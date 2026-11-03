import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyHomography, homographyForPlane, invertHomography, mapFromWall,
  mapToWall, projectUnit, validateWallPlane, wallTransform,
  type Point, type WallPlane,
} from './wall-plane';

const rectangle: WallPlane = [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.2 }, { x: 0.9, y: 0.8 }, { x: 0.1, y: 0.8 }];
const trapezoid: WallPlane = [{ x: 0.1, y: 0.12 }, { x: 0.87, y: 0.23 }, { x: 0.73, y: 0.9 }, { x: 0.24, y: 0.8 }];
const corners: WallPlane = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const close = (actual: Point, expected: Point, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual.x - expected.x) < tolerance, `x: ${actual.x} != ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < tolerance, `y: ${actual.y} != ${expected.y}`);
};

test('wall validation accepts clockwise rectangles and perspective walls', () => {
  assert.equal(validateWallPlane(rectangle), true);
  assert.equal(validateWallPlane(trapezoid), true);
  assert.equal(validateWallPlane(corners), true);
  assert.equal(validateWallPlane([{ x: 0, y: 0 }, { x: 0.2, y: 0 }, { x: 0.2, y: 0.1 }, { x: 0, y: 0.1 }]), true);
});

test('wall validation rejects reversed, crossed, misordered, concave and degenerate quadrilaterals', () => {
  const [a, b, c, d] = rectangle;
  const invalid: unknown[] = [
    null, {}, [], [a, b, c], [a, b, c, d, a], [a, d, c, b], [a, c, b, d], [c, d, a, b],
    [a, b, a, d], [a, b, { x: 0.3, y: 0.3 }, d],
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 0 }, { x: 0, y: 0.8 }],
    [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 0.1, y: 0.1 }, { x: 0, y: 0.1 }],
    [{ x: -0.1, y: 0 }, b, c, d], [{ x: NaN, y: 0 }, b, c, d], [{ x: 0, y: Infinity }, b, c, d],
    [{ x: '0.1', y: 0.2 }, b, c, d],
  ];
  for (const plane of invalid) assert.equal(validateWallPlane(plane), false, JSON.stringify(plane));
});

test('rectangle mapping correctly translates and scales image coordinates', () => {
  close(mapFromWall(rectangle, { x: 0.25, y: 0.75 }), { x: 0.3, y: 0.65 });
  close(mapToWall(rectangle, { x: 0.3, y: 0.65 }), { x: 0.25, y: 0.75 });
  close(mapFromWall(rectangle, { x: -0.1, y: 1.2 }), { x: 0.02, y: 0.92 });
});

test('perspective mapping reaches all four corners and round-trips an interior grid', () => {
  corners.forEach((corner, i) => close(mapFromWall(trapezoid, corner), trapezoid[i]));
  for (let x = 0; x <= 1; x += 0.1) {
    for (let y = 0; y <= 1; y += 0.1) close(mapToWall(trapezoid, mapFromWall(trapezoid, { x, y })), { x, y });
  }
  const h = homographyForPlane(trapezoid);
  assert.ok(Math.abs(h[6]) + Math.abs(h[7]) > 0.01, 'uses perspective, rather than an affine approximation');
  const inverse = invertHomography(h);
  close(applyHomography(inverse, applyHomography(h, { x: 0.41, y: 0.37 })), { x: 0.41, y: 0.37 });
});

test('projected unit dimensions and edge containment are preserved in wall coordinates', () => {
  const ratio = 0.7;
  const width = 0.3;
  const height = width * ratio;
  const position = { x: width / 2, y: height / 2, width };
  const projected = projectUnit(trapezoid, position, ratio);
  const expected: WallPlane = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  projected.forEach((point, i) => close(mapToWall(trapezoid, point), expected[i]));
  const outside = projectUnit(trapezoid, { x: 0, y: 0, width }, ratio);
  assert.ok(mapToWall(trapezoid, outside[0]).x < 0, 'does not hide invalid placement by clipping corners');
});

test('CSS matrix maps full-image pixel coordinates to the same projected corners', () => {
  const width = 1200;
  const height = 800;
  const values = wallTransform(trapezoid, width, height).slice(9, -1).split(',').map(Number);
  assert.equal(values.length, 16);
  corners.forEach((point, index) => {
    const x = point.x * width;
    const y = point.y * height;
    const denominator = values[3] * x + values[7] * y + values[15];
    close({
      x: (values[0] * x + values[4] * y + values[12]) / denominator / width,
      y: (values[1] * x + values[5] * y + values[13]) / denominator / height,
    }, trapezoid[index]);
  });
});

test('invalid transform inputs and perspective horizons fail explicitly', () => {
  assert.throws(() => homographyForPlane([rectangle[0], rectangle[0], rectangle[0], rectangle[0]]), RangeError);
  assert.throws(() => invertHomography(Array(9).fill(0)), RangeError);
  assert.throws(() => invertHomography([1, 0, 0, 0, 0, 0, 0, 0, 1]), RangeError);
  assert.throws(() => applyHomography([1, 0, 0, 0, 1, 0, 0, 0, 0], { x: 0, y: 0 }), RangeError);
  assert.throws(() => applyHomography([1, 2], { x: 0, y: 0 }), RangeError);
  assert.throws(() => applyHomography(homographyForPlane(rectangle), { x: NaN, y: 0 }), RangeError);
  assert.throws(() => projectUnit(rectangle, { x: 0.5, y: 0.5, width: 0 }, 0.3), RangeError);
  assert.throws(() => projectUnit(rectangle, { x: 0.5, y: 0.5, width: 0.3 }, -1), RangeError);
  assert.throws(() => wallTransform(rectangle, 0, 800), RangeError);
});

test('homography application and inversion are insensitive to uniform matrix scale', () => {
  const h = homographyForPlane(trapezoid);
  const point = { x: 0.2, y: 0.9 };
  for (const scale of [1e-100, 1e100, -7]) {
    const scaled = h.map(value => value * scale);
    close(applyHomography(scaled, point), applyHomography(h, point));
    close(applyHomography(invertHomography(scaled), applyHomography(scaled, point)), point);
  }
});
