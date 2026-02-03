// см в px при заданном dpi
// Формула: px = (см / 2.54) * dpi
export function cmToPx(cm: number, dpi: number): number {
  return Math.round((cm / 2.54) * dpi);
}

// px в см при заданном dpi
export function pxToCm(px: number, dpi: number): number {
  return (px * 2.54) / dpi;
}
