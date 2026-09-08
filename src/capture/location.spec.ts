import { describe, expect, it } from "vitest";
import { getMockPosition } from "./location.ts";

describe("getMockPosition (mock GPS)", () => {
  it("returns the deterministic Warsaw default with valid ranges", () => {
    const pos = getMockPosition();
    expect(pos).toEqual({ lat: 52.2297, lon: 21.0122 });
    expect(pos.lat).toBeGreaterThanOrEqual(-90);
    expect(pos.lat).toBeLessThanOrEqual(90);
    expect(pos.lon).toBeGreaterThanOrEqual(-180);
    expect(pos.lon).toBeLessThanOrEqual(180);
  });
});
