import { worldToScreen, type Vec2 } from "@/engine"
import type { BridgeSpec, RiverHazard, ZoneSpec } from "../map-spec"
import { aabbOf, beginWorldPolygon, rectsOverlap, toScreen, type DrawWorld } from "./world-draw"

const ZONE_STROKES = ["#7eb6ff", "#c5c9d0", "#7eb6ff", "#ffb074", "#ff8080", "#c090ff"]

export function drawDebugOverlay(
  world: DrawWorld,
  zones: readonly ZoneSpec[],
  hazard: RiverHazard,
  bridges: readonly BridgeSpec[],
  riverCenterline: readonly Vec2[],
): void {
  const { ctx } = world
  ctx.save()

  zones.forEach((zone, index) => {
    if (!rectsOverlap(aabbOf(zone.polygonMm), world.visible)) return
    ctx.strokeStyle = ZONE_STROKES[index % ZONE_STROKES.length]
    ctx.lineWidth = 1.5
    beginWorldPolygon(world, zone.polygonMm)
    ctx.stroke()
    zone.polygonMm.forEach((vertex, vertexIndex) => drawHandle(world, vertex, `${zone.id}:${vertexIndex}`))
  })

  if (rectsOverlap(aabbOf(hazard.outer), world.visible)) {
    ctx.strokeStyle = "#4ade80"
    ctx.lineWidth = 2
    beginWorldPolygon(world, hazard.outer)
    ctx.stroke()
  }

  riverCenterline.forEach((vertex, index) => drawHandle(world, vertex, `river:${index}`))

  for (const bridge of bridges) {
    const hx = bridge.orientation === "NS" ? bridge.widthMm / 2 : bridge.lengthMm / 2
    const hy = bridge.orientation === "NS" ? bridge.lengthMm / 2 : bridge.widthMm / 2
    const rect = [
      { x: bridge.centreMm.x - hx, y: bridge.centreMm.y - hy },
      { x: bridge.centreMm.x + hx, y: bridge.centreMm.y - hy },
      { x: bridge.centreMm.x + hx, y: bridge.centreMm.y + hy },
      { x: bridge.centreMm.x - hx, y: bridge.centreMm.y + hy },
    ]
    ctx.strokeStyle = "#fbbf24"
    ctx.lineWidth = 1.5
    beginWorldPolygon(world, rect)
    ctx.stroke()
    drawHandle(world, bridge.centreMm, `bridge:${bridge.id}`)
  }

  ctx.restore()
}

function drawHandle(world: DrawWorld, vertex: Vec2, _id: string): void {
  const p = toScreen(world, vertex)
  const { ctx } = world
  ctx.beginPath()
  ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
  ctx.fillStyle = "#111827"
  ctx.fill()
  ctx.strokeStyle = "#f8fafc"
  ctx.lineWidth = 1.5
  ctx.stroke()
}

export function hitDebugHandle(
  screen: Vec2,
  cam: DrawWorld["cam"],
  viewport: DrawWorld["viewport"],
  zones: readonly ZoneSpec[],
  riverCenterline: readonly Vec2[],
  bridges: readonly BridgeSpec[],
  radiusPx = 10,
): { kind: "zone" | "river" | "bridge"; index: number; vertex: number } | null {
  const hits: Array<{ kind: "zone" | "river" | "bridge"; index: number; vertex: number; dist: number }> = []
  zones.forEach((zone, index) => {
    zone.polygonMm.forEach((vertex, vertexIndex) => {
      const p = worldToScreen(vertex, cam, viewport)
      const dist = Math.hypot(p.x - screen.x, p.y - screen.y)
      if (dist <= radiusPx) hits.push({ kind: "zone", index, vertex: vertexIndex, dist })
    })
  })
  riverCenterline.forEach((vertex, vertexIndex) => {
    const p = worldToScreen(vertex, cam, viewport)
    const dist = Math.hypot(p.x - screen.x, p.y - screen.y)
    if (dist <= radiusPx) hits.push({ kind: "river", index: 0, vertex: vertexIndex, dist })
  })
  bridges.forEach((bridge, index) => {
    const p = worldToScreen(bridge.centreMm, cam, viewport)
    const dist = Math.hypot(p.x - screen.x, p.y - screen.y)
    if (dist <= radiusPx) hits.push({ kind: "bridge", index, vertex: 0, dist })
  })
  hits.sort((a, b) => a.dist - b.dist)
  return hits[0] ? { kind: hits[0].kind, index: hits[0].index, vertex: hits[0].vertex } : null
}
