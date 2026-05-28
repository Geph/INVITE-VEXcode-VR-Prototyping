/** Shared helpers for VEXcode VR–style robot simulation (units, angles, block traversal). */

/** ~13.33 playground pixels per 100 mm (7.5 mm per pixel). */
export const MM_PER_PIXEL = 7.5
export const PIXELS_PER_MM = 1 / MM_PER_PIXEL
export const PIXELS_PER_INCH = 25.4 * PIXELS_PER_MM

export function clampRobotPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  margin = 35,
): { x: number; y: number } {
  return {
    x: Math.max(margin, Math.min(width - margin, x)),
    y: Math.max(margin, Math.min(height - margin, y)),
  }
}

export function distanceToPixels(distance: number, unit: string): number {
  if (unit === "inches" || unit === "INCHES") {
    return distance * PIXELS_PER_INCH
  }
  return distance * PIXELS_PER_MM
}

export function pixelsToDistance(pixels: number, unit: string): number {
  if (unit === "inches" || unit === "INCHES") {
    return pixels / PIXELS_PER_INCH
  }
  return pixels * MM_PER_PIXEL
}

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

/** Drive animation timing at 50% velocity (VEX default). */
export const DRIVE_MS_PER_MM_AT_50 = 10
/** Turn animation timing at 50% turn velocity — independent from drive. */
export const TURN_MS_PER_DEGREE_AT_50 = 22

export function driveDurationMs(distancePixels: number, driveVelocityPercent: number): number {
  const v = Math.max(5, Math.min(100, driveVelocityPercent))
  const distanceMm = pixelsToDistance(distancePixels, "mm")
  return Math.max(80, (distanceMm * DRIVE_MS_PER_MM_AT_50 * 50) / v)
}

export function turnDurationMs(degrees: number, turnVelocityPercent: number): number {
  const v = Math.max(5, Math.min(100, turnVelocityPercent))
  return Math.max(80, (Math.abs(degrees) * TURN_MS_PER_DEGREE_AT_50 * 50) / v)
}

/** Max drive distance (mm) before hitting playground edge along current heading. */
export function maxDriveDistanceMm(
  x: number,
  y: number,
  rotationDeg: number,
  direction: string,
  width: number,
  height: number,
  margin = 35,
): number {
  const sign = direction === "forward" ? 1 : -1
  const angleRad = (rotationDeg * Math.PI) / 180
  const step = 2
  let dist = 0
  const maxPx = Math.hypot(width, height)
  while (dist < maxPx) {
    const px = x + sign * dist * Math.sin(angleRad)
    const py = y - sign * dist * Math.cos(angleRad)
    if (px < margin || py < margin || px > width - margin || py > height - margin) {
      return pixelsToDistance(dist, "mm")
    }
    dist += step
  }
  return pixelsToDistance(maxPx, "mm")
}

/** Deterministic 0..1 for stable visuals (SSR-safe). */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000
  return x - Math.floor(x)
}

export interface CoralPiece {
  x: number
  y: number
  radius: number
  color: string
}

export interface TrashSim {
  x: number
  y: number
  isCollected: boolean
  type: string
}

export function pointHitsCoral(
  x: number,
  y: number,
  coralPieces: CoralPiece[],
  margin = 0,
): boolean {
  for (const piece of coralPieces) {
    const dist = Math.hypot(x - piece.x, y - piece.y)
    if (dist < piece.radius + margin) return true
  }
  return false
}

export function raycastToBorder(
  x: number,
  y: number,
  rotationDeg: number,
  canvasW: number,
  canvasH: number,
  coralPieces: CoralPiece[],
  maxMm = 2000,
): number {
  const maxPx = distanceToPixels(maxMm, "mm")
  const angleRad = (rotationDeg * Math.PI) / 180
  const step = 2
  let dist = 0
  while (dist < maxPx) {
    const px = x + Math.sin(angleRad) * dist
    const py = y - Math.cos(angleRad) * dist
    if (px < 20 || py < 20 || px > canvasW - 20 || py > canvasH - 20) {
      return pixelsToDistance(dist, "mm")
    }
    if (pointHitsCoral(px, py, coralPieces, 8)) {
      return pixelsToDistance(dist, "mm")
    }
    dist += step
  }
  return pixelsToDistance(maxPx, "mm")
}

export function nearestTrashDistanceMm(
  x: number,
  y: number,
  trashItems: TrashSim[],
): number | null {
  let best: number | null = null
  for (const t of trashItems) {
    if (t.isCollected) continue
    const px = Math.hypot(x - t.x, y - t.y)
    const mm = pixelsToDistance(px, "mm")
    if (best === null || mm < best) best = mm
  }
  return best
}

/** Walk statement chain inside when_started (and nested C-blocks). */
export function forEachProgramBlock(
  startBlock: { type: string; getInputTargetBlock?: (name: string) => unknown; getNextBlock?: () => unknown },
  visit: (block: {
    type: string
    getFieldValue: (name: string) => string
    getInputTargetBlock: (name: string) => unknown
    getNextBlock: () => unknown
  }) => void,
): void {
  const seen = new Set<unknown>()
  const walk = (block: unknown) => {
    if (!block || seen.has(block)) return
    seen.add(block)
    const b = block as {
      type: string
      getFieldValue: (name: string) => string
      getInputTargetBlock: (name: string) => unknown
      getNextBlock: () => unknown
    }
    visit(b)
    const statementInputs = ["DO", "DO1", "DO2", "ELSE"]
    for (const input of statementInputs) {
      if (typeof b.getInputTargetBlock === "function") {
        walk(b.getInputTargetBlock(input))
      }
    }
    walk(b.getNextBlock())
  }

  if (startBlock.type === "when_started" && startBlock.getInputTargetBlock) {
    walk(startBlock.getInputTargetBlock("DO"))
  } else {
    walk(startBlock)
  }
}

export function registerBlockGenerator(Blockly: { JavaScript: { forBlock: Record<string, unknown> } }, type: string, fn: (block: unknown) => string | [string, number]) {
  Blockly.JavaScript.forBlock[type] = fn
}
