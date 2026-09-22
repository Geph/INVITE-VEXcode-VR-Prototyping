import type { EnemyEntity, MineralEntity, ObstacleEntity, RoverEntity } from "../entities"
import type { DrawWorld } from "./world-draw"
import { batchEnemies } from "./enemy"
import { batchMinerals } from "./mineral"
import { batchObstacles } from "./obstacle"

export function drawEntities(
  world: DrawWorld,
  index: { queryRect: (minX: number, minY: number, maxX: number, maxY: number) => RoverEntity[] },
): void {
  const { visible } = world
  const items = index.queryRect(visible.minX, visible.minY, visible.maxX, visible.maxY)
  const obstacles: ObstacleEntity[] = []
  const minerals: MineralEntity[] = []
  const enemies: EnemyEntity[] = []
  for (const item of items) {
    if (item.kind === "rock" || item.kind === "plant") obstacles.push(item)
    else if (item.kind === "mineral") minerals.push(item)
    else if (item.kind === "spider" || item.kind === "serpent") enemies.push(item)
  }
  // Layer batches retain the same silhouettes when zoom or on-screen counts change.
  batchObstacles(world, obstacles)
  batchMinerals(world, minerals)
  batchEnemies(world, enemies)
}
