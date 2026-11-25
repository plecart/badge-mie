import { describe, expect, it } from "vitest";
import { PALETTES, punchColors } from "./palette";

/** Les couleurs d'un mode, nommées comme les variables du prototype « Pouce ». */
const TOKENS = [
  "bg",
  "surface",
  "surface2",
  "fg",
  "muted",
  "line",
  "accent",
  "accentInk",
  "accentSoft",
  "danger",
  "pending",
];

describe("PALETTES", () => {
  it.each(["light", "dark"] as const)(
    "porte en mode %s chaque couleur du prototype, en hexadécimal",
    (scheme) => {
      const palette = PALETTES[scheme];
      expect(Object.keys(palette).sort()).toEqual([...TOKENS].sort());
      for (const color of Object.values(palette)) {
        expect(color).toMatch(/^#[0-9A-F]{6}$/);
      }
    },
  );
});

describe("punchColors", () => {
  it.each([
    [true, false, "accent", "accentInk"],
    [true, true, "surface2", "fg"],
    [false, false, "surface2", "muted"],
    [false, true, "surface2", "muted"],
  ])(
    "peint le bouton de pointage actif : %s, grisé : %s, d'un fond %s et d'un libellé %s",
    (enabled, muted, background, color) => {
      expect(punchColors({ enabled, muted })).toEqual({ background, color });
    },
  );
});
