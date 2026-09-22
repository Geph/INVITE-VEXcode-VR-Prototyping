/** Official VEXcode VR Coral Reef Cleanup field (mm). */
export const FIELD_MM = 2000
export const START_POSE = { xMm: 0, yMm: -800, headingDeg: 0 }
export const BATTERY_SEC = 180
export const TRASH_COUNT = 12

/** Playground scale used by today's Ocean Reef canvas (7.5 mm per pixel). */
export const MM_PER_PIXEL = 7.5
export const PIXELS_PER_MM = 1 / MM_PER_PIXEL

export const CANVAS_NORMAL_PX = 400
export const CANVAS_MAXIMIZED_PX = 600

export const GRID_MM = 100
export const MIN_ZOOM = PIXELS_PER_MM
export const MAX_ZOOM = PIXELS_PER_MM
export const INITIAL_ZOOM = PIXELS_PER_MM

export const OCEAN_REEF_ID = "ocean-reef"
export const OCEAN_REEF_NAME = "Ocean Reef"

export function canvasSizePx(maximized: boolean): { widthPx: number; heightPx: number } {
  const size = maximized ? CANVAS_MAXIMIZED_PX : CANVAS_NORMAL_PX
  return { widthPx: size, heightPx: size }
}
