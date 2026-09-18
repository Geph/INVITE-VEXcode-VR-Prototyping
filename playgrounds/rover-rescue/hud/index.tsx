"use client"

import { useState } from "react"
import { KeyRound } from "lucide-react"
import type { RoverRescueState } from "../state"
import { AIOverlay } from "./AIOverlay"
import { KeyLegend } from "./KeyLegend"

export { MissionDialog } from "./MissionDialog"
export { MissionEndPanel } from "./MissionEnd"

/**
 * `Minimap` and `MapView` are built but unmounted: no control opens them, so
 * restoring them means re-adding a toggle and passing the rover pose back in.
 */
export function RoverRescueHud({
  stateRef,
}: {
  stateRef: { current: RoverRescueState }
}) {
  const [aiOn, setAiOn] = useState(() => stateRef.current.aiVisualisation)
  const [keyOpen, setKeyOpen] = useState(false)

  return (
    <>
      {keyOpen ? <KeyLegend /> : null}
      <div
        id="vex-rover-viz-controls"
        className="absolute bottom-[8.75rem] right-2 z-20 flex flex-col items-stretch gap-1"
      >
        <AIOverlay
          enabled={aiOn}
          onToggle={() => {
            const next = !stateRef.current.aiVisualisation
            stateRef.current.aiVisualisation = next
            setAiOn(next)
          }}
        />
        <button
          id="vex-rover-map-key-toggle"
          type="button"
          aria-pressed={keyOpen}
          aria-label={keyOpen ? "Hide map key" : "Show map key"}
          title={keyOpen ? "Hide map key" : "Show map key"}
          className={`flex h-7 items-center justify-center gap-1 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-wide shadow-sm backdrop-blur-sm ${
            keyOpen
              ? "border-amber-300/70 bg-amber-300/90 text-amber-950"
              : "border-white/40 bg-black/55 text-white hover:bg-white/15"
          }`}
          onClick={(event) => {
            event.stopPropagation()
            setKeyOpen((open) => !open)
          }}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Key
        </button>
      </div>
    </>
  )
}
