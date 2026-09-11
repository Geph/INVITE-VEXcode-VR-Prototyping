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
import { clampRoverMm } from "@/playgrounds/rover-rescue/api"
import { riverHazardFromState } from "@/playgrounds/rover-rescue/state"
import { resolveRoverMove } from "@/playgrounds/rover-rescue/systems/physics"
import type { PlaygroundDefinition } from "@/playgrounds/types"
import { toEngineRobot } from "./playground-host"
import { isRoverRescuePlayground } from "./playground-motion"
import type { HostRobotPose } from "./program-types"

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
    y: isRoverRescuePlayground(playgroundId)
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
  if (isRoverRescuePlayground(playgroundId)) {
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
  if (isRoverRescuePlayground(playgroundId)) return screenToWorld(point, cam, viewport)
  return reefScreenToWorld(point.x, point.y, cam, viewport)
}

export interface DrivePrediction {
  /** Where the rover ends up, after walls, obstacles and the river. */
  endMm: { x: number; y: number }
  requestedMm: number
  reachableMm: number
  blocked: boolean
  inRiver: boolean
}

/** What the drive will actually do, so the preview matches the run. */
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
  const raw = driveEndMm(playgroundId, robot, direction, distanceMm)
  const reached = (end: { x: number; y: number }, blocked: boolean, inRiver: boolean): DrivePrediction => ({
    endMm: end,
    requestedMm: distanceMm,
    reachableMm: Math.hypot(end.x - robot.x, end.y - robot.y),
    blocked,
    inRiver,
  })

  if (!isRoverRescuePlayground(playgroundId)) {
    const bounds = playgroundWorldBounds(world)
    const clamped = {
      x: Math.min(bounds.maxX, Math.max(bounds.minX, raw.x)),
      y: Math.min(bounds.maxY, Math.max(bounds.minY, raw.y)),
    }
    const hitWall = clamped.x !== raw.x || clamped.y !== raw.y
    return reached(clamped, hitWall, false)
  }

  const wall = clampRoverMm(raw.x, raw.y)
  const resolved = resolveRoverMove(
    { x: robot.x, y: robot.y },
    { x: wall.xMm, y: wall.yMm },
    roverState.index,
    riverHazardFromState(roverState),
  )
  return reached({ x: resolved.xMm, y: resolved.yMm }, resolved.blocked, resolved.inRiver)
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
  const toward = isRoverRescuePlayground(playgroundId)
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
  robot,
  direction,
  distanceMm,
}: {
  ctx: CanvasRenderingContext2D
  playgroundId: string
  playground: PlaygroundDefinition<any>
  reefState: OceanReefState
  roverState: RoverRescueState
  robot: HostRobotPose
  direction: string
  distanceMm: number
}): void {
  const viewport: Viewport = { widthPx: ctx.canvas.width, heightPx: ctx.canvas.height }
  const cam = fitToBounds(playgroundWorldBounds(playground.world), viewport)
  const engineRobot = toEngineRobot(robot)
  if (isRoverRescuePlayground(playgroundId)) {
    playground.render(ctx, roverState, engineRobot, cam)
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
