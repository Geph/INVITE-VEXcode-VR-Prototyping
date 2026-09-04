import { describe, expect, it } from "vitest"
import { detectCone, detectRadial, raycast } from "@/engine/sensors"
import type { Entity } from "@/engine/types"

const mineral = (id: string, xMm: number, yMm: number, radiusMm = 0): Entity => ({
  id,
  xMm,
  yMm,
  radiusMm,
  kind: "mineral",
})

describe("raycast", () => {
  it("hits the nearest circle along a north heading", () => {
    const hit = raycast({ x: 0, y: 0 }, 0, 1000, [
      { kind: "circle", xMm: 0, yMm: 400, radiusMm: 50 },
      { kind: "circle", xMm: 0, yMm: 200, radiusMm: 20 },
    ])
    expect(hit).not.toBeNull()
    expect(hit!.distanceMm).toBeCloseTo(180)
    expect(hit!.point.y).toBeCloseTo(180)
  })

  it("hits a polygon edge and a segment", () => {
    const wall = raycast({ x: 0, y: 0 }, 90, 500, [
      {
        kind: "polygon",
        vertices: [
          { x: 100, y: -50 },
          { x: 140, y: -50 },
          { x: 140, y: 50 },
          { x: 100, y: 50 },
        ],
      },
    ])
    expect(wall!.distanceMm).toBeCloseTo(100)

    const beam = raycast({ x: 0, y: 0 }, 0, 500, [
      { kind: "segment", a: { x: -20, y: 80 }, b: { x: 20, y: 80 } },
    ])
    expect(beam!.distanceMm).toBeCloseTo(80)
  })

  it("returns null when nothing is in range, and 0 when already inside", () => {
    expect(raycast({ x: 0, y: 0 }, 0, 50, [{ kind: "circle", xMm: 0, yMm: 400, radiusMm: 10 }])).toBeNull()
    expect(raycast({ x: 0, y: 0 }, 0, 100, [])).toBeNull()
    const inside = raycast({ x: 0, y: 0 }, 0, 100, [
      {
        kind: "polygon",
        vertices: [
          { x: -10, y: -10 },
          { x: 10, y: -10 },
          { x: 10, y: 10 },
          { x: -10, y: 10 },
        ],
      },
    ])
    expect(inside!.distanceMm).toBe(0)
    expect(raycast({ x: 0, y: 0 }, 0, 100, [{ kind: "polygon", vertices: [{ x: 0, y: 1 }] }])).toBeNull()
    expect(
      raycast({ x: 0, y: 0 }, 0, 100, [{ kind: "segment", a: { x: 0, y: 10 }, b: { x: 0, y: 20 } }]),
    ).toBeNull()
  })
})

describe("detectRadial / detectCone", () => {
  const items = [mineral("near", 0, 100), mineral("far", 0, 900), mineral("side", 400, 0)]

  it("returns radial hits sorted by distance and honours a filter", () => {
    const hits = detectRadial({ x: 0, y: 0 }, 500, items)
    expect(hits.map((h) => h.entity.id)).toEqual(["near", "side"])
    expect(hits[0].distanceMm).toBeCloseTo(100)
    const filtered = detectRadial({ x: 0, y: 0 }, 2000, items, (e) => e.id !== "far")
    expect(filtered.map((h) => h.entity.id)).toEqual(["near", "side"])
  })

  it("keeps a 40° half-angle cone and reports a signed relative angle", () => {
    const ahead = detectCone({ x: 0, y: 0 }, 0, 20, 200, items)
    expect(ahead.map((h) => h.entity.id)).toEqual(["near"])
    expect(ahead[0].relativeAngleDeg).toBeCloseTo(0)
    const east = detectCone({ x: 0, y: 0 }, 90, 20, 1000, items)
    expect(east.map((h) => h.entity.id)).toEqual(["side"])
    const none = detectCone({ x: 0, y: 0 }, 0, 20, 50, items)
    expect(none).toEqual([])
    const skipped = detectCone({ x: 0, y: 0 }, 0, 90, 2000, items, (e) => e.id === "missing")
    expect(skipped).toEqual([])
  })

  it("subtracts entity radius so a touching sprite is distance 0", () => {
    const hits = detectRadial({ x: 0, y: 0 }, 100, [mineral("touch", 30, 0, 30)])
    expect(hits[0].distanceMm).toBeCloseTo(0)
  })
})
