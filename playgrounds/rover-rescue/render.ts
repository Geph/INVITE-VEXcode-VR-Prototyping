import type { Camera, RobotState } from "@/engine"
import { drawBase } from "./art/base"
import { drawBridges } from "./art/bridges"
import { drawDebugOverlay } from "./art/debug"
import { drawGrid } from "./art/grid"
import { drawRiver } from "./art/river"
import { drawRover } from "./art/rover"
import { drawTerrain } from "./art/terrain"
import { drawEntities } from "./art/entities"
import { drawAiOverlay } from "./art/ai-overlay"
import { createDrawWorld } from "./art/world-draw"
import { riverHazardFromState, type RoverRescueState } from "./state"

export function renderRoverRescue(
  ctx: CanvasRenderingContext2D,
  state: RoverRescueState,
  robot: RobotState,
  cam: Camera,
): void {
  const world = createDrawWorld(ctx, cam)
  ctx.save()
  drawTerrain(world, state.seed, state.zones)
  drawRiver(world, state.seed, state.elapsedMs, riverHazardFromState(state), state.riverCenterline)
  drawBridges(world, state.seed, state.bridges)
  drawBase(world)
  drawGrid(world)
  drawEntities(world, state.index)
  drawRover(world, robot, state.seed)
  ctx.restore()
}

export function renderRoverRescueOverlay(
  ctx: CanvasRenderingContext2D,
  state: RoverRescueState,
  robot: RobotState,
  cam: Camera,
): void {
  const world = createDrawWorld(ctx, cam)
  drawAiOverlay(world, state, robot)
  if (!state.debug) return
  drawDebugOverlay(world, state.zones, riverHazardFromState(state), state.bridges, state.riverCenterline)
}
