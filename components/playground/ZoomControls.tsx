"use client"

import { Crosshair, Focus, Minus, Plus } from "lucide-react"

export function ZoomControls({
  userScale,
  minZoom,
  maxZoom,
  follow,
  onZoomIn,
  onZoomOut,
  onFitField,
  onToggleFollow,
}: {
  userScale: number
  minZoom: number
  maxZoom: number
  follow: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onFitField: () => void
  onToggleFollow: () => void
}) {
  return (
    <div
      id="vex-playground-zoom-controls"
      className="absolute bottom-2 right-2 z-20 flex flex-col items-stretch gap-1"
    >
      <div className="flex overflow-hidden rounded-md border border-white/40 bg-black/55 shadow-sm backdrop-blur-sm">
        <button
          id="vex-playground-zoom-out"
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={userScale <= minZoom + 1e-6}
          className="flex h-7 w-7 items-center justify-center text-white hover:bg-white/15 disabled:opacity-40"
          onClick={(event) => {
            event.stopPropagation()
            onZoomOut()
          }}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div
          id="vex-playground-zoom-readout"
          className="flex min-w-[3.25rem] items-center justify-center border-x border-white/20 px-1 font-mono text-[10px] text-white"
        >
          {userScale.toFixed(2)}x
        </div>
        <button
          id="vex-playground-zoom-in"
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={userScale >= maxZoom - 1e-6}
          className="flex h-7 w-7 items-center justify-center text-white hover:bg-white/15 disabled:opacity-40"
          onClick={(event) => {
            event.stopPropagation()
            onZoomIn()
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <button
        id="vex-playground-fit-field"
        type="button"
        aria-label="Fit field"
        title="Fit field"
        className="flex h-7 items-center justify-center gap-1 rounded-md border border-white/40 bg-black/55 px-2 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur-sm hover:bg-white/15"
        onClick={(event) => {
          event.stopPropagation()
          onFitField()
        }}
      >
        <Focus className="h-3.5 w-3.5" />
        Fit field
      </button>
      <button
        id="vex-playground-follow-rover"
        type="button"
        aria-pressed={follow}
        aria-label={follow ? "Stop following rover" : "Follow rover"}
        title={follow ? "Stop following rover" : "Follow rover"}
        className={`flex h-7 items-center justify-center gap-1 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-wide shadow-sm backdrop-blur-sm ${
          follow
            ? "border-cyan-300/70 bg-cyan-400/80 text-cyan-950"
            : "border-white/40 bg-black/55 text-white hover:bg-white/15"
        }`}
        onClick={(event) => {
          event.stopPropagation()
          onToggleFollow()
        }}
      >
        <Crosshair className="h-3.5 w-3.5" />
        Follow
      </button>
    </div>
  )
}
