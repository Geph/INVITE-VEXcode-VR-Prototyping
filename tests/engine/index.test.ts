import { describe, expect, it } from "vitest"
import { MM_PER_INCH, ProgramStopped, STEP_MS, createRng, driveStep } from "@/engine"

describe("engine barrel", () => {
  it("re-exports the public surface", () => {
    expect(MM_PER_INCH).toBe(25.4)
    expect(STEP_MS).toBeCloseTo(1000 / 60)
    expect(createRng(1).next()).toBeGreaterThanOrEqual(0)
    expect(driveStep({ xMm: 0, yMm: 0, headingDeg: 0 }, 0, 50).yMm).toBe(0)
    expect(new ProgramStopped().name).toBe("ProgramStopped")
  })
})
