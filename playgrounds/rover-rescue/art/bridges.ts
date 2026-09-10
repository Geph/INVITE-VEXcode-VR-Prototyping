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
  ctx.fillStyle = "#686959"
  beginWorldPolygon(world, deck)
  ctx.fill()

  ctx.strokeStyle = "#343a33"
  ctx.lineWidth = world.detail ? 2 : 1
  ctx.stroke()

  if (world.detail) {
    drawPlanks(world, bridge, rng.next())
    drawRails(world, bridge)
    drawDeckPanels(world, bridge)
  }
  ctx.restore()
}

function drawPlanks(world: DrawWorld, bridge: BridgeSpec, salt: number): void {
  const planks = 12
  const { ctx } = world
  ctx.strokeStyle = `rgba(30, 37, 31, ${0.35 + salt * 0.15})`
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
  ctx.strokeStyle = "#a4a28b"
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

function drawDeckPanels(world: DrawWorld, bridge: BridgeSpec): void {
  const { ctx } = world
  ctx.strokeStyle = "rgba(200,202,174,0.45)"
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const side of [-1, 1] as const) {
    const a = plankPoint(bridge, 0.03, side)
    const b = plankPoint(bridge, 0.97, side)
    const centreA = plankPoint(bridge, 0.03, -side as -1 | 1)
    const centreB = plankPoint(bridge, 0.97, -side as -1 | 1)
    const sa = toScreen(world, { x: a.x * 0.7 + centreA.x * 0.3, y: a.y * 0.7 + centreA.y * 0.3 })
    const sb = toScreen(world, { x: b.x * 0.7 + centreB.x * 0.3, y: b.y * 0.7 + centreB.y * 0.3 })
    ctx.moveTo(sa.x, sa.y)
    ctx.lineTo(sb.x, sb.y)
  }
  ctx.stroke()
}
