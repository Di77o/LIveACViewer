import {useEffect,useRef} from 'react';
import {drawUnit3D,type Unit3DProjection} from '../lib/unit-3d';
import {unitSvg} from './UnitArtwork';
import type {ACModel} from '../data/catalog';
export const unitBodyColor=(model:ACModel)=>model.visualVariant==='gallery'?'#bba07b':model.visualVariant==='mirror'?'#35383c':'#d9dcd7';
const textures=new Map<string,Promise<HTMLImageElement>>();
function texture(model:ACModel){const key=model.id;let pending=textures.get(key);if(!pending){pending=(async()=>{const image=new Image();image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(unitSvg(model))}`;await image.decode();return image;})();textures.set(key,pending);}return pending;}
/** One renderer for screen and export avoids CSS projective-image tiling artifacts.
 * CSS keeps this canvas at the photo's size; the bitmap alone scales with DPR.
 * Using its intrinsic bitmap size for layout moves the painting away from the
 * normalized projection bounds used by the placement control on Retina screens.
 */
export default function Unit3DOverlay({projection,model,width,height}:{projection:Unit3DProjection;model:ACModel;width:number;height:number}){
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{let cancelled=false;const el=canvas.current;if(!el)return;el.dataset.rendered='false';
    void texture(model).then(image=>{if(cancelled)return;const ratio=Math.min(2,window.devicePixelRatio||1);el.width=Math.max(1,Math.round(width*ratio));el.height=Math.max(1,Math.round(height*ratio));const ctx=el.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,el.width,el.height);drawUnit3D(ctx,image,projection,el.width,el.height,{bodyColor:unitBodyColor(model)});el.dataset.rendered='true';});
    return()=>{cancelled=true;};
  },[projection,model,width,height]);
  return <canvas ref={canvas} className="unit-depth-scene" data-visible-faces={projection.sides.length} role="img" aria-label={`${model.name} dimension-based 3D preview`}/>;
}
