/**
 * Les palettes claire et sombre du prototype « Pouce », reprises telles quelles (issue #3,
 * « Décisions », point 7), plus l'orange de l'indicateur d'envoi (issue #4, décision 1) ; et les
 * couleurs du bouton de pointage selon son état ({@link punchColors}), nommées par leur clé de
 * palette, que le widget mélange le temps d'une transition ({@link Tint}).
 *
 * Module pur, lisible hors d'un composant React pour le widget d'écran d'accueil, qui ne peut pas
 * appeler de hook (issue #20) ; l'app choisit sa palette par `usePalette` de `./theme`.
 */

/** Une couleur `#RRGGBB`, de la forme qu'attendent aussi les primitives du widget. */
type HexColor = `#${string}`;

/** Les couleurs d'un mode, nommées comme les variables du prototype. */
export interface Palette {
  bg: HexColor;
  surface: HexColor;
  surface2: HexColor;
  fg: HexColor;
  muted: HexColor;
  line: HexColor;
  accent: HexColor;
  accentInk: HexColor;
  accentSoft: HexColor;
  danger: HexColor;
  /** Le point orange de l'indicateur d'envoi, quand des jours attendent l'envoi. */
  pending: HexColor;
}

/**
 * La palette de chaque mode du téléphone, clair (`light`) ou sombre (`dark`), les deux noms que
 * rend `useColorScheme` de React Native.
 *
 * @example PALETTES.dark.accent // « #86CDB0 »
 */
export const PALETTES: Record<"light" | "dark", Palette> = {
  light: {
    bg: "#F3F5F2",
    surface: "#FFFFFF",
    surface2: "#E9EEEA",
    fg: "#17201C",
    muted: "#5B6862",
    line: "#D9E0DB",
    accent: "#2C6A54",
    accentInk: "#FFFFFF",
    accentSoft: "#E0EEE6",
    danger: "#B3402E",
    pending: "#B8661A",
  },
  dark: {
    bg: "#0E1311",
    surface: "#161D1A",
    surface2: "#1F2824",
    fg: "#E6ECE8",
    muted: "#93A29A",
    line: "#28322D",
    accent: "#86CDB0",
    accentInk: "#0E1311",
    accentSoft: "#1A2C25",
    danger: "#F08A78",
    pending: "#F0A35E",
  },
};

/** Le nom d'une couleur de {@link Palette}, que résout la palette du mode affiché. */
export type PaletteToken = keyof Palette;

/**
 * Une couleur nommée, qui se résout dans la palette du mode affiché ({@link resolveTint}) : une clé
 * seule, ou le mélange de deux, à `amount` du chemin de `from` vers `to`, entre 0 et 1 exclus — le
 * temps d'une transition. Créée par {@link blend}.
 */
export type Tint =
  PaletteToken | { from: PaletteToken; to: PaletteToken; amount: number };

/**
 * Rend la couleur à `amount` du chemin de `from` vers `to`.
 *
 * @example blend("accent", "accentInk", 0.4) // { from: "accent", to: "accentInk", amount: 0.4 }
 * @param amount - La part du chemin faite : `from` à 0 et en deçà, `to` à 1 et au-delà.
 * @returns La clé seule à un bout du chemin, ou quand il part et arrive sur la même ; leur mélange
 *   entre les deux.
 */
export function blend(
  from: PaletteToken,
  to: PaletteToken,
  amount: number,
): Tint {
  if (amount <= 0 || from === to) return from;
  if (amount >= 1) return to;
  return { from, to, amount };
}

/**
 * Résout une couleur nommée dans la palette d'un mode.
 *
 * @example resolveTint(PALETTES.light, { from: "accent", to: "accentInk", amount: 0.5 })
 *   // « #96B5AA »
 * @returns La couleur de la clé ; pour un mélange, chaque canal pris à `amount` du chemin entre ceux
 *   des deux clés, en sRGB, arrondi à l'entier.
 */
export function resolveTint(palette: Palette, tint: Tint): HexColor {
  if (typeof tint === "string") return palette[tint];
  const from = palette[tint.from];
  const to = palette[tint.to];
  // Les canaux rouge, vert et bleu commencent aux caractères 1, 3 et 5 de `#RRGGBB`.
  const mixed = [1, 3, 5].map((start) => {
    const a = channel(from, start);
    const value = Math.round(a + (channel(to, start) - a) * tint.amount);
    return value.toString(16).padStart(2, "0");
  });
  return `#${mixed.join("").toUpperCase()}`;
}

/** Le canal de 0 à 255 écrit en deux chiffres hexadécimaux à partir de `start` dans `color`. */
function channel(color: HexColor, start: number): number {
  return Number.parseInt(color.slice(start, start + 2), 16);
}

/** Le fond d'un bouton et la couleur de son libellé, nommés par leur clé de palette. */
export interface ButtonColors {
  background: PaletteToken;
  color: PaletteToken;
}

/**
 * Rend les couleurs du bouton de pointage au repos : éteintes quand il est désactivé, sur le fond
 * neutre d'un jour non travaillé quand il est grisé, de l'accent sinon. Nommées par leur clé,
 * elles se résolvent dans la palette du mode affiché.
 *
 * @example punchColors({ enabled: true, muted: true }) // { background: "surface2", color: "fg" }
 * @param button.enabled - Vrai si un appui sur le bouton pointe.
 * @param button.muted - Vrai un jour non travaillé, où le bouton est grisé sans être désactivé.
 * @returns Les noms des deux couleurs ; désactivé, le bouton est éteint, grisé ou non.
 */
export function punchColors(button: {
  enabled: boolean;
  muted: boolean;
}): ButtonColors {
  if (!button.enabled) return { background: "surface2", color: "muted" };
  if (button.muted) return { background: "surface2", color: "fg" };
  return { background: "accent", color: "accentInk" };
}
