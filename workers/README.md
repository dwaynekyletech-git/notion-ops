# workers/

Deployed Notion Workers — the always-on automation layer (scheduled syncs,
event-driven capabilities). This is the core of the "build on the Notion
Developer Platform" scope of work.

## Scaffolding a worker

```bash
# from the repo root
ntn workers new workers/<worker-name> --git --install
cd workers/<worker-name>
ntn workers deploy
```

`ntn workers new` generates a `workers.json` (config + capabilities) and
capability source. Each worker lives in its own folder.

## Operating a worker

```bash
ntn workers ls                              # list all workers in the workspace
ntn workers capabilities ls <worker>        # list capabilities
ntn workers exec <capability-key>           # run a capability ad hoc
ntn workers sync status                     # view scheduled sync states
ntn workers sync trigger <capability>       # run a scheduled sync now
ntn workers env set KEY=value               # manage env vars
ntn workers usage                           # AI credit usage this period
```

## Conventions for this repo

- One folder per worker under `workers/`.
- **Never** commit secrets — use `ntn workers env` to manage environment
  variables remotely, or keep them in a local `.env` that is gitignored.
- Keep Client-specific customizations separate from general-purpose/reusable
  worker code (see `docs/compliance.md` — IP separation).
- Document each worker's purpose, inputs, and schedule in a short `README.md`
  inside its folder.
