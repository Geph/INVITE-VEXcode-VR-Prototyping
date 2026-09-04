"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { createRng, type RobotState as EngineRobotState } from "@/engine"
import {
  CORAL_REEF_BATTERY_SEC,
  CORAL_REEF_FIELD_MM,
  distanceToPixels,
  DISTANCE_SENSOR_MAX_MM,
  driveDurationMs,
  fieldMmToPixel,
  drawFieldRulerOverlay,
  forEachProgramBlock,
  generateWhenStartedJavaScript,
  getPlaygroundCanvasSize,
  remapPixelAcrossCanvas,
  maxDriveDistanceMm,
  EYE_NEAR_MM,
  isTrashNearEye,
  nearestTrashInFrontMm,
  normalizeDegrees,
  raycastToBorder,
  seededRandom,
  shortestRotationDelta,
  turnDurationMs,
  type CoralPiece,
} from "@/lib/robot-runtime"
import { isTypingInFormField } from "@/lib/blockly-widget-form"
import {
  AngleWheelPicker,
  CompassPicker,
  DistanceSliderPicker,
  dismissBlocklyFieldEditors,
} from "@/blocks/fields"
import { installAllBlocks } from "@/blocks/registry"
import { flyoutContents } from "@/blocks/toolbox"
import { BlocklyEditor, type FieldPickerEvent } from "@/components/workspace/BlocklyEditor"
import {
  CORAL_COLORS,
  CORAL_KINDS,
  drawCoralPiece,
  drawReefBed,
  drawSubmarine,
} from "@/playgrounds/ocean-reef/art"
import {
  DEFAULT_PLAYGROUND_ID,
  get as getPlayground,
  resolvePlaygroundId,
} from "@/playgrounds/registry"
import {
  clampRobotMm,
  coralToPixelPieces,
  createCoralPieces,
  createOceanReefState,
  hitsCoral,
  tickOceanReef,
  oceanReefCamera,
  poseToCanvas,
  renderDistanceRay,
  renderOceanReef,
  START_POSE,
  type OceanReefState,
} from "@/playgrounds/ocean-reef"
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
  Eye,
  RotateCcw,
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
  Ruler,
  Minus,
  Square,
  Bot,
  FolderOpen,
  Save,
  FilePlus,
  ChevronDown,
  Castle,
  Waves,
  StepForward,
} from "lucide-react"

declare global {
  interface Window {
    Blockly: any
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

// Robot pose is world millimetres (Ocean Reef +Y is canvas-down).
interface RobotState {
  x: number
  y: number
  rotation: number
  driveVelocity: number
  turnVelocity: number
  heading: number
}

type PlaygroundId = "castle-crashers" | "ocean-cleanup" | "rescue-rover"

const PLAYGROUND_OPTIONS: {
  id: PlaygroundId
  name: string
  available: boolean
  description: string
  icon: typeof Castle
}[] = [
  {
    id: "castle-crashers",
    name: "Castle Crashers",
    available: false,
    description: "Storm the keep. Content coming later.",
    icon: Castle,
  },
  {
    id: "ocean-cleanup",
    name: "Ocean Cleanup",
    available: true,
    description: "Collect trash on the coral reef.",
    icon: Waves,
  },
  {
    id: "rescue-rover",
    name: "Rescue Rover",
    available: false,
    description: "Search and recover. Content coming later.",
    icon: Bot,
  },
]

/**
 * `when_started` used to be a C-block whose program lived in a "DO" mouth. That
 * input is gone, so projects saved before the change would load as a bare hat
 * with the whole stack discarded. Rehome the mouth onto the next connection.
 */
function migrateWhenStartedMouths(dom: Element): void {
  for (const hat of Array.from(dom.querySelectorAll('block[type="when_started"]'))) {
    const mouth = Array.from(hat.children).find(
      (child) => child.tagName === "statement" && child.getAttribute("name") === "DO",
    )
    if (!mouth) continue
    const next = hat.ownerDocument.createElement("next")
    while (mouth.firstChild) next.appendChild(mouth.firstChild)
    hat.replaceChild(next, mouth)
  }
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

function toEngineRobot(
  pose: { x: number; y: number; rotation: number },
  velocities?: { driveVelocity: number; turnVelocity: number },
): EngineRobotState {
  return {
    xMm: pose.x,
    yMm: pose.y,
    headingDeg: pose.rotation,
    driveVelocity: velocities?.driveVelocity ?? 50,
    turnVelocity: velocities?.turnVelocity ?? 50,
    driveTimeoutMs: null,
  }
}

function hostTrashFromReef(state: OceanReefState): TrashItem[] {
  return state.trash.map((item) => {
    const px = poseToCanvas(item.xMm, item.yMm, state.view)
    return {
      id: item.id,
      x: px.x,
      y: px.y,
      type: item.type,
      scale: item.scale,
      floatOffset: item.floatOffset,
      isCollected: item.isCollected,
    }
  })
}

function reefViewFromMaximized(maximized: boolean) {
  const { w, h } = getPlaygroundCanvasSize(maximized)
  return { widthPx: w, heightPx: h, maximized }
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

function PlaygroundPickerDialog({
  open,
  onClose,
  onChoose,
}: {
  open: boolean
  onClose: () => void
  onChoose: (id: PlaygroundId) => void
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      id="vex-playground-picker-backdrop"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        id="vex-playground-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vex-playground-picker-title"
        className="w-full max-w-3xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="vex-playground-picker-title" className="text-lg font-semibold text-slate-900">
              Choose a playground
            </h2>
            <p className="mt-1 text-sm text-slate-500">Pick a field to open. More playgrounds will unlock as we add them.</p>
          </div>
          <Button
            id="vex-playground-picker-close"
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-slate-900"
            aria-label="Close playground picker"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div id="vex-playground-picker-options" className="grid gap-3 sm:grid-cols-3">
          {PLAYGROUND_OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                id={`vex-playground-option-${option.id}`}
                type="button"
                disabled={!option.available}
                aria-disabled={!option.available}
                title={option.available ? `Open ${option.name}` : `${option.name} is coming soon`}
                onClick={() => {
                  if (!option.available) return
                  onChoose(option.id)
                }}
                className={
                  option.available
                    ? "flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    : "flex cursor-not-allowed flex-col items-start gap-3 rounded-xl border border-slate-200 bg-slate-100 p-4 text-left opacity-50 grayscale"
                }
              >
                <span
                  className={
                    option.available
                      ? "flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700"
                      : "flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200 text-slate-500"
                  }
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{option.name}</span>
                  {!option.available && (
                    <span className="rounded-full bg-slate-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Coming soon
                    </span>
                  )}
                </span>
                <span className="text-sm text-slate-500">{option.description}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function VexWorkspace() {
  const blocklyWorkspaceContainerRef = useRef<HTMLDivElement>(null)
  const playgroundRef = useRef<HTMLDivElement>(null)
  const aiAssistantRef = useRef<HTMLDivElement>(null)
  const predictCanvasRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [blocklyLoaded, setBlocklyLoaded] = useState(false)
  const collab = useBlocklyCollab(workspace, blocklyLoaded, blocklyWorkspaceContainerRef)
  const [selectedCategory, setSelectedCategory] = useState<string | null>("drivetrain")
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const animationRef = useRef<number | null>(null)
  const [aiStep, setAiStep] = useState<AIAssistantState["surveyStep"]>("main")

  const initialRobotPos = { x: START_POSE.xMm, y: START_POSE.yMm }
  const robotStateRef = useRef<{ x: number; y: number; rotation: number }>({
    x: initialRobotPos.x,
    y: initialRobotPos.y,
    rotation: 0,
  })
  const [playgroundId, setPlaygroundId] = useState(DEFAULT_PLAYGROUND_ID)
  const activePlayground = getPlayground(playgroundId) ?? getPlayground(DEFAULT_PLAYGROUND_ID)!
  const reefStateRef = useRef<OceanReefState>({ ...createOceanReefState(1), trash: [] })
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
  /** True while the program pauses before every block instead of running straight through. */
  const stepModeRef = useRef(false)
  /** Releases the block the program is parked on. Set only while paused. */
  const stepGateRef = useRef<(() => void) | null>(null)
  /** A Step pressed mid-movement, spent by the next block instead of being dropped. */
  const pendingStepRef = useRef(false)
  const [isStepping, setIsStepping] = useState(false)
  const [isPausedOnBlock, setIsPausedOnBlock] = useState(false)

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

  /** Glow the block the program is on; `null` clears it. */
  const highlightProgramBlock = useCallback(
    (blockId: string | null) => {
      if (!workspace) return
      try {
        workspace.highlightBlock(blockId)
      } catch {
        /* the block can be deleted mid-run */
      }
    },
    [workspace],
  )

  /** Lets a paused program continue, whether it then runs free or stops. */
  const releaseStepGate = useCallback(() => {
    const resume = stepGateRef.current
    stepGateRef.current = null
    setIsPausedOnBlock(false)
    resume?.()
  }, [])

  useEffect(() => {
    setIsMounted(true)
    const playgroundX = Math.max(16, window.innerWidth - 520)
    const aiX = Math.max(16, window.innerWidth - 420)
    setPlaygroundState((prev) => ({ ...prev, x: playgroundX }))
    setAiAssistantState((prev) => ({ ...prev, x: aiX }))
    setRobotConfigState((prev) => ({ ...prev, x: Math.max(16, window.innerWidth / 2 - 200) }))
    setPlaygroundId(resolvePlaygroundId(new URLSearchParams(window.location.search).get("playground")))
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

  const [reefState, setReefState] = useState<OceanReefState>(() => ({ ...createOceanReefState(1), trash: [] }))
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
    isVisible: false,
    isMinimized: false,
    isMaximized: false,
  })
  const [playgroundPickerOpen, setPlaygroundPickerOpen] = useState(false)
  const [selectedPlaygroundId, setSelectedPlaygroundId] = useState<PlaygroundId | null>(null)
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

  const commitReefState = useCallback(
    (next: OceanReefState) => {
      reefStateRef.current = next
      setReefState(next)
      setCoralPieces(coralToPixelPieces(next.coral, next.view))
      syncTrashItems(hostTrashFromReef(next))
    },
    [syncTrashItems],
  )

  useEffect(() => {
    trashItemsRef.current = trashItems
  }, [trashItems])
  useEffect(() => {
    reefStateRef.current = reefState
  }, [reefState])
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
    const view = reefViewFromMaximized(maximized)
    const coral = createCoralPieces(view)
    const next: OceanReefState = {
      ...reefStateRef.current,
      view,
      coral,
    }
    commitReefState(next)
  }, [commitReefState])

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

    const pos = poseToCanvas(robotState.x, robotState.y, reefViewFromMaximized(playgroundState.isMaximized))
    ctx.save()
    ctx.translate(pos.x, pos.y)
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

  const handleRegisterBlocks = useCallback((Blockly: any) => {
    installAllBlocks(Blockly, activePlayground)
    installVexBlockContextMenu(Blockly)
    ;(window as any).__vexBlockToPython = (block: any) => blockToPythonSnippet(block)
  }, [activePlayground])

  const handleFieldPicker = useCallback((event: FieldPickerEvent) => {
    blocklyPickerRef.current = { blockId: event.blockId, fieldName: event.fieldName }
    if (event.blockType === "turn_degrees" || event.blockType === "turn_to_rotation" || event.blockType === "set_drive_rotation") {
      setAnglePickerState({
        isOpen: true,
        angle: Number(event.value) || 0,
        x: event.clientX,
        y: event.clientY,
      })
    } else if (event.blockType === "turn_to_heading" || event.blockType === "set_drive_heading") {
      setCompassPickerState({
        isOpen: true,
        heading: Number(event.value) || 0,
        x: event.clientX,
        y: event.clientY,
      })
    } else if (event.blockType === "drive_distance") {
      setDistancePickerState({
        isOpen: true,
        distance: Number(event.value) || 200,
        direction: event.direction || "forward",
        x: event.clientX,
        y: event.clientY,
      })
    }
  }, [])

  const toolbox = useMemo(
    () => flyoutContents(selectedCategory, activePlayground),
    [selectedCategory, activePlayground],
  )

  // Redraw playground when state changes
  const drawPlayground = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { w: width, h: height } = getPlaygroundCanvasSize(playgroundState.isMaximized)
    const cam = oceanReefCamera()
    const robot = toEngineRobot(robotState)
    renderOceanReef(ctx, reefState, robot, cam, { penTrail })

    if (isRunning) {
      const robotPx = poseToCanvas(robotState.x, robotState.y, reefState.view)
      const borderMm = raycastToBorder(
        robotPx.x,
        robotPx.y,
        robotState.rotation,
        width,
        height,
        coralPieces,
        DISTANCE_SENSOR_MAX_MM,
      )
      const trashMm = nearestTrashInFrontMm(robotPx.x, robotPx.y, robotState.rotation, trashItems, DISTANCE_SENSOR_MAX_MM)
      const frontMm = trashMm != null && trashMm < borderMm ? trashMm : borderMm
      renderDistanceRay(ctx, robot, cam, { widthPx: width, heightPx: height }, Math.min(frontMm, DISTANCE_SENSOR_MAX_MM))
    }

    if (showRuler) {
      drawFieldRulerOverlay(ctx, width, height)
    }
  }, [robotState, playgroundState.isMaximized, trashItems, coralPieces, penTrail, isRunning, showRuler, reefState])

  const checkCoralCollision = useCallback((xMm: number, yMm: number): boolean => {
    return hitsCoral(reefStateRef.current, toEngineRobot({ x: xMm, y: yMm, rotation: 0 }))
  }, [])

  const checkTrashCollision = useCallback(() => {
    const next = tickOceanReef(
      {
        ...reefStateRef.current,
        magnetEnergized: runtimeRef.current.magnetBoost || reefStateRef.current.magnetEnergized,
      },
      16.67,
      toEngineRobot(robotState),
    )
    if (next.trashCollected !== reefStateRef.current.trashCollected) {
      const gained = next.trashCollected - reefStateRef.current.trashCollected
      commitReefState({ ...next, missionOver: false, missionReason: undefined })
      setGameState((prev) => ({
        ...prev,
        trashCollected: prev.trashCollected + gained,
      }))
    }
  }, [robotState, commitReefState])

  const deployTrashField = useCallback(() => {
    if (trashSpawnIntervalRef.current) {
      clearInterval(trashSpawnIntervalRef.current)
      trashSpawnIntervalRef.current = null
    }

    const view = reefViewFromMaximized(playgroundState.isMaximized)
    const next = createOceanReefState(1, view)
    commitReefState(next)
    setGameState((prev) => ({
      ...prev,
      trashTotal: next.trash.length,
      trashCollected: 0,
      isSpawningTrash: true,
      batteryPercent: 100,
      missionEndReason: null,
      showCelebration: false,
      isGameOver: false,
      gameLost: false,
      runError: null,
    }))
  }, [playgroundState.isMaximized, commitReefState])

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
      const prev = reefStateRef.current
      const next: OceanReefState = {
        ...prev,
        trash: prev.trash.map((trash) => ({
          ...trash,
          scale: trash.scale < 0.8 + (trash.id % 4) * 0.1 ? trash.scale + 0.05 : trash.scale,
          floatOffset: trash.floatOffset + 0.03,
        })),
      }
      commitReefState(next)
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

      const view = reefViewFromMaximized(playgroundState.isMaximized)

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
        const clamped = clampRobotMm(x, y, view)
        if (clamped.xMm !== lastPoint.x || clamped.yMm !== lastPoint.y) {
          recordPenSegment(poseToCanvas(lastPoint.x, lastPoint.y, view), poseToCanvas(clamped.xMm, clamped.yMm, view))
          lastPoint = { x: clamped.xMm, y: clamped.yMm }
        }
        robotStateRef.current = { x: clamped.xMm, y: clamped.yMm, rotation }
        setRobotState((prev) => ({ ...prev, x: clamped.xMm, y: clamped.yMm, rotation }))
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

  const handleRun = async ({ step = false }: { step?: boolean } = {}) => {
    // `isRunning` can already be false while a stopped program is still unwinding,
    // so gate on the ref to avoid two programs driving the same robot.
    if (!workspace || !window.Blockly || programActiveRef.current) return

    programActiveRef.current = true
    stopRequestedRef.current = false
    stepModeRef.current = step
    pendingStepRef.current = false
    setIsStepping(step)
    setIsPausedOnBlock(false)
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
    // Every statement announces itself, which is what drives both the running
    // block highlight and the pause points for Step.
    jsGen.STATEMENT_PREFIX = "await robot.__step(%1);\n"
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

    const startPos = { x: START_POSE.xMm, y: START_POSE.yMm }
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

    const currentView = () => reefViewFromMaximized(playgroundState.isMaximized)

    const clampPosition = (xMm: number, yMm: number) => clampRobotMm(xMm, yMm, currentView())

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

    const engineRobotRef = {
      get current(): EngineRobotState {
        return {
          xMm: robotStateRef.current.x,
          yMm: robotStateRef.current.y,
          headingDeg: robotStateRef.current.rotation,
          driveVelocity: runtimeRef.current.driveVelocity,
          turnVelocity: runtimeRef.current.turnVelocity,
          driveTimeoutMs: runtimeRef.current.driveTimeoutSec != null ? runtimeRef.current.driveTimeoutSec * 1000 : null,
        }
      },
      set current(next: EngineRobotState) {
        robotStateRef.current = { x: next.xMm, y: next.yMm, rotation: next.headingDeg }
      },
    }
    const playgroundApi = activePlayground.createApi({
      robot: engineRobotRef,
      world: reefStateRef,
      writeConsole: (text, color) => pushConsoleLine(text, color),
      stopped: { get current() { return stopRequestedRef.current } },
      rng: createRng(1),
    })

    const robotAPI = {
      /**
       * Injected before every statement by `STATEMENT_PREFIX`. Highlights the
       * block that is about to run, and in step mode parks there until the
       * learner asks for the next one.
       */
      __step: async (blockId: string) => {
        throwIfStopped()
        highlightProgramBlock(blockId)
        if (!stepModeRef.current) return
        if (pendingStepRef.current) {
          pendingStepRef.current = false
          return
        }
        setIsPausedOnBlock(true)
        await new Promise<void>((resolve) => {
          stepGateRef.current = resolve
        })
        setIsPausedOnBlock(false)
        throwIfStopped()
      },
      drive: async (direction: string, distance?: number, unit?: string) =>
        withMotionLock(async () => {
          throwIfStopped()
          const sign = direction === "forward" ? 1 : -1
          const distanceMm =
            distance === undefined ? 200 : unit === "inches" || unit === "INCHES" ? Number(distance) * 25.4 : Number(distance)
          const angleRad = (robotStateRef.current.rotation * Math.PI) / 180
          const rawX = robotStateRef.current.x + sign * distanceMm * Math.sin(angleRad)
          const rawY = robotStateRef.current.y - sign * distanceMm * Math.cos(angleRad)
          const { xMm: targetX, yMm: targetY } = clampPosition(rawX, rawY)
          const actualMm = Math.hypot(targetX - robotStateRef.current.x, targetY - robotStateRef.current.y)
          const duration = driveDurationMs(distanceToPixels(actualMm, "mm"), runtimeRef.current.driveVelocity)
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
      energize: (device: string, mode: string) => {
        playgroundApi.energize(device, mode)
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
        return playgroundApi.bumperPressed(bumper)
      },
      distanceFoundObject: (sensor: string) => playgroundApi.distanceFoundObject(sensor),
      getDistance: (sensor: string, unit: string) => playgroundApi.getDistance(sensor, unit),
      eyeIsNear: (sensor: string) => {
        if (!robotCapabilities.eyeSensor) return false
        return playgroundApi.eyeIsNear(sensor)
      },
      eyeDetectsColor: (sensor: string, color: string) => {
        if (!robotCapabilities.eyeSensor) return false
        return playgroundApi.eyeDetectsColor(sensor, color)
      },
      eyeBrightness: (sensor: string) => {
        if (!robotCapabilities.eyeSensor) return 0
        return playgroundApi.eyeBrightness(sensor)
      },
      getPosition: (axis: string, unit: string) => playgroundApi.getPosition(axis, unit),
      getPositionAngle: () => playgroundApi.getPositionAngle(),
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
        pushConsoleLine("Add blocks under when started to run your program.")
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
      stepModeRef.current = false
      stepGateRef.current = null
      pendingStepRef.current = false
      setIsStepping(false)
      setIsPausedOnBlock(false)
      highlightProgramBlock(null)
      if (isRunningRef.current) {
        isRunningRef.current = false
        setIsRunning(false)
      }
    }
  }

  /** START also resumes a stepped program, so it reads as "run from here". */
  const handleStart = () => {
    if (programActiveRef.current) {
      if (!stepModeRef.current) return
      stepModeRef.current = false
      pendingStepRef.current = false
      setIsStepping(false)
      releaseStepGate()
      return
    }
    void handleRun()
  }

  /** Runs exactly one block, starting the program in step mode if needed. */
  const handleStep = () => {
    if (!programActiveRef.current) {
      void handleRun({ step: true })
      return
    }
    if (!stepModeRef.current) {
      // Switching from a free run: park on the next block.
      stepModeRef.current = true
      setIsStepping(true)
      return
    }
    if (stepGateRef.current) {
      releaseStepGate()
      return
    }
    // Mid-movement: remember the press so the next block does not stall.
    pendingStepRef.current = true
  }

  const handleStop = () => {
    if (!programActiveRef.current) return
    stopRequestedRef.current = true
    stepModeRef.current = false
    pendingStepRef.current = false
    setIsStepping(false)
    cancelRobotAnimation()
    releaseStepGate()
    if (trashSpawnIntervalRef.current) {
      clearInterval(trashSpawnIntervalRef.current)
      trashSpawnIntervalRef.current = null
    }
    isRunningRef.current = false
    setIsRunning(false)
    highlightProgramBlock(null)
  }

  const handleReset = () => {
    stopRequestedRef.current = true
    stepModeRef.current = false
    pendingStepRef.current = false
    setIsStepping(false)
    releaseStepGate()
    highlightProgramBlock(null)
    cancelRobotAnimation()
    if (trashSpawnIntervalRef.current) {
      clearInterval(trashSpawnIntervalRef.current)
      trashSpawnIntervalRef.current = null
    }
    setIsRunning(false)
    isRunningRef.current = false
    const resetPos = { x: START_POSE.xMm, y: START_POSE.yMm }
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
    migrateWhenStartedMouths(xml)
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
    setSelectedCategory(category)
  }

  const handleOpenPlayground = () => {
    setPlaygroundPickerOpen((open) => !open)
  }

  const handleClosePlaygroundPicker = useCallback(() => {
    setPlaygroundPickerOpen(false)
  }, [])

  const handleChoosePlayground = useCallback((id: PlaygroundId) => {
    const option = PLAYGROUND_OPTIONS.find((item) => item.id === id)
    if (!option?.available) return
    setSelectedPlaygroundId(id)
    setPlaygroundPickerOpen(false)
    setPlaygroundState((prev) => ({
      ...prev,
      isVisible: true,
      isMinimized: false,
    }))
  }, [])

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

    setPenTrail((segs) =>
      segs.map((seg) => {
        const a = remap(seg.x1, seg.y1)
        const b = remap(seg.x2, seg.y2)
        return { ...seg, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
      }),
    )

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
    // A program parked on a block is not driving, so reading your code between
    // steps must not cost battery.
    if (!isRunning || gameState.isGameOver || isPausedOnBlock) return
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
  }, [isRunning, gameState.isGameOver, isPausedOnBlock, endMission])

  useEffect(() => {
    if (!isRunning || gameState.isGameOver || gameState.trashTotal === 0) return
    const remaining = trashItems.filter((t) => !t.isCollected).length
    if (remaining === 0) {
      endMission("complete")
    }
  }, [trashItems, isRunning, gameState.isGameOver, gameState.trashTotal, endMission])

  const liveSensors = useMemo(() => {
    const { w, h } = getPlaygroundCanvasSize(playgroundState.isMaximized)
    const field = { x: Math.round(robotState.x), y: Math.round(robotState.y) }
    const robotPx = poseToCanvas(robotState.x, robotState.y, reefViewFromMaximized(playgroundState.isMaximized))
    const borderMm = raycastToBorder(robotPx.x, robotPx.y, robotState.rotation, w, h, coralPieces, DISTANCE_SENSOR_MAX_MM)
    const trashMm = nearestTrashInFrontMm(
      robotPx.x,
      robotPx.y,
      robotState.rotation,
      trashItems,
      DISTANCE_SENSOR_MAX_MM,
    )
    const frontDistanceMm = Math.round(trashMm != null && trashMm < borderMm ? trashMm : borderMm)
    const eyeNear =
      robotCapabilities.eyeSensor &&
      isTrashNearEye(robotPx.x, robotPx.y, robotState.rotation, trashItems, "front", EYE_NEAR_MM)
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
  const selectedPlaygroundName =
    PLAYGROUND_OPTIONS.find((option) => option.id === selectedPlaygroundId)?.name ?? "Playground"

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
              aria-label="Choose a playground"
              aria-haspopup="dialog"
              aria-expanded={playgroundPickerOpen}
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
        </div>
      </div>

      {/* Main Content */}
      <div id="vex-main" className="flex flex-1 overflow-hidden">
        <BlocklyEditor
          toolbox={toolbox}
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          onRegisterBlocks={handleRegisterBlocks}
          onWorkspaceReady={setWorkspace}
          onBlocklyLoaded={() => setBlocklyLoaded(true)}
          onTrash={handleTrash}
          onFieldPicker={handleFieldPicker}
          codeView={codeView}
          pythonCode={getPythonCode()}
          workspaceContainerRef={blocklyWorkspaceContainerRef}
          overlay={
            blocklyLoaded ? <BlocklyCollabOverlay peers={collab.peers} workspace={workspace} /> : null
          }
        />
      </div>

      <PlaygroundPickerDialog
        open={playgroundPickerOpen}
        onClose={handleClosePlaygroundPicker}
        onChoose={handleChoosePlayground}
      />

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
                {selectedPlaygroundName}
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

              <div id="vex-playground-run-controls" className="flex flex-wrap items-center gap-2 px-3 py-3">
                <Button
                  id="vex-btn-start"
                  size="sm"
                  className="bg-green-500 hover:bg-green-600 text-white border-0"
                  onClick={handleStart}
                  disabled={isRunning && !isStepping}
                  title={isStepping ? "Run the rest of the program" : "Run the program"}
                >
                  <Play className="h-4 w-4 mr-1" />
                  {isStepping ? "RESUME" : "START"}
                </Button>
                <Button
                  id="vex-btn-step"
                  size="sm"
                  className="bg-sky-500 hover:bg-sky-600 text-white border-0"
                  onClick={handleStep}
                  title="Run one block at a time"
                >
                  <StepForward className="h-4 w-4 mr-1" />
                  STEP
                </Button>
                <Button
                  id="vex-btn-stop"
                  size="sm"
                  className="bg-red-500 hover:bg-red-600 text-white border-0"
                  onClick={handleStop}
                  disabled={!isRunning}
                  title="Stop the program"
                >
                  <StopCircle className="h-4 w-4 mr-1" />
                  STOP
                </Button>
                <Button
                  id="vex-btn-reset"
                  size="sm"
                  className="bg-purple-500 hover:bg-purple-600 text-white border-0"
                  onClick={handleReset}
                  title="Send the robot back to the start"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  RESET
                </Button>
                {isStepping && (
                  <span id="vex-playground-step-status" className="ml-auto text-[11px] font-medium text-sky-700">
                    {isPausedOnBlock ? "Paused on highlighted block" : "Stepping…"}
                  </span>
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

export default VexWorkspace
