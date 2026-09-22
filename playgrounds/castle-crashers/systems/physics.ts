import type { RobotState } from "@/engine"
import { HEX_RADIUS_MM, ROBOT_RADIUS_MM, WATER_MARGIN_MM, PLOW_START, PLOW_FRONT_MM, PLOW_HALF_WIDTH_MM } from "../config"
import { insideHex, type CastleCrashersState, type CastlePiece } from "../state"

/** Push pieces and detect water falls. Pure given the same robot pose. */
export function tickCastlePhysics(
  state: CastleCrashersState,
  dtMs: number,
  robot: RobotState,
  missionRunning: boolean,
): CastleCrashersState {
  if (state.missionOver) return state

  const next: CastleCrashersState = {
    ...state,
    elapsedMs: state.elapsedMs + dtMs,
    missionMs: missionRunning ? state.missionMs + dtMs : state.missionMs,
    gpsXMm: robot.xMm,
    gpsYMm: robot.yMm,
    pieces: state.pieces.map((piece) => ({ ...piece })),
  }

  if (!insideHex(robot.xMm, robot.yMm, HEX_RADIUS_MM - WATER_MARGIN_MM)) {
    return { ...next, missionOver: true, missionReason: "water" }
  }

  if (!missionRunning) return next

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
  let weightClearedKg = next.weightClearedKg
  for (const piece of next.pieces) {
    if (piece.cleared) continue
    if (piece.pushable && moving) {
      for (const contact of contacts) pushPiece(piece, contact)
    }
    if (piece.pushable && !insideHex(piece.xMm, piece.yMm, HEX_RADIUS_MM + piece.halfWMm * 0.2)) {
      piece.cleared = true
      weightClearedKg += piece.weightKg
    }
  }

  return { ...next, weightClearedKg }
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
  piece.topple = Math.min(1, piece.topple + overlap / 110)
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
