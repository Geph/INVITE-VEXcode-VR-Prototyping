"use client"

import { useEffect, useRef, type Dispatch, type SetStateAction, type PointerEvent } from "react"
import { fitToBounds } from "@/engine"
import { playgroundWorldBounds } from "@/hooks/distance-picker-preview"
import { Button } from "@/components/ui/button"
import { BackButton } from "./help-panels"
import { paintPlayground, project } from "./predict-preview"
import { emptyPlan, type PlanCycle, type PlanPoint } from "./plan-cycle"

export type PlanBackdrop = Parameters<typeof paintPlayground>[1]
export const PLAN_VIEW = { widthPx: 320, heightPx: 260 }

export function PlanPanel({ plan, setPlan, backdrop, onBack, isRunning }: {
  plan: PlanCycle
  setPlan: Dispatch<SetStateAction<PlanCycle>>
  backdrop: PlanBackdrop
  onBack: () => void
  isRunning: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const camera = fitToBounds(playgroundWorldBounds(backdrop.playground.world), PLAN_VIEW)
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, PLAN_VIEW.widthPx, PLAN_VIEW.heightPx)
    paintPlayground(ctx, { ...backdrop, viewport: PLAN_VIEW, cam: camera })
    for (const stroke of plan.strokes) drawLine(ctx, stroke, "#1d4ed8", false)
    drawLine(ctx, plan.actual.map(p => project(backdrop.playgroundId, p, camera, PLAN_VIEW)), "#ea580c", true)
  }, [plan, backdrop, camera])

  const point = (event: PointerEvent<HTMLCanvasElement>): PlanPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(320, (event.clientX - rect.left) * 320 / rect.width)),
      y: Math.max(0, Math.min(260, (event.clientY - rect.top) * 260 / rect.height)),
    }
  }
  const canDraw = plan.phase === "draw" && !isRunning
  return (
    <div id="vex-ai-draw-plan" className="space-y-3 text-sm text-slate-700">
      <BackButton colorClass="text-blue-600" onClick={onBack} />
      <h4 className="text-base font-semibold">Make a plan</h4>
      <p role="status">{plan.phase === "draw" ? "Draw a path the robot might move, then submit your plan."
        : plan.phase === "build" ? "Now assemble your blocks to follow your plan. Press START when you’re ready."
        : plan.phase === "running" ? "Your robot is running. Watch how its path compares with your plan."
        : "How did the actual path compare with your plan? Draw a new plan and try again."}</p>
      <canvas ref={canvasRef} width={320} height={260} aria-label="Plan map: draw the robot’s path"
        className="w-full touch-none rounded-lg border-2 border-blue-300"
        onPointerDown={event => {
          if (!canDraw) return
          drawing.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          const p = point(event)
          setPlan(prev => ({ ...prev, strokes: [...prev.strokes, [p]] }))
        }}
        onPointerMove={event => {
          if (!drawing.current || !canDraw) return
          const p = point(event)
          setPlan(prev => ({ ...prev, strokes: prev.strokes.map((s, i) => i === prev.strokes.length - 1 ? [...s, p] : s) }))
        }}
        onPointerUp={() => { drawing.current = false }}
        onPointerCancel={() => { drawing.current = false }}
      />
      <p className="text-xs"><span className="text-blue-700">Blue solid: your plan.</span>{" "}<span className="text-orange-700">Orange dashed: actual path.</span></p>
      {plan.phase === "draw" ? <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!canDraw || !plan.strokes.length} onClick={() => setPlan(emptyPlan())}>Clear</Button>
        <Button disabled={!canDraw || !plan.strokes.some(s => s.length > 1)} onClick={() => setPlan(prev => ({ ...prev, phase: "build" }))}>Submit plan</Button>
      </div> : plan.phase !== "running" ? <Button disabled={isRunning} className="h-auto whitespace-normal" onClick={() => setPlan(emptyPlan())}>
        {plan.phase === "review" ? "Draw a new plan" : "Change my drawing"}
      </Button> : null}
      {isRunning && plan.phase === "draw" ? <p>Finish or stop this run before drawing your next plan.</p> : null}
    </div>
  )
}

function drawLine(ctx: CanvasRenderingContext2D, points: PlanPoint[], color: string, dashed: boolean) {
  if (!points.length) return
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 3
  ctx.lineCap = "round"
  ctx.setLineDash(dashed ? [6, 4] : [])
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(points[0].x, points[0].y, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
