import { applyHomography, homographyForPlane, type Point, type WallPlane } from './wall-plane';

/** Texture a perspective quadrilateral with small affine triangles (Canvas 2D). */
export function drawProjectedImage(context: CanvasRenderingContext2D, image: HTMLImageElement, plane: WallPlane, position: {x:number;y:number;width:number}, ratio: number, width: number, height: number) {
  const matrix = homographyForPlane(plane);
  const layer = document.createElement('canvas');
  layer.width = width; layer.height = height;
  const ctx = layer.getContext('2d');
  if (!ctx) throw new Error('Your browser could not render the wall perspective.');
  const project = (u: number, v: number): Point => { const p = applyHomography(matrix, {x:position.x-position.width/2+u*position.width,y:position.y-position.width*ratio/2+v*position.width*ratio}); return {x:p.x*width,y:p.y*height}; };
  function triangle(source: Point[], destination: Point[]) {
    const [s0,s1,s2]=source, [t0,t1,t2]=destination;
    const denominator=s0.x*(s1.y-s2.y)+s1.x*(s2.y-s0.y)+s2.x*(s0.y-s1.y);
    const a=(t0.x*(s1.y-s2.y)+t1.x*(s2.y-s0.y)+t2.x*(s0.y-s1.y))/denominator;
    const c=(t0.x*(s2.x-s1.x)+t1.x*(s0.x-s2.x)+t2.x*(s1.x-s0.x))/denominator;
    const b=(t0.y*(s1.y-s2.y)+t1.y*(s2.y-s0.y)+t2.y*(s0.y-s1.y))/denominator;
    const d=(t0.y*(s2.x-s1.x)+t1.y*(s0.x-s2.x)+t2.y*(s1.x-s0.x))/denominator;
    ctx!.save(); ctx!.beginPath();ctx!.moveTo(t0.x,t0.y);ctx!.lineTo(t1.x,t1.y);ctx!.lineTo(t2.x,t2.y);ctx!.closePath();ctx!.clip();
    ctx!.setTransform(a,b,c,d,t0.x-a*s0.x-c*s0.y,t0.y-b*s0.x-d*s0.y);
    ctx!.drawImage(image,0,0);ctx!.restore();
  }
  const columns=24,rows=12;
  for(let y=0;y<rows;y++) for(let x=0;x<columns;x++) {
    const uv=[{x:x/columns,y:y/rows},{x:(x+1)/columns,y:y/rows},{x:(x+1)/columns,y:(y+1)/rows},{x:x/columns,y:(y+1)/rows}];
    const source=uv.map(p=>({x:p.x*image.naturalWidth,y:p.y*image.naturalHeight}));
    const destination=uv.map(p=>project(p.x,p.y));
    triangle([source[0],source[1],source[2]],[destination[0],destination[1],destination[2]]);
    triangle([source[0],source[2],source[3]],[destination[0],destination[2],destination[3]]);
  }
  context.drawImage(layer,0,0);
}
