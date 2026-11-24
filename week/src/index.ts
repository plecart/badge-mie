/**
 * Calendrier de semaine : la logique pure de l'écran de la semaine et la journée de présence,
 * partagées par l'API et l'application.
 *
 * Conventions : une date est une chaîne `AAAA-MM-JJ`, une heure une chaîne `HH:MM`. Tous les
 * calculs de date se font en UTC, si bien qu'aucun résultat ne dépend du fuseau de la machine.
 * Le module ne lit jamais l'horloge : « aujourd'hui » arrive en argument.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Le nombre de jours d'une semaine, du lundi au dimanche. */
const WEEK_DAYS = 7;
const WEEK_MS = WEEK_DAYS * DAY_MS;

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
  return Math.floor((thursday - januaryFirst) / WEEK_MS) + 1;
}

/**
 * Rend les dates des jours d'une semaine, du lundi au dimanche.
 *
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine, tel que le rend {@link mondayOf}.
 * @returns Sept dates `AAAA-MM-JJ` consécutives, qui peuvent changer de mois ou d'année.
 * @throws {RangeError} si `monday` n'est pas une date réelle, ou pas un lundi.
 */
export function weekDates(monday: string): string[] {
  const start = parseMonday(monday);
  return Array.from({ length: WEEK_DAYS }, (_, index) =>
    formatDate(start + index * DAY_MS),
  );
}

/**
 * Rend le lundi d'une autre semaine, pour passer d'une semaine à la suivante ou à la précédente.
 *
 * @param monday - Le lundi `AAAA-MM-JJ` de départ, tel que le rend {@link mondayOf}.
 * @param weeks - Le nombre de semaines, négatif pour reculer.
 * @returns Le lundi `AAAA-MM-JJ` décalé, qui peut changer de mois ou d'année.
 * @throws {RangeError} si `monday` n'est pas une date réelle, ou pas un lundi.
 */
export function addWeeks(monday: string, weeks: number): string {
  return formatDate(parseMonday(monday) + weeks * WEEK_MS);
}

/** Le dimanche et le samedi, tels que les numérote `getUTCDay`. */
const SUNDAY = 0;
const SATURDAY = 6;

/** Les jours de la semaine en toutes lettres, dans l'ordre de `getUTCDay` : dimanche d'abord. */
const WEEKDAY_NAMES = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

/** Les mois en toutes lettres, de janvier à décembre. */
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Les mois abrégés, de janvier à décembre ; les mois courts restent entiers. */
const SHORT_MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/**
 * Entre les deux bornes d'une plage : un tiret demi-cadratin (U+2013), entouré d'espaces
 * ordinaires.
 */
const RANGE_SEPARATOR = " – ";

/** Le jour et le mois en toutes lettres d'une date UTC : « 4 décembre ». */
function longDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** Le jour et le mois abrégé d'une date UTC : « 4 déc. ». */
function shortDate(date: Date): string {
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]}`;
}

/**
 * Rend le libellé de la plage d'une semaine, du lundi au dimanche, pour l'en-tête de l'écran.
 *
 * Le mois s'écrit en toutes lettres une seule fois quand la semaine tient dans un mois, et en
 * abrégé à chaque borne sinon ; l'année n'est jamais écrite.
 *
 * @example weekRangeLabel("2026-11-16") // « 16 – 22 novembre »
 * @example weekRangeLabel("2026-11-30") // « 30 nov. – 6 déc. »
 * @example weekRangeLabel("2026-12-28") // « 28 déc. – 3 janv. »
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine, tel que le rend {@link mondayOf}.
 * @throws {RangeError} si `monday` n'est pas une date réelle, ou pas un lundi.
 */
export function weekRangeLabel(monday: string): string {
  const start = new Date(parseMonday(monday));
  const end = new Date(start.getTime() + WEEK_MS - DAY_MS);
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${start.getUTCDate()}${RANGE_SEPARATOR}${longDate(end)}`;
  }
  return `${shortDate(start)}${RANGE_SEPARATOR}${shortDate(end)}`;
}

/**
 * Rend le libellé d'un jour, pour la date affichée sous le bouton de pointage.
 *
 * Le jour de la semaine et le mois s'écrivent en toutes lettres et en minuscules, le numéro sans
 * zéro ; l'année n'est jamais écrite. Tous les jours ont un libellé, le week-end compris.
 *
 * @example dayLabel("2026-11-18") // « mercredi 18 novembre »
 * @example dayLabel("2025-12-01") // « lundi 1 décembre »
 * @param date - Une date `AAAA-MM-JJ` réelle, de n'importe quel jour de la semaine.
 * @throws {RangeError} si `date` n'est pas une date réelle.
 */
export function dayLabel(date: string): string {
  const day = new Date(parseDate(date));
  return `${WEEKDAY_NAMES[day.getUTCDay()]} ${longDate(day)}`;
}

/**
 * Les jours fériés à date fixe, `[mois, jour]` : jour de l'an, fête du Travail, victoire de 1945,
 * fête nationale, Assomption, Toussaint, armistice de 1918 et Noël.
 */
const FIXED_HOLIDAYS = [
  [1, 1],
  [5, 1],
  [5, 8],
  [7, 14],
  [8, 15],
  [11, 1],
  [11, 11],
  [12, 25],
] as const;

/**
 * Les jours fériés mobiles, en jours après le dimanche de Pâques : lundi de Pâques, Ascension et
 * lundi de Pentecôte.
 */
const EASTER_OFFSETS = [1, 39, 50];

/**
 * Minuit UTC du dimanche de Pâques d'une année du calendrier grégorien, par l'algorithme
 * grégorien anonyme (Meeus/Jones/Butcher), écrit avec ses variables à une lettre.
 */
function easterTime(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return utcDate(year, Math.floor(n / 31), (n % 31) + 1);
}

/**
 * Rend les jours fériés nationaux français d'une année : les huit à date fixe, et les trois qui
 * suivent Pâques. Les fériés propres à l'Alsace-Moselle (Vendredi saint, 26 décembre) n'y sont
 * pas.
 *
 * @example holidays(2026) // ["2026-01-01", "2026-04-06", "2026-05-01", …, "2026-12-25"]
 * @param year - L'année du calendrier grégorien.
 * @returns Onze dates `AAAA-MM-JJ`, dans l'ordre du calendrier.
 */
export function holidays(year: number): string[] {
  const easter = easterTime(year);
  return [
    ...FIXED_HOLIDAYS.map(([month, day]) =>
      formatDate(utcDate(year, month, day)),
    ),
    ...EASTER_OFFSETS.map((days) => formatDate(easter + days * DAY_MS)),
  ].sort();
}

/** Vrai si l'instant `time`, un minuit UTC, tombe un samedi ou un dimanche. */
function isWeekendTime(time: number): boolean {
  const weekday = new Date(time).getUTCDay();
  return weekday === SATURDAY || weekday === SUNDAY;
}

/** Vrai si l'instant `time`, un minuit UTC, tombe un jour férié (voir {@link holidays}). */
function isHolidayTime(time: number): boolean {
  return holidays(new Date(time).getUTCFullYear()).includes(formatDate(time));
}

/**
 * Dit si un texte est un jour non travaillé réel au format `AAAA-MM-JJ` : un samedi, un dimanche
 * ou un jour férié ({@link holidays}). C'est le prédicat du jour grisé, pour l'application comme
 * pour le widget (issue #20) ; l'issue #26 y ajoutera les congés.
 *
 * À appeler à une frontière de confiance, comme {@link isIsoDate} : elle ne lève sur aucun
 * texte.
 *
 * @param value - Le texte à vérifier.
 * @returns `true` pour un samedi, un dimanche ou un férié ; `false` pour un autre jour, ou pour
 *   un texte qui n'est pas une date réelle (voir {@link isIsoDate}).
 */
export function isNonWorkingDay(value: string): boolean {
  const time = tryParseDate(value);
  return time !== undefined && (isWeekendTime(time) || isHolidayTime(time));
}

/** Un jour de la semaine affichée, situé par rapport à aujourd'hui. */
export interface WeekDay {
  /** La date `AAAA-MM-JJ`. */
  date: string;
  /** Vrai pour le seul jour égal à aujourd'hui. */
  isToday: boolean;
  /** Vrai pour un jour postérieur à aujourd'hui. */
  isFuture: boolean;
  /** Vrai pour un jour non travaillé : samedi, dimanche ou férié (voir {@link isNonWorkingDay}). */
  isNonWorking: boolean;
}

/**
 * Rend les jours d'une semaine, du lundi au dimanche, situés par rapport à aujourd'hui, chacun
 * dit travaillé ou non.
 *
 * @param monday - Le lundi `AAAA-MM-JJ` de la semaine, tel que le rend {@link mondayOf}.
 * @param today - La date `AAAA-MM-JJ` du jour, lue sur l'horloge par l'appelant.
 * @returns Sept jours consécutifs. Dans une semaine passée, aucun n'est aujourd'hui ni à venir.
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
    isNonWorking: isNonWorkingDay(date),
  }));
}

/**
 * Une journée de présence, la valeur échangée partout, de la table `presence` à l'application
 * (PRD #1, « Interactions », « Journée »). Une heure non pointée vaut `null`.
 */
export interface PresenceDay {
  /** La date `AAAA-MM-JJ`. */
  jour: string;
  /** L'heure d'arrivée `HH:MM`. */
  arrivee: string | null;
  /** L'heure de départ `HH:MM`. */
  depart: string | null;
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HOUR_MINUTES = 60;

/**
 * Dit si un texte est une heure au format `HH:MM`.
 *
 * À appeler à une frontière de confiance, comme {@link isIsoDate} : {@link dayDuration} et
 * {@link departureFollowsArrival} lèvent sur une autre heure.
 *
 * @param value - Le texte à vérifier.
 * @returns `true` pour une heure de `00:00` à `23:59`, l'heure et les minutes sur deux chiffres ;
 *   `false` pour une heure avec secondes (`08:00:00`), sur un chiffre (`8:00`) ou hors bornes
 *   (`24:00`, `07:60`).
 */
export function isTime(value: string): boolean {
  return TIME.test(value);
}

/**
 * Dit si une valeur est une heure de {@link PresenceDay} : une heure `HH:MM`, ou `null` pour une
 * heure non pointée. À appeler avant de tenir pour telle une valeur décodée d'un JSON (corps de
 * requête, réponse du serveur, état local) ou un argument reçu.
 *
 * @param value - La valeur à vérifier, de n'importe quel type.
 * @returns `true` pour `null` ou une heure qu'admet {@link isTime} ; `false` pour toute autre
 *   valeur, `undefined`, un nombre ou un tableau compris.
 */
export function isTimeOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && isTime(value));
}

/**
 * Dit si une valeur est la journée de présence d'une date, comme {@link isTimeOrNull} pour une
 * heure : à appeler avant de tenir pour telle une valeur décodée d'un JSON.
 *
 * @param value - La valeur à vérifier, de n'importe quel type.
 * @param date - La date que la journée doit porter.
 * @returns `true` pour un objet dont `jour` vaut `date`, date réelle ({@link isIsoDate}), et dont
 *   `arrivee` et `depart` passent {@link isTimeOrNull} ; `false` pour toute autre valeur.
 */
export function isPresenceDay(
  value: unknown,
  date: string,
): value is PresenceDay {
  if (typeof value !== "object" || value === null) return false;
  const { jour, arrivee, depart } = value as Record<string, unknown>;
  return (
    jour === date &&
    isIsoDate(date) &&
    isTimeOrNull(arrivee) &&
    isTimeOrNull(depart)
  );
}

/** Rend la journée `jour` sans aucune heure pointée. */
export function emptyDay(jour: string): PresenceDay {
  return { jour, arrivee: null, depart: null };
}

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
 * L'ordre des deux heures n'est pas vérifié ici, mais par {@link departureFollowsArrival} : sur
 * un départ égal ou antérieur à l'arrivée, la durée sort nulle ou négative.
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
 * Dit si le départ d'une journée suit son arrivée : la règle d'ordre de la table `presence`,
 * `check (arrivee is null or depart is null or depart > arrivee)` (ADR-0001, « Décision »,
 * point 5). Toute vérification de l'ordre de deux heures passe par ici, pour qu'il n'y ait
 * qu'une règle.
 *
 * @example departureFollowsArrival("08:30", "17:00") // true
 * @example departureFollowsArrival("09:00", "09:00") // false
 * @example departureFollowsArrival(null, "17:00") // true
 * @param arrival - L'heure d'arrivée `HH:MM`, ou `null` si elle n'est pas pointée.
 * @param departure - L'heure de départ `HH:MM`, ou `null` si elle n'est pas pointée.
 * @returns `true` si l'une des deux heures manque, ou si le départ est strictement postérieur à
 *   l'arrivée, à la minute ; `false` pour un départ égal ou antérieur à l'arrivée.
 * @throws {RangeError} si les deux heures sont présentes et que l'une n'est pas une heure
 *   `HH:MM` valide, comme {@link dayDuration}.
 */
export function departureFollowsArrival(
  arrival: string | null,
  departure: string | null,
): boolean {
  const minutes = dayDuration(arrival, departure);
  return minutes === null || minutes > 0;
}

/**
 * La durée d'une journée de travail, 8 h 30, en minutes (ADR-0001, « Décision », point 5) : le
 * crédit d'un jour férié non pointé du lundi au vendredi ({@link dayMinutes}).
 */
export const WORKDAY_MINUTES = 510;

/**
 * Rend ce que compte un jour dans le total de la semaine (ADR-0001, « Décision », point 5).
 *
 * Un férié du lundi au vendredi sans aucune heure pointée compte une journée de travail. Dès
 * qu'une heure y est posée, il compte comme un jour normal, ses heures réelles. Un samedi ou un
 * dimanche, même férié, ne compte que ses heures pointées.
 *
 * @param day - La journée de présence.
 * @returns {@link WORKDAY_MINUTES} pour un férié du lundi au vendredi dont `arrivee` et `depart`
 *   valent `null` ; sinon la durée que rend {@link dayDuration}, `null` pour un jour incomplet.
 * @throws {RangeError} si `day.jour` n'est pas une date réelle, ou si une heure présente n'est
 *   pas une heure `HH:MM` valide.
 */
export function dayMinutes(day: PresenceDay): number | null {
  const time = parseDate(day.jour);
  const unpunched = day.arrivee === null && day.depart === null;
  if (unpunched && !isWeekendTime(time) && isHolidayTime(time)) {
    return WORKDAY_MINUTES;
  }
  return dayDuration(day.arrivee, day.depart);
}

/**
 * Rend le total de présence d'une semaine.
 *
 * @param durations - Ce que compte chaque jour, tel que le rend {@link dayMinutes} : les jours
 *   qui ne comptent rien (`null`) n'ajoutent rien.
 * @returns La somme en minutes, `0` si aucun jour ne compte.
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
