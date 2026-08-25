"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  clampRobotPosition,
  BUMPER_CONTACT_MARGIN_PX,
  BUMPER_FORWARD_PX,
  BUMPER_LATERAL_PX,
  CORAL_REEF_BATTERY_SEC,
  CORAL_REEF_FIELD_MM,
  CORAL_REEF_TRASH_COUNT,
  createInitialTrashItems,
  distanceToPixels,
  DISTANCE_SENSOR_MAX_MM,
  driveDurationMs,
  fieldMmToPixel,
  drawFieldRulerOverlay,
  forEachProgramBlock,
  generateWhenStartedJavaScript,
  getDefaultRobotPixelPosition,
  getPlaygroundCanvasSize,
  remapPixelAcrossCanvas,
  maxDriveDistanceMm,
  EYE_NEAR_MM,
  isTrashNearEye,
  nearestTrashDistanceMm,
  nearestTrashInFrontMm,
  normalizeDegrees,
  pixelToFieldMm,
  pointHitsCoral,
  raycastToBorder,
  attachNumberShadow,
  flyoutBlockWithNumberShadows,
  registerBlockGenerator,
  seededRandom,
  shortestRotationDelta,
  turnDurationMs,
  type CoralPiece,
} from "@/lib/robot-runtime"
import {
  ensureBlocklyWidgetDivReady,
  isBlocklyFieldEditorTarget,
  isTypingInFormField,
} from "@/lib/blockly-widget-fix"
import {
  CORAL_COLORS,
  CORAL_KINDS,
  drawCoralPiece,
  drawReefBed,
  drawSubmarine,
} from "@/lib/reef-art"
import { useBlocklyCollab } from "@/lib/use-blockly-collab"
import { blockToPythonSnippet, generatePythonProgram } from "@/lib/python-generator"
import { installVexBlockContextMenu } from "@/lib/blockly-context-menu"
import BlocklyCollabOverlay from "@/components/blockly-collab-overlay"
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
  Ruler,
  Minus,
  Square,
  Bot,
  FolderOpen,
  Save,
  FilePlus,
  ChevronDown,
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

/**
 * Thrown to unwind a running block program. Generated code has no way to
 * `return`, so stopping means rejecting at the next `await` and swallowing it.
 */
class ProgramStopped extends Error {
  constructor() {
    super("Program stopped")
    this.name = "ProgramStopped"
  }
}

/**
 * Every generated loop body ends with this so the browser can paint and the
 * runtime gets a chance to observe a stop request. Without it a loop whose body
 * is all synchronous blocks freezes the tab.
 */
const LOOP_YIELD = "await robot.wait(0);\n"

/** Block types that create a JS loop, so `break` is legal inside them. */
const LOOP_BLOCK_TYPES = new Set([
  "repeat_times",
  "forever_loop",
  "repeat_until",
  "while_loop",
  "repeat",
  "forever",
])

/** One row of the VEX print console. `print` appends to the last row. */
interface ConsoleLine {
  text: string
  color: string
}

const PRINT_COLORS: Record<string, string> = {
  black: "#d1fae5",
  red: "#f87171",
  green: "#4ade80",
  blue: "#60a5fa",
}

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
  const blocklyWorkspaceContainerRef = useRef<HTMLDivElement>(null)
  const playgroundRef = useRef<HTMLDivElement>(null)
  const aiAssistantRef = useRef<HTMLDivElement>(null)
  const predictCanvasRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [blocklyLoaded, setBlocklyLoaded] = useState(false)
  const [blocklyLoadError, setBlocklyLoadError] = useState<string | null>(null)
  const collab = useBlocklyCollab(workspace, blocklyLoaded, blocklyWorkspaceContainerRef)
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
  /** True from the moment a program starts until its async body finishes unwinding. */
  const programActiveRef = useRef(false)
  /** Set when the program must unwind (stop project, mission end, reset). */
  const stopRequestedRef = useRef(false)
  /** Settles the in-flight movement promise so `await` never dangles. */
  const animationCancelRef = useRef<(() => void) | null>(null)

  /** Ends the current movement early and lets the awaiting program continue. */
  const cancelRobotAnimation = useCallback(() => {
    if (animationCancelRef.current) {
      animationCancelRef.current()
      return
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [])

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
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])

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
  const [showRuler, setShowRuler] = useState(false)
  const [showSensors, setShowSensors] = useState(true)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const fileMenuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!fileMenuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (fileMenuRef.current && target && !fileMenuRef.current.contains(target)) {
        setFileMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFileMenuOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [fileMenuOpen])

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
  const trashItemsRef = useRef<TrashItem[]>([])
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

  const syncTrashItems = useCallback((items: TrashItem[]) => {
    trashItemsRef.current = items
    setTrashItems(items)
  }, [])

  useEffect(() => {
    trashItemsRef.current = trashItems
  }, [trashItems])
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
    const pieces: CoralPiece[] = []

    /** `angle` turns the colony so it grows away from the wall it sits on. */
    const pushPiece = (x: number, y: number, seed: number, angle: number) => {
      pieces.push({
        x,
        y,
        radius: 12 + seededRandom(seed) * 8,
        color: CORAL_COLORS[Math.floor(seededRandom(seed + 1) * CORAL_COLORS.length)],
        kind: CORAL_KINDS[Math.floor(seededRandom(seed + 2) * CORAL_KINDS.length)],
        angle,
        seed,
      })
    }

    for (let x = 0; x < width; x += 30) {
      pushPiece(x + 15, 15, x, Math.PI)
      pushPiece(x + 15, height - 15, x + 1000, 0)
    }
    for (let y = 30; y < height - 30; y += 30) {
      pushPiece(15, y + 15, y + 2000, Math.PI / 2)
      pushPiece(width - 15, y + 15, y + 3000, -Math.PI / 2)
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
    drawSubmarine(ctx, { scale })
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
    let cancelled = false

    const registerBlocks = (Blockly: any) => {
      defineDrivetrainBlocks(Blockly)
      defineMagnetBlocks(Blockly)
      defineDrawingBlocks(Blockly)
      defineSensingBlocks(Blockly)
      defineConsoleBlocks(Blockly)
      defineLogicBlocks(Blockly)
      defineOperatorsBlocks(Blockly)
      defineSwitchBlocks(Blockly)
      installVexBlockContextMenu(Blockly)
      ;(window as any).__vexBlockToPython = (block: any) => blockToPythonSnippet(block)
    }

    if (window.Blockly) {
      registerBlocks(window.Blockly)
      setBlocklyLoaded(true)
      return
    }

    void (async () => {
      try {
        // Loaded on demand so Blockly stays out of the initial bundle.
        const [core, generator] = await Promise.all([import("blockly"), import("blockly/javascript")])
        if (cancelled) return

        // The ESM namespace is frozen, so expose a writable facade that also
        // carries `.JavaScript` the way the old UMD global did.
        const Blockly = Object.assign(Object.create(null), core, {
          JavaScript: generator.javascriptGenerator,
        })

        window.Blockly = Blockly
        registerBlocks(Blockly)
        setBlocklyLoaded(true)
      } catch (error) {
        if (cancelled) return
        console.error("Failed to load Blockly:", error)
        setBlocklyLoadError(error instanceof Error ? error.message : "Unknown error")
      }
    })()

    return () => {
      cancelled = true
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
      whenStartedBlock.setDeletable(true)
      whenStartedBlock.setMovable(true)
      ensureBlocklyWidgetDivReady()
    }, 100)
  }, [blocklyLoaded, workspace])

  useEffect(() => {
    if (!blocklyLoaded) return
    ensureBlocklyWidgetDivReady()
    const observer = new MutationObserver(() => ensureBlocklyWidgetDivReady())
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [blocklyLoaded])

  // Combined effect for handling field clicks across all relevant blocks
  useEffect(() => {
    if (!workspace || !blocklyLoaded) return


    /** Only these fields open custom angle/distance pickers; all other fields use Blockly's inline editor. */
    const PICKER_FIELDS: Record<string, string> = {
      turn_degrees: "DEGREES",
      turn_to_rotation: "ROTATION",
      set_drive_rotation: "ROTATION",
      turn_to_heading: "HEADING",
      set_drive_heading: "HEADING",
      drive_distance: "DISTANCE",
    }

    const openCustomPicker = (e: PointerEvent) => {
      const target = e.target as Element
      if (isBlocklyFieldEditorTarget(target)) return

      const blockSvg = target.closest(".blocklyDraggable")
      if (!blockSvg) return

      const blockId = blockSvg.getAttribute("data-id")
      if (!blockId) return

      const block = workspace.getBlockById(blockId)
      if (!block) return

      const fieldName = PICKER_FIELDS[block.type]
      if (!fieldName) return

      const fieldGroup = target.closest(".blocklyEditableText")
      if (!fieldGroup) return

      const textElement = fieldGroup.querySelector("text")
      const fieldValue = textElement?.textContent || ""

      const isNumberField = /^-?\d+(\.\d+)?$/.test(fieldValue.trim())
      const hasDropdown = fieldGroup.querySelector(".blocklyDropdownRect") !== null

      if (hasDropdown || !isNumberField) return

      const currentVal = block.getFieldValue(fieldName)
      if (fieldValue.trim() !== String(currentVal).trim()) return

      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      dismissBlocklyFieldEditors()

      blocklyPickerRef.current = { blockId: block.id, fieldName }

      const blockType = block.type
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
          { kind: "block", type: "math_number" },
          flyoutBlockWithNumberShadows("math_arithmetic", ["A", "B"]),
          flyoutBlockWithNumberShadows("compare", ["A", "B"]),
          { kind: "block", type: "boolean_and" },
          { kind: "block", type: "boolean_or" },
          { kind: "block", type: "boolean_not" },
          { kind: "block", type: "text_string" },
          flyoutBlockWithNumberShadows("range_compare", ["A", "B", "C"]),
          { kind: "block", type: "random_int" },
          flyoutBlockWithNumberShadows("round_number", ["NUM", "PLACES"], { PLACES: 0 }),
          flyoutBlockWithNumberShadows("math_function", ["NUM"]),
          flyoutBlockWithNumberShadows("atan2_function", ["X", "Y"], { X: 1, Y: 1 }),
          flyoutBlockWithNumberShadows("modulo", ["A", "B"], { A: 1, B: 1 }),
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

    // Draw coral borders along all edges. The rubble bed is a separate pass so
    // neighbouring colonies fuse into one ledge.
    drawReefBed(ctx, coralPieces)
    coralPieces.forEach((piece) => drawCoralPiece(ctx, piece))

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
      const { x: rx, y: ry, rotation: rrot } = robotState
      const trashMm = nearestTrashInFrontMm(rx, ry, rrot, trashItems, DISTANCE_SENSOR_MAX_MM)
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

    if (showRuler) {
      drawFieldRulerOverlay(ctx, width, height)
    }
  }, [drawRobot, robotState, playgroundState.isMaximized, trashItems, coralPieces, penTrail, isRunning, showRuler])

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
      // Only an energized magnet extends reach; previously the bare item radius
      // counted as a magnet radius even with the magnet off.
      const magnetRadius = magnetRange > 0 ? magnetRange + 15 * scale * trash.scale : 0

      if (distance < pickupRadius || distance < magnetRadius) {
        collectedCount++
        return { ...trash, isCollected: true }
      }
      return trash
    })

    if (collectedCount > 0) {
      syncTrashItems(updatedTrash)
      setGameState((prev) => ({
        ...prev,
        trashCollected: prev.trashCollected + collectedCount,
      }))
    }
  }, [robotState.x, robotState.y, playgroundState.isMaximized, trashItems, syncTrashItems])

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

    syncTrashItems(items)
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
  }, [playgroundState.isMaximized, coralPieces, syncTrashItems])

  const endMission = useCallback((reason: MissionEndReason, opts?: { runError?: string; gameLost?: boolean }) => {
    // Unwind the block program too, otherwise it keeps driving after game over.
    stopRequestedRef.current = true
    cancelRobotAnimation()
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
  }, [cancelRobotAnimation])

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
    if (!playgroundState.isVisible || playgroundState.isMinimized) return

    const timer = setTimeout(() => {
      drawPlayground()
      drawRobot()
    }, 50)
    return () => clearTimeout(timer)
  }, [playgroundState.isVisible, playgroundState.isMinimized, drawPlayground, drawRobot])

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

      const { w: canvasW, h: canvasH } = getPlaygroundCanvasSize(playgroundState.isMaximized)

      const settle = () => {
        animationCancelRef.current = null
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = null
        }
        resolve()
      }

      // `stop driving` and mission end call this so the awaiting program resumes
      // instead of hanging on a promise that would never settle.
      animationCancelRef.current = settle

      /** Commit a frame: refs and pen first, then a pure state update. */
      const commit = (x: number, y: number, rotation: number) => {
        const clamped = clampRobotPosition(x, y, canvasW, canvasH)
        if (clamped.x !== lastPoint.x || clamped.y !== lastPoint.y) {
          recordPenSegment(lastPoint, { x: clamped.x, y: clamped.y })
          lastPoint = { x: clamped.x, y: clamped.y }
        }
        robotStateRef.current = { x: clamped.x, y: clamped.y, rotation }
        setRobotState((prev) => ({ ...prev, x: clamped.x, y: clamped.y, rotation }))
      }

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easeProgress = 1 - Math.pow(1 - progress, 3) // Ease-out cubic

        const current = { ...robotStateRef.current }
        if (targetState.x !== undefined) {
          current.x = startState.x + (targetState.x - startState.x) * easeProgress
        }
        if (targetState.y !== undefined) {
          current.y = startState.y + (targetState.y - startState.y) * easeProgress
        }
        if (targetState.rotation !== undefined) {
          const delta = shortestRotationDelta(startState.rotation, targetState.rotation)
          current.rotation = normalizeDegrees(startState.rotation + delta * easeProgress)
        }
        commit(current.x, current.y, current.rotation)

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
          return
        }

        // Land exactly on the target so repeated moves do not accumulate drift.
        commit(
          targetState.x ?? current.x,
          targetState.y ?? current.y,
          targetState.rotation ?? current.rotation,
        )
        settle()
      }

      animationRef.current = requestAnimationFrame(animate)
    })
  }

  const getPythonCode = useCallback(() => generatePythonProgram(workspace), [workspace])

  const handleRun = async () => {
    // `isRunning` can already be false while a stopped program is still unwinding,
    // so gate on the ref to avoid two programs driving the same robot.
    if (!workspace || !window.Blockly || programActiveRef.current) return

    programActiveRef.current = true
    stopRequestedRef.current = false
    isRunningRef.current = true
    setIsRunning(true)
    setPenTrail([])
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
    const jsGen = Blockly.JavaScript
    if (typeof jsGen.init === "function") {
      jsGen.init(workspace)
    }
    const code = generateWhenStartedJavaScript(workspace, jsGen)
    // `when_bumper` stacks are separate hats, so they are collected and polled
    // alongside the main program rather than inlined into it.
    const bumperEvents = workspace
      .getAllBlocks(false)
      .filter((b: { type: string }) => b.type === "when_bumper")
      .map((b: any) => ({
        bumper: b.getFieldValue("BUMPER"),
        state: b.getFieldValue("STATE"),
        body: jsGen.statementToCode(b, "DO"),
      }))
      .filter((handler: { body: string }) => handler.body.trim().length > 0)
    if (typeof jsGen.finish === "function") {
      jsGen.finish(workspace)
    }


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

    /** Print precision applies to numeric values only; text passes through. */
    const formatPrint = (value: unknown): string => {
      if (typeof value === "boolean") return value ? "true" : "false"
      const raw = typeof value === "string" ? value : String(value)
      if (raw.trim() === "") return raw
      const asNum = Number(raw)
      if (!Number.isFinite(asNum)) return raw
      const precision = runtimeRef.current.printPrecision
      const decimals = Math.max(0, Math.round(-Math.log10(precision > 0 ? precision : 1)))
      return asNum.toFixed(decimals)
    }

    /** VEX `print` writes into the current row; only the cursor block advances it. */
    const appendConsole = (value: unknown) => {
      const chunk = formatPrint(value)
      const color = PRINT_COLORS[runtimeRef.current.printColor] ?? PRINT_COLORS.black
      setConsoleLines((prev) => {
        if (prev.length === 0) return [{ text: chunk, color }]
        const next = prev.slice()
        const last = next[next.length - 1]
        next[next.length - 1] = { text: last.text + chunk, color }
        return next
      })
    }

    const nextConsoleRow = () => {
      setConsoleLines((prev) => [...prev, { text: "", color: PRINT_COLORS.black }])
    }

    /** Runtime/system messages always get their own row. */
    const pushConsoleLine = (text: string, color = PRINT_COLORS.black) => {
      setConsoleLines((prev) => [...prev, { text, color }])
    }

    /** Generated code has no early return, so unwind via throw at each await. */
    const throwIfStopped = () => {
      if (stopRequestedRef.current) throw new ProgramStopped()
    }

    // Serialize drivetrain motion so concurrent when_started threads queue
    // instead of fighting over the same animation.
    let motionQueue: Promise<void> = Promise.resolve()
    const withMotionLock = async <T,>(fn: () => Promise<T>): Promise<T> => {
      const run = motionQueue.then(fn, fn)
      motionQueue = run.then(
        () => undefined,
        () => undefined,
      )
      return run
    }

    const robotAPI = {
      drive: async (direction: string, distance?: number, unit?: string) =>
        withMotionLock(async () => {
          throwIfStopped()
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
            let timer: ReturnType<typeof setTimeout> | undefined
            const timeout = new Promise<"timeout">((resolve) => {
              timer = setTimeout(() => resolve("timeout"), runtimeRef.current.driveTimeoutSec! * 1000)
            })
            const outcome = await Promise.race([drivePromise.then(() => "done" as const), timeout])
            if (timer) clearTimeout(timer)
            if (outcome === "timeout") {
              // Settle the movement promise; leaving it pending would hang the program.
              cancelRobotAnimation()
              await drivePromise
            }
          } else {
            await drivePromise
          }
          throwIfStopped()
        }),
      turn: async (direction: string, degrees?: number) =>
        withMotionLock(async () => {
          throwIfStopped()
          const multiplier = direction === "right" ? 1 : -1
          const turnAmount = degrees === undefined ? 90 : Number(degrees)
          const targetRotation = normalizeDegrees(robotStateRef.current.rotation + turnAmount * multiplier)
          const delta = Math.abs(shortestRotationDelta(robotStateRef.current.rotation, targetRotation))
          const duration = turnDurationMs(delta, runtimeRef.current.turnVelocity)
          await animateRobotFluid({ rotation: targetRotation }, duration, robotStateRef)
          throwIfStopped()
        }),
      turnToHeading: async (heading: number) =>
        withMotionLock(async () => {
          throwIfStopped()
          const target = normalizeDegrees(Number(heading))
          const delta = Math.abs(shortestRotationDelta(robotStateRef.current.rotation, target))
          const duration = turnDurationMs(delta, runtimeRef.current.turnVelocity)
          await animateRobotFluid({ rotation: target }, duration, robotStateRef)
          runtimeRef.current.heading = target
          throwIfStopped()
        }),
      turnToRotation: async (rotation: number) =>
        withMotionLock(async () => {
          throwIfStopped()
          const target = normalizeDegrees(Number(rotation))
          const delta = Math.abs(shortestRotationDelta(robotStateRef.current.rotation, target))
          const duration = turnDurationMs(delta, runtimeRef.current.turnVelocity)
          await animateRobotFluid({ rotation: target }, duration, robotStateRef)
          throwIfStopped()
        }),
      stopDriving: () => {
        cancelRobotAnimation()
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
        throwIfStopped()
        const ms = Math.max(0, Number(seconds) * 1000)
        await new Promise((resolve) => setTimeout(resolve, Number.isFinite(ms) ? ms : 0))
        // Loop bodies yield through `wait`, so this is where stops get noticed.
        throwIfStopped()
      },
      setCursorNextRow: () => {
        nextConsoleRow()
      },
      clearAllRows: () => {
        setConsoleLines([])
      },
      setPrintPrecision: (precision: number) => {
        const value = Number(precision)
        runtimeRef.current.printPrecision = Number.isFinite(value) && value > 0 ? value : 1
      },
      setPrintColor: (color: string) => {
        runtimeRef.current.printColor = String(color).toLowerCase()
      },
      bumperPressed: (bumper: string) => {
        if (!robotCapabilities.bumperSensor) return false
        const side = bumper.toLowerCase() === "left" ? -1 : 1
        const angleRad = (robotStateRef.current.rotation * Math.PI) / 180
        // VEX bumpers sit on the front corners, so probe forward-and-out rather
        // than straight sideways from the middle of the hull.
        const probeX =
          robotStateRef.current.x +
          Math.sin(angleRad) * BUMPER_FORWARD_PX +
          Math.cos(angleRad) * BUMPER_LATERAL_PX * side
        const probeY =
          robotStateRef.current.y -
          Math.cos(angleRad) * BUMPER_FORWARD_PX +
          Math.sin(angleRad) * BUMPER_LATERAL_PX * side
        return pointHitsCoral(probeX, probeY, coralPieces, BUMPER_CONTACT_MARGIN_PX)
      },
      distanceFoundObject: (sensor: string) => {
        const trash = trashItemsRef.current
        const { x, y, rotation } = robotStateRef.current
        if (sensor === "down") {
          const mm = nearestTrashDistanceMm(x, y, trash)
          if (mm != null && mm < EYE_NEAR_MM) return true
        } else {
          const frontMm = nearestTrashInFrontMm(x, y, rotation, trash, DISTANCE_SENSOR_MAX_MM)
          if (frontMm != null) return true
        }
        const { w, h } = getCanvasSize()
        const dist = raycastToBorder(x, y, rotation, w, h, coralPieces, DISTANCE_SENSOR_MAX_MM)
        return dist < DISTANCE_SENSOR_MAX_MM
      },
      getDistance: (sensor: string, unit: string) => {
        const trash = trashItemsRef.current
        const { x, y, rotation } = robotStateRef.current
        const { w, h } = getCanvasSize()
        const borderMm = raycastToBorder(x, y, rotation, w, h, coralPieces, DISTANCE_SENSOR_MAX_MM)
        const trashMm =
          sensor === "down"
            ? nearestTrashDistanceMm(x, y, trash)
            : nearestTrashInFrontMm(x, y, rotation, trash, DISTANCE_SENSOR_MAX_MM)
        const valueMm = trashMm != null && trashMm < borderMm ? trashMm : borderMm
        return unit === "inches" ? valueMm / 25.4 : valueMm
      },
      eyeIsNear: (sensor: string) => {
        if (!robotCapabilities.eyeSensor) return false
        const { x, y, rotation } = robotStateRef.current
        const eye = sensor === "down" ? "down" : "front"
        return isTrashNearEye(x, y, rotation, trashItemsRef.current, eye, EYE_NEAR_MM)
      },
      eyeDetectsColor: (_sensor: string, color: string) => {
        if (!robotCapabilities.eyeSensor) return false
        const { x, y } = robotStateRef.current
        const trashColors: Record<string, string[]> = {
          red: ["can"],
          green: ["bag"],
          blue: ["bottle"],
          yellow: ["wrapper"],
          orange: ["wrapper"],
          purple: ["bag"],
        }
        const matching = trashColors[color] ?? []
        // Scan every nearby item; returning on the first one meant a matching
        // item was missed whenever a non-matching item happened to be closer.
        for (const t of trashItemsRef.current) {
          if (t.isCollected) continue
          if (Math.hypot(x - t.x, y - t.y) > 40) continue
          if (matching.includes(t.type)) return true
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
        const nearTrash = nearestTrashDistanceMm(x, y, trashItemsRef.current)
        if (nearTrash != null && nearTrash < EYE_NEAR_MM) return 40
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
        stopRequestedRef.current = true
        cancelRobotAnimation()
        if (trashSpawnIntervalRef.current) {
          clearInterval(trashSpawnIntervalRef.current)
          trashSpawnIntervalRef.current = null
        }
        isRunningRef.current = false
        setIsRunning(false)
        // Abandon the rest of the program, including any enclosing forever loop.
        throw new ProgramStopped()
      },
    }

    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

    /** Poll bumper state and fire each `when_bumper` stack on its edge. */
    const startBumperWatchers = () => {
      if (bumperEvents.length === 0) return () => {}

      const watchers = bumperEvents.map((handler: { bumper: string; state: string; body: string }) => ({
        matches: (was: boolean, now: boolean) =>
          handler.state === "pressed" ? now && !was : was && !now,
        run: new AsyncFunction("robot", handler.body) as (robot: unknown) => Promise<void>,
        bumper: handler.bumper,
        was: false,
        busy: false,
      }))

      const timer = setInterval(() => {
        if (stopRequestedRef.current) return
        for (const watcher of watchers) {
          const now = robotAPI.bumperPressed(watcher.bumper)
          const fire = watcher.matches(watcher.was, now)
          watcher.was = now
          // Skip re-entry so a slow handler cannot stack up on itself.
          if (!fire || watcher.busy) continue
          watcher.busy = true
          watcher
            .run(robotAPI)
            .catch((error: unknown) => {
              if (!(error instanceof ProgramStopped)) console.error("Bumper handler error:", error)
            })
            .finally(() => {
              watcher.busy = false
            })
        }
      }, 50)

      return () => clearInterval(timer)
    }

    const stopBumperWatchers = startBumperWatchers()

    try {
      if (!code.trim() && bumperEvents.length === 0) {
        pushConsoleLine("Add blocks inside when started to run your program.")
        return
      }
      if (code.trim()) {
        const execFunc = new AsyncFunction("robot", code)
        await execFunc(robotAPI)
      }
    } catch (error: unknown) {
      // A stop is a normal end of run, not a program error.
      if (!(error instanceof ProgramStopped)) {
        console.error("Execution error:", error)
        const message = error instanceof Error ? error.message : "Program error"
        setGameState((prev) => ({ ...prev, isGameOver: true, gameLost: false, runError: message }))
        pushConsoleLine(`Error: ${message}`, PRINT_COLORS.red)
      }
    } finally {
      stopBumperWatchers()
      stopRequestedRef.current = false
      programActiveRef.current = false
      if (isRunningRef.current) {
        isRunningRef.current = false
        setIsRunning(false)
      }
    }
  }

  const handleReset = () => {
    stopRequestedRef.current = true
    cancelRobotAnimation()
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
    syncTrashItems([])
    setPenTrail([])
    setConsoleLines([])
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
    syncTrashItems([])
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
    setFileMenuOpen(false)

    const Blockly = window.Blockly
    const xml = Blockly.Xml.workspaceToDom(workspace)
    const xmlText = Blockly.Xml.domToText(xml)

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
    const blob = new Blob([xmlText], { type: "text/xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vexcode-project-${stamp}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadWorkspaceFromXmlText = (xmlText: string) => {
    if (!workspace || !window.Blockly) return
    const Blockly = window.Blockly
    const xml = Blockly.utils.xml.textToDom(xmlText)
    workspace.clear()
    Blockly.Xml.domToWorkspace(xml, workspace)
  }

  const handleLoadProject = () => {
    setFileMenuOpen(false)
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !workspace || !window.Blockly) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        loadWorkspaceFromXmlText(String(event.target?.result ?? ""))
      } catch (error) {
        console.error("Failed to load project:", error)
        window.alert("Could not load that project file. Make sure it is a VEXcode XML export.")
      }
    }
    reader.readAsText(file)
  }

  const handleNewProject = () => {
    if (!workspace || !window.Blockly) return
    setFileMenuOpen(false)

    const confirmed = window.confirm(
      "Start a new blank project? Unsaved blocks on this workspace will be cleared.",
    )
    if (!confirmed) return

    workspace.clear()
    const whenStartedBlock = workspace.newBlock("when_started")
    whenStartedBlock.initSvg()
    whenStartedBlock.render()
    whenStartedBlock.moveBy(50, 50)
    whenStartedBlock.setDeletable(true)
    whenStartedBlock.setMovable(true)
  }

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category) // Update selected category state

    if (!workspace || !window.Blockly) return


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
        { kind: "block", type: "math_number" },
        flyoutBlockWithNumberShadows("math_arithmetic", ["A", "B"]),
        flyoutBlockWithNumberShadows("compare", ["A", "B"]),
        { kind: "block", type: "boolean_and" },
        { kind: "block", type: "boolean_or" },
        { kind: "block", type: "boolean_not" },
        { kind: "block", type: "text_string" },
        flyoutBlockWithNumberShadows("range_compare", ["A", "B", "C"]),
        { kind: "block", type: "random_int" },
        flyoutBlockWithNumberShadows("round_number", ["NUM", "PLACES"], { PLACES: 0 }),
        flyoutBlockWithNumberShadows("math_function", ["NUM"]),
        flyoutBlockWithNumberShadows("atan2_function", ["X", "Y"], { X: 1, Y: 1 }),
        flyoutBlockWithNumberShadows("modulo", ["A", "B"], { A: 1, B: 1 }),
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
    setPlaygroundState((prev) => ({
      ...prev,
      isVisible: true,
      isMinimized: false,
    }))
  }

  const handleClosePlayground = () => {
    setPlaygroundState((prev) => ({ ...prev, isVisible: false }))
  }

  const handleMinimizePlayground = () => {
    setPlaygroundState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }))
  }

  const handleMaximizePlayground = () => {
    const fromMaximized = playgroundState.isMaximized
    const toMaximized = !fromMaximized
    const from = getPlaygroundCanvasSize(fromMaximized)
    const to = getPlaygroundCanvasSize(toMaximized)
    const remap = (x: number, y: number) =>
      remapPixelAcrossCanvas(x, y, from.w, from.h, to.w, to.h)

    setRobotState((prev) => {
      const mapped = remap(prev.x, prev.y)
      const clamped = clampRobotPosition(mapped.x, mapped.y, to.w, to.h)
      robotStateRef.current = {
        x: clamped.x,
        y: clamped.y,
        rotation: robotStateRef.current.rotation,
      }
      return { ...prev, x: clamped.x, y: clamped.y }
    })

    setTrashItems((items) => {
      const next = items.map((trash) => {
        const mapped = remap(trash.x, trash.y)
        return { ...trash, x: mapped.x, y: mapped.y }
      })
      trashItemsRef.current = next
      return next
    })

    setPenTrail((segs) =>
      segs.map((seg) => {
        const a = remap(seg.x1, seg.y1)
        const b = remap(seg.x2, seg.y2)
        return { ...seg, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
      }),
    )

    if (runtimeRef.current.lastPenPoint) {
      runtimeRef.current.lastPenPoint = remap(
        runtimeRef.current.lastPenPoint.x,
        runtimeRef.current.lastPenPoint.y,
      )
    }

    setPlaygroundState((prev) => ({ ...prev, isMaximized: toMaximized }))
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
  }, [workspace]) // Removed drawPrediction from dependency array to fix circular dependency

  const handleKeyPress = (e: KeyboardEvent) => {
    if (isTypingInFormField()) return

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
    const trashMm = nearestTrashInFrontMm(
      robotState.x,
      robotState.y,
      robotState.rotation,
      trashItems,
      DISTANCE_SENSOR_MAX_MM,
    )
    const frontDistanceMm = Math.round(trashMm != null && trashMm < borderMm ? trashMm : borderMm)
    const eyeNear =
      robotCapabilities.eyeSensor &&
      isTrashNearEye(robotState.x, robotState.y, robotState.rotation, trashItems, "front", EYE_NEAR_MM)
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

  const canvasSize = getPlaygroundCanvasSize(playgroundState.isMaximized)

  return (
    <div id="vex-app-root" className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div id="vex-header" className="h-14 flex items-center justify-between px-4 text-white">
        <div id="vex-header-left" className="flex items-center gap-4">
          <div
            id="vex-header-brand"
            className="flex h-9 w-9 shrink-0 items-center justify-center"
            title="VEXcode VR Codesign Prototype"
            aria-label="VEXcode VR Codesign Prototype"
          >
            <Bot className="h-5 w-5 text-white" strokeWidth={2.25} aria-hidden />
          </div>
          <div id="vex-header-menu" className="relative flex items-center gap-2 text-sm" ref={fileMenuRef}>
            <input
              ref={fileInputRef}
              id="vex-file-input"
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <Button
              id="vex-btn-file-menu"
              type="button"
              variant="ghost"
              className="hover:bg-white/10 px-3 py-1.5 rounded transition-colors text-white"
              aria-haspopup="menu"
              aria-expanded={fileMenuOpen}
              onClick={() => setFileMenuOpen((open) => !open)}
            >
              File
              <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-80" />
            </Button>
            {fileMenuOpen && (
              <div
                id="vex-file-menu"
                role="menu"
                className="absolute left-0 top-full z-[60] mt-1 min-w-[220px] rounded-md border border-slate-700 bg-slate-900 py-1 text-sm text-slate-100 shadow-xl"
              >
                <button
                  id="vex-file-new"
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  onClick={handleNewProject}
                >
                  <FilePlus className="h-4 w-4 opacity-80" />
                  New blank project
                </button>
                <button
                  id="vex-file-load"
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  onClick={handleLoadProject}
                >
                  <FolderOpen className="h-4 w-4 opacity-80" />
                  Load project from file…
                </button>
                <button
                  id="vex-file-save"
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  onClick={handleSave}
                >
                  <Save className="h-4 w-4 opacity-80" />
                  Save project to file…
                </button>
              </div>
            )}
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
        <div
          id="vex-collab-status"
          className="flex items-center gap-2 rounded-md bg-white/15 px-3 py-1 text-xs"
          title="Everyone on this URL with the same room edits the same blocks in real time."
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              collab.connected ? "bg-green-300" : "bg-amber-300"
            }`}
            aria-hidden
          />
          <span>
            {collab.connected ? (collab.synced ? "Synced" : "Live collab") : "Connecting…"}
            {" · "}
            Room <span className="font-mono font-semibold">{collab.roomId}</span>
            {" · "}
            {1 + collab.peers.length} here
          </span>
          {collab.localName && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: collab.localColor }}
            >
              {collab.localName} (you)
            </span>
          )}
          {collab.peers.length > 0 && (
            <span className="flex items-center gap-1">
              {collab.peers.map((p) => (
                <span
                  key={p.id}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name}
                </span>
              ))}
            </span>
          )}
          {collab.error && (
            <span className="text-amber-200" title={collab.error}>
              — run <span className="font-mono">npm run dev:all</span>
            </span>
          )}
        </div>
        <div id="vex-header-actions" className="flex items-center gap-2">
          {!playgroundState.isVisible && (
            <Button
              id="vex-btn-open-playground"
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleOpenPlayground}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
              aria-label="Open Ocean Reef Cleanup playground window"
            >
              Open Ocean Reef Cleanup
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
      <div id="vex-main" className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Category Icons */}
        <div id="vex-category-sidebar" className="w-20 border-r flex flex-col items-center py-4 gap-1 relative">
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
        <div id="vex-blockly-workspace" ref={blocklyWorkspaceContainerRef} className="flex-1 relative">
          {!blocklyLoaded && (
            <div id="vex-blockly-loading" className="absolute inset-0 flex items-center justify-center">
              {blocklyLoadError ? (
                <p className="text-red-600">Could not load the block editor: {blocklyLoadError}</p>
              ) : (
                <p className="text-gray-600">Loading Blockly...</p>
              )}
            </div>
          )}
          {/* Always keep blocklyDiv mounted, just hide with CSS */}
          <div
            id="vex-blockly-canvas"
            ref={blocklyDivRef}
            className="w-full h-full"
            style={{ display: codeView === "blocks" ? "block" : "none" }}
          />
          {codeView === "blocks" && blocklyLoaded && (
            <BlocklyCollabOverlay peers={collab.peers} workspace={workspace} />
          )}
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
          className="fixed bg-white z-50 transition-all duration-200"
          style={{
            left: `${playgroundState.x}px`,
            top: `${playgroundState.y}px`,
            cursor: playgroundState.isDragging ? "grabbing" : "auto",
            width: playgroundState.isMaximized ? "616px" : "416px",
            height: "auto",
          }}
        >
          <div
            id="vex-playground-header"
            className="playground-header text-white px-4 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing"
          >
            <div id="vex-playground-title-row" className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-white/70" />
              <h3 id="vex-playground-title" className="font-semibold text-sm">
                Coral Reef Cleanup
              </h3>
            </div>
            <div id="vex-playground-window-controls" className="flex items-center gap-1">
              <Button
                id="vex-playground-hide"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                aria-label={playgroundState.isMinimized ? "Show playground" : "Hide playground"}
                title={playgroundState.isMinimized ? "Show playground" : "Hide playground"}
                onClick={(e) => {
                  e.stopPropagation()
                  handleMinimizePlayground()
                }}
              >
                {playgroundState.isMinimized ? <Square className="h-3.5 w-3.5" /> : <Minus className="h-4 w-4" />}
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
                  className="absolute top-2 left-2 right-20 z-10 max-h-20 overflow-y-auto rounded-md bg-black/75 px-2 py-1 font-mono text-[10px] text-green-300 shadow-md"
                >
                  {consoleLines.map((line, i) => (
                    <div key={i} style={{ color: line.color }}>
                      {line.text || "\u00a0"}
                    </div>
                  ))}
                </div>
              )}

              <div
                id="vex-playground-field-toggles"
                className="absolute top-2 right-2 z-20 flex items-center gap-1.5"
              >
                <button
                  id="vex-playground-sensors-toggle"
                  type="button"
                  aria-pressed={showSensors}
                  aria-label={showSensors ? "Hide robot sensors" : "Show robot sensors"}
                  title={showSensors ? "Hide robot sensors" : "Show robot sensors"}
                  className={`flex h-7 w-7 items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition-colors ${
                    showSensors
                      ? "border-sky-400/70 bg-sky-300/85 text-sky-950"
                      : "border-white/50 bg-white/70 text-slate-600 hover:bg-white/90"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowSensors((on) => !on)
                  }}
                >
                  <Gauge className="h-4 w-4" />
                </button>
                <button
                  id="vex-playground-ruler-toggle"
                  type="button"
                  aria-pressed={showRuler}
                  aria-label={showRuler ? "Hide field ruler" : "Show field ruler"}
                  title={showRuler ? "Hide field ruler" : "Show field ruler"}
                  className={`flex h-7 w-7 items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition-colors ${
                    showRuler
                      ? "border-amber-400/70 bg-amber-300/85 text-amber-950"
                      : "border-white/50 bg-white/70 text-slate-600 hover:bg-white/90"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowRuler((on) => !on)
                  }}
                >
                  <Ruler className="h-4 w-4" />
                </button>
              </div>

              <div id="vex-playground-canvas-row" className="flex">
                <canvas
                  id="vex-playground-canvas"
                  ref={canvasRef}
                  width={canvasSize.w}
                  height={canvasSize.h}
                />
              </div>

              <div
                id="vex-playground-status-bar"
                className="px-3 py-3 space-y-2.5"
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
                {showSensors && (
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
                )}
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
          className="fixed bg-white z-50 transition-all duration-200"
          style={{
            left: `${aiAssistantState.x}px`,
            top: `${aiAssistantState.y}px`,
            cursor: aiAssistantState.isDragging ? "grabbing" : "auto",
            width: aiAssistantState.isMaximized ? "420px" : "320px",
          }}
        >
          <div
            id="vex-ai-assistant-header"
            className="ai-assistant-header text-white px-4 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing"
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
          className="fixed bg-white z-50"
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
            className="robot-config-header text-white p-3 flex items-center justify-between cursor-move"
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
/** Picker UI is opened by the workspace pointer listener, not by field validators. */
function defineDrivetrainBlocks(Blockly: any) {
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
            // Nudge the learner to re-check the distance, without a modal that
            // interrupts the drag and swallows the field commit.
            (newValue: string) => {
              if (newValue !== this.getFieldValue("UNIT")) {
                this.setWarningText("Units changed — check your distance value.")
                setTimeout(() => this.setWarningText(null), 4000)
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
        .appendField(new Blockly.FieldNumber(90, 0, 360, 1), "DEGREES")
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
        .appendField(new Blockly.FieldNumber(90, 0, 359, 1), "HEADING")
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
        .appendField(new Blockly.FieldNumber(90, 0, 360, 1), "ROTATION")
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
        .appendField(new Blockly.FieldNumber(0, 0, 359, 1), "HEADING")
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
        .appendField(new Blockly.FieldNumber(0, 0, 360, 1), "ROTATION")
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
      // A hat block with its own mouth: blocks used to snap *below* it, which
      // put them in a stack that the program generator silently discarded.
      this.appendStatementInput("DO").setCheck(null)
      this.setColour("#F4D03F")
      this.setTooltip("Runs the blocks inside whenever the bumper changes state")
    },
  }
  // Handled as an event stack by the runner, not inlined into the main program.
  Blockly.JavaScript.forBlock["when_bumper"] = () => ""

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
          // "1" first so the block's default matches the runtime default.
          new Blockly.FieldDropdown([
            ["1", "1"],
            ["0.1", "0.1"],
            ["0.01", "0.01"],
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
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("wait until")
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
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Snap blocks inside the mouth under repeat — not below the block.")
    },
  }
  Blockly.JavaScript.forBlock["repeat_times"] = (block: any) => {
    const times = block.getFieldValue("TIMES")
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `for(let i = 0; i < ${times}; i++) {\n${statements}${LOOP_YIELD}}\n`
  }

  Blockly.Blocks["forever_loop"] = {
    init: function () {
      this.appendDummyInput().appendField("forever")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Snap blocks inside the forever mouth — not below the block.")
    },
  }
  Blockly.JavaScript.forBlock["forever_loop"] = (block: any) => {
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `while(true) {\n${statements}${LOOP_YIELD}}\n`
  }

  Blockly.Blocks["repeat_until"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("repeat until")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Runs the mouth blocks until the condition is true. Put blocks inside the mouth.")
    },
  }
  Blockly.JavaScript.forBlock["repeat_until"] = (block: any) => {
    const condition = Blockly.JavaScript.valueToCode(block, "CONDITION", Blockly.JavaScript.ORDER_NONE) || "false"
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `while(!(${condition})) {\n${statements}${LOOP_YIELD}}\n`
  }

  Blockly.Blocks["while_loop"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("while")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Repeats the mouth blocks while the condition is true.")
    },
  }
  Blockly.JavaScript.forBlock["while_loop"] = (block: any) => {
    const condition = Blockly.JavaScript.valueToCode(block, "CONDITION", Blockly.JavaScript.ORDER_NONE) || "true"
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `while(${condition}) {\n${statements}${LOOP_YIELD}}\n`
  }

  Blockly.Blocks["if_then"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("if")
      this.appendStatementInput("DO").appendField("then").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Runs the blocks inside then when the condition is true — not blocks snapped below.")
    },
  }
  Blockly.JavaScript.forBlock["if_then"] = (block: any) => {
    const condition = Blockly.JavaScript.valueToCode(block, "CONDITION", Blockly.JavaScript.ORDER_NONE) || "true"
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `if(${condition}) {\n${statements}}\n`
  }

  Blockly.Blocks["if_then_else"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("if")
      this.appendStatementInput("DO").appendField("then").setCheck(null)
      this.appendStatementInput("ELSE").appendField("else").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Use the then and else mouths for each branch — not the notch below the block.")
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
      this.appendValueInput("CONDITION1").setCheck("Boolean").appendField("if")
      this.appendStatementInput("DO1").appendField("then").setCheck(null)
      this.appendValueInput("CONDITION2").setCheck("Boolean").appendField("else if")
      this.appendStatementInput("DO2").appendField("then").setCheck(null)
      this.appendStatementInput("ELSE").appendField("else").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Snap each branch into its then / else mouth.")
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
  Blockly.JavaScript.forBlock["break_block"] = (block: any) => {
    // A bare `break` outside a loop is a syntax error, which would stop the
    // whole program from running rather than just this block.
    for (let parent = block.getSurroundParent?.(); parent; parent = parent.getSurroundParent?.()) {
      if (LOOP_BLOCK_TYPES.has(parent.type)) {
        block.setWarningText?.(null)
        return "break;\n"
      }
    }
    block.setWarningText?.("Put break inside a loop block.")
    return "// break ignored: not inside a loop\n"
  }

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
  Blockly.Blocks["math_number"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(new Blockly.FieldNumber(0), "NUM")
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
      this.setTooltip("Click the number to type a value")
    },
  }
  Blockly.JavaScript.forBlock["math_number"] = (block: any) => {
    const num = Number(block.getFieldValue("NUM"))
    const safe = Number.isFinite(num) ? num : 0
    // A negative literal binds looser than atomic, otherwise `a - -5` can be
    // emitted without the parentheses it needs.
    const order = safe < 0 ? Blockly.JavaScript.ORDER_UNARY_NEGATION : Blockly.JavaScript.ORDER_ATOMIC
    return [String(safe), order]
  }

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
      attachNumberShadow(this, Blockly, "A", 0)
      attachNumberShadow(this, Blockly, "B", 0)
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
      attachNumberShadow(this, Blockly, "A", 0)
      attachNumberShadow(this, Blockly, "B", 0)
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
      attachNumberShadow(this, Blockly, "A", 0)
      attachNumberShadow(this, Blockly, "B", 0)
      attachNumberShadow(this, Blockly, "C", 10)
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
    // `|| fallback` used to turn a legitimate 0 bound into 1.
    const from = Number(block.getFieldValue("FROM"))
    const to = Number(block.getFieldValue("TO"))
    const lo = Math.min(Number.isFinite(from) ? from : 0, Number.isFinite(to) ? to : 0)
    const hi = Math.max(Number.isFinite(from) ? from : 0, Number.isFinite(to) ? to : 0)
    return [`(Math.floor(Math.random() * (${hi} - ${lo} + 1)) + ${lo})`, Blockly.JavaScript.ORDER_ATOMIC]
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
      attachNumberShadow(this, Blockly, "NUM", 0)
      attachNumberShadow(this, Blockly, "PLACES", 0)
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
      attachNumberShadow(this, Blockly, "NUM", 0)
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
      attachNumberShadow(this, Blockly, "X", 1)
      attachNumberShadow(this, Blockly, "Y", 1)
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
      attachNumberShadow(this, Blockly, "A", 1)
      attachNumberShadow(this, Blockly, "B", 1)
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
      this.setTooltip("Runs when the program starts. Duplicate for multi-threaded programs.")
      this.setHelpUrl("")
      this.setDeletable(true)
      this.setMovable(true)
    },
  }

  registerBlockGenerator(Blockly, "when_started", (block: any) => {
    return Blockly.JavaScript.statementToCode(block, "DO")
  })

  // Editable Python snippet produced by “Convert Block to Switch Block”.
  Blockly.Blocks["switch_code"] = {
    init: function () {
      this.appendDummyInput().appendField("switch")
      this.appendDummyInput().appendField(new Blockly.FieldTextInput("# python"), "CODE")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#7CB342")
      this.setTooltip("Switch (Python) block — shown in the Python view; not executed by START")
      this.setHelpUrl("")
    },
  }

  registerBlockGenerator(Blockly, "switch_code", (block: any) => {
    const code = block.getFieldValue("CODE") || ""
    return `// switch: ${String(code).replace(/\n/g, " ")}\n`
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
    return `while (true) {\n${statements_do}${LOOP_YIELD}}\n`
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
      attachNumberShadow(this, Blockly, "TIMES", 10)
    },
  }

  registerBlockGenerator(Blockly, "repeat", (block: any) => {
    const value_times = Blockly.JavaScript.valueToCode(block, "TIMES", Blockly.JavaScript.ORDER_ATOMIC) || "0"
    const statements_do = Blockly.JavaScript.statementToCode(block, "DO")
    return `for (let count = 0; count < ${value_times}; count++) {\n${statements_do}${LOOP_YIELD}}\n`
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
      attachNumberShadow(this, Blockly, "SECONDS", 1)
    },
  }

  registerBlockGenerator(Blockly, "wait", (block: any) => {
    const value_seconds = Blockly.JavaScript.valueToCode(block, "SECONDS", Blockly.JavaScript.ORDER_ATOMIC) || "0"
    return `await robot.wait(${value_seconds});\n`
  })
}

export default BlocklyEditor
