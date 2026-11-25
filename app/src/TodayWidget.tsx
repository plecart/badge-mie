/**
 * La mise en page du widget d'écran d'accueil (issue #20), en 2×1 : sur une ligne, la pastille
 * d'envoi sans texte, puis l'arrivée et le départ du jour sous leurs titres ; juste en dessous, le
 * bouton de pointage, rectangulaire, pleine largeur. Le modèle arrive tout calculé de `./widget` :
 * les primitives de `react-native-android-widget` ne prennent ni hook ni rendu asynchrone (doc :
 * `rnaw/tutorial/widget-design`, ADR-0002).
 *
 * Le widget est une image, dessinée à la taille exacte que lui donne le lanceur (doc :
 * `rnaw/limitations`) : la ligne des heures a sa hauteur, le bouton prend le reste, et chaque
 * libellé tient sur une ligne, réduit au besoin dans sa case par l'ajustement uniforme d'Android
 * (`adjustsFontSizeToFit`, `TextWidget.java` de la bibliothèque, 0.26.0, lu le 2026-11-25).
 *
 * Les couleurs se résolvent dans la palette de chaque mode, les polices sont celles de l'app,
 * copiées dans le build par l'option `fonts` du plugin (`app.json`) et retrouvées par leur nom de
 * fichier, que `fontFamily` donne sans extension (`ResourceUtils.java` de la bibliothèque, 0.26.0,
 * lu le 2026-11-25). Chaque zone touchable porte un libellé pour TalkBack.
 */

import {
  FlexWidget,
  OverlapWidget,
  TextWidget,
  type WidgetRepresentation,
} from "react-native-android-widget";
import { MISSING, TIME_LABELS } from "./labels";
import { PALETTES, type Palette, resolveTint } from "./palette";
import { BUTTON_LABEL, FONTS } from "./theme";
import type { WidgetButton, WidgetModel } from "./widget";
import { CLICK_ACTIONS } from "./widget-task";

/**
 * La marge intérieure du widget, et l'écart entre ses deux étages comme entre la pastille et les
 * heures.
 */
const PADDING = 10;
const GAP = 6;

/** Le rayon des coins du widget, et celui, petit, du bouton rectangulaire. */
const RADIUS = 22;
const BUTTON_RADIUS = 6;

/** Le diamètre de la pastille d'envoi, celui du point de l'indicateur de l'app, agrandi. */
const DOT_SIZE = 10;

/** L'épaisseur du bord du bouton armé. */
const BORDER_WIDTH = 2;

/** Le corps du chiffre du décompte, et son retrait du coin du bouton, bord compris. */
const DIGIT_SIZE = 12;
const DIGIT_INSET = 6;

/** Le corps du libellé du bouton au plus, plus grand que celui de l'app, à la mesure du bouton. */
const LABEL_SIZE = 20;

/** La hauteur des lignes d'une heure : son titre, puis l'heure, aux corps d'une carte de l'app. */
const TITLE_HEIGHT = 14;
const TIME_HEIGHT = 28;

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

/**
 * Le widget dans la palette d'un mode : la ligne des heures, à sa hauteur, puis le bouton, qui
 * prend le reste.
 */
function TodayWidget({
  model,
  palette,
}: {
  model: WidgetModel;
  palette: Palette;
}) {
  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        flexGap: GAP,
        padding: PADDING,
        borderRadius: RADIUS,
        backgroundColor: palette.surface,
      }}
    >
      <FlexWidget
        style={{
          width: "match_parent",
          height: TITLE_HEIGHT + TIME_HEIGHT,
          flexDirection: "row",
          alignItems: "center",
          flexGap: GAP,
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
      </FlexWidget>
      {/* `OverlapWidget` ne prend pas `flex` : ce `FlexWidget` donne le reste au bouton. */}
      <FlexWidget style={{ width: "match_parent", flex: 1 }}>
        <PunchButton button={model.button} palette={palette} />
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * Une heure du jour, sous son titre, aux corps de la case d'une carte de l'app (`./DayCard`) ; son
 * toucher ouvre l'app sur l'écran de la semaine, où l'heure se corrige.
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
      style={{ flex: 1, height: "match_parent", justifyContent: "center" }}
    >
      <TextWidget
        text={label.toUpperCase()}
        maxLines={1}
        style={{
          ...fitted(TITLE_HEIGHT),
          fontFamily: FONTS.text,
          fontSize: 10,
          color: palette.muted,
        }}
      />
      <TextWidget
        text={time}
        maxLines={1}
        style={{
          ...fitted(TIME_HEIGHT),
          fontFamily: FONTS.digits,
          fontSize: 20,
          color: time === MISSING ? palette.muted : palette.fg,
        }}
      />
    </FlexWidget>
  );
}

/**
 * Le bouton de pointage, rectangulaire, de toute la place que lui laisse la ligne des heures.
 * Armé, il a un bord, et le chiffre de son décompte dans le coin haut droit, de la couleur du
 * libellé.
 */
function PunchButton({
  button,
  palette,
}: {
  button: WidgetButton;
  palette: Palette;
}) {
  const { border, secondsLeft } = button;
  return (
    <OverlapWidget
      {...CLICK_ACTIONS[button.tap]}
      accessibilityLabel={button.accessibilityLabel}
      style={{
        width: "match_parent",
        height: "match_parent",
        overflow: "hidden",
        borderRadius: BUTTON_RADIUS,
        backgroundColor: resolveTint(palette, button.background),
      }}
    >
      <FlexWidget
        style={{
          width: "match_parent",
          height: "match_parent",
          paddingHorizontal: 8,
          borderRadius: BUTTON_RADIUS,
          ...(border && {
            borderWidth: BORDER_WIDTH,
            borderColor: palette[border],
          }),
        }}
      >
        <TextWidget
          text={button.label}
          maxLines={1}
          style={{
            ...fitted("match_parent"),
            ...BUTTON_LABEL,
            fontSize: LABEL_SIZE,
            textAlign: "center",
            color: palette[button.color],
          }}
        />
      </FlexWidget>
      {secondsLeft !== undefined && (
        <FlexWidget
          style={{
            width: "match_parent",
            height: "match_parent",
            alignItems: "flex-end",
            padding: DIGIT_INSET,
          }}
        >
          <TextWidget
            text={String(secondsLeft)}
            style={{
              fontFamily: FONTS.digits,
              fontSize: DIGIT_SIZE,
              color: palette[button.color],
            }}
          />
        </FlexWidget>
      )}
    </OverlapWidget>
  );
}

/**
 * La case d'un libellé d'une ligne, de toute la largeur, que le texte remplit à son corps au plus,
 * réduit pour y tenir : l'ajustement d'Android demande une case de taille fixe.
 */
function fitted(height: number | "match_parent") {
  return { width: "match_parent", height, adjustsFontSizeToFit: true } as const;
}
