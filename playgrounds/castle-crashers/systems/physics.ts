import type { RobotState } from "@/engine"
import { HEX_RADIUS_MM, ROBOT_RADIUS_MM, WATER_MARGIN_MM, PLOW_START, PLOW_FRONT_MM, PLOW_HALF_WIDTH_MM } from "../config"
import { insideHex, type CastleCrashersState, type CastlePiece } from "../state"
import { CONTACT_PASSES, DEBRIS_DRAG_PER_SEC, DEBRIS_IMPULSE, DEBRIS_MAX_SPEED_MM_SEC, RESULTS_DELAY_MS, TOPPLE_DISTANCE_MM } from "../config"

/** Push pieces and detect water falls. Pure given the same robot pose. */
export function tickCastlePhysics(
  state: CastleCrashersState,
  dtMs: number,
  robot: RobotState,
  missionRunning: boolean,
): CastleCrashersState {
  if (state.missionOver && state.elapsedMs - (state.endedAtMs ?? 0) >= RESULTS_DELAY_MS) {
    return { ...state, elapsedMs: state.elapsedMs + dtMs }
  }
  missionRunning = missionRunning && !state.missionOver

  const next: CastleCrashersState = {
    ...state,
    elapsedMs: state.elapsedMs + dtMs,
    missionMs: missionRunning ? state.missionMs + dtMs : state.missionMs,
    gpsXMm: robot.xMm,
    gpsYMm: robot.yMm,
    pieces: state.pieces.map((piece) => ({ ...piece })),
  }

  if (!missionRunning && !state.pieces.some(p => Math.hypot(p.vxMmSec, p.vyMmSec) > 1)) return next

  const rad = robot.headingDeg * Math.PI / 180
  const forward = { x: Math.sin(rad), y: Math.cos(rad) }
  const front = { x: robot.xMm + forward.x * ROBOT_RADIUS_MM, y: robot.yMm + forward.y * ROBOT_RADIUS_MM }
  if (!next.plowAttached && Math.hypot(front.x - PLOW_START.xMm, front.y - PLOW_START.yMm) < 85) {
    next.plowAttached = true
  }
  const contacts = [{ x: robot.xMm, y: robot.yMm, radius: ROBOT_RADIUS_MM }]
  if (next.plowAttached) {
    for (let i = -2; i <= 2; i++) {
      const lateral = i * PLOW_HALF_WIDTH_MM / 2
      contacts.push({ x: robot.xMm + forward.x * PLOW_FRONT_MM + Math.cos(rad) * lateral,
        y: robot.yMm + forward.y * PLOW_FRONT_MM - Math.sin(rad) * lateral, radius: 30 })
    }
  }
  const moving = Math.hypot(robot.xMm - state.gpsXMm, robot.yMm - state.gpsYMm) > 0.01
  const seconds = Math.max(0.001, dtMs / 1000)
  const damping = Math.exp(-DEBRIS_DRAG_PER_SEC * seconds)
  let weightClearedKg = next.weightClearedKg
  for (const piece of next.pieces) {
    if (piece.cleared) continue
    if (piece.pushable) {
      piece.xMm += piece.vxMmSec * seconds
      piece.yMm += piece.vyMmSec * seconds
      piece.headingDeg += piece.spinDegSec * seconds
      piece.vxMmSec *= damping
      piece.vyMmSec *= damping
      piece.spinDegSec *= damping
      if (Math.hypot(piece.vxMmSec, piece.vyMmSec) < 1) piece.vxMmSec = piece.vyMmSec = 0
      if (moving && missionRunning) for (const contact of contacts) {
        const before = { x: piece.xMm, y: piece.yMm, heading: piece.headingDeg }
        pushPiece(piece, contact)
        const dx = piece.xMm - before.x, dy = piece.yMm - before.y
        if (dx || dy) {
          const speed = Math.min(DEBRIS_MAX_SPEED_MM_SEC, Math.hypot(dx, dy) / seconds * DEBRIS_IMPULSE)
          const length = Math.hypot(dx, dy)
          piece.vxMmSec = dx / length * speed
          piece.vyMmSec = dy / length * speed
          piece.spinDegSec = (piece.headingDeg - before.heading) / seconds
        }
      }
    }
  }
  // Contact transfers momentum to neighbours, so a wall can knock over a tower.
  // Initially overlapping roof/foundation layers stay assembled until struck.
  for (let pass = 0; pass < CONTACT_PASSES; pass++) for (const source of next.pieces) {
    if (source.cleared || !source.pushable || Math.hypot(source.vxMmSec, source.vyMmSec) < 5) continue
    for (const target of next.pieces) {
      if (target === source || target.cleared) continue
      const beforeX = target.xMm, beforeY = target.yMm, beforeHeading = target.headingDeg
      pushPiece(target, { x: source.xMm, y: source.yMm, radius: Math.min(source.halfWMm, source.halfHMm) })
      const dx = target.xMm - beforeX, dy = target.yMm - beforeY
      if (!dx && !dy) continue
      if (!target.pushable) {
        target.xMm = beforeX; target.yMm = beforeY; target.topple = 0
        target.headingDeg = beforeHeading
        source.xMm -= dx; source.yMm -= dy
        source.vxMmSec *= -0.15; source.vyMmSec *= -0.15
      } else {
        const transfer = source.weightKg / (source.weightKg + target.weightKg)
        target.vxMmSec += source.vxMmSec * transfer * 0.5
        target.vyMmSec += source.vyMmSec * transfer * 0.5
        source.vxMmSec *= 0.7; source.vyMmSec *= 0.7
      }
    }
  }
  for (const piece of next.pieces) {
    if (piece.cleared) continue
    if (piece.pushable && !insideHex(piece.xMm, piece.yMm, HEX_RADIUS_MM + piece.halfWMm * 0.2)) {
      piece.cleared = true
      piece.clearedAtMs = next.elapsedMs
      weightClearedKg += piece.weightKg
    }
  }
  // Score debris from this step before ending the mission on the same edge crossing.
  if (missionRunning && !insideHex(robot.xMm, robot.yMm, HEX_RADIUS_MM - WATER_MARGIN_MM)) {
    return { ...next, weightClearedKg, missionOver: true, missionReason: "water", endedAtMs: next.elapsedMs }
  }
  return { ...next, weightClearedKg }
}

/** Sweep the robot body against fixed rocks/trees without stopping at the water. */
export function castleMotionTarget(
  from: { x: number; y: number }, to: { xMm: number; yMm: number }, pieces: CastlePiece[],
): { xMm: number; yMm: number } {
  const count = Math.max(1, Math.ceil(Math.hypot(to.xMm - from.x, to.yMm - from.y) / (ROBOT_RADIUS_MM / 2)))
  let last = { xMm: from.x, yMm: from.y }
  for (let i = 1; i <= count; i++) {
    const x = from.x + (to.xMm - from.x) * i / count
    const y = from.y + (to.yMm - from.y) * i / count
    for (const piece of pieces) {
      if (piece.pushable || piece.cleared) continue
      const probe = { ...piece }
      pushPiece(probe, { x, y, radius: ROBOT_RADIUS_MM })
      if (probe.xMm !== piece.xMm || probe.yMm !== piece.yMm) return last
    }
    last = { xMm: x, yMm: y }
  }
  return last
}

function pushPiece(piece: CastlePiece, contact: { x: number; y: number; radius: number }): void {
  // Use the rotated footprint so a long wall does not push from empty space beside it.
  const angle = -piece.headingDeg * Math.PI / 180
  const c = Math.cos(angle), s = Math.sin(angle)
  const dx = contact.x - piece.xMm, dy = contact.y - piece.yMm
  const lx = dx * c + dy * s, ly = -dx * s + dy * c
  const qx = Math.max(-piece.halfWMm, Math.min(piece.halfWMm, lx))
  const qy = Math.max(-piece.halfHMm, Math.min(piece.halfHMm, ly))
  let nx = lx - qx, ny = ly - qy
  const distance = Math.hypot(nx, ny)
  if (distance >= contact.radius) return
  let overlap = contact.radius - distance
  if (distance > 1e-6) {
    nx /= distance
    ny /= distance
  } else if (piece.halfWMm - Math.abs(lx) < piece.halfHMm - Math.abs(ly)) {
    nx = lx >= 0 ? 1 : -1; ny = 0
    overlap += piece.halfWMm - Math.abs(lx)
  } else {
    nx = 0; ny = ly >= 0 ? 1 : -1
    overlap += piece.halfHMm - Math.abs(ly)
  }
  piece.xMm -= (nx * c - ny * s) * overlap
  piece.yMm -= (nx * s + ny * c) * overlap
  piece.topple = Math.min(1, piece.topple + overlap / TOPPLE_DISTANCE_MM)
  const lever = (qx * ny - qy * nx) / Math.max(piece.halfWMm, piece.halfHMm)
  piece.headingDeg += lever * Math.min(overlap * 0.12, 8)
}

export function clampCastleMm(xMm: number, yMm: number): { xMm: number; yMm: number } {
  if (insideHex(xMm, yMm, HEX_RADIUS_MM - WATER_MARGIN_MM)) return { xMm, yMm }
  // Soft clamp: pull back toward the origin along the same ray.
  const radius = HEX_RADIUS_MM - WATER_MARGIN_MM - ROBOT_RADIUS_MM
  const scale = Math.min(1, radius * Math.sqrt(3) / (2 * Math.max(Math.abs(xMm), 1e-6)),
    radius / Math.max(Math.abs(yMm) + Math.abs(xMm) / Math.sqrt(3), 1e-6))
  return { xMm: xMm * scale, yMm: yMm * scale }
}
