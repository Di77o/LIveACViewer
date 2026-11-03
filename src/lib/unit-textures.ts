import {unitSvg} from '../components/UnitArtwork';
import {unitSideSvg,type UnitFaceKind} from './unit-model-design';
import type {ACModel} from '../data/catalog';
export type UnitTextures={front:HTMLImageElement;sides:Record<UnitFaceKind,HTMLImageElement>};
const cache=new Map<string,Promise<UnitTextures>>();
async function decode(svg:string){const image=new Image();image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;await image.decode();return image;}
export function loadUnitTextures(model:ACModel):Promise<UnitTextures>{
  let pending=cache.get(model.id);
  if(!pending){pending=(async()=>{const [front,top,right,bottom,left]=await Promise.all([decode(unitSvg(model)),...(['top','right','bottom','left'] as const).map(face=>decode(unitSideSvg(model,face)))]);return {front,sides:{top,right,bottom,left}};})();cache.set(model.id,pending);}
  return pending;
}
