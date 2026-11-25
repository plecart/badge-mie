import { describe, expect, it } from "vitest";
import { blend, PALETTES, punchColors, resolveTint } from "./palette";

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

describe("blend", () => {
  it.each([
    [0, "accent"],
    [-0.5, "accent"],
    [1, "accentInk"],
    [1.5, "accentInk"],
  ] as const)(
    "rend à %d du chemin de accent vers accentInk la clé %s, sans mélange",
    (amount, token) => {
      expect(blend("accent", "accentInk", amount)).toBe(token);
    },
  );

  it("rend le mélange des deux clés entre les deux bouts du chemin", () => {
    expect(blend("accent", "accentInk", 0.4)).toEqual({
      from: "accent",
      to: "accentInk",
      amount: 0.4,
    });
  });

  it("rend la clé seule quand le chemin part et arrive sur la même", () => {
    expect(blend("surface2", "surface2", 0.4)).toBe("surface2");
  });
});

describe("resolveTint", () => {
  it("résout une clé dans la palette du mode affiché", () => {
    expect(resolveTint(PALETTES.dark, "accent")).toBe("#86CDB0");
  });

  it.each([
    // #2C6A54 → #FFFFFF à mi-chemin : 149,5 · 180,5 · 169,5, arrondis au-dessus.
    ["light", "accent", "accentInk", 0.5, "#96B5AA"],
    // #86CDB0 → #0E1311 au quart : 104 · 158,5 · 136,25.
    ["dark", "accent", "accentInk", 0.25, "#689F88"],
    // #0E1311 → #161D1A à mi-chemin : 18 · 24 · 21,5.
    ["dark", "accentInk", "surface", 0.5, "#121816"],
    // Un canal sous 16 garde ses deux chiffres : #0E1311 vers lui-même.
    ["dark", "bg", "accentInk", 0.5, "#0E1311"],
  ] as const)(
    "mélange en mode %s %s vers %s à %d, canal par canal : %s",
    (scheme, from, to, amount, hex) => {
      expect(resolveTint(PALETTES[scheme], { from, to, amount })).toBe(hex);
    },
  );
});
