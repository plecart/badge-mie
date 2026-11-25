/**
 * Le thème des écrans : la palette du mode du téléphone, prise dans `./palette`, et les polices du
 * prototype « Pouce », reprises telles quelles (issue #3, « Décisions », point 7).
 */

import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { SpaceGrotesk_500Medium } from "@expo-google-fonts/space-grotesk/500Medium";
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk/700Bold";
import { useColorScheme } from "react-native";
import { PALETTES, type Palette } from "./palette";

/** Les couleurs d'un mode ({@link Palette} de `./palette`), que les écrans prennent avec le thème. */
export type { Palette };

/**
 * Rend la palette du mode du téléphone, clair ou sombre ; le thème suit le réglage du système.
 *
 * @returns La palette sombre si le téléphone est en mode sombre, la claire sinon.
 */
export function usePalette(): Palette {
  return PALETTES[useColorScheme() === "dark" ? "dark" : "light"];
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
