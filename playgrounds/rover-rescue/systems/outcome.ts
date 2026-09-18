/**
 * Lifetime mission counters and the VEX playgroundData payload.
 * `parameters` stays BYTE-IDENTICAL to VEX; richer stats live only in `_invite`.
 */

import type { Vec2 } from "@/engine"
import { START_POSE } from "../config"
import type { EnemyEntity } from "../entities"
import { daysFromMs } from "../mission"
import { pointOnBridge, zoneFamilyAt, type BridgeSpec, type ZoneFamily, type ZoneSpec } from "../map-spec"

/** VEX's playgroundData.playground string for this world. */
export const VEX_ROVER_PLAYGROUND = "RoverRescue"

export interface EnemiesByType {
  spider: number
  serpentOrange: number
  serpentBlue: number
  serpentPurple: number
}

export interface RoverOutcomeLog {
  mineralsConsumed: number
  mineralsDelivered: number
  distanceTravelledMm: number
  zonesVisited: ZoneFamily[]
  bridgeCrossings: number
  enemiesByType: EnemiesByType
  projectStoppedByUser: boolean
  lastPoseMm: Vec2 | null
  onBridge: boolean
}

export interface RoverInviteStats {
  schemaVersion: 1
  finalLevel: number
  mineralsDelivered: number
  distanceTravelledMm: number
  endReason: string | null
  zonesVisited: ZoneFamily[]
  bridgeCrossings: number
  enemiesByType: EnemiesByType
  seed: number
}

export interface RoverOutcomeSource {
  seed: number
  xp: number
  level: number
  missionMs: number
  batteryPercent: number
  missionOver: boolean
  missionReason?: string
  outcome: RoverOutcomeLog
}

export interface RoverPlaygroundData {
  playground: typeof VEX_ROVER_PLAYGROUND
  parameters: Record<string, unknown>
  _invite: RoverInviteStats
}

const EMPTY_ENEMIES: EnemiesByType = {
  spider: 0,
  serpentOrange: 0,
  serpentBlue: 0,
  serpentPurple: 0,
}

export function emptyOutcomeLog(start: Vec2 = { x: START_POSE.xMm, y: START_POSE.yMm }): RoverOutcomeLog {
  const zone = zoneFamilyAt(start)
  return {
    mineralsConsumed: 0,
    mineralsDelivered: 0,
    distanceTravelledMm: 0,
    zonesVisited: zone ? [zone] : [],
    bridgeCrossings: 0,
    enemiesByType: { ...EMPTY_ENEMIES },
    projectStoppedByUser: false,
    lastPoseMm: { x: start.x, y: start.y },
    onBridge: pointOnBridge(start),
  }
}

export function accumulateMotion(
  log: RoverOutcomeLog,
  rover: Vec2 | null,
  zones: readonly ZoneSpec[],
  bridges: readonly BridgeSpec[],
): RoverOutcomeLog {
  if (!rover) return log
  const prev = log.lastPoseMm
  const distanceMm = prev ? Math.hypot(rover.x - prev.x, rover.y - prev.y) : 0
  const zone = zoneFamilyAt(rover, zones)
  const zonesVisited =
    zone && !log.zonesVisited.includes(zone) ? [...log.zonesVisited, zone].sort() : log.zonesVisited
  const onBridge = pointOnBridge(rover, bridges)
  return {
    ...log,
    distanceTravelledMm: log.distanceTravelledMm + distanceMm,
    zonesVisited,
    bridgeCrossings: !log.onBridge && onBridge ? log.bridgeCrossings + 1 : log.bridgeCrossings,
    lastPoseMm: { x: rover.x, y: rover.y },
    onBridge,
  }
}

export function recordMineralConsumed(log: RoverOutcomeLog): RoverOutcomeLog {
  return { ...log, mineralsConsumed: log.mineralsConsumed + 1 }
}

export function recordMineralsDelivered(log: RoverOutcomeLog, count: number): RoverOutcomeLog {
  if (count <= 0) return log
  return { ...log, mineralsDelivered: log.mineralsDelivered + count }
}

export function recordEnemyNeutralized(log: RoverOutcomeLog, enemy: EnemyEntity): RoverOutcomeLog {
  const key = enemyTypeKey(enemy)
  return { ...log, enemiesByType: { ...log.enemiesByType, [key]: log.enemiesByType[key] + 1 } }
}

export function markStopped(log: RoverOutcomeLog): RoverOutcomeLog {
  return log.projectStoppedByUser ? log : { ...log, projectStoppedByUser: true }
}

export function withStoppedByUser<S extends { outcome: RoverOutcomeLog }>(state: S): S {
  if (state.outcome.projectStoppedByUser) return state
  return { ...state, outcome: markStopped(state.outcome) }
}

export function enemyTypeKey(enemy: EnemyEntity): keyof EnemiesByType {
  if (enemy.kind === "spider") return "spider"
  if (enemy.serpentColor === "purple") return "serpentPurple"
  if (enemy.serpentColor === "blue") return "serpentBlue"
  return "serpentOrange"
}

export function neutralizedCount(byType: EnemiesByType): number {
  return byType.spider + byType.serpentOrange + byType.serpentBlue + byType.serpentPurple
}

export function roverOutcomeParameters(state: RoverOutcomeSource): Record<string, unknown> {
  return {
    days_explored: daysFromMs(state.missionMs),
    experience_gained: state.xp,
    // VEX's own misspelling. Do not "fix". See docs/LOGGING-SPEC.md.
    enemies_nuetralized: neutralizedCount(state.outcome.enemiesByType),
    minerals_consumed: state.outcome.mineralsConsumed,
    battery_remaining: Math.round(state.batteryPercent),
    project_stopped_by_user: state.outcome.projectStoppedByUser,
  }
}

export function roverInviteStats(state: RoverOutcomeSource): RoverInviteStats {
  return {
    schemaVersion: 1,
    finalLevel: state.level,
    mineralsDelivered: state.outcome.mineralsDelivered,
    distanceTravelledMm: state.outcome.distanceTravelledMm,
    endReason: state.missionOver
      ? (state.missionReason ?? null)
      : state.outcome.projectStoppedByUser
        ? "stopped"
        : null,
    zonesVisited: state.outcome.zonesVisited,
    bridgeCrossings: state.outcome.bridgeCrossings,
    enemiesByType: { ...state.outcome.enemiesByType },
    seed: state.seed,
  }
}

export function roverPlaygroundData(state: RoverOutcomeSource): RoverPlaygroundData {
  const parameters = roverOutcomeParameters(state)
  const _invite = roverInviteStats(state)
  return { playground: VEX_ROVER_PLAYGROUND, parameters, _invite }
}
