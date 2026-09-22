import type { Entity, Vec2 } from "./types"

/** Even-odd / ray-cast point-in-polygon. Boundary counts as inside. */
export function pointInPolygon(point: Vec2, vertices: readonly Vec2[]): boolean {
  if (vertices.length < 3) return false
  if (pointOnPolygonBoundary(point, vertices)) return true
  let inside = false
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i]
    const b = vertices[j]
    const intersect =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y + Number.EPSILON) + a.x
    if (intersect) inside = !inside
  }
  return inside
}

export function polygonsOverlap(a: readonly Vec2[], b: readonly Vec2[]): boolean {
  if (a.length < 3 || b.length < 3) return false
  for (const p of a) if (pointInPolygon(p, b)) return true
  for (const p of b) if (pointInPolygon(p, a)) return true
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i]
    const a2 = a[(i + 1) % a.length]
    for (let j = 0; j < b.length; j++) {
      if (segmentsIntersect(a1, a2, b[j], b[(j + 1) % b.length])) return true
    }
  }
  return false
}

export function circleHitsPolygon(center: Vec2, radiusMm: number, vertices: readonly Vec2[]): boolean {
  if (vertices.length < 3) return false
  if (pointInPolygon(center, vertices)) return true
  return distanceToPolyline(center, closedRing(vertices)) <= radiusMm
}

/** Minimum distance from a point to a polyline (open chain of segments). */
export function distanceToPolyline(point: Vec2, vertices: readonly Vec2[]): number {
  if (vertices.length === 0) return Infinity
  if (vertices.length === 1) return hypot(point, vertices[0])
  let best = Infinity
  for (let i = 0; i < vertices.length - 1; i++) {
    best = Math.min(best, distanceToSegment(point, vertices[i], vertices[i + 1]))
  }
  return best
}

export function segmentIntersectsPolygon(a: Vec2, b: Vec2, vertices: readonly Vec2[]): boolean {
  if (vertices.length < 3) return false
  if (pointInPolygon(a, vertices) || pointInPolygon(b, vertices)) return true
  for (let i = 0; i < vertices.length; i++) {
    if (segmentsIntersect(a, b, vertices[i], vertices[(i + 1) % vertices.length])) return true
  }
  return false
}

export class SpatialHash<T extends Entity> {
  readonly cellMm: number
  private cells = new Map<string, T[]>()

  constructor(cellMm = 500) {
    this.cellMm = cellMm > 0 ? cellMm : 500
  }

  clear(): void {
    this.cells.clear()
  }

  insert(item: T, radiusMm = item.radiusMm ?? 0): void {
    const r = Math.max(0, radiusMm)
    const minC = this.cell(item.xMm - r, item.yMm - r)
    const maxC = this.cell(item.xMm + r, item.yMm + r)
    for (let cx = minC.x; cx <= maxC.x; cx++) {
      for (let cy = minC.y; cy <= maxC.y; cy++) {
        const key = `${cx},${cy}`
        const bucket = this.cells.get(key)
        if (bucket) bucket.push(item)
        else this.cells.set(key, [item])
      }
    }
  }

  queryRadius(xMm: number, yMm: number, radiusMm: number): T[] {
    return this.collect(xMm - radiusMm, yMm - radiusMm, xMm + radiusMm, yMm + radiusMm, (item) => {
      const extra = item.radiusMm ?? 0
      return Math.hypot(item.xMm - xMm, item.yMm - yMm) <= radiusMm + extra
    })
  }

  queryRect(minX: number, minY: number, maxX: number, maxY: number): T[] {
    return this.collect(minX, minY, maxX, maxY, (item) => {
      const r = item.radiusMm ?? 0
      return item.xMm + r >= minX && item.xMm - r <= maxX && item.yMm + r >= minY && item.yMm - r <= maxY
    })
  }

  private collect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    keep: (item: T) => boolean,
  ): T[] {
    const minC = this.cell(minX, minY)
    const maxC = this.cell(maxX, maxY)
    const seen = new Set<T>()
    const out: T[] = []
    for (let cx = minC.x; cx <= maxC.x; cx++) {
      for (let cy = minC.y; cy <= maxC.y; cy++) {
        const bucket = this.cells.get(`${cx},${cy}`)
        if (!bucket) continue
        for (const item of bucket) {
          if (seen.has(item) || !keep(item)) continue
          seen.add(item)
          out.push(item)
        }
      }
    }
    return out
  }

  private cell(xMm: number, yMm: number): { x: number; y: number } {
    return { x: Math.floor(xMm / this.cellMm), y: Math.floor(yMm / this.cellMm) }
  }
}

function closedRing(vertices: readonly Vec2[]): Vec2[] {
  if (vertices.length === 0) return []
  const first = vertices[0]
  const last = vertices[vertices.length - 1]
  if (first.x === last.x && first.y === last.y) return [...vertices]
  return [...vertices, first]
}

function pointOnPolygonBoundary(point: Vec2, vertices: readonly Vec2[]): boolean {
  for (let i = 0; i < vertices.length; i++) {
    if (distanceToSegment(point, vertices[i], vertices[(i + 1) % vertices.length]) < 1e-9) return true
  }
  return false
}

export function segmentsIntersect(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): boolean {
  const o1 = orient(a1, a2, b1)
  const o2 = orient(a1, a2, b2)
  const o3 = orient(b1, b2, a1)
  const o4 = orient(b1, b2, a2)
  if (o1 !== o2 && o3 !== o4) return true
  if (o1 === 0 && onSegment(a1, b1, a2)) return true
  if (o2 === 0 && onSegment(a1, b2, a2)) return true
  if (o3 === 0 && onSegment(b1, a1, b2)) return true
  if (o4 === 0 && onSegment(b1, a2, b2)) return true
  return false
}

function orient(a: Vec2, b: Vec2, c: Vec2): number {
  const v = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)
  if (Math.abs(v) < 1e-12) return 0
  return v > 0 ? 1 : 2
}

function onSegment(a: Vec2, p: Vec2, b: Vec2): boolean {
  return (
    p.x <= Math.max(a.x, b.x) + 1e-12 &&
    p.x >= Math.min(a.x, b.x) - 1e-12 &&
    p.y <= Math.max(a.y, b.y) + 1e-12 &&
    p.y >= Math.min(a.y, b.y) - 1e-12
  )
}

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return hypot(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function hypot(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
