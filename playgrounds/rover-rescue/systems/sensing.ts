import {
  angleBetween,
  detectCone,
  detectRadial,
  raycast,
  shortestRotationDelta,
  type Obstacle,
  type RobotState,
  type SpatialHash,
  type Vec2,
} from "@/engine"
import {
  AI_DETECT_RANGE_MM,
  AI_SIGHT_HALF_ANGLE_DEG,
  AI_SIGHT_RANGE_MM,
  ROVER_DISTANCE_SENSOR_MAX_MM,
} from "../config"
import type { EnemyEntity, MineralEntity, RoverEntity } from "../entities"
import { BASE, pointOnBridge, type BridgeSpec, type RiverHazard } from "../map-spec"

export type SightKind = "mineral" | "enemy" | "obstacle" | "hazard" | "base"

export interface SightReport {
  id: string
  kind: SightKind
  entityKind?: RoverEntity["kind"]
  serpentColor?: EnemyEntity["serpentColor"]
  label: string
  posMm: Vec2
  distanceMm: number
  relativeAngleDeg: number
  radiusMm: number
  level?: number
  hp?: number
  maxHp?: number
}

export interface SensorSnapshot {
  origin: Vec2
  headingDeg: number
  detected: SightReport[]
  seen: SightReport[]
  foundObject: boolean
  distanceMm: number
}

const EMPTY: SensorSnapshot = {
  origin: { x: 0, y: 0 },
  headingDeg: 0,
  detected: [],
  seen: [],
  foundObject: false,
  distanceMm: ROVER_DISTANCE_SENSOR_MAX_MM,
}

export function emptySensing(): SensorSnapshot {
  return {
    origin: { ...EMPTY.origin },
    headingDeg: 0,
    detected: [],
    seen: [],
    foundObject: false,
    distanceMm: ROVER_DISTANCE_SENSOR_MAX_MM,
  }
}

export function detect(
  origin: Vec2,
  index: SpatialHash<RoverEntity>,
): SightReport[] {
  const nearby = index.queryRadius(origin.x, origin.y, AI_DETECT_RANGE_MM)
  const targets = nearby.filter(isDetectable)
  const byId = new Map(targets.map((item) => [item.id, item]))
  return detectRadial(origin, AI_DETECT_RANGE_MM, withZeroRadius(targets)).map((hit) =>
    toReport(byId.get(hit.entity.id) ?? hit.entity, hit.distanceMm, hit.relativeAngleDeg),
  )
}

export function sight(
  origin: Vec2,
  headingDeg: number,
  index: SpatialHash<RoverEntity>,
  hazard: RiverHazard,
  bridges: readonly BridgeSpec[],
): SightReport[] {
  const nearby = index.queryRadius(origin.x, origin.y, AI_SIGHT_RANGE_MM)
  const candidates = nearby.filter(isSightEntity)
  const byId = new Map(candidates.map((item) => [item.id, item]))
  const cone = detectCone(
    origin,
    headingDeg,
    AI_SIGHT_HALF_ANGLE_DEG,
    AI_SIGHT_RANGE_MM,
    withZeroRadius(candidates),
  )
  const reports: SightReport[] = []
  for (const hit of cone) {
    const entity = byId.get(hit.entity.id) ?? hit.entity
    if (isOccluded(origin, entity, hit.distanceMm, index)) continue
    reports.push(toReport(entity, hit.distanceMm, hit.relativeAngleDeg))
  }

  const base = baseReport(origin, headingDeg)
  if (
    base.distanceMm <= AI_SIGHT_RANGE_MM &&
    Math.abs(base.relativeAngleDeg) <= AI_SIGHT_HALF_ANGLE_DEG &&
    !isOccluded(origin, { id: "base", xMm: BASE.centreMm.x, yMm: BASE.centreMm.y, radiusMm: 0 }, base.distanceMm, index)
  ) {
    reports.push(base)
  }

  const river = hazardReport(origin, headingDeg, hazard, bridges)
  if (
    river &&
    !isOccluded(origin, { id: river.id, xMm: river.posMm.x, yMm: river.posMm.y, radiusMm: 0 }, river.distanceMm, index)
  ) {
    reports.push(river)
  }

  return reports.sort((a, b) => a.distanceMm - b.distanceMm)
}

export function distanceSensor(
  origin: Vec2,
  headingDeg: number,
  index: SpatialHash<RoverEntity>,
  hazard: RiverHazard,
  bridges: readonly BridgeSpec[],
): { foundObject: boolean; distanceMm: number } {
  const nearby = index.queryRadius(origin.x, origin.y, ROVER_DISTANCE_SENSOR_MAX_MM)
  const blockers: Obstacle[] = []
  for (const item of nearby) {
    if (!isSolid(item)) continue
    blockers.push({ kind: "circle", xMm: item.xMm, yMm: item.yMm, radiusMm: item.radiusMm ?? 0 })
  }
  blockers.push({ kind: "polygon", vertices: hazard.outer })
  const hit = raycast(origin, headingDeg, ROVER_DISTANCE_SENSOR_MAX_MM, blockers)
  if (!hit) return { foundObject: false, distanceMm: ROVER_DISTANCE_SENSOR_MAX_MM }
  if (hit.obstacle.kind === "polygon" && pointOnBridge(hit.point, bridges)) {
    const withoutRiver = raycast(
      origin,
      headingDeg,
      ROVER_DISTANCE_SENSOR_MAX_MM,
      blockers.filter((item) => item.kind !== "polygon"),
    )
    if (!withoutRiver) return { foundObject: false, distanceMm: ROVER_DISTANCE_SENSOR_MAX_MM }
    return { foundObject: true, distanceMm: withoutRiver.distanceMm }
  }
  return { foundObject: true, distanceMm: hit.distanceMm }
}

export function computeSensing(
  robot: RobotState,
  index: SpatialHash<RoverEntity>,
  hazard: RiverHazard,
  bridges: readonly BridgeSpec[],
): SensorSnapshot {
  const origin = { x: robot.xMm, y: robot.yMm }
  const headingDeg = robot.headingDeg
  const range = distanceSensor(origin, headingDeg, index, hazard, bridges)
  return {
    origin,
    headingDeg,
    detected: detect(origin, index),
    seen: sight(origin, headingDeg, index, hazard, bridges),
    foundObject: range.foundObject,
    distanceMm: range.distanceMm,
  }
}

export function nearestSeen(snapshot: SensorSnapshot, kind: SightKind): SightReport | null {
  return snapshot.seen.find((item) => item.kind === kind) ?? null
}

export function nearestDetected(snapshot: SensorSnapshot, kind: "mineral" | "enemy"): SightReport | null {
  return snapshot.detected.find((item) => item.kind === kind) ?? null
}

export function baseBearing(origin: Vec2, headingDeg: number): SightReport {
  return baseReport(origin, headingDeg)
}

function isDetectable(entity: RoverEntity): boolean {
  if (entity.kind === "mineral") return (entity as MineralEntity).state === "field"
  if (entity.kind === "spider" || entity.kind === "serpent") {
    return (entity as EnemyEntity).state !== "neutralized"
  }
  return false
}

function isSightEntity(entity: RoverEntity): boolean {
  if (entity.kind === "rock" || entity.kind === "plant") return true
  return isDetectable(entity)
}

function isSolid(entity: RoverEntity): boolean {
  return entity.kind === "rock" || entity.kind === "plant"
}

function withZeroRadius(entities: RoverEntity[]): RoverEntity[] {
  return entities.map((entity) => ({ ...entity, radiusMm: 0 }))
}

function toReport(entity: RoverEntity, distanceMm: number, relativeAngleDeg: number): SightReport {
  if (entity.kind === "mineral") {
    return {
      id: entity.id,
      kind: "mineral",
      entityKind: entity.kind,
      label: "Minerals",
      posMm: { x: entity.xMm, y: entity.yMm },
      distanceMm,
      relativeAngleDeg,
      radiusMm: entity.radiusMm ?? 0,
    }
  }
  if (entity.kind === "spider" || entity.kind === "serpent") {
    const enemy = entity as EnemyEntity
    return {
      id: entity.id,
      kind: "enemy",
      entityKind: entity.kind,
      serpentColor: enemy.serpentColor,
      label: "Enemy",
      posMm: { x: entity.xMm, y: entity.yMm },
      distanceMm,
      relativeAngleDeg,
      radiusMm: entity.radiusMm ?? 0,
      level: enemy.level,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
    }
  }
  return {
    id: entity.id,
    kind: "obstacle",
    entityKind: entity.kind,
    label: "Obstacle",
    posMm: { x: entity.xMm, y: entity.yMm },
    distanceMm,
    relativeAngleDeg,
    radiusMm: entity.radiusMm ?? 0,
  }
}

function baseReport(origin: Vec2, headingDeg: number): SightReport {
  const distanceMm = Math.hypot(BASE.centreMm.x - origin.x, BASE.centreMm.y - origin.y)
  const bearing = angleBetween(origin.x, origin.y, BASE.centreMm.x, BASE.centreMm.y)
  return {
    id: "base",
    kind: "base",
    label: "Base",
    posMm: { ...BASE.centreMm },
    distanceMm,
    relativeAngleDeg: shortestRotationDelta(headingDeg, bearing),
    radiusMm: BASE.radiusMm,
  }
}

function hazardReport(
  origin: Vec2,
  headingDeg: number,
  hazard: RiverHazard,
  bridges: readonly BridgeSpec[],
): SightReport | null {
  let best: Vec2 | null = null
  let bestDist = Infinity
  const verts = hazard.outer
  for (let i = 0; i < verts.length; i++) {
    const point = closestOnSegment(origin, verts[i]!, verts[(i + 1) % verts.length]!)
    if (pointOnBridge(point, bridges)) continue
    const distanceMm = Math.hypot(point.x - origin.x, point.y - origin.y)
    if (distanceMm > AI_SIGHT_RANGE_MM) continue
    const bearing = angleBetween(origin.x, origin.y, point.x, point.y)
    const relative = shortestRotationDelta(headingDeg, bearing)
    if (Math.abs(relative) > AI_SIGHT_HALF_ANGLE_DEG) continue
    if (distanceMm < bestDist) {
      bestDist = distanceMm
      best = point
    }
  }
  if (!best) return null
  const bearing = angleBetween(origin.x, origin.y, best.x, best.y)
  return {
    id: "hazard",
    kind: "hazard",
    label: "Hazard",
    posMm: best,
    distanceMm: bestDist,
    relativeAngleDeg: shortestRotationDelta(headingDeg, bearing),
    radiusMm: 0,
  }
}

function isOccluded(
  origin: Vec2,
  target: { id: string; xMm: number; yMm: number; radiusMm?: number },
  distanceMm: number,
  index: SpatialHash<RoverEntity>,
): boolean {
  if (distanceMm <= 1) return false
  const nearby = index.queryRadius(origin.x, origin.y, distanceMm)
  const blockers: Obstacle[] = []
  for (const item of nearby) {
    if (item.id === target.id || !isSolid(item)) continue
    blockers.push({ kind: "circle", xMm: item.xMm, yMm: item.yMm, radiusMm: item.radiusMm ?? 0 })
  }
  if (blockers.length === 0) return false
  const bearing = angleBetween(origin.x, origin.y, target.xMm, target.yMm)
  const hit = raycast(origin, bearing, Math.max(0, distanceMm - 1), blockers)
  return hit !== null
}

function closestOnSegment(point: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return { x: a.x, y: a.y }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2))
  return { x: a.x + t * dx, y: a.y + t * dy }
}
