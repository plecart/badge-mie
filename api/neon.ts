/**
 * Politique Neon de l'API : la Function `api`, lue par `neon deploy` au déploiement, jamais
 * importée par le code qui tourne.
 *
 * Déployer : `npm run deploy -w api -- --branch main`. Le script charge `api/.env.local` (ignoré par git) avant
 * d'évaluer ce fichier ; une variable déjà présente dans l'environnement du terminal l'emporte
 * sur le fichier. Un `JETON_API` absent fait échouer le déploiement (`required: true`) ; un
 * jeton vide est refusé au démarrage de la Function (`src/index.ts`).
 *
 * Tourner le jeton : changer `JETON_API` dans `api/.env.local`, redéployer, puis le ressaisir
 * dans l'application.
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
