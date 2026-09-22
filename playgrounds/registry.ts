import { oceanReef } from "./ocean-reef"
import { roverRescue } from "./rover-rescue"
import { castleCrashers } from "./castle-crashers"
import type { PlaygroundDefinition } from "./types"

export const DEFAULT_PLAYGROUND_ID = "ocean-reef"

const playgrounds = new Map<string, PlaygroundDefinition<any>>()

const ALIASES: Record<string, string> = {
  "ocean-cleanup": "ocean-reef",
  "rescue-rover": "rover-rescue",
  "castle-crashers": "castle-crashers",
  "castle-crasher-plus": "castle-crashers",
  "castle_crasher_plus": "castle-crashers",
}

export function register<S>(definition: PlaygroundDefinition<S>): void {
  playgrounds.set(definition.id, definition as PlaygroundDefinition<any>)
}

export function get(id: string): PlaygroundDefinition<any> | undefined {
  return playgrounds.get(id)
}

export function resolvePlaygroundId(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_PLAYGROUND_ID
  if (playgrounds.has(raw)) return raw
  const aliased = ALIASES[raw]
  if (aliased && playgrounds.has(aliased)) return aliased
  return DEFAULT_PLAYGROUND_ID
}

register(oceanReef)
register(roverRescue)
register(castleCrashers)
