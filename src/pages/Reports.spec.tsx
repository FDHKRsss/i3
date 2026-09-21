import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Reports } from "./Reports.tsx";

/**
 * M8 -- real reports shell. The milestone ships the list page with loading /
 * error / empty states plus a minimal non-empty scaffold; these tests drive
 * every state through a stubbed `fetch` so they are deterministic and never
 * touch the network.
 */

const mockFetch = vi.fn();

function jsonResponse<T>(data: T, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => data as unknown,
  } as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  cleanup();
  mockFetch.mockReset();
  vi.unstubAllGlobals();
});

describe("Reports page shell", () => {
  it("shows a loading state while the list is being fetched", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    mockFetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );

    render(<Reports />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/Ładowanie zgłoszeń/i)).toBeTruthy();

    resolveFetch(jsonResponse([]));
    await screen.findByText(/Nie ma jeszcze żadnych zgłoszeń/i);
  });

  it("shows an error state with a retry button when the response is not ok", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(null, false));

    render(<Reports />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Nie udało się pobrać zgłoszeń.");
    expect(
      screen.getByRole("button", { name: "Spróbuj ponownie" })
    ).toBeTruthy();
  });

  it("shows the error state when the fetch rejects", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));

    render(<Reports />);

    await screen.findByRole("alert");
    expect(
      screen.getByRole("button", { name: "Spróbuj ponownie" })
    ).toBeTruthy();
  });

  it("retries the fetch when 'Spróbuj ponownie' is clicked", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(null, false))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "r-1",
            description: "opis A",
            lat: null,
            lon: null,
            geo_desc: null,
          },
        ])
      );

    render(<Reports />);
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));

    await screen.findByText("opis A");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("shows an empty state linking to #/new when there are no reports", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    render(<Reports />);

    await screen.findByText(/Nie ma jeszcze żadnych zgłoszeń/i);
    const link = screen.getByRole("link", { name: "Dodaj pierwsze zgłoszenie" });
    expect(link.getAttribute("href")).toBe("#/new");
  });

  it("renders each report as a list item and links back home", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "r-1",
          description: "opis A",
          lat: null,
          lon: null,
          geo_desc: null,
        },
        {
          id: "r-2",
          description: "opis B",
          lat: null,
          lon: null,
          geo_desc: null,
        },
      ])
    );

    render(<Reports />);

    await screen.findByText("opis A");
    expect(screen.getByText("opis B")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Wróć" }).getAttribute("href")
    ).toBe("#/");
  });
});
