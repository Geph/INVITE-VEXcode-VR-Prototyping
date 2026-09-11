import { describe, expect, it } from "vitest"
import type { Vec2 } from "@/engine"
import { SpatialHash } from "@/engine"
import { sampleRiverCurve } from "@/playgrounds/rover-rescue/river-curve"
import { riverBankPolygon } from "@/playgrounds/rover-rescue/art/river"
import { BRIDGES, RIVER_CENTERLINE, RIVER_HAZARD, pointInRiverHazard, pointOnBridge } from "@/playgrounds/rover-rescue/map-spec"
import { resolveRoverMove } from "@/playgrounds/rover-rescue/systems/physics"
import type { RoverEntity } from "@/playgrounds/rover-rescue/entities"

function cross(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

describe("smooth river geometry", () => {
  it("keeps editable survey handles and endpoints while resolving coarse bends", () => {
    const before = structuredClone(RIVER_CENTERLINE)
    const curve = sampleRiverCurve(RIVER_CENTERLINE)
    expect(RIVER_CENTERLINE).toEqual(before)
    expect(curve[0]).toEqual(before[0])
    expect(curve.at(-1)).toEqual(before.at(-1))
    for (const handle of before) expect(curve).toContainEqual(handle)
    expect(curve.length).toBeGreaterThan(before.length * 8)
    expect(curve.length).toBeLessThan(400)
    for (let i = 1; i < curve.length; i++) {
      expect(Math.hypot(curve[i].x - curve[i - 1].x, curve[i].y - curve[i - 1].y)).toBeLessThan(120)
    }
  })

  it("uses the identical smooth bank polygon for artwork and hazard detection", () => {
    expect(riverBankPolygon()).toEqual(RIVER_HAZARD.outer)
    const curve = sampleRiverCurve(RIVER_CENTERLINE)
    for (const point of curve.slice(1, -1)) {
      if (!pointOnBridge(point)) expect(pointInRiverHazard(point)).toBe(true)
    }
    const bank = RIVER_HAZARD.outer
    for (let i = 0; i < bank.length; i++) {
      const a = bank[i], b = bank[(i + 1) % bank.length]
      for (let j = i + 2; j < bank.length; j++) {
        if (i === 0 && j === bank.length - 1) continue
        const c = bank[j], d = bank[(j + 1) % bank.length]
        const intersects = cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0
        expect(intersects).toBe(false)
      }
    }
  })

  it("carries the full river width through the left and bottom map edges", () => {
    for (const y of [1110, 1410, 1710]) {
      expect(pointInRiverHazard({ x: -6000, y })).toBe(true)
      expect(pointInRiverHazard({ x: -6001, y })).toBe(true)
    }
    for (const x of [1600, 2200, 2800]) {
      expect(pointInRiverHazard({ x, y: -3000 })).toBe(true)
      expect(pointInRiverHazard({ x, y: -3001 })).toBe(true)
    }
  })

  it("keeps a safe crossing along the full length of both bridge decks", () => {
    const index = new SpatialHash<RoverEntity>(500)
    for (const bridge of BRIDGES) {
      const half = bridge.lengthMm / 2 - 2
      const dx = bridge.orientation === "EW" ? half : 0
      const dy = bridge.orientation === "NS" ? half : 0
      const from = { x: bridge.centreMm.x - dx, y: bridge.centreMm.y - dy }
      const to = { x: bridge.centreMm.x + dx, y: bridge.centreMm.y + dy }
      const move = resolveRoverMove(from, to, index, RIVER_HAZARD)
      expect(move.inRiver).toBe(false)
      expect(move.blocked).toBe(false)
      expect(move.xMm).toBe(to.x)
      expect(move.yMm).toBe(to.y)
    }
  })

  it("handles empty, straight and repeated survey points without invalid coordinates", () => {
    expect(sampleRiverCurve([])).toEqual([])
    const straight = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
    expect(sampleRiverCurve(straight)).toEqual(straight)
    const repeated = sampleRiverCurve([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 100 }])
    expect(repeated.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
  })
})
