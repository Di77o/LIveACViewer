import type { PointerEvent } from 'react';
import { validateWallPlane, type Point, type WallPlane } from '../lib/wall-plane';

const names = ['Top left', 'Top right', 'Bottom right', 'Bottom left'];
export default function WallOverlay({ plane, draft, suggestion, marking, onChange }: {
  plane: WallPlane | null; draft: Point[]; suggestion: WallPlane | null; marking: boolean; onChange: (plane: WallPlane) => void;
}) {
  const points = marking ? draft : suggestion || plane || [];
  function moveCorner(event: PointerEvent<HTMLButtonElement>, index: number) {
    if (!plane || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const rect = event.currentTarget.closest('.room-stage')!.getBoundingClientRect();
    const next = plane.map((point, i) => i === index ? { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) } : point);
    if (validateWallPlane(next)) onChange(next);
  }
  return <div className={`wall-overlay ${marking ? 'marking' : ''}`} aria-label="Wall plane boundary">
    <svg className="wall-outline" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      {points.length > 1 && (points.length === 4 ? <polygon points={points.map(p => `${p.x * 1000},${p.y * 1000}`).join(' ')} /> : <polyline points={points.map(p => `${p.x * 1000},${p.y * 1000}`).join(' ')} />)}
    </svg>
    {points.map((point, i) => plane && !marking && !suggestion ? <button key={i} className="wall-corner" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-label={`${names[i]} wall corner. Drag or use arrow keys to adjust.`}
      onPointerDown={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => moveCorner(e, i)} onPointerUp={e => { e.stopPropagation(); e.currentTarget.releasePointerCapture(e.pointerId); }} onClick={e => e.stopPropagation()}
      onKeyDown={e => { const deltas: Record<string, Point> = { ArrowLeft: {x:-.005,y:0}, ArrowRight:{x:.005,y:0}, ArrowUp:{x:0,y:-.005}, ArrowDown:{x:0,y:.005} }; const delta = deltas[e.key]; if (!delta) return; e.preventDefault(); const next = plane.map((p,j) => j===i ? {x:p.x+delta.x,y:p.y+delta.y} : p); if(validateWallPlane(next)) onChange(next); }}>{i + 1}</button> : <span key={i} className="wall-corner wall-marker" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}>{i + 1}</span>)}
  </div>;
}
