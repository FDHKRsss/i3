// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { send } from "../src/send.tsx";

describe("send (frontend multipart submission)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts voice, image and GPS as multipart and returns the server text", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response("Report received successfully", { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const voice = new Blob(["RIFF-wav-bytes"], { type: "audio/wav" });
    const image = new Blob(["png-bytes"], { type: "image/png" });

    const result = await send({
      voice,
      image,
      gps: { lat: 52.2297, lon: 21.0122 },
    });

    expect(result).toBe("Report received successfully");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/report");
    expect(init.method).toBe("POST");

    const body = init.body as FormData;
    expect(body.get("lat")).toBe("52.2297");
    expect(body.get("lon")).toBe("21.0122");

    const voicePart = body.get("voice") as File;
    expect(voicePart.name).toBe("voice.wav");
    expect(voicePart.type).toBe("audio/wav");

    const imagePart = body.get("image") as File;
    expect(imagePart.name).toBe("image.png");
    expect(imagePart.type).toBe("image/png");
  });

  it("uses the .webm filename for non-WAV audio and surfaces HTTP errors", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response("Bad request", { status: 400 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await send({
      voice: new Blob(["webm-bytes"], { type: "audio/webm" }),
      image: null,
      gps: { lat: 0, lon: 0 },
    });

    expect(result).toBe("HTTP error! status: 400");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as FormData;
    expect((body.get("voice") as File).name).toBe("voice.webm");
    expect(body.has("image")).toBe(false);
  });
});
