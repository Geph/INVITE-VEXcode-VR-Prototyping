"use client"

import type React from "react"
import { useCallback, useRef } from "react"
import { normalizeDegrees, shortestRotationDelta } from "@/lib/robot-runtime"
import { poseToCanvas } from "@/playgrounds/ocean-reef"
import type { AnimateRobotFluidFn, HostRobotPose, HostRobotState, ProgramRuntime } from "./program-types"
import { clampHostRobotMm, isRoverRescuePlayground } from "./playground-motion"
import { reefViewFromMaximized } from "./playground-host"

export function useRobotAnimation({
  playgroundId,
  playgroundMaximized,
  setRobotState,
  runtimeRef,
  setPenTrail,
}: {
  playgroundId: string
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

      /**
       * Commit a frame: refs and pen first, then a pure state update.
       *
       * Rover Rescue targets come from `planRoverDrive`, which has already
       * stopped the path at the first obstacle or river cell. Re-resolving per
       * frame here used to cut drives short of that plan, which is what made
       * the distance picker's preview over-promise.
       */
      const commit = (x: number, y: number, rotation: number) => {
        const next = clampHostRobotMm(playgroundId, x, y, view)
        if (next.xMm !== lastPoint.x || next.yMm !== lastPoint.y) {
          if (!isRoverRescuePlayground(playgroundId)) {
            recordPenSegment(poseToCanvas(lastPoint.x, lastPoint.y, view), poseToCanvas(next.xMm, next.yMm, view))
          }
          lastPoint = { x: next.xMm, y: next.yMm }
        }
        poseRef.current = { x: next.xMm, y: next.yMm, rotation }
        setRobotState((prev) => ({ ...prev, x: next.xMm, y: next.yMm, rotation }))
      }

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        // Linear: the rover holds the velocity it was set to and then stops,
        // rather than easing out over the last third of every move.
        const progress = Math.min(elapsed / duration, 1)

        const current = { ...poseRef.current }
        if (targetState.x !== undefined) {
          current.x = startState.x + (targetState.x - startState.x) * progress
        }
        if (targetState.y !== undefined) {
          current.y = startState.y + (targetState.y - startState.y) * progress
        }
        if (targetState.rotation !== undefined) {
          const delta = shortestRotationDelta(startState.rotation, targetState.rotation)
          current.rotation = normalizeDegrees(startState.rotation + delta * progress)
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
