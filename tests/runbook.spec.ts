// @vitest-environment node
//
// Pins the concrete facts that `docs/RUNBOOK.md` documents (env defaults,
// compose wiring, DB schema, served title, upload dir, expected outputs) to the
// real source so the runbook cannot silently drift from the implementation.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const read = (rel: string): string => readFileSync(resolve(root, rel), "utf8");

const runbook = read("docs/RUNBOOK.md");
const envExample = read(".env.example");
const compose = read("docker-compose.yml");
const initSql = read("db/init.sql");
const indexHtml = read("index.html");
const storeSrc = read("server/store.ts");

describe("runbook (docs) vs. implementation", () => {
  it("documents the full docker compose end-to-end flow", () => {
    expect(runbook).toContain("docker compose up --build -d");
    expect(runbook).toContain("docker compose down");
    expect(runbook).toContain("docker compose down -v");
    expect(runbook).toContain("curl -s http://localhost:8080/health");
    expect(runbook).toContain('curl -s -X POST "http://localhost:8080/api/report"');
    expect(runbook).toContain('curl -s "http://localhost:8080/api/reports?limit=5"');
    expect(runbook).toContain("docker compose exec db psql");
    expect(runbook).toContain("docker compose exec app ls -l /app/uploads");
  });

  it("documents the expected API outputs exactly as produced", () => {
    expect(runbook).toContain('{"ok":true,"db":"up"}');
    expect(runbook).toContain("Report received successfully");
    expect(runbook).toContain("mock location (52.22970, 21.01220)");
    // Public report shape: geo/lat/lon/audio/image exposed, created_at stripped.
    expect(runbook).toContain("geo_desc");
    expect(runbook).toContain("audio_path");
    expect(runbook).toContain("created_at");
  });

  it("documents the workspace fallback for when Docker is unavailable", () => {
    expect(runbook).toContain("npm test");
    expect(runbook).toContain("npm run typecheck");
  });
});

describe("runbook env defaults (.env.example)", () => {
  it("matches the documented configuration table", () => {
    expect(envExample).toContain("APP_PORT=8080");
    expect(envExample).toContain("POSTGRES_USER=civil42");
    expect(envExample).toContain("POSTGRES_PASSWORD=civil42");
    expect(envExample).toContain("POSTGRES_DB=civil42");
    expect(envExample).toContain("GEO_PROVIDER=mock");
    expect(envExample).toContain("MAX_UPLOAD_BYTES=15728640");
  });
});

describe("runbook compose wiring (docker-compose.yml)", () => {
  it("uses Postgres 16, an internal-only db, and the two named volumes", () => {
    expect(compose).toContain("image: postgres:16-alpine");
    expect(compose).toContain("pgdata:");
    expect(compose).toContain("uploads:");

    // The `db` service must publish no host port (internal only).
    const dbBlock = compose.match(/  db:[\s\S]*?(?=\n  app:)/)?.[0] ?? "";
    expect(dbBlock).not.toContain("ports:");
    expect(dbBlock).toContain("pg_isready");
  });

  it("publishes APP_PORT -> 8080 and waits for the db healthcheck", () => {
    expect(compose).toContain('"${APP_PORT:-8080}:8080"');
    expect(compose).toContain("condition: service_healthy");
    expect(compose).toContain(
      "postgres://${POSTGRES_USER:-civil42}:${POSTGRES_PASSWORD:-civil42}@db:5432/${POSTGRES_DB:-civil42}"
    );
    expect(compose).toContain("UPLOAD_DIR: /app/uploads");
    expect(compose).toContain("GEO_PROVIDER: ${GEO_PROVIDER:-mock}");
    expect(compose).toContain("MAX_UPLOAD_BYTES: ${MAX_UPLOAD_BYTES:-15728640}");
  });
});

describe("runbook schema & static facts", () => {
  it("db/init.sql creates the reports table and the ordering index", () => {
    expect(initSql).toMatch(/CREATE TABLE IF NOT EXISTS reports\s*\(/);
    expect(initSql).toContain("gen_random_uuid()");
    expect(initSql).toContain("reports_created_at_idx");
  });

  it("serves the documented <title>Civil42</title>", () => {
    expect(indexHtml).toMatch(/<title>Civil42<\/title>/);
  });

  it("defaults the upload dir to the documented /app/uploads volume path", () => {
    expect(storeSrc).toContain('process.env.UPLOAD_DIR ?? "/app/uploads"');
  });
});
