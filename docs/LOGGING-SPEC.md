# Telemetry logging spec

Compatibility contract with the external learner-modelling pipeline.
Reproduce VEX's schema exactly, including its misspellings. Do not "fix"
them; the pipeline keys on these strings.

The analysis behind this contract is in `docs/ROVER-RESCUE-LOGGING-PLAN.md`.

## Frozen misspellings

- `enemies_nuetralized` — not `neutralized`
- `PlaygroundChange` — capital P, unlike every sibling event type

## Rover Rescue `playgroundData.parameters`

Byte-identical to VEX. Rover Rescue does **not** carry `gps_x_position` /
`gps_y_position`.

```
days_explored, experience_gained, enemies_nuetralized,
minerals_consumed, battery_remaining, project_stopped_by_user
```

Richer stats live only under `playgroundData._invite`. Never widen `parameters`.
