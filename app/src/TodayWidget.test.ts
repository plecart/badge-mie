import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { todayWidget } from "./TodayWidget";
import type { WidgetButton, WidgetModel } from "./widget";

// La bibliothèque, mockée à sa frontière : ses primitives deviennent des éléments qui gardent leurs
// props. Son index importe `react-native`, que Node ne charge pas.
vi.mock("react-native-android-widget", () => ({
  FlexWidget: "FlexWidget",
  OverlapWidget: "OverlapWidget",
  TextWidget: "TextWidget",
}));

// `./theme` importe le mode du téléphone et les fichiers des polices, que Node ne charge pas.
vi.mock("react-native", () => ({}));
vi.mock("@expo-google-fonts/inter/400Regular", () => ({ Inter_400Regular: 1 }));
vi.mock("@expo-google-fonts/inter/600SemiBold", () => ({
  Inter_600SemiBold: 2,
}));
vi.mock("@expo-google-fonts/space-grotesk/500Medium", () => ({
  SpaceGrotesk_500Medium: 3,
}));
vi.mock("@expo-google-fonts/space-grotesk/700Bold", () => ({
  SpaceGrotesk_700Bold: 4,
}));

/** Une primitive du widget dépliée : son nom, ses props hors enfants, ses enfants dépliés. */
interface WidgetNode {
  type: string;
  props: Record<string, unknown>;
  children: WidgetNode[];
}

/**
 * Déplie un arbre JSX jusqu'aux primitives, comme la bibliothèque avant de le passer au natif :
 * chaque composant est appelé avec ses props, les `false` d'un rendu conditionnel tombent
 * (`buildWidgetTree`, `src/api/build-widget-tree.ts` de la bibliothèque, 0.26.0, lu le 2026-11-25).
 */
function unfold(node: ReactNode): WidgetNode[] {
  if (Array.isArray(node)) return node.flatMap(unfold);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  const { type, props } = node;
  if (typeof type !== "string") {
    return unfold((type as (props: object) => ReactNode)(props));
  }
  const { children, ...rest } = props;
  return [{ type, props: rest, children: unfold(children) }];
}

/** Les primitives d'un arbre déplié, dans l'ordre de lecture. */
function flatten(tree: WidgetNode[]): WidgetNode[] {
  return tree.flatMap((node) => [node, ...flatten(node.children)]);
}

/** L'ordre de grandeur de la hauteur du widget 2×2, en dp : titres, heures et bouton. */
const HEIGHT_2X2 = 160;

/** Les arbres clair et sombre du widget, dépliés. */
function render(model: WidgetModel): {
  light: WidgetNode[];
  dark: WidgetNode[];
} {
  const widget = todayWidget(model, HEIGHT_2X2);
  if (!("light" in widget)) throw new Error("un seul arbre, sans mode sombre");
  return { light: unfold(widget.light), dark: unfold(widget.dark) };
}

/** Chaque zone touchable, qui porte une action ou un libellé pour TalkBack, et son action. */
function touchZones(tree: WidgetNode[]): [unknown, unknown][] {
  return flatten(tree)
    .filter(
      ({ props }) => "accessibilityLabel" in props || "clickAction" in props,
    )
    .map(({ props }) => [props.accessibilityLabel, props.clickAction]);
}

/** Les textes affichés, dans l'ordre de lecture. */
function texts(tree: WidgetNode[]): unknown[] {
  return flatten(tree)
    .filter(({ type }) => type === "TextWidget")
    .map(({ props }) => props.text);
}

/** L'arbre sans ses styles, où vivent les couleurs du mode : `toEqual` ignore un `undefined`. */
function withoutStyles(tree: WidgetNode[]): unknown[] {
  return tree.map(({ type, props, children }) => ({
    type,
    props: { ...props, style: undefined },
    children: withoutStyles(children),
  }));
}

/** Le widget, arrivée à 08:52 et départ vide, sous ce bouton. */
function model(button: WidgetButton): WidgetModel {
  return { dot: "accent", arrival: "08:52", departure: "—", button };
}

/** Le bouton au repos, qu'un toucher arme. */
const RESTING: WidgetButton = {
  label: "Badger",
  accessibilityLabel: "Pointer le départ",
  background: "accent",
  color: "accentInk",
  tap: "punch",
};

/** Le bouton armé, qu'un toucher confirme, 3 secondes au décompte. */
const ARMED: WidgetButton = {
  label: "Confirmer",
  accessibilityLabel: "Confirmer le départ",
  background: "accentInk",
  color: "accent",
  border: "accent",
  secondsLeft: 3,
  tap: "punch",
};

/** Le bouton sans jeton, qui ouvre l'app. */
const NO_TOKEN: WidgetButton = {
  label: "Ouvrir l'app",
  accessibilityLabel: "Ouvrir l'app",
  background: "accent",
  color: "accentInk",
  tap: "openApp",
};

/** Le bouton éteint d'une journée terminée. */
const FINISHED: WidgetButton = {
  label: "Journée terminée",
  accessibilityLabel: "Journée terminée",
  background: "surface2",
  color: "muted",
  tap: "none",
};

describe("todayWidget — les zones touchables", () => {
  it.each([
    ["arme au repos", RESTING, "PUNCH"],
    ["confirme armé", ARMED, "PUNCH"],
    ["ouvre l'app sans jeton", NO_TOKEN, "OPEN_APP"],
    ["ne fait rien, la journée terminée", FINISHED, undefined],
  ])(
    "les deux heures ouvrent l'app, le bouton %s",
    (_, button, clickAction) => {
      expect(touchZones(render(model(button)).light)).toEqual([
        ["Arrivée 08:52", "OPEN_APP"],
        ["Départ —", "OPEN_APP"],
        [button.accessibilityLabel, clickAction],
      ]);
    },
  );
});

describe("todayWidget — le chiffre du décompte", () => {
  it("n'apparaît pas au repos", () => {
    expect(texts(render(model(RESTING)).light)).toEqual([
      "ARRIVÉE",
      "08:52",
      "DÉPART",
      "—",
      "Badger",
    ]);
  });

  it("apparaît armé, après le libellé", () => {
    expect(texts(render(model(ARMED)).light)).toEqual([
      "ARRIVÉE",
      "08:52",
      "DÉPART",
      "—",
      "Confirmer",
      "3",
    ]);
  });
});

describe("todayWidget — les modes clair et sombre", () => {
  it.each([
    ["au repos", RESTING],
    ["armé", ARMED],
    ["sans jeton", NO_TOKEN],
    ["la journée terminée", FINISHED],
  ])(
    "rend deux arbres qui ne diffèrent que par leurs styles, le bouton %s",
    (_, button) => {
      const { light, dark } = render(model(button));
      expect(dark).not.toEqual(light);
      expect(withoutStyles(dark)).toEqual(withoutStyles(light));
    },
  );
});
