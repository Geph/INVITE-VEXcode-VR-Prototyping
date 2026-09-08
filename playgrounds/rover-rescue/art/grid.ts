import { worldToScreen } from "@/engine"
import { FIELD_BOUNDS, GRID_MM } from "../config"
import { type DrawWorld } from "./world-draw"

export function drawGrid(world: DrawWorld): void {
  const { ctx, cam, viewport, visible } = world
  const step = GRID_MM
  const minX = Math.max(FIELD_BOUNDS.minX, Math.floor(visible.minX / step) * step)
  const maxX = Math.min(FIELD_BOUNDS.maxX, Math.ceil(visible.maxX / step) * step)
  const minY = Math.max(FIELD_BOUNDS.minY, Math.floor(visible.minY / step) * step)
  const maxY = Math.min(FIELD_BOUNDS.maxY, Math.ceil(visible.maxY / step) * step)

  ctx.save()
  ctx.lineCap = "butt"

  ctx.beginPath()
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)"
  ctx.lineWidth = 1
  for (let x = minX; x <= maxX; x += step) {
    if (x % (step * 2) === 0) continue
    strokeVertical(world, x, minY, maxY)
  }
  for (let y = minY; y <= maxY; y += step) {
    if (y % (step * 2) === 0) continue
    strokeHorizontal(world, y, minX, maxX)
  }
  ctx.stroke()

  ctx.beginPath()
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)"
  ctx.lineWidth = 1.4
  for (let x = minX; x <= maxX; x += step) {
    if (x % (step * 2) !== 0 || x === 0) continue
    strokeVertical(world, x, minY, maxY)
  }
  for (let y = minY; y <= maxY; y += step) {
    if (y % (step * 2) !== 0 || y === 0) continue
    strokeHorizontal(world, y, minX, maxX)
  }
  ctx.stroke()

  ctx.beginPath()
  ctx.strokeStyle = "rgba(255, 220, 140, 0.55)"
  ctx.lineWidth = 1.6
  const x0 = worldToScreen({ x: 0, y: Math.max(minY, FIELD_BOUNDS.minY) }, cam, viewport)
  const x1 = worldToScreen({ x: 0, y: Math.min(maxY, FIELD_BOUNDS.maxY) }, cam, viewport)
  const y0 = worldToScreen({ x: Math.max(minX, FIELD_BOUNDS.minX), y: 0 }, cam, viewport)
  const y1 = worldToScreen({ x: Math.min(maxX, FIELD_BOUNDS.maxX), y: 0 }, cam, viewport)
  ctx.moveTo(x0.x, x0.y)
  ctx.lineTo(x1.x, x1.y)
  ctx.moveTo(y0.x, y0.y)
  ctx.lineTo(y1.x, y1.y)
  ctx.stroke()
  ctx.restore()
}

function strokeVertical(world: DrawWorld, x: number, minY: number, maxY: number): void {
  const a = worldToScreen({ x, y: minY }, world.cam, world.viewport)
  const b = worldToScreen({ x, y: maxY }, world.cam, world.viewport)
  world.ctx.moveTo(a.x, a.y)
  world.ctx.lineTo(b.x, b.y)
}

function strokeHorizontal(world: DrawWorld, y: number, minX: number, maxX: number): void {
  const a = worldToScreen({ x: minX, y }, world.cam, world.viewport)
  const b = worldToScreen({ x: maxX, y }, world.cam, world.viewport)
  world.ctx.moveTo(a.x, a.y)
  world.ctx.lineTo(b.x, b.y)
}
