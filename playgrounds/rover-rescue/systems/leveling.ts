/**
 * XP and levels. The thresholds and awards are published; the strength each
 * level grants is not, so it comes from the config tables.
 */

import {
  ABSORB_PCT_BY_LEVEL,
  CAPACITY_BY_LEVEL,
  LEVEL_XP_THRESHOLDS,
  ROVER_LEVEL_MAX,
  ROVER_LEVEL_MIN,
} from "../config"

export function levelFromXp(xp: number): number {
  const earned = Math.max(0, xp)
  let level = ROVER_LEVEL_MIN
  for (let candidate = ROVER_LEVEL_MIN; candidate <= ROVER_LEVEL_MAX; candidate++) {
    if (earned >= LEVEL_XP_THRESHOLDS[candidate]) level = candidate
  }
  return level
}

/** Cumulative XP the next level needs, or null at the cap. */
export function xpForNextLevel(level: number): number | null {
  const next = level + 1
  if (next > ROVER_LEVEL_MAX) return null
  return LEVEL_XP_THRESHOLDS[next]
}

/**
 * The playground shows XP as progress through the current level, not lifetime
 * XP, so `exp` is what the XP block and the level bar both report.
 */
export function expWithinLevel(xp: number): { exp: number; needed: number | null } {
  const level = levelFromXp(xp)
  const floor = LEVEL_XP_THRESHOLDS[level]
  const ceiling = xpForNextLevel(level)
  return {
    exp: Math.max(0, xp) - floor,
    needed: ceiling === null ? null : ceiling - floor,
  }
}

export function absorbPctForLevel(level: number): number {
  return ABSORB_PCT_BY_LEVEL[clampLevel(level)]
}

export function capacityForLevel(level: number): number {
  return CAPACITY_BY_LEVEL[clampLevel(level)]
}

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return ROVER_LEVEL_MIN
  return Math.max(ROVER_LEVEL_MIN, Math.min(ROVER_LEVEL_MAX, Math.floor(level)))
}
