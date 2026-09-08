import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./app.tsx";

describe("app", () => {
  it("renders the capture screen without asking for device permissions", () => {
    render(<App />);
    expect(screen.getByText(/Kliknij, aby wysłać/i)).toBeTruthy();
  });
});
