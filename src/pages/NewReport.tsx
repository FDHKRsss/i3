import { useCallback, useEffect, useState } from "react";
import "../app.css";
import { Camera } from "../capture/Camera.tsx";
import { type CapturedImages } from "../capture/image.ts";
import { reverseGeocode } from "../capture/geo.ts";
import {
  GeolocationError,
  getCurrentPosition,
  parsePosition,
  type GeolocationErrorCode,
  type GpsPosition,
} from "../capture/location.ts";
import { MapPin } from "../map/MapPin.tsx";
import { generateDescription } from "../description.ts";

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

const LOCATION_ERROR_HINT: Record<GeolocationErrorCode, string> = {
  unsupported: "Twoja przeglądarka nie udostępnia lokalizacji.",
  "permission-denied": "Nie udzielono zgody na dostęp do lokalizacji.",
  "position-unavailable": "Nie udało się ustalić pozycji.",
  timeout: "Przekroczono czas oczekiwania na lokalizację.",
  unknown: "Nie udało się pobrać lokalizacji.",
};

type LocationStatus = "locating" | "error";

interface LocationStepProps {
  position: GpsPosition | null;
  address: string | null;
  onChange: (position: GpsPosition | null, address: string | null) => void;
}

/**
 * Location step (M10 -- real). On mount it requests the real device position
 * via `navigator.geolocation` (high accuracy + 10 s timeout) and reverse-
 * geocodes it. When a position is captured it renders the required two-column
 * screen — left: coordinates + address + accuracy, right: map + pin — and
 * lifts the position up so the wizard can gate "Dalej". On failure (denied /
 * unsupported / timeout) it offers a retry and a manual lat/lon entry, so the
 * flow still completes headless or without a GPS permission.
 */
function LocationStep({ position, address, onChange }: LocationStepProps) {
  const [status, setStatus] = useState<LocationStatus>("locating");
  const [errorCode, setErrorCode] = useState<GeolocationErrorCode>("unknown");
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [manualError, setManualError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // A position already captured (and lifted to the wizard) is reused when the
    // user comes back to this step — only a "Pobierz ponownie" (which clears
    // `position` to null) or a retry re-runs the geolocation request.
    if (position) {
      return;
    }
    let cancelled = false;
    setStatus("locating");
    void getCurrentPosition()
      .then(async (pos) => {
        const addr = await reverseGeocode({ lat: pos.lat, lon: pos.lon });
        if (cancelled) {
          return;
        }
        onChange(pos, addr);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setErrorCode(
          error instanceof GeolocationError ? error.code : "unknown"
        );
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // `onChange` is a stable wrapper over the wizard's setState calls; only the
    // position/attempt transitions matter for re-running the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, attempt]);

  const handleManual = useCallback(() => {
    const pos = parsePosition(manualLat, manualLon);
    if (!pos) {
      setManualError(true);
      return;
    }
    setManualError(false);
    onChange(pos, `Ręcznie podane: ${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}`);
  }, [manualLat, manualLon, onChange]);

  if (position) {
    return (
      <div className="location-step">
        <p className="wizard__hint">{STEP_HINT.location}</p>
        <div className="location-step__columns">
          <section
            className="location-step__details"
            aria-label="Współrzędne lokalizacji"
          >
            <dl className="location-step__fields">
              <div className="location-step__field">
                <dt>Szerokość</dt>
                <dd>{position.lat.toFixed(5)}</dd>
              </div>
              <div className="location-step__field">
                <dt>Długość</dt>
                <dd>{position.lon.toFixed(5)}</dd>
              </div>
              <div className="location-step__field">
                <dt>Dokładność</dt>
                <dd>
                  {position.accuracy === null
                    ? "nieznana"
                    : `${position.accuracy.toFixed(0)} m`}
                </dd>
              </div>
            </dl>
            <p className="location-step__address">
              <strong>Adres:</strong>{" "}
              {address?.trim() || "Nieznana lokalizacja"}
            </p>
          </section>
          <MapPin lat={position.lat} lon={position.lon} />
        </div>
        <p className="location-step__saved" role="status">
          Lokalizacja zapisana — przejdź dalej albo pobierz ją ponownie.
        </p>
      </div>
    );
  }

  return (
    <div className="location-step">
      <p className="wizard__hint">{STEP_HINT.location}</p>

      {status === "locating" && (
        <p className="location-step__state" role="status">
          Pobieram lokalizację GPS…
        </p>
      )}

      {status === "error" && (
        <div className="location-step__state location-step__state--error" role="alert">
          <p>{LOCATION_ERROR_HINT[errorCode]}</p>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      <form
        className="location-step__manual"
        onSubmit={(event) => {
          event.preventDefault();
          handleManual();
        }}
      >
        <p className="location-step__manual-title">
          Albo wpisz współrzędne ręcznie:
        </p>
        <label className="location-step__manual-field">
          Szerokość (lat)
          <input
            type="text"
            inputMode="decimal"
            value={manualLat}
            onChange={(event) => setManualLat(event.target.value)}
            placeholder="np. 52.2297"
          />
        </label>
        <label className="location-step__manual-field">
          Długość (lon)
          <input
            type="text"
            inputMode="decimal"
            value={manualLon}
            onChange={(event) => setManualLon(event.target.value)}
            placeholder="np. 21.0122"
          />
        </label>
        {manualError && (
          <p className="location-step__manual-error" role="alert">
            Podaj poprawne współrzędne (szerokość −90..90, długość −180..180).
          </p>
        )}
        <button type="submit" className="button button--primary">
          Użyj współrzędnych
        </button>
      </form>
    </div>
  );
}

interface DescriptionStepProps {
  description: string;
  hasImage: boolean;
  position: GpsPosition | null;
  onChange: (description: string) => void;
}

/**
 * Description step (M11 -- real). An editable textarea plus a "Generate"
 * button that fills it with the deterministic A.I.-style default built from the
 * captured photo/location metadata (`generateDescription`). The wizard gates
 * "Dalej" until the text is non-empty, so the user always has a description —
 * generated or hand-written — before continuing.
 */
function DescriptionStep({
  description,
  hasImage,
  position,
  onChange,
}: DescriptionStepProps) {
  const handleGenerate = useCallback(() => {
    onChange(
      generateDescription({
        hasImage,
        lat: position?.lat ?? null,
        lon: position?.lon ?? null,
      })
    );
  }, [hasImage, position, onChange]);

  return (
    <div className="description-step">
      <p className="wizard__hint">{STEP_HINT.description}</p>
      <label className="description-step__field">
        Opis zgłoszenia
        <textarea
          value={description}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Opisz, co się stało…"
          rows={5}
        />
      </label>
      <button
        type="button"
        className="button button--secondary description-step__generate"
        onClick={handleGenerate}
      >
        Generate
      </button>
    </div>
  );
}

/**
 * Report wizard. A step indicator drives the four-step flow
 * camera → location → description → review. The camera step (M9 -- real) uses
 * the real `getUserMedia` camera with a `MockCamera` fallback and pushes the
 * compressed full photo + thumbnail into the wizard state on capture. The
 * location step (M10 -- real) captures real GPS and renders the two-column
 * coordinates | map+pin screen. The description step (M11 -- real) offers an
 * editable textarea plus a "Generate" default and gates on non-empty text. The
 * review body is filled in by M12.
 */
export function NewReport() {
  const [stepIndex, setStepIndex] = useState(0);
  const [images, setImages] = useState<CapturedImages | null>(null);
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const total = STEPS.length;
  const current = STEPS[stepIndex];
  const isCameraStep = stepIndex === 0;
  const isLocationStep = stepIndex === 1;
  const isDescriptionStep = stepIndex === 2;

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);

  const handleCapture = useCallback((captured: CapturedImages) => {
    setImages(captured);
  }, []);

  const handleRetake = useCallback(() => {
    setImages(null);
  }, []);

  const handleLocationChange = useCallback(
    (pos: GpsPosition | null, addr: string | null) => {
      setPosition(pos);
      setAddress(addr);
    },
    []
  );

  const handleRelocate = useCallback(() => {
    setPosition(null);
    setAddress(null);
  }, []);

  const handleDescriptionChange = useCallback((value: string) => {
    setDescription(value);
  }, []);

  // Each step gates "Dalej" until its input is captured: photo → GPS →
  // non-empty description.
  const nextDisabled =
    (isCameraStep && images === null) ||
    (isLocationStep && position === null) ||
    (isDescriptionStep && description.trim() === "");

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
        ) : isLocationStep ? (
          <LocationStep
            position={position}
            address={address}
            onChange={handleLocationChange}
          />
        ) : isDescriptionStep ? (
          <DescriptionStep
            description={description}
            hasImage={images !== null}
            position={position}
            onChange={handleDescriptionChange}
          />
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

        {isLocationStep && (
          <button
            type="button"
            className="button button--secondary"
            disabled={position === null}
            onClick={handleRelocate}
          >
            Pobierz ponownie
          </button>
        )}

        {stepIndex < total - 1 && (
          <button
            type="button"
            className="button button--primary"
            disabled={nextDisabled}
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
