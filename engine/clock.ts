import type { TickContext } from "./types"

/** 60 Hz simulation step. */
export const STEP_MS = 1000 / 60

const MAX_STEPS_PER_FRAME = 8

export class SimulationClock {
  readonly stepMs = STEP_MS
  /** Multiplies incoming real time (2 = in-game time runs twice as fast). */
  scale = 1
  gameTimeMs = 0
  stepIndex = 0
  private accumulator = 0

  context(): TickContext {
    return {
      dtMs: this.stepMs,
      stepMs: this.stepMs,
      gameTimeMs: this.gameTimeMs,
      stepIndex: this.stepIndex,
    }
  }

  reset(): void {
    this.gameTimeMs = 0
    this.stepIndex = 0
    this.accumulator = 0
  }

  /**
   * Advance from a render-frame delta. A slow frame runs several fixed steps;
   * leftover time stays in the accumulator.
   */
  pushFrame(realDtMs: number, onStep: (ctx: TickContext) => void): number {
    const dt = Number.isFinite(realDtMs) ? Math.max(0, realDtMs) : 0
    this.accumulator += dt * this.scale
    let ran = 0
    while (this.accumulator >= STEP_MS && ran < MAX_STEPS_PER_FRAME) {
      this.advanceOne(onStep)
      this.accumulator -= STEP_MS
      ran++
    }
    return ran
  }

  /**
   * Run steps without rendering until `until` is true or `maxSteps` is hit.
   * Used by Rover Rescue standby.
   */
  fastForward(until: (ctx: TickContext) => boolean, maxSteps: number): TickContext {
    const cap = Math.max(0, Math.floor(maxSteps))
    for (let i = 0; i < cap; i++) {
      this.advanceOne()
      const ctx = this.context()
      if (until(ctx)) return ctx
    }
    return this.context()
  }

  private advanceOne(onStep?: (ctx: TickContext) => void): void {
    this.gameTimeMs += STEP_MS
    this.stepIndex += 1
    onStep?.(this.context())
  }
}
