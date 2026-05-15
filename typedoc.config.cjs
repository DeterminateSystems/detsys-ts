/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
  entryPoints: ["./src/index.ts"],
  out: "docs",
  readme: "./DOCS.md",
  tsconfig: "./tsconfig.typedoc.json",
};
