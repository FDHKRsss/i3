import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "/app/uploads";

async function ensureDir(): Promise<void> {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

/**
 * Persist one uploaded file to the uploads volume and return the relative
 * filename that is stored in the database.
 */
export async function saveUpload(
  id: string,
  ext: string,
  data: Buffer
): Promise<string> {
  await ensureDir();
  const filename = `${id}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), data);
  return filename;
}

export async function removeUpload(filename: string): Promise<void> {
  try {
    await unlink(path.join(UPLOAD_DIR, filename));
  } catch {
    // Best-effort cleanup; missing files are not an error.
  }
}
