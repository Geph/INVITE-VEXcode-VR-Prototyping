import { describe, expect, it } from "vitest"
import { emptyPlan, samplePlanRun, type PlanCycle } from "@/components/ai-assistant/plan-cycle"

describe("draw / build / run / review cycle", () => {
  it("records actual world positions only for a submitted plan and freezes the review through Reset", () => {
    const drawing = emptyPlan()
    expect(samplePlanRun(drawing, true, { x: 10, y: 0 })).toBe(drawing)
    let plan: PlanCycle = { ...drawing, phase: "build", strokes: [[{ x: 5, y: 4 }, { x: 10, y: 8 }]] }
    plan = samplePlanRun(plan, true, { x: 1014, y: 50 })
    plan = samplePlanRun(plan, true, { x: 814, y: 50 })
    plan = samplePlanRun(plan, false, { x: 1014, y: 50 })
    expect(plan.phase).toBe("review")
    expect(plan.actual).toEqual([{ x: 1014, y: 50 }, { x: 814, y: 50 }])
    expect(plan.strokes).toHaveLength(1)
    expect(samplePlanRun(plan, true, { x: 0, y: 0 })).toBe(plan)
    expect(emptyPlan()).toEqual({ phase: "draw", strokes: [], actual: [] })
  })
})
