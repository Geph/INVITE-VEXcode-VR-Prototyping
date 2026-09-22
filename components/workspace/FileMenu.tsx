"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, FilePlus, FolderOpen, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { migrateWorkspaceXml } from "@/blocks/block-type-migration"

/**
 * `pg_events_when_started` used to be a C-block whose program lived in a "DO"
 * mouth. That input is gone, so projects saved before the change would load as
 * a bare hat with the whole stack discarded. Rehome the mouth onto the next
 * connection.
 */
function migrateWhenStartedMouths(dom: Element): void {
  for (const hat of Array.from(dom.querySelectorAll('block[type="pg_events_when_started"]'))) {
    const mouth = Array.from(hat.children).find(
      (child) => child.tagName === "statement" && child.getAttribute("name") === "DO",
    )
    if (!mouth) continue
    const next = hat.ownerDocument.createElement("next")
    while (mouth.firstChild) next.appendChild(mouth.firstChild)
    hat.replaceChild(next, mouth)
  }
}

export function FileMenu({ workspace }: { workspace: any }) {
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const fileMenuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!fileMenuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (fileMenuRef.current && target && !fileMenuRef.current.contains(target)) {
        setFileMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFileMenuOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [fileMenuOpen])

  const handleSave = () => {
    if (!workspace || !window.Blockly) return
    setFileMenuOpen(false)

    const Blockly = window.Blockly
    const xml = Blockly.Xml.workspaceToDom(workspace)
    const xmlText = Blockly.Xml.domToText(xml)

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
    const blob = new Blob([xmlText], { type: "text/xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vexcode-project-${stamp}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadWorkspaceFromXmlText = (xmlText: string) => {
    if (!workspace || !window.Blockly) return
    const Blockly = window.Blockly
    const xml = Blockly.utils.xml.textToDom(migrateWorkspaceXml(xmlText))
    migrateWhenStartedMouths(xml)
    workspace.clear()
    Blockly.Xml.domToWorkspace(xml, workspace)
  }

  const handleLoadProject = () => {
    setFileMenuOpen(false)
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !workspace || !window.Blockly) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        loadWorkspaceFromXmlText(String(event.target?.result ?? ""))
      } catch (error) {
        console.error("Failed to load project:", error)
        window.alert("Could not load that project file. Make sure it is a VEXcode XML export.")
      }
    }
    reader.readAsText(file)
  }

  const handleNewProject = () => {
    if (!workspace || !window.Blockly) return
    setFileMenuOpen(false)

    const confirmed = window.confirm(
      "Start a new blank project? Unsaved blocks on this workspace will be cleared.",
    )
    if (!confirmed) return

    workspace.clear()
    const whenStartedBlock = workspace.newBlock("pg_events_when_started")
    whenStartedBlock.initSvg()
    whenStartedBlock.render()
    whenStartedBlock.moveBy(50, 50)
    whenStartedBlock.setDeletable(true)
    whenStartedBlock.setMovable(true)
  }

  return (
    <div id="vex-header-menu" className="relative flex items-center gap-2 text-sm" ref={fileMenuRef}>
      <input
        ref={fileInputRef}
        id="vex-file-input"
        type="file"
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <Button
        id="vex-btn-file-menu"
        type="button"
        variant="ghost"
        className="hover:bg-white/10 px-3 py-1.5 rounded transition-colors text-white"
        aria-haspopup="menu"
        aria-expanded={fileMenuOpen}
        onClick={() => setFileMenuOpen((open) => !open)}
      >
        File
        <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-80" />
      </Button>
      {fileMenuOpen && (
        <div
          id="vex-file-menu"
          role="menu"
          className="absolute left-0 top-full z-[60] mt-1 min-w-[220px] rounded-md border border-slate-700 bg-slate-900 py-1 text-sm text-slate-100 shadow-xl"
        >
          <button
            id="vex-file-new"
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
            onClick={handleNewProject}
          >
            <FilePlus className="h-4 w-4 opacity-80" />
            New blank project
          </button>
          <button
            id="vex-file-load"
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
            onClick={handleLoadProject}
          >
            <FolderOpen className="h-4 w-4 opacity-80" />
            Load project from file…
          </button>
          <button
            id="vex-file-save"
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
            onClick={handleSave}
          >
            <Save className="h-4 w-4 opacity-80" />
            Save project to file…
          </button>
        </div>
      )}
    </div>
  )
}
