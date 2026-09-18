/**
 * Day-50 mission prompt. Reaching 50 days does not end the run; the dialog
 * does, unless the learner continues and re-irradiates the field.
 */

import { daysFromMs } from "../mission"
import { buildEntityIndex, reirradiateEnemies, type EnemyEntity } from "../entities"
import type { RoverRescueState } from "../state"

export interface NeutralizedCounts {
  spider: number
  orange: number
  blue: number
  purple: number
}

export interface Day50Snapshot {
  days: number
  level: number
  xp: number
  batteryPercent: number
  neutralized: NeutralizedCounts
}

export function continuePastDay50(state: RoverRescueState): RoverRescueState {
  const enemies = reirradiateEnemies(state.enemies)
  return {
    ...state,
    enemies,
    day50Dialog: false,
    day50Continued: true,
    index: buildEntityIndex({ obstacles: state.obstacles, minerals: state.minerals, enemies }),
  }
}

export function concludeDay50(state: RoverRescueState): RoverRescueState {
  return {
    ...state,
    missionOver: true,
    missionReason: "days",
    day50Dialog: false,
  }
}

export function day50Snapshot(state: RoverRescueState): Day50Snapshot {
  return {
    days: daysFromMs(state.missionMs),
    level: state.level,
    xp: state.xp,
    batteryPercent: Math.round(state.batteryPercent),
    neutralized: countNeutralized(state.enemies),
  }
}

export function countNeutralized(enemies: readonly EnemyEntity[]): NeutralizedCounts {
  const counts: NeutralizedCounts = { spider: 0, orange: 0, blue: 0, purple: 0 }
  for (const enemy of enemies) {
    if (enemy.state !== "neutralized") continue
    if (enemy.kind === "spider") counts.spider += 1
    else if (enemy.serpentColor === "purple") counts.purple += 1
    else if (enemy.serpentColor === "blue") counts.blue += 1
    else counts.orange += 1
  }
  return counts
}
