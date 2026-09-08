"use client"

import { useEffect, useRef } from "react"
import type { RobotState } from "@/engine"
import {
  AI_DETECT_RANGE_MM,
  AI_SIGHT_HALF_ANGLE_DEG,
  AI_SIGHT_RANGE_MM,
} from "../config"
import type { RoverRescueState } from "../state"
import type { SightReport } from "../systems/sensing"

const SIZE = 148
const RANGE_MM = AI_SIGHT_RANGE_MM

export function Minimap({
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
      drawMinimap(ctx, stateRef.current, robotRef.current)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [stateRef])

  return (
    <canvas
      id="vex-rover-minimap"
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      className="rounded-full border border-white/30 bg-black/55 shadow-lg"
      aria-label="Rover radar minimap"
    />
  )
}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  state: RoverRescueState,
  robot: Pick<RobotState, "xMm" | "yMm" | "headingDeg">,
): void {
  const cx = SIZE / 2
  const cy = SIZE / 2
  const rim = SIZE / 2 - 8
  const pxPerMm = rim / RANGE_MM
  ctx.clearRect(0, 0, SIZE, SIZE)

  ctx.beginPath()
  ctx.arc(cx, cy, SIZE / 2 - 1, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(12, 16, 22, 0.92)"
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, rim + 2, 0, Math.PI * 2)
  ctx.clip()

  ctx.beginPath()
  ctx.arc(cx, cy, AI_DETECT_RANGE_MM * pxPerMm, 0, Math.PI * 2)
  ctx.strokeStyle = "rgba(176, 80, 255, 0.95)"
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = "rgba(160, 70, 255, 0.08)"
  ctx.fill()

  const heading = robot.headingDeg
  const start = headingToCanvas(heading - AI_SIGHT_HALF_ANGLE_DEG)
  const end = headingToCanvas(heading + AI_SIGHT_HALF_ANGLE_DEG)
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, AI_SIGHT_RANGE_MM * pxPerMm, start, end, false)
  ctx.closePath()
  ctx.fillStyle = "rgba(176, 90, 255, 0.28)"
  ctx.fill()
  ctx.strokeStyle = "rgba(210, 150, 255, 0.7)"
  ctx.lineWidth = 1
  ctx.stroke()

  const contacts = uniqueContacts(state)
  for (const hit of contacts) {
    const x = cx + (hit.posMm.x - robot.xMm) * pxPerMm
    const y = cy - (hit.posMm.y - robot.yMm) * pxPerMm
    ctx.beginPath()
    ctx.arc(x, y, hit.kind === "enemy" ? 3.2 : 2.4, 0, Math.PI * 2)
    ctx.fillStyle = dotColor(hit)
    ctx.fill()
  }

  ctx.beginPath()
  ctx.moveTo(cx, cy - 7)
  ctx.lineTo(cx + 5, cy + 6)
  ctx.lineTo(cx, cy + 3)
  ctx.lineTo(cx - 5, cy + 6)
  ctx.closePath()
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((heading * Math.PI) / 180)
  ctx.translate(-cx, -cy)
  ctx.fillStyle = "#7ee0ff"
  ctx.fill()
  ctx.restore()
  ctx.restore()

  drawCompassTicks(ctx, cx, cy, rim + 4)
}

function uniqueContacts(state: RoverRescueState): SightReport[] {
  const byId = new Map<string, SightReport>()
  for (const hit of state.sensing.detected) byId.set(hit.id, hit)
  for (const hit of state.sensing.seen) if (hit.distanceMm <= RANGE_MM) byId.set(hit.id, hit)
  return [...byId.values()]
}

function dotColor(hit: SightReport): string {
  if (hit.kind === "mineral") return "#5cecff"
  if (hit.kind === "enemy") return "#ff6b4a"
  if (hit.kind === "obstacle") return "#d8d2c4"
  if (hit.kind === "hazard") return "#3ecf8a"
  return "#f4d35e"
}

function headingToCanvas(headingDeg: number): number {
  return ((headingDeg - 90) * Math.PI) / 180
}

function drawCompassTicks(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
  const labels = [
    { d: 0, t: "N" },
    { d: 90, t: "E" },
    { d: 180, t: "S" },
    { d: 270, t: "W" },
  ]
  ctx.strokeStyle = "rgba(255,255,255,0.55)"
  ctx.fillStyle = "rgba(255,255,255,0.9)"
  ctx.font = "700 9px ui-sans-serif, system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  for (let deg = 0; deg < 360; deg += 30) {
    const a = headingToCanvas(deg)
    const inner = radius - (deg % 90 === 0 ? 6 : 3)
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
    ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius)
    ctx.lineWidth = deg % 90 === 0 ? 1.6 : 1
    ctx.stroke()
  }
  for (const label of labels) {
    const a = headingToCanvas(label.d)
    const r = radius - 12
    ctx.fillText(label.t, cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  }
}
