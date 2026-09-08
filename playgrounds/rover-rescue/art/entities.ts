import type { EnemyEntity, MineralEntity, ObstacleEntity, RoverEntity } from "../entities"
import type { DrawWorld } from "./world-draw"
import { batchEnemies, drawEnemy } from "./enemy"
import { batchMinerals, drawMineral } from "./mineral"
import { batchObstacles, drawObstacle } from "./obstacle"

const DETAIL_ENTITY_CAP = 36
const DETAIL_USER_SCALE = 1.25

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

  const detailed = world.detail && world.userScale >= DETAIL_USER_SCALE && items.length <= DETAIL_ENTITY_CAP
  if (!detailed) {
    batchObstacles(world, obstacles)
    batchMinerals(world, minerals)
    batchEnemies(world, enemies)
    return
  }
  for (const obstacle of obstacles) drawObstacle(world, obstacle)
  for (const mineral of minerals) drawMineral(world, mineral)
  for (const enemy of enemies) drawEnemy(world, enemy)
}
