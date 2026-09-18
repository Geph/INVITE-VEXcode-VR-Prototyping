"use client"

import type { ReactNode, RefObject } from "react"
import { Gauge, Ruler, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlaygroundCanvas } from "@/components/playground/PlaygroundCanvas"
import { RunToolbar } from "@/components/workspace/Toolbar"
import type { SurveyStep } from "@/components/ai-assistant"
import { CORAL_REEF_FIELD_MM } from "@/lib/robot-runtime"
import { formatDays, MISSION_DAYS } from "@/playgrounds/rover-rescue"
import type { ConsoleLine, ProgramGameState } from "@/hooks/program-types"
import type { LiveSensors } from "@/hooks/playground-host"

export function PlaygroundHud({
  consoleLines,
  showSensors,
  showRuler,
  onToggleSensors,
  onToggleRuler,
  canvasRef,
  canvasWidth,
  canvasHeight,
  gameState,
  liveSensors,
  isRunning,
  isStepping,
  isPausedOnBlock,
  onStart,
  onStep,
  onStop,
  onReset,
  aiStep,
  onCloseStrategy,
  chrome = "reef",
  canvasOverlay,
  toolbarTrailing,
  gameOverDetail,
}: {
  consoleLines: ConsoleLine[]
  showSensors: boolean
  showRuler: boolean
  onToggleSensors: () => void
  onToggleRuler: () => void
  canvasRef: RefObject<HTMLCanvasElement | null>
  canvasWidth: number
  canvasHeight: number
  gameState: ProgramGameState
  liveSensors: LiveSensors
  isRunning: boolean
  isStepping: boolean
  isPausedOnBlock: boolean
  onStart: () => void
  onStep: () => void
  onStop: () => void
  onReset: () => void
  aiStep: SurveyStep
  onCloseStrategy: () => void
  chrome?: "reef" | "field"
  canvasOverlay?: ReactNode
  toolbarTrailing?: ReactNode
  /** Replaces the default game-over card when the playground supplies its own. */
  gameOverDetail?: ReactNode
}) {
  return (
    <div id="vex-playground-body" className="flex flex-col relative">
      {consoleLines.length > 0 && (
        <div
          id="vex-playground-console"
          className="absolute top-2 left-2 right-20 z-10 max-h-20 overflow-y-auto rounded-md bg-black/75 px-2 py-1 font-mono text-[10px] text-green-300 shadow-md"
        >
          {consoleLines.map((line, i) => (
            <div key={i} style={{ color: line.color }}>
              {line.text || "\u00a0"}
            </div>
          ))}
        </div>
      )}

      {chrome === "reef" && <div
        id="vex-playground-field-toggles"
        className="absolute top-2 right-2 z-20 flex items-center gap-1.5"
      >
        <button
          id="vex-playground-sensors-toggle"
          type="button"
          aria-pressed={showSensors}
          aria-label={showSensors ? "Hide robot sensors" : "Show robot sensors"}
          title={showSensors ? "Hide robot sensors" : "Show robot sensors"}
          className={`flex h-7 w-7 items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition-colors ${
            showSensors
              ? "border-sky-400/70 bg-sky-300/85 text-sky-950"
              : "border-white/50 bg-white/70 text-slate-600 hover:bg-white/90"
          }`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSensors()
          }}
        >
          <Gauge className="h-4 w-4" />
        </button>
        <button
          id="vex-playground-ruler-toggle"
          type="button"
          aria-pressed={showRuler}
          aria-label={showRuler ? "Hide field ruler" : "Show field ruler"}
          title={showRuler ? "Hide field ruler" : "Show field ruler"}
          className={`flex h-7 w-7 items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition-colors ${
            showRuler
              ? "border-amber-400/70 bg-amber-300/85 text-amber-950"
              : "border-white/50 bg-white/70 text-slate-600 hover:bg-white/90"
          }`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleRuler()
          }}
        >
          <Ruler className="h-4 w-4" />
        </button>
      </div>}

      <div className="relative">
        <PlaygroundCanvas canvasRef={canvasRef} width={canvasWidth} height={canvasHeight} />
        {canvasOverlay}
      </div>

      {chrome === "reef" && <div
        id="vex-playground-status-bar"
        className="px-3 py-3 space-y-2.5"
      >
        <div className="flex flex-wrap items-end gap-4">
          <div
            id="vex-playground-trash-score"
            className="bg-gradient-to-r from-[#FF8C00] to-[#FFA500] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm min-w-[120px]"
          >
            <div className="text-[10px] font-medium uppercase tracking-wide text-orange-100">Trash collected</div>
            <div className="text-lg leading-tight mt-0.5">{gameState.trashCollected}</div>
          </div>
          <div id="vex-playground-battery" className="flex-1 min-w-[160px] max-w-[220px]">
            <div className="flex items-baseline justify-between text-xs text-gray-600 mb-1">
              <span className="font-semibold text-gray-800">Battery</span>
              <span id="vex-playground-battery-value" className="font-mono font-semibold text-gray-900">
                {Math.round(gameState.batteryPercent)}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden shadow-inner">
              <div
                id="vex-playground-battery-bar"
                className={`h-full transition-all duration-300 ${gameState.batteryPercent < 25 ? "bg-red-500" : gameState.batteryPercent < 50 ? "bg-amber-400" : "bg-green-500"}`}
                style={{ width: `${Math.max(0, gameState.batteryPercent)}%` }}
              />
            </div>
          </div>
        </div>
        {showSensors && (
          <div
            id="vex-playground-sensors"
            className="rounded-md border border-slate-200 bg-white/80 px-3 py-2 text-[11px] font-mono text-slate-700 space-y-1"
          >
            <div className="font-sans text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Robot sensors
            </div>
            <div>
              <span className="text-slate-500">Location (mm)</span> X {liveSensors.field.x}, Y {liveSensors.field.y}
              <span className="text-slate-400 mx-1">·</span>
              <span className="text-slate-500">Rotation</span> {liveSensors.rotation}°
            </div>
            <div>
              <span className="text-slate-500">Front distance</span> {liveSensors.frontDistanceMm} mm
              {liveSensors.frontObjectDetected && <span className="text-cyan-700"> · object detected</span>}
              {liveSensors.eyeNear && <span className="text-cyan-700"> · eye near trash</span>}
            </div>
            <div className="text-[10px] text-slate-400">
              Field {CORAL_REEF_FIELD_MM}×{CORAL_REEF_FIELD_MM} mm · Start position (0, -800)
            </div>
          </div>
        )}
      </div>}

      <RunToolbar
        isRunning={isRunning}
        isStepping={isStepping}
        isPausedOnBlock={isPausedOnBlock}
        onStart={onStart}
        onStep={onStep}
        onStop={onStop}
        onReset={onReset}
        trailing={toolbarTrailing}
      />

      {gameState.isGameOver && (
        <div id="vex-playground-gameover" className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-b-lg">
          {gameOverDetail ?? (
          <div className="bg-white rounded-xl p-6 shadow-2xl text-center max-w-xs">
            {gameState.missionEndReason === "complete" ? (
              <>
                <h3 className="text-2xl font-bold text-green-600 mb-2">Mission complete!</h3>
                <p className="text-gray-600 mb-4">
                  {chrome === "field"
                    ? `The rover survived the full ${MISSION_DAYS}-day mission.`
                    : "All trash collected before the battery ran out."}
                </p>
              </>
            ) : gameState.missionEndReason === "river" ? (
              <>
                <h3 className="text-2xl font-bold text-red-600 mb-2">Mission ended</h3>
                <p className="text-gray-600 mb-4">The rover entered the river.</p>
              </>
            ) : gameState.missionEndReason === "battery" ? (
              <>
                <h3 className="text-2xl font-bold text-amber-600 mb-2">Battery depleted</h3>
                <p className="text-gray-600 mb-4">
                  {chrome === "field"
                    ? "The rover ran out of power. Use mineral samples to recharge."
                    : "The underwater robot stopped. Collect more trash next run."}
                </p>
              </>
            ) : gameState.runError ? (
              <>
                <h3 className="text-2xl font-bold text-amber-600 mb-2">Program stopped</h3>
                <p className="text-gray-600 mb-4">{gameState.runError}</p>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-red-600 mb-2">Mission ended</h3>
                <p className="text-gray-600 mb-4">The robot collided with the coral reef.</p>
              </>
            )}
            {chrome === "reef" ? (
              <p id="vex-playground-gameover-score" className="text-lg font-semibold text-orange-500 mb-4">
                Trash collected: {gameState.trashCollected}
              </p>
            ) : (
              <p id="vex-playground-gameover-days" className="text-lg font-semibold text-orange-500 mb-4">
                Days survived: {formatDays(gameState.missionDays)}
              </p>
            )}
            <Button id="vex-playground-gameover-retry" onClick={onReset} className="bg-purple-500 hover:bg-purple-600 text-white">
              Try Again
            </Button>
          </div>
          )}
        </div>
      )}

      {aiStep === "strategy-examples" && (
        <div
          id="vex-playground-strategy-overlay"
          className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-b-lg p-4 z-40"
        >
          <div id="vex-playground-strategy-panel" className="bg-white rounded-xl shadow-2xl max-w-3xl max-h-96 overflow-y-auto">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-xl flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Strategies to Collect More Trash</h3>
                <p className="text-sm text-blue-100">Try these approaches and compare the results</p>
              </div>
              <button
                onClick={onCloseStrategy}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Approach 1 */}
                <div className="border-l-4 border-blue-500 bg-blue-50 p-3 rounded">
                  <p className="font-bold text-blue-900 mb-2">Approach 1: Increase Velocity</p>
                  
                  {/* Movement visualization */}
                  <svg width="100%" height="100" viewBox="0 0 150 100" className="border border-blue-200 rounded mb-2 bg-white">
                    <rect x="10" y="10" width="130" height="80" fill="none" stroke="#d4d4d8" strokeDasharray="2" />
                    <circle cx="75" cy="15" r="3" fill="#ff6b35" />
                    <line x1="75" y1="15" x2="75" y2="55" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" />
                    <circle cx="75" cy="55" r="6" fill="#3b82f6" opacity="0.3" />
                    <text x="75" y="75" fontSize="10" textAnchor="middle" fill="#666">Straight line forward</text>
                  </svg>

                  <div className="bg-white p-2 rounded border border-blue-200 mb-2 font-mono text-xs text-gray-700">
                    when started<br/>
                    set drive velocity to 100<br/>
                    drive forward 500 mm
                  </div>
                  <p className="text-xs text-gray-700"><span className="font-semibold">Result:</span> Fast collection in one line. Good for quick focused movement.</p>
                </div>

                {/* Approach 2 */}
                <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded">
                  <p className="font-bold text-green-900 mb-2">Approach 2: Continuous Patrol Loop</p>
                  
                  {/* Movement visualization */}
                  <svg width="100%" height="100" viewBox="0 0 150 100" className="border border-green-200 rounded mb-2 bg-white">
                    <rect x="10" y="10" width="130" height="80" fill="none" stroke="#d4d4d8" strokeDasharray="2" />
                    <circle cx="75" cy="15" r="3" fill="#ff6b35" />
                    <polyline points="75,15 75,50 120,50 120,80 40,80 40,50 75,50" stroke="#16a34a" strokeWidth="2" fill="none" strokeDasharray="4" />
                    <text x="75" y="95" fontSize="10" textAnchor="middle" fill="#666">Square patrol pattern</text>
                  </svg>

                  <div className="bg-white p-2 rounded border border-green-200 mb-2 font-mono text-xs text-gray-700">
                    when started<br/>
                    forever<br/>
                    &nbsp;&nbsp;drive forward 300 mm<br/>
                    &nbsp;&nbsp;turn right 90 degrees
                  </div>
                  <p className="text-xs text-gray-700"><span className="font-semibold">Result:</span> Covers large area continuously. Maximum trash collection.</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 p-3 rounded">
                <p className="text-xs font-semibold text-yellow-900">Challenge: Try both approaches and see which collects more trash!</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
