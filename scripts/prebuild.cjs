const fs = require("node:fs/promises");

const json = require("../package.json");
fs.writeFile(
  "./src/version.generated.ts",
  `export const version = "${json.version}";\n`,
);
