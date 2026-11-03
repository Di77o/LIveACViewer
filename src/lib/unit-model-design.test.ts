import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { models } from '../data/catalog';
import { unitSvg } from '../components/UnitArtwork';
import { getUnitDesign, unitSideSvg, type UnitFaceKind } from './unit-model-design';

const find = (id: string) => models.find(model => model.id === id)!;

test('all catalog casing profiles span the complete depth and stay inside nominal dimensions', () => {
  for (const model of models) {
    const design = getUnitDesign(model), stations = design.sideProfile;
    assert.equal(stations[0].depthFraction, 0);
    assert.equal(stations.at(-1)!.depthFraction, 1);
    assert.ok(stations.length >= 5, model.id);
    assert.ok(stations.some(s => s.sideInsetMm === 0 && s.topInsetMm === 0 && s.bottomInsetMm === 0), 'nominal bounding dimensions are retained');
    for (const [i, station] of stations.entries()) {
      assert.ok(Object.values(station).every(Number.isFinite));
      assert.ok(station.sideInsetMm >= 0 && 2 * station.sideInsetMm < model.widthMm);
      assert.ok(station.topInsetMm >= 0 && station.bottomInsetMm >= 0 && station.topInsetMm + station.bottomInsetMm < model.heightMm);
      if (i) assert.ok(station.depthFraction > stations[i - 1].depthFraction);
    }
    assert.ok(design.outlet.topFraction + design.outlet.heightFraction < 1);
    assert.ok(design.outlet.sideInsetMm * 2 < model.widthMm);
  }
});

test('family shape and material differences encode the photographed appliances', () => {
  const mirror = getUnitDesign(find('artcool-mirror')), matt = getUnitDesign(find('artcool-matt-black'));
  const premium = getUnitDesign(find('dualcool-premium')), deluxe = getUnitDesign(find('dualcool-deluxe')), special = getUnitDesign(find('dualcool-special'));
  assert.deepEqual(mirror.sideProfile, matt.sideProfile, 'shared ARTCOOL casing');
  assert.ok(mirror.materials.front.roughness < matt.materials.front.roughness);
  assert.ok(mirror.materials.front.reflectivity > matt.materials.front.reflectivity);
  assert.ok(mirror.casing.cornerRadiusMm < premium.casing.cornerRadiusMm);
  assert.equal(mirror.outlet.louverCount, 5);
  assert.equal(deluxe.outlet.louverCount, 2);
  assert.ok(special.outlet.topFraction < deluxe.outlet.topFraction, 'Special has a taller lower airfoil/outlet assembly');
  assert.notDeepEqual(premium.sideProfile, deluxe.sideProfile);
  assert.notDeepEqual(special.sideProfile, deluxe.sideProfile);
  for (const model of models) for (const value of Object.values(getUnitDesign(model).materials)) {
    assert.match(value.color, /^#[a-f0-9]{6}$/i);
    for (const parameter of [value.roughness, value.metalness, value.reflectivity]) assert.ok(parameter >= 0 && parameter <= 1);
  }
});

test('Gallery has a thin picture frame and a 16:9 screen within the square board', () => {
  const model = find('artcool-gallery'), design = getUnitDesign(model), { screen, frameMm } = design.gallery!;
  assert.equal(model.widthMm, model.heightMm);
  assert.ok(frameMm >= 8 && frameMm <= 12);
  assert.ok(Math.abs(screen.width * model.widthMm / (screen.height * model.heightMm) - 16 / 9) < 1e-10);
  assert.ok(screen.x > frameMm / model.widthMm && screen.x + screen.width < 1 - frameMm / model.widthMm);
  assert.ok(screen.y > .23 && screen.y + screen.height < .77);
});

test('generic dimensions get a usable white profile and invalid dimensions fail explicitly', () => {
  const generic = { widthMm: 900, heightMm: 310, depthMm: 230 };
  assert.equal(getUnitDesign(generic).family, 'deluxe');
  assert.equal(getUnitDesign({ ...generic, visualVariant: 'gallery' }).family, 'gallery');
  for (const bad of [0, -1, NaN, Infinity]) assert.throws(() => getUnitDesign({ ...generic, depthMm: bad }), RangeError);
});

test('front textures rasterize at physical aspect, resolve paint references, and contain the family geometry', async () => {
  for (const model of models) {
    const svg = unitSvg(model), design = getUnitDesign(model);
    const ids = new Set(Array.from(svg.matchAll(/\bid="([^"]+)"/g), match => match[1]));
    for (const reference of svg.matchAll(/url\(#([^)]*)\)/g)) assert.ok(ids.has(reference[1]), reference[1]);
    assert.doesNotMatch(svg, /NaN|Infinity|<image\b|https?:\/\/(?!www\.w3\.org)/);
    const { info } = await sharp(Buffer.from(svg)).png().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, model.widthMm);
    assert.equal(info.height, model.heightMm);
    if (design.family === 'gallery') {
      assert.match(svg, /data-part="wood-frame"/);
      assert.match(svg, /data-part="display" data-aspect="16:9"/);
      assert.doesNotMatch(svg, /outlet-louvers/);
    } else {
      assert.equal(Array.from(svg.matchAll(/data-part="horizontal-louver"/g)).length, design.outlet.louverCount);
      assert.equal(Array.from(svg.matchAll(/data-part="vertical-fin"/g)).length, design.outlet.verticalFinCount);
      assert.match(svg, /data-part="outlet-cavity"/);
      assert.match(svg, /data-part="lower-airfoil"/);
    }
    assert.equal(svg.includes('data-part="glass-reflection"'), design.family === 'mirror');
  }
});

test('side textures use clockwise edge length by rear-to-front depth UVs and include intake/underside geometry', async () => {
  for (const model of models) for (const face of ['top', 'right', 'bottom', 'left'] as UnitFaceKind[]) {
    const svg = unitSideSvg(model, face);
    const metadata = await sharp(Buffer.from(svg)).metadata();
    assert.equal(metadata.width, face === 'top' || face === 'bottom' ? model.widthMm : model.heightMm);
    assert.equal(metadata.height, model.depthMm);
    assert.equal(svg.includes('data-part="underside-outlet"'), face === 'bottom');
    assert.equal(svg.includes('data-part="intake-slots"'), face === 'top' && model.visualVariant !== 'gallery');
  }
});
