/**
 * Le thème des écrans : les palettes claire et sombre et les polices du prototype « Pouce »,
 * reprises telles quelles (issue #3, « Décisions », point 7), plus l'orange de l'indicateur
 * d'envoi (issue #4, décision 1).
 */

import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { SpaceGrotesk_500Medium } from "@expo-google-fonts/space-grotesk/500Medium";
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk/700Bold";
import { useColorScheme } from "react-native";

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

const LIGHT: Palette = {
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
};

const DARK: Palette = {
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
};

/**
 * Rend la palette du mode du téléphone, clair ou sombre ; le thème suit le réglage du système.
 *
 * @returns La palette sombre si le téléphone est en mode sombre, la claire sinon.
 */
export function usePalette(): Palette {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}

/**
 * Les fichiers des polices, par nom de famille, à charger par `useFonts` avant tout rendu. Chaque
 * graisse est importée de son propre module : l'index d'un paquet `@expo-google-fonts` charge
 * toutes ses graisses.
 */
export const FONT_SOURCES = {
  Inter_400Regular,
  Inter_600SemiBold,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
};

/** Les familles à donner à `fontFamily` : Inter pour le texte, Space Grotesk pour les chiffres. */
export const FONTS = {
  text: "Inter_400Regular",
  textStrong: "Inter_600SemiBold",
  digits: "SpaceGrotesk_500Medium",
  digitsStrong: "SpaceGrotesk_700Bold",
} satisfies Record<string, keyof typeof FONT_SOURCES>;

/** La forme des boutons pleine largeur du prototype, `.primary` et `.secondary`. */
export const BUTTON = {
  height: 56,
  borderRadius: 16,
  alignItems: "center",
  justifyContent: "center",
} as const;

/** Le libellé de ces boutons ; sa couleur dépend du bouton et de son état. */
export const BUTTON_LABEL = { fontFamily: FONTS.textStrong, fontSize: 16 };
