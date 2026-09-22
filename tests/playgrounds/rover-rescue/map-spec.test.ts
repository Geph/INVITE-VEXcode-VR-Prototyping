import { describe, expect, it } from "vitest"
import { pointInPolygon } from "@/engine"
import {
  BASE_PAD_CENTRE_MM,
  canvasSizePx,
  FIELD_HEIGHT_MM,
  FIELD_WIDTH_MM,
  GRID_MM,
  START_POSE,
} from "@/playgrounds/rover-rescue/config"
import {
  BASE,
  BRIDGES,
  RIVER_CENTERLINE,
  RIVER_HAZARD,
  RIVER_WIDTH_MM,
  ZONES,
  pointInRiverHazard,
} from "@/playgrounds/rover-rescue/map-spec"

describe("rover-rescue map spec", () => {
  it("uses the spec field, grid, and base start pose", () => {
    expect(FIELD_WIDTH_MM).toBe(12000)
    expect(FIELD_HEIGHT_MM).toBe(6000)
    expect(GRID_MM).toBe(500)
    expect(START_POSE).toEqual({
      xMm: BASE_PAD_CENTRE_MM.x,
      yMm: BASE_PAD_CENTRE_MM.y,
      headingDeg: 0,
    })
    expect(BASE.centreMm).toEqual(BASE_PAD_CENTRE_MM)
    expect(canvasSizePx(false)).toEqual({ widthPx: 800, heightPx: 400 })
    expect(canvasSizePx(true)).toEqual({ widthPx: 1200, heightPx: 600 })
  })

  it("keeps the traced zone, river, and bridge vertices", () => {
    expect(ZONES.map((zone) => zone.id)).toEqual(["B_WEST", "B_EAST", "A", "C", "D", "E"])
    expect(RIVER_CENTERLINE[0]).toEqual({ x: -6000, y: 1410 })
    expect(RIVER_CENTERLINE[RIVER_CENTERLINE.length - 1]).toEqual({ x: 2200, y: -3000 })
    expect(RIVER_WIDTH_MM).toBe(800)
    expect(BRIDGES.map((bridge) => bridge.id)).toEqual(["north", "south"])
  })

  it("offsets the river and punches bridge decks out of the hazard", () => {
    expect(RIVER_HAZARD.outer.length).toBeGreaterThan(4)
    expect(RIVER_HAZARD.holes).toHaveLength(2)
    const midRiver = { x: -1420, y: 1090 }
    expect(pointInRiverHazard(midRiver)).toBe(true)
    for (const bridge of BRIDGES) {
      expect(pointInPolygon(bridge.centreMm, RIVER_HAZARD.outer)).toBe(true)
      expect(pointInRiverHazard(bridge.centreMm)).toBe(false)
    }
  })
})
