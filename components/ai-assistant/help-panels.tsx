"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { GitCompare, Heart, Lightbulb, Target, Users, Wrench, Zap, RotateCcw, Search, Gem, Crosshair, Home, Moon, Pencil, Map } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isCastleCrashersPlayground, isRoverRescuePlayground } from "@/hooks/playground-motion"
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
            className="justify-start text-left h-auto py-3 px-4 bg-slate-600 hover:bg-slate-700 text-white border-0"
            onClick={onOpenPlayground}
          >
            <Map className="w-5 h-5 mr-3" />
            <span>Open Playground</span>
          </Button>
        ) : null}
        <MenuButton color="bg-blue-500 hover:bg-blue-600" icon={<Lightbulb className="w-5 h-5 mr-3" />} n="1" label="Make a plan" onClick={() => setAiStep("strategy")} />
        <MenuButton color="bg-purple-500 hover:bg-purple-600" icon={<Target className="w-5 h-5 mr-3" />} n="2" label="Predict" onClick={() => setAiStep("predict")} />
        <MenuButton color="bg-red-500 hover:bg-red-600" icon={<Wrench className="w-5 h-5 mr-3" />} n="3" label="Investigate" onClick={() => setAiStep("fix")} />
        <MenuButton color="bg-green-500 hover:bg-green-600" icon={<GitCompare className="w-5 h-5 mr-3" />} n="4" label="Compare" onClick={() => setAiStep("compare")} />
        <MenuButton color="bg-orange-500 hover:bg-orange-600" icon={<Heart className="w-5 h-5 mr-3" />} n="5" label="How do you feel?" onClick={() => setAiStep("feel")} />
        <MenuButton color="bg-indigo-500 hover:bg-indigo-600" icon={<Users className="w-5 h-5 mr-3" />} n="6" label="Work with Someone" onClick={() => setAiStep("partner")} />
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
    <Button className={`justify-start text-left h-auto py-3 px-4 text-white border-0 ${color}`} onClick={onClick}>
      {icon}
      <span className="mr-2 font-semibold">{n}.</span>
      <span>{label}</span>
    </Button>
  )
}

/** Ocean Reef (and future Castle-free cleanup fields) keep the velocity / edge plans. */
const CLEANUP_PLANS = [
  { icon: Zap, label: "Move faster (efficiently)", detail: "examples" as const },
  { icon: RotateCcw, label: "Movement strategies", detail: "When the distance sensor sees a wall, turn so the robot keeps cleaning instead of pushing into the border." },
  { icon: Search, label: "Blocks that can help you", detail: "Look in Sensing and Control for blocks that check what is ahead, then choose a turn." },
]

const CASTLE_PLANS = [
  { icon: Pencil, label: "Draw your plan", detail: "draw" as const },
  { icon: RotateCcw, label: "Movement strategies", detail: "Stay on the green hex. If you get close to the red border, turn before the robot falls in the water." },
  { icon: Search, label: "Blocks that can help you", detail: "Look in Drivetrain and Sensing for blocks that help you aim pushes toward the water." },
]

const ROVER_PLANS = [
  { icon: Gem, label: "Find and use minerals", detail: "Drive to a mineral, absorb it, and use it before the battery runs out." },
  { icon: Crosshair, label: "Blast aliens", detail: "Face an alien and fire so it stops draining the battery." },
  { icon: Home, label: "Bring minerals to base", detail: "Carry minerals back to base and drop them there to store them." },
  { icon: Moon, label: "Sleep to last longer", detail: "Use standby to skip ahead when nothing useful is in range." },
]

export function PlanMenu({
  playgroundId,
  onBack,
  onExamples,
  onDraw,
}: {
  playgroundId: string
  onBack: () => void
  onExamples: () => void
  onDraw: () => void
}) {
  const rover = isRoverRescuePlayground(playgroundId)
  const castle = isCastleCrashersPlayground(playgroundId)
  const plans = rover ? ROVER_PLANS : castle ? CASTLE_PLANS : CLEANUP_PLANS
  const [note, setNote] = useState<string | null>(null)

  if (note) {
    return (
      <div className="text-gray-700 text-sm">
        <BackButton colorClass="text-blue-600 hover:text-blue-800" onClick={() => setNote(null)} />
        <p className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded">{note}</p>
      </div>
    )
  }

  const heading = rover
    ? "Which Rover Rescue plan?"
    : castle
      ? "Which Castle Crasher+ plan?"
      : "What strategy would you like help with?"

  return (
    <div className="text-gray-700">
      <BackButton colorClass="text-blue-600 hover:text-blue-800" onClick={onBack} />
      <p className="mb-4 font-medium text-base">{heading}</p>
      <div className="flex flex-col gap-2">
        {plans.map((plan, index) => {
          const Icon = plan.icon
          return (
            <Button
              key={plan.label}
              className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0"
              onClick={() => {
                if (plan.detail === "examples") onExamples()
                else if (plan.detail === "draw") onDraw()
                else if (typeof plan.detail === "string") setNote(plan.detail)
              }}
            >
              <Icon className="w-5 h-5 mr-3" />
              <span className="mr-2 font-semibold">{index + 1}.</span>
              <span>{plan.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
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
            className="justify-start text-left h-auto py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white border-0"
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
          <Button className="justify-start text-left h-auto py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white border-0" onClick={() => shareCode(workspace, setCode, setCopied, setPanel)}>
            <span className="mr-2 font-semibold">1.</span> Share your code
          </Button>
          <Button className="justify-start text-left h-auto py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white border-0" onClick={() => setPanel("pair")}>
            <span className="mr-2 font-semibold">2.</span> Pair programming mode
          </Button>
          <Button className="justify-start text-left h-auto py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white border-0" onClick={() => setPanel("multi")}>
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

/** Scratch pad so learners can sketch a push path before they build blocks. */
export function DrawPlanPanel({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasMarks, setHasMarks] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    paintIsland(ctx, canvas.width, canvas.height)
  }, [])

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  return (
    <div id="vex-ai-draw-plan" className="text-gray-700 text-sm">
      <BackButton colorClass="text-blue-600 hover:text-blue-800" onClick={onBack} />
      <p className="mb-2 font-medium text-base">Draw your plan</p>
      <p className="mb-3 text-xs text-slate-600">
        Sketch where you will push castle pieces into the water. Use this as a rough path before you build the
        blocks.
      </p>
      <canvas
        ref={canvasRef}
        width={280}
        height={220}
        className="w-full touch-none rounded-lg border-2 border-blue-300 bg-green-50"
        onPointerDown={(event) => {
          const canvas = canvasRef.current
          const ctx = canvas?.getContext("2d")
          const p = point(event)
          if (!canvas || !ctx || !p) return
          drawing.current = true
          canvas.setPointerCapture(event.pointerId)
          ctx.strokeStyle = "#1565C0"
          ctx.lineWidth = 3
          ctx.lineCap = "round"
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          setHasMarks(true)
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return
          const ctx = canvasRef.current?.getContext("2d")
          const p = point(event)
          if (!ctx || !p) return
          ctx.lineTo(p.x, p.y)
          ctx.stroke()
        }}
        onPointerUp={() => {
          drawing.current = false
        }}
        onPointerCancel={() => {
          drawing.current = false
        }}
      />
      <div className="mt-2 flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasMarks}
          onClick={() => {
            const canvas = canvasRef.current
            const ctx = canvas?.getContext("2d")
            if (!canvas || !ctx) return
            paintIsland(ctx, canvas.width, canvas.height)
            setHasMarks(false)
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  )
}

function paintIsland(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = "#E8F5E9"
  ctx.fillRect(0, 0, width, height)
  // Hex hint matches Castle Crasher+'s island.
  ctx.strokeStyle = "#8B1E1E"
  ctx.lineWidth = 3
  const cx = width / 2
  const cy = height / 2
  const r = Math.min(cx, cy) - 12
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = ((-90 + i * 60) * Math.PI) / 180
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = "#81C784"
  ctx.fill()
}

