/**
 * Envelope helpers. Full VEX emit/sink wiring is Phase 4; this stamps the
 * two _invite identity fields so later co-editing does not have to re-derive
 * actor and workspace from a prior dataset.
 */

import { getSessionID, getStudentID } from "./identity"

export interface InviteEnvelope {
  actorID: string
  workspaceID: string
}

/** Single-player: actorID = studentID, workspaceID = this page-load session. */
export function inviteEnvelope(): InviteEnvelope {
  return {
    actorID: getStudentID(),
    workspaceID: getSessionID(),
  }
}

export function stampInvite<T extends object>(payload: T): T & { _invite: InviteEnvelope } {
  try {
    return { ...payload, _invite: inviteEnvelope() }
  } catch {
    return { ...payload, _invite: { actorID: "", workspaceID: "" } }
  }
}
