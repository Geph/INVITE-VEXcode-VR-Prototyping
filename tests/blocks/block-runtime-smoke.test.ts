import { afterEach, describe, expect, it } from "vitest"
import { installAllBlocks } from "@/blocks/registry"
import { createProgramRobotApi, type ProgramRobotApiContext } from "@/hooks/program-robot-api"
import { ProgramStopped } from "@/hooks/program-types"
import { oceanReef } from "@/playgrounds/ocean-reef"
import { oceanReefBlocks } from "@/playgrounds/ocean-reef/blocks"
import { roverRescue } from "@/playgrounds/rover-rescue"
import { roverRescueBlocks } from "@/playgrounds/rover-rescue/blocks"
import { createRoverRescueState } from "@/playgrounds/rover-rescue/state"

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
    OBJECT: type.includes("broadcast") ? "message1" : "item",
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

function mockCtx(playground: typeof oceanReef | typeof roverRescue): ProgramRobotApiContext {
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
  playground: typeof oceanReef | typeof roverRescue,
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
