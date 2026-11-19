/**
 * Client de l'API : la lecture d'une semaine, `GET /semaines/:lundi` (ADR-0001, « Décision »,
 * point 6).
 *
 * La requête et la lecture de la réponse sont des fonctions pures, testées ; {@link readWeek} n'est
 * que l'adaptateur mince qui les relie par `fetch`, non testé (PRD #1, « Décisions de test »).
 */

import { isTime, type PresenceDay, weekDates } from "@badge-mie/week";
import { API_URL } from "./api-url";

/** Le serveur a refusé le jeton (HTTP 401) : il faut le ressaisir. */
export class TokenRejectedError extends Error {
  override name = "TokenRejectedError";
  constructor() {
    super("jeton refusé");
  }
}

/**
 * Le serveur n'a pas rendu de semaine lisible : réseau coupé, statut HTTP autre que 2xx et 401,
 * ou corps mal formé. Pour l'utilisateur, c'est « Serveur injoignable ».
 */
export class ServerUnreachableError extends Error {
  override name = "ServerUnreachableError";
  constructor(options?: ErrorOptions) {
    super("serveur injoignable", options);
  }
}

/**
 * Construit la requête de lecture d'une semaine.
 *
 * @param token - Le jeton d'accès, porté en en-tête `Authorization: Bearer`.
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine ; le serveur rend 400 pour un autre jour.
 * @returns L'URL et les options de `fetch` ; la méthode est `GET`, celle par défaut.
 */
export function weekRequest(
  token: string,
  monday: string,
): { url: string; init: RequestInit } {
  return {
    url: `${API_URL}/semaines/${monday}`,
    init: { headers: { Authorization: `Bearer ${token}` } },
  };
}

/** Vrai pour une heure `HH:MM` ou `null`. */
function isTimeOrNull(value: unknown): boolean {
  return value === null || (typeof value === "string" && isTime(value));
}

/**
 * Vrai pour un objet dont `jour` vaut `date`, et dont `arrivee` et `depart` sont une heure `HH:MM`
 * ou `null`.
 */
function isPresenceDay(value: unknown, date: string): value is PresenceDay {
  if (typeof value !== "object" || value === null) return false;
  const { jour, arrivee, depart } = value as Record<string, unknown>;
  return jour === date && isTimeOrNull(arrivee) && isTimeOrNull(depart);
}

/**
 * Dit si une valeur reçue ou relue est la semaine attendue : le serveur l'envoie, l'état local la
 * garde, et aucune des deux sources n'est crue sur parole.
 *
 * @param value - La valeur à vérifier, telle que `JSON.parse` l'a rendue.
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine demandée.
 * @returns `true` pour un tableau de cinq journées dont `jour` est, dans l'ordre, chaque date du
 *   lundi au vendredi de cette semaine, et dont `arrivee` et `depart` sont une heure `HH:MM` ou
 *   `null` ; `false` pour toute autre valeur.
 * @throws {RangeError} si `monday` n'est pas un lundi réel : c'est une erreur de l'appelant.
 */
export function isWeek(value: unknown, monday: string): value is PresenceDay[] {
  const dates = weekDates(monday);
  return (
    Array.isArray(value) &&
    value.length === dates.length &&
    dates.every((date, index) => isPresenceDay(value[index], date))
  );
}

/**
 * Lit la réponse à {@link weekRequest}. C'est une frontière de confiance : le corps est vérifié,
 * champ par champ, avant d'être rendu.
 *
 * @param status - Le statut HTTP de la réponse.
 * @param body - Le corps décodé en JSON, ou `undefined` s'il n'a pas pu l'être.
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine demandée.
 * @returns Les cinq journées de la semaine, telles que le serveur les a rendues.
 * @throws {TokenRejectedError} sur un 401, quel que soit le corps.
 * @throws {ServerUnreachableError} sur tout autre statut hors 2xx, ou sur un corps qui n'est pas
 *   la semaine demandée (voir {@link isWeek}).
 * @throws {RangeError} sur un 2xx, si `monday` n'est pas un lundi réel : c'est une erreur de
 *   l'appelant.
 */
export function parseWeekResponse(
  status: number,
  body: unknown,
  monday: string,
): PresenceDay[] {
  if (status === 401) throw new TokenRejectedError();
  if (status < 200 || status > 299 || !isWeek(body, monday)) {
    throw new ServerUnreachableError();
  }
  return body;
}

/**
 * Lit une semaine sur le serveur.
 *
 * @param token - Le jeton d'accès.
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine.
 * @returns Les cinq journées de la semaine, du lundi au vendredi.
 * @throws {TokenRejectedError} si le serveur refuse le jeton.
 * @throws {ServerUnreachableError} si `fetch` échoue (réseau coupé), ou pour toute autre réponse
 *   que {@link parseWeekResponse} refuse.
 * @throws {RangeError} si `monday` n'est pas un lundi réel et que le serveur rend pourtant un 2xx.
 *   Il rend 400 pour un autre jour, qui lève alors {@link ServerUnreachableError}.
 */
export async function readWeek(
  token: string,
  monday: string,
): Promise<PresenceDay[]> {
  const { url, init } = weekRequest(token, monday);
  const response = await fetch(url, init).catch((cause: unknown) => {
    throw new ServerUnreachableError({ cause });
  });
  const body: unknown = await response.json().catch(() => undefined);
  return parseWeekResponse(response.status, body, monday);
}
