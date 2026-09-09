import { afterEach, describe, expect, it } from "vitest"
import {
  buildSessionLog,
  getSessionEvents,
  recordSessionEvent,
  resetSessionLog,
} from "@/lib/session-log"

describe("session log", () => {
  afterEach(() => {
    resetSessionLog()
  })

  it("records events and includes them in the export payload", () => {
    recordSessionEvent("run_start", { playgroundId: "ocean-reef", step: false })
    recordSessionEvent("run_end")

    const file = buildSessionLog({
      playgroundId: "ocean-reef",
      console: ["hello"],
      workspaceXml: '<xml xmlns="https://developers.google.com/blockly/xml"></xml>',
    })

    expect(file.sessionId.length).toBeGreaterThan(0)
    expect(file.playgroundId).toBe("ocean-reef")
    expect(file.console).toEqual(["hello"])
    expect(file.workspaceXml).toContain("blockly")
    expect(file.events.map((event) => event.type)).toEqual(["run_start", "run_end"])
    expect(file.events[0]?.data).toEqual({ playgroundId: "ocean-reef", step: false })
    expect(file.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("does not throw when recording", () => {
    expect(() => recordSessionEvent("run_stop")).not.toThrow()
    expect(getSessionEvents()).toHaveLength(1)
  })
})
