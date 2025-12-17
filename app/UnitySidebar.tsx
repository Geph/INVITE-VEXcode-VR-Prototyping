"use client"; // MUST be the first line

import { Unity, useUnityContext } from "react-unity-webgl";

export default function UnitySidebar() {
  const { unityProvider, isLoaded, loadingProgression } = useUnityContext({
    loaderUrl: "/Build/agent.loader.js",
    dataUrl: "/Build/agent.data.unityweb",
    frameworkUrl: "/Build/agent.framework.js.unityweb",
    codeUrl: "/Build/agent.wasm.unityweb",
  });

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {!isLoaded && <p>Loading Unity... {Math.round(loadingProgression * 100)}%</p>}
      <Unity unityProvider={unityProvider} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
