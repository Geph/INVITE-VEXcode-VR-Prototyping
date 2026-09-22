import { describe, expect, it } from "vitest"
import { drivetrain } from "@/blocks/common/drivetrain"
import { createProgramRobotApi, type ProgramRobotApiContext } from "@/hooks/program-robot-api"
import { oceanReef } from "@/playgrounds/ocean-reef"

function mockCtx(animate: ProgramRobotApiContext["animateRobotFluid"]): ProgramRobotApiContext {
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
    animateRobotFluid: animate,
    activePlayground: oceanReef,
    getView: () => ({ widthPx: 400, heightPx: 400, maximized: false }),
  }
}

describe("anddontwait_mutator", () => {
  it("emits a non-awaiting drive call when the mutator is true", () => {
    const generate = drivetrain.jsGenerators.pg_drivetrain_drive_for
    const waiting = generate({
      getFieldValue: (name: string) =>
        ({ DIRECTION: "forward", DISTANCE: "200", UNIT: "mm", anddontwait_mutator: "false" }[name] ?? ""),
    })
    const racing = generate({
      getFieldValue: (name: string) =>
        ({ DIRECTION: "forward", DISTANCE: "200", UNIT: "mm", anddontwait_mutator: "true" }[name] ?? ""),
    })
    expect(waiting).toBe("await robot.drive('forward', 200, 'mm');\n")
    expect(racing).toBe("robot.drive('forward', 200, 'mm', false);\n")
  })

  it("emits a non-awaiting go-to call when the mutator is true", () => {
    const generate = drivetrain.jsGenerators.pg_drivetrain_go_to_object
    const waiting = generate({
      getFieldValue: (name: string) =>
        ({ OBJECT: "minerals", anddontwait_mutator: "false" }[name] ?? ""),
    })
    const racing = generate({
      getFieldValue: (name: string) =>
        ({ OBJECT: "base", anddontwait_mutator: "true" }[name] ?? ""),
    })
    expect(waiting).toBe("await robot.goToObject('minerals');\n")
    expect(racing).toBe("robot.goToObject('base', false);\n")
  })

  it("returns before motion completes and drive-is-done flips false then true", async () => {
    let finish!: () => void
    const motion = new Promise<void>((resolve) => {
      finish = resolve
    })
    const { robotAPI } = createProgramRobotApi(mockCtx(() => motion))

    const started = robotAPI.drive("forward", 200, "mm", false)
    await expect(started).resolves.toBeUndefined()
    expect(robotAPI.driveIsDone()).toBe(false)

    finish()
    await motion
    const deadline = Date.now() + 100
    while (!robotAPI.driveIsDone() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    expect(robotAPI.driveIsDone()).toBe(true)
  })
})
