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
import type { Camera } from "@/engine"
import type { PlaygroundDefinition } from "@/playgrounds/types"
import {
  daysFromMs,
  capacityForLevel,
  expWithinLevel,
  tickRoverRescue,
  type RoverRescueState,
  type RoverStatus,
} from "@/playgrounds/rover-rescue"
import { isCastleCrashersPlayground, isRoverRescuePlayground } from "./playground-motion"
import type { HostRobotState, ProgramGameState, ProgramRuntime } from "./program-types"
import {
  reefViewFromMaximized,
  toEngineRobot,
  type PlaygroundChromeState,
  type TrashItem,
} from "./playground-host"
import { SimulationClock, fitToBounds } from "@/engine"
import { playgroundWorldBounds } from "./distance-picker-preview"
import type { CastleCrashersState } from "@/playgrounds/castle-crashers"
import { tickCastlePhysics } from "@/playgrounds/castle-crashers"

export function usePlaygroundDraw({
  canvasRef,
  playgroundId,
  activePlayground,
  playgroundState,
  robotState,
  reefState,
  reefStateRef,
  roverStateRef,
  castleStateRef,
  roverCamera,
  coralPieces,
  trashItems,
  penTrail,
  isRunning,
  showRuler,
  runtimeRef,
  commitReefState,
  setGameState,
  gameState,
  onRoverMissionOver,
  onRoverStatus,
  onCastleState,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  playgroundId: string
  activePlayground: PlaygroundDefinition<any>
  playgroundState: PlaygroundChromeState
  robotState: HostRobotState
  reefState: OceanReefState
  reefStateRef: React.MutableRefObject<OceanReefState>
  roverStateRef: React.MutableRefObject<RoverRescueState>
  castleStateRef: React.MutableRefObject<CastleCrashersState>
  roverCamera: Camera | null
  coralPieces: CoralPiece[]
  trashItems: TrashItem[]
  penTrail: { x1: number; y1: number; x2: number; y2: number; color: string; width: number }[]
  isRunning: boolean
  showRuler: boolean
  runtimeRef: React.MutableRefObject<ProgramRuntime>
  commitReefState: (next: OceanReefState) => void
  setGameState: React.Dispatch<React.SetStateAction<ProgramGameState>>
  gameState: ProgramGameState
  onRoverMissionOver?: (reason: string, status: RoverStatus) => void
  onRoverStatus?: (status: RoverStatus) => void
  onCastleState?: (state: CastleCrashersState) => void
}) {
  const floatAnimationRef = useRef<number | null>(null)
  const roverCameraRef = useRef(roverCamera)
  roverCameraRef.current = roverCamera
  const robotStateRef = useRef(robotState)
  robotStateRef.current = robotState
  // The rover loop must not restart when the run state flips, so it reads refs.
  const isRunningRef = useRef(isRunning)
  isRunningRef.current = isRunning
  const missionCallbacksRef = useRef({ onRoverMissionOver, onRoverStatus, onCastleState })
  missionCallbacksRef.current = { onRoverMissionOver, onRoverStatus, onCastleState }
  const roverPlayground = isRoverRescuePlayground(playgroundId)
  const castlePlayground = isCastleCrashersPlayground(playgroundId)
  const oceanPlayground = !roverPlayground && !castlePlayground

  const drawRobot = useCallback(() => {
    if (!oceanPlayground) return
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
  }, [oceanPlayground, playgroundState.isVisible, playgroundState.isMinimized, playgroundState.isMaximized, robotState])

  const drawPlayground = useCallback(() => {
    if (!oceanPlayground) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { w: width, h: height } = getPlaygroundCanvasSize(playgroundState.isMaximized)
    const cam = oceanReefCamera(width)
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
  }, [oceanPlayground, robotState, playgroundState.isMaximized, trashItems, coralPieces, penTrail, isRunning, showRuler, reefState])

  const checkCoralCollision = useCallback((xMm: number, yMm: number): boolean => {
    if (!oceanPlayground) return false
    return hitsCoral(reefStateRef.current, toEngineRobot({ x: xMm, y: yMm, rotation: 0 }))
  }, [oceanPlayground])

  const checkTrashCollision = useCallback(() => {
    if (!oceanPlayground) return
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
  }, [oceanPlayground, robotState, commitReefState])

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
    if (!oceanPlayground) return
    drawPlayground()
  }, [oceanPlayground, drawPlayground])

  useEffect(() => {
    if (!oceanPlayground) return
    drawRobot()
  }, [oceanPlayground, drawRobot, playgroundState.isMaximized, playgroundState.isVisible, playgroundState.isMinimized])

  useEffect(() => {
    if (!oceanPlayground) return
    if (!playgroundState.isVisible || playgroundState.isMinimized) return

    const timer = setTimeout(() => {
      drawPlayground()
      drawRobot()
    }, 50)
    return () => clearTimeout(timer)
  }, [oceanPlayground, playgroundState.isVisible, playgroundState.isMinimized, drawPlayground, drawRobot])

  useEffect(() => {
    if (!roverPlayground || !playgroundState.isVisible || playgroundState.isMinimized) return
    let frame = 0
    let last = performance.now()
    let reportedStatus = ""
    let signaledOver = roverStateRef.current.missionOver
    const loop = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      const robot = toEngineRobot(robotStateRef.current)
      // Standby owns the ticks; this loop only paints so the HUD can race.
      if (!roverStateRef.current.standby) {
        roverStateRef.current = tickRoverRescue(roverStateRef.current, dt, robot, {
          missionRunning: isRunningRef.current,
        })
      }
      const days = daysFromMs(roverStateRef.current.missionMs)
      // The readouts show tenths of a day and whole percent, so React only hears
      // about the rover when a figure it actually displays has moved.
      const status = {
        days,
        batteryPercent: Math.round(roverStateRef.current.batteryPercent),
        level: roverStateRef.current.level,
        exp: expWithinLevel(roverStateRef.current.xp).exp,
        stored: roverStateRef.current.storage.length,
        capacity: capacityForLevel(roverStateRef.current.level),
        standby: roverStateRef.current.standby,
        day50Dialog: roverStateRef.current.day50Dialog,
      }
      const digest = `${Math.floor(days * 10)}|${status.batteryPercent}|${status.level}|${status.exp}|${status.stored}|${status.capacity}|${status.standby ? 1 : 0}|${status.day50Dialog ? 1 : 0}`
      if (digest !== reportedStatus) {
        reportedStatus = digest
        missionCallbacksRef.current.onRoverStatus?.(status)
      }
      if (!roverStateRef.current.missionOver) signaledOver = false
      if (roverStateRef.current.missionOver && !signaledOver) {
        signaledOver = true
        missionCallbacksRef.current.onRoverMissionOver?.(
          roverStateRef.current.missionReason ?? "river",
          status,
        )
      }
      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d")
      const cam = roverCameraRef.current
      if (ctx && cam) {
        activePlayground.render(ctx, roverStateRef.current, robot, cam)
        activePlayground.renderOverlay?.(ctx, roverStateRef.current, robot, cam)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [roverPlayground, playgroundState.isVisible, playgroundState.isMinimized, activePlayground, roverStateRef, canvasRef])

  useEffect(() => {
    if (!castlePlayground) return
    let frame = 0
    let last = performance.now()
    let reportedWeight = -1
    let signaledOver = false
    const clock = new SimulationClock()
    let frameTimeMs = 0
    let previousRobot = toEngineRobot(robotStateRef.current)
    const loop = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      const robot = toEngineRobot(robotStateRef.current)
      const frameStartMs = frameTimeMs
      frameTimeMs += dt
      // Sample the animated pose at each physics step, not once per render.
      // Otherwise a slow frame applies its entire drive as one oversized shove.
      clock.pushFrame(dt, ({ dtMs, gameTimeMs }) => {
        const fraction = dt > 0 ? Math.max(0, Math.min(1, (gameTimeMs - frameStartMs) / dt)) : 1
        const sample = { ...robot,
          xMm: previousRobot.xMm + (robot.xMm - previousRobot.xMm) * fraction,
          yMm: previousRobot.yMm + (robot.yMm - previousRobot.yMm) * fraction,
        }
        castleStateRef.current = tickCastlePhysics(castleStateRef.current, dtMs, sample, isRunningRef.current)
      })
      previousRobot = robot
      if (!castleStateRef.current.missionOver) signaledOver = false
      if (castleStateRef.current.weightClearedKg !== reportedWeight) {
        reportedWeight = castleStateRef.current.weightClearedKg
        missionCallbacksRef.current.onCastleState?.(castleStateRef.current)
      }
      if (castleStateRef.current.missionOver && !signaledOver) {
        signaledOver = true
        missionCallbacksRef.current.onCastleState?.(castleStateRef.current)
      }
      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d")
      if (ctx) {
        const viewport = { widthPx: canvas!.width, heightPx: canvas!.height }
        const cam = fitToBounds(playgroundWorldBounds(activePlayground.world), viewport)
        if (playgroundState.isVisible && !playgroundState.isMinimized) {
          activePlayground.render(ctx, castleStateRef.current, robot, cam)
        }
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [castlePlayground, playgroundState.isVisible, playgroundState.isMinimized, activePlayground, castleStateRef, canvasRef])

  return {
    checkCoralCollision,
    checkTrashCollision,
    floatAnimationRef,
  }
}
