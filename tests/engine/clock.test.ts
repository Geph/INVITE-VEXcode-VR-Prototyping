import { describe, expect, it } from "vitest"
import { STEP_MS, SimulationClock } from "@/engine/clock"

describe("SimulationClock", () => {
  it("uses a 60 Hz step", () => {
    expect(STEP_MS).toBeCloseTo(1000 / 60)
  })

  it("accumulates a slow frame into several fixed steps", () => {
    const clock = new SimulationClock()
    const steps: number[] = []
    const ran = clock.pushFrame(STEP_MS * 2.5, (ctx) => steps.push(ctx.stepIndex))
    expect(ran).toBe(2)
    expect(steps).toEqual([1, 2])
    expect(clock.gameTimeMs).toBeCloseTo(STEP_MS * 2)
    expect(clock.pushFrame(STEP_MS * 0.6, () => {})).toBe(1)
  })

  it("scales incoming real time and caps a spiral-of-death frame", () => {
    const clock = new SimulationClock()
    clock.scale = 2
    expect(clock.pushFrame(STEP_MS, () => {})).toBe(2)
    clock.reset()
    expect(clock.gameTimeMs).toBe(0)
    expect(clock.pushFrame(STEP_MS * 100, () => {})).toBe(8)
    clock.reset()
    expect(clock.pushFrame(Number.NaN, () => {})).toBe(0)
  })

  it("fast-forwards until the predicate or maxSteps", () => {
    const clock = new SimulationClock()
    const hit = clock.fastForward((ctx) => ctx.stepIndex >= 3, 10)
    expect(hit.stepIndex).toBe(3)
    const capped = new SimulationClock().fastForward(() => false, 5)
    expect(capped.stepIndex).toBe(5)
    expect(new SimulationClock().fastForward(() => true, 0).stepIndex).toBe(0)
  })
})
