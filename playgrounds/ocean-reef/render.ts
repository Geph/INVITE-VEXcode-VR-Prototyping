import type { Camera, RobotState } from "@/engine"
import { distanceToPixels, drawFieldRulerOverlay, seededRandom } from "@/lib/robot-runtime"
import {
  coralToScreenPiece,
  drawCoralPiece,
  drawReefBed,
  drawSubmarine,
  reefWorldToScreen,
} from "./art"
import { START_POSE } from "./config"
import type { OceanReefState, OceanReefTrash } from "./entities"

function drawSandFloor(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, "#f4d6a2")
  gradient.addColorStop(0.5, "#e8c18e")
  gradient.addColorStop(1, "#d4a76a")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = "rgba(180, 140, 90, 0.15)"
  for (let i = 0; i < 200; i++) {
    ctx.beginPath()
    ctx.arc(seededRandom(i) * width, seededRandom(i + 50) * height, seededRandom(i + 100) * 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawTrashItem(
  ctx: CanvasRenderingContext2D,
  trash: OceanReefTrash,
  cam: Camera,
  viewport: { widthPx: number; heightPx: number },
  artScale: number,
): void {
  if (trash.isCollected) return
  const pos = reefWorldToScreen(trash.xMm, trash.yMm, cam, viewport)
  const trashX = pos.x
  const trashY = pos.y + Math.sin(trash.floatOffset) * 3
  const trashScale = trash.scale * artScale

  ctx.save()
  ctx.translate(trashX, trashY)
  ctx.scale(trashScale, trashScale)

  switch (trash.type) {
    case "bottle":
      ctx.fillStyle = "#87CEEB"
      ctx.strokeStyle = "#5BA3C6"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = "#4A90E2"
      ctx.fillRect(-3, -18, 6, 6)
      break
    case "can":
      ctx.fillStyle = "#C0C0C0"
      ctx.strokeStyle = "#808080"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(-6, -10, 12, 20, 3)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = "#E74C3C"
      ctx.fillRect(-5, -5, 10, 10)
      break
    case "wrapper":
      ctx.fillStyle = "#FFD700"
      ctx.strokeStyle = "#DAA520"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-10, -5)
      ctx.lineTo(10, -8)
      ctx.lineTo(12, 5)
      ctx.lineTo(-8, 8)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      break
    case "bag":
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)"
      ctx.strokeStyle = "#DDD"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, -15)
      ctx.quadraticCurveTo(15, -5, 10, 10)
      ctx.quadraticCurveTo(0, 15, -10, 10)
      ctx.quadraticCurveTo(-15, -5, 0, -15)
      ctx.fill()
      ctx.stroke()
      break
  }
  ctx.restore()
}

export function renderOceanReef(
  ctx: CanvasRenderingContext2D,
  state: OceanReefState,
  robot: RobotState,
  cam: Camera,
  options?: {
    showRuler?: boolean
    penTrail?: Array<{ x1: number; y1: number; x2: number; y2: number; color: string; width: number }>
  },
): void {
  const viewport = { widthPx: state.view.widthPx, heightPx: state.view.heightPx }
  const { widthPx: width, heightPx: height } = viewport
  const artScale = state.view.maximized ? 1.5 : 1

  drawSandFloor(ctx, width, height)

  options?.penTrail?.forEach((seg) => {
    ctx.strokeStyle = seg.color
    ctx.lineWidth = seg.width * artScale
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(seg.x1, seg.y1)
    ctx.lineTo(seg.x2, seg.y2)
    ctx.stroke()
  })

  const origin = reefWorldToScreen(0, 0, cam, viewport)
  ctx.strokeStyle = "rgba(60, 120, 180, 0.35)"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(origin.x - 10, origin.y)
  ctx.lineTo(origin.x + 10, origin.y)
  ctx.moveTo(origin.x, origin.y - 10)
  ctx.lineTo(origin.x, origin.y + 10)
  ctx.stroke()

  const spawn = reefWorldToScreen(START_POSE.xMm, START_POSE.yMm, cam, viewport)
  ctx.fillStyle = "rgba(46, 125, 50, 0.25)"
  ctx.beginPath()
  ctx.arc(spawn.x, spawn.y, 14, 0, Math.PI * 2)
  ctx.fill()

  const screenCoral = state.coral.map((piece) => coralToScreenPiece(piece, cam, viewport))
  drawReefBed(ctx, screenCoral)
  screenCoral.forEach((piece) => drawCoralPiece(ctx, piece))

  state.trash.forEach((trash) => drawTrashItem(ctx, trash, cam, viewport, artScale))

  const robotPos = reefWorldToScreen(robot.xMm, robot.yMm, cam, viewport)
  ctx.save()
  ctx.translate(robotPos.x, robotPos.y)
  ctx.rotate((robot.headingDeg * Math.PI) / 180)
  drawSubmarine(ctx, { scale: artScale })
  ctx.restore()

  if (options?.showRuler) {
    drawFieldRulerOverlay(ctx, width, height)
  }
}

export function renderDistanceRay(
  ctx: CanvasRenderingContext2D,
  robot: RobotState,
  cam: Camera,
  viewport: { widthPx: number; heightPx: number },
  frontMm: number,
): void {
  const origin = reefWorldToScreen(robot.xMm, robot.yMm, cam, viewport)
  const rayPx = distanceToPixels(frontMm, "mm")
  const angleRad = (robot.headingDeg * Math.PI) / 180
  ctx.strokeStyle = "rgba(0, 188, 212, 0.65)"
  ctx.lineWidth = 2
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(origin.x, origin.y)
  ctx.lineTo(origin.x + Math.sin(angleRad) * rayPx, origin.y - Math.cos(angleRad) * rayPx)
  ctx.stroke()
  ctx.setLineDash([])
}
