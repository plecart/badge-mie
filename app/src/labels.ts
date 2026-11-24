/**
 * Les textes de l'écran de la semaine qui dépendent d'un état : le libellé du bouton de pointage et
 * son indication pour TalkBack, le message de la barre du dernier geste, accepté, refusé ou
 * interrompu, la durée d'une carte, l'indicateur d'envoi, la ligne sous le bouton (issue #4,
 * décision 1). Module pur : l'écran les compose sans rien décider (PRD #1, module 5).
 */

import {
  dayLabel,
  dayMinutes,
  formatDuration,
  type PresenceDay,
} from "@badge-mie/week";
import type { PunchAction, Refusal, TimeField } from "./punch";

/** Ce qu'affiche une heure, une durée ou un total encore inconnus. */
export const MISSING = "—";

/** Le libellé du bouton de pointage pour chaque action (PRD #1, stories 12 à 15). */
export const PUNCH_LABELS: Record<PunchAction, string> = {
  arrival: "Pointer l'arrivée",
  departure: "Pointer le départ",
  done: "Journée terminée",
};

/**
 * Le message d'un appui sur le bouton de pointage interrompu avant la fin, affiché seul dans la
 * barre du dernier geste (ADR-0001, « Propositions UX ») : un toucher qui ne ferait rien
 * ressemblerait à une panne (issue #14, décisions du 2026-11-19).
 */
export const HOLD_TO_PUNCH = "Maintiens le bouton pour pointer";

/**
 * L'indication, pour TalkBack, du bouton de pointage : sous TalkBack, son activation pointe
 * directement ; sans lui, il se maintient.
 */
export const HOLD_HINT = "Sans TalkBack, maintiens le bouton pour pointer";

/** Le message d'un geste refusé, affiché seul dans la barre du dernier geste. */
export const REFUSAL_TEXTS: Record<Refusal, string> = {
  departureMustFollowArrival: "Le départ doit suivre l'arrivée",
  clearDepartureFirst: "Effacez d'abord le départ de ce jour",
};

/**
 * Rend le message d'un pointage accepté, affiché dans la barre « Annuler ».
 *
 * @example punchMessage("arrival", "08:42") // « Arrivée pointée à 08:42 »
 * @param action - L'action pointée.
 * @param time - L'heure `HH:MM` pointée.
 */
export function punchMessage(
  action: "arrival" | "departure",
  time: string,
): string {
  return `${action === "arrival" ? "Arrivée pointée" : "Départ pointé"} à ${time}`;
}

/**
 * Rend le message d'une correction ou d'un effacement accepté, de même forme qu'un pointage
 * (PRD #1, story 28 amendée).
 *
 * @example editMessage("depart", null) // « Départ effacé »
 * @param field - L'heure corrigée.
 * @param time - La nouvelle heure `HH:MM`, ou `null` pour un effacement.
 */
export function editMessage(field: TimeField, time: string | null): string {
  const arrival = field === "arrivee";
  if (time === null) return arrival ? "Arrivée effacée" : "Départ effacé";
  return `${arrival ? "Arrivée corrigée" : "Départ corrigé"} à ${time}`;
}

/**
 * Rend ce qu'affiche la carte d'un jour à la place de sa durée.
 *
 * @param day - La journée de la carte.
 * @param isToday - Vrai pour la carte d'aujourd'hui.
 * @returns Ce que compte le jour ({@link dayMinutes}), formaté : sa durée (« 8 h 35 ») s'il a ses
 *   deux heures, « 8 h 30 » pour un férié du lundi au vendredi sans aucune heure ; sinon « en
 *   cours » pour aujourd'hui commencé et non terminé, et pour lui seul (PRD #1, story 6 amendée),
 *   un férié compris ; « — » pour tout autre jour qui a une heure sans l'autre ; rien pour un
 *   autre jour sans aucune heure.
 * @throws {RangeError} si `day.jour` n'est pas une date réelle, ou si une heure présente n'est
 *   pas une heure `HH:MM`, comme {@link dayMinutes}.
 */
export function durationText(day: PresenceDay, isToday: boolean): string {
  const minutes = dayMinutes(day);
  if (minutes !== null) return formatDuration(minutes);
  if (day.arrivee === null && day.depart === null) return "";
  return isToday && day.depart === null ? "en cours" : MISSING;
}

/**
 * Rend le texte de l'indicateur d'envoi, à côté du total (PRD #1, stories 39 et 40).
 *
 * @param count - Le nombre de jours en attente d'envoi.
 * @returns « Enregistré » quand aucun jour n'attend, « En attente d'envoi (n) » sinon.
 */
export function pendingText(count: number): string {
  return count === 0 ? "Enregistré" : `En attente d'envoi (${count})`;
}

/**
 * Rend la ligne sous le bouton du bas : la date du jour et l'heure courante.
 *
 * @example clockLine("2026-11-18", "09:05") // « mercredi 18 novembre · 09:05 »
 * @param date - La date `AAAA-MM-JJ` du jour.
 * @param time - L'heure courante `HH:MM`.
 * @throws {RangeError} si `date` n'est pas une date réelle, comme {@link dayLabel}.
 */
export function clockLine(date: string, time: string): string {
  return `${dayLabel(date)} · ${time}`;
}

/**
 * Rend l'indication, pour l'accessibilité, du geste qui corrige une heure d'un jour : le nom de
 * l'heure touchable reste son texte visible.
 *
 * @example editHint("arrivee", "2026-11-18") // « Modifier l'arrivée du mercredi 18 novembre »
 * @param field - L'heure à corriger.
 * @param date - La date `AAAA-MM-JJ` du jour.
 * @throws {RangeError} si `date` n'est pas une date réelle, comme {@link dayLabel}.
 */
export function editHint(field: TimeField, date: string): string {
  return `Modifier ${field === "arrivee" ? "l'arrivée" : "le départ"} du ${dayLabel(date)}`;
}
