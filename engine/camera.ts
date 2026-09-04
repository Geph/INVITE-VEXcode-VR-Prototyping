import type { Camera, Vec2, Viewport, WorldBounds } from "./types"

export interface WorldRect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const DEFAULT_VIEW: Viewport = { widthPx: 400, heightPx: 400 }

export function createCamera(centerMm: Vec2, zoom: number): Camera {
  return { centerMm: { x: centerMm.x, y: centerMm.y }, zoom }
}

/**
 * World mm → screen pixels. World +Y is north; screen +Y is down.
 * `zoom` is pixels per millimetre.
 */
export function worldToScreen(world: Vec2, camera: Camera, viewport: Viewport = DEFAULT_VIEW): Vec2 {
  const zoom = camera.zoom
  return {
    x: viewport.widthPx / 2 + (world.x - camera.centerMm.x) * zoom,
    y: viewport.heightPx / 2 - (world.y - camera.centerMm.y) * zoom,
  }
}

export function screenToWorld(screen: Vec2, camera: Camera, viewport: Viewport = DEFAULT_VIEW): Vec2 {
  const zoom = camera.zoom === 0 ? 1 : camera.zoom
  return {
    x: camera.centerMm.x + (screen.x - viewport.widthPx / 2) / zoom,
    y: camera.centerMm.y - (screen.y - viewport.heightPx / 2) / zoom,
  }
}

/** World-mm rectangle currently visible in the viewport (for culling). */
export function visibleWorldRect(camera: Camera, viewport: Viewport = DEFAULT_VIEW): WorldRect {
  const tl = screenToWorld({ x: 0, y: 0 }, camera, viewport)
  const br = screenToWorld({ x: viewport.widthPx, y: viewport.heightPx }, camera, viewport)
  return {
    minX: Math.min(tl.x, br.x),
    maxX: Math.max(tl.x, br.x),
    minY: Math.min(tl.y, br.y),
    maxY: Math.max(tl.y, br.y),
  }
}

/** Keep as much of the view as possible inside `bounds`. */
export function clampToBounds(camera: Camera, bounds: WorldBounds, viewport: Viewport = DEFAULT_VIEW): Camera {
  const halfW = viewport.widthPx / (2 * Math.max(camera.zoom, 1e-9))
  const halfH = viewport.heightPx / (2 * Math.max(camera.zoom, 1e-9))
  const minCenterX = bounds.minX + halfW
  const maxCenterX = bounds.maxX - halfW
  const minCenterY = bounds.minY + halfH
  const maxCenterY = bounds.maxY - halfH
  return {
    centerMm: {
      x: minCenterX > maxCenterX ? (bounds.minX + bounds.maxX) / 2 : clamp(camera.centerMm.x, minCenterX, maxCenterX),
      y: minCenterY > maxCenterY ? (bounds.minY + bounds.maxY) / 2 : clamp(camera.centerMm.y, minCenterY, maxCenterY),
    },
    zoom: camera.zoom,
  }
}

/** Center on `bounds` and zoom so the whole rectangle fits. */
export function fitToBounds(
  bounds: WorldBounds,
  viewport: Viewport = DEFAULT_VIEW,
  paddingMm = 0,
): Camera {
  const width = Math.max(1, bounds.maxX - bounds.minX + paddingMm * 2)
  const height = Math.max(1, bounds.maxY - bounds.minY + paddingMm * 2)
  const zoom = Math.min(viewport.widthPx / width, viewport.heightPx / height)
  return {
    centerMm: {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    },
    zoom,
  }
}

/** Zoom about a screen point so that world position under the cursor stays put. */
export function zoomAt(
  camera: Camera,
  screenPoint: Vec2,
  factor: number,
  viewport: Viewport = DEFAULT_VIEW,
  zoomRange?: { min: number; max: number },
): Camera {
  const world = screenToWorld(screenPoint, camera, viewport)
  let zoom = camera.zoom * (Number.isFinite(factor) && factor > 0 ? factor : 1)
  if (zoomRange) zoom = clamp(zoom, zoomRange.min, zoomRange.max)
  const next = { centerMm: { ...camera.centerMm }, zoom }
  const after = screenToWorld(screenPoint, next, viewport)
  next.centerMm.x += world.x - after.x
  next.centerMm.y += world.y - after.y
  return next
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
