/**
 * Student / session identity for the event envelope.
 * Display names never appear here — only the anonymised studentID.
 */

const ANON_STUDENT = "INVITE-C000"

let studentID = ANON_STUDENT
let sessionID = newSessionId()

function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `session-${Date.now()}`
}

export function getStudentID(): string {
  return studentID
}

export function getSessionID(): string {
  return sessionID
}

/** Join screen (Phase 4) will call this with the hashed {SITE}-C{NNN} id. */
export function setStudentID(id: string): void {
  const next = id.trim()
  studentID = next.length > 0 ? next : ANON_STUDENT
}

export function resetIdentity(): void {
  studentID = ANON_STUDENT
  sessionID = newSessionId()
}
