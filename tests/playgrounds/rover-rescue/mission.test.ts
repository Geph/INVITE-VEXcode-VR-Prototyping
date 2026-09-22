import { describe, expect, it } from "vitest"
import { DAY_MS, MISSION_DAYS, START_POSE } from "@/playgrounds/rover-rescue/config"
import { daysFromMs, formatDays, missionComplete, msFromDays } from "@/playgrounds/rover-rescue/mission"
import { createRoverRescueState, tickRoverRescue } from "@/playgrounds/rover-rescue/state"
import { RIVER_CENTERLINE } from "@/playgrounds/rover-rescue/map-spec"

const atBase = { xMm: START_POSE.xMm, yMm: START_POSE.yMm, headingDeg: 0, driveVelocity: 50, turnVelocity: 50, driveTimeoutMs: null }

describe("mission clock", () => {
  it("converts between milliseconds and in-game days", () => {
    expect(daysFromMs(0)).toBe(0)
    expect(daysFromMs(DAY_MS)).toBe(1)
    expect(daysFromMs(DAY_MS * 2.5)).toBe(2.5)
    expect(msFromDays(3)).toBe(DAY_MS * 3)
    expect(daysFromMs(-500)).toBe(0)
  })

  it("shows one decimal without rounding a day up before it is earned", () => {
    expect(formatDays(0)).toBe("0.0")
    expect(formatDays(1.97)).toBe("1.9")
    expect(formatDays(12.44)).toBe("12.4")
    expect(formatDays(49.99)).toBe("49.9")
  })

  it("calls the mission complete only at the documented 50 days", () => {
    expect(missionComplete(msFromDays(MISSION_DAYS - 0.1))).toBe(false)
    expect(missionComplete(msFromDays(MISSION_DAYS))).toBe(true)
  })
})

describe("tickRoverRescue mission time", () => {
  it("only advances while a program is running", () => {
    const idle = tickRoverRescue(createRoverRescueState(1), 1000, atBase)
    expect(idle.missionMs).toBe(0)
    // Enemies and respawns still animate, so the render clock keeps going.
    expect(idle.elapsedMs).toBe(1000)

    const running = tickRoverRescue(createRoverRescueState(1), 1000, atBase, { missionRunning: true })
    expect(running.missionMs).toBe(1000)
  })

  it("offers the day-50 dialog instead of ending the mission", () => {
    let state = createRoverRescueState(1)
    state = { ...state, missionMs: msFromDays(MISSION_DAYS) - 10, batteryPercent: 40 }
    const before = tickRoverRescue(state, 5, atBase, { missionRunning: true })
    expect(before.missionOver).toBe(false)
    expect(before.day50Dialog).toBe(false)

    const after = tickRoverRescue(before, 10, atBase, { missionRunning: true })
    expect(after.missionOver).toBe(false)
    expect(after.day50Dialog).toBe(true)
    expect(after.missionReason).toBeUndefined()
  })

  it("keeps the mission clock running while the day-50 dialog is up", () => {
    const open = tickRoverRescue(
      { ...createRoverRescueState(1), missionMs: msFromDays(MISSION_DAYS), batteryPercent: 40, day50Dialog: true },
      1000,
      atBase,
      { missionRunning: true },
    )
    expect(open.missionOver).toBe(false)
    expect(open.day50Dialog).toBe(true)
    expect(open.missionMs).toBe(msFromDays(MISSION_DAYS) + 1000)
  })

  it("stops the clock once the mission is over", () => {
    const over = tickRoverRescue(
      { ...createRoverRescueState(1), missionOver: true, missionReason: "river" },
      1000,
      atBase,
      { missionRunning: true },
    )
    expect(over.missionMs).toBe(0)
    expect(over.missionReason).toBe("river")
  })

  it("ends the mission the moment the rover is in the river", () => {
    const mid = RIVER_CENTERLINE[4]
    const state = tickRoverRescue(createRoverRescueState(1), 16, { ...atBase, xMm: mid.x, yMm: mid.y }, {
      missionRunning: true,
    })
    expect(state.missionOver).toBe(true)
    expect(state.missionReason).toBe("river")
  })
})
