import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
  server: {
    proxy: {
      // During `npm run dev`, forward API calls to the Express server.
      "/api": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  },
});
