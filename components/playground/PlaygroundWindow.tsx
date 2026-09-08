"use client"

import type React from "react"
import type { ReactNode, Ref } from "react"
import { GripVertical, Maximize2, Minimize2, Minus, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { playgroundWindowWidthPx } from "@/lib/robot-runtime"

export interface PlaygroundWindowState {
  x: number
  y: number
  isDragging: boolean
  isMinimized: boolean
  isMaximized: boolean
}

export function PlaygroundWindow({
  title,
  state,
  windowRef,
  onMouseDown,
  onMinimize,
  onMaximize,
  onClose,
  canvasWidth,
  children,
}: {
  title: string
  state: PlaygroundWindowState
  windowRef: Ref<HTMLDivElement>
  onMouseDown: (e: React.MouseEvent) => void
  onMinimize: () => void
  onMaximize: () => void
  onClose: () => void
  canvasWidth: number
  children: ReactNode
}) {
  return (
    <div
      id="vex-playground-window"
      ref={windowRef}
      onMouseDown={onMouseDown}
      suppressHydrationWarning
      className="fixed bg-white z-50 transition-all duration-200"
      style={{
        left: `${state.x}px`,
        top: `${state.y}px`,
        cursor: state.isDragging ? "grabbing" : "auto",
        width: `${playgroundWindowWidthPx(canvasWidth)}px`,
        height: "auto",
      }}
    >
      <div
        id="vex-playground-header"
        className="playground-header text-white px-4 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        <div id="vex-playground-title-row" className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-white/70" />
          <h3 id="vex-playground-title" className="font-semibold text-sm">
            {title}
          </h3>
        </div>
        <div id="vex-playground-window-controls" className="flex items-center gap-1">
          <Button
            id="vex-playground-hide"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white hover:bg-white/20"
            aria-label={state.isMinimized ? "Show playground" : "Hide playground"}
            title={state.isMinimized ? "Show playground" : "Hide playground"}
            onClick={(e) => {
              e.stopPropagation()
              onMinimize()
            }}
          >
            {state.isMinimized ? <Square className="h-3.5 w-3.5" /> : <Minus className="h-4 w-4" />}
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
            {state.isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
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
      {!state.isMinimized && children}
    </div>
  )
}
