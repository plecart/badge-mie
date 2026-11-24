/**
 * Client de l'API, ses deux routes (ADR-0001, « Décision », point 6) : la lecture d'une semaine,
 * `GET /semaines/:lundi`, et l'écriture d'un jour, `PUT /jours/:date`.
 *
 * Pour chaque route, la requête et la lecture de la réponse sont des fonctions pures, testées ;
 * {@link readWeek} et {@link writeDay} ne sont que les adaptateurs minces qui les relient par
 * `fetch`, non testés, hormis le délai maximal des requêtes à l'API ({@link REQUEST_TIMEOUT_MS}),
 * testé sur la lecture d'une semaine et l'écriture d'un jour avec un `fetch` factice et des
 * minuteurs simulés (PRD #1, « Décisions de test »).
 */

import {
  emptyDay,
  isPresenceDay,
  type PresenceDay,
  weekDates,
} from "@badge-mie/week";
import { API_URL } from "./api-url";

/** Le serveur a refusé le jeton (HTTP 401) : il faut le ressaisir. */
export class TokenRejectedError extends Error {
  override name = "TokenRejectedError";
  constructor() {
    super("jeton refusé");
  }
}

/**
 * Le serveur n'a pas pu être joint, ou sa réponse n'est pas exploitable : réseau coupé, ou pas de
 * réponse dans le délai maximal ({@link REQUEST_TIMEOUT_MS}) ; pour la lecture d'une semaine,
 * statut HTTP autre que 2xx et 401, ou corps mal formé ; pour l'écriture d'un jour, statut hors
 * 2xx et 4xx (5xx, 1xx, 3xx). Pour l'utilisateur, c'est « Serveur injoignable ».
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
 * Il se classe en refus durable (décision 7 de #4) : un 4xx dit la faute dans la requête
 * (RFC 9110 §15.5), que l'idempotence du `PUT` rejouerait à l'identique. Deux 4xx sont pourtant
 * transitoires, 408 (RFC 9110 §15.5.9) et 429 (RFC 6585 §4) : la même requête rejouée plus tard
 * peut passer. Le classement ne change rien pour eux : l'entrée reste en file, jamais perdue, et
 * repart à la relance suivante.
 */
export class DayRejectedError extends Error {
  override name = "DayRejectedError";
  constructor() {
    super("journée refusée");
  }
}

/**
 * Le délai maximal d'une requête à l'API, en millisecondes : la lecture d'une semaine comme
 * l'écriture d'un jour, sans réponse dans ce délai, est abandonnée et lève
 * {@link ServerUnreachableError} (#14, décision du 2026-11-19). Sans lui, une lecture sans fin
 * laissait non pointable une semaine jamais lue, et un envoi sans fin tenait la relance de la File
 * d'envoi.
 */
export const REQUEST_TIMEOUT_MS = 10_000;

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
 * Envoie une requête par `fetch`, ses options complétées du signal d'`AbortSignal.timeout`, qui
 * l'abandonne au bout du délai maximal ({@link REQUEST_TIMEOUT_MS}). Un `fetch` qui échoue (réseau
 * coupé, délai dépassé) lève {@link ServerUnreachableError}, qui garde l'erreur d'origine en
 * `cause` ; toute réponse, quel que soit son statut, est rendue telle quelle.
 *
 * Dans l'application, `AbortSignal.timeout` vient du polyfill global de react-native 0.88.1
 * (`static timeout` de `src/private/webapis/dom/abort-api/AbortSignal.js`, posé par
 * `polyfillGlobal` de `Libraries/Core/setUpXHR.js`, lu le 2026-11-19), et `expo/fetch` écoute le
 * signal : à l'abandon, il abandonne la réponse et annule la requête native
 * (`addAbortSignalListener` de `expo/src/winter/fetch/fetch.ts`, expo 58.0.26, lu le 2026-11-19).
 */
function send({ url, init }: ApiRequest): Promise<Response> {
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal }).catch((cause: unknown) => {
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

/** Le nombre de journées de la semaine d'avant la PR #41, que tolère {@link parseWeek}. */
const FIVE_DAY_WEEK = 5;

/** Dit si une valeur est le tableau des journées de `dates`, dans l'ordre ({@link parseWeek}). */
function isWeekOf(value: unknown, dates: string[]): value is PresenceDay[] {
  return (
    Array.isArray(value) &&
    value.length === dates.length &&
    dates.every((date, index) => isPresenceDay(value[index], date))
  );
}

/**
 * Lit une valeur reçue ou relue comme la semaine attendue : le serveur l'envoie, l'état local la
 * garde, et aucune des deux sources n'est crue sur parole.
 *
 * La forme à cinq journées, du lundi au vendredi, est celle de l'état local rangé par la
 * version précédente de l'application, et de l'API d'avant la PR #41, encore en service tant que
 * la nouvelle n'est pas déployée : tolérée le temps de la mise en service, elle se lit complétée
 * du samedi et du dimanche vides, sans rien perdre.
 *
 * @param value - La valeur à lire, telle que `JSON.parse` l'a rendue.
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine demandée.
 * @returns Les sept journées de la semaine, pour un tableau de sept journées — ou de cinq, du
 *   lundi au vendredi — dont `jour` est, dans l'ordre, chaque date de cette semaine, et dont
 *   `arrivee` et `depart` sont une heure `HH:MM` ou `null` ; `null` pour toute autre valeur.
 * @throws {RangeError} si `monday` n'est pas un lundi réel : c'est une erreur de l'appelant.
 */
export function parseWeek(
  value: unknown,
  monday: string,
): PresenceDay[] | null {
  const dates = weekDates(monday);
  if (isWeekOf(value, dates)) return value;
  if (!isWeekOf(value, dates.slice(0, FIVE_DAY_WEEK))) return null;
  return [...value, ...dates.slice(FIVE_DAY_WEEK).map(emptyDay)];
}

/**
 * Lit la réponse à {@link weekRequest}. C'est une frontière de confiance : le corps est vérifié,
 * champ par champ, avant d'être rendu.
 *
 * @param status - Le statut HTTP de la réponse.
 * @param body - Le corps décodé en JSON, ou `undefined` s'il n'a pas pu l'être.
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine demandée.
 * @returns Les sept journées de la semaine, telles que le serveur les a rendues, complétées du
 *   samedi et du dimanche vides pour l'API d'avant la PR #41 (voir {@link parseWeek}).
 * @throws {TokenRejectedError} sur un 401, quel que soit le corps.
 * @throws {ServerUnreachableError} sur tout autre statut hors 2xx, ou sur un corps qui n'est pas
 *   la semaine demandée (voir {@link parseWeek}).
 * @throws {RangeError} sur un 2xx, si `monday` n'est pas un lundi réel : c'est une erreur de
 *   l'appelant.
 */
export function parseWeekResponse(
  status: number,
  body: unknown,
  monday: string,
): PresenceDay[] {
  if (status === 401) throw new TokenRejectedError();
  const week = isSuccess(status) ? parseWeek(body, monday) : null;
  if (week === null) throw new ServerUnreachableError();
  return week;
}

/**
 * Lit une semaine sur le serveur.
 *
 * @param token - Le jeton d'accès.
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine.
 * @returns Les sept journées de la semaine, du lundi au dimanche.
 * @throws {TokenRejectedError} si le serveur refuse le jeton.
 * @throws {ServerUnreachableError} si `fetch` échoue (réseau coupé), sans réponse dans le délai
 *   maximal ({@link REQUEST_TIMEOUT_MS}), ou pour toute autre réponse que
 *   {@link parseWeekResponse} refuse.
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
 *   qui n'est pas réelle, et accepte n'importe quel jour de la semaine.
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
 * @throws {DayRejectedError} sur tout autre 4xx, 408 et 429 compris : le refus classé durable.
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
 * Le corps de la réponse n'est pas lu. Sous Expo, le `fetch` global est `expo/fetch`
 * (`expo/src/winter/runtime.native.ts`, sauf `EXPO_PUBLIC_USE_RN_FETCH`), dont le module natif
 * Android lit le corps jusqu'au bout puis ferme la réponse, que JavaScript le lise ou non
 * (`onResponse` de `expo/android/src/main/java/expo/modules/fetch/NativeResponse.kt`, expo
 * 58.0.26, lu le 2026-11-19) : ne pas le lire ne retient pas la connexion.
 *
 * @param token - Le jeton d'accès.
 * @param day - La journée à écrire.
 * @throws {TokenRejectedError} si le serveur refuse le jeton.
 * @throws {DayRejectedError} si le serveur refuse la journée.
 * @throws {ServerUnreachableError} si `fetch` échoue (réseau coupé), sans réponse dans le délai
 *   maximal ({@link REQUEST_TIMEOUT_MS}), ou sur toute autre réponse que
 *   {@link parseDayResponse} refuse.
 */
export async function writeDay(token: string, day: PresenceDay): Promise<void> {
  parseDayResponse((await send(dayRequest(token, day))).status);
}
