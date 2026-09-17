import { createElement } from "react"
import { createRef } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MissionDayReadout } from "@/components/playground/MissionDayReadout"
import { PlaygroundHud } from "@/components/playground/PlaygroundHud"
import { INITIAL_GAME_STATE } from "@/hooks/playground-host"
import type { ProgramGameState } from "@/hooks/program-types"

function renderHud(gameState: ProgramGameState, chrome: "reef" | "field" = "reef") {
  return renderToStaticMarkup(
    createElement(PlaygroundHud, {
      consoleLines: [],
      showSensors: false,
      showRuler: false,
      onToggleSensors: () => {},
      onToggleRuler: () => {},
      canvasRef: createRef<HTMLCanvasElement>(),
      canvasWidth: 400,
      canvasHeight: 400,
      gameState,
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
      chrome,
    }),
  )
}

describe("PlaygroundHud Ocean Cleanup score", () => {
  it("shows only the running trash count, not a field total", () => {
    const html = renderHud({ ...INITIAL_GAME_STATE, trashCollected: 3, trashTotal: 12 })
    expect(html).toContain("vex-playground-trash-score")
    expect(html).toContain(">3<")
    expect(html).not.toContain("/ 12")
    expect(html).not.toContain("remaining on field")
  })
})

describe("Rover Rescue mission days", () => {
  it("reads the day count to one decimal", () => {
    const html = renderToStaticMarkup(createElement(MissionDayReadout, { days: 12.47 }))
    expect(html).toContain("vex-playground-mission-days")
    expect(html).toContain("12.4")
    expect(html).toContain("of 50")
  })

  it("reports days survived instead of trash when the river ends the mission", () => {
    const html = renderHud(
      { ...INITIAL_GAME_STATE, isGameOver: true, gameLost: true, missionEndReason: "river", missionDays: 8.32 },
      "field",
    )
    expect(html).toContain("vex-playground-gameover-days")
    expect(html).toContain("Days survived: 8.3")
    expect(html).not.toContain("vex-playground-gameover-score")
    expect(html).toContain("The rover entered the river.")
  })

  it("calls a full 50 days a completed mission", () => {
    const html = renderHud(
      { ...INITIAL_GAME_STATE, isGameOver: true, missionEndReason: "complete", missionDays: 50 },
      "field",
    )
    expect(html).toContain("Mission complete!")
    expect(html).toContain("survived the full 50-day mission")
    expect(html).toContain("Days survived: 50.0")
  })
})
