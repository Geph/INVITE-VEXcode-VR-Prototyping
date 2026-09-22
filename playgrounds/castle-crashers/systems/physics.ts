import type { RobotState } from "@/engine"
import { HEX_RADIUS_MM, ROBOT_RADIUS_MM, WATER_MARGIN_MM } from "../config"
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

  let weightClearedKg = next.weightClearedKg
  for (const piece of next.pieces) {
    if (piece.cleared) continue
    if (piece.pushable) {
      const pushed = pushPiece(piece, robot)
      if (pushed) {
        piece.xMm = pushed.xMm
        piece.yMm = pushed.yMm
      }
    }
    if (piece.pushable && !insideHex(piece.xMm, piece.yMm, HEX_RADIUS_MM + piece.halfWMm * 0.2)) {
      piece.cleared = true
      weightClearedKg += piece.weightKg
    }
  }

  return { ...next, weightClearedKg }
}

function pushPiece(piece: CastlePiece, robot: RobotState): { xMm: number; yMm: number } | null {
  const dx = piece.xMm - robot.xMm
  const dy = piece.yMm - robot.yMm
  const dist = Math.hypot(dx, dy)
  const reach = ROBOT_RADIUS_MM + Math.max(piece.halfWMm, piece.halfHMm) * 0.85
  if (dist <= 1e-6 || dist >= reach) return null
  const overlap = reach - dist
  const nx = dx / dist
  const ny = dy / dist
  return { xMm: piece.xMm + nx * overlap, yMm: piece.yMm + ny * overlap }
}

export function clampCastleMm(xMm: number, yMm: number): { xMm: number; yMm: number } {
  if (insideHex(xMm, yMm, HEX_RADIUS_MM - WATER_MARGIN_MM)) return { xMm, yMm }
  // Soft clamp: pull back toward the origin along the same ray.
  const dist = Math.hypot(xMm, yMm) || 1
  const max = HEX_RADIUS_MM - WATER_MARGIN_MM - ROBOT_RADIUS_MM
  const scale = max / dist
  return { xMm: xMm * scale, yMm: yMm * scale }
}
