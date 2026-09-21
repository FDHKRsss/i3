import { useCallback, useState } from "react";
import "../app.css";
import { Camera } from "../capture/Camera.tsx";
import { type CapturedImages } from "../capture/image.ts";

const STEPS = [
  { id: "camera", label: "Aparat" },
  { id: "location", label: "Lokalizacja" },
  { id: "description", label: "Opis" },
  { id: "review", label: "Przegląd" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const STEP_HINT: Record<StepId, string> = {
  camera: "Zrób zdjęcie aparatem telefonu.",
  location: "Pobierz swoją lokalizację GPS i zobacz ją na mapie.",
  description: "Dodaj opis zgłoszenia (albo wygeneruj go automatycznie).",
  review: "Sprawdź zgłoszenie i wyślij.",
};

/**
 * Report wizard. A step indicator drives the four-step flow
 * camera → location → description → review. The camera step (M9 -- real) uses
 * the real `getUserMedia` camera with a `MockCamera` fallback and pushes the
 * compressed full photo + thumbnail into the wizard state on capture; it also
 * exposes "Zrób ponownie" (retake) / "Dalej" (continue) buttons. Location,
 * description and review bodies are filled in by M10–M12.
 */
export function NewReport() {
  const [stepIndex, setStepIndex] = useState(0);
  const [images, setImages] = useState<CapturedImages | null>(null);
  const total = STEPS.length;
  const current = STEPS[stepIndex];
  const isCameraStep = stepIndex === 0;

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);

  const handleCapture = useCallback((images: CapturedImages) => {
    setImages(images);
  }, []);

  const handleRetake = useCallback(() => {
    setImages(null);
  }, []);

  return (
    <main className="page wizard">
      <header className="wizard__header">
        <h1>Nowe zgłoszenie</h1>
        <ol className="stepper" aria-label="Postęp zgłoszenia">
          {STEPS.map((step, i) => {
            const stateClass =
              i === stepIndex
                ? "stepper__step--active"
                : i < stepIndex
                  ? "stepper__step--done"
                  : "";
            return (
              <li
                key={step.id}
                className={`stepper__step ${stateClass}`}
                aria-current={i === stepIndex ? "step" : undefined}
              >
                <span className="stepper__index">{i + 1}</span>
                <span className="stepper__label">{step.label}</span>
              </li>
            );
          })}
        </ol>
      </header>

      <section className="wizard__body" aria-labelledby="wizard-step-title">
        <h2 id="wizard-step-title" className="wizard__step-title">
          Krok {stepIndex + 1} z {total}: {current.label}
        </h2>

        {isCameraStep ? (
          <div className="camera-step">
            <p className="wizard__hint">{STEP_HINT.camera}</p>
            {images === null ? (
              <div className="camera-step__viewfinder">
                <Camera onCapture={handleCapture} />
              </div>
            ) : (
              <p className="camera-step__captured" role="status">
                Zdjęcie zapisane — przejdź dalej albo zrób je ponownie.
              </p>
            )}
          </div>
        ) : (
          <p className="wizard__hint">{STEP_HINT[current.id]}</p>
        )}
      </section>

      <nav className="wizard__actions" aria-label="Nawigacja kreatora">
        <button
          type="button"
          className="button button--secondary"
          disabled={stepIndex === 0}
          onClick={goBack}
        >
          Wstecz
        </button>

        {isCameraStep && (
          <button
            type="button"
            className="button button--secondary"
            disabled={images === null}
            onClick={handleRetake}
          >
            Zrób ponownie
          </button>
        )}

        {stepIndex < total - 1 && (
          <button
            type="button"
            className="button button--primary"
            disabled={isCameraStep && images === null}
            onClick={goNext}
          >
            Dalej
          </button>
        )}
      </nav>

      <a className="button button--secondary" href="#/">
        Anuluj
      </a>
    </main>
  );
}
