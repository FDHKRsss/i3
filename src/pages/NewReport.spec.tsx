import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NewReport } from "./NewReport.tsx";

/**
 * M8 -- real wizard shell. The milestone ships the step indicator and the
 * back/next navigation; these tests pin the structure (4-step `<ol>`,
 * `aria-current="step"` tracking) and the navigation behavior, which are the
 * wizard's actual contract for the later camera/location/description/review
 * milestones to fill in.
 */

afterEach(cleanup);

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
    render(<NewReport />);

    expect(
      screen.getByRole("heading", { name: "Krok 1 z 4: Aparat" })
    ).toBeTruthy();

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
    render(<NewReport />);

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
