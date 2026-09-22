import {
  fitToBounds,
  visibleWorldRect,
  worldToScreen,
  type Camera,
  type Vec2,
  type Viewport,
  type WorldRect,
} from "@/engine"
import { DETAIL_LOD_USER_ZOOM, FIELD_BOUNDS } from "../config"

export interface DrawWorld {
  ctx: CanvasRenderingContext2D
  cam: Camera
  viewport: Viewport
  visible: WorldRect
  userScale: number
  detail: boolean
}

export function canvasViewport(ctx: CanvasRenderingContext2D): Viewport {
  return { widthPx: ctx.canvas.width, heightPx: ctx.canvas.height }
}

export function createDrawWorld(ctx: CanvasRenderingContext2D, cam: Camera): DrawWorld {
  const viewport = canvasViewport(ctx)
  const fit = fitToBounds(FIELD_BOUNDS, viewport)
  const userScale = fit.zoom > 0 ? cam.zoom / fit.zoom : 1
  return {
    ctx,
    cam,
    viewport,
    visible: visibleWorldRect(cam, viewport),
    userScale,
    detail: userScale >= DETAIL_LOD_USER_ZOOM,
  }
}

export function aabbOf(points: readonly Vec2[]): WorldRect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

export function rectsOverlap(a: WorldRect, b: WorldRect, padMm = 0): boolean {
  return a.minX <= b.maxX + padMm && a.maxX >= b.minX - padMm && a.minY <= b.maxY + padMm && a.maxY >= b.minY - padMm
}

export function circleVisible(center: Vec2, radiusMm: number, visible: WorldRect): boolean {
  return (
    center.x + radiusMm >= visible.minX &&
    center.x - radiusMm <= visible.maxX &&
    center.y + radiusMm >= visible.minY &&
    center.y - radiusMm <= visible.maxY
  )
}

export function toScreen(world: DrawWorld, point: Vec2): Vec2 {
  return worldToScreen(point, world.cam, world.viewport)
}

export function beginWorldPolygon(world: DrawWorld, points: readonly Vec2[]): void {
  const { ctx } = world
  ctx.beginPath()
  if (points.length === 0) return
  const first = toScreen(world, points[0])
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < points.length; i++) {
    const p = toScreen(world, points[i])
    ctx.lineTo(p.x, p.y)
  }
  ctx.closePath()
}

export function fillWorldPolygon(world: DrawWorld, points: readonly Vec2[], fill: string): void {
  if (points.length < 3) return
  if (!rectsOverlap(aabbOf(points), world.visible)) return
  world.ctx.fillStyle = fill
  beginWorldPolygon(world, points)
  world.ctx.fill()
}

export function strokeWorldPolygon(world: DrawWorld, points: readonly Vec2[], stroke: string, lineWidthPx: number): void {
  if (points.length < 2) return
  if (!rectsOverlap(aabbOf(points), world.visible)) return
  world.ctx.strokeStyle = stroke
  world.ctx.lineWidth = lineWidthPx
  beginWorldPolygon(world, points)
  world.ctx.stroke()
}

export function fillWorldCircle(world: DrawWorld, center: Vec2, radiusMm: number, fill: string): void {
  if (!circleVisible(center, radiusMm, world.visible)) return
  const p = toScreen(world, center)
  world.ctx.beginPath()
  world.ctx.arc(p.x, p.y, radiusMm * world.cam.zoom, 0, Math.PI * 2)
  world.ctx.fillStyle = fill
  world.ctx.fill()
}
