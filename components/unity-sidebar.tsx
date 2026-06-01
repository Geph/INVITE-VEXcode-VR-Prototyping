"use client"

import { Unity, useUnityContext } from "react-unity-webgl"

export default function UnitySidebar() {
  const { unityProvider, isLoaded, loadingProgression } = useUnityContext({
    loaderUrl: "/Build/agent.loader.js",
    dataUrl: "/Build/agent.data.unityweb",
    frameworkUrl: "/Build/agent.framework.js.unityweb",
    codeUrl: "/Build/agent.wasm.unityweb",
  })

  return (
    <div id="vex-unity-sidebar" className="flex h-full w-full flex-col bg-slate-950">
      {!isLoaded && (
        <p id="vex-unity-loading" className="p-4 text-center text-sm text-slate-300">
          Loading Unity agent… {Math.round(loadingProgression * 100)}%
        </p>
      )}
      <Unity
        id="vex-unity-canvas"
        unityProvider={unityProvider}
        className="h-full w-full flex-1"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  )
}
