# Project context (durable directives all agents must always honor)

- Transform `civil42pwa-public` (fetched, not pushed to) into a self-contained,
  Unix-runnable seed. **Never add the upstream as a git remote and never push to it.**
- Keep the real functionality: capture (photo + audio + GPS) → submit →
  reverse-geocode → persist → show result.
- **Remove Snowflake**; use a **local PostgreSQL** database.
- **Mock the device bits** (camera, mic, GPS) and reverse-geocoding: no
  camera/mic/GPS permission prompts.
- Run it with **Docker + Compose + named volumes**; easy build and tear-down.
- Simple tools (Node 22, Vite/React, Express, pg, PostgreSQL 16).
- Host port configurable via env (default `8080`); never assume a port is free.
- Dev-workspace environment: Docker is NOT available here (validate with
  `npm test` + `npm run typecheck`; the `docker compose up` flow is verified on
  the target box per `docs/RUNBOOK.md`). Node 22 is not on the default `PATH` —
  prepend `/home/op/.local/node-v22.23.2-linux-x64/bin` before npm commands.
- Do not write `README.md` (owned by the goal / human gate). Plan →
  `docs/PLAN.md`, design → `docs/ARCHITECTURE.md`, compose runbook →
  `docs/RUNBOOK.md`.
