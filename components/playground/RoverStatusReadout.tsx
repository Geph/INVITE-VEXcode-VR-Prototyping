"use client"

import { capacityForLevel, ROVER_LEVEL_MAX, type RoverStatus } from "@/playgrounds/rover-rescue"

/**
 * A compact battery and level strip beside the day counter. Phase 11 replaces
 * this with the framed battery and Strength / Level boxes from the reference
 * screenshots; until then it exists so the numbers driving the mission are
 * visible while playing.
 */
export function RoverStatusReadout({ status }: { status: RoverStatus }) {
  const tone =
    status.batteryPercent > 50 ? "text-green-600" : status.batteryPercent > 20 ? "text-amber-600" : "text-red-600"
  return (
    <div className="flex items-center gap-2">
      <div
        id="vex-playground-rover-battery"
        className="flex items-baseline gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 shadow-sm"
        title="Battery remaining. The mission ends at 0%"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Battery</span>
        <span
          id="vex-playground-rover-battery-value"
          className={`font-mono text-sm font-semibold leading-none ${tone}`}
        >
          {status.batteryPercent}%
        </span>
      </div>
      <div
        id="vex-playground-rover-level"
        className="flex items-baseline gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 shadow-sm"
        title={`Rover level. Capacity ${capacityForLevel(status.level)} minerals`}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Level</span>
        <span id="vex-playground-rover-level-value" className="font-mono text-sm font-semibold leading-none text-slate-900">
          {status.level}
        </span>
        <span className="text-[10px] font-medium text-slate-400">
          {status.level >= ROVER_LEVEL_MAX ? "max" : `XP ${status.exp}`}
        </span>
      </div>
      <div
        id="vex-playground-rover-cargo"
        className="flex items-baseline gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 shadow-sm"
        title="Mineral samples the rover is carrying. Drive onto Base to bank them."
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cargo</span>
        <span
          id="vex-playground-rover-cargo-value"
          className="font-mono text-sm font-semibold leading-none text-slate-900"
        >
          {status.stored}/{status.capacity}
        </span>
      </div>
    </div>
  )
}
