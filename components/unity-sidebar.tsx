"use client"

import { useEffect, useRef } from "react"
import { Unity, useUnityContext } from "react-unity-webgl"

/** GitHub Pages serves the app under /<repo>, so public assets need the prefix. */
const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

/**
 * Cap the WebGL backing store at 1× CSS pixels. Retina / 3× displays otherwise
 * allocate huge framebuffers for this small sidebar viewport and can OOM.
 */
const UNITY_PIXEL_RATIO = 1

/** One live createUnityInstance at a time — a second heap will crash the tab. */
let unityPlayerClaimed = false

const unityConfig = {
  loaderUrl: `${assetBase}/Build/agent.loader.js`,
  dataUrl: `${assetBase}/Build/agent.data.unityweb`,
  frameworkUrl: `${assetBase}/Build/agent.framework.js.unityweb`,
  codeUrl: `${assetBase}/Build/agent.wasm.unityweb`,
  companyName: "INVITE",
  productName: "INVITE VEXcode VR",
  productVersion: "0.1.0",
  webglContextAttributes: {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: "low-power" as const,
  },
  printErr: (message: string) => {
    if (isMissingUnityScriptLog(String(message))) return
    console.error(message)
  },
}

/** Missing MonoBehaviours left in the exported scene. Harmless for this viewer. */
function isMissingUnityScriptLog(message: string): boolean {
  return /referenced script/i.test(message) && /is missing/i.test(message)
}

/**
 * Unity's WebGL glue logs missing-script warnings via `console.error`, not
 * `printErr`, so they have to be filtered on the console itself. Installed
 * once on the client so it is in place before `createUnityInstance` runs.
 */
function installUnityConsoleFilter() {
  if (typeof window === "undefined") return
  const marker = window as Window & { __unityScriptLogFilter?: boolean }
  if (marker.__unityScriptLogFilter) return
  marker.__unityScriptLogFilter = true

  const originalError = console.error.bind(console)
  const originalWarn = console.warn.bind(console)
  const shouldIgnore = (args: unknown[]) =>
    args.some((arg) => typeof arg === "string" && isMissingUnityScriptLog(arg))

  console.error = (...args: unknown[]) => {
    if (shouldIgnore(args)) return
    originalError(...args)
  }
  console.warn = (...args: unknown[]) => {
    if (shouldIgnore(args)) return
    originalWarn(...args)
  }
}

installUnityConsoleFilter()

export default function UnitySidebar() {
  const claimedRef = useRef(false)
  if (!claimedRef.current && !unityPlayerClaimed) {
    unityPlayerClaimed = true
    claimedRef.current = true
  }
  const blocked = !claimedRef.current

  const { unityProvider, isLoaded, loadingProgression, initialisationError } =
    useUnityContext(unityConfig)

  useEffect(() => {
    if (blocked) return
    return () => {
      if (claimedRef.current) {
        unityPlayerClaimed = false
        claimedRef.current = false
      }
    }
  }, [blocked])

  useEffect(() => {
    if (blocked || !isLoaded) return
    const canvas = document.getElementById("vex-unity-canvas")
    if (!canvas) return

    const onContextLost = (event: Event) => {
      event.preventDefault()
      console.warn("Unity WebGL context was lost; reload the page to restore the agent.")
    }

    canvas.addEventListener("webglcontextlost", onContextLost)
    return () => canvas.removeEventListener("webglcontextlost", onContextLost)
  }, [blocked, isLoaded])

  if (blocked) {
    return (
      <div id="vex-unity-sidebar" className="flex h-full w-full items-center justify-center bg-slate-950 p-4">
        <p className="text-center text-sm text-slate-300">
          Unity agent is already running in this tab.
        </p>
      </div>
    )
  }

  return (
    <div id="vex-unity-sidebar" className="flex h-full w-full flex-col bg-slate-950">
      {initialisationError ? (
        <p id="vex-unity-init-error" className="p-4 text-center text-sm text-red-300">
          Unity agent failed to start. Reload the page to try again.
        </p>
      ) : (
        !isLoaded && (
          <p id="vex-unity-loading" className="p-4 text-center text-sm text-slate-300">
            Loading Unity agent… {Math.round(loadingProgression * 100)}%
          </p>
        )
      )}
      <Unity
        id="vex-unity-canvas"
        unityProvider={unityProvider}
        className="h-full w-full flex-1"
        style={{ width: "100%", height: "100%" }}
        devicePixelRatio={UNITY_PIXEL_RATIO}
        matchWebGLToCanvasSize
        disabledCanvasEvents={["contextmenu", "dragstart", "wheel"]}
        tabIndex={-1}
      />
    </div>
  )
}
