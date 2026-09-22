/**
 * Battery drain. Power leaks with in-game time and faster while the rover is
 * driving, so standing still is the cheap way to spend a day and crossing the
 * map is the expensive one.
 */

import {
  BATTERY_DRAIN_DRIVING_PCT_PER_DAY,
  BATTERY_DRAIN_IDLE_PCT_PER_DAY,
  BATTERY_START_PCT,
  DAY_MS,
} from "../config"

/** Percent per in-game day at the rover's current activity. */
export function drainRatePctPerDay(moving: boolean): number {
  return BATTERY_DRAIN_IDLE_PCT_PER_DAY + (moving ? BATTERY_DRAIN_DRIVING_PCT_PER_DAY : 0)
}

/** Battery after `dtMs` of mission time. Never below 0 or above full. */
export function drainBattery(batteryPercent: number, dtMs: number, moving: boolean): number {
  const days = Math.max(0, dtMs) / DAY_MS
  const next = batteryPercent - drainRatePctPerDay(moving) * days
  return clampBattery(next)
}

export function clampBattery(batteryPercent: number): number {
  if (!Number.isFinite(batteryPercent)) return 0
  return Math.max(0, Math.min(BATTERY_START_PCT, batteryPercent))
}

export function batteryEmpty(batteryPercent: number): boolean {
  return batteryPercent <= 0
}
