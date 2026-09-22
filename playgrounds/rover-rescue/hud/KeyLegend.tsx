"use client"

import type { ReactNode } from "react"

export function KeyLegend() {
  return (
    <div
      id="vex-rover-map-key"
      role="dialog"
      aria-label="Map key"
      className="absolute bottom-2 right-[8.5rem] z-30 w-56 rounded-lg border border-white/30 bg-slate-950/90 p-3 text-white shadow-xl backdrop-blur-md"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-violet-200">Map key</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
        <KeyItem swatch={<RoverSwatch />} label="Rover" />
        <KeyItem swatch={<BaseSwatch />} label="Base" />
        <KeyItem swatch={<MineralSwatch />} label="Minerals" />
        <KeyItem swatch={<RockSwatch />} label="Rock" />
        <KeyItem swatch={<PlantSwatch />} label="Plant" />
        <KeyItem swatch={<SpiderSwatch />} label="Spider" />
        <KeyItem swatch={<SerpentSwatch color="#e2a744" />} label="Orange serpent" />
        <KeyItem swatch={<SerpentSwatch color="#55afe1" />} label="Blue serpent" />
        <KeyItem swatch={<SerpentSwatch color="#b886d9" />} label="Purple serpent" />
        <KeyItem swatch={<RiverSwatch />} label="River hazard" />
        <KeyItem swatch={<BridgeSwatch />} label="Bridge" />
        <KeyItem swatch={<HillSwatch />} label="Hills" />
      </div>
      <p className="mt-2 text-[9px] leading-snug text-slate-300">
        Rocks and plants stop the rover. The river ends the mission. Minerals and
        enemies do not block.
      </p>
    </div>
  )
}

function KeyItem({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{swatch}</span>
      <span className="leading-tight text-slate-100">{label}</span>
    </div>
  )
}

function RoverSwatch() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <rect x="5" y="3" width="6" height="10" rx="1" fill="#152f4d" stroke="#49caee" strokeWidth="1.2" />
      <path d="M8 1.5 L10.2 4.2 H5.8 Z" fill="#81ffff" />
    </svg>
  )
}

function BaseSwatch() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="#6f705b" stroke="#c4b992" strokeWidth="1" />
      <path d="M5 5 L11 11 M11 5 L5 11" stroke="#fffbea" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function MineralSwatch() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <rect x="2" y="5" width="12" height="8" fill="#263e40" />
      <rect x="4" y="6" width="2" height="6" fill="#b7a049" />
      <rect x="10" y="6" width="2" height="6" fill="#b7a049" />
      <rect x="4" y="3.5" width="8" height="1.8" fill="#80f1ee" />
    </svg>
  )
}

function RockSwatch() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <polygon points="8,2 13,6 12,13 4,13 3,6" fill="#777867" />
      <polygon points="8,2 13,6 8,8 4,6" fill="#a0a087" />
    </svg>
  )
}

function PlantSwatch() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <circle cx="8" cy="8" r="3" fill="#35584d" />
      <circle cx="5" cy="6" r="2.2" fill="#599282" />
      <circle cx="11" cy="6" r="2.2" fill="#b8a33c" />
      <circle cx="8" cy="11" r="2" fill="#c77948" />
    </svg>
  )
}

function SpiderSwatch() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path
        d="M8 7 L2 4 M8 8 L2 8 M8 9 L2 12 M8 7 L14 4 M8 8 L14 8 M8 9 L14 12"
        stroke="#233f40"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="8" cy="8" r="2.4" fill="#315457" />
      <circle cx="8" cy="8" r="1.3" fill="#ae8eac" />
    </svg>
  )
}

function SerpentSwatch({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M2 10 C5 4, 8 12, 14 6" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function RiverSwatch() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <rect x="1" y="4" width="14" height="8" rx="2" fill="#3cbe29" />
      <path d="M2 8 C5 6, 8 10, 14 7" fill="none" stroke="#279c27" strokeWidth="1.4" />
    </svg>
  )
}

function BridgeSwatch() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <rect x="2" y="5" width="12" height="6" fill="#8b8a7d" stroke="#5c5b52" strokeWidth="0.8" />
      <path d="M4 5 V11 M8 5 V11 M12 5 V11" stroke="#c9c4b0" strokeWidth="0.8" />
    </svg>
  )
}

function HillSwatch() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M1 13 C3 7, 6 6, 8 9 C10 5, 13 6, 15 13 Z" fill="#a25544" />
      <path d="M4 13 C6 9, 8 9, 10 13" fill="#bd8c31" />
    </svg>
  )
}
