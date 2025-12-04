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
  surveyStep: "main" | "strategy" | "predict" | "fix" | "compare" | "feel" | "partner"
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

interface GameState {
  trashCollected: number
  trashItems: TrashItem[]
  isGameOver: boolean
  isSpawningTrash: boolean
  gameLost: boolean
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

function BlocklyEditor() {
  const blocklyDivRef = useRef<HTMLDivElement>(null)
  const playgroundRef = useRef<HTMLDivElement>(null)
  const aiAssistantRef = useRef<HTMLDivElement>(null)
  const predictCanvasRef = useRef<HTMLCanvasElement>(null) // Added for prediction canvas
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [blocklyLoaded, setBlocklyLoaded] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>("drivetrain")
  const [isRunning, setIsRunning] = useState<boolean>(false) // Added isRunning state
  const animationRef = useRef<number | null>(null) // Added animationRef
  const [deletedBlocks, setDeletedBlocks] = useState<string | null>(null)
  const [showDeletedBlocks, setShowDeletedBlocks] = useState(false)
  const [aiStep, setAiStep] = useState<AIAssistantState["surveyStep"]>("main") // Added aiStep state

  interface CoralPiece {
    x: number
    y: number
    radius: number
    color: string
  }

  const [coralPieces, setCoralPieces] = useState<CoralPiece[]>([])

  const [robotState, setRobotState] = useState<RobotState>({
    x: 200,
    y: 200,
    rotation: 0,
    driveVelocity: 50,
    turnVelocity: 50,
    heading: 0,
  })

  const [playgroundState, setPlaygroundState] = useState<PlaygroundState>({
    x: typeof window !== "undefined" ? window.innerWidth - 520 : 400,
    y: 100,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    isVisible: true,
    isMinimized: false,
    isMaximized: false,
  })

  const [aiAssistantState, setAiAssistantState] = useState<AIAssistantState>({
    x: typeof window !== "undefined" ? window.innerWidth - 420 : 400,
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
    callback?: (angle: number) => void
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
    callback?: (heading: number) => void
  }>({
    isOpen: false,
    heading: 0,
    x: 0,
    y: 0,
  })

  const [distancePickerState, setDistancePickerState] = useState<{
    isOpen: boolean
    distance: number
    x: number
    y: number
    callback?: (distance: number) => void
  }>({
    isOpen: false,
    distance: 200,
    x: 0,
    y: 0,
  })

  const [trashItems, setTrashItems] = useState<TrashItem[]>([])
  const [gameState, setGameState] = useState<GameState>({
    trashCollected: 0,
    gameLost: false,
  })
  const trashSpawnIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const floatAnimationRef = useRef<number | null>(null)

  const initializeCoralBorders = useCallback(() => {
    const width = playgroundState.isMaximized ? 600 : 400
    const height = playgroundState.isMaximized ? 600 : 400
    const coralColors = ["#FF6B6B", "#FF8E8E", "#FFB6B6", "#E67E22", "#FF5252", "#F39C12"]
    const pieces: CoralPiece[] = []

    // Top coral border
    for (let x = 0; x < width; x += 30) {
      pieces.push({
        x: x + 15,
        y: 15,
        radius: 12 + Math.random() * 8,
        color: coralColors[Math.floor(Math.random() * coralColors.length)],
      })
    }

    // Bottom coral border
    for (let x = 0; x < width; x += 30) {
      pieces.push({
        x: x + 15,
        y: height - 15,
        radius: 12 + Math.random() * 8,
        color: coralColors[Math.floor(Math.random() * coralColors.length)],
      })
    }

    // Left coral border
    for (let y = 30; y < height - 30; y += 30) {
      pieces.push({
        x: 15,
        y: y + 15,
        radius: 12 + Math.random() * 8,
        color: coralColors[Math.floor(Math.random() * coralColors.length)],
      })
    }

    // Right coral border
    for (let y = 30; y < height - 30; y += 30) {
      pieces.push({
        x: width - 15,
        y: y + 15,
        radius: 12 + Math.random() * 8,
        color: coralColors[Math.floor(Math.random() * coralColors.length)],
      })
    }

    setCoralPieces(pieces)
  }, [playgroundState.isMaximized])

  // Initialize coral on mount
  useEffect(() => {
    initializeCoralBorders()
  }, [initializeCoralBorders])

  const drawRobot = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !playgroundState.isVisible || playgroundState.isMinimized) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const size = playgroundState.isMaximized ? 600 : 400
    const scale = playgroundState.isMaximized ? 1.5 : 1
    const robotX = robotState.x * scale
    const robotY = robotState.y * scale

    ctx.save()
    ctx.translate(robotX, robotY)
    ctx.rotate((robotState.rotation * Math.PI) / 180)

    // Main submarine body - yellow oval
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

  const handleFieldClick = (e: MouseEvent) => {
    const target = e.target as Element

    // Check if clicked on a field text element
    const fieldGroup = target.closest(".blocklyEditableText")
    if (!fieldGroup) return

    // Get the text content of the clicked field to determine if it's a number
    const textElement = fieldGroup.querySelector("text")
    const fieldValue = textElement?.textContent || ""

    // Check if this is a number field (contains only digits and optional decimal)
    const isNumberField = /^-?\d+(\.\d+)?$/.test(fieldValue.trim())

    // Also check if it's a dropdown by looking for dropdown indicator
    const hasDropdown = fieldGroup.querySelector(".blocklyDropdownRect") !== null

    // If it's a dropdown field or not a number, don't show custom picker
    if (hasDropdown || !isNumberField) return

    // Find the block that contains this field
    const blockSvg = target.closest(".blocklyDraggable")
    if (!blockSvg) return

    const blockId = blockSvg.getAttribute("data-id")
    if (!blockId) return

    const block = workspace.getBlockById(blockId)
    if (!block) return

    const blockType = block.type

    // Check which field was clicked based on the block type and field value
    if (blockType === "turn_degrees") {
      const currentDegrees = block.getFieldValue("DEGREES")
      // Only open if clicked value matches the DEGREES field
      if (fieldValue.trim() === currentDegrees.toString()) {
        setAnglePickerState({
          isOpen: true,
          angle: Number(currentDegrees) || 90,
          x: e.clientX,
          y: e.clientY,
          callback: (val: number) => {
            block.setFieldValue(val.toString(), "DEGREES")
          },
        })
        e.preventDefault()
        e.stopPropagation()
      }
    } else if (blockType === "turn_to_rotation") {
      const currentRotation = block.getFieldValue("ROTATION")
      if (fieldValue.trim() === currentRotation.toString()) {
        setAnglePickerState({
          isOpen: true,
          angle: Number(currentRotation) || 90,
          x: e.clientX,
          y: e.clientY,
          callback: (val: number) => {
            block.setFieldValue(val.toString(), "ROTATION")
          },
        })
        e.preventDefault()
        e.stopPropagation()
      }
    } else if (blockType === "turn_to_heading" || blockType === "set_drive_heading") {
      const currentHeading = block.getFieldValue("HEADING")
      if (fieldValue.trim() === currentHeading.toString()) {
        setCompassPickerState({
          isOpen: true,
          heading: Number(currentHeading) || 0,
          x: e.clientX,
          y: e.clientY,
          callback: (val: number) => {
            block.setFieldValue(val.toString(), "HEADING")
          },
        })
        e.preventDefault()
        e.stopPropagation()
      }
    } else if (blockType === "set_drive_rotation") {
      const currentRotation = block.getFieldValue("ROTATION")
      if (fieldValue.trim() === currentRotation.toString()) {
        setAnglePickerState({
          isOpen: true,
          angle: Number(currentRotation) || 0,
          x: e.clientX,
          y: e.clientY,
          callback: (val: number) => {
            block.setFieldValue(val.toString(), "ROTATION")
          },
        })
        e.preventDefault()
        e.stopPropagation()
      }
    } else if (blockType === "drive_distance") {
      const currentDistance = block.getFieldValue("DISTANCE")
      // Only open slider if clicked on the distance number, not the dropdown
      if (fieldValue.trim() === currentDistance.toString()) {
        setDistancePickerState({
          isOpen: true,
          distance: Number(currentDistance) || 200,
          x: e.clientX,
          y: e.clientY,
          callback: (val: number) => {
            block.setFieldValue(val.toString(), "DISTANCE")
          },
        })
        e.preventDefault()
        e.stopPropagation()
      }
    }
  }

  // Get the workspace's SVG element
  const workspaceSvg = workspace?.getParentSvg() // Use optional chaining here
  useEffect(() => {
    if (workspaceSvg) {
      workspaceSvg.addEventListener("click", handleFieldClick)
    }

    return () => {
      if (workspaceSvg) {
        workspaceSvg.removeEventListener("click", handleFieldClick)
      }
    }
  }, [workspaceSvg]) // Dependency on workspaceSvg

  useEffect(() => {
    if (!workspace || !blocklyLoaded) return // Use ref

    const Blockly = window.Blockly

    // Listen for field clicks by adding a handler to the workspace's SVG
    const handleFieldClick = (e: MouseEvent) => {
      const target = e.target as Element

      // Check if clicked on a field text element
      const fieldGroup = target.closest(".blocklyEditableText")
      if (!fieldGroup) return

      // Get the text content of the clicked field to determine if it's a number
      const textElement = fieldGroup.querySelector("text")
      const fieldValue = textElement?.textContent || ""

      // Check if this is a number field (contains only digits and optional decimal)
      const isNumberField = /^-?\d+(\.\d+)?$/.test(fieldValue.trim())

      // Also check if it's a dropdown by looking for dropdown indicator
      const hasDropdown = fieldGroup.querySelector(".blocklyDropdownRect") !== null

      // If it's a dropdown field or not a number, don't show custom picker
      if (hasDropdown || !isNumberField) return

      // Find the block that contains this field
      const blockSvg = target.closest(".blocklyDraggable")
      if (!blockSvg) return

      const blockId = blockSvg.getAttribute("data-id")
      if (!blockId) return

      const block = workspace.getBlockById(blockId)
      if (!block) return

      const blockType = block.type

      // Check which field was clicked based on the block type and field value
      if (blockType === "turn_degrees") {
        const currentDegrees = block.getFieldValue("DEGREES")
        // Only open if clicked value matches the DEGREES field
        if (fieldValue.trim() === currentDegrees.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentDegrees) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DEGREES")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_heading" || blockType === "set_drive_heading") {
        const currentHeading = block.getFieldValue("HEADING")
        if (fieldValue.trim() === currentHeading.toString()) {
          setCompassPickerState({
            isOpen: true,
            heading: Number(currentHeading) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "HEADING")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "set_drive_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "drive_distance") {
        const currentDistance = block.getFieldValue("DISTANCE")
        // Only open slider if clicked on the distance number, not the dropdown
        if (fieldValue.trim() === currentDistance.toString()) {
          setDistancePickerState({
            isOpen: true,
            distance: Number(currentDistance) || 200,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DISTANCE")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
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
  }, [blocklyLoaded, workspace]) // Dependency on blocklyLoaded and workspace

  useEffect(() => {
    if (!workspace || !blocklyLoaded) return

    const Blockly = window.Blockly

    // Listen for field clicks by adding a handler to the workspace's SVG
    const handleFieldClick = (e: MouseEvent) => {
      const target = e.target as Element

      // Check if clicked on a field text element
      const fieldGroup = target.closest(".blocklyEditableText")
      if (!fieldGroup) return

      // Get the text content of the clicked field to determine if it's a number
      const textElement = fieldGroup.querySelector("text")
      const fieldValue = textElement?.textContent || ""

      // Check if this is a number field (contains only digits and optional decimal)
      const isNumberField = /^-?\d+(\.\d+)?$/.test(fieldValue.trim())

      // Also check if it's a dropdown by looking for dropdown indicator
      const hasDropdown = fieldGroup.querySelector(".blocklyDropdownRect") !== null

      // If it's a dropdown field or not a number, don't show custom picker
      if (hasDropdown || !isNumberField) return

      // Find the block that contains this field
      const blockSvg = target.closest(".blocklyDraggable")
      if (!blockSvg) return

      const blockId = blockSvg.getAttribute("data-id")
      if (!blockId) return

      const block = workspace.getBlockById(blockId)
      if (!block) return

      const blockType = block.type

      // Check which field was clicked based on the block type and field value
      if (blockType === "turn_degrees") {
        const currentDegrees = block.getFieldValue("DEGREES")
        // Only open if clicked value matches the DEGREES field
        if (fieldValue.trim() === currentDegrees.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentDegrees) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DEGREES")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_heading" || blockType === "set_drive_heading") {
        const currentHeading = block.getFieldValue("HEADING")
        if (fieldValue.trim() === currentHeading.toString()) {
          setCompassPickerState({
            isOpen: true,
            heading: Number(currentHeading) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "HEADING")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "set_drive_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "drive_distance") {
        const currentDistance = block.getFieldValue("DISTANCE")
        // Only open slider if clicked on the distance number, not the dropdown
        if (fieldValue.trim() === currentDistance.toString()) {
          setDistancePickerState({
            isOpen: true,
            distance: Number(currentDistance) || 200,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DISTANCE")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
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
  }, [blocklyLoaded, workspace]) // Dependency on blocklyLoaded and workspace

  useEffect(() => {
    if (!workspace || !blocklyLoaded) return

    const Blockly = window.Blockly

    // Listen for field clicks by adding a handler to the workspace's SVG
    const handleFieldClick = (e: MouseEvent) => {
      const target = e.target as Element

      // Check if clicked on a field text element
      const fieldGroup = target.closest(".blocklyEditableText")
      if (!fieldGroup) return

      // Get the text content of the clicked field to determine if it's a number
      const textElement = fieldGroup.querySelector("text")
      const fieldValue = textElement?.textContent || ""

      // Check if this is a number field (contains only digits and optional decimal)
      const isNumberField = /^-?\d+(\.\d+)?$/.test(fieldValue.trim())

      // Also check if it's a dropdown by looking for dropdown indicator
      const hasDropdown = fieldGroup.querySelector(".blocklyDropdownRect") !== null

      // If it's a dropdown field or not a number, don't show custom picker
      if (hasDropdown || !isNumberField) return

      // Find the block that contains this field
      const blockSvg = target.closest(".blocklyDraggable")
      if (!blockSvg) return

      const blockId = blockSvg.getAttribute("data-id")
      if (!blockId) return

      const block = workspace.getBlockById(blockId)
      if (!block) return

      const blockType = block.type

      // Check which field was clicked based on the block type and field value
      if (blockType === "turn_degrees") {
        const currentDegrees = block.getFieldValue("DEGREES")
        // Only open if clicked value matches the DEGREES field
        if (fieldValue.trim() === currentDegrees.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentDegrees) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DEGREES")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_heading" || blockType === "set_drive_heading") {
        const currentHeading = block.getFieldValue("HEADING")
        if (fieldValue.trim() === currentHeading.toString()) {
          setCompassPickerState({
            isOpen: true,
            heading: Number(currentHeading) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "HEADING")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "set_drive_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "drive_distance") {
        const currentDistance = block.getFieldValue("DISTANCE")
        // Only open slider if clicked on the distance number, not the dropdown
        if (fieldValue.trim() === currentDistance.toString()) {
          setDistancePickerState({
            isOpen: true,
            distance: Number(currentDistance) || 200,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DISTANCE")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
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
  }, [blocklyLoaded, workspace]) // Dependency on blocklyLoaded and workspace

  useEffect(() => {
    if (!workspace || !blocklyLoaded) return

    const Blockly = window.Blockly

    // Listen for field clicks by adding a handler to the workspace's SVG
    const handleFieldClick = (e: MouseEvent) => {
      const target = e.target as Element

      // Check if clicked on a field text element
      const fieldGroup = target.closest(".blocklyEditableText")
      if (!fieldGroup) return

      // Get the text content of the clicked field to determine if it's a number
      const textElement = fieldGroup.querySelector("text")
      const fieldValue = textElement?.textContent || ""

      // Check if this is a number field (contains only digits and optional decimal)
      const isNumberField = /^-?\d+(\.\d+)?$/.test(fieldValue.trim())

      // Also check if it's a dropdown by looking for dropdown indicator
      const hasDropdown = fieldGroup.querySelector(".blocklyDropdownRect") !== null

      // If it's a dropdown field or not a number, don't show custom picker
      if (hasDropdown || !isNumberField) return

      // Find the block that contains this field
      const blockSvg = target.closest(".blocklyDraggable")
      if (!blockSvg) return

      const blockId = blockSvg.getAttribute("data-id")
      if (!blockId) return

      const block = workspace.getBlockById(blockId)
      if (!block) return

      const blockType = block.type

      // Check which field was clicked based on the block type and field value
      if (blockType === "turn_degrees") {
        const currentDegrees = block.getFieldValue("DEGREES")
        // Only open if clicked value matches the DEGREES field
        if (fieldValue.trim() === currentDegrees.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentDegrees) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DEGREES")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_heading" || blockType === "set_drive_heading") {
        const currentHeading = block.getFieldValue("HEADING")
        if (fieldValue.trim() === currentHeading.toString()) {
          setCompassPickerState({
            isOpen: true,
            heading: Number(currentHeading) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "HEADING")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "set_drive_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "drive_distance") {
        const currentDistance = block.getFieldValue("DISTANCE")
        // Only open slider if clicked on the distance number, not the dropdown
        if (fieldValue.trim() === currentDistance.toString()) {
          setDistancePickerState({
            isOpen: true,
            distance: Number(currentDistance) || 200,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DISTANCE")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
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
  }, [blocklyLoaded, workspace]) // Dependency on blocklyLoaded and workspace

  useEffect(() => {
    if (!workspace || !blocklyLoaded) return

    const Blockly = window.Blockly

    // Listen for field clicks by adding a handler to the workspace's SVG
    const handleFieldClick = (e: MouseEvent) => {
      const target = e.target as Element

      // Check if clicked on a field text element
      const fieldGroup = target.closest(".blocklyEditableText")
      if (!fieldGroup) return

      // Get the text content of the clicked field to determine if it's a number
      const textElement = fieldGroup.querySelector("text")
      const fieldValue = textElement?.textContent || ""

      // Check if this is a number field (contains only digits and optional decimal)
      const isNumberField = /^-?\d+(\.\d+)?$/.test(fieldValue.trim())

      // Also check if it's a dropdown by looking for dropdown indicator
      const hasDropdown = fieldGroup.querySelector(".blocklyDropdownRect") !== null

      // If it's a dropdown field or not a number, don't show custom picker
      if (hasDropdown || !isNumberField) return

      // Find the block that contains this field
      const blockSvg = target.closest(".blocklyDraggable")
      if (!blockSvg) return

      const blockId = blockSvg.getAttribute("data-id")
      if (!blockId) return

      const block = workspace.getBlockById(blockId)
      if (!block) return

      const blockType = block.type

      // Check which field was clicked based on the block type and field value
      if (blockType === "turn_degrees") {
        const currentDegrees = block.getFieldValue("DEGREES")
        // Only open if clicked value matches the DEGREES field
        if (fieldValue.trim() === currentDegrees.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentDegrees) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DEGREES")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_heading" || blockType === "set_drive_heading") {
        const currentHeading = block.getFieldValue("HEADING")
        if (fieldValue.trim() === currentHeading.toString()) {
          setCompassPickerState({
            isOpen: true,
            heading: Number(currentHeading) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "HEADING")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "set_drive_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "drive_distance") {
        const currentDistance = block.getFieldValue("DISTANCE")
        // Only open slider if clicked on the distance number, not the dropdown
        if (fieldValue.trim() === currentDistance.toString()) {
          setDistancePickerState({
            isOpen: true,
            distance: Number(currentDistance) || 200,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DISTANCE")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
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
  }, [blocklyLoaded, workspace]) // Dependency on blocklyLoaded and workspace

  useEffect(() => {
    if (!workspace || !blocklyLoaded) return

    const Blockly = window.Blockly

    // Listen for field clicks by adding a handler to the workspace's SVG
    const handleFieldClick = (e: MouseEvent) => {
      const target = e.target as Element

      // Check if clicked on a field text element
      const fieldGroup = target.closest(".blocklyEditableText")
      if (!fieldGroup) return

      // Get the text content of the clicked field to determine if it's a number
      const textElement = fieldGroup.querySelector("text")
      const fieldValue = textElement?.textContent || ""

      // Check if this is a number field (contains only digits and optional decimal)
      const isNumberField = /^-?\d+(\.\d+)?$/.test(fieldValue.trim())

      // Also check if it's a dropdown by looking for dropdown indicator
      const hasDropdown = fieldGroup.querySelector(".blocklyDropdownRect") !== null

      // If it's a dropdown field or not a number, don't show custom picker
      if (hasDropdown || !isNumberField) return

      // Find the block that contains this field
      const blockSvg = target.closest(".blocklyDraggable")
      if (!blockSvg) return

      const blockId = blockSvg.getAttribute("data-id")
      if (!blockId) return

      const block = workspace.getBlockById(blockId)
      if (!block) return

      const blockType = block.type

      // Check which field was clicked based on the block type and field value
      if (blockType === "turn_degrees") {
        const currentDegrees = block.getFieldValue("DEGREES")
        // Only open if clicked value matches the DEGREES field
        if (fieldValue.trim() === currentDegrees.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentDegrees) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DEGREES")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_heading" || blockType === "set_drive_heading") {
        const currentHeading = block.getFieldValue("HEADING")
        if (fieldValue.trim() === currentHeading.toString()) {
          setCompassPickerState({
            isOpen: true,
            heading: Number(currentHeading) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "HEADING")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "set_drive_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "drive_distance") {
        const currentDistance = block.getFieldValue("DISTANCE")
        // Only open slider if clicked on the distance number, not the dropdown
        if (fieldValue.trim() === currentDistance.toString()) {
          setDistancePickerState({
            isOpen: true,
            distance: Number(currentDistance) || 200,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DISTANCE")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
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
  }, [blocklyLoaded, workspace]) // Dependency on blocklyLoaded and workspace

  useEffect(() => {
    if (!workspace || !blocklyLoaded) return

    const Blockly = window.Blockly

    // Listen for field clicks by adding a handler to the workspace's SVG
    const handleFieldClick = (e: MouseEvent) => {
      const target = e.target as Element

      // Check if clicked on a field text element
      const fieldGroup = target.closest(".blocklyEditableText")
      if (!fieldGroup) return

      // Get the text content of the clicked field to determine if it's a number
      const textElement = fieldGroup.querySelector("text")
      const fieldValue = textElement?.textContent || ""

      // Check if this is a number field (contains only digits and optional decimal)
      const isNumberField = /^-?\d+(\.\d+)?$/.test(fieldValue.trim())

      // Also check if it's a dropdown by looking for dropdown indicator
      const hasDropdown = fieldGroup.querySelector(".blocklyDropdownRect") !== null

      // If it's a dropdown field or not a number, don't show custom picker
      if (hasDropdown || !isNumberField) return

      // Find the block that contains this field
      const blockSvg = target.closest(".blocklyDraggable")
      if (!blockSvg) return

      const blockId = blockSvg.getAttribute("data-id")
      if (!blockId) return

      const block = workspace.getBlockById(blockId)
      if (!block) return

      const blockType = block.type

      // Check which field was clicked based on the block type and field value
      if (blockType === "turn_degrees") {
        const currentDegrees = block.getFieldValue("DEGREES")
        // Only open if clicked value matches the DEGREES field
        if (fieldValue.trim() === currentDegrees.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentDegrees) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DEGREES")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_heading" || blockType === "set_drive_heading") {
        const currentHeading = block.getFieldValue("HEADING")
        if (fieldValue.trim() === currentHeading.toString()) {
          setCompassPickerState({
            isOpen: true,
            heading: Number(currentHeading) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "HEADING")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "set_drive_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "drive_distance") {
        const currentDistance = block.getFieldValue("DISTANCE")
        // Only open slider if clicked on the distance number, not the dropdown
        if (fieldValue.trim() === currentDistance.toString()) {
          setDistancePickerState({
            isOpen: true,
            distance: Number(currentDistance) || 200,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DISTANCE")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
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
  }, [blocklyLoaded, workspace]) // Dependency on blocklyLoaded and workspace

  useEffect(() => {
    if (!workspace || !blocklyLoaded) return

    const Blockly = window.Blockly

    // Listen for field clicks by adding a handler to the workspace's SVG
    const handleFieldClick = (e: MouseEvent) => {
      const target = e.target as Element

      // Check if clicked on a field text element
      const fieldGroup = target.closest(".blocklyEditableText")
      if (!fieldGroup) return

      // Get the text content of the clicked field to determine if it's a number
      const textElement = fieldGroup.querySelector("text")
      const fieldValue = textElement?.textContent || ""

      // Check if this is a number field (contains only digits and optional decimal)
      const isNumberField = /^-?\d+(\.\d+)?$/.test(fieldValue.trim())

      // Also check if it's a dropdown by looking for dropdown indicator
      const hasDropdown = fieldGroup.querySelector(".blocklyDropdownRect") !== null

      // If it's a dropdown field or not a number, don't show custom picker
      if (hasDropdown || !isNumberField) return

      // Find the block that contains this field
      const blockSvg = target.closest(".blocklyDraggable")
      if (!blockSvg) return

      const blockId = blockSvg.getAttribute("data-id")
      if (!blockId) return

      const block = workspace.getBlockById(blockId)
      if (!block) return

      const blockType = block.type

      // Check which field was clicked based on the block type and field value
      if (blockType === "turn_degrees") {
        const currentDegrees = block.getFieldValue("DEGREES")
        // Only open if clicked value matches the DEGREES field
        if (fieldValue.trim() === currentDegrees.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentDegrees) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DEGREES")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_heading" || blockType === "set_drive_heading") {
        const currentHeading = block.getFieldValue("HEADING")
        if (fieldValue.trim() === currentHeading.toString()) {
          setCompassPickerState({
            isOpen: true,
            heading: Number(currentHeading) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "HEADING")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "set_drive_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "drive_distance") {
        const currentDistance = block.getFieldValue("DISTANCE")
        // Only open slider if clicked on the distance number, not the dropdown
        if (fieldValue.trim() === currentDistance.toString()) {
          setDistancePickerState({
            isOpen: true,
            distance: Number(currentDistance) || 200,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DISTANCE")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
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
  }, [blocklyLoaded, workspace]) // Dependency on blocklyLoaded and workspace

  useEffect(() => {
    if (!workspace || !blocklyLoaded) return

    const Blockly = window.Blockly

    // Listen for field clicks by adding a handler to the workspace's SVG
    const handleFieldClick = (e: MouseEvent) => {
      const target = e.target as Element

      // Check if clicked on a field text element
      const fieldGroup = target.closest(".blocklyEditableText")
      if (!fieldGroup) return

      // Get the text content of the clicked field to determine if it's a number
      const textElement = fieldGroup.querySelector("text")
      const fieldValue = textElement?.textContent || ""

      // Check if this is a number field (contains only digits and optional decimal)
      const isNumberField = /^-?\d+(\.\d+)?$/.test(fieldValue.trim())

      // Also check if it's a dropdown by looking for dropdown indicator
      const hasDropdown = fieldGroup.querySelector(".blocklyDropdownRect") !== null

      // If it's a dropdown field or not a number, don't show custom picker
      if (hasDropdown || !isNumberField) return

      // Find the block that contains this field
      const blockSvg = target.closest(".blocklyDraggable")
      if (!blockSvg) return

      const blockId = blockSvg.getAttribute("data-id")
      if (!blockId) return

      const block = workspace.getBlockById(blockId)
      if (!block) return

      const blockType = block.type

      // Check which field was clicked based on the block type and field value
      if (blockType === "turn_degrees") {
        const currentDegrees = block.getFieldValue("DEGREES")
        // Only open if clicked value matches the DEGREES field
        if (fieldValue.trim() === currentDegrees.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentDegrees) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DEGREES")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 90,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "turn_to_heading" || blockType === "set_drive_heading") {
        const currentHeading = block.getFieldValue("HEADING")
        if (fieldValue.trim() === currentHeading.toString()) {
          setCompassPickerState({
            isOpen: true,
            heading: Number(currentHeading) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "HEADING")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "set_drive_rotation") {
        const currentRotation = block.getFieldValue("ROTATION")
        if (fieldValue.trim() === currentRotation.toString()) {
          setAnglePickerState({
            isOpen: true,
            angle: Number(currentRotation) || 0,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "ROTATION")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (blockType === "drive_distance") {
        const currentDistance = block.getFieldValue("DISTANCE")
        // Only open slider if clicked on the distance number, not the dropdown
        if (fieldValue.trim() === currentDistance.toString()) {
          setDistancePickerState({
            isOpen: true,
            distance: Number(currentDistance) || 200,
            x: e.clientX,
            y: e.clientY,
            callback: (val: number) => {
              block.setFieldValue(val.toString(), "DISTANCE")
            },
          })
          e.preventDefault()
          e.stopPropagation()
        }
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
  }, [blocklyLoaded, workspace]) // Dependency on blocklyLoaded and workspace

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
  }, [selectedCategory, workspace, blocklyLoaded])

  // Redraw playground when state changes
  const drawPlayground = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = playgroundState.isMaximized ? 600 : 400
    const height = playgroundState.isMaximized ? 600 : 400

    // Draw sandy ocean floor background
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, "#f4d6a2") // Light sandy color
    gradient.addColorStop(0.5, "#e8c18e")
    gradient.addColorStop(1, "#d4a76a") // Darker sand
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Add sand texture with dots
    ctx.fillStyle = "rgba(180, 140, 90, 0.15)"
    for (let i = 0; i < 200; i++) {
      ctx.beginPath()
      ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 2, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw coral borders along all edges
    // Using the pre-calculated coralPieces state
    coralPieces.forEach((piece) => {
      ctx.fillStyle = piece.color
      ctx.beginPath()
      ctx.arc(piece.x, piece.y, piece.radius, 0, Math.PI * 2) // Apply scale here
      ctx.fill()
    })

    // Draw floating trash items
    trashItems.forEach((trash) => {
      if (trash.isCollected) return

      const trashX = trash.x * (playgroundState.isMaximized ? 1.5 : 1)
      const trashY = (trash.y + Math.sin(trash.floatOffset) * 3) * (playgroundState.isMaximized ? 1.5 : 1)
      const trashScale = trash.scale * (playgroundState.isMaximized ? 1.5 : 1)

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

    // Draw robot
    drawRobot()
  }, [drawRobot, robotState, playgroundState.isMaximized, trashItems, coralPieces]) // Added coralPieces dependency

  const checkCoralCollision = useCallback(
    (x: number, y: number): boolean => {
      const canvasSize = playgroundState.isMaximized ? 600 : 400
      const scale = playgroundState.isMaximized ? 1.5 : 1
      const robotSize = 30 * scale // Use the updated robot size for collision

      // Check against pre-calculated coral pieces
      for (const piece of coralPieces) {
        const distance = Math.sqrt(Math.pow(x * scale - piece.x * scale, 2) + Math.pow(y * scale - piece.y * scale, 2))
        if (distance < robotSize / 2 + piece.radius * scale) {
          return true
        }
      }
      return false
    },
    [playgroundState.isMaximized, coralPieces], // Added coralPieces dependency
  )

  const checkTrashCollision = useCallback(() => {
    const scale = playgroundState.isMaximized ? 1.5 : 1
    const robotSize = 30 * scale // Use the updated robot size for collision

    setGameState((prev) => {
      let collected = 0
      const updatedTrash = trashItems.map((trash) => {
        if (trash.isCollected) return trash

        const dx = robotState.x - trash.x
        const dy = robotState.y - trash.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Collision detection: robot radius + trash radius (approximated)
        if (distance < robotSize * 0.5 + 15 * scale * trash.scale) {
          collected++
          return { ...trash, isCollected: true }
        }
        return trash
      })

      if (collected > 0) {
        return {
          ...prev,
          trashItems: updatedTrash,
          trashCollected: prev.trashCollected + collected,
        }
      }
      return prev
    })
  }, [robotState.x, robotState.y, playgroundState.isMaximized, trashItems])

  // Around line 1315, replace spawnTrash function
  const startSpawningTrash = useCallback(() => {
    if (trashSpawnIntervalRef.current) {
      clearInterval(trashSpawnIntervalRef.current)
    }

    setGameState((prev) => ({ ...prev, isSpawningTrash: true }))

    const spawnTrash = () => {
      const canvasWidth = playgroundState.isMaximized ? 600 : 400
      const canvasHeight = playgroundState.isMaximized ? 600 : 400
      const margin = 60

      setTrashItems((prev) => {
        if (prev.length >= 20) return prev

        const types: ("bottle" | "can" | "wrapper" | "bag")[] = ["bottle", "can", "wrapper", "bag"]
        const newTrash: TrashItem = {
          id: Date.now() + Math.random(),
          x: margin + Math.random() * (canvasWidth - margin * 2),
          y: margin + Math.random() * (canvasHeight - margin * 2), // Random position instead of top
          type: types[Math.floor(Math.random() * types.length)],
          scale: 0, // Start at 0 scale for expand animation
          floatOffset: Math.random() * Math.PI * 2,
          isCollected: false,
        }

        return [...prev, newTrash]
      })
    }

    spawnTrash()
    trashSpawnIntervalRef.current = setInterval(spawnTrash, 2000)
  }, [playgroundState.isMaximized])

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

    if (checkCoralCollision(robotState.x, robotState.y) && isRunning) {
      setIsRunning(false)
      setGameState((prev) => ({ ...prev, isGameOver: true, gameLost: true }))
      if (trashSpawnIntervalRef.current) {
        clearInterval(trashSpawnIntervalRef.current)
        trashSpawnIntervalRef.current = null
      }
      if (floatAnimationRef.current) {
        cancelAnimationFrame(floatAnimationRef.current)
      }
    }
  }, [robotState.x, robotState.y, checkTrashCollision, checkCoralCollision, isRunning])

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

  const animateRobotFluid = (targetState: Partial<RobotState>, duration = 500) => {
    return new Promise<void>((resolve) => {
      const startTime = performance.now()
      const startState = { ...robotState }

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
            newState.rotation = startState.rotation + (targetState.rotation - startState.rotation) * easeProgress
          }
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
            return finalState
          })
          resolve()
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    })
  }

  const handleRun = async () => {
    if (!workspace || !window.Blockly || isRunning) return

    setIsRunning(true)
    setGameState((prev) => ({ ...prev, isGameOver: false, gameLost: false })) // Reset game over state
    startSpawningTrash()

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
          const pixels = 200 // Default distance in pixels
          const angleRad = (robotState.rotation * Math.PI) / 180
          const targetX = robotState.x + pixels * multiplier * Math.sin(angleRad)
          const targetY = robotState.y + pixels * multiplier * Math.cos(angleRad)
          await animateRobotFluid({ x: targetX, y: targetY }, 1000)
        } else {
          // Convert distance to pixels based on unit
          const pixels = unit === "mm" ? distance * 0.133333 : distance // Approximately 100mm = 13.33 pixels
          const angleRad = (robotState.rotation * Math.PI) / 180
          const targetX = robotState.x + pixels * multiplier * Math.sin(angleRad)
          const targetY = robotState.y + pixels * multiplier * Math.cos(angleRad)
          await animateRobotFluid({ x: targetX, y: targetY }, 500)
        }
      },
      turn: async (direction: string, degrees?: number) => {
        const multiplier = direction === "right" ? 1 : -1
        if (degrees === undefined) {
          // Default turn of 90 degrees
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
          animationRef.current = null
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
        return false // Placeholder
      },
      distanceFoundObject: (sensor: string) => {
        console.log(`Checking if ${sensor} found object`)
        return false // Placeholder
      },
      getDistance: (sensor: string, unit: string) => {
        console.log(`Getting distance from ${sensor} in ${unit}`)
        return 0 // Placeholder
      },
      eyeIsNear: (sensor: string) => {
        console.log(`Checking if ${sensor} is near object`)
        return false // Placeholder
      },
      eyeDetectsColor: (sensor: string, color: string) => {
        console.log(`Checking if ${sensor} detects ${color}`)
        return false // Placeholder
      },
      eyeBrightness: (sensor: string) => {
        console.log(`Getting brightness from ${sensor}`)
        return 50 // Placeholder
      },
      getPosition: (axis: string, unit: string) => {
        console.log(`Getting position ${axis} in ${unit}`)
        if (axis === "x") return robotState.x
        if (axis === "y") return robotState.y
        return 0 // Default
      },
      getPositionAngle: () => {
        console.log("Getting position angle")
        return robotState.rotation
      },
      stop: () => {
        // Added stop function for stop_project block
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = null
        }
        if (trashSpawnIntervalRef.current) {
          clearInterval(trashSpawnIntervalRef.current)
          trashSpawnIntervalRef.current = null
        }
        setIsRunning(false)
      },
    }

    try {
      const transformedCode = code.replace(/\/\/ comment/g, "/* comment */") // Handle comments
      const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
      const execFunc = new AsyncFunction("robot", transformedCode)
      await execFunc(robotAPI)
    } catch (error: any) {
      console.error("Execution error:", error)
      setIsRunning(false) // Ensure isRunning is reset on error
      setGameState((prev) => ({ ...prev, isGameOver: true, gameLost: true })) // Set game over on error
    } finally {
      // This block executes regardless of whether an error occurred or not
      // However, we need to be careful not to reset isRunning if stop() was called within the executed code.
      // A more robust solution might involve a flag set by the stop() function.
      // For now, we assume if the try block completes without an explicit stop, we should reset.
      if (isRunning) {
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
    setRobotState({
      x: 200,
      y: 200,
      rotation: 0,
      driveVelocity: 50,
      turnVelocity: 50,
      heading: 0,
    })
    setGameState({
      trashCollected: 0,
      gameLost: false,
      isGameOver: false,
    })
    setTrashItems([]) // Clear trash items
  }

  const handleClear = () => {
    if (workspace) {
      workspace.clear()
    }
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
    // Clear game state on clear as well
    setGameState({
      trashCollected: 0,
      gameLost: false,
      isGameOver: false,
    })
    setTrashItems([]) // Clear trash items
    if (trashSpawnIntervalRef.current) {
      clearInterval(trashSpawnIntervalRef.current)
      trashSpawnIntervalRef.current = null
    }
    if (floatAnimationRef.current) {
      cancelAnimationFrame(floatAnimationRef.current)
      floatAnimationRef.current = null
    }
    setIsRunning(false)
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
      gameLost: false,
      isGameOver: false,
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

    // Find when_started block and trace connected blocks
    const allBlocks = workspace.getAllBlocks()
    const startBlock = allBlocks.find((b: any) => b.type === "when_started")

    if (startBlock) {
      let currentBlock = startBlock.getNextBlock()

      while (currentBlock) {
        const blockType = currentBlock.type

        if (blockType === "turn_degrees") {
          const direction = currentBlock.getFieldValue("DIRECTION")
          const degrees = Number.parseFloat(currentBlock.getFieldValue("DEGREES")) || 90
          currentRotation += direction === "right" ? degrees : -degrees
        } else if (blockType === "turn_to_heading") {
          const heading = Number.parseFloat(currentBlock.getFieldValue("HEADING")) || 0
          currentRotation = heading
        } else if (blockType === "turn_to_rotation") {
          const rotation = Number.parseFloat(currentBlock.getFieldValue("ROTATION")) || 0
          currentRotation = rotation
        } else if (blockType === "drive_distance") {
          const direction = currentBlock.getFieldValue("DIRECTION")
          const distance = Number.parseFloat(currentBlock.getFieldValue("DISTANCE")) || 200
          const unit = currentBlock.getFieldValue("UNIT") || "mm"

          // Convert to pixels (scaled for preview)
          const pixels = (unit === "mm" ? distance * 0.5 : distance * 12.7) * scale
          const multiplier = direction === "forward" ? -1 : 1
          const angleRad = (currentRotation * Math.PI) / 180

          currentX += pixels * multiplier * Math.sin(angleRad)
          currentY += pixels * multiplier * Math.cos(angleRad)
          pathPoints.push({ x: currentX, y: currentY })
        } else if (blockType === "drive") {
          const direction = currentBlock.getFieldValue("DIRECTION")
          const pixels = 50 * scale // Default distance
          const multiplier = direction === "forward" ? -1 : 1
          const angleRad = (currentRotation * Math.PI) / 180

          currentX += pixels * multiplier * Math.sin(angleRad)
          currentY += pixels * multiplier * Math.cos(angleRad)
          pathPoints.push({ x: currentX, y: currentY })
        }

        currentBlock = currentBlock.getNextBlock()
      }
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
    let subRotation = 0
    if (startBlock) {
      let block = startBlock.getNextBlock()
      while (block) {
        if (block.type === "turn_degrees") {
          const dir = block.getFieldValue("DIRECTION")
          const deg = Number.parseFloat(block.getFieldValue("DEGREES")) || 90
          subRotation += dir === "right" ? deg : -deg
        } else if (block.type === "turn_to_heading" || block.type === "turn_to_rotation") {
          subRotation = Number.parseFloat(block.getFieldValue("HEADING") || block.getFieldValue("ROTATION")) || 0
          break
        }
        if (block.type === "drive_distance" || block.type === "drive") break
        block = block.getNextBlock()
      }
    }
    drawMiniSub(width / 2, height / 2, subRotation)
  }, [workspace])

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

  const handleRestoreBlocks = () => {
    if (workspace && deletedBlocks) {
      const xml = (window as any).Blockly.Xml.textToDom(deletedBlocks)
      ;(window as any).Blockly.Xml.domToWorkspace(xml, workspace)
      setShowDeletedBlocks(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
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
            width: playgroundState.isMaximized ? "640px" : "440px",
            height: playgroundState.isMaximized ? "680px" : "auto", // Adjusted height for maximized state
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
            <div className="flex flex-col relative">
              <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-[#FF8C00] to-[#FFA500] text-white px-3 py-1 rounded-full text-sm font-bold shadow-md">
                Trash: {gameState.trashCollected}
              </div>

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
              {/* Bottom ruler - width includes canvas + right ruler */}
              <div
                className="h-8 bg-gray-100 border-t border-gray-300 flex items-center justify-between px-4 text-[9px] text-gray-600"
                style={{ width: playgroundState.isMaximized ? 632 : 432 }}
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i}>{playgroundState.isMaximized ? i * 150 : i * 100}</span>
                ))}
              </div>

              {gameState.isGameOver && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-b-lg">
                  <div className="bg-white rounded-xl p-6 shadow-2xl text-center">
                    <h3 className="text-2xl font-bold text-red-600 mb-2">You Lose!</h3>
                    <p className="text-gray-600 mb-4">You hit the coral reef!</p>
                    <p className="text-lg font-semibold text-orange-500 mb-4">
                      Trash Collected: {gameState.trashCollected}
                    </p>
                    <Button onClick={handleReset} className="bg-purple-500 hover:bg-purple-600 text-white">
                      Try Again
                    </Button>
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
          ref={aiAssistantRef}
          onMouseDown={handleAIAssistantMouseDown}
          className="fixed bg-white rounded-lg shadow-2xl border-2 border-gray-300 z-50 transition-all duration-200"
          style={{
            left: `${aiAssistantState.x}px`,
            top: `${aiAssistantState.y}px`,
            cursor: aiAssistantState.isDragging ? "grabbing" : "auto",
            width: aiAssistantState.isMaximized ? "420px" : "320px",
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
            <div className="p-4">
              {aiStep === "main" ? (
                <div className="text-gray-700">
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
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0">
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
              ) : aiStep === "predict" ? (
                <div className="space-y-4">
                  <Button variant="outline" onClick={() => setAiStep("main")} className="mb-2">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <p className="text-purple-600 font-semibold">Predict and Plan - Preview your robot&apos;s path:</p>
                  <div className="border-4 border-purple-300 rounded-lg overflow-hidden">
                    <canvas ref={predictCanvasRef} width={300} height={300} className="w-full" />
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
                  <p className="mb-4 font-medium text-base">What&apos;s not working?</p>
                  <div className="flex flex-col gap-2">
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0">
                      <StopCircle className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">1.</span>
                      <span>Robot isn&apos;t moving</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0">
                      <ArrowLeftRight className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">2.</span>
                      <span>Robot moves the wrong direction</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0">
                      <Eye className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">3.</span>
                      <span>Sensors aren&apos;t detecting anything</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0">
                      <RefreshCw className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">4.</span>
                      <span>Loop doesn&apos;t stop</span>
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

      {showDeletedBlocks && deletedBlocks && (
        <div
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

      {/* Angle Picker Modals */}
      {anglePickerState.isOpen && (
        <AngleWheelPicker
          value={anglePickerState.angle}
          onChange={(newValue) => {
            if (anglePickerState.callback) {
              anglePickerState.callback(newValue)
            }
          }}
          onClose={() => setAnglePickerState((prev) => ({ ...prev, isOpen: false }))}
        />
      )}

      {compassPickerState.isOpen && (
        <CompassPicker
          value={compassPickerState.heading}
          onChange={(newValue) => {
            if (compassPickerState.callback) {
              compassPickerState.callback(newValue)
            }
          }}
          onClose={() => setCompassPickerState((prev) => ({ ...prev, isOpen: false }))}
        />
      )}

      {distancePickerState.isOpen && (
        <DistanceSliderPicker
          value={distancePickerState.distance}
          direction={playgroundState.isMaximized ? "forward" : "forward"} // Placeholder, needs to be dynamically set
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
            // Removed direct call to setDistancePickerState, handled by click listener
            return val
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
      this.appendDummyInput()
        .appendField("position")
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

// Switch Blocks
function defineSwitchBlocks(Blockly: any) {
  Blockly.Blocks["when_started"] = {
    init: function () {
      this.appendDummyInput().appendField("when started")
      this.appendStatementInput("DO")
      this.setColour("#F5A623")
      this.setDeletable(false)
      this.setTooltip("Program starts here")
    },
  }
  Blockly.JavaScript.forBlock["when_started"] = (block: any) => {
    return Blockly.JavaScript.statementToCode(block, "DO")
  }

  Blockly.Blocks["function_definition"] = {
    init: function () {
      this.appendDummyInput().appendField("function").appendField(new Blockly.FieldTextInput("myFunction"), "NAME")
      this.appendStatementInput("DO")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["function_definition"] = (block: any) => {
    const name = block.getFieldValue("NAME")
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `async function ${name}() {\n${statements}}\n`
  }

  Blockly.Blocks["function_with_input"] = {
    init: function () {
      this.appendDummyInput().appendField("function").appendField(new Blockly.FieldTextInput("myFunction"), "NAME")
      this.appendDummyInput().appendField("with input").appendField(new Blockly.FieldTextInput("input"), "INPUT_NAME")
      this.appendStatementInput("DO")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["function_with_input"] = (block: any) => {
    const name = block.getFieldValue("NAME")
    const inputName = block.getFieldValue("INPUT_NAME")
    const statements = Blockly.JavaScript.statementToCode(block, "DO")
    return `async function ${name}(${inputName}) {\n${statements}}\n`
  }

  Blockly.Blocks["function_call"] = {
    init: function () {
      this.appendDummyInput().appendField("call").appendField(new Blockly.FieldTextInput("myFunction"), "NAME")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["function_call"] = (block: any) => {
    const name = block.getFieldValue("NAME")
    return `await ${name}();\n`
  }

  Blockly.Blocks["function_call_with_input"] = {
    init: function () {
      this.appendDummyInput().appendField("call").appendField(new Blockly.FieldTextInput("myFunction"), "NAME")
      this.appendValueInput("INPUT")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["function_call_with_input"] = (block: any) => {
    const name = block.getFieldValue("NAME")
    const input = Blockly.JavaScript.valueToCode(block, "INPUT", Blockly.JavaScript.ORDER_NONE) || "null"
    return `await ${name}(${input});\n`
  }

  Blockly.Blocks["boolean_and"] = {
    init: function () {
      this.appendValueInput("A")
      this.appendValueInput("B").appendField("and")
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
      this.setInputsInline(true)
    },
  }
  Blockly.JavaScript.forBlock["boolean_and"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_LOGICAL_AND) || "false"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_LOGICAL_AND) || "false"
    return [`(${a} && ${b})`, Blockly.JavaScript.ORDER_LOGICAL_AND]
  }

  Blockly.Blocks["boolean_or"] = {
    init: function () {
      this.appendValueInput("A")
      this.appendValueInput("B").appendField("or")
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
      this.setInputsInline(true)
    },
  }
  Blockly.JavaScript.forBlock["boolean_or"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_LOGICAL_OR) || "false"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_LOGICAL_OR) || "false"
    return [`(${a} || ${b})`, Blockly.JavaScript.ORDER_LOGICAL_OR]
  }

  Blockly.Blocks["boolean_not"] = {
    init: function () {
      this.appendValueInput("A").appendField("not")
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["boolean_not"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_LOGICAL_NOT) || "true"
    return [`!(${a})`, Blockly.JavaScript.ORDER_LOGICAL_NOT]
  }

  Blockly.Blocks["compare_equal"] = {
    init: function () {
      this.appendValueInput("A")
      this.appendValueInput("B").appendField("=")
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
      this.setInputsInline(true)
    },
  }
  Blockly.JavaScript.forBlock["compare_equal"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_EQUALITY) || "0"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_EQUALITY) || "0"
    return [`(${a} === ${b})`, Blockly.JavaScript.ORDER_EQUALITY]
  }

  Blockly.Blocks["compare_not_equal"] = {
    init: function () {
      this.appendValueInput("A")
      this.appendValueInput("B").appendField("≠")
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
      this.setInputsInline(true)
    },
  }
  Blockly.JavaScript.forBlock["compare_not_equal"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_EQUALITY) || "0"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_EQUALITY) || "0"
    return [`(${a} !== ${b})`, Blockly.JavaScript.ORDER_EQUALITY]
  }

  Blockly.Blocks["compare_less"] = {
    init: function () {
      this.appendValueInput("A")
      this.appendValueInput("B").appendField("<")
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
      this.setInputsInline(true)
    },
  }
  Blockly.JavaScript.forBlock["compare_less"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_RELATIONAL) || "0"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_RELATIONAL) || "0"
    return [`(${a} < ${b})`, Blockly.JavaScript.ORDER_RELATIONAL]
  }

  Blockly.Blocks["compare_greater"] = {
    init: function () {
      this.appendValueInput("A")
      this.appendValueInput("B").appendField(">")
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
      this.setInputsInline(true)
    },
  }
  Blockly.JavaScript.forBlock["compare_greater"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_RELATIONAL) || "0"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_RELATIONAL) || "0"
    return [`(${a} > ${b})`, Blockly.JavaScript.ORDER_RELATIONAL]
  }

  Blockly.Blocks["compare_less_equal"] = {
    init: function () {
      this.appendValueInput("A")
      this.appendValueInput("B").appendField("≤")
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
      this.setInputsInline(true)
    },
  }
  Blockly.JavaScript.forBlock["compare_less_equal"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_RELATIONAL) || "0"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_RELATIONAL) || "0"
    return [`(${a} <= ${b})`, Blockly.JavaScript.ORDER_RELATIONAL]
  }

  Blockly.Blocks["compare_greater_equal"] = {
    init: function () {
      this.appendValueInput("A")
      this.appendValueInput("B").appendField("≥")
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
      this.setInputsInline(true)
    },
  }
  Blockly.JavaScript.forBlock["compare_greater_equal"] = (block: any) => {
    const a = Blockly.JavaScript.valueToCode(block, "A", Blockly.JavaScript.ORDER_RELATIONAL) || "0"
    const b = Blockly.JavaScript.valueToCode(block, "B", Blockly.JavaScript.ORDER_RELATIONAL) || "0"
    return [`(${a} >= ${b})`, Blockly.JavaScript.ORDER_RELATIONAL]
  }

  Blockly.Blocks["number_value"] = {
    init: function () {
      this.appendDummyInput().appendField(new Blockly.FieldNumber(0), "NUM")
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["number_value"] = (block: any) => {
    const num = block.getFieldValue("NUM")
    return [String(num), Blockly.JavaScript.ORDER_ATOMIC]
  }

  Blockly.Blocks["text_value"] = {
    init: function () {
      this.appendDummyInput().appendField('"').appendField(new Blockly.FieldTextInput(""), "TEXT").appendField('"')
      this.setOutput(true, "String")
      this.setColour("#4CAF50")
    },
  }
  Blockly.JavaScript.forBlock["text_value"] = (block: any) => {
    const text = block.getFieldValue("TEXT")
    return [`"${text}"`, Blockly.JavaScript.ORDER_ATOMIC]
  }
}

export default BlocklyEditor
