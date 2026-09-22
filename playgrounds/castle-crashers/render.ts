import type { Camera, RobotState } from "@/engine"
import { drawCastleField, drawCastlePieces, drawCastleRobot } from "./art/draw"
import type { CastleCrashersState } from "./state"

export function renderCastleCrashers(
  ctx: CanvasRenderingContext2D,
  state: CastleCrashersState,
  robot: RobotState,
  cam: Camera,
): void {
  const viewport = { widthPx: ctx.canvas.width, heightPx: ctx.canvas.height }
  drawCastleField(ctx, cam, viewport, state.elapsedMs)
  drawCastlePieces(ctx, state.pieces, cam, viewport)
  drawCastleRobot(ctx, robot, cam, viewport)
}
