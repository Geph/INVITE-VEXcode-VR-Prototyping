"use client"

import type React from "react"
import { GripVertical, Maximize, Maximize2, Minimize, Minimize2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AIAssistantState } from "./types"

export function AssistantWindow({
  aiAssistantState,
  aiAssistantRef,
  onMouseDown,
  onMinimize,
  onMaximize,
  onClose,
  children,
}: {
  aiAssistantState: AIAssistantState
  aiAssistantRef: React.RefObject<HTMLDivElement | null>
  onMouseDown: (e: React.MouseEvent) => void
  onMinimize: () => void
  onMaximize: () => void
  onClose: () => void
  children: React.ReactNode
}) {
  if (!aiAssistantState.isVisible) return null

  return (
    <div
      id="vex-ai-assistant-window"
      ref={aiAssistantRef}
      onMouseDown={onMouseDown}
      suppressHydrationWarning
      className="fixed bg-white z-50 transition-all duration-200"
      style={{
        left: `${aiAssistantState.x}px`,
        top: `${aiAssistantState.y}px`,
        cursor: aiAssistantState.isDragging ? "grabbing" : "auto",
        width: aiAssistantState.isMaximized ? "420px" : "320px",
      }}
    >
      <div
        id="vex-ai-assistant-header"
        className="ai-assistant-header text-white px-4 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-white/70" />
          <h3 id="vex-ai-assistant-title" className="font-semibold text-sm">
            AI Assistant
          </h3>
        </div>
        <div id="vex-ai-assistant-window-controls" className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation()
              onMinimize()
            }}
          >
            {aiAssistantState.isMinimized ? <Maximize className="h-4 w-4" /> : <Minimize className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation()
              onMaximize()
            }}
          >
            {aiAssistantState.isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {!aiAssistantState.isMinimized && (
        <div id="vex-ai-assistant-body" className="p-4">
          {children}
        </div>
      )}
    </div>
  )
}
