"use client"

import type { Vec2 } from "@/engine"

/** Sits in the run toolbar rather than over the field, which stays uncovered. */
export function CoordinateReadout({
  cursorWorld,
  rover,
}: {
  cursorWorld: Vec2 | null
  rover: { x: number; y: number; heading: number }
}) {
  return (
    <div
      id="vex-playground-coord-readout"
      className="flex flex-wrap items-center justify-end gap-x-3 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] leading-snug text-slate-600 shadow-sm"
    >
      <span>
        Cursor{" "}
        {cursorWorld
          ? `X ${Math.round(cursorWorld.x)}  Y ${Math.round(cursorWorld.y)}`
          : "X —  Y —"}
      </span>
      <span>
        Rover X {Math.round(rover.x)}  Y {Math.round(rover.y)}  {rover.heading.toFixed(1)}°
      </span>
    </div>
  )
}
