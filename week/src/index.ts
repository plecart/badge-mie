/**
 * Calendrier de semaine : la logique pure de l'écran de la semaine, partagée par l'API et
 * l'application.
 *
 * Conventions : une date est une chaîne `AAAA-MM-JJ`, une heure une chaîne `HH:MM`. Tous les
 * calculs de date se font en UTC, si bien qu'aucun résultat ne dépend du fuseau de la machine.
 * Le module ne lit jamais l'horloge : « aujourd'hui » arrive en argument.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Du lundi au vendredi. */
const WORKDAYS = 5;

/**
 * Formate un instant UTC en date `AAAA-MM-JJ`.
 *
 * @param time - Millisecondes depuis l'époque Unix.
 */
function formatDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Minuit UTC d'une date civile.
 *
 * `setUTCFullYear` et non `Date.UTC`, qui décale les années 0 à 99 en 1900 à 1999.
 *
 * @param month - Le mois, de 1 à 12. Un mois ou un jour hors bornes déborde sur le mois ou
 *   l'année voisins, sans erreur.
 */
function utcDate(year: number, month: number, day: number): number {
  return new Date(0).setUTCFullYear(year, month - 1, day);
}

/**
 * Minuit UTC d'une date `AAAA-MM-JJ`.
 *
 * Le format est vérifié par expression régulière, puis la date reconstruite est comparée au
 * texte d'origine : un jour ou un mois hors bornes (`2026-02-30`) serait sinon reporté au mois
 * suivant (voir {@link utcDate}).
 *
 * @param date - Le texte à lire.
 * @returns L'instant en millisecondes, ou `undefined` si le texte n'est pas une date réelle.
 */
function tryParseDate(date: string): number | undefined {
  const match = ISO_DATE.exec(date);
  if (!match) return undefined;
  const time = utcDate(Number(match[1]), Number(match[2]), Number(match[3]));
  return formatDate(time) === date ? time : undefined;
}

/**
 * Dit si un texte est une date réelle au format `AAAA-MM-JJ`.
 *
 * À appeler à une frontière de confiance (paramètre de route, saisie) avant tout calcul : les
 * autres fonctions lèvent sur une date invalide.
 *
 * @param value - Le texte à vérifier.
 * @returns `true` pour une date réelle du calendrier grégorien, écrite `AAAA-MM-JJ` avec le mois
 *   et le jour sur deux chiffres ; `false` pour un autre format (`16-11-2026`, `2026-1-5`) ou
 *   une date qui n'existe pas (`2026-02-30`, `2026-13-01`, `2025-02-29`).
 */
export function isIsoDate(value: string): boolean {
  return tryParseDate(value) !== undefined;
}

/**
 * Minuit UTC d'une date `AAAA-MM-JJ` réelle.
 *
 * Toute fonction publique qui calcule sur une date passe par ici : une date invalide lève au
 * lieu de produire un résultat faux en silence.
 *
 * @throws {RangeError} si `date` n'est pas une date réelle (voir {@link isIsoDate}).
 */
function parseDate(date: string): number {
  const time = tryParseDate(date);
  if (time === undefined) {
    throw new RangeError(`date invalide : « ${date} », attendu AAAA-MM-JJ`);
  }
  return time;
}

/** Minuit UTC du lundi de la semaine qui contient l'instant `time` (lui-même un minuit UTC). */
function mondayTime(time: number): number {
  const daysSinceMonday = (new Date(time).getUTCDay() + 6) % 7;
  return time - daysSinceMonday * DAY_MS;
}

/**
 * Rend le lundi de la semaine (lundi → dimanche) qui contient une date.
 *
 * @param date - Une date `AAAA-MM-JJ` réelle, de n'importe quel jour de la semaine.
 * @returns Le lundi `AAAA-MM-JJ` : la date elle-même si c'est un lundi, six jours plus tôt si
 *   c'est un dimanche. Il peut tomber dans le mois ou l'année d'avant (`2027-01-01` →
 *   `2026-12-28`).
 * @throws {RangeError} si `date` n'est pas une date réelle.
 */
export function mondayOf(date: string): string {
  return formatDate(mondayTime(parseDate(date)));
}

/** Vrai si l'instant `time`, un minuit UTC, tombe un lundi. */
function isMondayTime(time: number): boolean {
  return mondayTime(time) === time;
}

/**
 * Dit si un texte est un lundi réel au format `AAAA-MM-JJ`.
 *
 * À appeler à une frontière de confiance, comme {@link isIsoDate} : {@link weekDates} et
 * {@link weekDays} lèvent sur un autre jour.
 *
 * @param value - Le texte à vérifier.
 * @returns `true` pour un lundi ; `false` pour un autre jour ou pour un texte qui n'est pas une
 *   date réelle (voir {@link isIsoDate}).
 */
export function isMonday(value: string): boolean {
  const time = tryParseDate(value);
  return time !== undefined && isMondayTime(time);
}

/**
 * Minuit UTC d'un lundi `AAAA-MM-JJ` réel.
 *
 * @throws {RangeError} si `monday` n'est pas une date réelle, ou pas un lundi.
 */
function parseMonday(monday: string): number {
  const time = parseDate(monday);
  if (!isMondayTime(time)) {
    throw new RangeError(`lundi invalide : « ${monday} », attendu un lundi`);
  }
  return time;
}

/**
 * Rend le numéro de semaine ISO 8601 d'une date.
 *
 * La semaine ISO commence le lundi, et la semaine 1 est celle qui contient le premier jeudi de
 * janvier : une semaine appartient à l'année de son jeudi.
 *
 * @param date - Une date `AAAA-MM-JJ` réelle.
 * @returns Un entier de 1 à 53. Les premiers jours de janvier peuvent appartenir à la dernière
 *   semaine de l'année d'avant, et les derniers jours de décembre à la semaine 1 de la suivante.
 * @throws {RangeError} si `date` n'est pas une date réelle.
 */
export function isoWeek(date: string): number {
  const thursday = mondayTime(parseDate(date)) + 3 * DAY_MS;
  const januaryFirst = utcDate(new Date(thursday).getUTCFullYear(), 1, 1);
  return Math.floor((thursday - januaryFirst) / (7 * DAY_MS)) + 1;
}

/**
 * Rend les dates des jours ouvrés d'une semaine, du lundi au vendredi.
 *
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine, tel que le rend {@link mondayOf}.
 * @returns Cinq dates `AAAA-MM-JJ` consécutives, qui peuvent changer de mois ou d'année.
 * @throws {RangeError} si `monday` n'est pas une date réelle, ou pas un lundi.
 */
export function weekDates(monday: string): string[] {
  const start = parseMonday(monday);
  return Array.from({ length: WORKDAYS }, (_, index) =>
    formatDate(start + index * DAY_MS),
  );
}

/** Un jour ouvré de la semaine affichée, situé par rapport à aujourd'hui. */
export interface WeekDay {
  /** La date `AAAA-MM-JJ`. */
  date: string;
  /** Vrai pour le seul jour égal à aujourd'hui. */
  isToday: boolean;
  /** Vrai pour un jour postérieur à aujourd'hui. */
  isFuture: boolean;
}

/**
 * Rend les jours ouvrés d'une semaine, du lundi au vendredi, situés par rapport à aujourd'hui.
 *
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine, tel que le rend {@link mondayOf}.
 * @param today - La date `AAAA-MM-JJ` du jour, lue sur l'horloge par l'appelant.
 * @returns Cinq jours consécutifs. Dans une semaine passée, aucun n'est marqué ; un samedi ou un
 *   dimanche, la semaine en cours non plus.
 * @throws {RangeError} si `monday` n'est pas un lundi réel, ou `today` pas une date réelle.
 */
export function weekDays(monday: string, today: string): WeekDay[] {
  const dates = weekDates(monday);
  // `today` n'est lu que pour être validé : deux dates `AAAA-MM-JJ` s'ordonnent comme leur texte.
  parseDate(today);
  return dates.map((date) => ({
    date,
    isToday: date === today,
    isFuture: date > today,
  }));
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HOUR_MINUTES = 60;

/**
 * Minutes écoulées depuis minuit pour une heure `HH:MM`.
 *
 * @throws {RangeError} si `time` n'est pas une heure de `00:00` à `23:59` écrite `HH:MM`, sans
 *   secondes.
 */
function minutesOf(time: string): number {
  const match = TIME.exec(time);
  if (!match) {
    throw new RangeError(`heure invalide : « ${time} », attendu HH:MM`);
  }
  return Number(match[1]) * HOUR_MINUTES + Number(match[2]);
}

/**
 * Rend la durée de présence d'un jour, de l'arrivée au départ.
 *
 * L'ordre des deux heures n'est pas vérifié : la table `presence` impose déjà
 * `depart > arrivee`.
 *
 * @param arrival - L'heure d'arrivée `HH:MM`, ou `null` si elle n'est pas pointée.
 * @param departure - L'heure de départ `HH:MM`, ou `null` si elle n'est pas pointée.
 * @returns La durée en minutes, ou `null` si l'une des deux heures manque : un jour incomplet
 *   n'a pas de durée.
 * @throws {RangeError} si une heure présente n'est pas une heure `HH:MM` valide.
 */
export function dayDuration(
  arrival: string | null,
  departure: string | null,
): number | null {
  if (arrival === null || departure === null) return null;
  return minutesOf(departure) - minutesOf(arrival);
}

/**
 * Rend le total de présence d'une semaine.
 *
 * @param durations - Les durées des jours, telles que les rend {@link dayDuration} : les jours
 *   incomplets (`null`) ne comptent pas.
 * @returns La somme en minutes, `0` si aucun jour n'est complet.
 */
export function weekTotal(durations: readonly (number | null)[]): number {
  return durations.reduce<number>(
    (total, minutes) => total + (minutes ?? 0),
    0,
  );
}

/**
 * Écrit une durée en heures et minutes, minutes sur deux chiffres : 425 → « 7 h 05 ».
 *
 * @param minutes - Un nombre entier de minutes, positif ou nul.
 * @returns Le texte `H h MM` ; les heures ne passent jamais en jours (2400 → « 40 h 00 »).
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / HOUR_MINUTES);
  const rest = minutes % HOUR_MINUTES;
  return `${hours} h ${String(rest).padStart(2, "0")}`;
}
