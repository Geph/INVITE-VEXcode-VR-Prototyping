import { createRng, type RobotState, type SpatialHash, type Vec2 } from "@/engine"
import {
  BRIDGES,
  RIVER_CENTERLINE,
  ZONES,
  clonePolygon,
  cloneVec2,
  deriveRiverHazard,
  type BridgeSpec,
  type RiverHazard,
  type ZoneSpec,
} from "./map-spec"
import {
  buildEntityIndex,
  placeMineral,
  type EnemyEntity,
  type MineralEntity,
  type ObstacleEntity,
  type RoverEntity,
} from "./entities"
import { missionComplete } from "./mission"
import { wanderEnemies } from "./systems/enemy-ai"
import { isRiverHazard, pushedMinerals, type MineralPush } from "./systems/physics"
import {
  computeSensing,
  emptySensing,
  type SensorSnapshot,
} from "./systems/sensing"
import { applyMineralRespawns, scheduleMineralRespawn, spawnWorld, type MineralRespawn } from "./systems/spawn"

/** `river` ends the mission early; `days` means the full 50 days were survived. */
export type MissionReason = "river" | "days"

export interface RoverRescueState {
  seed: number
  elapsedMs: number
  /** Time the rover has spent on task. Only advances while a program runs. */
  missionMs: number
  debug: boolean
  zones: ZoneSpec[]
  riverCenterline: Vec2[]
  bridges: BridgeSpec[]
  obstacles: ObstacleEntity[]
  minerals: MineralEntity[]
  enemies: EnemyEntity[]
  mineralRespawns: MineralRespawn[]
  blocked: boolean
  driveMoving: boolean
  missionOver: boolean
  missionReason?: MissionReason
  index: SpatialHash<RoverEntity>
  sensing: SensorSnapshot
  aiVisualisation: boolean
}

export function createRoverRescueState(seed: number, debug = false): RoverRescueState {
  const zones = ZONES.map((zone) => ({ ...zone, polygonMm: clonePolygon(zone.polygonMm) }))
  const riverCenterline = clonePolygon(RIVER_CENTERLINE)
  const bridges = BRIDGES.map((bridge) => ({ ...bridge, centreMm: cloneVec2(bridge.centreMm) }))
  const hazard = deriveRiverHazard(riverCenterline, undefined, bridges)
  const spawned = spawnWorld(seed, hazard, bridges, zones)
  return {
    seed,
    elapsedMs: 0,
    missionMs: 0,
    debug,
    zones,
    riverCenterline,
    bridges,
    obstacles: spawned.obstacles,
    minerals: spawned.minerals,
    enemies: spawned.enemies,
    mineralRespawns: [],
    blocked: false,
    driveMoving: false,
    missionOver: false,
    index: buildEntityIndex(spawned),
    sensing: emptySensing(),
    aiVisualisation: false,
  }
}

export function resetRoverRescueState(state: RoverRescueState, seed: number): RoverRescueState {
  const next = createRoverRescueState(seed, state.debug)
  next.aiVisualisation = state.aiVisualisation
  return next
}

export interface RoverTickOptions {
  /** The mission clock is paused unless a program is actually running. */
  missionRunning?: boolean
}

export function tickRoverRescue(
  state: RoverRescueState,
  dtMs: number,
  robot?: RobotState,
  options: RoverTickOptions = {},
): RoverRescueState {
  const elapsedMs = state.elapsedMs + Math.max(0, dtMs)
  const running = options.missionRunning === true && !state.missionOver
  const missionMs = running ? state.missionMs + Math.max(0, dtMs) : state.missionMs
  const hazard = riverHazardFromState(state)
  const enemies = wanderEnemies(state.enemies, elapsedMs, state.index, hazard, state.bridges)
  const afterWander = buildEntityIndex({ obstacles: state.obstacles, minerals: state.minerals, enemies })
  const respawned = applyMineralRespawns(
    state.minerals,
    state.mineralRespawns,
    elapsedMs,
    createRng(state.seed).fork(`respawn:${Math.floor(elapsedMs / 250)}`),
    afterWander,
    hazard,
    state.bridges,
    state.zones,
  )
  const settled = buildEntityIndex({
    obstacles: state.obstacles,
    minerals: respawned.minerals,
    enemies,
  })
  const pushes = robot
    ? pushedMinerals({
        minerals: respawned.minerals,
        rover: { x: robot.xMm, y: robot.yMm },
        headingDeg: robot.headingDeg,
        index: settled,
        hazard,
      })
    : []
  const minerals = applyMineralPushes(respawned.minerals, pushes)
  const index = pushes.length
    ? buildEntityIndex({ obstacles: state.obstacles, minerals, enemies })
    : settled
  const inRiver = robot ? isRiverHazard({ x: robot.xMm, y: robot.yMm }, hazard) : false
  const outOfDays = missionComplete(missionMs)
  const sensing = robot ? computeSensing(robot, index, hazard, state.bridges) : emptySensing()
  return {
    ...state,
    elapsedMs,
    missionMs,
    enemies,
    minerals,
    mineralRespawns: respawned.queue,
    index,
    sensing,
    missionOver: state.missionOver || inRiver || outOfDays,
    missionReason: state.missionOver
      ? state.missionReason
      : inRiver
        ? "river"
        : outOfDays
          ? "days"
          : state.missionReason,
  }
}

function applyMineralPushes(
  minerals: readonly MineralEntity[],
  pushes: readonly MineralPush[],
): MineralEntity[] {
  if (pushes.length === 0) return minerals as MineralEntity[]
  const moved = new Map(pushes.map((push) => [push.id, push.toMm]))
  return minerals.map((mineral) => {
    const to = moved.get(mineral.id)
    return to ? placeMineral(mineral, to) : mineral
  })
}

export function riverHazardFromState(state: RoverRescueState): RiverHazard {
  return deriveRiverHazard(state.riverCenterline, undefined, state.bridges)
}

export function entityLists(state: RoverRescueState) {
  return {
    obstacles: state.obstacles,
    minerals: state.minerals,
    enemies: state.enemies,
  }
}

export function markMineralUsed(state: RoverRescueState, id: string): RoverRescueState {
  const minerals = state.minerals.map((mineral) =>
    mineral.id === id ? { ...mineral, state: "used" as const } : mineral,
  )
  const used = minerals.find((mineral) => mineral.id === id)
  const job = used ? scheduleMineralRespawn(used, state.elapsedMs) : null
  return {
    ...state,
    minerals,
    mineralRespawns: job ? [...state.mineralRespawns, job] : state.mineralRespawns,
    index: buildEntityIndex({ obstacles: state.obstacles, minerals, enemies: state.enemies }),
  }
}
