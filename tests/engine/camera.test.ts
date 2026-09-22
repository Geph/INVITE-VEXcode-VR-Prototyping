import { describe, expect, it } from "vitest"
import {
  clampToBounds,
  createCamera,
  fitToBounds,
  screenToWorld,
  visibleWorldRect,
  worldToScreen,
  zoomAt,
} from "@/engine/camera"

const view = { widthPx: 400, heightPx: 200 }
const field = { minX: -6000, maxX: 6000, minY: -3000, maxY: 3000 }

describe("camera", () => {
  it("round-trips world and screen about the centre", () => {
    const cam = createCamera({ x: 0, y: 0 }, 0.1)
    const screen = worldToScreen({ x: 0, y: 0 }, cam, view)
    expect(screen).toEqual({ x: 200, y: 100 })
    expect(screenToWorld(screen, cam, view)).toEqual({ x: 0, y: 0 })
  })

  it("inverts Y: world north is screen-up", () => {
    const cam = createCamera({ x: 0, y: 0 }, 1)
    const north = worldToScreen({ x: 0, y: 50 }, cam, view)
    const east = worldToScreen({ x: 50, y: 0 }, cam, view)
    expect(north.y).toBeLessThan(100)
    expect(east.x).toBeGreaterThan(200)
  })

  it("reports the visible world rect for culling", () => {
    const cam = createCamera({ x: 0, y: 0 }, 0.5)
    const rect = visibleWorldRect(cam, view)
    expect(rect.minX).toBeCloseTo(-400)
    expect(rect.maxX).toBeCloseTo(400)
    expect(rect.minY).toBeCloseTo(-200)
    expect(rect.maxY).toBeCloseTo(200)
  })

  it("clamps the centre so the view stays inside bounds", () => {
    const loose = clampToBounds(createCamera({ x: 8000, y: 0 }, 0.05), field, view)
    expect(loose.centerMm.x).toBeLessThan(6000)
    const tiny = { minX: -10, maxX: 10, minY: -10, maxY: 10 }
    const fitted = clampToBounds(createCamera({ x: 0, y: 0 }, 0.01), tiny, view)
    expect(fitted.centerMm).toEqual({ x: 0, y: 0 })
  })

  it("fits a rectangle and zooms about a screen point", () => {
    const fitted = fitToBounds(field, view)
    expect(fitted.centerMm).toEqual({ x: 0, y: 0 })
    expect(fitted.zoom).toBeCloseTo(200 / 6000)
    const cam = createCamera({ x: 0, y: 0 }, 1)
    const under = { x: 300, y: 50 }
    const worldBefore = screenToWorld(under, cam, view)
    const zoomed = zoomAt(cam, under, 2, view, { min: 0.5, max: 4 })
    expect(zoomed.zoom).toBe(2)
    expect(screenToWorld(under, zoomed, view).x).toBeCloseTo(worldBefore.x)
    expect(screenToWorld(under, zoomed, view).y).toBeCloseTo(worldBefore.y)
    expect(zoomAt(cam, under, 0, view).zoom).toBe(1)
  })

  it("treats zoom 0 as 1 when converting screen to world", () => {
    const cam = createCamera({ x: 10, y: 20 }, 0)
    expect(screenToWorld({ x: 200, y: 100 }, cam, view)).toEqual({ x: 10, y: 20 })
  })
})
