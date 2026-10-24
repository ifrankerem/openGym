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

## Ponytail (simplest complete change)

Both roles write the least code that fully does the task. The brain reviews every PR against these rules before merging and sends back anything that breaks them.

- Before writing, read the task and the code it touches, and list every place the change must reach: callers, tests, fixtures, exports. That is the scope. Extra features are not.
- Take the first option that fully works: does it need to exist at all → already in this codebase (a helper in `frontend/src/lib/`, a component, a pattern) → the platform or an installed dependency → one plain line → otherwise the minimum code that works.
- No abstraction, wrapper, option, config or "for later" code the issue does not ask for. Deletion beats addition. Keep the structure, layers and names the codebase already has.
- The shortest working diff wins, once everything it must touch is covered. A clever one-liner that needs decoding is not short.
- Comment only the why the code cannot show, in one line.
- Bug fix: grep every caller of the function first and fix the root cause once in the shared code.
- Code that is moved or ported keeps its error handling and validation.
- Never cut: validation at trust boundaries, error handling that prevents data loss, accessibility, anything the issue asks for.
- Tester: every issue test case is required. Beyond them add none. Keep fixtures small: build state with the existing helpers and only the fields the test reads.
- Worker: in a port, copy the reference commit's behaviour with the smallest edit to v1.4.2's code; do not re-port lines v1.4.2 already does another way.
- End the READY reply with one line: what was skipped or not checked.

## Off limits

Paths no task changes unless the owner says so:

- `catalogue/media/`, `data/`, `media/`
- `frontend/src/lib/exercises-data.js` (generated)
- `.github/`, `.gitlab-ci.yml`
- `ORCHESTRA.md` (brain only)
