/**
 * L'application HTTP de Badge Mie (ADR-0001, « Décision », points 3 et 6). Elle ne lit ni
 * l'environnement ni l'horloge : ce dont elle dépend arrive en argument de {@link createApp}.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import {
  departureFollowsArrival,
  isIsoDate,
  isMonday,
  isTimeOrNull,
  isWorkday,
  type PresenceDay,
  weekDates,
} from "@badge-mie/week";
import { Hono, type MiddlewareHandler } from "hono";

/** L'accès aux présences, injecté : l'application ne connaît pas la base. */
export interface PresenceRepository {
  /**
   * Rend les journées enregistrées entre deux dates `AAAA-MM-JJ`, bornes comprises ; un jour sans
   * ligne n'y figure pas.
   */
  readDays(from: string, to: string): Promise<PresenceDay[]>;
  /**
   * Crée ou remplace la ligne du jour `day.jour` par les heures de `day` : rejouée, l'écriture
   * laisse le même état. Deux heures `null` laissent une ligne aux heures nulles, que la lecture
   * rend telle quelle.
   *
   * Précondition : `day` a passé les contrôles de `PUT /jours/:date` (voir {@link createApp}).
   */
  writeDay(day: PresenceDay): Promise<void>;
}

/** Empreinte SHA-256 : deux textes de longueurs quelconques se comparent à longueur égale. */
function sha256(text: string): Buffer {
  return createHash("sha256").update(text).digest();
}

/**
 * Garde du jeton : un en-tête `Authorization` qui n'est pas exactement `Bearer <token>` rend 401,
 * qu'il manque, porte un autre schéma, une autre valeur ou une autre forme. Les deux en-têtes se
 * comparent en temps constant, par leurs empreintes SHA-256.
 *
 * @param token - Le jeton fixe attendu.
 */
function requireToken(token: string): MiddlewareHandler {
  const expected = sha256(`Bearer ${token}`);
  return async (c, next) => {
    const received = sha256(c.req.header("Authorization") ?? "");
    if (!timingSafeEqual(received, expected)) {
      return c.text("Unauthorized", 401, { "WWW-Authenticate": "Bearer" });
    }
    await next();
  };
}

/**
 * Rend les journées d'une semaine du lundi au vendredi, une par jour : le dépôt ne rend que les
 * jours qui ont une ligne, les autres prennent des heures `null`.
 */
async function readWeek(
  repository: PresenceRepository,
  monday: string,
): Promise<PresenceDay[]> {
  const dates = weekDates(monday);
  const days = await repository.readDays(monday, dates.at(-1)!);
  const byDate = new Map(days.map((day) => [day.jour, day]));
  return dates.map((jour) => ({
    jour,
    arrivee: byDate.get(jour)?.arrivee ?? null,
    depart: byDate.get(jour)?.depart ?? null,
  }));
}

/**
 * Lit les deux heures du corps d'un `PUT /jours/:date`.
 *
 * Les clés en plus s'ignorent. Une clé absente se lit `undefined`, qui n'est ni `null` ni une
 * heure : elle est refusée comme une heure invalide. L'ordre des deux heures n'est pas vérifié ici.
 *
 * @param text - Le corps brut de la requête.
 * @returns `{ arrivee, depart }`, ou `undefined` si le texte n'est pas du JSON, n'est pas un
 *   objet, ou si l'une des deux clés manque ou ne vaut ni `null` ni une heure `HH:MM`.
 */
function parseHours(
  text: string,
): Pick<PresenceDay, "arrivee" | "depart"> | undefined {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof body !== "object" || body === null) return undefined;
  const { arrivee, depart } = body as Record<string, unknown>;
  return isTimeOrNull(arrivee) && isTimeOrNull(depart)
    ? { arrivee, depart }
    : undefined;
}

/**
 * Crée l'application. La garde du jeton passe avant tout le reste, route inconnue comprise.
 *
 * `GET /semaines/:lundi` rend 400 si `:lundi` n'est pas un lundi `AAAA-MM-JJ` réel, et sinon les
 * 5 journées `{ jour, arrivee, depart }` de la semaine, du lundi au vendredi.
 *
 * `PUT /jours/:date` crée ou remplace la journée `:date` par les heures `{ arrivee, depart }` de
 * son corps JSON, et rend 204 sans corps ; rejoué, il laisse le même état (ADR-0001,
 * « Décision », point 4). Il rend 400 sans rien écrire si `:date` n'est pas une date
 * `AAAA-MM-JJ` réelle ou tombe un samedi ou un dimanche ({@link isWorkday}), deux contrôles faits
 * avant de lire le corps ; si le corps n'est pas un objet JSON dont les clés `arrivee` et `depart`
 * valent chacune `null` ou une heure `HH:MM` (les autres clés s'ignorent) ; ou si le départ ne
 * suit pas l'arrivée ({@link departureFollowsArrival}). Un départ sans arrivée est admis, comme
 * par la table `presence`. Une date future n'est pas contrôlée : l'API ne lit pas l'horloge,
 * et l'heure du téléphone fait foi, corrigeable à la main (PRD #1, « Hors périmètre », horloge
 * serveur de référence).
 *
 * @param options.token - Le jeton fixe attendu.
 * @param options.repository - Le dépôt des présences.
 */
export function createApp({
  token,
  repository,
}: {
  token: string;
  repository: PresenceRepository;
}): Hono {
  const app = new Hono();
  app.use(requireToken(token));

  app.get("/semaines/:lundi", async (c) => {
    const monday = c.req.param("lundi");
    if (!isMonday(monday)) {
      return c.text("lundi invalide : attendu un lundi AAAA-MM-JJ", 400);
    }
    return c.json(await readWeek(repository, monday));
  });

  app.put("/jours/:date", async (c) => {
    const jour = c.req.param("date");
    if (!isIsoDate(jour)) {
      return c.text("date invalide : attendu une date AAAA-MM-JJ", 400);
    }
    if (!isWorkday(jour)) {
      return c.text(
        "date invalide : attendu un jour du lundi au vendredi",
        400,
      );
    }
    const hours = parseHours(await c.req.text());
    if (!hours) {
      return c.text(
        "corps invalide : attendu { arrivee, depart }, chaque heure HH:MM ou null",
        400,
      );
    }
    if (!departureFollowsArrival(hours.arrivee, hours.depart)) {
      return c.text("départ invalide : attendu un départ après l'arrivée", 400);
    }
    await repository.writeDay({ jour, ...hours });
    return c.body(null, 204);
  });

  return app;
}
