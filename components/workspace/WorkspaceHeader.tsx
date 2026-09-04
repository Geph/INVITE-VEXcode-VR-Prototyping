"use client"

import { Bot } from "lucide-react"
import { CodeViewToggle, HeaderActions } from "@/components/workspace/Toolbar"
import { FileMenu } from "@/components/workspace/FileMenu"
import type { CollabState } from "@/lib/use-blockly-collab"

export function WorkspaceHeader({
  workspace,
  codeView,
  onToggleCodeView,
  collab,
  playgroundVisible,
  playgroundPickerOpen,
  onOpenPlayground,
  onGetHelp,
  onOpenRobotConfig,
}: {
  workspace: any
  codeView: "blocks" | "python"
  onToggleCodeView: () => void
  collab: CollabState
  playgroundVisible: boolean
  playgroundPickerOpen: boolean
  onOpenPlayground: () => void
  onGetHelp: () => void
  onOpenRobotConfig: () => void
}) {
  return (
    <div id="vex-header" className="h-14 flex items-center justify-between px-4 text-white">
      <div id="vex-header-left" className="flex items-center gap-4">
        <div
          id="vex-header-brand"
          className="flex h-9 w-9 shrink-0 items-center justify-center"
          title="VEXcode VR Codesign Prototype"
          aria-label="VEXcode VR Codesign Prototype"
        >
          <Bot className="h-5 w-5 text-white" strokeWidth={2.25} aria-hidden />
        </div>
        <FileMenu workspace={workspace} />
      </div>
      <div id="vex-header-project-info" className="flex items-center gap-2">
        <span className="text-sm font-semibold">VEXcode Project</span>
        <CodeViewToggle
          codeView={codeView}
          onToggle={onToggleCodeView}
        />
        <span className="text-xs text-white/70">Not Saving</span>
      </div>
      <div
        id="vex-collab-status"
        className="flex items-center gap-2 rounded-md bg-white/15 px-3 py-1 text-xs"
        title="Everyone on this URL with the same room edits the same blocks in real time."
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            collab.connected ? "bg-green-300" : "bg-amber-300"
          }`}
          aria-hidden
        />
        <span>
          {collab.connected ? (collab.synced ? "Synced" : "Live collab") : "Connecting…"}
          {" · "}
          Room <span className="font-mono font-semibold">{collab.roomId}</span>
          {" · "}
          {1 + collab.peers.length} here
        </span>
        {collab.localName && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: collab.localColor }}
          >
            {collab.localName} (you)
          </span>
        )}
        {collab.peers.length > 0 && (
          <span className="flex items-center gap-1">
            {collab.peers.map((p) => (
              <span
                key={p.id}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: p.color }}
              >
                {p.name}
              </span>
            ))}
          </span>
        )}
        {collab.error && (
          <span className="text-amber-200" title={collab.error}>
            — run <span className="font-mono">npm run dev:all</span>
          </span>
        )}
      </div>
      <HeaderActions
        playgroundVisible={playgroundVisible}
        playgroundPickerOpen={playgroundPickerOpen}
        onOpenPlayground={onOpenPlayground}
        onGetHelp={onGetHelp}
        onOpenRobotConfig={onOpenRobotConfig}
      />
    </div>
  )
}
