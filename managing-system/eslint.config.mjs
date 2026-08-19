import stylistic from "@stylistic/eslint-plugin";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/", "dist/", "coverage/", "data/", "src/generated/"],
  },
  tseslint.configs.recommended,
  {
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@stylistic/lines-between-class-members": [
        "error",
        "always",
        { exceptAfterSingleLine: false },
      ],
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "any", prev: ["const", "let", "var"], next: ["const", "let", "var"] },
        { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
        { blankLine: "always", prev: "*", next: "return" },
        { blankLine: "any", prev: "return", next: "return" },
        { blankLine: "always", prev: "block-like", next: "*" },
      ],
      curly: ["error", "all"],
      "prefer-const": "off",
    },
  },
);
