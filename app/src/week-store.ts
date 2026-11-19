/**
 * L'état local des semaines lues : la dernière réponse du serveur pour chaque semaine, gardée
 * sur le téléphone pour s'afficher avant la réponse suivante, ou à sa place sans réseau (PRD #1,
 * « Interactions », « Lecture d'une semaine »).
 *
 * Le stockage est injecté : `@react-native-async-storage/async-storage` dans l'application, un
 * stockage en mémoire dans les tests.
 */

import type { PresenceDay } from "@badge-mie/week";
import { isWeek, ServerUnreachableError } from "./api";

/** Un stockage clé-valeur de textes, de la forme d'`AsyncStorage`. */
export interface KeyValueStorage {
  /** Rend le texte rangé sous `key`, ou `null` s'il n'y en a pas. */
  getItem(key: string): Promise<string | null>;
  /** Range `value` sous `key`, en remplaçant le texte précédent. */
  setItem(key: string, value: string): Promise<void>;
}

/** Ce que l'écran affiche d'une semaine. */
export interface WeekView {
  /** Les journées de la semaine, ou `null` tant qu'aucune n'est connue. */
  days: PresenceDay[] | null;
  /** Vrai quand le serveur est injoignable et qu'aucun état local ne le remplace. */
  unreachable: boolean;
}

/** La clé de stockage d'une semaine : une par lundi. */
function keyOf(monday: string): string {
  return `semaine:${monday}`;
}

/**
 * Enregistre les journées d'une semaine dans l'état local, en remplaçant les précédentes.
 *
 * @param storage - Le stockage clé-valeur.
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine.
 * @param days - Les journées, telles que le serveur les a rendues.
 */
export async function saveWeek(
  storage: KeyValueStorage,
  monday: string,
  days: PresenceDay[],
): Promise<void> {
  await storage.setItem(keyOf(monday), JSON.stringify(days));
}

/**
 * Lit une semaine dans l'état local.
 *
 * @returns Les journées enregistrées, ou `null` s'il n'y en a pas, si le texte rangé n'est pas
 *   du JSON, ou si ce JSON n'est pas la semaine de `monday` (voir {@link isWeek}) : un état local
 *   illisible ou de forme inattendue compte comme absent.
 */
async function readLocalWeek(
  storage: KeyValueStorage,
  monday: string,
): Promise<PresenceDay[] | null> {
  const text = await storage.getItem(keyOf(monday));
  if (text === null) return null;
  let days: unknown;
  try {
    days = JSON.parse(text);
  } catch {
    return null;
  }
  return isWeek(days, monday) ? days : null;
}

/**
 * Charge une semaine pour l'écran : l'état local d'abord, puis la réponse du serveur.
 *
 * `show` est appelé deux fois. La première avec l'état local (`days: null` s'il n'y en a pas). La
 * seconde avec la réponse du serveur, enregistrée ensuite dans l'état local ; ou, si le serveur
 * est injoignable, de nouveau avec l'état local, laissé intact, et `unreachable` vrai s'il n'y en
 * a pas. Le second appel peut arriver après que l'écran est passé à une autre semaine : à
 * l'appelant d'ignorer une vue qui ne correspond plus à la semaine affichée.
 *
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine.
 * @param dependencies.storage - Le stockage de l'état local.
 * @param dependencies.read - La lecture de la semaine sur le serveur, jeton compris.
 * @param show - Affiche une vue de la semaine.
 * @throws {TokenRejectedError} si le serveur refuse le jeton ; l'état local n'est pas touché.
 *   Toute autre erreur que {@link ServerUnreachableError} remonte de même, y compris un échec de
 *   l'enregistrement, qui arrive après l'affichage de la réponse.
 */
export async function loadWeek(
  monday: string,
  {
    storage,
    read,
  }: {
    storage: KeyValueStorage;
    read: (monday: string) => Promise<PresenceDay[]>;
  },
  show: (view: WeekView) => void,
): Promise<void> {
  const local = await readLocalWeek(storage, monday);
  show({ days: local, unreachable: false });
  let days: PresenceDay[];
  try {
    days = await read(monday);
  } catch (error) {
    if (!(error instanceof ServerUnreachableError)) throw error;
    show({ days: local, unreachable: local === null });
    return;
  }
  show({ days, unreachable: false });
  await saveWeek(storage, monday, days);
}
