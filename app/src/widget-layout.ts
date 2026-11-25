/**
 * Les hauteurs du widget d'écran d'accueil selon celle que lui donne le lanceur (`widgetInfo`) :
 * la ligne des heures cède la place avant le bouton, qui garde toujours une hauteur touchable.
 * Module pur, sans la bibliothèque du widget : `./TodayWidget` le dessine.
 */

/** La marge intérieure du widget, et l'écart entre la ligne des heures et le bouton. */
const PADDING = 10;
const GAP = 6;

/** La hauteur du titre d'une heure, puis de l'heure, aux corps d'une carte de l'app. */
const TITLE_HEIGHT = 14;
const TIME_HEIGHT = 28;

/** Le rayon des coins du widget. */
export const RADIUS = 22;

/**
 * La hauteur minimale du bouton, en dp : la plus grande que laisse la hauteur minimale déclarée du
 * widget, 40 dp (`minHeight` d'`app.json`), sous une marge de 4 dp en haut et en bas.
 */
export const MIN_BUTTON_HEIGHT = 32;

/** Les hauteurs du widget au-dessus de son bouton, qui prend le reste, et l'arrondi du bouton. */
export interface WidgetLayout {
  padding: number;
  /** L'écart entre la ligne des heures et le bouton ; 0 sans ligne des heures. */
  gap: number;
  /** La hauteur des titres « ARRIVÉE » et « DÉPART » ; 0 quand ils ne tiennent pas. */
  titleHeight: number;
  /** La hauteur des heures ; 0 quand elles ne tiennent pas : la ligne des heures disparaît. */
  timeHeight: number;
  /**
   * Le rayon des coins du bouton, concentrique à ceux du widget : leur rayon moins la marge, règle
   * des arrondis imbriqués (doc Android, page Glance « Implement rounded corners » : « calculate a
   * proportional radius for your inner content », `systemRadiusValue - widgetPadding`,
   * developer.android.com/develop/ui/compose/glance/create-app-widget, lue par la session de la
   * PR le 2026-11-25).
   */
  buttonRadius: number;
}

/**
 * Rend les hauteurs du widget pour la hauteur que lui donne le lanceur : les titres et les heures
 * tant qu'ils laissent au bouton {@link MIN_BUTTON_HEIGHT}, puis les heures seules, puis le bouton
 * seul, sous une marge resserrée au besoin.
 *
 * @example widgetLayout(109) // { padding: 10, gap: 6, titleHeight: 14, timeHeight: 28,
 *   //                          buttonRadius: 12 } : un bouton de 41 dp
 * @param height - La hauteur du widget, en dp ; au moins 40, sa hauteur minimale déclarée.
 * @returns Des hauteurs qui laissent au bouton au moins {@link MIN_BUTTON_HEIGHT} sur toute
 *   hauteur d'au moins 40 dp.
 */
export function widgetLayout(height: number): WidgetLayout {
  // La place au-dessus d'un bouton de hauteur minimale, sous la marge entière.
  const room = height - 2 * PADDING - MIN_BUTTON_HEIGHT;
  if (room >= GAP + TIME_HEIGHT) {
    const titleHeight =
      room >= GAP + TITLE_HEIGHT + TIME_HEIGHT ? TITLE_HEIGHT : 0;
    return framed(PADDING, GAP, titleHeight, TIME_HEIGHT);
  }
  const padding = Math.min(
    PADDING,
    Math.floor((height - MIN_BUTTON_HEIGHT) / 2),
  );
  return framed(padding, 0, 0, 0);
}

/** Les hauteurs sous une marge, le bouton arrondi en concentrique. */
function framed(
  padding: number,
  gap: number,
  titleHeight: number,
  timeHeight: number,
): WidgetLayout {
  return {
    padding,
    gap,
    titleHeight,
    timeHeight,
    buttonRadius: RADIUS - padding,
  };
}
