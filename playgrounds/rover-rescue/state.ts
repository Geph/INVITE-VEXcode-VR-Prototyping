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
  type EnemyEntity,
  type MineralEntity,
  type ObstacleEntity,
  type RoverEntity,
} from "./entities"
import { missionComplete } from "./mission"
import {
  BATTERY_START_PCT,
  LEVEL_UP_SIGNAL_MS,
  ABSORB_COOLDOWN_MS,
  XP_MINERAL_TO_BASE,
  XP_USE_MINERAL,
} from "./config"
import { batteryEmpty, clampBattery, drainBattery } from "./systems/battery"
import { absorbNearestEnemy, tickCombat } from "./systems/combat"
import { capacityForLevel, levelFromXp } from "./systems/leveling"
import {
  applyMineralPushes,
  dropLatestMineral,
  markStorageDelivered,
  nearestUsableMineral,
  pickupNearestMineral,
  type PickupFail,
} from "./systems/minerals"
import { isOnBasePad, isRiverHazard, pushedMinerals } from "./systems/physics"
import {
  computeSensing,
  emptySensing,
  type SensorSnapshot,
} from "./systems/sensing"
import { applyMineralRespawns, scheduleMineralRespawn, spawnWorld, type MineralRespawn } from "./systems/spawn"
import {
  accumulateMotion,
  emptyOutcomeLog,
  recordEnemyNeutralized,
  recordMineralConsumed,
  recordMineralsDelivered,
  type RoverOutcomeLog,
} from "./systems/outcome"

/** `river` and `battery` end the mission early; `days` means all 50 were survived. */
export type MissionReason = "river" | "battery" | "days"

export interface RoverRescueState {
  seed: number
  elapsedMs: number
  /** Time the rover has spent on task. Only advances while a program runs. */
  missionMs: number
  batteryPercent: number
  /** Lifetime XP. The playground reports progress through the current level. */
  xp: number
  level: number
  /** Carried sample ids, oldest first. Drop pops the last id. */
  storage: string[]
  debug: boolean
  zones: ZoneSpec[]
  riverCenterline: Vec2[]
  bridges: BridgeSpec[]
  obstacles: ObstacleEntity[]
  minerals: MineralEntity[]
  enemies: EnemyEntity[]
  mineralRespawns: MineralRespawn[]
  blocked: boolean
  /** True while at least one enemy is in melee. */
  underAttack: boolean
  /** Mission time until which `when level up` reads true. */
  levelUpUntilMs: number
  /** Mission time of the last successful absorb; null until the first one. */
  lastAbsorbAtMs: number | null
  driveMoving: boolean
  /** True while standby is fast-forwarding; the draw loop renders but does not tick. */
  standby: boolean
  /**
   * True after the rover has survived 50 days and the Continue / Statistics /
   * Certificate prompt is up. The program keeps running while this is set.
   */
  day50Dialog: boolean
  /** Continue already dismissed the prompt; do not offer it again. */
  day50Continued: boolean
  missionOver: boolean
  missionReason?: MissionReason
  index: SpatialHash<RoverEntity>
  sensing: SensorSnapshot
  aiVisualisation: boolean
  /** Lifetime counters for playgroundData. Survives Continue re-irradiation. */
  outcome: RoverOutcomeLog
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
    batteryPercent: BATTERY_START_PCT,
    xp: 0,
    level: 1,
    storage: [],
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
    underAttack: false,
    levelUpUntilMs: 0,
    lastAbsorbAtMs: null,
    standby: false,
    day50Dialog: false,
    day50Continued: false,
    missionOver: false,
    index: buildEntityIndex(spawned),
    sensing: emptySensing(),
    aiVisualisation: false,
    outcome: emptyOutcomeLog(),
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
  // Power only leaks while the rover is on task, on the same clock as the days.
  const afterIdle = running
    ? drainBattery(state.batteryPercent, dtMs, state.driveMoving)
    : state.batteryPercent
  const hazard = riverHazardFromState(state)
  const combat = tickCombat({
    enemies: state.enemies,
    rover: robot ? { x: robot.xMm, y: robot.yMm } : null,
    roverLevel: state.level,
    batteryPercent: afterIdle,
    elapsedMs,
    dtMs: Math.max(0, dtMs),
    running,
    index: state.index,
    hazard,
    bridges: state.bridges,
  })
  const batteryPercent = combat.batteryPercent
  const enemies = combat.enemies
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
  const pushed = {
    ...state,
    elapsedMs,
    missionMs,
    batteryPercent,
    enemies,
    minerals,
    mineralRespawns: respawned.queue,
    underAttack: combat.underAttack,
    index: pushes.length
      ? buildEntityIndex({ obstacles: state.obstacles, minerals, enemies })
      : settled,
  }
  const rover = robot ? { x: robot.xMm, y: robot.yMm } : null
  const banked = rover && !state.missionOver ? settleCargo(pushed, rover) : pushed
  const inRiver = rover ? isRiverHazard(rover, hazard) : false
  const flat = batteryEmpty(batteryPercent)
  const reachedDay50 = missionComplete(missionMs)
  const day50Dialog =
    state.day50Continued || state.missionOver
      ? false
      : state.day50Dialog || (reachedDay50 && !inRiver && !flat)
  const sensing = robot ? computeSensing(robot, banked.index, hazard, state.bridges) : emptySensing()
  return {
    ...banked,
    sensing,
    outcome: accumulateMotion(banked.outcome, rover, state.zones, state.bridges),
    day50Dialog,
    missionOver: state.missionOver || inRiver || flat,
    missionReason: state.missionOver
      ? state.missionReason
      : inRiver
        ? "river"
        : flat
          ? "battery"
          : state.missionReason,
  }
}

/**
 * Consume the sample the rover is standing next to. Per the VEX documentation a
 * sample is used where it lies, so cargo is not a candidate.
 */
export function useMineralOnGround(
  state: RoverRescueState,
  rover: Vec2,
): { state: RoverRescueState; used: boolean } {
  const target = nearestUsableMineral(state.minerals, rover)
  if (!target) return { state, used: false }
  const consumed = markMineralUsed(state, target.id)
  return {
    state: {
      ...applyXp(consumed, XP_USE_MINERAL),
      batteryPercent: clampBattery(BATTERY_START_PCT),
      outcome: recordMineralConsumed(consumed.outcome),
    },
    used: true,
  }
}

export function pickupMineral(
  state: RoverRescueState,
  rover: Vec2,
): { state: RoverRescueState; picked: boolean; reason?: PickupFail } {
  const result = pickupNearestMineral(
    state.minerals,
    state.storage,
    rover,
    capacityForLevel(state.level),
  )
  if (!result.ok) return { state, picked: false, reason: result.reason }
  const next = withMinerals(state, result.minerals, result.storage)
  return { state: settleCargo(next, rover), picked: true }
}

export function dropMineral(
  state: RoverRescueState,
  rover: Vec2,
): { state: RoverRescueState; dropped: boolean } {
  const result = dropLatestMineral(state.minerals, state.storage, rover)
  if (!result.ok) return { state, dropped: false }
  return { state: withMinerals(state, result.minerals, result.storage), dropped: true }
}

function settleCargo(state: RoverRescueState, rover: Vec2): RoverRescueState {
  if (state.storage.length === 0 || !isOnBasePad(rover)) return state
  return deliverStorageToBase(state)
}

export function deliverStorageToBase(state: RoverRescueState): RoverRescueState {
  const patch = markStorageDelivered(state.minerals, state.storage)
  if (!patch) return state
  const jobs = patch.delivered
    .map((mineral) => scheduleMineralRespawn(mineral, state.elapsedMs))
    .filter((job): job is NonNullable<typeof job> => job !== null)
  return {
    ...applyXp(withMinerals(state, patch.minerals, []), XP_MINERAL_TO_BASE * patch.delivered.length),
    mineralRespawns: [...state.mineralRespawns, ...jobs],
    outcome: recordMineralsDelivered(state.outcome, patch.delivered.length),
  }
}

export function absorbEnemyRadiation(
  state: RoverRescueState,
  rover: Vec2,
): { state: RoverRescueState; absorbed: boolean; reason?: "cooldown" | "none" } {
  if (state.lastAbsorbAtMs !== null && state.elapsedMs - state.lastAbsorbAtMs < ABSORB_COOLDOWN_MS) {
    return { state, absorbed: false, reason: "cooldown" }
  }
  const result = absorbNearestEnemy({
    enemies: state.enemies,
    rover,
    roverLevel: state.level,
    batteryPercent: state.batteryPercent,
  })
  if (!result.absorbed) return { state, absorbed: false, reason: "none" }
  const index = buildEntityIndex({ obstacles: state.obstacles, minerals: state.minerals, enemies: result.enemies })
  let next: RoverRescueState = {
    ...state,
    enemies: result.enemies,
    batteryPercent: result.batteryPercent,
    lastAbsorbAtMs: state.elapsedMs,
    index,
    sensing: computeSensing(
      {
        xMm: rover.x,
        yMm: rover.y,
        headingDeg: state.sensing.headingDeg,
        driveVelocity: 0,
        turnVelocity: 0,
        driveTimeoutMs: null,
      },
      index,
      riverHazardFromState(state),
      state.bridges,
    ),
  }
  if (result.xpDelta > 0) next = applyXp(next, result.xpDelta)
  if (result.neutralized) {
    next = { ...next, outcome: recordEnemyNeutralized(next.outcome, result.neutralized) }
  }
  return { state: next, absorbed: true }
}

function applyXp(state: RoverRescueState, xpDelta: number): RoverRescueState {
  const xp = state.xp + xpDelta
  const level = levelFromXp(xp)
  return {
    ...state,
    xp,
    level,
    levelUpUntilMs: level > state.level ? state.elapsedMs + LEVEL_UP_SIGNAL_MS : state.levelUpUntilMs,
  }
}

function withMinerals(
  state: RoverRescueState,
  minerals: MineralEntity[],
  storage: string[],
): RoverRescueState {
  return {
    ...state,
    minerals,
    storage,
    index: buildEntityIndex({ obstacles: state.obstacles, minerals, enemies: state.enemies }),
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
