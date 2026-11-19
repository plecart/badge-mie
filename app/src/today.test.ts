import { describe, expect, it } from "vitest";
import { currentTime, instantAt, today } from "./today";

describe("today", () => {
  it("rend la date locale du téléphone, le soir, quand la date UTC est déjà le lendemain", () => {
    expect(today(new Date(2026, 10, 16, 23, 30))).toBe("2026-11-16");
  });

  it("écrit le mois et le jour sur deux chiffres", () => {
    expect(today(new Date(2026, 0, 5, 9, 0))).toBe("2026-01-05");
  });
});

describe("currentTime", () => {
  it.each([
    [
      "sur deux chiffres, secondes tronquées",
      new Date(2026, 10, 18, 8, 5, 59),
      "08:05",
    ],
    ["à minuit", new Date(2026, 10, 18, 0, 0), "00:00"],
    ["à la dernière minute du jour", new Date(2026, 10, 18, 23, 59), "23:59"],
  ])("rend l'heure locale du téléphone à la minute, %s", (_, now, time) => {
    expect(currentTime(now)).toBe(time);
  });
});

describe("instantAt", () => {
  it("rend l'instant local d'une date à une heure, que today et currentTime relisent", () => {
    const instant = instantAt("2026-11-18", "08:05");
    expect([today(instant), currentTime(instant)]).toEqual([
      "2026-11-18",
      "08:05",
    ]);
  });
});
