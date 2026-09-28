import { defineConfig } from "vite";

// un único módulo ES con Lit dentro, escrito en la integración (02 §3.1)
export default defineConfig({
  build: {
    target: "es2022",
    outDir: "../custom_components/irrigation_scheduler/frontend",
    emptyOutDir: true,
    lib: {
      entry: "src/main.ts",
      formats: ["es"],
      fileName: () => "irrigation-scheduler.js",
    },
  },
});
