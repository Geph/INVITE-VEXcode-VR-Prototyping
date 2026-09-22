"use client"

import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { OceanReefState } from "@/playgrounds/ocean-reef"
import type { RoverRescueState } from "@/playgrounds/rover-rescue"
import type { CastleCrashersState } from "@/playgrounds/castle-crashers"
import type { PlaygroundDefinition } from "@/playgrounds/types"
import { CompareMenu } from "./compare-panel"
import { FeelMenu, MainMenu, PartnerMenu, PlanMenu } from "./help-panels"
import { InvestigateMenu } from "./investigate-panel"
import { PredictPreview } from "./predict-preview"
import type { SurveyStep } from "./types"

type HelpWorkspace = {
  getAllBlocks: (ordered?: boolean) => Array<{ type: string; getNextBlock?: () => unknown; getFieldValue: (name: string) => string; getInputTargetBlock: (name: string) => unknown }>
  getBlockById?: (id: string) => { type: string; toString?: () => string } | null
  addChangeListener?: (fn: (event: { type?: string; blockId?: string | null; newElementId?: string | null }) => void) => void
  removeChangeListener?: (fn: (event: { type?: string; blockId?: string | null; newElementId?: string | null }) => void) => void
}

type HelpPlayground =
  | PlaygroundDefinition<OceanReefState>
  | PlaygroundDefinition<RoverRescueState>
  | PlaygroundDefinition<CastleCrashersState>

export function OptionTree({
  aiStep,
  setAiStep,
  workspace,
  playgroundId,
  playground,
  robot,
  reefState,
  roverState,
  castleState,
}: {
  aiStep: SurveyStep
  setAiStep: (step: SurveyStep) => void
  workspace: HelpWorkspace | null
  playgroundId: string
  playground: HelpPlayground
  robot: { x: number; y: number; rotation: number }
  reefState: OceanReefState
  roverState: RoverRescueState
  castleState: CastleCrashersState
}) {
  if (aiStep === "main") return <MainMenu setAiStep={setAiStep} />
  if (aiStep === "strategy") {
    return <PlanMenu playgroundId={playgroundId} onBack={() => setAiStep("main")} onExamples={() => setAiStep("strategy-examples")} />
  }
  if (aiStep === "strategy-examples") return <StrategyExamples onBack={() => setAiStep("strategy")} />
  if (aiStep === "predict") {
    return (
      <div className="space-y-3">
        <Button variant="outline" onClick={() => setAiStep("main")} className="mb-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <PredictPreview
          workspace={workspace}
          playgroundId={playgroundId}
          playground={playground}
          robot={robot}
          reefState={reefState}
          roverState={roverState}
          castleState={castleState}
        />
      </div>
    )
  }
  if (aiStep === "fix") return <InvestigateMenu workspace={workspace} onBack={() => setAiStep("main")} />
  if (aiStep === "compare") {
    return (
      <CompareMenu
        playgroundId={playgroundId}
        reefState={reefState}
        roverState={roverState}
        workspace={workspace}
        onBack={() => setAiStep("main")}
      />
    )
  }
  if (aiStep === "feel") return <FeelMenu onBack={() => setAiStep("main")} />
  if (aiStep === "partner") return <PartnerMenu workspace={workspace} onBack={() => setAiStep("main")} />
  return null
}

function StrategyExamples({ onBack }: { onBack: () => void }) {
  return (
    <div className="text-gray-700 text-sm">
      <Button variant="ghost" size="sm" className="mb-3 text-blue-600 hover:text-blue-800 -ml-2" onClick={onBack}>
        ← Back
      </Button>
      <p className="mb-3 font-medium text-base">Two approaches to move efficiently:</p>
      <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
        <p className="font-semibold text-blue-900 mb-2">Approach 1: Increase Velocity</p>
        <p className="text-xs text-gray-600 mb-2">Set drive velocity to 100 at the start, then drive forward.</p>
        <div className="bg-white p-2 rounded border border-blue-200 mb-2 font-mono text-xs">
          <div className="text-blue-700">when started</div>
          <div className="ml-4 text-green-700">set drive_velocity to 100</div>
          <div className="ml-4 text-purple-700">drive forward 500 mm</div>
        </div>
        <p className="text-xs text-gray-700"><span className="font-semibold">Why:</span> Higher velocity means faster movement. This approach is simple and direct.</p>
      </div>
      <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 rounded">
        <p className="font-semibold text-green-900 mb-2">Approach 2: Add a loop</p>
        <p className="text-xs text-gray-600 mb-2">Use a forever loop to keep collecting without stopping.</p>
        <div className="bg-white p-2 rounded border border-green-200 mb-2 font-mono text-xs">
          <div className="text-blue-700">when started</div>
          <div className="ml-4 text-purple-700">forever</div>
          <div className="ml-8 text-green-700">drive forward 300 mm</div>
          <div className="ml-8 text-blue-700">turn right 90 degrees</div>
        </div>
        <p className="text-xs text-gray-700"><span className="font-semibold">Why:</span> Loops let the robot patrol and collect more trash.</p>
      </div>
    </div>
  )
}
