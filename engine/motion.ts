import type { RobotState } from "./types"
import { normalizeDegrees } from "./units"

/** Drive animation timing at 50% velocity (VEX default). */
export const DRIVE_MS_PER_MM_AT_50 = 10
/** Turn animation timing at 50% turn velocity — independent from drive. */
export const TURN_MS_PER_DEGREE_AT_50 = 22

function clampVelocity(percent: number): number {
  return Math.max(5, Math.min(100, percent))
}

/** Duration to drive `distanceMm` at the given velocity %. Floor 80 ms. */
export function driveDurationMs(distanceMm: number, driveVelocityPercent: number): number {
  const v = clampVelocity(driveVelocityPercent)
  return Math.max(80, (distanceMm * DRIVE_MS_PER_MM_AT_50 * 50) / v)
}

/** Duration to turn `degrees` at the given velocity %. Floor 80 ms. */
export function turnDurationMs(degrees: number, turnVelocityPercent: number): number {
  const v = clampVelocity(turnVelocityPercent)
  return Math.max(80, (Math.abs(degrees) * TURN_MS_PER_DEGREE_AT_50 * 50) / v)
}

/** Millimetres travelled in `dtMs` at `velocityPercent` (50% → 100 mm/s). */
export function driveSpeedMmPerMs(velocityPercent: number): number {
  const v = clampVelocity(velocityPercent)
  return (v / 50) / DRIVE_MS_PER_MM_AT_50
}

/** Degrees turned in one millisecond at `velocityPercent`. */
export function turnSpeedDegPerMs(velocityPercent: number): number {
  const v = clampVelocity(velocityPercent)
  return (v / 50) / TURN_MS_PER_DEGREE_AT_50
}

/**
 * Advance pose along heading. 0° is north, clockwise, +Y north.
 * `direction` anything other than `"forward"` is reverse.
 */
export function driveStep(
  pose: Pick<RobotState, "xMm" | "yMm" | "headingDeg">,
  dtMs: number,
  velocityPercent: number,
  direction: string = "forward",
): Pick<RobotState, "xMm" | "yMm" | "headingDeg"> {
  const sign = direction === "forward" ? 1 : -1
  const dist = driveSpeedMmPerMs(velocityPercent) * Math.max(0, dtMs) * sign
  const rad = (pose.headingDeg * Math.PI) / 180
  return {
    xMm: pose.xMm + dist * Math.sin(rad),
    yMm: pose.yMm + dist * Math.cos(rad),
    headingDeg: pose.headingDeg,
  }
}

/** Rotate in place. Positive `direction` `"right"` is clockwise. */
export function turnStep(
  pose: Pick<RobotState, "xMm" | "yMm" | "headingDeg">,
  dtMs: number,
  velocityPercent: number,
  direction: "left" | "right" = "right",
): Pick<RobotState, "xMm" | "yMm" | "headingDeg"> {
  const sign = direction === "right" ? 1 : -1
  const delta = turnSpeedDegPerMs(velocityPercent) * Math.max(0, dtMs) * sign
  return {
    xMm: pose.xMm,
    yMm: pose.yMm,
    headingDeg: normalizeDegrees(pose.headingDeg + delta),
  }
}
