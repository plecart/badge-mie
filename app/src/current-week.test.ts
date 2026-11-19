import { describe, expect, it } from "vitest";
import { followCurrentWeek } from "./current-week";

describe("followCurrentWeek", () => {
  it("passe à la nouvelle semaine en cours un écran qui affichait l'ancienne", () => {
    expect(followCurrentWeek("2026-11-16", "2026-11-16", "2026-11-23")).toBe(
      "2026-11-23",
    );
  });

  it("garde la semaine passée qu'affiche l'écran", () => {
    expect(followCurrentWeek("2026-11-09", "2026-11-16", "2026-11-23")).toBe(
      "2026-11-09",
    );
  });
});
