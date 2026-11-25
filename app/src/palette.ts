/**
 * Les palettes claire et sombre du prototype « Pouce », reprises telles quelles (issue #3,
 * « Décisions », point 7), plus l'orange de l'indicateur d'envoi (issue #4, décision 1).
 *
 * Module pur, lisible hors d'un composant React : l'app choisit la sienne par `usePalette` de
 * `./theme`, et le widget d'écran d'accueil, qui ne peut pas appeler de hook, rend les deux
 * (issue #20).
 */

/** Les couleurs d'un mode, nommées comme les variables du prototype. */
export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  fg: string;
  muted: string;
  line: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  danger: string;
  /** Le point orange de l'indicateur d'envoi, quand des jours attendent l'envoi. */
  pending: string;
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
