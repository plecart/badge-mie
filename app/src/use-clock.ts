/**
 * L'horloge des écrans : la date du jour et l'heure courante, tenues à jour. Elles se relisent
 * par {@link today} et {@link currentTime}, les seules lectures de l'horloge de l'application
 * (issue #4, décision 9).
 */

import { useEffect, useState } from "react";
import { currentTime, today } from "./today";

/** L'intervalle de relecture de l'horloge. */
const READ_INTERVAL_MS = 1000;

/**
 * Rend la date du jour et l'heure courante, relues chaque seconde : l'écran suit le passage de la
 * minute et le changement de jour à une seconde près, et ne se redessine qu'à leur changement,
 * React ignorant un état remplacé par une valeur égale (`objectIs` de `dispatchSetStateInternal`,
 * `ReactFabric-prod.js` de react-native 0.88.1, lu le 2026-11-19).
 *
 * L'application passée en arrière-plan, Android suspend les minuteurs du JavaScript et les relance
 * au retour au premier plan (`onHostPause` / `onHostResume` de `JavaTimerManager.kt`,
 * react-native 0.88.1, lu le 2026-11-19) : l'horloge s'y relit aussitôt.
 *
 * @returns `date` au format `AAAA-MM-JJ` et `time` au format `HH:MM`, en heure locale.
 */
export function useClock(): { date: string; time: string } {
  const [date, setDate] = useState(() => today());
  const [time, setTime] = useState(() => currentTime());
  useEffect(() => {
    const timer = setInterval(() => {
      setDate(today());
      setTime(currentTime());
    }, READ_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return { date, time };
}
