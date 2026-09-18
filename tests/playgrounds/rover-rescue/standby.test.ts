import { describe, expect, it } from "vitest"
import { STEP_MS } from "@/engine"
import {
  BATTERY_DRAIN_IDLE_PCT_PER_DAY,
  BATTERY_START_PCT,
  DAY_MS,
  START_POSE,
  STANDBY_MAX_STEPS,
} from "@/playgrounds/rover-rescue/config"
import { daysFromMs } from "@/playgrounds/rover-rescue/mission"
import { createRoverRescueState } from "@/playgrounds/rover-rescue/state"
import {
  advanceStandby,
  parseStandbyPercent,
  runStandby,
  shouldEnterStandby,
} from "@/playgrounds/rover-rescue/systems/standby"

const parked = {
  xMm: START_POSE.xMm,
  yMm: START_POSE.yMm,
  headingDeg: 0,
  driveVelocity: 50,
  turnVelocity: 50,
  driveTimeoutMs: null,
}

describe("shouldEnterStandby", () => {
  it("refuses to start when the threshold is already at or above the battery", () => {
    expect(shouldEnterStandby(50, 50)).toBe(false)
    expect(shouldEnterStandby(40, 50)).toBe(false)
    expect(shouldEnterStandby(80, 50)).toBe(true)
    expect(shouldEnterStandby(100, 0)).toBe(true)
  })

  it("clamps nonsense percents into 0–100", () => {
    expect(parseStandbyPercent(150)).toBe(100)
    expect(parseStandbyPercent(-4)).toBe(0)
    expect(parseStandbyPercent("50")).toBe(50)
    expect(parseStandbyPercent(Number.NaN)).toBe(0)
  })
})

describe("advanceStandby", () => {
  it("drains parked battery until it falls to the threshold, and advances days", () => {
    const world = createRoverRescueState(1)
    const dropPct = 10
    const days = dropPct / BATTERY_DRAIN_IDLE_PCT_PER_DAY
    const neededSteps = Math.ceil((days * DAY_MS) / STEP_MS) + 2
    const { state, steps } = advanceStandby(world, parked, BATTERY_START_PCT - dropPct, neededSteps)

    expect(state.batteryPercent).toBeLessThanOrEqual(BATTERY_START_PCT - dropPct)
    expect(state.batteryPercent).toBeGreaterThan(BATTERY_START_PCT - dropPct - 0.2)
    expect(daysFromMs(state.missionMs)).toBeCloseTo(days, 1)
    expect(steps).toBeGreaterThan(0)
    expect(state.driveMoving).toBe(false)
    expect(state.missionOver).toBe(false)
  })

  it("stops at the step cap so a runaway call cannot hang", () => {
    const { state, steps } = advanceStandby(createRoverRescueState(1), parked, 0, 8)
    expect(steps).toBe(8)
    expect(state.batteryPercent).toBeGreaterThan(90)
    expect(STANDBY_MAX_STEPS).toBeGreaterThan(8)
  })
})

describe("runStandby", () => {
  it("is a no-op when battery is already at the threshold", async () => {
    const world = { current: { ...createRoverRescueState(1), batteryPercent: 40 } }
    const entered = await runStandby(world, parked, 50, { current: false })
    expect(entered).toBe(false)
    expect(world.current.batteryPercent).toBe(40)
    expect(world.current.standby).toBe(false)
  })

  it("clears the standby flag even if the stop signal fires", async () => {
    const world = { current: createRoverRescueState(1) }
    const stopped = { current: true }
    // Already flagged, then immediately stopped: still must leave standby off.
    const entered = await runStandby(world, parked, 50, stopped)
    expect(entered).toBe(true)
    expect(world.current.standby).toBe(false)
  })
})
