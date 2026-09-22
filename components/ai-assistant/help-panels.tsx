"use client"

import { useState, type ReactNode } from "react"
import { GitCompare, Heart, Lightbulb, Users, Wrench, Map } from "lucide-react"
import { Button } from "@/components/ui/button"
import { generatePythonProgram } from "@/lib/python-generator"
import type { PyWorkspace } from "@/blocks/generators/python-types"
import type { SurveyStep } from "./types"

const EMOTIONS = [
  { emoji: "😤", label: "Frustrated" },
  { emoji: "😕", label: "Stuck" },
  { emoji: "🤔", label: "Curious" },
  { emoji: "😄", label: "Excited" },
  { emoji: "😌", label: "Proud" },
  { emoji: "😴", label: "Tired" },
]

export function BackButton({
  colorClass,
  onClick,
}: {
  colorClass: string
  onClick: () => void
}) {
  return (
    <Button variant="ghost" size="sm" className={`mb-3 -ml-2 ${colorClass}`} onClick={onClick}>
      ← Back
    </Button>
  )
}

export function MainMenu({
  setAiStep,
  playgroundVisible,
  onOpenPlayground,
}: {
  setAiStep: (step: SurveyStep) => void
  playgroundVisible: boolean
  onOpenPlayground: () => void
}) {
  return (
    <div id="vex-ai-assistant-menu" className="text-gray-700">
      <p className="mb-4 font-medium text-base">What sort of help do you want?</p>
      <div className="flex flex-col gap-2">
        {!playgroundVisible ? (
          <Button
            id="vex-ai-open-playground"
            className="justify-start text-left whitespace-normal break-words h-auto py-3 px-4 bg-slate-600 hover:bg-slate-700 text-white border-0"
            onClick={onOpenPlayground}
          >
            <Map className="w-5 h-5 mr-3" />
            <span>Open Playground</span>
          </Button>
        ) : null}
        <MenuButton color="bg-blue-500 hover:bg-blue-600" icon={<Lightbulb className="w-5 h-5 mr-3" />} n="1" label="Make a plan" onClick={() => setAiStep("strategy")} />
        <MenuButton color="bg-red-500 hover:bg-red-600" icon={<Wrench className="w-5 h-5 mr-3" />} n="2" label="Investigate" onClick={() => setAiStep("fix")} />
        <MenuButton color="bg-green-500 hover:bg-green-600" icon={<GitCompare className="w-5 h-5 mr-3" />} n="3" label="Compare" onClick={() => setAiStep("compare")} />
        <MenuButton color="bg-orange-500 hover:bg-orange-600" icon={<Heart className="w-5 h-5 mr-3" />} n="4" label="How do you feel?" onClick={() => setAiStep("feel")} />
        <MenuButton color="bg-indigo-500 hover:bg-indigo-600" icon={<Users className="w-5 h-5 mr-3" />} n="5" label="Work with Someone" onClick={() => setAiStep("partner")} />
      </div>
    </div>
  )
}

function MenuButton({
  color,
  icon,
  n,
  label,
  onClick,
}: {
  color: string
  icon: ReactNode
  n: string
  label: string
  onClick: () => void
}) {
  return (
    <Button className={`justify-start text-left whitespace-normal break-words h-auto py-3 px-4 text-white border-0 ${color}`} onClick={onClick}>
      {icon}
      <span className="mr-2 font-semibold">{n}.</span>
      <span>{label}</span>
    </Button>
  )
}

export function FeelMenu({ onBack }: { onBack: () => void }) {
  const [chosen, setChosen] = useState<string | null>(null)
  return (
    <div className="text-gray-700">
      <BackButton colorClass="text-orange-600 hover:text-orange-800" onClick={onBack} />
      <p className="mb-4 font-medium text-base">How are you feeling?</p>
      <div className="flex flex-col gap-2">
        {EMOTIONS.map((emotion, index) => (
          <Button
            key={emotion.label}
            className="justify-start text-left whitespace-normal break-words h-auto py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white border-0"
            onClick={() => setChosen(emotion.label)}
          >
            <span className="mr-3 text-lg" aria-hidden>
              {emotion.emoji}
            </span>
            <span className="mr-2 font-semibold">{index + 1}.</span>
            <span>{emotion.label}</span>
          </Button>
        ))}
      </div>
      {chosen ? <p className="mt-3 text-sm text-orange-800">Noted: you feel {chosen.toLowerCase()}.</p> : null}
    </div>
  )
}

export function PartnerMenu({
  workspace,
  onBack,
}: {
  workspace: { getAllBlocks: (ordered: boolean) => unknown[] } | null
  onBack: () => void
}) {
  const [panel, setPanel] = useState<"list" | "share" | "pair" | "multi">("list")
  const [code, setCode] = useState("")
  const [copied, setCopied] = useState(false)

  if (panel === "list") {
    return (
      <div className="text-gray-700">
        <BackButton colorClass="text-indigo-600 hover:text-indigo-800" onClick={onBack} />
        <p className="mb-4 font-medium text-base">How would you like to work together?</p>
        <div className="flex flex-col gap-2">
          <Button className="justify-start text-left whitespace-normal break-words h-auto py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white border-0" onClick={() => shareCode(workspace, setCode, setCopied, setPanel)}>
            <span className="mr-2 font-semibold">1.</span> Share your code
          </Button>
          <Button className="justify-start text-left whitespace-normal break-words h-auto py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white border-0" onClick={() => setPanel("pair")}>
            <span className="mr-2 font-semibold">2.</span> Pair programming mode
          </Button>
          <Button className="justify-start text-left whitespace-normal break-words h-auto py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white border-0" onClick={() => setPanel("multi")}>
            <span className="mr-2 font-semibold">3.</span> Multiplayer mode
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="text-gray-700 text-sm">
      <BackButton colorClass="text-indigo-600 hover:text-indigo-800" onClick={() => setPanel("list")} />
      {panel === "share" ? (
        <div className="space-y-2">
          <p className="font-medium">{copied ? "Copied to the clipboard." : "Copy this and send it to your partner."}</p>
          <textarea readOnly value={code} className="w-full h-40 text-xs font-mono border rounded p-2" />
        </div>
      ) : null}
      {panel === "pair" ? (
        <p className="p-3 bg-indigo-50 border-l-4 border-indigo-500 rounded">
          Pair programming mode: one of you drives the blocks, the other reads the playground and says what to try next. Switch roles after each run.
        </p>
      ) : null}
      {panel === "multi" ? (
        <p className="p-3 bg-indigo-50 border-l-4 border-indigo-500 rounded">
          Multiplayer mode: use the Multiplayer button in the header so each person has a robot on the same playground.
        </p>
      ) : null}
    </div>
  )
}

function shareCode(
  workspace: { getAllBlocks: (ordered: boolean) => unknown[] } | null,
  setCode: (code: string) => void,
  setCopied: (copied: boolean) => void,
  setPanel: (panel: "share") => void,
) {
  const text = generatePythonProgram(workspace as unknown as PyWorkspace | null)
  setCode(text)
  setPanel("share")
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }
}

