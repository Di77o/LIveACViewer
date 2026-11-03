import { mapToWall, type Point, type WallPlane } from './wall-plane';
/** A measured horizontal segment on this same wall determines its full width. */
export function widthFromReference(plane: WallPlane, points: [Point,Point], referenceCm: number): number {
  if(!Number.isFinite(referenceCm)||referenceCm<5||referenceCm>1000) throw new Error('Enter a measured reference width between 5 and 1000 cm.');
  const [a,b]=points.map(p=>mapToWall(plane,p));
  if([a,b].some(p=>p.x<0||p.x>1||p.y<0||p.y>1)) throw new Error('Mark both reference ends inside the selected wall.');
  if(Math.abs(a.y-b.y)>.08) throw new Error('Choose a horizontal reference on the wall: both ends should be at the same wall height.');
  const fraction=Math.abs(a.x-b.x);
  if(fraction<.03) throw new Error('Choose reference ends farther apart for a more useful scale.');
  const width=referenceCm/fraction;
  if(width<100||width>2000) throw new Error('This reference implies a wall outside 100–2000 cm. Check the corners, endpoints and measurement.');
  return Math.round(width);
}
