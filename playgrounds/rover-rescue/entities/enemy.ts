import type { Entity, Vec2 } from "@/engine"
import {
  ENEMY_HP_BY_LEVEL,
  ENEMY_LEVEL_DISTANCE_MM,
  ENEMY_LEVEL_MAX,
  ENEMY_LEVEL_MIN,
  ENEMY_RADIATION_BY_LEVEL,
  SERPENT_HP_BONUS,
  SPIDER_RADIUS_MM,
  SERPENT_RADIUS_MM,
} from "../config"
import { BASE } from "../map-spec"

export type EnemyKind = "spider" | "serpent"
export type SerpentColor = "orange" | "blue" | "purple"
export type EnemyAiState = "idle" | "pursuing" | "attacking" | "neutralized"

export interface EnemyEntity extends Entity {
  kind: EnemyKind
  posMm: Vec2
  serpentColor: SerpentColor | null
  level: number
  maxHp: number
  hp: number
  radiation: number
  state: EnemyAiState
  homeMm: Vec2
  artSeed: number
  wanderPhase: number
  radiusMm: number
  /** Mission time of the last successful hit; null until the first one. */
  lastHitAtMs: number | null
}

export function enemyLevelFromBase(posMm: Vec2): number {
  const distanceMm = Math.hypot(posMm.x - BASE.centreMm.x, posMm.y - BASE.centreMm.y)
  return Math.max(
    ENEMY_LEVEL_MIN,
    Math.min(ENEMY_LEVEL_MAX, 1 + Math.floor(distanceMm / ENEMY_LEVEL_DISTANCE_MM)),
  )
}

export function statsForEnemy(kind: EnemyKind, level: number): { maxHp: number; radiation: number } {
  const clamped = Math.max(ENEMY_LEVEL_MIN, Math.min(ENEMY_LEVEL_MAX, level))
  const maxHp = ENEMY_HP_BY_LEVEL[clamped] + (kind === "serpent" ? SERPENT_HP_BONUS : 0)
  return { maxHp, radiation: ENEMY_RADIATION_BY_LEVEL[clamped] }
}

export function createEnemy(input: {
  id: string
  posMm: Vec2
  kind: EnemyKind
  serpentColor: SerpentColor | null
  artSeed: number
  wanderPhase: number
}): EnemyEntity {
  const level = enemyLevelFromBase(input.posMm)
  const { maxHp, radiation } = statsForEnemy(input.kind, level)
  return {
    id: input.id,
    kind: input.kind,
    xMm: input.posMm.x,
    yMm: input.posMm.y,
    posMm: { x: input.posMm.x, y: input.posMm.y },
    serpentColor: input.kind === "serpent" ? input.serpentColor : null,
    level,
    maxHp,
    hp: maxHp,
    radiation,
    state: "idle",
    homeMm: { x: input.posMm.x, y: input.posMm.y },
    artSeed: input.artSeed,
    wanderPhase: input.wanderPhase,
    radiusMm: input.kind === "serpent" ? SERPENT_RADIUS_MM : SPIDER_RADIUS_MM,
    lastHitAtMs: null,
  }
}

export function placeEnemy(enemy: EnemyEntity, posMm: Vec2): EnemyEntity {
  return { ...enemy, xMm: posMm.x, yMm: posMm.y, posMm: { x: posMm.x, y: posMm.y } }
}

/** Continue after day 50 restores every neutralized enemy in place at its home. */
export function reirradiateEnemy(enemy: EnemyEntity): EnemyEntity {
  if (enemy.state !== "neutralized") return enemy
  const { maxHp, radiation } = statsForEnemy(enemy.kind, enemy.level)
  return placeEnemy(
    {
      ...enemy,
      maxHp,
      hp: maxHp,
      radiation,
      state: "idle",
      lastHitAtMs: null,
    },
    enemy.homeMm,
  )
}

export function reirradiateEnemies(enemies: readonly EnemyEntity[]): EnemyEntity[] {
  return enemies.map(reirradiateEnemy)
}
