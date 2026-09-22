import type { Camera, RobotState } from "@/engine"
import type { PlaygroundDefinition } from "../types"
import { createCastleCrashersApi, castleCrashersBlocks } from "./api"
import {
  CASTLE_CRASHERS_ID,
  CASTLE_CRASHERS_NAME,
  CASTLE_TELEMETRY_NAME,
  FIELD_HEIGHT_MM,
  FIELD_WIDTH_MM,
  GRID_MM,
  INITIAL_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  START_POSE,
} from "./config"
import { renderCastleCrashers } from "./render"
import {
  createCastleCrashersState,
  resetCastleCrashersState,
  type CastleCrashersState,
} from "./state"
import { tickCastlePhysics } from "./systems/physics"

export type { CastleCrashersState } from "./state"
export type { CastleLevel } from "./config"
export {
  CASTLE_CRASHERS_ID,
  CASTLE_CRASHERS_NAME,
  CASTLE_TELEMETRY_NAME,
  FIELD_DIAMETER_MM,
  START_POSE,
} from "./config"
export {
  createCastleCrashersState,
  isCastleCrashersPlayground,
  insideHex,
  resetCastleCrashersState,
} from "./state"
export { CastleCrashersHud, CastleLevelToggle } from "./hud"
export { clampCastleMm, tickCastlePhysics } from "./systems/physics"
export { renderCastleCrashers }

export const castleCrashers: PlaygroundDefinition<CastleCrashersState> = {
  id: CASTLE_CRASHERS_ID,
  name: CASTLE_CRASHERS_NAME,
  world: {
    widthMm: FIELD_WIDTH_MM,
    heightMm: FIELD_HEIGHT_MM,
    gridMm: GRID_MM,
    startPose: { ...START_POSE },
    camera: { minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, initialZoom: INITIAL_ZOOM, follow: false },
  },
  createState(seed: number) {
    return createCastleCrashersState(seed)
  },
  reset(state, seed) {
    return resetCastleCrashersState(state, seed)
  },
  tick(state, dtMs, robot) {
    return tickCastlePhysics(state, dtMs, robot, true)
  },
  render(ctx, state, robot, cam) {
    renderCastleCrashers(ctx, state, robot, cam)
  },
  renderOverlay(_ctx, _state, _robot, _cam) {},
  blocks: castleCrashersBlocks,
  createApi: createCastleCrashersApi,
  isMissionOver(state) {
    return { over: state.missionOver, reason: state.missionReason, won: false }
  },
  outcomeParameters(state) {
    return {
      weight_cleared: state.weightClearedKg,
      elapsedtime: Math.round((state.missionMs / 1000) * 10) / 10,
      difficulty_level: state.level,
      project_stopped_by_user: state.projectStoppedByUser,
      gps_x_position: Math.round(state.gpsXMm),
      gps_y_position: Math.round(state.gpsYMm),
    }
  },
  inviteTelemetry(state) {
    return {
      playground: CASTLE_TELEMETRY_NAME,
      pieces_cleared: state.pieces.filter((p) => p.cleared).length,
      pieces_remaining: state.pieces.filter((p) => !p.cleared && p.pushable).length,
    }
  },
  markStoppedByUser(state) {
    return { ...state, projectStoppedByUser: true, missionOver: true, missionReason: "stopped", endedAtMs: state.elapsedMs }
  },
}

export function startRobot(): RobotState {
  return {
    xMm: START_POSE.xMm,
    yMm: START_POSE.yMm,
    headingDeg: START_POSE.headingDeg,
    driveVelocity: 50,
    turnVelocity: 50,
    driveTimeoutMs: null,
  }
}

export function castleCrashersCamera(): Camera {
  return { centerMm: { x: 0, y: 0 }, zoom: INITIAL_ZOOM }
}
