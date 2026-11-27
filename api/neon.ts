/**
 * Politique Neon de l'API : la Function `api`, lue par `neon deploy` au déploiement, jamais
 * importée par le code qui tourne.
 *
 * Déployer : la CI (`.github/workflows/deploiement.yml`) déploie sur la branche Neon `preprod`, la
 * pré-prod, à chaque push sur `main` dont la CI est verte, et sur la branche Neon `main`, la
 * production, à chaque tag `v*` posé sur un commit de `main` à la CI verte. À la main, en secours :
 * `npm run deploy -w api -- --branch preprod` (ou `--branch main`). Le script charge
 * `api/.env.local` (ignoré par git) avant d'évaluer ce fichier ; une variable déjà présente dans
 * l'environnement l'emporte sur le fichier.
 *
 * Le jeton n'est connu que de la Function et du téléphone (ADR-0001, « Décision », point 3) :
 * la CI ne l'a jamais. `JETON_API` absent ou vide, le déploiement garde la valeur déjà déployée
 * (`onUndefined: "skip"`, doc de `FunctionEnvVar` dans `@neon/config`) ; une Function déployée
 * sans jeton du tout refuse de démarrer (`src/index.ts`).
 *
 * Tourner le jeton : la pré-prod et la production partagent le même. Le changer dans
 * `api/.env.local`, redéployer à la main les deux branches Neon, puis le ressaisir dans
 * l'application.
 */

import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  functions: {
    api: {
      name: "Badge Mie API",
      source: "src/index.ts",
      env: {
        JETON_API: { value: process.env.JETON_API, required: false, onUndefined: "skip" },
      },
    },
  },
});
