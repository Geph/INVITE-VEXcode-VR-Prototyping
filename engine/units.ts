/**
 * Unit and angle helpers. Millimetre↔pixel conversion takes an explicit
 * `pixelsPerMm` (the camera zoom). Nothing here assumes a canvas size.
 */

export const MM_PER_INCH = 25.4

export function mmToInches(mm: number): number {
  return mm / MM_PER_INCH
}

export function inchesToMm(inches: number): number {
  return inches * MM_PER_INCH
}

export function mmToPixels(mm: number, pixelsPerMm: number): number {
  return mm * pixelsPerMm
}

export function pixelsToMm(pixels: number, pixelsPerMm: number): number {
  return pixelsPerMm === 0 ? 0 : pixels / pixelsPerMm
}

/** Distance in `unit` to millimetres. Only "inches" / "INCHES" are imperial. */
export function distanceToMm(distance: number, unit: string): number {
  if (unit === "inches" || unit === "INCHES") return inchesToMm(distance)
  return distance
}

export function mmToDistance(mm: number, unit: string): number {
  if (unit === "inches" || unit === "INCHES") return mmToInches(mm)
  return mm
}

/**
 * Wrap into [0, 360). Same as the Ocean Reef helper, including the signed-zero
 * case: `-360 % 360` is `-0`, and `-0 < 0` is false.
 */
export function normalizeDegrees(deg: number): number {
  let d = deg % 360
  if (d < 0) d += 360
  return d
}

/** Shortest signed delta from `from` to `to` (degrees). */
export function shortestRotationDelta(from: number, to: number): number {
  let delta = normalizeDegrees(to) - normalizeDegrees(from)
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  return delta
}

/**
 * Compass bearing of the vector from A to B, degrees, 0 = north, clockwise.
 * Degenerate (coincident) points return 0.
 */
export function angleBetween(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  if (dx === 0 && dy === 0) return 0
  return normalizeDegrees((Math.atan2(dx, dy) * 180) / Math.PI)
}
