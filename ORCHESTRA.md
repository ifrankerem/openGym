# Orchestra

This repository runs the orchestra: a brain plans and reviews, and OpenCode agents write the tests (`orchestra-tester`) and the code (`orchestra-worker`). Brain rules: `~/.orchestra/BRAIN.md`.

GitHub: ifrankerem/openGym

This is the owner's fork of `DuarteSantos8/openGym` (remote `upstream`). Task issues and PRs live on the fork only.

**Base branch: `unit-port`.** The per-exercise unit work is being ported onto upstream's latest `main` (v1.4.2) on the fork's `unit-port` branch. Every task branch starts from `origin/unit-port` and every task PR targets `--base unit-port`. Wherever the agent steps say `main`, read `unit-port`. The fork's `main` keeps the old work (fork APK, the original unit commits) and is the reference the port tasks copy from; never push to it. Never open issues or PRs on `upstream`, never push to it; the brain prepares upstream pull requests itself.

## Setup

Run once per clone, before the first task. Use Node 22, the version upstream CI runs on:

- `source ~/.nvm/nvm.sh && nvm use 22`
- `npm ci --no-audit --no-fund`
- `cd frontend && npm ci --no-audit --no-fund`
- `cd api && npm ci --omit=optional --no-audit --no-fund`
- `cd mcp && npm ci --no-audit --no-fund`

## Verify

Every command passes before a PR is ready, and the brain runs them again before merging. Run them from the repository root with Node 22 active (`source ~/.nvm/nvm.sh && nvm use 22`):

- `cd frontend && npm test`
- `cd frontend && npm run build`
- `cd frontend && node scripts/check-locales.mjs`
- `cd mcp && npm test && npm run check:node-loadable`
- `cd api && npm test`

## Tests

- Frontend: Vitest. Tests sit beside the code as `*.test.js` / `*.test.jsx` (for example `frontend/src/lib/session-start.js` → `frontend/src/lib/session-start.test.js`, or a topic file such as `session-start.plan.test.js`). Single file: `cd frontend && npx vitest run src/lib/progression.test.js`. Single test: `npx vitest run -t "test name"`.
- Training logic (what you lift next, reading a logged session back) is a pure helper in `frontend/src/lib/` with a unit test beside it. UI behaviour is tested with the existing `*.test.jsx` patterns (happy-dom), see `frontend/src/views/Settings.startfrom.test.jsx`.
- MCP: Vitest in `mcp/test/`. API: `node:test` in `api/test/`.

## Commits

- Upstream style: `area: what changed, said plainly` or `fix(area): ...` / `feat(area): ...`, for example `feat(stats): Exercise progress gets the 1M / 3M / 1Y / All range (#511)`. Header at most 100 characters, written in English.
- One task, one commit is fine; the brain squash-merges.

## Project rules

Files every agent reads before working:

- The architecture notes at the repository root (project layout, where the logic lives)
- `CONTRIBUTING.md` (dependency-light, style, tests, locales)
- The task issue

Rules that come from those files and bite most often:

- No new dependency, frontend or api.
- No linter or formatter exists. Match the surrounding style by hand: 2-space indent, no semicolons, single quotes, comments only where the why is not obvious.
- Every new UI string goes into every locale file in `frontend/src/locales/` (English is the source and has no file). `node scripts/check-locales.mjs` fails on a missing key. Translate properly; Turkish (`tr.js`) must read naturally.
- Do not edit the generated `frontend/src/lib/exercises-data.js` by hand.

## Ponytail

Mandatory for every role: `~/.orchestra/PONYTAIL.md` (the simplest complete change). Project-specific additions:

- Worker, in a port task: copy the reference commit's behaviour with the smallest edit to v1.4.2's code; do not re-port lines v1.4.2 already does another way.

## Off limits

Paths no task changes unless the owner says so:

- `catalogue/media/`, `data/`, `media/`
- `frontend/src/lib/exercises-data.js` (generated)
- `.github/`, `.gitlab-ci.yml`
- `ORCHESTRA.md` (brain only)
