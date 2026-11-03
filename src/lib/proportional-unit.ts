import { mapFromWall, type WallPlane } from './wall-plane';
import type { Position } from './placement';
/** Anchor to the wall but retain the manufacturer's front-view aspect ratio. */
export function proportionalUnit(plane: WallPlane, position: Position, imageAspect: number) {
  const center=mapFromWall(plane,position);
  const left=mapFromWall(plane,{x:position.x-position.width/2,y:position.y});
  const right=mapFromWall(plane,{x:position.x+position.width/2,y:position.y});
  const dx=right.x-left.x, dy=(right.y-left.y)/imageAspect;
  return {x:center.x,y:center.y,width:Math.hypot(dx,dy),angle:Math.atan2(dy,dx)};
}
