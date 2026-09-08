# Runbook — verify `docker compose up` end-to-end

> Purpose: confirm on a plain Unix box that the whole stack (Vite/React frontend,
> Express API, local PostgreSQL 16, and the two named volumes) builds, starts,
> serves, persists a report, and survives a teardown/re-up cycle.

All commands are run from the repository root, unless noted. No camera, mic or
GPS permissions are ever requested: the frontend mocks capture and the backend
mocks reverse-geocoding (see `docs/ARCHITECTURE.md`, "Mocking strategy").

---

## 0. Prerequisites

- Docker Engine (with the Compose v2 plugin: `docker compose version`).
- A Unix shell (`bash`/`sh`).
- Nothing listening on the host port you choose (default `8080`).

> Workspace note: if Docker is not available where you develop (e.g. this
> agent workspace), validate the backend/API behavior with the Node test suite
> instead — `npm test` and `npm run typecheck` — and run this runbook on the
> target box (EC2/any Unix host).

## 1. Configure

```sh
cp .env.example .env
```

The defaults work out of the box. The knobs you are most likely to touch:

| Variable          | Default    | Meaning                                              |
| ----------------- | ---------- | ---------------------------------------------------- |
| `APP_PORT`        | `8080`     | Host port the app is published on (change it if `8080` is taken). |
| `POSTGRES_USER`   | `civil42`  | Postgres user (also used by the app).                |
| `POSTGRES_PASSWORD` | `civil42` | Postgres password.                                   |
| `POSTGRES_DB`     | `civil42`  | Database name.                                       |
| `GEO_PROVIDER`    | `mock`     | Reverse-geocode provider; only `mock` is implemented. |
| `MAX_UPLOAD_BYTES`| `15728640` | Upload size cap (15 MB).                             |

Postgres is **internal only** (no host port is published), so it never clashes
with a local `5432`.

## 2. Build and start

```sh
docker compose up --build -d
```

This builds the multi-stage image (frontend bundle + compiled server) and starts
`db` first, then `app` (the app waits for the DB healthcheck via `depends_on`).

## 3. Wait until both services are healthy

```sh
docker compose ps
```

Expected: two services, `db` and `app`, both showing `healthy`. If `app` is
still `starting`, wait a few seconds and re-run — the first boot runs
`db/init.sql`, and the app healthcheck only flips green once `/health` returns
`db: "up"`.

## 4. Health check

```sh
curl -s http://localhost:8080/health
# {"ok":true,"db":"up"}
```

- `db: "up"` means the app reached Postgres with `SELECT 1`.
- `db: "down"` means the app booted but the database is not reachable yet —
  wait for the DB healthcheck, or inspect `docker compose logs db`.

(If you changed `APP_PORT`, use that port in every URL below.)

## 5. Frontend is served

```sh
curl -s http://localhost:8080/ | grep -o '<title>[^<]*</title>'
```

Or open `http://localhost:8080/` in a browser. The single-page app loads from the
built `dist/`, and all device capture is mocked (a canvas-drawn PNG, a synthetic
WAV, and a fixed GPS default), so no permission prompts appear.

## 6. End-to-end: capture → submit → reverse-geocode → persist → list

Create two tiny stand-in files (the seed stores raw bytes; it does not decode
audio/image content):

```sh
printf 'dummy-wav-bytes' > /tmp/voice.wav
printf 'dummy-png-bytes' > /tmp/photo.png
```

Submit a report (multipart, `voice` required, `image` optional):

```sh
curl -s -X POST "http://localhost:8080/api/report" \
  -F "voice=@/tmp/voice.wav;type=audio/wav" \
  -F "image=@/tmp/photo.png;type=image/png" \
  -F "lat=52.2297" \
  -F "lon=21.0122"
# Report received successfully
```

List the persisted reports:

```sh
curl -s "http://localhost:8080/api/reports?limit=5"
```

Expected: a JSON array whose newest entry contains

- `id` — a UUID string,
- `lat` / `lon` — `52.2297` / `21.0122`,
- `audio_path` — `<uuid>.wav`,
- `image_path` — `<uuid>.png`,
- `geo_desc` — `mock location (52.22970, 21.01220)`.

(`created_at` is kept only as an internal SQL ordering detail and is not exposed.)

## 7. Verify persistence in Postgres

```sh
docker compose exec db psql -U civil42 -d civil42 \
  -c "SELECT id, lat, lon, audio_path, image_path, geo_desc FROM reports ORDER BY created_at DESC LIMIT 5;"
```

You should see the row you just submitted. The schema (`reports` table and the
`reports_created_at_idx` index) is created by `db/init.sql` on the first boot.

## 8. Verify the uploads volume

```sh
docker compose exec app ls -l /app/uploads
```

Expected: one `<uuid>.wav` and one `<uuid>.png` file — the binaries written by
`server/store.ts` to the `uploads` named volume.

## 9. Tear-down and restart (data survives)

```sh
docker compose down      # stops containers; keeps pgdata + uploads volumes
docker compose up -d     # starts again — report data is still there
curl -s "http://localhost:8080/api/reports?limit=5"   # still lists the report
```

For a **clean reset** (drop the database and uploaded files):

```sh
docker compose down -v   # also deletes the named volumes (fresh start)
docker compose up --build -d
```

---

## Troubleshooting

- **`bind: address already in use`** — set a different `APP_PORT` in `.env` and
  run `docker compose up -d` again. Never assume `8080` is free.
- **`app` stays `unhealthy`** — `docker compose logs app`; the app only reports
  healthy when `/health` returns `db: "up"`, so first confirm `docker compose ps`
  shows `db` healthy.
- **`db` never becomes healthy** — `docker compose logs db`; the most common
  cause is a leftover `pgdata` volume from an old Postgres major version — remove
  it with `docker compose down -v`.
- **DB down at app start** — by design the app still boots and `/health` returns
  `{"ok":true,"db":"down"}` (HTTP `503`); report POST returns `500` rather than
  hanging until the DB comes back.
