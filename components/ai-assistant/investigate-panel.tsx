"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { BackButton } from "./help-panels"

interface HelpBlock {
  type: string
  toString?: () => string
}

interface InvestigateWorkspace {
  getBlockById?: (id: string) => HelpBlock | null
  addChangeListener?: (fn: (event: { type?: string; blockId?: string | null; newElementId?: string | null }) => void) => void
  removeChangeListener?: (fn: (event: { type?: string; blockId?: string | null; newElementId?: string | null }) => void) => void
}

export function InvestigateMenu({
  workspace,
  onBack,
}: {
  workspace: InvestigateWorkspace | null
  onBack: () => void
}) {
  const [mode, setMode] = useState<"list" | "blocks" | "notebook">("list")

  if (mode === "blocks") {
    return <BlockHelp workspace={workspace} onBack={() => setMode("list")} />
  }
  if (mode === "notebook") {
    return <Notebook onBack={() => setMode("list")} />
  }

  return (
    <div className="text-gray-700">
      <BackButton colorClass="text-red-600 hover:text-red-800" onClick={onBack} />
      <p className="mb-4 font-medium text-base">What do you want to look at?</p>
      <div className="flex flex-col gap-2">
        <Button className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0" onClick={() => setMode("blocks")}>
          <span className="mr-2 font-semibold">1.</span> Click on a block for help
        </Button>
        <Button className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0" onClick={() => setMode("notebook")}>
          <span className="mr-2 font-semibold">2.</span> Record screenshot for engineering notebook
        </Button>
      </div>
    </div>
  )
}

function BlockHelp({ workspace, onBack }: { workspace: InvestigateWorkspace | null; onBack: () => void }) {
  const [selected, setSelected] = useState<{ type: string; label: string } | null>(null)

  useEffect(() => {
    if (!workspace?.addChangeListener || !workspace.removeChangeListener) return
    const onEvent = (event: { type?: string; blockId?: string | null; newElementId?: string | null }) => {
      if (event.type !== "selected" && event.type !== "click") return
      const id = event.blockId || event.newElementId
      if (!id || !workspace.getBlockById) return
      const block = workspace.getBlockById(id)
      if (!block) return
      const label = block.toString?.() || readableType(block.type)
      setSelected({ type: block.type, label })
    }
    workspace.addChangeListener(onEvent)
    return () => workspace.removeChangeListener?.(onEvent)
  }, [workspace])

  return (
    <div className="text-gray-700 text-sm">
      <BackButton colorClass="text-red-600 hover:text-red-800" onClick={onBack} />
      <p className="mb-3 font-medium">Click a block in the workspace.</p>
      {selected ? (
        <div className="rounded border border-dashed border-red-300 bg-red-50 p-3">
          <p className="font-medium text-red-900">{selected.label}</p>
          <p className="mt-1 text-xs text-slate-600">Help text for {readableType(selected.type)} will appear here.</p>
          <div className="mt-3 flex h-24 items-center justify-center rounded border border-red-200 bg-white text-xs text-red-400 animate-pulse">
            Animation placeholder
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Nothing selected yet.</p>
      )}
    </div>
  )
}

function Notebook({ onBack }: { onBack: () => void }) {
  const [shots, setShots] = useState<Array<{ at: string; src: string }>>([])
  const [note, setNote] = useState<string | null>(null)

  return (
    <div id="vex-ai-notebook" className="text-gray-700 text-sm">
      <BackButton colorClass="text-red-600 hover:text-red-800" onClick={onBack} />
      <p className="mb-3 font-medium">Engineering notebook</p>
      <Button
        className="mb-3 bg-red-500 hover:bg-red-600 text-white"
        onClick={() => {
          void captureNotebook().then((src) => {
            if (!src) {
              setNote("Open the playground or the block workspace, then try again.")
              return
            }
            setNote(null)
            setShots((prev) => [{ at: new Date().toLocaleTimeString(), src }, ...prev].slice(0, 6))
          })
        }}
      >
        Record screenshot
      </Button>
      {note ? <p className="mb-2 text-xs text-red-700">{note}</p> : null}
      <div className="space-y-2">
        {shots.map((shot) => (
          <figure key={shot.at + shot.src.slice(-12)} className="rounded border p-2">
            <div
              role="img"
              aria-label={`Notebook capture at ${shot.at}`}
              className="h-28 w-full rounded bg-slate-100 bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url("${shot.src}")` }}
            />
            <figcaption className="mt-1 text-xs text-slate-500">{shot.at}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

function readableType(type: string): string {
  return type.replace(/^pg_/, "").replaceAll("_", " ")
}

async function captureNotebook(): Promise<string | null> {
  const playground = document.getElementById("vex-playground-canvas")
  if (playground instanceof HTMLCanvasElement && playground.width > 0) {
    try {
      return playground.toDataURL("image/png")
    } catch {
      // A tainted canvas cannot be read; fall through to the block workspace.
    }
  }
  const svg = document.querySelector("#vex-blockly-workspace svg")
  if (!(svg instanceof SVGSVGElement)) return null
  const xml = new XMLSerializer().serializeToString(svg)
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }))
  try {
    const image = await loadImage(url)
    const canvas = document.createElement("canvas")
    canvas.width = 320
    canvas.height = 180
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.fillStyle = "#f7f8fb"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/png")
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("snapshot failed"))
    image.src = url
  })
}
