import { clampRobotMm } from "@/playgrounds/ocean-reef"
import { ROVER_RESCUE_ID } from "@/playgrounds/rover-rescue"
import { clampRoverMm } from "@/playgrounds/rover-rescue/api"
import { riverHazardFromState, type RoverRescueState } from "@/playgrounds/rover-rescue/state"
import { planRoverDrive } from "@/playgrounds/rover-rescue/systems/physics"
import { CASTLE_CRASHERS_ID } from "@/playgrounds/castle-crashers"
import { clampCastleMm } from "@/playgrounds/castle-crashers/systems/physics"
import type { PlaygroundView } from "./program-types"

export function isRoverRescuePlayground(id: string): boolean {
  return id === ROVER_RESCUE_ID
}

export function isCastleCrashersPlayground(id: string): boolean {
  return id === CASTLE_CRASHERS_ID
}

/** Rover Rescue and Castle Crasher+ both use engine +Y = north. */
export function isEngineNorthPlayground(id: string): boolean {
  return isRoverRescuePlayground(id) || isCastleCrashersPlayground(id)
}

export function clampHostRobotMm(
  playgroundId: string,
  xMm: number,
  yMm: number,
  view: PlaygroundView,
): { xMm: number; yMm: number } {
  if (isRoverRescuePlayground(playgroundId)) return clampRoverMm(xMm, yMm)
  if (isCastleCrashersPlayground(playgroundId)) return clampCastleMm(xMm, yMm)
  return clampRobotMm(xMm, yMm, view)
}

/** 0° = north. Rover Rescue / Castle use +Y north; Ocean Reef keeps historical −Y forward. */
export function driveTargetMm(
  playgroundId: string,
  pose: { x: number; y: number; rotation: number },
  direction: string,
  distanceMm: number,
  view: PlaygroundView,
  roverState?: RoverRescueState | null,
): { xMm: number; yMm: number } {
  if (isRoverRescuePlayground(playgroundId) && roverState) {
    const plan = planRoverDrive({
      from: { x: pose.x, y: pose.y },
      headingDeg: pose.rotation,
      direction,
      distanceMm,
      index: roverState.index,
      hazard: riverHazardFromState(roverState),
    })
    roverState.blocked = plan.blocked
    return { xMm: plan.endMm.x, yMm: plan.endMm.y }
  }

  const sign = direction === "forward" ? 1 : -1
  const rad = (pose.rotation * Math.PI) / 180
  const rawX = pose.x + sign * distanceMm * Math.sin(rad)
  const rawY = isEngineNorthPlayground(playgroundId)
    ? pose.y + sign * distanceMm * Math.cos(rad)
    : pose.y - sign * distanceMm * Math.cos(rad)
  return clampHostRobotMm(playgroundId, rawX, rawY, view)
}
