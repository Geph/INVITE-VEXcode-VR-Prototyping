import type { Entity, Vec2 } from "@/engine"

export type ObstacleKind = "rock" | "plant"

export interface ObstacleEntity extends Entity {
  kind: ObstacleKind
  posMm: Vec2
  radiusMm: number
  artSeed: number
}

export function createObstacle(
  id: string,
  posMm: Vec2,
  kind: ObstacleKind,
  radiusMm: number,
  artSeed: number,
): ObstacleEntity {
  return {
    id,
    kind,
    xMm: posMm.x,
    yMm: posMm.y,
    posMm: { x: posMm.x, y: posMm.y },
    radiusMm,
    artSeed,
  }
}
