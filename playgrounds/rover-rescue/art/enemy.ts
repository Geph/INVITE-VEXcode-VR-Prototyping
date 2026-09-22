import type { EnemyEntity, SerpentColor } from "../entities"
import { circleVisible, toScreen, type DrawWorld } from "./world-draw"

const SERPENT_TINT: Record<SerpentColor, string> = {
  orange: "#e2a744", blue: "#55afe1", purple: "#b886d9",
}

export function drawEnemy(world: DrawWorld, enemy: EnemyEntity): void {
  batchEnemies(world, [enemy])
}

export function batchEnemies(world: DrawWorld, enemies: readonly EnemyEntity[]): void {
  const visible = enemies.filter(e => e.state !== "neutralized" && circleVisible(e.posMm, e.radiusMm, world.visible))
  const { ctx } = world
  ctx.save()
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.strokeStyle = "#233f40"
  ctx.lineWidth = Math.max(1, world.cam.zoom * 9)
  ctx.beginPath()
  for (const e of visible) {
    if (e.kind !== "spider") continue
    const p = toScreen(world, e.posMm)
    const r = Math.max(4.2, e.radiusMm * world.cam.zoom)
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const t = (i - 1.5) / 1.5
      ctx.moveTo(p.x + side * r * 0.2, p.y + t * r * 0.2)
      ctx.lineTo(p.x + side * r * 0.7, p.y + t * r * 0.6)
      ctx.lineTo(p.x + side * r, p.y + t * r * 0.95 + r * 0.3)
    }
  }
  ctx.stroke()
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer === 0 ? "#315457" : "#ae8eac"
    ctx.beginPath()
    for (const e of visible) {
      if (e.kind !== "spider") continue
      const p = toScreen(world, e.posMm)
      const r = Math.max(4.2, e.radiusMm * world.cam.zoom) * (layer === 0 ? 0.38 : 0.17)
      ctx.moveTo(p.x + r, p.y)
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    }
    ctx.fill()
  }
  for (const color of Object.keys(SERPENT_TINT) as SerpentColor[]) {
    const serpents = visible.filter(e => e.kind === "serpent" && e.serpentColor === color)
    if (!serpents.length) continue
    for (let layer = 0; layer < 2; layer++) {
      ctx.strokeStyle = layer === 0 ? SERPENT_TINT[color] : "#285954"
      ctx.lineWidth = Math.max(layer === 0 ? 4 : 1.6, world.cam.zoom * (layer === 0 ? 38 : 19))
      ctx.beginPath()
      for (const e of serpents) serpentPath(world, e)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function serpentPath(world: DrawWorld, e: EnemyEntity): void {
  const p = toScreen(world, e.posMm)
  const r = Math.max(5, e.radiusMm * world.cam.zoom)
  const angle = e.artSeed % 360 * Math.PI / 180
  const point = (x: number, y: number) => ({
    x: p.x + Math.cos(angle) * x - Math.sin(angle) * y,
    y: p.y + Math.sin(angle) * x + Math.cos(angle) * y,
  })
  const { ctx } = world
  const tail = point(-r, 0)
  ctx.moveTo(tail.x, tail.y)
  for (let i = 1; i <= 8; i++) {
    const next = point(-r + i / 4 * r, Math.sin(i * 0.85 + e.wanderPhase) * r * 0.3)
    ctx.lineTo(next.x, next.y)
  }
}
