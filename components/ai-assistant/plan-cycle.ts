export interface PlanPoint { x: number; y: number }
export interface PlanCycle {
  phase: "draw" | "build" | "running" | "review"
  strokes: PlanPoint[][]
  actual: PlanPoint[]
}
export const emptyPlan = (): PlanCycle => ({ phase: "draw", strokes: [], actual: [] })

/** Actual samples are world millimetres; sketches are preview-canvas pixels. */
export function samplePlanRun(plan: PlanCycle, running: boolean, point: PlanPoint): PlanCycle {
  if (plan.phase === "build" && running) return { ...plan, phase: "running", actual: [{ ...point }] }
  if (plan.phase !== "running") return plan
  // Reset can end a run and restore the start pose in the same React update.
  // That teleport is not part of the travelled path.
  if (!running) return { ...plan, phase: "review" }
  const last = plan.actual.at(-1)
  const moved = !last || Math.hypot(point.x - last.x, point.y - last.y) >= 2
  return {
    ...plan,
    phase: "running",
    actual: moved ? [...plan.actual, { ...point }] : plan.actual,
  }
}
