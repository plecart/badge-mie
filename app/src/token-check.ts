/**
 * Le geste « Valider » de l'écran du jeton : le jeton saisi n'est enregistré qu'une fois reconnu
 * par le serveur (issue #3, critères « App (lot 2) »).
 */

import type { PresenceDay } from "@badge-mie/week";
import { ServerUnreachableError, TokenRejectedError } from "./api";

/** L'issue de la vérification : « Jeton refusé » et « Serveur injoignable » pour l'écran. */
export type TokenCheckOutcome = "accepted" | "rejected" | "unreachable";

/**
 * Vérifie un jeton saisi en lisant une semaine avec lui.
 *
 * Si la lecture réussit, le jeton est enregistré, puis la semaine lue l'est dans l'état local :
 * l'écran de la semaine s'ouvre ensuite sur ses journées, sans attendre le serveur. Sinon, rien
 * n'est enregistré.
 *
 * @param token - Le jeton saisi.
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine en cours.
 * @param dependencies.read - La lecture d'une semaine sur le serveur avec un jeton donné.
 * @param dependencies.saveToken - L'enregistrement du jeton dans le coffre.
 * @param dependencies.saveWeek - L'enregistrement d'une semaine dans l'état local.
 * @returns `"accepted"` si le serveur a rendu la semaine, `"rejected"` s'il a refusé le jeton,
 *   `"unreachable"` s'il est injoignable.
 * @throws Toute autre erreur de `read`, ou d'un enregistrement, telle quelle.
 */
export async function checkToken(
  token: string,
  monday: string,
  {
    read,
    saveToken,
    saveWeek,
  }: {
    read: (token: string, monday: string) => Promise<PresenceDay[]>;
    saveToken: (token: string) => Promise<void>;
    saveWeek: (monday: string, days: PresenceDay[]) => Promise<void>;
  },
): Promise<TokenCheckOutcome> {
  let days: PresenceDay[];
  try {
    days = await read(token, monday);
  } catch (error) {
    if (error instanceof TokenRejectedError) return "rejected";
    if (error instanceof ServerUnreachableError) return "unreachable";
    throw error;
  }
  await saveToken(token);
  await saveWeek(monday, days);
  return "accepted";
}
