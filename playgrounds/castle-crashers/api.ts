import type { PlaygroundApiDeps } from "../types"
import type { CastleCrashersState } from "./state"

/** Castle Crasher+ has no playground-specific sensor blocks yet. */
export function createCastleCrashersApi(_deps: PlaygroundApiDeps<CastleCrashersState>) {
  return {}
}

export const castleCrashersBlocks = []
