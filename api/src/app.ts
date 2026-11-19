/**
 * L'application HTTP de Badge Mie (ADR-0001, « Décision », points 3 et 6). Elle ne lit ni
 * l'environnement ni l'horloge : ce dont elle dépend arrive en argument de {@link createApp}.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { isMonday, type PresenceDay, weekDates } from "@badge-mie/week";
import { Hono, type MiddlewareHandler } from "hono";

/** L'accès aux présences, injecté : l'application ne connaît pas la base. */
export interface PresenceRepository {
  /**
   * Rend les journées enregistrées entre deux dates `AAAA-MM-JJ`, bornes comprises ; un jour sans
   * ligne n'y figure pas.
   */
  readDays(from: string, to: string): Promise<PresenceDay[]>;
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
 * Crée l'application. La garde du jeton passe avant tout le reste, route inconnue comprise.
 *
 * `GET /semaines/:lundi` rend 400 si `:lundi` n'est pas un lundi `AAAA-MM-JJ` réel, et sinon les
 * 5 journées `{ jour, arrivee, depart }` de la semaine, du lundi au vendredi.
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

  return app;
}
