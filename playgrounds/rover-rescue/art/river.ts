import type { Vec2 } from "@/engine"
import { FIELD_BOUNDS } from "../config"
import { RIVER_CENTERLINE, RIVER_WIDTH_MM, type RiverHazard, riverOuterPolygon } from "../map-spec"
import { sampleRiverChannel } from "../river-curve"
import { terrainTexture } from "./terrain-texture"
import { aabbOf, beginWorldPolygon, rectsOverlap, toScreen, type DrawWorld } from "./world-draw"

export function drawRiver(
  world: DrawWorld, seed: number, elapsedMs: number, hazard: RiverHazard,
  centerline: readonly Vec2[] = RIVER_CENTERLINE,
): void {
  if (!rectsOverlap(aabbOf(hazard.outer), world.visible, RIVER_WIDTH_MM)) return
  const { ctx, cam } = world
  ctx.save()
  // The channel continues off-map; clip it at the field edge, without a bank cap.
  if (typeof ctx.clip === "function") {
    beginWorldPolygon(world, [
      { x: FIELD_BOUNDS.minX, y: FIELD_BOUNDS.minY },
      { x: FIELD_BOUNDS.maxX, y: FIELD_BOUNDS.minY },
      { x: FIELD_BOUNDS.maxX, y: FIELD_BOUNDS.maxY },
      { x: FIELD_BOUNDS.minX, y: FIELD_BOUNDS.maxY },
    ])
    ctx.clip()
  }
  beginWorldPolygon(world, hazard.outer)
  for (const hole of hazard.holes) {
    const first = toScreen(world, hole[0])
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < hole.length; i++) {
      const p = toScreen(world, hole[i])
      ctx.lineTo(p.x, p.y)
    }
    ctx.closePath()
  }
  const topLeft = toScreen(world, { x: FIELD_BOUNDS.minX, y: FIELD_BOUNDS.maxY })
  const bottomRight = toScreen(world, { x: FIELD_BOUNDS.maxX, y: FIELD_BOUNDS.minY })
  const gradient = ctx.createLinearGradient(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y)
  gradient.addColorStop(0, "#30b52a")
  gradient.addColorStop(0.5, "#3cbe29")
  gradient.addColorStop(1, "#279c27")
  ctx.fillStyle = gradient
  ctx.fill("evenodd")
  // Drawing, sensing and collision all use the same sampled banks and bridge holes.
  if (typeof ctx.clip === "function") ctx.clip("evenodd")
  ctx.strokeStyle = "#3d4934"
  ctx.lineWidth = Math.max(2, 145 * cam.zoom)
  ctx.stroke()
  ctx.strokeStyle = "#447d33"
  ctx.lineWidth = Math.max(1, 60 * cam.zoom)
  ctx.stroke()
  const texture = terrainTexture(seed)
  if (texture && typeof ctx.clip === "function") {
    ctx.save()
    ctx.globalCompositeOperation = "soft-light"
    ctx.globalAlpha = 0.6
    ctx.drawImage(texture, topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y)
    ctx.restore()
  }
  if (world.detail && centerline.length > 1) drawFlow(world, elapsedMs, sampleRiverChannel(centerline, RIVER_WIDTH_MM))
  ctx.restore()
}

function drawFlow(world: DrawWorld, elapsedMs: number, points: readonly Vec2[]): void {
  const { ctx } = world
  const phase = elapsedMs / 9000
  ctx.strokeStyle = "rgba(182,245,109,0.18)"
  ctx.lineWidth = Math.max(1, 13 * world.cam.zoom)
  ctx.lineCap = "round"
  ctx.beginPath()
  for (const band of [-1, 0, 1]) {
    for (let i = 0; i < points.length; i++) {
      const a = points[Math.max(0, i - 1)]
      const b = points[Math.min(points.length - 1, i + 1)]
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const offset = band * RIVER_WIDTH_MM * 0.21 + Math.sin(i * 0.15 - phase + band) * 28
      const p = toScreen(world, {
        x: points[i].x - (b.y - a.y) / length * offset,
        y: points[i].y + (b.x - a.x) / length * offset,
      })
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
  }
  ctx.stroke()
}

export function riverBankPolygon(centerline: readonly Vec2[] = RIVER_CENTERLINE): Vec2[] {
  return riverOuterPolygon(centerline, RIVER_WIDTH_MM)
}
