# Deployment

The app is a Next.js static export. `npm run build` creates `out/`.
For a project subpath, set `NEXT_PUBLIC_BASE_PATH` at build time; the Pages workflow
sets it to `/INVITE-VEXcode-VR-Prototyping`.

- [CI](../.github/workflows/ci.yml): lint, typecheck, tests with coverage, static build;
  separate non-blocking runtime dependency audit.
- [Pages deployment](../.github/workflows/deploy-pages.yml): builds and publishes
  pushes to `main`, `SV` and `Mars-Rover`; also supports manual dispatch.
- [Release](../.github/workflows/release.yml): manual version/tag/release operation.
  A normal deployment does not need a version bump or GitHub release.

All three deployment branches share the same Pages environment and live URL.
Check the exact commit and successful deployment run, not merely that push worked.
CI and deployment are separate workflows; successful publishing does not prove CI
passed. After publishing, check the live subpath, query-based playground selection,
asset loading, editor, a short run and Get Help against the testing checklist.

## Collaboration relay

GitHub Pages cannot run `scripts/collab-server.mjs`. Local `npm run dev:all` starts
it on port 1234. Hosted multiplayer requires a separately reachable relay and a
`NEXT_PUBLIC_COLLAB_WS_URL` configured at app build time. The current Pages workflow
does not set this variable; the client otherwise derives a host/port 1234 URL.
Do not describe production multiplayer as deployed without checking that service.

## Reference materials for fidelity work

Most useful inputs, in order:

1. Exact saved official-VR programs paired with uncut recordings showing blocks,
   playground, difficulty, velocity, sensor values, timer and final score.
2. Isolated Castle clips: front/back plow approaches, one piece pushed over the edge,
   glancing impacts, stacked pieces falling, and water/Stop/completion endings.
   Include reset before each run so the starting state is known.
3. Official specifications or company-confirmed answers: dimensions, piece masses,
   score trigger, collision rules, pickup tolerance, speed and sensor semantics.
   Identify product version/date and separate confirmed rules from assumptions.
4. Study context: learning task, intervention conditions, age/experience range,
   desired support wording, persistence/collaboration definitions and log requirements.
5. Representative anonymized learner work, teacher facilitation notes, target
   devices/browsers, session duration and network constraints.

Store private recordings/participant data outside the public repository. Link a
sanitized evidence index with source, date, question answered, and relevant timestamps.
