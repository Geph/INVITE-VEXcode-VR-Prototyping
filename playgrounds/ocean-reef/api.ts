import type { RobotState } from "@/engine"
import {
  BUMPER_CONTACT_MARGIN_PX,
  BUMPER_FORWARD_PX,
  BUMPER_LATERAL_PX,
  clampRobotPosition,
  DISTANCE_SENSOR_MAX_MM,
  EYE_NEAR_MM,
  fieldMmToPixel,
  isTrashNearEye,
  nearestTrashDistanceMm,
  nearestTrashInFrontMm,
  normalizeDegrees,
  pixelsToDistance,
  pointHitsCoral,
  raycastToBorder,
} from "@/lib/robot-runtime"
import type { PlaygroundApiDeps } from "../types"
import { coralToPixelPieces, trashToPixelItems, type OceanReefState, type OceanReefView } from "./entities"

export function poseToCanvas(xMm: number, yMm: number, view: OceanReefView): { x: number; y: number } {
  return fieldMmToPixel(xMm, yMm, view.widthPx, view.heightPx)
}

export function canvasToPoseUnrounded(x: number, y: number, view: OceanReefView): { xMm: number; yMm: number } {
  return {
    xMm: pixelsToDistance(x - view.widthPx / 2, "mm"),
    yMm: pixelsToDistance(y - view.heightPx / 2, "mm"),
  }
}

export function clampRobotMm(xMm: number, yMm: number, view: OceanReefView): { xMm: number; yMm: number } {
  const px = poseToCanvas(xMm, yMm, view)
  const clamped = clampRobotPosition(px.x, px.y, view.widthPx, view.heightPx)
  return canvasToPoseUnrounded(clamped.x, clamped.y, view)
}

/** Ocean Reef +Y is canvas-down, matching today's pixel drive math. */
export function applyDrive(
  robot: RobotState,
  direction: string,
  distanceMm: number,
  view: OceanReefView,
): RobotState {
  const sign = direction === "forward" ? 1 : -1
  const angleRad = (robot.headingDeg * Math.PI) / 180
  const rawX = robot.xMm + sign * distanceMm * Math.sin(angleRad)
  const rawY = robot.yMm - sign * distanceMm * Math.cos(angleRad)
  const clamped = clampRobotMm(rawX, rawY, view)
  return { ...robot, xMm: clamped.xMm, yMm: clamped.yMm }
}

export function applyTurn(robot: RobotState, direction: string, degrees: number): RobotState {
  const multiplier = direction === "right" ? 1 : -1
  return { ...robot, headingDeg: normalizeDegrees(robot.headingDeg + degrees * multiplier) }
}

export function reportedPositionMm(robot: RobotState): { x: number; y: number } {
  return { x: Math.round(robot.xMm), y: Math.round(robot.yMm) }
}

function worldPixels(state: OceanReefState) {
  return {
    coral: coralToPixelPieces(state.coral, state.view),
    trash: trashToPixelItems(state.trash, state.view),
  }
}

function robotPixels(robot: RobotState, view: OceanReefView) {
  const pos = poseToCanvas(robot.xMm, robot.yMm, view)
  return { x: pos.x, y: pos.y, rotation: robot.headingDeg }
}

export function collectTrash(state: OceanReefState, robot: RobotState): OceanReefState {
  const scale = state.view.maximized ? 1.5 : 1
  const robotSize = 30 * scale
  const magnetRange = state.magnetEnergized ? 40 : 0
  const robotPx = poseToCanvas(robot.xMm, robot.yMm, state.view)

  let collectedCount = 0
  const trash = state.trash.map((item) => {
    if (item.isCollected) return item
    const trashPx = poseToCanvas(item.xMm, item.yMm, state.view)
    const distance = Math.hypot(robotPx.x - trashPx.x, robotPx.y - trashPx.y)
    const pickupRadius = robotSize * 0.5 + 15 * scale * item.scale
    const magnetRadius = magnetRange > 0 ? magnetRange + 15 * scale * item.scale : 0
    if (distance < pickupRadius || distance < magnetRadius) {
      collectedCount++
      return { ...item, isCollected: true }
    }
    return item
  })

  if (collectedCount === 0) return state
  const trashCollected = state.trashCollected + collectedCount
  const remaining = trash.filter((item) => !item.isCollected).length
  return {
    ...state,
    trash,
    trashCollected,
    missionOver: remaining === 0 ? true : state.missionOver,
    missionReason: remaining === 0 ? "complete" : state.missionReason,
  }
}

export function hitsCoral(state: OceanReefState, robot: RobotState): boolean {
  if (state.coral.length === 0) return false
  const robotPx = poseToCanvas(robot.xMm, robot.yMm, state.view)
  const coral = coralToPixelPieces(state.coral, state.view)
  const robotRadius = 22
  for (const piece of coral) {
    if (Math.hypot(robotPx.x - piece.x, robotPx.y - piece.y) < robotRadius + piece.radius) {
      return true
    }
  }
  return false
}

export function tickOceanReef(state: OceanReefState, dtMs: number, robot: RobotState): OceanReefState {
  void dtMs
  let next = collectTrash(state, robot)
  if (!next.missionOver && hitsCoral(next, robot)) {
    next = { ...next, missionOver: true, missionReason: "coral" }
  }
  return next
}

export function createOceanReefApi(deps: PlaygroundApiDeps<OceanReefState>): Record<string, (...args: any[]) => unknown> {
  const readWorld = () => {
    const state = deps.world.current
    const robot = deps.robot.current
    const px = robotPixels(robot, state.view)
    const { coral, trash } = worldPixels(state)
    return { state, robot, px, coral, trash }
  }

  return {
    bumperPressed: (bumper: string) => {
      const { px, coral } = readWorld()
      const side = bumper.toLowerCase() === "left" ? -1 : 1
      const angleRad = (px.rotation * Math.PI) / 180
      const probeX = px.x + Math.sin(angleRad) * BUMPER_FORWARD_PX + Math.cos(angleRad) * BUMPER_LATERAL_PX * side
      const probeY = px.y - Math.cos(angleRad) * BUMPER_FORWARD_PX + Math.sin(angleRad) * BUMPER_LATERAL_PX * side
      return pointHitsCoral(probeX, probeY, coral, BUMPER_CONTACT_MARGIN_PX)
    },
    distanceFoundObject: (sensor: string) => {
      const { state, px, coral, trash } = readWorld()
      if (sensor === "down") {
        const mm = nearestTrashDistanceMm(px.x, px.y, trash)
        if (mm != null && mm < EYE_NEAR_MM) return true
      } else {
        const frontMm = nearestTrashInFrontMm(px.x, px.y, px.rotation, trash, DISTANCE_SENSOR_MAX_MM)
        if (frontMm != null) return true
      }
      const dist = raycastToBorder(px.x, px.y, px.rotation, state.view.widthPx, state.view.heightPx, coral, DISTANCE_SENSOR_MAX_MM)
      return dist < DISTANCE_SENSOR_MAX_MM
    },
    getDistance: (sensor: string, unit: string) => {
      const { state, px, coral, trash } = readWorld()
      const borderMm = raycastToBorder(
        px.x,
        px.y,
        px.rotation,
        state.view.widthPx,
        state.view.heightPx,
        coral,
        DISTANCE_SENSOR_MAX_MM,
      )
      const trashMm =
        sensor === "down"
          ? nearestTrashDistanceMm(px.x, px.y, trash)
          : nearestTrashInFrontMm(px.x, px.y, px.rotation, trash, DISTANCE_SENSOR_MAX_MM)
      const valueMm = trashMm != null && trashMm < borderMm ? trashMm : borderMm
      return unit === "inches" ? valueMm / 25.4 : valueMm
    },
    eyeIsNear: (sensor: string) => {
      const { px, trash } = readWorld()
      const eye = sensor === "down" ? "down" : "front"
      return isTrashNearEye(px.x, px.y, px.rotation, trash, eye, EYE_NEAR_MM)
    },
    eyeDetectsColor: (_sensor: string, color: string) => {
      const { px, coral, trash } = readWorld()
      const trashColors: Record<string, string[]> = {
        red: ["can"],
        green: ["bag"],
        blue: ["bottle"],
        yellow: ["wrapper"],
        orange: ["wrapper"],
        purple: ["bag"],
      }
      const matching = trashColors[color] ?? []
      for (const t of trash) {
        if (t.isCollected) continue
        if (Math.hypot(px.x - t.x, px.y - t.y) > 40) continue
        if (matching.includes(t.type)) return true
      }
      if (color === "red" || color === "orange") {
        return pointHitsCoral(px.x, px.y, coral, 20)
      }
      return false
    },
    eyeBrightness: (_sensor: string) => {
      const { px, coral, trash } = readWorld()
      if (pointHitsCoral(px.x, px.y, coral, 15)) return 25
      const nearTrash = nearestTrashDistanceMm(px.x, px.y, trash)
      if (nearTrash != null && nearTrash < EYE_NEAR_MM) return 40
      return 85
    },
    getPosition: (axis: string, unit: string) => {
      const field = reportedPositionMm(deps.robot.current)
      const mm = axis.toLowerCase() === "x" ? field.x : field.y
      return unit.toLowerCase() === "inches" ? mm / 25.4 : mm
    },
    getPositionAngle: () => normalizeDegrees(deps.robot.current.headingDeg),
    energize: (_device: string, mode: string) => {
      deps.world.current = {
        ...deps.world.current,
        magnetEnergized: mode === "boost",
      }
    },
  }
}
