"use client"

import type React from "react"
import { useCallback, useEffect, useRef } from "react"
import {
  DISTANCE_SENSOR_MAX_MM,
  drawFieldRulerOverlay,
  getPlaygroundCanvasSize,
  nearestTrashInFrontMm,
  raycastToBorder,
  type CoralPiece,
} from "@/lib/robot-runtime"
import { drawSubmarine } from "@/playgrounds/ocean-reef/art"
import {
  hitsCoral,
  oceanReefCamera,
  poseToCanvas,
  renderDistanceRay,
  renderOceanReef,
  tickOceanReef,
  type OceanReefState,
} from "@/playgrounds/ocean-reef"
import type { HostRobotState, ProgramGameState, ProgramRuntime } from "./program-types"
import {
  reefViewFromMaximized,
  toEngineRobot,
  type PlaygroundChromeState,
  type TrashItem,
} from "./playground-host"

export function usePlaygroundDraw({
  canvasRef,
  playgroundState,
  robotState,
  reefState,
  reefStateRef,
  coralPieces,
  trashItems,
  penTrail,
  isRunning,
  showRuler,
  runtimeRef,
  commitReefState,
  setGameState,
  gameState,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  playgroundState: PlaygroundChromeState
  robotState: HostRobotState
  reefState: OceanReefState
  reefStateRef: React.MutableRefObject<OceanReefState>
  coralPieces: CoralPiece[]
  trashItems: TrashItem[]
  penTrail: { x1: number; y1: number; x2: number; y2: number; color: string; width: number }[]
  isRunning: boolean
  showRuler: boolean
  runtimeRef: React.MutableRefObject<ProgramRuntime>
  commitReefState: (next: OceanReefState) => void
  setGameState: React.Dispatch<React.SetStateAction<ProgramGameState>>
  gameState: ProgramGameState
}) {
  const floatAnimationRef = useRef<number | null>(null)

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

  useEffect(() => {
    drawPlayground()
  }, [drawPlayground])

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

  return {
    checkCoralCollision,
    checkTrashCollision,
    floatAnimationRef,
  }
}
