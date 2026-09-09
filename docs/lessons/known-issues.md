# Known issues

_Recurring walls/gotchas and how to get past them. One bullet each._

- Node/npm are NOT on the default PATH. Prepend `/home/op/.local/node-v22.23.2-linux-x64/bin`
  (matches `.nvmrc` = `22`) before `npm test` / `npm run typecheck`, else `command not found: node`.
- Docker is unavailable in this workspace (`docker: not found`). Validate backend/API behavior with
  the Node test suite (`npm test` + `npm run typecheck`) instead of relying on `docker compose`.
- `npm test` prints `Error: db down` to stderr; this is EXPECTED — the two negative-path specs mock
  `listReports`/`insertReport` rejection (GET `/api/reports` → `503`, POST `/api/report` → `500`).
  Exit code 0 + all tests passing means the suite is green, not broken.
- Doc test-count claims are pinned to the **committed** tree, but `npm test` runs the **working**
  tree. Verify against the working tree (the runner's `N passed`, or `grep -c '^\\s*it('` /
  `^\\s*test(`), NOT `git show HEAD`: a reviewer read HEAD (`43`) as "matching" while the
  runner/working tree had `46`.
- Review roles need materials to act: a critic invoked bare returned `approved: false` with a
  `No task/goal, plan, or actor output` blocking issue (not a real verdict). When handing off to any
  reviewer, always include the goal, `docs/PLAN.md`, and the last actor's output.
