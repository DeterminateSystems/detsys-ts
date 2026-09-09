import packageJson from "./package.json" with { type: "json" };
import { defineConfig } from "tsdown";

export default defineConfig({
  name: "detsys-ts",
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "esnext",
  sourcemap: true,
  dts: {
    resolve: false,
  },
  clean: true,

  // The library reports its own version as the OpenTelemetry instrumentation
  // scope version. `package.json` is the one place that holds it, and
  // `tsconfig.json` puts `rootDir` at `src`, thus `src` cannot import a file
  // above it. The build supplies the value instead.
  define: {
    __DETSYS_TS_VERSION__: JSON.stringify(packageJson.version),
  },
});
