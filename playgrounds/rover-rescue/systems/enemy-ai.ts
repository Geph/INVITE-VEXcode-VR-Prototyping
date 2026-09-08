import type { SpatialHash, Vec2 } from "@/engine"
import { ENEMY_WANDER_PERIOD_MS, ENEMY_WANDER_RADIUS_MM, FIELD_BOUNDS } from "../config"
import { placeEnemy, type EnemyEntity, type RoverEntity } from "../entities"
import type { BridgeSpec, RiverHazard } from "../map-spec"
import { isForbiddenSpawn, obstacleAt } from "./physics"

export function wanderEnemies(
  enemies: readonly EnemyEntity[],
  elapsedMs: number,
  index: SpatialHash<RoverEntity>,
  hazard: RiverHazard,
  bridges: readonly BridgeSpec[],
): EnemyEntity[] {
  return enemies.map((enemy) => {
    if (enemy.state !== "idle") return enemy
    const next = wanderPoint(enemy, elapsedMs)
    if (!isInsideField(next)) return enemy
    if (isForbiddenSpawn(next, hazard, bridges)) return enemy
    if (obstacleAt(next, enemy.radiusMm, index)) return enemy
    return placeEnemy(enemy, next)
  })
}

function wanderPoint(enemy: EnemyEntity, elapsedMs: number): Vec2 {
  const turns = elapsedMs / ENEMY_WANDER_PERIOD_MS + enemy.wanderPhase
  const angle = turns * Math.PI * 2
  const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(angle * 2 + enemy.wanderPhase))
  const radius = ENEMY_WANDER_RADIUS_MM * pulse
  return {
    x: enemy.homeMm.x + Math.cos(angle) * radius,
    y: enemy.homeMm.y + Math.sin(angle) * radius,
  }
}

function isInsideField(point: Vec2): boolean {
  return (
    point.x >= FIELD_BOUNDS.minX &&
    point.x <= FIELD_BOUNDS.maxX &&
    point.y >= FIELD_BOUNDS.minY &&
    point.y <= FIELD_BOUNDS.maxY
  )
}
