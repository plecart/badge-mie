/**
 * Le dépôt réel des présences : la table `presence` de la base Neon, lue et écrite par `pg`.
 *
 * Seule la réécriture de l'URL de connexion (`withVerifiedTls`) a un test unitaire : le reste est
 * une frontière tierce (Postgres), éprouvée contre Neon au déploiement de la Function.
 */

import type { PresenceDay } from "@badge-mie/week";
import { attachDatabasePool } from "@neon/functions";
import { Pool } from "pg";
import type { PresenceRepository } from "./app";

/**
 * Les journées d'une plage de dates, bornes comprises. Postgres rend la date et les heures en
 * texte par `to_char`, au format fixé ici quel que soit le `DateStyle` de la session : `pg`
 * lirait sinon une `date` en objet `Date` à minuit local, et une `time` avec ses secondes.
 */
const READ_DAYS = `
  select to_char(jour, 'YYYY-MM-DD') as jour,
         to_char(arrivee, 'HH24:MI') as arrivee,
         to_char(depart, 'HH24:MI') as depart
  from presence
  where jour between $1 and $2
  order by jour`;

/**
 * Crée ou remplace la ligne d'un jour, en une requête : sur un jour qui a déjà sa ligne,
 * `on conflict` remplace les deux heures et date la modification. `pg` envoie les paramètres sans
 * type (`pg-protocol` 1.16.1) et un `null` JavaScript en `NULL` (`prepareValue` de `pg` 8.23.1,
 * lu le 2026-11-19) : Postgres lit la date et les heures envoyées en texte (`AAAA-MM-JJ`, `HH:MM`)
 * d'après le type de leur colonne, comme les dates de `READ_DAYS` (non vérifié contre Neon pour
 * les heures). Le `check` de la table refuserait un départ qui ne suit pas l'arrivée : la route
 * l'a déjà écarté.
 */
const WRITE_DAY = `
  insert into presence (jour, arrivee, depart)
  values ($1, $2, $3)
  on conflict (jour) do update
    set arrivee = excluded.arrivee,
        depart = excluded.depart,
        modifie_le = now()`;

/**
 * Connexions au plus par pool. Chaque isolat de la Function crée le sien : la base en reçoit au
 * plus ce nombre fois les isolats vivants (doc Neon « Neon Functions runtime limits »).
 */
const MAX_CONNECTIONS = 5;

/**
 * Passe l'URL de connexion en `sslmode=verify-full`, quel que soit son mode (absent compris), et
 * garde le reste. `pg` 8 lit déjà `require` ainsi, mais avertit à la première connexion de chaque
 * processus que `pg` 9 lui rendra la sémantique libpq, sans vérifier le certificat (`pg` 8.23.1,
 * `pg-connection-string` 2.14.1, lus le 2026-11-19) : explicite, le mode ne dépend plus du client.
 *
 * @throws {Error} si l'URL est illisible, sans la recopier : elle porte le mot de passe.
 */
export function withVerifiedTls(connectionString: string): string {
  const url = URL.parse(connectionString);
  if (!url) throw new Error("URL de connexion illisible");
  url.searchParams.set("sslmode", "verify-full");
  return url.href;
}

/**
 * Crée le dépôt sur son propre pool `pg`, à appeler une fois par processus : les requêtes
 * partagent ensuite ce pool. `attachDatabasePool` écoute ses erreurs, sans quoi la coupure d'une
 * connexion inactive ferait tomber le processus (doc Neon « Get started with Neon Functions »).
 *
 * @param connectionString - L'URL de connexion poolée (`DATABASE_URL`, injectée par Neon).
 * @throws {Error} si l'URL est illisible (`withVerifiedTls`).
 */
export function createNeonRepository(
  connectionString: string,
): PresenceRepository {
  const url = withVerifiedTls(connectionString);
  const pool = new Pool({ connectionString: url, max: MAX_CONNECTIONS });
  attachDatabasePool(pool);
  return {
    async readDays(from, to) {
      const { rows } = await pool.query<PresenceDay>(READ_DAYS, [from, to]);
      return rows;
    },
    async writeDay({ jour, arrivee, depart }) {
      await pool.query(WRITE_DAY, [jour, arrivee, depart]);
    },
  };
}
