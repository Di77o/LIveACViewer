/** Coordinates are normalized to the complete image or to the wall, as documented. */
export type Point = { x: number; y: number };

/** Image-space corners in top-left, top-right, bottom-right, bottom-left order. */
export type WallPlane = [Point, Point, Point, Point];

const EPSILON = 1e-12;
const finitePoint = (value: unknown): value is Point => {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Partial<Point>;
  return typeof p.x === 'number' && Number.isFinite(p.x)
    && typeof p.y === 'number' && Number.isFinite(p.y);
};

/**
 * Require a clockwise convex wall occupying at least 2% of the image. In image
 * coordinates y points down, so clockwise winding has positive signed area.
 * Opposite-edge centers establish the intended top/left corner ordering while
 * allowing sloping edges and perspective. Invalid input returns false.
 */
export function validateWallPlane(input: unknown): input is WallPlane {
  if (!Array.isArray(input) || input.length !== 4) return false;
  if (!input.every(p => finitePoint(p) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)) return false;
  const points = input as WallPlane;
  let doubleArea = 0;
  for (let i = 0; i < 4; i++) {
    const a = points[i];
    const b = points[(i + 1) % 4];
    const c = points[(i + 2) % 4];
    const turn = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (turn <= EPSILON) return false;
    doubleArea += a.x * b.y - b.x * a.y;
  }
  if (doubleArea / 2 < 0.02 - EPSILON) return false;
  const [tl, tr, br, bl] = points;
  return tl.y + tr.y < bl.y + br.y && tl.x + bl.x < tr.x + br.x;
}

/** Solve an augmented square system with partial-pivot Gaussian elimination. */
function solve(rows: number[][]): number[] {
  const size = rows.length;
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) <= EPSILON) throw new RangeError('Wall plane is singular.');
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let j = column; j <= size; j++) rows[column][j] /= divisor;
    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let j = column; j <= size; j++) rows[row][j] -= factor * rows[column][j];
    }
  }
  return rows.map(row => row[size]);
}

/** Return a row-major 3×3 homography mapping wall UV (unit square) to the image. */
export function homographyForPlane(plane: WallPlane): number[] {
  if (!validateWallPlane(plane)) throw new RangeError('Choose four convex wall corners in top-left to bottom-left order.');
  const uv: WallPlane = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const rows: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = uv[i];
    const { x, y } = plane[i];
    rows.push([u, v, 1, 0, 0, 0, -x * u, -x * v, x]);
    rows.push([0, 0, 0, u, v, 1, -y * u, -y * v, y]);
  }
  return [...solve(rows), 1];
}

function validateMatrix(matrix: readonly number[]): void {
  if (matrix.length !== 9 || !matrix.every(Number.isFinite)) throw new RangeError('A homography must contain nine finite numbers.');
}

/** Apply a row-major 3×3 homography, including perspective division. */
export function applyHomography(matrix: readonly number[], point: Point): Point {
  validateMatrix(matrix);
  if (!finitePoint(point)) throw new RangeError('A point must contain finite coordinates.');
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const denominator = g * point.x + h * point.y + i;
  const denominatorScale = Math.abs(g * point.x) + Math.abs(h * point.y) + Math.abs(i);
  if (Math.abs(denominator) <= EPSILON * denominatorScale || denominator === 0) {
    throw new RangeError('This point lies on the perspective horizon.');
  }
  const result = {
    x: (a * point.x + b * point.y + c) / denominator,
    y: (d * point.x + e * point.y + f) / denominator,
  };
  if (!finitePoint(result)) throw new RangeError('The projected point is not finite.');
  return result;
}

/** Invert a row-major 3×3 homography. Singular/nonfinite matrices throw RangeError. */
export function invertHomography(matrix: readonly number[]): number[] {
  validateMatrix(matrix);
  // Normalize before computing cofactors to avoid scale-dependent overflow.
  const scale = Math.max(...matrix.map(Math.abs));
  if (scale === 0) throw new RangeError('The homography is singular.');
  const [a, b, c, d, e, f, g, h, i] = matrix.map(n => n / scale);
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const determinant = a * A + b * B + c * C;
  if (Math.abs(determinant) <= EPSILON) throw new RangeError('The homography is singular.');
  // A homography is unchanged by multiplication by a nonzero scalar: the
  // adjugate itself represents the inverse, without an unnecessary 1/det.
  return [A, c * h - b * i, b * f - c * e, B, a * i - c * g, c * d - a * f, C, b * g - a * h, a * e - b * d];
}

/** Convert wall UV to normalized full-image coordinates. UV may lie outside 0..1. */
export function mapFromWall(plane: WallPlane, uv: Point): Point {
  return applyHomography(homographyForPlane(plane), uv);
}

/** Convert normalized full-image coordinates to wall UV. No clamping is applied. */
export function mapToWall(plane: WallPlane, point: Point): Point {
  return applyHomography(invertHomography(homographyForPlane(plane)), point);
}

/**
 * Project a unit rectangle onto the wall. Position x/y is its CENTER in wall UV;
 * width is a fraction of wall width. ratio = unitHeight/unitWidth in wall UV,
 * e.g. (heightMm/widthMm) * (wallWidthCm/wallHeightCm). No clamping is applied,
 * so callers can detect and constrain placements extending beyond the wall.
 */
export function projectUnit(plane: WallPlane, position: { x: number; y: number; width: number }, ratio: number): WallPlane {
  if (!finitePoint(position) || !Number.isFinite(position.width) || position.width <= 0 || !Number.isFinite(ratio) || ratio <= 0) {
    throw new RangeError('Unit position, width, and aspect ratio must be finite; size must be positive.');
  }
  const halfWidth = position.width / 2;
  const halfHeight = position.width * ratio / 2;
  const matrix = homographyForPlane(plane);
  return [
    { x: position.x - halfWidth, y: position.y - halfHeight },
    { x: position.x + halfWidth, y: position.y - halfHeight },
    { x: position.x + halfWidth, y: position.y + halfHeight },
    { x: position.x - halfWidth, y: position.y + halfHeight },
  ].map(p => applyHomography(matrix, p)) as WallPlane;
}

/**
 * CSS transform for a full-image-sized element (widthPx × heightPx) into the
 * plane's corner quad in that same image. Set transform-origin: 0 0. Dimensions
 * must describe the displayed image, not the unit rectangle.
 */
export function wallTransform(plane: WallPlane, widthPx: number, heightPx: number): string {
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) || widthPx <= 0 || heightPx <= 0) {
    throw new RangeError('Image dimensions must be positive finite numbers.');
  }
  const [a, b, c, d, e, f, g, h, i] = homographyForPlane(plane);
  // CSS matrix3d is column-major; conjugate normalized H with image scaling.
  const values = [
    a, d * heightPx / widthPx, 0, g / widthPx,
    b * widthPx / heightPx, e, 0, h / heightPx,
    0, 0, 1, 0,
    c * widthPx, f * heightPx, 0, i,
  ];
  return `matrix3d(${values.map(value => Number(value.toPrecision(14))).join(',')})`;
}
