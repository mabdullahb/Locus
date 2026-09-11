import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([
    {
        // .cjs files under .claude/skills are standalone tooling scripts, not
        // part of the Next.js app. They are deliberately CommonJS (the .cjs
        // extension requires require()), so the TypeScript/ESM-oriented rules
        // below don't apply to them.
        ignores: [".claude/**"],
    },
    {
        extends: [...nextCoreWebVitals, ...nextTypescript, ...compat.extends("prettier")],
    },
]);