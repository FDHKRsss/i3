# Failures

_Regressions: what broke, the proven root cause, and the fix._

- `GET /api/reports` returned the raw `pg` row, leaking the internal `created_at` (a `Date`); the
  HTTP-layer test pins the public shape to `{ id }`, so the extra key broke deep-equal. Fix: map each
  row to an explicit public object in `server/index.ts` that strips `created_at` (kept only as an
  internal SQL ordering detail).
