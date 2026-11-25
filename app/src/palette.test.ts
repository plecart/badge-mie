import { describe, expect, it } from "vitest";
import { PALETTES } from "./palette";

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
