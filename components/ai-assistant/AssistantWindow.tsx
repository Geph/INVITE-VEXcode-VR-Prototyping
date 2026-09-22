"use client"

import type React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AIAssistantState } from "./types"

export function AssistantWindow({
  aiAssistantState,
  aiAssistantRef,
  onClose,
  children,
}: {
  aiAssistantState: AIAssistantState
  aiAssistantRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  children: React.ReactNode
}) {
  if (!aiAssistantState.isVisible) return null

  return (
    <aside
      id="vex-ai-assistant-sidebar"
      ref={aiAssistantRef}
      suppressHydrationWarning
      className="relative z-[60] flex h-full w-[360px] shrink-0 flex-col border-l border-slate-200 bg-white"
      aria-label="Get Help"
    >
      <div
        id="vex-ai-assistant-header"
        className="ai-assistant-header flex items-center justify-between px-4 py-3 text-white"
      >
        <h3 id="vex-ai-assistant-title" className="text-sm font-semibold">
          Get Help
        </h3>
        <Button
          id="vex-ai-assistant-close"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-white hover:bg-white/20"
          aria-label="Close help"
          title="Close help"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div id="vex-ai-assistant-body" className="flex-1 overflow-y-auto p-4">
        {children}
      </div>
    </aside>
  )
}
