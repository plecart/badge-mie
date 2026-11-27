/**
 * Politique Neon de l'API : la Function `api`, lue par `neon deploy` au déploiement, jamais
 * importée par le code qui tourne.
 *
 * Déployer : la CI (`.github/workflows/deploiement.yml`) déploie sur la branche Neon `preprod`, la
 * pré-prod, à chaque push sur `main` dont la CI est verte, et sur la branche Neon `main`, la
 * production, à chaque tag `v*` posé sur un commit de `main` à la CI verte. À la main, en secours :
 * `npm run deploy -w api -- --branch preprod` (ou `--branch main`). Le script charge
 * `api/.env.local` (ignoré par git) avant d'évaluer ce fichier ; une variable déjà présente dans
 * l'environnement l'emporte sur le fichier — c'est ainsi que la CI passe le jeton. Un
 * `JETON_API` absent fait échouer le déploiement (`required: true`) ; un jeton vide est refusé
 * au démarrage de la Function (`src/index.ts`).
 *
 * Tourner le jeton : la pré-prod et la production partagent le même. Le changer dans le secret
 * `JETON_API` du dépôt — sinon le déploiement suivant de la CI remet l'ancien — et dans
 * `api/.env.local`, redéployer les deux branches Neon, puis le ressaisir dans l'application.
 */

import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  functions: {
    api: {
      name: "Badge Mie API",
      source: "src/index.ts",
      env: {
        JETON_API: { value: process.env.JETON_API, required: true },
      },
    },
  },
});
