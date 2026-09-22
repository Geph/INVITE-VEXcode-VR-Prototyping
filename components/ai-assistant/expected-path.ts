/**
 * Straight-line preview of the program from the rover's current pose.
 * Forever loops are walked once so the preview cannot spin forever.
 */

import { forEachProgramBlock } from "@/lib/robot-runtime"
import { isEngineNorthPlayground } from "@/hooks/playground-motion"

export interface PathPoint {
  x: number
  y: number
}

interface MotionBlock {
  type: string
  getFieldValue: (name: string) => string
  getInputTargetBlock: (name: string) => unknown
  getNextBlock: () => unknown
}

interface PathWorkspace {
  getAllBlocks: () => Array<{ type: string; getNextBlock?: () => unknown }>
}

function millimetres(distance: string, unit: string): number {
  const value = Number.parseFloat(distance)
  const mm = Number.isFinite(value) ? value : 200
  return unit === "inches" || unit === "INCHES" ? mm * 25.4 : mm
}

export function programPathMm(
  workspace: PathWorkspace | null,
  start: { x: number; y: number; headingDeg: number },
  playgroundId: string,
): PathPoint[] {
  const points: PathPoint[] = [{ x: start.x, y: start.y }]
  if (!workspace) return points

  let x = start.x
  let y = start.y
  let heading = start.headingDeg
  const forwardY = isEngineNorthPlayground(playgroundId) ? 1 : -1

  const hats = workspace.getAllBlocks().filter((block) => block.type === "pg_events_when_started")
  for (const hat of hats) {
    forEachProgramBlock(hat, (block) => {
      const moved = stepBlock(block, x, y, heading, forwardY)
      x = moved.x
      y = moved.y
      heading = moved.heading
      if (moved.drove) points.push({ x, y })
    })
  }
  return points
}

function stepBlock(
  block: MotionBlock,
  x: number,
  y: number,
  heading: number,
  forwardY: number,
): { x: number; y: number; heading: number; drove: boolean } {
  if (block.type === "pg_drivetrain_turn_for" || block.type === "pg_drivetrain_turn") {
    const degrees =
      block.type === "pg_drivetrain_turn" ? 90 : Number.parseFloat(block.getFieldValue("DEGREES")) || 90
    const sign = block.getFieldValue("DIRECTION") === "right" ? 1 : -1
    return { x, y, heading: heading + sign * degrees, drove: false }
  }
  if (block.type === "pg_drivetrain_turn_to_heading") {
    return { x, y, heading: Number.parseFloat(block.getFieldValue("HEADING")) || 0, drove: false }
  }
  if (block.type === "pg_drivetrain_turn_to_rotation") {
    return { x, y, heading: Number.parseFloat(block.getFieldValue("ROTATION")) || 0, drove: false }
  }
  if (block.type === "pg_drivetrain_drive_for" || block.type === "pg_drivetrain_drive") {
    const distance =
      block.type === "pg_drivetrain_drive"
        ? 200
        : millimetres(block.getFieldValue("DISTANCE"), block.getFieldValue("UNIT") || "mm")
    const sign = block.getFieldValue("DIRECTION") === "reverse" ? -1 : 1
    const rad = (heading * Math.PI) / 180
    return {
      x: x + sign * distance * Math.sin(rad),
      y: y + sign * distance * Math.cos(rad) * forwardY,
      heading,
      drove: true,
    }
  }
  return { x, y, heading, drove: false }
}
