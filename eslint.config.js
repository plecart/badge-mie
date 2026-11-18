import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  // Harnais Claude Code : scripts vendus et worktrees des sessions parallèles.
  globalIgnores([".claude/"]),
  js.configs.recommended,
  tseslint.configs.recommended,
);
