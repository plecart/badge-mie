/**
 * Un bouton qui agit par appui maintenu (ADR-0001, « Propositions UX ») : pendant l'appui, une
 * progression se dessine sur son contour en {@link fillMs}, et l'appui abouti agit à cet instant.
 * Relâché ou sorti du bouton avant la fin, il ne fait que le dire, et la progression revient en
 * arrière en {@link rewindMs}.
 *
 * L'appui se lit par `onPressIn` et `onPressOut`, sans `onLongPress` : `onPressOut` part au
 * relâchement comme à la sortie du doigt hors du bouton et de sa marge de rétention, alors que le
 * délai d'un appui long s'annule aussi quand le doigt bouge de plus de 10 px, ce qui laisserait la
 * progression aller au bout sans rien déclencher (`Libraries/Pressability/Pressability.js`,
 * react-native 0.88.1, lu le 2026-11-19 : `onResponderMove`, `_activate`, `_deactivate`). La fin de
 * l'animation est donc l'appui abouti.
 *
 * Sous TalkBack, l'activation agit directement : l'action d'accessibilité `activate`, déclarée,
 * prend `ACTION_CLICK`, et Android la remet à `onAccessibilityAction` sans clic
 * (`ReactAccessibilityDelegate.kt`, react-native 0.88.1, lu le 2026-11-19 :
 * `performAccessibilityAction`).
 *
 * ponytail: la progression balaie le contour de gauche à droite, haut et bas ensemble, sans
 * dépendance ; un trait qui en fait le tour se tracerait en SVG (`react-native-svg`), si le
 * balayage ne convient pas.
 */

import { type ReactNode, useEffectEvent, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  type StyleProp,
  StyleSheet,
  useAnimatedValue,
  View,
  type ViewStyle,
} from "react-native";
import { fillMs, rewindMs } from "./hold";
import { BUTTON } from "./theme";

/** L'épaisseur du contour dessiné. */
const RING_WIDTH = 3;

/** La seule action d'accessibilité du bouton : l'activation par TalkBack. */
const ACTIONS = [{ name: "activate" }];

/**
 * @param style - La forme et le fond du bouton, aux coins de {@link BUTTON}.
 * @param ringColor - La couleur du contour dessiné.
 * @param hint - L'indication lue par TalkBack.
 * @param onDone - L'action : à l'appui abouti, celle du dernier rendu ; à l'activation par TalkBack.
 * @param onInterrupted - Appelé quand l'appui s'interrompt avant la fin.
 * @param children - Le contenu du bouton.
 */
export function HoldButton({
  style,
  ringColor,
  hint,
  onDone,
  onInterrupted,
  children,
}: {
  style: StyleProp<ViewStyle>;
  ringColor: string;
  hint: string;
  onDone: () => void;
  onInterrupted: () => void;
  children: ReactNode;
}) {
  // La progression de 0 à 1, animée en JavaScript : le pilote natif n'anime une largeur que sous
  // l'option `useSharedAnimatedBackend` (`NativeAnimatedAllowlist.js`, react-native 0.88.1, lu le
  // 2026-11-19).
  const progress = useAnimatedValue(0);
  const [width, setWidth] = useState(0);
  // L'appui aboutit bien après le rendu qui l'a commencé : il appelle le `onDone` du dernier rendu
  // validé, qui voit l'état de cet instant. Hors d'un rendu, où elle lève, la fonction de
  // `useEffectEvent` appelle toujours ce dernier `onDone` (`mountEvent` et `updateEvent` de
  // `ReactFabric-dev.js`, react-native 0.88.1, lu le 2026-11-19).
  const latestOnDone = useEffectEvent(onDone);
  // Vrai quand l'appui en cours a abouti : son relâchement n'interrompt rien.
  const completed = useRef(false);

  /** Anime la progression vers `toValue`, en une durée tirée d'où elle en est. */
  function animate(
    toValue: number,
    duration: (from: number) => number,
    onEnd?: () => void,
  ) {
    progress.stopAnimation((from) =>
      Animated.timing(progress, {
        toValue,
        duration: duration(from),
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) onEnd?.();
      }),
    );
  }

  function pressIn() {
    completed.current = false;
    animate(1, fillMs, () => {
      completed.current = true;
      progress.setValue(0);
      latestOnDone();
    });
  }

  function pressOut() {
    if (completed.current) return;
    onInterrupted();
    animate(0, rewindMs);
  }

  return (
    <Pressable
      style={style}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
      accessibilityRole="button"
      accessibilityHint={hint}
      accessibilityActions={ACTIONS}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === "activate") onDone();
      }}
    >
      <Animated.View
        style={[
          styles.clip,
          {
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      >
        <View style={[styles.ring, { width, borderColor: ringColor }]} />
      </Animated.View>
      {children}
    </Pressable>
  );
}

/** Calé sur le bord gauche du bouton, sur toute sa hauteur. */
const FROM_LEFT = { position: "absolute", left: 0, top: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  clip: { ...FROM_LEFT, overflow: "hidden" },
  ring: {
    ...FROM_LEFT,
    borderWidth: RING_WIDTH,
    borderRadius: BUTTON.borderRadius,
  },
});
