import type { Camera, Viewport } from "@/engine"
import { worldToScreen } from "@/engine"
import { HEX_RADIUS_MM } from "../config"
import { hexVertices } from "../layout"
import type { CastlePiece } from "../state"

export function drawCastleField(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  viewport: Viewport,
  elapsedMs: number,
): void {
  drawWater(ctx, viewport, elapsedMs)
  const verts = hexVertices().map((p) => worldToScreen(p, cam, viewport))
  ctx.beginPath()
  ctx.moveTo(verts[0].x, verts[0].y)
  for (const v of verts.slice(1)) ctx.lineTo(v.x, v.y)
  ctx.closePath()
  ctx.fillStyle = "#4CAF50"
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = "#8B1E1E"
  ctx.stroke()

  // Inner grass highlight.
  const inner = hexVertices(HEX_RADIUS_MM * 0.96).map((p) => worldToScreen(p, cam, viewport))
  ctx.beginPath()
  ctx.moveTo(inner[0].x, inner[0].y)
  for (const v of inner.slice(1)) ctx.lineTo(v.x, v.y)
  ctx.closePath()
  ctx.fillStyle = "rgba(255,255,255,0.06)"
  ctx.fill()
}

export function drawCastlePieces(
  ctx: CanvasRenderingContext2D,
  pieces: CastlePiece[],
  cam: Camera,
  viewport: Viewport,
): void {
  for (const piece of pieces) {
    if (piece.cleared) continue
    const screen = worldToScreen({ x: piece.xMm, y: piece.yMm }, cam, viewport)
    const scale = cam.zoom
    ctx.save()
    ctx.translate(screen.x, screen.y)
    ctx.rotate((piece.headingDeg * Math.PI) / 180)
    paintPiece(ctx, piece, scale)
    ctx.restore()
  }
}

function drawWater(ctx: CanvasRenderingContext2D, viewport: Viewport, elapsedMs: number) {
  const g = ctx.createLinearGradient(0, 0, viewport.widthPx, viewport.heightPx)
  g.addColorStop(0, "#1E88E5")
  g.addColorStop(0.5, "#42A5F5")
  g.addColorStop(1, "#1565C0")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, viewport.widthPx, viewport.heightPx)

  ctx.strokeStyle = "rgba(255,255,255,0.18)"
  ctx.lineWidth = 1.5
  const phase = elapsedMs * 0.002
  for (let i = 0; i < 18; i++) {
    const y = ((i * 47 + phase * 30) % (viewport.heightPx + 40)) - 20
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x <= viewport.widthPx; x += 24) {
      ctx.lineTo(x, y + Math.sin(x * 0.04 + phase + i) * 4)
    }
    ctx.stroke()
  }
}

function paintPiece(ctx: CanvasRenderingContext2D, piece: CastlePiece, zoom: number) {
  const w = piece.halfWMm * 2 * zoom
  const h = piece.halfHMm * 2 * zoom
  if (piece.kind === "rock") {
    ctx.fillStyle = "#B0BEC5"
    ctx.beginPath()
    ctx.ellipse(0, 0, w * 0.55, h * 0.45, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "#78909C"
    ctx.stroke()
    return
  }
  if (piece.kind === "tree") {
    ctx.fillStyle = "#2E7D32"
    ctx.beginPath()
    ctx.arc(0, 0, Math.max(w, h) * 0.45, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#5D4037"
    ctx.fillRect(-4 * zoom, 0, 8 * zoom, h * 0.4)
    return
  }
  if (piece.kind === "tower") {
    ctx.fillStyle = "#ECEFF1"
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.fillStyle = "#42A5F5"
    ctx.fillRect(-w / 2, -h / 2, w, h * 0.35)
    ctx.fillStyle = "#E53935"
    ctx.beginPath()
    ctx.moveTo(0, -h * 0.85)
    ctx.lineTo(w * 0.55, -h * 0.15)
    ctx.lineTo(-w * 0.55, -h * 0.15)
    ctx.closePath()
    ctx.fill()
    return
  }
  if (piece.kind === "keep") {
    ctx.fillStyle = "#90CAF9"
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.strokeStyle = "#1565C0"
    ctx.lineWidth = 2
    ctx.strokeRect(-w / 2, -h / 2, w, h)
    ctx.fillStyle = "#E53935"
    ctx.fillRect(-w * 0.2, -h * 0.55, w * 0.4, h * 0.25)
    return
  }
  // wall / roof
  ctx.fillStyle = "#90A4AE"
  ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.strokeStyle = "#546E7A"
  ctx.strokeRect(-w / 2, -h / 2, w, h)
}

export function drawCastleRobot(
  ctx: CanvasRenderingContext2D,
  robot: { xMm: number; yMm: number; headingDeg: number },
  cam: Camera,
  viewport: Viewport,
): void {
  const p = worldToScreen({ x: robot.xMm, y: robot.yMm }, cam, viewport)
  const s = Math.max(8, 18 * cam.zoom * 12)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate((robot.headingDeg * Math.PI) / 180)
  ctx.fillStyle = "#263238"
  ctx.fillRect(-s * 0.45, -s * 0.35, s * 0.9, s * 0.7)
  ctx.fillStyle = "#FFD54F"
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.55)
  ctx.lineTo(s * 0.25, 0)
  ctx.lineTo(-s * 0.25, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
