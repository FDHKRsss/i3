# Patterns

_Reusable techniques that worked, so they are reused not rediscovered._

- Docs drift from the repo: before marking a milestone done (or editing docs), grep-verify every
  factual claim in `PLAN.md`/`ARCHITECTURE.md` (tool versions like Vite 5 vs 8, status text, test
  counts) against `package.json` and the actual tree — a stale doc misleads the next agent into
  redoing finished work.
