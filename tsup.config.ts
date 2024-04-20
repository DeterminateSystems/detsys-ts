import { defineConfig } from "tsup";

defineConfig({
  outDir: "dist",
  splitting: false,
  format: ["esm", "cjs"],
  clean: true,
  bundle: false,
});
