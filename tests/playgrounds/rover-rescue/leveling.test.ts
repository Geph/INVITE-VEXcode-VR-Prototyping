import { describe, expect, it } from "vitest"
import {
  ABSORB_PCT_BY_LEVEL,
  CAPACITY_BY_LEVEL,
  LEVEL_XP_THRESHOLDS,
  ROVER_LEVEL_MAX,
} from "@/playgrounds/rover-rescue/config"
import {
  absorbPctForLevel,
  capacityForLevel,
  expWithinLevel,
  levelFromXp,
  xpForNextLevel,
} from "@/playgrounds/rover-rescue/systems/leveling"

describe("levelFromXp", () => {
  it("puts every documented threshold on the level it earns", () => {
    expect(levelFromXp(0)).toBe(1)
    expect(levelFromXp(9)).toBe(1)
    expect(levelFromXp(10)).toBe(2)
    expect(levelFromXp(29)).toBe(2)
    expect(levelFromXp(30)).toBe(3)
    expect(levelFromXp(69)).toBe(3)
    expect(levelFromXp(70)).toBe(4)
    expect(levelFromXp(124)).toBe(4)
    expect(levelFromXp(125)).toBe(5)
  })

  it("caps at level 5 however much XP is earned", () => {
    expect(levelFromXp(10_000)).toBe(ROVER_LEVEL_MAX)
    expect(xpForNextLevel(ROVER_LEVEL_MAX)).toBeNull()
  })

  it("never drops below level 1, even on nonsense input", () => {
    expect(levelFromXp(-50)).toBe(1)
    expect(levelFromXp(0)).toBe(1)
  })

  it("reads each threshold straight off the published table", () => {
    for (let level = 2; level <= ROVER_LEVEL_MAX; level++) {
      expect(levelFromXp(LEVEL_XP_THRESHOLDS[level])).toBe(level)
      expect(levelFromXp(LEVEL_XP_THRESHOLDS[level] - 1)).toBe(level - 1)
      expect(xpForNextLevel(level - 1)).toBe(LEVEL_XP_THRESHOLDS[level])
    }
  })
})

describe("expWithinLevel", () => {
  it("reports progress through the level, not lifetime XP", () => {
    // The playground shows "XP: current/next", so 12 lifetime XP at L2 is 2.
    expect(expWithinLevel(12)).toEqual({ exp: 2, needed: 20 })
    expect(expWithinLevel(10)).toEqual({ exp: 0, needed: 20 })
    expect(expWithinLevel(4)).toEqual({ exp: 4, needed: 10 })
  })

  it("has no next level to count toward at the cap", () => {
    expect(expWithinLevel(130)).toEqual({ exp: 5, needed: null })
  })
})

describe("strength per level", () => {
  it("starts at the documented 10% absorb and 2 mineral capacity", () => {
    expect(absorbPctForLevel(1)).toBe(10)
    expect(capacityForLevel(1)).toBe(2)
  })

  it("never gets weaker as the rover levels up", () => {
    for (let level = 2; level <= ROVER_LEVEL_MAX; level++) {
      expect(absorbPctForLevel(level)).toBeGreaterThan(absorbPctForLevel(level - 1))
      expect(capacityForLevel(level)).toBeGreaterThan(capacityForLevel(level - 1))
    }
    expect(ABSORB_PCT_BY_LEVEL).toHaveLength(ROVER_LEVEL_MAX + 1)
    expect(CAPACITY_BY_LEVEL).toHaveLength(ROVER_LEVEL_MAX + 1)
  })

  it("clamps a level outside the table rather than reading off the end", () => {
    expect(capacityForLevel(0)).toBe(capacityForLevel(1))
    expect(capacityForLevel(99)).toBe(capacityForLevel(ROVER_LEVEL_MAX))
    expect(absorbPctForLevel(Number.NaN)).toBe(absorbPctForLevel(1))
  })
})
