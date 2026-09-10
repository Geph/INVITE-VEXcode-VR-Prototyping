import type { ObstacleEntity } from "../entities"
import { circleVisible, toScreen, type DrawWorld } from "./world-draw"

// Batched facets keep both the full map and dense close-up views inexpensive.
export function batchObstacles(world: DrawWorld, obstacles: readonly ObstacleEntity[]): void {
  const visible = obstacles.filter(o => circleVisible(o.posMm, o.radiusMm, world.visible))
  const { ctx } = world
  ctx.save()
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle = ["#393c35", "#777867", "#a0a087"][layer]
    ctx.beginPath()
    for (const o of visible) if (o.kind === "rock") rockPath(world, o, layer)
    ctx.fill()
  }
  const palettes = [["#786c25", "#b8a33c"], ["#35584d", "#599282"], ["#86493d", "#c77948"]]
  for (let variant = 0; variant < palettes.length; variant++) {
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = palettes[variant][layer]
      ctx.beginPath()
      for (const o of visible) {
        if (o.kind === "plant" && o.artSeed % 3 === variant) plantPath(world, o, layer)
      }
      ctx.fill()
    }
  }
  ctx.restore()
}

export function drawObstacle(world: DrawWorld, obstacle: ObstacleEntity): void {
  batchObstacles(world, [obstacle])
}

function rockPath(world: DrawWorld, o: ObstacleEntity, layer: number): void {
  const p = toScreen(world, o.posMm)
  const r = Math.max(3, o.radiusMm * world.cam.zoom)
  const vertices = Array.from({ length: 6 }, (_, i) => {
    const angle = i * Math.PI / 3 + o.artSeed % 11
    const radius = r * (0.73 + ((o.artSeed + i * 7) % 5) * 0.06)
    return { x: p.x + Math.cos(angle) * radius, y: p.y + Math.sin(angle) * radius }
  })
  const points = layer === 0 ? vertices : layer === 1
    ? [vertices[0], vertices[1], vertices[2], vertices[3], { x: p.x - r * 0.12, y: p.y - r * 0.22 }]
    : [vertices[3], vertices[4], vertices[5], { x: p.x - r * 0.12, y: p.y - r * 0.22 }]
  const { ctx } = world
  ctx.moveTo(points[0].x, points[0].y)
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y)
  ctx.closePath()
}

function plantPath(world: DrawWorld, o: ObstacleEntity, layer: number): void {
  const p = toScreen(world, o.posMm)
  const r = Math.max(3.6, o.radiusMm * world.cam.zoom)
  const { ctx } = world
  const leaves = 7
  for (let i = 0; i < leaves; i++) {
    const a = i * Math.PI * 2 / leaves + o.artSeed % 17
    const length = r * (0.72 + ((o.artSeed + i) % 4) * 0.09)
    const tipX = p.x + Math.cos(a) * length
    const tipY = p.y + Math.sin(a) * length
    const side = layer === 0 ? -1 : 1
    ctx.moveTo(p.x, p.y)
    ctx.quadraticCurveTo(p.x + Math.cos(a + side * 0.65) * length * 0.65,
      p.y + Math.sin(a + side * 0.65) * length * 0.65, tipX, tipY)
    ctx.lineTo(p.x + Math.cos(a) * length * 0.36, p.y + Math.sin(a) * length * 0.36)
    ctx.closePath()
  }
}
