import { GRID_MM } from "../config"
import type { DrawWorld } from "./world-draw"

/** Screen-space cartography: north stays up; the ruler measures the current zoom. */
export function drawCartography({ ctx, viewport, cam }: DrawWorld): void {
  const x = viewport.widthPx - 62
  const y = 55
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = "#f3edda"
  ctx.fillStyle = "#f3edda"
  ctx.shadowColor = "rgba(27,26,18,0.7)"
  ctx.shadowBlur = 3
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(0, 0, 28, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4 - Math.PI / 2
    const length = i % 2 ? 22 : 35
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(angle - 0.3) * 7, Math.sin(angle - 0.3) * 7)
    ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length)
    ctx.closePath()
  }
  ctx.fill()
  ctx.font = "600 10px system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("N", 0, -43)
  ctx.fillText("E", 43, 0)
  ctx.fillText("S", 0, 43)
  ctx.fillText("W", -43, 0)
  // One grid square, so the bar matches the 500 mm field lines.
  const mm = GRID_MM
  const width = mm * cam.zoom
  ctx.lineWidth = 1
  ctx.strokeRect(-width / 2, 65, width, 5)
  ctx.fillRect(0, 65, width / 2, 5)
  ctx.font = "10px system-ui, sans-serif"
  ctx.fillText("0", -width / 2, 56)
  ctx.fillText(`${mm}`, width / 2, 56)
  ctx.fillText("mm · 1 grid", 0, 82)
  ctx.restore()
}
