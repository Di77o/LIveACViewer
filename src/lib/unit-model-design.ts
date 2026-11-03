/** Inputs shared by the catalog, geometry renderer, and SVG texture generator. */
export type UnitDesignModel = {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  id?: string;
  visualVariant?: 'standard' | 'mirror' | 'gallery';
  finish?: string;
};

export type UnitFaceKind = 'top' | 'right' | 'bottom' | 'left';
export type UnitMaterial = {
  color: string;
  /** Illustrative material values in [0,1], not manufacturer PBR measurements. */
  roughness: number;
  metalness: number;
  reflectivity: number;
};
export type UnitProfileStation = {
  /** 0 = wall/back, 1 = front. Insets shrink the nominal width/height rectangle. */
  depthFraction: number;
  topInsetMm: number;
  bottomInsetMm: number;
  sideInsetMm: number;
};
export type UnitDesign = {
  family: 'mirror' | 'matt-black' | 'premium' | 'deluxe' | 'special' | 'gallery';
  casing: { bevelMm: number; cornerRadiusMm: number; frontInsetMm: number; backInsetMm: number };
  sideProfile: UnitProfileStation[];
  materials: Record<'body' | 'front' | 'bevel' | 'vent' | 'louver', UnitMaterial>;
  outlet: { topFraction: number; heightFraction: number; sideInsetMm: number; louverCount: number; verticalFinCount: number };
  gallery?: { frameMm: number; screen: { x: number; y: number; width: number; height: number } };
};

const material = (color: string, roughness: number, metalness = 0, reflectivity = .08): UnitMaterial => ({ color, roughness, metalness, reflectivity });

/**
 * Dimensioned, photo-informed casing profiles. Only the outer dimensions come
 * from the LG catalog; the intermediate stations and materials are illustrative.
 * Generic geometry inputs deliberately fall back to the white Deluxe profile.
 */
export function getUnitDesign(model: UnitDesignModel): UnitDesign {
  if (![model.widthMm, model.heightMm, model.depthMm].every(value => Number.isFinite(value) && value > 0)) throw new RangeError('Invalid unit design dimensions.');
  const gallery = model.visualVariant === 'gallery' || model.id === 'artcool-gallery';
  const black = model.visualVariant === 'mirror' || /artcool-(mirror|matt-black)/.test(model.id ?? '');
  const matt = black && (/matt/i.test(model.finish ?? '') || model.id === 'artcool-matt-black');
  const family: UnitDesign['family'] = gallery ? 'gallery' : black ? matt ? 'matt-black' : 'mirror' : model.id === 'dualcool-premium' ? 'premium' : model.id === 'dualcool-special' ? 'special' : 'deluxe';
  const s = model.heightMm / (gallery ? 652 : 307);
  const station = (depthFraction: number, top: number, bottom: number, side: number): UnitProfileStation => ({ depthFraction, topInsetMm: top * s, bottomInsetMm: bottom * s, sideInsetMm: Math.min(side * s, model.widthMm * .08) });
  if (gallery) {
    return {
      family,
      casing: { bevelMm: 3 * s, cornerRadiusMm: 2 * s, frontInsetMm: 2 * s, backInsetMm: 21 * s },
      // A recessed appliance housing behind a thin, full-width picture frame.
      sideProfile: [station(0, 24, 24, 24), station(.12, 12, 12, 12), station(.82, 9, 9, 9), station(.96, 0, 0, 0), station(1, 0, 0, 0)],
      materials: { body: material('#e6e2da', .66), front: material('#f1f0eb', .48), bevel: material('#bb9764', .52), vent: material('#353936', .88), louver: material('#c9c8bd', .57) },
      outlet: { topFraction: .965, heightFraction: .025, sideInsetMm: 40 * s, louverCount: 3, verticalFinCount: 12 },
      gallery: { frameMm: 9 * s, screen: { x: .042, y: .243, width: .916, height: .916 * model.widthMm / model.heightMm * 9 / 16 } },
    };
  }
  const special = family === 'special', premium = family === 'premium';
  const topFraction = black ? .816 : special ? .752 : premium ? .807 : .793;
  return {
    family,
    casing: { bevelMm: (black ? 3 : premium ? 12 : 9) * s, cornerRadiusMm: (black ? 2.3 : premium ? 15 : special ? 10 : 8) * s, frontInsetMm: (black ? 2 : 5) * s, backInsetMm: (black ? 20 : 24) * s },
    // Rear chassis, rounded shoulder, full-width face, then the lower airfoil lip.
    sideProfile: black
      ? [station(0, 18, 35, 20), station(.16, 7, 24, 10), station(.68, 2, 10, 3), station(.94, 0, 0, 0), station(1, 1, 9, 1)]
      : premium
        ? [station(0, 23, 38, 24), station(.18, 11, 26, 12), station(.6, 2, 10, 4), station(.86, 0, 0, 0), station(.97, 2, 3, 1), station(1, 5, 12, 3)]
        : special
          ? [station(0, 21, 46, 19), station(.18, 8, 31, 9), station(.58, 1, 13, 3), station(.86, 0, 0, 0), station(.97, 2, 4, 1), station(1, 5, 13, 3)]
          : [station(0, 24, 40, 23), station(.18, 10, 28, 11), station(.58, 1, 11, 3), station(.86, 0, 0, 0), station(.97, 2, 3, 1), station(1, 5, 12, 3)],
    materials: {
      body: material(black ? '#303235' : '#e9eae7', matt ? .84 : .47),
      front: material(black ? matt ? '#353638' : '#55585b' : '#f6f6f3', black ? matt ? .87 : .13 : .42, black && !matt ? .25 : 0, black && !matt ? .84 : .09),
      bevel: material(black ? matt ? '#27292b' : '#64686b' : '#d9dcd7', black && !matt ? .23 : .51, black && !matt ? .35 : 0),
      vent: material('#111719', .93),
      louver: material(black ? matt ? '#36393b' : '#969d9e' : '#b4bcb9', black && !matt ? .26 : .58, black && !matt ? .45 : 0),
    },
    outlet: { topFraction, heightFraction: black ? .153 : special ? .119 : .104, sideInsetMm: (black ? 4 : premium ? 17 : 10) * s, louverCount: black ? 5 : 2, verticalFinCount: black ? 6 : special ? 7 : 6 },
  };
}

const n = (value: number) => Number(value.toFixed(3));

/**
 * Optional casing texture for a projected side quad. UV orientation matches
 * [back corner i, back corner i+1, front corner i+1, front corner i]. Thus v=0
 * is at the wall and v=1 at the face; u runs clockwise around the unit.
 * Apply to the entire side or clip it to each sideProfile segment's v interval.
 */
export function unitSideSvg(model: UnitDesignModel, kind: UnitFaceKind): string {
  const design = getUnitDesign(model), { materials, family } = design;
  const across = kind === 'top' || kind === 'bottom' ? model.widthMm : model.heightMm;
  const depth = model.depthMm, bottom = kind === 'bottom', top = kind === 'top';
  const dark = family === 'mirror' || family === 'matt-black';
  const gap = Math.max(3, across / 52);
  const intake = top && family !== 'gallery'
    ? `<g data-part="intake-slots" fill="${materials.vent.color}" opacity=".72">${Array.from({ length: Math.floor(across / gap) - 2 }, (_, i) => `<rect x="${n(gap * (i + 1))}" y="${n(depth * .12)}" width="${n(gap * .47)}" height="${n(depth * .39)}" rx="1.4"/>`).join('')}</g>` : '';
  const outlet = bottom
    ? `<g data-part="underside-outlet"><rect x="${n(across * .055)}" y="${n(depth * .38)}" width="${n(across * .89)}" height="${n(depth * .38)}" rx="${n(depth * .04)}" fill="${materials.vent.color}"/>${Array.from({ length: family === 'gallery' ? 4 : 3 }, (_, i) => `<path d="M${n(across * .06)} ${n(depth * (.43 + i * .105))}H${n(across * .94)}" stroke="${materials.louver.color}" stroke-width="${n(depth * .025)}"/>`).join('')}${Array.from({ length: design.outlet.verticalFinCount }, (_, i) => `<path d="M${n(across * (.1 + .8 * i / Math.max(1, design.outlet.verticalFinCount - 1)))} ${n(depth * .4)}v${n(depth * .35)}" stroke="${materials.body.color}" stroke-width="${n(depth * .018)}"/>`).join('')}</g>` : '';
  const seam = !top && !bottom
    ? `<path data-part="service-seam" d="M${n(across * .12)} ${n(depth * .64)}H${n(across * .86)}Q${n(across * .93)} ${n(depth * .64)} ${n(across * .93)} ${n(depth * .73)}V${n(depth * .93)}" stroke="${dark ? '#72777a' : '#b9bfba'}" stroke-opacity=".48" stroke-width=".65"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(across)}" height="${n(depth)}" viewBox="0 0 ${n(across)} ${n(depth)}" fill="none" data-design-family="${family}" data-face="${kind}"><defs><linearGradient id="side" x2="0" y2="1"><stop stop-color="${materials.body.color}"/><stop offset=".67" stop-color="${materials.body.color}"/><stop offset="1" stop-color="${materials.bevel.color}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#side)"/>${intake}${outlet}${seam}<path d="M0 ${n(depth * .955)}H${n(across)}" stroke="${dark ? '#8f9596' : '#fff'}" stroke-opacity="${dark ? '.22' : '.6'}" stroke-width="1"/></svg>`;
}
