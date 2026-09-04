/** Shared engine types. Simulation state is always in world millimetres. */

export interface Vec2 {
  x: number
  y: number
}

/** Pose and drivetrain settings. Position is world mm; 0° heading is north. */
export interface RobotState {
  xMm: number
  yMm: number
  headingDeg: number
  driveVelocity: number
  turnVelocity: number
  driveTimeoutMs: number | null
}

export interface Entity {
  id: string
  xMm: number
  yMm: number
  radiusMm?: number
  kind?: string
}

/** Pan/zoom camera. `zoom` is pixels per millimetre. */
export interface Camera {
  centerMm: Vec2
  zoom: number
}

export interface Viewport {
  widthPx: number
  heightPx: number
}

export interface WorldBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface TickContext {
  dtMs: number
  stepMs: number
  gameTimeMs: number
  stepIndex: number
}

export interface SensorHit<T = Entity> {
  entity: T
  distanceMm: number
  relativeAngleDeg: number
}

export type Obstacle =
  | { kind: "circle"; xMm: number; yMm: number; radiusMm: number }
  | { kind: "polygon"; vertices: Vec2[] }
  | { kind: "segment"; a: Vec2; b: Vec2 }
