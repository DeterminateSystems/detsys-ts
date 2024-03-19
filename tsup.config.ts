import { defineConfig } from "tsup";

export default defineConfig({
  name: "detsys-ts",
  entry: ["./src/main.ts"],
  outDir: "./dist",
  dts: true,
  minify: true,
  sourcemap: true,
});
