import "./app.css";
import { useEffect, useState } from "react";
import { MockCamera } from "./capture/MockCamera.tsx";
import { useMockAudio } from "./capture/useMockAudio.ts";
import { getMockPosition } from "./capture/location.ts";
import { send } from "./send.tsx";

const version = "seed";
const welcome = `[Nagrywam] Kliknij, aby wysłać zdjęcie z audio i pozycją [${version}]`;

export function App() {
  const audio = useMockAudio();
  const [label, setLabel] = useState(welcome);

  useEffect(() => {
    audio.start();
  }, [audio.start]);

  function submit(photo: HTMLCanvasElement, voice: Blob) {
    setLabel("Wysyłam...");
    photo.toBlob((image) => {
      const gps = getMockPosition();
      send({ voice, image, gps }).then((txt) => setLabel(txt));
    }, "image/png");
    audio.start();
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "1fr",
        width: "100vw",
        height: "100vh",
      }}
    >
      <MockCamera
        onCapture={(photo) => audio.stop((voice) => submit(photo, voice))}
      />
      <div
        style={{
          position: "absolute",
          bottom: "1cm",
          left: "50%",
          transform: "translate(-50%, 0)",
          pointerEvents: "none",
          background: "white",
          opacity: 0.7,
          padding: 8,
          borderRadius: 10,
        }}
      >
        {label}
      </div>
    </div>
  );
}
