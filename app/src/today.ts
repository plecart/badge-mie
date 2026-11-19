/**
 * Aujourd'hui et l'heure courante, lus sur l'horloge du téléphone, et l'instant d'une date à une
 * heure, pour le sélecteur d'heure. {@link today} et {@link currentTime} sont les deux seules
 * lectures de l'horloge de l'application : `@badge-mie/week` et le Pointage du jour reçoivent la
 * date et l'heure en argument et ne les lisent jamais.
 */

/** Écrit un nombre sur `length` chiffres, complété de zéros à gauche. */
function digits(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

/**
 * Rend la date du jour en heure locale, au format `AAAA-MM-JJ`.
 *
 * Les méthodes locales de `Date`, et non `toISOString`, qui écrit la date UTC : le soir, à l'ouest
 * de Greenwich, elle est déjà le lendemain.
 *
 * @param now - L'instant à dater ; l'instant présent par défaut.
 * @returns La date civile de `now` dans le fuseau du téléphone.
 */
export function today(now: Date = new Date()): string {
  return `${digits(now.getFullYear(), 4)}-${digits(now.getMonth() + 1, 2)}-${digits(now.getDate(), 2)}`;
}

/**
 * Rend l'heure courante en heure locale, à la minute, au format `HH:MM` : l'heure d'un pointage.
 *
 * Les méthodes locales de `Date`, comme {@link today} : l'heure pointée est celle que le téléphone
 * affiche. Les secondes sont tronquées, jamais arrondies.
 *
 * @example currentTime(new Date(2026, 10, 18, 8, 5, 59)) // « 08:05 »
 * @param now - L'instant à lire ; l'instant présent par défaut.
 * @returns L'heure de `now` dans le fuseau du téléphone, de `00:00` à `23:59`.
 */
export function currentTime(now: Date = new Date()): string {
  return `${digits(now.getHours(), 2)}:${digits(now.getMinutes(), 2)}`;
}

/**
 * Rend l'instant d'une date à une heure, en heure locale : l'inverse de {@link today} et de
 * {@link currentTime}, pour préremplir le sélecteur d'heure. Ne lit pas l'horloge.
 *
 * Le constructeur local de `Date`, comme {@link today} : une date-heure écrite en ISO sans fuseau
 * se lit en heure locale ou en UTC selon sa forme.
 *
 * @example currentTime(instantAt("2026-11-18", "08:05")) // « 08:05 »
 * @param date - Une date `AAAA-MM-JJ` réelle.
 * @param time - Une heure `HH:MM` de `00:00` à `23:59`.
 * @returns L'instant de `date` à `time`, secondes à zéro, dans le fuseau du téléphone.
 */
export function instantAt(date: string, time: string): Date {
  return new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    Number(time.slice(0, 2)),
    Number(time.slice(3, 5)),
  );
}
