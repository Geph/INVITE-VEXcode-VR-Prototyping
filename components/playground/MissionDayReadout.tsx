"use client"

import { formatDays, MISSION_DAYS } from "@/playgrounds/rover-rescue"

/** Sits in the run toolbar rather than over the field, which stays uncovered. */
export function MissionDayReadout({ days }: { days: number }) {
  const complete = days >= MISSION_DAYS
  return (
    <div
      id="vex-playground-mission-days"
      className="flex items-baseline justify-end gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 shadow-sm"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Day</span>
      <span
        id="vex-playground-mission-days-value"
        className={`font-mono text-sm font-semibold leading-none ${complete ? "text-green-600" : "text-slate-900"}`}
      >
        {formatDays(days)}
      </span>
      <span className="text-[10px] font-medium text-slate-400">of {MISSION_DAYS}</span>
    </div>
  )
}
