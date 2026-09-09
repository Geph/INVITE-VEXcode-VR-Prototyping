import { createElement } from "react"
import { createRef } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PlaygroundHud } from "@/components/playground/PlaygroundHud"
import { INITIAL_GAME_STATE } from "@/hooks/playground-host"

describe("PlaygroundHud Ocean Cleanup score", () => {
  it("shows only the running trash count, not a field total", () => {
    const html = renderToStaticMarkup(
      createElement(PlaygroundHud, {
        consoleLines: [],
        showSensors: false,
        showRuler: false,
        onToggleSensors: () => {},
        onToggleRuler: () => {},
        canvasRef: createRef<HTMLCanvasElement>(),
        canvasWidth: 400,
        canvasHeight: 400,
        gameState: { ...INITIAL_GAME_STATE, trashCollected: 3, trashTotal: 12 },
        liveSensors: {
          field: { x: 0, y: 0 },
          rotation: 0,
          frontDistanceMm: 0,
          frontObjectDetected: false,
          eyeNear: false,
          trashRemaining: 9,
        },
        isRunning: true,
        isStepping: false,
        isPausedOnBlock: false,
        onStart: () => {},
        onStep: () => {},
        onStop: () => {},
        onReset: () => {},
        aiStep: "main",
        onCloseStrategy: () => {},
      }),
    )
    expect(html).toContain("vex-playground-trash-score")
    expect(html).toContain(">3<")
    expect(html).not.toContain("/ 12")
    expect(html).not.toContain("remaining on field")
  })
})
