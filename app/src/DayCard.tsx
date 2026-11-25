/**
 * La carte d'un jour de l'écran de la semaine : son nom et son numéro, ses deux heures, et ce
 * qu'il compte — sa durée, ou le crédit d'un férié (`durationText`) — (issue #3, « Décisions »,
 * point 7). Une heure se touche pour la corriger quand le jour se corrige (issue #4, critères
 * « Écran »). Un jour non travaillé a sa carte grisée ; celle d'aujourd'hui reste mise en évidence
 * (ADR-0001, « Propositions UX »).
 */

import type { PresenceDay, WeekDay } from "@badge-mie/week";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { durationText, editHint, MISSING, TIME_LABELS } from "./labels";
import type { TimeField } from "./punch";
import { FONTS, type Palette } from "./theme";

/** Les deux heures d'une carte, dans l'ordre d'affichage. */
const TIME_FIELDS: readonly TimeField[] = ["arrivee", "depart"];

/** L'opacité des cases d'un jour futur. */
const FUTURE_OPACITY = 0.45;

/**
 * Le fond d'une carte : l'accent doux pour aujourd'hui, même non travaillé ; la surface atténuée
 * pour un autre jour non travaillé, passé ou à venir ; rien pour un autre jour à venir, dont les
 * cases s'estompent ; la surface pour un jour passé.
 */
function cardBackground(day: WeekDay, palette: Palette): string {
  if (day.isToday) return palette.accentSoft;
  if (day.isNonWorking) return palette.surface2;
  return day.isFuture ? "transparent" : palette.surface;
}

/**
 * @param name - Le jour abrégé, « Lun. » à « Dim. ».
 * @param presence - La journée lue, ou `undefined` tant que rien n'est arrivé.
 * @param onEdit - Ouvre la correction d'une heure ; `undefined` si le jour ne se corrige pas.
 */
export function DayCard({
  day,
  name,
  presence,
  onEdit,
  palette,
}: {
  day: WeekDay;
  name: string | undefined;
  presence: PresenceDay | undefined;
  onEdit: ((field: TimeField) => void) | undefined;
  palette: Palette;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBackground(day, palette),
          borderColor: day.isToday ? palette.accent : palette.line,
        },
      ]}
    >
      <View style={styles.dayColumn}>
        <Text style={[styles.dayName, { color: palette.muted }]}>{name}</Text>
        <Text
          style={[
            styles.dayNumber,
            { color: day.isNonWorking ? palette.muted : palette.fg },
          ]}
        >
          {Number(day.date.slice(8))}
        </Text>
      </View>
      {TIME_FIELDS.map((field) => (
        <TimeSlot
          key={field}
          field={field}
          time={presence?.[field] ?? null}
          day={day}
          onEdit={onEdit && (() => onEdit(field))}
          palette={palette}
        />
      ))}
      <Text style={[styles.duration, { color: palette.muted }]}>
        {presence && durationText(presence, day.isToday)}
      </Text>
    </View>
  );
}

/**
 * Une case d'heure : son libellé, puis l'heure, ou « — » si elle manque. Touchable quand le jour
 * se corrige : son nom reste son texte visible, et l'indication d'accessibilité dit le geste.
 */
function TimeSlot({
  field,
  time,
  day,
  onEdit,
  palette,
}: {
  field: TimeField;
  time: string | null;
  day: WeekDay;
  onEdit: (() => void) | undefined;
  palette: Palette;
}) {
  return (
    <Pressable
      style={[
        styles.slot,
        {
          // Sur une carte teintée, aujourd'hui ou grisée, les cases prennent la surface pour s'en
          // détacher.
          backgroundColor:
            day.isToday || day.isNonWorking
              ? palette.surface
              : palette.surface2,
          opacity: day.isFuture ? FUTURE_OPACITY : 1,
        },
      ]}
      onPress={onEdit}
      disabled={onEdit === undefined}
      accessibilityRole={onEdit && "button"}
      accessibilityHint={onEdit && editHint(field, day.date)}
    >
      <Text style={[styles.slotLabel, { color: palette.muted }]}>
        {TIME_LABELS[field]}
      </Text>
      <Text
        style={[
          styles.slotTime,
          { color: time === null ? palette.muted : palette.fg },
        ]}
      >
        {time ?? MISSING}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
});
