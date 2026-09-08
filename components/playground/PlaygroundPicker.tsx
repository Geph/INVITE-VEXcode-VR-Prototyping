"use client"

import { useEffect } from "react"
import { Bot, Castle, Waves, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export type PlaygroundId = "castle-crashers" | "ocean-cleanup" | "rescue-rover"

export const PLAYGROUND_OPTIONS: {
  id: PlaygroundId
  name: string
  available: boolean
  description: string
  icon: typeof Castle
}[] = [
  {
    id: "castle-crashers",
    name: "Castle Crashers",
    available: false,
    description: "Storm the keep. Content coming later.",
    icon: Castle,
  },
  {
    id: "ocean-cleanup",
    name: "Ocean Cleanup",
    available: true,
    description: "Collect trash on the coral reef.",
    icon: Waves,
  },
  {
    id: "rescue-rover",
    name: "Rover Rescue",
    available: true,
    description: "Explore the 12×6 m research field.",
    icon: Bot,
  },
]

export function PlaygroundPicker({
  open,
  onClose,
  onChoose,
}: {
  open: boolean
  onClose: () => void
  onChoose: (id: PlaygroundId) => void
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      id="vex-playground-picker-backdrop"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        id="vex-playground-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vex-playground-picker-title"
        className="w-full max-w-3xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="vex-playground-picker-title" className="text-lg font-semibold text-slate-900">
              Choose a playground
            </h2>
            <p className="mt-1 text-sm text-slate-500">Pick a field to open. More playgrounds will unlock as we add them.</p>
          </div>
          <Button
            id="vex-playground-picker-close"
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-slate-900"
            aria-label="Close playground picker"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div id="vex-playground-picker-options" className="grid gap-3 sm:grid-cols-3">
          {PLAYGROUND_OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                id={`vex-playground-option-${option.id}`}
                type="button"
                disabled={!option.available}
                aria-disabled={!option.available}
                title={option.available ? `Open ${option.name}` : `${option.name} is coming soon`}
                onClick={() => {
                  if (!option.available) return
                  onChoose(option.id)
                }}
                className={
                  option.available
                    ? "flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    : "flex cursor-not-allowed flex-col items-start gap-3 rounded-xl border border-slate-200 bg-slate-100 p-4 text-left opacity-50 grayscale"
                }
              >
                <span
                  className={
                    option.available
                      ? "flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700"
                      : "flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200 text-slate-500"
                  }
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{option.name}</span>
                  {!option.available && (
                    <span className="rounded-full bg-slate-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Coming soon
                    </span>
                  )}
                </span>
                <span className="text-sm text-slate-500">{option.description}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
