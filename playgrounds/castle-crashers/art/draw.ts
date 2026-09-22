import type { Camera, Viewport } from "@/engine"
import { worldToScreen } from "@/engine"
import { PLOW_FRONT_MM, PLOW_HALF_WIDTH_MM, PLOW_START } from "../config"
import type { CastlePiece } from "../state"
import { paintPiece } from "./masonry"
export { drawCastleField } from "./scenery"

export function drawCastlePieces(ctx: CanvasRenderingContext2D, pieces: CastlePiece[], cam: Camera, viewport: Viewport): void {
  // Foundations first; roofs and turrets cover their adjoining wall ends.
  const layer = (p: CastlePiece) => p.kind === "keep" || p.kind === "ramp" ? 0
    : p.kind === "wall" || p.kind === "castle-wall" ? 1 : 2
  for (const piece of [...pieces].sort((a, b) => layer(a) - layer(b))) {
    if (piece.cleared) continue
    const p = worldToScreen({ x: piece.xMm, y: piece.yMm }, cam, viewport)
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(piece.headingDeg * Math.PI / 180); ctx.scale(cam.zoom, cam.zoom)
    paintPiece(ctx, piece)
    ctx.restore()
  }
}

/** The blade opens towards the robot's forward direction (local screen -Y). */
function paintPlow(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#252a25"; ctx.fillRect(-9, 0, 18, 34)
  ctx.beginPath(); ctx.arc(0, 35, 14, 0, Math.PI * 2); ctx.fill()
  ctx.lineJoin = "bevel"; ctx.beginPath()
  ctx.moveTo(-PLOW_HALF_WIDTH_MM, -32); ctx.lineTo(-73, 0); ctx.lineTo(73, 0); ctx.lineTo(PLOW_HALF_WIDTH_MM, -32)
  ctx.strokeStyle = "#594e3a"; ctx.lineWidth = 20; ctx.stroke()
  ctx.strokeStyle = "#9a7a4f"; ctx.lineWidth = 12; ctx.stroke()
  ctx.strokeStyle = "#b29a74"; ctx.lineWidth = 3; ctx.stroke()
  ctx.fillStyle = "#594936"
  for (const x of [-67, 67]) ctx.fillRect(x - 3, -5, 6, 8)
}

export function drawCastlePlow(ctx: CanvasRenderingContext2D, cam: Camera, viewport: Viewport): void {
  const p = worldToScreen({ x: PLOW_START.xMm, y: PLOW_START.yMm }, cam, viewport)
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(cam.zoom, cam.zoom); paintPlow(ctx); ctx.restore()
}

export function drawCastleRobot(ctx: CanvasRenderingContext2D,
  robot: { xMm: number; yMm: number; headingDeg: number }, cam: Camera, viewport: Viewport, plowAttached = false): void {
  const p = worldToScreen({ x: robot.xMm, y: robot.yMm }, cam, viewport)
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(robot.headingDeg * Math.PI / 180); ctx.scale(cam.zoom, cam.zoom)
  ctx.fillStyle = "#24302355"; ctx.fillRect(-57, -55, 125, 140)
  // Four rubber wheels, machined chassis rails, battery and front sensors.
  for (const x of [-55, 42]) for (const y of [-50, 22]) {
    ctx.fillStyle = "#252b2b"; ctx.fillRect(x, y, 19, 42); ctx.fillStyle = "#626762"
    for (let t = 0; t < 5; t++) ctx.fillRect(x + 2, y + 4 + t * 7, 15, 2)
  }
  ctx.fillStyle = "#848d87"; ctx.fillRect(-45, -53, 90, 122)
  ctx.fillStyle = "#c3c6b8"; ctx.fillRect(-39, -48, 78, 109)
  ctx.fillStyle = "#575f59"; ctx.fillRect(-25, -21, 50, 57)
  ctx.fillStyle = "#aab1a3"; ctx.fillRect(-20, -17, 40, 43)
  ctx.fillStyle = "#283730"; ctx.fillRect(-12, -8, 24, 18)
  ctx.fillStyle = "#5faab0"; ctx.fillRect(-8, -5, 16, 9)
  for (const x of [-37, 27]) {
    ctx.fillStyle = "#d8dbca"; ctx.fillRect(x, -71, 10, 125); ctx.fillStyle = "#747970"
    for (let y = -45; y < 54; y += 14) ctx.fillRect(x + 3, y, 4, 5)
    ctx.fillStyle = "#dda83d"; ctx.fillRect(x - 3, -72, 16, 13)
    ctx.fillStyle = "#eef3e7"; ctx.fillRect(x - 2, -62, 14, 16)
  }
  ctx.strokeStyle = "#c0a447"; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(-23, 24); ctx.lineTo(-29, 44); ctx.lineTo(22, 44); ctx.lineTo(25, 17); ctx.stroke()
  if (plowAttached) { ctx.translate(0, -PLOW_FRONT_MM); paintPlow(ctx) }
  ctx.restore()
}
