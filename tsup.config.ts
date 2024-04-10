import { defineConfig } from "tsup";

export default defineConfig({
  name: "detsys-ts",
  entry: ["./src/main.ts"],
  outDir: "./dist",
  dts: true,
  splitting: false,
  minify: true,
  sourcemap: true,
});
