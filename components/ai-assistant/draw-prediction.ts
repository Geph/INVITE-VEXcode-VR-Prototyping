import { distanceToPixels, forEachProgramBlock, seededRandom, type CoralPiece } from "@/lib/robot-runtime"
import {
  CORAL_COLORS,
  CORAL_KINDS,
  drawCoralPiece,
  drawReefBed,
  drawSubmarine,
} from "@/playgrounds/ocean-reef/art"

/** Draw the prediction on the predict canvas. */
export function drawPredictionOnCanvas(canvas: HTMLCanvasElement | null, workspace: any) {
  if (!canvas || !workspace || !window.Blockly) return

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const width = 300
  const height = 300
  const scale = 0.5 // Scale down for preview

  // Draw ocean floor background (same as playground)
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, "#f4d6a2")
  gradient.addColorStop(0.5, "#e8c18e")
  gradient.addColorStop(1, "#d4a76a")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Draw coral border with the same artwork as the playground, at preview size.
  const previewCoral: CoralPiece[] = []
  const pushPreviewCoral = (x: number, y: number, seed: number, angle: number) => {
    previewCoral.push({
      x,
      y,
      radius: 8 + seededRandom(seed) * 4,
      color: CORAL_COLORS[Math.floor(seededRandom(seed + 1) * CORAL_COLORS.length)],
      kind: CORAL_KINDS[Math.floor(seededRandom(seed + 2) * CORAL_KINDS.length)],
      angle,
      seed,
    })
  }
  for (let x = 0; x < width; x += 20) {
    pushPreviewCoral(x + 10, 10, x, Math.PI)
    pushPreviewCoral(x + 10, height - 10, x + 1000, 0)
  }
  for (let y = 20; y < height - 20; y += 20) {
    pushPreviewCoral(10, y + 10, y + 2000, Math.PI / 2)
    pushPreviewCoral(width - 10, y + 10, y + 3000, -Math.PI / 2)
  }
  drawReefBed(ctx, previewCoral)
  previewCoral.forEach((piece) => drawCoralPiece(ctx, piece))

  // Draw "Trash: 0" counter
  ctx.fillStyle = "#F5A623"
  ctx.beginPath()
  ctx.roundRect(10, 25, 60, 22, 5)
  ctx.fill()
  ctx.fillStyle = "#FFF"
  ctx.font = "bold 12px Arial"
  ctx.fillText("Trash: 0", 15, 41)

  // Start position (center) - robot's current position
  let currentX = width / 2
  let currentY = height / 2
  let currentRotation = 0 // 0 = facing up

  // Draw starting submarine
  const drawMiniSub = (x: number, y: number, rotation: number) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((rotation * Math.PI) / 180)
    drawSubmarine(ctx, { scale: 0.55, headlamp: false, bumpers: false })
    ctx.restore()
  }

  // Parse blocks and calculate path
  const pathPoints: { x: number; y: number }[] = [{ x: currentX, y: currentY }]

  const allBlocks = workspace.getAllBlocks()
  const startBlocks = allBlocks.filter((b: { type: string }) => b.type === "when_started")

  for (const startBlock of startBlocks) {
    forEachProgramBlock(startBlock, (block) => {
      const blockType = block.type

      if (blockType === "turn_degrees" || blockType === "turn_simple") {
        const direction = block.getFieldValue("DIRECTION")
        const degrees =
          blockType === "turn_simple" ? 90 : Number.parseFloat(block.getFieldValue("DEGREES")) || 90
        currentRotation += direction === "right" ? degrees : -degrees
      } else if (blockType === "turn_to_heading") {
        currentRotation = Number.parseFloat(block.getFieldValue("HEADING")) || 0
      } else if (blockType === "turn_to_rotation") {
        currentRotation = Number.parseFloat(block.getFieldValue("ROTATION")) || 0
      } else if (blockType === "drive_distance") {
        const direction = block.getFieldValue("DIRECTION")
        const distance = Number.parseFloat(block.getFieldValue("DISTANCE")) || 200
        const unit = block.getFieldValue("UNIT") || "mm"
        const pixels = distanceToPixels(distance, unit) * scale
        const sign = direction === "forward" ? 1 : -1
        const angleRad = (currentRotation * Math.PI) / 180
        currentX += sign * pixels * Math.sin(angleRad)
        currentY -= sign * pixels * Math.cos(angleRad)
        pathPoints.push({ x: currentX, y: currentY })
      } else if (blockType === "drive_simple") {
        const direction = block.getFieldValue("DIRECTION")
        const pixels = distanceToPixels(200, "mm") * scale
        const sign = direction === "forward" ? 1 : -1
        const angleRad = (currentRotation * Math.PI) / 180
        currentX += sign * pixels * Math.sin(angleRad)
        currentY -= sign * pixels * Math.cos(angleRad)
        pathPoints.push({ x: currentX, y: currentY })
      }
    })
  }

  if (pathPoints.length > 1) {
    ctx.strokeStyle = "#22C55E" // Green color
    ctx.lineWidth = 3
    ctx.setLineDash([8, 4]) // Dotted line pattern
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    ctx.beginPath()
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y)
    for (let i = 1; i < pathPoints.length; i++) {
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y)
    }
    ctx.stroke()
    ctx.setLineDash([]) // Reset to solid
  }

  // Draw submarine at start position with correct rotation
  drawMiniSub(width / 2, height / 2, currentRotation)
}
