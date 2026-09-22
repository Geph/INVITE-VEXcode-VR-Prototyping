"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { dismissBlocklyFieldEditors } from "./dismiss-editors"

export interface AngleWheelPickerProps {
  value: number
  onApply: (value: number) => void
  onClose: () => void
  max?: number
}

export function AngleWheelPicker({ value, onApply, onClose, max = 360 }: AngleWheelPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [currentAngle, setCurrentAngle] = useState(value)

  useEffect(() => {
    // Hide via Blockly APIs — never set display:none on the shared divs
    // (that sticks and breaks later dropdown/number editors).
    dismissBlocklyFieldEditors()
  }, [])

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const size = 200
    const center = size / 2
    const radius = 80

    ctx.clearRect(0, 0, size, size)

    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.strokeStyle = "#4A90E2"
    ctx.lineWidth = 3
    ctx.stroke()

    for (let i = 0; i < 36; i++) {
      const angle = (i * 10 * Math.PI) / 180 - Math.PI / 2
      const innerR = i % 9 === 0 ? radius - 15 : radius - 8
      const outerR = radius
      ctx.beginPath()
      ctx.moveTo(center + innerR * Math.cos(angle), center + innerR * Math.sin(angle))
      ctx.lineTo(center + outerR * Math.cos(angle), center + outerR * Math.sin(angle))
      ctx.strokeStyle = i % 9 === 0 ? "#333" : "#999"
      ctx.lineWidth = i % 9 === 0 ? 2 : 1
      ctx.stroke()

      if (i % 9 === 0) {
        const labelR = radius - 25
        ctx.font = "12px sans-serif"
        ctx.fillStyle = "#333"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(`${i * 10}°`, center + labelR * Math.cos(angle), center + labelR * Math.sin(angle))
      }
    }

    if (currentAngle > 0) {
      ctx.beginPath()
      ctx.moveTo(center, center)
      ctx.arc(center, center, radius - 3, -Math.PI / 2, (currentAngle * Math.PI) / 180 - Math.PI / 2)
      ctx.closePath()
      ctx.fillStyle = "rgba(74, 144, 226, 0.3)"
      ctx.fill()
    }

    const handleAngle = (currentAngle * Math.PI) / 180 - Math.PI / 2
    ctx.beginPath()
    ctx.arc(
      center + (radius - 3) * Math.cos(handleAngle),
      center + (radius - 3) * Math.sin(handleAngle),
      8,
      0,
      Math.PI * 2,
    )
    ctx.fillStyle = "#4A90E2"
    ctx.fill()
    ctx.strokeStyle = "#fff"
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.font = "bold 24px sans-serif"
    ctx.fillStyle = "#333"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(`${Math.round(currentAngle)}°`, center, center)
  }, [currentAngle])

  useEffect(() => {
    drawWheel()
  }, [drawWheel])

  const updateAngle = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left - 100
    const y = e.clientY - rect.top - 100
    let angle = (Math.atan2(y, x) * 180) / Math.PI + 90
    if (angle < 0) angle += 360
    angle = Math.min(angle, max)
    setCurrentAngle(angle)
  }

  return (
    <div
      id="vex-picker-angle-overlay"
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div id="vex-picker-angle" className="bg-white rounded-lg p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-medium text-center mb-2 text-gray-600">Drag to set degrees</p>
        <canvas
          ref={canvasRef}
          width={200}
          height={200}
          onMouseDown={(e) => {
            setIsDragging(true)
            updateAngle(e)
          }}
          onMouseMove={(e) => isDragging && updateAngle(e)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          className="cursor-pointer"
        />
        <div className="flex gap-2 mt-3 justify-center">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const final = Math.round(currentAngle)
              onApply(final)
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
