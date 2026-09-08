import { useCallback, useRef, useState } from "react";

export interface MockAudio {
  start: () => void;
  stop: (onDone: (audio: Blob) => void) => void;
  isRecording: boolean;
}

/**
 * Synthesize a short PCM WAV entirely in JavaScript so no microphone
 * permission is requested. The produced Blob is shaped like a real recording.
 */
function synthWav(durationMs: number): Blob {
  const sampleRate = 8000;
  const numSamples = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string): void => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.3 * 32767;
    view.setInt16(44 + i * 2, sample, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export function useMockAudio(): MockAudio {
  const [isRecording, setIsRecording] = useState(false);
  const startedAtRef = useRef(0);

  const start = useCallback(() => {
    startedAtRef.current = Date.now();
    setIsRecording(true);
  }, []);

  const stop = useCallback(
    (onDone: (audio: Blob) => void) => {
      if (!isRecording) {
        return;
      }
      setIsRecording(false);
      const elapsed = Math.max(Date.now() - startedAtRef.current, 200);
      onDone(synthWav(elapsed));
    },
    [isRecording]
  );

  return { start, stop, isRecording };
}
