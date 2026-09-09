/** In-memory session log. Telemetry failures never break the app. */

export interface SessionLogEvent {
  t: string
  type: string
  data?: Record<string, unknown>
}

export interface SessionLogSnapshot {
  playgroundId?: string
  console?: string[]
  workspaceXml?: string
}

export interface SessionLogFile extends SessionLogSnapshot {
  sessionId: string
  exportedAt: string
  events: SessionLogEvent[]
}

let sessionId = newSessionId()
const events: SessionLogEvent[] = []

function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `session-${Date.now()}`
}

function nowIso(): string {
  return new Date().toISOString()
}

export function recordSessionEvent(type: string, data?: Record<string, unknown>): void {
  try {
    events.push({ t: nowIso(), type, ...(data ? { data } : {}) })
  } catch {
    /* never break Start / playground / export */
  }
}

export function buildSessionLog(snapshot: SessionLogSnapshot = {}): SessionLogFile {
  return {
    sessionId,
    exportedAt: nowIso(),
    playgroundId: snapshot.playgroundId,
    console: snapshot.console,
    workspaceXml: snapshot.workspaceXml,
    events: events.slice(),
  }
}

export function downloadSessionLog(file: SessionLogFile): void {
  const stamp = file.exportedAt.slice(0, 19).replace(/[:T]/g, "-")
  const blob = new Blob([`${JSON.stringify(file, null, 2)}\n`], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `vexcode-session-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function resetSessionLog(): void {
  events.length = 0
  sessionId = newSessionId()
}

export function getSessionEvents(): readonly SessionLogEvent[] {
  return events
}
