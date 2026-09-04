export type {
  Camera,
  Entity,
  Obstacle,
  RobotState,
  SensorHit,
  TickContext,
  Vec2,
  Viewport,
  WorldBounds,
} from "./types"

export {
  distanceToMm,
  inchesToMm,
  mmToDistance,
  mmToInches,
  mmToPixels,
  MM_PER_INCH,
  normalizeDegrees,
  pixelsToMm,
  shortestRotationDelta,
  angleBetween,
} from "./units"

export { createRng, type SeededRng } from "./rng"

export { SimulationClock, STEP_MS } from "./clock"

export {
  clampToBounds,
  createCamera,
  fitToBounds,
  screenToWorld,
  visibleWorldRect,
  worldToScreen,
  zoomAt,
  type WorldRect,
} from "./camera"

export {
  SpatialHash,
  circleHitsPolygon,
  distanceToPolyline,
  pointInPolygon,
  polygonsOverlap,
  segmentIntersectsPolygon,
  segmentsIntersect,
} from "./collision"

export { detectCone, detectRadial, raycast, type RaycastHit } from "./sensors"

export {
  DRIVE_MS_PER_MM_AT_50,
  TURN_MS_PER_DEGREE_AT_50,
  driveDurationMs,
  driveSpeedMmPerMs,
  driveStep,
  turnDurationMs,
  turnSpeedDegPerMs,
  turnStep,
} from "./motion"

export {
  EventHatRegistry,
  ProgramStopped,
  compileProgram,
  runProgram,
  type EventHat,
  type HatEdge,
} from "./interpreter"
