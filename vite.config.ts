import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

function figmaAssetResolver() {
  return {
    name: "figma-asset-resolver",
    resolveId(id: string) {
      if (id.startsWith("figma:asset/")) {
        const filename = id.replace("figma:asset/", "");
        return path.resolve(__dirname, "src/assets", filename);
      }
    },
  };
}

export default defineConfig({
  // Served at the domain root in every environment (dev, Pages, Vercel).
  base: "/",
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
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

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ["**/*.svg", "**/*.csv"],
  appType: "spa",

  build: {
    rollupOptions: {
      output: {
        // React and the router change far less often than app code, so keeping them
        // in their own chunk lets browsers reuse it across deploys.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router"],
        },
      },
    },
  },
});
