export interface AIAssistantState {
  isVisible: boolean
}

export type SurveyStep =
  | "main"
  | "strategy"
  | "predict"
  | "fix"
  | "compare"
  | "feel"
  | "partner"
  | "strategy-examples"
