/**
 * Le point d'entrée de l'application, que lit `main` dans `package.json` : l'app, et le
 * gestionnaire de tâche de son widget d'écran d'accueil, que la bibliothèque du widget veut
 * enregistré ici (doc : `rnaw/tutorial/register-task-handler`, ADR-0002).
 */

import { registerRootComponent } from "expo";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { App } from "./src/App";
import { widgetTaskHandler } from "./src/widget-handler";

registerRootComponent(App);
registerWidgetTaskHandler(widgetTaskHandler);
