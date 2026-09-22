"use client"

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react"
import { Button } from "@/components/ui/button"
import { dismissBlocklyFieldEditors } from "./dismiss-editors"

export interface DistanceSliderPickerProps {
  value: number
  maxDistanceMm: number
  title: string
  headingDeg?: number
  describePrediction?: (distanceMm: number) => string
  onApply: (value: number) => void
  onClose: () => void
  onDrawPreview: (ctx: CanvasRenderingContext2D, distanceMm: number) => void
  onPreviewPointer?: (x: number, y: number) => void
}

export function DistanceSliderPicker({
  value,
  maxDistanceMm,
  title,
  headingDeg,
  describePrediction,
  onApply,
  onClose,
  onDrawPreview,
  onPreviewPointer,
}: DistanceSliderPickerProps) {
  const maxMm = Math.max(50, maxDistanceMm)
  const [currentDistance, setCurrentDistance] = useState(() => Math.min(value, maxMm))
  const [aiming, setAiming] = useState(false)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewSize = 280
  const aimingRef = useRef(false)

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
    onDrawPreview(ctx, currentDistance)
  }, [currentDistance, onDrawPreview, previewSize])

  useEffect(() => {
    drawPreview()
  }, [drawPreview])

  const reportPointer = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!onPreviewPointer) return
      const canvas = previewCanvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      onPreviewPointer((event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY)
    },
    [onPreviewPointer],
  )

  return (
    <div
      id="vex-picker-distance-overlay"
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div id="vex-picker-distance" className="bg-white rounded-lg p-6 shadow-xl min-w-[400px]" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-medium text-center mb-4 text-gray-600">{title}</p>

        <div className="flex gap-6 items-center">
          <div className="shrink-0">
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <canvas
                ref={previewCanvasRef}
                width={previewSize}
                height={previewSize}
                className={onPreviewPointer ? (aiming ? "cursor-grabbing" : "cursor-grab") : undefined}
                onPointerDown={(event) => {
                  if (!onPreviewPointer) return
                  aimingRef.current = true
                  setAiming(true)
                  event.currentTarget.setPointerCapture(event.pointerId)
                  reportPointer(event)
                }}
                onPointerMove={(event) => {
                  if (!aimingRef.current) return
                  reportPointer(event)
                }}
                onPointerUp={(event) => {
                  aimingRef.current = false
                  setAiming(false)
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId)
                  }
                }}
              />
            </div>
            {headingDeg != null && (
              <p className="text-xs text-center text-gray-500 mt-2">
                {Math.round(headingDeg)}° · drag to rotate
              </p>
            )}
            {describePrediction && (
              <p className="text-xs text-center text-gray-600 mt-1">{describePrediction(currentDistance)}</p>
            )}
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
