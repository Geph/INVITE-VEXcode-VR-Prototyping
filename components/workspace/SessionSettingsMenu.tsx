"use client"

import { useEffect, useRef, useState } from "react"
import { Download, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildSessionLog, downloadSessionLog, type SessionLogSnapshot } from "@/lib/session-log"

export function SessionSettingsMenu({ getSnapshot }: { getSnapshot: () => SessionLogSnapshot }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (menuRef.current && target && !menuRef.current.contains(target)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const handleExport = () => {
    setOpen(false)
    try {
      downloadSessionLog(buildSessionLog(getSnapshot()))
    } catch {
      /* export must not take down the workbench */
    }
  }

  return (
    <div id="vex-session-settings" className="relative" ref={menuRef}>
      <Button
        id="vex-btn-session-settings"
        type="button"
        variant="secondary"
        size="icon-sm"
        className="bg-white/20 hover:bg-white/30 text-white border-0"
        aria-label="Session settings"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Session settings"
        onClick={() => setOpen((value) => !value)}
      >
        <Settings className="h-4 w-4" />
      </Button>
      {open && (
        <div
          id="vex-session-settings-menu"
          role="menu"
          className="absolute right-0 top-full z-[60] mt-1 min-w-[220px] rounded-md border border-slate-700 bg-slate-900 py-1 text-sm text-slate-100 shadow-xl"
        >
          <button
            id="vex-session-export-log"
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 opacity-80" />
            Export session log…
          </button>
        </div>
      )}
    </div>
  )
}
