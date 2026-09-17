/**
 * Every Rover Rescue constant that lives in ROVER-RESCUE-SPEC.md.
 * Do not invent gameplay numbers here — later phases import these.
 */

import type { WorldBounds } from "@/engine"

export const ROVER_RESCUE_ID = "rover-rescue"
export const ROVER_RESCUE_NAME = "Rover Rescue"

export const FIELD_WIDTH_MM = 12000
export const FIELD_HEIGHT_MM = 6000
export const FIELD_MIN_X_MM = -6000
export const FIELD_MAX_X_MM = 6000
export const FIELD_MIN_Y_MM = -3000
export const FIELD_MAX_Y_MM = 3000
export const GRID_MM = 500

export const FIELD_BOUNDS: WorldBounds = {
  minX: FIELD_MIN_X_MM,
  maxX: FIELD_MAX_X_MM,
  minY: FIELD_MIN_Y_MM,
  maxY: FIELD_MAX_Y_MM,
}

/** Nominal SW corner of the field. */
export const BASE_NOMINAL_MM = { x: -6000, y: -3000 }

export const BASE_PAD_RADIUS_MM = 250

/**
 * The spec draws the pad tangent to the SW corner, which clips the disc and
 * its "BASE" label at the field edge. One pad radius of inset keeps both clear.
 */
export const BASE_PAD_CENTRE_MM = {
  x: FIELD_MIN_X_MM + BASE_PAD_RADIUS_MM * 2,
  y: FIELD_MIN_Y_MM + BASE_PAD_RADIUS_MM * 2,
}

export const ROVER_LENGTH_MM = 191
export const ROVER_WIDTH_MM = 147

/** Rover starts on the Base pad, heading 0° = north. */
export const START_POSE = {
  xMm: BASE_PAD_CENTRE_MM.x,
  yMm: BASE_PAD_CENTRE_MM.y,
  headingDeg: 0,
}

/**
 * User-facing zoom is a scale relative to fit-to-window (1x = the whole
 * field visible). Engine `camera.zoom` is still pixels per millimetre:
 * `pxPerMm = fitZoom * userScale`.
 *
 * `initialZoom: 0` is the fit-to-window sentinel — the host computes the
 * actual px/mm from the canvas size at mount.
 */
export const FIT_USER_ZOOM = 1
/** Fit is the floor: zooming out past it would only reveal void off-field. */
export const MIN_USER_ZOOM = FIT_USER_ZOOM
export const MAX_USER_ZOOM = 3
export const FIT_ZOOM_SENTINEL = 0
export const FOLLOW_ROVER = true

/** Skip stipple / plank / highlight passes below this user scale. */
export const DETAIL_LOD_USER_ZOOM = 0.5

/** Pan may show at most this fraction of the viewport past a field edge. */
export const CAMERA_PAN_OVERSCAN = 0.1

export const CAMERA = {
  minZoom: MIN_USER_ZOOM,
  maxZoom: MAX_USER_ZOOM,
  initialZoom: FIT_ZOOM_SENTINEL,
  follow: FOLLOW_ROVER,
} as const

/** Short canvas side matches Ocean Reef; width follows the 2:1 field. */
export const CANVAS_SHORT_PX = 400
export const CANVAS_SHORT_MAXIMIZED_PX = 600

export function canvasSizePx(maximized: boolean): { widthPx: number; heightPx: number } {
  const short = maximized ? CANVAS_SHORT_MAXIMIZED_PX : CANVAS_SHORT_PX
  const aspect = FIELD_WIDTH_MM / FIELD_HEIGHT_MM
  return { widthPx: Math.round(short * aspect), heightPx: short }
}

/**
 * Keep these counts inside the Phase 5 bands: 120–180 / 40–60 / 35–50.
 * TUNABLE: 150 rocks and plants left a median straight run under 1000 mm, so a
 * drive-for of a few thousand millimetres almost always stopped early.
 */
export const OBSTACLE_COUNT = 120
export const MINERAL_COUNT = 50
export const ENEMY_COUNT = 42

export const MINERALS_PER_ZONE = { A: 10, B: 12, C: 10, D: 10, E: 8 } as const

/** Spec: C slow, D medium, E fast. A/B never respawn. */
export const MINERAL_RESPAWN_MS = { C: 20000, D: 12000, E: 6000 } as const

export const ENEMY_SPAWN_TABLE = {
  A: { spiders: 8, serpents: 0, serpentColor: null },
  B: { spiders: 10, serpents: 0, serpentColor: null },
  C: { spiders: 6, serpents: 4, serpentColor: "orange" },
  D: { spiders: 5, serpents: 4, serpentColor: "blue" },
  E: { spiders: 3, serpents: 2, serpentColor: "purple" },
} as const

/** Spec: level = clamp(1 + floor(distanceFromBaseMm / 2400), 1, 5). */
export const ENEMY_LEVEL_DISTANCE_MM = 2400
export const ENEMY_LEVEL_MIN = 1
export const ENEMY_LEVEL_MAX = 5

/** Unpublished HP / radiation curve — tune in playtest. Index = level. */
export const ENEMY_HP_BY_LEVEL = [0, 20, 35, 50, 65, 80] as const
export const ENEMY_RADIATION_BY_LEVEL = [0, 10, 18, 26, 34, 42] as const
export const SERPENT_HP_BONUS = 10

export const ENEMY_WANDER_RADIUS_MM = 380
export const ENEMY_WANDER_PERIOD_MS = 9000

export const ROCK_RADIUS_MIN_MM = 45
export const ROCK_RADIUS_MAX_MM = 85
export const PLANT_RADIUS_MIN_MM = 28
export const PLANT_RADIUS_MAX_MM = 55
export const MINERAL_RADIUS_MM = 28
export const SPIDER_RADIUS_MM = 36
export const SERPENT_RADIUS_MM = 58

export const OBSTACLE_SPACING_MM = 260
export const OBSTACLE_SPACING_ROCKY_MM = 170
/**
 * TUNABLE: the yard around the start pose stays empty. At 420 mm a rock could
 * sit one rover-length from the Base and stop the first drive after ~350 mm.
 */
export const START_CLEARANCE_MM = 1200
/** TUNABLE: keep enemies out of the starting yard by the Base. */
export const ENEMY_BASE_CLEARANCE_MM = 2000
/**
 * TUNABLE: driving forward sweeps a corridor as wide as the rover (147 mm), so
 * half the width is the honest collision radius. Half the length inflated every
 * obstacle by 30% and stopped straight drives within a few hundred millimetres.
 */
export const ROVER_HIT_RADIUS_MM = ROVER_WIDTH_MM / 2
export const MOVE_STEP_MM = 24

/**
 * Minerals are cargo, not terrain: the rover shoves them aside instead of
 * stopping. A pushed sample is placed this far past the rover's hull so it
 * leaves the corridor rather than jittering against it for the whole drive.
 * TUNABLE.
 */
export const MINERAL_PUSH_MARGIN_MM = 6

/**
 * DOC: the mission runs 50 in-game days. Day length in real milliseconds is
 * not published, so this is TUNABLE: at 5 s a day, crossing the 12 m field at
 * the default 50% velocity costs roughly 24 days, which makes the 50-day
 * mission about two field crossings of driving.
 */
export const MISSION_DAYS = 50
export const DAY_MS = 5000

/** Spec § Sensing. Detect is a radar; sight is a forward cone. */
export const AI_DETECT_RANGE_MM = 800
export const AI_SIGHT_RANGE_MM = 1000
export const AI_SIGHT_HALF_ANGLE_DEG = 20
export const ROVER_DISTANCE_SENSOR_MAX_MM = 2000
/** Official API when no obstacle/hazard is in the sight cone. */
export const AI_MISSING_SIGHT_MM = 1000
