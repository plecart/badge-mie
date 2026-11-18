import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    // `.claude/` héberge les worktrees des sessions parallèles : lancée depuis la copie
    // principale, la suite y ramasserait les tests des autres branches.
    exclude: [...configDefaults.exclude, ".claude/**"],
    // Le fuseau de l'utilisateur (ADR-0001, « Décision », point 5), sur tout poste : en UTC,
    // celui de la CI, un calcul fait par erreur en heure locale passerait inaperçu.
    env: { TZ: "Europe/Paris" },
  },
});
