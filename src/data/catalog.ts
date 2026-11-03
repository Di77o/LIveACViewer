/**
 * Starter collection, checked against LG's public regional catalog on 2026-11-03.
 * Dimensions and nominal cooling capacities refer to the 2026 RAC brochure below.
 * Product family pages can show earlier product photographs; these are reference
 * images, not guaranteed photographs of every regional SKU/capacity variant.
 */
export type ACModel = {
  id: string;
  name: string;
  family: string;
  description: string;
  finish: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  capacities: string[];
  imageUrl: string;
  sourceUrl: string;
  imageSourceUrl: string;
  specificationSourceUrl: string;
  verifiedAt: string;
  visualVariant: 'standard' | 'mirror' | 'gallery';
  marketNote: string;
};

export const catalogNote =
  'A starter collection from official LG Belgium and Netherlands pages and the 2026 LG RAC brochure. Confirm the exact Belgian SKU and stock with your installer. Preview artwork is illustrative; this is not an exhaustive Belgian availability list.';

export const catalogSources = {
  belgium: 'https://www.lgklimaat.be/producten/lg-single-split/',
  brochure2026: 'https://www.lgklimaat.nl/media/qlypkfv5/lg_rac-flyer-digital-airco_nl_2026.pdf',
  checkedAt: '2026-11-03',
};

const shared = {
  verifiedAt: catalogSources.checkedAt,
  specificationSourceUrl: catalogSources.brochure2026,
  marketNote: 'Listed on LG Belgium’s regional site. Confirm the exact 2026 SKU and availability with your installer.',
};

export const models: ACModel[] = [
  {
    ...shared,
    id: 'artcool-mirror',
    name: 'ARTCOOL AI Mirror',
    family: 'ARTCOOL',
    description: 'A reflective glass front with a quiet architectural presence. AI Air and a dual-vane design.',
    finish: 'Mirror black',
    widthMm: 935,
    heightMm: 307,
    depthMm: 235,
    capacities: ['2.5 kW', '3.5 kW', '5.0 kW'],
    imageUrl: '/models/mirror.jpg',
    sourceUrl: 'https://www.lgklimaat.be/producten/lg-single-split/dualcool-ai-air-mirror/',
    imageSourceUrl: 'https://www.lgklimaat.nl/media/xnvpwr2s/single-split-inverter-air-conditioner-s1-2025-s3nm091lrc0-gallery-gallery-1100-01.jpg',
    visualVariant: 'mirror',
  },
  {
    ...shared,
    id: 'artcool-gallery',
    name: 'ARTCOOL Gallery Premium',
    family: 'ARTCOOL',
    description: 'A square wood-look frame with a 27-inch display, turning the indoor unit into part of your gallery wall.',
    finish: 'Wood-look frame',
    widthMm: 652,
    heightMm: 652,
    depthMm: 158,
    capacities: ['2.6 kW', '3.7 kW'],
    imageUrl: '/models/gallery-premium.jpg',
    sourceUrl: 'https://www.lgklimaat.be/producten/lg-single-split/artcool-gallery-premium/',
    imageSourceUrl: 'https://www.lgklimaat.nl/media/m3rj15vh/01_rac_ga2_s3nm12el26a_a12ga2_front_eng_home_auto.jpg',
    visualVariant: 'gallery',
  },
  {
    ...shared,
    id: 'dualcool-premium',
    name: 'DUALCOOL AI Premium',
    family: 'DUALCOOL',
    description: 'A clean white front with AI Air, a human-detecting sensor, and adjustable dual-vane airflow.',
    finish: 'White',
    widthMm: 895,
    heightMm: 307,
    depthMm: 235,
    capacities: ['2.5 kW', '3.5 kW'],
    imageUrl: '/models/dualcool-premium.jpg',
    sourceUrl: 'https://www.lgklimaat.be/producten/lg-single-split/dualcool-ai-air-premium/',
    imageSourceUrl: 'https://www.lgklimaat.nl/media/nfkjoo0u/silver_vr_1.jpg',
    visualVariant: 'standard',
  },
  {
    ...shared,
    id: 'dualcool-deluxe',
    name: 'DUALCOOL AI Deluxe',
    family: 'DUALCOOL',
    description: 'An understated white profile with Soft Air and LG ThinQ control, suited to a light, minimal interior.',
    finish: 'White',
    widthMm: 895,
    heightMm: 307,
    depthMm: 235,
    capacities: ['2.5 kW', '3.5 kW', '5.0 kW', '6.6 kW'],
    imageUrl: '/models/dualcool-deluxe.jpg',
    sourceUrl: 'https://www.lgklimaat.be/producten/lg-single-split/dualcool-ai-air-deluxe/',
    imageSourceUrl: 'https://www.lgklimaat.nl/media/kqqcuhlh/dualcool-ai-air-deluxe-single-split_01.jpg?width=1000',
    visualVariant: 'standard',
  },
  {
    ...shared,
    id: 'artcool-matt-black',
    name: 'ARTCOOL AI Matt Black',
    family: 'ARTCOOL',
    description: 'A low-sheen black finish for a bolder contrast, with AI Air and dual-vane airflow.',
    finish: 'Matt black',
    widthMm: 935,
    heightMm: 307,
    depthMm: 235,
    capacities: ['2.5 kW', '3.5 kW', '5.0 kW'],
    imageUrl: '/models/matt-black.jpg',
    sourceUrl: 'https://www.lgklimaat.nl/producten/lg-single-split/artcool-ai-matt-black/',
    imageSourceUrl: 'https://www.lgklimaat.nl/media/vasp2xpu/aa09sb-eu-mattblack-01-front.jpg?width=1000',
    visualVariant: 'mirror',
    marketNote: 'Listed in the official LG Netherlands 2026 collection; Belgian availability has not been verified.',
  },
  {
    ...shared,
    id: 'dualcool-special',
    name: 'DUALCOOL AI Special',
    family: 'DUALCOOL',
    description: 'A narrower white wall unit for spaces where a discreet footprint matters.',
    finish: 'White',
    widthMm: 799,
    heightMm: 307,
    depthMm: 235,
    capacities: ['2.5 kW', '3.5 kW'],
    imageUrl: '/models/dualcool-special.jpg',
    sourceUrl: 'https://www.lgklimaat.be/producten/lg-single-split/dualcool-ai-air-special/',
    imageSourceUrl: 'https://www.lgklimaat.nl/media/ujeh05aj/09_s0_s3nm090a1h0_p09snd_eu_frontlow1.jpg',
    visualVariant: 'standard',
  },
];
