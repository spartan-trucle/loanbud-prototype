import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Same aliases as vite.config.ts, so a module using "@/app/..." imports can be
  // imported from a test rather than only from the app.
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app": path.resolve(__dirname, "./src/app"),
      "@features": path.resolve(__dirname, "./src/app/components"),
      "@ui": path.resolve(__dirname, "./src/app/components/ui"),
      "@types": path.resolve(__dirname, "./src/app/types"),
      "@data": path.resolve(__dirname, "./src/app/data"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
