import { describe, expect, it } from "vitest";
import { fillMs, rewindMs, whenFinished } from "./hold";

describe("fillMs", () => {
  it("fait durer 500 ms un appui maintenu parti d'une progression vide", () => {
    expect(fillMs(0)).toBe(500);
  });

  it.each([
    [0.25, 375],
    [0.5, 250],
    [1, 0],
  ])(
    "laisse à un appui repris à la progression %d %i ms à maintenir",
    (progress, ms) => {
      expect(fillMs(progress)).toBe(ms);
    },
  );
});

describe("rewindMs", () => {
  it.each([
    [0.75, 125],
    [0.375, 62.5],
    [0, 0],
  ])(
    "ramène à vide la progression %d en %d ms, trois fois plus vite qu'elle ne s'est remplie",
    (progress, ms) => {
      expect(rewindMs(progress)).toBe(ms);
    },
  );

  it("ramène à vide une progression pleine en un sixième de seconde", () => {
    expect(rewindMs(1)).toBeCloseTo(166.67);
  });
});

describe("whenFinished", () => {
  it("déclenche l'appui abouti quand la progression va au bout", () => {
    let calls = 0;
    whenFinished(() => calls++)({ finished: true });
    expect(calls).toBe(1);
  });

  it("ne déclenche rien quand la progression s'arrête avant la fin, appui interrompu ou bouton démonté", () => {
    let calls = 0;
    whenFinished(() => calls++)({ finished: false });
    expect(calls).toBe(0);
  });
});
