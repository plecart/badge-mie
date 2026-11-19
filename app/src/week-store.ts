/**
 * L'état local des semaines : les journées de chaque semaine, gardées sur le téléphone pour
 * s'afficher avant la réponse du serveur, ou à sa place sans réseau (PRD #1, « Interactions »,
 * « Lecture d'une semaine »). Une journée modifiée y entre par {@link saveDay} ; la réponse du
 * serveur y entre par {@link loadWeek}, sauf pour les jours en attente d'envoi, qui l'emportent.
 *
 * Le stockage est injecté : `@react-native-async-storage/async-storage` dans l'application, un
 * stockage en mémoire dans les tests.
 */

import { mondayOf, type PresenceDay, weekDates } from "@badge-mie/week";
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
 * @param days - Les cinq journées de la semaine, du lundi au vendredi.
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
 * Superpose des jours en attente d'envoi aux journées d'une semaine : chaque journée dont un jour
 * en attente porte la date est remplacée par lui ; les jours en attente d'autres semaines n'y
 * changent rien.
 */
function overlay(days: PresenceDay[], pending: PresenceDay[]): PresenceDay[] {
  const byDate = new Map(pending.map((day) => [day.jour, day]));
  return days.map((day) => byDate.get(day.jour) ?? day);
}

/**
 * Range une journée dans l'état local de sa semaine, à la place de la précédente.
 *
 * @param storage - Le stockage clé-valeur.
 * @param day - La journée, d'un jour ouvré, du lundi au vendredi.
 * @throws {RangeError} si `day.jour` n'est pas une date réelle.
 */
export async function saveDay(
  storage: KeyValueStorage,
  day: PresenceDay,
): Promise<void> {
  const monday = mondayOf(day.jour);
  const days =
    (await readLocalWeek(storage, monday)) ??
    weekDates(monday).map((jour) => ({ jour, arrivee: null, depart: null }));
  await saveWeek(
    storage,
    monday,
    days.map((saved) => (saved.jour === day.jour ? day : saved)),
  );
}

/**
 * Charge une semaine pour l'écran : l'état local d'abord, puis la réponse du serveur, l'un et
 * l'autre sous les jours en attente d'envoi.
 *
 * `show` est d'abord appelé avec l'état local (`days: null` s'il n'y en a pas), puis avec la
 * réponse du serveur, enregistrée ensuite dans l'état local telle qu'affichée. Si le serveur est
 * injoignable ({@link ServerUnreachableError}), le second appel reprend l'état local, laissé
 * intact, avec `unreachable` vrai s'il n'y en a pas. Toute autre panne — un état local qui ne se
 * lit ni ne s'écrit, une lecture qui échoue autrement — se dit comme un serveur injoignable : un
 * dernier appel garde les journées déjà affichées par ce chargement (`null` si l'état local ne
 * s'est pas lu, et c'est alors le seul appel), avec `unreachable` vrai.
 *
 * Chaque vue superpose les jours en attente de cette semaine à ses journées : un jour en attente
 * l'emporte sur la valeur du serveur comme sur celle de l'état local (PRD #1, story 38). Ce sont
 * les jours en attente au début du chargement, puis ceux du moment où la vue s'affiche, qui
 * l'emportent : un jour envoyé pendant la lecture peut manquer à la réponse du serveur. Une vue
 * sans journées (`days: null`) le reste. Si la file ne se lit pas, la vue s'affiche sans
 * superposition plutôt que pas du tout.
 *
 * Chaque appel peut arriver après que l'écran est passé à une autre semaine : à l'appelant
 * d'ignorer une vue qui ne correspond plus à la semaine affichée.
 *
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine.
 * @param dependencies.storage - Le stockage de l'état local.
 * @param dependencies.read - La lecture de la semaine sur le serveur, jeton compris.
 * @param dependencies.pending - Les jours en attente d'envoi, de toutes les semaines.
 * @param show - Affiche une vue de la semaine.
 * @throws {TokenRejectedError} si le serveur refuse le jeton, seule erreur qui remonte ; l'état
 *   local n'est pas touché.
 */
export async function loadWeek(
  monday: string,
  {
    storage,
    read,
    pending,
  }: {
    storage: KeyValueStorage;
    read: (monday: string) => Promise<PresenceDay[]>;
    pending: () => Promise<PresenceDay[]>;
  },
  show: (view: WeekView) => void,
): Promise<void> {
  // Une file qui ne se lit pas ne cache pas la semaine : elle s'affiche sans superposition.
  const pendingNow = () => pending().catch((): PresenceDay[] => []);
  const atStart = await pendingNow();
  // Les jours en attente au début du chargement, puis ceux d'à présent, qui l'emportent : un jour
  // envoyé pendant la lecture peut manquer à la réponse du serveur.
  const withPending = async (days: PresenceDay[]): Promise<PresenceDay[]> =>
    overlay(overlay(days, atStart), await pendingNow());
  // Les journées affichées en dernier par ce chargement.
  let shown: PresenceDay[] | null = null;
  try {
    const local = await readLocalWeek(storage, monday);
    shown = local && (await withPending(local));
    show({ days: shown, unreachable: false });
    shown = await withPending(await read(monday));
    show({ days: shown, unreachable: false });
    // ponytail: un `saveDay` arrivé entre la dernière lecture de la file et cette écriture y est
    // recouvert ; la vue le montre tant qu'il attend, et la lecture qui suit son envoi le rend.
    // Sérialiser les écritures de l'état local si le cas se voit.
    await saveWeek(storage, monday, shown);
  } catch (error) {
    if (error instanceof TokenRejectedError) throw error;
    const offline = error instanceof ServerUnreachableError;
    show({
      days: shown && (await withPending(shown)),
      unreachable: !offline || shown === null,
    });
  }
}
