import type { MineralEntity } from "../entities"
import { circleVisible, toScreen, type DrawWorld } from "./world-draw"

export function drawMineral(world: DrawWorld, mineral: MineralEntity): void {
  batchMinerals(world, [mineral])
}

export function batchMinerals(world: DrawWorld, minerals: readonly MineralEntity[]): void {
  const visible = minerals.filter(m => m.state === "field" && circleVisible(m.posMm, m.radiusMm, world.visible))
  const { ctx } = world
  ctx.save()
  // A steel sample crate with gold straps; cyan remains its identifying accent.
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle = ["#263e40", "#b7a049", "#80f1ee"][layer]
    ctx.beginPath()
    for (const mineral of visible) {
      const p = toScreen(world, mineral.posMm)
      const r = Math.max(3.4, mineral.radiusMm * world.cam.zoom)
      if (layer === 0) {
        ctx.rect(p.x - r, p.y - r * 0.7, r * 2, r * 1.4)
      } else if (layer === 1) {
        ctx.rect(p.x - r * 0.65, p.y - r * 0.6, r * 0.27, r * 1.2)
        ctx.rect(p.x + r * 0.38, p.y - r * 0.6, r * 0.27, r * 1.2)
      } else {
        ctx.rect(p.x - r * 0.65, p.y - r * 0.85, r * 1.3, Math.max(0.8, r * 0.15))
      }
    }
    ctx.fill()
  }
  ctx.restore()
}
