"use client"

import { useEffect, useRef, useState } from "react"
import {
  ensureBlocklyWidgetDivReady,
  VEX_WIDGET_NODE_SELECTOR,
} from "@/lib/blockly-widget-form"
import { createVexTheme } from "@/lib/vex-blockly-theme"

export function useBlocklyLoader(onRegisterBlocks: (Blockly: any) => void) {
  const [blocklyLoaded, setBlocklyLoaded] = useState(false)
  const [blocklyLoadError, setBlocklyLoadError] = useState<string | null>(null)
  const onRegisterRef = useRef(onRegisterBlocks)
  onRegisterRef.current = onRegisterBlocks

  useEffect(() => {
    let cancelled = false

    const register = (Blockly: any) => {
      onRegisterRef.current(Blockly)
    }

    if (window.Blockly) {
      register(window.Blockly)
      setBlocklyLoaded(true)
      return
    }

    void (async () => {
      try {
        const [core, generator] = await Promise.all([import("blockly"), import("blockly/javascript")])
        if (cancelled) return

        const Blockly = Object.assign(Object.create(null), core, {
          JavaScript: generator.javascriptGenerator,
        })

        window.Blockly = Blockly
        register(Blockly)
        setBlocklyLoaded(true)
      } catch (error) {
        if (cancelled) return
        console.error("Failed to load Blockly:", error)
        setBlocklyLoadError(error instanceof Error ? error.message : "Unknown error")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return { blocklyLoaded, blocklyLoadError }
}

export function useBlocklyInjection(
  blocklyLoaded: boolean,
  blocklyDivRef: { current: HTMLDivElement | null },
  onWorkspaceReady: (workspace: any) => void,
) {
  const [workspace, setWorkspace] = useState<any>(null)
  const onReadyRef = useRef(onWorkspaceReady)
  onReadyRef.current = onWorkspaceReady

  useEffect(() => {
    if (!blocklyLoaded || !blocklyDivRef.current || workspace) return

    const Blockly = window.Blockly
    const ws = Blockly.inject(blocklyDivRef.current, {
      toolbox: {
        kind: "flyoutToolbox",
        contents: [],
      },
      renderer: "zelos",
      theme: createVexTheme(Blockly),
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2,
      },
      move: {
        scrollbars: true,
        drag: true,
        wheel: true,
      },
      trashcan: false,
    })
    setWorkspace(ws)
    onReadyRef.current(ws)

    setTimeout(() => {
      const whenStartedBlock = ws.newBlock("when_started")
      whenStartedBlock.initSvg()
      whenStartedBlock.render()
      whenStartedBlock.moveBy(50, 50)
      whenStartedBlock.setDeletable(true)
      whenStartedBlock.setMovable(true)
      ensureBlocklyWidgetDivReady()
    }, 100)
  }, [blocklyLoaded, workspace, blocklyDivRef])

  return workspace
}

export function useBlocklyWidgetFix(blocklyLoaded: boolean) {
  useEffect(() => {
    if (!blocklyLoaded) return
    ensureBlocklyWidgetDivReady()
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue
          if (node.matches?.(VEX_WIDGET_NODE_SELECTOR) || node.querySelector?.(VEX_WIDGET_NODE_SELECTOR)) {
            ensureBlocklyWidgetDivReady()
            return
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [blocklyLoaded])
}
