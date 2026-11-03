import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Camera, Check, ChevronDown, Expand, Eye, EyeOff, ImagePlus, Info, Leaf, LoaderCircle, Move, RotateCcw, ShieldCheck, Sparkles, Upload, Wind, X } from 'lucide-react';
import { models, type ACModel } from './data/catalog';
import { widthFromReference } from './lib/reference-scale';
import { proportionalUnit } from './lib/proportional-unit';
import WallOverlay from './components/WallOverlay';
import { mapToWall, validateWallPlane, wallTransform, type Point, type WallPlane } from './lib/wall-plane';
import { drawProjectedImage } from './lib/projective-canvas';
import UnitArtwork, { unitSvg } from './components/UnitArtwork';
import { approximateWidth, constrainPosition, unitHeight, type Position } from './lib/placement';
import { loadImage, preparePhoto } from './lib/photo';

type Recommendation = Position & { summary: string; reasoning: string[]; warnings: string[]; confidence: 'low' | 'medium' | 'high' };
type WallSuggestion = { corners: WallPlane | null; confidence: 'low'|'medium'|'high'; summary: string; warnings: string[]; widthGuess?: {minCm:number;maxCm:number;basis:string}|null };
type Photo = { src: string; width: number; height: number; isSample: boolean; name: string };
const staticHosted = Boolean((window as Window & { __LIVEAC_STATIC__?: boolean }).__LIVEAC_STATIC__);
const localMode = staticHosted || window.location.protocol === 'file:' || Boolean((window as Window & { __LIVEAC_LOCAL__?: boolean }).__LIVEAC_LOCAL__);
const sample: Photo = { src: '/sample-room.jpg', width: 1600, height: 1200, isSample: true, name: 'The sunlit living room' };

function Unit({ model, className = '' }: { model: ACModel; className?: string }) {
  if (model.imageUrl) return <img className={`unit-image ${className}`} src={model.imageUrl} alt={model.name} draggable={false} />;
  return <div className={`unit-render ${model.finish.toLowerCase().includes('black') ? 'unit-dark' : ''} ${className}`}><span className="unit-brand">LG</span><span className="unit-vent" /></div>;
}

export default function App() {
  const [selected, setSelected] = useState(models[0]);
  const [photo, setPhoto] = useState<Photo>(sample);
  const [preserveProportions,setPreserveProportions]=useState(true);
  const [wallWidth, setWallWidth] = useState(420);
  const [referencePoints,setReferencePoints]=useState<Point[]|null>(null);
  const [referenceCm,setReferenceCm]=useState(90);
  const [localReady,setLocalReady]=useState(false);
  const [scaleSource,setScaleSource]=useState('Manual estimate');
  const [wallHeight, setWallHeight] = useState(250);
  const [wallPlane, setWallPlane] = useState<WallPlane | null>(null);
  const [draftCorners, setDraftCorners] = useState<Point[]>([]);
  const [markingWall, setMarkingWall] = useState(false);
  const [wallSuggestion, setWallSuggestion] = useState<WallSuggestion | null>(null);
  const [stageSize, setStageSize] = useState({width: 1, height: 1});
  const [consentTask, setConsentTask] = useState<'placement'|'wall'|'local'>('placement');
  const [position, setPosition] = useState<Position>({ x: 0.4, y: 0.094, width: approximateWidth(models[0].widthMm, 420) });
  const [showUnit, setShowUnit] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<'photo' | 'ai' | 'wall' | 'save' | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [help, setHelp] = useState(false);
  const [consent, setConsent] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(localMode ? false : null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommendationApplied, setRecommendationApplied] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const photoVersion = useRef(0);
  const drag = useRef<{ pointer: number; startX: number; startY: number; original: Position } | null>(null);
  const aspect = photo.width / photo.height;
  const anchored = wallPlane&&preserveProportions?proportionalUnit(wallPlane,position,aspect):null;
  const displayPosition=anchored||position;
  const planeAspect = Math.max(100, wallWidth) / Math.max(100, wallHeight);
  const height = unitHeight(position.width, selected.widthMm, selected.heightMm, wallPlane&&!preserveProportions ? planeAspect : aspect);
  const displayHeight=anchored?unitHeight(anchored.width,selected.widthMm,selected.heightMm,aspect):height;
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(entries => { const rect = entries[0].contentRect; if(rect.width && rect.height) setStageSize({width:rect.width,height:rect.height}); });
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (localMode) return;
    fetch('/api/local-status').then(r=>r.json()).then(d=>setLocalReady(d.available===true)).catch(()=>{});
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => setAiConfigured(data.aiConfigured)).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (!expanded && !help && !consent) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setExpanded(false); setHelp(false); setConsent(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, help, consent]);

  useEffect(() => {
    if (!help && !consent) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('.modal');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex="0"]') || []).filter(el => !el.hasAttribute('disabled'));
    focusable()[0]?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', trap);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', trap); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [help, consent]);

  const clamp = (next: Position, model = selected) => constrainPosition(next, model.widthMm, model.heightMm, wallPlane ? planeAspect : aspect);
  function applyPlane(plane: WallPlane) {
    setWallPlane(plane); setMarkingWall(false); setDraftCorners([]); setWallSuggestion(null);
    setPosition(constrainPosition({x:.5,y:.22,width:approximateWidth(selected.widthMm,wallWidth)},selected.widthMm,selected.heightMm,planeAspect));
    setShowUnit(true); setRecommendation(null); setRecommendationApplied(false);
    setNotice('Wall plane set. The unit now follows its perspective. Drag the numbered corners to refine it.');
  }
  function clearPlane() {
    setReferencePoints(null);setWallPlane(null); setWallSuggestion(null); setMarkingWall(false); setDraftCorners([]); setRecommendation(null);
    setPosition(constrainPosition({x:.5,y:.22,width:approximateWidth(selected.widthMm,wallWidth)},selected.widthMm,selected.heightMm,aspect));
  }
  function markCorner(event: React.MouseEvent<HTMLDivElement>) {
    if(busy||!stage.current)return;
    if(referencePoints!==null&&wallPlane){
      const rect=stage.current.getBoundingClientRect();
      const next=[...referencePoints,{x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height}];
      if(next.length===2){try{const width=widthFromReference(wallPlane,next as [Point,Point],referenceCm);setWallWidth(width);setScaleSource('Measured horizontal reference');setPosition(constrainPosition({...position,width:approximateWidth(selected.widthMm,width)},selected.widthMm,selected.heightMm,width/Math.max(100,wallHeight)));setReferencePoints(null);setNotice(`Wall width estimated from your reference: ${width} cm.`);}catch(e){setError(e instanceof Error?e.message:'Check your reference.');setReferencePoints([]);}}else setReferencePoints(next);
      return;
    }
    if (!markingWall) return;
    const rect=stage.current.getBoundingClientRect();
    const next=[...draftCorners,{x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height}];
    if(next.length===4) {
      if(validateWallPlane(next)) applyPlane(next);
      else setError('Mark a clear rectangle in this order: top left, top right, bottom right, bottom left. Corners must not cross. Try the final corner again or start over.');
    } else setDraftCorners(next);
  }
  function beginAi(task: 'placement'|'wall'|'local') {
    if(task==='local'){if(localMode){setError('Local detection requires the Docker version. Your photo has not been sent.');return;}setConsentTask('local');setConsent(true);return;}
    if(aiConfigured===false) {
      setError(staticHosted ? 'AI isn’t connected on this version. Mark your wall manually and save your preview. Your photo has not been sent.' : localMode ? 'AI analysis needs the hosted or Docker version with an AI connection. This local file supports manual wall marking, placement and saving previews. Your photo has not been sent.' : 'AI placement isn’t connected yet. You can explore manually while the site owner connects the recommendation service. Your photo has not been sent.');
      return;
    }
    setConsentTask(task); setConsent(true);
  }
  function applyRecommendation() {
    if(!recommendation) return;
    if(wallPlane) {
      const center=mapToWall(wallPlane,recommendation);
      setPosition(clamp({...center,width:approximateWidth(selected.widthMm,wallWidth)}));
    } else setPosition(clamp(recommendation));
    setShowUnit(true);setRecommendationApplied(true);setNotice('Suggested position applied. You can still adjust it.');
  }
  function chooseModel(model: ACModel) {
    setSelected(model);
    setPosition(old => clamp({ ...old, width: approximateWidth(model.widthMm, wallWidth) }, model));
    setRecommendation(null);
    setRecommendationApplied(false);
    setShowUnit(true);
  }
  async function choosePhoto(file?: File) {
    if (!file || busy) return;
    setBusy('photo'); setError('');
    try {
      const next = await preparePhoto(file);
      photoVersion.current += 1;
      setPhoto({ ...next, name: file.name, isSample: false });
      setWallPlane(null);setMarkingWall(false);setDraftCorners([]);setWallSuggestion(null);setReferencePoints(null);setScaleSource('Manual estimate');
      setPosition(constrainPosition({ x: 0.5, y: 0.22, width: approximateWidth(selected.widthMm, wallWidth) }, selected.widthMm, selected.heightMm, next.width / next.height));
      setRecommendation(null); setRecommendationApplied(false); setShowUnit(true);
      setNotice('Your room is ready. Drag the unit to explore a position.');
    } catch (error) { setError(error instanceof Error ? error.message : 'The photo could not be opened.'); }
    finally { setBusy(null); if (cameraInput.current) cameraInput.current.value = ''; if (uploadInput.current) uploadInput.current.value = ''; }
  }
  function resetPosition() {
    setPosition(clamp({ x: wallPlane ? .5 : photo.isSample ? 0.4 : 0.5, y: wallPlane ? .22 : photo.isSample ? 0.094 : 0.22, width: approximateWidth(selected.widthMm, wallWidth) }));
    setShowUnit(true); setRecommendationApplied(false); setNotice('Placement reset.');
  }
  function dragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (busy || markingWall) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, original: position };
  }
  function dragMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || !stage.current || drag.current.pointer !== event.pointerId) return;
    const rect = stage.current.getBoundingClientRect();
    let delta={x:(event.clientX-drag.current.startX)/rect.width,y:(event.clientY-drag.current.startY)/rect.height};
    if(wallPlane) {
      try {
        const from=mapToWall(wallPlane,{x:(drag.current.startX-rect.left)/rect.width,y:(drag.current.startY-rect.top)/rect.height});
        const to=mapToWall(wallPlane,{x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height});
        delta={x:to.x-from.x,y:to.y-from.y};
      } catch { return; }
    }
    setPosition(clamp({ ...drag.current.original, x: drag.current.original.x + delta.x, y: drag.current.original.y + delta.y }));
    setRecommendationApplied(false);
  }
  function changeWidth(value: number) {
    setPosition(old => clamp({ ...old, width: value }));
    setRecommendationApplied(false);
  }
  async function requestRecommendation() {
    setConsent(false); setBusy(consentTask!=='placement'?'wall':'ai'); setError('');
    const version = photoVersion.current;
    try {
      const image = photo.src.startsWith('data:') ? photo.src : await (async () => {
        const response = await fetch(photo.src);
        return (await preparePhoto(new File([await response.blob()], 'room.jpg', { type: 'image/jpeg' }))).src;
      })();
      const response = await fetch(consentTask==='local'?'/api/local-detect-wall':consentTask==='wall'?'/api/detect-wall':'/api/recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(consentTask==='local'?250_000:55_000),
        body: JSON.stringify({ image, model: { name: selected.name, widthMm: selected.widthMm, heightMm: selected.heightMm, depthMm: selected.depthMm }, wallWidthCm: wallWidth, ...(wallPlane ? {wallCorners:wallPlane} : {}), imageWidth: photo.width, imageHeight: photo.height }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'We could not assess this photo. Please try again.');
      if (version !== photoVersion.current) return;
      if(consentTask!=='placement') { setWallSuggestion(result.wall); setMarkingWall(false); setNotice('Review the detected wall corners before using them.'); return; }
      setRecommendation(result.placement); setRecommendationApplied(false);
      setNotice('Your recommendation is ready to review.');
    } catch (error) { setError(error instanceof Error && error.name === 'TimeoutError' ? 'The recommendation took too long. Please try again.' : error instanceof Error ? error.message : 'Could not connect to the recommendation service.'); }
    finally { setBusy(null); }
  }
  async function savePreview() {
    setBusy('save'); setError('');
    try {
      const image = await loadImage(photo.src);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight + 90;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Your browser could not create the preview.');
      ctx.drawImage(image, 0, 0);
      if (showUnit) {
        const w = position.width * image.naturalWidth;
        const h = w * selected.heightMm / selected.widthMm;
        const left = position.x * image.naturalWidth - w / 2;
        const top = position.y * image.naturalHeight - h / 2;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 7;
        const unitImage=await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(unitSvg(selected))}`);
        if(wallPlane&&!preserveProportions) drawProjectedImage(ctx,unitImage,wallPlane,position,selected.heightMm/selected.widthMm*planeAspect,image.naturalWidth,image.naturalHeight);
        else if(anchored){const aw=anchored.width*image.naturalWidth;const ah=aw*selected.heightMm/selected.widthMm;ctx.translate(anchored.x*image.naturalWidth,anchored.y*image.naturalHeight);ctx.rotate(anchored.angle);ctx.drawImage(unitImage,-aw/2,-ah/2,aw,ah);}
        else if (selected.imageUrl) ctx.drawImage(unitImage, left, top, w, h);
        else { ctx.fillStyle = selected.finish.toLowerCase().includes('black') ? '#323432' : '#f3f1ec'; ctx.beginPath(); ctx.roundRect(left, top, w, h, 5); ctx.fill(); }
        ctx.restore();
      }
      ctx.fillStyle = '#f7f8f5'; ctx.fillRect(0, image.naturalHeight, canvas.width, 90);
      ctx.fillStyle = '#304c3f'; ctx.font = `${Math.max(16, canvas.width / 65)}px sans-serif`;
      ctx.fillText(`LiveAC  /  ${selected.name}  /  Visual concept`, 24, image.naturalHeight + 35);
      ctx.fillStyle = '#68716a'; ctx.font = `${Math.max(12, canvas.width / 90)}px sans-serif`;
      ctx.fillText('Approximate scale. Final position and clearances to be confirmed by a qualified installer.', 24, image.naturalHeight + 65);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('The preview could not be saved.')), 'image/jpeg', 0.94));
      const file = new File([blob], 'liveac-room-preview.jpg', { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'My LiveAC room preview' }); }
        catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) throw e; }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 15000);
        setNotice('Preview downloaded. Make it part of your plans.');
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'The preview could not be saved.'); }
    finally { setBusy(null); }
  }

  return <>
    <header className="site-header">
      <a className="brand" href={localMode ? '#' : '/'} aria-label="LiveAC home"><span className="brand-mark"><Wind size={24} strokeWidth={1.6} /></span>live<span className="brand-light">ac</span><span className="brand-studio">STUDIO</span></a>
      <nav aria-label="Main navigation"><span className="nav-active">Room visualizer</span><button onClick={() => setHelp(true)}>How it works <ArrowUpRight size={13} /></button></nav>
      <span className="market"><span className="belgian-flag" />Belgium <span className="market-dot">·</span> EN</span>
    </header>

    <main>
      <section className="intro">
        <div><div className="eyebrow"><span /> A BETTER FEELING AT HOME</div><h1>Comfort, in the right place<span>.</span></h1><p>Meet your room’s next addition. See it. Place it. Make it feel at home.</p></div>
        <div className="intro-note"><span className="intro-note-icon"><Leaf size={21} strokeWidth={1.4} /></span><div>Designed around your space.<br /><strong>Inspired by a little intelligence.</strong></div></div>
      </section>
      <div className="studio-layout">
        <section className="workspace" aria-label="Room preview">
          <div className="workspace-bar"><div className="room-title"><span className="live-dot" />{photo.isSample ? 'A little inspiration' : 'Your room'}<span className="sample-tag">{photo.isSample ? 'EXAMPLE ROOM' : 'YOUR PHOTO'}</span></div><div className="workspace-actions"><button className="icon-button" title="Reset placement" aria-label="Reset placement" onClick={resetPosition} disabled={!!busy}><RotateCcw size={16} /></button><button className="icon-button" title={showUnit ? 'View original room' : 'Show unit'} aria-label={showUnit ? 'View original room' : 'Show unit'} onClick={() => setShowUnit(!showUnit)}>{showUnit ? <Eye size={17} /> : <EyeOff size={17} />}</button><span className="toolbar-divider"/><button className="icon-button" title="Expand preview" aria-label="Expand preview" onClick={() => setExpanded(true)}><Expand size={16} /></button></div></div>
          <div className={expanded ? 'preview-expanded' : ''}>
            {expanded && <button className="close-expanded icon-button" aria-label="Close expanded preview" onClick={() => setExpanded(false)}><X /></button>}
            <div ref={stage} className={`room-stage ${busy === 'ai' || busy==='wall' ? 'analyzing' : ''} ${markingWall||referencePoints!==null?'marking-wall':''}`} onClick={markCorner} style={{ aspectRatio: `${photo.width} / ${photo.height}`, ...(expanded ? { width: `min(92vw, calc((100dvh - 120px) * ${aspect}))` } : {}) }}>
              <img className="room-photo" src={photo.src} alt={photo.isSample ? 'Example sunlit living room with a clear wall above the gallery of photographs' : 'Your uploaded room'} draggable={false} />
              <div className="unit-plane" style={{ transform: wallPlane&&!preserveProportions ? wallTransform(wallPlane,stageSize.width,stageSize.height) : 'none' }}>
              {showUnit && <div className={`placed-unit ${markingWall||referencePoints!==null?'unit-marking':''}`} role="button" tabIndex={0} aria-label="Air conditioner placement. Drag to move, or use arrow keys." style={{ left: `${displayPosition.x * 100}%`, top: `${displayPosition.y * 100}%`, width: `${displayPosition.width * 100}%`, height: `${displayHeight * 100}%`, transform: `translate(-50%,-50%) rotate(${anchored?.angle||0}rad)` }} onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={event => {
                const deltas: Record<string, [number, number]> = { ArrowLeft: [-.01, 0], ArrowRight: [.01, 0], ArrowUp: [0, -.01], ArrowDown: [0, .01] };
                if (deltas[event.key]) { event.preventDefault(); const [x, y] = deltas[event.key]; setPosition(old => clamp({ ...old, x: old.x + x, y: old.y + y })); setRecommendationApplied(false); }
              }}><UnitArtwork model={selected} /><span className="unit-handle"><Move size={11} /></span></div>}
              </div>
              <WallOverlay plane={wallPlane} draft={draftCorners} marking={markingWall} suggestion={wallSuggestion?.corners||null} onChange={plane=>{setWallPlane(plane);setRecommendation(null);}} />
              {referencePoints!==null&&<div className="marking-instruction" role="status">Tap {referencePoints.length?'the other':'the first'} end of your horizontal reference</div>}
              {markingWall && <div className="marking-instruction" role="status">Tap corner {draftCorners.length+1}: {['top left','top right','bottom right','bottom left'][draftCorners.length]}</div>}
              <div className="photo-label"><span /> LIVE PREVIEW</div>
              <div className="photo-watermark">liveac<span> / {photo.isSample ? 'the possibilities' : 'your space'}</span></div>
              {(busy === 'ai'||busy==='wall') && <div className="analysis-status"><Sparkles size={17} /><span>{busy==='wall'?'Looking for your wall…':'Finding a place that feels right…'}</span></div>}
            </div>
          </div>
          <div className="placement-toolbar"><span className="drag-hint"><Move size={15} /> Drag the unit to find your fit</span><div className="size-control"><label htmlFor="unit-size">Visual size</label><input id="unit-size" type="range" min="8" max="55" value={Math.round(position.width * 100)} onChange={e => changeWidth(Number(e.target.value) / 100)} disabled={!!busy} /><span>{Math.round(position.width * 100)}%</span></div></div>
          <section className="wall-tools" aria-label="Wall perspective tools">
            <div className="wall-tools-title"><Move size={16}/><div><strong>{wallPlane?'Anchored to your wall':'Give your wall a little perspective.'}</strong><p>{markingWall?'Mark a visible rectangle: top left → top right → bottom right → bottom left.':wallPlane?'Drag the numbered corners to refine the plane. Units follow the wall’s angle.':'Mark four wall corners, or ask AI for a starting point you can adjust.'}</p></div>{wallPlane&&<span className="plane-active"><Check size={11}/> PLANE SET</span>}</div>
            <div className="wall-tools-actions">{markingWall?<><button className="button button-secondary" onClick={()=>setDraftCorners(old=>old.slice(0,-1))} disabled={!draftCorners.length}>Undo corner</button><button className="button button-secondary" onClick={()=>{setMarkingWall(false);setDraftCorners([]);}}>Cancel marking</button></>:<><button className="button button-secondary" onClick={()=>{setMarkingWall(true);setDraftCorners([]);setWallSuggestion(null);}} disabled={!!busy}><Move size={14}/>{wallPlane?'Redraw wall':'Mark wall'}</button><button className="button button-secondary" onClick={()=>beginAi('local')} disabled={!!busy}><Sparkles size={14}/>Detect locally</button><button className="button button-secondary" onClick={()=>beginAi('wall')} disabled={!!busy}>{busy==='wall'?<LoaderCircle className="spin" size={14}/>:<Sparkles size={14}/>}Detect wall with AI</button>{wallPlane&&<button className="text-button" onClick={clearPlane}>Remove plane</button>}</>}</div>
            {wallPlane&&<label className="proportion-toggle"><input type="checkbox" checked={preserveProportions} onChange={e=>setPreserveProportions(e.target.checked)}/>Keep original unit proportions <span>(recommended; Gallery stays square)</span></label>}
            {!localMode&&<p className="local-detector-note">{localReady?'Local vision model ready · no API key needed':'Local vision: start Docker with the local-ai profile. First use downloads the model.'}</p>}
            {wallSuggestion&&<div className="wall-suggestion"><strong>Review detected wall · {wallSuggestion.confidence} confidence</strong><p>{wallSuggestion.summary}</p>{wallSuggestion.warnings.map((warning,i)=><p key={i}>{warning}</p>)}{wallSuggestion.widthGuess&&<div className="width-guess"><strong>Rough width guess: {wallSuggestion.widthGuess.minCm}–{wallSuggestion.widthGuess.maxCm} cm · low confidence</strong><p>{wallSuggestion.widthGuess.basis}</p><p>Object sizes are assumed. Use a measured reference for a dependable scale.</p><button className="button button-secondary" onClick={()=>{const width=Math.round((wallSuggestion.widthGuess!.minCm+wallSuggestion.widthGuess!.maxCm)/2);setWallWidth(width);setScaleSource('AI guess — low confidence');setPosition(constrainPosition({...position,width:approximateWidth(selected.widthMm,width)},selected.widthMm,selected.heightMm,wallPlane?width/Math.max(100,wallHeight):aspect));}}>Use range midpoint as a rough scale</button></div>}<div>{wallSuggestion.corners&&<button className="button button-primary" onClick={()=>applyPlane(wallSuggestion.corners!)}>Use detected wall</button>}<button className="button button-secondary" onClick={()=>setWallSuggestion(null)}>Dismiss</button></div></div>}
          </section>
          <div className="upload-strip"><div className="upload-icon"><ImagePlus size={23} strokeWidth={1.4} /></div><div className="upload-copy"><h3>Start with your own space</h3><p>A straight-on photo of your wall works best.</p></div><div className="upload-buttons"><button className="button button-secondary camera-button" onClick={() => cameraInput.current?.click()} disabled={!!busy}><Camera size={16} /><span>Take a photo</span></button><button className="button button-primary" onClick={() => uploadInput.current?.click()} disabled={!!busy}>{busy === 'photo' ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}<span>Upload photo</span></button></div></div>
          <div className="privacy-note"><ShieldCheck size={13} /> Your photo stays on your device unless you choose AI analysis.</div>
          <input ref={cameraInput} className="visually-hidden" type="file" accept="image/*" capture="environment" aria-label="Take a room photo" onChange={e => choosePhoto(e.target.files?.[0])} />
          <input ref={uploadInput} className="visually-hidden" type="file" accept="image/*" aria-label="Upload a room photo" onChange={e => choosePhoto(e.target.files?.[0])} />
          <section className="ai-card">
            <div className="ai-heading"><div className="ai-symbol"><Sparkles size={20} strokeWidth={1.5} /></div><div><div className="eyebrow">A FRESH PERSPECTIVE</div><h2>Let your room lead the way.</h2></div><span className="ai-tag">AI PLACEMENT</span></div>
            <p>Find a position that works with your wall, your furniture, and the feeling of your room.</p>
            <div className="ai-bottom"><span>{aiConfigured === false ? <><span className="status-dot" /> {staticHosted ? 'AI placement is not connected yet' : localMode ? 'Local preview · AI needs the hosted version' : 'AI connection needs setup'}</> : <><ShieldCheck size={14} /> You choose what to share</>}</span><button className="button button-dark" onClick={() => beginAi('placement')} disabled={!!busy}>{busy === 'ai' ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}{busy === 'ai' ? 'Considering your space…' : 'Find the best spot'}<ArrowRight size={15} /></button></div>
            {recommendation && <div className="recommendation"><div className="recommendation-top"><strong>Your room, considered</strong><span>{recommendation.confidence} confidence</span></div><p>{recommendation.summary}</p><ul>{recommendation.reasoning.map((reason, i) => <li key={i}><Check size={14} />{reason}</li>)}</ul>{recommendation.warnings.map((warning, i) => <p className="recommendation-warning" key={i}><Info size={14}/>{warning}</p>)}<button className="button button-primary" disabled={recommendationApplied || !!busy} onClick={applyRecommendation}>{recommendationApplied ? <Check size={15} /> : <ArrowUpRight size={15} />}{recommendationApplied ? 'Position applied' : recommendation.confidence === 'low' ? 'Try this tentative position' : 'Try this position'}</button></div>}
          </section>
        </section>

        <aside className="model-panel">
          <div className="model-panel-heading"><div><div className="eyebrow">THE RIGHT LOOK</div><h2>Meet your indoor unit.</h2></div><span className="lg-badge">LG</span></div>
          <p className="panel-description">Thoughtful design. A natural fit for your home.</p>
          <div className="collection-label"><span>LG COLLECTION</span><span>{models.length} designs <ChevronDown size={12} /></span></div>
          <div className="model-list" role="group" aria-label="Choose an LG indoor unit">
            {models.map(model => <button key={model.id} className={`model-option ${selected.id === model.id ? 'selected' : ''}`} onClick={() => chooseModel(model)} disabled={!!busy} aria-pressed={selected.id === model.id}>
              <div className="model-thumbnail"><Unit model={model} /></div><div className="model-option-copy"><strong>{model.name.replace(/^LG /, '')}</strong><span>{model.finish}</span></div><span className="model-radio">{selected.id === model.id && <Check size={11} strokeWidth={3} />}</span>
            </button>)}
          </div>
          <div className="selected-specs"><div className="selected-specs-top"><h3>{selected.name.replace(/^LG /, '')}</h3><a href={selected.sourceUrl} target="_blank" rel="noreferrer" aria-label={`View official ${selected.name} information`}><ArrowUpRight size={16} /></a></div><p>{selected.description}</p><div className="spec-row"><span>Dimensions <small>W × H × D</small></span><strong>{selected.widthMm} × {selected.heightMm} × {selected.depthMm} <small>mm</small></strong></div><div className="spec-row"><span>Cooling options</span><strong>{selected.capacities.map(capacity => capacity.replace(' kW', '')).join(' / ')} <small>kW</small></strong></div></div>
          <p className="model-market-note">{selected.marketNote}</p><div className="wall-scale"><label htmlFor="wall-width">{wallPlane?'Marked wall width':'Visible wall width'} <span>approx.</span></label><div className="wall-input"><input id="wall-width" type="number" inputMode="numeric" min="100" max="2000" step="10" value={wallWidth} disabled={!!busy} onChange={e => { const width = Number(e.target.value); setWallWidth(width); if (width >= 100 && width <= 2000) { setPosition(old => clamp({ ...old, width: approximateWidth(selected.widthMm, width) })); setRecommendation(null); } }} onBlur={() => { if (wallWidth < 100 || wallWidth > 2000) { setWallWidth(420); setPosition(old => clamp({ ...old, width: approximateWidth(selected.widthMm, 420) })); } }} /><span>cm</span></div><p>Used for a rough visual scale. Enter the marked wall’s width and height for a better perspective estimate. Clearances aren’t measured.</p></div>
          {wallPlane && <div className="wall-scale"><label htmlFor="wall-height">Marked wall height <span>approx.</span></label><div className="wall-input"><input id="wall-height" type="number" inputMode="numeric" min="100" max="1000" value={wallHeight} onChange={e=>{const value=Number(e.target.value);setWallHeight(value);setPosition(old=>constrainPosition(old,selected.widthMm,selected.heightMm,Math.max(100,wallWidth)/Math.max(100,value)));}} onBlur={()=>{if(wallHeight<100||wallHeight>1000)setWallHeight(250);}}/><span>cm</span></div><p>Measure the rectangle you marked, rather than the entire room.</p></div>}
          {wallPlane&&<div className="reference-scale"><strong>Scale from a known width</strong><p>Measure a horizontal object on this same wall (such as a window). Enter its width, then mark its two ends.</p><label htmlFor="reference-width">Reference width (cm)</label><input id="reference-width" type="number" min="5" max="1000" value={referenceCm} onChange={e=>setReferenceCm(Number(e.target.value))}/><button className="button button-secondary" disabled={!!busy||markingWall} onClick={()=>setReferencePoints(referencePoints===null?[]:null)}>{referencePoints===null?'Mark reference ends':'Cancel reference'}</button></div>}
          <p className="scale-source">Scale: {scaleSource}. Dimensions remain approximate.</p>
          <button className="button button-primary save-button" onClick={savePreview} disabled={!!busy}>{busy === 'save' ? <LoaderCircle className="spin" size={16} /> : <ArrowDownToLine size={16} />}Save my preview<ArrowRight size={16} /></button>
          <span className="save-note">A little inspiration to keep or share.</span>
          <div className="catalog-note"><Info size={13} /><p>Official LG Belgium listings and the 2026 LG collection. Preview units are illustrative. Confirm the exact model with your installer.</p></div>
        </aside>
      </div>
      <div className="bottom-note"><span><Info size={14} /> A vision for your room. A conversation with your installer.</span><p>This is an aesthetic preview. A qualified installer should confirm the final position, clearances, and suitability.</p></div>
    </main>
    <footer><a className="footer-brand" href={localMode ? '#' : '/'}>liveac<span> STUDIO</span></a><span>Better spaces. Better everyday.</span><div><span>Independent visualization tool</span><span className="footer-dot">·</span><button onClick={() => setHelp(true)}>About this preview <ArrowUpRight size={12} /></button></div></footer>
    {notice && <div className="toast" role="status"><Check size={16} />{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
    {error && <div className="error-toast" role="alert"><Info size={19} /><p>{error}</p><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={17} /></button></div>}
    {(help || consent) && <div className="modal-backdrop" onClick={() => { setHelp(false); setConsent(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()}><button className="modal-close icon-button" aria-label="Close dialog" onClick={() => { setHelp(false); setConsent(false); }}><X size={20} /></button><span className="modal-icon">{consent ? <Sparkles size={25} /> : <Wind size={25} />}</span><div className="eyebrow">A LITTLE GUIDANCE</div><h2 id="modal-title">{consent ? 'A second eye for your space.' : 'Picture the possibilities.'}</h2>{consent ? <><p>{consentTask==='local'?'We’ll send this photo to the local vision model in your Docker setup. It stays on that machine; no cloud API or key is used. Review the corners and any width guess before applying them.':consentTask==='wall'?'To detect a wall, we’ll send this room photo and its dimensions to OpenAI for analysis. You can review and adjust the suggested corners before using them.':'To suggest a location, we’ll send this room photo, your selected unit, the approximate wall width, and any marked wall corners to OpenAI for analysis.'}</p><p>{consentTask==='local'?'The model can take a few minutes on a CPU. It cannot measure real dimensions from a photo; width suggestions are uncertain guesses.':'Only continue with a photo you’re comfortable sharing. Your photo is not stored by this app’s server. The AI provider processes it under its own data policy.'}</p>{consentTask!=='local'&&<a className="text-link" href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noreferrer">OpenAI privacy policy <ArrowUpRight size={13} /></a>}<div className="modal-actions"><button className="button button-secondary" onClick={() => setConsent(false)}>Keep editing</button><button className="button button-primary" onClick={requestRecommendation}><Sparkles size={15}/>Analyze my photo</button></div></> : <><ol className="how-steps"><li><span>01</span><div><strong>Bring your wall into focus.</strong><p>On iPhone, take a straight-on photo or choose one from your library. Include the ceiling and surrounding furniture.</p></div></li><li><span>02</span><div><strong>Find the design that feels like you.</strong><p>Mark the wall’s four corners clockwise from top left to anchor a perspective plane. Enter its width and height, choose an LG unit, and drag it into place. AI wall detection is optional.</p></div></li><li><span>03</span><div><strong>Look at it with fresh eyes.</strong><p>Request an AI aesthetic recommendation, review the suggestion, and save your preview to discuss with your installer.</p></div></li></ol><p className="modal-footnote">This is a two-dimensional visual concept, not a measured AR survey. Product appearance and scale are approximate. LG is a trademark of LG Electronics; LiveAC is an independent tool. <a href="https://unsplash.com/photos/gray-fabric-sofa-near-white-wooden-table-pz-lg1r5X4A" target="_blank" rel="noreferrer">Sample room photo: Unsplash.</a></p><button className="button button-primary" onClick={() => setHelp(false)}>Make yourself at home <ArrowRight size={15} /></button></>}</section></div>}
  </>;
}
