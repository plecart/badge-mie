import { describe, expect, it } from "vitest";
import { today } from "./today";

describe("today", () => {
  it("rend la date locale du téléphone, le soir, quand la date UTC est déjà le lendemain", () => {
    expect(today(new Date(2026, 10, 16, 23, 30))).toBe("2026-11-16");
  });

  it("écrit le mois et le jour sur deux chiffres", () => {
    expect(today(new Date(2026, 0, 5, 9, 0))).toBe("2026-01-05");
  });
});
