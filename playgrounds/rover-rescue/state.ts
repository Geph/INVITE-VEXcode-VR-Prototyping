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
import { buildEntityIndex, type EnemyEntity, type MineralEntity, type ObstacleEntity, type RoverEntity } from "./entities"
import { wanderEnemies } from "./systems/enemy-ai"
import { isRiverHazard } from "./systems/physics"
import {
  computeSensing,
  emptySensing,
  type SensorSnapshot,
} from "./systems/sensing"
import { applyMineralRespawns, scheduleMineralRespawn, spawnWorld, type MineralRespawn } from "./systems/spawn"

export interface RoverRescueState {
  seed: number
  elapsedMs: number
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
  missionReason?: string
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

export function tickRoverRescue(state: RoverRescueState, dtMs: number, robot?: RobotState): RoverRescueState {
  const elapsedMs = state.elapsedMs + Math.max(0, dtMs)
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
  const index = buildEntityIndex({
    obstacles: state.obstacles,
    minerals: respawned.minerals,
    enemies,
  })
  const inRiver = robot ? isRiverHazard({ x: robot.xMm, y: robot.yMm }, hazard) : false
  const sensing = robot ? computeSensing(robot, index, hazard, state.bridges) : emptySensing()
  return {
    ...state,
    elapsedMs,
    enemies,
    minerals: respawned.minerals,
    mineralRespawns: respawned.queue,
    index,
    sensing,
    missionOver: state.missionOver || inRiver,
    missionReason: state.missionOver ? state.missionReason : inRiver ? "river" : state.missionReason,
  }
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
