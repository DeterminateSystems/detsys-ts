import gitHubPlugin from "eslint-plugin-github";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },

      ecmaVersion: 9,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2015,
      },
    },
  },
  {
    settings: {
      "import/resolver": {
        typescript: {},
      },
      "import/parsers": {
        "@typescript-eslint/parser": [".ts"],
      },
    },
  },
  gitHubPlugin.getFlatConfigs().recommended,
  {
    rules: {
      "@typescript-eslint/no-base-to-string": "error",
      camelcase: "error",
      "i18n-text/no-en": "off",
      "@typescript-eslint/no-shadow": "error",
      "eslint-comments/no-use": "off",
      "import/extensions": [
        "error",
        "ignorePackages",
        { json: "always", ts: "never" },
      ],
      "import/no-namespace": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        {
          accessibility: "no-public",
        },
      ],
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/array-type": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/consistent-type-assertions": "error",
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
        },
      ],
      "@typescript-eslint/no-array-constructor": "error",
      "@typescript-eslint/no-empty-interface": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-extraneous-class": "error",
      "@typescript-eslint/no-for-in-array": "error",
      "@typescript-eslint/no-inferrable-types": "error",
      "@typescript-eslint/no-misused-new": "error",
      "@typescript-eslint/no-namespace": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-unnecessary-qualifier": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-useless-constructor": "error",
      "@typescript-eslint/no-var-requires": "error",
      "@typescript-eslint/prefer-for-of": "warn",
      "@typescript-eslint/prefer-function-type": "warn",
      "@typescript-eslint/prefer-includes": "error",
      "@typescript-eslint/prefer-string-starts-ends-with": "error",
      "@typescript-eslint/promise-function-async": "error",
      "@typescript-eslint/require-array-sort-compare": "error",
      "@typescript-eslint/restrict-plus-operands": "error",
      "@typescript-eslint/unbound-method": "error",
    },
  },
);
