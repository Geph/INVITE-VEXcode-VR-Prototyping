import { pointInPolygon } from "./collision"
import type { Entity, Obstacle, SensorHit, Vec2 } from "./types"
import { angleBetween, normalizeDegrees, shortestRotationDelta } from "./units"

export interface RaycastHit {
  distanceMm: number
  point: Vec2
  obstacle: Obstacle
}

const RAY_EPS = 1e-6

/** Cast a ray from `origin` along `headingDeg` (0 = north, clockwise). */
export function raycast(
  origin: Vec2,
  headingDeg: number,
  maxMm: number,
  obstacles: readonly Obstacle[],
): RaycastHit | null {
  const range = Math.max(0, maxMm)
  const heading = normalizeDegrees(headingDeg)
  const rad = (heading * Math.PI) / 180
  const dir: Vec2 = { x: Math.sin(rad), y: Math.cos(rad) }
  let best: RaycastHit | null = null

  for (const obstacle of obstacles) {
    const hits = rayHitsObstacle(origin, dir, range, obstacle)
    for (const hit of hits) {
      if (hit.distanceMm < -RAY_EPS || hit.distanceMm > range) continue
      if (!best || hit.distanceMm < best.distanceMm) best = { ...hit, obstacle }
    }
  }
  return best
}

export function detectRadial<T extends Entity>(
  origin: Vec2,
  radiusMm: number,
  entities: readonly T[],
  filter?: (entity: T) => boolean,
): SensorHit<T>[] {
  const hits: SensorHit<T>[] = []
  for (const entity of entities) {
    if (filter && !filter(entity)) continue
    const extra = entity.radiusMm ?? 0
    const distanceMm = Math.max(0, Math.hypot(entity.xMm - origin.x, entity.yMm - origin.y) - extra)
    if (distanceMm > radiusMm) continue
    const bearing = angleBetween(origin.x, origin.y, entity.xMm, entity.yMm)
    hits.push({ entity, distanceMm, relativeAngleDeg: bearing })
  }
  return hits.sort(byDistance)
}

export function detectCone<T extends Entity>(
  origin: Vec2,
  headingDeg: number,
  halfAngleDeg: number,
  rangeMm: number,
  entities: readonly T[],
  filter?: (entity: T) => boolean,
): SensorHit<T>[] {
  const heading = normalizeDegrees(headingDeg)
  const hits: SensorHit<T>[] = []
  for (const entity of entities) {
    if (filter && !filter(entity)) continue
    const extra = entity.radiusMm ?? 0
    const distanceMm = Math.max(0, Math.hypot(entity.xMm - origin.x, entity.yMm - origin.y) - extra)
    if (distanceMm > rangeMm) continue
    const bearing = angleBetween(origin.x, origin.y, entity.xMm, entity.yMm)
    const relativeAngleDeg = shortestRotationDelta(heading, bearing)
    if (Math.abs(relativeAngleDeg) > halfAngleDeg) continue
    hits.push({ entity, distanceMm, relativeAngleDeg })
  }
  return hits.sort(byDistance)
}

function byDistance<T>(a: SensorHit<T>, b: SensorHit<T>): number {
  return a.distanceMm - b.distanceMm
}

function rayHitsObstacle(origin: Vec2, dir: Vec2, range: number, obstacle: Obstacle): Array<Omit<RaycastHit, "obstacle">> {
  if (obstacle.kind === "circle") {
    return rayCircle(origin, dir, range, obstacle)
  }
  if (obstacle.kind === "segment") {
    const t = raySegment(origin, dir, range, obstacle.a, obstacle.b)
    return t === null ? [] : [{ distanceMm: t, point: pointOnRay(origin, dir, t) }]
  }
  const hits: Array<Omit<RaycastHit, "obstacle">> = []
  const verts = obstacle.vertices
  if (verts.length < 2) return hits
  if (pointInPolygon(origin, verts)) {
    hits.push({ distanceMm: 0, point: { ...origin } })
  }
  for (let i = 0; i < verts.length; i++) {
    const t = raySegment(origin, dir, range, verts[i], verts[(i + 1) % verts.length])
    if (t !== null) hits.push({ distanceMm: t, point: pointOnRay(origin, dir, t) })
  }
  return hits
}

function rayCircle(
  origin: Vec2,
  dir: Vec2,
  range: number,
  circle: { xMm: number; yMm: number; radiusMm: number },
): Array<Omit<RaycastHit, "obstacle">> {
  const fx = origin.x - circle.xMm
  const fy = origin.y - circle.yMm
  const a = dir.x * dir.x + dir.y * dir.y
  const b = 2 * (fx * dir.x + fy * dir.y)
  const c = fx * fx + fy * fy - circle.radiusMm * circle.radiusMm
  const disc = b * b - 4 * a * c
  if (disc < 0 || a === 0) return []
  const root = Math.sqrt(disc)
  const t0 = (-b - root) / (2 * a)
  const t1 = (-b + root) / (2 * a)
  const hits: Array<Omit<RaycastHit, "obstacle">> = []
  for (const t of [t0, t1]) {
    if (t >= 0 && t <= range) hits.push({ distanceMm: t, point: pointOnRay(origin, dir, t) })
  }
  return hits
}

function raySegment(origin: Vec2, dir: Vec2, range: number, a: Vec2, b: Vec2): number | null {
  const sx = b.x - a.x
  const sy = b.y - a.y
  const denom = dir.x * sy - dir.y * sx
  if (Math.abs(denom) < 1e-12) return null
  const qx = a.x - origin.x
  const qy = a.y - origin.y
  const t = (qx * sy - qy * sx) / denom
  const u = (qx * dir.y - qy * dir.x) / denom
  if (t < 0 || t > range || u < -1e-9 || u > 1 + 1e-9) return null
  return t
}

function pointOnRay(origin: Vec2, dir: Vec2, t: number): Vec2 {
  return { x: origin.x + dir.x * t, y: origin.y + dir.y * t }
}
