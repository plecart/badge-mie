/**
 * Le Pointage du jour (PRD #1, module 2) : l'action que propose le bouton de pointage, ce que
 * fait un appui sur lui, et la journée qui résulte d'un pointage ou d'une correction à la main.
 *
 * Module pur : il ne lit jamais l'horloge, la date et l'heure arrivent en argument (`today` et
 * `currentTime` de `./today`), et ne stocke rien, l'appelant enregistre la journée rendue. L'ordre
 * des deux heures se vérifie par la règle de `@badge-mie/week`, {@link departureFollowsArrival},
 * la même que celle de l'API.
 */

import {
  departureFollowsArrival,
  emptyDay,
  isTimeOrNull,
  mondayOf,
  type PresenceDay,
  weekDates,
} from "@badge-mie/week";
import type { WeekView } from "./week-store";

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

/** Une heure d'une journée, celle que corrige {@link editTime}. */
export type TimeField = "arrivee" | "depart";

/** Le bouton de pointage d'aujourd'hui : l'action dont il porte le libellé, et s'il est actif. */
export interface PunchButton {
  action: PunchAction;
  enabled: boolean;
}

/** Ce que l'écran fait d'un appui sur le bouton de pointage. */
export interface PunchPress {
  /** La journée d'aujourd'hui d'avant l'appui, que rétablit « Annuler ». */
  before: PresenceDay;
  /** L'action pointée, pour le message de la barre. */
  action: "arrival" | "departure";
  /** La journée pointée, à enregistrer, ou le motif du refus. */
  outcome: Outcome;
  /**
   * Vrai si l'appui donne le retour haptique : un pointage accepté, et lui seul (issue #4,
   * décision 1).
   */
  haptic: boolean;
}

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
 * Dit si une action du bouton de pointage pointe une heure : le bouton n'est actif, et
 * {@link punch} n'est permis, que pour elle.
 *
 * @param action - L'action, telle que la rend {@link punchAction}.
 * @returns `true` pour `arrival` et `departure`, `false` pour `done` et `weekend`.
 */
export function canPunch(
  action: PunchAction,
): action is "arrival" | "departure" {
  return action === "arrival" || action === "departure";
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
 * @throws {RangeError} si l'action ne se pointe pas ({@link canPunch}) : le bouton est alors
 *   désactivé, et l'appel est une erreur de l'appelant. Aussi si `day.jour` n'est pas une date
 *   réelle, et dans les cas de {@link editTime}.
 */
export function punch(day: PresenceDay, time: string): Outcome {
  const action = punchAction(day);
  if (!canPunch(action)) {
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
  field: TimeField,
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

/**
 * La journée d'aujourd'hui telle que la pointe le bouton, dans la semaine affichée.
 *
 * Une semaine jamais lue (`days: null`) dont le chargement s'est terminé sans réseau se pointe
 * sur une journée vide : sans état local, ce téléphone ne l'a jamais pointée, et son premier
 * pointage en crée l'état (`saveDay` de `./week-store`). Un téléphone qui a perdu son état local
 * — réinstallé, données effacées, état illisible — alors que le serveur a déjà l'arrivée du jour
 * la voit écrasée, et la corrige à la main : un seul téléphone pointe (ADR-0001, « Comportement
 * hors ligne »).
 *
 * @returns La journée ; `undefined` tant que la semaine se charge, ou si `date` n'est pas un jour
 *   ouvré de la semaine affichée.
 */
function todayOf(
  view: WeekView,
  monday: string,
  date: string,
): PresenceDay | undefined {
  if (view.days !== null) return view.days.find((day) => day.jour === date);
  if (!view.unreachable || !weekDates(monday).includes(date)) return undefined;
  return emptyDay(date);
}

/**
 * Rend le bouton de pointage d'aujourd'hui, actif quand un appui a une journée à pointer :
 * {@link pressPunch} ne rend alors pas `null`.
 *
 * @param view - La vue de la semaine affichée.
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine affichée.
 * @param date - La date du jour `AAAA-MM-JJ`.
 * @returns L'action du bouton — lue sur une journée vide quand il n'a pas de journée à pointer,
 *   `weekend` un samedi —, et s'il est actif.
 * @throws {RangeError} si `date` n'est pas une date réelle, comme {@link punchAction} ; ou, sur
 *   une semaine jamais lue et injoignable, si `monday` n'est pas un lundi réel.
 */
export function punchButton(
  view: WeekView,
  monday: string,
  date: string,
): PunchButton {
  const day = todayOf(view, monday, date);
  const action = punchAction(day ?? emptyDay(date));
  return { action, enabled: day !== undefined && canPunch(action) };
}

/**
 * Rend ce que fait un appui sur le bouton de pointage : rien quand il n'a rien à pointer, sinon
 * le pointage d'aujourd'hui à `time`, accepté ou refusé.
 *
 * @param view - La vue de la semaine affichée.
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine affichée.
 * @param date - La date du jour `AAAA-MM-JJ`, relue au moment de l'appui.
 * @param time - L'heure `HH:MM` de l'appui.
 * @returns `null` — la semaine se charge, `date` n'est pas un jour ouvré de la semaine affichée,
 *   ou la journée est terminée — ; sinon l'appui ({@link PunchPress}).
 * @throws {RangeError} si `time` n'est pas une heure `HH:MM`, comme {@link punch} ; ou, sur une
 *   semaine jamais lue et injoignable, si `monday` n'est pas un lundi réel.
 */
export function pressPunch(
  view: WeekView,
  monday: string,
  date: string,
  time: string,
): PunchPress | null {
  const day = todayOf(view, monday, date);
  if (day === undefined) return null;
  const action = punchAction(day);
  if (!canPunch(action)) return null;
  const outcome = punch(day, time);
  return { before: day, action, outcome, haptic: "day" in outcome };
}
