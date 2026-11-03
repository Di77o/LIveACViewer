import type { ACModel } from '../data/catalog';

/** Self-contained, transparent preview illustration; not a manufacturer render. */
export function unitSvg(model: ACModel): string {
  const { widthMm: w, heightMm: h } = model;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">`;

  if (model.visualVariant === 'gallery') {
    return `${open}
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="652" y2="652" gradientUnits="userSpaceOnUse"><stop stop-color="#dac29c"/><stop offset=".45" stop-color="#bda079"/><stop offset="1" stop-color="#d1b489"/></linearGradient>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="600" gradientUnits="userSpaceOnUse"><stop stop-color="#ede5d6"/><stop offset="1" stop-color="#d2d8cc"/></linearGradient>
      </defs>
      <g transform="scale(${w / 652} ${h / 652})">
        <rect x="3" y="3" width="646" height="646" rx="3" fill="url(#wood)" stroke="#9e8666" stroke-width="2"/>
        <rect x="15" y="15" width="622" height="622" fill="#edeae1" stroke="#f1e3cc" stroke-width="3"/>
        <rect x="40" y="40" width="572" height="572" fill="url(#sky)"/>
        <circle cx="437" cy="174" r="64" fill="#cda676"/>
        <path d="M40 367C155 292 248 285 344 341C430 392 510 332 612 284V612H40Z" fill="#a5afa0"/>
        <path d="M40 453C156 350 251 376 348 421C448 465 523 395 612 373V612H40Z" fill="#738675"/>
        <path d="M40 534C170 454 266 453 355 491C460 538 529 460 612 443V612H40Z" fill="#4d6256"/>
        <path d="M15 15L3 3M637 15L649 3M15 637L3 649M637 637L649 649" stroke="#aa8d68" stroke-width="1.5"/>
        <text x="326" y="630" text-anchor="middle" fill="#9b9b91" font-family="Arial,sans-serif" font-size="9">LG</text>
      </g></svg>`;
  }

  const dark = model.visualVariant === 'mirror';
  const matt = model.finish.toLowerCase().includes('matt');
  const front = dark
    ? `<linearGradient id="front" x1="0" y1="0" x2="950" y2="310" gradientUnits="userSpaceOnUse"><stop stop-color="${matt ? '#45464a' : '#7d7e83'}"/><stop offset=".55" stop-color="#343539"/><stop offset="1" stop-color="#27282b"/></linearGradient>`
    : '<linearGradient id="front" x1="0" y1="0" x2="0" y2="330" gradientUnits="userSpaceOnUse"><stop stop-color="#fcfcfb"/><stop offset=".72" stop-color="#f0f0ee"/><stop offset="1" stop-color="#dedfdd"/></linearGradient>';

  return `${open}
    <defs>${front}
      <linearGradient id="edge" x1="0" y1="0" x2="0" y2="330" gradientUnits="userSpaceOnUse"><stop stop-color="${dark ? '#505155' : '#dbdcda'}"/><stop offset="1" stop-color="${dark ? '#17181a' : '#b9bcb9'}"/></linearGradient>
      <linearGradient id="vent" x1="0" y1="270" x2="0" y2="326" gradientUnits="userSpaceOnUse"><stop stop-color="#1e2526"/><stop offset="1" stop-color="#404748"/></linearGradient>
    </defs>
    <g transform="scale(${w / 1000} ${h / 330})">
      <path d="M27 3H973L993 15V294L977 322H23L7 294V15Z" fill="url(#edge)"/>
      <rect x="8" y="12" width="984" height="279" rx="8" fill="url(#front)" stroke="${dark ? '#414247' : '#d8dad7'}" stroke-width="2"/>
      ${dark && !matt ? '<path d="M11 28L760 288H11Z" fill="#fff" opacity=".075"/><path d="M11 28L760 288" stroke="#fff" opacity=".07"/>' : ''}
      <path d="M29 287H971L962 315H38Z" fill="url(#vent)"/>
      <path d="M31 292H969M34 301H966M37 310H963" stroke="${dark ? '#93979a' : '#c6cac7'}" stroke-width="2"/>
      <path d="M20 19H980" stroke="${dark ? '#b0b1b5' : '#ffffff'}" stroke-opacity=".55" stroke-width="2"/>
      <text x="500" y="264" text-anchor="middle" fill="${dark ? '#b0b2b5' : '#a7aca8'}" font-family="Arial,sans-serif" font-size="16" letter-spacing="-1">LG</text>
      ${!dark ? '<circle cx="942" cy="257" r="3" fill="#a4b7a7"/><path d="M962 249V261" stroke="#c4cac4" stroke-width="2"/>' : ''}
    </g></svg>`;
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
