import { existsSync } from "node:fs";
import type { WithAndroidWidgetsParams } from "react-native-android-widget";
import { describe, expect, it } from "vitest";
import app from "./app.json" with { type: "json" };

/** L'entrée du plugin `react-native-android-widget` dans la configuration Expo, s'il en a une. */
const plugin = app.expo.plugins.find(
  (entry) => Array.isArray(entry) && entry[0] === "react-native-android-widget",
);

/** Les widgets que déclare le plugin, vide s'il n'en déclare aucun. */
const widgets =
  (plugin?.[1] as WithAndroidWidgetsParams | undefined)?.widgets ?? [];

/** Le premier widget déclaré, celui que les tests suivants lisent. */
const [today] = widgets;

/**
 * La largeur disponible de `n` cellules en portrait, et la hauteur de `m` cellules en paysage, en
 * dp : developer.android.com/develop/ui/views/appwidgets/layouts, « Determine a size for your
 * widget » (lu le 2026-11-25), dont la table donne `73n − 16` et `66m − 15` et fait prendre
 * `minWidth` en portrait, `minHeight` en paysage.
 */
const portraitWidth = (n: number) => 73 * n - 16;
const landscapeHeight = (m: number) => 66 * m - 15;

/**
 * Le widget d'écran d'accueil (#20) : un seul, `Today`, en 4×1. Android 12 et plus le posent sur
 * `targetCellWidth` × `targetCellHeight` ; Android 11 et moins, sur le nombre de cellules qu'il
 * faut pour tenir `minWidth` × `minHeight` (même page). Android ne le rafraîchit pas plus d'une
 * fois toutes les 30 min, le plancher que le plugin impose à `updatePeriodMillis`.
 */
describe("app.json — le widget d'écran d'accueil", () => {
  it("déclare un seul widget, « Today »", () => {
    expect(widgets.map(({ name }) => name)).toEqual(["Today"]);
  });

  it("occupe 4×1 cellules, sur Android 12 et plus comme avant", () => {
    expect(today?.targetCellWidth).toBe(4);
    expect(today?.targetCellHeight).toBe(1);
    const minWidth = Number.parseFloat(today?.minWidth ?? "");
    const minHeight = Number.parseFloat(today?.minHeight ?? "");
    expect(minWidth).toBeGreaterThan(portraitWidth(3));
    expect(minWidth).toBeLessThanOrEqual(portraitWidth(4));
    expect(minHeight).toBeGreaterThan(0);
    expect(minHeight).toBeLessThanOrEqual(landscapeHeight(1));
  });

  it("se rafraîchit toutes les 30 min", () => {
    expect(today?.updatePeriodMillis).toBe(30 * 60 * 1000);
  });
});

/** Le plugin qui raccourcit les chemins des objets C++, tel que le nomme `expo.plugins`. */
const CMAKE_PLUGIN = "./plugins/with-cmake-object-path-max";

/**
 * Le build Android sous Windows (ADR-0002, « Conséquences ») : sans ce plugin, il échoue sur un
 * chemin d'objet trop long, et c'est `expo.plugins` qui le fait jouer au prebuild.
 */
describe("app.json — le build Android sous Windows", () => {
  it("branche le plugin qui raccourcit les chemins des objets C++, à côté d'app.json", () => {
    expect(app.expo.plugins).toContain(CMAKE_PLUGIN);
    expect(existsSync(new URL(`${CMAKE_PLUGIN}.ts`, import.meta.url))).toBe(
      true,
    );
  });
});
