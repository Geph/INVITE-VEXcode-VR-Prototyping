import { afterEach, describe, expect, it } from "vitest"
import { inviteEnvelope, stampInvite } from "@/telemetry/emitter"
import { getSessionID, getStudentID, resetIdentity, setStudentID } from "@/telemetry/identity"

describe("telemetry identity envelope", () => {
  afterEach(() => {
    resetIdentity()
  })

  it("sets actorID to studentID and workspaceID to the page-load session", () => {
    const envelope = inviteEnvelope()
    expect(envelope.actorID).toBe(getStudentID())
    expect(envelope.workspaceID).toBe(getSessionID())
    expect(envelope.actorID).toBe("INVITE-C000")
  })

  it("stamps _invite without leaking the display name", () => {
    setStudentID("WREN-C102")
    const stamped = stampInvite({ eventType: "runProject" })
    expect(stamped._invite.actorID).toBe("WREN-C102")
    expect(stamped._invite.workspaceID).toBe(getSessionID())
    expect(JSON.stringify(stamped)).not.toMatch(/display/i)
  })
})
