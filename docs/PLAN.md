# Plan

## Goal(s)

1. **Bring the code in, but never touch the source remote.** Fetch
   `https://github.com/rzymek/civil42pwa-public.git`, keep a local working copy,
   and transform it. We never add that repo as a `remote` and never push to it;
   all commits go to *this* workspace's own origin only.
2. **Make it run locally on a plain Unix box (AWS EC2 or anywhere).** Keep the
   real functionality that is already there: a report is captured (photo + audio
   + GPS), sent to a backend, reverse-geocoded, and persisted.
3. **Drop Snowflake.** Replace it with a **local database** (PostgreSQL).
4. **Mock the device bits that can't/shouldn't run headless** (camera, and by
   extension audio + GPS, and reverse-geocoding): do **not** ask for camera/mic
   permissions. This is a seed ("zalazek"), not a production capture app.
5. **Docker + Docker Compose + volumes.** One-command build and tear-down, data
   survives across `docker compose down/up`. Simple tools.

Everything below is a means to these goals. The plan is a living document: items
are re-checked against the goals at each review and adjusted incrementally.

## Human notes & how they are handled

- *"nie pushuj nic do tego repo"* — the source repo is only cloned/copied in;
  no `remote` pointing at `civil42pwa-public` is configured, and `git push`
  targets this workspace's own origin. See ARCHITECTURE "Source & git".
- *"wywal snowflake … postaw lokalna baze danych"* — M1 removes the Snowflake
  SDK/Firebase functions; M2 introduces PostgreSQL with a schema and a volume.
- *"zdjecie zmockowac … nie pros o dostepy do kamery"* — M4 replaces `getUserMedia`
  (camera **and** mic) and the GPS prompt with deterministic mocks; no permission
  prompts remain.
- *"rzeczy nie da sie latwo zrobic … pomockuj"* — reverse-geocoding defaults to a
  mock provider (M3) but is isolated in one module so it can be swapped later.
- *"docker + compose + volumes … latwo budowalo i stawialo spowrotem"* — M5.
- *"dobierz narzedzia (proste)"* — Node 22 LTS, Vite + React (already present),
  Express, `pg`, `busboy`, PostgreSQL 16; see ARCHITECTURE "Tooling".

## Constraints (non-negotiable)

- Do **not** push to `civil42pwa-public`. Do not add it as a git remote.
- Do **not** write `README.md` (owned by the goal / human gate).
- Host port must be configurable via env with a default; never assume a fixed
  host port is free.
- No device permission prompts in the app (camera/mic/GPS all mocked).
- Keep the original user-visible functionality: capture → submit → persist →
  show result.

## Milestones

Pass 1 = every milestone as a stub/mock so the whole app runs end-to-end.
Pass 2 = replace each stub with the real implementation.

- [x] M1 -- stub   Bootstrap: directory skeleton (src/ server/ db/) + no-op server + placeholder Dockerfile/compose so the repo boots.
- [x] M1 -- real   Source already copied into the workspace; this step removes Firebase, Snowflake, `.github` CI, surge/PWA asset gen and consolidates into one root `package.json`.

- [x] M2 -- stub   DB layer mocked: in-memory store returning canned rows; no real database needed yet.
- [x] M2 -- real   PostgreSQL 16 via compose, `db/init.sql` schema (`reports` table), `pg` pool + insert/list.

- [x] M3 -- stub   Backend API stubbed: Express serves `/health`, `POST /api/report`, `GET /api/reports` with canned responses.
- [x] M3 -- real   Backend real: multipart parse (busboy), validation, mock reverse-geocode module, write uploads to volume, persist + list via `pg`, serve built `dist/`.

- [x] M4 -- stub   Frontend stub: App renders and submits a hard-coded Blob to the backend; shows the response.
- [x] M4 -- real   Frontend real: mock camera (canvas-generated PNG), mock audio (synthetic WAV), mock GPS default, submit multipart to `/api/report`, error handling + result label.

- [x] M5 -- stub   Compose stub: minimal `docker-compose.yml` + `Dockerfile` that build/start a placeholder; named volumes declared.
- [x] M5 -- real   Compose real: multi-stage build (frontend + server), `app` + `db` services, `pgdata`/`uploads` volumes, `APP_PORT` configurable, healthchecks, `depends_on`.

- [x] M6 -- stub   Tests stub: placeholder vitest/supertest smoke + a docs/RUNBOOK placeholder.
- [x] M6 -- real   Tests real: backend validation + geo-mock unit tests, frontend render smoke test, and a runbook verifying `docker compose up` end-to-end.

- [x] M7 -- real   Fresh-clone robustness (no stub phase): `npm test` now runs a `pretest` (`npm run build:frontend`) so the SPA-serving specs have a `dist/` even on a clean checkout; `npm run typecheck` also typechecks `tests/**` via a new `tsconfig.test.json`; `tests/pipeline.spec.ts` pins that wiring; extra specs cover the SPA fallback, non-numeric `limit`, and lat-only geocode skip.

## Current status

- Source fetched and copied into the workspace (read-only clone; no remote added).
- Full implementation is in place: `server/` (Express + `pg` + mock geo + busboy),
  `src/` frontend with mocked camera/audio/GPS (`src/capture/`), `db/init.sql`
  schema, `docker-compose.yml`, multi-stage `Dockerfile`, and the full test suite
  (`tests/` + `*.spec.ts(x)`).
- `docs/RUNBOOK.md` documents the full `docker compose up` flow (build, health,
  capture→submit→geocode→persist→list, volume persistence, teardown), and
  `tests/runbook.spec.ts` pins the runbook's concrete claims to the real source
  so they cannot drift.
- All milestones M1–M7 are complete (M7 has no separate stub phase); the suite is
  green (`npm test` + `npm run typecheck`, 49 tests passing across 11 files).
