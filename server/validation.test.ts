import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, validateDetectedWall, validatePhoto, validatePlacement, validateRequest } from './validation.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9z0AAAAASUVORK5CYII=';
const request = { image: png, model: { name: 'LG wall unit', widthMm: 837, heightMm: 308, depthMm: 189 }, wallWidthCm: 400, imageWidth: 1200, imageHeight: 800 };
const placement = { x: 0.5, y: 0.25, width: 0.22, reasoning: ['Balanced on the visible wall.'], summary: 'Position above the seating area.', confidence: 'medium', warnings: ['Ask an installer to confirm.'] };

test('accepts a supported photo and valid model dimensions', () => {
  assert.deepEqual(validateRequest(request), request);
});

test('recommendations preserve valid selected wall corners and reject malformed planes', () => {
  const wallCorners = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.15 }, { x: 0.85, y: 0.9 }, { x: 0.12, y: 0.9 }];
  assert.deepEqual(validateRequest({ ...request, wallCorners }).wallCorners, wallCorners);
  for (const invalid of [null, [], wallCorners.slice(0, 3), [...wallCorners].reverse(), [{ x: -0.1, y: 0.1 }, ...wallCorners.slice(1)]]) {
    assert.throws(() => validateRequest({ ...request, wallCorners: invalid }), ApiError);
  }
});

test('rejects disguised files, malformed base64, oversize images, and missing dimensions', () => {
  for (const changed of [
    { image: 'data:image/jpeg;base64,' + png.split(',')[1] },
    { image: 'data:image/png;base64,aGVsbG8=' },
    { image: 'data:image/png;base64,%%%%' },
    { image: 'x'.repeat(11_184_837) },
    { wallWidthCm: 0 },
    { wallWidthCm: Infinity },
    { imageHeight: undefined },
    { model: { ...request.model, widthMm: -1 } },
    { model: { ...request.model, name: '' } },
  ]) assert.throws(() => validateRequest({ ...request, ...changed }), ApiError);
});

test('accepts usable normalized placements', () => {
  assert.deepEqual(validatePlacement(placement), placement);
});

test('rejects output outside frame, nonnumeric coordinates, and excessive output', () => {
  for (const changed of [
    { x: -0.2 }, { x: 1 }, { width: 0.9 }, { y: NaN }, { x: '0.5' },
    { reasoning: [] }, { warnings: Array(6).fill('Warning') },
    { confidence: 'certain' }, { summary: '' },
  ]) assert.throws(() => validatePlacement({ ...placement, ...changed }), ApiError);
});

test('wall detection validates photos without requiring an indoor unit or wall measurement', () => {
  assert.deepEqual(validatePhoto({ image: png, imageWidth: 1200, imageHeight: 800 }, true), { image: png, imageWidth: 1200, imageHeight: 800 });
  assert.throws(() => validatePhoto({ image: png }, true), ApiError);
});

test('wall detection accepts convex ordered corners or a low-confidence null result', () => {
  const wall = { corners: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.15 }, { x: 0.85, y: 0.9 }, { x: 0.12, y: 0.9 }], confidence: 'medium', summary: 'The main wall.', warnings: [] };
  assert.deepEqual(validateDetectedWall(wall), wall);
  assert.deepEqual(validateDetectedWall({ ...wall, corners: null, confidence: 'low' }), { ...wall, corners: null, confidence: 'low' });
  for (const changed of [
    { corners: null, confidence: 'high' },
    { corners: wall.corners.slice(0, 3) },
    { corners: [{ x: 0.1, y: 0.1 }, { x: 0.1, y: 0.9 }, { x: 0.9, y: 0.9 }, { x: 0.9, y: 0.1 }] },
    { corners: [{ x: 0.1, y: 0.1 }, { x: 1.1, y: 0.15 }, { x: 0.85, y: 0.9 }, { x: 0.12, y: 0.9 }] },
    { corners: [{ x: 0.1, y: 0.1 }, { x: 0.11, y: 0.1 }, { x: 0.11, y: 0.11 }, { x: 0.1, y: 0.11 }] },
    { warnings: Array(6).fill('Warning') },
  ]) assert.throws(() => validateDetectedWall({ ...wall, ...changed }), ApiError);
});
