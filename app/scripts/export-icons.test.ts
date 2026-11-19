import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ICON_SIZE, renderIcon } from "./export-icons";

/** Le centre du rendu, en pixels. */
const CENTER = ICON_SIZE / 2;

/**
 * Le rayon de la zone sûre, en pixels : le cercle central de 66 de diamètre sur un calque de 108
 * (guide Android des icônes adaptatives), que le masque du lanceur ne rogne jamais.
 */
const SAFE_RADIUS = (33 / 108) * ICON_SIZE;

/** Le nombre d'octets d'un pixel RGBA, et la place de son opacité. */
const RGBA = 4;
const ALPHA = 3;

/** Compte les pixels non transparents du rendu, dedans et hors de la zone sûre. */
function visiblePixels(svg: string): { inside: number; outside: number } {
  const { pixels } = renderIcon(svg);
  let inside = 0;
  let outside = 0;
  for (let y = 0; y < ICON_SIZE; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      if (pixels[(y * ICON_SIZE + x) * RGBA + ALPHA] === 0) continue;
      // La distance se mesure au centre du pixel.
      const distance = Math.hypot(x + 0.5 - CENTER, y + 0.5 - CENTER);
      if (distance <= SAFE_RADIUS) inside++;
      else outside++;
    }
  }
  return { inside, outside };
}

const source = readFileSync(
  new URL("../assets/icon.svg", import.meta.url),
  "utf8",
);

describe("icône adaptative", () => {
  it("n'a aucun pixel visible hors de la zone sûre", () => {
    expect(visiblePixels(source).outside).toBe(0);
  });

  it("a son motif visible dans la zone sûre", () => {
    expect(visiblePixels(source).inside).toBeGreaterThan(0);
  });
});
