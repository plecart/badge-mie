/**
 * Le widget d'écran d'accueil (issue #20) : ce qu'il montre ({@link widgetModel}), et ce que fait
 * un toucher sur son bouton de pointage ({@link tapEffect}, {@link isStillShown},
 * {@link punchAt}). Module pur, sans React ni la bibliothèque du widget : son gestionnaire de
 * tâche lit le stockage, appelle ces fonctions, enregistre et dessine.
 *
 * Le widget lit les règles de l'app, il ne les recopie jamais : son bouton suit `punchButton` de
 * `./punch`, qui le grise un jour non travaillé — un congé l'y grisera sans toucher au widget
 * (issue #26) —, et son pointage `pressPunch` ; ses couleurs `punchColors` de `./palette`, ses
 * textes `./labels`, la date et l'heure `today` et `currentTime` de `./today`.
 *
 * Le bouton pointe en deux touchers (ADR-0001, « Propositions UX ») : le premier l'arme, le
 * second pointe s'il vient pendant l'affichage de l'état armé. Chaque toucher est une invocation
 * neuve du gestionnaire, et deux touchers rapprochés tournent en même temps (ADR-0002, « Essai sur
 * l'émulateur ») : l'état affiché du bouton, sa phase, se range donc dans le stockage, avec un
 * identifiant propre à chaque affichage ({@link WidgetPhase}).
 */

import { mondayOf } from "@badge-mie/week";
import {
  CONFIRM_LABELS,
  DEPARTURE_TOO_EARLY,
  MISSING,
  OPEN_APP,
  PUNCH_LABELS,
} from "./labels";
import { type ButtonColors, type PaletteToken, punchColors } from "./palette";
import {
  canPunch,
  type Outcome,
  pressPunch,
  type PunchButton,
  punchButton,
} from "./punch";
import { currentTime, today } from "./today";
import type { WeekView } from "./week-store";

/** Une phase du bouton autre que le repos : armé par un premier toucher, ou refus affiché. */
export type PhaseKind = "armed" | "refused";

/**
 * L'état affiché du bouton hors du repos, tel qu'il se range dans le stockage, sérialisable en
 * JSON ; le repos s'y range en `null`. Créée par {@link showPhase}.
 */
export interface WidgetPhase {
  kind: PhaseKind;
  /** L'instant de son affichage, en millisecondes depuis l'époque Unix (`Date.getTime`). */
  shownAt: number;
  /** Propre à cet affichage : un retour au repos différé n'efface que la phase qu'il a posée. */
  id: string;
}

/**
 * La durée d'affichage de chaque phase, en millisecondes, comptée depuis son affichage et non
 * depuis le toucher (issue #20, « Décisions ») : 3 s d'armement, pendant lesquelles un second
 * toucher pointe, et 3 s de refus affiché. Passée, la phase compte pour le repos.
 */
export const PHASE_MS: Record<PhaseKind, number> = {
  armed: 3000,
  refused: 3000,
};

/**
 * Rend une phase affichée à un instant, à ranger telle quelle.
 *
 * @example showPhase("armed", now) // { kind: "armed", shownAt: now.getTime(), id: "0.8394…" }
 * @param kind - La phase : `armed` ou `refused`.
 * @param now - L'instant de son affichage, celui du dessin qui la montre, et non du toucher.
 * @returns La phase, sous un identifiant tiré au hasard (`Math.random`), qui la distingue en
 *   pratique de toute autre phase, même affichée au même instant.
 */
export function showPhase(kind: PhaseKind, now: Date): WidgetPhase {
  return { kind, shownAt: now.getTime(), id: String(Math.random()) };
}

/**
 * La phase rangée si elle est encore affichée à `now`, `null` si elle a expiré — ou si elle se dit
 * affichée après `now`, l'horloge ayant reculé : sans cette borne, elle durerait le temps du recul
 * en plus de sa durée, et un toucher unique pointerait.
 */
function shownPhase(stored: WidgetPhase | null, now: Date): WidgetPhase | null {
  if (stored === null) return null;
  const elapsed = now.getTime() - stored.shownAt;
  return elapsed >= 0 && elapsed < PHASE_MS[stored.kind] ? stored : null;
}

/**
 * Ce que fait un toucher sur un élément du widget : passer au gestionnaire du bouton de pointage
 * (`punch`), qui décide par {@link tapEffect} ; ouvrir l'app (`openApp`) ; ou rien (`none`).
 */
export type WidgetTap = "punch" | "openApp" | "none";

/**
 * Le bouton de pointage du widget : ses couleurs, nommées par leur clé de palette pour se résoudre
 * dans les deux thèmes, son libellé, son bord, et ce que fait son toucher.
 */
export interface WidgetButton extends ButtonColors {
  label: string;
  /** La couleur du bord ; absente, le bouton n'a pas de bord. */
  border?: PaletteToken;
  tap: WidgetTap;
}

/** Ce que montre le widget, de gauche à droite. */
export interface WidgetModel {
  /** La couleur de la pastille d'envoi, sans texte. */
  dot: PaletteToken;
  /** L'arrivée du jour `HH:MM`, ou « — » ({@link MISSING}). */
  arrival: string;
  /** Le départ du jour `HH:MM`, ou « — ». */
  departure: string;
  button: WidgetButton;
}

/** Ce que lit le widget pour se dessiner. */
export interface WidgetState {
  /** La vue de la semaine de `now`. */
  view: WeekView;
  /** L'instant du dessin : la date du jour s'y lit, et la phase y expire. */
  now: Date;
  /** Le nombre de jours en attente d'envoi. */
  pending: number;
  /** Vrai si le jeton est saisi. */
  hasToken: boolean;
  /** La phase rangée, ou `null` au repos ; expirée à `now`, elle compte pour le repos. */
  phase: WidgetPhase | null;
}

/**
 * Rend ce que montre le widget : la pastille d'envoi, l'arrivée et le départ du jour, et le bouton
 * de pointage, actif, grisé ou éteint comme celui de l'app ({@link punchButton}), sur ses couleurs
 * ({@link punchColors}). Armé, le bouton inverse ses couleurs : le fond prend celle du libellé, le
 * libellé et le bord celle du fond (issue #20, « Double toucher »).
 *
 * Hypothèse retenue sur la phrase « Un jour grisé, l'état armé se lit à son texte » du critère
 * « Double toucher », à montrer au mainteneur à l'arrêt visuel : un jour grisé, le bouton armé
 * garde ses couleurs grisées, sans bord, et seul son texte change.
 *
 * @example // Le mercredi 25 novembre 2026 à 9 h, arrivée à 08:52, rien en attente d'envoi :
 *   widgetModel({ view, now, pending: 0, hasToken: true, phase: null })
 *   // { dot: "accent", arrival: "08:52", departure: "—",
 *   //   button: { label: "Pointer le départ", background: "accent", color: "accentInk",
 *   //             tap: "punch" } }
 * @param state - Ce que lit le widget ({@link WidgetState}).
 * @returns La pastille en `accent` quand aucun jour n'attend l'envoi, en `pending` sinon ; les
 *   heures du jour, « — » pour une heure vide ou une journée inconnue ; le bouton : « Ouvrir
 *   l'app » sans jeton, aux couleurs d'un bouton actif, grisé ou non, même sur une journée
 *   terminée ; sinon celui de l'app au repos, armé ou refusé selon la phase encore affichée à
 *   `now` — une phase ne change rien au bouton éteint.
 * @throws {RangeError} si `now` n'est pas un instant valide (`new Date(NaN)`), comme `mondayOf`
 *   de `@badge-mie/week`.
 */
export function widgetModel({
  view,
  now,
  pending,
  hasToken,
  phase,
}: WidgetState): WidgetModel {
  const date = today(now);
  const day = view.days?.find((candidate) => candidate.jour === date);
  return {
    dot: pending === 0 ? "accent" : "pending",
    arrival: day?.arrivee ?? MISSING,
    departure: day?.depart ?? MISSING,
    button: buttonOf(
      punchButton(view, mondayOf(date), date),
      hasToken,
      shownPhase(phase, now),
    ),
  };
}

/**
 * Le bouton du widget.
 *
 * @param button - Le bouton de pointage de l'app, aujourd'hui.
 * @param hasToken - Vrai si le jeton est saisi ; sans lui, le bouton ouvre l'app.
 * @param phase - La phase encore affichée, ou `null` au repos.
 */
function buttonOf(
  button: PunchButton,
  hasToken: boolean,
  phase: WidgetPhase | null,
): WidgetButton {
  const { action } = button;
  if (!hasToken) {
    // « Ouvrir l'app » agit : les couleurs d'un bouton actif, jamais celles d'un bouton éteint.
    const active = punchColors({ enabled: true, muted: button.muted });
    return { label: OPEN_APP, ...active, tap: "openApp" };
  }
  const colors = punchColors(button);
  // `enabled` implique `canPunch(action)`, que seul ce second test apprend au typage.
  if (!button.enabled || !canPunch(action)) {
    return { label: PUNCH_LABELS[action], ...colors, tap: "none" };
  }
  if (phase?.kind === "armed") {
    const armed = button.muted ? colors : inverted(colors);
    return { label: CONFIRM_LABELS[action], ...armed, tap: "punch" };
  }
  const label =
    phase?.kind === "refused" ? DEPARTURE_TOO_EARLY : PUNCH_LABELS[action];
  return { label, ...colors, tap: "punch" };
}

/** Les couleurs inversées du bouton armé, que décrit {@link widgetModel}. */
function inverted({ background, color }: ButtonColors): ButtonColors & {
  border: PaletteToken;
} {
  return { background: color, color: background, border: background };
}

/** Ce que fait un toucher sur le bouton de pointage actif : l'armer, ou pointer. */
export type TapEffect = "arm" | "punch";

/**
 * Rend ce que fait un toucher sur le bouton de pointage actif : il pointe s'il vient pendant
 * l'affichage de l'état armé, moins de {@link PHASE_MS} `armed` après lui ; sinon il arme.
 *
 * @example tapEffect(showPhase("armed", shown), new Date(shown.getTime() + 2999)) // "punch"
 * @param stored - La phase rangée, ou `null` au repos.
 * @param now - L'instant du toucher.
 * @returns `punch` pendant l'état armé ; `arm` au repos, après l'expiration de l'état armé — un
 *   toucher plus tard réarme sans pointer —, avant son affichage rangé — l'horloge a reculé —,
 *   et pendant un refus affiché.
 */
export function tapEffect(stored: WidgetPhase | null, now: Date): TapEffect {
  return shownPhase(stored, now)?.kind === "armed" ? "punch" : "arm";
}

/**
 * Dit si un retour au repos différé s'applique encore : deux touchers rapprochés tournent en même
 * temps, et le retour au repos du premier ne doit pas effacer la phase que le second a posée
 * (ADR-0002, « Essai sur l'émulateur »).
 *
 * @example const posted = showPhase("armed", now);
 *   isStillShown(posted, posted) // true
 *   isStillShown(showPhase("armed", now), posted) // false : un autre toucher a rangé la sienne
 * @param stored - La phase rangée au terme du délai, ou `null` au repos.
 * @param posted - La phase que l'invocation a posée, et qu'elle s'apprête à effacer.
 * @returns `true` si la phase rangée est `posted`, reconnue à son identifiant, même relue du
 *   stockage ; `false` si une autre l'a remplacée, ou si le bouton est déjà au repos.
 */
export function isStillShown(
  stored: WidgetPhase | null,
  posted: WidgetPhase,
): boolean {
  return stored?.id === posted.id;
}

/**
 * Pointe aujourd'hui sur un toucher qui confirme l'état armé, comme le bouton de l'app
 * ({@link pressPunch}) : la date et l'heure se lisent sur l'instant du toucher, jamais sur la
 * date qu'affiche le widget, qui peut avoir jusqu'à 30 min de retard (issue #20, « Décisions »).
 *
 * @example punchAt(view, new Date(2026, 10, 25, 8, 52, 40))
 *   // { day: { jour: "2026-11-25", arrivee: "08:52", depart: null } }
 * @param view - La vue de la semaine de `now`, celle du lundi `mondayOf(today(now))`.
 * @param now - L'instant du toucher.
 * @returns `{ day }`, la journée pointée à enregistrer par la File d'envoi ; `{ refusal }`, un
 *   pointage refusé, qui ne change aucune heure et s'affiche ({@link showPhase} `refused`) ; ou
 *   `null`, rien à pointer — journée terminée, ou `view` lue d'une autre semaine que celle de
 *   `now` ; une semaine jamais lue et injoignable se pointe comme la semaine de `now` : l'appelant
 *   charge celle-ci.
 * @throws {RangeError} si `now` n'est pas un instant valide (`new Date(NaN)`), comme `mondayOf`
 *   de `@badge-mie/week`.
 */
export function punchAt(view: WeekView, now: Date): Outcome | null {
  const date = today(now);
  const press = pressPunch(view, mondayOf(date), date, currentTime(now));
  return press?.outcome ?? null;
}
