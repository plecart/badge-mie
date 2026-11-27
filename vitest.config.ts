import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // `__DEV__`, global que le prélude du bundle React Native pose, n'existe pas sous Node. Vitest
  // assigne une clé sans point de `define` à `globalThis`, sans remplacement statique
  // (`deleteDefineConfig` et `setupDefines`, vitest 5.1.1, lus le 2026-11-27) : un test le change
  // encore par `vi.stubGlobal`. Vrai, comme dans le build de développement.
  define: { __DEV__: true },
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
