"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  DISTANCE_SENSOR_MAX_MM,
  EYE_NEAR_MM,
  getPlaygroundCanvasSize,
  playgroundWindowWidthPx,
  playgroundWindowX,
  isTrashNearEye,
  nearestTrashInFrontMm,
  normalizeDegrees,
  raycastToBorder,
  remapPixelAcrossCanvas,
  type CoralPiece,
} from "@/lib/robot-runtime"
import {
  coralToPixelPieces,
  createCoralPieces,
  createOceanReefState,
  poseToCanvas,
  START_POSE,
  type OceanReefState,
} from "@/playgrounds/ocean-reef"
import {
  DEFAULT_PLAYGROUND_ID,
  get as getPlayground,
  resolvePlaygroundId,
} from "@/playgrounds/registry"
import {
  createCastleCrashersState,
  resetCastleCrashersState,
  type CastleCrashersState,
} from "@/playgrounds/castle-crashers"
import { createRoverRescueState, resetRoverRescueState, type RoverRescueState } from "@/playgrounds/rover-rescue"
import { PLAYGROUND_OPTIONS, type PlaygroundId } from "@/components/playground/PlaygroundPicker"
import { isCastleCrashersPlayground, isRoverRescuePlayground } from "./playground-motion"
import { useRobotAnimation } from "./useRobotAnimation"
import type { HostRobotPose, HostRobotState, ProgramGameState } from "./program-types"
import {
  hostTrashFromReef,
  INITIAL_GAME_STATE,
  INITIAL_PLAYGROUND_CHROME,
  INITIAL_RUNTIME,
  initialHostRobot,
  reefViewFromMaximized,
  type LiveSensors,
  type PlaygroundChromeState,
  type TrashItem,
} from "./playground-host"

function pickerToRegistryId(id: PlaygroundId): string {
  if (id === "rescue-rover") return "rover-rescue"
  if (id === "ocean-cleanup") return "ocean-reef"
  if (id === "castle-crashers") return "castle-crashers"
  return DEFAULT_PLAYGROUND_ID
}

function registryToPickerId(id: string): PlaygroundId | null {
  if (id === "rover-rescue") return "rescue-rover"
  if (id === "ocean-reef") return "ocean-cleanup"
  if (id === "castle-crashers") return "castle-crashers"
  return null
}

export function usePlaygroundSession(eyeSensor: boolean) {
  const playgroundRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const initialRobotPos = { x: START_POSE.xMm, y: START_POSE.yMm }
  const robotStateRef = useRef<HostRobotPose>({
    x: initialRobotPos.x,
    y: initialRobotPos.y,
    rotation: 0,
  })
  const [playgroundId, setPlaygroundId] = useState(DEFAULT_PLAYGROUND_ID)
  const activePlayground = getPlayground(playgroundId) ?? getPlayground(DEFAULT_PLAYGROUND_ID)!
  const reefStateRef = useRef<OceanReefState>({ ...createOceanReefState(1), trash: [] })
  const runtimeRef = useRef({ ...INITIAL_RUNTIME })
  const [isMounted, setIsMounted] = useState(false)
  const [reefState, setReefState] = useState<OceanReefState>(() => ({ ...createOceanReefState(1), trash: [] }))
  const [coralPieces, setCoralPieces] = useState<CoralPiece[]>([])
  const [penTrail, setPenTrail] = useState<
    { x1: number; y1: number; x2: number; y2: number; color: string; width: number }[]
  >([])
  const [robotState, setRobotState] = useState<HostRobotState>(() =>
    initialHostRobot(initialRobotPos.x, initialRobotPos.y),
  )
  const [playgroundState, setPlaygroundState] = useState<PlaygroundChromeState>(INITIAL_PLAYGROUND_CHROME)
  const [playgroundPickerOpen, setPlaygroundPickerOpen] = useState(false)
  const [selectedPlaygroundId, setSelectedPlaygroundId] = useState<PlaygroundId | null>(null)
  const [showRuler, setShowRuler] = useState(false)
  const [showSensors, setShowSensors] = useState(true)
  const [trashItems, setTrashItems] = useState<TrashItem[]>([])
  const trashItemsRef = useRef<TrashItem[]>([])
  const [gameState, setGameState] = useState<ProgramGameState>(INITIAL_GAME_STATE)
  const coralGraceUntilRef = useRef(0)
  const trashSpawnIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const deployTrashFieldRef = useRef<() => void>(() => {})

  const [roverState, setRoverState] = useState<RoverRescueState>(() => createRoverRescueState(1))
  const roverStateRef = useRef(roverState)
  const [castleState, setCastleState] = useState<CastleCrashersState>(() => createCastleCrashersState(1))
  const castleStateRef = useRef(castleState)

  const { cancelRobotAnimation, animateRobotFluidRef } = useRobotAnimation({
    castleStateRef,
    playgroundId,
    playgroundMaximized: playgroundState.isMaximized,
    setRobotState,
    runtimeRef,
    setPenTrail,
  })

  const applyStartPose = useCallback((id: string) => {
    const playground = getPlayground(id) ?? getPlayground(DEFAULT_PLAYGROUND_ID)!
    const pose = playground.world.startPose
    robotStateRef.current = { x: pose.xMm, y: pose.yMm, rotation: pose.headingDeg }
    setRobotState(initialHostRobot(pose.xMm, pose.yMm, pose.headingDeg))
  }, [])

  useEffect(() => {
    roverStateRef.current = roverState
  }, [roverState])

  useEffect(() => {
    castleStateRef.current = castleState
  }, [castleState])

  useEffect(() => {
    setIsMounted(true)
    const params = new URLSearchParams(window.location.search)
    const raw = params.get("playground")
    const id = resolvePlaygroundId(raw)
    const debug = params.get("debug") === "1"
    const playground = getPlayground(id) ?? getPlayground(DEFAULT_PLAYGROUND_ID)!
    const canvas = getPlaygroundCanvasSize(false, playground.world)
    const playgroundX = playgroundWindowX(canvas.w, window.innerWidth)
    setPlaygroundId(id)
    applyStartPose(id)
    setRoverState(createRoverRescueState(1, debug))
    setCastleState(createCastleCrashersState(1))
    setSelectedPlaygroundId(registryToPickerId(id))
    setPlaygroundState((prev) => ({
      ...prev,
      x: playgroundX,
      isVisible: prev.isVisible || isRoverRescuePlayground(id) || isCastleCrashersPlayground(id),
    }))
  }, [applyStartPose])

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
    if (!isMounted || isRoverRescuePlayground(playgroundId) || isCastleCrashersPlayground(playgroundId)) return
    initializeCoralBorders(playgroundState.isMaximized)
  }, [isMounted, playgroundId, playgroundState.isMaximized, initializeCoralBorders])

  const handlePlaygroundMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    if ((e.target as HTMLElement).closest("#vex-playground-canvas, #vex-playground-zoom-controls, #vex-playground-mission-days")) return
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

  const deployTrashField = useCallback(() => {
    if (trashSpawnIntervalRef.current) {
      clearInterval(trashSpawnIntervalRef.current)
      trashSpawnIntervalRef.current = null
    }

    if (isRoverRescuePlayground(playgroundId)) {
      setRoverState((prev) => resetRoverRescueState(prev, prev.seed))
      applyStartPose(playgroundId)
      setGameState((prev) => ({
        ...prev,
        trashTotal: 0,
        trashCollected: 0,
        isSpawningTrash: false,
        batteryPercent: 100,
        missionEndReason: null,
        missionDays: 0,
        showCelebration: false,
        isGameOver: false,
        gameLost: false,
        runError: null,
      }))
      return
    }

    if (isCastleCrashersPlayground(playgroundId)) {
      setCastleState((prev) => resetCastleCrashersState(prev, prev.seed))
      applyStartPose(playgroundId)
      setGameState((prev) => ({
        ...prev,
        trashTotal: 0,
        trashCollected: 0,
        isSpawningTrash: false,
        batteryPercent: 100,
        missionEndReason: null,
        missionDays: 0,
        showCelebration: false,
        isGameOver: false,
        gameLost: false,
        runError: null,
      }))
      return
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
      missionDays: 0,
      showCelebration: false,
      isGameOver: false,
      gameLost: false,
      runError: null,
    }))
  }, [playgroundId, playgroundState.isMaximized, commitReefState, applyStartPose])
  deployTrashFieldRef.current = deployTrashField

  const handleOpenPlayground = () => {
    setPlaygroundPickerOpen((open) => !open)
  }

  const handleClosePlaygroundPicker = useCallback(() => {
    setPlaygroundPickerOpen(false)
  }, [])

  const handleChoosePlayground = useCallback((id: PlaygroundId) => {
    const option = PLAYGROUND_OPTIONS.find((item) => item.id === id)
    if (!option?.available) return
    const registryId = pickerToRegistryId(id)
    setPlaygroundId(registryId)
    setSelectedPlaygroundId(id)
    applyStartPose(registryId)
    setPenTrail([])
    if (isRoverRescuePlayground(registryId)) {
      setRoverState((prev) => createRoverRescueState(prev.seed, prev.debug))
    }
    if (isCastleCrashersPlayground(registryId)) {
      setCastleState((prev) => createCastleCrashersState(prev.seed, prev.level))
    }
    const playground = getPlayground(registryId) ?? getPlayground(DEFAULT_PLAYGROUND_ID)!
    setPlaygroundPickerOpen(false)
    setPlaygroundState((prev) => {
      const canvas = getPlaygroundCanvasSize(prev.isMaximized, playground.world)
      return {
        ...prev,
        x: playgroundWindowX(canvas.w, window.innerWidth),
        isVisible: true,
        isMinimized: false,
      }
    })
  }, [applyStartPose])

  const handleClosePlayground = () => {
    setPlaygroundState((prev) => ({ ...prev, isVisible: false }))
  }

  const handleMinimizePlayground = () => {
    setPlaygroundState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }))
  }

  const handleMaximizePlayground = () => {
    const fromMaximized = playgroundState.isMaximized
    const toMaximized = !fromMaximized
    const from = getPlaygroundCanvasSize(fromMaximized, activePlayground.world)
    const to = getPlaygroundCanvasSize(toMaximized, activePlayground.world)
    if (!isRoverRescuePlayground(playgroundId) && !isCastleCrashersPlayground(playgroundId)) {
      const remap = (x: number, y: number) =>
        remapPixelAcrossCanvas(x, y, from.w, from.h, to.w, to.h)

      setPenTrail((segs) =>
        segs.map((seg) => {
          const a = remap(seg.x1, seg.y1)
          const b = remap(seg.x2, seg.y2)
          return { ...seg, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
        }),
      )
    }

    setPlaygroundState((prev) => {
      const maxX = Math.max(16, window.innerWidth - playgroundWindowWidthPx(to.w) - 16)
      return { ...prev, isMaximized: toMaximized, x: Math.min(prev.x, maxX) }
    })
  }

  const liveSensors: LiveSensors = useMemo(() => {
    const { w, h } = getPlaygroundCanvasSize(playgroundState.isMaximized, activePlayground.world)
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
      eyeSensor &&
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
  }, [robotState, trashItems, coralPieces, playgroundState.isMaximized, eyeSensor, activePlayground.world])

  const canvasSize = getPlaygroundCanvasSize(playgroundState.isMaximized, activePlayground.world)
  const selectedPlaygroundName =
    PLAYGROUND_OPTIONS.find((option) => option.id === selectedPlaygroundId)?.name ??
    activePlayground.name ??
    "Playground"

  return {
    playgroundId,
    playgroundRef,
    canvasRef,
    robotStateRef,
    runtimeRef,
    reefStateRef,
    roverState,
    roverStateRef,
    setRoverState,
    castleState,
    castleStateRef,
    setCastleState,
    activePlayground,
    reefState,
    coralPieces,
    penTrail,
    setPenTrail,
    robotState,
    setRobotState,
    playgroundState,
    playgroundPickerOpen,
    showRuler,
    setShowRuler,
    showSensors,
    setShowSensors,
    trashItems,
    gameState,
    setGameState,
    coralGraceUntilRef,
    trashSpawnIntervalRef,
    deployTrashFieldRef,
    cancelRobotAnimation,
    animateRobotFluidRef,
    syncTrashItems,
    commitReefState,
    handlePlaygroundMouseDown,
    handleOpenPlayground,
    handleClosePlaygroundPicker,
    handleChoosePlayground,
    handleClosePlayground,
    handleMinimizePlayground,
    handleMaximizePlayground,
    liveSensors,
    canvasSize,
    selectedPlaygroundName,
    applyStartPose,
  }
}
