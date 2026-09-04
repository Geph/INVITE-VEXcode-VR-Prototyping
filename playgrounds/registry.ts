import { oceanReef } from "./ocean-reef"
import type { PlaygroundDefinition } from "./types"

export const DEFAULT_PLAYGROUND_ID = "ocean-reef"

const playgrounds = new Map<string, PlaygroundDefinition<any>>()

export function register<S>(definition: PlaygroundDefinition<S>): void {
  playgrounds.set(definition.id, definition as PlaygroundDefinition<any>)
}

export function get(id: string): PlaygroundDefinition<any> | undefined {
  return playgrounds.get(id)
}

export function resolvePlaygroundId(raw: string | null | undefined): string {
  if (raw && playgrounds.has(raw)) return raw
  return DEFAULT_PLAYGROUND_ID
}

register(oceanReef)
