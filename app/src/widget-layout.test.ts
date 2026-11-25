import { describe, expect, it } from "vitest";
import { MIN_BUTTON_HEIGHT, RADIUS, widgetLayout } from "./widget-layout";

/** La hauteur que laisse au bouton une mise en page, sous la marge, les heures et l'écart. */
function buttonHeight(height: number): number {
  const { padding, gap, titleHeight, timeHeight } = widgetLayout(height);
  return height - 2 * padding - gap - titleHeight - timeHeight;
}

/** Toutes les hauteurs entières de 40 dp, la hauteur minimale déclarée, à 240 dp. */
const HEIGHTS = Array.from({ length: 201 }, (_, i) => 40 + i);

describe("widgetLayout — les hauteurs du widget", () => {
  it.each([
    ["109 dp, le 2×1 en portrait", 109, 10, 6, 14, 28, 12],
    ["100 dp, au plus juste avec les titres", 100, 10, 6, 14, 28, 12],
    ["99 dp, les heures sans leurs titres", 99, 10, 6, 0, 28, 12],
    ["86 dp, au plus juste avec les heures", 86, 10, 6, 0, 28, 12],
    ["85 dp, le bouton seul", 85, 10, 0, 0, 0, 12],
    ["51 dp, une cellule en paysage", 51, 9, 0, 0, 0, 13],
    ["40 dp, la hauteur minimale déclarée", 40, 4, 0, 0, 0, 18],
  ])(
    "sur %s : marge %i, écart %i, titres %i, heures %i, rayon du bouton %i",
    (_, height, padding, gap, titleHeight, timeHeight, buttonRadius) => {
      expect(widgetLayout(height)).toEqual({
        padding,
        gap,
        titleHeight,
        timeHeight,
        buttonRadius,
      });
    },
  );

  it.each([
    [109, 41],
    [100, 32],
    [99, 45],
    [86, 32],
    [51, 33],
    [40, 32],
  ])("laisse au bouton, sur %i dp, %i dp", (height, button) => {
    expect(buttonHeight(height)).toBe(button);
  });

  it("garde au bouton au moins 32 dp sur toute hauteur de 40 à 240 dp", () => {
    const tooSmall = HEIGHTS.filter((height) => buttonHeight(height) < 32);
    expect([MIN_BUTTON_HEIGHT, tooSmall]).toEqual([32, []]);
  });

  it("arrondit le bouton en concentrique : le rayon du widget, 22 dp, moins la marge", () => {
    const offset = HEIGHTS.filter((height) => {
      const { padding, buttonRadius } = widgetLayout(height);
      return buttonRadius !== RADIUS - padding;
    });
    expect([RADIUS, offset]).toEqual([22, []]);
  });
});
