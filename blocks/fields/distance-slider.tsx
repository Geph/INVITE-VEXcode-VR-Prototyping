"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { CORAL_REEF_FIELD_MM, distanceToPixels, fieldMmToPixel, maxDriveDistanceMm } from "@/lib/robot-runtime"
import { dismissBlocklyFieldEditors } from "./dismiss-editors"

export interface DistanceSliderPickerProps {
  value: number
  onApply: (value: number) => void
  onClose: () => void
  robotState: { x: number; y: number; rotation: number }
  direction: string
  playgroundWidth: number
  playgroundHeight: number
}

export function DistanceSliderPicker({
  value,
  onApply,
  onClose,
  robotState,
  direction,
  playgroundWidth,
  playgroundHeight,
}: DistanceSliderPickerProps) {
  const [currentDistance, setCurrentDistance] = useState(value)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewSize = 280
  const previewScale = previewSize / Math.max(playgroundWidth, playgroundHeight)
  const robotPx = fieldMmToPixel(robotState.x, robotState.y, playgroundWidth, playgroundHeight)
  const maxMm = Math.min(
    2000,
    Math.max(50, maxDriveDistanceMm(robotPx.x, robotPx.y, robotState.rotation, direction, playgroundWidth, playgroundHeight)),
  )

  useEffect(() => {
    setCurrentDistance(Math.min(value, maxMm))
  }, [value, maxMm])

  useEffect(() => {
    dismissBlocklyFieldEditors()
  }, [])

  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, previewSize, previewSize)

    const offsetX = (previewSize - playgroundWidth * previewScale) / 2
    const offsetY = (previewSize - playgroundHeight * previewScale) / 2

    const toPreview = (px: number, py: number) => ({
      x: offsetX + px * previewScale,
      y: offsetY + py * previewScale,
    })

    const floorX = offsetX
    const floorY = offsetY
    const floorW = playgroundWidth * previewScale
    const floorH = playgroundHeight * previewScale
    const gradient = ctx.createLinearGradient(0, floorY, 0, floorY + floorH)
    gradient.addColorStop(0, "#f4d6a2")
    gradient.addColorStop(0.5, "#e8c18e")
    gradient.addColorStop(1, "#d4a76a")
    ctx.fillStyle = gradient
    ctx.fillRect(floorX, floorY, floorW, floorH)

    ctx.fillStyle = "#FF6B6B"
    for (let x = 0; x < playgroundWidth; x += 30) {
      const p1 = toPreview(x + 15, 15)
      const p2 = toPreview(x + 15, playgroundHeight - 15)
      ctx.beginPath()
      ctx.arc(p1.x, p1.y, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(p2.x, p2.y, 6, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let y = 30; y < playgroundHeight - 30; y += 30) {
      const p1 = toPreview(15, y + 15)
      const p2 = toPreview(playgroundWidth - 15, y + 15)
      ctx.beginPath()
      ctx.arc(p1.x, p1.y, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(p2.x, p2.y, 6, 0, Math.PI * 2)
      ctx.fill()
    }

    const robot = toPreview(robotPx.x, robotPx.y)
    const angleRad = (robotState.rotation * Math.PI) / 180
    const sign = direction === "forward" ? 1 : -1
    const distancePx = distanceToPixels(currentDistance, "mm")
    const end = toPreview(
      robotPx.x + sign * distancePx * Math.sin(angleRad),
      robotPx.y - sign * distancePx * Math.cos(angleRad),
    )

    ctx.beginPath()
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = "#22C55E"
    ctx.lineWidth = 2
    ctx.moveTo(robot.x, robot.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = "#FFD700"
    ctx.strokeStyle = "#E6B800"
    ctx.beginPath()
    ctx.arc(robot.x, robot.y, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = "#22C55E"
    ctx.beginPath()
    ctx.arc(end.x, end.y, 5, 0, Math.PI * 2)
    ctx.fill()
  }, [currentDistance, robotState, direction, playgroundWidth, playgroundHeight, previewScale, previewSize, robotPx.x, robotPx.y])

  useEffect(() => {
    drawPreview()
  }, [drawPreview])

  return (
    <div
      id="vex-picker-distance-overlay"
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div id="vex-picker-distance" className="bg-white rounded-lg p-6 shadow-xl min-w-[400px]" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-medium text-center mb-4 text-gray-600">
          Set distance — Coral Reef field ({CORAL_REEF_FIELD_MM}×{CORAL_REEF_FIELD_MM} mm)
        </p>

        <div className="flex gap-6 items-center">
          <div className="border border-gray-200 rounded-lg overflow-hidden shrink-0">
            <canvas ref={previewCanvasRef} width={previewSize} height={previewSize} />
          </div>

          <div className="flex flex-col gap-4 flex-1">
            <div className="text-center">
              <span className="text-4xl font-bold text-blue-600">{currentDistance}</span>
              <span className="text-lg text-gray-500 ml-1">mm</span>
            </div>

            <input
              type="range"
              min={0}
              max={Math.round(maxMm)}
              value={currentDistance}
              onChange={(e) => setCurrentDistance(Number(e.target.value))}
              className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />

            <div className="flex justify-between text-xs text-gray-400">
              <span>0</span>
              <span>{Math.round(maxMm / 4)}</span>
              <span>{Math.round(maxMm / 2)}</span>
              <span>{Math.round((maxMm * 3) / 4)}</span>
              <span>{Math.round(maxMm)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6 justify-center">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              onApply(currentDistance)
              requestAnimationFrame(() => onClose())
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}
