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
  ctx.rotate((rng.next() - 0.5) * 0.18)
  ctx.fillStyle = "#1d4e5c"
  ctx.fillRect(-r * 0.78, -r, r * 1.56, r * 2)
  ctx.fillRect(-r * 0.28, -r * 1.25, r * 0.56, r * 0.3)
  ctx.fillStyle = "#3ee0ff"
  ctx.globalAlpha = 0.92
  ctx.fillRect(-r * 0.58, -r * 0.78, r * 1.16, r * 1.56)
  if (world.detail) {
    ctx.globalAlpha = 0.9
    ctx.fillStyle = "#e8ffff"
    ctx.beginPath()
    ctx.moveTo(r * 0.08, -r * 0.55)
    ctx.lineTo(-r * 0.32, r * 0.08)
    ctx.lineTo(-r * 0.02, r * 0.08)
    ctx.lineTo(-r * 0.12, r * 0.55)
    ctx.lineTo(r * 0.34, -r * 0.12)
    ctx.lineTo(r * 0.05, -r * 0.12)
    ctx.closePath()
    ctx.fill()
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
    const r = Math.max(2.3, mineral.radiusMm * world.cam.zoom)
    ctx.rect(p.x - r * 0.7, p.y - r, r * 1.4, r * 2)
    ctx.rect(p.x - r * 0.23, p.y - r * 1.28, r * 0.46, r * 0.3)
  }
  ctx.fill()
  ctx.restore()
}
