import type { SpatialHash, Vec2 } from "@/engine"
import {
  ENEMY_BASE_CLEARANCE_MM,
  FIELD_BOUNDS,
  MINERAL_PUSH_MARGIN_MM,
  MOVE_STEP_MM,
  ROVER_HIT_RADIUS_MM,
  ROVER_LENGTH_MM,
  ROVER_WIDTH_MM,
  START_CLEARANCE_MM,
  START_POSE,
} from "../config"
import type { MineralEntity, RoverEntity } from "../entities"
import {
  BASE,
  BRIDGES,
  pointInRiverHazard,
  pointOnBasePad,
  pointOnBridge,
  type BridgeSpec,
  type RiverHazard,
} from "../map-spec"

const HALF_LENGTH = ROVER_LENGTH_MM / 2
const HALF_WIDTH = ROVER_WIDTH_MM / 2

/** Keeps the whole hull inside the dotted border. */
export function clampRoverMm(xMm: number, yMm: number): { xMm: number; yMm: number } {
  return {
    xMm: clamp(xMm, FIELD_BOUNDS.minX + HALF_WIDTH, FIELD_BOUNDS.maxX - HALF_WIDTH),
    yMm: clamp(yMm, FIELD_BOUNDS.minY + HALF_LENGTH, FIELD_BOUNDS.maxY - HALF_LENGTH),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

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

/** Spiders and serpents stay out of the lower-left yard around Base. */
export function isForbiddenEnemySpawn(
  point: Vec2,
  hazard: RiverHazard,
  bridges: readonly BridgeSpec[] = BRIDGES,
): boolean {
  if (isForbiddenSpawn(point, hazard, bridges)) return true
  const start = { x: START_POSE.xMm, y: START_POSE.yMm }
  return Math.hypot(point.x - start.x, point.y - start.y) < ENEMY_BASE_CLEARANCE_MM
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

export interface DrivePlan {
  /** Where the rover actually ends up, after walls, obstacles and the river. */
  endMm: Vec2
  requestedMm: number
  reachableMm: number
  blocked: boolean
  inRiver: boolean
}

/** Unit vector for a drive. Heading 0° is north, and north is +Y. */
export function roverDriveVector(headingDeg: number, direction = "forward"): Vec2 {
  const sign = direction === "reverse" ? -1 : 1
  const rad = (headingDeg * Math.PI) / 180
  return { x: sign * Math.sin(rad), y: sign * Math.cos(rad) }
}

/**
 * The single answer to "where does this drive end". The distance picker's
 * preview and the drive itself both call this, so the dashed line cannot
 * promise a distance the rover will not cover.
 */
export function planRoverDrive({
  from,
  headingDeg,
  direction,
  distanceMm,
  index,
  hazard,
}: {
  from: Vec2
  headingDeg: number
  direction: string
  distanceMm: number
  index: SpatialHash<RoverEntity>
  hazard: RiverHazard
}): DrivePlan {
  const unit = roverDriveVector(headingDeg, direction)
  const requestedMm = Math.max(0, distanceMm)
  const wall = clampRoverMm(from.x + unit.x * requestedMm, from.y + unit.y * requestedMm)
  const resolved = resolveRoverMove(from, { x: wall.xMm, y: wall.yMm }, index, hazard)
  const endMm = { x: resolved.xMm, y: resolved.yMm }
  return {
    endMm,
    requestedMm,
    reachableMm: Math.hypot(endMm.x - from.x, endMm.y - from.y),
    blocked: resolved.blocked,
    inRiver: resolved.inRiver,
  }
}

export interface MineralPush {
  id: string
  toMm: Vec2
}

/**
 * Mineral samples are cargo, so the rover shoves them out of its way instead
 * of stopping. A sample that would be shoved into a rock, into the river or
 * off the field stays put — being overrun beats vanishing.
 */
export function pushedMinerals({
  minerals,
  rover,
  headingDeg,
  index,
  hazard,
}: {
  minerals: readonly MineralEntity[]
  rover: Vec2
  headingDeg: number
  index: SpatialHash<RoverEntity>
  hazard: RiverHazard
}): MineralPush[] {
  const pushes: MineralPush[] = []
  for (const mineral of minerals) {
    if (mineral.state !== "field") continue
    const clearanceMm = ROVER_HIT_RADIUS_MM + mineral.radiusMm
    const dx = mineral.xMm - rover.x
    const dy = mineral.yMm - rover.y
    const gap = Math.hypot(dx, dy)
    if (gap >= clearanceMm) continue

    // A dead-centre hit has no direction to push along, so use the heading.
    const away = gap > 1e-6 ? { x: dx / gap, y: dy / gap } : roverDriveVector(headingDeg)
    const reach = clearanceMm + MINERAL_PUSH_MARGIN_MM
    const target = clampRoverMm(rover.x + away.x * reach, rover.y + away.y * reach)
    const toMm = { x: target.xMm, y: target.yMm }
    if (isRiverHazard(toMm, hazard)) continue
    if (obstacleAt(toMm, mineral.radiusMm, index)) continue
    pushes.push({ id: mineral.id, toMm })
  }
  return pushes
}
