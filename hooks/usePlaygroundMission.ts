"use client"

import type React from "react"
import { useCallback, useEffect } from "react"
import { CORAL_REEF_BATTERY_SEC } from "@/lib/robot-runtime"
import { INITIAL_GAME_STATE } from "./playground-host"
import type { HostRobotState, ProgramGameState } from "./program-types"

type MissionEndReason = ProgramGameState["missionEndReason"]

export function usePlaygroundMission({
  robotState,
  trashItems,
  gameState,
  setGameState,
  isRunning,
  isPausedOnBlock,
  stopRequestedRef,
  isRunningRef,
  setIsRunning,
  cancelRobotAnimation,
  trashSpawnIntervalRef,
  coralGraceUntilRef,
  floatAnimationRef,
  syncTrashItems,
  checkCoralCollision,
  checkTrashCollision,
}: {
  robotState: HostRobotState
  trashItems: { isCollected: boolean }[]
  gameState: ProgramGameState
  setGameState: React.Dispatch<React.SetStateAction<ProgramGameState>>
  isRunning: boolean
  isPausedOnBlock: boolean
  stopRequestedRef: React.MutableRefObject<boolean>
  isRunningRef: React.MutableRefObject<boolean>
  setIsRunning: React.Dispatch<React.SetStateAction<boolean>>
  cancelRobotAnimation: () => void
  trashSpawnIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>
  coralGraceUntilRef: React.MutableRefObject<number>
  floatAnimationRef: React.MutableRefObject<number | null>
  syncTrashItems: (items: any[]) => void
  checkCoralCollision: (xMm: number, yMm: number) => boolean
  checkTrashCollision: () => void
}) {
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

  const handleTrash = () => {
    setGameState({ ...INITIAL_GAME_STATE })
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

  useEffect(() => {
    if (!gameState.showCelebration) return
    const timer = setTimeout(() => {
      setGameState((prev) => ({ ...prev, showCelebration: false }))
    }, 5000)
    return () => clearTimeout(timer)
  }, [gameState.showCelebration])

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

  return { handleTrash }
}
