
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // Only include componentTagger in development mode if it's available
    mode === 'development' && 
    (() => {
      try {
        return require("lovable-tagger").componentTagger();
      } catch (error) {
        // If lovable-tagger is not available, return null
        console.warn("lovable-tagger not found, skipping...");
        return null;
      }
    })(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Make sure the build is in the right place for Electron
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Set base to ./ for proper asset loading in Electron
    base: "./",
    // Ensure that sourcemaps are generated
    sourcemap: true,
  }
}));
