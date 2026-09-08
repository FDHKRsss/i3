export interface GpsPosition {
  lat: number;
  lon: number;
}

/**
 * Mock GPS: a fixed default with no browser permission prompt.
 *
 * Swap this one module for a real geolocation implementation later; the rest
 * of the app only depends on the returned `{ lat, lon }` shape.
 */
export function getMockPosition(): GpsPosition {
  // Warsaw — chosen as a deterministic, non-sensitive default.
  return { lat: 52.2297, lon: 21.0122 };
}
