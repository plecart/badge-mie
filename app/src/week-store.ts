/**
 * L'état local des semaines lues : la dernière réponse du serveur pour chaque semaine, gardée
 * sur le téléphone pour s'afficher avant la réponse suivante, ou à sa place sans réseau (PRD #1,
 * « Interactions », « Lecture d'une semaine »).
 *
 * Le stockage est injecté : `@react-native-async-storage/async-storage` dans l'application, un
 * stockage en mémoire dans les tests.
 */

import type { PresenceDay } from "@badge-mie/week";
import { isWeek, ServerUnreachableError, TokenRejectedError } from "./api";

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
 * `show` est d'abord appelé avec l'état local (`days: null` s'il n'y en a pas), puis avec la
 * réponse du serveur, enregistrée ensuite dans l'état local. Si le serveur est injoignable
 * ({@link ServerUnreachableError}), le second appel reprend l'état local, laissé intact, avec
 * `unreachable` vrai s'il n'y en a pas. Toute autre panne — un état local qui ne se lit ni ne
 * s'écrit, une lecture qui échoue autrement — se dit comme un serveur injoignable : un dernier
 * appel garde les journées déjà affichées par ce chargement (`null` si l'état local ne s'est pas
 * lu, et c'est alors le seul appel), avec `unreachable` vrai.
 *
 * Chaque appel peut arriver après que l'écran est passé à une autre semaine : à l'appelant
 * d'ignorer une vue qui ne correspond plus à la semaine affichée.
 *
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine.
 * @param dependencies.storage - Le stockage de l'état local.
 * @param dependencies.read - La lecture de la semaine sur le serveur, jeton compris.
 * @param show - Affiche une vue de la semaine.
 * @throws {TokenRejectedError} si le serveur refuse le jeton, seule erreur qui remonte ; l'état
 *   local n'est pas touché.
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
  // Les journées affichées en dernier par ce chargement.
  let shown: PresenceDay[] | null = null;
  try {
    shown = await readLocalWeek(storage, monday);
    show({ days: shown, unreachable: false });
    shown = await read(monday);
    show({ days: shown, unreachable: false });
    await saveWeek(storage, monday, shown);
  } catch (error) {
    if (error instanceof TokenRejectedError) throw error;
    const offline = error instanceof ServerUnreachableError;
    show({ days: shown, unreachable: !offline || shown === null });
  }
}
