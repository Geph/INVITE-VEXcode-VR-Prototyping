# INVITE VEXcode VR Research Prototype

A prototyping platform for research into **persistence and collaboration in
middle-school programming**, developed in collaboration with VEX. It lets the
research team explore robot playgrounds, block programming, and learner support.

Includes Castle Crasher+, Rover Rescue, and Ocean Reef. Built with Next.js,
TypeScript, and Blockly. Behavior is experimental; fidelity to VEXcode VR varies
by feature. See the [known limitations](docs/BLOCK-AUDIT.md).

## Run locally

Use Node.js 22 (see `.nvmrc`).

```sh
npm ci
npm run dev:all
```

Open [localhost:3000](http://localhost:3000). This starts the app and collaboration
relay; `npm run dev` runs only the app. On Windows, use `npm.cmd` if the PowerShell
npm launcher fails.

## Test and contribute

Follow the [testing checklist](docs/TESTING-CHECKLIST.md). Maintainers and agents
should start with the [documentation index](docs/README.md),
[architecture](docs/ARCHITECTURE.md), and [handoff instructions](AGENTS.md).

```sh
npm run lint
npm run typecheck
npm test -- --coverage
npm run build
```

## Deployment

Pushes to `main`, `SV`, or `Mars-Rover` publish the static app through GitHub Actions
and GitHub Pages. These branches share one live site. See the
[deployment notes](docs/DEPLOYMENT.md) and [change history](docs/CHANGELOG.md).
Multiplayer needs a separately hosted WebSocket relay; Pages serves only the app.
