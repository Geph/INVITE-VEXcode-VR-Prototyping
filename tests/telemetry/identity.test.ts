import { afterEach, describe, expect, it } from "vitest"
import { getSessionID, getStudentID, resetIdentity, setStudentID } from "@/telemetry/identity"

describe("telemetry identity", () => {
  afterEach(() => {
    resetIdentity()
  })

  it("starts anonymous in the {SITE}-C{NNN} shape", () => {
    expect(getStudentID()).toBe("INVITE-C000")
    expect(getSessionID().length).toBeGreaterThan(0)
  })

  it("rotates the session id on reset and never stores a display name", () => {
    const before = getSessionID()
    setStudentID("CROW-C002")
    resetIdentity()
    expect(getStudentID()).toBe("INVITE-C000")
    expect(getSessionID()).not.toBe(before)
  })
})
