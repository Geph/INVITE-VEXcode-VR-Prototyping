import { clampRobotMm } from "@/playgrounds/ocean-reef"
import { ROVER_RESCUE_ID } from "@/playgrounds/rover-rescue"
import { clampRoverMm } from "@/playgrounds/rover-rescue/api"
import { riverHazardFromState, type RoverRescueState } from "@/playgrounds/rover-rescue/state"
import { resolveRoverMove } from "@/playgrounds/rover-rescue/systems/physics"
import type { PlaygroundView } from "./program-types"

export function isRoverRescuePlayground(id: string): boolean {
  return id === ROVER_RESCUE_ID
}

export function clampHostRobotMm(
  playgroundId: string,
  xMm: number,
  yMm: number,
  view: PlaygroundView,
): { xMm: number; yMm: number } {
  if (isRoverRescuePlayground(playgroundId)) return clampRoverMm(xMm, yMm)
  return clampRobotMm(xMm, yMm, view)
}

/** 0° = north. Rover Rescue uses +Y north; Ocean Reef keeps historical −Y forward. */
export function driveTargetMm(
  playgroundId: string,
  pose: { x: number; y: number; rotation: number },
  direction: string,
  distanceMm: number,
  view: PlaygroundView,
  roverState?: RoverRescueState | null,
): { xMm: number; yMm: number } {
  const sign = direction === "forward" ? 1 : -1
  const rad = (pose.rotation * Math.PI) / 180
  const rawX = pose.x + sign * distanceMm * Math.sin(rad)
  const rawY = isRoverRescuePlayground(playgroundId)
    ? pose.y + sign * distanceMm * Math.cos(rad)
    : pose.y - sign * distanceMm * Math.cos(rad)
  const field = clampHostRobotMm(playgroundId, rawX, rawY, view)
  if (!roverState || !isRoverRescuePlayground(playgroundId)) return field
  const resolved = resolveRoverMove(
    { x: pose.x, y: pose.y },
    { x: field.xMm, y: field.yMm },
    roverState.index,
    riverHazardFromState(roverState),
  )
  roverState.blocked = resolved.blocked
  return { xMm: resolved.xMm, yMm: resolved.yMm }
}
