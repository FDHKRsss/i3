# Known issues

_Recurring walls/gotchas and how to get past them. One bullet each._

- Node/npm are NOT on the default PATH. Prepend `/home/op/.local/node-v22.23.2-linux-x64/bin`
  (matches `.nvmrc` = `22`) before `npm test` / `npm run typecheck`, else `command not found: node`.
- Docker is unavailable in this workspace (`docker: not found`). Validate backend/API behavior with
  the Node test suite (`npm test` + `npm run typecheck`) instead of relying on `docker compose`.
- `npm test` prints `Error: db down` to stderr; this is EXPECTED — the two negative-path specs mock
  `listReports`/`insertReport` rejection (GET `/api/reports` → `503`, POST `/api/report` → `500`).
  Exit code 0 + all tests passing means the suite is green, not broken.
