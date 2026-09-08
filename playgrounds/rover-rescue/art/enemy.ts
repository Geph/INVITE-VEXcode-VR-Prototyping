import { createRng } from "@/engine"
import type { EnemyEntity, SerpentColor } from "../entities"
import { circleVisible, toScreen, type DrawWorld } from "./world-draw"

const SERPENT_TINT: Record<SerpentColor, string> = {
  orange: "#e07a2a",
  blue: "#3b7ad9",
  purple: "#8b5cf6",
}

export function drawEnemy(world: DrawWorld, enemy: EnemyEntity): void {
  if (enemy.state === "neutralized") return
  if (!circleVisible(enemy.posMm, enemy.radiusMm, world.visible)) return
  if (enemy.kind === "serpent") drawSerpent(world, enemy)
  else drawSpider(world, enemy)
}

export function batchEnemies(world: DrawWorld, enemies: readonly EnemyEntity[]): void {
  const { ctx } = world
  ctx.save()
  ctx.fillStyle = "#1a1410"
  ctx.beginPath()
  for (const enemy of enemies) {
    if (enemy.kind !== "spider" || enemy.state === "neutralized") continue
    if (!circleVisible(enemy.posMm, enemy.radiusMm, world.visible)) continue
    addDot(world, enemy, 0.7)
  }
  ctx.fill()
  for (const color of Object.keys(SERPENT_TINT) as SerpentColor[]) {
    ctx.fillStyle = SERPENT_TINT[color]
    ctx.beginPath()
    let any = false
    for (const enemy of enemies) {
      if (enemy.kind !== "serpent" || enemy.serpentColor !== color || enemy.state === "neutralized") continue
      if (!circleVisible(enemy.posMm, enemy.radiusMm, world.visible)) continue
      addDot(world, enemy, 0.85)
      any = true
    }
    if (any) ctx.fill()
  }
  ctx.restore()
}

function addDot(world: DrawWorld, enemy: EnemyEntity, scale: number): void {
  const p = toScreen(world, enemy.posMm)
  const r = Math.max(1.8, enemy.radiusMm * world.cam.zoom * scale)
  world.ctx.rect(p.x - r, p.y - r, r * 2, r * 2)
}

function drawSpider(world: DrawWorld, enemy: EnemyEntity): void {
  const rng = createRng(enemy.artSeed).fork("spider")
  const p = toScreen(world, enemy.posMm)
  const r = Math.max(2, enemy.radiusMm * world.cam.zoom)
  const { ctx } = world
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.strokeStyle = "#1b1612"
  ctx.lineWidth = Math.max(1, r * 0.18)
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rng.next() * 0.1
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.stroke()
  ctx.fillStyle = "#221c18"
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawSerpent(world: DrawWorld, enemy: EnemyEntity): void {
  const rng = createRng(enemy.artSeed).fork("serpent")
  const p = toScreen(world, enemy.posMm)
  const r = Math.max(2, enemy.radiusMm * world.cam.zoom)
  const tint = enemy.serpentColor ? SERPENT_TINT[enemy.serpentColor] : "#e07a2a"
  const { ctx } = world
  const heading = rng.next() * Math.PI * 2
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(heading)
  ctx.fillStyle = tint
  ctx.beginPath()
  ctx.moveTo(-r, 0)
  for (let i = 0; i < 5; i++) {
    const x = -r + (i / 4) * r * 2
    const y = Math.sin(i * 1.1 + enemy.wanderPhase) * r * 0.35
    ctx.lineTo(x, y - r * 0.28)
  }
  for (let i = 4; i >= 0; i--) {
    const x = -r + (i / 4) * r * 2
    const y = Math.sin(i * 1.1 + enemy.wanderPhase) * r * 0.35
    ctx.lineTo(x, y + r * 0.28)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
