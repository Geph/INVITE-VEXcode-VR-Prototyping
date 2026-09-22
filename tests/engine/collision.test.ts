import { describe, expect, it } from "vitest"
import {
  SpatialHash,
  circleHitsPolygon,
  distanceToPolyline,
  pointInPolygon,
  polygonsOverlap,
  segmentIntersectsPolygon,
  segmentsIntersect,
} from "@/engine/collision"
import type { Entity } from "@/engine/types"

const square: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
]

describe("pointInPolygon", () => {
  it("classifies interior, exterior, and boundary", () => {
    expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true)
    expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false)
    expect(pointInPolygon({ x: 0, y: 50 }, square)).toBe(true)
    expect(pointInPolygon({ x: 0, y: 0 }, [])).toBe(false)
    expect(pointInPolygon({ x: 0, y: 0 }, [{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe(false)
  })
})

describe("polygons / circles / segments", () => {
  const other = [
    { x: 80, y: 80 },
    { x: 180, y: 80 },
    { x: 180, y: 180 },
    { x: 80, y: 180 },
  ]

  it("detects overlap, separation, and edge crossing", () => {
    expect(polygonsOverlap(square, other)).toBe(true)
    expect(polygonsOverlap(square, [{ x: 200, y: 200 }, { x: 210, y: 200 }, { x: 210, y: 210 }])).toBe(false)
    expect(polygonsOverlap(square, [{ x: 0, y: 0 }])).toBe(false)
  })

  it("hits a circle against a polygon", () => {
    expect(circleHitsPolygon({ x: 50, y: 50 }, 1, square)).toBe(true)
    expect(circleHitsPolygon({ x: 150, y: 50 }, 40, square)).toBe(false)
    expect(circleHitsPolygon({ x: 110, y: 50 }, 15, square)).toBe(true)
    expect(circleHitsPolygon({ x: 0, y: 0 }, 1, [])).toBe(false)
  })

  it("measures distance to a polyline and segment intersection", () => {
    expect(distanceToPolyline({ x: 0, y: 10 }, [{ x: 0, y: 0 }, { x: 100, y: 0 }])).toBeCloseTo(10)
    expect(distanceToPolyline({ x: 3, y: 4 }, [{ x: 0, y: 0 }])).toBeCloseTo(5)
    expect(distanceToPolyline({ x: 0, y: 0 }, [])).toBe(Infinity)
    expect(segmentIntersectsPolygon({ x: -10, y: 50 }, { x: 200, y: 50 }, square)).toBe(true)
    expect(segmentIntersectsPolygon({ x: 200, y: 200 }, { x: 300, y: 300 }, square)).toBe(false)
    expect(segmentIntersectsPolygon({ x: 50, y: 50 }, { x: 60, y: 60 }, square)).toBe(true)
    expect(segmentIntersectsPolygon({ x: 0, y: 0 }, { x: 1, y: 1 }, [])).toBe(false)
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true)
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(false)
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 })).toBe(true)
  })
})

describe("SpatialHash", () => {
  const a: Entity = { id: "a", xMm: 0, yMm: 0, radiusMm: 10 }
  const b: Entity = { id: "b", xMm: 800, yMm: 0, radiusMm: 10 }

  it("queries by radius and rectangle", () => {
    const hash = new SpatialHash<Entity>(500)
    hash.insert(a)
    hash.insert(b)
    expect(hash.queryRadius(0, 0, 20).map((e) => e.id)).toEqual(["a"])
    expect(hash.queryRadius(0, 0, 900).map((e) => e.id).sort()).toEqual(["a", "b"])
    expect(hash.queryRect(700, -10, 900, 10).map((e) => e.id)).toEqual(["b"])
    hash.clear()
    expect(hash.queryRadius(0, 0, 20)).toEqual([])
  })

  it("falls back to a 500 mm cell when constructed with 0", () => {
    const hash = new SpatialHash<Entity>(0)
    expect(hash.cellMm).toBe(500)
    hash.insert({ id: "c", xMm: 10, yMm: 10 })
    expect(hash.queryRect(0, 0, 20, 20)).toHaveLength(1)
  })
})
