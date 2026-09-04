"use client"

import type React from "react"
import { useCallback, useRef } from "react"
import { normalizeDegrees, shortestRotationDelta } from "@/lib/robot-runtime"
import { clampRobotMm, poseToCanvas } from "@/playgrounds/ocean-reef"
import type { AnimateRobotFluidFn, HostRobotPose, HostRobotState, ProgramRuntime } from "./program-types"
import { reefViewFromMaximized } from "./playground-host"

export function useRobotAnimation({
  playgroundMaximized,
  setRobotState,
  runtimeRef,
  setPenTrail,
}: {
  playgroundMaximized: boolean
  setRobotState: React.Dispatch<React.SetStateAction<HostRobotState>>
  runtimeRef: React.MutableRefObject<ProgramRuntime>
  setPenTrail: React.Dispatch<
    React.SetStateAction<{ x1: number; y1: number; x2: number; y2: number; color: string; width: number }[]>
  >
}) {
  const animationRef = useRef<number | null>(null)
  const animationCancelRef = useRef<(() => void) | null>(null)
  const animateRobotFluidRef = useRef<AnimateRobotFluidFn>(async () => {})

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
  }, [runtimeRef, setPenTrail])

  const animateRobotFluid = (
    targetState: Partial<HostRobotState>,
    duration = 500,
    poseRef: React.MutableRefObject<HostRobotPose>,
  ) => {
    return new Promise<void>((resolve) => {
      const startTime = performance.now()
      const startState = { ...poseRef.current }
      let lastPoint = { x: startState.x, y: startState.y }

      const view = reefViewFromMaximized(playgroundMaximized)

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
        poseRef.current = { x: clamped.xMm, y: clamped.yMm, rotation }
        setRobotState((prev) => ({ ...prev, x: clamped.xMm, y: clamped.yMm, rotation }))
      }

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easeProgress = 1 - Math.pow(1 - progress, 3) // Ease-out cubic

        const current = { ...poseRef.current }
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

  return { cancelRobotAnimation, animateRobotFluidRef }
}
