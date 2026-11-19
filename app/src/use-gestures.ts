/**
 * Les gestes de l'écran de la semaine : le pointage d'aujourd'hui, la correction d'une heure et
 * l'annulation du dernier geste. Chacun s'enregistre par la File d'envoi, et la barre du dernier
 * geste le confirme pendant {@link BAR_MS}, « Annuler » compris (issue #4, décisions 1 et 2).
 *
 * Ce que fait le bouton de pointage, actif ou non, et l'issue d'un appui, retour haptique compris,
 * se décident dans `./punch` ({@link punchButton}, {@link pressPunch}) : l'écran les exécute.
 *
 * Aucun gestionnaire ne laisse remonter d'exception : les journées viennent d'une semaine vérifiée
 * à sa lecture, `pressPunch` reçoit le lundi de la semaine affichée et l'heure `HH:MM` de
 * `currentTime`, `editTime` une heure `HH:MM` ou `null`, le sélecteur reçoit toujours un `Date`,
 * et un échec du stockage s'affiche dans la barre.
 */

import type { PresenceDay } from "@badge-mie/week";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { ImpactFeedbackStyle, impactAsync } from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { editMessage, PUNCH_LABELS, punchMessage } from "./labels";
import {
  editTime,
  type Outcome,
  pressPunch,
  punchButton,
  type TimeField,
} from "./punch";
import type { DockButton } from "./PunchDock";
import type { SendQueue } from "./send-queue";
import { currentTime, instantAt, today } from "./today";
import type { WeekView } from "./week-store";

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
 * @param options.view - La vue de la semaine affichée.
 * @param options.monday - Le lundi `AAAA-MM-JJ` de la semaine affichée.
 * @param options.date - La date du jour `AAAA-MM-JJ`, celle de l'horloge de l'écran.
 * @param options.onSaved - Appelé après chaque enregistrement, réussi ou non, pour relire la
 *   semaine affichée.
 * @returns `message` et `onUndo`, la barre du dernier geste pour `PunchDock` (`onUndo` absent pour
 *   un refus) ; `punchButton`, le bouton de pointage ; `edit`, qui ouvre la correction d'une heure
 *   d'une journée.
 */
export function useGestures({
  queue,
  view,
  monday,
  date,
  onSaved,
}: {
  queue: SendQueue;
  view: WeekView;
  monday: string;
  date: string;
  onSaved: () => void;
}): {
  message: string | null;
  onUndo: (() => void) | undefined;
  punchButton: DockButton;
  edit: (day: PresenceDay, field: TimeField) => void;
} {
  const [bar, setBar] = useState<Bar | null>(null);
  // Vrai pendant l'enregistrement d'un pointage.
  const punching = useRef(false);

  // Un nouveau geste remplace la barre et relance son délai.
  useEffect(() => {
    if (bar === null) return;
    const timer = setTimeout(() => setBar(null), BAR_MS);
    return () => clearTimeout(timer);
  }, [bar]);

  const button = punchButton(view, monday, date);

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
   * Pointe aujourd'hui, la date et l'heure relues au moment du geste, comme le dit
   * {@link pressPunch} : un appui traité après minuit lit le jour nouveau, et ne pointe rien hors
   * des jours ouvrés de la semaine affichée.
   *
   * Un appui reçu pendant l'enregistrement d'un pointage est ignoré : il lirait encore la journée
   * d'avant le premier, et la repointerait, une minute plus tard s'il tombe sur la minute
   * suivante. Code d'écran, sans test.
   */
  async function punchToday() {
    if (punching.current) return;
    const time = currentTime();
    const press = pressPunch(view, monday, today(), time);
    if (press === null) return;
    // ponytail: la garde tombe à la fin de l'enregistrement, avant l'affichage de la semaine
    // relue ; un second appui dans cet intervalle repointe encore, et son « Annuler » rétablit la
    // journée d'avant les deux. La tenir jusqu'à la vue suivante si le double appui se voit.
    punching.current = true;
    try {
      const message = punchMessage(press.action, time);
      const saved = await settle(press.before, press.outcome, message);
      // Manqué, le retour haptique ne change rien au pointage.
      if (saved && press.haptic) {
        impactAsync(ImpactFeedbackStyle.Medium).catch(() => undefined);
      }
    } finally {
      punching.current = false;
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
      label: PUNCH_LABELS[button.action],
      onPress: () => void punchToday(),
      variant: "primary",
      disabled: !button.enabled,
    },
    edit,
  };
}
