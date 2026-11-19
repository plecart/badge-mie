/**
 * Le geste « Valider » de l'écran du jeton : le jeton saisi n'est enregistré qu'une fois reconnu
 * par le serveur (issue #3, critères « App (lot 2) »).
 */

import type { PresenceDay } from "@badge-mie/week";
import { TokenRejectedError } from "./api";

/** L'issue de la vérification : « Jeton refusé » et « Serveur injoignable » pour l'écran. */
export type TokenCheckOutcome = "accepted" | "rejected" | "unreachable";

/**
 * Vérifie un jeton saisi en lisant une semaine avec lui.
 *
 * Si la lecture réussit, la semaine lue est enregistrée dans l'état local, puis le jeton : l'écran
 * de la semaine s'ouvre ensuite sur ses journées, sans attendre le serveur, et un échec du premier
 * enregistrement ne laisse pas dans le coffre un jeton que l'écran n'a pas accepté. Sinon, rien
 * n'est enregistré.
 *
 * Toute panne autre qu'un jeton refusé — réseau, réponse illisible, enregistrement qui échoue —
 * se dit « Serveur injoignable » : la vérification ne rejette jamais.
 *
 * @param token - Le jeton saisi.
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine en cours.
 * @param dependencies.read - La lecture d'une semaine sur le serveur avec un jeton donné.
 * @param dependencies.saveToken - L'enregistrement du jeton dans le coffre.
 * @param dependencies.saveWeek - L'enregistrement d'une semaine dans l'état local.
 * @returns `"accepted"` si le serveur a rendu la semaine et que les deux enregistrements ont
 *   réussi, `"rejected"` s'il a refusé le jeton, `"unreachable"` pour toute autre issue.
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
  try {
    await saveWeek(monday, await read(token, monday));
    await saveToken(token);
    return "accepted";
  } catch (error) {
    return error instanceof TokenRejectedError ? "rejected" : "unreachable";
  }
}
