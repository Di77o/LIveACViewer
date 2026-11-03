import {useEffect,useRef} from 'react';
import {drawUnit3D,type Unit3DProjection} from '../lib/unit-3d';
import {getUnitDesign} from '../lib/unit-model-design';
import {loadUnitTextures} from '../lib/unit-textures';
import type {ACModel} from '../data/catalog';
export const unitBodyColor=(model:ACModel)=>getUnitDesign(model).materials.body.color;
/** One renderer for screen and export avoids CSS projective-image tiling artifacts.
 * CSS keeps this canvas at the photo's size; the bitmap alone scales with DPR.
 * Using its intrinsic bitmap size for layout moves the painting away from the
 * normalized projection bounds used by the placement control on Retina screens.
 */
export default function Unit3DOverlay({projection,model,width,height}:{projection:Unit3DProjection;model:ACModel;width:number;height:number}){
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{let cancelled=false;const el=canvas.current;if(!el)return;el.dataset.rendered='false';
    void loadUnitTextures(model).then(textures=>{if(cancelled)return;const ratio=Math.min(2,window.devicePixelRatio||1);el.width=Math.max(1,Math.round(width*ratio));el.height=Math.max(1,Math.round(height*ratio));const ctx=el.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,el.width,el.height);drawUnit3D(ctx,textures.front,projection,el.width,el.height,{bodyColor:unitBodyColor(model),sideTextures:textures.sides});el.dataset.rendered='true';});
    return()=>{cancelled=true;};
  },[projection,model,width,height]);
  return <canvas ref={canvas} className="unit-depth-scene" data-visible-faces={projection.sides.length} role="img" aria-label={`${model.name} dimension-based 3D preview`}/>;
}
