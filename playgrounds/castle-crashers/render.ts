import type { Camera, RobotState } from "@/engine"
import { drawCastleField, drawCastlePieces, drawCastlePlow, drawCastleRobot } from "./art/draw"
import type { CastleCrashersState } from "./state"
import { RESULTS_DELAY_MS } from "./config"

export function renderCastleCrashers(
  ctx: CanvasRenderingContext2D,
  state: CastleCrashersState,
  robot: RobotState,
  cam: Camera,
): void {
  const viewport = { widthPx: ctx.canvas.width, heightPx: ctx.canvas.height }
  const results = state.missionOver && state.elapsedMs - (state.endedAtMs ?? state.elapsedMs) >= RESULTS_DELAY_MS
  drawCastleField(ctx, cam, viewport, state.elapsedMs, !results)
  if (results) return
  drawCastlePieces(ctx, state.pieces, cam, viewport, state.elapsedMs)
  if (!state.plowAttached) drawCastlePlow(ctx, cam, viewport)
  if (state.missionReason !== "water") drawCastleRobot(ctx, robot, cam, viewport, state.plowAttached)
}
