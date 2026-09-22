// @vitest-environment node
//
// Pins the milestone-planning docs (docs/PLAN.md + docs/ARCHITECTURE.md) to the
// fact that M15 (the final compose/tests/docs pass) shipped: the checkbox, the
// "Current status" entry, and the "Implementation status" entry must all agree,
// and the stale pre-M15 phrasing ("not implemented yet", "Next: M15") must be
// gone. This mirrors runbook.spec.ts in pinning docs to the real tree so the
// three milestone-state locations cannot silently drift apart.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const read = (rel: string): string => readFileSync(resolve(root, rel), "utf8");

const plan = read("docs/PLAN.md");
const arch = read("docs/ARCHITECTURE.md");

const planStatus = plan.split("## Current status")[1]?.split("## Post-approval polish")[0] ?? "";

describe("PLAN.md reflects the shipped M15 state", () => {
  it("marks both M15 passes done", () => {
    expect(plan).toMatch(/^- \[x\] M15 -- stub\b/m);
    expect(plan).toMatch(/^- \[x\] M15 -- real\b/m);
  });

  it("updates the Current status tail: M15 done, no next milestone pending", () => {
    expect(planStatus).toContain("M15 (stub + real) — done");
    expect(planStatus).not.toContain("Next: **M15**");
  });

  it("keeps the BYTEA storage facts", () => {
    expect(plan).toContain("image BYTEA");
    expect(plan).toContain("thumbnail BYTEA");
  });
});

describe("ARCHITECTURE.md reflects the shipped M15 state", () => {
  it("lists M15 as done and leaves no open milestone", () => {
    expect(arch).toContain("M15 (Compose, tests & docs)");
    expect(arch).not.toContain("M15 (Compose, tests & docs) — not implemented yet");
    expect(arch).not.toContain("not implemented yet");
  });
});
