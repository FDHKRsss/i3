/**
 * Image capture helpers (M9 -- stub).
 *
 * The camera step needs a placeholder photo + thumbnail pair to push into the
 * wizard state so the whole report flow runs end-to-end before real canvas
 * processing lands (M9 -- real). `makePlaceholderImages` returns fixed JPEG
 * blobs — deterministic and headless/test-safe, since jsdom has no
 * `canvas.toBlob` and no real camera.
 */
export interface CapturedImages {
  full: Blob;
  thumbnail: Blob;
}

export function makePlaceholderImages(): CapturedImages {
  return {
    full: new Blob(["placeholder-photo"], { type: "image/jpeg" }),
    thumbnail: new Blob(["placeholder-thumbnail"], { type: "image/jpeg" }),
  };
}
