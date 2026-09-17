import type { RobotState as EngineRobotState } from "@/engine"
import { getPlaygroundCanvasSize } from "@/lib/robot-runtime"
import { poseToCanvas, type OceanReefState } from "@/playgrounds/ocean-reef"
import type { HostRobotState, ProgramGameState, ProgramRuntime } from "./program-types"

export interface PlaygroundChromeState {
  x: number
  y: number
  isDragging: boolean
  dragStartX: number
  dragStartY: number
  isVisible: boolean
  isMinimized: boolean
  isMaximized: boolean
}

export interface TrashItem {
  id: number
  x: number
  y: number
  type: "bottle" | "can" | "wrapper" | "bag"
  scale: number
  floatOffset: number
  isCollected: boolean
}

export interface LiveSensors {
  field: { x: number; y: number }
  frontDistanceMm: number
  frontObjectDetected: boolean
  eyeNear: boolean
  rotation: number
  trashRemaining: number
}

export const INITIAL_RUNTIME: ProgramRuntime = {
  driveVelocity: 50,
  turnVelocity: 50,
  driveTimeoutSec: null,
  heading: 0,
  penDown: false,
  penColor: "#000000",
  penWidth: 2,
  magnetBoost: false,
  printPrecision: 1,
  printColor: "black",
  lastPenPoint: null,
}

export const INITIAL_GAME_STATE: ProgramGameState = {
  trashCollected: 0,
  trashTotal: 0,
  batteryPercent: 100,
  gameLost: false,
  isGameOver: false,
  isSpawningTrash: false,
  runError: null,
  showCelebration: false,
  missionEndReason: null,
  missionDays: 0,
}

export const INITIAL_PLAYGROUND_CHROME: PlaygroundChromeState = {
  x: 400,
  y: 100,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  isVisible: false,
  isMinimized: false,
  isMaximized: false,
}

export function toEngineRobot(
  pose: { x: number; y: number; rotation: number },
  velocities?: { driveVelocity: number; turnVelocity: number },
): EngineRobotState {
  return {
    xMm: pose.x,
    yMm: pose.y,
    headingDeg: pose.rotation,
    driveVelocity: velocities?.driveVelocity ?? 50,
    turnVelocity: velocities?.turnVelocity ?? 50,
    driveTimeoutMs: null,
  }
}

export function hostTrashFromReef(state: OceanReefState): TrashItem[] {
  return state.trash.map((item) => {
    const px = poseToCanvas(item.xMm, item.yMm, state.view)
    return {
      id: item.id,
      x: px.x,
      y: px.y,
      type: item.type,
      scale: item.scale,
      floatOffset: item.floatOffset,
      isCollected: item.isCollected,
    }
  })
}

export function reefViewFromMaximized(maximized: boolean) {
  const { w, h } = getPlaygroundCanvasSize(maximized)
  return { widthPx: w, heightPx: h, maximized }
}

export function initialHostRobot(x: number, y: number): HostRobotState {
  return {
    x,
    y,
    rotation: 0,
    driveVelocity: 50,
    turnVelocity: 50,
    heading: 0,
  }
}
