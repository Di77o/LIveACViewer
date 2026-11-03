import { validateWallPlane, type Point, type WallPlane } from '../../src/lib/wall-plane.js';
export type WallCandidate = {corners:WallPlane; areaFraction:number; maskCoverage:number};
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function hull(points:Point[]):Point[]{
  const sorted=points.sort((a,b)=>a.x-b.x||a.y-b.y), lower:Point[]=[],upper:Point[]=[];
  for(const p of sorted){while(lower.length>=2&&cross(lower.at(-2)!,lower.at(-1)!,p)<=0)lower.pop();lower.push(p);}
  for(const p of [...sorted].reverse()){while(upper.length>=2&&cross(upper.at(-2)!,upper.at(-1)!,p)<=0)upper.pop();upper.push(p);}
  return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
function area(points:Point[]){return Math.abs(points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a.x*b.y-a.y*b.x;},0))/2;}
/** Fit conservative quads to actual connected wall regions; no full-image fallback. */
export function wallCandidates(mask:Uint8Array,width:number,height:number):WallCandidate[]{
  if(mask.length!==width*height)throw new Error('Mask dimensions do not match.');
  const visited=new Uint8Array(mask.length),candidates:WallCandidate[]=[];
  for(let start=0;start<mask.length;start++){
    if(!mask[start]||visited[start])continue;
    const queue=[start];visited[start]=1;const pixels:number[]=[];
    for(let head=0;head<queue.length;head++){
      const i=queue[head];pixels.push(i);const x=i%width,y=Math.floor(i/width);
      for(const [nx,ny]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
        if(nx<0||nx>=width||ny<0||ny>=height)continue;const next=ny*width+nx;
        if(mask[next]&&!visited[next]){visited[next]=1;queue.push(next);}
      }
    }
    const areaFraction=pixels.length/mask.length;if(areaFraction<.035)continue;
    const boundary:Point[]=[];
    for(const i of pixels){const x=i%width,y=Math.floor(i/width);if(x===0||y===0||x===width-1||y===height-1||!mask[i-1]||!mask[i+1]||!mask[i-width]||!mask[i+width]){
      for(const [dx,dy]of [[0,0],[1,0],[1,1],[0,1]])boundary.push({x:(x+dx)/width,y:(y+dy)/height});
    }}
    const polygon=hull(boundary), hullArea=area(polygon);
    while(polygon.length>4){let index=0,min=Infinity;for(let i=0;i<polygon.length;i++){const loss=Math.abs(cross(polygon[(i+polygon.length-1)%polygon.length],polygon[i],polygon[(i+1)%polygon.length]));if(loss<min){min=loss;index=i;}}polygon.splice(index,1);}
    if(polygon.length!==4||area(polygon)<hullArea*.68)continue;
    let first=0;for(let i=1;i<4;i++)if(polygon[i].x+polygon[i].y<polygon[first].x+polygon[first].y)first=i;
    const corners=[...polygon.slice(first),...polygon.slice(0,first)];
    if(validateWallPlane(corners))candidates.push({corners,areaFraction,maskCoverage:Math.min(1,areaFraction/area(corners))});
  }
  return candidates.sort((a,b)=>b.areaFraction-a.areaFraction).slice(0,3);
}
