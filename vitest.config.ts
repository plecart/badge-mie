import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    // `.claude/` héberge les worktrees des sessions parallèles : lancée depuis la copie
    // principale, la suite y ramasserait les tests des autres branches.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
});
