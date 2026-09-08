import {
  createCamera,
  fitToBounds,
  zoomAt,
  type Camera,
  type Vec2,
  type Viewport,
} from "@/engine"
import {
  CAMERA_PAN_OVERSCAN,
  FIELD_BOUNDS,
  FIT_USER_ZOOM,
  MAX_USER_ZOOM,
  MIN_USER_ZOOM,
} from "./config"

export function fitFieldCamera(viewport: Viewport): Camera {
  return fitToBounds(FIELD_BOUNDS, viewport)
}

export function userScaleToZoom(userScale: number, viewport: Viewport): number {
  return fitFieldCamera(viewport).zoom * clampUserScale(userScale)
}

export function zoomToUserScale(zoom: number, viewport: Viewport): number {
  const fit = fitFieldCamera(viewport).zoom
  return fit > 0 ? clampUserScale(zoom / fit) : FIT_USER_ZOOM
}

export function cameraFromUserScale(userScale: number, centerMm: Vec2, viewport: Viewport): Camera {
  return createCamera(centerMm, userScaleToZoom(userScale, viewport))
}

export function clampUserScale(scale: number): number {
  return Math.max(MIN_USER_ZOOM, Math.min(MAX_USER_ZOOM, scale))
}

/** Viewport may extend `CAMERA_PAN_OVERSCAN` of its size past a field edge. */
export function clampRoverCamera(camera: Camera, viewport: Viewport): Camera {
  const zoom = Math.max(camera.zoom, 1e-9)
  const viewW = viewport.widthPx / zoom
  const viewH = viewport.heightPx / zoom
  const halfW = viewW / 2
  const halfH = viewH / 2
  const marginX = CAMERA_PAN_OVERSCAN * viewW
  const marginY = CAMERA_PAN_OVERSCAN * viewH
  const minCenterX = FIELD_BOUNDS.minX - marginX + halfW
  const maxCenterX = FIELD_BOUNDS.maxX + marginX - halfW
  const minCenterY = FIELD_BOUNDS.minY - marginY + halfH
  const maxCenterY = FIELD_BOUNDS.maxY + marginY - halfH
  return {
    centerMm: {
      x: minCenterX > maxCenterX ? 0 : clamp(camera.centerMm.x, minCenterX, maxCenterX),
      y: minCenterY > maxCenterY ? 0 : clamp(camera.centerMm.y, minCenterY, maxCenterY),
    },
    zoom: camera.zoom,
  }
}

export function zoomRoverAt(
  camera: Camera,
  screenPoint: Vec2,
  factor: number,
  viewport: Viewport,
): Camera {
  const min = userScaleToZoom(MIN_USER_ZOOM, viewport)
  const max = userScaleToZoom(MAX_USER_ZOOM, viewport)
  return clampRoverCamera(zoomAt(camera, screenPoint, factor, viewport, { min, max }), viewport)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
