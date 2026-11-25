/**
 * La mise en page du widget d'écran d'accueil (issue #20), en 2×1 : sur une ligne, la pastille
 * d'envoi sans texte, puis l'arrivée et le départ du jour sous leurs titres ; juste en dessous, le
 * bouton de pointage, rectangulaire, pleine largeur. Le modèle arrive tout calculé de `./widget` :
 * les primitives de `react-native-android-widget` ne prennent ni hook ni rendu asynchrone (doc :
 * `rnaw/tutorial/widget-design`, ADR-0002).
 *
 * Le widget est une image, dessinée à la taille exacte que lui donne le lanceur (doc :
 * `rnaw/limitations`) : la ligne des heures prend les hauteurs que `./widget-layout` tire de la
 * sienne, le bouton prend le reste, et chaque libellé tient sur une ligne, réduit au besoin dans sa
 * case par l'ajustement uniforme d'Android (`adjustsFontSizeToFit`, `TextWidget.java` de la
 * bibliothèque, 0.26.0, lu le 2026-11-25).
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
import { PALETTES, type Palette } from "./palette";
import { BUTTON_LABEL, FONTS, SLOT_LABEL, SLOT_TIME } from "./theme";
import type { WidgetButton, WidgetModel } from "./widget";
import { RADIUS, type WidgetLayout, widgetLayout } from "./widget-layout";
import { CLICK_ACTIONS } from "./widget-task";

/** L'écart entre la pastille d'envoi et les heures. */
const DOT_GAP = 6;

/** Le diamètre de la pastille d'envoi, celui du point de l'indicateur de l'app, agrandi. */
const DOT_SIZE = 10;

/** L'épaisseur du bord du bouton armé. */
const BORDER_WIDTH = 2;

/** Le corps du chiffre du décompte, et son retrait du coin du bouton, bord compris. */
const DIGIT_SIZE = 12;
const DIGIT_INSET = 6;

/** Le retrait du libellé du bouton de ses bords gauche et droit. */
const LABEL_INSET = 8;

/** Le corps du libellé du bouton au plus, plus grand que celui de l'app, à la mesure du bouton. */
const LABEL_SIZE = 20;

/**
 * Rend le widget dans les deux modes du téléphone : le système affiche l'arbre du mode courant,
 * les deux ayant la même structure (doc : `rnaw/tutorial/dark-mode-widget`).
 *
 * @param model - Ce que montre le widget, de `widgetModel`.
 * @param height - La hauteur du widget posé, en dp (`widgetInfo`).
 */
export function todayWidget(
  model: WidgetModel,
  height: number,
): WidgetRepresentation {
  const layout = widgetLayout(height);
  return {
    light: (
      <TodayWidget model={model} palette={PALETTES.light} layout={layout} />
    ),
    dark: <TodayWidget model={model} palette={PALETTES.dark} layout={layout} />,
  };
}

/**
 * Le widget dans la palette d'un mode : la ligne des heures, aux hauteurs de `layout`, absente
 * quand elles sont nulles, puis le bouton, qui prend le reste.
 */
function TodayWidget({
  model,
  palette,
  layout,
}: {
  model: WidgetModel;
  palette: Palette;
  layout: WidgetLayout;
}) {
  const { padding, gap, titleHeight, timeHeight, buttonRadius } = layout;
  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        flexGap: gap,
        padding,
        borderRadius: RADIUS,
        backgroundColor: palette.surface,
      }}
    >
      {timeHeight > 0 && (
        <FlexWidget
          style={{
            width: "match_parent",
            height: titleHeight + timeHeight,
            flexDirection: "row",
            alignItems: "center",
            flexGap: DOT_GAP,
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
            layout={layout}
          />
          <TimeSlot
            label={TIME_LABELS.depart}
            time={model.departure}
            palette={palette}
            layout={layout}
          />
        </FlexWidget>
      )}
      {/* `OverlapWidget` ne prend pas `flex` : ce `FlexWidget` donne le reste au bouton. */}
      <FlexWidget style={{ width: "match_parent", flex: 1 }}>
        <PunchButton
          button={model.button}
          palette={palette}
          radius={buttonRadius}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * Une heure du jour, sous son titre quand il a sa hauteur, aux corps de la case d'une carte de
 * l'app ({@link SLOT_LABEL}, {@link SLOT_TIME}) ; son toucher ouvre l'app sur l'écran de la
 * semaine, où l'heure se corrige.
 */
function TimeSlot({
  label,
  time,
  palette,
  layout: { titleHeight, timeHeight },
}: {
  label: string;
  time: string;
  palette: Palette;
  layout: WidgetLayout;
}) {
  return (
    <FlexWidget
      {...CLICK_ACTIONS.openApp}
      accessibilityLabel={`${label} ${time}`}
      style={{ flex: 1, height: "match_parent", justifyContent: "center" }}
    >
      {titleHeight > 0 && (
        <TextWidget
          text={label.toUpperCase()}
          maxLines={1}
          style={{
            ...fitted(titleHeight),
            ...SLOT_LABEL,
            color: palette.muted,
          }}
        />
      )}
      <TextWidget
        text={time}
        maxLines={1}
        style={{
          ...fitted(timeHeight),
          ...SLOT_TIME,
          color: time === MISSING ? palette.muted : palette.fg,
        }}
      />
    </FlexWidget>
  );
}

/**
 * Le bouton de pointage, de toute la place que lui laisse la ligne des heures, aux coins de rayon
 * `radius`. Armé, il a un bord, et le chiffre de son décompte dans le coin haut droit, de la
 * couleur du libellé.
 */
function PunchButton({
  button,
  palette,
  radius,
}: {
  button: WidgetButton;
  palette: Palette;
  radius: number;
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
        borderRadius: radius,
        backgroundColor: palette[button.background],
      }}
    >
      <FlexWidget
        style={{
          width: "match_parent",
          height: "match_parent",
          paddingHorizontal: LABEL_INSET,
          borderRadius: radius,
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
