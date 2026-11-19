/**
 * La bande du bas de l'écran de la semaine : la barre du dernier geste, le bouton du bas, puis la
 * date du jour et l'heure courante (issue #4, décision 1). Elle affiche ce qu'on lui passe, sans
 * rien décider ; le bouton du bas agit au toucher, ou, actif et à appui maintenu, par
 * `./HoldButton`.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import { HoldButton } from "./HoldButton";
import { BUTTON, BUTTON_LABEL, FONTS, type Palette } from "./theme";

/** La hauteur d'« Annuler », cible tactile, que la barre garde aussi pour un refus, sans lui. */
const TOUCH_HEIGHT = 48;

/**
 * Le bouton du bas : `primary` pour le bouton de pointage, `secondary` pour « Revenir à cette
 * semaine », comme les boutons `.primary` et `.secondary` du prototype.
 */
export interface DockButton {
  label: string;
  /** L'action du bouton : au toucher, ou, à appui maintenu, à l'appui abouti. */
  onPress: () => void;
  variant: "primary" | "secondary";
  disabled?: boolean;
  /**
   * Présent, le bouton actif se maintient pour agir : `hint` l'annonce à TalkBack, sous lequel
   * l'activation agit directement, et `onInterrupted` part à un appui interrompu avant la fin.
   */
  hold?: { hint: string; onInterrupted: () => void };
}

/**
 * @param message - Le message de la barre du dernier geste, ou `null` quand la barre est cachée.
 * @param onUndo - Annule le dernier geste ; `undefined` laisse la barre sans « Annuler », pour un
 *   refus.
 * @param button - Le bouton du bas.
 * @param clock - La ligne sous le bouton : la date du jour et l'heure courante.
 */
export function PunchDock({
  message,
  onUndo,
  button,
  clock,
  palette,
}: {
  message: string | null;
  onUndo: (() => void) | undefined;
  button: DockButton;
  clock: string;
  palette: Palette;
}) {
  return (
    <View style={[styles.dock, { borderTopColor: palette.line }]}>
      {message !== null && (
        <View style={[styles.bar, { backgroundColor: palette.surface2 }]}>
          <Text
            style={[styles.message, { color: palette.fg }]}
            accessibilityLiveRegion="polite"
          >
            {message}
          </Text>
          {onUndo && (
            <Pressable
              style={styles.undoButton}
              onPress={onUndo}
              accessibilityRole="button"
            >
              <Text style={[styles.undo, { color: palette.accent }]}>
                Annuler
              </Text>
            </Pressable>
          )}
        </View>
      )}
      <BottomButton {...button} palette={palette} />
      <Text style={[styles.clock, { color: palette.muted }]}>{clock}</Text>
    </View>
  );
}

/**
 * Le bouton du bas, pleine largeur ; désactivé, il prend les couleurs éteintes et ne se maintient
 * pas. Maintenu, son contour se dessine de la couleur de son libellé.
 */
function BottomButton({
  label,
  onPress,
  variant,
  disabled = false,
  hold,
  palette,
}: DockButton & { palette: Palette }) {
  const secondary = variant === "secondary";
  const [background, color] = secondary
    ? [palette.surface, palette.fg]
    : disabled
      ? [palette.surface2, palette.muted]
      : [palette.accent, palette.accentInk];
  const style = [
    BUTTON,
    { backgroundColor: background },
    secondary && [styles.secondary, { borderColor: palette.line }],
  ];
  const text = <Text style={[BUTTON_LABEL, { color }]}>{label}</Text>;
  if (hold && !disabled) {
    return (
      <HoldButton
        style={style}
        ringColor={color}
        hint={hold.hint}
        onDone={onPress}
        onInterrupted={hold.onInterrupted}
      >
        {text}
      </HoldButton>
    );
  }
  return (
    <Pressable
      style={style}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {text}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dock: { borderTopWidth: 1, padding: 16, gap: 8 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: TOUCH_HEIGHT,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  message: { flex: 1, fontFamily: FONTS.text, fontSize: 14 },
  undoButton: { minHeight: TOUCH_HEIGHT, justifyContent: "center" },
  undo: { fontFamily: FONTS.textStrong, fontSize: 14 },
  secondary: { borderWidth: 1 },
  clock: { fontFamily: FONTS.text, fontSize: 13, textAlign: "center" },
});
