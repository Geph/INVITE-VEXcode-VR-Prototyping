import nextPlugin from "@next/eslint-plugin-next"
import tseslint from "typescript-eslint"

/**
 * Built from `@next/eslint-plugin-next` + `typescript-eslint` directly rather
 * than `eslint-config-next`, whose bundled React plugin does not support the
 * current ESLint major.
 */
export default [
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    rules: {
      // The Blockly bridge is an untyped runtime global; `any` is load-bearing.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]
