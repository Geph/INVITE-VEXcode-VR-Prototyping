"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  clampRobotPosition,
  CORAL_REEF_BATTERY_SEC,
  CORAL_REEF_FIELD_MM,
  CORAL_REEF_TRASH_COUNT,
  createInitialTrashItems,
  distanceToPixels,
  DISTANCE_SENSOR_MAX_MM,
  driveDurationMs,
  fieldMmToPixel,
  fieldRulerTicksMm,
  forEachProgramBlock,
  getDefaultRobotPixelPosition,
  getPlaygroundCanvasSize,
  maxDriveDistanceMm,
  nearestTrashDistanceMm,
  normalizeDegrees,
  pixelToFieldMm,
  pixelsToDistance,
  pointHitsCoral,
  raycastToBorder,
  registerBlockGenerator,
  seededRandom,
  shortestRotationDelta,
  turnDurationMs,
  type CoralPiece,
} from "@/lib/robot-runtime"
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
  Lightbulb,
  Wrench,
  GitCompare,
  Heart,
  Users,
  Zap,
  Search,
  StopCircle,
  ArrowLeftRight,
  RefreshCw,
  Gauge,
  Target,
  FileDiff,
  Frown,
  Sparkles,
  PartyPopper,
  Share2,
  ArrowLeft,
  Settings,
  Calculator,
} from "lucide-react"

declare global {
  interface Window {
    Blockly: any
  }
}

/** Close any active Blockly inline editor so it cannot overwrite picker values on Apply. */
function dismissBlocklyFieldEditors() {
  if (typeof window === "undefined" || !window.Blockly) return
  const Blockly = window.Blockly
  try {
    Blockly.WidgetDiv?.hide?.()
    Blockly.DropDownDiv?.hideIfOwner?.(null)
    Blockly.DropDownDiv?.hide?.()
  } catch {
    /* Blockly may not have dropdown API in all builds */
  }
}

/** Push a new number into a Blockly field and refresh the workspace SVG immediately. */
function updateBlocklyNumberField(
  block: {
    id: string
    setFieldValue: (value: string, name: string) => void
    getFieldValue: (name: string) => string
    getField: (name: string) => {
      setValue: (value: string) => void
      getSvgRoot?: () => SVGElement | null
    } | null
    render?: () => void
  },
  workspace: { render: () => void },
  fieldName: string,
  value: number,
) {
  dismissBlocklyFieldEditors()

  const text = String(Math.round(value))
  const oldText = String(block.getFieldValue(fieldName))
  const Blockly = window.Blockly

  if (Blockly?.Events?.isEnabled?.() && oldText !== text) {
    Blockly.Events.fire(new Blockly.Events.BlockChange(block, "field", fieldName, oldText, text))
  }

  block.setFieldValue(text, fieldName)
  const field = block.getField(fieldName)
  if (field) {
    field.setValue(text)
    const textEl = field.getSvgRoot?.()?.querySelector("text")
    if (textEl) {
      textEl.textContent = text
    }
  }

  block.render?.()
  workspace.render()
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

interface RobotConfigState {
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
  surveyStep: "main" | "strategy" | "predict" | "fix" | "compare" | "feel" | "partner" | "strategy-examples"
}

interface CategoryState {
  selectedCategory: string | null
}

interface TrashItem {
  id: number
  x: number
  y: number
  type: "bottle" | "can" | "wrapper" | "bag"
  scale: number
  floatOffset: number
  isCollected: boolean
}

type MissionEndReason = "coral" | "battery" | "complete" | null

interface GameState {
  trashCollected: number
  trashTotal: number
  batteryPercent: number
  isGameOver: boolean
  isSpawningTrash: boolean
  gameLost: boolean
  runError: string | null
  showCelebration: boolean
  missionEndReason: MissionEndReason
}

// AngleWheelPicker component for rotation/degrees input
interface AngleWheelPickerProps {
  value: number
  onApply: (value: number) => void
  onClose: () => void
  max?: number
}

function AngleWheelPicker({ value, onApply, onClose, max = 360 }: AngleWheelPickerProps) {
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

// CompassPicker component for heading input
interface CompassPickerProps {
  value: number
  onApply: (value: number) => void
  onClose: () => void
}

function CompassPicker({ value, onApply, onClose }: CompassPickerProps) {
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

interface DistanceSliderPickerProps {
  value: number
  onApply: (value: number) => void
  onClose: () => void
  robotState: RobotState
  direction: string
  playgroundWidth: number
  playgroundHeight: number
}

function DistanceSliderPicker({
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
  const maxMm = Math.min(
    2000,
    Math.max(50, maxDriveDistanceMm(robotState.x, robotState.y, robotState.rotation, direction, playgroundWidth, playgroundHeight)),
  )

  useEffect(() => {
    setCurrentDistance(Math.min(value, maxMm))
  }, [value, maxMm])

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

    // Sandy floor (matches playground)
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

    // Coral border hint
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

    const robot = toPreview(robotState.x, robotState.y)
    const angleRad = (robotState.rotation * Math.PI) / 180
    const sign = direction === "forward" ? 1 : -1
    const distancePx = distanceToPixels(currentDistance, "mm")
    const end = toPreview(
      robotState.x + sign * distancePx * Math.sin(angleRad),
      robotState.y - sign * distancePx * Math.cos(angleRad),
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
  }, [currentDistance, robotState, direction, playgroundWidth, playgroundHeight, previewScale, previewSize])

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

function BlocklyEditor() {
  const blocklyDivRef = useRef<HTMLDivElement>(null)
  const playgroundRef = useRef<HTMLDivElement>(null)
  const aiAssistantRef = useRef<HTMLDivElement>(null)
  const predictCanvasRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [blocklyLoaded, setBlocklyLoaded] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>("drivetrain")
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const animationRef = useRef<number | null>(null)
  const [deletedBlocks, setDeletedBlocks] = useState<string | null>(null)
  const [showDeletedBlocks, setShowDeletedBlocks] = useState(false)
  const [aiStep, setAiStep] = useState<AIAssistantState["surveyStep"]>("main")

  const initialRobotPos = getDefaultRobotPixelPosition(false)
  const robotStateRef = useRef<{ x: number; y: number; rotation: number }>({
    x: initialRobotPos.x,
    y: initialRobotPos.y,
    rotation: 0,
  })
  const runtimeRef = useRef({
    driveVelocity: 50,
    turnVelocity: 50,
    driveTimeoutSec: null as number | null,
    heading: 0,
    penDown: false,
    penColor: "#000000",
    penWidth: 2,
    magnetBoost: false,
    printPrecision: 1,
    printColor: "black",
    lastPenPoint: null as { x: number; y: number } | null,
  })
  const isRunningRef = useRef(false)

  useEffect(() => {
    setIsMounted(true)
    const playgroundX = Math.max(16, window.innerWidth - 520)
    const aiX = Math.max(16, window.innerWidth - 420)
    setPlaygroundState((prev) => ({ ...prev, x: playgroundX }))
    setAiAssistantState((prev) => ({ ...prev, x: aiX }))
    setRobotConfigState((prev) => ({ ...prev, x: Math.max(16, window.innerWidth / 2 - 200) }))
  }, [])

  const [isMounted, setIsMounted] = useState(false)

  const [robotConfigState, setRobotConfigState] = useState<RobotConfigState>({
    x: 400,
    y: 150,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    isVisible: false,
    isMinimized: false,
    isMaximized: false,
  })

  const [robotCapabilities, setRobotCapabilities] = useState({
    eyeSensor: true,
    bumperSensor: true,
    arm: false,
    gyro: false,
    gps: false,
    inertial: false,
    rangeFinder: false,
    lineTracker: false,
  })

  const [coralPieces, setCoralPieces] = useState<CoralPiece[]>([])
  const [penTrail, setPenTrail] = useState<
    { x1: number; y1: number; x2: number; y2: number; color: string; width: number }[]
  >([])
  const [consoleLines, setConsoleLines] = useState<string[]>([])

  const [robotState, setRobotState] = useState<RobotState>({
    x: initialRobotPos.x,
    y: initialRobotPos.y,
    rotation: 0,
    driveVelocity: 50,
    turnVelocity: 50,
    heading: 0,
  })

  const [playgroundState, setPlaygroundState] = useState<PlaygroundState>({
    x: 400,
    y: 100,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    isVisible: true,
    isMinimized: false,
    isMaximized: false,
  })

  const [aiAssistantState, setAiAssistantState] = useState<AIAssistantState>({
    x: 400,
    y: 200,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    isVisible: false,
    isMinimized: false,
    isMaximized: true,
    surveyStep: "main",
  })

  const [anglePickerState, setAnglePickerState] = useState<{
    isOpen: boolean
    angle: number
    x: number
    y: number
  }>({
    isOpen: false,
    angle: 90,
    x: 0,
    y: 0,
  })

  const [compassPickerState, setCompassPickerState] = useState<{
    isOpen: boolean
    heading: number
    x: number
    y: number
  }>({
    isOpen: false,
    heading: 0,
    x: 0,
    y: 0,
  })

  const [distancePickerState, setDistancePickerState] = useState<{
    isOpen: boolean
    distance: number
    direction: string
    x: number
    y: number
  }>({
    isOpen: false,
    distance: 200,
    direction: "forward",
    x: 0,
    y: 0,
  })

  const [trashItems, setTrashItems] = useState<TrashItem[]>([])
  const [gameState, setGameState] = useState<GameState>({
    trashCollected: 0,
    trashTotal: 0,
    batteryPercent: 100,
    gameLost: false,
    isGameOver: false,
    isSpawningTrash: false,
    runError: null,
    showCelebration: false,
    missionEndReason: null,
  })
  const [codeView, setCodeView] = useState<"blocks" | "python">("blocks")
  const coralGraceUntilRef = useRef(0)
  const blocklyPickerRef = useRef<{ blockId: string; fieldName: string } | null>(null)

  const applyPickerValue = useCallback(
    (value: number) => {
      if (!workspace || !blocklyPickerRef.current) return
      const { blockId, fieldName } = blocklyPickerRef.current
      const block = workspace.getBlockById(blockId)
      if (!block) return
      updateBlocklyNumberField(block, workspace, fieldName, value)
    },
    [workspace],
  )
  const trashSpawnIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const floatAnimationRef = useRef<number | null>(null)

  const initializeCoralBorders = useCallback((maximized: boolean) => {
    const { w: width, h: height } = getPlaygroundCanvasSize(maximized)
    const coralColors = ["#FF6B6B", "#FF8E8E", "#FFB6B6", "#E67E22", "#FF5252", "#F39C12"]
    const pieces: CoralPiece[] = []

    const pushPiece = (x: number, y: number, seed: number) => {
      pieces.push({
        x,
        y,
        radius: 12 + seededRandom(seed) * 8,
        color: coralColors[Math.floor(seededRandom(seed + 1) * coralColors.length)],
      })
    }

    for (let x = 0; x < width; x += 30) {
      pushPiece(x + 15, 15, x)
      pushPiece(x + 15, height - 15, x + 1000)
    }
    for (let y = 30; y < height - 30; y += 30) {
      pushPiece(15, y + 15, y + 2000)
      pushPiece(width - 15, y + 15, y + 3000)
    }

    setCoralPieces(pieces)
  }, [])

  useEffect(() => {
    if (!isMounted) return
    initializeCoralBorders(playgroundState.isMaximized)
  }, [isMounted, playgroundState.isMaximized, initializeCoralBorders])

  const drawRobot = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !playgroundState.isVisible || playgroundState.isMinimized) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const scale = playgroundState.isMaximized ? 1.5 : 1

    ctx.save()
    ctx.translate(robotState.x, robotState.y)
    ctx.rotate((robotState.rotation * Math.PI) / 180)

    // Main
    // submarine body - yellow oval
    ctx.fillStyle = "#FFD700"
    ctx.strokeStyle = "#E6B800"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(0, 0, 25 * scale, 18 * scale, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Red triangular periscope/antenna on top
    ctx.fillStyle = "#E74C3C"
    ctx.strokeStyle = "#C0392B"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, -25 * scale)
    ctx.lineTo(-6 * scale, -12 * scale)
    ctx.lineTo(6 * scale, -12 * scale)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Googly eyes - white circles with black pupils
    // Left eye
    ctx.fillStyle = "#FFFFFF"
    ctx.strokeStyle = "#333"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(-8 * scale, -4 * scale, 7 * scale, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    // Left pupil
    ctx.fillStyle = "#000"
    ctx.beginPath()
    ctx.arc(-6 * scale, -4 * scale, 3 * scale, 0, Math.PI * 2)
    ctx.fill()

    // Right eye
    ctx.fillStyle = "#FFFFFF"
    ctx.strokeStyle = "#333"
    ctx.beginPath()
    ctx.arc(8 * scale, -4 * scale, 7 * scale, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    // Right pupil
    ctx.fillStyle = "#000"
    ctx.beginPath()
    ctx.arc(10 * scale, -4 * scale, 3 * scale, 0, Math.PI * 2)
    ctx.fill()

    // Whiskers/antennae
    ctx.strokeStyle = "#333"
    ctx.lineWidth = 1.5
    // Left whiskers
    ctx.beginPath()
    ctx.moveTo(-20 * scale, -2 * scale)
    ctx.lineTo(-30 * scale, -8 * scale)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-20 * scale, 2 * scale)
    ctx.lineTo(-30 * scale, 6 * scale)
    ctx.stroke()
    // Right whiskers
    ctx.beginPath()
    ctx.moveTo(20 * scale, -2 * scale)
    ctx.lineTo(30 * scale, -8 * scale)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(20 * scale, 2 * scale)
    ctx.lineTo(30 * scale, 6 * scale)
    ctx.stroke()

    // Small smile
    ctx.strokeStyle = "#333"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(0, 4 * scale, 6 * scale, 0.2, Math.PI - 0.2)
    ctx.stroke()

    ctx.restore()
  }, [playgroundState.isVisible, playgroundState.isMinimized, playgroundState.isMaximized, robotState])

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
          defineOperatorsBlocks(Blockly) // Define Operators blocks
          defineSwitchBlocks(Blockly) // This function is now defined
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
      defineOperatorsBlocks(window.Blockly) // Define Operators blocks
      defineSwitchBlocks(window.Blockly) // This function is now defined
      setBlocklyLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!blocklyLoaded || !blocklyDivRef.current || workspace) return // Use ref

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
      move: {
        scrollbars: true,
        drag: true,
        wheel: true,
      },
      trashcan: false,
    })
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

  // Combined effect for handling field clicks across all relevant blocks
  useEffect(() => {
    if (!workspace || !blocklyLoaded) return

    const Blockly = window.Blockly

    const openCustomPicker = (e: PointerEvent) => {
      const target = e.target as Element

      const fieldGroup = target.closest(".blocklyEditableText")
      if (!fieldGroup) return

      const textElement = fieldGroup.querySelector("text")
      const fieldValue = textElement?.textContent || ""

      const isNumberField = /^-?\d+(\.\d+)?$/.test(fieldValue.trim())
      const hasDropdown = fieldGroup.querySelector(".blocklyDropdownRect") !== null

      if (hasDropdown || !isNumberField) return

      const blockSvg = target.closest(".blocklyDraggable")
      if (!blockSvg) return

      const blockId = blockSvg.getAttribute("data-id")
      if (!blockId) return

      const block = workspace.getBlockById(blockId)
      if (!block) return

      const blockType = block.type
      let fieldName: string | null = null

      if (blockType === "turn_degrees") {
        fieldName = "DEGREES"
      } else if (blockType === "turn_to_rotation" || blockType === "set_drive_rotation") {
        fieldName = "ROTATION"
      } else if (blockType === "turn_to_heading" || blockType === "set_drive_heading") {
        fieldName = "HEADING"
      } else if (blockType === "drive_distance") {
        fieldName = "DISTANCE"
      }

      if (!fieldName) return

      const currentVal = block.getFieldValue(fieldName)
      if (fieldValue.trim() !== String(currentVal).trim()) return

      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      dismissBlocklyFieldEditors()

      blocklyPickerRef.current = { blockId: block.id, fieldName }

      if (blockType === "turn_degrees" || blockType === "turn_to_rotation" || blockType === "set_drive_rotation") {
        setAnglePickerState({
          isOpen: true,
          angle: Number(currentVal) || 0,
          x: e.clientX,
          y: e.clientY,
        })
      } else if (blockType === "turn_to_heading" || blockType === "set_drive_heading") {
        setCompassPickerState({
          isOpen: true,
          heading: Number(currentVal) || 0,
          x: e.clientX,
          y: e.clientY,
        })
      } else if (blockType === "drive_distance") {
        setDistancePickerState({
          isOpen: true,
          distance: Number(currentVal) || 200,
          direction: block.getFieldValue("DIRECTION") || "forward",
          x: e.clientX,
          y: e.clientY,
        })
      }
    }

    const workspaceSvg = workspace.getParentSvg()
    if (workspaceSvg) {
      workspaceSvg.addEventListener("pointerdown", openCustomPicker, true)
    }

    return () => {
      if (workspaceSvg) {
        workspaceSvg.removeEventListener("pointerdown", openCustomPicker, true)
      }
    }
  }, [blocklyLoaded, workspace])

  // useEffect for updating toolbox based on selected category
  useEffect(() => {
    if (!workspace || !blocklyLoaded) return

    const Blockly = window.Blockly

    let blocks: any[] = []

    switch (selectedCategory) {
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
      case "operators":
        blocks = [
          { kind: "block", type: "math_arithmetic" },
          { kind: "block", type: "compare" },
          { kind: "block", type: "boolean_and" },
          { kind: "block", type: "boolean_or" },
          { kind: "block", type: "boolean_not" },
          { kind: "block", type: "text_string" },
          { kind: "block", type: "range_compare" },
          { kind: "block", type: "random_int" },
          { kind: "block", type: "round_number" },
          { kind: "block", type: "math_function" },
          { kind: "block", type: "atan2_function" },
          { kind: "block", type: "modulo" },
          { kind: "block", type: "text_join" },
          { kind: "block", type: "text_letter_at" },
          { kind: "block", type: "text_length" },
          { kind: "block", type: "text_contains" },
          { kind: "block", type: "convert_type" },
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
          { kind: "block", type: "position_value" },
          { kind: "block", type: "position_angle" },
        ]
        break
      case "console":
        blocks = [
          { kind: "block", type: "print_text" },
          { kind: "block", type: "text_string" },
          { kind: "block", type: "set_cursor_next_row" },
          { kind: "block", type: "clear_all_rows" },
          { kind: "block", type: "set_print_precision" },
          { kind: "block", type: "set_print_color" },
        ]
        break
      case "loops": // Corrected from "loops" to match the update
        blocks = [
          { kind: "block", type: "when_started" }, // Added from defineSwitchBlocks
          { kind: "block", type: "forever" }, // Added from defineSwitchBlocks
          { kind: "block", type: "repeat" }, // Added from defineSwitchBlocks
          { kind: "block", type: "wait" }, // Added from defineSwitchBlocks
          // Removed function_definition, function_with_input, function_call as they are not in updates
          // Removed boolean_and, boolean_or, boolean_not, compare_equal, when_started as they are already in logic or operators
        ]
        break
    }

    workspace.updateToolbox({ kind: "flyoutToolbox", contents: blocks })
  }, [selectedCategory, workspace, blocklyLoaded])

  // Redraw playground when state changes
  const drawPlayground = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { w: width, h: height } = getPlaygroundCanvasSize(playgroundState.isMaximized)

    // Draw sandy ocean floor background
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, "#f4d6a2") // Light sandy color
    gradient.addColorStop(0.5, "#e8c18e")
    gradient.addColorStop(1, "#d4a76a") // Darker sand
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Add sand texture with dots (deterministic — avoids hydration flicker)
    ctx.fillStyle = "rgba(180, 140, 90, 0.15)"
    for (let i = 0; i < 200; i++) {
      ctx.beginPath()
      ctx.arc(seededRandom(i) * width, seededRandom(i + 50) * height, seededRandom(i + 100) * 2, 0, Math.PI * 2)
      ctx.fill()
    }

    const scale = playgroundState.isMaximized ? 1.5 : 1
    penTrail.forEach((seg) => {
      ctx.strokeStyle = seg.color
      ctx.lineWidth = seg.width * scale
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(seg.x1, seg.y1)
      ctx.lineTo(seg.x2, seg.y2)
      ctx.stroke()
    })

    // Field origin marker (0, 0 mm) — VEX location reference
    const origin = fieldMmToPixel(0, 0, width, height)
    ctx.strokeStyle = "rgba(60, 120, 180, 0.35)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(origin.x - 10, origin.y)
    ctx.lineTo(origin.x + 10, origin.y)
    ctx.moveTo(origin.x, origin.y - 10)
    ctx.lineTo(origin.x, origin.y + 10)
    ctx.stroke()

    const spawn = fieldMmToPixel(0, -800, width, height)
    ctx.fillStyle = "rgba(46, 125, 50, 0.25)"
    ctx.beginPath()
    ctx.arc(spawn.x, spawn.y, 14, 0, Math.PI * 2)
    ctx.fill()

    // Draw coral borders along all edges
    coralPieces.forEach((piece) => {
      ctx.fillStyle = piece.color
      ctx.beginPath()
      ctx.arc(piece.x, piece.y, piece.radius, 0, Math.PI * 2) // Apply scale here
      ctx.fill()
    })

    // Draw floating trash items
    trashItems.forEach((trash) => {
      if (trash.isCollected) return

      const trashX = trash.x
      const trashY = trash.y + Math.sin(trash.floatOffset) * 3
      const trashScale = trash.scale * scale

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
    })

    // Front distance sensor ray while program runs (VEXcode VR front eye / distance sensor)
    if (isRunning) {
      const borderMm = raycastToBorder(
        robotState.x,
        robotState.y,
        robotState.rotation,
        width,
        height,
        coralPieces,
        DISTANCE_SENSOR_MAX_MM,
      )
      const trashMm = nearestTrashDistanceMm(robotState.x, robotState.y, trashItems)
      const frontMm = trashMm != null && trashMm < borderMm ? trashMm : borderMm
      const rayPx = distanceToPixels(Math.min(frontMm, DISTANCE_SENSOR_MAX_MM), "mm")
      const angleRad = (robotState.rotation * Math.PI) / 180
      ctx.strokeStyle = "rgba(0, 188, 212, 0.65)"
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(robotState.x, robotState.y)
      ctx.lineTo(robotState.x + Math.sin(angleRad) * rayPx, robotState.y - Math.cos(angleRad) * rayPx)
      ctx.stroke()
      ctx.setLineDash([])
    }

    drawRobot()
  }, [drawRobot, robotState, playgroundState.isMaximized, trashItems, coralPieces, penTrail, isRunning])

  const checkCoralCollision = useCallback(
    (x: number, y: number): boolean => {
      if (coralPieces.length === 0) return false
      const robotRadius = 22

      for (const piece of coralPieces) {
        const distance = Math.hypot(x - piece.x, y - piece.y)
        if (distance < robotRadius + piece.radius) {
          return true
        }
      }
      return false
    },
    [coralPieces],
  )

  const checkTrashCollision = useCallback(() => {
    const scale = playgroundState.isMaximized ? 1.5 : 1
    const robotSize = 30 * scale
    const magnetRange = runtimeRef.current.magnetBoost ? 40 : 0

    let collectedCount = 0
    const updatedTrash = trashItems.map((trash) => {
      if (trash.isCollected) return trash

      const dx = robotState.x - trash.x
      const dy = robotState.y - trash.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const pickupRadius = robotSize * 0.5 + 15 * scale * trash.scale
      const magnetRadius = magnetRange + 15 * scale * trash.scale

      if (distance < pickupRadius || distance < magnetRadius) {
        collectedCount++
        return { ...trash, isCollected: true }
      }
      return trash
    })

    if (collectedCount > 0) {
      setTrashItems(updatedTrash)
      setGameState((prev) => ({
        ...prev,
        trashCollected: prev.trashCollected + collectedCount,
      }))
    }
  }, [robotState.x, robotState.y, playgroundState.isMaximized, trashItems])

  const deployTrashField = useCallback(() => {
    if (trashSpawnIntervalRef.current) {
      clearInterval(trashSpawnIntervalRef.current)
      trashSpawnIntervalRef.current = null
    }

    const { w, h } = getPlaygroundCanvasSize(playgroundState.isMaximized)
    const base = createInitialTrashItems(w, h, coralPieces, CORAL_REEF_TRASH_COUNT)
    const items: TrashItem[] = base.map((t, i) => ({
      id: Date.now() + i,
      x: t.x,
      y: t.y,
      type: t.type as TrashItem["type"],
      scale: 0.85 + seededRandom(i) * 0.15,
      floatOffset: seededRandom(i + 20) * Math.PI * 2,
      isCollected: false,
    }))

    setTrashItems(items)
    setGameState((prev) => ({
      ...prev,
      trashTotal: items.length,
      trashCollected: 0,
      isSpawningTrash: true,
      batteryPercent: 100,
      missionEndReason: null,
      showCelebration: false,
      isGameOver: false,
      gameLost: false,
      runError: null,
    }))
  }, [playgroundState.isMaximized, coralPieces])

  const endMission = useCallback((reason: MissionEndReason, opts?: { runError?: string; gameLost?: boolean }) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (trashSpawnIntervalRef.current) {
      clearInterval(trashSpawnIntervalRef.current)
      trashSpawnIntervalRef.current = null
    }
    isRunningRef.current = false
    setIsRunning(false)
    setGameState((prev) => ({
      ...prev,
      isGameOver: true,
      missionEndReason: reason,
      gameLost: opts?.gameLost ?? reason === "coral",
      runError: opts?.runError ?? (reason === "battery" ? "Battery depleted." : prev.runError),
      showCelebration: reason === "complete",
      isSpawningTrash: false,
    }))
  }, [])

  useEffect(() => {
    if (!gameState.isSpawningTrash) return

    const animateTrash = () => {
      setTrashItems((prev) =>
        prev.map((trash) => ({
          ...trash,
          scale: trash.scale < 0.8 + (trash.id % 4) * 0.1 ? trash.scale + 0.05 : trash.scale,
          floatOffset: trash.floatOffset + 0.03,
        })),
      )
      floatAnimationRef.current = requestAnimationFrame(animateTrash)
    }

    floatAnimationRef.current = requestAnimationFrame(animateTrash)

    return () => {
      if (floatAnimationRef.current) {
        cancelAnimationFrame(floatAnimationRef.current)
      }
    }
  }, [gameState.isSpawningTrash])

  // Check collisions on robot move
  useEffect(() => {
    checkTrashCollision()

    if (isRunning && performance.now() < coralGraceUntilRef.current) {
      return
    }

    if (checkCoralCollision(robotState.x, robotState.y) && isRunning) {
      endMission("coral", { gameLost: true })
      if (floatAnimationRef.current) {
        cancelAnimationFrame(floatAnimationRef.current)
      }
    }
  }, [robotState.x, robotState.y, checkTrashCollision, checkCoralCollision, isRunning, endMission])

  // Redraw playground when state changes
  useEffect(() => {
    drawPlayground()
  }, [drawPlayground])

  // Redraw robot (no change needed here, but good to have)
  useEffect(() => {
    drawRobot()
  }, [drawRobot, playgroundState.isMaximized, playgroundState.isVisible, playgroundState.isMinimized])

  useEffect(() => {
    if (!canvasRef.current || !playgroundState.isVisible || playgroundState.isMinimized) return

    const timer = setTimeout(() => {
      drawRobot()
    }, 100)
    return () => clearTimeout(timer)
  }, [playgroundState.isVisible, playgroundState.isMinimized])

  const recordPenSegment = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (!runtimeRef.current.penDown) return
    setPenTrail((prev) => [
      ...prev,
      {
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        color: runtimeRef.current.penColor,
        width: runtimeRef.current.penWidth,
      },
    ])
  }, [])

  const animateRobotFluid = (
    targetState: Partial<RobotState>,
    duration = 500,
    robotStateRef: React.MutableRefObject<{ x: number; y: number; rotation: number }>,
  ) => {
    return new Promise<void>((resolve) => {
      const startTime = performance.now()
      const startState = { ...robotStateRef.current }
      let lastPoint = { x: startState.x, y: startState.y }

      const canvasW = playgroundState.isMaximized ? 600 : 400
      const canvasH = playgroundState.isMaximized ? 600 : 400

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easeProgress = 1 - Math.pow(1 - progress, 3) // Ease-out cubic

        setRobotState((prev) => {
          const newState = { ...prev }
          if (targetState.x !== undefined) {
            newState.x = startState.x + (targetState.x - startState.x) * easeProgress
          }
          if (targetState.y !== undefined) {
            newState.y = startState.y + (targetState.y - startState.y) * easeProgress
          }
          if (targetState.rotation !== undefined) {
            const delta = shortestRotationDelta(startState.rotation, targetState.rotation)
            newState.rotation = normalizeDegrees(startState.rotation + delta * easeProgress)
          }
          const clamped = clampRobotPosition(newState.x, newState.y, canvasW, canvasH)
          newState.x = clamped.x
          newState.y = clamped.y
          const currentPoint = { x: newState.x, y: newState.y }
          if (currentPoint.x !== lastPoint.x || currentPoint.y !== lastPoint.y) {
            recordPenSegment(lastPoint, currentPoint)
            lastPoint = currentPoint
          }
          robotStateRef.current = { x: newState.x, y: newState.y, rotation: newState.rotation }
          return newState
        })

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          // Ensure final state is exact
          setRobotState((prev) => {
            const finalState = { ...prev }
            if (targetState.x !== undefined) finalState.x = targetState.x
            if (targetState.y !== undefined) finalState.y = targetState.y
            if (targetState.rotation !== undefined) finalState.rotation = targetState.rotation
            const clamped = clampRobotPosition(finalState.x, finalState.y, canvasW, canvasH)
            finalState.x = clamped.x
            finalState.y = clamped.y
            robotStateRef.current = { x: finalState.x, y: finalState.y, rotation: finalState.rotation }
            return finalState
          })
          resolve()
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    })
  }

  const getPythonCode = useCallback(() => {
    if (!workspace) return "# No code yet"
    
    // Recursively generate code for a statement input (DO, ELSE, etc.)
    const generateStatements = (block: any, inputName: string, indent: string): string => {
      const child = block.getInputTargetBlock(inputName)
      if (!child) return `${indent}pass\n`
      return generateSequence(child, indent)
    }

    // Walk a chain of next-connected blocks
    const generateSequence = (block: any, indent: string): string => {
      if (!block) return ""
      return generatePythonFromBlock(block, indent) + generateSequence(block.getNextBlock(), indent)
    }

    // Custom Python code generator - traverse blocks and generate Python syntax
    const generatePythonFromBlock = (block: any, indent: string = ""): string => {
      if (!block) return ""
      
      const type = block.type
      let code = ""
      
      switch (type) {
        case "when_started":
          code = "# When Started\ndef main():\n"
          code += generateStatements(block, "DO", "    ")
          code += "\nmain()"
          break
          
        case "drive_simple": {
          const dir = block.getFieldValue("DIRECTION") || "forward"
          code = `${indent}drivetrain.drive(${dir.toUpperCase()})\n`
          break
        }
          
        case "drive_distance": {
          const direction = block.getFieldValue("DIRECTION") || "forward"
          const distance = block.getFieldValue("DISTANCE") || "200"
          const unit = block.getFieldValue("UNIT") || "mm"
          const unitPython = unit === "inches" ? "INCHES" : "MM"
          code = `${indent}drivetrain.drive_for(${direction.toUpperCase()}, ${distance}, ${unitPython})\n`
          break
        }
          
        case "turn_simple": {
          const dir = block.getFieldValue("DIRECTION") || "right"
          code = `${indent}drivetrain.turn(${dir.toUpperCase()})\n`
          break
        }
          
        case "turn_degrees": {
          const turnDir = block.getFieldValue("DIRECTION") || "right"
          const degrees = block.getFieldValue("DEGREES") || "90"
          code = `${indent}drivetrain.turn_for(${turnDir.toUpperCase()}, ${degrees}, DEGREES)\n`
          break
        }
        
        case "turn_to_heading": {
          const heading = block.getFieldValue("HEADING") || "0"
          code = `${indent}drivetrain.turn_to_heading(${heading}, DEGREES)\n`
          break
        }
        
        case "turn_to_rotation": {
          const rotation = block.getFieldValue("ROTATION") || "0"
          code = `${indent}drivetrain.turn_to_rotation(${rotation}, DEGREES)\n`
          break
        }
          
        case "set_drive_velocity": {
          const velocity = block.getFieldValue("VELOCITY") || "50"
          code = `${indent}drivetrain.set_drive_velocity(${velocity}, PERCENT)\n`
          break
        }
          
        case "set_turn_velocity": {
          const turnVel = block.getFieldValue("VELOCITY") || "50"
          code = `${indent}drivetrain.set_turn_velocity(${turnVel}, PERCENT)\n`
          break
        }
          
        case "set_drive_heading": {
          const heading = block.getFieldValue("HEADING") || "0"
          code = `${indent}drivetrain.set_heading(${heading}, DEGREES)\n`
          break
        }
        
        case "set_drive_rotation": {
          const rotation = block.getFieldValue("ROTATION") || "0"
          code = `${indent}drivetrain.set_rotation(${rotation}, DEGREES)\n`
          break
        }
        
        case "set_drive_timeout": {
          const timeout = block.getFieldValue("TIMEOUT") || "1"
          code = `${indent}drivetrain.set_timeout(${timeout}, SECONDS)\n`
          break
        }
          
        case "stop_driving":
          code = `${indent}drivetrain.stop()\n`
          break
          
        case "forever":
        case "forever_loop": {
          code = `${indent}while True:\n`
          code += generateStatements(block, "DO", indent + "    ")
          break
        }

        case "repeat":
        case "repeat_times": {
          const times = block.getFieldValue("TIMES") || "10"
          code = `${indent}for i in range(${times}):\n`
          code += generateStatements(block, "DO", indent + "    ")
          break
        }
        
        case "repeat_until": {
          const cond = block.getInputTargetBlock("CONDITION")
          const condStr = cond ? `not ${cond.type}()` : "not condition"
          code = `${indent}while ${condStr}:\n`
          code += generateStatements(block, "DO", indent + "    ")
          break
        }
        
        case "while_loop": {
          code = `${indent}while condition:\n`
          code += generateStatements(block, "DO", indent + "    ")
          break
        }
          
        case "wait_seconds": {
          const waitTime = block.getFieldValue("SECONDS") || "1"
          code = `${indent}wait(${waitTime}, SECONDS)\n`
          break
        }
        
        case "wait_until":
          code = `${indent}wait_until(condition)\n`
          break
          
        case "if_then": {
          const ifCond = block.getInputTargetBlock("CONDITION")
          const ifCondStr = ifCond ? generatePythonFromBlock(ifCond, "").trim() : "condition"
          code = `${indent}if ${ifCondStr}:\n`
          code += generateStatements(block, "DO", indent + "    ")
          break
        }
        
        case "if_then_else": {
          const ifelseCond = block.getInputTargetBlock("CONDITION")
          const ifelseCondStr = ifelseCond ? generatePythonFromBlock(ifelseCond, "").trim() : "condition"
          code = `${indent}if ${ifelseCondStr}:\n`
          code += generateStatements(block, "DO", indent + "    ")
          code += `${indent}else:\n`
          code += generateStatements(block, "ELSE", indent + "    ")
          break
        }
        
        case "break_block":
          code = `${indent}break\n`
          break
        
        case "stop_project":
          code = `${indent}stop()\n`
          break
        
        case "comment_block": {
          const comment = block.getFieldValue("COMMENT") || ""
          code = `${indent}# ${comment}\n`
          break
        }
          
        case "energize_magnet": {
          const action = block.getFieldValue("ACTION") || "pick up"
          code = action === "pick up" 
            ? `${indent}electromagnet.pickup()\n`
            : `${indent}electromagnet.drop()\n`
          break
        }
          
        case "move_pen": {
          const penAction = block.getFieldValue("POSITION") || "down"
          code = `${indent}pen.move(${penAction.toUpperCase()})\n`
          break
        }
        
        case "set_pen_width": {
          const width = block.getFieldValue("WIDTH") || "1"
          code = `${indent}pen.set_pen_width(${width})\n`
          break
        }
          
        case "set_pen_color": {
          const color = block.getFieldValue("COLOR") || "red"
          code = `${indent}pen.set_pen_color("${color}")\n`
          break
        }
          
        case "print_text": {
          const text = block.getFieldValue("TEXT") || ""
          code = `${indent}brain.print("${text}")\n`
          break
        }
        
        case "clear_all_rows":
          code = `${indent}brain.clear()\n`
          break
        
        case "set_cursor_next_row":
          code = `${indent}brain.next_row()\n`
          break
        
        // Sensing blocks
        case "bumper_pressed":
          code = `bumper.pressed()`
          break
        
        case "eye_is_near": {
          const nearObj = block.getFieldValue("OBJECT") || "any"
          code = `eye.is_near_object()`
          break
        }
        
        case "eye_detects_color": {
          const detColor = block.getFieldValue("COLOR") || "red"
          code = `eye.detect("${detColor}")`
          break
        }
        
        // Operators
        case "math_arithmetic": {
          const op = block.getFieldValue("OP") || "ADD"
          const opMap: { [key: string]: string } = { ADD: "+", MINUS: "-", MULTIPLY: "*", DIVIDE: "/" }
          const a = block.getFieldValue("A") || "0"
          const b = block.getFieldValue("B") || "0"
          code = `(${a} ${opMap[op] || "+"} ${b})`
          break
        }
        
        case "random_int": {
          const from = block.getFieldValue("FROM") || "1"
          const to = block.getFieldValue("TO") || "10"
          code = `random.randint(${from}, ${to})`
          break
        }
          
        default:
          code = `${indent}# ${type}()\n`
      }
      
      return code
    }
    
    // Get top-level blocks and generate code
    const topBlocks = workspace.getTopBlocks(true)
    if (topBlocks.length === 0) return "# No code yet\n# Add blocks to see Python code"
    
    let pythonCode = "# VEXcode VR Python\nfrom vexcode import *\nimport random\n\n"
    
    for (const block of topBlocks) {
      pythonCode += generatePythonFromBlock(block)
    }
    
    return pythonCode
  }, [workspace])

  const handleRun = async () => {
    if (!workspace || !window.Blockly || isRunning) return

    isRunningRef.current = true
    setIsRunning(true)
    coralGraceUntilRef.current = performance.now() + 400
    setGameState((prev) => ({
      ...prev,
      isGameOver: false,
      gameLost: false,
      runError: null,
      missionEndReason: null,
      showCelebration: false,
    }))
    setConsoleLines([])
    deployTrashField()

    const Blockly = window.Blockly
    const code = Blockly.JavaScript.workspaceToCode(workspace)

    const { w: canvasWidth, h: canvasHeight } = getPlaygroundCanvasSize(playgroundState.isMaximized)

    runtimeRef.current = {
      driveVelocity: 50,
      turnVelocity: 50,
      driveTimeoutSec: null,
      heading: 0,
      penDown: false,
      penColor: "#000000",
      penWidth: 2,
      magnetBoost: false,
      printPrecision: 1,
      printColor: "black",
      lastPenPoint: null,
    }

    const startPos = getDefaultRobotPixelPosition(playgroundState.isMaximized)
    setRobotState({
      x: startPos.x,
      y: startPos.y,
      rotation: 0,
      driveVelocity: 50,
      turnVelocity: 50,
      heading: 0,
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    robotStateRef.current = { x: startPos.x, y: startPos.y, rotation: 0 }

    const getCanvasSize = () => getPlaygroundCanvasSize(playgroundState.isMaximized)

    const clampPosition = (x: number, y: number) => {
      const { w, h } = getCanvasSize()
      return clampRobotPosition(x, y, w, h)
    }

    const formatPrint = (text: unknown) => {
      const raw = String(text)
      const precision = runtimeRef.current.printPrecision
      const asNum = Number(raw)
      const formatted = Number.isFinite(asNum) ? Number(asNum.toFixed(Math.max(0, -Math.log10(precision)))) : raw
      return formatted
    }

    const appendConsole = (text: unknown) => {
      const line = formatPrint(text)
      setConsoleLines((prev) => [...prev, line])
    }

    const robotAPI = {
      drive: async (direction: string, distance?: number, unit?: string) => {
        const sign = direction === "forward" ? 1 : -1
        const pixels =
          distance === undefined
            ? distanceToPixels(200, "mm")
            : distanceToPixels(Number(distance), unit || "mm")
        const angleRad = (robotStateRef.current.rotation * Math.PI) / 180
        const rawX = robotStateRef.current.x + sign * pixels * Math.sin(angleRad)
        const rawY = robotStateRef.current.y - sign * pixels * Math.cos(angleRad)
        const { x: targetX, y: targetY } = clampPosition(rawX, rawY)
        const actualPixels = Math.hypot(targetX - robotStateRef.current.x, targetY - robotStateRef.current.y)
        const duration = driveDurationMs(actualPixels, runtimeRef.current.driveVelocity)
        const drivePromise = animateRobotFluid({ x: targetX, y: targetY }, duration, robotStateRef)
        if (runtimeRef.current.driveTimeoutSec != null) {
          await Promise.race([
            drivePromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Drive timeout")), runtimeRef.current.driveTimeoutSec! * 1000),
            ),
          ]).catch(() => {
            robotAPI.stopDriving()
          })
        } else {
          await drivePromise
        }
      },
      turn: async (direction: string, degrees?: number) => {
        const multiplier = direction === "right" ? 1 : -1
        const turnAmount = degrees === undefined ? 90 : Number(degrees)
        const targetRotation = normalizeDegrees(robotStateRef.current.rotation + turnAmount * multiplier)
        const delta = Math.abs(shortestRotationDelta(robotStateRef.current.rotation, targetRotation))
        const duration = turnDurationMs(delta, runtimeRef.current.turnVelocity)
        await animateRobotFluid({ rotation: targetRotation }, duration, robotStateRef)
      },
      turnToHeading: async (heading: number) => {
        const target = normalizeDegrees(Number(heading))
        const delta = Math.abs(shortestRotationDelta(robotStateRef.current.rotation, target))
        const duration = turnDurationMs(delta, runtimeRef.current.turnVelocity)
        await animateRobotFluid({ rotation: target }, duration, robotStateRef)
        runtimeRef.current.heading = target
      },
      turnToRotation: async (rotation: number) => {
        const target = normalizeDegrees(Number(rotation))
        const delta = Math.abs(shortestRotationDelta(robotStateRef.current.rotation, target))
        const duration = turnDurationMs(delta, runtimeRef.current.turnVelocity)
        await animateRobotFluid({ rotation: target }, duration, robotStateRef)
      },
      stopDriving: () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = null
        }
      },
      setDriveVelocity: (velocity: number) => {
        runtimeRef.current.driveVelocity = Number(velocity)
        setRobotState((prev) => ({ ...prev, driveVelocity: Number(velocity) }))
      },
      setTurnVelocity: (velocity: number) => {
        runtimeRef.current.turnVelocity = Number(velocity)
        setRobotState((prev) => ({ ...prev, turnVelocity: Number(velocity) }))
      },
      setDriveHeading: (heading: number) => {
        const h = normalizeDegrees(Number(heading))
        runtimeRef.current.heading = h
        setRobotState((prev) => ({ ...prev, heading: h, rotation: h }))
        robotStateRef.current.rotation = h
      },
      setDriveRotation: (rotation: number) => {
        const r = normalizeDegrees(Number(rotation))
        setRobotState((prev) => ({ ...prev, rotation: r }))
        robotStateRef.current.rotation = r
      },
      setDriveTimeout: async (seconds: number) => {
        runtimeRef.current.driveTimeoutSec = Number(seconds)
      },
      energize: (_device: string, mode: string) => {
        runtimeRef.current.magnetBoost = mode === "boost"
        if (mode === "drop") runtimeRef.current.magnetBoost = false
      },
      movePen: (position: string) => {
        runtimeRef.current.penDown = position === "down"
        if (runtimeRef.current.penDown) {
          runtimeRef.current.lastPenPoint = { ...robotStateRef.current }
        }
      },
      setPenWidth: (width: string) => {
        const widths: Record<string, number> = { thin: 1, medium: 3, thick: 6 }
        runtimeRef.current.penWidth = widths[width] ?? 2
      },
      setPenColor: (color: string) => {
        const colors: Record<string, string> = {
          black: "#000000",
          red: "#E74C3C",
          blue: "#3498DB",
          green: "#27AE60",
          yellow: "#F1C40F",
          purple: "#9B59B6",
          orange: "#E67E22",
        }
        runtimeRef.current.penColor = colors[color] ?? color
      },
      print: (text: unknown) => {
        appendConsole(text)
      },
      wait: async (seconds: number) => {
        await new Promise((resolve) => setTimeout(resolve, Number(seconds) * 1000))
      },
      setCursorNextRow: () => {
        appendConsole("")
      },
      clearAllRows: () => {
        setConsoleLines([])
      },
      setPrintPrecision: (precision: number) => {
        runtimeRef.current.printPrecision = Number(precision)
      },
      setPrintColor: (color: string) => {
        runtimeRef.current.printColor = color.toLowerCase()
      },
      bumperPressed: (bumper: string) => {
        if (!robotCapabilities.bumperSensor) return false
        const side = bumper.toLowerCase()
        const offset = side === "left" ? -90 : 90
        const angleRad = ((robotStateRef.current.rotation + offset) * Math.PI) / 180
        const probeX = robotStateRef.current.x + Math.sin(angleRad) * 22
        const probeY = robotStateRef.current.y - Math.cos(angleRad) * 22
        return pointHitsCoral(probeX, probeY, coralPieces, 4)
      },
      distanceFoundObject: (sensor: string) => {
        const { w, h } = getCanvasSize()
        const dist = raycastToBorder(
          robotStateRef.current.x,
          robotStateRef.current.y,
          robotStateRef.current.rotation + (sensor === "down" ? 0 : 0),
          w,
          h,
          coralPieces,
          DISTANCE_SENSOR_MAX_MM,
        )
        const trashDist = nearestTrashDistanceMm(robotStateRef.current.x, robotStateRef.current.y, trashItems)
        if (trashDist != null && trashDist < DISTANCE_SENSOR_MAX_MM) return true
        return dist < DISTANCE_SENSOR_MAX_MM
      },
      getDistance: (sensor: string, unit: string) => {
        const { w, h } = getCanvasSize()
        const mm = raycastToBorder(
          robotStateRef.current.x,
          robotStateRef.current.y,
          robotStateRef.current.rotation,
          w,
          h,
          coralPieces,
        )
        const trashDist = nearestTrashDistanceMm(robotStateRef.current.x, robotStateRef.current.y, trashItems)
        const valueMm = trashDist != null && trashDist < mm ? trashDist : mm
        return unit === "inches" ? valueMm / 25.4 : valueMm
      },
      eyeIsNear: (sensor: string) => {
        if (!robotCapabilities.eyeSensor) return false
        const angleRad = (robotStateRef.current.rotation * Math.PI) / 180
        const probeX = robotStateRef.current.x + Math.sin(angleRad) * 30
        const probeY = robotStateRef.current.y - Math.cos(angleRad) * 30
        const trashDist = nearestTrashDistanceMm(probeX, probeY, trashItems)
        return trashDist != null && trashDist < 80
      },
      eyeDetectsColor: (_sensor: string, color: string) => {
        if (!robotCapabilities.eyeSensor) return false
        const { x, y } = robotStateRef.current
        for (const t of trashItems) {
          if (t.isCollected) continue
          if (Math.hypot(x - t.x, y - t.y) > 40) continue
          const trashColors: Record<string, string[]> = {
            red: ["can"],
            green: ["bag"],
            blue: ["bottle"],
            yellow: ["wrapper"],
            orange: ["wrapper"],
            purple: ["bag"],
          }
          return trashColors[color]?.includes(t.type) ?? false
        }
        if (color === "red" || color === "orange") {
          return pointHitsCoral(x, y, coralPieces, 20)
        }
        return false
      },
      eyeBrightness: (_sensor: string) => {
        if (!robotCapabilities.eyeSensor) return 0
        const { x, y } = robotStateRef.current
        if (pointHitsCoral(x, y, coralPieces, 15)) return 25
        const nearTrash = nearestTrashDistanceMm(x, y, trashItems)
        if (nearTrash != null && nearTrash < 60) return 40
        return 85
      },
      getPosition: (axis: string, unit: string) => {
        const { w, h } = getCanvasSize()
        const field = pixelToFieldMm(robotStateRef.current.x, robotStateRef.current.y, w, h)
        const mm = axis.toLowerCase() === "x" ? field.x : field.y
        return unit.toLowerCase() === "inches" ? mm / 25.4 : mm
      },
      getPositionAngle: () => normalizeDegrees(robotStateRef.current.rotation),
      stop: () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = null
        }
        if (trashSpawnIntervalRef.current) {
          clearInterval(trashSpawnIntervalRef.current)
          trashSpawnIntervalRef.current = null
        }
        isRunningRef.current = false
        setIsRunning(false)
      },
    }

    try {
      if (!code.trim()) {
        appendConsole("Add blocks inside when started to run your program.")
        return
      }
      const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
      const execFunc = new AsyncFunction("robot", code)
      await execFunc(robotAPI)
    } catch (error: unknown) {
      console.error("Execution error:", error)
      const message = error instanceof Error ? error.message : "Program error"
      setGameState((prev) => ({ ...prev, isGameOver: true, gameLost: false, runError: message }))
      appendConsole(`Error: ${message}`)
    } finally {
      if (isRunningRef.current) {
        isRunningRef.current = false
        setIsRunning(false)
      }
    }
  }

  const handleReset = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (trashSpawnIntervalRef.current) {
      clearInterval(trashSpawnIntervalRef.current)
      trashSpawnIntervalRef.current = null
    }
    setIsRunning(false)
    isRunningRef.current = false
    const resetPos = getDefaultRobotPixelPosition(playgroundState.isMaximized)
    setRobotState({
      x: resetPos.x,
      y: resetPos.y,
      rotation: 0,
      driveVelocity: 50,
      turnVelocity: 50,
      heading: 0,
    })
    robotStateRef.current = { x: resetPos.x, y: resetPos.y, rotation: 0 }
    setGameState({
      trashCollected: 0,
      trashTotal: 0,
      batteryPercent: 100,
      gameLost: false,
      isGameOver: false,
      runError: null,
      showCelebration: false,
      missionEndReason: null,
      isSpawningTrash: false,
    })
    setTrashItems([])
    setPenTrail([])
    setConsoleLines([])
  }

  const handleClear = () => {
    if (workspace) {
      workspace.clear()
    }
    const clearPos = getDefaultRobotPixelPosition(playgroundState.isMaximized)
    setRobotState({
      x: clearPos.x,
      y: clearPos.y,
      rotation: 0,
      driveVelocity: 50,
      turnVelocity: 50,
      heading: 0,
    })
    setGameState({
      trashCollected: 0,
      trashTotal: 0,
      batteryPercent: 100,
      gameLost: false,
      isGameOver: false,
      runError: null,
      showCelebration: false,
      missionEndReason: null,
      isSpawningTrash: false,
    })
    setTrashItems([])
    setPenTrail([])
    setConsoleLines([])
    if (trashSpawnIntervalRef.current) {
      clearInterval(trashSpawnIntervalRef.current)
      trashSpawnIntervalRef.current = null
    }
    if (floatAnimationRef.current) {
      cancelAnimationFrame(floatAnimationRef.current)
      floatAnimationRef.current = null
    }
    setIsRunning(false)
    isRunningRef.current = false
  }

  const handleTrash = () => {
    if (workspace) {
      // Save current workspace state before clearing
      const xml = (window as any).Blockly.Xml.workspaceToDom(workspace)
      const xmlText = (window as any).Blockly.Xml.domToText(xml)
      setDeletedBlocks(xmlText)
      workspace.clear()
    }
    setGameState({
      trashCollected: 0,
      trashTotal: 0,
      batteryPercent: 100,
      gameLost: false,
      isGameOver: false,
      runError: null,
      showCelebration: false,
      missionEndReason: null,
      isSpawningTrash: false,
    })
    setTrashItems([])
    if (trashSpawnIntervalRef.current) {
      clearInterval(trashSpawnIntervalRef.current)
      trashSpawnIntervalRef.current = null
    }
    if (floatAnimationRef.current) {
      cancelAnimationFrame(floatAnimationRef.current)
      floatAnimationRef.current = null
    }
    setIsRunning(false)
    isRunningRef.current = false
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
    setSelectedCategory(category) // Update selected category state

    if (!workspace || !window.Blockly) return

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
    } else if (category === "operators") {
      blocks = [
        { kind: "block", type: "math_arithmetic" },
          { kind: "block", type: "compare" },
          { kind: "block", type: "boolean_and" },
          { kind: "block", type: "boolean_or" },
          { kind: "block", type: "boolean_not" },
          { kind: "block", type: "text_string" },
          { kind: "block", type: "range_compare" },
        { kind: "block", type: "random_int" },
        { kind: "block", type: "round_number" },
        { kind: "block", type: "math_function" },
        { kind: "block", type: "atan2_function" },
        { kind: "block", type: "modulo" },
        { kind: "block", type: "text_join" },
        { kind: "block", type: "text_letter_at" },
        { kind: "block", type: "text_length" },
        { kind: "block", type: "text_contains" },
        { kind: "block", type: "convert_type" },
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
        { kind: "block", type: "position_value" },
        { kind: "block", type: "position_angle" },
      ]
    } else if (category === "console") {
      blocks = [
        { kind: "block", type: "print_text" },
        { kind: "block", type: "text_string" },
        { kind: "block", type: "set_cursor_next_row" },
        { kind: "block", type: "clear_all_rows" },
        { kind: "block", type: "set_print_precision" },
        { kind: "block", type: "set_print_color" },
      ]
    } else if (category === "loops") {
      // Corrected from "loops" to match the update
      blocks = [
        { kind: "block", type: "when_started" }, // Added from defineSwitchBlocks
        { kind: "block", type: "forever" }, // Added from defineSwitchBlocks
        { kind: "block", type: "repeat" }, // Added from defineSwitchBlocks
        { kind: "block", type: "wait" }, // Added from defineSwitchBlocks
        // Removed function_definition, function_with_input, function_call as they are not in updates
        // Removed boolean_and, boolean_or, boolean_not, compare_equal, when_started as they are already in logic or operators
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
    setAiAssistantState((prev) => ({ ...prev, isVisible: true, isMinimized: false }))
    setAiStep("main") // Reset AI assistant step when opened
  }

  const handleCloseAIAssistant = () => {
    setAiAssistantState((prev) => ({ ...prev, isVisible: false }))
    setAiStep("main") // Reset AI assistant step when closed
  }

  const handleMinimizeAIAssistant = () => {
    setAiAssistantState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }))
  }

  const handleMaximizeAIAssistant = () => {
    setAiAssistantState((prev) => ({ ...prev, isMaximized: !prev.isMaximized }))
  }

  const handleAIAssistantMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    if (!(e.target as HTMLElement).closest(".ai-assistant-header")) return

    setAiAssistantState((prev) => ({
      ...prev,
      isDragging: true,
      dragStartX: e.clientX - prev.x,
      dragStartY: e.clientY - prev.y,
    }))
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (aiAssistantState.isDragging) {
        setAiAssistantState((prev) => ({
          ...prev,
          x: e.clientX - prev.dragStartX,
          y: e.clientY - prev.dragStartY,
        }))
      }
    }

    const handleMouseUp = () => {
      setAiAssistantState((prev) => ({ ...prev, isDragging: false }))
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

  // Function to draw the prediction on the predict canvas
  const drawPrediction = useCallback(() => {
    const canvas = predictCanvasRef.current
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

    // Draw coral border
    const coralColors = ["#FF6B6B", "#FF8E8E", "#FFB6B6", "#E67E22", "#FF5252"]
    for (let x = 0; x < width; x += 20) {
      ctx.fillStyle = coralColors[x % coralColors.length]
      ctx.beginPath()
      ctx.arc(x + 10, 10, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + 10, height - 10, 8, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let y = 20; y < height - 20; y += 20) {
      ctx.fillStyle = coralColors[y % coralColors.length]
      ctx.beginPath()
      ctx.arc(10, y + 10, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(width - 10, y + 10, 8, 0, Math.PI * 2)
      ctx.fill()
    }

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

      // Body
      ctx.fillStyle = "#FFD700"
      ctx.strokeStyle = "#E6B800"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Periscope
      ctx.fillStyle = "#E74C3C"
      ctx.beginPath()
      ctx.moveTo(0, -15)
      ctx.lineTo(-4, -8)
      ctx.lineTo(4, -8)
      ctx.closePath()
      ctx.fill()

      // Eyes
      ctx.fillStyle = "#FFF"
      ctx.beginPath()
      ctx.arc(-4, -2, 4, 0, Math.PI * 2)
      ctx.arc(4, -2, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "#000"
      ctx.beginPath()
      ctx.arc(-3, -2, 2, 0, Math.PI * 2)
      ctx.arc(5, -2, 2, 0, Math.PI * 2)
      ctx.fill()

      // Whiskers
      ctx.strokeStyle = "#333"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-12, 0)
      ctx.lineTo(-18, -4)
      ctx.moveTo(-12, 2)
      ctx.lineTo(-18, 5)
      ctx.moveTo(12, 0)
      ctx.lineTo(18, -4)
      ctx.moveTo(12, 2)
      ctx.lineTo(18, 5)
      ctx.stroke()

      ctx.restore()
    }

    // Parse blocks and calculate path
    const Blockly = window.Blockly
    const pathPoints: { x: number; y: number }[] = [{ x: currentX, y: currentY }]

    const allBlocks = workspace.getAllBlocks()
    const startBlock = allBlocks.find((b: { type: string }) => b.type === "when_started")

    if (startBlock) {
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
  }, [workspace]) // Removed drawPrediction from dependency array to fix circular dependency

  const handleKeyPress = (e: KeyboardEvent) => {
    const key = e.key

    if (aiAssistantState.surveyStep === "main") {
      switch (key) {
        case "1":
          setAiStep("strategy")
          break
        case "2":
          setAiStep("predict")
          break
        case "3":
          setAiStep("fix")
          break
        case "4":
          setAiStep("compare")
          break
        case "5":
          setAiStep("feel")
          break
        case "6":
          setAiStep("partner")
          break
      }
    }
  }

  useEffect(() => {
    if (aiAssistantState.isVisible && !aiAssistantState.isMinimized) {
      window.addEventListener("keydown", handleKeyPress)
    } else {
      window.removeEventListener("keydown", handleKeyPress)
    }

    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [aiAssistantState.isVisible, aiAssistantState.isMinimized, aiStep]) // Depend on aiStep as well

  useEffect(() => {
    if (aiAssistantState.isVisible && !aiAssistantState.isMinimized && aiStep === "predict") {
      // Small delay to ensure canvas is rendered
      const timer = setTimeout(() => {
        drawPrediction()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [aiAssistantState.isVisible, aiAssistantState.isMinimized, aiStep, drawPrediction])

  useEffect(() => {
    if (!gameState.showCelebration) return
    const timer = setTimeout(() => {
      setGameState((prev) => ({ ...prev, showCelebration: false }))
    }, 5000)
    return () => clearTimeout(timer)
  }, [gameState.showCelebration])

  useEffect(() => {
    if (!isRunning || gameState.isGameOver) return
    const tickMs = 250
    const drainPerTick = (100 / CORAL_REEF_BATTERY_SEC) * (tickMs / 1000)
    const id = setInterval(() => {
      setGameState((prev) => {
        const next = prev.batteryPercent - drainPerTick
        if (next <= 0) {
          endMission("battery")
          return { ...prev, batteryPercent: 0 }
        }
        return { ...prev, batteryPercent: next }
      })
    }, tickMs)
    return () => clearInterval(id)
  }, [isRunning, gameState.isGameOver, endMission])

  useEffect(() => {
    if (!isRunning || gameState.isGameOver || gameState.trashTotal === 0) return
    const remaining = trashItems.filter((t) => !t.isCollected).length
    if (remaining === 0) {
      endMission("complete")
    }
  }, [trashItems, isRunning, gameState.isGameOver, gameState.trashTotal, endMission])

  const liveSensors = useMemo(() => {
    const { w, h } = getPlaygroundCanvasSize(playgroundState.isMaximized)
    const field = pixelToFieldMm(robotState.x, robotState.y, w, h)
    const borderMm = raycastToBorder(robotState.x, robotState.y, robotState.rotation, w, h, coralPieces, DISTANCE_SENSOR_MAX_MM)
    const trashMm = nearestTrashDistanceMm(robotState.x, robotState.y, trashItems)
    const frontDistanceMm = Math.round(trashMm != null && trashMm < borderMm ? trashMm : borderMm)
    const angleRad = (robotState.rotation * Math.PI) / 180
    const probeX = robotState.x + Math.sin(angleRad) * 30
    const probeY = robotState.y - Math.cos(angleRad) * 30
    const eyeTrashMm = nearestTrashDistanceMm(probeX, probeY, trashItems)
    const eyeNear = robotCapabilities.eyeSensor && eyeTrashMm != null && eyeTrashMm < 80
    const trashRemaining = trashItems.filter((t) => !t.isCollected).length
    return {
      field,
      frontDistanceMm,
      frontObjectDetected: frontDistanceMm < DISTANCE_SENSOR_MAX_MM,
      eyeNear,
      rotation: Math.round(normalizeDegrees(robotState.rotation)),
      trashRemaining,
    }
  }, [robotState, trashItems, coralPieces, playgroundState.isMaximized, robotCapabilities.eyeSensor])

  useEffect(() => {
    if (gameState.isGameOver) {
      setAiAssistantState((prev) => ({ ...prev, isVisible: true, isMinimized: false }))
    }
  }, [gameState.isGameOver])

  const handleRestoreBlocks = () => {
    if (workspace && deletedBlocks) {
      const xml = (window as any).Blockly.Xml.textToDom(deletedBlocks)
      ;(window as any).Blockly.Xml.domToWorkspace(xml, workspace)
      setShowDeletedBlocks(false)
    }
  }

  const handleOpenRobotConfig = () => {
    setRobotConfigState((prev) => ({ ...prev, isVisible: true, isMinimized: false }))
  }

  const handleCloseRobotConfig = () => {
    setRobotConfigState((prev) => ({ ...prev, isVisible: false }))
  }

  const handleMinimizeRobotConfig = () => {
    setRobotConfigState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }))
  }

  const handleMaximizeRobotConfig = () => {
    setRobotConfigState((prev) => ({ ...prev, isMaximized: !prev.isMaximized }))
  }

  const handleRobotConfigMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    if (!(e.target as HTMLElement).closest(".robot-config-header")) return

    setRobotConfigState((prev) => ({
      ...prev,
      isDragging: true,
      dragStartX: e.clientX - prev.x,
      dragStartY: e.clientY - prev.y,
    }))
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (robotConfigState.isDragging) {
        setRobotConfigState((prev) => ({
          ...prev,
          x: e.clientX - prev.dragStartX,
          y: e.clientY - prev.dragStartY,
        }))
      }
    }

    const handleMouseUp = () => {
      setRobotConfigState((prev) => ({ ...prev, isDragging: false }))
    }

    if (robotConfigState.isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [robotConfigState.isDragging])

  const confettiParticles = useMemo(() => {
    if (!gameState.showCelebration) return []
    const colors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"]
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      style: {
        left: `${50 + (seededRandom(i) - 0.5) * 20}%`,
        top: "-10%",
        width: "10px",
        height: "10px",
        backgroundColor: colors[Math.floor(seededRandom(i + 10) * colors.length)],
        borderRadius: seededRandom(i + 20) > 0.5 ? "50%" : "0%",
        transform: `rotate(${seededRandom(i + 30) * 360}deg)`,
        animationDelay: `${seededRandom(i + 40) * 0.5}s`,
        animationDuration: `${2 + seededRandom(i + 50)}s`,
      } as React.CSSProperties,
    }))
  }, [gameState.showCelebration])

  const rulerTicks = fieldRulerTicksMm()
  const canvasSize = getPlaygroundCanvasSize(playgroundState.isMaximized)

  return (
    <div id="vex-app-root" className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Header */}
      <div id="vex-header" className="h-14 bg-gradient-to-r from-[#1976D2] to-[#2196F3] flex items-center justify-between px-4 text-white shadow-md">
        <div id="vex-header-left" className="flex items-center gap-4">
          <div id="vex-header-brand" className="bg-[#FF6B35] px-3 py-1.5 rounded font-bold text-xs">
            VEXcode VR Codesign Prototype
          </div>
          <div id="vex-header-menu" className="flex items-center gap-2 text-sm">
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
        <div id="vex-header-project-info" className="flex items-center gap-2">
          <span className="text-sm font-semibold">VEXcode Project</span>
          <button
            id="vex-btn-code-view-toggle"
            onClick={() => setCodeView(codeView === "blocks" ? "python" : "blocks")}
            className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded transition-colors"
          >
            {codeView === "blocks" ? "Show Python" : "Show Blocks"}
          </button>
          <span className="text-xs text-white/70">Not Saving</span>
        </div>
        <div id="vex-header-actions" className="flex items-center gap-2">
          {!playgroundState.isVisible && (
            <Button
              id="vex-btn-open-playground"
              variant="secondary"
              size="sm"
              onClick={handleOpenPlayground}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              Open Playground
            </Button>
          )}
          <Button
            id="vex-btn-get-help"
            variant="secondary"
            size="sm"
            className="bg-pink-500 hover:bg-pink-600 text-white border-0 flex items-center gap-1"
            onClick={handleOpenAIAssistant}
          >
            <HelpCircle className="h-4 w-4" />
            Get Help
          </Button>
          <Button
            id="vex-btn-robot-config"
            variant="secondary"
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 text-white border-0 flex items-center gap-1"
            onClick={handleOpenRobotConfig}
          >
            <Settings className="h-4 w-4" />
            Robot
          </Button>
          <Button
            id="vex-btn-start"
            size="sm"
            className="bg-green-500 hover:bg-green-600 text-white border-0"
            onClick={handleRun}
            disabled={isRunning}
          >
            <Play className="h-4 w-4 mr-1" />
            START
          </Button>
          <Button id="vex-btn-reset" size="sm" className="bg-purple-500 hover:bg-purple-600 text-white border-0" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            RESET
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div id="vex-main" className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Category Icons */}
        <div id="vex-category-sidebar" className="w-20 bg-[#D6E4F5] border-r border-gray-300 flex flex-col items-center py-4 gap-1 relative">
          <Button
            id="vex-category-drivetrain"
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              selectedCategory === "drivetrain"
                ? "bg-[#4A90E2] text-white"
                : "bg-[#4A90E2]/20 text-[#4A90E2] hover:bg-[#4A90E2]/30"
            }`}
            onClick={() => handleSelectCategory("drivetrain")}
          >
            <Cog className="h-6 w-6" />
            <span className="text-[10px] font-medium">Drivetrain</span>
          </Button>
          <Button
            id="vex-category-operators"
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              selectedCategory === "operators"
                ? "bg-[#4CAF50] text-white"
                : "bg-[#4CAF50]/20 text-[#4CAF50] hover:bg-[#4CAF50]/30"
            }`}
            onClick={() => handleSelectCategory("operators")}
          >
            <Calculator className="h-6 w-6" />
            <span className="text-[10px] font-medium">Operators</span>
          </Button>
          <Button
            id="vex-category-logic"
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              selectedCategory === "logic"
                ? "bg-[#F5A623] text-white"
                : "bg-[#F5A623]/20 text-[#F5A623] hover:bg-[#F5A623]/30"
            }`}
            onClick={() => handleSelectCategory("logic")}
          >
            <GitBranch className="h-6 w-6" />
            <span className="text-[10px] font-medium">Logic</span>
          </Button>
          <Button
            id="vex-category-magnet"
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              selectedCategory === "magnet"
                ? "bg-[#9B59B6] text-white"
                : "bg-[#9B59B6]/20 text-[#9B59B6] hover:bg-[#9B59B6]/30"
            }`}
            onClick={() => handleSelectCategory("magnet")}
          >
            <Magnet className="h-6 w-6" />
            <span className="text-[10px] font-medium">Magnet</span>
          </Button>
          <Button
            id="vex-category-drawing"
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              selectedCategory === "drawing"
                ? "bg-[#E67E22] text-white"
                : "bg-[#E67E22]/20 text-[#E67E22] hover:bg-[#E67E22]/30"
            }`}
            onClick={() => handleSelectCategory("drawing")}
          >
            <Pencil className="h-6 w-6" />
            <span className="text-[10px] font-medium">Drawing</span>
          </Button>
          <Button
            id="vex-category-sensing"
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              selectedCategory === "sensing"
                ? "bg-[#14B8A6] text-white"
                : "bg-[#14B8A6]/20 text-[#14B8A6] hover:bg-[#14B8A6]/30"
            }`}
            onClick={() => handleSelectCategory("sensing")}
          >
            <Eye className="h-6 w-6" />
            <span className="text-[10px] font-medium">Sensing</span>
          </Button>
          <Button
            id="vex-category-console"
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              selectedCategory === "console"
                ? "bg-[#7F8C8D] text-white"
                : "bg-[#7F8C8D]/20 text-[#7F8C8D] hover:bg-[#7F8C8D]/30"
            }`}
            onClick={() => handleSelectCategory("console")}
          >
            <Terminal className="h-6 w-6" />
            <span className="text-[10px] font-medium">Console</span>
          </Button>
          <Button
            id="vex-category-switch"
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              selectedCategory === "loops"
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
            id="vex-category-trash"
            variant="ghost"
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              deletedBlocks
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-red-500/20 text-red-500 hover:bg-red-500/30"
            }`}
            onClick={() => (deletedBlocks ? setShowDeletedBlocks(true) : handleTrash())}
          >
            <Trash2 className="h-6 w-6" />
            <span className="text-[10px] font-medium">{deletedBlocks ? "View" : "Trash"}</span>
          </Button>
        </div>

        {/* Blockly Workspace */}
        <div id="vex-blockly-workspace" className="flex-1 relative">
          {!blocklyLoaded && (
            <div id="vex-blockly-loading" className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-600">Loading Blockly...</p>
            </div>
          )}
          {/* Always keep blocklyDiv mounted, just hide with CSS */}
          <div
            id="vex-blockly-canvas"
            ref={blocklyDivRef}
            className="w-full h-full"
            style={{ display: codeView === "blocks" ? "block" : "none" }}
          />
          {codeView === "python" && (
            <div id="vex-python-code-view" className="w-full h-full bg-gray-900 text-gray-100 font-mono text-sm overflow-auto p-4">
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                <code>{getPythonCode()}</code>
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Playground Window */}
      {playgroundState.isVisible && (
        <div
          id="vex-playground-window"
          ref={playgroundRef}
          onMouseDown={handlePlaygroundMouseDown}
          suppressHydrationWarning
          className="fixed bg-white rounded-lg shadow-2xl border-2 border-gray-300 z-50 transition-all duration-200"
          style={{
            left: `${playgroundState.x}px`,
            top: `${playgroundState.y}px`,
            cursor: playgroundState.isDragging ? "grabbing" : "auto",
            width: playgroundState.isMaximized ? "640px" : "440px",
            height: "auto",
          }}
        >
          <div
            id="vex-playground-header"
            className="playground-header bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white px-4 py-2 rounded-t-lg flex items-center justify-between cursor-grab active:cursor-grabbing"
          >
            <div id="vex-playground-title-row" className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-white/70" />
              <h3 id="vex-playground-title" className="font-semibold text-sm">
                Coral Reef Cleanup
              </h3>
            </div>
            <div id="vex-playground-window-controls" className="flex items-center gap-1">
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
            <div id="vex-playground-body" className="flex flex-col relative">
              {consoleLines.length > 0 && (
                <div
                  id="vex-playground-console"
                  className="absolute top-2 left-2 right-12 z-10 max-h-20 overflow-y-auto rounded-md bg-black/75 px-2 py-1 font-mono text-[10px] text-green-300 shadow-md"
                >
                  {consoleLines.map((line, i) => (
                    <div key={`${i}-${line}`}>{line || "\u00a0"}</div>
                  ))}
                </div>
              )}

              <div id="vex-playground-canvas-row" className="flex">
                <canvas
                  id="vex-playground-canvas"
                  ref={canvasRef}
                  width={canvasSize.w}
                  height={canvasSize.h}
                />
                <div
                  id="vex-playground-ruler-y"
                  className="w-8 bg-gray-100 border-l border-gray-300 flex flex-col items-center justify-between py-1 text-[8px] text-gray-600"
                  style={{ height: canvasSize.h }}
                  aria-label="Y axis millimeters"
                >
                  {rulerTicks.map((mm) => (
                    <span key={mm} className="transform -rotate-90 whitespace-nowrap">
                      {mm}
                    </span>
                  ))}
                </div>
              </div>
              <div
                id="vex-playground-ruler-x"
                className="h-8 bg-gray-100 border-t border-gray-300 flex items-center justify-between px-2 text-[8px] text-gray-600"
                style={{ width: canvasSize.w + 32 }}
                aria-label="X axis millimeters"
              >
                {rulerTicks.map((mm) => (
                  <span key={mm}>{mm}</span>
                ))}
              </div>

              <div
                id="vex-playground-status-bar"
                className="border-t-2 border-[#357ABD]/20 bg-gradient-to-b from-slate-50 to-slate-100 px-3 py-3 space-y-2.5"
                style={{ width: canvasSize.w + 32 }}
              >
                <div className="flex flex-wrap items-end gap-4">
                  <div
                    id="vex-playground-trash-score"
                    className="bg-gradient-to-r from-[#FF8C00] to-[#FFA500] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm min-w-[120px]"
                  >
                    <div className="text-[10px] font-medium uppercase tracking-wide text-orange-100">Trash collected</div>
                    <div className="text-lg leading-tight mt-0.5">
                      {gameState.trashCollected}
                      {gameState.trashTotal > 0 ? ` / ${gameState.trashTotal}` : ""}
                    </div>
                    {liveSensors.trashRemaining > 0 && isRunning && (
                      <div className="text-[10px] font-normal text-orange-100 mt-0.5">
                        {liveSensors.trashRemaining} remaining on field
                      </div>
                    )}
                  </div>
                  <div id="vex-playground-battery" className="flex-1 min-w-[160px] max-w-[220px]">
                    <div className="flex items-baseline justify-between text-xs text-gray-600 mb-1">
                      <span className="font-semibold text-gray-800">Battery</span>
                      <span id="vex-playground-battery-value" className="font-mono font-semibold text-gray-900">
                        {Math.round(gameState.batteryPercent)}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden shadow-inner">
                      <div
                        id="vex-playground-battery-bar"
                        className={`h-full transition-all duration-300 ${gameState.batteryPercent < 25 ? "bg-red-500" : gameState.batteryPercent < 50 ? "bg-amber-400" : "bg-green-500"}`}
                        style={{ width: `${Math.max(0, gameState.batteryPercent)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div
                  id="vex-playground-sensors"
                  className="rounded-md border border-slate-200 bg-white/80 px-3 py-2 text-[11px] font-mono text-slate-700 space-y-1"
                >
                  <div className="font-sans text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Robot sensors
                  </div>
                  <div>
                    <span className="text-slate-500">Location (mm)</span> X {liveSensors.field.x}, Y {liveSensors.field.y}
                    <span className="text-slate-400 mx-1">·</span>
                    <span className="text-slate-500">Rotation</span> {liveSensors.rotation}°
                  </div>
                  <div>
                    <span className="text-slate-500">Front distance</span> {liveSensors.frontDistanceMm} mm
                    {liveSensors.frontObjectDetected && <span className="text-cyan-700"> · object detected</span>}
                    {liveSensors.eyeNear && <span className="text-cyan-700"> · eye near trash</span>}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Field {CORAL_REEF_FIELD_MM}×{CORAL_REEF_FIELD_MM} mm · Start position (0, -800)
                  </div>
                </div>
              </div>

              {gameState.isGameOver && (
                <div id="vex-playground-gameover" className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-b-lg">
                  <div className="bg-white rounded-xl p-6 shadow-2xl text-center max-w-xs">
                    {gameState.missionEndReason === "complete" ? (
                      <>
                        <h3 className="text-2xl font-bold text-green-600 mb-2">Mission complete!</h3>
                        <p className="text-gray-600 mb-4">All trash collected before the battery ran out.</p>
                      </>
                    ) : gameState.missionEndReason === "battery" ? (
                      <>
                        <h3 className="text-2xl font-bold text-amber-600 mb-2">Battery depleted</h3>
                        <p className="text-gray-600 mb-4">The underwater robot stopped. Collect more trash next run.</p>
                      </>
                    ) : gameState.runError ? (
                      <>
                        <h3 className="text-2xl font-bold text-amber-600 mb-2">Program stopped</h3>
                        <p className="text-gray-600 mb-4">{gameState.runError}</p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-2xl font-bold text-red-600 mb-2">Mission ended</h3>
                        <p className="text-gray-600 mb-4">The robot collided with the coral reef.</p>
                      </>
                    )}
                    <p id="vex-playground-gameover-score" className="text-lg font-semibold text-orange-500 mb-4">
                      Trash collected: {gameState.trashCollected}
                      {gameState.trashTotal > 0 ? ` / ${gameState.trashTotal}` : ""}
                    </p>
                    <Button id="vex-playground-gameover-retry" onClick={handleReset} className="bg-purple-500 hover:bg-purple-600 text-white">
                      Try Again
                    </Button>
                  </div>
                </div>
              )}

              {aiStep === "strategy-examples" && (
                <div
                  id="vex-playground-strategy-overlay"
                  className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-b-lg p-4 z-40"
                >
                  <div id="vex-playground-strategy-panel" className="bg-white rounded-xl shadow-2xl max-w-3xl max-h-96 overflow-y-auto">
                    <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-xl flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-lg">Strategies to Collect More Trash</h3>
                        <p className="text-sm text-blue-100">Try these approaches and compare the results</p>
                      </div>
                      <button
                        onClick={() => setAiStep("strategy")}
                        className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Approach 1 */}
                        <div className="border-l-4 border-blue-500 bg-blue-50 p-3 rounded">
                          <p className="font-bold text-blue-900 mb-2">Approach 1: Increase Velocity</p>
                          
                          {/* Movement visualization */}
                          <svg width="100%" height="100" viewBox="0 0 150 100" className="border border-blue-200 rounded mb-2 bg-white">
                            <rect x="10" y="10" width="130" height="80" fill="none" stroke="#d4d4d8" strokeDasharray="2" />
                            <circle cx="75" cy="15" r="3" fill="#ff6b35" />
                            <line x1="75" y1="15" x2="75" y2="55" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" />
                            <circle cx="75" cy="55" r="6" fill="#3b82f6" opacity="0.3" />
                            <text x="75" y="75" fontSize="10" textAnchor="middle" fill="#666">Straight line forward</text>
                          </svg>

                          <div className="bg-white p-2 rounded border border-blue-200 mb-2 font-mono text-xs text-gray-700">
                            when started<br/>
                            set drive velocity to 100<br/>
                            drive forward 500 mm
                          </div>
                          <p className="text-xs text-gray-700"><span className="font-semibold">Result:</span> Fast collection in one line. Good for quick focused movement.</p>
                        </div>

                        {/* Approach 2 */}
                        <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded">
                          <p className="font-bold text-green-900 mb-2">Approach 2: Continuous Patrol Loop</p>
                          
                          {/* Movement visualization */}
                          <svg width="100%" height="100" viewBox="0 0 150 100" className="border border-green-200 rounded mb-2 bg-white">
                            <rect x="10" y="10" width="130" height="80" fill="none" stroke="#d4d4d8" strokeDasharray="2" />
                            <circle cx="75" cy="15" r="3" fill="#ff6b35" />
                            <polyline points="75,15 75,50 120,50 120,80 40,80 40,50 75,50" stroke="#16a34a" strokeWidth="2" fill="none" strokeDasharray="4" />
                            <text x="75" y="95" fontSize="10" textAnchor="middle" fill="#666">Square patrol pattern</text>
                          </svg>

                          <div className="bg-white p-2 rounded border border-green-200 mb-2 font-mono text-xs text-gray-700">
                            when started<br/>
                            forever<br/>
                            &nbsp;&nbsp;drive forward 300 mm<br/>
                            &nbsp;&nbsp;turn right 90 degrees
                          </div>
                          <p className="text-xs text-gray-700"><span className="font-semibold">Result:</span> Covers large area continuously. Maximum trash collection.</p>
                        </div>
                      </div>

                      <div className="bg-yellow-50 border border-yellow-300 p-3 rounded">
                        <p className="text-xs font-semibold text-yellow-900">Challenge: Try both approaches and see which collects more trash!</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Assistant Window */}
      {aiAssistantState.isVisible && (
        <div
          id="vex-ai-assistant-window"
          ref={aiAssistantRef}
          onMouseDown={handleAIAssistantMouseDown}
          suppressHydrationWarning
          className="fixed bg-white rounded-lg shadow-2xl border-2 border-gray-300 z-50 transition-all duration-200"
          style={{
            left: `${aiAssistantState.x}px`,
            top: `${aiAssistantState.y}px`,
            cursor: aiAssistantState.isDragging ? "grabbing" : "auto",
            width: aiAssistantState.isMaximized ? "420px" : "320px",
          }}
        >
          <div
            id="vex-ai-assistant-header"
            className="ai-assistant-header bg-gradient-to-r from-[#9B59B6] to-[#8E44AD] text-white px-4 py-2 rounded-t-lg flex items-center justify-between cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-white/70" />
              <h3 id="vex-ai-assistant-title" className="font-semibold text-sm">
                AI Assistant
              </h3>
            </div>
            <div id="vex-ai-assistant-window-controls" className="flex items-center gap-1">
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
            <div id="vex-ai-assistant-body" className="p-4">
              {aiStep === "main" ? (
                <div id="vex-ai-assistant-menu" className="text-gray-700">
                  <p className="mb-4 font-medium text-base">What sort of help do you want?</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0"
                      onClick={() => setAiStep("strategy")}
                    >
                      <Lightbulb className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">1.</span>
                      <span>Come up with a strategy</span>
                    </Button>
                    <Button
                      className="justify-start text-left h-auto py-3 px-4 bg-purple-500 hover:bg-purple-600 text-white border-0"
                      onClick={() => {
                        console.log("[v0] Navigate to predict")
                        setAiStep("predict")
                      }}
                    >
                      <Target className="mr-3 h-5 w-5" />
                      <span className="mr-2">2.</span> Predict and Plan
                    </Button>
                    <Button
                      className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0"
                      onClick={() => setAiStep("fix")}
                    >
                      <Wrench className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">3.</span>
                      <span>Fix something that&apos;s not working</span>
                    </Button>
                    <Button
                      className="justify-start text-left h-auto py-3 px-4 bg-green-500 hover:bg-green-600 text-white border-0"
                      onClick={() => setAiStep("compare")}
                    >
                      <GitCompare className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">4.</span>
                      <span>Compare to a previous attempt</span>
                    </Button>
                    <Button
                      className="justify-start text-left h-auto py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white border-0"
                      onClick={() => setAiStep("feel")}
                    >
                      <Heart className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">5.</span>
                      <span>Tell me how you feel</span>
                    </Button>
                    <Button
                      className="justify-start text-left h-auto py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white border-0"
                      onClick={() => setAiStep("partner")}
                    >
                      <Users className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">6.</span>
                      <span>Work with a partner</span>
                    </Button>
                  </div>
                </div>
              ) : aiStep === "strategy" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-blue-600 hover:text-blue-800 -ml-2"
                    onClick={() => setAiStep("main")}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">What strategy would you like help with?</p>
                  <div className="flex flex-col gap-2">
                    <Button 
                      className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0"
                      onClick={() => setAiStep("strategy-examples")}
                    >
                      <Zap className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">1.</span>
                      <span>Move faster (efficiently)</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0">
                      <RotateCcw className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">2.</span>
                      <span>Turn around at the edge</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0">
                      <Search className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">3.</span>
                      <span>Find more blocks that could help you</span>
                    </Button>
                  </div>
                </div>
              ) : aiStep === "strategy-examples" ? (
                <div className="text-gray-700 text-sm">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-blue-600 hover:text-blue-800 -ml-2"
                    onClick={() => setAiStep("strategy")}
                  >
                    ← Back
                  </Button>
                  <p className="mb-3 font-medium text-base">Two approaches to move efficiently:</p>
                  
                  {/* Approach 1 */}
                  <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                    <p className="font-semibold text-blue-900 mb-2">Approach 1: Increase Velocity</p>
                    <p className="text-xs text-gray-600 mb-2">Set drive velocity to 100 at the start, then drive forward.</p>
                    <div className="bg-white p-2 rounded border border-blue-200 mb-2 font-mono text-xs">
                      <div className="text-blue-700">when started</div>
                      <div className="ml-4 text-green-700">set drive_velocity to 100</div>
                      <div className="ml-4 text-purple-700">drive forward 500 mm</div>
                    </div>
                    <p className="text-xs text-gray-700"><span className="font-semibold">Why:</span> Higher velocity = faster movement. This approach is simple and direct.</p>
                  </div>

                  {/* Approach 2 */}
                  <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 rounded">
                    <p className="font-semibold text-green-900 mb-2">Approach 2: Add Loop for Continuous Movement</p>
                    <p className="text-xs text-gray-600 mb-2">Use a forever loop to keep collecting trash continuously without stopping.</p>
                    <div className="bg-white p-2 rounded border border-green-200 mb-2 font-mono text-xs">
                      <div className="text-blue-700">when started</div>
                      <div className="ml-4 text-purple-700">forever</div>
                      <div className="ml-8 text-green-700">drive forward 300 mm</div>
                      <div className="ml-8 text-blue-700">turn right 90 degrees</div>
                    </div>
                    <p className="text-xs text-gray-700"><span className="font-semibold">Why:</span> Loops allow the robot to patrol continuously, covering more area and collecting more trash automatically.</p>
                  </div>

                  {/* Comparison */}
                  <div className="p-3 bg-gray-50 border border-gray-300 rounded">
                    <p className="font-semibold text-gray-900 mb-2">Comparison:</p>
                    <div className="text-xs space-y-1">
                      <div><span className="font-semibold text-blue-700">Approach 1:</span> Best for collecting one area quickly. Limited trash collection.</div>
                      <div><span className="font-semibold text-green-700">Approach 2:</span> Best for collecting more trash over time. Continuously patrols the area.</div>
                      <div className="mt-2 text-gray-600">Try both approaches and see which gets you more trash!</div>
                    </div>
                  </div>
                </div>
              ) : aiStep === "predict" ? (
                <div className="space-y-4">
                  <Button variant="outline" onClick={() => setAiStep("main")} className="mb-2">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <p className="text-purple-600 font-semibold">Predict and Plan - Preview your robot&apos;s path:</p>
                  <div className="border-4 border-purple-300 rounded-lg overflow-hidden">
                    <canvas id="vex-ai-predict-canvas" ref={predictCanvasRef} width={300} height={300} className="w-full" />
                  </div>
                  <Button
                    onClick={() => {
                      console.log("[v0] Show Prediction clicked")
                      drawPrediction()
                    }}
                    className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Show Prediction
                  </Button>
                </div>
              ) : aiStep === "fix" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-red-600 hover:text-red-800 -ml-2"
                    onClick={() => setAiStep("main")}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">What's not working?</p>
                  <div className="flex flex-col gap-2">
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0">
                      <StopCircle className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">1.</span>
                      <span>Robot isn't moving</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0">
                      <ArrowLeftRight className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">2.</span>
                      <span>Robot moves the wrong direction</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0">
                      <Eye className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">3.</span>
                      <span>Sensors aren't detecting anything</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0">
                      <RefreshCw className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">4.</span>
                      <span>Loop doesn't stop</span>
                    </Button>
                  </div>
                </div>
              ) : aiStep === "compare" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-green-600 hover:text-green-800 -ml-2"
                    onClick={() => setAiStep("main")}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">What would you like to compare?</p>
                  <div className="flex flex-col gap-2">
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-green-500 hover:bg-green-600 text-white border-0">
                      <Gauge className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">1.</span>
                      <span>Compare speed of different attempts</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-green-500 hover:bg-green-600 text-white border-0">
                      <Target className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">2.</span>
                      <span>Compare accuracy of movements</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-green-500 hover:bg-green-600 text-white border-0">
                      <FileDiff className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">3.</span>
                      <span>See what changed between versions</span>
                    </Button>
                  </div>
                </div>
              ) : aiStep === "feel" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-orange-600 hover:text-orange-800 -ml-2"
                    onClick={() => setAiStep("main")}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">How are you feeling?</p>
                  <div className="flex flex-col gap-2">
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white border-0">
                      <Frown className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">1.</span>
                      <span>Frustrated - nothing is working</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white border-0">
                      <HelpCircle className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">2.</span>
                      <span>Stuck - not sure what to try next</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white border-0">
                      <Sparkles className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">3.</span>
                      <span>Curious - want to learn more</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white border-0">
                      <PartyPopper className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">4.</span>
                      <span>Excited - making progress!</span>
                    </Button>
                  </div>
                </div>
              ) : aiStep === "partner" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-blue-600 hover:text-blue-800 -ml-2"
                    onClick={() => setAiStep("main")}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">How would you like to collaborate?</p>
                  <div className="flex flex-col gap-2">
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0">
                      <Share2 className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">1.</span>
                      <span>Share my code with a partner</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0">
                      <GitCompare className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">2.</span>
                      <span>Compare our solutions</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0">
                      <Users className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">3.</span>
                      <span>Work together on one robot</span>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Robot Config Window */}
      {robotConfigState.isVisible && (
        <div
          id="vex-robot-config-window"
          className="fixed bg-white border-2 border-gray-300 shadow-xl z-50"
          style={{
            left: `${robotConfigState.x}px`,
            top: `${robotConfigState.y}px`,
            width: robotConfigState.isMaximized ? "560px" : "460px",
            height: robotConfigState.isMaximized ? "500px" : "auto",
          }}
          onMouseDown={handleRobotConfigMouseDown}
        >
          <div
            id="vex-robot-config-header"
            className="robot-config-header bg-gradient-to-r from-blue-600 to-blue-500 text-white p-3 rounded-t-lg flex items-center justify-between cursor-move"
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-5 w-5" />
              <span id="vex-robot-config-title" className="font-bold text-lg">
                Devices
              </span>
            </div>
            <div id="vex-robot-config-window-controls" className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-white/20 text-white"
                onClick={handleMinimizeRobotConfig}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-white/20 text-white"
                onClick={handleMaximizeRobotConfig}
              >
                {robotConfigState.isMaximized ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-white/20 text-white"
                onClick={handleCloseRobotConfig}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!robotConfigState.isMinimized && (
            <div id="vex-robot-config-body" className="p-5">
              {/* Grid of device cards matching VEX VR style */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {/* Controller - always enabled */}
                <div className="flex flex-col items-center justify-center p-3 border-2 border-blue-500 bg-blue-50 rounded-lg cursor-default relative">
                  <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <Cog className="h-10 w-10 text-gray-700 mb-1" />
                  <span className="text-xs font-medium text-center">CONTROLLER</span>
                </div>

                {/* Drivetrain - always enabled */}
                <div className="flex flex-col items-center justify-center p-3 border-2 border-blue-500 bg-blue-50 rounded-lg cursor-default relative">
                  <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <Settings className="h-10 w-10 text-gray-700 mb-1" />
                  <span className="text-xs font-medium text-center">DRIVETRAIN</span>
                </div>

                {/* Eye/Vision Sensor */}
                <div
                  className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                    robotCapabilities.eyeSensor
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 bg-white hover:bg-gray-50"
                  }`}
                  onClick={() => setRobotCapabilities((prev) => ({ ...prev, eyeSensor: !prev.eyeSensor }))}
                >
                  {robotCapabilities.eyeSensor && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                  <Eye className="h-10 w-10 text-gray-700 mb-1" />
                  <span className="text-xs font-medium text-center">VISION</span>
                </div>

                {/* Bumper Sensor */}
                <div
                  className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                    robotCapabilities.bumperSensor
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 bg-white hover:bg-gray-50"
                  }`}
                  onClick={() => setRobotCapabilities((prev) => ({ ...prev, bumperSensor: !prev.bumperSensor }))}
                >
                  {robotCapabilities.bumperSensor && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                  <Target className="h-10 w-10 text-gray-700 mb-1" />
                  <span className="text-xs font-medium text-center">BUMPER</span>
                </div>

                {/* Inertial Sensor */}
                <div
                  className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                    robotCapabilities.inertial
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 bg-white hover:bg-gray-50"
                  }`}
                  onClick={() => setRobotCapabilities((prev) => ({ ...prev, inertial: !prev.inertial }))}
                >
                  {robotCapabilities.inertial && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                  <Gauge className="h-10 w-10 text-gray-700 mb-1" />
                  <span className="text-xs font-medium text-center">INERTIAL</span>
                </div>

                {/* Gyro Sensor */}
                <div
                  className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                    robotCapabilities.gyro ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:bg-gray-50"
                  }`}
                  onClick={() => setRobotCapabilities((prev) => ({ ...prev, gyro: !prev.gyro }))}
                >
                  {robotCapabilities.gyro && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                  <RefreshCw className="h-10 w-10 text-gray-700 mb-1" />
                  <span className="text-xs font-medium text-center">GYRO</span>
                </div>

                {/* GPS Sensor */}
                <div
                  className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                    robotCapabilities.gps ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:bg-gray-50"
                  }`}
                  onClick={() => setRobotCapabilities((prev) => ({ ...prev, gps: !prev.gps }))}
                >
                  {robotCapabilities.gps && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                  <Zap className="h-10 w-10 text-gray-700 mb-1" />
                  <span className="text-xs font-medium text-center">GPS</span>
                </div>

                {/* Electromagnet */}
                <div
                  className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                    robotCapabilities.rangeFinder
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 bg-white hover:bg-gray-50"
                  }`}
                  onClick={() => setRobotCapabilities((prev) => ({ ...prev, rangeFinder: !prev.rangeFinder }))}
                >
                  {robotCapabilities.rangeFinder && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                  <Magnet className="h-10 w-10 text-gray-700 mb-1" />
                  <span className="text-xs font-medium text-center">
                    ELECTRO-
                    <br />
                    MAGNET
                  </span>
                </div>

                {/* Arm */}
                <div
                  className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                    robotCapabilities.arm ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:bg-gray-50"
                  }`}
                  onClick={() => setRobotCapabilities((prev) => ({ ...prev, arm: !prev.arm }))}
                >
                  {robotCapabilities.arm && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                  <Wrench className="h-10 w-10 text-gray-700 mb-1" />
                  <span className="text-xs font-medium text-center">ARM</span>
                </div>

                {/* 2-Wire Motor */}
                <div
                  className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                    robotCapabilities.lineTracker
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 bg-white hover:bg-gray-50"
                  }`}
                  onClick={() => setRobotCapabilities((prev) => ({ ...prev, lineTracker: !prev.lineTracker }))}
                >
                  {robotCapabilities.lineTracker && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                  <Zap className="h-10 w-10 text-gray-700 mb-1" />
                  <span className="text-xs font-medium text-center">
                    2-WIRE
                    <br />
                    MOTOR
                  </span>
                </div>
              </div>

              {/* Bottom buttons matching VEX VR style */}
              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  className="px-6 bg-transparent"
                  onClick={() => {
                    setRobotCapabilities({
                      eyeSensor: true,
                      bumperSensor: true,
                      arm: false,
                      gyro: false,
                      gps: false,
                      inertial: false,
                      rangeFinder: false,
                      lineTracker: false,
                    })
                    handleCloseRobotConfig()
                  }}
                >
                  CANCEL
                </Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 px-6" onClick={handleCloseRobotConfig}>
                  DONE
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {showDeletedBlocks && deletedBlocks && (
        <div
          id="vex-deleted-blocks-modal"
          className="fixed bg-white rounded-lg shadow-2xl border border-gray-300 overflow-hidden"
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 400,
            zIndex: 200,
          }}
        >
          <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-2 flex items-center justify-between">
            <span className="font-semibold text-sm">Deleted Blocks</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-white hover:bg-white/20"
                onClick={() => setShowDeletedBlocks(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-600 mb-4">
              Your previously deleted blocks are stored here. You can restore them to the workspace.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1 bg-green-500 hover:bg-green-600 text-white" onClick={handleRestoreBlocks}>
                Restore Blocks
              </Button>
              <Button
                variant="outline"
                className="flex-1 bg-transparent"
                onClick={() => {
                  setDeletedBlocks(null)
                  setShowDeletedBlocks(false)
                }}
              >
                Clear Trash
              </Button>
            </div>
          </div>
        </div>
      )}

      {gameState.showCelebration && confettiParticles.length > 0 && (
        <div id="vex-celebration-overlay" className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
          {confettiParticles.map((particle) => (
            <div key={particle.id} className="absolute animate-confetti" style={particle.style} />
          ))}
          {/* Celebration message */}
          <div className="bg-gradient-to-br from-yellow-400 via-orange-400 to-pink-500 text-white p-8 rounded-2xl shadow-2xl pointer-events-auto transform animate-bounce-in">
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-4xl font-bold mb-2">Amazing Work!</h2>
              <p className="text-2xl mb-4">You collected {gameState.trashCollected} pieces of trash!</p>
              <div className="text-lg opacity-90">Keep up the great work cleaning the ocean!</div>
            </div>
          </div>
        </div>
      )}

      {/* Angle Picker Modals */}
      {anglePickerState.isOpen && (
        <AngleWheelPicker
          value={anglePickerState.angle}
          onApply={applyPickerValue}
          onClose={() => {
            blocklyPickerRef.current = null
            setAnglePickerState((prev) => ({ ...prev, isOpen: false }))
          }}
        />
      )}

      {compassPickerState.isOpen && (
        <CompassPicker
          value={compassPickerState.heading}
          onApply={applyPickerValue}
          onClose={() => {
            blocklyPickerRef.current = null
            setCompassPickerState((prev) => ({ ...prev, isOpen: false }))
          }}
        />
      )}

      {distancePickerState.isOpen && (
        <DistanceSliderPicker
          value={distancePickerState.distance}
          direction={distancePickerState.direction}
          playgroundWidth={playgroundState.isMaximized ? 600 : 400}
          playgroundHeight={playgroundState.isMaximized ? 600 : 400}
          robotState={robotState}
          onApply={applyPickerValue}
          onClose={() => {
            blocklyPickerRef.current = null
            setDistancePickerState((prev) => ({ ...prev, isOpen: false }))
          }}
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
        .appendField(new Blockly.FieldNumber(200, 0, 5000), "DISTANCE")
        .appendField(
          new Blockly.FieldDropdown(
            [
              ["mm", "mm"],
              ["inches", "inches"],
            ],
            (newValue) => {
              // When unit changes, show alert and highlight distance field
              if (newValue !== this.getFieldValue("UNIT")) {
                alert("⚠️ Units changed! Please check your distance value.")

                const distanceFieldElement = this.getField("DISTANCE") as { fieldGroup_?: { querySelector: (s: string) => Element | null } }
                if (distanceFieldElement?.fieldGroup_) {
                  const rect = distanceFieldElement.fieldGroup_.querySelector("rect")
                  if (rect) {
                    rect.setAttribute("fill", "#ff1493")
                    setTimeout(() => {
                      rect.setAttribute("fill", "#ffffff")
                    }, 3000)
                  }
                }
              }
              return newValue
            },
          ),
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
    const distance = Number(block.getFieldValue("DISTANCE")) || 0
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
          new Blockly.FieldNumber(90, 0, 359, 1, (newValue: string) => {
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
      this.setColour("#14B8A6")
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
      this.setColour("#14B8A6")
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
      this.setColour("#14B8A6")
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
      this.setColour("#14B8A6")
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
      this.setColour("#14B8A6")
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
      this.setColour("#14B8A6")
      this.setTooltip("Get eye sensor brightness percentage")
    },
  }
  Blockly.JavaScript.forBlock["eye_brightness"] = (block: any) => {
    const sensor = block.getFieldValue("SENSOR")
    return [`robot.eyeBrightness('${sensor}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["position_value"] = {
    init: function () {
      this.appendDummyInput().appendField("position")
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["X", "X"],
            ["Y", "Y"],
          ]),
          "AXIS",
        )
        .appendField("in")
        .appendField(
          new Blockly.FieldDropdown([
            ["mm", "MM"],
            ["inches", "INCHES"],
          ]),
          "UNIT",
        )
      this.setOutput(true, "Number")
      this.setColour("#14B8A6")
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
      this.setColour("#14B8A6")
      this.setTooltip("Get robot angle")
    },
  }
  Blockly.JavaScript.forBlock["position_angle"] = () => {
    return [`robot.getPositionAngle()`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }
}

// Console Blocks
function defineConsoleBlocks(Blockly: any) {
  Blockly.Blocks["print_text"] = {
    init: function () {
      this.appendValueInput("TEXT").appendField("print")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
      this.setTooltip("Print text to console")
    },
  }
  Blockly.JavaScript.forBlock["print_text"] = (block: any) => {
    const text = Blockly.JavaScript.valueToCode(block, "TEXT", Blockly.JavaScript.ORDER_NONE) || "''"
    return `robot.print(${text});\n`
  }

  Blockly.Blocks["set_cursor_next_row"] = {
    init: function () {
      this.appendDummyInput().appendField("set cursor to next row")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
    },
  }
  Blockly.JavaScript.forBlock["set_cursor_next_row"] = () => `robot.setCursorNextRow();\n`

  Blockly.Blocks["clear_all_rows"] = {
    init: function () {
      this.appendDummyInput().appendField("clear all rows")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
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
            ["1", "1"],
          ]),
          "PRECISION",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
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
            ["black", "BLACK"],
            ["red", "RED"],
            ["green", "GREEN"],
            ["blue", "BLUE"],
          ]),
          "COLOR",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
    },
  }
  Blockly.JavaScript.forBlock["set_print_color"] = (block: any) => {
    const color = block.getFieldValue("COLOR")
    return `robot.setPrintColor('${color}');\n`
  }
}

// Logic Blocks
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
    },
  }
  Blockly.JavaScript.forBlock["wait_seconds"] = (block: any) => {
    const seconds = block.getFieldValue("SECONDS")
    return `await robot.wait(${seconds});\n`
  }

  Blockly.Blocks["wait_until"] = {
    init: function () {
      this.appendValueInput("CONDITION").appendField("wait until")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
    },
  }
  Blockly.JavaScript.forBlock["wait_until"] = (block: any) => {
    const condition = Blockly.JavaScript.valueToCode(block, "CONDITION", Blockly.JavaScript.ORDER_NONE) || "true"
    return `while(!(${condition})) { await robot.wait(0.1); }\n`
  }

  Blockly.Blocks["repeat_times"] = {
    init: function () {
      this.appendDummyInput().appendField("repeat").appendField(new Blockly.FieldNumber(10, 1), "TIMES")
      this.appendStatementInput("DO")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
    },
  }
  Blockly.JavaScript.forBlock["repeat_times"] = (block: any) => {
    const times = block.getFieldValue("TIMES")
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `for(let i = 0; i < ${times}; i++) {\n${statements}}\n`
  }

  Blockly.Blocks["forever_loop"] = {
    init: function () {
      this.appendDummyInput().appendField("forever")
      this.appendStatementInput("DO")
      this.setPreviousStatement(true, null)
      this.setColour("#F5A623")
    },
  }
  Blockly.JavaScript.forBlock["forever_loop"] = (block: any) => {
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `while(true) {\n${statements}await robot.wait(0.01);\n}\n`
  }

  Blockly.Blocks["repeat_until"] = {
    init: function () {
      this.appendValueInput("CONDITION").appendField("repeat until")
      this.appendStatementInput("DO")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
    },
  }
  Blockly.JavaScript.forBlock["repeat_until"] = (block: any) => {
    const condition = Blockly.JavaScript.valueToCode(block, "CONDITION", Blockly.JavaScript.ORDER_NONE) || "false"
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `while(!(${condition})) {\n${statements}}\n`
  }

  Blockly.Blocks["while_loop"] = {
    init: function () {
      this.appendValueInput("CONDITION").appendField("while")
      this.appendStatementInput("DO")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
    },
  }
  Blockly.JavaScript.forBlock["while_loop"] = (block: any) => {
    const condition = Blockly.JavaScript.valueToCode(block, "CONDITION", Blockly.JavaScript.ORDER_NONE) || "true"
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `while(${condition}) {\n${statements}}\n`
  }

  Blockly.Blocks["if_then"] = {
    init: function () {
      this.appendValueInput("CONDITION").appendField("if")
      this.appendDummyInput().appendField("then")
      this.appendStatementInput("DO")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
    },
  }
  Blockly.JavaScript.forBlock["if_then"] = (block: any) => {
    const condition = Blockly.JavaScript.valueToCode(block, "CONDITION", Blockly.JavaScript.ORDER_NONE) || "true"
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `if(${condition}) {\n${statements}}\n`
  }

  Blockly.Blocks["if_then_else"] = {
    init: function () {
      this.appendValueInput("CONDITION").appendField("if")
      this.appendDummyInput().appendField("then")
      this.appendStatementInput("DO")
      this.appendDummyInput().appendField("else")
      this.appendStatementInput("ELSE")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
    },
  }
  Blockly.JavaScript.forBlock["if_then_else"] = (block: any) => {
    const condition = Blockly.JavaScript.valueToCode(block, "CONDITION", Blockly.JavaScript.ORDER_NONE) || "true"
    const doStatements = Blockly.JavaScript.statementToCode(block, "DO")
    const elseStatements = Blockly.JavaScript.statementToCode(block, "ELSE")
    return `if(${condition}) {\n${doStatements}} else {\n${elseStatements}}\n`
  }

  Blockly.Blocks["if_elseif_else"] = {
    init: function () {
      this.appendValueInput("CONDITION1").appendField("if")
      this.appendDummyInput().appendField("then")
      this.appendStatementInput("DO1")
      this.appendValueInput("CONDITION2").appendField("else if")
      this.appendDummyInput().appendField("then")
      this.appendStatementInput("DO2")
      this.appendDummyInput().appendField("else")
      this.appendStatementInput("ELSE")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
    },
  }
  Blockly.JavaScript.forBlock["if_elseif_else"] = (block: any) => {
    const condition1 = Blockly.JavaScript.valueToCode(block, "CONDITION1", Blockly.JavaScript.ORDER_NONE) || "true"
    const do1Statements = Blockly.JavaScript.statementToCode(block, "DO1")
    const condition2 = Blockly.JavaScript.valueToCode(block, "CONDITION2", Blockly.JavaScript.ORDER_NONE) || "true"
    const do2Statements = Blockly.JavaScript.statementToCode(block, "DO2")
    const elseStatements = Blockly.JavaScript.statementToCode(block, "ELSE")
    return `if (${condition1}) {\n${do1Statements}} else if (${condition2}) {\n${do2Statements}} else {\n${elseStatements}}\n`
  }

  Blockly.Blocks["break_block"] = {
    init: function () {
      this.appendDummyInput().appendField("break")
      this.setPreviousStatement(true, null)
      this.setColour("#F5A623")
    },
  }
  Blockly.JavaScript.forBlock["break_block"] = () => `break;\n`

  Blockly.Blocks["stop_project"] = {
    init: function () {
      this.appendDummyInput().appendField("stop project")
      this.setPreviousStatement(true, null)
      this.setColour("#F5A623")
    },
  }
  Blockly.JavaScript.forBlock["stop_project"] = () => `robot.stop();\n`

  Blockly.Blocks["comment_block"] = {
    init: function () {
      this.appendDummyInput().appendField("comment").appendField(new Blockly.FieldTextInput(""), "TEXT")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#AAAAAA")
    },
  }
  Blockly.JavaScript.forBlock["comment_block"] = (block: any) => {
    const text = block.getFieldValue("TEXT")
    return `// ${text}\n`
  }
}

// Operators Blocks
function defineOperatorsBlocks(Blockly: any) {
  // Math Arithmetic
  Blockly.Blocks["math_arithmetic"] = {
    init: function () {
      this.appendValueInput("A").setCheck("Number")
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["+", "ADD"],
          ["-", "MINUS"],
          ["×", "MULTIPLY"],
          ["÷", "DIVIDE"],
        ]),
        "OP",
      )
      this.appendValueInput("B").setCheck("Number")
      this.setInputsInline(true)
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["math_arithmetic"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_ATOMIC) || "0"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_ATOMIC) || "0"
    const op = block.getFieldValue("OP")
    const operators: any = { ADD: "+", MINUS: "-", MULTIPLY: "*", DIVIDE: "/" }
    return [`(${a} ${operators[op]} ${b})`, Blockly.JavaScript.ORDER_ATOMIC]
  }

  // Comparison
  Blockly.Blocks["compare"] = {
    init: function () {
      this.appendValueInput("A").setCheck("Number")
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["=", "EQ"],
          ["≠", "NEQ"],
          ["<", "LT"],
          [">", "GT"],
          ["≤", "LTE"],
          ["≥", "GTE"],
        ]),
        "OP",
      )
      this.appendValueInput("B").setCheck("Number")
      this.setInputsInline(true)
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["compare"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_RELATIONAL) || "0"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_RELATIONAL) || "0"
    const op = block.getFieldValue("OP")
    const operators: any = { EQ: "===", NEQ: "!==", LT: "<", GT: ">", LTE: "<=", GTE: ">=" }
    return [`(${a} ${operators[op]} ${b})`, Blockly.JavaScript.ORDER_RELATIONAL]
  }

  // Boolean AND
  Blockly.Blocks["boolean_and"] = {
    init: function () {
      this.appendValueInput("A").setCheck("Boolean")
      this.appendDummyInput().appendField("and")
      this.appendValueInput("B").setCheck("Boolean")
      this.setInputsInline(true)
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
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
      this.setInputsInline(true)
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["boolean_or"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_LOGICAL_OR) || "false"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_LOGICAL_OR) || "false"
    return [`(${a} || ${b})`, Blockly.JavaScript.ORDER_LOGICAL_OR]
  }

  Blockly.Blocks["text_string"] = {
    init: function () {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput("text"), "TEXT")
      this.setOutput(true, "String")
      this.setColour("#4CAF50")
      this.setTooltip("Text value for print and other blocks")
    },
  }
  Blockly.JavaScript.forBlock["text_string"] = (block: any) => {
    const text = block.getFieldValue("TEXT").replace(/\\/g, "\\\\").replace(/'/g, "\\'")
    return [`'${text}'`, Blockly.JavaScript.ORDER_ATOMIC]
  }

  // Boolean NOT
  Blockly.Blocks["boolean_not"] = {
    init: function () {
      this.appendDummyInput().appendField("not")
      this.appendValueInput("BOOL").setCheck("Boolean")
      this.setInputsInline(true)
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["boolean_not"] = (block: any) => {
    const bool = Blockly.JavaScript.valueToCode(block, "BOOL", Blockly.JavaScript.ORDER_LOGICAL_NOT) || "false"
    return [`(!${bool})`, Blockly.JavaScript.ORDER_LOGICAL_NOT]
  }

  // Range Comparison (triple compare)
  Blockly.Blocks["range_compare"] = {
    init: function () {
      this.appendValueInput("A").setCheck("Number")
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["<", "LT"],
          ["≤", "LTE"],
        ]),
        "OP1",
      )
      this.appendValueInput("B").setCheck("Number")
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["<", "LT"],
          ["≤", "LTE"],
        ]),
        "OP2",
      )
      this.appendValueInput("C").setCheck("Number")
      this.setInputsInline(true)
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["range_compare"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_RELATIONAL) || "0"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_RELATIONAL) || "0"
    const c = Blockly.JavaScript.valueToCode(block, "C", Blockly.JavaScript.ORDER_RELATIONAL) || "0"
    const op1 = block.getFieldValue("OP1")
    const op2 = block.getFieldValue("OP2")
    const operators: any = { LT: "<", LTE: "<=" }
    return [`(${a} ${operators[op1]} ${b} && ${b} ${operators[op2]} ${c})`, Blockly.JavaScript.ORDER_LOGICAL_AND]
  }

  // Pick Random
  Blockly.Blocks["random_int"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("pick random")
        .appendField(new Blockly.FieldNumber(1, 0), "FROM")
        .appendField("to")
        .appendField(new Blockly.FieldNumber(10, 0), "TO")
      this.setInputsInline(true)
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["random_int"] = (block: any) => {
    const from = block.getFieldValue("FROM") || "1"
    const to = block.getFieldValue("TO") || "10"
    return [`(Math.floor(Math.random() * (${to} - ${from} + 1)) + ${from})`, Blockly.JavaScript.ORDER_ATOMIC]
  }

  // Round Number
  Blockly.Blocks["round_number"] = {
    init: function () {
      this.appendDummyInput().appendField("round")
      this.appendValueInput("NUM").setCheck("Number")
      this.appendDummyInput().appendField("to")
      this.appendValueInput("PLACES").setCheck("Number")
      this.appendDummyInput().appendField("decimal places")
      this.setInputsInline(true)
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["round_number"] = (block: any) => {
    const num = Blockly.JavaScript.valueToCode(block, "NUM", Blockly.JavaScript.ORDER_ATOMIC) || "0"
    const places = Blockly.JavaScript.valueToCode(block, "PLACES", Blockly.JavaScript.ORDER_ATOMIC) || "0"
    return [`(Math.round(${num} * Math.pow(10, ${places})) / Math.pow(10, ${places}))`, Blockly.JavaScript.ORDER_ATOMIC]
  }

  // Math Function (abs, sqrt, etc.)
  Blockly.Blocks["math_function"] = {
    init: function () {
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["abs", "ABS"],
          ["√", "SQRT"],
          ["sin", "SIN"],
          ["cos", "COS"],
          ["tan", "TAN"],
        ]),
        "FUNC",
      )
      this.appendDummyInput().appendField("of")
      this.appendValueInput("NUM").setCheck("Number")
      this.setInputsInline(true)
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["math_function"] = (block: any) => {
    const num = Blockly.JavaScript.valueToCode(block, "NUM", Blockly.JavaScript.ORDER_ATOMIC) || "0"
    const func = block.getFieldValue("FUNC")
    const functions: any = { ABS: "Math.abs", SQRT: "Math.sqrt", SIN: "Math.sin", COS: "Math.cos", TAN: "Math.tan" }
    return [`${functions[func]}(${num})`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  // atan2 Function
  Blockly.Blocks["atan2_function"] = {
    init: function () {
      this.appendDummyInput().appendField("atan2 of x:")
      this.appendValueInput("X").setCheck("Number")
      this.appendDummyInput().appendField("y:")
      this.appendValueInput("Y").setCheck("Number")
      this.setInputsInline(true)
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["atan2_function"] = (block: any) => {
    const x = Blockly.JavaScript.valueToCode(block, "X", Blockly.JavaScript.ORDER_ATOMIC) || "1"
    const y = Blockly.JavaScript.valueToCode(block, "Y", Blockly.JavaScript.ORDER_ATOMIC) || "1"
    return [`Math.atan2(${y}, ${x})`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  // Modulo (Remainder)
  Blockly.Blocks["modulo"] = {
    init: function () {
      this.appendDummyInput().appendField("remainder of")
      this.appendValueInput("A").setCheck("Number")
      this.appendDummyInput().appendField("/")
      this.appendValueInput("B").setCheck("Number")
      this.setInputsInline(true)
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["modulo"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_MODULUS) || "0"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_MODULUS) || "1"
    return [`(${a} % ${b})`, Blockly.JavaScript.ORDER_MODULUS]
  }

  // Text Join
  Blockly.Blocks["text_join"] = {
    init: function () {
      this.appendDummyInput().appendField("join")
      this.appendValueInput("A").setCheck("String")
      this.appendValueInput("B").setCheck("String")
      this.setInputsInline(true)
      this.setOutput(true, "String")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["text_join"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_ADDITION) || "''"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_ADDITION) || "''"
    return [`(${a} + ${b})`, Blockly.JavaScript.ORDER_ADDITION]
  }

  // Letter At Position
  Blockly.Blocks["text_letter_at"] = {
    init: function () {
      this.appendDummyInput().appendField("letter")
      this.appendValueInput("AT").setCheck("Number")
      this.appendDummyInput().appendField("of")
      this.appendValueInput("TEXT").setCheck("String")
      this.setInputsInline(true)
      this.setOutput(true, "String")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["text_letter_at"] = (block: any) => {
    const at = Blockly.JavaScript.valueToCode(block, "AT", Blockly.JavaScript.ORDER_ATOMIC) || "1"
    const text = Blockly.JavaScript.valueToCode(block, "TEXT", Blockly.JavaScript.ORDER_MEMBER) || "''"
    return [`(${text}[${at} - 1] || '')`, Blockly.JavaScript.ORDER_MEMBER]
  }

  // Text Length
  Blockly.Blocks["text_length"] = {
    init: function () {
      this.appendDummyInput().appendField("length of")
      this.appendValueInput("TEXT").setCheck("String")
      this.setInputsInline(true)
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["text_length"] = (block: any) => {
    const text = Blockly.JavaScript.valueToCode(block, "TEXT", Blockly.JavaScript.ORDER_MEMBER) || "''"
    return [`(${text}.length)`, Blockly.JavaScript.ORDER_MEMBER]
  }

  // Text Contains
  Blockly.Blocks["text_contains"] = {
    init: function () {
      this.appendValueInput("TEXT").setCheck("String")
      this.appendDummyInput().appendField("contains")
      this.appendValueInput("SEARCH").setCheck("String")
      this.appendDummyInput().appendField("?")
      this.setInputsInline(true)
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["text_contains"] = (block: any) => {
    const text = Blockly.JavaScript.valueToCode(block, "TEXT", Blockly.JavaScript.ORDER_MEMBER) || "''"
    const search = Blockly.JavaScript.valueToCode(block, "SEARCH", Blockly.JavaScript.ORDER_NONE) || "''"
    return [`(${text}.includes(${search}))`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  // Convert Type
  Blockly.Blocks["convert_type"] = {
    init: function () {
      this.appendDummyInput().appendField("convert")
      this.appendValueInput("VALUE")
      this.appendDummyInput()
        .appendField("to")
        .appendField(
          new Blockly.FieldDropdown([
            ["text", "TEXT"],
            ["number", "NUMBER"],
          ]),
          "TYPE",
        )
      this.setInputsInline(true)
      this.setOutput(true)
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["convert_type"] = (block: any) => {
    const value = Blockly.JavaScript.valueToCode(block, "VALUE", Blockly.JavaScript.ORDER_ATOMIC) || "0"
    const type = block.getFieldValue("TYPE")
    if (type === "TEXT") {
      return [`String(${value})`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
    } else {
      return [`Number(${value})`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
    }
  }
}

// Switch Blocks
function defineSwitchBlocks(Blockly: any) {
  // When Started block - event trigger
  Blockly.Blocks["when_started"] = {
    init: function () {
      this.appendDummyInput().appendField("when started")
      this.appendStatementInput("DO").setCheck(null)
      this.setColour("#FFB300")
      this.setTooltip("Runs when the program starts")
      this.setHelpUrl("")
    },
  }

  registerBlockGenerator(Blockly, "when_started", (block: any) => {
    return Blockly.JavaScript.statementToCode(block, "DO")
  })

  // Forever loop
  Blockly.Blocks["forever"] = {
    init: function () {
      this.appendDummyInput().appendField("forever")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#FFB300")
      this.setTooltip("Repeats the blocks inside forever")
      this.setHelpUrl("")
    },
  }

  registerBlockGenerator(Blockly, "forever", (block: any) => {
    const statements_do = Blockly.JavaScript.statementToCode(block, "DO")
    return `while (true) {\n${statements_do}await robot.wait(0.01);\n}\n`
  })

  // Repeat N times
  Blockly.Blocks["repeat"] = {
    init: function () {
      this.appendValueInput("TIMES").setCheck("Number").appendField("repeat")
      this.appendDummyInput().appendField("times")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#FFB300")
      this.setTooltip("Repeats the blocks inside N times")
      this.setHelpUrl("")
    },
  }

  registerBlockGenerator(Blockly, "repeat", (block: any) => {
    const value_times = Blockly.JavaScript.valueToCode(block, "TIMES", Blockly.JavaScript.ORDER_ATOMIC) || "0"
    const statements_do = Blockly.JavaScript.statementToCode(block, "DO")
    return `for (let count = 0; count < ${value_times}; count++) {\n${statements_do}}\n`
  })

  // Wait
  Blockly.Blocks["wait"] = {
    init: function () {
      this.appendValueInput("SECONDS").setCheck("Number").appendField("wait")
      this.appendDummyInput().appendField("seconds")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#FFB300")
      this.setTooltip("Waits for the specified number of seconds")
      this.setHelpUrl("")
    },
  }

  registerBlockGenerator(Blockly, "wait", (block: any) => {
    const value_seconds = Blockly.JavaScript.valueToCode(block, "SECONDS", Blockly.JavaScript.ORDER_ATOMIC) || "0"
    return `await robot.wait(${value_seconds});\n`
  })
}

export default BlocklyEditor
