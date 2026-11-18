import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    // `.claude/` héberge les worktrees des sessions parallèles : lancée depuis la copie
    // principale, la suite y ramasserait les tests des autres branches.
    exclude: [...configDefaults.exclude, ".claude/**"],
    // Un fuseau en retard sur UTC et sans heure d'été (UTC−10 toute l'année), sur tout poste :
    // minuit UTC y tombe la veille à 14 h, si bien qu'une méthode locale (`getDay`,
    // `setFullYear`…) prise pour sa jumelle UTC change la date et fait rougir la suite. En UTC ou
    // à Paris, minuit UTC tombe le jour même et l'erreur passerait inaperçue.
    env: { TZ: "Pacific/Honolulu" },
  },
});
