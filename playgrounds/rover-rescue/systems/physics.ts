import type { SpatialHash, Vec2 } from "@/engine"
import { ROVER_HIT_RADIUS_MM, START_CLEARANCE_MM, START_POSE, MOVE_STEP_MM } from "../config"
import type { RoverEntity } from "../entities"
import {
  BASE,
  BRIDGES,
  pointInRiverHazard,
  pointOnBasePad,
  pointOnBridge,
  type BridgeSpec,
  type RiverHazard,
} from "../map-spec"

export interface MoveResolution {
  xMm: number
  yMm: number
  blocked: boolean
  inRiver: boolean
}

export function isOnBasePad(point: Vec2): boolean {
  return pointOnBasePad(point, BASE)
}

export function isOnBridgeDeck(point: Vec2, bridges: readonly BridgeSpec[] = BRIDGES): boolean {
  return pointOnBridge(point, bridges)
}

export function isRiverHazard(point: Vec2, hazard: RiverHazard): boolean {
  return pointInRiverHazard(point, hazard)
}

export function isForbiddenSpawn(point: Vec2, hazard: RiverHazard, bridges: readonly BridgeSpec[] = BRIDGES): boolean {
  if (isRiverHazard(point, hazard)) return true
  if (isOnBridgeDeck(point, bridges)) return true
  if (isOnBasePad(point)) return true
  const start = { x: START_POSE.xMm, y: START_POSE.yMm }
  return Math.hypot(point.x - start.x, point.y - start.y) < START_CLEARANCE_MM
}

export function obstacleAt(
  point: Vec2,
  radiusMm: number,
  index: SpatialHash<RoverEntity>,
): RoverEntity | null {
  const hits = index.queryRadius(point.x, point.y, radiusMm)
  for (const item of hits) {
    if (item.kind !== "rock" && item.kind !== "plant") continue
    const gap = Math.hypot(item.xMm - point.x, item.yMm - point.y)
    if (gap < radiusMm + (item.radiusMm ?? 0)) return item
  }
  return null
}

export function resolveRoverMove(
  from: Vec2,
  to: Vec2,
  index: SpatialHash<RoverEntity>,
  hazard: RiverHazard,
): MoveResolution {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.hypot(dx, dy)
  if (dist < 1e-6) {
    return {
      xMm: from.x,
      yMm: from.y,
      blocked: Boolean(obstacleAt(from, ROVER_HIT_RADIUS_MM, index)),
      inRiver: isRiverHazard(from, hazard),
    }
  }

  const steps = Math.max(1, Math.ceil(dist / MOVE_STEP_MM))
  let last = from
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const next = { x: from.x + dx * t, y: from.y + dy * t }
    if (obstacleAt(next, ROVER_HIT_RADIUS_MM, index)) {
      return { xMm: last.x, yMm: last.y, blocked: true, inRiver: isRiverHazard(last, hazard) }
    }
    last = next
    if (isRiverHazard(next, hazard)) {
      return { xMm: next.x, yMm: next.y, blocked: false, inRiver: true }
    }
  }
  return { xMm: to.x, yMm: to.y, blocked: false, inRiver: false }
}
