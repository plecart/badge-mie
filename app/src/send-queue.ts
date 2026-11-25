/**
 * La File d'envoi (PRD #1, module 3) : chaque journée modifiée est gardée sur le téléphone avant
 * tout envoi, puis part vers le serveur dès que possible, réseau ou pas (ADR-0001, « Décision »,
 * point 4).
 *
 * Correspondance avec le PRD : {@link SendQueue.record} est `enregistrer`, {@link SendQueue.flush}
 * est `rejouer` (la relance), la longueur de {@link SendQueue.pendingDays} est `enAttente()`.
 *
 * La file tient sous une seule clé du stockage : un objet JSON indexé par date, une entrée par
 * jour, l'état complet du jour, remplacé à chaque modification. Le stockage et l'envoi sont
 * injectés. Le module n'écoute rien et n'a pas de minuteur : les déclencheurs de la relance
 * (ouverture, retour du réseau, premier plan) appellent {@link SendQueue.flush} (décision 8 de #4).
 */

import { isPresenceDay, type PresenceDay } from "@badge-mie/week";
import { DayRejectedError, TokenRejectedError } from "./api";
import { type KeyValueStorage, saveDay } from "./week-store";

/** La clé de stockage de la file, distincte de celles des semaines. */
const KEY = "file-envoi";

/** Les entrées de la file, par date `AAAA-MM-JJ`. */
type Entries = Map<string, PresenceDay>;

/**
 * La dernière lecture-modification-écriture de la file, par stockage : la suivante l'attend, de
 * quelque file qu'elle vienne. Le processus de l'app vivant, son widget tourne dans le même
 * contexte JS qu'elle — sa tâche prend le `ReactHost` de l'application et son contexte courant
 * (`HeadlessJsTaskWorker.java` de `react-native-android-widget` 0.26.0, lu le 2026-11-25) —,
 * chacun avec sa file sur le même stockage : une chaîne propre à chaque file laisserait la sortie
 * d'un jour envoyé par l'une effacer le jour que l'autre vient d'enregistrer.
 */
const writesByStorage = new WeakMap<KeyValueStorage, Promise<unknown>>();

/**
 * Lit le texte rangé de la file. C'est une frontière de confiance, comme l'état local d'une
 * semaine : un texte absent, illisible ou qui n'est pas un objet compte comme une file vide, et
 * une entrée dont la valeur n'est pas la journée de sa clé, date réelle comprise (voir
 * {@link isPresenceDay}), compte comme absente.
 */
function parseEntries(text: string | null): Entries {
  let value: unknown;
  try {
    value = JSON.parse(text ?? "{}");
  } catch {
    return new Map();
  }
  if (typeof value !== "object" || value === null) return new Map();
  return new Map(
    Object.entries(value).filter((entry): entry is [string, PresenceDay] =>
      isPresenceDay(entry[1], entry[0]),
    ),
  );
}

/** Lit les entrées de la file rangée dans `storage`. */
async function readEntries(storage: KeyValueStorage): Promise<Entries> {
  return parseEntries(await storage.getItem(KEY));
}

/**
 * Rend les jours en attente d'envoi rangés dans un stockage, sans créer de file : ce que lit le
 * widget pour se dessiner, et {@link SendQueue.pendingDays}.
 *
 * @param storage - Le stockage clé-valeur de la file.
 * @returns Les journées de la file, par date croissante ; leur nombre est `enAttente()`.
 * @throws l'erreur du stockage s'il ne se lit pas.
 */
export async function readPendingDays(
  storage: KeyValueStorage,
): Promise<PresenceDay[]> {
  // Deux dates `AAAA-MM-JJ` s'ordonnent comme leur texte.
  return [...(await readEntries(storage)).values()].sort((a, b) =>
    a.jour < b.jour ? -1 : 1,
  );
}

/** Vrai si l'entrée existe et porte la même date, la même arrivée et le même départ que `day`. */
function isSame(entry: PresenceDay | undefined, day: PresenceDay): boolean {
  return (
    entry?.jour === day.jour &&
    entry.arrivee === day.arrivee &&
    entry.depart === day.depart
  );
}

/** La File d'envoi. */
export interface SendQueue {
  /**
   * Enregistre l'état complet d'une journée (`enregistrer`) : l'entrée de son jour est écrite dans
   * la file avant tout envoi, à la place de la précédente ; la journée est rangée dans l'état
   * local de sa semaine (décision 6 de #4) ; `onChange` reçoit le nombre de jours en attente ;
   * puis la relance part, sans être attendue. Ces deux derniers temps suivent l'écriture de la
   * file, même si celle de l'état local échoue.
   *
   * @param day - La journée, telle que la rend le Pointage du jour : une date réelle, de n'importe
   *   quel jour de la semaine, deux heures `HH:MM` ou `null`.
   * @returns Une promesse résolue une fois la file et l'état local écrits.
   * @throws l'erreur du stockage si l'une des deux écritures échoue : écrite d'abord, l'entrée
   *   de la file reste quand seule la seconde échoue, se compte dans `onChange` et part à la
   *   relance.
   */
  record(day: PresenceDay): Promise<void>;
  /**
   * Relance l'envoi de la file (`rejouer`), jour par jour, par date croissante. Une relance à la
   * fois : un appel pendant une relance n'envoie rien en parallèle, il la fait repartir une fois
   * finie, une seule fois quel que soit le nombre d'appels. Pour chaque jour :
   *
   * - envoyé, il sort de la file s'il n'a pas changé pendant l'envoi ; modifié entre-temps, il
   *   reste et repart à la reprise ;
   * - refusé par le serveur ({@link DayRejectedError}), il reste en file, jamais perdu, et la
   *   relance passe au jour suivant (décision 7 de #4) ;
   * - sur un jeton refusé ({@link TokenRejectedError}), la relance s'arrête, la file est gardée
   *   et `onTokenRejected` est appelé ;
   * - sur toute autre panne, du réseau (`ServerUnreachableError`) ou du stockage, la
   *   relance s'arrête et la file est gardée.
   *
   * @returns Une promesse résolue à la fin de la relance, reprise comprise ; elle ne rejette
   *   jamais.
   */
  flush(): Promise<void>;
  /**
   * Rend les jours en attente d'envoi, comme {@link readPendingDays} sur le stockage de la file.
   *
   * @returns Les journées de la file, par date croissante ; leur nombre est `enAttente()`.
   * @throws l'erreur du stockage s'il ne se lit pas.
   */
  pendingDays(): Promise<PresenceDay[]>;
}

/**
 * Crée la File d'envoi.
 *
 * Toutes les lectures-modifications-écritures de la file passent l'une après l'autre, celles de
 * toutes les files créées sur le même stockage : un enregistrement pendant une relance, de cette
 * file ou d'une autre, n'est jamais écrasé par la sortie d'un jour envoyé.
 *
 * @param options.storage - Le stockage clé-valeur, celui de l'état local des semaines.
 * @param options.send - L'envoi d'une journée au serveur, jeton compris ; il lève les erreurs de
 *   `writeDay`.
 * @param options.onChange - Reçoit le nombre de jours en attente après chaque écriture de la file.
 * @param options.onTokenRejected - Appelé quand un jeton refusé a arrêté la relance.
 */
export function createSendQueue({
  storage,
  send,
  onChange,
  onTokenRejected,
}: {
  storage: KeyValueStorage;
  send: (day: PresenceDay) => Promise<void>;
  onChange?: (pending: number) => void;
  onTokenRejected?: () => void;
}): SendQueue {
  // La relance en cours, et la demande de la faire repartir.
  let running: Promise<void> | undefined;
  let rerun = false;

  /** Modifie la file à son tour, et rend le nombre de jours qui y restent. */
  function update(change: (entries: Entries) => void): Promise<number> {
    const previous = writesByStorage.get(storage) ?? Promise.resolve();
    const done = previous.then(async () => {
      const entries = await readEntries(storage);
      change(entries);
      await storage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
      return entries.size;
    });
    // Une écriture qui échoue ne bloque pas les suivantes.
    writesByStorage.set(
      storage,
      done.catch(() => undefined),
    );
    return done;
  }

  const pendingDays = () => readPendingDays(storage);

  /** Envoie la file une fois ; lève sur la panne qui l'arrête. */
  async function sendAll(): Promise<void> {
    for (const day of await pendingDays()) {
      try {
        await send(day);
      } catch (error) {
        if (error instanceof DayRejectedError) continue;
        if (error instanceof TokenRejectedError) onTokenRejected?.();
        throw error;
      }
      const pending = await update((entries) => {
        if (isSame(entries.get(day.jour), day)) entries.delete(day.jour);
      });
      onChange?.(pending);
    }
  }

  function flush(): Promise<void> {
    if (running) {
      rerun = true;
      return running;
    }
    running = (async () => {
      do {
        rerun = false;
        // La panne qui arrête la relance la laisse en file : la suivante la reprendra.
        await sendAll().catch(() => undefined);
      } while (rerun);
      running = undefined;
    })();
    return running;
  }

  async function record(day: PresenceDay): Promise<void> {
    const pending = await update((entries) => entries.set(day.jour, day));
    try {
      await saveDay(storage, day);
    } finally {
      // L'entrée est en file, que l'état local se soit écrit ou non : elle se dit et part.
      onChange?.(pending);
      void flush();
    }
  }

  return { record, flush, pendingDays };
}
