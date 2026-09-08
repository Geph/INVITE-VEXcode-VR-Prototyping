import { createRng, type RobotState } from "@/engine"
import { ROVER_LENGTH_MM, ROVER_WIDTH_MM } from "../config"
import { circleVisible, toScreen, type DrawWorld } from "./world-draw"

const MIN_SCREEN_LENGTH_PX = 18

export function drawRover(world: DrawWorld, robot: RobotState, seed: number): void {
  const halfLen = ROVER_LENGTH_MM / 2
  const halfWid = ROVER_WIDTH_MM / 2
  if (!circleVisible({ x: robot.xMm, y: robot.yMm }, Math.hypot(halfLen, halfWid), world.visible)) return

  const rng = createRng(seed).fork("rover")
  const accent = rng.next() > 0.35 ? "#3ee0c0" : "#4ad4e0"
  const p = toScreen(world, { x: robot.xMm, y: robot.yMm })
  const pxPerMm = Math.max(world.cam.zoom, MIN_SCREEN_LENGTH_PX / ROVER_LENGTH_MM)
  const { ctx } = world

  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate((robot.headingDeg * Math.PI) / 180)
  ctx.scale(pxPerMm, pxPerMm)

  if (!world.detail) {
    drawSimpleRover(ctx, halfLen, halfWid, accent)
    ctx.restore()
    return
  }

  ctx.fillStyle = "#1a1f24"
  roundedRect(ctx, -halfWid - 8, -halfLen * 0.35, 16, halfLen * 0.7, 3)
  ctx.fill()
  roundedRect(ctx, halfWid - 8, -halfLen * 0.35, 16, halfLen * 0.7, 3)
  ctx.fill()

  ctx.fillStyle = "#0b1c2e"
  ctx.strokeStyle = "#1e4a6e"
  ctx.lineWidth = 2
  roundedRect(ctx, -halfWid - 28, -halfLen * 0.28, 26, halfLen * 0.56, 2)
  ctx.fill()
  ctx.stroke()
  roundedRect(ctx, halfWid + 2, -halfLen * 0.28, 26, halfLen * 0.56, 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = "#2b333c"
  ctx.strokeStyle = "#8b949e"
  ctx.lineWidth = 2
  roundedRect(ctx, -halfWid, -halfLen, ROVER_WIDTH_MM, ROVER_LENGTH_MM, 12)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = accent
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.moveTo(0, -halfLen + 4)
  ctx.lineTo(18, -halfLen + 36)
  ctx.lineTo(-18, -halfLen + 36)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.fillStyle = "#1c2228"
  roundedRect(ctx, -22, -8, 44, 36, 4)
  ctx.fill()

  ctx.strokeStyle = accent
  ctx.globalAlpha = 0.7
  ctx.lineWidth = 2
  ctx.strokeRect(-halfWid + 6, -halfLen + 10, ROVER_WIDTH_MM - 12, 8)
  ctx.globalAlpha = 1

  ctx.restore()
}

function drawSimpleRover(
  ctx: CanvasRenderingContext2D,
  halfLen: number,
  halfWid: number,
  accent: string,
): void {
  ctx.fillStyle = "#2b333c"
  ctx.beginPath()
  ctx.rect(-halfWid, -halfLen, ROVER_WIDTH_MM, ROVER_LENGTH_MM)
  ctx.fill()
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.moveTo(0, -halfLen)
  ctx.lineTo(halfWid, -halfLen + 40)
  ctx.lineTo(-halfWid, -halfLen + 40)
  ctx.closePath()
  ctx.fill()
}

function roundedRect(
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
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}
