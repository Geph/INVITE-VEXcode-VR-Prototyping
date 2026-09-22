"use client"

import type React from "react"
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { isTypingInFormField } from "@/lib/blockly-widget-form"
import type { OceanReefState } from "@/playgrounds/ocean-reef"
import type { RoverRescueState } from "@/playgrounds/rover-rescue"
import type { CastleCrashersState } from "@/playgrounds/castle-crashers"
import type { PlaygroundDefinition } from "@/playgrounds/types"
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
  workspace: React.ComponentProps<typeof OptionTree>["workspace"]
  surveyStep: SurveyStep
  onSurveyStepChange: (step: SurveyStep) => void
  playgroundId: string
  playground: HelpPlayground
  robot: { x: number; y: number; rotation: number }
  reefState: OceanReefState
  roverState: RoverRescueState
  castleState: CastleCrashersState
  ref?: React.Ref<AIAssistantHandle>
}

export function AIAssistant({
  workspace,
  surveyStep: aiStep,
  onSurveyStepChange: setAiStep,
  playgroundId,
  playground,
  robot,
  reefState,
  roverState,
  castleState,
  ref,
}: AIAssistantProps) {
  const aiAssistantRef = useRef<HTMLDivElement>(null)
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
        "2": "predict",
        "3": "fix",
        "4": "compare",
        "5": "feel",
        "6": "partner",
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
        aiStep={aiStep}
        setAiStep={setAiStep}
        workspace={workspace}
        playgroundId={playgroundId}
        playground={playground}
        robot={robot}
        reefState={reefState}
        roverState={roverState}
        castleState={castleState}
      />
    </AssistantWindow>
  )
}
