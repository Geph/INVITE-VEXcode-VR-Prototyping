import { describe, expect, it } from "vitest"
import { createCamera, screenToWorld } from "@/engine"
import {
  clampRoverCamera,
  clampUserScale,
  fitFieldCamera,
  panRoverCamera,
  userScaleToZoom,
  zoomRoverAt,
  zoomToUserScale,
} from "@/playgrounds/rover-rescue/camera"
import {
  FIELD_BOUNDS,
  FIT_USER_ZOOM,
  MAX_USER_ZOOM,
  MIN_USER_ZOOM,
} from "@/playgrounds/rover-rescue/config"

const view = { widthPx: 800, heightPx: 400 }

describe("rover camera pan", () => {
  it("keeps the dragged point under the cursor", () => {
    const cam = createCamera({ x: 0, y: 0 }, userScaleToZoom(2, view))
    const grab = { x: 500, y: 120 }
    const worldGrabbed = screenToWorld(grab, cam, view)
    const delta = { x: -160, y: 90 }
    const panned = panRoverCamera(cam, delta, view)
    const under = screenToWorld({ x: grab.x + delta.x, y: grab.y + delta.y }, panned, view)
    expect(under.x).toBeCloseTo(worldGrabbed.x, 6)
    expect(under.y).toBeCloseTo(worldGrabbed.y, 6)
  })

  it("moves the centre opposite the drag, scaled by zoom", () => {
    const zoom = userScaleToZoom(2, view)
    const cam = createCamera({ x: 0, y: 0 }, zoom)
    const panned = panRoverCamera(cam, { x: 100, y: 50 }, view)
    expect(panned.centerMm.x).toBeCloseTo(-100 / zoom, 6)
    expect(panned.centerMm.y).toBeCloseTo(50 / zoom, 6)
  })

  it("locks the centre at fit so a drag cannot slide the field off the canvas", () => {
    const cam = fitFieldCamera(view)
    const panned = panRoverCamera(cam, { x: -100000, y: 40000 }, view)
    expect(panned.centerMm).toEqual({ x: 0, y: 0 })
    expect(panned.zoom).toBe(cam.zoom)
  })

  it("stops a zoomed-in pan at the field edge, with no void past the map", () => {
    const zoom = userScaleToZoom(2, view)
    const halfW = view.widthPx / zoom / 2
    const halfH = view.heightPx / zoom / 2
    const tooFar = clampRoverCamera(createCamera({ x: -20000, y: -20000 }, zoom), view)
    expect(tooFar.centerMm.x).toBeCloseTo(FIELD_BOUNDS.minX + halfW, 6)
    expect(tooFar.centerMm.y).toBeCloseTo(FIELD_BOUNDS.minY + halfH, 6)
    const east = clampRoverCamera(createCamera({ x: 20000, y: 20000 }, zoom), view)
    expect(east.centerMm.x).toBeCloseTo(FIELD_BOUNDS.maxX - halfW, 6)
    expect(east.centerMm.y).toBeCloseTo(FIELD_BOUNDS.maxY - halfH, 6)
  })

  it("stops zooming out at fit so the field always fills the canvas", () => {
    expect(MIN_USER_ZOOM).toBe(FIT_USER_ZOOM)
    expect(clampUserScale(0.25)).toBe(FIT_USER_ZOOM)
    const fit = fitFieldCamera(view)
    const out = zoomRoverAt(fit, { x: view.widthPx / 2, y: view.heightPx / 2 }, 0.5, view)
    expect(out.zoom).toBeCloseTo(fit.zoom, 9)
    expect(zoomToUserScale(out.zoom, view)).toBeCloseTo(FIT_USER_ZOOM, 9)
  })

  it("still zooms in up to the maximum", () => {
    const fit = fitFieldCamera(view)
    const origin = { x: view.widthPx / 2, y: view.heightPx / 2 }
    let cam = fit
    for (let i = 0; i < 20; i++) cam = zoomRoverAt(cam, origin, 1.25, view)
    expect(zoomToUserScale(cam.zoom, view)).toBeCloseTo(MAX_USER_ZOOM, 9)
    expect(cam.zoom).toBeGreaterThan(fit.zoom)
  })

  it("leaves the camera alone for a zero drag", () => {
    const cam = createCamera({ x: 1200, y: -400 }, userScaleToZoom(1.5, view))
    expect(panRoverCamera(cam, { x: 0, y: 0 }, view)).toEqual(cam)
  })
})
