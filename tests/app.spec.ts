// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

vi.mock("../server/db.js", () => ({
  ping: vi.fn(async () => true),
  listReports: vi.fn(async () => []),
  insertReport: vi.fn(async () => ({})),
}));

vi.mock("../server/geo.js", () => ({
  whatIsAtLocation: vi.fn(
    async ({ lat, lon }: { lat: number; lon: number }) => `mock ${lat},${lon}`
  ),
}));

vi.mock("../server/store.js", () => ({
  saveUpload: vi.fn(async () => "stored.bin"),
  removeUpload: vi.fn(async () => {}),
}));

import { app } from "../server/index.js";
import { insertReport, listReports, ping } from "../server/db.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  // Bind an OS-chosen (ephemeral) port so the test never collides with a
  // process already listening on a fixed port.
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

beforeEach(() => {
  vi.clearAllMocks();
});

/** Build a minimal, valid multipart/form-data report body (voice + coords). */
function buildReportBody(boundary: string): string {
  return [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="lat"\r\n\r\n`,
    `52.2\r\n`,
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="lon"\r\n\r\n`,
    `21.0\r\n`,
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="voice"; filename="v.wav"\r\n`,
    `Content-Type: audio/wav\r\n\r\n`,
    `RIFF-fake-audio`,
    `\r\n--${boundary}--\r\n`,
  ].join("");
}

describe("Express app (HTTP layer)", () => {
  it("GET /health returns 200 and db up when the database responds", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: "up" });
  });

  it("GET /health returns 503 and db down when ping fails", async () => {
    vi.mocked(ping).mockResolvedValueOnce(false);
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: true, db: "down" });
  });

  it("does not expose the x-powered-by header", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("GET /api/reports returns rows and clamps an oversized limit to 100", async () => {
    vi.mocked(listReports).mockResolvedValueOnce([
      { id: "1", created_at: new Date() },
    ] as never);
    const res = await fetch(`${baseUrl}/api/reports?limit=9999`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "1" }]);
    expect(listReports).toHaveBeenCalledWith(100);
  });

  it("strips the internal created_at while preserving every other report field", async () => {
    vi.mocked(listReports).mockResolvedValueOnce([
      {
        id: "r-1",
        created_at: new Date("2026-09-09T12:00:00Z"),
        lat: 52.2297,
        lon: 21.0122,
        audio_path: "r-1.wav",
        image_path: "r-1.png",
        geo_desc: "mock location (52.22970, 21.01220)",
      },
    ] as never);

    const res = await fetch(`${baseUrl}/api/reports?limit=10`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      {
        id: "r-1",
        lat: 52.2297,
        lon: 21.0122,
        audio_path: "r-1.wav",
        image_path: "r-1.png",
        geo_desc: "mock location (52.22970, 21.01220)",
      },
    ]);
    expect("created_at" in body[0]).toBe(false);
  });

  it("defaults the report limit to 50 and enforces a minimum of 1", async () => {
    await fetch(`${baseUrl}/api/reports`);
    expect(listReports).toHaveBeenCalledWith(50);

    vi.mocked(listReports).mockClear();
    await fetch(`${baseUrl}/api/reports?limit=0`);
    expect(listReports).toHaveBeenCalledWith(1);
  });

  it("GET /api/reports returns 503 when the database is unavailable", async () => {
    vi.mocked(listReports).mockRejectedValueOnce(new Error("db down"));
    const res = await fetch(`${baseUrl}/api/reports`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Database unavailable" });
  });

  it("GET /api/report returns 405 with an Allow: POST header", async () => {
    const res = await fetch(`${baseUrl}/api/report`);
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
    expect(await res.text()).toBe("Method not allowed");
  });

  it("POST /api/report rejects non-multipart content with 400", async () => {
    const res = await fetch(`${baseUrl}/api/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Expected multipart/form-data");
  });

  it("POST /api/report accepts a valid multipart report end-to-end", async () => {
    const boundary = "----civil42testboundary";
    const body = buildReportBody(boundary);

    const res = await fetch(`${baseUrl}/api/report`, {
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Report received successfully");
  });

  it("POST /api/report returns a generic 500 (no leaked details) when the DB insert fails", async () => {
    vi.mocked(insertReport).mockRejectedValueOnce(new Error("db down"));
    const boundary = "----civil42testboundary500";
    const body = buildReportBody(boundary);

    const res = await fetch(`${baseUrl}/api/report`, {
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("Internal server error");
  });
});
