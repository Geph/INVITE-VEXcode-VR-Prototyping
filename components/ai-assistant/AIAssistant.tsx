"use client"

import type React from "react"
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { isTypingInFormField } from "@/lib/blockly-widget-form"
import type { OceanReefState } from "@/playgrounds/ocean-reef"
import type { RoverRescueState } from "@/playgrounds/rover-rescue"
import { createCastleCrashersState, type CastleCrashersState } from "@/playgrounds/castle-crashers"
import type { PlaygroundDefinition } from "@/playgrounds/types"
import { fitToBounds } from "@/engine"
import { playgroundWorldBounds } from "@/hooks/distance-picker-preview"
import { emptyPlan, samplePlanRun } from "./plan-cycle"
import { PlanPanel, PLAN_VIEW } from "./plan-panel"
import { AssistantWindow } from "./AssistantWindow"
import { OptionTree } from "./option-tree"
import type { AIAssistantState, SurveyStep } from "./types"

export type { AIAssistantState, SurveyStep } from "./types"

export type AIAssistantHandle = {
  open: () => void
  show: () => void
}

type HelpPlayground =
  | PlaygroundDefinition<OceanReefState>
  | PlaygroundDefinition<RoverRescueState>
  | PlaygroundDefinition<CastleCrashersState>

export type AIAssistantProps = {
  isRunning: boolean
  workspace: React.ComponentProps<typeof OptionTree>["workspace"]
  surveyStep: SurveyStep
  onSurveyStepChange: (step: SurveyStep) => void
  playgroundId: string
  playground: HelpPlayground
  robot: { x: number; y: number; rotation: number }
  reefState: OceanReefState
  roverState: RoverRescueState
  castleState: CastleCrashersState
  playgroundVisible: boolean
  onOpenPlayground: () => void
  ref?: React.Ref<AIAssistantHandle>
}

export function AIAssistant({
  workspace,
  isRunning,
  surveyStep: aiStep,
  onSurveyStepChange: setAiStep,
  playgroundId,
  playground,
  robot,
  reefState,
  roverState,
  castleState,
  playgroundVisible,
  onOpenPlayground,
  ref,
}: AIAssistantProps) {
  const aiAssistantRef = useRef<HTMLDivElement>(null)
  const [plan, setPlan] = useState(emptyPlan)
  const planCastle = useMemo(() => createCastleCrashersState(castleState.seed, castleState.level), [castleState.seed, castleState.level])
  useEffect(() => {
    setPlan(prev => samplePlanRun(prev, isRunning, robot))
  }, [isRunning, robot.x, robot.y])
  useEffect(() => {
    if (plan.phase !== "review") return
    setAiAssistantState({ isVisible: true })
    setAiStep("strategy")
  }, [plan.phase, setAiStep])
  const start = playground.world.startPose
  const planBackdrop = {
    playgroundId, playground, reefState, roverState, castleState: planCastle,
    robot: { x: start.xMm, y: start.yMm, rotation: start.headingDeg },
    viewport: PLAN_VIEW, cam: fitToBounds(playgroundWorldBounds(playground.world), PLAN_VIEW),
  }

  const [aiAssistantState, setAiAssistantState] = useState<AIAssistantState>({
    isVisible: false,
  })

  const handleShowAIAssistant = useCallback(() => {
    setAiAssistantState({ isVisible: true })
  }, [])

  const handleOpenAIAssistant = useCallback(() => {
    setAiAssistantState({ isVisible: true })
    setAiStep("main")
  }, [setAiStep])

  const handleCloseAIAssistant = useCallback(() => {
    setAiAssistantState({ isVisible: false })
    setAiStep("main")
  }, [setAiStep])

  useImperativeHandle(ref, () => ({
    open: handleOpenAIAssistant,
    show: handleShowAIAssistant,
  }))

  useEffect(() => {
    if (!aiAssistantState.isVisible) return

    const handleKeyPress = (e: KeyboardEvent) => {
      if (isTypingInFormField()) return
      if (aiStep !== "main") return

      const steps: Record<string, SurveyStep> = {
        "1": "strategy",
        "2": "fix",
        "3": "compare",
        "4": "feel",
        "5": "partner",
      }
      const next = steps[e.key]
      if (next) setAiStep(next)
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [aiAssistantState.isVisible, aiStep, setAiStep])

  return (
    <AssistantWindow
      aiAssistantState={aiAssistantState}
      aiAssistantRef={aiAssistantRef}
      onClose={handleCloseAIAssistant}
    >
      <OptionTree
        planPanel={<PlanPanel plan={plan} setPlan={setPlan} backdrop={planBackdrop} isRunning={isRunning} onBack={() => setAiStep("main")} />}
        aiStep={aiStep}
        setAiStep={setAiStep}
        workspace={workspace}
        playgroundId={playgroundId}
        playground={playground}
        robot={robot}
        reefState={reefState}
        roverState={roverState}
        castleState={castleState}
        playgroundVisible={playgroundVisible}
        onOpenPlayground={onOpenPlayground}
      />
    </AssistantWindow>
  )
}
