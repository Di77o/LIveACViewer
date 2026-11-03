import {validateWallPlane,type Point,type WallPlane} from '../../src/lib/wall-plane.js';
export type ImageLine={start:Point;end:Point;strength:number;kind:'horizontal'|'vertical'};
type Line={nx:number;ny:number;rho:number;support:number};
const intersection=(a:Line,b:Line):Point|null=>{const d=a.nx*b.ny-b.nx*a.ny;return Math.abs(d)<1e-6?null:{x:(a.rho*b.ny-b.rho*a.ny)/d,y:(a.nx*b.rho-b.nx*a.rho)/d};};
/** Constrained edge voting only near an existing semantic wall boundary.
 * A ceiling seam can refine the mask; an interior television edge cannot replace it.
 */
export function refineWallWithLines(plane:WallPlane,pixels:Uint8Array,width:number,height:number,channels:number):{corners:WallPlane;lines:ImageLine[];refined:boolean}{
  if(!validateWallPlane(plane)||width<8||height<8||pixels.length!==width*height*channels||channels<1)throw new Error('Invalid image or wall plane.');
  const gray=new Float32Array(width*height),gx=new Float32Array(gray.length),gy=new Float32Array(gray.length),mag=new Float32Array(gray.length);
  for(let i=0;i<gray.length;i++)gray[i]=channels===1?pixels[i]:(pixels[i*channels]*.299+pixels[i*channels+1]*.587+pixels[i*channels+2]*.114);
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=y*width+x;gx[i]=-gray[i-width-1]+gray[i-width+1]-2*gray[i-1]+2*gray[i+1]-gray[i+width-1]+gray[i+width+1];gy[i]=-gray[i-width-1]-2*gray[i-width]-gray[i-width+1]+gray[i+width-1]+2*gray[i+width]+gray[i+width+1];mag[i]=Math.hypot(gx[i],gy[i]);}
  const points=plane.map(p=>({x:p.x*width,y:p.y*height})), fitted:Line[]=[],guides:ImageLine[]=[],maxShift=Math.min(width,height)*.045;
  for(let edge=0;edge<4;edge++){
    const a=points[edge],b=points[(edge+1)%4],length=Math.hypot(b.x-a.x,b.y-a.y),tx=(b.x-a.x)/length,ty=(b.y-a.y)/length,nx=-ty,ny=tx;
    const original={nx,ny,rho:nx*a.x+ny*a.y,support:0};
    if(length<Math.min(width,height)*.15){fitted.push(original);continue;}
    const nearby:number[]=[];
    const xmin=Math.max(1,Math.floor(Math.min(a.x,b.x)-maxShift)),xmax=Math.min(width-2,Math.ceil(Math.max(a.x,b.x)+maxShift)),ymin=Math.max(1,Math.floor(Math.min(a.y,b.y)-maxShift)),ymax=Math.min(height-2,Math.ceil(Math.max(a.y,b.y)+maxShift));
    for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){const i=y*width+x,along=(x-a.x)*tx+(y-a.y)*ty;if(mag[i]>55&&along>-.04*length&&along<1.04*length&&Math.abs((x-a.x)*nx+(y-a.y)*ny)<maxShift&&Math.abs(gx[i]*nx+gy[i]*ny)/mag[i]>.8)nearby.push(i);}
    let best=original,bestScore=0;
    const bins=2*Math.ceil(maxShift)+1,mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    for(let degrees=-10;degrees<=10;degrees+=1){const angle=degrees*Math.PI/180,nxx=nx*Math.cos(angle)-ny*Math.sin(angle),nyy=nx*Math.sin(angle)+ny*Math.cos(angle),scores=new Float32Array(bins);
      for(const i of nearby){const x=i%width,y=Math.floor(i/width),offset=Math.round((x-mid.x)*nxx+(y-mid.y)*nyy)+Math.floor(bins/2);if(offset>=0&&offset<bins)scores[offset]+=Math.min(150,mag[i]);}
      for(let bin=0;bin<bins;bin++){
        const shift=bin-Math.floor(bins/2),penalty=1+Math.abs(shift)/maxShift*.35+Math.abs(degrees)*.015,score=scores[bin]/penalty;
        if(score>bestScore){bestScore=score;best={nx:nxx,ny:nyy,rho:nxx*mid.x+nyy*mid.y+shift,support:0};}
      }
    }
    const occupied=new Uint8Array(24);let hits=0;
    for(const i of nearby){const x=i%width,y=Math.floor(i/width);if(Math.abs(best.nx*x+best.ny*y-best.rho)<1.8){const along=(x-a.x)*tx+(y-a.y)*ty;const bin=Math.floor(along/length*24);if(bin>=0&&bin<24){occupied[bin]=1;hits++;}}}
    const coverage=occupied.reduce((sum,n)=>sum+n,0)/24;
    if(coverage<.6||hits<length*.4||bestScore<length*25){fitted.push(original);continue;}
    best.support=coverage;fitted.push(best);
    const projected=(p:Point)=>{const d=best.nx*p.x+best.ny*p.y-best.rho;return{x:(p.x-best.nx*d)/width,y:(p.y-best.ny*d)/height};};
    guides.push({start:projected(a),end:projected(b),strength:coverage,kind:edge%2===0?'horizontal':'vertical'});
  }
  if(!guides.length)return {corners:plane,lines:[],refined:false};
  const corners=points.map((_,i)=>intersection(fitted[(i+3)%4],fitted[i])).map(p=>p?{x:p.x/width,y:p.y/height}:null);
  if(corners.some((p,i)=>!p||Math.hypot(p.x-plane[i].x,p.y-plane[i].y)>.065)||!validateWallPlane(corners))return {corners:plane,lines:[],refined:false};
  const refined=corners.some((p,i)=>Math.hypot(p.x-plane[i].x,p.y-plane[i].y)>.002);
  return {corners:corners as WallPlane,lines:guides,refined};
}
