import type { Camera, RobotState } from "@/engine"
import type { PlaygroundDefinition } from "../types"
import { createOceanReefApi, tickOceanReef } from "./api"
import { oceanReefBlocks } from "./blocks"
import {
  BATTERY_SEC,
  FIELD_MM,
  GRID_MM,
  INITIAL_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  OCEAN_REEF_ID,
  OCEAN_REEF_NAME,
  START_POSE,
} from "./config"
import { createOceanReefState, type OceanReefState } from "./entities"
import { renderOceanReef } from "./render"

export type { OceanReefState } from "./entities"
export { coralToPixelPieces, createCoralPieces, createOceanReefState, createTrashItems } from "./entities"
export {
  applyDrive,
  applyTurn,
  clampRobotMm,
  collectTrash,
  createOceanReefApi,
  hitsCoral,
  poseToCanvas,
  reportedPositionMm,
  tickOceanReef,
} from "./api"
export { oceanReefBlocks } from "./blocks"
export { reefWorldToScreen } from "./art"
export { renderDistanceRay, renderOceanReef } from "./render"
export { FIELD_MM, INITIAL_ZOOM, OCEAN_REEF_ID, START_POSE, canvasSizePx } from "./config"

export const oceanReef: PlaygroundDefinition<OceanReefState> = {
  id: OCEAN_REEF_ID,
  name: OCEAN_REEF_NAME,
  world: {
    widthMm: FIELD_MM,
    heightMm: FIELD_MM,
    gridMm: GRID_MM,
    startPose: { ...START_POSE },
    camera: { minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, initialZoom: INITIAL_ZOOM, follow: false },
  },
  createState(seed: number) {
    return createOceanReefState(seed)
  },
  reset(state, seed) {
    return createOceanReefState(seed, state.view)
  },
  tick(state, dtMs, robot) {
    return tickOceanReef(state, dtMs, robot)
  },
  render(ctx, state, robot, cam) {
    renderOceanReef(ctx, state, robot, cam)
  },
  renderOverlay(ctx, state, robot, cam) {
    void ctx
    void state
    void robot
    void cam
  },
  blocks: oceanReefBlocks,
  createApi: createOceanReefApi,
  isMissionOver(state) {
    return {
      over: state.missionOver,
      reason: state.missionReason,
      won: state.missionReason === "complete",
    }
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

export function oceanReefCamera(): Camera {
  return { centerMm: { x: 0, y: 0 }, zoom: INITIAL_ZOOM }
}

export { BATTERY_SEC }
