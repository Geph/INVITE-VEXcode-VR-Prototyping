"use client"

import type { ReactNode } from "react"
import { HelpCircle, Play, RotateCcw, StepForward, StopCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SessionSettingsMenu } from "@/components/workspace/SessionSettingsMenu"
import type { SessionLogSnapshot } from "@/lib/session-log"

export function CodeViewToggle({
  codeView,
  onToggle,
}: {
  codeView: "blocks" | "python"
  onToggle: () => void
}) {
  return (
    <button
      id="vex-btn-code-view-toggle"
      onClick={onToggle}
      className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded transition-colors"
    >
      {codeView === "blocks" ? "Show Python" : "Show Blocks"}
    </button>
  )
}

export function HeaderActions({
  playgroundVisible,
  playgroundPickerOpen,
  onOpenPlayground,
  onGetHelp,
  getSessionSnapshot,
  multiplayerOpen,
  onToggleMultiplayer,
}: {
  playgroundVisible: boolean
  playgroundPickerOpen: boolean
  onOpenPlayground: () => void
  onGetHelp: () => void
  getSessionSnapshot: () => SessionLogSnapshot
  multiplayerOpen: boolean
  onToggleMultiplayer: () => void
}) {
  return (
    <div id="vex-header-actions" className="flex items-center gap-2">
      <Button
        id="vex-btn-multiplayer"
        type="button"
        variant="secondary"
        size="sm"
        className="bg-white/20 hover:bg-white/30 text-white border-0"
        aria-pressed={multiplayerOpen}
        aria-controls="vex-collab-status"
        onClick={onToggleMultiplayer}
      >
        Multiplayer
      </Button>
      {!playgroundVisible && (
        <Button
          id="vex-btn-open-playground"
          type="button"
          variant="secondary"
          size="sm"
          onClick={onOpenPlayground}
          className="bg-white/20 hover:bg-white/30 text-white border-0"
          aria-label="Choose a playground"
          aria-haspopup="dialog"
          aria-expanded={playgroundPickerOpen}
        >
          Open Playground
        </Button>
      )}
      <Button
        id="vex-btn-get-help"
        variant="secondary"
        size="sm"
        className="bg-pink-500 hover:bg-pink-600 text-white border-0 flex items-center gap-1"
        onClick={onGetHelp}
      >
        <HelpCircle className="h-4 w-4" />
        Get Help
      </Button>
      <Button
        id="vex-btn-plan"
        type="button"
        variant="secondary"
        size="sm"
        className="bg-white/20 hover:bg-white/30 text-white border-0"
      >
        Plan
      </Button>
      <SessionSettingsMenu getSnapshot={getSessionSnapshot} />
    </div>
  )
}

export function RunToolbar({
  isRunning,
  isStepping,
  isPausedOnBlock,
  onStart,
  onStep,
  onStop,
  onReset,
  trailing,
}: {
  isRunning: boolean
  isStepping: boolean
  isPausedOnBlock: boolean
  onStart: () => void
  onStep: () => void
  onStop: () => void
  onReset: () => void
  trailing?: ReactNode
}) {
  return (
    <div id="vex-playground-run-controls" className="flex flex-wrap items-center gap-2 px-3 py-3">
      <Button
        id="vex-btn-start"
        size="sm"
        className="bg-green-500 hover:bg-green-600 text-white border-0"
        onClick={onStart}
        disabled={isRunning && !isStepping}
        title={isStepping ? "Run the rest of the program" : "Run the program"}
      >
        <Play className="h-4 w-4 mr-1" />
        {isStepping ? "RESUME" : "START"}
      </Button>
      <Button
        id="vex-btn-step"
        size="sm"
        className="bg-sky-500 hover:bg-sky-600 text-white border-0"
        onClick={onStep}
        title="Run one block at a time"
      >
        <StepForward className="h-4 w-4 mr-1" />
        STEP
      </Button>
      <Button
        id="vex-btn-stop"
        size="sm"
        className="bg-red-500 hover:bg-red-600 text-white border-0"
        onClick={onStop}
        disabled={!isRunning}
        title="Stop the program"
      >
        <StopCircle className="h-4 w-4 mr-1" />
        STOP
      </Button>
      <Button
        id="vex-btn-reset"
        size="sm"
        className="bg-purple-500 hover:bg-purple-600 text-white border-0"
        onClick={onReset}
        title="Send the robot back to the start"
      >
        <RotateCcw className="h-4 w-4 mr-1" />
        RESET
      </Button>
      {(isStepping || trailing) && (
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {isStepping && (
            <span id="vex-playground-step-status" className="text-[11px] font-medium text-sky-700">
              {isPausedOnBlock ? "Paused on highlighted block" : "Stepping…"}
            </span>
          )}
          {trailing}
        </div>
      )}
    </div>
  )
}
