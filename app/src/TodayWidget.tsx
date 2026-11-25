/**
 * La mise en page du widget d'écran d'accueil (issue #20), en 2×2 : en haut, la pastille d'envoi
 * sans texte, puis l'arrivée et le départ du jour sous leurs titres ; en dessous, le bouton de
 * pointage, pleine largeur. Le modèle arrive tout calculé de `./widget` : les primitives de
 * `react-native-android-widget` ne prennent ni hook ni rendu asynchrone (doc :
 * `rnaw/tutorial/widget-design`, ADR-0002).
 *
 * Le widget est une image, dessinée à la taille exacte que lui donne le lanceur (doc :
 * `rnaw/limitations`) : la mise en page se dimensionne sur elle ({@link WidgetSize}), et chaque
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
  type WidgetInfo,
  type WidgetRepresentation,
} from "react-native-android-widget";
import { MISSING, TIME_LABELS } from "./labels";
import { PALETTES, type Palette, resolveTint } from "./palette";
import { BUTTON, BUTTON_LABEL, FONTS } from "./theme";
import type { WidgetButton, WidgetModel } from "./widget";
import { CLICK_ACTIONS } from "./widget-task";

/** La taille du widget posé, en dp, telle que la donne la bibliothèque. */
export type WidgetSize = Pick<WidgetInfo, "width" | "height">;

/**
 * La marge intérieure du widget, et l'écart entre ses deux étages comme entre la pastille et les
 * heures.
 */
const PADDING = 12;
const GAP = 8;

/** Le rayon des coins du widget. */
const RADIUS = 22;

/** Le diamètre de la pastille d'envoi, celui du point de l'indicateur de l'app, agrandi. */
const DOT_SIZE = 10;

/** L'épaisseur du bord du bouton armé. */
const BORDER_WIDTH = 2;

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
 * @param size - La taille du widget posé.
 */
export function todayWidget(
  model: WidgetModel,
  size: WidgetSize,
): WidgetRepresentation {
  return {
    light: <TodayWidget model={model} palette={PALETTES.light} size={size} />,
    dark: <TodayWidget model={model} palette={PALETTES.dark} size={size} />,
  };
}

/**
 * Le widget dans la palette d'un mode. Les deux étages se partagent la hauteur par moitié : le
 * bouton, cible du pouce et support du compte à rebours, en prend autant que les heures, et rétrécit
 * avec un widget moins haut, en paysage.
 */
function TodayWidget({
  model,
  palette,
  size,
}: {
  model: WidgetModel;
  palette: Palette;
  size: WidgetSize;
}) {
  const stagesHeight = size.height - 2 * PADDING - GAP;
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
          flex: 1,
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
      <PunchButton
        button={model.button}
        palette={palette}
        width={size.width - 2 * PADDING}
        height={Math.round(stagesHeight / 2)}
      />
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
 * Le bouton de pointage, pleine largeur, de la hauteur donnée. Armé, sa bande du compte à rebours
 * part de la gauche, de la part du délai qui reste de `width`, la largeur attendue du bouton ; le
 * libellé et le bord se dessinent par-dessus. Le bouton lui-même ne prend pas `width` : il ne déborde
 * jamais du widget, et la bande s'y coupe.
 */
function PunchButton({
  button,
  palette,
  width,
  height,
}: {
  button: WidgetButton;
  palette: Palette;
  width: number;
  height: number;
}) {
  const { countdown, border } = button;
  return (
    <OverlapWidget
      {...CLICK_ACTIONS[button.tap]}
      accessibilityLabel={button.accessibilityLabel}
      style={{
        width: "match_parent",
        height,
        overflow: "hidden",
        borderRadius: BUTTON.borderRadius,
        backgroundColor: resolveTint(palette, button.background),
      }}
    >
      {countdown && (
        <FlexWidget
          style={{
            width: Math.round(width * countdown.remaining),
            height: "match_parent",
            backgroundColor: resolveTint(palette, countdown.color),
          }}
        />
      )}
      <FlexWidget
        style={{
          width: "match_parent",
          height: "match_parent",
          paddingHorizontal: 8,
          borderRadius: BUTTON.borderRadius,
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
