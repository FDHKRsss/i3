# Architecture

## Overview

`civil42pwa-public` is a small PWA: the browser captures a photo + voice note +
GPS, POSTs them as multipart to a backend, which reverse-geocodes the position
and persists the report (files + metadata) to Snowflake.

We transform it into a **self-contained, Unix-runnable seed**:

- Frontend stays React + Vite (TypeScript), but all device capture is **mocked**
  so no camera/mic/GPS permission is requested.
- Backend becomes a plain **Express (Node 22) server** that serves the built
  frontend **and** the report API from one origin.
- Persistence is a **local PostgreSQL 16** database plus an **uploads volume**
  for the binary files. Snowflake and Firebase are gone.
- Everything runs under **Docker Compose** with named volumes so it builds and
  tears down cleanly and data survives restarts.

```
Browser ──HTTP──> app (Express, port 8080 in container)
                    ├─ /api/report   → busboy parse → validate → mock geocode
                    │                 → write file to /app/uploads (volume)
                    │                 → INSERT into Postgres
                    ├─ /api/reports  → SELECT from Postgres
                    ├─ /health      → SELECT 1 against Postgres
                    └─ /*           → static files from dist/

                    app ──TCP 5432──> db (postgres:16-alpine)
                                       volume: pgdata
```

## Source & git

- Upstream fetched (read-only clone) at commit
  `429f9bc33ebc4858fb5f9d156167f5db22821d36` (2026-08-11, "initial commit").
- Its files are copied into this workspace; we **never configure it as a git
  remote and never push to it**. This workspace has its own origin and
  `git commit/push` (on milestone acceptance) targets that origin only.

## Tooling (chosen, and why)

| Concern | Choice | Why (vs. alternatives) |
|---|---|---|
| Runtime | Node.js **22 LTS** (`node:22-alpine`) | LTS, matches the original Cloud Functions engine (22); Alpine keeps images small. |
| Frontend | **Vite 5 + React 18 + TS** (already in repo) | Keep the existing app; minimal change. |
| Backend | **Express** + **busboy** + **pg** | Express is the default simple HTTP server; busboy already parses multipart in the source; `pg` is the standard Postgres driver. |
| DB | **PostgreSQL 16** (alpine) | Simple, durable, official Docker image; replaces Snowflake with a real local DB. |
| Server execution | `tsc` → `server-dist/` then `node` | One TS language across the repo; a compiled server keeps the runtime image lean (no `tsx` in prod). |
| Package manager | **npm** | Simplest/universal; drops the source's pnpm lock and Firebase/surge/PWA-asset tooling. |
| PWA plugin | **removed** | Offline/installability is not core to the seed and adds `sharp`/asset-generation complexity; revisit later if needed. |

## What will be in the code

```
.
├─ src/                     # frontend (Vite + React, TypeScript)
│  ├─ main.tsx              # entry + error boundary
│  ├─ app.tsx               # capture → submit → show result
│  ├─ capture/
│  │  ├─ MockCamera.tsx      # canvas that draws a placeholder photo
│  │  ├─ useMockAudio.ts     # synthesizes a WAV blob (no mic)
│  │  └─ location.ts         # mock GPS default {lat, lon}
│  ├─ send.tsx              # multipart POST to /api/report
│  └─ ...                   # css, tests
├─ server/                  # backend (TypeScript, compiled to server-dist/)
│  ├─ index.ts              # Express app, routes, static serving, listen(PORT)
│  ├─ report.ts             # multipart parse + validation + orchestration
│  ├─ db.ts                 # pg pool, insertReport, listReports, ping
│  ├─ store.ts              # write/delete upload files under UPLOAD_DIR
│  └─ geo.ts                # reverse-geocode (mock provider by default)
├─ db/
│  └─ init.sql              # reports table (runs on first Postgres boot)
├─ Dockerfile               # multi-stage: build frontend+server → runtime
├─ docker-compose.yml       # app + db, named volumes, env-configurable port
├─ .env.example             # APP_PORT, DATABASE_URL, GEO_PROVIDER, ...
├─ package.json             # single root package (frontend + server deps)
├─ tsconfig.test.json       # typechecks tests/** (separate from app build)
├─ tests/                   # vitest suites: app/report/send/geo/store/runbook/pipeline
└─ docs/                    # PLAN + ARCHITECTURE + RUNBOOK (compose flow)
```

## Verification & runbook

- `docs/RUNBOOK.md` is the compose runbook: it verifies `docker compose up`
  end-to-end on a plain Unix box (build, health, capture→submit→geocode→
  persist→list, volume persistence across `down`/`up`, and a clean `down -v`
  reset).
- Because Docker is not available in this dev workspace, `tests/runbook.spec.ts`
  pins the runbook's concrete facts (env defaults, compose wiring, schema, served
  title, upload dir, expected API outputs) to the real source so the doc cannot
  silently drift from the implementation.
- `npm test` runs a `pretest` (`npm run build:frontend`), so a fresh clone has a
  `dist/` for the SPA-serving specs; `npm run typecheck` also typechecks
  `tests/**` via `tsconfig.test.json`, and `tests/pipeline.spec.ts` pins that
  wiring so it cannot be silently dropped. The rest of the behavior is validated
  by `npm test` + `npm run typecheck` (currently 49 tests across 11 files).

## Database schema (`db/init.sql`)

```sql
CREATE TABLE IF NOT EXISTS reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat         DOUBLE PRECISION,
  lon         DOUBLE PRECISION,
  audio_path  TEXT NOT NULL,
  image_path  TEXT,
  geo_desc    TEXT
);
```

- Binary files are written to `UPLOAD_DIR` (default `/app/uploads`, a named
  volume) as `<id>.webm`/`<id>.png`; the DB stores only relative paths.
- `gen_random_uuid()` is built into Postgres ≥ 13, so no extension is needed.

## API contract

- `POST /api/report` — multipart/form-data.
  - `voice` (file, required), `image` (file, optional), `lat`/`lon` (strings).
  - `200` → `Report received successfully`; `400` on malformed/invalid input;
    `405` on non-POST; `500` on server/DB failure (message logged, not leaked).
- `GET /api/reports?limit=50` — JSON list of recent reports (newest first).
- `GET /health` — `{ ok: true, db: "up" }` after `SELECT 1`.

## Mocking strategy

| Original | Seed behaviour |
|---|---|
| `navigator.mediaDevices.getUserMedia({video})` | `MockCamera` draws a timestamped placeholder on a `<canvas>`; "capture" → `canvas.toBlob('image/png')`. |
| `getUserMedia({audio})` + `MediaRecorder` | `useMockAudio` synthesizes a short WAV (PCM sine) in JS → `Blob('audio/wav')`. |
| `use-geo-location` prompt | `location.ts` returns a fixed default (e.g. Warsaw) — no prompt. |
| Nominatim reverse-geocode | `geo.ts` returns `"mock location (lat, lon)"` by default; the module boundary allows a real provider later. |

All three device mocks keep the same interfaces as the originals so the real
implementations can be swapped back one file at a time.

## Port & resource handling

- **Host port is configurable**: `APP_PORT` env (default `8080`) maps to the
  container's fixed `8080`. Never assume the host port is free — change
  `APP_PORT` in `.env`.
- Postgres is **internal only** (no host port published) to avoid `5432`
  conflicts; reach it with `docker compose exec db psql ...` when needed.
- `DATABASE_URL` is injected (default `postgres://civil42:civil42@db:5432/civil42`).
- Upload size is capped (configurable `MAX_UPLOAD_BYTES`, default 15 MB) and
  `lat`/`lon` are validated to finite, in-range numbers.

## Failure modes & error handling

- DB down at app start → app still boots; `/health` reports `db: "down"`; report
  POST returns `500` rather than hanging.
- Malformed multipart / missing voice / bad coordinates → `400` with a short
  message.
- File write or DB insert fails → `500`, temp files cleaned up, no partial
  record left in a visible "success" state.
- Port already bound inside the container → server fails fast with a clear
  message; host-side conflicts are handled by changing `APP_PORT`.

## Removed & why (scope)

- `functions/` (Firebase Cloud Functions), `firebase.json`, `.firebaserc`,
  `snowflake.ts`, `snowflake-sdk` → replaced by Express + Postgres.
- `.github/workflows` (Firebase/surge deploys) → out of scope for a local seed.
- `vite-plugin-pwa` + `pwa-assets-generator` + `surge` → offline/install not
  core to the seed; simplifies the build.
- `use-geo-location` → replaced by the mock GPS module.
