/**
 * L'écran de la semaine, variante « Pouce » du prototype : l'en-tête et ses flèches, la ligne du
 * total, les cinq cartes du lundi au vendredi et la bande du bas (issue #3, « Décisions », point 7).
 * En lecture seule : les heures deviennent touchables, et la bande reçoit le bouton de pointage,
 * avec #4.
 */

import {
  addWeeks,
  dayDuration,
  formatDuration,
  isoWeek,
  mondayOf,
  type PresenceDay,
  type WeekDay,
  weekDays,
  weekRangeLabel,
  weekTotal,
} from "@badge-mie/week";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useEffectEvent, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { readWeek, TokenRejectedError } from "./api";
import { BUTTON, BUTTON_LABEL, FONTS, type Palette, usePalette } from "./theme";
import { today } from "./today";
import { loadWeek, type WeekView } from "./week-store";

/** Les jours abrégés des cinq cartes, du lundi au vendredi. */
const DAY_NAMES = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven."];

/** Ce qu'affiche une heure, une durée ou un total encore inconnus. */
const MISSING = "—";

/** L'opacité de la flèche « Semaine suivante » sur la semaine en cours. */
const DISABLED_OPACITY = 0.28;

/** L'opacité des cases d'un jour futur. */
const FUTURE_OPACITY = 0.45;

/** Le corps du sur-titre de l'en-tête, et son espacement de 0,08em. */
const OVERLINE_SIZE = 11;
const OVERLINE_SPACING = 0.08 * OVERLINE_SIZE;

/**
 * @param token - Le jeton d'accès, pour lire les semaines sur le serveur.
 * @param onTokenRejected - Appelé quand le serveur refuse le jeton.
 */
export function WeekScreen({
  token,
  onTokenRejected,
}: {
  token: string;
  onTokenRejected: () => void;
}) {
  const palette = usePalette();
  const date = today();
  const currentMonday = mondayOf(date);
  const [monday, setMonday] = useState(currentMonday);
  // Chaque vue garde le lundi qui l'a demandée : celle d'une autre semaine n'est pas affichée.
  const [loaded, setLoaded] = useState<{ monday: string; view: WeekView }>();
  const reportTokenRejected = useEffectEvent(onTokenRejected);

  useEffect(() => {
    // Un chargement remplacé (autre semaine, ou la même redemandée) n'affiche plus rien.
    let current = true;
    loadWeek(
      monday,
      {
        storage: AsyncStorage,
        read: (week) => readWeek(token, week),
        // En lecture seule, l'écran n'a pas de file d'envoi : aucun jour n'attend.
        pending: async () => [],
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
  }, [monday, token]);

  const view = loaded?.monday === monday ? loaded.view : undefined;
  const days = view?.days ?? null;
  const isCurrent = monday >= currentMonday;
  const total = days
    ? formatDuration(
        weekTotal(days.map((day) => dayDuration(day.arrivee, day.depart))),
      )
    : MISSING;

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
        <Text style={[styles.metaText, { color: palette.muted }]}>
          Total{" "}
          <Text style={[styles.totalValue, { color: palette.fg }]}>
            {total}
          </Text>
        </Text>
        {view?.unreachable && (
          <Text
            style={[styles.metaText, { color: palette.danger }]}
            accessibilityLiveRegion="polite"
          >
            Serveur injoignable
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.cards}>
        {weekDays(monday, date).map((day, index) => (
          <DayCard
            key={day.date}
            day={day}
            name={DAY_NAMES[index]}
            presence={days?.[index]}
            palette={palette}
          />
        ))}
      </ScrollView>

      <View style={[styles.dock, { borderTopColor: palette.line }]}>
        {isCurrent ? (
          // La place du bouton de pointage, qui arrive avec #4.
          <View style={{ height: BUTTON.height }} />
        ) : (
          <Pressable
            style={[
              BUTTON,
              styles.secondary,
              { backgroundColor: palette.surface, borderColor: palette.line },
            ]}
            onPress={() => setMonday(currentMonday)}
            accessibilityRole="button"
          >
            <Text style={[BUTTON_LABEL, { color: palette.fg }]}>
              Revenir à cette semaine
            </Text>
          </Pressable>
        )}
      </View>
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
 * La carte d'un jour : son nom et son numéro, ses deux heures, sa durée.
 *
 * @param presence - La journée lue, ou `undefined` tant que rien n'est arrivé.
 */
function DayCard({
  day,
  name,
  presence,
  palette,
}: {
  day: WeekDay;
  name: string | undefined;
  presence: PresenceDay | undefined;
  palette: Palette;
}) {
  const arrival = presence?.arrivee ?? null;
  const departure = presence?.depart ?? null;
  const duration = dayDuration(arrival, departure);
  const empty = arrival === null && departure === null;
  const background = day.isToday
    ? palette.accentSoft
    : day.isFuture
      ? "transparent"
      : palette.surface;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: background,
          borderColor: day.isToday ? palette.accent : palette.line,
        },
      ]}
    >
      <View style={styles.dayColumn}>
        <Text style={[styles.dayName, { color: palette.muted }]}>{name}</Text>
        <Text style={[styles.dayNumber, { color: palette.fg }]}>
          {Number(day.date.slice(8))}
        </Text>
      </View>
      <TimeSlot label="Arrivée" time={arrival} day={day} palette={palette} />
      <TimeSlot label="Départ" time={departure} day={day} palette={palette} />
      <Text style={[styles.duration, { color: palette.muted }]}>
        {duration !== null ? formatDuration(duration) : empty ? "" : MISSING}
      </Text>
    </View>
  );
}

/** Une case d'heure : son libellé, puis l'heure, ou « — » si elle manque. */
function TimeSlot({
  label,
  time,
  day,
  palette,
}: {
  label: string;
  time: string | null;
  day: WeekDay;
  palette: Palette;
}) {
  return (
    <View
      style={[
        styles.slot,
        {
          backgroundColor: day.isToday ? palette.surface : palette.surface2,
          opacity: day.isFuture ? FUTURE_OPACITY : 1,
        },
      ]}
    >
      <Text style={[styles.slotLabel, { color: palette.muted }]}>{label}</Text>
      <Text
        style={[
          styles.slotTime,
          { color: time === null ? palette.muted : palette.fg },
        ]}
      >
        {time ?? MISSING}
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
  metaText: { fontFamily: FONTS.text, fontSize: 13 },
  totalValue: { fontFamily: FONTS.digitsStrong },
  cards: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  dayColumn: { width: 44 },
  dayName: { fontFamily: FONTS.text, fontSize: 12 },
  dayNumber: { fontFamily: FONTS.digits, fontSize: 20 },
  slot: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  slotLabel: {
    fontFamily: FONTS.text,
    fontSize: 10,
    textTransform: "uppercase",
  },
  slotTime: { fontFamily: FONTS.digits, fontSize: 20 },
  duration: {
    width: 64,
    textAlign: "right",
    fontFamily: FONTS.text,
    fontSize: 13,
  },
  dock: { borderTopWidth: 1, padding: 16 },
  secondary: { borderWidth: 1 },
});
