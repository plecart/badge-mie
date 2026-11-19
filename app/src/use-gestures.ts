/**
 * Les gestes de l'écran de la semaine : le pointage d'aujourd'hui, la correction d'une heure et
 * l'annulation du dernier geste. Chacun s'enregistre par la File d'envoi, et la barre du dernier
 * geste le confirme pendant {@link BAR_MS}, « Annuler » compris (issue #4, décisions 1 et 2).
 *
 * Aucun gestionnaire ne laisse remonter d'exception : les journées viennent d'une semaine vérifiée
 * à sa lecture, `punch` n'est appelé que sur une action qui se pointe, `editTime` que sur une heure
 * `HH:MM` ou `null`, le sélecteur reçoit toujours un `Date`, et un échec du stockage s'affiche dans
 * la barre.
 */

import type { PresenceDay } from "@badge-mie/week";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { ImpactFeedbackStyle, impactAsync } from "expo-haptics";
import { useEffect, useState } from "react";
import { editMessage, PUNCH_LABELS, punchMessage } from "./labels";
import {
  canPunch,
  editTime,
  type Outcome,
  punch,
  punchAction,
  type TimeField,
} from "./punch";
import type { DockButton } from "./PunchDock";
import type { SendQueue } from "./send-queue";
import { currentTime, instantAt, today } from "./today";

/** La durée d'affichage de la barre du dernier geste, et de son « Annuler » (PRD #1, story 20). */
const BAR_MS = 5000;

/** Le message d'un geste que le téléphone n'a pas pu enregistrer. */
const NOT_SAVED = "Échec de l'enregistrement sur le téléphone";

/** La barre du dernier geste : son message, et la journée d'avant le geste s'il s'annule. */
interface Bar {
  message: string;
  undo?: PresenceDay;
}

/**
 * Rend les gestes de l'écran de la semaine.
 *
 * @param options.queue - La File d'envoi, par laquelle chaque geste s'enregistre.
 * @param options.days - Les journées de la semaine affichée, ou `null` tant qu'elle n'est pas
 *   connue : on ne pointe jamais une journée inconnue, qui écraserait celle du serveur.
 * @param options.date - La date du jour `AAAA-MM-JJ`, celle de l'horloge de l'écran.
 * @param options.onSaved - Appelé après chaque enregistrement, réussi ou non, pour relire la
 *   semaine affichée.
 * @returns `message` et `onUndo`, la barre du dernier geste pour `PunchDock` (`onUndo` absent pour
 *   un refus) ; `punchButton`, le bouton de pointage ; `edit`, qui ouvre la correction d'une heure
 *   d'une journée.
 */
export function useGestures({
  queue,
  days,
  date,
  onSaved,
}: {
  queue: SendQueue;
  days: PresenceDay[] | null;
  date: string;
  onSaved: () => void;
}): {
  message: string | null;
  onUndo: (() => void) | undefined;
  punchButton: DockButton;
  edit: (day: PresenceDay, field: TimeField) => void;
} {
  const [bar, setBar] = useState<Bar | null>(null);

  // Un nouveau geste remplace la barre et relance son délai.
  useEffect(() => {
    if (bar === null) return;
    const timer = setTimeout(() => setBar(null), BAR_MS);
    return () => clearTimeout(timer);
  }, [bar]);

  /** La journée d'une date dans la semaine affichée ; `undefined` si elle n'y est pas connue. */
  const dayOf = (isoDate: string) => days?.find((day) => day.jour === isoDate);
  const todayDay = dayOf(date);
  // Le week-end, ou tant que la semaine n'est pas connue, l'action se lit sur une journée vide.
  const action = punchAction(
    todayDay ?? { jour: date, arrivee: null, depart: null },
  );

  /**
   * Enregistre une journée par la file.
   *
   * @returns `false` si le téléphone n'a pas pu l'écrire ; la barre le dit alors.
   */
  async function save(day: PresenceDay): Promise<boolean> {
    try {
      await queue.record(day);
      return true;
    } catch {
      setBar({ message: NOT_SAVED });
      return false;
    } finally {
      // Même en échec, `record` a pu écrire la file : la semaine relue le montre.
      onSaved();
    }
  }

  /**
   * Conclut un geste. Refusé, son motif s'affiche seul et rien ne change ; accepté, la journée
   * est enregistrée, et la barre affiche `message` avec « Annuler », qui rétablit `before`.
   *
   * @returns `true` si le geste est accepté et enregistré.
   */
  async function settle(
    before: PresenceDay,
    outcome: Outcome,
    message: string,
  ): Promise<boolean> {
    if ("refusal" in outcome) {
      setBar({ message: outcome.refusal });
      return false;
    }
    if (!(await save(outcome.day))) return false;
    setBar({ message, undo: before });
    return true;
  }

  /**
   * Pointe aujourd'hui, la date et l'heure relues au moment du geste. Ne fait rien si la journée
   * n'est pas connue ou n'a rien à pointer : un appui traité après minuit ne pointe jamais une
   * journée inconnue ni terminée. Un second appui reçu avant que la semaine relue s'affiche lit
   * encore la journée d'avant le premier : il la pointe de nouveau, à la même heure ou à la
   * minute suivante, et son « Annuler » rétablit la journée d'avant les deux.
   */
  async function punchToday() {
    const day = dayOf(today());
    if (day === undefined) return;
    const punched = punchAction(day);
    if (!canPunch(punched)) return;
    const time = currentTime();
    if (await settle(day, punch(day, time), punchMessage(punched, time))) {
      // Le retour haptique accompagne le pointage seul (issue #4, décision 1) ; manqué, il ne
      // change rien au pointage.
      impactAsync(ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
  }

  /**
   * Ouvre le sélecteur d'heure natif sur une heure d'une journée, prérempli avec cette heure, ou
   * avec l'heure courante si elle est vide ; « Effacer » n'y apparaît que sur une heure
   * renseignée. Fermé sans choix, il ne change rien.
   */
  function edit(day: PresenceDay, field: TimeField) {
    const time = day[field];
    // `currentTime` rend toujours une heure `HH:MM`, et l'autre heure de la journée vient d'une
    // semaine vérifiée : `editTime` ne lève pas.
    const apply = (next: string | null) =>
      void settle(day, editTime(day, field, next), editMessage(field, next));
    DateTimePickerAndroid.open({
      value: instantAt(today(), time ?? currentTime()),
      mode: "time",
      is24Hour: true,
      ...(time === null ? {} : { neutralButton: { label: "Effacer" } }),
      onValueChange: (_, selected) => apply(currentTime(selected)),
      onNeutralButtonPress: () => apply(null),
    });
  }

  /** Rétablit la journée d'avant le dernier geste, puis cache la barre. */
  async function undo(day: PresenceDay) {
    if (await save(day)) setBar(null);
  }

  const undoDay = bar?.undo;
  return {
    message: bar?.message ?? null,
    onUndo: undoDay && (() => void undo(undoDay)),
    punchButton: {
      label: PUNCH_LABELS[action],
      onPress: () => void punchToday(),
      variant: "primary",
      disabled: todayDay === undefined || !canPunch(action),
    },
    edit,
  };
}
