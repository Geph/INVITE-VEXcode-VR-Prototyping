"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Play,
  GripVertical,
  X,
  Minimize,
  Maximize,
  Minimize2,
  Maximize2,
  Cog,
  Magnet,
  Pencil,
  Eye,
  Terminal,
  GitBranch,
  ToggleLeft,
  RotateCcw,
  Trash2,
  HelpCircle,
} from "lucide-react"

declare global {
  interface Window {
    Blockly: any
  }
}

// Robot state interface
interface RobotState {
  x: number
  y: number
  rotation: number
  driveVelocity: number
  turnVelocity: number
  heading: number
}

// Draggable playground state
interface PlaygroundState {
  x: number
  y: number
  isDragging: boolean
  dragStartX: number
  dragStartY: number
  isVisible: boolean
  isMinimized: boolean
  isMaximized: boolean
}

// Draggable AI Assistant state
interface AIAssistantState {
  x: number
  y: number
  isDragging: boolean
  dragStartX: number
  dragStartY: number
  isVisible: boolean
  isMinimized: boolean
  isMaximized: boolean
  surveyStep: "main" | "strategy" | "fix" | "compare" | "feel" | "partner"
}

interface CategoryState {
  selectedCategory: string | null
}

// AngleWheelPicker component for rotation/degrees input
interface AngleWheelPickerProps {
  value: number
  onChange: (value: number) => void
  onClose: () => void
  max?: number
}

function AngleWheelPicker({ value, onChange, onClose, max = 360 }: AngleWheelPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [currentAngle, setCurrentAngle] = useState(value)

  useEffect(() => {
    const widgetDiv = document.querySelector(".blocklyWidgetDiv") as HTMLElement
    const dropDownDiv = document.querySelector(".blocklyDropDownDiv") as HTMLElement
    if (widgetDiv) widgetDiv.style.display = "none"
    if (dropDownDiv) dropDownDiv.style.display = "none"
    return () => {
      if (widgetDiv) widgetDiv.style.display = ""
      if (dropDownDiv) dropDownDiv.style.display = ""
    }
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

    // Draw outer circle
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.strokeStyle = "#4A90E2"
    ctx.lineWidth = 3
    ctx.stroke()

    // Draw tick marks
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

    // Draw pie slice
    if (currentAngle > 0) {
      ctx.beginPath()
      ctx.moveTo(center, center)
      ctx.arc(center, center, radius - 3, -Math.PI / 2, (currentAngle * Math.PI) / 180 - Math.PI / 2)
      ctx.closePath()
      ctx.fillStyle = "rgba(74, 144, 226, 0.3)"
      ctx.fill()
    }

    // Draw handle
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

    // Center value
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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-white rounded-lg p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
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
              onChange(Math.round(currentAngle))
              onClose()
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}

// CompassPicker component for heading input
interface CompassPickerProps {
  value: number
  onChange: (value: number) => void
  onClose: () => void
}

function CompassPicker({ value, onChange, onClose }: CompassPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [currentHeading, setCurrentHeading] = useState(value)

  useEffect(() => {
    const widgetDiv = document.querySelector(".blocklyWidgetDiv") as HTMLElement
    const dropDownDiv = document.querySelector(".blocklyDropDownDiv") as HTMLElement
    if (widgetDiv) widgetDiv.style.display = "none"
    if (dropDownDiv) dropDownDiv.style.display = "none"
    return () => {
      if (widgetDiv) widgetDiv.style.display = ""
      if (dropDownDiv) dropDownDiv.style.display = ""
    }
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

    // Outer circle
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.strokeStyle = "#2E7D32"
    ctx.lineWidth = 4
    ctx.stroke()

    // Background
    ctx.beginPath()
    ctx.arc(center, center, radius - 5, 0, Math.PI * 2)
    ctx.fillStyle = "#F5F5F5"
    ctx.fill()

    // Tick marks
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

    // Cardinal directions
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

    // Heading arrow
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

    // Center circle
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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-white rounded-lg p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
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
              onChange(Math.round(currentHeading))
              onClose()
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}

interface DistanceSliderPickerProps {
  value: number
  onChange: (value: number) => void
  onClose: () => void
  robotState: RobotState
  direction: string
}

function DistanceSliderPicker({ value, onChange, onClose, robotState, direction }: DistanceSliderPickerProps) {
  const [currentDistance, setCurrentDistance] = useState(value)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const widgetDiv = document.querySelector(".blocklyWidgetDiv") as HTMLElement
    const dropDownDiv = document.querySelector(".blocklyDropDownDiv") as HTMLElement
    if (widgetDiv) widgetDiv.style.display = "none"
    if (dropDownDiv) dropDownDiv.style.display = "none"
    return () => {
      if (widgetDiv) widgetDiv.style.display = ""
      if (dropDownDiv) dropDownDiv.style.display = ""
    }
  }, [])

  // Draw the preview line on the Ocean Cleanup window
  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const size = 200
    const scale = 0.5 // Scale down the preview
    ctx.clearRect(0, 0, size, size)

    // Draw background grid
    ctx.strokeStyle = "#e0e0e0"
    ctx.lineWidth = 0.5
    for (let i = 0; i <= size; i += 20) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, size)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(size, i)
      ctx.stroke()
    }

    // Robot position scaled down
    const robotX = robotState.x * scale
    const robotY = robotState.y * scale
    const angle = (robotState.rotation * Math.PI) / 180

    // Draw robot
    ctx.fillStyle = "#4A90E2"
    ctx.beginPath()
    ctx.arc(robotX, robotY, 10, 0, Math.PI * 2)
    ctx.fill()

    // Calculate end point based on direction and distance
    const distanceScaled = currentDistance * scale
    const dirMultiplier = direction === "forward" ? -1 : 1
    const endX = robotX + Math.sin(angle) * distanceScaled * dirMultiplier
    const endY = robotY + Math.cos(angle) * distanceScaled * dirMultiplier

    // Draw dotted preview line
    ctx.beginPath()
    ctx.setLineDash([5, 5])
    ctx.strokeStyle = "#FF6B6B"
    ctx.lineWidth = 3
    ctx.moveTo(robotX, robotY)
    ctx.lineTo(endX, endY)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw end marker
    ctx.beginPath()
    ctx.arc(endX, endY, 6, 0, Math.PI * 2)
    ctx.fillStyle = "#FF6B6B"
    ctx.fill()
  }, [currentDistance, robotState, direction])

  useEffect(() => {
    drawPreview()
  }, [drawPreview])

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 shadow-xl min-w-[400px]" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-medium text-center mb-4 text-gray-600">Set distance (0-400)</p>

        <div className="flex gap-6 items-center">
          {/* Preview canvas */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <canvas ref={previewCanvasRef} width={200} height={200} />
          </div>

          {/* Slider and value */}
          <div className="flex flex-col gap-4 flex-1">
            <div className="text-center">
              <span className="text-4xl font-bold text-blue-600">{currentDistance}</span>
              <span className="text-lg text-gray-500 ml-1">mm</span>
            </div>

            <input
              type="range"
              min={0}
              max={400}
              value={currentDistance}
              onChange={(e) => setCurrentDistance(Number(e.target.value))}
              className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />

            <div className="flex justify-between text-xs text-gray-400">
              <span>0</span>
              <span>100</span>
              <span>200</span>
              <span>300</span>
              <span>400</span>
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
              onChange(currentDistance)
              onClose()
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function BlocklyEditor() {
  const blocklyDivRef = useRef<HTMLDivElement>(null)
  const playgroundRef = useRef<HTMLDivElement>(null)
  const aiAssistantRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workspaceRef = useRef<any>(null) // Changed to ref
  const [workspace, setWorkspace] = useState<any>(null)
  const [blocklyLoaded, setBlocklyLoaded] = useState(false)
  const [robotState, setRobotState] = useState<RobotState>({
    x: 200,
    y: 200,
    rotation: 0,
    driveVelocity: 50,
    turnVelocity: 50,
    heading: 0,
  })

  const [playgroundState, setPlaygroundState] = useState<PlaygroundState>({
    x: 100,
    y: 100,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    isVisible: true,
    isMinimized: false,
    isMaximized: false,
  })

  const [aiAssistantState, setAIAssistantState] = useState<AIAssistantState>({
    x: 900,
    y: 150,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    isVisible: false,
    isMinimized: false,
    isMaximized: false,
    surveyStep: "main",
  })

  const [categoryState, setCategoryState] = useState<CategoryState>({
    selectedCategory: "drivetrain",
  })

  const [isRunning, setIsRunning] = useState(false)
  const animationRef = useRef<number | null>(null)

  // State for angle pickers
  const [anglePickerState, setAnglePickerState] = useState<{
    isOpen: boolean
    type: "wheel" | "compass"
    value: number
    callback: ((value: number) => void) | null
  }>({
    isOpen: false,
    type: "wheel",
    value: 0,
    callback: null,
  })

  const [distancePickerState, setDistancePickerState] = useState<{
    isOpen: boolean
    value: number
    direction: string
    callback: ((value: number) => void) | null
  }>({
    isOpen: false,
    value: 200,
    direction: "forward",
    callback: null,
  })

  const [activeFieldInfo, setActiveFieldInfo] = useState<{
    block: any
    fieldName: string
  } | null>(null)

  // ... existing code for handlers ...

  const handlePlaygroundMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    if ((e.target as HTMLElement).closest(".playground-header")) {
      setPlaygroundState((prev) => ({
        ...prev,
        isDragging: true,
        dragStartX: e.clientX - prev.x,
        dragStartY: e.clientY - prev.y,
      }))
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (playgroundState.isDragging) {
        setPlaygroundState((prev) => ({
          ...prev,
          x: e.clientX - prev.dragStartX,
          y: e.clientY - prev.dragStartY,
        }))
      }
    }

    const handleMouseUp = () => {
      setPlaygroundState((prev) => ({ ...prev, isDragging: false }))
    }

    if (playgroundState.isDragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [playgroundState.isDragging])

  useEffect(() => {
    if (typeof window !== "undefined" && !window.Blockly) {
      const script = document.createElement("script")
      script.src = "https://cdn.jsdelivr.net/npm/blockly@10/blockly.min.js"
      script.crossOrigin = "anonymous"
      script.onload = () => {
        console.log("[v0] Blockly core loaded successfully")
        const Blockly = window.Blockly
        if (Blockly) {
          defineDrivetrainBlocks(Blockly, setAnglePickerState, setDistancePickerState) // Pass setDistancePickerState
          defineMagnetBlocks(Blockly)
          defineDrawingBlocks(Blockly)
          defineSensingBlocks(Blockly)
          defineConsoleBlocks(Blockly)
          defineLogicBlocks(Blockly)
          defineSwitchBlocks(Blockly)
          setBlocklyLoaded(true)
        }
      }
      script.onerror = (e) => {
        console.log("[v0] Failed to load Blockly core:", e)
      }
      document.body.appendChild(script)
    } else if (window.Blockly) {
      defineDrivetrainBlocks(window.Blockly, setAnglePickerState, setDistancePickerState) // Pass setDistancePickerState
      defineMagnetBlocks(window.Blockly)
      defineDrawingBlocks(window.Blockly)
      defineSensingBlocks(window.Blockly)
      defineConsoleBlocks(window.Blockly)
      defineLogicBlocks(window.Blockly)
      defineSwitchBlocks(window.Blockly)
      setBlocklyLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!blocklyLoaded || !blocklyDivRef.current || workspaceRef.current) return // Use ref

    const Blockly = window.Blockly

    const ws = Blockly.inject(blocklyDivRef.current, {
      toolbox: {
        kind: "flyoutToolbox",
        contents: [],
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1.2,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2,
      },
      trashcan: false,
    })
    workspaceRef.current = ws // Store in ref
    setWorkspace(ws)

    setTimeout(() => {
      const whenStartedBlock = ws.newBlock("when_started")
      whenStartedBlock.initSvg()
      whenStartedBlock.render()
      whenStartedBlock.moveBy(50, 50)
      whenStartedBlock.setDeletable(false) // Can't be deleted
      whenStartedBlock.setMovable(true) // Can be moved
    }, 100)
  }, [blocklyLoaded, workspace])

  useEffect(() => {
    if (!workspaceRef.current || !blocklyLoaded) return // Use ref

    const workspace = workspaceRef.current

    // Listen for field clicks by adding a handler to the workspace's SVG
    const handleFieldClick = (e: MouseEvent) => {
      const target = e.target as Element

      // Check if clicked on a field text element
      const fieldGroup = target.closest(".blocklyEditableText")
      if (!fieldGroup) return

      // Find the block that contains this field
      const blockSvg = target.closest(".blocklyDraggable")
      if (!blockSvg) return

      const blockId = blockSvg.getAttribute("data-id")
      if (!blockId) return

      const block = workspace.getBlockById(blockId)
      if (!block) return

      const blockType = block.type

      // Check which field was clicked based on the block type
      if (blockType === "turn_degrees" || blockType === "turn_to_rotation") {
        const fieldName = blockType === "turn_degrees" ? "DEGREES" : "ROTATION"
        const currentValue = Number(block.getFieldValue(fieldName)) || 90
        setAnglePickerState({
          isOpen: true,
          type: "wheel",
          value: currentValue,
          callback: (val: number) => {
            block.setFieldValue(val.toString(), fieldName)
          },
        })
        e.preventDefault()
        e.stopPropagation()
      } else if (blockType === "turn_to_heading" || blockType === "set_drive_heading") {
        const fieldName = "HEADING"
        const currentValue = Number(block.getFieldValue(fieldName)) || 0
        setAnglePickerState({
          isOpen: true,
          type: "compass",
          value: currentValue,
          callback: (val: number) => {
            block.setFieldValue(val.toString(), fieldName)
          },
        })
        e.preventDefault()
        e.stopPropagation()
      } else if (blockType === "set_drive_rotation") {
        const fieldName = "ROTATION"
        const currentValue = Number(block.getFieldValue(fieldName)) || 0
        setAnglePickerState({
          isOpen: true,
          type: "wheel",
          value: currentValue,
          callback: (val: number) => {
            block.setFieldValue(val.toString(), fieldName)
          },
        })
        e.preventDefault()
        e.stopPropagation()
      } else if (blockType === "drive_distance") {
        const fieldName = "DISTANCE"
        const currentValue = Number(block.getFieldValue(fieldName)) || 200
        const direction = block.getFieldValue("DIRECTION") || "forward"
        setDistancePickerState({
          isOpen: true,
          value: currentValue,
          direction: direction,
          callback: (val: number) => {
            block.setFieldValue(val.toString(), fieldName)
          },
        })
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // Get the workspace's SVG element
    const workspaceSvg = workspace.getParentSvg()
    if (workspaceSvg) {
      workspaceSvg.addEventListener("click", handleFieldClick)
    }

    return () => {
      if (workspaceSvg) {
        workspaceSvg.removeEventListener("click", handleFieldClick)
      }
    }
  }, [blocklyLoaded]) // Dependency on blocklyLoaded

  useEffect(() => {
    if (!workspace || !window.Blockly) return

    const Blockly = window.Blockly

    let blocks: any[] = []

    switch (categoryState.selectedCategory) {
      case "drivetrain":
        blocks = [
          { kind: "block", type: "drive_simple" },
          { kind: "block", type: "drive_distance" },
          { kind: "block", type: "turn_simple" },
          { kind: "block", type: "turn_degrees" },
          { kind: "block", type: "turn_to_heading" },
          { kind: "block", type: "turn_to_rotation" },
          { kind: "block", type: "stop_driving" },
          { kind: "block", type: "set_drive_velocity" },
          { kind: "block", type: "set_turn_velocity" },
          { kind: "block", type: "set_drive_heading" },
          { kind: "block", type: "set_drive_rotation" },
          { kind: "block", type: "set_drive_timeout" },
        ]
        break
      case "magnet":
        blocks = [{ kind: "block", type: "energize_magnet" }]
        break
      case "drawing":
        blocks = [
          { kind: "block", type: "move_pen" },
          { kind: "block", type: "set_pen_width" },
          { kind: "block", type: "set_pen_color" },
        ]
        break
      case "sensing":
        blocks = [
          { kind: "block", type: "bumper_pressed" },
          { kind: "block", type: "when_bumper" },
          { kind: "block", type: "distance_found_object" },
          { kind: "block", type: "distance_in_units" },
          { kind: "block", type: "eye_is_near" },
          { kind: "block", type: "eye_detects_color" },
          { kind: "block", type: "eye_brightness" },
          { kind: "block", type: "when_eye_detects" },
          { kind: "block", type: "position_value" },
          { kind: "block", type: "position_angle" },
        ]
        break
      case "console":
        blocks = [
          { kind: "block", type: "print_text" },
          { kind: "block", type: "set_cursor_next_row" },
          { kind: "block", type: "clear_all_rows" },
          { kind: "block", type: "set_print_precision" },
          { kind: "block", type: "set_print_color" },
        ]
        break
      case "logic":
        blocks = [
          { kind: "block", type: "wait_seconds" },
          { kind: "block", type: "wait_until" },
          { kind: "block", type: "repeat_times" },
          { kind: "block", type: "forever_loop" },
          { kind: "block", type: "repeat_until" },
          { kind: "block", type: "while_loop" },
          { kind: "block", type: "if_then" },
          { kind: "block", type: "if_then_else" },
          { kind: "block", type: "if_elseif_else" }, // Added if_elseif_else
          { kind: "block", type: "break_block" },
          { kind: "block", type: "stop_project" },
          { kind: "block", type: "comment_block" },
        ]
        break
      case "loops":
        blocks = [
          { kind: "block", type: "function_definition" },
          { kind: "block", type: "function_with_input" },
          { kind: "block", type: "function_call" },
          { kind: "block", type: "boolean_and" }, // Replaced boolean_value with boolean_and
          { kind: "block", type: "boolean_or" }, // Replaced not_operator with boolean_or
          { kind: "block", type: "boolean_not" }, // Replaced and_or_operator with boolean_not
          { kind: "block", type: "compare_equal" }, // Replaced comparison_operator with compare_equal
          { kind: "block", type: "when_started" },
        ]
        break
    }

    workspace.updateToolbox({ kind: "flyoutToolbox", contents: blocks })
  }, [categoryState.selectedCategory, workspace])

  const drawRobot = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const canvasSize = playgroundState.isMaximized ? 600 : 400

    ctx.clearRect(0, 0, canvasSize, canvasSize)

    // Ocean background
    ctx.fillStyle = "#E8F4F8"
    ctx.fillRect(0, 0, canvasSize, canvasSize)

    // Grid
    ctx.strokeStyle = "#B0D4E3"
    ctx.lineWidth = 1
    const gridSize = 40

    for (let x = 0; x <= canvasSize; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvasSize)
      ctx.stroke()
    }

    for (let y = 0; y <= canvasSize; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvasSize, y)
      ctx.stroke()
    }

    const scale = playgroundState.isMaximized ? 1.5 : 1
    const robotX = robotState.x * scale
    const robotY = robotState.y * scale

    // Robot shadow
    ctx.save()
    ctx.translate(robotX + 3, robotY + 3)
    ctx.rotate((robotState.rotation * Math.PI) / 180)
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)"
    ctx.fillRect(-20, -25, 40, 50)
    ctx.restore()

    // Robot body
    ctx.save()
    ctx.translate(robotX, robotY)
    ctx.rotate((robotState.rotation * Math.PI) / 180)

    ctx.fillStyle = "#2196F3"
    ctx.strokeStyle = "#1565C0"
    ctx.lineWidth = 3
    ctx.fillRect(-20, -25, 40, 50)
    ctx.strokeRect(-20, -25, 40, 50)

    // Wheels
    ctx.fillStyle = "#333"
    ctx.fillRect(-24, -20, 6, 15)
    ctx.fillRect(-24, 5, 6, 15)
    ctx.fillRect(18, -20, 6, 15)
    ctx.fillRect(18, 5, 6, 15)

    // Eyes
    ctx.fillStyle = "#FFF"
    ctx.beginPath()
    ctx.arc(-8, -10, 6, 0, Math.PI * 2)
    ctx.arc(8, -10, 6, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = "#333"
    ctx.beginPath()
    ctx.arc(-8, -10, 3, 0, Math.PI * 2)
    ctx.arc(8, -10, 3, 0, Math.PI * 2)
    ctx.fill()

    // Direction indicator
    ctx.fillStyle = "#FFC107"
    ctx.beginPath()
    ctx.moveTo(0, -25)
    ctx.lineTo(-8, -32)
    ctx.lineTo(8, -32)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }, [robotState, playgroundState.isMaximized])

  useEffect(() => {
    drawRobot()
  }, [drawRobot, playgroundState.isMaximized, playgroundState.isVisible, playgroundState.isMinimized])

  useEffect(() => {
    if (canvasRef.current && playgroundState.isVisible && !playgroundState.isMinimized) {
      const timer = setTimeout(() => {
        drawRobot()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [])

  const animateRobotFluid = (targetState: Partial<RobotState>, duration = 500) => {
    return new Promise<void>((resolve) => {
      const startTime = performance.now()
      const startState = { ...robotState }

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easeProgress = 1 - Math.pow(1 - progress, 3)

        setRobotState((prev) => {
          const newState = { ...prev }
          if (targetState.x !== undefined) {
            newState.x = startState.x + (targetState.x - startState.x) * easeProgress
          }
          if (targetState.y !== undefined) {
            newState.y = startState.y + (targetState.y - startState.y) * easeProgress
          }
          if (targetState.rotation !== undefined) {
            newState.rotation = startState.rotation + (targetState.rotation - startState.rotation) * easeProgress
          }
          return newState
        })

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          resolve()
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    })
  }

  const handleRun = async () => {
    if (!workspace || !window.Blockly || isRunning) return

    setIsRunning(true)
    const Blockly = window.Blockly
    const code = Blockly.JavaScript.workspaceToCode(workspace)

    const canvasWidth = playgroundState.isMaximized ? 600 : 400
    const canvasHeight = playgroundState.isMaximized ? 600 : 400

    setRobotState({
      x: canvasWidth / 2,
      y: canvasHeight / 2,
      rotation: 0,
      driveVelocity: 50,
      turnVelocity: 50,
      heading: 0,
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    const robotAPI = {
      drive: async (direction: string, distance?: number, unit?: string) => {
        const multiplier = direction === "forward" ? -1 : 1
        if (distance === undefined) {
          const pixels = 200
          const targetX = robotState.x + pixels * multiplier * Math.sin((robotState.rotation * Math.PI) / 180)
          const targetY = robotState.y + pixels * multiplier * Math.cos((robotState.rotation * Math.PI) / 180)
          await animateRobotFluid({ x: targetX, y: targetY }, 1000)
        } else {
          const pixels = unit === "mm" ? distance / 5 : distance
          const targetX = robotState.x + pixels * multiplier * Math.sin((robotState.rotation * Math.PI) / 180)
          const targetY = robotState.y + pixels * multiplier * Math.cos((robotState.rotation * Math.PI) / 180)
          await animateRobotFluid({ x: targetX, y: targetY }, 500)
        }
      },
      turn: async (direction: string, degrees?: number) => {
        const multiplier = direction === "right" ? 1 : -1
        if (degrees === undefined) {
          const targetRotation = robotState.rotation + 90 * multiplier
          await animateRobotFluid({ rotation: targetRotation }, 500)
        } else {
          const targetRotation = robotState.rotation + degrees * multiplier
          await animateRobotFluid({ rotation: targetRotation }, 500)
        }
      },
      turnToHeading: async (heading: number) => {
        await animateRobotFluid({ rotation: heading }, 500)
      },
      turnToRotation: async (rotation: number) => {
        await animateRobotFluid({ rotation: rotation }, 500)
      },
      stopDriving: () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
      },
      setDriveVelocity: (velocity: number) => {
        setRobotState((prev) => ({ ...prev, driveVelocity: velocity }))
      },
      setTurnVelocity: (velocity: number) => {
        setRobotState((prev) => ({ ...prev, turnVelocity: velocity }))
      },
      setDriveHeading: (heading: number) => {
        setRobotState((prev) => ({ ...prev, heading: heading }))
      },
      setDriveRotation: (rotation: number) => {
        setRobotState((prev) => ({ ...prev, rotation: rotation }))
      },
      setDriveTimeout: (seconds: number) => {
        return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
      },
      energize: (device: string, mode: string) => {
        console.log(`Energizing ${device} to ${mode}`)
      },
      movePen: (position: string) => {
        console.log(`Move pen ${position}`)
      },
      setPenWidth: (width: string) => {
        console.log(`Set pen width to ${width}`)
      },
      setPenColor: (color: string) => {
        console.log(`Set pen color to ${color}`)
      },
      print: (text: string) => {
        console.log(`[Console] ${text}`)
      },
      wait: async (seconds: number) => {
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
      },
      customFunction: async () => {
        console.log("Custom function called")
      },
      customFunctionWithInput: async (input: any) => {
        console.log(`Custom function called with input: ${input}`)
      },
      booleanTrue: () => true,
      booleanFalse: () => false,
      not: (value: boolean) => !value,
      and: (a: boolean, b: boolean) => a && b,
      or: (a: boolean, b: boolean) => a || b,
      equals: (a: number, b: number) => a === b,
      notEquals: (a: number, b: number) => a !== b,
      lessThan: (a: number, b: number) => a < b,
      greaterThan: (a: number, b: number) => a > b,
      lessThanOrEqual: (a: number, b: number) => a <= b,
      greaterThanOrEqual: (a: number, b: number) => a >= b,
      whenStarted: async () => {
        console.log("Program started")
      },
      setCursorNextRow: () => {
        console.log("Set cursor to next row")
      },
      clearAllRows: () => {
        console.log("Clear all rows")
      },
      setPrintPrecision: (precision: number) => {
        console.log(`Set print precision to ${precision}`)
      },
      setPrintColor: (color: string) => {
        console.log(`Set print color to ${color}`)
      },
      bumperPressed: (bumper: string) => {
        console.log(`Checking if ${bumper} bumper is pressed`)
        return false
      },
      distanceFoundObject: (sensor: string) => {
        console.log(`Checking if ${sensor} found object`)
        return false
      },
      getDistance: (sensor: string, unit: string) => {
        console.log(`Getting distance from ${sensor} in ${unit}`)
        return 0
      },
      eyeIsNear: (sensor: string) => {
        console.log(`Checking if ${sensor} is near object`)
        return false
      },
      eyeDetectsColor: (sensor: string, color: string) => {
        console.log(`Checking if ${sensor} detects ${color}`)
        return false
      },
      eyeBrightness: (sensor: string) => {
        console.log(`Getting brightness from ${sensor}`)
        return 50
      },
      getPosition: (axis: string, unit: string) => {
        console.log(`Getting position ${axis} in ${unit}`)
        return axis === "x" ? robotState.x : robotState.y
      },
      getPositionAngle: () => {
        console.log("Getting position angle")
        return robotState.rotation
      },
      stop: () => {
        // Added stop function for stop_project block
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
        setIsRunning(false)
      },
    }

    try {
      const transformedCode = code.replace(/\/\/ comment/g, "/* comment */")
      const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
      const execFunc = new AsyncFunction("robot", transformedCode)
      await execFunc(robotAPI)
    } catch (error: any) {
      console.error("Execution error:", error)
      setIsRunning(false) // Ensure isRunning is reset on error
    }

    // If the execution finished without calling stop, reset isRunning
    if (isRunning) {
      setIsRunning(false)
    }
  }

  const handleReset = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    setIsRunning(false)
    const canvasWidth = playgroundState.isMaximized ? 600 : 400
    const canvasHeight = playgroundState.isMaximized ? 600 : 400
    setRobotState({
      x: canvasWidth / 2,
      y: canvasHeight / 2,
      rotation: 0,
      driveVelocity: 50,
      turnVelocity: 50,
      heading: 0,
    })
  }

  const handleClear = () => {
    if (workspace) {
      workspace.clear()
      const canvasWidth = playgroundState.isMaximized ? 600 : 400
      const canvasHeight = playgroundState.isMaximized ? 600 : 400
      setRobotState({
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        rotation: 0,
        driveVelocity: 50,
        turnVelocity: 50,
        heading: 0,
      })
    }
  }

  const handleTrash = () => {
    if (workspace) {
      workspace.clear()
    }
  }

  const handleSave = () => {
    if (!workspace || !window.Blockly) return

    const Blockly = window.Blockly
    const xml = Blockly.Xml.workspaceToDom(workspace)
    const xmlText = Blockly.Xml.domToText(xml)

    const blob = new Blob([xmlText], { type: "text/xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "robot-program.xml"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleOpen = () => {
    if (!workspace || !window.Blockly) return

    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".xml"
    input.onchange = (e: any) => {
      const file = e.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const xmlText = event.target?.result as string
        const Blockly = window.Blockly
        const xml = Blockly.utils.xml.textToDom(xmlText)
        workspace.clear()
        Blockly.Xml.domToWorkspace(xml, workspace)
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleSelectCategory = (category: string) => {
    if (!workspace || !window.Blockly) return

    setCategoryState({ selectedCategory: category })

    const Blockly = window.Blockly

    let blocks: any[] = []
    if (category === "drivetrain") {
      blocks = [
        { kind: "block", type: "drive_simple" },
        { kind: "block", type: "drive_distance" },
        { kind: "block", type: "turn_simple" },
        { kind: "block", type: "turn_degrees" },
        { kind: "block", type: "turn_to_heading" },
        { kind: "block", type: "turn_to_rotation" },
        { kind: "block", type: "stop_driving" },
        { kind: "block", type: "set_drive_velocity" },
        { kind: "block", type: "set_turn_velocity" },
        { kind: "block", type: "set_drive_heading" },
        { kind: "block", type: "set_drive_rotation" },
        { kind: "block", type: "set_drive_timeout" },
      ]
    } else if (category === "magnet") {
      blocks = [{ kind: "block", type: "energize_magnet" }]
    } else if (category === "drawing") {
      blocks = [
        { kind: "block", type: "move_pen" },
        { kind: "block", type: "set_pen_width" },
        { kind: "block", type: "set_pen_color" },
      ]
    } else if (category === "sensing") {
      blocks = [
        { kind: "block", type: "bumper_pressed" },
        { kind: "block", type: "when_bumper" },
        { kind: "block", type: "distance_found_object" },
        { kind: "block", type: "distance_in_units" },
        { kind: "block", type: "eye_is_near" },
        { kind: "block", type: "eye_detects_color" },
        { kind: "block", type: "eye_brightness" },
        { kind: "block", type: "when_eye_detects" },
        { kind: "block", type: "position_value" },
        { kind: "block", type: "position_angle" },
      ]
    } else if (category === "console") {
      blocks = [
        { kind: "block", type: "print_text" },
        { kind: "block", type: "set_cursor_next_row" },
        { kind: "block", type: "clear_all_rows" },
        { kind: "block", type: "set_print_precision" },
        { kind: "block", type: "set_print_color" },
      ]
    } else if (category === "logic") {
      blocks = [
        { kind: "block", type: "wait_seconds" },
        { kind: "block", type: "wait_until" },
        { kind: "block", type: "repeat_times" },
        { kind: "block", type: "forever_loop" },
        { kind: "block", type: "repeat_until" },
        { kind: "block", type: "while_loop" },
        { kind: "block", type: "if_then" },
        { kind: "block", type: "if_then_else" },
        { kind: "block", type: "if_elseif_else" }, // Added if_elseif_else
        { kind: "block", type: "break_block" },
        { kind: "block", type: "stop_project" },
        { kind: "block", type: "comment_block" },
      ]
    } else if (category === "loops") {
      blocks = [
        { kind: "block", type: "function_definition" },
        { kind: "block", type: "function_with_input" },
        { kind: "block", type: "function_call" },
        { kind: "block", type: "boolean_and" }, // Replaced boolean_value with boolean_and
        { kind: "block", type: "boolean_or" }, // Replaced not_operator with boolean_or
        { kind: "block", type: "boolean_not" }, // Replaced and_or_operator with boolean_not
        { kind: "block", type: "compare_equal" }, // Replaced comparison_operator with compare_equal
        { kind: "block", type: "when_started" },
      ]
    }

    workspace.updateToolbox({ kind: "flyoutToolbox", contents: blocks })
    workspace.getToolbox()?.setSelectedItem(null)
  }

  const handleOpenPlayground = () => {
    setPlaygroundState((prev) => ({ ...prev, isVisible: true, isMinimized: false }))
  }

  const handleClosePlayground = () => {
    setPlaygroundState((prev) => ({ ...prev, isVisible: false }))
  }

  const handleMinimizePlayground = () => {
    setPlaygroundState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }))
  }

  const handleMaximizePlayground = () => {
    setPlaygroundState((prev) => ({ ...prev, isMaximized: !prev.isMaximized }))
  }

  const handleOpenAIAssistant = () => {
    setAIAssistantState((prev) => ({ ...prev, isVisible: true, isMinimized: false }))
  }

  const handleCloseAIAssistant = () => {
    setAIAssistantState((prev) => ({ ...prev, isVisible: false }))
  }

  const handleMinimizeAIAssistant = () => {
    setAIAssistantState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }))
  }

  const handleMaximizeAIAssistant = () => {
    setAIAssistantState((prev) => ({ ...prev, isMaximized: !prev.isMaximized }))
  }

  const handleAIAssistantMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    if (!(e.target as HTMLElement).closest(".ai-assistant-header")) return

    setAIAssistantState((prev) => ({
      ...prev,
      isDragging: true,
      dragStartX: e.clientX - prev.x,
      dragStartY: e.clientY - prev.y,
    }))
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (aiAssistantState.isDragging) {
        setAIAssistantState((prev) => ({
          ...prev,
          x: e.clientX - prev.dragStartX,
          y: e.clientY - prev.dragStartY,
        }))
      }
    }

    const handleMouseUp = () => {
      setAIAssistantState((prev) => ({ ...prev, isDragging: false }))
    }

    if (aiAssistantState.isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [aiAssistantState.isDragging])

  return (
    <div className="h-screen flex flex-col bg-[#E8EEF7]">
      {/* Header */}
      <div className="h-14 bg-gradient-to-r from-[#1976D2] to-[#2196F3] flex items-center justify-between px-4 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="bg-[#FF6B35] px-3 py-1.5 rounded font-bold text-sm">VR</div>
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              className="hover:bg-white/10 px-3 py-1.5 rounded transition-colors text-white"
              onClick={handleSave}
            >
              File
            </Button>
            <Button
              variant="ghost"
              className="hover:bg-white/10 px-3 py-1.5 rounded transition-colors text-white"
              onClick={handleOpen}
            >
              Tools
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">VEXcode Project</span>
          <span className="text-xs text-white/70">Not Saving</span>
        </div>
        <div className="flex items-center gap-2">
          {!playgroundState.isVisible && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenPlayground}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              Open Playground
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="bg-pink-500 hover:bg-pink-600 text-white border-0 flex items-center gap-1"
            onClick={handleOpenAIAssistant}
          >
            <HelpCircle className="h-4 w-4" />
            Get Help
          </Button>
          <Button
            size="sm"
            className="bg-green-500 hover:bg-green-600 text-white border-0"
            onClick={handleRun}
            disabled={isRunning}
          >
            <Play className="h-4 w-4 mr-1" />
            START
          </Button>
          <Button size="sm" className="bg-purple-500 hover:bg-purple-600 text-white border-0" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            RESET
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Category Icons */}
        <div className="w-20 bg-[#D6E4F5] border-r border-gray-300 flex flex-col items-center py-4 gap-1 relative">
          <Button
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              categoryState.selectedCategory === "drivetrain"
                ? "bg-[#4A90E2] text-white"
                : "bg-[#4A90E2]/20 text-[#4A90E2] hover:bg-[#4A90E2]/30"
            }`}
            onClick={() => handleSelectCategory("drivetrain")}
          >
            <Cog className="h-6 w-6" />
            <span className="text-[10px] font-medium">Drivetrain</span>
          </Button>
          <Button
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              categoryState.selectedCategory === "magnet"
                ? "bg-[#9B59B6] text-white"
                : "bg-[#9B59B6]/20 text-[#9B59B6] hover:bg-[#9B59B6]/30"
            }`}
            onClick={() => handleSelectCategory("magnet")}
          >
            <Magnet className="h-6 w-6" />
            <span className="text-[10px] font-medium">Magnet</span>
          </Button>
          <Button
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              categoryState.selectedCategory === "drawing"
                ? "bg-[#E67E22] text-white"
                : "bg-[#E67E22]/20 text-[#E67E22] hover:bg-[#E67E22]/30"
            }`}
            onClick={() => handleSelectCategory("drawing")}
          >
            <Pencil className="h-6 w-6" />
            <span className="text-[10px] font-medium">Drawing</span>
          </Button>
          <Button
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              categoryState.selectedCategory === "sensing"
                ? "bg-[#27AE60] text-white"
                : "bg-[#27AE60]/20 text-[#27AE60] hover:bg-[#27AE60]/30"
            }`}
            onClick={() => handleSelectCategory("sensing")}
          >
            <Eye className="h-6 w-6" />
            <span className="text-[10px] font-medium">Sensing</span>
          </Button>
          <Button
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              categoryState.selectedCategory === "console"
                ? "bg-[#7F8C8D] text-white"
                : "bg-[#7F8C8D]/20 text-[#7F8C8D] hover:bg-[#7F8C8D]/30"
            }`}
            onClick={() => handleSelectCategory("console")}
          >
            <Terminal className="h-6 w-6" />
            <span className="text-[10px] font-medium">Console</span>
          </Button>
          <Button
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              categoryState.selectedCategory === "logic"
                ? "bg-[#F5A623] text-white"
                : "bg-[#F5A623]/20 text-[#F5A623] hover:bg-[#F5A623]/30"
            }`}
            onClick={() => handleSelectCategory("logic")}
          >
            <GitBranch className="h-6 w-6" />
            <span className="text-[10px] font-medium">Logic</span>
          </Button>
          <Button
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              categoryState.selectedCategory === "loops"
                ? "bg-[#2ECC71] text-white"
                : "bg-[#2ECC71]/20 text-[#2ECC71] hover:bg-[#2ECC71]/30"
            }`}
            onClick={() => handleSelectCategory("loops")}
          >
            <ToggleLeft className="h-6 w-6" />
            <span className="text-[10px] font-medium">Switch</span>
          </Button>

          <div className="flex-1" />
          <Button
            variant="ghost"
            className="w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors bg-red-500/20 text-red-500 hover:bg-red-500/30"
            onClick={handleTrash}
          >
            <Trash2 className="h-6 w-6" />
            <span className="text-[10px] font-medium">Trash</span>
          </Button>
        </div>

        {/* Blockly Workspace */}
        <div className="flex-1 relative">
          {!blocklyLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-600">Loading Blockly...</p>
            </div>
          )}
          <div ref={blocklyDivRef} className="w-full h-full" />
        </div>
      </div>

      {/* Playground Window */}
      {playgroundState.isVisible && (
        <div
          ref={playgroundRef}
          onMouseDown={handlePlaygroundMouseDown}
          className="fixed bg-white rounded-lg shadow-2xl border-2 border-gray-300 z-50 transition-all duration-200"
          style={{
            left: `${playgroundState.x}px`,
            top: `${playgroundState.y}px`,
            cursor: playgroundState.isDragging ? "grabbing" : "auto",
            width: playgroundState.isMaximized ? "600px" : "400px",
            height: playgroundState.isMaximized ? "600px" : "auto",
          }}
        >
          <div className="playground-header bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white px-4 py-2 rounded-t-lg flex items-center justify-between cursor-grab active:cursor-grabbing">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-white/70" />
              <h3 className="font-semibold text-sm">Ocean Cleanup</h3>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleMinimizePlayground()
                }}
              >
                {playgroundState.isMinimized ? <Maximize className="h-4 w-4" /> : <Minimize className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleMaximizePlayground()
                }}
              >
                {playgroundState.isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClosePlayground()
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {!playgroundState.isMinimized && (
            <div className="flex flex-col">
              {/* Fixed layout with canvas, right ruler, and bottom ruler */}
              <div className="flex">
                <canvas
                  ref={canvasRef}
                  width={playgroundState.isMaximized ? 600 : 400}
                  height={playgroundState.isMaximized ? 600 : 400}
                />
                {/* Right ruler at far right edge */}
                <div
                  className="w-8 bg-gray-100 border-l border-gray-300 flex flex-col items-center justify-between py-1 text-[9px] text-gray-600"
                  style={{ height: playgroundState.isMaximized ? 600 : 400 }}
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="transform -rotate-90 whitespace-nowrap">
                      {playgroundState.isMaximized ? i * 150 : i * 100}
                    </span>
                  ))}
                </div>
              </div>
              {/* Bottom ruler */}
              <div
                className="h-8 bg-gray-100 border-t border-gray-300 flex items-center justify-between px-4 text-[9px] text-gray-600"
                style={{ width: playgroundState.isMaximized ? 600 : 400 }}
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i}>{playgroundState.isMaximized ? i * 150 : i * 100}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Assistant Window */}
      {aiAssistantState.isVisible && (
        <div
          ref={aiAssistantRef}
          onMouseDown={handleAIAssistantMouseDown}
          className="fixed bg-white rounded-lg shadow-2xl border-2 border-gray-300 z-50 transition-all duration-200"
          style={{
            left: `${aiAssistantState.x}px`,
            top: `${aiAssistantState.y}px`,
            cursor: aiAssistantState.isDragging ? "grabbing" : "auto",
            width: aiAssistantState.isMaximized ? "600px" : "400px",
            height: aiAssistantState.isMinimized ? "auto" : aiAssistantState.isMaximized ? "600px" : "auto",
          }}
        >
          <div className="ai-assistant-header bg-gradient-to-r from-[#9B59B6] to-[#8E44AD] text-white px-4 py-2 rounded-t-lg flex items-center justify-between cursor-grab active:cursor-grabbing">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-white/70" />
              <h3 className="font-semibold text-sm">AI Assistant</h3>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleMinimizeAIAssistant()
                }}
              >
                {aiAssistantState.isMinimized ? <Maximize className="h-4 w-4" /> : <Minimize className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleMaximizeAIAssistant()
                }}
              >
                {aiAssistantState.isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCloseAIAssistant()
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {!aiAssistantState.isMinimized && (
            <div className="p-4 overflow-auto">
              {aiAssistantState.surveyStep === "main" ? (
                <div className="text-gray-700">
                  <p className="mb-4 font-medium text-base">What sort of help do you want?</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                      onClick={() => setAIAssistantState((prev) => ({ ...prev, surveyStep: "strategy" }))}
                    >
                      <span className="mr-2 text-purple-600 font-semibold">1.</span>
                      Come up with a strategy
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                      onClick={() => setAIAssistantState((prev) => ({ ...prev, surveyStep: "fix" }))}
                    >
                      <span className="mr-2 text-purple-600 font-semibold">2.</span>
                      Fix something that's not working
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                      onClick={() => setAIAssistantState((prev) => ({ ...prev, surveyStep: "compare" }))}
                    >
                      <span className="mr-2 text-purple-600 font-semibold">3.</span>
                      Compare to a previous attempt
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                      onClick={() => setAIAssistantState((prev) => ({ ...prev, surveyStep: "feel" }))}
                    >
                      <span className="mr-2 text-purple-600 font-semibold">4.</span>
                      Tell me how you feel
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                      onClick={() => setAIAssistantState((prev) => ({ ...prev, surveyStep: "partner" }))}
                    >
                      <span className="mr-2 text-purple-600 font-semibold">5.</span>
                      Work with a partner
                    </Button>
                  </div>
                </div>
              ) : aiAssistantState.surveyStep === "strategy" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-purple-600 hover:text-purple-800 -ml-2"
                    onClick={() => setAIAssistantState((prev) => ({ ...prev, surveyStep: "main" }))}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">What strategy would you like help with?</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">1.</span>Move faster (efficiently)
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">2.</span>Turn around at the edge
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">3.</span>Find more blocks that could help you
                    </Button>
                  </div>
                </div>
              ) : aiAssistantState.surveyStep === "fix" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-purple-600 hover:text-purple-800 -ml-2"
                    onClick={() => setAIAssistantState((prev) => ({ ...prev, surveyStep: "main" }))}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">What's not working?</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">1.</span>Robot isn't moving
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">2.</span>Robot moves the wrong direction
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">3.</span>Sensors aren't detecting anything
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">4.</span>Loop doesn't stop
                    </Button>
                  </div>
                </div>
              ) : aiAssistantState.surveyStep === "compare" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-purple-600 hover:text-purple-800 -ml-2"
                    onClick={() => setAIAssistantState((prev) => ({ ...prev, surveyStep: "main" }))}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">What would you like to compare?</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">1.</span>Compare speed of different attempts
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">2.</span>Compare accuracy of movements
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">3.</span>See what changed between versions
                    </Button>
                  </div>
                </div>
              ) : aiAssistantState.surveyStep === "feel" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-purple-600 hover:text-purple-800 -ml-2"
                    onClick={() => setAIAssistantState((prev) => ({ ...prev, surveyStep: "main" }))}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">How are you feeling?</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">1.</span>Frustrated - nothing is working
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">2.</span>Stuck - not sure what to try next
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">3.</span>Curious - want to learn more
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">4.</span>Excited - making progress!
                    </Button>
                  </div>
                </div>
              ) : aiAssistantState.surveyStep === "partner" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-purple-600 hover:text-purple-800 -ml-2"
                    onClick={() => setAIAssistantState((prev) => ({ ...prev, surveyStep: "main" }))}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">How would you like to collaborate?</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">1.</span>Share my code with a partner
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">2.</span>Compare our solutions
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">3.</span>Work on different parts together
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <span className="mr-2 text-purple-600 font-semibold">4.</span>Explain my approach to someone
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Angle Picker Modals */}
      {anglePickerState.isOpen && anglePickerState.type === "wheel" && (
        <AngleWheelPicker
          value={anglePickerState.value}
          onChange={(newValue) => {
            if (anglePickerState.callback) {
              anglePickerState.callback(newValue)
            }
          }}
          onClose={() => setAnglePickerState((prev) => ({ ...prev, isOpen: false }))}
        />
      )}

      {anglePickerState.isOpen && anglePickerState.type === "compass" && (
        <CompassPicker
          value={anglePickerState.value}
          onChange={(newValue) => {
            if (anglePickerState.callback) {
              anglePickerState.callback(newValue)
            }
          }}
          onClose={() => setAnglePickerState((prev) => ({ ...prev, isOpen: false }))}
        />
      )}

      {distancePickerState.isOpen && (
        <DistanceSliderPicker
          value={distancePickerState.value}
          direction={distancePickerState.direction}
          robotState={robotState}
          onChange={(newValue) => {
            if (distancePickerState.callback) {
              distancePickerState.callback(newValue)
            }
          }}
          onClose={() => setDistancePickerState((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  )
}

// Block definition functions - pass setAnglePickerState to drivetrain blocks
function defineDrivetrainBlocks(Blockly: any, setAnglePickerState: any, setDistancePickerState: any) {
  // Added setDistancePickerState
  Blockly.Blocks["drive_simple"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("drive")
        .appendField(
          new Blockly.FieldDropdown([
            ["forward", "forward"],
            ["reverse", "reverse"],
          ]),
          "DIRECTION",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Drive the robot forward or reverse")
    },
  }

  Blockly.JavaScript.forBlock["drive_simple"] = (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    return `await robot.drive('${direction}');\n`
  }

  Blockly.Blocks["drive_distance"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("drive")
        .appendField(
          new Blockly.FieldDropdown([
            ["forward", "forward"],
            ["reverse", "reverse"],
          ]),
          "DIRECTION",
        )
        .appendField("for")
        // Changed to use the DistanceSliderPicker
        .appendField(
          new Blockly.FieldTextInput("200", (val) => {
            // setDistancePickerState({
            //   isOpen: true,
            //   value: Number(val),
            //   direction: this.getFieldValue("DIRECTION"),
            //   callback: (newVal) => {
            //     this.setFieldValue(newVal.toString(), "DISTANCE")
            //     Blockly.Events.fire(new Blockly.Events.Change(this, "field", "DISTANCE", val, newVal.toString()))
            //   },
            // })
            return val // Keep the old value until updated by the picker
          }),
          "DISTANCE",
        )
        .appendField(
          new Blockly.FieldDropdown([
            ["mm", "mm"],
            ["inches", "inches"],
          ]),
          "UNIT",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Drive the robot a specific distance")
    },
  }

  Blockly.JavaScript.forBlock["drive_distance"] = (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    const distance = block.getFieldValue("DISTANCE")
    const unit = block.getFieldValue("UNIT")
    return `await robot.drive('${direction}', ${distance}, '${unit}');\n`
  }

  Blockly.Blocks["turn_simple"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("turn")
        .appendField(
          new Blockly.FieldDropdown([
            ["right", "right"],
            ["left", "left"],
          ]),
          "DIRECTION",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Turn the robot right or left")
    },
  }

  Blockly.JavaScript.forBlock["turn_simple"] = (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    return `await robot.turn('${direction}');\n`
  }

  Blockly.Blocks["turn_degrees"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("turn")
        .appendField(
          new Blockly.FieldDropdown([
            ["right", "right"],
            ["left", "left"],
          ]),
          "DIRECTION",
        )
        .appendField("for")
        .appendField(
          new Blockly.FieldNumber(90, 0, 360, null, (newValue: number) => {
            // Removed direct call to setAnglePickerState, will be handled by click listener
          }),
          "DEGREES",
        )
        .appendField("degrees")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Turn the robot a specific number of degrees")
    },
  }

  Blockly.JavaScript.forBlock["turn_degrees"] = (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    const degrees = block.getFieldValue("DEGREES")
    return `await robot.turn('${direction}', ${degrees});\n`
  }

  Blockly.Blocks["turn_to_heading"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("turn to heading")
        .appendField(
          new Blockly.FieldNumber(90, 0, 359, null, (newValue: number) => {
            // Removed direct call to setAnglePickerState, will be handled by click listener
          }),
          "HEADING",
        )
        .appendField("degrees")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Turn to a specific heading (compass)")
    },
  }

  Blockly.JavaScript.forBlock["turn_to_heading"] = (block: any) => {
    const heading = block.getFieldValue("HEADING")
    return `await robot.turnToHeading(${heading});\n`
  }

  Blockly.Blocks["turn_to_rotation"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("turn to rotation")
        .appendField(
          new Blockly.FieldNumber(90, 0, 360, null, (newValue: number) => {
            // Removed direct call to setAnglePickerState, will be handled by click listener
          }),
          "ROTATION",
        )
        .appendField("degrees")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Turn to a specific rotation")
    },
  }

  Blockly.JavaScript.forBlock["turn_to_rotation"] = (block: any) => {
    const rotation = block.getFieldValue("ROTATION")
    return `await robot.turnToRotation(${rotation});\n`
  }

  Blockly.Blocks["stop_driving"] = {
    init: function () {
      this.appendDummyInput().appendField("stop driving")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Stop the robot")
    },
  }

  Blockly.JavaScript.forBlock["stop_driving"] = () => `robot.stopDriving();\n`

  Blockly.Blocks["set_drive_velocity"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set drive velocity to")
        .appendField(new Blockly.FieldNumber(50, 0, 100), "VELOCITY")
        .appendField("%")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the drive velocity")
    },
  }

  Blockly.JavaScript.forBlock["set_drive_velocity"] = (block: any) => {
    const velocity = block.getFieldValue("VELOCITY")
    return `robot.setDriveVelocity(${velocity});\n`
  }

  Blockly.Blocks["set_turn_velocity"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set turn velocity to")
        .appendField(new Blockly.FieldNumber(50, 0, 100), "VELOCITY")
        .appendField("%")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the turn velocity")
    },
  }

  Blockly.JavaScript.forBlock["set_turn_velocity"] = (block: any) => {
    const velocity = block.getFieldValue("VELOCITY")
    return `robot.setTurnVelocity(${velocity});\n`
  }

  Blockly.Blocks["set_drive_heading"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set drive heading to")
        .appendField(
          new Blockly.FieldNumber(0, 0, 359, 1, (newValue: string) => {
            // Removed direct call to setAnglePickerState, will be handled by click listener
          }),
          "HEADING",
        )
        .appendField("degrees")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the drive heading")
    },
  }

  Blockly.JavaScript.forBlock["set_drive_heading"] = (block: any) => {
    const heading = block.getFieldValue("HEADING")
    return `robot.setDriveHeading(${heading});\n`
  }

  Blockly.Blocks["set_drive_rotation"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set drive rotation to")
        .appendField(
          new Blockly.FieldNumber(0, 0, 360, 1, (newValue: string) => {
            // Removed direct call to setAnglePickerState, will be handled by click listener
          }),
          "ROTATION",
        )
        .appendField("degrees")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the drive rotation")
    },
  }

  Blockly.JavaScript.forBlock["set_drive_rotation"] = (block: any) => {
    const rotation = block.getFieldValue("ROTATION")
    return `robot.setDriveRotation(${rotation});\n`
  }

  Blockly.Blocks["set_drive_timeout"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set drive timeout to")
        .appendField(new Blockly.FieldNumber(1, 0), "TIMEOUT")
        .appendField("seconds")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the drive timeout")
    },
  }

  Blockly.JavaScript.forBlock["set_drive_timeout"] = (block: any) => {
    const timeout = block.getFieldValue("TIMEOUT")
    return `await robot.setDriveTimeout(${timeout});\n`
  }
}

function defineMagnetBlocks(Blockly: any) {
  Blockly.Blocks["energize_magnet"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("energize")
        .appendField(
          new Blockly.FieldDropdown([
            ["Magnet", "magnet"],
            ["Electromagnet", "electromagnet"],
          ]),
          "DEVICE",
        )
        .appendField("to")
        .appendField(
          new Blockly.FieldDropdown([
            ["boost", "boost"],
            ["drop", "drop"],
            ["off", "off"],
          ]),
          "MODE",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
      this.setTooltip("Energize the magnet to boost, drop, or turn off")
    },
  }

  Blockly.JavaScript.forBlock["energize_magnet"] = (block: any) => {
    const device = block.getFieldValue("DEVICE")
    const mode = block.getFieldValue("MODE")
    return `robot.energize('${device}', '${mode}');\n`
  }
}

function defineDrawingBlocks(Blockly: any) {
  Blockly.Blocks["move_pen"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("Move Pen")
        .appendField(
          new Blockly.FieldDropdown([
            ["down", "down"],
            ["up", "up"],
          ]),
          "POSITION",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#E67E22")
      this.setTooltip("Move the pen up or down")
    },
  }

  Blockly.JavaScript.forBlock["move_pen"] = (block: any) => {
    const position = block.getFieldValue("POSITION")
    return `robot.movePen('${position}');\n`
  }

  Blockly.Blocks["set_pen_width"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set pen to width")
        .appendField(
          new Blockly.FieldDropdown([
            ["thin", "thin"],
            ["medium", "medium"],
            ["thick", "thick"],
          ]),
          "WIDTH",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#E67E22")
      this.setTooltip("Set the pen width")
    },
  }

  Blockly.JavaScript.forBlock["set_pen_width"] = (block: any) => {
    const width = block.getFieldValue("WIDTH")
    return `robot.setPenWidth('${width}');\n`
  }

  Blockly.Blocks["set_pen_color"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set pen to color")
        .appendField(
          new Blockly.FieldDropdown([
            ["black", "black"],
            ["red", "red"],
            ["blue", "blue"],
            ["green", "green"],
            ["yellow", "yellow"],
            ["purple", "purple"],
            ["orange", "orange"],
          ]),
          "COLOR",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#E67E22")
      this.setTooltip("Set the pen color")
    },
  }

  Blockly.JavaScript.forBlock["set_pen_color"] = (block: any) => {
    const color = block.getFieldValue("COLOR")
    return `robot.setPenColor('${color}');\n`
  }
}

function defineSensingBlocks(Blockly: any) {
  Blockly.Blocks["bumper_pressed"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["LeftBumper", "left"],
            ["RightBumper", "right"],
          ]),
          "BUMPER",
        )
        .appendField("pressed?")
      this.setOutput(true, "Boolean")
      this.setColour("#5DADE2")
      this.setTooltip("Check if bumper is pressed")
    },
  }
  Blockly.JavaScript.forBlock["bumper_pressed"] = (block: any) => {
    const bumper = block.getFieldValue("BUMPER")
    return [`robot.bumperPressed('${bumper}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["when_bumper"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("when")
        .appendField(
          new Blockly.FieldDropdown([
            ["LeftBumper", "left"],
            ["RightBumper", "right"],
          ]),
          "BUMPER",
        )
        .appendField(
          new Blockly.FieldDropdown([
            ["pressed", "pressed"],
            ["released", "released"],
          ]),
          "STATE",
        )
      this.setNextStatement(true, null)
      this.setColour("#F4D03F")
      this.setTooltip("When bumper is pressed or released")
    },
  }
  Blockly.JavaScript.forBlock["when_bumper"] = (block: any) => {
    const bumper = block.getFieldValue("BUMPER")
    const state = block.getFieldValue("STATE")
    return `// Event: when ${bumper} bumper ${state}\n`
  }

  Blockly.Blocks["distance_found_object"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["FrontDistance", "front"],
            ["DownDistance", "down"],
          ]),
          "SENSOR",
        )
        .appendField("found an object?")
      this.setOutput(true, "Boolean")
      this.setColour("#5DADE2")
      this.setTooltip("Check if distance sensor found an object")
    },
  }
  Blockly.JavaScript.forBlock["distance_found_object"] = (block: any) => {
    const sensor = block.getFieldValue("SENSOR")
    return [`robot.distanceFoundObject('${sensor}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["distance_in_units"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["FrontDistance", "front"],
            ["DownDistance", "down"],
          ]),
          "SENSOR",
        )
        .appendField("in")
        .appendField(
          new Blockly.FieldDropdown([
            ["mm", "mm"],
            ["inches", "inches"],
          ]),
          "UNIT",
        )
      this.setOutput(true, "Number")
      this.setColour("#5DADE2")
      this.setTooltip("Get distance sensor reading")
    },
  }
  Blockly.JavaScript.forBlock["distance_in_units"] = (block: any) => {
    const sensor = block.getFieldValue("SENSOR")
    const unit = block.getFieldValue("UNIT")
    return [`robot.getDistance('${sensor}', '${unit}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["eye_is_near"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["FrontEye", "front"],
            ["DownEye", "down"],
          ]),
          "SENSOR",
        )
        .appendField("is near object?")
      this.setOutput(true, "Boolean")
      this.setColour("#5DADE2")
      this.setTooltip("Check if eye sensor is near an object")
    },
  }
  Blockly.JavaScript.forBlock["eye_is_near"] = (block: any) => {
    const sensor = block.getFieldValue("SENSOR")
    return [`robot.eyeIsNear('${sensor}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["eye_detects_color"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["FrontEye", "front"],
            ["DownEye", "down"],
          ]),
          "SENSOR",
        )
        .appendField("detects")
        .appendField(
          new Blockly.FieldDropdown([
            ["red", "red"],
            ["green", "green"],
            ["blue", "blue"],
            ["yellow", "yellow"],
            ["orange", "orange"],
            ["purple", "purple"],
          ]),
          "COLOR",
        )
        .appendField("?")
      this.setOutput(true, "Boolean")
      this.setColour("#5DADE2")
      this.setTooltip("Check if eye sensor detects a color")
    },
  }
  Blockly.JavaScript.forBlock["eye_detects_color"] = (block: any) => {
    const sensor = block.getFieldValue("SENSOR")
    const color = block.getFieldValue("COLOR")
    return [`robot.eyeDetectsColor('${sensor}', '${color}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["eye_brightness"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["FrontEye", "front"],
            ["DownEye", "down"],
          ]),
          "SENSOR",
        )
        .appendField("brightness in %")
      this.setOutput(true, "Number")
      this.setColour("#5DADE2")
      this.setTooltip("Get eye sensor brightness percentage")
    },
  }
  Blockly.JavaScript.forBlock["eye_brightness"] = (block: any) => {
    const sensor = block.getFieldValue("SENSOR")
    return [`robot.eyeBrightness('${sensor}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["when_eye_detects"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("when")
        .appendField(
          new Blockly.FieldDropdown([
            ["FrontEye", "front"],
            ["DownEye", "down"],
          ]),
          "SENSOR",
        )
        .appendField(
          new Blockly.FieldDropdown([
            ["detects", "detects"],
            ["loses", "loses"],
          ]),
          "STATE",
        )
        .appendField("an object")
      this.setNextStatement(true, null)
      this.setColour("#F4D03F")
      this.setTooltip("When eye detects or loses an object")
    },
  }
  Blockly.JavaScript.forBlock["when_eye_detects"] = (block: any) => {
    const sensor = block.getFieldValue("SENSOR")
    const state = block.getFieldValue("STATE")
    return `// Event: when ${sensor} eye ${state} an object\n`
  }

  Blockly.Blocks["position_value"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("position")
        .appendField(
          new Blockly.FieldDropdown([
            ["X", "x"],
            ["Y", "y"],
          ]),
          "AXIS",
        )
        .appendField("in")
        .appendField(
          new Blockly.FieldDropdown([
            ["mm", "mm"],
            ["inches", "inches"],
          ]),
          "UNIT",
        )
      this.setOutput(true, "Number")
      this.setColour("#5DADE2")
      this.setTooltip("Get robot position")
    },
  }
  Blockly.JavaScript.forBlock["position_value"] = (block: any) => {
    const axis = block.getFieldValue("AXIS")
    const unit = block.getFieldValue("UNIT")
    return [`robot.getPosition('${axis}', '${unit}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["position_angle"] = {
    init: function () {
      this.appendDummyInput().appendField("position angle in degrees")
      this.setOutput(true, "Number")
      this.setColour("#5DADE2")
      this.setTooltip("Get robot rotation angle")
    },
  }
  Blockly.JavaScript.forBlock["position_angle"] = () => {
    return [`robot.getPositionAngle()`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }
}

function defineConsoleBlocks(Blockly: any) {
  Blockly.Blocks["print_text"] = {
    init: function () {
      this.appendDummyInput().appendField("print").appendField(new Blockly.FieldTextInput("VEXcode"), "TEXT")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
      this.setTooltip("Print text to the console")
    },
  }
  Blockly.JavaScript.forBlock["print_text"] = (block: any) => {
    const text = block.getFieldValue("TEXT")
    return `robot.print('${text}');\n`
  }

  Blockly.Blocks["set_cursor_next_row"] = {
    init: function () {
      this.appendDummyInput().appendField("set cursor to next row")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
      this.setTooltip("Move cursor to next row")
    },
  }
  Blockly.JavaScript.forBlock["set_cursor_next_row"] = () => `robot.setCursorNextRow();\n`

  Blockly.Blocks["clear_all_rows"] = {
    init: function () {
      this.appendDummyInput().appendField("clear all rows")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
      this.setTooltip("Clear all console rows")
    },
  }
  Blockly.JavaScript.forBlock["clear_all_rows"] = () => `robot.clearAllRows();\n`

  Blockly.Blocks["set_print_precision"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set print precision to")
        .appendField(
          new Blockly.FieldDropdown([
            ["0.1", "0.1"],
            ["0.01", "0.01"],
            ["0.001", "0.001"],
            ["1", "1"],
          ]),
          "PRECISION",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
      this.setTooltip("Set print precision for numbers")
    },
  }
  Blockly.JavaScript.forBlock["set_print_precision"] = (block: any) => {
    const precision = block.getFieldValue("PRECISION")
    return `robot.setPrintPrecision(${precision});\n`
  }

  Blockly.Blocks["set_print_color"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set print color")
        .appendField(
          new Blockly.FieldDropdown([
            ["black", "black"],
            ["red", "red"],
            ["green", "green"],
            ["blue", "blue"],
            ["white", "white"],
          ]),
          "COLOR",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
      this.setTooltip("Set print text color")
    },
  }
  Blockly.JavaScript.forBlock["set_print_color"] = (block: any) => {
    const color = block.getFieldValue("COLOR")
    return `robot.setPrintColor('${color}');\n`
  }
}

function defineLogicBlocks(Blockly: any) {
  Blockly.Blocks["wait_seconds"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("wait")
        .appendField(new Blockly.FieldNumber(1, 0), "SECONDS")
        .appendField("seconds")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Wait for specified seconds")
    },
  }
  Blockly.JavaScript.forBlock["wait_seconds"] = (block: any) => {
    const seconds = block.getFieldValue("SECONDS")
    return `await robot.wait(${seconds});\n`
  }

  Blockly.Blocks["wait_until"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("wait until")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Wait until condition is true")
    },
  }
  Blockly.JavaScript.forBlock["wait_until"] = (block: any) => {
    const condition = Blockly.JavaScript.valueToCode(block, "CONDITION", Blockly.JavaScript.ORDER_NONE) || "false"
    return `while (!(${condition})) { await robot.wait(0.1); }\n`
  }

  Blockly.Blocks["repeat_times"] = {
    init: function () {
      this.appendDummyInput().appendField("repeat").appendField(new Blockly.FieldNumber(10, 1), "TIMES")
      this.appendStatementInput("DO").appendField("")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Repeat blocks a number of times")
    },
  }
  Blockly.JavaScript.forBlock["repeat_times"] = (block: any) => {
    const times = block.getFieldValue("TIMES")
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `for (let i = 0; i < ${times}; i++) {\n${statements}}\n`
  }

  Blockly.Blocks["forever_loop"] = {
    init: function () {
      this.appendDummyInput().appendField("forever")
      this.appendStatementInput("DO").appendField("")
      this.setPreviousStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Repeat blocks forever")
    },
  }
  Blockly.JavaScript.forBlock["forever_loop"] = (block: any) => {
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `while (true) {\n${statements}await robot.wait(0.01);\n}\n`
  }

  Blockly.Blocks["repeat_until"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("repeat until")
      this.appendStatementInput("DO").appendField("")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Repeat blocks until condition is true")
    },
  }
  Blockly.JavaScript.forBlock["repeat_until"] = (block: any) => {
    const condition = Blockly.JavaScript.valueToCode(block, "CONDITION", Blockly.JavaScript.ORDER_NONE) || "false"
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `while (!(${condition})) {\n${statements}}\n`
  }

  Blockly.Blocks["while_loop"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("while")
      this.appendStatementInput("DO").appendField("")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Repeat blocks while condition is true")
    },
  }
  Blockly.JavaScript.forBlock["while_loop"] = (block: any) => {
    const condition = Blockly.JavaScript.valueToCode(block, "CONDITION", Blockly.JavaScript.ORDER_NONE) || "false"
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `while (${condition}) {\n${statements}}\n`
  }

  Blockly.Blocks["if_then"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("if")
      this.appendDummyInput().appendField("then")
      this.appendStatementInput("DO").appendField("")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("If condition is true, do something")
    },
  }
  Blockly.JavaScript.forBlock["if_then"] = (block: any) => {
    const condition = Blockly.JavaScript.valueToCode(block, "CONDITION", Blockly.JavaScript.ORDER_NONE) || "false"
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `if (${condition}) {\n${statements}}\n`
  }

  Blockly.Blocks["if_then_else"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("if")
      this.appendDummyInput().appendField("then")
      this.appendStatementInput("DO").appendField("")
      this.appendDummyInput().appendField("else")
      this.appendStatementInput("ELSE").appendField("")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("If condition is true, do something, otherwise do something else")
    },
  }
  Blockly.JavaScript.forBlock["if_then_else"] = (block: any) => {
    const condition = Blockly.JavaScript.valueToCode(block, "CONDITION", Blockly.JavaScript.ORDER_NONE) || "false"
    const doStatements = Blockly.JavaScript.statementToCode(block, "DO")
    const elseStatements = Blockly.JavaScript.statementToCode(block, "ELSE")
    return `if (${condition}) {\n${doStatements}} else {\n${elseStatements}}\n`
  }

  Blockly.Blocks["if_elseif_else"] = {
    init: function () {
      this.appendValueInput("CONDITION1").setCheck("Boolean").appendField("if")
      this.appendDummyInput().appendField("then")
      this.appendStatementInput("DO1").appendField("")
      this.appendValueInput("CONDITION2").setCheck("Boolean").appendField("else if")
      this.appendDummyInput().appendField("then")
      this.appendStatementInput("DO2").appendField("")
      this.appendDummyInput().appendField("else")
      this.appendStatementInput("ELSE").appendField("")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("If/else if/else chain")
    },
  }
  Blockly.JavaScript.forBlock["if_elseif_else"] = (block: any) => {
    const condition1 = Blockly.JavaScript.valueToCode(block, "CONDITION1", Blockly.JavaScript.ORDER_NONE) || "false"
    const do1 = Blockly.JavaScript.statementToCode(block, "DO1")
    const condition2 = Blockly.JavaScript.valueToCode(block, "CONDITION2", Blockly.JavaScript.ORDER_NONE) || "false"
    const do2 = Blockly.JavaScript.statementToCode(block, "DO2")
    const elseStatements = Blockly.JavaScript.statementToCode(block, "ELSE")
    return `if (${condition1}) {\n${do1}} else if (${condition2}) {\n${do2}} else {\n${elseStatements}}\n`
  }

  Blockly.Blocks["break_block"] = {
    init: function () {
      this.appendDummyInput().appendField("break")
      this.setPreviousStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Break out of loop")
    },
  }
  Blockly.JavaScript.forBlock["break_block"] = () => {
    return "break;\n"
  }

  Blockly.Blocks["stop_project"] = {
    init: function () {
      this.appendDummyInput().appendField("stop project")
      this.setPreviousStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Stop the entire project")
    },
  }
  Blockly.JavaScript.forBlock["stop_project"] = () => {
    return "robot.stop(); return;\n"
  }

  Blockly.Blocks["comment_block"] = {
    init: function () {
      this.appendDummyInput().appendField("comment").appendField(new Blockly.FieldTextInput(""), "TEXT")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#888888")
      this.setTooltip("Add a comment")
    },
  }
  Blockly.JavaScript.forBlock["comment_block"] = (block: any) => {
    const text = block.getFieldValue("TEXT")
    return `// ${text}\n`
  }
}

function defineSwitchBlocks(Blockly: any) {
  Blockly.Blocks["function_definition"] = {
    init: function () {
      this.appendDummyInput().appendField("define").appendField(new Blockly.FieldTextInput("myFunction"), "NAME")
      this.appendStatementInput("STACK").appendField("")
      this.setColour("#4CAF9C")
      this.setTooltip("Define a function")
    },
  }
  Blockly.JavaScript.forBlock["function_definition"] = (block: any) => {
    const name = block.getFieldValue("NAME")
    const statements = Blockly.JavaScript.statementToCode(block, "STACK")
    return `async function ${name}() {\n${statements}}\n`
  }

  Blockly.Blocks["function_call"] = {
    init: function () {
      this.appendDummyInput().appendField("call").appendField(new Blockly.FieldTextInput("myFunction"), "NAME")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4CAF9C")
      this.setTooltip("Call a function")
    },
  }
  Blockly.JavaScript.forBlock["function_call"] = (block: any) => {
    const name = block.getFieldValue("NAME")
    return `await ${name}();\n`
  }

  Blockly.Blocks["function_with_input"] = {
    init: function () {
      this.appendDummyInput().appendField("define").appendField(new Blockly.FieldTextInput("myFunction"), "NAME")
      this.appendValueInput("INPUT1").appendField("input")
      this.appendStatementInput("STACK").appendField("")
      this.setColour("#4CAF9C")
      this.setTooltip("Define a function with input")
    },
  }
  Blockly.JavaScript.forBlock["function_with_input"] = (block: any) => {
    const name = block.getFieldValue("NAME")
    const statements = Blockly.JavaScript.statementToCode(block, "STACK")
    return `async function ${name}(input) {\n${statements}}\n`
  }

  Blockly.Blocks["boolean_and"] = {
    init: function () {
      this.appendValueInput("A").setCheck("Boolean")
      this.appendDummyInput().appendField("and")
      this.appendValueInput("B").setCheck("Boolean")
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF9C")
      this.setInputsInline(true)
      this.setTooltip("Returns true if both inputs are true")
    },
  }
  Blockly.JavaScript.forBlock["boolean_and"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_LOGICAL_AND) || "false"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_LOGICAL_AND) || "false"
    return [`(${a} && ${b})`, Blockly.JavaScript.ORDER_LOGICAL_AND]
  }

  Blockly.Blocks["boolean_or"] = {
    init: function () {
      this.appendValueInput("A").setCheck("Boolean")
      this.appendDummyInput().appendField("or")
      this.appendValueInput("B").setCheck("Boolean")
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF9C")
      this.setInputsInline(true)
      this.setTooltip("Returns true if either input is true")
    },
  }
  Blockly.JavaScript.forBlock["boolean_or"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_LOGICAL_OR) || "false"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_LOGICAL_OR) || "false"
    return [`(${a} || ${b})`, Blockly.JavaScript.ORDER_LOGICAL_OR]
  }

  Blockly.Blocks["boolean_not"] = {
    init: function () {
      this.appendValueInput("A").setCheck("Boolean").appendField("not")
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF9C")
      this.setTooltip("Returns the opposite")
    },
  }
  Blockly.JavaScript.forBlock["boolean_not"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_LOGICAL_NOT) || "true"
    return [`!${a}`, Blockly.JavaScript.ORDER_LOGICAL_NOT]
  }

  Blockly.Blocks["compare_equal"] = {
    init: function () {
      this.appendValueInput("A")
      this.appendDummyInput().appendField("=")
      this.appendValueInput("B")
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF9C")
      this.setInputsInline(true)
      this.setTooltip("Check if values are equal")
    },
  }
  Blockly.JavaScript.forBlock["compare_equal"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_EQUALITY) || "0"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_EQUALITY) || "0"
    return [`(${a} === ${b})`, Blockly.JavaScript.ORDER_EQUALITY]
  }

  Blockly.Blocks["when_started"] = {
    init: function () {
      this.appendDummyInput().appendField(new Blockly.FieldLabel("when started", "when-started-text"))
      this.appendStatementInput("STACK")
      this.setColour("#F5C631") // Yellow/gold color matching the image
      this.setTooltip("Run when program starts")
      this.setDeletable(false)
      this.setMovable(true)
      // Hat shape - no previous connection, only next statement connection
      this.setPreviousStatement(false)
      this.setNextStatement(false)
      // This makes it a "hat" block shape in Blockly
      this.hat = "cap"
    },
  }
  Blockly.JavaScript.forBlock["when_started"] = (block: any) => {
    const statements = Blockly.JavaScript.statementToCode(block, "STACK")
    return `// When started\n${statements}`
  }
}
