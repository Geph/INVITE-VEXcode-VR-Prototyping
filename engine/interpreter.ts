/**
 * Program runner and event-hat registry. No React — the host supplies the
 * `robot` API and calls `poll`.
 */

export class ProgramStopped extends Error {
  constructor(message = "Program stopped") {
    super(message)
    this.name = "ProgramStopped"
  }
}

type AsyncRobotFn = (robot: unknown) => Promise<void>

function compileBody(body: string): AsyncRobotFn {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
    ...args: string[]
  ) => AsyncRobotFn
  return new AsyncFunction("robot", body)
}

export function compileProgram(body: string): AsyncRobotFn {
  return compileBody(body)
}

export async function runProgram(body: string, robot: unknown): Promise<void> {
  const fn = compileBody(body)
  try {
    await fn(robot)
  } catch (error) {
    if (error instanceof ProgramStopped) return
    throw error
  }
}

export type HatEdge = "rising" | "falling" | "level"

export interface EventHat {
  id: string
  predicate: () => boolean
  /** Source text compiled against `robot`, or a ready async function. */
  body: string | AsyncRobotFn
  /** Default `rising`: fire when the predicate becomes true. */
  edge?: HatEdge
}

interface ArmedHat {
  id: string
  predicate: () => boolean
  run: AsyncRobotFn
  edge: HatEdge
  was: boolean
  busy: boolean
}

/**
 * Polls predicates and fires handler bodies. A handler that is still running
 * is not re-entered (same guard as the Ocean Reef bumper watchers).
 */
export class EventHatRegistry {
  private hats: ArmedHat[] = []
  private stopped = false
  private onError: ((error: unknown, id: string) => void) | null = null

  constructor(hats: EventHat[] = []) {
    for (const hat of hats) this.register(hat)
  }

  onHandlerError(handler: (error: unknown, id: string) => void): this {
    this.onError = handler
    return this
  }

  register(hat: EventHat): void {
    this.hats.push({
      id: hat.id,
      predicate: hat.predicate,
      run: typeof hat.body === "function" ? hat.body : compileBody(hat.body),
      edge: hat.edge ?? "rising",
      was: false,
      busy: false,
    })
  }

  /** Sample every hat. Safe to call from an interval or the clock. */
  poll(robot: unknown): void {
    if (this.stopped) return
    for (const hat of this.hats) {
      const now = !!hat.predicate()
      const fire =
        hat.edge === "level"
          ? now
          : hat.edge === "falling"
            ? hat.was && !now
            : !hat.was && now
      hat.was = now
      if (!fire || hat.busy) continue
      hat.busy = true
      hat
        .run(robot)
        .catch((error: unknown) => {
          if (error instanceof ProgramStopped) return
          this.onError?.(error, hat.id)
        })
        .finally(() => {
          hat.busy = false
        })
    }
  }

  /** True while any handler is in flight. */
  get busy(): boolean {
    return this.hats.some((hat) => hat.busy)
  }

  stop(): void {
    this.stopped = true
  }

  resume(): void {
    this.stopped = false
  }

  clear(): void {
    this.hats = []
    this.stopped = false
  }
}
