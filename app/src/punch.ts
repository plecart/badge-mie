/**
 * Le Pointage du jour (PRD #1, module 2) : l'action que propose le bouton de pointage, et la
 * journée qui résulte d'un pointage ou d'une correction à la main.
 *
 * Module pur : il ne lit jamais l'horloge, l'heure arrive en argument (`currentTime` de
 * `./today`), et ne stocke rien, l'appelant enregistre la journée rendue. L'ordre des deux heures
 * se vérifie par la règle de `@badge-mie/week`, {@link departureFollowsArrival}, la même que
 * celle de l'API.
 */

import {
  departureFollowsArrival,
  isTimeOrNull,
  mondayOf,
  type PresenceDay,
  weekDates,
} from "@badge-mie/week";

/** Le motif d'un refus de l'ordre des heures, affiché tel quel. */
export const DEPARTURE_MUST_FOLLOW_ARRIVAL = "Le départ doit suivre l'arrivée";

/** Le motif du refus d'effacer l'arrivée d'une journée qui a un départ, affiché tel quel. */
export const CLEAR_DEPARTURE_FIRST = "Effacez d'abord le départ de ce jour";

/**
 * L'action du bouton de pointage pour une journée : pointer l'arrivée, pointer le départ, rien
 * quand la journée est terminée (`done`), rien le samedi ni le dimanche (`weekend`).
 */
export type PunchAction = "arrival" | "departure" | "done" | "weekend";

/** L'issue d'un pointage ou d'une correction : la journée qui en résulte, ou le motif du refus. */
export type Outcome = { day: PresenceDay } | { refusal: string };

/**
 * Rend l'action que propose le bouton de pointage pour une journée.
 *
 * @param day - La journée, d'ordinaire celle d'aujourd'hui.
 * @returns `weekend` un samedi ou un dimanche ; sinon `arrival` tant que l'arrivée n'est pas
 *   pointée, même si le départ l'est, `departure` quand seule l'arrivée l'est, `done` quand les
 *   deux le sont.
 * @throws {RangeError} si `day.jour` n'est pas une date réelle.
 */
export function punchAction(day: PresenceDay): PunchAction {
  if (!weekDates(mondayOf(day.jour)).includes(day.jour)) return "weekend";
  if (day.arrivee === null) return "arrival";
  return day.depart === null ? "departure" : "done";
}

/**
 * Pointe une journée : pose l'heure sur l'arrivée ou le départ, selon {@link punchAction}.
 *
 * Un départ qui ne suit pas l'arrivée est refusé, comme à la correction à la main : c'est le
 * double appui dans la même minute (décision 4 de #4).
 *
 * @example punch({ jour: "2026-11-18", arrivee: null, depart: null }, "08:30")
 *   // { day: { jour: "2026-11-18", arrivee: "08:30", depart: null } }
 * @param day - La journée à pointer.
 * @param time - L'heure `HH:MM` du pointage, telle que la rend `currentTime`.
 * @returns La journée pointée, ou le refus {@link DEPARTURE_MUST_FOLLOW_ARRIVAL}.
 * @throws {RangeError} si l'action est `done` ou `weekend` : le bouton est alors désactivé, et
 *   l'appel est une erreur de l'appelant. Aussi si `day.jour` n'est pas une date réelle, et dans
 *   les cas de {@link editTime}.
 */
export function punch(day: PresenceDay, time: string): Outcome {
  const action = punchAction(day);
  if (action === "done" || action === "weekend") {
    throw new RangeError(`rien à pointer le ${day.jour} : ${action}`);
  }
  return editTime(day, action === "arrival" ? "arrivee" : "depart", time);
}

/**
 * Corrige à la main une heure d'une journée, ou l'efface.
 *
 * Un départ sans arrivée est admis, comme par la table `presence` (ADR-0001, « Décision »,
 * point 5).
 *
 * @param day - La journée à corriger.
 * @param field - L'heure à corriger : `arrivee` ou `depart`.
 * @param time - La nouvelle heure `HH:MM`, ou `null` pour l'effacer.
 * @returns La journée corrigée ; ou le refus {@link CLEAR_DEPARTURE_FIRST} pour l'effacement de
 *   l'arrivée d'une journée qui a un départ ; ou le refus {@link DEPARTURE_MUST_FOLLOW_ARRIVAL}
 *   quand le départ de la journée corrigée ne suit pas son arrivée.
 * @throws {RangeError} si `time` n'est ni `null` ni une heure `HH:MM` : la journée partirait
 *   vers un serveur qui la refuserait toujours. Aussi si la journée corrigée porte ses deux
 *   heures et que l'autre n'est pas une heure `HH:MM` (voir {@link departureFollowsArrival}).
 */
export function editTime(
  day: PresenceDay,
  field: "arrivee" | "depart",
  time: string | null,
): Outcome {
  if (!isTimeOrNull(time)) {
    throw new RangeError(`heure invalide : « ${time} », attendu HH:MM`);
  }
  if (field === "arrivee" && time === null && day.depart !== null) {
    return { refusal: CLEAR_DEPARTURE_FIRST };
  }
  const next = { ...day, [field]: time };
  return departureFollowsArrival(next.arrivee, next.depart)
    ? { day: next }
    : { refusal: DEPARTURE_MUST_FOLLOW_ARRIVAL };
}
