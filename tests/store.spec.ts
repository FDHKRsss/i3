// @vitest-environment node
import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

type Store = typeof import("../server/store.js");

/**
 * The store module reads UPLOAD_DIR once at import time, so it is imported
 * dynamically after the env var is pointed at an isolated temp directory.
 */
describe("store (real upload persistence)", () => {
  let dir: string;
  let saveUpload: Store["saveUpload"];
  let removeUpload: Store["removeUpload"];

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "civil42-store-"));
    process.env.UPLOAD_DIR = dir;
    vi.resetModules();
    const store = await import("../server/store.js");
    saveUpload = store.saveUpload;
    removeUpload = store.removeUpload;
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
    delete process.env.UPLOAD_DIR;
  });

  it("writes uploaded bytes to <id>.<ext> and returns the relative filename", async () => {
    const name = await saveUpload("abc-123", "wav", Buffer.from("RIFF-fake-audio"));
    expect(name).toBe("abc-123.wav");
    await expect(readFile(path.join(dir, name), "utf8")).resolves.toBe(
      "RIFF-fake-audio"
    );
  });

  it("removeUpload deletes the stored file and is idempotent for missing files", async () => {
    const name = await saveUpload("img-1", "png", Buffer.from("fake-png"));
    await removeUpload(name);
    await expect(access(path.join(dir, name))).rejects.toThrow();
    await expect(removeUpload("never-written.bin")).resolves.toBeUndefined();
  });
});
