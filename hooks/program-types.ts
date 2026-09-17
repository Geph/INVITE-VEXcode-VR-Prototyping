import type React from "react"
import type { PlaygroundDefinition } from "@/playgrounds/types"

/**
 * Thrown to unwind a running block program. Generated code has no way to
 * `return`, so stopping means rejecting at the next `await` and swallowing it.
 */
export class ProgramStopped extends Error {
  constructor() {
    super("Program stopped")
    this.name = "ProgramStopped"
  }
}

/** One row of the VEX print console. `print` appends to the last row. */
export interface ConsoleLine {
  text: string
  color: string
}

export const PRINT_COLORS: Record<string, string> = {
  black: "#d1fae5",
  red: "#f87171",
  green: "#4ade80",
  blue: "#60a5fa",
}

export interface HostRobotPose {
  x: number
  y: number
  rotation: number
}

export interface HostRobotState extends HostRobotPose {
  driveVelocity: number
  turnVelocity: number
  heading: number
}

export interface ProgramRuntime {
  driveVelocity: number
  turnVelocity: number
  driveTimeoutSec: number | null
  heading: number
  penDown: boolean
  penColor: string
  penWidth: number
  magnetBoost: boolean
  printPrecision: number
  printColor: string
  lastPenPoint: { x: number; y: number } | null
}

export interface ProgramGameState {
  trashCollected: number
  trashTotal: number
  batteryPercent: number
  isGameOver: boolean
  isSpawningTrash: boolean
  gameLost: boolean
  runError: string | null
  showCelebration: boolean
  missionEndReason: "coral" | "battery" | "complete" | "river" | null
  /** Rover Rescue in-game days survived. Ocean Reef leaves this at 0. */
  missionDays: number
}

export interface RobotCapabilities {
  eyeSensor: boolean
  bumperSensor: boolean
}

export interface PlaygroundView {
  widthPx: number
  heightPx: number
  maximized: boolean
}

export type AnimateRobotFluidFn = (
  targetState: Partial<HostRobotState>,
  duration: number | undefined,
  robotStateRef: React.MutableRefObject<HostRobotPose>,
) => Promise<void>

export interface ProgramRunnerDeps {
  workspace: any
  robotStateRef: React.MutableRefObject<HostRobotPose>
  setRobotState: React.Dispatch<React.SetStateAction<HostRobotState>>
  runtimeRef: React.MutableRefObject<ProgramRuntime>
  reefStateRef: React.MutableRefObject<any>
  roverStateRef?: React.MutableRefObject<any>
  activePlayground: Pick<PlaygroundDefinition<any>, "id" | "createApi" | "world">
  robotCapabilities: RobotCapabilities
  getView: () => PlaygroundView
  animateRobotFluidRef: React.MutableRefObject<AnimateRobotFluidFn>
  deployTrashFieldRef: React.MutableRefObject<() => void>
  cancelRobotAnimation: () => void
  setGameState: React.Dispatch<React.SetStateAction<ProgramGameState>>
  setPenTrail: React.Dispatch<
    React.SetStateAction<{ x1: number; y1: number; x2: number; y2: number; color: string; width: number }[]>
  >
  coralGraceUntilRef: React.MutableRefObject<number>
  trashSpawnIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>
  syncTrashItems: (items: any[]) => void
}
