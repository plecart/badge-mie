/**
 * L'appui maintenu du bouton de pointage (ADR-0001, « Propositions UX ») : sa durée, et le rythme
 * de sa progression, une fraction de 0 (vide) à 1 (appui abouti), qui se remplit pendant l'appui et
 * revient en arrière quand il s'interrompt, puis ce que déclenche sa fin. Module pur :
 * `./HoldButton` la dessine.
 */

/**
 * La durée d'un appui maintenu qui pointe : environ 1 s (issue #14, décision du 2026-11-19 à
 * l'arrêt visuel de la PR #16).
 */
const HOLD_MS = 1000;

/** Combien de fois plus vite la progression revient en arrière qu'elle ne s'est remplie. */
const REWIND_SPEEDUP = 3;

/**
 * Rend le temps qu'il reste à maintenir l'appui depuis une progression, à vitesse constante : un
 * appui repris pendant le retour en arrière repart d'où elle en est.
 *
 * @param progress - La progression au début de l'appui, de 0 à 1.
 */
export function fillMs(progress: number): number {
  return (1 - progress) * HOLD_MS;
}

/**
 * Rend la durée du retour en arrière depuis une progression, trois fois plus court que son
 * remplissage.
 *
 * @param progress - La progression au moment où l'appui s'interrompt, de 0 à 1.
 */
export function rewindMs(progress: number): number {
  return (progress * HOLD_MS) / REWIND_SPEEDUP;
}

/**
 * Rend le rappel de fin d'une animation de la progression, qui n'appelle `onEnd` que si elle est
 * allée au bout : arrêtée avant — appui interrompu, autre animation lancée, bouton démonté —, elle
 * ne déclenche rien.
 *
 * @param onEnd - Ce que déclenche la progression allée au bout.
 */
export function whenFinished(
  onEnd: () => void,
): (result: { finished: boolean }) => void {
  return ({ finished }) => {
    if (finished) onEnd();
  };
}
