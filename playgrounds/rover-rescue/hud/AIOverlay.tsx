"use client"

import { ScanEye } from "lucide-react"

export function AIOverlay({
  enabled,
  onToggle,
}: {
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      id="vex-rover-ai-overlay"
      type="button"
      aria-pressed={enabled}
      aria-label={enabled ? "Hide AI visualisation" : "Show AI visualisation"}
      title={enabled ? "Hide AI visualisation" : "Show AI visualisation"}
      className={`flex h-7 items-center justify-center gap-1 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-wide shadow-sm backdrop-blur-sm ${
        enabled
          ? "border-fuchsia-300/70 bg-fuchsia-400/85 text-fuchsia-950"
          : "border-white/40 bg-black/55 text-white hover:bg-white/15"
      }`}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
    >
      <ScanEye className="h-3.5 w-3.5" />
      AI
    </button>
  )
}
