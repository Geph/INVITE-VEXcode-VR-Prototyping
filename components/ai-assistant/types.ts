export interface AIAssistantState {
  x: number
  y: number
  isDragging: boolean
  dragStartX: number
  dragStartY: number
  isVisible: boolean
  isMinimized: boolean
  isMaximized: boolean
  surveyStep: "main" | "strategy" | "predict" | "fix" | "compare" | "feel" | "partner" | "strategy-examples"
}

export type SurveyStep = AIAssistantState["surveyStep"]
