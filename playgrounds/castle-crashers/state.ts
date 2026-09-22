import {
  CASTLE_CRASHERS_ID,
  type CastleLevel,
  START_POSE,
  WATER_MARGIN_MM,
  HEX_RADIUS_MM,
} from "./config"
import { level1Layout, level2Trees, type CastlePieceSpec, type PieceKind } from "./layout"

export interface CastlePiece {
  id: string
  kind: PieceKind
  xMm: number
  yMm: number
  headingDeg: number
  halfWMm: number
  halfHMm: number
  weightKg: number
  pushable: boolean
  /** True once the piece has been shoved past the hex into the water. */
  cleared: boolean
}

export interface CastleCrashersState {
  seed: number
  level: CastleLevel
  elapsedMs: number
  /** Mission clock advances only while a program is running. */
  missionMs: number
  weightClearedKg: number
  pieces: CastlePiece[]
  missionOver: boolean
  missionReason?: "water" | "stopped"
  projectStoppedByUser: boolean
  gpsXMm: number
  gpsYMm: number
}

export function createCastleCrashersState(seed: number, level: CastleLevel = 1): CastleCrashersState {
  const specs = level === 2 ? [...level1Layout(), ...level2Trees()] : level1Layout()
  return {
    seed,
    level,
    elapsedMs: 0,
    missionMs: 0,
    weightClearedKg: 0,
    pieces: specs.map(fromSpec),
    missionOver: false,
    projectStoppedByUser: false,
    gpsXMm: START_POSE.xMm,
    gpsYMm: START_POSE.yMm,
  }
}

export function resetCastleCrashersState(state: CastleCrashersState, seed: number): CastleCrashersState {
  return createCastleCrashersState(seed, state.level)
}

export function isCastleCrashersPlayground(id: string): boolean {
  return id === CASTLE_CRASHERS_ID
}

/** Point-in-hex for a pointy-top hex centered at the origin. */
export function insideHex(xMm: number, yMm: number, radiusMm = HEX_RADIUS_MM - WATER_MARGIN_MM): boolean {
  const ax = Math.abs(xMm)
  const ay = Math.abs(yMm)
  if (ay > radiusMm) return false
  // Vertical distance from a flat side of a pointy-top hex.
  const SQRT3 = Math.sqrt(3)
  return ax * SQRT3 + ay <= radiusMm * SQRT3
}

function fromSpec(spec: CastlePieceSpec): CastlePiece {
  return {
    id: spec.id,
    kind: spec.kind,
    xMm: spec.xMm,
    yMm: spec.yMm,
    headingDeg: spec.headingDeg,
    halfWMm: spec.halfWMm,
    halfHMm: spec.halfHMm,
    weightKg: spec.weightKg,
    pushable: spec.pushable,
    cleared: false,
  }
}
