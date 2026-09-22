"use client"

import { useEffect, useRef } from "react"
import { fitToBounds, worldToScreen, type Camera, type Viewport } from "@/engine"
import { playgroundWorldBounds } from "@/hooks/distance-picker-preview"
import { toEngineRobot } from "@/hooks/playground-host"
import { isCastleCrashersPlayground, isEngineNorthPlayground, isRoverRescuePlayground } from "@/hooks/playground-motion"
import { reefWorldToScreen } from "@/playgrounds/ocean-reef/art"
import type { OceanReefState } from "@/playgrounds/ocean-reef"
import type { RoverRescueState } from "@/playgrounds/rover-rescue"
import type { CastleCrashersState } from "@/playgrounds/castle-crashers"
import type { PlaygroundDefinition } from "@/playgrounds/types"
import { programPathMm, type PathPoint } from "./expected-path"

const PREVIEW_W = 320
const PREVIEW_H = 200

type PreviewPlayground =
  | PlaygroundDefinition<OceanReefState>
  | PlaygroundDefinition<RoverRescueState>
  | PlaygroundDefinition<CastleCrashersState>

export function PredictPreview({
  workspace,
  playgroundId,
  playground,
  robot,
  reefState,
  roverState,
  castleState,
}: {
  workspace: {
    getAllBlocks: () => Array<{ type: string; getNextBlock?: () => unknown }>
    addChangeListener?: (fn: () => void) => void
    removeChangeListener?: (fn: () => void) => void
  } | null
  playgroundId: string
  playground: PreviewPlayground
  robot: { x: number; y: number; rotation: number }
  reefState: OceanReefState
  roverState: RoverRescueState
  castleState: CastleCrashersState
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const live = useRef({ playground, robot, reefState, roverState, castleState })
  live.current = { playground, robot, reefState, roverState, castleState }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let backdrop: HTMLCanvasElement | null = null
    let screenPath: PathPoint[] = []

    const rebuild = () => {
      const snap = live.current
      const viewport: Viewport = { widthPx: PREVIEW_W, heightPx: PREVIEW_H }
      const cam = fitToBounds(playgroundWorldBounds(snap.playground.world), viewport)
      const next = document.createElement("canvas")
      next.width = PREVIEW_W
      next.height = PREVIEW_H
      const backdropCtx = next.getContext("2d")
      if (!backdropCtx) return
      paintPlayground(backdropCtx, {
        playgroundId,
        playground: snap.playground,
        robot: snap.robot,
        reefState: snap.reefState,
        roverState: snap.roverState,
        castleState: snap.castleState,
        viewport,
        cam,
      })
      backdrop = next
      screenPath = programPathMm(
        workspace,
        { x: snap.robot.x, y: snap.robot.y, headingDeg: snap.robot.rotation },
        playgroundId,
      ).map((point) => project(playgroundId, point, cam, viewport))
    }

    rebuild()
    workspace?.addChangeListener?.(rebuild)

    let offset = 0
    let frame = 0
    const draw = () => {
      ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H)
      if (backdrop) ctx.drawImage(backdrop, 0, 0)
      strokePath(ctx, screenPath, offset)
      offset -= 0.7
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      workspace?.removeChangeListener?.(rebuild)
      cancelAnimationFrame(frame)
    }
  }, [workspace, playgroundId])

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-purple-700">Expected path on {playground.name}</p>
      <canvas
        id="vex-ai-predict-canvas"
        ref={canvasRef}
        width={PREVIEW_W}
        height={PREVIEW_H}
        className="w-full rounded-lg border-4 border-purple-300 bg-slate-100"
      />
      <p className="text-xs text-slate-500">
        The dotted line is where this program drives from the robot&apos;s current pose.
      </p>
    </div>
  )
}

function paintPlayground(
  ctx: CanvasRenderingContext2D,
  input: {
    playgroundId: string
    playground: PreviewPlayground
    robot: { x: number; y: number; rotation: number }
    reefState: OceanReefState
    roverState: RoverRescueState
    castleState: CastleCrashersState
    viewport: Viewport
    cam: Camera
  },
) {
  const engineRobot = toEngineRobot(input.robot)
  if (isRoverRescuePlayground(input.playgroundId)) {
    ;(input.playground as PlaygroundDefinition<RoverRescueState>).render(ctx, input.roverState, engineRobot, input.cam)
    return
  }
  if (isCastleCrashersPlayground(input.playgroundId)) {
    ;(input.playground as PlaygroundDefinition<CastleCrashersState>).render(ctx, input.castleState, engineRobot, input.cam)
    return
  }
  ;(input.playground as PlaygroundDefinition<OceanReefState>).render(
    ctx,
    { ...input.reefState, view: { widthPx: PREVIEW_W, heightPx: PREVIEW_H, maximized: false } },
    engineRobot,
    input.cam,
  )
}

function project(playgroundId: string, point: PathPoint, cam: Camera, viewport: Viewport) {
  if (isEngineNorthPlayground(playgroundId)) return worldToScreen(point, cam, viewport)
  return reefWorldToScreen(point.x, point.y, cam, viewport)
}

function strokePath(ctx: CanvasRenderingContext2D, points: PathPoint[], offset: number) {
  if (points.length === 0) return
  const start = points[0]
  ctx.fillStyle = "#FFD700"
  ctx.beginPath()
  ctx.arc(start.x, start.y, 5, 0, Math.PI * 2)
  ctx.fill()
  if (points.length < 2) return
  ctx.save()
  ctx.setLineDash([8, 6])
  ctx.lineDashOffset = offset
  ctx.strokeStyle = "#16A34A"
  ctx.lineWidth = 3
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y)
  ctx.stroke()
  ctx.restore()
}
