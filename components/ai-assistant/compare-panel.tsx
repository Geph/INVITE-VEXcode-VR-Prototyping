"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { isRoverRescuePlayground } from "@/hooks/playground-motion"
import type { OceanReefState } from "@/playgrounds/ocean-reef"
import type { RoverRescueState } from "@/playgrounds/rover-rescue"
import { BackButton } from "./help-panels"

interface VersionWorkspace {
  getAllBlocks?: (ordered?: boolean) => unknown[]
}

export function CompareMenu({
  playgroundId,
  reefState,
  roverState,
  workspace,
  onBack,
}: {
  playgroundId: string
  reefState: OceanReefState
  roverState: RoverRescueState
  workspace: VersionWorkspace | null
  onBack: () => void
}) {
  const [mode, setMode] = useState<"list" | "scores" | "versions">("list")
  if (mode === "scores") {
    return (
      <ScoreHistory
        label={scoreLabel(playgroundId, reefState, roverState)}
        onBack={() => setMode("list")}
      />
    )
  }
  if (mode === "versions") {
    return <CompareVersions workspace={workspace} onBack={() => setMode("list")} />
  }
  return (
    <div className="text-gray-700">
      <BackButton colorClass="text-green-600 hover:text-green-800" onClick={onBack} />
      <p className="mb-4 font-medium text-base">What would you like to compare?</p>
      <div className="flex flex-col gap-2">
        <Button className="justify-start text-left whitespace-normal break-words h-auto py-3 px-4 bg-green-500 hover:bg-green-600 text-white border-0" onClick={() => setMode("scores")}>
          <span className="mr-2 font-semibold">1.</span> Score history
        </Button>
        <Button className="justify-start text-left whitespace-normal break-words h-auto py-3 px-4 bg-green-500 hover:bg-green-600 text-white border-0" onClick={() => setMode("versions")}>
          <span className="mr-2 font-semibold">2.</span> Compare to previous versions of your code
        </Button>
      </div>
    </div>
  )
}

function scoreLabel(playgroundId: string, reef: OceanReefState, rover: RoverRescueState): string {
  if (isRoverRescuePlayground(playgroundId)) {
    return `Level ${rover.level} · battery ${Math.round(rover.batteryPercent)}% · carrying ${rover.storage.length}`
  }
  return `Trash collected ${reef.trashCollected}`
}

function ScoreHistory({ label, onBack }: { label: string; onBack: () => void }) {
  const [rows, setRows] = useState<Array<{ at: string; label: string }>>([])
  return (
    <div id="vex-ai-score-history" className="text-gray-700 text-sm">
      <BackButton colorClass="text-green-600 hover:text-green-800" onClick={onBack} />
      <p className="mb-2 font-medium">Score history</p>
      <p className="mb-3 text-xs text-slate-600">Current: {label}</p>
      <Button
        className="mb-3 bg-green-500 hover:bg-green-600 text-white"
        onClick={() => setRows((prev) => [{ at: new Date().toLocaleTimeString(), label }, ...prev])}
      >
        Save this score
      </Button>
      {rows.length === 0 ? <p className="text-xs text-slate-500">No scores saved yet.</p> : null}
      <ol className="space-y-1">
        {rows.map((row, index) => (
          <li key={`${row.at}-${index}`} className="rounded border px-2 py-1">
            {row.at} — {row.label}
          </li>
        ))}
      </ol>
    </div>
  )
}

function CompareVersions({ workspace, onBack }: { workspace: VersionWorkspace | null; onBack: () => void }) {
  const [versions, setVersions] = useState<Array<{ at: string; blocks: number; text: string }>>([])

  const capture = () => {
    const text = workspaceXml(workspace)
    const blocks = workspace?.getAllBlocks?.(false).length ?? 0
    setVersions((prev) => [{ at: new Date().toLocaleTimeString(), blocks, text }, ...prev].slice(0, 8))
  }

  const newest = versions[0]
  const previous = versions[1]

  return (
    <div id="vex-ai-versions" className="text-gray-700 text-sm">
      <BackButton colorClass="text-green-600 hover:text-green-800" onClick={onBack} />
      <p className="mb-2 font-medium">Compare to previous versions of your code</p>
      <Button className="mb-3 bg-green-500 hover:bg-green-600 text-white" onClick={capture}>
        Save this version
      </Button>
      {newest && previous ? (
        <p className="mb-2 rounded bg-green-50 p-2 text-xs">
          Latest has {newest.blocks} blocks ({newest.text.length} characters). Previous had {previous.blocks} blocks ({previous.text.length} characters).
        </p>
      ) : (
        <p className="mb-2 text-xs text-slate-500">Save two versions to see what changed.</p>
      )}
      <ol className="space-y-1">
        {versions.map((version, index) => (
          <li key={`${version.at}-${index}`} className="rounded border px-2 py-1 text-xs">
            {version.at} — {version.blocks} blocks
          </li>
        ))}
      </ol>
    </div>
  )
}

function workspaceXml(workspace: VersionWorkspace | null): string {
  const blockly = (window as Window & { Blockly?: { Xml?: { workspaceToDom: (workspace: unknown) => unknown; domToText: (dom: unknown) => string } } }).Blockly
  if (!workspace || !blockly?.Xml) return ""
  return blockly.Xml.domToText(blockly.Xml.workspaceToDom(workspace))
}
