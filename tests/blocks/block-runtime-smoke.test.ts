import { afterEach, describe, expect, it } from "vitest"
import { installAllBlocks } from "@/blocks/registry"
import { createProgramRobotApi, type ProgramRobotApiContext } from "@/hooks/program-robot-api"
import { ProgramStopped } from "@/hooks/program-types"
import { oceanReef } from "@/playgrounds/ocean-reef"
import { oceanReefBlocks } from "@/playgrounds/ocean-reef/blocks"
import { roverRescue } from "@/playgrounds/rover-rescue"
import { roverRescueBlocks } from "@/playgrounds/rover-rescue/blocks"
import { createRoverRescueState } from "@/playgrounds/rover-rescue/state"
import { castleCrashers } from "@/playgrounds/castle-crashers"
import { driveSpeedMmPerMs } from "@/engine/motion"

const HAT_TYPES = new Set([
  "pg_events_when_started",
  "pg_events_when_broadcasted",
  "pg_events_when_bumper",
  "pg_events_when_under_attack",
  "pg_events_when_level_up",
])

const ORDER = {
  ORDER_ATOMIC: 0,
  ORDER_UNARY_NEGATION: 1,
  ORDER_FUNCTION_CALL: 2,
  ORDER_MEMBER: 3,
  ORDER_MODULUS: 4,
  ORDER_ADDITION: 5,
  ORDER_RELATIONAL: 6,
  ORDER_LOGICAL_AND: 7,
  ORDER_LOGICAL_NOT: 8,
  ORDER_NONE: 99,
}

function fieldsFor(type: string): Record<string, string> {
  return {
    DIRECTION: type.includes("turn") ? "right" : "forward",
    DISTANCE: "200",
    UNIT: type.includes("position") ? "MM" : "mm",
    DEGREES: "90",
    HEADING: "90",
    ROTATION: "45",
    VELOCITY: "50",
    PERCENT: "100",
    TIMEOUT: "1",
    SECONDS: "0",
    TIMES: "1",
    TEXT: "hello",
    PRECISION: "1",
    COLOR: type.includes("eye") ? "red" : "black",
    POSITION: "down",
    WIDTH: "medium",
    OBJECT: type.includes("broadcast") ? "message1" : type.includes("go_to") ? "minerals" : "item",
    DEVICE: "magnet",
    MODE: "boost",
    BUMPER: "left",
    SENSOR: "front",
    KIND: "base",
    AXIS: "X",
    ACTION: "use",
    anddontwait_mutator: "false",
    OP: type.includes("and_or") ? "AND" : type.includes("comparison") ? "EQ" : "ADD",
    OP1: "LT",
    OP2: "LT",
    FUNC: "ABS",
    FROM: "1",
    TO: "3",
    NUM: "5",
    CODE: "# python",
    TYPE: "NUMBER",
    STATE: "pressed",
  }
}

function stubBlock(type: string) {
  const fields = fieldsFor(type)
  return {
    type,
    getFieldValue: (name: string) => fields[name] ?? "",
    getSurroundParent: () => (type === "pg_control_break" ? { type: "pg_control_repeat" } : null),
    setWarningText: () => {},
  }
}

function installGenerators(playgroundBlocks: typeof oceanReefBlocks) {
  const JavaScript = {
    ...ORDER,
    forBlock: {} as Record<string, (block: unknown) => string | [string, number]>,
    valueToCode(block: { type: string }, name: string) {
      if (name.startsWith("CONDITION")) return block.type === "pg_control_while" ? "false" : "true"
      if (name === "TEXT" || name === "SEARCH") return "'x'"
      if (name === "BOOL") return "false"
      return "1"
    },
    statementToCode(block: { type: string }) {
      if (block.type === "pg_control_forever") return "  robot.stop();\n"
      return ""
    },
  }
  ;(globalThis as unknown as { window: { Blockly: { JavaScript: typeof JavaScript } } }).window = {
    Blockly: { JavaScript },
  }
  const Blockly = { Blocks: {} as Record<string, unknown>, JavaScript }
  installAllBlocks(Blockly, { blocks: playgroundBlocks })
  return JavaScript.forBlock
}

function mockCtx(playground: typeof oceanReef | typeof roverRescue | typeof castleCrashers): ProgramRobotApiContext {
  const robotStateRef = { current: { x: 0, y: 0, rotation: 0 } }
  return {
    runtimeRef: {
      current: {
        driveVelocity: 50,
        turnVelocity: 50,
        driveTimeoutSec: null,
        heading: 0,
        penDown: false,
        penColor: "#000000",
        penWidth: 2,
        magnetBoost: false,
        printPrecision: 1,
        printColor: "black",
        lastPenPoint: null,
      },
    },
    robotStateRef,
    reefStateRef: { current: oceanReef.createState(1) },
    castleStateRef: { current: castleCrashers.createState(1) },
    roverStateRef: { current: createRoverRescueState(1) },
    setRobotState: () => {},
    setConsoleLines: () => {},
    setIsRunning: () => {},
    setIsPausedOnBlock: () => {},
    robotCapabilities: { bumperSensor: true, eyeSensor: true },
    stopRequestedRef: { current: false },
    stepModeRef: { current: false },
    pendingStepRef: { current: false },
    stepGateRef: { current: null },
    isRunningRef: { current: true },
    trashSpawnIntervalRef: { current: null },
    highlightProgramBlock: () => {},
    cancelRobotAnimation: () => {},
    animateRobotFluid: async (target, _duration, poseRef) => {
      if (target.x != null) poseRef.current.x = target.x
      if (target.y != null) poseRef.current.y = target.y
      if (target.rotation != null) poseRef.current.rotation = target.rotation
    },
    activePlayground: playground,
    getView: () => ({ widthPx: 400, heightPx: 400, maximized: false }),
  }
}

async function runGenerated(robotAPI: Record<string, unknown>, code: string) {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
    ...args: string[]
  ) => (robot: unknown) => Promise<unknown>
  try {
    return await new AsyncFunction("robot", code)(robotAPI)
  } catch (error) {
    if (error instanceof ProgramStopped) return "stopped"
    throw error
  }
}

function methodNames(code: string): string[] {
  return [...code.matchAll(/robot\.([A-Za-z_]\w*)/g)].map((match) => match[1])
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

function expectEveryGeneratorRuns(
  playgroundBlocks: typeof oceanReefBlocks,
  playground: typeof oceanReef | typeof roverRescue | typeof castleCrashers,
) {
  it("generates and executes every registered block against the robot API", async () => {
    const generators = installGenerators(playgroundBlocks)
    const types = Object.keys(generators).sort()
    expect(types.length).toBeGreaterThan(20)

    for (const type of types) {
      const generated = generators[type](stubBlock(type))
      const isExpr = Array.isArray(generated)
      const code = isExpr ? generated[0] : generated
      expect(typeof code, type).toBe("string")

      if (HAT_TYPES.has(type)) {
        expect(code, type).toBe("")
        continue
      }

      const { robotAPI } = createProgramRobotApi(mockCtx(playground))
      const api = robotAPI as unknown as Record<string, unknown>
      for (const name of methodNames(code)) {
        expect(typeof api[name], `${type} -> robot.${name}`).toBe("function")
      }

      if (isExpr) {
        const value = await runGenerated(api, `return (${code})`)
        expect(value, type).not.toBe(undefined)
        continue
      }

      const runnable = type === "pg_control_break" ? `for (let i = 0; i < 1; i++) {\n${code}}\n` : code
      const result = await runGenerated(api, runnable)
      if (type === "pg_control_stop_project" || type === "pg_control_forever") {
        expect(result, type).toBe("stopped")
      }
    }
  })
}

describe("Ocean Reef block runtime", () => {
  expectEveryGeneratorRuns(oceanReefBlocks, oceanReef)
})

describe("Castle Crasher block runtime", () => {
  expectEveryGeneratorRuns(castleCrashers.blocks, castleCrashers)

  it("drives the requested world distance left from the official start pose", async () => {
    const ctx = mockCtx(castleCrashers)
    ctx.robotStateRef.current = { x: 1014, y: 50, rotation: -90 }
    const { robotAPI } = createProgramRobotApi(ctx)
    await robotAPI.drive("forward", 200, "mm")
    expect(ctx.robotStateRef.current.x).toBeCloseTo(814)
    expect(ctx.robotStateRef.current.y).toBeCloseTo(50)
    await robotAPI.drive("reverse", 200 / 25.4, "inches")
    expect(ctx.robotStateRef.current.x).toBeCloseTo(1014)
  })

  it("marks Castle, rather than Ocean Reef, when stop project executes", () => {
    const ctx = mockCtx(castleCrashers)
    const { robotAPI } = createProgramRobotApi(ctx)
    expect(() => robotAPI.stop()).toThrow(ProgramStopped)
    expect(ctx.castleStateRef?.current.missionReason).toBe("stopped")
    expect(ctx.reefStateRef.current.projectStoppedByUser).toBe(false)
  })
})

// Regressions for the five independently reproduced audit failures.
describe("repaired block behavior gaps (see docs/BLOCK-AUDIT.md)", () => {
  it("0% velocity must keep the robot still", () => {
    expect(driveSpeedMmPerMs(0)).toBe(0)
  })

  it("set heading must not physically rotate the robot", () => {
    const ctx = mockCtx(oceanReef)
    const { robotAPI } = createProgramRobotApi(ctx)
    robotAPI.setDriveHeading(90)
    expect(ctx.robotStateRef.current.rotation).toBe(0)
  })

  it("turn right 360 must animate one complete revolution", async () => {
    const ctx = mockCtx(oceanReef)
    let requestedRotation = 0
    ctx.animateRobotFluid = async (target) => { requestedRotation = target.rotation ?? 0 }
    await createProgramRobotApi(ctx).robotAPI.turn("right", 360)
    expect(requestedRotation).toBe(360)
  })

  it("zeroes heading and rotation without moving, then turns relative to those references", async () => {
    const ctx = mockCtx(castleCrashers)
    ctx.robotStateRef.current.rotation = -90
    const { robotAPI: robot } = createProgramRobotApi(ctx)
    robot.setDriveHeading(0)
    robot.setDriveRotation(0)
    expect(ctx.robotStateRef.current.rotation).toBe(-90)
    await robot.turnToHeading(90)
    expect(ctx.robotStateRef.current.rotation).toBe(0)
    await robot.turnToRotation(720)
    expect(ctx.robotStateRef.current.rotation).toBe(630)
    await robot.turn("left", 450)
    expect(ctx.robotStateRef.current.rotation).toBe(180)
  })

  it("executes Switch movement and reports unsupported Python", async () => {
    const ctx = mockCtx(castleCrashers)
    const robot = createProgramRobotApi(ctx).robotAPI
    await robot.runSwitchCode("drivetrain.drive_for(FORWARD, 100, MM)\ndrivetrain.turn_for(RIGHT, 270, DEGREES)")
    expect(ctx.robotStateRef.current.y).toBeCloseTo(100)
    expect(ctx.robotStateRef.current.rotation).toBe(270)
    await expect(robot.runSwitchCode("import os")).rejects.toThrow("Switch Python line 1")
  })

  it("Castle position sensor must report its start coordinates", () => {
    const ctx = mockCtx(castleCrashers)
    ctx.robotStateRef.current = { x: 1014, y: 50, rotation: -90 }
    expect(createProgramRobotApi(ctx).robotAPI.getPosition("X", "mm")).toBe(1014)
  })

  it("Switch Python must produce executable code instead of only a comment", () => {
    const generators = installGenerators(oceanReefBlocks)
    const code = generators.pg_control_switch({ getFieldValue: () => "drivetrain.drive(FORWARD)" }) as string
    expect(code.trim().startsWith("//")).toBe(false)
  })
})

describe("Rover Rescue block runtime", () => {
  expectEveryGeneratorRuns(roverRescueBlocks, roverRescue)

  it("drive, turn, print, variable, and broadcast actually change runtime state", async () => {
    const generators = installGenerators(roverRescueBlocks)
    const ctx = mockCtx(roverRescue)
    const lines: string[] = []
    ctx.setConsoleLines = (update) => {
      const next = typeof update === "function" ? update(lines.map((text) => ({ text, color: "#000" }))) : update
      lines.length = 0
      for (const line of next) lines.push(line.text)
    }
    const { robotAPI, registerBroadcastHandlers } = createProgramRobotApi(ctx)
    registerBroadcastHandlers([{ message: "message1", body: "robot.setVariable('heard', 1);" }])

    await runGenerated(robotAPI as unknown as Record<string, unknown>, generators.pg_drivetrain_drive_for(stubBlock("pg_drivetrain_drive_for")) as string)
    expect(ctx.robotStateRef.current.y).not.toBe(0)

    await runGenerated(robotAPI as unknown as Record<string, unknown>, generators.pg_drivetrain_turn_for(stubBlock("pg_drivetrain_turn_for")) as string)
    expect(ctx.robotStateRef.current.rotation).toBe(90)

    await runGenerated(robotAPI as unknown as Record<string, unknown>, generators.pg_looks_print(stubBlock("pg_looks_print")) as string)
    expect(lines.join("")).toContain("x")

    await runGenerated(robotAPI as unknown as Record<string, unknown>, generators.pg_variables_set_variable(stubBlock("pg_variables_set_variable")) as string)
    expect(robotAPI.getVariable("item")).toBe(1)

    await runGenerated(robotAPI as unknown as Record<string, unknown>, generators.pg_events_broadcast(stubBlock("pg_events_broadcast")) as string)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(robotAPI.getVariable("heard")).toBe(1)
  })
})
