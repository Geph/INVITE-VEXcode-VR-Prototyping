import { FIELD_BOUNDS } from "../config"
import { FIELD_RECT_MM, TERRAIN_BANDS, ZONES, type ZoneSpec } from "../map-spec"
import { fillWorldPolygon, toScreen, type DrawWorld } from "./world-draw"
import { terrainTexture } from "./terrain-texture"

// Surface colours are separate from the sensing/debug zone colours and geometry.
const SURFACE: Record<string, string> = {
  B_WEST: "#555348", B_EAST: "#98697a", A: "#c28b35",
  C: "#aaa06a", D: "#85704b", E: "#665052",
}

export function drawTerrain(world: DrawWorld, seed: number, zones: readonly ZoneSpec[] = ZONES): void {
  const { ctx, viewport } = world
  ctx.fillStyle = "#40382d"
  ctx.fillRect(0, 0, viewport.widthPx, viewport.heightPx)
  fillWorldPolygon(world, FIELD_RECT_MM, "#a86f45")
  for (const band of TERRAIN_BANDS) fillWorldPolygon(world, band.polygonMm, band.fillColor)
  for (const zone of zones) fillWorldPolygon(world, zone.polygonMm, SURFACE[zone.id] ?? zone.tintColor)

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
