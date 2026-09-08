import express from "express";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { listReports, ping } from "./db.js";
import { handleReport, HttpError } from "./report.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT ?? 8080);
const DIST_DIR = process.env.DIST_DIR ?? path.resolve(__dirname, "../dist");

export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  const dbUp = await ping();
  res.status(dbUp ? 200 : 503).json({ ok: true, db: dbUp ? "up" : "down" });
});

// `/api/report` accepts only POST (multipart). Non-POST methods get a 405,
// per the API contract in docs/ARCHITECTURE.md.
app.all("/api/report", async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    await handleReport(req, res);
  } catch (err) {
    const status = err instanceof HttpError ? err.statusCode : 500;
    if (status >= 500) {
      // Internal details are logged, never leaked to the client.
      console.error(err);
      if (!res.headersSent) {
        res.status(status).send("Internal server error");
      }
      return;
    }
    if (!res.headersSent) {
      res.status(status).send(err instanceof Error ? err.message : "Bad request");
    }
  }
});

app.get("/api/reports", async (req, res) => {
  try {
    const raw = Number(req.query.limit);
    const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 50, 1), 100);
    const rows = await listReports(limit);
    // `created_at` is an internal ordering detail; the public report shape
    // does not expose it (matches the seed's earlier stub contract).
    const publicRows = rows.map(({ created_at: _createdAt, ...report }) => report);
    res.json(publicRows);
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: "Database unavailable" });
  }
});

app.use(express.static(DIST_DIR));

app.get("*", (_req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

// Start listening only when this file is the entry point, so integration
// tests can import `app` without binding a host port.
const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Civil42 server listening on http://0.0.0.0:${PORT}`);
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error(`Failed to start server on port ${PORT}: ${err.message}`);
    process.exit(1);
  });
}
