/**
 * The mission clock. Time only counts while the rover is out there, so the
 * day count is a measure of the learner's program rather than of how long the
 * playground window happened to be open.
 */

import { DAY_MS, MISSION_DAYS } from "./config"

/** In-game days for a mission duration, as a fraction. */
export function daysFromMs(missionMs: number): number {
  return Math.max(0, missionMs) / DAY_MS
}

export function msFromDays(days: number): number {
  return Math.max(0, days) * DAY_MS
}

/** The playground shows one decimal, so the readout ticks about twice a day. */
export function formatDays(days: number): string {
  return (Math.floor(Math.max(0, days) * 10) / 10).toFixed(1)
}

/** A mission that has run its full 50 days is a win, not a loss. */
export function missionComplete(missionMs: number): boolean {
  return daysFromMs(missionMs) >= MISSION_DAYS
}
