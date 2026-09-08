import type { PlaygroundDefinition } from "../types"
import { createRoverRescueApi } from "./api"
import { roverRescueBlocks } from "./blocks"
import {
  CAMERA,
  FIELD_HEIGHT_MM,
  FIELD_WIDTH_MM,
  GRID_MM,
  ROVER_RESCUE_ID,
  ROVER_RESCUE_NAME,
  START_POSE,
} from "./config"
import { renderRoverRescue, renderRoverRescueOverlay } from "./render"
import { createRoverRescueState, resetRoverRescueState, tickRoverRescue, type RoverRescueState } from "./state"

export type { RoverRescueState } from "./state"
export { createRoverRescueState, resetRoverRescueState, tickRoverRescue } from "./state"
export { clampRoverMm, createRoverRescueApi } from "./api"
export { resolveRoverMove } from "./systems/physics"
export { computeSensing, detect, sight, distanceSensor } from "./systems/sensing"
export { entityLists } from "./state"
export { enemyLevelFromBase } from "./entities"
export { renderRoverRescue, renderRoverRescueOverlay } from "./render"
export {
  CAMERA,
  canvasSizePx,
  FIELD_BOUNDS,
  FIELD_HEIGHT_MM,
  FIELD_WIDTH_MM,
  GRID_MM,
  ROVER_RESCUE_ID,
  ROVER_RESCUE_NAME,
  START_POSE,
} from "./config"
export { formatMapSpecAsTypeScript, RIVER_HAZARD, ZONES, BRIDGES, BASE } from "./map-spec"

export const roverRescue: PlaygroundDefinition<RoverRescueState> = {
  id: ROVER_RESCUE_ID,
  name: ROVER_RESCUE_NAME,
  world: {
    widthMm: FIELD_WIDTH_MM,
    heightMm: FIELD_HEIGHT_MM,
    gridMm: GRID_MM,
    startPose: { ...START_POSE },
    camera: { ...CAMERA },
  },
  createState(seed: number) {
    return createRoverRescueState(seed)
  },
  reset(state, seed) {
    return resetRoverRescueState(state, seed)
  },
  tick(state, dtMs, robot) {
    return tickRoverRescue(state, dtMs, robot)
  },
  render(ctx, state, robot, cam) {
    renderRoverRescue(ctx, state, robot, cam)
  },
  renderOverlay(ctx, state, robot, cam) {
    renderRoverRescueOverlay(ctx, state, robot, cam)
  },
  blocks: roverRescueBlocks,
  createApi: createRoverRescueApi,
  isMissionOver(state) {
    return { over: state.missionOver, reason: state.missionReason, won: false }
  },
}
