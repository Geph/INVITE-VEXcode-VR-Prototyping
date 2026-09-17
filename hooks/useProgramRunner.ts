"use client"

import { useCallback, useRef, useState } from "react"
import { generateWhenStartedJavaScript } from "@/lib/robot-runtime"
import { recordSessionEvent } from "@/lib/session-log"
import { createProgramRobotApi } from "./program-robot-api"
import { startBumperWatchers } from "./program-watchers"
import {
  PRINT_COLORS,
  ProgramStopped,
  type ConsoleLine,
  type ProgramRunnerDeps,
} from "./program-types"

export type { ConsoleLine, ProgramRunnerDeps } from "./program-types"
export type { AnimateRobotFluidFn } from "./program-types"

export function useProgramRunner({
  workspace,
  robotStateRef,
  setRobotState,
  runtimeRef,
  reefStateRef,
  roverStateRef,
  activePlayground,
  robotCapabilities,
  getView,
  animateRobotFluidRef,
  deployTrashFieldRef,
  cancelRobotAnimation,
  setGameState,
  setPenTrail,
  coralGraceUntilRef,
  trashSpawnIntervalRef,
  syncTrashItems,
}: ProgramRunnerDeps) {
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const isRunningRef = useRef(false)
  /** True from the moment a program starts until its async body finishes unwinding. */
  const programActiveRef = useRef(false)
  /** Set when the program must unwind (stop project, mission end, reset). */
  const stopRequestedRef = useRef(false)
  /** True while the program pauses before every block instead of running straight through. */
  const stepModeRef = useRef(false)
  /** Releases the block the program is parked on. Set only while paused. */
  const stepGateRef = useRef<(() => void) | null>(null)
  /** A Step pressed mid-movement, spent by the next block instead of being dropped. */
  const pendingStepRef = useRef(false)
  const [isStepping, setIsStepping] = useState(false)
  const [isPausedOnBlock, setIsPausedOnBlock] = useState(false)
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])

  /** Glow the block the program is on; `null` clears it. */
  const highlightProgramBlock = useCallback(
    (blockId: string | null) => {
      if (!workspace) return
      try {
        workspace.highlightBlock(blockId)
      } catch {
        /* the block can be deleted mid-run */
      }
    },
    [workspace],
  )

  /** Lets a paused program continue, whether it then runs free or stops. */
  const releaseStepGate = useCallback(() => {
    const resume = stepGateRef.current
    stepGateRef.current = null
    setIsPausedOnBlock(false)
    resume?.()
  }, [])

  const handleRun = async ({ step = false }: { step?: boolean } = {}) => {
    // `isRunning` can already be false while a stopped program is still unwinding,
    // so gate on the ref to avoid two programs driving the same robot.
    if (!workspace || !window.Blockly || programActiveRef.current) return

    programActiveRef.current = true
    stopRequestedRef.current = false
    stepModeRef.current = step
    pendingStepRef.current = false
    setIsStepping(step)
    setIsPausedOnBlock(false)
    isRunningRef.current = true
    setIsRunning(true)
    recordSessionEvent("run_start", { playgroundId: activePlayground.id, step })
    setPenTrail([])
    coralGraceUntilRef.current = performance.now() + 400
    setGameState((prev) => ({
      ...prev,
      isGameOver: false,
      gameLost: false,
      runError: null,
      missionEndReason: null,
      missionDays: 0,
      showCelebration: false,
    }))
    setConsoleLines([])
    deployTrashFieldRef.current()
    const animateRobotFluid = animateRobotFluidRef.current

    const Blockly = window.Blockly
    const jsGen = Blockly.JavaScript
    // Every statement announces itself, which is what drives both the running
    // block highlight and the pause points for Step.
    jsGen.STATEMENT_PREFIX = "await robot.__step(%1);\n"
    if (typeof jsGen.init === "function") {
      jsGen.init(workspace)
    }
    const code = generateWhenStartedJavaScript(workspace, jsGen)
    // `pg_events_when_bumper` stacks are separate hats, so they are collected and polled
    // alongside the main program rather than inlined into it.
    const bumperEvents = workspace
      .getAllBlocks(false)
      .filter((b: { type: string }) => b.type === "pg_events_when_bumper")
      .map((b: any) => ({
        bumper: b.getFieldValue("BUMPER"),
        state: b.getFieldValue("STATE"),
        body: jsGen.statementToCode(b, "DO"),
      }))
      .filter((handler: { body: string }) => handler.body.trim().length > 0)
    const broadcastEvents = workspace
      .getAllBlocks(false)
      .filter((b: { type: string }) => b.type === "pg_events_when_broadcasted")
      .map((b: any) => ({
        message: String(b.getFieldValue("OBJECT") || ""),
        body: jsGen.statementToCode(b, "SUBSTACK"),
      }))
      .filter((handler: { body: string }) => handler.body.trim().length > 0)
    if (typeof jsGen.finish === "function") {
      jsGen.finish(workspace)
    }

    runtimeRef.current = {
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
    }

    const startPos = { x: activePlayground.world.startPose.xMm, y: activePlayground.world.startPose.yMm }
    setRobotState({
      x: startPos.x,
      y: startPos.y,
      rotation: 0,
      driveVelocity: 50,
      turnVelocity: 50,
      heading: 0,
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    robotStateRef.current = { x: startPos.x, y: startPos.y, rotation: 0 }

    const { robotAPI, pushConsoleLine, registerBroadcastHandlers } = createProgramRobotApi({
      runtimeRef,
      robotStateRef,
      reefStateRef,
      roverStateRef,
      setRobotState,
      setConsoleLines,
      setIsRunning,
      setIsPausedOnBlock,
      robotCapabilities,
      stopRequestedRef,
      stepModeRef,
      pendingStepRef,
      stepGateRef,
      isRunningRef,
      trashSpawnIntervalRef,
      highlightProgramBlock,
      cancelRobotAnimation,
      animateRobotFluid,
      activePlayground,
      getView,
    })

    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

    const stopBumperWatchers = startBumperWatchers(bumperEvents, robotAPI, stopRequestedRef)
    registerBroadcastHandlers(broadcastEvents)

    try {
      if (!code.trim() && bumperEvents.length === 0 && broadcastEvents.length === 0) {
        pushConsoleLine("Add blocks under when started to run your program.")
        return
      }
      if (code.trim()) {
        const execFunc = new AsyncFunction("robot", code)
        await execFunc(robotAPI)
      }
    } catch (error: unknown) {
      // A stop is a normal end of run, not a program error.
      if (!(error instanceof ProgramStopped)) {
        console.error("Execution error:", error)
        const message = error instanceof Error ? error.message : "Program error"
        setGameState((prev) => ({ ...prev, isGameOver: true, gameLost: false, runError: message }))
        pushConsoleLine(`Error: ${message}`, PRINT_COLORS.red)
      }
    } finally {
      stopBumperWatchers()
      stopRequestedRef.current = false
      programActiveRef.current = false
      stepModeRef.current = false
      stepGateRef.current = null
      pendingStepRef.current = false
      setIsStepping(false)
      setIsPausedOnBlock(false)
      highlightProgramBlock(null)
      recordSessionEvent("run_end", { playgroundId: activePlayground.id })
      if (isRunningRef.current) {
        isRunningRef.current = false
        setIsRunning(false)
      }
    }
  }

  /** START also resumes a stepped program, so it reads as "run from here". */
  const handleStart = () => {
    if (programActiveRef.current) {
      if (!stepModeRef.current) return
      stepModeRef.current = false
      pendingStepRef.current = false
      setIsStepping(false)
      releaseStepGate()
      return
    }
    void handleRun()
  }

  /** Runs exactly one block, starting the program in step mode if needed. */
  const handleStep = () => {
    if (!programActiveRef.current) {
      void handleRun({ step: true })
      return
    }
    if (!stepModeRef.current) {
      // Switching from a free run: park on the next block.
      stepModeRef.current = true
      setIsStepping(true)
      return
    }
    if (stepGateRef.current) {
      releaseStepGate()
      return
    }
    // Mid-movement: remember the press so the next block does not stall.
    pendingStepRef.current = true
  }

  const handleStop = () => {
    if (!programActiveRef.current) return
    stopRequestedRef.current = true
    stepModeRef.current = false
    pendingStepRef.current = false
    setIsStepping(false)
    cancelRobotAnimation()
    releaseStepGate()
    if (trashSpawnIntervalRef.current) {
      clearInterval(trashSpawnIntervalRef.current)
      trashSpawnIntervalRef.current = null
    }
    isRunningRef.current = false
    setIsRunning(false)
    highlightProgramBlock(null)
    recordSessionEvent("run_stop", { playgroundId: activePlayground.id })
  }

  const handleReset = () => {
    stopRequestedRef.current = true
    stepModeRef.current = false
    pendingStepRef.current = false
    setIsStepping(false)
    releaseStepGate()
    highlightProgramBlock(null)
    cancelRobotAnimation()
    if (trashSpawnIntervalRef.current) {
      clearInterval(trashSpawnIntervalRef.current)
      trashSpawnIntervalRef.current = null
    }
    setIsRunning(false)
    isRunningRef.current = false
    const resetPos = { x: activePlayground.world.startPose.xMm, y: activePlayground.world.startPose.yMm }
    setRobotState({
      x: resetPos.x,
      y: resetPos.y,
      rotation: 0,
      driveVelocity: 50,
      turnVelocity: 50,
      heading: 0,
    })
    robotStateRef.current = { x: resetPos.x, y: resetPos.y, rotation: 0 }
    setGameState({
      trashCollected: 0,
      trashTotal: 0,
      batteryPercent: 100,
      gameLost: false,
      isGameOver: false,
      runError: null,
      showCelebration: false,
      missionEndReason: null,
      missionDays: 0,
      isSpawningTrash: false,
    })
    syncTrashItems([])
    setPenTrail([])
    setConsoleLines([])
    recordSessionEvent("run_reset", { playgroundId: activePlayground.id })
  }

  return {
    handleStart,
    handleStep,
    handleStop,
    handleReset,
    isRunning,
    setIsRunning,
    isRunningRef,
    stopRequestedRef,
    isStepping,
    isPausedOnBlock,
    consoleLines,
    setConsoleLines,
  }
}
