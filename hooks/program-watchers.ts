import { EventHatRegistry } from "@/engine"
import type { ProgramRobotAPI } from "./program-robot-api"
import { ProgramStopped } from "./program-types"

/** Poll bumper state and fire each `pg_events_when_bumper` stack on its edge. */
export function startBumperWatchers(
  bumperEvents: { bumper: string; state: string; body: string }[],
  robotAPI: ProgramRobotAPI,
  stopRequestedRef: { current: boolean },
) {
  if (bumperEvents.length === 0) return () => {}

  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

  const watchers = bumperEvents.map((handler: { bumper: string; state: string; body: string }) => ({
    matches: (was: boolean, now: boolean) =>
      handler.state === "pressed" ? now && !was : was && !now,
    run: new AsyncFunction("robot", handler.body) as (robot: unknown) => Promise<void>,
    bumper: handler.bumper,
    was: false,
    busy: false,
  }))

  const timer = setInterval(() => {
    if (stopRequestedRef.current) return
    for (const watcher of watchers) {
      const now = robotAPI.bumperPressed(watcher.bumper)
      const fire = watcher.matches(watcher.was, now)
      watcher.was = now
      // Skip re-entry so a slow handler cannot stack up on itself.
      if (!fire || watcher.busy) continue
      watcher.busy = true
      watcher
        .run(robotAPI)
        .catch((error: unknown) => {
          if (!(error instanceof ProgramStopped)) console.error("Bumper handler error:", error)
        })
        .finally(() => {
          watcher.busy = false
        })
    }
  }, 50)

  return () => clearInterval(timer)
}

/** Rising-edge hats (under attack, level up) polled alongside the main program. */
export function startEdgeWatchers(
  events: { id: string; predicate: () => boolean; body: string }[],
  robotAPI: ProgramRobotAPI,
  stopRequestedRef: { current: boolean },
) {
  if (events.length === 0) return () => {}

  const registry = new EventHatRegistry(
    events.map((handler) => ({
      id: handler.id,
      predicate: handler.predicate,
      body: handler.body,
    })),
  )
  registry.onHandlerError((error, id) => {
    if (!(error instanceof ProgramStopped)) console.error(`Event hat ${id} error:`, error)
  })

  const timer = setInterval(() => {
    if (stopRequestedRef.current) return
    registry.poll(robotAPI)
  }, 50)

  return () => {
    registry.stop()
    clearInterval(timer)
  }
}
