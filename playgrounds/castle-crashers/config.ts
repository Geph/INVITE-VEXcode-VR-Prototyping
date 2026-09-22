/**
 * Castle Crasher+ field constants from VEX documentation.
 * DOC values must match https://api.vex.com/vr/home/playgrounds/castle_crasher_plus.html
 */

/** DOC: hexagonal map diameter. */
export const FIELD_DIAMETER_MM = 3288
/** DOC: center-to-vertex radius (half the diameter). */
export const HEX_RADIUS_MM = FIELD_DIAMETER_MM / 2
/** Camera bounds include water outside the red edge; physical diameter stays unchanged. */
export const FIELD_WIDTH_MM = FIELD_DIAMETER_MM + 240
export const FIELD_HEIGHT_MM = FIELD_DIAMETER_MM + 240

/** DOC: Standard VR Robot start pose (mm). Heading faces −X toward the keep. */
export const START_POSE = { xMm: 1014, yMm: 50, headingDeg: -90 }

export const GRID_MM = 100
export const MIN_ZOOM = 0.08
export const MAX_ZOOM = 0.35
export const INITIAL_ZOOM = 0.14

/** TUNABLE: robot body radius used for pushes and water checks. */
export const ROBOT_RADIUS_MM = 75
/** TUNABLE: pickup and blade dimensions traced from the top-down reference. */
export const PLOW_START = { xMm: 145, yMm: 1120 }
export const PLOW_HALF_WIDTH_MM = 115
export const PLOW_FRONT_MM = 105
/** TUNABLE: how far past the hex edge counts as "in the water". */
export const WATER_MARGIN_MM = 20

/** TUNABLE: debris slide, tumble and splash, estimated from the research video. */
export const DEBRIS_DRAG_PER_SEC = 2.8
export const DEBRIS_IMPULSE = 1.35
export const DEBRIS_MAX_SPEED_MM_SEC = 1200
export const SPLASH_DURATION_MS = 900
export const RESULTS_DELAY_MS = 1000
export const TOPPLE_DISTANCE_MM = 110
export const CONTACT_PASSES = 3
/** TUNABLE kg per component; the video establishes whole-kg scoring, not individual masses. */
export const PIECE_WEIGHT_KG = {
  wall: 100, turret: 200, "castle-wall": 150, tower: 100,
  keep: 1500, roof: 150, ramp: 100, rock: 0, tree: 0,
} as const

export const CASTLE_CRASHERS_ID = "castle-crashers"
export const CASTLE_CRASHERS_NAME = "Castle Crasher+"

/** Telemetry playground label VEX uses inside nested playgroundData (misspelled). */
export const CASTLE_TELEMETRY_NAME = "CasteCrasherPlus"

export type CastleLevel = 1 | 2
