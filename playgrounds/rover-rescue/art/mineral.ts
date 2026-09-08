import { createRng } from "@/engine"
import type { MineralEntity } from "../entities"
import { circleVisible, toScreen, type DrawWorld } from "./world-draw"

export function drawMineral(world: DrawWorld, mineral: MineralEntity): void {
  if (mineral.state !== "field") return
  if (!circleVisible(mineral.posMm, mineral.radiusMm, world.visible)) return
  const rng = createRng(mineral.id.split("").reduce((h, c) => h + c.charCodeAt(0), 1)).fork("mineral")
  const p = toScreen(world, mineral.posMm)
  const r = Math.max(2.5, mineral.radiusMm * world.cam.zoom)
  const { ctx } = world
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate((rng.next() - 0.5) * 0.4)
  ctx.fillStyle = "#1d4e5c"
  ctx.fillRect(-r, -r, r * 2, r * 2)
  ctx.fillStyle = "#3ee0ff"
  ctx.globalAlpha = 0.92
  ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4)
  if (world.detail) {
    ctx.globalAlpha = 0.55
    ctx.fillStyle = "#e8ffff"
    ctx.fillRect(-r * 0.25, -r * 0.25, r * 0.5, r * 0.5)
  }
  ctx.restore()
}

export function batchMinerals(world: DrawWorld, minerals: readonly MineralEntity[]): void {
  const { ctx } = world
  ctx.save()
  ctx.fillStyle = "#3ee0ff"
  ctx.beginPath()
  for (const mineral of minerals) {
    if (mineral.state !== "field") continue
    if (!circleVisible(mineral.posMm, mineral.radiusMm, world.visible)) continue
    const p = toScreen(world, mineral.posMm)
    const r = Math.max(2, mineral.radiusMm * world.cam.zoom)
    ctx.rect(p.x - r, p.y - r, r * 2, r * 2)
  }
  ctx.fill()
  ctx.restore()
}
