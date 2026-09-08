import type { Camera, RobotState } from "@/engine"
import { createDrawWorld, toScreen, type DrawWorld } from "./world-draw"
import type { RoverRescueState } from "../state"
import type { SightReport } from "../systems/sensing"

const GLOW: Record<string, string> = {
  mineral: "rgba(80, 230, 255, 0.95)",
  enemy: "rgba(255, 92, 64, 0.95)",
  obstacle: "rgba(255, 210, 90, 0.95)",
  hazard: "rgba(70, 210, 140, 0.95)",
  base: "rgba(250, 230, 120, 0.95)",
  detect: "rgba(180, 120, 255, 0.85)",
}

export function drawAiOverlay(world: DrawWorld, state: RoverRescueState, _robot: RobotState): void {
  if (!state.aiVisualisation) return
  const sensing = state.sensing
  if (!sensing) return
  const seenIds = new Set(sensing.seen.map((item) => item.id))

  for (const hit of sensing.detected) {
    drawGlow(world, hit, seenIds.has(hit.id) ? GLOW[hit.kind] ?? GLOW.detect : GLOW.detect)
  }
  for (const hit of sensing.seen) {
    if (!seenIds.has(hit.id)) continue
    if (!sensing.detected.some((item) => item.id === hit.id)) {
      drawGlow(world, hit, GLOW[hit.kind] ?? GLOW.detect)
    }
  }

  for (const hit of sensing.seen) {
    if (hit.kind !== "mineral" && hit.kind !== "enemy" && hit.kind !== "obstacle") continue
    drawLabel(world, hit)
  }
}

function drawGlow(world: DrawWorld, hit: SightReport, stroke: string): void {
  const p = toScreen(world, hit.posMm)
  const r = Math.max(8, (hit.radiusMm || 24) * world.cam.zoom + 4)
  const { ctx } = world
  ctx.save()
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.strokeStyle = stroke
  ctx.lineWidth = 2.5
  ctx.shadowColor = stroke
  ctx.shadowBlur = 8
  ctx.stroke()
  ctx.restore()
}

function drawLabel(world: DrawWorld, hit: SightReport): void {
  const p = toScreen(world, hit.posMm)
  const lines = labelLines(hit)
  const { ctx } = world
  ctx.save()
  ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "bottom"
  const lineH = 13
  const padX = 6
  const padY = 5
  let width = 0
  for (const line of lines) width = Math.max(width, ctx.measureText(line).width)
  const height = lines.length * lineH
  const boxW = width + padX * 2
  const boxH = height + padY * 2
  const x = p.x
  const y = p.y - Math.max(10, (hit.radiusMm || 24) * world.cam.zoom) - 8
  ctx.fillStyle = "rgba(8, 12, 18, 0.78)"
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)"
  ctx.lineWidth = 1
  roundRect(ctx, x - boxW / 2, y - boxH, boxW, boxH, 4)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = "#f4fbff"
  ctx.shadowColor = "transparent"
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? "700 11px ui-sans-serif, system-ui, sans-serif" : "11px ui-sans-serif, system-ui, sans-serif"
    ctx.fillText(line, x, y - padY - (lines.length - 1 - i) * lineH)
  })
  ctx.restore()
}

function labelLines(hit: SightReport): string[] {
  const lines = [hit.label, `Distance: ${Math.round(hit.distanceMm)} mm`]
  if (hit.kind === "mineral" || hit.kind === "enemy") {
    lines.push(`Angle: ${Math.round(hit.relativeAngleDeg)}°`)
  }
  if (hit.kind === "enemy") {
    lines.push(`Level: ${hit.level ?? 0}  HP: ${Math.round(hit.hp ?? 0)}/${Math.round(hit.maxHp ?? 0)}`)
  }
  return lines
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export function drawAiOverlayPass(
  ctx: CanvasRenderingContext2D,
  state: RoverRescueState,
  robot: RobotState,
  cam: Camera,
): void {
  const world = createDrawWorld(ctx, cam)
  drawAiOverlay(world, state, robot)
}
