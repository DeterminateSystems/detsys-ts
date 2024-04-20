import { defineConfig } from "tsup";

export default defineConfig({
  name: "detsys-ts",
  entry: ["src/index.ts"],
  format: ["cjs"],
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: {
    resolve: true,
  },
});
