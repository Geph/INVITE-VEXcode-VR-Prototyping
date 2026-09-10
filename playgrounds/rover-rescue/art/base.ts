import { BASE } from "../map-spec"
import { circleVisible, fillWorldCircle, toScreen, type DrawWorld } from "./world-draw"

export function drawBase(world: DrawWorld, base = BASE): void {
  if (!circleVisible(base.centreMm, base.radiusMm, world.visible)) return
  const { ctx } = world
  const p = toScreen(world, base.centreMm)
  const r = base.radiusMm * world.cam.zoom

  ctx.save()
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.fillStyle = "#6f705b"
  ctx.fill()
  ctx.lineWidth = world.detail ? 2.5 : 1.5
  ctx.strokeStyle = "#c4b992"
  ctx.stroke()

  fillWorldCircle(world, base.centreMm, base.radiusMm * 0.72, "#454d43")

  ctx.strokeStyle = "#fffbea"
  ctx.lineWidth = world.detail ? 3 : 2
  ctx.lineCap = "round"
  ctx.beginPath()
  const inset = r * 0.38
  ctx.moveTo(p.x - inset, p.y - inset)
  ctx.lineTo(p.x + inset, p.y + inset)
  ctx.moveTo(p.x + inset, p.y - inset)
  ctx.lineTo(p.x - inset, p.y + inset)
  ctx.stroke()

  ctx.fillStyle = "#f3f6f8"
  ctx.font = `${world.detail ? 11 : 9}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  ctx.fillText("Base", p.x, p.y + r + 4)
  ctx.restore()
}
