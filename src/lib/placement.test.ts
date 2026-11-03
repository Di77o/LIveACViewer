import test from 'node:test';
import assert from 'node:assert/strict';
import { approximateWidth, constrainPosition, unitHeight } from './placement.ts';

test('a model width is scaled to the user supplied visible wall width', () => {
  assert.equal(approximateWidth(900, 450), 0.2);
});
test('drag and model aspect ratio keep the whole unit within the photo', () => {
  for (const imageAspect of [0.5, 4 / 3, 2.4]) {
    for (const [widthMm, heightMm] of [[900, 300], [652, 652]]) {
      const result = constrainPosition({x: -2, y: 4, width: 0.9}, widthMm, heightMm, imageAspect);
      const height = unitHeight(result.width, widthMm, heightMm, imageAspect);
      assert.ok(result.x - result.width / 2 >= 0);
      assert.ok(result.y + height / 2 <= 1);
      assert.ok(height <= 0.85);
    }
  }
});
