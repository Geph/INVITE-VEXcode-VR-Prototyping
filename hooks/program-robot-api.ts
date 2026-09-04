import type React from "react"
import { createRng, type RobotState as EngineRobotState } from "@/engine"
import { clampRobotMm } from "@/playgrounds/ocean-reef"
import {
  distanceToPixels,
  driveDurationMs,
  normalizeDegrees,
  shortestRotationDelta,
  turnDurationMs,
} from "@/lib/robot-runtime"
import {
  PRINT_COLORS,
  ProgramStopped,
  type AnimateRobotFluidFn,
  type ConsoleLine,
  type HostRobotPose,
  type HostRobotState,
  type PlaygroundView,
  type ProgramRuntime,
  type RobotCapabilities,
} from "./program-types"
import type { PlaygroundDefinition } from "@/playgrounds/types"

export interface ProgramRobotApiContext {
  runtimeRef: { current: ProgramRuntime }
  robotStateRef: { current: HostRobotPose }
  reefStateRef: { current: any }
  setRobotState: React.Dispatch<React.SetStateAction<HostRobotState>>
  setConsoleLines: React.Dispatch<React.SetStateAction<ConsoleLine[]>>
  setIsRunning: React.Dispatch<React.SetStateAction<boolean>>
  setIsPausedOnBlock: React.Dispatch<React.SetStateAction<boolean>>
  robotCapabilities: RobotCapabilities
  stopRequestedRef: { current: boolean }
  stepModeRef: { current: boolean }
  pendingStepRef: { current: boolean }
  stepGateRef: { current: (() => void) | null }
  isRunningRef: { current: boolean }
  trashSpawnIntervalRef: { current: NodeJS.Timeout | null }
  highlightProgramBlock: (blockId: string | null) => void
  cancelRobotAnimation: () => void
  animateRobotFluid: AnimateRobotFluidFn
  activePlayground: { createApi: PlaygroundDefinition<any>["createApi"] }
  getView: () => PlaygroundView
}

export type ProgramRobotAPI = ReturnType<typeof createProgramRobotApi>["robotAPI"]

export function createProgramRobotApi(ctx: ProgramRobotApiContext) {
  const currentView = () => ctx.getView()

  const clampPosition = (xMm: number, yMm: number) => clampRobotMm(xMm, yMm, currentView())

  /** Print precision applies to numeric values only; text passes through. */
  const formatPrint = (value: unknown): string => {
    if (typeof value === "boolean") return value ? "true" : "false"
    const raw = typeof value === "string" ? value : String(value)
    if (raw.trim() === "") return raw
    const asNum = Number(raw)
    if (!Number.isFinite(asNum)) return raw
    const precision = ctx.runtimeRef.current.printPrecision
    const decimals = Math.max(0, Math.round(-Math.log10(precision > 0 ? precision : 1)))
    return asNum.toFixed(decimals)
  }

  /** VEX `print` writes into the current row; only the cursor block advances it. */
  const appendConsole = (value: unknown) => {
    const chunk = formatPrint(value)
    const color = PRINT_COLORS[ctx.runtimeRef.current.printColor] ?? PRINT_COLORS.black
    ctx.setConsoleLines((prev) => {
      if (prev.length === 0) return [{ text: chunk, color }]
      const next = prev.slice()
      const last = next[next.length - 1]
      next[next.length - 1] = { text: last.text + chunk, color }
      return next
    })
  }

  const nextConsoleRow = () => {
    ctx.setConsoleLines((prev) => [...prev, { text: "", color: PRINT_COLORS.black }])
  }

  /** Runtime/system messages always get their own row. */
  const pushConsoleLine = (text: string, color = PRINT_COLORS.black) => {
    ctx.setConsoleLines((prev) => [...prev, { text, color }])
  }

  /** Generated code has no early return, so unwind via throw at each await. */
  const throwIfStopped = () => {
    if (ctx.stopRequestedRef.current) throw new ProgramStopped()
  }

  // Serialize drivetrain motion so concurrent when_started threads queue
  // instead of fighting over the same animation.
  let motionQueue: Promise<void> = Promise.resolve()
  const withMotionLock = async <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = motionQueue.then(fn, fn)
    motionQueue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  const engineRobotRef = {
    get current(): EngineRobotState {
      return {
        xMm: ctx.robotStateRef.current.x,
        yMm: ctx.robotStateRef.current.y,
        headingDeg: ctx.robotStateRef.current.rotation,
        driveVelocity: ctx.runtimeRef.current.driveVelocity,
        turnVelocity: ctx.runtimeRef.current.turnVelocity,
        driveTimeoutMs: ctx.runtimeRef.current.driveTimeoutSec != null ? ctx.runtimeRef.current.driveTimeoutSec * 1000 : null,
      }
    },
    set current(next: EngineRobotState) {
      ctx.robotStateRef.current = { x: next.xMm, y: next.yMm, rotation: next.headingDeg }
    },
  }
  const playgroundApi = ctx.activePlayground.createApi({
    robot: engineRobotRef,
    world: ctx.reefStateRef,
    writeConsole: (text, color) => pushConsoleLine(text, color),
    stopped: { get current() { return ctx.stopRequestedRef.current } },
    rng: createRng(1),
  }) as any

  const robotAPI = {
    /**
     * Injected before every statement by `STATEMENT_PREFIX`. Highlights the
     * block that is about to run, and in step mode parks there until the
     * learner asks for the next one.
     */
    __step: async (blockId: string) => {
      throwIfStopped()
      ctx.highlightProgramBlock(blockId)
      if (!ctx.stepModeRef.current) return
      if (ctx.pendingStepRef.current) {
        ctx.pendingStepRef.current = false
        return
      }
      ctx.setIsPausedOnBlock(true)
      await new Promise<void>((resolve) => {
        ctx.stepGateRef.current = resolve
      })
      ctx.setIsPausedOnBlock(false)
      throwIfStopped()
    },
    drive: async (direction: string, distance?: number, unit?: string) =>
      withMotionLock(async () => {
        throwIfStopped()
        const sign = direction === "forward" ? 1 : -1
        const distanceMm =
          distance === undefined ? 200 : unit === "inches" || unit === "INCHES" ? Number(distance) * 25.4 : Number(distance)
        const angleRad = (ctx.robotStateRef.current.rotation * Math.PI) / 180
        const rawX = ctx.robotStateRef.current.x + sign * distanceMm * Math.sin(angleRad)
        const rawY = ctx.robotStateRef.current.y - sign * distanceMm * Math.cos(angleRad)
        const { xMm: targetX, yMm: targetY } = clampPosition(rawX, rawY)
        const actualMm = Math.hypot(targetX - ctx.robotStateRef.current.x, targetY - ctx.robotStateRef.current.y)
        const duration = driveDurationMs(distanceToPixels(actualMm, "mm"), ctx.runtimeRef.current.driveVelocity)
        const drivePromise = ctx.animateRobotFluid({ x: targetX, y: targetY }, duration, ctx.robotStateRef)
        if (ctx.runtimeRef.current.driveTimeoutSec != null) {
          let timer: ReturnType<typeof setTimeout> | undefined
          const timeout = new Promise<"timeout">((resolve) => {
            timer = setTimeout(() => resolve("timeout"), ctx.runtimeRef.current.driveTimeoutSec! * 1000)
          })
          const outcome = await Promise.race([drivePromise.then(() => "done" as const), timeout])
          if (timer) clearTimeout(timer)
          if (outcome === "timeout") {
            // Settle the movement promise; leaving it pending would hang the program.
            ctx.cancelRobotAnimation()
            await drivePromise
          }
        } else {
          await drivePromise
        }
        throwIfStopped()
      }),
    turn: async (direction: string, degrees?: number) =>
      withMotionLock(async () => {
        throwIfStopped()
        const multiplier = direction === "right" ? 1 : -1
        const turnAmount = degrees === undefined ? 90 : Number(degrees)
        const targetRotation = normalizeDegrees(ctx.robotStateRef.current.rotation + turnAmount * multiplier)
        const delta = Math.abs(shortestRotationDelta(ctx.robotStateRef.current.rotation, targetRotation))
        const duration = turnDurationMs(delta, ctx.runtimeRef.current.turnVelocity)
        await ctx.animateRobotFluid({ rotation: targetRotation }, duration, ctx.robotStateRef)
        throwIfStopped()
      }),
    turnToHeading: async (heading: number) =>
      withMotionLock(async () => {
        throwIfStopped()
        const target = normalizeDegrees(Number(heading))
        const delta = Math.abs(shortestRotationDelta(ctx.robotStateRef.current.rotation, target))
        const duration = turnDurationMs(delta, ctx.runtimeRef.current.turnVelocity)
        await ctx.animateRobotFluid({ rotation: target }, duration, ctx.robotStateRef)
        ctx.runtimeRef.current.heading = target
        throwIfStopped()
      }),
    turnToRotation: async (rotation: number) =>
      withMotionLock(async () => {
        throwIfStopped()
        const target = normalizeDegrees(Number(rotation))
        const delta = Math.abs(shortestRotationDelta(ctx.robotStateRef.current.rotation, target))
        const duration = turnDurationMs(delta, ctx.runtimeRef.current.turnVelocity)
        await ctx.animateRobotFluid({ rotation: target }, duration, ctx.robotStateRef)
        throwIfStopped()
      }),
    stopDriving: () => {
      ctx.cancelRobotAnimation()
    },
    setDriveVelocity: (velocity: number) => {
      ctx.runtimeRef.current.driveVelocity = Number(velocity)
      ctx.setRobotState((prev) => ({ ...prev, driveVelocity: Number(velocity) }))
    },
    setTurnVelocity: (velocity: number) => {
      ctx.runtimeRef.current.turnVelocity = Number(velocity)
      ctx.setRobotState((prev) => ({ ...prev, turnVelocity: Number(velocity) }))
    },
    setDriveHeading: (heading: number) => {
      const h = normalizeDegrees(Number(heading))
      ctx.runtimeRef.current.heading = h
      ctx.setRobotState((prev) => ({ ...prev, heading: h, rotation: h }))
      ctx.robotStateRef.current.rotation = h
    },
    setDriveRotation: (rotation: number) => {
      const r = normalizeDegrees(Number(rotation))
      ctx.setRobotState((prev) => ({ ...prev, rotation: r }))
      ctx.robotStateRef.current.rotation = r
    },
    setDriveTimeout: async (seconds: number) => {
      ctx.runtimeRef.current.driveTimeoutSec = Number(seconds)
    },
    energize: (device: string, mode: string) => {
      playgroundApi.energize(device, mode)
      ctx.runtimeRef.current.magnetBoost = mode === "boost"
      if (mode === "drop") ctx.runtimeRef.current.magnetBoost = false
    },
    movePen: (position: string) => {
      ctx.runtimeRef.current.penDown = position === "down"
      if (ctx.runtimeRef.current.penDown) {
        ctx.runtimeRef.current.lastPenPoint = { ...ctx.robotStateRef.current }
      }
    },
    setPenWidth: (width: string) => {
      const widths: Record<string, number> = { thin: 1, medium: 3, thick: 6 }
      ctx.runtimeRef.current.penWidth = widths[width] ?? 2
    },
    setPenColor: (color: string) => {
      const colors: Record<string, string> = {
        black: "#000000",
        red: "#E74C3C",
        blue: "#3498DB",
        green: "#27AE60",
        yellow: "#F1C40F",
        purple: "#9B59B6",
        orange: "#E67E22",
      }
      ctx.runtimeRef.current.penColor = colors[color] ?? color
    },
    print: (text: unknown) => {
      appendConsole(text)
    },
    wait: async (seconds: number) => {
      throwIfStopped()
      const ms = Math.max(0, Number(seconds) * 1000)
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(ms) ? ms : 0))
      // Loop bodies yield through `wait`, so this is where stops get noticed.
      throwIfStopped()
    },
    setCursorNextRow: () => {
      nextConsoleRow()
    },
    clearAllRows: () => {
      ctx.setConsoleLines([])
    },
    setPrintPrecision: (precision: number) => {
      const value = Number(precision)
      ctx.runtimeRef.current.printPrecision = Number.isFinite(value) && value > 0 ? value : 1
    },
    setPrintColor: (color: string) => {
      ctx.runtimeRef.current.printColor = String(color).toLowerCase()
    },
    bumperPressed: (bumper: string) => {
      if (!ctx.robotCapabilities.bumperSensor) return false
      return playgroundApi.bumperPressed(bumper)
    },
    distanceFoundObject: (sensor: string) => playgroundApi.distanceFoundObject(sensor),
    getDistance: (sensor: string, unit: string) => playgroundApi.getDistance(sensor, unit),
    eyeIsNear: (sensor: string) => {
      if (!ctx.robotCapabilities.eyeSensor) return false
      return playgroundApi.eyeIsNear(sensor)
    },
    eyeDetectsColor: (sensor: string, color: string) => {
      if (!ctx.robotCapabilities.eyeSensor) return false
      return playgroundApi.eyeDetectsColor(sensor, color)
    },
    eyeBrightness: (sensor: string) => {
      if (!ctx.robotCapabilities.eyeSensor) return 0
      return playgroundApi.eyeBrightness(sensor)
    },
    getPosition: (axis: string, unit: string) => playgroundApi.getPosition(axis, unit),
    getPositionAngle: () => playgroundApi.getPositionAngle(),
    stop: () => {
      ctx.stopRequestedRef.current = true
      ctx.cancelRobotAnimation()
      if (ctx.trashSpawnIntervalRef.current) {
        clearInterval(ctx.trashSpawnIntervalRef.current)
        ctx.trashSpawnIntervalRef.current = null
      }
      ctx.isRunningRef.current = false
      ctx.setIsRunning(false)
      // Abandon the rest of the program, including any enclosing forever loop.
      throw new ProgramStopped()
    },
  }

  return { robotAPI, pushConsoleLine }
}

/** Poll bumper state and fire each `when_bumper` stack on its edge. */
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
