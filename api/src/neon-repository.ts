/**
 * Le dépôt réel des présences : la table `presence` de la base Neon, lue par `pg`.
 *
 * Aucun test unitaire : c'est une frontière tierce (Postgres), éprouvée contre Neon au
 * déploiement de la Function.
 */

import { attachDatabasePool } from "@neon/functions";
import { Pool } from "pg";
import type { PresenceDay, PresenceRepository } from "./app";

/**
 * Les journées d'une plage de dates, bornes comprises. Postgres rend la date et les heures en
 * texte : `pg` lirait sinon une `date` en objet `Date` à minuit local, et une `time` avec ses
 * secondes.
 */
const READ_DAYS = `
  select jour::text as jour,
         to_char(arrivee, 'HH24:MI') as arrivee,
         to_char(depart, 'HH24:MI') as depart
  from presence
  where jour between $1 and $2
  order by jour`;

/**
 * Connexions au plus par pool. Chaque isolat de la Function crée le sien : la base en reçoit au
 * plus ce nombre fois les isolats vivants (doc Neon « Neon Functions runtime limits »).
 */
const MAX_CONNECTIONS = 5;

/**
 * Crée le dépôt sur son propre pool `pg`, à appeler une fois par processus : les requêtes
 * partagent ensuite ce pool. `attachDatabasePool` écoute ses erreurs, sans quoi la coupure d'une
 * connexion inactive ferait tomber le processus (doc Neon « Get started with Neon Functions »).
 *
 * @param connectionString - L'URL de connexion poolée (`DATABASE_URL`, injectée par Neon).
 */
export function createNeonRepository(
  connectionString: string,
): PresenceRepository {
  const pool = new Pool({ connectionString, max: MAX_CONNECTIONS });
  attachDatabasePool(pool);
  return {
    async readDays(from, to) {
      const { rows } = await pool.query<PresenceDay>(READ_DAYS, [from, to]);
      return rows;
    },
  };
}
