import { useCallback, useEffect, useState } from "react";
import "../app.css";

type ReportSummary = {
  id: string;
  description: string | null;
  lat: number | null;
  lon: number | null;
  geo_desc: string | null;
};

type ReportsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; reports: ReportSummary[] };

/**
 * Reports page (M8 -- real shell). Fetches `GET /api/reports` and renders
 * loading / error / empty states. The full per-report row (photo thumbnail,
 * map thumbnail, coordinates, timestamp) is filled in by M13 -- real; this
 * milestone ships the shell so the page is a working list scaffold, not a
 * placeholder.
 */
export function Reports() {
  const [state, setState] = useState<ReportsState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/reports");
      if (!res.ok) {
        setState({ status: "error" });
        return;
      }
      const reports = (await res.json()) as ReportSummary[];
      setState({ status: "ready", reports });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page reports">
      <header className="reports__header">
        <h1>Zgłoszenia</h1>
        <p className="reports__subtitle">
          Wszystkie zgłoszenia zapisane w bazie.
        </p>
      </header>

      {state.status === "loading" && (
        <p className="reports__state" role="status">
          Ładowanie zgłoszeń…
        </p>
      )}

      {state.status === "error" && (
        <div className="reports__state reports__state--error" role="alert">
          <p>Nie udało się pobrać zgłoszeń.</p>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => void load()}
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      {state.status === "ready" && state.reports.length === 0 && (
        <div className="reports__state reports__state--empty">
          <p>Nie ma jeszcze żadnych zgłoszeń.</p>
          <a className="button button--primary" href="#/new">
            Dodaj pierwsze zgłoszenie
          </a>
        </div>
      )}

      {state.status === "ready" && state.reports.length > 0 && (
        <ul className="reports__list">
          {state.reports.map((report) => (
            <li key={report.id} className="reports__item">
              <span className="reports__item-description">
                {report.description?.trim() || "Brak opisu"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <a className="button button--secondary" href="#/">
        Wróć
      </a>
    </main>
  );
}
