import { describe, expect, it } from "vitest"
import {
  CASTLE_CRASHERS_ID,
  FIELD_DIAMETER_MM,
  START_POSE,
  createCastleCrashersState,
  insideHex,
} from "@/playgrounds/castle-crashers"
import { tickCastlePhysics } from "@/playgrounds/castle-crashers/systems/physics"

describe("Castle Crasher+", () => {
  it("uses the documented field diameter and start pose", () => {
    expect(FIELD_DIAMETER_MM).toBe(3288)
    expect(START_POSE).toEqual({ xMm: 1014, yMm: 50, headingDeg: -90 })
    expect(CASTLE_CRASHERS_ID).toBe("castle-crashers")
  })

  it("keeps the start pose on the island", () => {
    expect(insideHex(START_POSE.xMm, START_POSE.yMm)).toBe(true)
  })

  it("scores a piece once it is past the hex edge", () => {
    const state = createCastleCrashersState(1)
    const piece = state.pieces.find((p) => p.pushable && p.weightKg > 0)
    expect(piece).toBeTruthy()
    const pieces = state.pieces.map((p) =>
      p.id === piece!.id ? { ...p, xMm: 2000, yMm: 0, cleared: false } : { ...p },
    )
    const next = tickCastlePhysics(
      { ...state, pieces },
      16,
      {
        xMm: START_POSE.xMm,
        yMm: START_POSE.yMm,
        headingDeg: START_POSE.headingDeg,
        driveVelocity: 50,
        turnVelocity: 50,
        driveTimeoutMs: null,
      },
      true,
    )
    const matched = next.pieces.find((p) => p.id === piece!.id)
    expect(matched?.cleared).toBe(true)
    expect(next.weightClearedKg).toBe(piece!.weightKg)
  })

  it("ends the mission when the robot leaves the hex", () => {
    const state = createCastleCrashersState(1)
    const next = tickCastlePhysics(
      state,
      16,
      {
        xMm: 2500,
        yMm: 0,
        headingDeg: 0,
        driveVelocity: 50,
        turnVelocity: 50,
        driveTimeoutMs: null,
      },
      true,
    )
    expect(next.missionOver).toBe(true)
    expect(next.missionReason).toBe("water")
  })
})
