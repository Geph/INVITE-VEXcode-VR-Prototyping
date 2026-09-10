import type { RobotState } from "@/engine"
import { ROVER_LENGTH_MM, ROVER_WIDTH_MM } from "../config"
import { circleVisible, toScreen, type DrawWorld } from "./world-draw"

export function drawRover(world: DrawWorld, robot: RobotState, _seed: number): void {
  if (!circleVisible({ x: robot.xMm, y: robot.yMm }, ROVER_LENGTH_MM, world.visible)) return
  const { ctx } = world
  const p = toScreen(world, { x: robot.xMm, y: robot.yMm })
  const scale = Math.max(world.cam.zoom, 20 / ROVER_LENGTH_MM)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(robot.headingDeg * Math.PI / 180)
  ctx.scale(scale, scale)
  // North is the sensor mast end. Panels stay inside the nominal rover width.
  ctx.fillStyle = "#292e2c"
  ctx.beginPath()
  for (const x of [-57, 37]) for (const y of [-64, 12]) ctx.rect(x, y, 20, 50)
  ctx.fill()
  ctx.fillStyle = "#152f4d"
  ctx.strokeStyle = "#49caee"
  ctx.lineWidth = 3
  ctx.beginPath()
  for (const side of [-1, 1]) {
    ctx.moveTo(side * 25, -52)
    ctx.lineTo(side * ROVER_WIDTH_MM / 2, -34)
    ctx.lineTo(side * (ROVER_WIDTH_MM / 2 - 5), 48)
    ctx.lineTo(side * 25, 66)
    ctx.closePath()
  }
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = "#858b78"
  ctx.fillRect(-23, -58, 46, 130)
  ctx.fillStyle = "#303b35"
  ctx.fillRect(-13, -42, 26, 96)
  ctx.fillStyle = "#81ffff"
  ctx.beginPath()
  ctx.moveTo(0, -84)
  ctx.lineTo(13, -59)
  ctx.lineTo(-13, -59)
  ctx.closePath()
  ctx.rect(-8, 33, 16, 14)
  ctx.fill()
  if (world.userScale >= 1.25) drawHardware(ctx)
  ctx.restore()
}

function drawHardware(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "#559ece"
  ctx.lineWidth = 1.4
  ctx.beginPath()
  for (const side of [-1, 1]) {
    for (let x = 33; x <= 65; x += 8) {
      ctx.moveTo(side * x, -30)
      ctx.lineTo(side * x, 44)
    }
    for (let y = -24; y <= 40; y += 8) {
      ctx.moveTo(side * 28, y)
      ctx.lineTo(side * 68, y)
    }
  }
  ctx.stroke()
  ctx.strokeStyle = "#c4a448"
  ctx.lineWidth = 2
  ctx.beginPath()
  for (const side of [-1, 1]) {
    ctx.moveTo(side * 45, -34)
    ctx.lineTo(side * 45, 48)
  }
  ctx.stroke()
  ctx.fillStyle = "#b7baa0"
  ctx.fillRect(-4, -88, 8, 54)
  ctx.fillRect(-27, -41, 54, 9)
  ctx.fillRect(-27, 52, 54, 9)
  ctx.fillStyle = "#222f2d"
  ctx.fillRect(-17, -92, 34, 19)
  ctx.fillStyle = "#80eef2"
  ctx.beginPath()
  ctx.arc(-8, -83, 4, 0, Math.PI * 2)
  ctx.arc(8, -83, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#126e68"
  ctx.fillRect(-10, -18, 20, 40)
  ctx.strokeStyle = "#6e766b"
  ctx.lineWidth = 3
  ctx.beginPath()
  for (const x of [-54, 40]) {
    for (const y of [-59, -49, -39, -29, 18, 28, 38, 48]) {
      ctx.moveTo(x, y)
      ctx.lineTo(x + 14, y)
    }
  }
  ctx.stroke()
}
