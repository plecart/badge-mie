import { describe, expect, it } from "vitest";
import { fillMs, rewindMs } from "./hold";

describe("fillMs", () => {
  it("fait durer 1 000 ms un appui maintenu parti d'une progression vide", () => {
    expect(fillMs(0)).toBe(1000);
  });

  it.each([
    [0.25, 750],
    [0.5, 500],
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
    [0.75, 250],
    [0.375, 125],
    [0, 0],
  ])(
    "ramène à vide la progression %d en %i ms, trois fois plus vite qu'elle ne s'est remplie",
    (progress, ms) => {
      expect(rewindMs(progress)).toBe(ms);
    },
  );

  it("ramène à vide une progression pleine en un tiers de seconde", () => {
    expect(rewindMs(1)).toBeCloseTo(333.33);
  });
});
