"use client"

import type React from "react"
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { isTypingInFormField } from "@/lib/blockly-widget-form"
import { AssistantWindow } from "./AssistantWindow"
import { drawPredictionOnCanvas } from "./draw-prediction"
import { OptionTree } from "./option-tree"
import type { AIAssistantState, SurveyStep } from "./types"

export type { AIAssistantState, SurveyStep } from "./types"

export type AIAssistantHandle = {
  open: () => void
  show: () => void
}

export type AIAssistantProps = {
  workspace: any
  surveyStep: SurveyStep
  onSurveyStepChange: (step: SurveyStep) => void
  ref?: React.Ref<AIAssistantHandle>
}

export function AIAssistant({
  workspace,
  surveyStep: aiStep,
  onSurveyStepChange: setAiStep,
  ref,
}: AIAssistantProps) {
  const aiAssistantRef = useRef<HTMLDivElement>(null)
  const predictCanvasRef = useRef<HTMLCanvasElement>(null)

  const [aiAssistantState, setAiAssistantState] = useState<AIAssistantState>({
    x: 400,
    y: 200,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    isVisible: false,
    isMinimized: false,
    isMaximized: true,
    surveyStep: "main",
  })

  useEffect(() => {
    const aiX = Math.max(16, window.innerWidth - 420)
    setAiAssistantState((prev) => ({ ...prev, x: aiX }))
  }, [])

  const handleShowAIAssistant = () => {
    setAiAssistantState((prev) => ({ ...prev, isVisible: true, isMinimized: false }))
  }

  const handleOpenAIAssistant = () => {
    handleShowAIAssistant()
    setAiStep("main") // Reset AI assistant step when opened
  }

  const handleCloseAIAssistant = () => {
    setAiAssistantState((prev) => ({ ...prev, isVisible: false }))
    setAiStep("main") // Reset AI assistant step when closed
  }

  const handleMinimizeAIAssistant = () => {
    setAiAssistantState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }))
  }

  const handleMaximizeAIAssistant = () => {
    setAiAssistantState((prev) => ({ ...prev, isMaximized: !prev.isMaximized }))
  }

  useImperativeHandle(ref, () => ({
    open: handleOpenAIAssistant,
    show: handleShowAIAssistant,
  }))

  const handleAIAssistantMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    if (!(e.target as HTMLElement).closest(".ai-assistant-header")) return

    setAiAssistantState((prev) => ({
      ...prev,
      isDragging: true,
      dragStartX: e.clientX - prev.x,
      dragStartY: e.clientY - prev.y,
    }))
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (aiAssistantState.isDragging) {
        setAiAssistantState((prev) => ({
          ...prev,
          x: e.clientX - prev.dragStartX,
          y: e.clientY - prev.dragStartY,
        }))
      }
    }

    const handleMouseUp = () => {
      setAiAssistantState((prev) => ({ ...prev, isDragging: false }))
    }

    if (aiAssistantState.isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [aiAssistantState.isDragging])

  // Function to draw the prediction on the predict canvas
  const drawPrediction = useCallback(() => {
    drawPredictionOnCanvas(predictCanvasRef.current, workspace)
  }, [workspace]) // Removed drawPrediction from dependency array to fix circular dependency

  const handleKeyPress = (e: KeyboardEvent) => {
    if (isTypingInFormField()) return

    const key = e.key

    if (aiAssistantState.surveyStep === "main") {
      switch (key) {
        case "1":
          setAiStep("strategy")
          break
        case "2":
          setAiStep("predict")
          break
        case "3":
          setAiStep("fix")
          break
        case "4":
          setAiStep("compare")
          break
        case "5":
          setAiStep("feel")
          break
        case "6":
          setAiStep("partner")
          break
      }
    }
  }

  useEffect(() => {
    if (aiAssistantState.isVisible && !aiAssistantState.isMinimized) {
      window.addEventListener("keydown", handleKeyPress)
    } else {
      window.removeEventListener("keydown", handleKeyPress)
    }

    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [aiAssistantState.isVisible, aiAssistantState.isMinimized, aiStep]) // Depend on aiStep as well

  useEffect(() => {
    if (aiAssistantState.isVisible && !aiAssistantState.isMinimized && aiStep === "predict") {
      // Small delay to ensure canvas is rendered
      const timer = setTimeout(() => {
        drawPrediction()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [aiAssistantState.isVisible, aiAssistantState.isMinimized, aiStep, drawPrediction])

  return (
    <AssistantWindow
      aiAssistantState={aiAssistantState}
      aiAssistantRef={aiAssistantRef}
      onMouseDown={handleAIAssistantMouseDown}
      onMinimize={handleMinimizeAIAssistant}
      onMaximize={handleMaximizeAIAssistant}
      onClose={handleCloseAIAssistant}
    >
      <OptionTree
        aiStep={aiStep}
        setAiStep={setAiStep}
        predictCanvasRef={predictCanvasRef}
        drawPrediction={drawPrediction}
      />
    </AssistantWindow>
  )
}
