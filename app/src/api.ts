/**
 * Client de l'API : la lecture d'une semaine, `GET /semaines/:lundi` (ADR-0001, « Décision »,
 * point 6).
 *
 * La requête et la lecture de la réponse sont des fonctions pures, testées ; {@link readWeek} n'est
 * que l'adaptateur mince qui les relie par `fetch`, non testé (PRD #1, « Décisions de test »).
 */

import { type PresenceDay, WORKDAYS } from "@badge-mie/week";
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

/** Vrai pour une heure en texte ou `null` ; le format `HH:MM` n'est pas vérifié. */
function isTextOrNull(value: unknown): boolean {
  return value === null || typeof value === "string";
}

/** Vrai pour un objet dont `jour` est un texte, et `arrivee` et `depart` un texte ou `null`. */
function isPresenceDay(value: unknown): value is PresenceDay {
  if (typeof value !== "object" || value === null) return false;
  const { jour, arrivee, depart } = value as Record<string, unknown>;
  return (
    typeof jour === "string" && isTextOrNull(arrivee) && isTextOrNull(depart)
  );
}

/** Vrai pour un tableau de cinq journées bien formées. */
function isWeek(body: unknown): body is PresenceDay[] {
  return (
    Array.isArray(body) && body.length === WORKDAYS && body.every(isPresenceDay)
  );
}

/**
 * Lit la réponse à {@link weekRequest}. C'est une frontière de confiance : le corps est vérifié,
 * champ par champ, avant d'être rendu.
 *
 * @param status - Le statut HTTP de la réponse.
 * @param body - Le corps décodé en JSON, ou `undefined` s'il n'a pas pu l'être.
 * @returns Les cinq journées de la semaine, telles que le serveur les a rendues.
 * @throws {TokenRejectedError} sur un 401, quel que soit le corps.
 * @throws {ServerUnreachableError} sur tout autre statut hors 2xx, ou sur un corps qui n'est pas
 *   un tableau de cinq journées dont `jour` est un texte, et `arrivee` et `depart` un texte ou
 *   `null`.
 */
export function parseWeekResponse(
  status: number,
  body: unknown,
): PresenceDay[] {
  if (status === 401) throw new TokenRejectedError();
  if (status < 200 || status > 299 || !isWeek(body)) {
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
  return parseWeekResponse(response.status, body);
}
