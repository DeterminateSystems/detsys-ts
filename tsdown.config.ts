import { name } from "./package.json";
import { defineConfig } from "tsdown";

export default defineConfig({
  name,
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node24",
  sourcemap: true,
  dts: {
    resolve: false,
  },
  clean: true,
});
