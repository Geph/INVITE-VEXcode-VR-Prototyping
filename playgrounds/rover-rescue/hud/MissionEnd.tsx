"use client"

import { useState } from "react"
import { formatDays } from "../mission"
import { MISSION_DAYS } from "../config"
import type { Day50Snapshot } from "../systems/day50"

export function MissionEndPanel({
  view,
  snapshot,
  onRetry,
}: {
  view: "stats" | "certificate"
  snapshot: Day50Snapshot
  onRetry: () => void
}) {
  return view === "certificate" ? (
    <CertificateCard snapshot={snapshot} onRetry={onRetry} />
  ) : (
    <StatisticsCard snapshot={snapshot} onRetry={onRetry} />
  )
}

function StatisticsCard({ snapshot, onRetry }: { snapshot: Day50Snapshot; onRetry: () => void }) {
  const n = snapshot.neutralized
  return (
    <div id="vex-rover-day50-stats-panel" className="bg-white rounded-xl p-6 shadow-2xl text-center max-w-sm">
      <h3 className="text-2xl font-bold text-green-600 mb-1">Mission complete!</h3>
      <p className="text-gray-600 mb-4">The rover survived the full {MISSION_DAYS}-day mission.</p>
      <dl id="vex-rover-day50-stats-list" className="grid grid-cols-2 gap-x-4 gap-y-1 text-left text-sm mb-4">
        <Stat label="Days" value={formatDays(snapshot.days)} />
        <Stat label="Level" value={String(snapshot.level)} />
        <Stat label="XP" value={String(snapshot.xp)} />
        <Stat label="Battery" value={`${snapshot.batteryPercent}%`} />
        <Stat label="Spiders" value={String(n.spider)} />
        <Stat label="Orange serpents" value={String(n.orange)} />
        <Stat label="Blue serpents" value={String(n.blue)} />
        <Stat label="Purple serpents" value={String(n.purple)} />
      </dl>
      <RetryButton onRetry={onRetry} />
    </div>
  )
}

function CertificateCard({ snapshot, onRetry }: { snapshot: Day50Snapshot; onRetry: () => void }) {
  const [name, setName] = useState("")
  const who = name.trim() || "Rover operator"
  return (
    <div id="vex-rover-day50-certificate-panel" className="bg-white rounded-xl p-6 shadow-2xl text-center max-w-sm">
      <div className="rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-5 mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">Rover Rescue</p>
        <h3 className="text-xl font-bold text-amber-950 mt-1">Mission certificate</h3>
        <label className="mt-3 block text-left text-[11px] font-semibold text-slate-600" htmlFor="vex-rover-certificate-name">
          Operator name
        </label>
        <input
          id="vex-rover-certificate-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        <p className="mt-3 text-sm text-slate-800">
          This certifies that <span className="font-semibold">{who}</span> survived {formatDays(snapshot.days)}{" "}
          days at level {snapshot.level} with {snapshot.xp} XP.
        </p>
      </div>
      <div className="flex justify-center gap-2">
        <button
          id="vex-rover-certificate-print"
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          onClick={() => window.print()}
        >
          Print
        </button>
        <RetryButton onRetry={onRetry} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-mono font-semibold text-slate-900 text-right">{value}</dd>
    </>
  )
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      id="vex-playground-gameover-retry"
      type="button"
      onClick={onRetry}
      className="bg-purple-500 hover:bg-purple-600 text-white rounded-md px-4 py-2 text-sm font-semibold"
    >
      Try Again
    </button>
  )
}
