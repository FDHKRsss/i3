import busboy from "busboy";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { whatIsAtLocation } from "./geo.js";
import { insertReport } from "./db.js";
import { removeUpload, saveUpload } from "./store.js";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

interface ParsedFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

interface ParsedReport {
  voice?: ParsedFile;
  image?: ParsedFile;
  lat?: string;
  lon?: string;
}

function maxUploadBytes(): number {
  const raw = Number(process.env.MAX_UPLOAD_BYTES ?? 15 * 1024 * 1024);
  return Number.isFinite(raw) && raw > 0 ? raw : 15 * 1024 * 1024;
}

function parseCoord(
  value: string | undefined,
  name: "lat" | "lon"
): number | null {
  if (value === undefined || value.trim() === "") {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new HttpError(400, `Invalid ${name}`);
  }
  const [min, max] = name === "lat" ? [-90, 90] : [-180, 180];
  if (n < min || n > max) {
    throw new HttpError(400, `Invalid ${name}`);
  }
  return n;
}

function extFor(mimetype: string, fallback: string): string {
  const byMime: Record<string, string> = {
    "audio/webm": "webm",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "image/png": "png",
    "image/jpeg": "jpg",
  };
  return byMime[mimetype] ?? fallback;
}

function parseMultipart(
  req: IncomingMessage,
  maxBytes: number
): Promise<ParsedReport> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    const files: Record<string, ParsedFile> = {};
    const filePromises: Promise<void>[] = [];
    let tooLarge = false;

    const bb = busboy({
      headers: req.headers,
      limits: {
        files: 2,
        fileSize: maxBytes,
        fields: 20,
        fieldSize: 64 * 1024,
        parts: 30,
      },
    });

    bb.on("field", (name: string, val: string) => {
      fields[name] = val;
    });

    bb.on(
      "file",
      (
        name: string,
        file: Readable & { truncated?: boolean },
        info: { mimetype?: string; mimeType?: string }
      ) => {
        const chunks: Buffer[] = [];
        const mimetype = info.mimeType ?? info.mimetype ?? "application/octet-stream";

        const p = new Promise<void>((res, rej) => {
          file.on("limit", () => {
            tooLarge = true;
            rej(new HttpError(400, "Upload too large"));
          });
          file.on("data", (data: Buffer) => {
            chunks.push(data);
          });
          file.on("end", () => {
            if (file.truncated) {
              tooLarge = true;
              rej(new HttpError(400, "Upload too large"));
              return;
            }
            files[name] = {
              buffer: Buffer.concat(chunks),
              filename: `${name}`,
              mimetype,
            };
            res();
          });
          file.on("error", rej);
        });
        filePromises.push(p);
      }
    );

    bb.on("filesLimit", () => {
      reject(new HttpError(400, "Too many files"));
    });
    bb.on("error", (err: unknown) => {
      reject(err);
    });
    bb.on("close", async () => {
      try {
        await Promise.all(filePromises);
        if (tooLarge) {
          reject(new HttpError(400, "Upload too large"));
          return;
        }
        resolve({ ...files, ...fields });
      } catch (err) {
        reject(err);
      }
    });

    req.pipe(bb);
  });
}

export async function handleReport(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new HttpError(400, "Expected multipart/form-data");
  }

  const limit = maxUploadBytes();
  const parsed = await parseMultipart(req, limit);

  const lat = parseCoord(parsed.lat, "lat");
  const lon = parseCoord(parsed.lon, "lon");
  const voice = parsed.voice;

  if (!voice || voice.buffer.length === 0) {
    throw new HttpError(400, "Missing voice recording");
  }

  const geoDesc =
    lat !== null && lon !== null ? await whatIsAtLocation({ lat, lon }) : "";

  const id = randomUUID();
  const audioPath = await saveUpload(
    id,
    extFor(voice.mimetype, "webm"),
    voice.buffer
  );

  let imagePath: string | null = null;
  try {
    if (parsed.image && parsed.image.buffer.length > 0) {
      imagePath = await saveUpload(
        id,
        extFor(parsed.image.mimetype, "png"),
        parsed.image.buffer
      );
    }
    await insertReport({ lat, lon, audioPath, imagePath, geoDesc });
  } catch (err) {
    await removeUpload(audioPath);
    if (imagePath) {
      await removeUpload(imagePath);
    }
    throw err;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Report received successfully");
}
