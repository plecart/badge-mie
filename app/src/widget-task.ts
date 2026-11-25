/**
 * Le gestionnaire de tâche du widget d'écran d'accueil (issue #20), à dépendances injectées :
 * stockage, coffre du jeton, envoi d'une journée, horloge, attente et dessin. Son adaptateur,
 * `./widget-handler`, y branche ceux de l'app ; ce module ne connaît ni React ni la bibliothèque
 * du widget, hormis le type de ce qu'elle passe au gestionnaire.
 *
 * Chaque événement du widget est une invocation neuve (ADR-0002, « Essai sur l'émulateur ») :
 * - un ajout, une mise à jour ou un redimensionnement le dessine ({@link currentModel}) ;
 * - un toucher du bouton de pointage l'arme ou pointe ({@link tapEffect}), sur la semaine de
 *   l'instant du toucher, par la File d'envoi de l'app ;
 * - les autres touchers, sur une heure ou sur « Ouvrir l'app », ouvrent l'app sans invocation :
 *   la bibliothèque traite `OPEN_APP` en natif ({@link CLICK_ACTIONS}).
 *
 * Le widget ne lit jamais le serveur : il dessine l'état local de la semaine, les jours en attente
 * d'envoi par-dessus, comme l'app hors réseau. Seul l'envoi d'un pointage le contacte.
 */

import { mondayOf, type PresenceDay } from "@badge-mie/week";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { REQUEST_TIMEOUT_MS, ServerUnreachableError } from "./api";
import { createSendQueue, readPendingDays } from "./send-queue";
import { today } from "./today";
import {
  isStillShown,
  PHASE_MS,
  type PhaseKind,
  punchAt,
  showPhase,
  tapEffect,
  type WidgetModel,
  type WidgetPhase,
  type WidgetState,
  type WidgetTap,
  widgetModel,
} from "./widget";
import { type KeyValueStorage, loadWeek, type WeekView } from "./week-store";

/** Le nom du widget, celui que déclare le plugin de la bibliothèque dans `app.json`. */
export const WIDGET_NAME = "Today";

/** L'action d'un toucher sur le bouton de pointage, que le gestionnaire reçoit. */
export const PUNCH_CLICK = "PUNCH";

/**
 * L'action que porte une zone touchable du widget, selon ce que fait son toucher : le bouton de
 * pointage appelle le gestionnaire ({@link PUNCH_CLICK}) ; `OPEN_APP` ouvre l'app, traité en natif
 * par la bibliothèque sans appeler le gestionnaire ; sans action, le toucher ne fait rien.
 */
export const CLICK_ACTIONS: Record<WidgetTap, { clickAction?: string }> = {
  punch: { clickAction: PUNCH_CLICK },
  openApp: { clickAction: "OPEN_APP" },
  none: {},
};

/**
 * La clé de la phase du bouton dans le stockage, distincte de celles de la File d'envoi
 * (`file-envoi`) et de l'état local des semaines (`semaine:…`).
 */
export const PHASE_KEY = "phase-widget";

/**
 * L'attente maximale de la relance après un pointage : deux requêtes sans réponse, car l'appel qui
 * attend la relance lancée par `record` la fait repartir une fois (`flush`). La tâche du widget a
 * 30 s (ADR-0002, « Options étudiées ») : les 10 qui restent vont aux lectures, à l'enregistrement
 * et aux dessins. Une relance plus longue continue sans être attendue ; un jour qu'elle n'a pas
 * envoyé reste en file.
 */
export const SEND_WAIT_MS = 2 * REQUEST_TIMEOUT_MS;

/** Ce que lit le widget pour se dessiner. */
export interface WidgetSources {
  /** Le stockage de l'état local des semaines et de la File d'envoi. */
  storage: KeyValueStorage;
  /** Le jeton du coffre, ou `null` s'il n'y en a pas. */
  readToken: () => Promise<string | null>;
  /** L'instant présent. */
  now: () => Date;
}

/** Ce dont le gestionnaire a besoin, en plus de ce qu'il lit, pour pointer et dessiner. */
export interface WidgetTaskDependencies extends WidgetSources {
  /** Efface le jeton du coffre, quand le serveur l'a refusé. */
  clearToken: () => Promise<void>;
  /** Envoie une journée au serveur avec le jeton ; lève les erreurs de `writeDay`. */
  send: (token: string, day: PresenceDay) => Promise<void>;
  /** Attend `ms` millisecondes. */
  wait: (ms: number) => Promise<void>;
  /** Dessine le widget. */
  draw: (model: WidgetModel) => void;
}

/** Vrai si `value` est une phase rangée de forme attendue ({@link WidgetPhase}). */
function isPhase(value: unknown): value is WidgetPhase {
  if (typeof value !== "object" || value === null) return false;
  const { kind, shownAt, id } = value as Record<string, unknown>;
  return (
    typeof kind === "string" &&
    Object.keys(PHASE_MS).includes(kind) &&
    Number.isFinite(shownAt) &&
    typeof id === "string"
  );
}

/**
 * Lit la phase rangée du bouton. C'est une frontière de confiance, comme la File d'envoi : un
 * texte absent, illisible, ou qui n'est pas une phase connue, avec un instant fini et un
 * identifiant texte, compte comme le repos.
 *
 * @param storage - Le stockage de la phase.
 * @returns La phase rangée, ou `null` au repos — aussi quand le stockage ne se lit pas.
 */
export async function readPhase(
  storage: KeyValueStorage,
): Promise<WidgetPhase | null> {
  try {
    const value: unknown = JSON.parse(
      (await storage.getItem(PHASE_KEY)) ?? "null",
    );
    return isPhase(value) ? value : null;
  } catch {
    return null;
  }
}

/** Range la phase du bouton, `null` pour le repos. */
function writePhase(
  storage: KeyValueStorage,
  phase: WidgetPhase | null,
): Promise<void> {
  return storage.setItem(PHASE_KEY, JSON.stringify(phase));
}

/** Une lecture du serveur qui n'a jamais lieu : le widget ne lit que l'état local. */
async function offline(): Promise<never> {
  throw new ServerUnreachableError();
}

/** Rend la vue de la semaine de `date` que montrerait l'app hors réseau. */
async function localWeek(
  storage: KeyValueStorage,
  date: string,
  pending: PresenceDay[],
): Promise<WeekView> {
  let view: WeekView = { days: null, unreachable: true };
  // Sans réseau, la dernière vue est l'état local sous les jours en attente, ou la semaine
  // reconstruite, ou `unreachable` sans journées, qui se pointe sur une journée vide.
  await loadWeek(
    mondayOf(date),
    { storage, read: offline, pending: async () => pending },
    (shown) => {
      view = shown;
    },
  );
  return view;
}

/** Lit ce que le widget dessine à l'instant présent, et le jeton. */
async function readState(
  sources: WidgetSources,
): Promise<{ state: WidgetState; token: string | null }> {
  const { storage } = sources;
  const now = sources.now();
  // Une file illisible ne cache pas la semaine, un coffre illisible vaut un coffre vide.
  const pending = await readPendingDays(storage).catch((): PresenceDay[] => []);
  const token = await sources.readToken().catch(() => null);
  const state: WidgetState = {
    view: await localWeek(storage, today(now), pending),
    now,
    pending: pending.length,
    hasToken: token !== null,
    phase: await readPhase(storage),
  };
  return { state, token };
}

/**
 * Rend ce que montre le widget à l'instant présent : l'état local de la semaine d'aujourd'hui,
 * les jours en attente d'envoi, la présence du jeton et la phase rangée du bouton
 * ({@link widgetModel}). C'est le dessin du gestionnaire comme celui que l'app demande.
 *
 * @param sources - Le stockage, le coffre et l'horloge.
 * @returns Le modèle du widget ; ne rejette jamais, un stockage ou un coffre illisible comptant
 *   comme vide.
 */
export async function currentModel(
  sources: WidgetSources,
): Promise<WidgetModel> {
  return widgetModel((await readState(sources)).state);
}

/** Dessine le widget à l'instant présent. */
async function redraw(deps: WidgetTaskDependencies): Promise<void> {
  deps.draw(await currentModel(deps));
}

/**
 * Affiche une phase du bouton pendant sa durée, puis le ramène au repos : le dessin d'abord, puis
 * la phase rangée à l'instant qui le suit, car sa durée se compte depuis l'affichage. Le retour au
 * repos n'efface que la phase posée ici ({@link isStillShown}) : un autre toucher a pu ranger la
 * sienne entre-temps.
 */
async function showFor(
  deps: WidgetTaskDependencies,
  state: WidgetState,
  kind: PhaseKind,
): Promise<void> {
  deps.draw(widgetModel({ ...state, phase: showPhase(kind, state.now) }));
  const posted = showPhase(kind, deps.now());
  await writePhase(deps.storage, posted);
  await deps.wait(PHASE_MS[kind]);
  if (!isStillShown(await readPhase(deps.storage), posted)) return;
  await writePhase(deps.storage, null);
  await redraw(deps);
}

/**
 * Pointe sur un toucher qui confirme l'état armé. La phase est rangée au repos avant tout : un
 * toucher suivant, dans la fenêtre de l'état armé, réarme au lieu de pointer encore.
 */
async function punch(
  deps: WidgetTaskDependencies,
  state: WidgetState,
  token: string,
): Promise<void> {
  await writePhase(deps.storage, null);
  const outcome = punchAt(state.view, state.now);
  if (outcome === null) return redraw(deps);
  if ("refusal" in outcome) return showFor(deps, state, "refused");
  let tokenRejected = false;
  const queue = createSendQueue({
    storage: deps.storage,
    send: (day) => deps.send(token, day),
    onTokenRejected: () => {
      tokenRejected = true;
    },
  });
  // Un enregistrement manqué se voit au dessin suivant : l'heure n'y est pas.
  await queue.record(outcome.day).catch(() => undefined);
  await redraw(deps);
  // `record` a lancé la relance : l'attendre, au plus le temps qu'il reste à la tâche.
  await Promise.race([queue.flush(), deps.wait(SEND_WAIT_MS)]);
  // Comme l'app : un jeton refusé quitte le coffre, et le bouton renvoie vers l'app.
  if (tokenRejected) await deps.clearToken().catch(() => undefined);
  await redraw(deps);
}

/**
 * Traite un toucher sur le bouton de pointage : l'arme au repos, pointe pendant l'état armé. Un
 * toucher reçu sur un bouton qui ne pointe plus — journée terminée, jeton effacé depuis le dernier
 * dessin — ne fait que redessiner.
 */
async function tapButton(deps: WidgetTaskDependencies): Promise<void> {
  const { state, token } = await readState(deps);
  // Sans jeton, le bouton ouvre l'app : ce test ne sert qu'au typage de `token`.
  if (token === null || widgetModel(state).button.tap !== "punch") {
    return redraw(deps);
  }
  if (tapEffect(state.phase, state.now) === "arm") {
    return showFor(deps, state, "armed");
  }
  await punch(deps, state, token);
}

/**
 * Traite un événement du widget, dans la borne de 30 s de sa tâche (ADR-0002, « Options
 * étudiées ») : 3 s d'état armé ou de refus affiché, ou {@link SEND_WAIT_MS} de relance au plus.
 *
 * @param task.widgetAction - L'événement : ajout, mise à jour, redimensionnement, suppression ou
 *   toucher.
 * @param task.clickAction - L'action de la zone touchée, pour un toucher.
 * @param deps - Ce que lit et fait le gestionnaire ({@link WidgetTaskDependencies}).
 * @returns Une promesse résolue une fois l'événement traité : rien pour une suppression ; un
 *   toucher du bouton de pointage ({@link PUNCH_CLICK}) l'arme ou pointe ; tout autre événement
 *   redessine le widget.
 */
export async function runWidgetTask(
  {
    widgetAction,
    clickAction,
  }: Pick<WidgetTaskHandlerProps, "widgetAction" | "clickAction">,
  deps: WidgetTaskDependencies,
): Promise<void> {
  if (widgetAction === "WIDGET_DELETED") return;
  if (widgetAction === "WIDGET_CLICK" && clickAction === PUNCH_CLICK) {
    return tapButton(deps);
  }
  await redraw(deps);
}
