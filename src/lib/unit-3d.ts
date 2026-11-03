import {homographyForPlane,invertHomography, type Point, type WallPlane} from './wall-plane';
import type {Position} from './placement';
import type {UnitProfileStation,UnitFaceKind} from './unit-model-design';
type V=[number,number,number];
const add=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scale=(a:V,s:number):V=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(a:V)=>Math.hypot(...a);
const unit=(a:V):V=>{const n=norm(a);if(n<1e-8)throw new RangeError('Wall directions are degenerate.');return scale(a,1/n);};
export type Unit3DProjection={front:WallPlane;back:WallPlane;center:Point;frontCenter:Point;sides:{points:WallPlane;shade:number;kind:string;face?:UnitFaceKind;depthStart?:number;depthEnd?:number}[];bounds:{left:number;top:number;width:number;height:number};camera:{estimated:true;source:'manual'|'vanishing-points'|'assumed';fovDegrees:number;orthogonalityErrorDegrees:number;wallAspect:number};dimensions:{widthMm:number;heightMm:number;depthMm:number}};
/** Pinhole projection of a dimensioned box, not a stretched front image.
 * Its center is anchored to the selected wall; orthogonal local axes preserve
 * physical product shape. Camera/focal length remain estimates from one photo.
 */
export function projectUnit3D(plane:WallPlane,position:Position,model:{widthMm:number;heightMm:number;depthMm:number},imageWidth:number,imageHeight:number,options:{depthScale?:number;fovDegrees?:number;casingProfile?:UnitProfileStation[]}={}):Unit3DProjection{
  if(![imageWidth,imageHeight,model.widthMm,model.heightMm,model.depthMm,position.width].every(n=>Number.isFinite(n)&&n>0)||![position.x,position.y].every(Number.isFinite))throw new RangeError('Invalid 3D dimensions.');
  const h=homographyForPlane(plane),cx=imageWidth/2,cy=imageHeight/2;
  const columns:V[]=[[h[0]*imageWidth,h[3]*imageHeight,h[6]],[h[1]*imageWidth,h[4]*imageHeight,h[7]],[h[2]*imageWidth,h[5]*imageHeight,h[8]]];
  const [a,b]=columns;let fov=options.fovDegrees??55,source:'manual'|'vanishing-points'|'assumed'=options.fovDegrees===undefined?'assumed':'manual';
  if(options.fovDegrees===undefined&&Math.abs(a[2]*b[2])>1e-7){
    const f2=-((a[0]-cx*a[2])*(b[0]-cx*b[2])+(a[1]-cy*a[2])*(b[1]-cy*b[2]))/(a[2]*b[2]);
    const candidate=f2>0?2*Math.atan(imageWidth/(2*Math.sqrt(f2)))*180/Math.PI:NaN;
    if(candidate>=30&&candidate<=95){fov=candidate;source='vanishing-points';}
  }
  if(fov<25||fov>100)throw new RangeError('Camera view angle must be between 25 and 100 degrees.');
  const f=imageWidth/(2*Math.tan(fov*Math.PI/360));
  const camera=columns.map(([x,y,z])=>[(x-cx*z)/f,(y-cy*z)/f,z] as V);
  const r1=unit(camera[0]),raw2=unit(camera[1]),r2=unit(add(raw2,scale(r1,-dot(raw2,r1))));
  const center3=add(add(scale(camera[0],position.x),scale(camera[1],position.y)),camera[2]);
  let normal=unit(cross(r1,r2));if(dot(normal,center3)>0)normal=scale(normal,-1);
  const width=norm(camera[0])*position.width,height=width*model.heightMm/model.widthMm;
  const depthScale=options.depthScale??1;if(!Number.isFinite(depthScale)||depthScale<0||depthScale>2)throw new RangeError('Invalid depth scale.');
  const depth=width*model.depthMm/model.widthMm*depthScale;
  const stations=options.casingProfile||[{depthFraction:0,topInsetMm:0,bottomInsetMm:0,sideInsetMm:0},{depthFraction:1,topInsetMm:0,bottomInsetMm:0,sideInsetMm:0}];
  if(stations.length<2||stations[0].depthFraction!==0||stations.at(-1)!.depthFraction!==1||stations.some((s,i)=>![s.depthFraction,s.topInsetMm,s.bottomInsetMm,s.sideInsetMm].every(Number.isFinite)||s.topInsetMm<0||s.bottomInsetMm<0||s.sideInsetMm<0||s.topInsetMm+s.bottomInsetMm>=model.heightMm||s.sideInsetMm*2>=model.widthMm||(i>0&&s.depthFraction<=stations[i-1].depthFraction)))throw new RangeError('Invalid casing cross-section.');
  const mm=width/model.widthMm;
  const rings3=stations.map(s=>[[-width/2+s.sideInsetMm*mm,-height/2+s.topInsetMm*mm],[width/2-s.sideInsetMm*mm,-height/2+s.topInsetMm*mm],[width/2-s.sideInsetMm*mm,height/2-s.bottomInsetMm*mm],[-width/2+s.sideInsetMm*mm,height/2-s.bottomInsetMm*mm]].map(([x,y])=>add(add(center3,add(scale(r1,x),scale(r2,y))),scale(normal,depth*s.depthFraction))));
  const back3=rings3[0],front3=rings3.at(-1)!;
  const project=([x,y,z]:V):Point=>{if(z<=1e-5)throw new RangeError('Unit is too close to the estimated camera.');return {x:(f*x/z+cx)/imageWidth,y:(f*y/z+cy)/imageHeight};};
  const rings=rings3.map(ring=>ring.map(project) as WallPlane),back=rings[0],front=rings.at(-1)!;
  const kinds:UnitFaceKind[]=['top','right','bottom','left'],shades=[1.08,.78,.63,.88];
  const sides:Unit3DProjection['sides']=[];
  if(depth>1e-8)for(let station=0;station<rings3.length-1;station++)for(let i=0;i<4;i++){
    const j=(i+1)%4,a=rings3[station],b=rings3[station+1];
    const edge=add(a[j],scale(a[i],-1)),outward=add(b[i],scale(a[i],-1)),faceNormal=cross(outward,edge);
    if(norm(faceNormal)<1e-12)continue;
    const mid=scale([a[i],a[j],b[j],b[i]].reduce(add,[0,0,0] as V),.25);
    if(dot(unit(faceNormal),scale(mid,-1))>1e-8){
      const facing=Math.max(0,dot(unit(faceNormal),unit(scale(mid,-1))));
      sides.push({points:[rings[station][i],rings[station][j],rings[station+1][j],rings[station+1][i]] as WallPlane,shade:shades[i]*(.88+facing*.12),kind:`${kinds[i]}-${station}`,face:kinds[i],depthStart:stations[station].depthFraction,depthEnd:stations[station+1].depthFraction});
    }
  }
  const all=rings.flat();if(all.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>4||Math.abs(p.y)>4))throw new RangeError('Refine the wall corners for a stable camera estimate.');
  const left=Math.min(...all.map(p=>p.x)),top=Math.min(...all.map(p=>p.y));
  return {front,back,center:project(center3),frontCenter:project(scale(front3.reduce(add,[0,0,0] as V),.25)),sides,bounds:{left,top,width:Math.max(...all.map(p=>p.x))-left,height:Math.max(...all.map(p=>p.y))-top},camera:{estimated:true,source,fovDegrees:fov,wallAspect:norm(camera[0])/norm(camera[1]),orthogonalityErrorDegrees:Math.abs(90-Math.acos(Math.max(-1,Math.min(1,dot(r1,raw2))))*180/Math.PI)},dimensions:{widthMm:model.widthMm,heightMm:model.heightMm,depthMm:model.depthMm}};
}
/** Homography for a small projected front; unlike a wall, it can be <2% of a photo. */
function quadMatrix([p0,p1,p2,p3]:WallPlane){
  const dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x,dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y;
  let g=0,h=0;if(Math.abs(dx3)+Math.abs(dy3)>1e-12){const det=dx1*dy2-dx2*dy1;if(Math.abs(det)<1e-12)throw new RangeError('Degenerate unit face.');g=(dx3*dy2-dx2*dy3)/det;h=(dx1*dy3-dx3*dy1)/det;}
  return [p1.x-p0.x+g*p1.x,p3.x-p0.x+h*p3.x,p0.x,p1.y-p0.y+g*p1.y,p3.y-p0.y+h*p3.y,p0.y,g,h,1];
}
export function cssQuadTransform(quad:WallPlane,widthPx:number,heightPx:number){const[a,b,c,d,e,f,g,h,i]=quadMatrix(quad);return `matrix3d(${[a,d*heightPx/widthPx,0,g/widthPx,b*widthPx/heightPx,e,0,h/heightPx,0,0,1,0,c*widthPx,f*heightPx,0,i].join(',')})`;}
export function shadedColor(hex:string,shade:number){const rgb=hex.replace('#','').match(/../g)!.map(c=>Math.max(0,Math.min(255,Math.round(parseInt(c,16)*shade))));return `rgb(${rgb.join(',')})`;}
const texturePixels=new WeakMap<HTMLImageElement,ImageData>();
function paintTexture(ctx:CanvasRenderingContext2D,image:HTMLImageElement,face:WallPlane,width:number,height:number,vStart=0,vEnd=1,shade=1){
  let source=texturePixels.get(image);
  if(!source){const sourceCanvas=document.createElement('canvas');sourceCanvas.width=image.naturalWidth;sourceCanvas.height=image.naturalHeight;const sourceContext=sourceCanvas.getContext('2d')!;sourceContext.drawImage(image,0,0);source=sourceContext.getImageData(0,0,sourceCanvas.width,sourceCanvas.height);texturePixels.set(image,source);}
  const left=Math.max(0,Math.floor(Math.min(...face.map(p=>p.x))*width)),top=Math.max(0,Math.floor(Math.min(...face.map(p=>p.y))*height));
  const right=Math.min(width,Math.ceil(Math.max(...face.map(p=>p.x))*width)),bottom=Math.min(height,Math.ceil(Math.max(...face.map(p=>p.y))*height));
  if(right<=left||bottom<=top)return;
  const inverse=invertHomography(quadMatrix(face));
  const output=document.createElement('canvas');output.width=right-left;output.height=bottom-top;const out=output.getContext('2d')!,bitmap=out.createImageData(output.width,output.height),sw=source.width,sh=source.height;
  for(let y=0;y<output.height;y++)for(let x=0;x<output.width;x++){
    const px=(left+x+.5)/width,py=(top+y+.5)/height,den=inverse[6]*px+inverse[7]*py+inverse[8];
    const u=(inverse[0]*px+inverse[1]*py+inverse[2])/den,v=(inverse[3]*px+inverse[4]*py+inverse[5])/den;
    if(u<0||u>1||v<0||v>1)continue;
    const sx=Math.max(0,Math.min(sw-1,u*sw-.5)),sy=Math.max(0,Math.min(sh-1,(vStart+(vEnd-vStart)*v)*sh-.5)),x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(sw-1,x0+1),y1=Math.min(sh-1,y0+1),fx=sx-x0,fy=sy-y0,index=(y*output.width+x)*4;
    for(let c=0;c<4;c++)bitmap.data[index+c]=(source.data[(y0*sw+x0)*4+c]*(1-fx)*(1-fy)+source.data[(y0*sw+x1)*4+c]*fx*(1-fy)+source.data[(y1*sw+x0)*4+c]*(1-fx)*fy+source.data[(y1*sw+x1)*4+c]*fx*fy)*(c===3?1:shade);
  }
  out.putImageData(bitmap,0,0);ctx.drawImage(output,left,top);
}
export function drawUnit3D(ctx:CanvasRenderingContext2D,image:HTMLImageElement,projection:Unit3DProjection,width:number,height:number,options:{bodyColor?:string;shadow?:boolean;sideTextures?:Partial<Record<UnitFaceKind,HTMLImageElement>>}={}){
  const color=options.bodyColor||'#d8dbd7';
  const polygon=(points:Point[])=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x*width,p.y*height):ctx.moveTo(p.x*width,p.y*height));ctx.closePath();};
  ctx.save();if(options.shadow!==false){ctx.shadowColor='#0005';ctx.shadowBlur=9;ctx.shadowOffsetY=5;}polygon(projection.back);ctx.fillStyle=shadedColor(color,.7);ctx.fill();ctx.restore();
  for(const side of projection.sides){polygon(side.points);ctx.fillStyle=shadedColor(color,side.shade);ctx.fill();const texture=side.face?options.sideTextures?.[side.face]:undefined;if(texture)paintTexture(ctx,texture,side.points,width,height,side.depthStart??0,side.depthEnd??1,side.shade);}
  polygon(projection.front);ctx.fillStyle=color;ctx.fill();paintTexture(ctx,image,projection.front,width,height);
}
