import type { ComponentType } from "react"
import type { Camera, RobotState, SeededRng } from "@/engine"

export type { Camera, RobotState }

export interface BlockCategory {
  id: string
  label: string
  colour: string
  define: (Blockly: any) => void
  toolbox: Array<{ kind: string; type: string }>
}

export interface PlaygroundApiDeps<S = unknown> {
  robot: { current: RobotState }
  world: { current: S }
  writeConsole: (text: string, color?: string) => void
  stopped: { readonly current: boolean }
  rng: SeededRng
}

export interface PlaygroundDefinition<S = unknown> {
  id: string
  name: string
  world: {
    widthMm: number
    heightMm: number
    gridMm: number
    startPose: { xMm: number; yMm: number; headingDeg: number }
    camera: { minZoom: number; maxZoom: number; initialZoom: number; follow: boolean }
  }
  createState(seed: number): S
  reset(state: S, seed: number): S
  tick(state: S, dtMs: number, robot: RobotState): S
  render(ctx: CanvasRenderingContext2D, state: S, robot: RobotState, cam: Camera): void
  renderOverlay?(ctx: CanvasRenderingContext2D, state: S, robot: RobotState, cam: Camera): void
  blocks: BlockCategory[]
  createApi(deps: PlaygroundApiDeps<S>): Record<string, (...args: any[]) => unknown>
  hud?: ComponentType<{ state: S; robot: RobotState }>
  isMissionOver(state: S): { over: boolean; reason?: string; won?: boolean }
}
