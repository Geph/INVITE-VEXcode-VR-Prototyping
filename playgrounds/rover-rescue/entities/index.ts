import type { SpatialHash } from "@/engine"
import { GRID_MM } from "../config"
import { SpatialHash as Hash } from "@/engine/collision"
import type { EnemyEntity } from "./enemy"
import type { MineralEntity } from "./mineral"
import type { ObstacleEntity } from "./obstacle"

export type { MineralCarryState, MineralEntity } from "./mineral"
export { createMineral, placeMineral } from "./mineral"
export type { ObstacleEntity, ObstacleKind } from "./obstacle"
export { createObstacle } from "./obstacle"
export type { EnemyAiState, EnemyEntity, EnemyKind, SerpentColor } from "./enemy"
export { createEnemy, enemyLevelFromBase, placeEnemy, reirradiateEnemies, statsForEnemy } from "./enemy"

export type RoverEntity = MineralEntity | ObstacleEntity | EnemyEntity

export function buildEntityIndex(input: {
  obstacles: readonly ObstacleEntity[]
  minerals: readonly MineralEntity[]
  enemies: readonly EnemyEntity[]
}): SpatialHash<RoverEntity> {
  const index = new Hash<RoverEntity>(GRID_MM)
  for (const obstacle of input.obstacles) index.insert(obstacle)
  for (const mineral of input.minerals) {
    if (mineral.state === "field") index.insert(mineral)
  }
  for (const enemy of input.enemies) index.insert(enemy)
  return index
}
