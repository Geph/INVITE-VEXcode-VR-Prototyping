import { describe, expect, it } from "vitest"
import {
  DRIVE_MS_PER_MM_AT_50,
  TURN_MS_PER_DEGREE_AT_50,
  driveDurationMs,
  driveStep,
  turnDurationMs,
  turnStep,
} from "@/engine/motion"

describe("durations", () => {
  it("matches the Ocean Reef 50% constants", () => {
    expect(DRIVE_MS_PER_MM_AT_50).toBe(10)
    expect(TURN_MS_PER_DEGREE_AT_50).toBe(22)
    expect(driveDurationMs(100, 50)).toBe(1000)
    expect(turnDurationMs(90, 50)).toBe(1980)
    expect(driveDurationMs(0, 50)).toBe(80)
    expect(turnDurationMs(-10, 50)).toBe(Math.max(80, 10 * 22))
    expect(driveDurationMs(100, 0)).toBe(driveDurationMs(100, 5))
    expect(turnDurationMs(90, 200)).toBe(turnDurationMs(90, 100))
  })
})

describe("driveStep / turnStep", () => {
  it("drives north at 50% by 100 mm in 1000 ms", () => {
    const next = driveStep({ xMm: 0, yMm: 0, headingDeg: 0 }, 1000, 50, "forward")
    expect(next.xMm).toBeCloseTo(0)
    expect(next.yMm).toBeCloseTo(100)
  })

  it("drives east when heading is 90° and reverses opposite the heading", () => {
    const east = driveStep({ xMm: 0, yMm: 0, headingDeg: 90 }, 1000, 50)
    expect(east.xMm).toBeCloseTo(100)
    expect(east.yMm).toBeCloseTo(0)
    const back = driveStep({ xMm: 0, yMm: 0, headingDeg: 0 }, 1000, 50, "reverse")
    expect(back.yMm).toBeCloseTo(-100)
  })

  it("turns clockwise on right and wraps through 360", () => {
    const right = turnStep({ xMm: 1, yMm: 2, headingDeg: 350 }, 22 * 20, 50, "right")
    expect(right.headingDeg).toBeCloseTo(10)
    expect(right.xMm).toBe(1)
    const left = turnStep({ xMm: 0, yMm: 0, headingDeg: 0 }, 22 * 90, 50, "left")
    expect(left.headingDeg).toBeCloseTo(270)
  })
})
