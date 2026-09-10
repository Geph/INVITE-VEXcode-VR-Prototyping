import { createRng, type Vec2 } from "@/engine"
import { RIVER_CENTERLINE, RIVER_WIDTH_MM, type RiverHazard, riverOuterPolygon } from "../map-spec"
import { aabbOf, beginWorldPolygon, rectsOverlap, toScreen, type DrawWorld } from "./world-draw"

export function drawRiver(
  world: DrawWorld, seed: number, elapsedMs: number, hazard: RiverHazard,
  centerline: readonly Vec2[] = RIVER_CENTERLINE,
): void {
  if (!rectsOverlap(aabbOf(hazard.outer), world.visible, RIVER_WIDTH_MM)) return
  const { ctx, cam } = world
  ctx.save()
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
  const gradient = ctx.createLinearGradient(0, 0, world.viewport.widthPx, world.viewport.heightPx)
  gradient.addColorStop(0, "#58c52c")
  gradient.addColorStop(0.5, "#35b526")
  gradient.addColorStop(1, "#79d62c")
  ctx.fillStyle = gradient
  ctx.fill("evenodd")
  // Keep shore shading and flow inside the actual hazard, including bridge holes.
  if (typeof ctx.clip === "function") ctx.clip("evenodd")
  ctx.strokeStyle = "#3d5032"
  ctx.lineWidth = Math.max(2, 170 * cam.zoom)
  ctx.stroke()
  ctx.strokeStyle = "#54873b"
  ctx.lineWidth = Math.max(1, 85 * cam.zoom)
  ctx.stroke()
  if (world.detail && centerline.length > 1) drawFlow(world, seed, elapsedMs, centerline)
  ctx.restore()
}

function drawFlow(world: DrawWorld, seed: number, elapsedMs: number, points: readonly Vec2[]): void {
  const { ctx } = world
  const rng = createRng(seed).fork("river-flow")
  const phase = ((elapsedMs / 6500) % 1 + 1) % 1
  ctx.strokeStyle = "rgba(197,255,111,0.27)"
  ctx.lineWidth = Math.max(1, 16 * world.cam.zoom)
  ctx.lineCap = "round"
  ctx.beginPath()
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
    for (let j = 0; j < 4; j++) {
      const t = (phase + j / 4 + rng.next() * 0.15) % 0.8
      const offset = (rng.next() - 0.5) * RIVER_WIDTH_MM * 0.52
      const x = a.x + (b.x - a.x) * t - (b.y - a.y) / length * offset
      const y = a.y + (b.y - a.y) * t + (b.x - a.x) / length * offset
      const start = toScreen(world, { x, y })
      const end = toScreen(world, { x: x + (b.x - a.x) * 0.16, y: y + (b.y - a.y) * 0.16 })
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
    }
  }
  ctx.stroke()
}

export function riverBankPolygon(centerline: readonly Vec2[] = RIVER_CENTERLINE): Vec2[] {
  return riverOuterPolygon(centerline, RIVER_WIDTH_MM)
}
