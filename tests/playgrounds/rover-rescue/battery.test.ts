import { describe, expect, it } from "vitest"
import {
  BATTERY_DRAIN_DRIVING_PCT_PER_DAY,
  BATTERY_DRAIN_IDLE_PCT_PER_DAY,
  BATTERY_START_PCT,
  DAY_MS,
  MISSION_DAYS,
  START_POSE,
} from "@/playgrounds/rover-rescue/config"
import { batteryEmpty, clampBattery, drainBattery, drainRatePctPerDay } from "@/playgrounds/rover-rescue/systems/battery"
import { msFromDays } from "@/playgrounds/rover-rescue/mission"
import { createRoverRescueState, tickRoverRescue } from "@/playgrounds/rover-rescue/state"

const atBase = {
  xMm: START_POSE.xMm,
  yMm: START_POSE.yMm,
  headingDeg: 0,
  driveVelocity: 50,
  turnVelocity: 50,
  driveTimeoutMs: null,
}

describe("drainBattery", () => {
  it("costs more per day while driving than parked", () => {
    expect(drainRatePctPerDay(false)).toBe(BATTERY_DRAIN_IDLE_PCT_PER_DAY)
    expect(drainRatePctPerDay(true)).toBe(BATTERY_DRAIN_IDLE_PCT_PER_DAY + BATTERY_DRAIN_DRIVING_PCT_PER_DAY)
    expect(drainBattery(100, DAY_MS, true)).toBeLessThan(drainBattery(100, DAY_MS, false))
  })

  it("drains the published percent for one in-game day", () => {
    expect(drainBattery(100, DAY_MS, false)).toBeCloseTo(100 - BATTERY_DRAIN_IDLE_PCT_PER_DAY, 6)
    expect(drainBattery(100, DAY_MS / 2, false)).toBeCloseTo(100 - BATTERY_DRAIN_IDLE_PCT_PER_DAY / 2, 6)
  })

  it("bottoms out at 0 instead of going negative", () => {
    expect(drainBattery(1, msFromDays(MISSION_DAYS), true)).toBe(0)
    expect(batteryEmpty(drainBattery(1, msFromDays(MISSION_DAYS), true))).toBe(true)
    expect(clampBattery(-5)).toBe(0)
    expect(clampBattery(140)).toBe(BATTERY_START_PCT)
    expect(clampBattery(Number.NaN)).toBe(0)
  })

  /**
   * The tuning has to leave the mission winnable but not free: parking for all
   * 50 days must not survive on the starting charge alone, or minerals would be
   * pointless, and it must not die in a handful of days either.
   */
  it("is tuned so a full battery is worth roughly the whole mission parked", () => {
    expect(drainBattery(BATTERY_START_PCT, msFromDays(MISSION_DAYS), false)).toBe(0)
    expect(drainBattery(BATTERY_START_PCT, msFromDays(MISSION_DAYS - 5), false)).toBeGreaterThan(0)
    expect(drainBattery(BATTERY_START_PCT, msFromDays(MISSION_DAYS), true)).toBe(0)
    expect(drainBattery(BATTERY_START_PCT, msFromDays(10), true)).toBeGreaterThan(0)
  })
})

describe("tickRoverRescue battery", () => {
  it("holds charge while no program is running", () => {
    const idle = tickRoverRescue(createRoverRescueState(1), msFromDays(5), atBase)
    expect(idle.batteryPercent).toBe(BATTERY_START_PCT)
  })

  it("drains on the same clock as the days", () => {
    const running = tickRoverRescue(createRoverRescueState(1), DAY_MS, atBase, { missionRunning: true })
    expect(running.batteryPercent).toBeCloseTo(BATTERY_START_PCT - BATTERY_DRAIN_IDLE_PCT_PER_DAY, 6)
    expect(running.missionOver).toBe(false)
  })

  it("ends the mission at 0% rather than letting the rover coast", () => {
    const flat = tickRoverRescue({ ...createRoverRescueState(1), batteryPercent: 0.5 }, DAY_MS, atBase, {
      missionRunning: true,
    })
    expect(flat.batteryPercent).toBe(0)
    expect(flat.missionOver).toBe(true)
    expect(flat.missionReason).toBe("battery")
  })

  it("keeps the river as the reason when both would end the mission", () => {
    // Drowning is the more specific failure, and it is what the player just did.
    const state = { ...createRoverRescueState(1), batteryPercent: 0.1 }
    const drowned = tickRoverRescue(state, DAY_MS, { ...atBase, xMm: 330, yMm: 770 }, { missionRunning: true })
    expect(drowned.missionOver).toBe(true)
    expect(drowned.missionReason).toBe("river")
  })
})
