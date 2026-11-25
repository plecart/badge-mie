/**
 * La mise en page du widget d'écran d'accueil (issue #20), en 4×1 : de gauche à droite, la
 * pastille d'envoi sans texte, l'arrivée et le départ du jour, et le bouton de pointage. Le
 * modèle arrive tout calculé de `./widget` : les primitives de `react-native-android-widget` ne
 * prennent ni hook ni rendu asynchrone (doc : `rnaw/tutorial/widget-design`, ADR-0002).
 *
 * Les couleurs se résolvent dans la palette de chaque mode, les polices sont celles de l'app,
 * copiées dans le build par l'option `fonts` du plugin (`app.json`) et retrouvées par leur nom de
 * fichier, que `fontFamily` donne sans extension (`ResourceUtils.java` de la bibliothèque, 0.26.0,
 * lu le 2026-11-25). Le widget est une image : chaque zone touchable porte un libellé pour
 * TalkBack.
 */

import {
  FlexWidget,
  TextWidget,
  type WidgetRepresentation,
} from "react-native-android-widget";
import { MISSING, TIME_LABELS } from "./labels";
import { PALETTES, type Palette, resolveTint } from "./palette";
import { BUTTON, BUTTON_LABEL, FONTS } from "./theme";
import type { WidgetModel } from "./widget";
import { CLICK_ACTIONS } from "./widget-task";

/** Le diamètre de la pastille d'envoi, celui du point de l'indicateur de l'app, agrandi. */
const DOT_SIZE = 10;

/** L'épaisseur du bord du bouton armé. */
const BORDER_WIDTH = 2;

/**
 * Rend le widget dans les deux modes du téléphone : le système affiche l'arbre du mode courant,
 * les deux ayant la même structure (doc : `rnaw/tutorial/dark-mode-widget`).
 *
 * @param model - Ce que montre le widget, de `widgetModel`.
 */
export function todayWidget(model: WidgetModel): WidgetRepresentation {
  return {
    light: <TodayWidget model={model} palette={PALETTES.light} />,
    dark: <TodayWidget model={model} palette={PALETTES.dark} />,
  };
}

/** Le widget dans la palette d'un mode. */
function TodayWidget({
  model,
  palette,
}: {
  model: WidgetModel;
  palette: Palette;
}) {
  const { button } = model;
  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "row",
        alignItems: "center",
        flexGap: 12,
        paddingHorizontal: 14,
        borderRadius: 22,
        backgroundColor: palette.surface,
      }}
    >
      <FlexWidget
        style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: palette[model.dot],
        }}
      />
      <TimeSlot
        label={TIME_LABELS.arrivee}
        time={model.arrival}
        palette={palette}
      />
      <TimeSlot
        label={TIME_LABELS.depart}
        time={model.departure}
        palette={palette}
      />
      <FlexWidget
        {...CLICK_ACTIONS[button.tap]}
        accessibilityLabel={button.accessibilityLabel}
        style={{
          flex: 1,
          height: BUTTON.height,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 8,
          borderRadius: BUTTON.borderRadius,
          backgroundColor: resolveTint(palette, button.background),
          ...(button.border && {
            borderWidth: BORDER_WIDTH,
            borderColor: palette[button.border],
          }),
        }}
      >
        <TextWidget
          text={button.label}
          maxLines={2}
          style={{
            ...BUTTON_LABEL,
            textAlign: "center",
            color: resolveTint(palette, button.color),
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * Une heure du jour, sous son libellé, aux corps de la case d'une carte de l'app (`./DayCard`) ;
 * son toucher ouvre l'app sur l'écran de la semaine, où l'heure se corrige.
 */
function TimeSlot({
  label,
  time,
  palette,
}: {
  label: string;
  time: string;
  palette: Palette;
}) {
  return (
    <FlexWidget
      {...CLICK_ACTIONS.openApp}
      accessibilityLabel={`${label} ${time}`}
      style={{ height: "match_parent", justifyContent: "center" }}
    >
      <TextWidget
        text={label.toUpperCase()}
        style={{ fontFamily: FONTS.text, fontSize: 10, color: palette.muted }}
      />
      <TextWidget
        text={time}
        style={{
          fontFamily: FONTS.digits,
          fontSize: 20,
          color: time === MISSING ? palette.muted : palette.fg,
        }}
      />
    </FlexWidget>
  );
}
