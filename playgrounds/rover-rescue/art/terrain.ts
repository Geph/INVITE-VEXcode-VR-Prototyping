import { createRng } from "@/engine"
import { FIELD_BOUNDS, GRID_MM } from "../config"
import { FIELD_RECT_MM, TERRAIN_BANDS, ZONES, type ZoneSpec } from "../map-spec"
import { fillWorldPolygon, type DrawWorld } from "./world-draw"

const STIPPLE_STEP_MM = GRID_MM
const STIPPLE_CAP = 220

export function drawTerrain(world: DrawWorld, seed: number, zones: readonly ZoneSpec[] = ZONES): void {
  const { ctx, viewport } = world
  ctx.fillStyle = "#8a6a3e"
  ctx.fillRect(0, 0, viewport.widthPx, viewport.heightPx)
  fillWorldPolygon(world, FIELD_RECT_MM, "#b07a3c")

  for (const band of TERRAIN_BANDS) {
    fillWorldPolygon(world, band.polygonMm, band.fillColor)
  }
  for (const zone of zones) {
    fillWorldPolygon(world, zone.polygonMm, zone.tintColor)
  }

  if (world.detail) {
    drawStipple(world, seed)
  }
}

function drawStipple(world: DrawWorld, seed: number): void {
  const { ctx, visible } = world
  const minX = Math.max(FIELD_BOUNDS.minX, Math.floor(visible.minX / STIPPLE_STEP_MM) * STIPPLE_STEP_MM)
  const maxX = Math.min(FIELD_BOUNDS.maxX, Math.ceil(visible.maxX / STIPPLE_STEP_MM) * STIPPLE_STEP_MM)
  const minY = Math.max(FIELD_BOUNDS.minY, Math.floor(visible.minY / STIPPLE_STEP_MM) * STIPPLE_STEP_MM)
  const maxY = Math.min(FIELD_BOUNDS.maxY, Math.ceil(visible.maxY / STIPPLE_STEP_MM) * STIPPLE_STEP_MM)

  ctx.save()
  ctx.fillStyle = "rgba(40, 24, 12, 0.18)"
  ctx.beginPath()
  let dots = 0
  for (let x = minX; x <= maxX && dots < STIPPLE_CAP; x += STIPPLE_STEP_MM) {
    for (let y = minY; y <= maxY && dots < STIPPLE_CAP; y += STIPPLE_STEP_MM) {
      const rng = createRng(seed).fork(`stipple:${x}:${y}`)
      const jitterX = (rng.next() - 0.5) * STIPPLE_STEP_MM * 0.7
      const jitterY = (rng.next() - 0.5) * STIPPLE_STEP_MM * 0.7
      const p = { x: x + jitterX, y: y + jitterY }
      if (p.x < visible.minX || p.x > visible.maxX || p.y < visible.minY || p.y > visible.maxY) continue
      const screen = {
        x: world.viewport.widthPx / 2 + (p.x - world.cam.centerMm.x) * world.cam.zoom,
        y: world.viewport.heightPx / 2 - (p.y - world.cam.centerMm.y) * world.cam.zoom,
      }
      const r = 0.6 + rng.next() * 1.1
      ctx.rect(screen.x, screen.y, r, r)
      dots++
    }
  }
  ctx.fill()
  ctx.restore()
}
