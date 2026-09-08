"use client"

import { useState } from "react"
import type { RobotState } from "@/engine"
import { Map as MapIcon } from "lucide-react"
import type { RoverRescueState } from "../state"
import { AIOverlay } from "./AIOverlay"
import { MapView } from "./MapView"
import { Minimap } from "./Minimap"

export type RoverMapMode = "minimap" | "map" | "hidden"

const MAP_CYCLE: RoverMapMode[] = ["minimap", "map", "hidden"]

export function nextMapMode(mode: RoverMapMode): RoverMapMode {
  return MAP_CYCLE[(MAP_CYCLE.indexOf(mode) + 1) % MAP_CYCLE.length] ?? "minimap"
}

export function RoverRescueHud({
  stateRef,
  robot,
}: {
  stateRef: { current: RoverRescueState }
  robot: Pick<RobotState, "xMm" | "yMm" | "headingDeg">
}) {
  const [mapMode, setMapMode] = useState<RoverMapMode>("minimap")
  const [aiOn, setAiOn] = useState(() => stateRef.current.aiVisualisation)

  const mapLabel = mapMode === "minimap" ? "Minimap" : mapMode === "map" ? "Map" : "Map off"

  return (
    <>
      <div id="vex-rover-map-slot" className="pointer-events-none absolute top-2 right-2 z-20">
        {mapMode === "minimap" ? <Minimap stateRef={stateRef} robot={robot} /> : null}
        {mapMode === "map" ? <MapView stateRef={stateRef} robot={robot} /> : null}
      </div>
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
          id="vex-rover-map-toggle"
          type="button"
          aria-label={`Cycle map view, currently ${mapLabel}`}
          title={`Map: ${mapLabel}`}
          className={`flex h-7 items-center justify-center gap-1 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-wide shadow-sm backdrop-blur-sm ${
            mapMode === "hidden"
              ? "border-white/40 bg-black/55 text-white hover:bg-white/15"
              : "border-violet-300/70 bg-violet-400/85 text-violet-950"
          }`}
          onClick={(event) => {
            event.stopPropagation()
            setMapMode((mode) => nextMapMode(mode))
          }}
        >
          <MapIcon className="h-3.5 w-3.5" />
          {mapLabel}
        </button>
      </div>
    </>
  )
}
