import { createRng, type Vec2 } from "@/engine"
import { RIVER_CENTERLINE, RIVER_WIDTH_MM, type RiverHazard, riverOuterPolygon } from "../map-spec"
import { aabbOf, beginWorldPolygon, rectsOverlap, toScreen, type DrawWorld } from "./world-draw"

const HIGHLIGHT_BANDS = 5

export function drawRiver(
  world: DrawWorld,
  seed: number,
  elapsedMs: number,
  hazard: RiverHazard,
  centerline: readonly Vec2[] = RIVER_CENTERLINE,
): void {
  if (!rectsOverlap(aabbOf(hazard.outer), world.visible, RIVER_WIDTH_MM)) return

  const { ctx } = world
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
  ctx.fillStyle = "#1f6b4a"
  ctx.fill("evenodd")

  ctx.strokeStyle = "#3d5a3a"
  ctx.lineWidth = world.detail ? 3 : 1.5
  ctx.stroke()
  ctx.restore()

  if (!world.detail || centerline.length < 2) return
  drawFlowHighlights(world, seed, elapsedMs, centerline)
}

function drawFlowHighlights(world: DrawWorld, seed: number, elapsedMs: number, centerline: readonly Vec2[]): void {
  const rng = createRng(seed).fork("river-flow")
  const { ctx } = world
  const lengths = segmentLengths(centerline)
  const total = lengths[lengths.length - 1] || 1
  const phase = ((elapsedMs / 4000) % 1 + 1) % 1

  ctx.save()
  ctx.strokeStyle = "rgba(180, 255, 210, 0.35)"
  ctx.lineWidth = 2
  ctx.lineCap = "round"
  ctx.beginPath()
  for (let i = 0; i < HIGHLIGHT_BANDS; i++) {
    const t = (phase + i / HIGHLIGHT_BANDS + rng.next() * 0.02) % 1
    const a = pointAlong(centerline, lengths, total, t)
    const b = pointAlong(centerline, lengths, total, Math.min(0.999, t + 0.06))
    const sa = toScreen(world, a)
    const sb = toScreen(world, b)
    ctx.moveTo(sa.x, sa.y)
    ctx.lineTo(sb.x, sb.y)
  }
  ctx.stroke()
  ctx.restore()
}

function segmentLengths(points: readonly Vec2[]): number[] {
  const out = [0]
  for (let i = 1; i < points.length; i++) {
    out.push(out[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }
  return out
}

function pointAlong(points: readonly Vec2[], lengths: number[], total: number, t: number): Vec2 {
  const target = t * total
  for (let i = 1; i < points.length; i++) {
    if (lengths[i] >= target) {
      const span = lengths[i] - lengths[i - 1] || 1
      const u = (target - lengths[i - 1]) / span
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * u,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * u,
      }
    }
  }
  return points[points.length - 1]
}

export function riverBankPolygon(centerline: readonly Vec2[] = RIVER_CENTERLINE): Vec2[] {
  return riverOuterPolygon(centerline, RIVER_WIDTH_MM)
}
