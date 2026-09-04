"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { type RobotState as EngineRobotState } from "@/engine"
import {
  CORAL_REEF_BATTERY_SEC,
  CORAL_REEF_FIELD_MM,
  DISTANCE_SENSOR_MAX_MM,
  drawFieldRulerOverlay,
  getPlaygroundCanvasSize,
  remapPixelAcrossCanvas,
  EYE_NEAR_MM,
  isTrashNearEye,
  nearestTrashInFrontMm,
  normalizeDegrees,
  raycastToBorder,
  seededRandom,
  shortestRotationDelta,
  type CoralPiece,
} from "@/lib/robot-runtime"
import { useProgramRunner, type AnimateRobotFluidFn } from "@/hooks/useProgramRunner"
import {
  AngleWheelPicker,
  CompassPicker,
  DistanceSliderPicker,
  dismissBlocklyFieldEditors,
} from "@/blocks/fields"
import { installAllBlocks } from "@/blocks/registry"
import { flyoutContents } from "@/blocks/toolbox"
import { AIAssistant, type AIAssistantHandle, type SurveyStep } from "@/components/ai-assistant"
import { PlaygroundCanvas } from "@/components/playground/PlaygroundCanvas"
import { PlaygroundWindow } from "@/components/playground/PlaygroundWindow"
import { BlocklyEditor, type FieldPickerEvent } from "@/components/workspace/BlocklyEditor"
import { CodeViewToggle, HeaderActions, RunToolbar } from "@/components/workspace/Toolbar"
import { drawSubmarine } from "@/playgrounds/ocean-reef/art"
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
  Wrench,
  Zap,
  StopCircle,
  RefreshCw,
  Gauge,
  Target,
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
  const aiAssistantRef = useRef<AIAssistantHandle>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [blocklyLoaded, setBlocklyLoaded] = useState(false)
  const collab = useBlocklyCollab(workspace, blocklyLoaded, blocklyWorkspaceContainerRef)
  const [selectedCategory, setSelectedCategory] = useState<string | null>("drivetrain")
  const animationRef = useRef<number | null>(null)
  const [aiStep, setAiStep] = useState<SurveyStep>("main")

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
    setPlaygroundState((prev) => ({ ...prev, x: playgroundX }))
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
  const deployTrashFieldRef = useRef<() => void>(() => {})
  const animateRobotFluidRef = useRef<AnimateRobotFluidFn>(async () => {})

  const {
    handleStart,
    handleStep,
    handleStop,
    handleReset,
    isRunning,
    setIsRunning,
    isRunningRef,
    stopRequestedRef,
    isStepping,
    isPausedOnBlock,
    consoleLines,
  } = useProgramRunner({
    workspace,
    robotStateRef,
    setRobotState,
    runtimeRef,
    reefStateRef,
    activePlayground,
    robotCapabilities,
    getView: () => reefViewFromMaximized(playgroundState.isMaximized),
    animateRobotFluidRef,
    deployTrashFieldRef,
    cancelRobotAnimation,
    setGameState,
    setPenTrail,
    coralGraceUntilRef,
    trashSpawnIntervalRef,
    syncTrashItems,
  })

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
  deployTrashFieldRef.current = deployTrashField

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
  animateRobotFluidRef.current = animateRobotFluid

  const getPythonCode = useCallback(() => generatePythonProgram(workspace), [workspace])

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
    aiAssistantRef.current?.open()
  }

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
      aiAssistantRef.current?.show()
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
          <CodeViewToggle
            codeView={codeView}
            onToggle={() => setCodeView(codeView === "blocks" ? "python" : "blocks")}
          />
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
        <HeaderActions
          playgroundVisible={playgroundState.isVisible}
          playgroundPickerOpen={playgroundPickerOpen}
          onOpenPlayground={handleOpenPlayground}
          onGetHelp={handleOpenAIAssistant}
          onOpenRobotConfig={handleOpenRobotConfig}
        />
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
        <PlaygroundWindow
          title={selectedPlaygroundName}
          state={playgroundState}
          windowRef={playgroundRef}
          onMouseDown={handlePlaygroundMouseDown}
          onMinimize={handleMinimizePlayground}
          onMaximize={handleMaximizePlayground}
          onClose={handleClosePlayground}
        >
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

              <PlaygroundCanvas canvasRef={canvasRef} width={canvasSize.w} height={canvasSize.h} />

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

              <RunToolbar
                isRunning={isRunning}
                isStepping={isStepping}
                isPausedOnBlock={isPausedOnBlock}
                onStart={handleStart}
                onStep={handleStep}
                onStop={handleStop}
                onReset={handleReset}
              />

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
        </PlaygroundWindow>
      )}

      <AIAssistant
        ref={aiAssistantRef}
        workspace={workspace}
        surveyStep={aiStep}
        onSurveyStepChange={setAiStep}
      />

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
