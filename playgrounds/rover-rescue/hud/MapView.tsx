"use client"

import { useEffect, useRef } from "react"
import type { RobotState } from "@/engine"
import { fitToBounds } from "@/engine"
import { FIELD_BOUNDS, GRID_MM } from "../config"
import { drawBase } from "../art/base"
import { drawBridges } from "../art/bridges"
import { drawEntities } from "../art/entities"
import { drawGrid } from "../art/grid"
import { drawRiver } from "../art/river"
import { drawTerrain } from "../art/terrain"
import { createDrawWorld, toScreen } from "../art/world-draw"
import { riverHazardFromState, type RoverRescueState } from "../state"

const WIDTH = 360
const HEIGHT = 180

export function MapView({
  stateRef,
  robot,
}: {
  stateRef: { current: RoverRescueState }
  robot: Pick<RobotState, "xMm" | "yMm" | "headingDeg">
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const robotRef = useRef(robot)
  robotRef.current = robot

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let frame = 0
    const loop = () => {
      drawMap(ctx, stateRef.current, robotRef.current)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [stateRef])

  return (
    <canvas
      id="vex-rover-map-view"
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      className="rounded-md border border-white/30 bg-black/70 shadow-lg"
      aria-label="Rover Rescue full map"
    />
  )
}

function drawMap(
  ctx: CanvasRenderingContext2D,
  state: RoverRescueState,
  robot: Pick<RobotState, "xMm" | "yMm" | "headingDeg">,
): void {
  const cam = fitToBounds(FIELD_BOUNDS, { widthPx: WIDTH, heightPx: HEIGHT }, GRID_MM * 0.15)
  const world = createDrawWorld(ctx, cam)
  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  drawTerrain(world, state.seed, state.zones)
  drawRiver(world, state.seed, state.elapsedMs, riverHazardFromState(state), state.riverCenterline)
  drawBridges(world, state.seed, state.bridges)
  drawBase(world)
  drawGrid(world)
  drawEntities(world, state.index)
  drawRoverMark(world, robot)
  drawScaleBar(ctx, cam.zoom)
  drawCompassRose(ctx)
}

function drawRoverMark(
  world: ReturnType<typeof createDrawWorld>,
  robot: Pick<RobotState, "xMm" | "yMm" | "headingDeg">,
): void {
  const p = toScreen(world, { x: robot.xMm, y: robot.yMm })
  const { ctx } = world
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate((robot.headingDeg * Math.PI) / 180)
  ctx.beginPath()
  ctx.moveTo(0, -7)
  ctx.lineTo(5, 6)
  ctx.lineTo(0, 3)
  ctx.lineTo(-5, 6)
  ctx.closePath()
  ctx.fillStyle = "#7ee0ff"
  ctx.strokeStyle = "#08202c"
  ctx.lineWidth = 1
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawScaleBar(ctx: CanvasRenderingContext2D, pxPerMm: number): void {
  const mm = 2000
  const w = mm * pxPerMm
  const x = 12
  const y = HEIGHT - 14
  ctx.save()
  ctx.fillStyle = "rgba(8, 10, 14, 0.65)"
  ctx.fillRect(x - 4, y - 14, w + 8, 18)
  ctx.strokeStyle = "#f3f6f8"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.moveTo(x, y - 4)
  ctx.lineTo(x, y + 4)
  ctx.moveTo(x + w, y - 4)
  ctx.lineTo(x + w, y + 4)
  ctx.stroke()
  ctx.fillStyle = "#f3f6f8"
  ctx.font = "9px ui-sans-serif, system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "bottom"
  ctx.fillText("2000 mm", x + w / 2, y - 3)
  ctx.restore()
}

function drawCompassRose(ctx: CanvasRenderingContext2D): void {
  const cx = WIDTH - 28
  const cy = 28
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = "rgba(255,255,255,0.7)"
  ctx.fillStyle = "rgba(8,10,14,0.55)"
  ctx.beginPath()
  ctx.arc(0, 0, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, -12)
  ctx.lineTo(3, 0)
  ctx.lineTo(0, 4)
  ctx.lineTo(-3, 0)
  ctx.closePath()
  ctx.fillStyle = "#e85d4c"
  ctx.fill()
  ctx.fillStyle = "#f3f6f8"
  ctx.font = "700 9px ui-sans-serif, system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("N", 0, -16)
  ctx.restore()
}
