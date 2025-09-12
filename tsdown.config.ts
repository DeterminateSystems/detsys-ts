import { defineConfig } from "tsdown";

export default defineConfig({
  name: "detsys-ts",
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  sourcemap: true,
  dts: {
    resolve: false,
  },
  clean: true,
});
