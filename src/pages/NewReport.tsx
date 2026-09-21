import { useState } from "react";
import "../app.css";

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
 * Report wizard (M8 -- real shell). A step indicator drives the four-step flow
 * camera → location → description → review with real Polish copy and
 * next/back navigation. Each step's body is filled in by M9–M12; this
 * milestone delivers the navigation + step indicator so the wizard is a real
 * skeleton, not a placeholder.
 */
export function NewReport() {
  const [stepIndex, setStepIndex] = useState(0);
  const total = STEPS.length;
  const current = STEPS[stepIndex];

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
        <p className="wizard__hint">{STEP_HINT[current.id]}</p>
      </section>

      <nav className="wizard__actions" aria-label="Nawigacja kreatora">
        <button
          type="button"
          className="button button--secondary"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
        >
          Wstecz
        </button>
        {stepIndex < total - 1 ? (
          <button
            type="button"
            className="button button--primary"
            onClick={() => setStepIndex((i) => Math.min(total - 1, i + 1))}
          >
            Dalej
          </button>
        ) : null}
      </nav>

      <a className="button button--secondary" href="#/">
        Anuluj
      </a>
    </main>
  );
}
