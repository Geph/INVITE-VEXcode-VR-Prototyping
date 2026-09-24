"use client"

import type { ReactNode } from "react"
import type { OceanReefState } from "@/playgrounds/ocean-reef"
import type { RoverRescueState } from "@/playgrounds/rover-rescue"
import type { CastleCrashersState } from "@/playgrounds/castle-crashers"
import type { PlaygroundDefinition } from "@/playgrounds/types"
import { CompareMenu } from "./compare-panel"
import { FeelMenu, MainMenu, PartnerMenu } from "./help-panels"
import { InvestigateMenu } from "./investigate-panel"
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
  reefState,
  roverState,
  playgroundVisible,
  onOpenPlayground,
  planPanel,
}: {
  planPanel: ReactNode
  aiStep: SurveyStep
  setAiStep: (step: SurveyStep) => void
  workspace: HelpWorkspace | null
  playgroundId: string
  playground: HelpPlayground
  robot: { x: number; y: number; rotation: number }
  reefState: OceanReefState
  roverState: RoverRescueState
  castleState: CastleCrashersState
  playgroundVisible: boolean
  onOpenPlayground: () => void
}) {
  if (aiStep === "main") {
    return (
      <MainMenu
        setAiStep={setAiStep}
        playgroundVisible={playgroundVisible}
        onOpenPlayground={onOpenPlayground}
      />
    )
  }
  if (aiStep === "strategy" || aiStep === "strategy-draw" || aiStep === "predict") return planPanel
  if (aiStep === "fix") return <InvestigateMenu playgroundId={playgroundId} workspace={workspace} onBack={() => setAiStep("main")} />
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
