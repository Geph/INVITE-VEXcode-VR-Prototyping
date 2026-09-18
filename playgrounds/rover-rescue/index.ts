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

export type { MissionReason, RoverRescueState, RoverTickOptions } from "./state"
export { createRoverRescueState, resetRoverRescueState, tickRoverRescue } from "./state"
export { clampRoverMm, createRoverRescueApi } from "./api"
export { daysFromMs, formatDays, missionComplete, msFromDays } from "./mission"
export { useMineralOnGround, pickupMineral, dropMineral, deliverStorageToBase, absorbEnemyRadiation } from "./state"
export { batteryEmpty, clampBattery, drainBattery, drainRatePctPerDay } from "./systems/battery"
export {
  absorbPctForLevel,
  capacityForLevel,
  expWithinLevel,
  levelFromXp,
  xpForNextLevel,
} from "./systems/leveling"
export { nearestUsableMineral, parseMineralAction } from "./systems/minerals"
export { absorbNearestEnemy, attackDrainPct, tickCombat, xpForNeutralizing } from "./systems/combat"
export {
  concludeDay50,
  continuePastDay50,
  day50Snapshot,
  type Day50Snapshot,
} from "./systems/day50"
export {
  advanceStandby,
  parseStandbyPercent,
  shouldEnterStandby,
} from "./systems/standby"
export {
  BATTERY_START_PCT,
  CAPACITY_BY_LEVEL,
  DAY_MS,
  LEVEL_XP_THRESHOLDS,
  MINERAL_USE_RANGE_MM,
  MISSION_DAYS,
  ROVER_LEVEL_MAX,
  STANDBY_MAX_STEPS,
  STANDBY_STEPS_PER_YIELD,
  XP_MINERAL_TO_BASE,
  XP_USE_MINERAL,
  XP_SPIDER,
  XP_SERPENT,
  XP_SERPENT_PURPLE,
} from "./config"

/** What the rover reports to React: the figures the HUD shows, nothing else. */
export interface RoverStatus {
  days: number
  batteryPercent: number
  level: number
  /** XP earned toward the next level, matching what the XP block reports. */
  exp: number
  /** Samples in the hold right now. */
  stored: number
  /** How many the current level can carry. */
  capacity: number
  /** True while standby is racing the clock. */
  standby: boolean
  /** True while the day-50 Continue / Statistics / Certificate prompt is up. */
  day50Dialog: boolean
}
export { planRoverDrive, pushedMinerals, resolveRoverMove, roverDriveVector } from "./systems/physics"
export type { DrivePlan, MineralPush } from "./systems/physics"
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
    return tickRoverRescue(state, dtMs, robot, { missionRunning: true })
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
    // Surviving all 50 days is the win condition; the river is the loss.
    return { over: state.missionOver, reason: state.missionReason, won: state.missionReason === "days" }
  },
}
