"use client"

import { useEffect, useState } from "react"
import type { CastleCrashersState } from "./state"
import type { CastleLevel } from "./config"

function formatTimer(ms: number): string {
  const totalTenths = Math.floor(ms / 100)
  const tenths = totalTenths % 10
  const totalSec = Math.floor(totalTenths / 10)
  const sec = totalSec % 60
  const min = Math.floor(totalSec / 60)
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}:${tenths}`
}

export function CastleCrashersHud({
  stateRef,
}: {
  stateRef: { current: CastleCrashersState }
}) {
  const [snap, setSnap] = useState(() => ({
    kg: stateRef.current.weightClearedKg,
    ms: stateRef.current.missionMs,
    reason: stateRef.current.missionReason,
  }))

  useEffect(() => {
    let frame = 0
    const tick = () => {
      const s = stateRef.current
      setSnap((prev) => {
        if (prev.kg === s.weightClearedKg && prev.ms === s.missionMs && prev.reason === s.missionReason) {
          return prev
        }
        return { kg: s.weightClearedKg, ms: s.missionMs, reason: s.missionReason }
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [stateRef])

  return (
    <div id="vex-castle-hud" className="pointer-events-none absolute bottom-3 left-3 z-10 space-y-1">
      <div className="rounded border border-black bg-white px-2 py-1 text-xs font-semibold text-black">
        Castle Cleared: {snap.kg} kg
      </div>
      <div className="rounded border border-black bg-white px-2 py-1 text-xs font-mono text-black">
        {formatTimer(snap.ms)}
      </div>
      {snap.reason === "water" ? (
        <div className="rounded border border-red-700 bg-red-50 px-2 py-1 text-xs text-red-800">
          Robot fell in the water
        </div>
      ) : null}
    </div>
  )
}

export function CastleLevelToggle({
  level,
  onChange,
}: {
  level: CastleLevel
  onChange: (level: CastleLevel) => void
}) {
  return (
    <button
      id="vex-castle-level-toggle"
      type="button"
      className="absolute bottom-3 right-3 z-10 rounded border border-amber-700 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950"
      onClick={() => onChange(level === 1 ? 2 : 1)}
      title="State Select — switch Castle Crasher+ level"
    >
      Level {level}
    </button>
  )
}
