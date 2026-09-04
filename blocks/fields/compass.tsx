"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { dismissBlocklyFieldEditors } from "./dismiss-editors"

export interface CompassPickerProps {
  value: number
  onApply: (value: number) => void
  onClose: () => void
}

export function CompassPicker({ value, onApply, onClose }: CompassPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [currentHeading, setCurrentHeading] = useState(value)

  useEffect(() => {
    dismissBlocklyFieldEditors()
  }, [])

  const drawCompass = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const size = 220
    const center = size / 2
    const radius = 90

    ctx.clearRect(0, 0, size, size)

    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.strokeStyle = "#2E7D32"
    ctx.lineWidth = 4
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(center, center, radius - 5, 0, Math.PI * 2)
    ctx.fillStyle = "#F5F5F5"
    ctx.fill()

    for (let i = 0; i < 36; i++) {
      const angle = (i * 10 * Math.PI) / 180 - Math.PI / 2
      const innerR = i % 9 === 0 ? radius - 20 : radius - 12
      ctx.beginPath()
      ctx.moveTo(center + innerR * Math.cos(angle), center + innerR * Math.sin(angle))
      ctx.lineTo(center + (radius - 5) * Math.cos(angle), center + (radius - 5) * Math.sin(angle))
      ctx.strokeStyle = i % 9 === 0 ? "#333" : "#999"
      ctx.lineWidth = i % 9 === 0 ? 2 : 1
      ctx.stroke()
    }

    const directions = [
      { label: "N", angle: 0, color: "#D32F2F" },
      { label: "E", angle: 90, color: "#333" },
      { label: "S", angle: 180, color: "#333" },
      { label: "W", angle: 270, color: "#333" },
    ]
    directions.forEach(({ label, angle, color }) => {
      const rad = (angle * Math.PI) / 180 - Math.PI / 2
      ctx.font = "bold 16px sans-serif"
      ctx.fillStyle = color
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(label, center + (radius + 15) * Math.cos(rad), center + (radius + 15) * Math.sin(rad))
    })

    const headingRad = (currentHeading * Math.PI) / 180 - Math.PI / 2
    ctx.save()
    ctx.translate(center, center)
    ctx.rotate(headingRad + Math.PI / 2)
    ctx.beginPath()
    ctx.moveTo(0, -radius + 25)
    ctx.lineTo(-10, 0)
    ctx.lineTo(0, -10)
    ctx.lineTo(10, 0)
    ctx.closePath()
    ctx.fillStyle = "#D32F2F"
    ctx.fill()
    ctx.restore()

    ctx.beginPath()
    ctx.arc(center, center, 35, 0, Math.PI * 2)
    ctx.fillStyle = "#fff"
    ctx.fill()
    ctx.strokeStyle = "#2E7D32"
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.font = "bold 18px sans-serif"
    ctx.fillStyle = "#333"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(`${Math.round(currentHeading)}°`, center, center)
  }, [currentHeading])

  useEffect(() => {
    drawCompass()
  }, [drawCompass])

  const updateHeading = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left - 110
    const y = e.clientY - rect.top - 110
    let angle = (Math.atan2(y, x) * 180) / Math.PI + 90
    if (angle < 0) angle += 360
    setCurrentHeading(angle % 360)
  }

  return (
    <div
      id="vex-picker-compass-overlay"
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div id="vex-picker-compass" className="bg-white rounded-lg p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-medium text-center mb-2 text-gray-600">Select compass heading</p>
        <canvas
          ref={canvasRef}
          width={220}
          height={220}
          onMouseDown={(e) => {
            setIsDragging(true)
            updateHeading(e)
          }}
          onMouseMove={(e) => isDragging && updateHeading(e)}
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
            className="bg-green-600 hover:bg-green-700"
            onClick={() => {
              const final = Math.round(currentHeading)
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
