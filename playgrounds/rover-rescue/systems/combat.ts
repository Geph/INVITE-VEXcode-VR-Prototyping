/**
 * Aggro, melee drain, and absorb. Ranges and rates are TUNABLE so a
 * level-matched fight is survivable and a much higher-level enemy is not.
 */

import type { SpatialHash, Vec2 } from "@/engine"
import { clampBattery } from "./battery"
import { wanderEnemy } from "./enemy-ai"
import { isOnBridgeDeck, isRiverHazard, obstacleAt } from "./physics"
import { absorbPctForLevel } from "./leveling"
import {
  ABSORB_DAMAGE_PER_ROVER_LEVEL,
  ABSORB_RANGE_MM,
  ENEMY_AGGRO_RANGE_MM,
  ENEMY_ATTACK_COOLDOWN_MS,
  ENEMY_ATTACK_DRAIN_BASE_PCT,
  ENEMY_ATTACK_DRAIN_PER_LEVEL_GAP_PCT,
  ENEMY_ATTACK_RANGE_MM,
  ENEMY_LEASH_RANGE_MM,
  ENEMY_PURSUE_SPEED_MM_PER_MS,
  FIELD_BOUNDS,
  XP_SERPENT,
  XP_SERPENT_PURPLE,
  XP_SPIDER,
} from "../config"
import { placeEnemy, type EnemyEntity, type RoverEntity } from "../entities"
import type { BridgeSpec, RiverHazard } from "../map-spec"

export interface CombatTickInput {
  enemies: readonly EnemyEntity[]
  rover: Vec2 | null
  roverLevel: number
  batteryPercent: number
  elapsedMs: number
  dtMs: number
  running: boolean
  index: SpatialHash<RoverEntity>
  hazard: RiverHazard
  bridges: readonly BridgeSpec[]
}

export interface CombatTickResult {
  enemies: EnemyEntity[]
  batteryPercent: number
  underAttack: boolean
}

export interface AbsorbInput {
  enemies: readonly EnemyEntity[]
  rover: Vec2
  roverLevel: number
  batteryPercent: number
}

export interface AbsorbResult {
  enemies: EnemyEntity[]
  batteryPercent: number
  xpDelta: number
  absorbed: boolean
  neutralized: EnemyEntity | null
}

export function xpForNeutralizing(enemy: EnemyEntity): number {
  if (enemy.kind === "spider") return XP_SPIDER
  if (enemy.serpentColor === "purple") return XP_SERPENT_PURPLE
  return XP_SERPENT
}

export function attackDrainPct(enemyLevel: number, roverLevel: number): number {
  const gap = Math.max(0, enemyLevel - roverLevel)
  return ENEMY_ATTACK_DRAIN_BASE_PCT + ENEMY_ATTACK_DRAIN_PER_LEVEL_GAP_PCT * gap
}

export function tickCombat(input: CombatTickInput): CombatTickResult {
  if (!input.running || !input.rover) {
    return {
      enemies: input.enemies.map((enemy) =>
        wanderEnemy(enemy, input.elapsedMs, input.index, input.hazard, input.bridges),
      ),
      batteryPercent: input.batteryPercent,
      underAttack: false,
    }
  }

  const rover = input.rover
  let batteryPercent = input.batteryPercent
  let underAttack = false
  const enemies = input.enemies.map((enemy) => {
    if (enemy.state === "neutralized") return enemy
    const stepped = advanceEnemy(enemy, rover, input)
    if (stepped.state !== "attacking") return stepped
    underAttack = true
    const hit = tryHit(stepped, input.elapsedMs)
    if (hit.didHit) {
      batteryPercent = clampBattery(batteryPercent - attackDrainPct(stepped.level, input.roverLevel))
    }
    return hit.enemy
  })
  return { enemies, batteryPercent, underAttack }
}

export function absorbNearestEnemy(input: AbsorbInput): AbsorbResult {
  const target = nearestAbsorbable(input.enemies, input.rover)
  if (!target) {
    return {
      enemies: input.enemies as EnemyEntity[],
      batteryPercent: input.batteryPercent,
      xpDelta: 0,
      absorbed: false,
      neutralized: null,
    }
  }
  const damage = ABSORB_DAMAGE_PER_ROVER_LEVEL * input.roverLevel
  const hp = Math.max(0, target.hp - damage)
  const neutralized = hp <= 0
  const gained = (absorbPctForLevel(input.roverLevel) / 100) * target.radiation
  const patched: EnemyEntity = {
    ...target,
    hp,
    state: neutralized ? "neutralized" : target.state,
    radiation: neutralized ? 0 : target.radiation,
  }
  return {
    enemies: input.enemies.map((enemy) => (enemy.id === patched.id ? patched : enemy)),
    batteryPercent: clampBattery(input.batteryPercent + gained),
    xpDelta: neutralized ? xpForNeutralizing(target) : 0,
    absorbed: true,
    neutralized: neutralized ? target : null,
  }
}

function nearestAbsorbable(enemies: readonly EnemyEntity[], rover: Vec2): EnemyEntity | null {
  let best: EnemyEntity | null = null
  let bestDist = ABSORB_RANGE_MM
  for (const enemy of enemies) {
    if (enemy.state === "neutralized") continue
    const dist = Math.hypot(enemy.xMm - rover.x, enemy.yMm - rover.y)
    if (dist <= bestDist) {
      best = enemy
      bestDist = dist
    }
  }
  return best
}

function advanceEnemy(enemy: EnemyEntity, rover: Vec2, input: CombatTickInput): EnemyEntity {
  const dist = Math.hypot(enemy.xMm - rover.x, enemy.yMm - rover.y)
  const state = nextAiState(enemy.state, dist)
  if (state === "idle") {
    return wanderEnemy({ ...enemy, state }, input.elapsedMs, input.index, input.hazard, input.bridges)
  }
  return moveToward({ ...enemy, state }, rover, input)
}

function nextAiState(state: EnemyEntity["state"], dist: number): EnemyEntity["state"] {
  if (dist > ENEMY_LEASH_RANGE_MM) return "idle"
  if (dist <= ENEMY_ATTACK_RANGE_MM) return "attacking"
  if (dist <= ENEMY_AGGRO_RANGE_MM || state === "pursuing" || state === "attacking") return "pursuing"
  return "idle"
}

function moveToward(enemy: EnemyEntity, rover: Vec2, input: CombatTickInput): EnemyEntity {
  const dx = rover.x - enemy.xMm
  const dy = rover.y - enemy.yMm
  const dist = Math.hypot(dx, dy)
  if (dist < 1) return enemy
  const step = Math.min(ENEMY_PURSUE_SPEED_MM_PER_MS * Math.max(0, input.dtMs), dist)
  const next = { x: enemy.xMm + (dx / dist) * step, y: enemy.yMm + (dy / dist) * step }
  if (!isInsideField(next)) return enemy
  if (!isOnBridgeDeck(next, input.bridges) && isRiverHazard(next, input.hazard)) return enemy
  if (obstacleAt(next, enemy.radiusMm, input.index)) return enemy
  return placeEnemy(enemy, next)
}

function tryHit(enemy: EnemyEntity, elapsedMs: number): { enemy: EnemyEntity; didHit: boolean } {
  if (enemy.lastHitAtMs !== null && elapsedMs - enemy.lastHitAtMs < ENEMY_ATTACK_COOLDOWN_MS) {
    return { enemy, didHit: false }
  }
  return { enemy: { ...enemy, lastHitAtMs: elapsedMs }, didHit: true }
}

function isInsideField(point: Vec2): boolean {
  return (
    point.x >= FIELD_BOUNDS.minX &&
    point.x <= FIELD_BOUNDS.maxX &&
    point.y >= FIELD_BOUNDS.minY &&
    point.y <= FIELD_BOUNDS.maxY
  )
}
