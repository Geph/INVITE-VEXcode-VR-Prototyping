import {
  fitToBounds,
  normalizeDegrees,
  screenToWorld,
  worldToScreen,
  type Camera,
  type Viewport,
  type WorldBounds,
} from "@/engine"
import { reefScreenToWorld, reefWorldToScreen } from "@/playgrounds/ocean-reef/art"
import type { OceanReefState } from "@/playgrounds/ocean-reef"
import type { RoverRescueState } from "@/playgrounds/rover-rescue"
import { riverHazardFromState } from "@/playgrounds/rover-rescue/state"
import { planRoverDrive, type DrivePlan } from "@/playgrounds/rover-rescue/systems/physics"
import type { PlaygroundDefinition } from "@/playgrounds/types"
import { toEngineRobot } from "./playground-host"
import { isCastleCrashersPlayground, isEngineNorthPlayground, isRoverRescuePlayground } from "./playground-motion"
import type { HostRobotPose } from "./program-types"
import type { CastleCrashersState } from "@/playgrounds/castle-crashers"

export const DISTANCE_PREVIEW_PX = 280

export function distancePickerTitle(name: string, widthMm: number, heightMm: number): string {
  return `Set distance — ${name} (${widthMm}×${heightMm} mm)`
}

export function playgroundWorldBounds(world: { widthMm: number; heightMm: number }): WorldBounds {
  return {
    minX: -world.widthMm / 2,
    maxX: world.widthMm / 2,
    minY: -world.heightMm / 2,
    maxY: world.heightMm / 2,
  }
}

/** Slider ceiling is the longest field edge, not the remaining run to the wall. */
export function pickerMaxDistanceMm(world: { widthMm: number; heightMm: number }): number {
  return Math.max(world.widthMm, world.heightMm)
}

function driveEndMm(
  playgroundId: string,
  pose: HostRobotPose,
  direction: string,
  distanceMm: number,
): { x: number; y: number } {
  const sign = direction === "forward" ? 1 : -1
  const rad = (pose.rotation * Math.PI) / 180
  return {
    x: pose.x + sign * distanceMm * Math.sin(rad),
    y: isEngineNorthPlayground(playgroundId)
      ? pose.y + sign * distanceMm * Math.cos(rad)
      : pose.y - sign * distanceMm * Math.cos(rad),
  }
}

function previewViewport(canvasPx = DISTANCE_PREVIEW_PX): Viewport {
  return { widthPx: canvasPx, heightPx: canvasPx }
}

export function previewCamera(world: { widthMm: number; heightMm: number }, canvasPx = DISTANCE_PREVIEW_PX): Camera {
  return fitToBounds(playgroundWorldBounds(world), previewViewport(canvasPx))
}

function project(
  playgroundId: string,
  point: { x: number; y: number },
  cam: Camera,
  viewport: Viewport,
): { x: number; y: number } {
  if (isEngineNorthPlayground(playgroundId)) {
    return worldToScreen({ x: point.x, y: point.y }, cam, viewport)
  }
  return reefWorldToScreen(point.x, point.y, cam, viewport)
}

function unproject(
  playgroundId: string,
  point: { x: number; y: number },
  cam: Camera,
  viewport: Viewport,
): { x: number; y: number } {
  if (isEngineNorthPlayground(playgroundId)) return screenToWorld(point, cam, viewport)
  return reefScreenToWorld(point.x, point.y, cam, viewport)
}

/** Ocean Reef only ever hits walls, so it reuses the rover's plan shape. */
export type DrivePrediction = DrivePlan

/**
 * What the drive will actually do. Rover Rescue defers to the same planner the
 * drive itself uses, so the dashed line and the run cannot disagree.
 */
export function predictDrive({
  playgroundId,
  robot,
  direction,
  distanceMm,
  world,
  roverState,
}: {
  playgroundId: string
  robot: HostRobotPose
  direction: string
  distanceMm: number
  world: { widthMm: number; heightMm: number }
  roverState: RoverRescueState
}): DrivePrediction {
  if (isRoverRescuePlayground(playgroundId)) {
    return planRoverDrive({
      from: { x: robot.x, y: robot.y },
      headingDeg: robot.rotation,
      direction,
      distanceMm,
      index: roverState.index,
      hazard: riverHazardFromState(roverState),
    })
  }

  const raw = driveEndMm(playgroundId, robot, direction, distanceMm)
  const bounds = playgroundWorldBounds(world)
  const endMm = {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, raw.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, raw.y)),
  }
  return {
    endMm,
    requestedMm: distanceMm,
    reachableMm: Math.hypot(endMm.x - robot.x, endMm.y - robot.y),
    blocked: endMm.x !== raw.x || endMm.y !== raw.y,
    inRiver: false,
  }
}

/** One line of plain language under the preview. */
export function drivePredictionHint(prediction: DrivePrediction): string {
  const short = prediction.requestedMm - prediction.reachableMm > 10
  if (prediction.inRiver) return `Enters the river after ${Math.round(prediction.reachableMm)} mm — mission over`
  if (prediction.blocked && short) return `Stops after ${Math.round(prediction.reachableMm)} mm — something is in the way`
  if (short) return `Reaches the field edge after ${Math.round(prediction.reachableMm)} mm`
  return "Path is clear"
}

const HEADING_DEAD_ZONE_PX = 12

/** Heading that aims the drive line at a preview-canvas pointer. */
export function headingFromPreviewPointer(
  playgroundId: string,
  robot: Pick<HostRobotPose, "x" | "y">,
  pointerPx: { x: number; y: number },
  world: { widthMm: number; heightMm: number },
  direction = "forward",
  canvasPx = DISTANCE_PREVIEW_PX,
): number | null {
  const viewport = previewViewport(canvasPx)
  const cam = previewCamera(world, canvasPx)
  const start = project(playgroundId, { x: robot.x, y: robot.y }, cam, viewport)
  const dxPx = pointerPx.x - start.x
  const dyPx = pointerPx.y - start.y
  if (dxPx * dxPx + dyPx * dyPx < HEADING_DEAD_ZONE_PX * HEADING_DEAD_ZONE_PX) return null

  const worldPoint = unproject(playgroundId, pointerPx, cam, viewport)
  const dx = worldPoint.x - robot.x
  const dy = worldPoint.y - robot.y
  const toward = isEngineNorthPlayground(playgroundId)
    ? (Math.atan2(dx, dy) * 180) / Math.PI
    : (Math.atan2(dx, -dy) * 180) / Math.PI
  return normalizeDegrees(direction === "reverse" ? toward + 180 : toward)
}

export function drawDistancePickerPreview({
  ctx,
  playgroundId,
  playground,
  reefState,
  roverState,
  castleState,
  robot,
  direction,
  distanceMm,
}: {
  ctx: CanvasRenderingContext2D
  playgroundId: string
  playground: PlaygroundDefinition<any>
  reefState: OceanReefState
  roverState: RoverRescueState
  castleState: CastleCrashersState
  robot: HostRobotPose
  direction: string
  distanceMm: number
}): void {
  const viewport: Viewport = { widthPx: ctx.canvas.width, heightPx: ctx.canvas.height }
  const cam = fitToBounds(playgroundWorldBounds(playground.world), viewport)
  const engineRobot = toEngineRobot(robot)
  if (isRoverRescuePlayground(playgroundId)) {
    playground.render(ctx, roverState, engineRobot, cam)
  } else if (isCastleCrashersPlayground(playgroundId)) {
    playground.render(ctx, castleState, engineRobot, cam)
  } else {
    playground.render(
      ctx,
      { ...reefState, view: { widthPx: viewport.widthPx, heightPx: viewport.heightPx, maximized: false } },
      engineRobot,
      cam,
    )
  }

  const prediction = predictDrive({
    playgroundId,
    robot,
    direction,
    distanceMm,
    world: playground.world,
    roverState,
  })
  const start = project(playgroundId, { x: robot.x, y: robot.y }, cam, viewport)
  const stop = project(playgroundId, prediction.endMm, cam, viewport)
  const requested = project(playgroundId, driveEndMm(playgroundId, robot, direction, distanceMm), cam, viewport)

  // The part that cannot be driven is drawn faintly, so the gap is visible.
  if (prediction.requestedMm - prediction.reachableMm > 10) {
    ctx.beginPath()
    ctx.setLineDash([4, 5])
    ctx.strokeStyle = "#F87171"
    ctx.lineWidth = 2
    ctx.moveTo(stop.x, stop.y)
    ctx.lineTo(requested.x, requested.y)
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.setLineDash([6, 4])
  ctx.strokeStyle = prediction.inRiver ? "#F87171" : "#22C55E"
  ctx.lineWidth = 2
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(stop.x, stop.y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = "#FFD700"
  ctx.strokeStyle = "#E6B800"
  ctx.beginPath()
  ctx.arc(start.x, start.y, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  const halted = prediction.blocked || prediction.inRiver
  ctx.fillStyle = halted ? "#F87171" : "#22C55E"
  ctx.beginPath()
  ctx.arc(stop.x, stop.y, 5, 0, Math.PI * 2)
  ctx.fill()
  if (halted) {
    ctx.strokeStyle = "#FEE2E2"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(stop.x, stop.y, 9, 0, Math.PI * 2)
    ctx.stroke()
  }
}
