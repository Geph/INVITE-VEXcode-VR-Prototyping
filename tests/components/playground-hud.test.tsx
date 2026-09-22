import { createElement } from "react"
import { createRef } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MissionDayReadout } from "@/components/playground/MissionDayReadout"
import { RoverStatusReadout } from "@/components/playground/RoverStatusReadout"
import { PlaygroundHud } from "@/components/playground/PlaygroundHud"
import { MissionDialog } from "@/playgrounds/rover-rescue/hud/MissionDialog"
import { MissionEndPanel } from "@/playgrounds/rover-rescue/hud/MissionEnd"
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

  it("relabels the day counter as Standby while the clock is racing", () => {
    const html = renderToStaticMarkup(createElement(MissionDayReadout, { days: 12.47, standby: true }))
    expect(html).toContain("Standby")
    expect(html).toContain("12.4")
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

describe("Rover Rescue cargo readout", () => {
  it("shows how many samples the rover is carrying against capacity", () => {
    const html = renderToStaticMarkup(
      createElement(RoverStatusReadout, {
        status: { days: 1, batteryPercent: 80, level: 1, exp: 4, stored: 1, capacity: 2, standby: false, day50Dialog: false },
      }),
    )
    expect(html).toContain("vex-playground-rover-cargo")
    expect(html).toContain("1/2")
  })
})

describe("Rover Rescue day-50 dialog", () => {
  it("shows Continue, View Statistics, and Get Certificate without covering the field as a modal", () => {
    const html = renderToStaticMarkup(
      createElement(MissionDialog, {
        days: 50,
        onContinue: () => {},
        onViewStatistics: () => {},
        onGetCertificate: () => {},
      }),
    )
    expect(html).toContain("vex-rover-day50-dialog")
    expect(html).toContain("vex-rover-day50-continue")
    expect(html).toContain("vex-rover-day50-stats")
    expect(html).toContain("vex-rover-day50-certificate")
    expect(html).toContain("Continue")
    expect(html).toContain("View Statistics")
    expect(html).toContain("Get Certificate")
  })

  it("renders statistics and a local certificate instead of the generic complete card", () => {
    const snapshot = {
      days: 50,
      level: 3,
      xp: 32,
      batteryPercent: 44,
      neutralized: { spider: 2, orange: 1, blue: 0, purple: 1 },
    }
    const stats = renderToStaticMarkup(
      createElement(MissionEndPanel, { view: "stats", snapshot, onRetry: () => {} }),
    )
    expect(stats).toContain("vex-rover-day50-stats-panel")
    expect(stats).toContain("32")
    expect(stats).toContain("Spiders")

    const cert = renderToStaticMarkup(
      createElement(MissionEndPanel, { view: "certificate", snapshot, onRetry: () => {} }),
    )
    expect(cert).toContain("vex-rover-day50-certificate-panel")
    expect(cert).toContain("vex-rover-certificate-name")
    expect(cert).toContain("Print")
  })
})
