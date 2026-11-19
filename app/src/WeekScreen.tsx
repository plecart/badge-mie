/**
 * L'écran de la semaine, variante « Pouce » du prototype : l'en-tête et ses flèches, la ligne du
 * total et de l'indicateur d'envoi, les cinq cartes du lundi au vendredi et la bande du bas
 * (issue #3, « Décisions », point 7 ; issue #4, décision 1). Il s'ouvre sur la semaine en cours,
 * et passe à la nouvelle quand son horloge change de semaine, sauf s'il affiche une semaine passée
 * (`./current-week`). On y pointe aujourd'hui en maintenant le bouton du bas, et on y corrige une
 * heure d'un jour passé ou d'aujourd'hui en la touchant (`./use-gestures`). Chaque geste passe
 * par la File d'envoi, que l'écran relance à son ouverture, au retour du réseau et au retour au
 * premier plan (issue #4, décision 8).
 */

import {
  addWeeks,
  dayDuration,
  formatDuration,
  isoWeek,
  mondayOf,
  weekDays,
  weekRangeLabel,
  weekTotal,
} from "@badge-mie/week";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addNetworkStateListener } from "expo-network";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { readWeek, TokenRejectedError, writeDay } from "./api";
import { followCurrentWeek } from "./current-week";
import { DayCard } from "./DayCard";
import { clockLine, MISSING, pendingText } from "./labels";
import { PunchDock } from "./PunchDock";
import { createSendQueue } from "./send-queue";
import { FONTS, type Palette, usePalette } from "./theme";
import { useClock } from "./use-clock";
import { useGestures } from "./use-gestures";
import { loadWeek, type WeekView } from "./week-store";

/** Les jours abrégés des cinq cartes, du lundi au vendredi. */
const DAY_NAMES = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven."];

/** L'opacité de la flèche « Semaine suivante » sur la semaine en cours. */
const DISABLED_OPACITY = 0.28;

/** Le corps du sur-titre de l'en-tête, et son espacement de 0,08em. */
const OVERLINE_SIZE = 11;
const OVERLINE_SPACING = 0.08 * OVERLINE_SIZE;

/**
 * @param token - Le jeton d'accès, pour lire et écrire les journées sur le serveur.
 * @param onTokenRejected - Appelé quand le serveur refuse le jeton, à la lecture d'une semaine
 *   comme à l'envoi de la file ; il peut l'être plusieurs fois pour un même refus.
 */
export function WeekScreen({
  token,
  onTokenRejected,
}: {
  token: string;
  onTokenRejected: () => void;
}) {
  const palette = usePalette();
  const clock = useClock();
  const currentMonday = mondayOf(clock.date);
  const [monday, setMonday] = useState(currentMonday);
  // La semaine en cours du rendu précédent. À son changement, le lundi affiché se règle par
  // `followCurrentWeek` dans le rendu même, sans effet : React applique un `setState` du composant
  // pendant son rendu par un nouveau rendu immédiat, avant tout affichage
  // (`enqueueRenderPhaseUpdate` et `renderWithHooksAgain` de `ReactFabric-prod.js`, react-native
  // 0.88.1, lu le 2026-11-19).
  const [previousCurrent, setPreviousCurrent] = useState(currentMonday);
  if (currentMonday !== previousCurrent) {
    setPreviousCurrent(currentMonday);
    setMonday((displayed) =>
      followCurrentWeek(displayed, previousCurrent, currentMonday),
    );
  }
  // Chaque vue garde le lundi qui l'a demandée : celle d'une autre semaine n'est pas affichée.
  const [loaded, setLoaded] = useState<{ monday: string; view: WeekView }>();
  // Incrémenté pour relire la semaine affichée : après un geste, au retour au premier plan.
  const [reloads, setReloads] = useState(0);
  const reload = () => setReloads((count) => count + 1);
  // Le nombre de jours en attente d'envoi, `null` tant que la file ne l'a pas dit.
  const [pending, setPending] = useState<number | null>(null);
  const reportTokenRejected = useEffectEvent(onTokenRejected);

  // Une file par jeton, qui envoie avec lui ; `reportTokenRejected` appelle toujours le dernier
  // `onTokenRejected` reçu.
  const queue = useMemo(
    () =>
      createSendQueue({
        storage: AsyncStorage,
        send: (day) => writeDay(token, day),
        onChange: setPending,
        onTokenRejected: reportTokenRejected,
      }),
    [token],
  );

  useEffect(() => {
    // Un chargement remplacé (autre semaine, ou la même redemandée) n'affiche plus rien.
    let current = true;
    loadWeek(
      monday,
      {
        storage: AsyncStorage,
        read: (week) => readWeek(token, week),
        pending: queue.pendingDays,
      },
      (view) => {
        if (current) setLoaded({ monday, view });
      },
    ).catch((error: unknown) => {
      // Seul un jeton refusé remonte de `loadWeek`.
      if (current && error instanceof TokenRejectedError) reportTokenRejected();
    });
    return () => {
      current = false;
    };
  }, [monday, token, queue, reloads]);

  // Les déclencheurs de la relance (issue #4, décision 8) : l'ouverture de l'écran, le retour du
  // réseau, le retour au premier plan, qui relit aussi la semaine affichée. `record` relance de
  // lui-même.
  useEffect(() => {
    void queue.flush();
    queue.pendingDays().then(
      // Le compte lu ici ne remplace pas celui qu'une écriture de la file a pu dire avant lui.
      (days) => setPending((count) => count ?? days.length),
      // Une file qui ne se lit pas laisse l'indicateur caché.
      () => undefined,
    );
    const network = addNetworkStateListener(({ isConnected }) => {
      if (isConnected) void queue.flush();
    });
    const appState = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      reload();
      void queue.flush();
    });
    return () => {
      network.remove();
      appState.remove();
    };
  }, [queue]);

  // Tant qu'elle n'a rien affiché, la semaine se charge.
  const view: WeekView =
    loaded?.monday === monday
      ? loaded.view
      : { days: null, unreachable: false };
  const days = view.days;
  const isCurrent = monday >= currentMonday;
  const total = days
    ? formatDuration(
        weekTotal(days.map((day) => dayDuration(day.arrivee, day.depart))),
      )
    : MISSING;
  const gestures = useGestures({
    queue,
    view,
    monday,
    date: clock.date,
    onSaved: reload,
  });

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg }]}>
      <View style={styles.header}>
        <RoundButton
          icon="chevron-back"
          label="Semaine précédente"
          onPress={() => setMonday(addWeeks(monday, -1))}
          palette={palette}
        />
        <View style={styles.heading}>
          <Text style={[styles.overline, { color: palette.muted }]}>
            {`Semaine ${isoWeek(monday)}${isCurrent ? " · en cours" : ""}`}
          </Text>
          <Text style={[styles.range, { color: palette.fg }]}>
            {weekRangeLabel(monday)}
          </Text>
        </View>
        <RoundButton
          icon="chevron-forward"
          label="Semaine suivante"
          disabled={isCurrent}
          onPress={() => setMonday(addWeeks(monday, 1))}
          palette={palette}
        />
      </View>

      <View style={styles.meta}>
        <View style={styles.totalLine}>
          <Text style={[styles.metaText, { color: palette.muted }]}>
            Total{" "}
            <Text style={[styles.totalValue, { color: palette.fg }]}>
              {total}
            </Text>
          </Text>
          {pending !== null && (
            <SendIndicator count={pending} palette={palette} />
          )}
        </View>
        {view.unreachable && (
          <Text
            style={[styles.metaText, { color: palette.danger }]}
            accessibilityLiveRegion="polite"
          >
            Serveur injoignable
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.cards}>
        {weekDays(monday, clock.date).map((day, index) => {
          const presence = days?.[index];
          return (
            <DayCard
              key={day.date}
              day={day}
              name={DAY_NAMES[index]}
              presence={presence}
              // Jamais un jour futur, ni tant que la semaine n'est pas connue, même injoignable,
              // à la différence du pointage (`pressPunch`) : un jour passé a très probablement
              // des heures sur le serveur, et une heure posée sur une journée supposée vide
              // effacerait l'autre, le `PUT` portant la journée entière. La garde ne tient que
              // jusqu'au premier pointage de la semaine : il crée son état local (`saveDay`) — ou,
              // cet état perdu, la semaine reconstruite tant qu'il attend l'envoi (`loadWeek`) —,
              // et ses jours passés deviennent alors éditables comme vides.
              onEdit={
                presence && !day.isFuture
                  ? (field) => gestures.edit(presence, field)
                  : undefined
              }
              palette={palette}
            />
          );
        })}
      </ScrollView>

      <PunchDock
        message={gestures.message}
        onUndo={gestures.onUndo}
        button={
          isCurrent
            ? gestures.punchButton
            : {
                label: "Revenir à cette semaine",
                onPress: () => setMonday(currentMonday),
                variant: "secondary",
              }
        }
        clock={clockLine(clock.date, clock.time)}
        palette={palette}
      />
    </SafeAreaView>
  );
}

/** Un bouton rond de l'en-tête, à chevron. */
function RoundButton({
  icon,
  label,
  disabled = false,
  onPress,
  palette,
}: {
  icon: "chevron-back" | "chevron-forward";
  label: string;
  disabled?: boolean;
  onPress: () => void;
  palette: Palette;
}) {
  return (
    <Pressable
      style={[
        styles.round,
        {
          backgroundColor: palette.surface,
          borderColor: palette.line,
          opacity: disabled ? DISABLED_OPACITY : 1,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Ionicons name={icon} size={20} color={palette.fg} />
    </Pressable>
  );
}

/**
 * L'indicateur d'envoi, à côté du total : un point vert quand aucun jour n'attend l'envoi, orange
 * sinon, et son texte (PRD #1, stories 39 et 40).
 *
 * @param count - Le nombre de jours en attente d'envoi.
 */
function SendIndicator({
  count,
  palette,
}: {
  count: number;
  palette: Palette;
}) {
  return (
    <View style={styles.indicator}>
      <View
        style={[
          styles.dot,
          { backgroundColor: count === 0 ? palette.accent : palette.pending },
        ]}
      />
      <Text style={[styles.metaText, { color: palette.muted }]}>
        {pendingText(count)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { flex: 1, alignItems: "center" },
  overline: {
    fontFamily: FONTS.textStrong,
    fontSize: OVERLINE_SIZE,
    letterSpacing: OVERLINE_SPACING,
    textTransform: "uppercase",
  },
  range: { fontFamily: FONTS.digits, fontSize: 19 },
  meta: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  totalLine: { flexDirection: "row", alignItems: "center", gap: 16 },
  indicator: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  metaText: { fontFamily: FONTS.text, fontSize: 13 },
  totalValue: { fontFamily: FONTS.digitsStrong },
  cards: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
});
