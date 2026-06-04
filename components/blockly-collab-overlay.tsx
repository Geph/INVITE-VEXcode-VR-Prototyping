"use client"

import { useEffect, useRef } from "react"
import type { CollabPeer } from "@/lib/use-blockly-collab"

interface BlocklyCollabOverlayProps {
  peers: CollabPeer[]
  workspace: {
    getBlockById: (id: string) => { getSvgRoot?: () => SVGElement | null } | null
  } | null
}

/** Remote peer cursors + colored outlines on blocks they have selected. */
export default function BlocklyCollabOverlay({ peers, workspace }: BlocklyCollabOverlayProps) {
  const highlightRefs = useRef<Map<string, { el: SVGElement; stroke: string | null }>>(new Map())

  useEffect(() => {
    if (!workspace) return

    const activeKeys = new Set<string>()

    for (const peer of peers) {
      for (const blockId of peer.selectedBlockIds) {
        const key = `${peer.id}:${blockId}`
        activeKeys.add(key)
        const block = workspace.getBlockById(blockId)
        const root = block?.getSvgRoot?.()
        const path = root?.querySelector(".blocklyPath") as SVGElement | null
        if (!path) continue

        if (!highlightRefs.current.has(key)) {
          highlightRefs.current.set(key, {
            el: path,
            stroke: path.getAttribute("stroke"),
          })
        }
        path.setAttribute("stroke", peer.color)
        path.setAttribute("stroke-width", "4")
      }
    }

    for (const [key, entry] of highlightRefs.current.entries()) {
      if (!activeKeys.has(key)) {
        if (entry.stroke) entry.el.setAttribute("stroke", entry.stroke)
        else entry.el.removeAttribute("stroke")
        entry.el.removeAttribute("stroke-width")
        highlightRefs.current.delete(key)
      }
    }
  }, [peers, workspace])

  useEffect(() => {
    return () => {
      for (const [, entry] of highlightRefs.current.entries()) {
        if (entry.stroke) entry.el.setAttribute("stroke", entry.stroke)
        else entry.el.removeAttribute("stroke")
        entry.el.removeAttribute("stroke-width")
      }
      highlightRefs.current.clear()
    }
  }, [workspace])

  return (
    <div
      id="vex-blockly-collab-overlay"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      aria-hidden
    >
      {peers.map((peer) =>
        peer.cursor ? (
          <div
            key={peer.id}
            className="absolute flex items-start gap-1 transition-transform duration-75"
            style={{
              left: peer.cursor.x,
              top: peer.cursor.y,
              transform: "translate(-2px, -2px)",
            }}
          >
            <svg width="18" height="22" viewBox="0 0 18 22" className="drop-shadow-md">
              <path
                d="M1 1L1 16L6 11L10 20L13 19L9 10L16 10L1 1Z"
                fill={peer.color}
                stroke="#fff"
                strokeWidth="1.2"
              />
            </svg>
            <span
              className="mt-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-md"
              style={{ backgroundColor: peer.color }}
            >
              {peer.name}
            </span>
          </div>
        ) : null,
      )}
    </div>
  )
}
