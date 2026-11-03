import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {warmDetector,detectFastWall} from '../server/vision/fast-wall';
import type {WallPlane} from '../src/lib/wall-plane';
type Entry={image:string;expected?:'wall'|'no-wall';referencePlane?:WallPlane};
const args=process.argv.slice(2),mi=args.indexOf('--manifest'),oi=args.indexOf('--output');
const entries:Entry[]=mi>=0?JSON.parse(await readFile(args[mi+1],'utf8')):args.filter(a=>!a.startsWith('--')).map(image=>({image}));
if(!entries.length)entries.push({image:'public/sample-room.jpg'});
function inside(poly:WallPlane,x:number,y:number){return poly.every((a,i)=>{const b=poly[(i+1)%4];return (b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x)>=0;});}
function iou(a:WallPlane,b:WallPlane){let intersection=0,union=0;for(let y=0;y<128;y++)for(let x=0;x<128;x++){const pa=inside(a,(x+.5)/128,(y+.5)/128),pb=inside(b,(x+.5)/128,(y+.5)/128);if(pa&&pb)intersection++;if(pa||pb)union++;}return intersection/union;}
const coldStart=performance.now();await warmDetector();const warmupMs=Math.round(performance.now()-coldStart);
const results=[];
for(const entry of entries){
 const image='data:image/jpeg;base64,'+(await readFile(entry.image)).toString('base64');const times:number[]=[];let wall;
 for(let i=0;i<3;i++){wall=await detectFastWall(image);times.push(wall.timingMs);}
 const overlap=wall!.corners&&entry.referencePlane?iou(wall!.corners,entry.referencePlane):null;
 results.push({image:entry.image,warmMs:times,planeFound:Boolean(wall!.corners),planeIoU:overlap,expected:entry.expected,success:entry.expected==='no-wall'?!wall!.corners:entry.expected==='wall'?Boolean(wall!.corners)&&(overlap===null||overlap>=.5):null,corners:wall!.corners});
}
const times=results.flatMap(r=>r.warmMs).sort((a,b)=>a-b),labelled=results.filter(r=>r.success!==null);
const report={hardware:{platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,availableParallelism:os.availableParallelism()},model:'UPerNet / ConvNeXt-Tiny INT8, CPU, 512px',warmupMs,threads:process.env.WALL_CPU_THREADS||'2',p50Ms:times[Math.floor(times.length*.5)],p95Ms:times[Math.min(times.length-1,Math.floor(times.length*.95))],labelledCases:labelled.length,passed:labelled.filter(r=>r.success).length,metric:'Coarse suggested-plane IoU >= 0.5 against hand-marked reference quad (not pixel accuracy or installation suitability). Small fixtures are smoke tests, not evidence of 90% customer acceptance.',results};
console.log(JSON.stringify(report,null,2));if(oi>=0)await writeFile(path.resolve(args[oi+1]),JSON.stringify(report,null,2)+'\n');
