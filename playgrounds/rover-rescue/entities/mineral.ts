import type { Entity, Vec2 } from "@/engine"
import { MINERAL_RADIUS_MM } from "../config"

export type MineralCarryState = "field" | "carried" | "used" | "delivered"

export interface MineralEntity extends Entity {
  kind: "mineral"
  posMm: Vec2
  zoneId: string
  state: MineralCarryState
  radiusMm: number
}

export function createMineral(id: string, posMm: Vec2, zoneId: string): MineralEntity {
  return {
    id,
    kind: "mineral",
    xMm: posMm.x,
    yMm: posMm.y,
    posMm: { x: posMm.x, y: posMm.y },
    zoneId,
    state: "field",
    radiusMm: MINERAL_RADIUS_MM,
  }
}

export function placeMineral(mineral: MineralEntity, posMm: Vec2): MineralEntity {
  return {
    ...mineral,
    xMm: posMm.x,
    yMm: posMm.y,
    posMm: { x: posMm.x, y: posMm.y },
    state: "field",
  }
}
