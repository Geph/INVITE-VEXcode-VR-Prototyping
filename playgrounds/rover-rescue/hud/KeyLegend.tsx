"use client"

import type { ReactNode } from "react"
import {
  BatteryMedium,
  Biohazard,
  Bot,
  Bug,
  Castle,
  Flower2,
  Footprints,
  Mountain,
  Route,
} from "lucide-react"

export function KeyLegend() {
  return (
    <div
      id="vex-rover-map-key"
      role="dialog"
      aria-label="Map key"
      className="absolute bottom-[8.75rem] right-[6.75rem] z-30 w-52 rounded-lg border border-white/30 bg-slate-950/90 p-3 text-white shadow-xl backdrop-blur-md"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-violet-200">Map key</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
        <KeyItem icon={<BatteryMedium />} color="text-cyan-300" label="Resource" />
        <KeyItem icon={<Bot />} color="text-sky-300" label="Rover" />
        <KeyItem icon={<Mountain />} color="text-stone-300" label="Rock" />
        <KeyItem icon={<Flower2 />} color="text-green-400" label="Plant" />
        <KeyItem icon={<Bug />} color="text-stone-200" label="Spider" />
        <KeyItem icon={<Footprints />} color="text-orange-400" label="Orange serpent" />
        <KeyItem icon={<Footprints />} color="text-blue-400" label="Blue serpent" />
        <KeyItem icon={<Footprints />} color="text-violet-400" label="Purple serpent" />
        <KeyItem icon={<Biohazard />} color="text-emerald-400" label="River hazard" />
        <KeyItem icon={<Route />} color="text-amber-300" label="Bridge" />
        <KeyItem icon={<Castle />} color="text-yellow-300" label="Base" />
      </div>
    </div>
  )
}

function KeyItem({
  icon,
  color,
  label,
}: {
  icon: ReactNode
  color: string
  label: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4 ${color}`}>
        {icon}
      </span>
      <span className="leading-tight text-slate-100">{label}</span>
    </div>
  )
}
