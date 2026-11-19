/**
 * Aujourd'hui, lu sur l'horloge du téléphone. C'est la seule lecture de l'horloge de l'application :
 * `@badge-mie/week` reçoit la date du jour en argument et ne la lit jamais.
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
