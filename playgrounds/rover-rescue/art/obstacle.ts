import { createRng } from "@/engine"
import type { ObstacleEntity } from "../entities"
import { circleVisible, toScreen, type DrawWorld } from "./world-draw"

export function drawObstacle(world: DrawWorld, obstacle: ObstacleEntity): void {
  if (!circleVisible(obstacle.posMm, obstacle.radiusMm, world.visible)) return
  if (obstacle.kind === "plant") drawPlant(world, obstacle)
  else drawRock(world, obstacle)
}

export function batchObstacles(world: DrawWorld, obstacles: readonly ObstacleEntity[]): void {
  const { ctx } = world
  ctx.save()
  ctx.fillStyle = "#4a3c32"
  ctx.beginPath()
  for (const obstacle of obstacles) {
    if (obstacle.kind !== "rock") continue
    if (!circleVisible(obstacle.posMm, obstacle.radiusMm, world.visible)) continue
    addDot(world, obstacle)
  }
  ctx.fill()
  ctx.fillStyle = "#3d6a3a"
  ctx.beginPath()
  for (const obstacle of obstacles) {
    if (obstacle.kind !== "plant") continue
    if (!circleVisible(obstacle.posMm, obstacle.radiusMm, world.visible)) continue
    addDot(world, obstacle)
  }
  ctx.fill()
  ctx.restore()
}

function addDot(world: DrawWorld, obstacle: ObstacleEntity): void {
  const p = toScreen(world, obstacle.posMm)
  const r = Math.max(1.6, obstacle.radiusMm * world.cam.zoom)
  world.ctx.rect(p.x - r, p.y - r, r * 2, r * 2)
}

function drawRock(world: DrawWorld, obstacle: ObstacleEntity): void {
  const rng = createRng(obstacle.artSeed).fork("rock")
  const p = toScreen(world, obstacle.posMm)
  const r = Math.max(2, obstacle.radiusMm * world.cam.zoom)
  const { ctx } = world
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.fillStyle = "#5a4a3e"
  ctx.beginPath()
  const sides = 6
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + rng.next() * 0.3
    const rad = r * (0.75 + rng.next() * 0.35)
    const x = Math.cos(a) * rad
    const y = Math.sin(a) * rad
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawPlant(world: DrawWorld, obstacle: ObstacleEntity): void {
  const rng = createRng(obstacle.artSeed).fork("plant")
  const p = toScreen(world, obstacle.posMm)
  const r = Math.max(2, obstacle.radiusMm * world.cam.zoom)
  const { ctx } = world
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.fillStyle = "#2f5d32"
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2)
  ctx.fill()
  if (world.detail) {
    ctx.fillStyle = "#4a8a46"
    for (let i = 0; i < 3; i++) {
      const a = rng.next() * Math.PI * 2
      ctx.beginPath()
      ctx.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.32, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}
