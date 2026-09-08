import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMockAudio } from "./useMockAudio.ts";

function readWavHeader(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const ascii = (offset: number, length: number) => {
    let s = "";
    for (let i = 0; i < length; i++) {
      s += String.fromCharCode(view.getUint8(offset + i));
    }
    return s;
  };
  return {
    riff: ascii(0, 4),
    wave: ascii(8, 4),
    fmt: ascii(12, 4),
    chunkSize: view.getUint32(4, true),
    byteLength: buffer.byteLength,
    audioFormat: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    dataChunkSize: view.getUint32(40, true),
  };
}

/** jsdom's Blob lacks arrayBuffer(); FileReader is the portable way to read it. */
function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe("useMockAudio (synthetic WAV, no mic)", () => {
  it("starts/stops recording and yields a structurally valid PCM WAV Blob", async () => {
    const { result } = renderHook(() => useMockAudio());
    expect(result.current.isRecording).toBe(false);

    act(() => result.current.start());
    expect(result.current.isRecording).toBe(true);

    let captured: Blob | undefined;
    act(() => {
      result.current.stop((audio) => (captured = audio));
    });

    expect(result.current.isRecording).toBe(false);
    expect(captured).toBeInstanceOf(Blob);
    expect(captured!.type).toBe("audio/wav");

    const buffer = await readBlob(captured!);
    const header = readWavHeader(buffer);
    expect(header.riff).toBe("RIFF");
    expect(header.wave).toBe("WAVE");
    expect(header.fmt).toBe("fmt ");
    // RIFF chunk size = whole file minus the 8-byte "RIFF<size>" header.
    expect(header.chunkSize).toBe(header.byteLength - 8);
    expect(header.audioFormat).toBe(1); // PCM
    expect(header.channels).toBe(1); // mono
    expect(header.sampleRate).toBe(8000);
    // "data" payload size + 44-byte header must equal the file length.
    expect(header.dataChunkSize).toBe(header.byteLength - 44);
    expect(header.byteLength).toBeGreaterThan(44);
  });

  it("ignores stop before start and produces no audio", () => {
    const { result } = renderHook(() => useMockAudio());
    let called = false;
    act(() => {
      result.current.stop(() => (called = true));
    });
    expect(called).toBe(false);
    expect(result.current.isRecording).toBe(false);
  });
});
