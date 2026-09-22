/**
 * Standby fast-forwards mission time until battery falls to a threshold.
 * The rover is parked, so drain is the idle rate. Ticks run without a
 * matching render; the host yields every STANDBY_STEPS_PER_YIELD so the
 * HUD can show days racing.
 */

import { SimulationClock, STEP_MS, type RobotState } from "@/engine"
import { STANDBY_MAX_STEPS, STANDBY_STEPS_PER_YIELD } from "../config"
import { clampBattery } from "./battery"
import { tickRoverRescue, type RoverRescueState } from "../state"

/** Spec: if the threshold is already at or above current battery, skip. */
export function shouldEnterStandby(batteryPercent: number, thresholdPct: number): boolean {
  return clampBattery(thresholdPct) < batteryPercent
}

export function parseStandbyPercent(raw: unknown): number {
  return clampBattery(Number(raw))
}

export interface StandbyChunk {
  state: RoverRescueState
  steps: number
}

/**
 * One burst of ticks, owned by SimulationClock.fastForward so the step cap
 * is the same primitive the engine tests already cover.
 */
export function advanceStandby(
  state: RoverRescueState,
  robot: RobotState,
  thresholdPct: number,
  maxSteps: number,
): StandbyChunk {
  const clock = new SimulationClock()
  let latest: RoverRescueState = { ...state, standby: true, driveMoving: false }
  const target = clampBattery(thresholdPct)
  clock.fastForward(
    () => latest.batteryPercent <= target || latest.missionOver || latest.day50Dialog,
    maxSteps,
    () => {
      latest = tickRoverRescue(latest, STEP_MS, robot, { missionRunning: true })
    },
  )
  return { state: latest, steps: clock.stepIndex }
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve())
      return
    }
    setTimeout(resolve, 0)
  })
}

export async function runStandby(
  world: { current: RoverRescueState },
  robot: RobotState,
  rawThreshold: unknown,
  stopped: { readonly current: boolean },
): Promise<boolean> {
  const thresholdPct = parseStandbyPercent(rawThreshold)
  if (!shouldEnterStandby(world.current.batteryPercent, thresholdPct)) return false

  world.current = { ...world.current, standby: true, driveMoving: false }
  let steps = 0
  try {
    while (steps < STANDBY_MAX_STEPS && !stopped.current) {
      const current = world.current
      if (current.batteryPercent <= thresholdPct || current.missionOver || current.day50Dialog) break
      const chunk = Math.min(STANDBY_STEPS_PER_YIELD, STANDBY_MAX_STEPS - steps)
      const result = advanceStandby(current, robot, thresholdPct, chunk)
      world.current = result.state
      steps += result.steps
      if (result.steps === 0) break
      if (result.state.batteryPercent <= thresholdPct || result.state.missionOver || result.state.day50Dialog) break
      await yieldFrame()
    }
  } finally {
    if (world.current.standby) {
      world.current = { ...world.current, standby: false }
    }
  }
  return true
}
