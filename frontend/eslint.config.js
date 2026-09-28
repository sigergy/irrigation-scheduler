import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import lit from "eslint-plugin-lit";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  { ignores: ["node_modules/"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  lit.configs["flat/recommended"],
  { languageOptions: { globals: globals.browser } },
]);
