"use client"

import { MISSION_DAYS } from "../config"

export function MissionDialog({
  days,
  onContinue,
  onViewStatistics,
  onGetCertificate,
}: {
  days: number
  onContinue: () => void
  onViewStatistics: () => void
  onGetCertificate: () => void
}) {
  return (
    <div
      id="vex-rover-day50-dialog"
      className="absolute bottom-2 left-2 right-2 z-30 rounded-lg border border-emerald-300/80 bg-white/95 px-3 py-2.5 shadow-lg"
      role="dialog"
      aria-labelledby="vex-rover-day50-title"
    >
      <p id="vex-rover-day50-title" className="text-sm font-semibold text-emerald-800">
        {MISSION_DAYS} days survived
      </p>
      <p className="mt-0.5 text-[11px] text-slate-600">
        The rover is still running. Continue to re-irradiate neutralized enemies, or end the mission.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          id="vex-rover-day50-continue"
          type="button"
          className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
          onClick={(event) => {
            event.stopPropagation()
            onContinue()
          }}
        >
          Continue
        </button>
        <button
          id="vex-rover-day50-stats"
          type="button"
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
          onClick={(event) => {
            event.stopPropagation()
            onViewStatistics()
          }}
        >
          View Statistics
        </button>
        <button
          id="vex-rover-day50-certificate"
          type="button"
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
          onClick={(event) => {
            event.stopPropagation()
            onGetCertificate()
          }}
        >
          Get Certificate
        </button>
      </div>
      <p className="sr-only">{days.toFixed(1)} in-game days</p>
    </div>
  )
}
