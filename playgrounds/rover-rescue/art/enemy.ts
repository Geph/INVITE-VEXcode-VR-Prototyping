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
  ctx.strokeStyle = "#17110e"
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const enemy of enemies) {
    if (enemy.kind !== "spider" || enemy.state === "neutralized") continue
    if (!circleVisible(enemy.posMm, enemy.radiusMm, world.visible)) continue
    addSpiderLegs(world, enemy)
  }
  ctx.stroke()
  ctx.fillStyle = "#1a1410"
  ctx.beginPath()
  for (const enemy of enemies) {
    if (enemy.kind !== "spider" || enemy.state === "neutralized") continue
    if (!circleVisible(enemy.posMm, enemy.radiusMm, world.visible)) continue
    addSpiderBody(world, enemy)
  }
  ctx.fill()
  for (const color of Object.keys(SERPENT_TINT) as SerpentColor[]) {
    ctx.strokeStyle = SERPENT_TINT[color]
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = 3.2
    ctx.beginPath()
    let any = false
    for (const enemy of enemies) {
      if (enemy.kind !== "serpent" || enemy.serpentColor !== color || enemy.state === "neutralized") continue
      if (!circleVisible(enemy.posMm, enemy.radiusMm, world.visible)) continue
      addSerpent(world, enemy)
      any = true
    }
    if (any) ctx.stroke()
  }
  ctx.restore()
}

function addSpiderLegs(world: DrawWorld, enemy: EnemyEntity): void {
  const p = toScreen(world, enemy.posMm)
  const r = Math.max(3.5, enemy.radiusMm * world.cam.zoom)
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      world.ctx.moveTo(p.x + side * r * 0.28, p.y + i * r * 0.25)
      world.ctx.lineTo(p.x + side * r, p.y + i * r * 0.5)
    }
  }
}

function addSpiderBody(world: DrawWorld, enemy: EnemyEntity): void {
  const p = toScreen(world, enemy.posMm)
  const r = Math.max(3.5, enemy.radiusMm * world.cam.zoom)
  world.ctx.moveTo(p.x + r * 0.45, p.y)
  world.ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2)
  world.ctx.moveTo(p.x + r * 0.24, p.y - r * 0.42)
  world.ctx.arc(p.x, p.y - r * 0.42, r * 0.24, 0, Math.PI * 2)
}

function addSerpent(world: DrawWorld, enemy: EnemyEntity): void {
  const p = toScreen(world, enemy.posMm)
  const r = Math.max(4.5, enemy.radiusMm * world.cam.zoom)
  const heading = ((enemy.artSeed % 360) * Math.PI) / 180
  const cos = Math.cos(heading)
  const sin = Math.sin(heading)
  const point = (along: number, across: number) => ({
    x: p.x + cos * along - sin * across,
    y: p.y + sin * along + cos * across,
  })
  const start = point(-r, 0)
  world.ctx.moveTo(start.x, start.y)
  for (let i = 1; i <= 4; i++) {
    const along = -r + (i / 4) * r * 2
    const across = Math.sin(i * 1.8 + enemy.wanderPhase) * r * 0.28
    const next = point(along, across)
    world.ctx.lineTo(next.x, next.y)
  }
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
