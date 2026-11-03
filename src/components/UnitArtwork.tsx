import type { ACModel } from '../data/catalog';
import { getUnitDesign, type UnitDesign } from '../lib/unit-model-design';

const n = (value: number) => Number(value.toFixed(3));
const xml = (value: string) => value.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!);

function logo(x: number, y: number, size: number, color: string) {
  return `<g data-part="maker-mark" transform="translate(${n(x)} ${n(y)})" fill="none" stroke="${color}" stroke-width="${n(size * .062)}" opacity=".75"><circle cx="${n(-size * .7)}" cy="0" r="${n(size * .46)}"/><path d="M${n(-size * .7)} ${n(-size * .26)}v${n(size * .48)}h${n(size * .18)}M${n(-size * .67)} 0h${n(size * .37)}v${n(size * .19)}"/><circle cx="${n(-size * .87)}" cy="${n(-size * .18)}" r="${n(size * .025)}" fill="${color}"/><path d="M0 ${n(-size * .31)}v${n(size * .62)}h${n(size * .4)}M${n(size * 1.05)} ${n(-size * .22)}C${n(size * .62)} ${n(-size * .57)} ${n(size * .44)} ${n(size * .36)} ${n(size * .88)} ${n(size * .33)}h${n(size * .18)}V0h${n(-size * .25)}" stroke-width="${n(size * .13)}"/></g>`;
}

function galleryArtwork(model: ACModel, design: UnitDesign) {
  const w = model.widthMm, h = model.heightMm, frame = design.gallery!.frameMm;
  const screen = design.gallery!.screen, x = w * screen.x, y = h * screen.y, sw = w * screen.width, sh = h * screen.height;
  const f = n(frame), p = (value: number) => n(value);
  // Deterministic grain follows the four rails without covering the display.
  const grain = Array.from({ length: 7 }, (_, i) => {
    const a = frame * (.13 + i * .12);
    return `<path d="M${f} ${p(a)}Q${p(w * .43)} ${p(a + .9)} ${p(w - frame)} ${p(a - .3)}M${f} ${p(h - a)}Q${p(w * .57)} ${p(h - a - .8)} ${p(w - frame)} ${p(h - a + .4)}M${p(a)} ${f}Q${p(a + .7)} ${p(h * .38)} ${p(a - .4)} ${p(h - frame)}M${p(w - a)} ${f}Q${p(w - a - .6)} ${p(h * .52)} ${p(w - a + .3)} ${p(h - frame)}"/>`;
  }).join('');
  return `<defs>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d5bc90"/><stop offset=".36" stop-color="#c8ab7c"/><stop offset=".7" stop-color="#b99764"/><stop offset="1" stop-color="#ceb185"/></linearGradient>
    <linearGradient id="board" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f4f3ee"/><stop offset="1" stop-color="#e9e6df"/></linearGradient>
    <linearGradient id="screen-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a4b6ba"/><stop offset=".56" stop-color="#d8dcce"/><stop offset="1" stop-color="#d2be99"/></linearGradient>
    <linearGradient id="screen-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".18"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#364550" stop-opacity=".12"/></linearGradient>
    <clipPath id="display-clip"><rect x="${p(x)}" y="${p(y)}" width="${p(sw)}" height="${p(sh)}" rx=".8"/></clipPath>
  </defs>
  <g data-part="wood-frame">
    <rect x=".7" y=".7" width="${p(w - 1.4)}" height="${p(h - 1.4)}" rx="1.6" fill="url(#wood)" stroke="#aa8e64" stroke-width="1.2"/>
    <g stroke="#927347" stroke-width=".45" opacity=".26">${grain}</g>
    <path d="M1 1L${f} ${f}M${p(w - 1)} 1L${p(w - frame)} ${f}M1 ${p(h - 1)}L${f} ${p(h - frame)}M${p(w - 1)} ${p(h - 1)}L${p(w - frame)} ${p(h - frame)}" stroke="#9d8057" stroke-width=".7"/>
    <rect x="${f}" y="${f}" width="${p(w - 2 * frame)}" height="${p(h - 2 * frame)}" fill="url(#board)" stroke="#e6dac3" stroke-width="1.7"/>
    <path d="M${p(frame + 1)} ${p(h - frame - 1)}V${p(frame + 1)}H${p(w - frame - 1)}" stroke="#b7b09f" stroke-opacity=".45" stroke-width=".9"/>
  </g>
  <g data-part="display" data-aspect="16:9">
    <rect x="${p(x - 1.1)}" y="${p(y - 1.1)}" width="${p(sw + 2.2)}" height="${p(sh + 2.2)}" fill="#c9cbc7" rx="1.1"/>
    <g clip-path="url(#display-clip)">
      <rect x="${p(x)}" y="${p(y)}" width="${p(sw)}" height="${p(sh)}" fill="url(#screen-sky)"/>
      <circle cx="${p(x + sw * .76)}" cy="${p(y + sh * .27)}" r="${p(sh * .11)}" fill="#ede5c9"/>
      <path d="M${p(x)} ${p(y + sh * .63)}Q${p(x + sw * .16)} ${p(y + sh * .34)} ${p(x + sw * .36)} ${p(y + sh * .64)}T${p(x + sw * .73)} ${p(y + sh * .55)}T${p(x + sw)} ${p(y + sh * .57)}V${p(y + sh)}H${p(x)}Z" fill="#7c9993"/>
      <path d="M${p(x)} ${p(y + sh * .8)}Q${p(x + sw * .22)} ${p(y + sh * .57)} ${p(x + sw * .48)} ${p(y + sh * .77)}T${p(x + sw)} ${p(y + sh * .7)}V${p(y + sh)}H${p(x)}Z" fill="#4c7776"/>
      <path d="M${p(x)} ${p(y + sh * .91)}Q${p(x + sw * .25)} ${p(y + sh * .82)} ${p(x + sw * .52)} ${p(y + sh * .94)}T${p(x + sw)} ${p(y + sh * .87)}V${p(y + sh)}H${p(x)}Z" fill="#2c5358"/>
      <rect x="${p(x)}" y="${p(y)}" width="${p(sw)}" height="${p(sh)}" fill="url(#screen-glass)"/>
      <path d="M${p(x)} ${p(y)}H${p(x + sw * .48)}L${p(x + sw * .15)} ${p(y + sh)}H${p(x)}Z" fill="#fff" opacity=".045"/>
    </g>
  </g>
  <path data-part="receiver" d="M${p(w * .87)} ${p(h - 2)}h${p(w * .052)}" stroke="#777d77" stroke-opacity=".48" stroke-width="1.1"/>`;
}

function wallUnitArtwork(model: ACModel, design: UnitDesign) {
  const w = model.widthMm, h = model.heightMm, s = h / 307, dark = design.family === 'mirror' || design.family === 'matt-black';
  const matt = design.family === 'matt-black', premium = design.family === 'premium';
  const frontEnd = design.outlet.topFraction * h, ventEnd = frontEnd + design.outlet.heightFraction * h, inset = design.outlet.sideInsetMm;
  const lowerShoulder = h - s * (dark ? 5 : 18);
  const f = (value: number) => n(value), r = design.casing.cornerRadiusMm;
  const finGap = (w - inset * 2 - s * 28) / (design.outlet.verticalFinCount - 1);
  const fins = Array.from({ length: design.outlet.verticalFinCount }, (_, i) => {
    const x = inset + s * 14 + finGap * i;
    return `<path data-part="vertical-fin" d="M${f(x)} ${f(frontEnd + 1)}l${f(s * 2)} ${f(ventEnd - frontEnd - 2)}h${f(s * 4)}l${f(-s * 2)} ${f(frontEnd - ventEnd + 2)}Z" fill="url(#fin)"/>`;
  }).join('');
  const intake = Array.from({ length: Math.floor(w / (s * 31)) }, (_, i) => `<path d="M${f(s * 22 + i * s * 30)} ${f(s * 1.4)}v${f(s * 4)}" stroke="${dark ? '#656b6c' : '#acb4ae'}" stroke-width="${f(s * 1.5)}"/>`).join('');
  const louvers = Array.from({ length: design.outlet.louverCount }, (_, i) => {
    const y = frontEnd + (i + .4) * (ventEnd - frontEnd) / design.outlet.louverCount;
    const thickness = s * (dark ? 2.2 : 3.4);
    return `<g data-part="horizontal-louver"><path d="M${f(inset - s * 1.5)} ${f(y)}Q${f(w * .5)} ${f(y + s * (dark ? .6 : 1.5))} ${f(w - inset + s * 1.5)} ${f(y)}l${f(-s * 2)} ${f(thickness)}H${f(inset + s * .5)}Z" fill="url(#louver)"/><path d="M${f(inset)} ${f(y)}Q${f(w * .5)} ${f(y + s * (dark ? .6 : 1.5))} ${f(w - inset)} ${f(y)}" stroke="${design.materials.louver.color}" stroke-opacity="${matt ? '.38' : '.85'}" stroke-width="${f(s * .7)}"/></g>`;
  }).join('');
  const panelPath = dark
    ? `M${f(s * 2)} ${f(s * 7)}H${f(w - s * 2)}V${f(frontEnd - s * 1.5)}H${f(s * 2)}Z`
    : `M${f(r)} ${f(s * 5)}Q${f(s * 3)} ${f(s * 5)} ${f(s * 2)} ${f(r + s * 2)}L${f(s * 1.5)} ${f(frontEnd - s * 8)}Q${f(s * 1.5)} ${f(frontEnd - s * 1.5)} ${f(inset)} ${f(frontEnd)}H${f(w - inset)}Q${f(w - s * 1.5)} ${f(frontEnd - s * 1.5)} ${f(w - s * 1.5)} ${f(frontEnd - s * 8)}L${f(w - s * 2)} ${f(r + s * 2)}Q${f(w - s * 3)} ${f(s * 5)} ${f(w - r)} ${f(s * 5)}Z`;
  return `<defs>
    <linearGradient id="case" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${dark ? '#414548' : '#e6e8e2'}"/><stop offset=".63" stop-color="${design.materials.body.color}"/><stop offset="1" stop-color="${dark ? '#252a2d' : '#cfd4cc'}"/></linearGradient>
    <linearGradient id="front" x1="0" y1="0" x2="${dark ? '1' : '.12'}" y2="1"><stop stop-color="${dark ? matt ? '#454749' : '#9b9fa3' : '#fdfdf9'}"/><stop offset=".47" stop-color="${dark ? matt ? '#383a3c' : '#62666a' : '#f6f6f3'}"/><stop offset="1" stop-color="${dark ? matt ? '#303234' : '#303438' : '#eaece6'}"/></linearGradient>
    <linearGradient id="vent" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#070c0e"/><stop offset=".68" stop-color="#141c1e"/><stop offset="1" stop-color="#252d2d"/></linearGradient>
    <linearGradient id="fin" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#131a1c"/><stop offset=".48" stop-color="${dark ? '#596062' : '#5e6966'}"/><stop offset="1" stop-color="#151d1e"/></linearGradient>
    <linearGradient id="louver" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${dark ? matt ? '#45494a' : '#a2a9a9' : '#b6c0bb'}"/><stop offset=".36" stop-color="${dark ? '#41494b' : '#66726e'}"/><stop offset="1" stop-color="#182021"/></linearGradient>
    <linearGradient id="airfoil" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${dark ? '#41474a' : '#f5f6f0'}"/><stop offset=".25" stop-color="${dark ? '#303639' : '#e1e5dc'}"/><stop offset="1" stop-color="${dark ? '#202629' : '#cbd2c8'}"/></linearGradient>
    <clipPath id="front-clip"><path d="${panelPath}"/></clipPath>
  </defs>
  <path data-part="case-shell" d="M${f(s * 25)} ${f(s * 2)}Q${f(s * 38)} 0 ${f(s * 50)} 0H${f(w - s * 50)}Q${f(w - s * 38)} 0 ${f(w - s * 25)} ${f(s * 2)}L${f(w - s * 1)} ${f(s * 8)}V${f(h - s * 23)}L${f(w - s * 25)} ${f(h - s * 1)}H${f(s * 25)}L${f(s)} ${f(h - s * 23)}V${f(s * 8)}Z" fill="url(#case)"/>
  <g data-part="top-intake" opacity="${dark ? '.9' : '.37'}"><path d="M${f(s * 34)} ${f(s * 5)}H${f(w - s * 34)}" stroke="${dark ? '#161b1d' : '#89968f'}" stroke-width="${f(s * 4)}"/>${intake}</g>
  <path data-part="outlet-cavity" d="M${f(inset)} ${f(frontEnd - s * 3)}H${f(w - inset)}Q${f(w - s * 2)} ${f(frontEnd)} ${f(w - s * 3)} ${f(frontEnd + s * 10)}V${f(ventEnd - s * 2)}L${f(w - inset)} ${f(ventEnd + s * 1)}H${f(inset)}L${f(s * 3)} ${f(ventEnd - s * 2)}V${f(frontEnd + s * 10)}Q${f(s * 2)} ${f(frontEnd)} ${f(inset)} ${f(frontEnd - s * 3)}Z" fill="url(#vent)"/>
  ${fins}
  <g data-part="front-panel" data-material="${dark ? matt ? 'matte-polymer' : 'reflective-glass' : 'satin-polymer'}">
    <path d="${panelPath}" fill="url(#front)" stroke="${dark ? '#52575a' : '#d4dad1'}" stroke-width="${f(s * .7)}" stroke-linejoin="round"/>
    ${dark && !matt ? `<g clip-path="url(#front-clip)"><path data-part="glass-reflection" d="M0 ${f(frontEnd * .62)}L${f(w)} ${f(frontEnd * .93)}V${f(frontEnd)}H0Z" fill="#e1e6e9" opacity=".13"/><path d="M${f(w * .12)} 0H${f(w * .53)}L${f(w * .38)} ${f(frontEnd)}H0Z" fill="#fff" opacity=".023"/></g>` : ''}
    ${!dark ? `<path d="M${f(s * 9)} ${f(r + s * 4)}Q${f(s * 9)} ${f(s * 8)} ${f(r + s * 4)} ${f(s * 8)}H${f(w - r - s * 4)}Q${f(w - s * 8)} ${f(s * 8)} ${f(w - s * 8)} ${f(r + s * 4)}" stroke="#fff" stroke-opacity=".8" stroke-width="${f(s * 1.2)}"/><path d="M${f(s * 5)} ${f(s * 23)}V${f(frontEnd - s * 8)}M${f(w - s * 5)} ${f(s * 23)}V${f(frontEnd - s * 8)}" stroke="${premium ? '#b9c3b8' : '#d1d8ce'}" stroke-opacity=".36" stroke-width="${f(s * 2)}"/>` : `<path d="M${f(s * 3)} ${f(s * 8)}H${f(w - s * 3)}" stroke="${matt ? '#727779' : '#d9dcde'}" stroke-opacity=".5" stroke-width="${f(s * .65)}"/>`}
    ${logo(w / 2 - s * 2, frontEnd - s * (dark ? 24 : 22), s * 10.5, dark ? '#a9b0b1' : '#a4ada5')}
    ${premium ? `<g data-part="receiver" opacity=".64"><circle cx="${f(w - s * 42)}" cy="${f(frontEnd - s * 24)}" r="${f(s * 1.4)}" fill="#a1b4aa"/><rect x="${f(w - s * 32)}" y="${f(frontEnd - s * 29)}" width="${f(s * 3)}" height="${f(s * 9)}" rx="${f(s * 1.5)}" fill="#d3d9d2"/></g>` : ''}
  </g>
  <g data-part="outlet-louvers">${louvers}</g>
  <path data-part="lower-airfoil" d="M${f(s * 2)} ${f(ventEnd + s * 1)}Q${f(w * .5)} ${f(ventEnd + s * 4)} ${f(w - s * 2)} ${f(ventEnd + s * 1)}V${f(lowerShoulder)}L${f(w - s * 23)} ${f(h - s * 1)}H${f(s * 23)}L${f(s * 2)} ${f(lowerShoulder)}Z" fill="url(#airfoil)" stroke="${dark ? '#50585a' : '#c6cec4'}" stroke-width="${f(s * .65)}"/>
  <path data-part="airfoil-seam" d="M${f(s * 20)} ${f(ventEnd + s * (dark ? 3 : 8))}L${f(s * 36)} ${f(h - s * (dark ? 2 : 10))}H${f(w - s * 36)}L${f(w - s * 20)} ${f(ventEnd + s * (dark ? 3 : 8))}" stroke="${dark ? '#70797a' : '#aab5a9'}" stroke-opacity="${dark ? '.3' : '.6'}" stroke-width="${f(s * .7)}"/>
  ${!dark ? `<path d="M${f(s * 23)} ${f(h - s * 2)}H${f(w - s * 23)}" stroke="#eef1e8" stroke-width="${f(s)}" opacity=".75"/>` : ''}`;
}

/** Self-contained dimensioned artwork, drawn from references; not an LG render. */
export function unitSvg(model: ACModel): string {
  const design = getUnitDesign(model);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${model.widthMm}" height="${model.heightMm}" viewBox="0 0 ${model.widthMm} ${model.heightMm}" fill="none" data-design-family="${design.family}" data-model-origin="illustrative"><title>${xml(model.name)} illustrative indoor unit</title>${design.family === 'gallery' ? galleryArtwork(model, design) : wallUnitArtwork(model, design)}</svg>`;
}

export default function UnitArtwork({ model }: { model: ACModel }) {
  return (
    <img
      className="unit-artwork"
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(unitSvg(model))}`}
      alt={`${model.name} illustrative indoor unit`}
      draggable={false}
    />
  );
}
