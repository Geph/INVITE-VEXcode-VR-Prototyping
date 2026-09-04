# Rover Rescue build plan

Canonical copies of the two parts that later phases implement:

- **Part 1** — field, zones, river, economy, sensing, blocks → [`ROVER-RESCUE-SPEC.md`](./ROVER-RESCUE-SPEC.md)
- **Part 2** — target tree, `PlaygroundDefinition`, five invariants → [`ARCHITECTURE.md`](./ARCHITECTURE.md)

Phase 0 (docs + characterisation tests) is done. Phases 1–3 rewrite the host so Ocean Reef stays identical. Phase 4+ adds Rover Rescue against the spec. Do not widen `PlaygroundDefinition` with Rover Rescue special cases.
