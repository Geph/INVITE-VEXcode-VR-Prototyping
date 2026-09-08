import { createRng } from "@/engine"
import { BRIDGES, bridgeDeckRect, type BridgeSpec } from "../map-spec"
import { aabbOf, beginWorldPolygon, rectsOverlap, toScreen, type DrawWorld } from "./world-draw"

export function drawBridges(world: DrawWorld, seed: number, bridges: readonly BridgeSpec[] = BRIDGES): void {
  for (const bridge of bridges) {
    drawBridge(world, seed, bridge)
  }
}

function drawBridge(world: DrawWorld, seed: number, bridge: BridgeSpec): void {
  const deck = bridgeDeckRect(bridge)
  if (!rectsOverlap(aabbOf(deck), world.visible)) return
  const rng = createRng(seed).fork(`bridge:${bridge.id}`)
  const { ctx } = world

  ctx.save()
  ctx.fillStyle = "#8b6a3e"
  beginWorldPolygon(world, deck)
  ctx.fill()

  ctx.strokeStyle = "#5a4326"
  ctx.lineWidth = world.detail ? 2 : 1
  ctx.stroke()

  if (world.detail) {
    drawPlanks(world, bridge, rng.next())
    drawRails(world, bridge)
  }
  ctx.restore()
}

function drawPlanks(world: DrawWorld, bridge: BridgeSpec, salt: number): void {
  const planks = 8
  const { ctx } = world
  ctx.strokeStyle = `rgba(70, 48, 24, ${0.35 + salt * 0.15})`
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 1; i < planks; i++) {
    const t = i / planks
    const a = plankPoint(bridge, t, -1)
    const b = plankPoint(bridge, t, 1)
    const sa = toScreen(world, a)
    const sb = toScreen(world, b)
    ctx.moveTo(sa.x, sa.y)
    ctx.lineTo(sb.x, sb.y)
  }
  ctx.stroke()
}

function drawRails(world: DrawWorld, bridge: BridgeSpec): void {
  const { ctx } = world
  ctx.strokeStyle = "#3a2a16"
  ctx.lineWidth = 2.5
  ctx.beginPath()
  for (const side of [-1, 1] as const) {
    const a = plankPoint(bridge, 0, side)
    const b = plankPoint(bridge, 1, side)
    const sa = toScreen(world, a)
    const sb = toScreen(world, b)
    ctx.moveTo(sa.x, sa.y)
    ctx.lineTo(sb.x, sb.y)
  }
  ctx.stroke()
}

function plankPoint(bridge: BridgeSpec, along: number, side: -1 | 1) {
  const halfAlong = bridge.lengthMm / 2
  const halfAcross = bridge.widthMm / 2
  const t = (along - 0.5) * 2
  if (bridge.orientation === "NS") {
    return {
      x: bridge.centreMm.x + side * halfAcross,
      y: bridge.centreMm.y + t * halfAlong,
    }
  }
  return {
    x: bridge.centreMm.x + t * halfAlong,
    y: bridge.centreMm.y + side * halfAcross,
  }
}
