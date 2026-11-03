export type Position = { x: number; y: number; width: number };

export function unitHeight(width: number, widthMm: number, heightMm: number, imageAspect: number) {
  return width * heightMm / widthMm * imageAspect;
}

export function constrainPosition(position: Position, widthMm: number, heightMm: number, imageAspect: number): Position {
  const width = Math.max(0.08, Math.min(0.6, position.width, 0.85 * widthMm / heightMm / imageAspect));
  const height = unitHeight(width, widthMm, heightMm, imageAspect);
  return {
    x: Math.max(width / 2 + 0.015, Math.min(0.985 - width / 2, position.x)),
    y: Math.max(height / 2 + 0.015, Math.min(0.985 - height / 2, position.y)),
    width,
  };
}

export function approximateWidth(widthMm: number, wallWidthCm: number) {
  return Math.max(0.08, Math.min(0.6, widthMm / 10 / wallWidthCm));
}
