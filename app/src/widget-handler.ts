/**
 * L'adaptateur du widget d'écran d'accueil : branche sur le cœur `./widget-task` ce que l'app
 * utilise — `AsyncStorage`, le coffre du jeton, `writeDay`, l'horloge, `setTimeout` — et le dessin
 * de `react-native-android-widget` (`./TodayWidget`).
 *
 * Adaptateur mince, non testé, comme `./token-vault` : il importe des modules natifs. Le même
 * objet `AsyncStorage` que l'écran de la semaine : la File d'envoi sérialise ses écritures par
 * stockage, celles du widget avec celles de l'app.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  requestWidgetUpdate,
  type WidgetTaskHandlerProps,
} from "react-native-android-widget";
import { writeDay } from "./api";
import { todayWidget } from "./TodayWidget";
import { clearToken, readToken } from "./token-vault";
import {
  currentModel,
  runWidgetTask,
  WIDGET_NAME,
  type WidgetSources,
} from "./widget-task";

/** Ce que lit le widget pour se dessiner, dans l'app. */
const sources: WidgetSources = {
  storage: AsyncStorage,
  readToken,
  now: () => new Date(),
};

/**
 * Le gestionnaire de tâche du widget, à enregistrer par `registerWidgetTaskHandler` dans le point
 * d'entrée de l'app ({@link runWidgetTask}).
 *
 * @param props - Ce que la bibliothèque passe à chaque événement du widget.
 */
export function widgetTaskHandler(
  props: WidgetTaskHandlerProps,
): Promise<void> {
  return runWidgetTask(props, {
    ...sources,
    clearToken,
    send: writeDay,
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    draw: (model) => props.renderWidget(todayWidget(model)),
  });
}

/**
 * Redessine depuis l'app chaque widget posé, du même dessin que le gestionnaire
 * ({@link currentModel}) : à chaque écriture de la File d'envoi de l'app, et quand le jeton change.
 * Sans widget posé, ne fait rien.
 *
 * @returns Une promesse résolue une fois la demande faite ; elle ne rejette jamais : un widget qui
 *   ne se redessine pas ne gêne pas l'app, il se rafraîchit à sa prochaine mise à jour périodique.
 */
export function refreshWidget(): Promise<void> {
  return requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: async () => todayWidget(await currentModel(sources)),
  }).catch(() => undefined);
}
