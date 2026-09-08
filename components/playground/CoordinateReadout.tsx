"use client"

import type { Vec2 } from "@/engine"

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
      className="absolute bottom-2 left-2 z-20 max-w-[70%] rounded-md border border-white/30 bg-black/60 px-2 py-1 font-mono text-[10px] leading-snug text-slate-100 shadow-sm backdrop-blur-sm"
    >
      <div>
        Cursor{" "}
        {cursorWorld
          ? `X ${Math.round(cursorWorld.x)}  Y ${Math.round(cursorWorld.y)}`
          : "X —  Y —"}
      </div>
      <div>
        Rover X {Math.round(rover.x)}  Y {Math.round(rover.y)}  {rover.heading.toFixed(1)}°
      </div>
    </div>
  )
}
