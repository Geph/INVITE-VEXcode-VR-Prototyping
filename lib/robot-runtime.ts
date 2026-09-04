/** Shared helpers for VEXcode VR–style robot simulation (units, angles, block traversal). */

import {
  DRIVE_MS_PER_MM_AT_50,
  TURN_MS_PER_DEGREE_AT_50,
  driveDurationMs as driveDurationFromMm,
  turnDurationMs,
} from "@/engine/motion"
import { normalizeDegrees, shortestRotationDelta } from "@/engine/units"

export { DRIVE_MS_PER_MM_AT_50, TURN_MS_PER_DEGREE_AT_50, normalizeDegrees, shortestRotationDelta, turnDurationMs }

/** Coral Reef Cleanup playground (VEXcode VR docs). */
export const CORAL_REEF_FIELD_MM = 2000
export const CORAL_REEF_START_MM = { x: 0, y: -800 }
/** Battery lasts a few minutes in the official challenge (~3 min). */
export const CORAL_REEF_BATTERY_SEC = 180
export const CORAL_REEF_TRASH_COUNT = 12
/** Front distance sensor range (VEXcode VR). */
export const DISTANCE_SENSOR_MAX_MM = 3000
/** Eye “near object” range (mm) — tuned for playground scale. */
export const EYE_NEAR_MM = 250
/** Approximate trash sprite radius on the playground (px). */
export const TRASH_HIT_RADIUS_PX = 20
/** Front eye offset from robot center (px). */
export const EYE_FORWARD_OFFSET_PX = 22

/**
 * Bumper contact points sit on the front corners of the hull. The reach has to
 * exceed the hull's own coral-collision envelope (`robotRadius` 22 + piece
 * radius 12–20), otherwise the mission ends on impact before the bumper can
 * ever read as pressed.
 */
export const BUMPER_FORWARD_PX = 20
export const BUMPER_LATERAL_PX = 12
export const BUMPER_CONTACT_MARGIN_PX = 14

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

/** Pixel-taking wrapper around the engine helper (which works in millimetres). */
export function driveDurationMs(distancePixels: number, driveVelocityPercent: number): number {
  return driveDurationFromMm(pixelsToDistance(distancePixels, "mm"), driveVelocityPercent)
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
  /** Rendering only. Colony shape; omitted pieces pick one from `seed`. */
  kind?: "brain" | "branch" | "fan" | "polyps" | "tube"
  /** Rendering only. Rotation (radians) that points the colony away from its wall. */
  angle?: number
  /** Rendering only. Drives the deterministic per-colony detail. */
  seed?: number
}

export interface TrashSim {
  x: number
  y: number
  isCollected: boolean
  type: "bottle" | "can" | "wrapper" | "bag"
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
    const mm = pixelsToDistance(Math.max(0, px - TRASH_HIT_RADIUS_PX), "mm")
    if (best === null || mm < best) best = mm
  }
  return best
}

/** Nearest uncollected trash in front of the robot within maxMm (edge-to-edge). */
export function nearestTrashInFrontMm(
  x: number,
  y: number,
  rotationDeg: number,
  trashItems: TrashSim[],
  maxMm: number = DISTANCE_SENSOR_MAX_MM,
  eyeOffsetPx: number = EYE_FORWARD_OFFSET_PX,
): number | null {
  const angleRad = (rotationDeg * Math.PI) / 180
  const eyeX = x + Math.sin(angleRad) * eyeOffsetPx
  const eyeY = y - Math.cos(angleRad) * eyeOffsetPx
  const forwardX = Math.sin(angleRad)
  const forwardY = -Math.cos(angleRad)

  let best: number | null = null
  for (const t of trashItems) {
    if (t.isCollected) continue
    const dx = t.x - eyeX
    const dy = t.y - eyeY
    if (dx * forwardX + dy * forwardY < 0) continue
    const px = Math.hypot(dx, dy)
    const mm = pixelsToDistance(Math.max(0, px - TRASH_HIT_RADIUS_PX), "mm")
    if (mm > maxMm) continue
    if (best === null || mm < best) best = mm
  }
  return best
}

export function isTrashNearEye(
  x: number,
  y: number,
  rotationDeg: number,
  trashItems: TrashSim[],
  sensor: "front" | "down",
  maxMm: number = EYE_NEAR_MM,
): boolean {
  if (sensor === "down") {
    const mm = nearestTrashDistanceMm(x, y, trashItems)
    return mm !== null && mm <= maxMm
  }
  const frontMm = nearestTrashInFrontMm(x, y, rotationDeg, trashItems, maxMm)
  return frontMm !== null
}

/** Walk the statement chain under when_started (and nested C-blocks). */
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

  // The hat contributes no behaviour, so start below it. Skipping it also keeps
  // a bare hat reading as an empty program rather than a one-block one.
  if (startBlock.type === "when_started" && startBlock.getNextBlock) {
    walk(startBlock.getNextBlock())
  } else {
    walk(startBlock)
  }
}

/** JavaScript for every when_started stack, run as concurrent threads. */
export function generateWhenStartedJavaScript(
  workspace: { getAllBlocks: (ordered: boolean) => { type: string; isEnabled?: () => boolean }[] } | null,
  js: { blockToCode: (block: { type: string }) => string | [string, number] },
): string {
  if (!workspace) return ""
  const hats = workspace
    .getAllBlocks(false)
    .filter((b) => b.type === "when_started" && (typeof b.isEnabled !== "function" || b.isEnabled()))

  const bodies = hats
    .map((hat) => {
      const result = js.blockToCode(hat)
      return ((Array.isArray(result) ? result[0] : result) || "").trimEnd()
    })
    .filter((body) => body.trim().length > 0)

  if (bodies.length === 0) return ""
  if (bodies.length === 1) return `${bodies[0]}\n`

  const threads = bodies
    .map((body, index) => `  // thread ${index + 1}\n  (async () => {\n${body}\n  })()`)
    .join(",\n")
  return `await Promise.all([\n${threads}\n]);\n`
}

export function registerBlockGenerator(Blockly: { JavaScript: { forBlock: Record<string, unknown> } }, type: string, fn: (block: unknown) => string | [string, number]) {
  Blockly.JavaScript.forBlock[type] = fn
}

type BlocklyXmlUtils = {
  utils: {
    xml: {
      createElement: (name: string) => Element
    }
  }
}

/** Shadow XML for a default number literal block in value inputs. */
export function createNumberShadowDom(Blockly: BlocklyXmlUtils, value = 0): Element {
  const shadow = Blockly.utils.xml.createElement("shadow")
  shadow.setAttribute("type", "math_number")
  const field = Blockly.utils.xml.createElement("field")
  field.setAttribute("name", "NUM")
  field.textContent = String(value)
  shadow.appendChild(field)
  return shadow
}

export function attachNumberShadow(
  block: { getInput: (name: string) => { setShadowDom: (dom: Element) => unknown } | null },
  Blockly: BlocklyXmlUtils,
  inputName: string,
  value = 0,
): void {
  const input = block.getInput(inputName)
  if (!input) return
  input.setShadowDom(createNumberShadowDom(Blockly, value))
}

/** Flyout/toolbox block JSON with default number shadows on value inputs. */
export function flyoutBlockWithNumberShadows(
  type: string,
  inputNames: string[],
  defaults: Record<string, number> = {},
): {
  kind: "block"
  type: string
  inputs: Record<string, { shadow: { type: string; fields: { NUM: number } } }>
} {
  const inputs: Record<string, { shadow: { type: string; fields: { NUM: number } } }> = {}
  for (const name of inputNames) {
    inputs[name] = { shadow: { type: "math_number", fields: { NUM: defaults[name] ?? 0 } } }
  }
  return { kind: "block", type, inputs }
}

export function getPlaygroundCanvasSize(isMaximized: boolean): { w: number; h: number } {
  return { w: isMaximized ? 600 : 400, h: isMaximized ? 600 : 400 }
}

/** Canvas pixel position for a VEX field coordinate (origin at playground center). */
export function fieldMmToPixel(xMm: number, yMm: number, canvasW: number, canvasH: number): { x: number; y: number } {
  return {
    x: canvasW / 2 + distanceToPixels(xMm, "mm"),
    y: canvasH / 2 + distanceToPixels(yMm, "mm"),
  }
}

/** VEX field mm from canvas pixels (origin at playground center). */
export function pixelToFieldMm(px: number, py: number, canvasW: number, canvasH: number): { x: number; y: number } {
  return {
    x: Math.round(pixelsToDistance(px - canvasW / 2, "mm")),
    y: Math.round(pixelsToDistance(py - canvasH / 2, "mm")),
  }
}

export function getDefaultRobotPixelPosition(isMaximized: boolean): { x: number; y: number } {
  const { w, h } = getPlaygroundCanvasSize(isMaximized)
  const pos = fieldMmToPixel(CORAL_REEF_START_MM.x, CORAL_REEF_START_MM.y, w, h)
  return clampRobotPosition(pos.x, pos.y, w, h)
}

/** Keep a canvas point at the same field (mm) location after a playground size change. */
export function remapPixelAcrossCanvas(
  x: number,
  y: number,
  fromW: number,
  fromH: number,
  toW: number,
  toH: number,
): { x: number; y: number } {
  const mm = pixelToFieldMm(x, y, fromW, fromH)
  return fieldMmToPixel(mm.x, mm.y, toW, toH)
}

export function fieldRulerTicksMm(): number[] {
  return [-1000, -500, 0, 500, 1000]
}

/**
 * Subtle yellow millimetre overlay along the inner field edges.
 * Drawn last so ticks stay readable over coral, without covering the centre.
 */
export function drawFieldRulerOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
): void {
  const inset = 28
  const left = pixelToFieldMm(inset, 0, canvasW, canvasH).x
  const right = pixelToFieldMm(canvasW - inset, 0, canvasW, canvasH).x
  const top = pixelToFieldMm(0, inset, canvasW, canvasH).y
  const bottom = pixelToFieldMm(0, canvasH - inset, canvasW, canvasH).y
  const minorStep = 100
  const startX = Math.ceil(left / minorStep) * minorStep
  const startY = Math.ceil(top / minorStep) * minorStep

  ctx.save()
  ctx.lineCap = "round"
  ctx.font = "bold 9px ui-sans-serif, system-ui, sans-serif"
  ctx.textBaseline = "middle"

  ctx.fillStyle = "rgba(255, 214, 64, 0.16)"
  ctx.fillRect(inset, canvasH - inset - 1, canvasW - inset * 2, 14)
  ctx.fillRect(canvasW - inset - 1, inset, 14, canvasH - inset * 2)

  for (let mm = startX; mm <= right; mm += minorStep) {
    const { x } = fieldMmToPixel(mm, 0, canvasW, canvasH)
    const major = mm % 500 === 0
    ctx.strokeStyle = major ? "rgba(212, 160, 12, 0.72)" : "rgba(212, 160, 12, 0.38)"
    ctx.lineWidth = major ? 1.4 : 0.8
    ctx.beginPath()
    ctx.moveTo(x, canvasH - inset - 1)
    ctx.lineTo(x, canvasH - inset - (major ? 11 : 6))
    ctx.stroke()
    if (major) {
      ctx.fillStyle = "rgba(110, 72, 8, 0.72)"
      ctx.textAlign = "center"
      ctx.fillText(String(mm), x, canvasH - inset - 16)
    }
  }

  for (let mm = startY; mm <= bottom; mm += minorStep) {
    const { y } = fieldMmToPixel(0, mm, canvasW, canvasH)
    const major = mm % 500 === 0
    ctx.strokeStyle = major ? "rgba(212, 160, 12, 0.72)" : "rgba(212, 160, 12, 0.38)"
    ctx.lineWidth = major ? 1.4 : 0.8
    ctx.beginPath()
    ctx.moveTo(canvasW - inset - 1, y)
    ctx.lineTo(canvasW - inset - (major ? 11 : 6), y)
    ctx.stroke()
    if (major) {
      ctx.fillStyle = "rgba(110, 72, 8, 0.72)"
      ctx.textAlign = "right"
      ctx.fillText(String(mm), canvasW - inset - 14, y)
    }
  }

  ctx.restore()
}

/** Place trash away from coral borders and the default spawn point. */
export function createInitialTrashItems(
  canvasW: number,
  canvasH: number,
  coralPieces: CoralPiece[],
  count = CORAL_REEF_TRASH_COUNT,
): TrashSim[] {
  const types: TrashSim["type"][] = ["bottle", "can", "wrapper", "bag"]
  const items: TrashSim[] = []
  const margin = 55
  const spawn = fieldMmToPixel(CORAL_REEF_START_MM.x, CORAL_REEF_START_MM.y, canvasW, canvasH)
  let attempts = 0

  while (items.length < count && attempts < count * 50) {
    attempts++
    const x = margin + seededRandom(attempts) * (canvasW - margin * 2)
    const y = margin + seededRandom(attempts + 500) * (canvasH - margin * 2)
    if (pointHitsCoral(x, y, coralPieces, 28)) continue
    if (Math.hypot(x - spawn.x, y - spawn.y) < 70) continue

    items.push({
      x,
      y,
      isCollected: false,
      type: types[Math.floor(seededRandom(attempts + 1000) * types.length)],
    })
  }

  return items
}
