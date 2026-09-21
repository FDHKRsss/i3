import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NewReport } from "./NewReport.tsx";

/**
 * M8 -- real wizard shell + M9 -- stub camera step. The milestone ships the
 * step indicator, the back/next navigation, and the camera step that gates
 * progression until a placeholder photo is captured. These tests pin the
 * structure (4-step `<ol>`, `aria-current="step"` tracking), the navigation
 * behavior, and the camera-step capture/retake/gating contract — not exact
 * copy strings, so later milestones can change the copy freely.
 */

afterEach(cleanup);

/** The camera step's mock viewfinder renders a single `<canvas>`; clicking it
 * captures a placeholder photo + thumbnail and gates navigation. */
function capturePhoto(container: HTMLElement): void {
  const canvas = container.querySelector("canvas");
  if (!canvas) {
    throw new Error("expected the mock camera <canvas> to be rendered");
  }
  fireEvent.click(canvas);
}

describe("NewReport wizard shell", () => {
  it("renders the wizard heading and a 4-step ordered indicator", () => {
    render(<NewReport />);

    expect(
      screen.getByRole("heading", { name: "Nowe zgłoszenie" })
    ).toBeTruthy();

    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");

    const steps = within(list).getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(within(steps[0]).getByText("Aparat")).toBeTruthy();
    expect(within(steps[1]).getByText("Lokalizacja")).toBeTruthy();
    expect(within(steps[2]).getByText("Opis")).toBeTruthy();
    expect(within(steps[3]).getByText("Przegląd")).toBeTruthy();
  });

  it("marks only the first step as current and disables back on step 1", () => {
    render(<NewReport />);

    const steps = screen.getAllByRole("listitem");
    expect(steps[0].getAttribute("aria-current")).toBe("step");
    expect(steps[1].getAttribute("aria-current")).toBeNull();
    expect(steps[2].getAttribute("aria-current")).toBeNull();
    expect(steps[3].getAttribute("aria-current")).toBeNull();

    expect(
      screen.getByRole("button", { name: "Wstecz" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("advances through all four steps, moving aria-current and hiding next on the last step", () => {
    const { container } = render(<NewReport />);

    expect(
      screen.getByRole("heading", { name: "Krok 1 z 4: Aparat" })
    ).toBeTruthy();

    // M9: the camera step gates progression until a photo is captured.
    expect(
      screen.getByRole("button", { name: "Dalej" }).hasAttribute("disabled")
    ).toBe(true);
    capturePhoto(container);
    expect(
      screen.getByRole("button", { name: "Dalej" }).hasAttribute("disabled")
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Dalej" }));
    expect(
      screen.getByRole("heading", { name: "Krok 2 z 4: Lokalizacja" })
    ).toBeTruthy();

    let steps = screen.getAllByRole("listitem");
    expect(steps[1].getAttribute("aria-current")).toBe("step");
    expect(steps[0].getAttribute("aria-current")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Wstecz" }).hasAttribute("disabled")
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Dalej" }));
    fireEvent.click(screen.getByRole("button", { name: "Dalej" }));
    expect(
      screen.getByRole("heading", { name: "Krok 4 z 4: Przegląd" })
    ).toBeTruthy();

    steps = screen.getAllByRole("listitem");
    expect(steps[3].getAttribute("aria-current")).toBe("step");
    // On the final step there is no "next" button.
    expect(screen.queryByRole("button", { name: "Dalej" })).toBeNull();
  });

  it("moves back one step with 'Wstecz'", () => {
    const { container } = render(<NewReport />);

    capturePhoto(container);
    fireEvent.click(screen.getByRole("button", { name: "Dalej" }));
    expect(
      screen.getByRole("heading", { name: "Krok 2 z 4: Lokalizacja" })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Wstecz" }));
    expect(
      screen.getByRole("heading", { name: "Krok 1 z 4: Aparat" })
    ).toBeTruthy();
  });

  it("links 'Anuluj' back to the home route", () => {
    render(<NewReport />);

    expect(
      screen.getByRole("link", { name: "Anuluj" }).getAttribute("href")
    ).toBe("#/");
  });
});

describe("NewReport camera step (M9 -- stub)", () => {
  it("renders the mock viewfinder and gates 'Dalej'/'Zrób ponownie' until capture", () => {
    const { container } = render(<NewReport />);

    expect(container.querySelector("canvas")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Dalej" }).hasAttribute("disabled")
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Zrób ponownie" })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it("capturing swaps the viewfinder for a saved status and enables both actions", () => {
    const { container } = render(<NewReport />);

    capturePhoto(container);

    // The viewfinder is replaced by a success note, and the actions unlock.
    expect(container.querySelector("canvas")).toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(/zapisane/i);
    expect(
      screen.getByRole("button", { name: "Dalej" }).hasAttribute("disabled")
    ).toBe(false);
    expect(
      screen
        .getByRole("button", { name: "Zrób ponownie" })
        .hasAttribute("disabled")
    ).toBe(false);
  });

  it("'Zrób ponownie' returns to the viewfinder and gates progression again", () => {
    const { container } = render(<NewReport />);

    capturePhoto(container);
    fireEvent.click(screen.getByRole("button", { name: "Zrób ponownie" }));

    expect(container.querySelector("canvas")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Dalej" }).hasAttribute("disabled")
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Zrób ponownie" })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it("keeps the captured photo when navigating back from a later step", () => {
    const { container } = render(<NewReport />);

    capturePhoto(container);
    fireEvent.click(screen.getByRole("button", { name: "Dalej" }));
    expect(
      screen.getByRole("heading", { name: "Krok 2 z 4: Lokalizacja" })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Wstecz" }));
    expect(
      screen.getByRole("heading", { name: "Krok 1 z 4: Aparat" })
    ).toBeTruthy();
    // The captured state survives the round-trip: still "saved", still able to
    // continue without re-taking the photo.
    expect(container.querySelector("canvas")).toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(/zapisane/i);
    expect(
      screen.getByRole("button", { name: "Dalej" }).hasAttribute("disabled")
    ).toBe(false);
  });
});
