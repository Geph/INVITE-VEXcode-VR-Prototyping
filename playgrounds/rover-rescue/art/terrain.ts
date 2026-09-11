import { FIELD_BOUNDS } from "../config"
import { FIELD_RECT_MM, ZONES, type ZoneSpec } from "../map-spec"
import { fillWorldPolygon, toScreen, type DrawWorld } from "./world-draw"
import { terrainTexture } from "./terrain-texture"
import { drawLandforms } from "./landforms"

export function drawTerrain(world: DrawWorld, seed: number, _zones: readonly ZoneSpec[] = ZONES): void {
  const { ctx, viewport } = world
  ctx.fillStyle = "#40382d"
  ctx.fillRect(0, 0, viewport.widthPx, viewport.heightPx)
  fillWorldPolygon(world, FIELD_RECT_MM, "#958552")
  drawLandforms(world)
  const texture = terrainTexture(seed)
  if (!texture) return
  const corner = toScreen(world, { x: FIELD_BOUNDS.minX, y: FIELD_BOUNDS.maxY })
  ctx.save()
  ctx.globalCompositeOperation = "soft-light"
  ctx.drawImage(texture, corner.x, corner.y,
    (FIELD_BOUNDS.maxX - FIELD_BOUNDS.minX) * world.cam.zoom,
    (FIELD_BOUNDS.maxY - FIELD_BOUNDS.minY) * world.cam.zoom)
  ctx.restore()
}
