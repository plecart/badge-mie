/**
 * Entrée de la Neon Function `api` (déclarée dans `neon.ts`) : l'application, gardée par le jeton
 * `JETON_API` et branchée sur la base `DATABASE_URL`.
 */

import { createApp } from "./app";
import { createNeonRepository } from "./neon-repository";

/**
 * Lit une variable d'environnement obligatoire.
 *
 * @throws {Error} si elle est absente ou vide : la Function refuse alors de démarrer plutôt que
 *   de servir sans jeton ou sans base.
 */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`variable d'environnement manquante : ${name}`);
  }
  return value;
}

export default createApp({
  token: requiredEnv("JETON_API"),
  repository: createNeonRepository(requiredEnv("DATABASE_URL")),
});
