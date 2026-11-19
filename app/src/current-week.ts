/**
 * La semaine en cours, suivie par l'écran de la semaine quand l'horloge passe à une nouvelle
 * semaine (ADR-0001, « Contexte » : « À l'ouverture, l'écran montre la semaine en cours »).
 */

/**
 * Rend le lundi à afficher quand la semaine en cours change : un écran qui affichait l'ancienne
 * semaine en cours passe à la nouvelle, un écran sur une semaine passée la garde.
 *
 * @param displayed - Le lundi `AAAA-MM-JJ` affiché.
 * @param previousCurrent - Le lundi de la semaine en cours d'avant le changement.
 * @param current - Le lundi de la semaine en cours d'à présent.
 * @returns `current` si `displayed` est `previousCurrent`, `displayed` sinon.
 */
export function followCurrentWeek(
  displayed: string,
  previousCurrent: string,
  current: string,
): string {
  return displayed === previousCurrent ? current : displayed;
}
