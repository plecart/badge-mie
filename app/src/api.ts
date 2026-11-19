/**
 * Client de l'API, ses deux routes (ADR-0001, « Décision », point 6) : la lecture d'une semaine,
 * `GET /semaines/:lundi`, et l'écriture d'un jour, `PUT /jours/:date`.
 *
 * Pour chaque route, la requête et la lecture de la réponse sont des fonctions pures, testées ;
 * {@link readWeek} et {@link writeDay} ne sont que les adaptateurs minces qui les relient par
 * `fetch`, non testés (PRD #1, « Décisions de test »).
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
 * Le serveur n'a pas pu être joint, ou sa réponse n'est pas exploitable : réseau coupé ; pour la
 * lecture d'une semaine, statut HTTP autre que 2xx et 401, ou corps mal formé ; pour l'écriture
 * d'un jour, statut hors 2xx et 4xx (5xx, 1xx, 3xx). Pour l'utilisateur, c'est « Serveur
 * injoignable ».
 */
export class ServerUnreachableError extends Error {
  override name = "ServerUnreachableError";
  constructor(options?: ErrorOptions) {
    super("serveur injoignable", options);
  }
}

/**
 * Le serveur a refusé la journée : un statut 4xx autre que 401 en réponse à `PUT /jours/:date`.
 *
 * C'est un refus durable. La faute est dans la requête (RFC 9110 §15.5), que l'idempotence du
 * `PUT` rejouerait à l'identique : la rejouer ne la ferait pas passer. L'entrée reste pourtant en
 * file, jamais perdue (décision 7 de #4).
 */
export class DayRejectedError extends Error {
  override name = "DayRejectedError";
  constructor() {
    super("journée refusée");
  }
}

/** Une requête prête pour `fetch` : son URL et ses options. */
interface ApiRequest {
  url: string;
  init: RequestInit;
}

/** L'en-tête qui porte le jeton d'accès : `Authorization: Bearer <jeton>`. */
function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/** Vrai pour un statut HTTP de succès, 2xx. */
function isSuccess(status: number): boolean {
  return status >= 200 && status <= 299;
}

/**
 * Envoie une requête par `fetch`. Un `fetch` qui échoue (réseau coupé) lève
 * {@link ServerUnreachableError}, qui garde l'erreur d'origine en `cause` ; toute réponse, quel
 * que soit son statut, est rendue telle quelle.
 */
function send({ url, init }: ApiRequest): Promise<Response> {
  return fetch(url, init).catch((cause: unknown) => {
    throw new ServerUnreachableError({ cause });
  });
}

/**
 * Construit la requête de lecture d'une semaine.
 *
 * @param token - Le jeton d'accès, porté en en-tête `Authorization: Bearer`.
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine ; le serveur rend 400 pour un autre jour.
 * @returns L'URL et les options de `fetch` ; la méthode est `GET`, celle par défaut.
 */
export function weekRequest(token: string, monday: string): ApiRequest {
  return {
    url: `${API_URL}/semaines/${monday}`,
    init: { headers: bearer(token) },
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
  if (!isSuccess(status) || !isWeek(body, monday)) {
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
  const response = await send(weekRequest(token, monday));
  const body: unknown = await response.json().catch(() => undefined);
  return parseWeekResponse(response.status, body, monday);
}

/**
 * Construit la requête d'écriture d'un jour : `PUT /jours/:date`, qui crée ou remplace la
 * journée sur le serveur.
 *
 * @param token - Le jeton d'accès, porté en en-tête `Authorization: Bearer`.
 * @param day - La journée à écrire ; `day.jour` fait la route, le serveur rend 400 pour une date
 *   qui n'est pas réelle.
 * @returns L'URL et les options de `fetch` : la méthode `PUT`, le corps JSON
 *   `{ arrivee, depart }`, une heure non pointée écrite `null`, et son en-tête `Content-Type`.
 */
export function dayRequest(token: string, day: PresenceDay): ApiRequest {
  return {
    url: `${API_URL}/jours/${day.jour}`,
    init: {
      method: "PUT",
      headers: { ...bearer(token), "Content-Type": "application/json" },
      body: JSON.stringify({ arrivee: day.arrivee, depart: day.depart }),
    },
  };
}

/**
 * Lit la réponse à {@link dayRequest}. Seul le statut compte : le serveur répond 204 sans corps.
 *
 * @param status - Le statut HTTP de la réponse.
 * @throws {TokenRejectedError} sur un 401.
 * @throws {DayRejectedError} sur tout autre 4xx : le refus durable.
 * @throws {ServerUnreachableError} sur tout statut hors 2xx et 4xx : 5xx, 1xx, 3xx.
 */
export function parseDayResponse(status: number): void {
  if (isSuccess(status)) return;
  if (status === 401) throw new TokenRejectedError();
  if (status >= 400 && status <= 499) throw new DayRejectedError();
  throw new ServerUnreachableError();
}

/**
 * Écrit une journée sur le serveur.
 *
 * Le corps de la réponse n'est pas lu. Sous Expo, `fetch` est `expo/fetch`, dont le module natif
 * Android lit le corps jusqu'au bout puis ferme la réponse, que JavaScript le lise ou non : ne
 * pas le lire ne retient pas la connexion.
 *
 * @param token - Le jeton d'accès.
 * @param day - La journée à écrire.
 * @throws {TokenRejectedError} si le serveur refuse le jeton.
 * @throws {DayRejectedError} si le serveur refuse la journée.
 * @throws {ServerUnreachableError} si `fetch` échoue (réseau coupé), ou sur toute autre réponse
 *   que {@link parseDayResponse} refuse.
 */
export async function writeDay(token: string, day: PresenceDay): Promise<void> {
  parseDayResponse((await send(dayRequest(token, day))).status);
}
