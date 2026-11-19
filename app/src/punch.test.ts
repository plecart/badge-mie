import type { PresenceDay } from "@badge-mie/week";
import { describe, expect, it } from "vitest";
import { canPunch, editTime, punch, punchAction } from "./punch";

/** Une journée du mercredi 18 novembre 2026, aux heures données. */
function wednesday(arrivee: string | null, depart: string | null): PresenceDay {
  return { jour: "2026-11-18", arrivee, depart };
}

describe("punchAction", () => {
  it.each([
    ["une journée vide", wednesday(null, null)],
    ["une journée qui n'a qu'un départ", wednesday(null, "17:00")],
  ])("propose l'arrivée sur %s", (_, day) => {
    expect(punchAction(day)).toBe("arrival");
  });

  it("propose le départ quand l'arrivée est pointée", () => {
    expect(punchAction(wednesday("08:30", null))).toBe("departure");
  });

  it("ne propose plus rien quand la journée est terminée", () => {
    expect(punchAction(wednesday("08:30", "17:00"))).toBe("done");
  });

  it.each([
    ["un samedi", "2026-11-21"],
    ["un dimanche", "2026-11-22"],
  ])("ne propose aucun pointage %s", (_, jour) => {
    expect(punchAction({ jour, arrivee: null, depart: null })).toBe("weekend");
  });

  it("lève une RangeError sur un jour qui n'est pas une date réelle", () => {
    expect(() =>
      punchAction({ jour: "2026-02-30", arrivee: null, depart: null }),
    ).toThrow(
      new RangeError("date invalide : « 2026-02-30 », attendu AAAA-MM-JJ"),
    );
  });
});

describe("canPunch", () => {
  it.each([
    ["arrival", true],
    ["departure", true],
    ["done", false],
    ["weekend", false],
  ] as const)("dit si l'action %s se pointe : %s", (action, expected) => {
    expect(canPunch(action)).toBe(expected);
  });
});

describe("punch", () => {
  it("pointe l'arrivée d'une journée vide", () => {
    expect(punch(wednesday(null, null), "08:30")).toEqual({
      day: wednesday("08:30", null),
    });
  });

  it("pointe le départ d'une journée commencée", () => {
    expect(punch(wednesday("08:30", null), "17:00")).toEqual({
      day: wednesday("08:30", "17:00"),
    });
  });

  it("refuse un départ pointé dans la même minute que l'arrivée", () => {
    expect(punch(wednesday("08:30", null), "08:30")).toEqual({
      refusal: "Le départ doit suivre l'arrivée",
    });
  });

  it.each([
    [
      "une journée terminée",
      wednesday("08:30", "17:00"),
      "rien à pointer le 2026-11-18 : done",
    ],
    [
      "un samedi",
      { jour: "2026-11-21", arrivee: null, depart: null },
      "rien à pointer le 2026-11-21 : weekend",
    ],
  ])("lève une RangeError sur %s, au bouton désactivé", (_, day, message) => {
    expect(() => punch(day, "18:00")).toThrow(new RangeError(message));
  });
});

describe("editTime", () => {
  it.each([
    [
      "un départ corrigé avant l'arrivée",
      () => editTime(wednesday("08:30", "17:00"), "depart", "08:00"),
      "Le départ doit suivre l'arrivée",
    ],
    [
      "une arrivée corrigée après le départ",
      () => editTime(wednesday("08:30", "17:00"), "arrivee", "18:00"),
      "Le départ doit suivre l'arrivée",
    ],
    [
      "l'effacement de l'arrivée d'une journée qui a un départ",
      () => editTime(wednesday("08:30", "17:00"), "arrivee", null),
      "Effacez d'abord le départ de ce jour",
    ],
  ])("refuse %s, avec son motif", (_, edit, refusal) => {
    expect(edit()).toEqual({ refusal });
  });

  it.each([
    [
      "efface le départ",
      () => editTime(wednesday("08:30", "17:00"), "depart", null),
      wednesday("08:30", null),
    ],
    [
      "efface l'arrivée d'une journée sans départ",
      () => editTime(wednesday("08:30", null), "arrivee", null),
      wednesday(null, null),
    ],
    [
      "corrige l'arrivée avant le départ",
      () => editTime(wednesday("08:30", "17:00"), "arrivee", "08:00"),
      wednesday("08:00", "17:00"),
    ],
    [
      "pose un départ sur une journée sans arrivée",
      () => editTime(wednesday(null, null), "depart", "17:00"),
      wednesday(null, "17:00"),
    ],
  ])("%s", (_, edit, day) => {
    expect(edit()).toEqual({ day });
  });
});

describe("heures invalides", () => {
  it.each([
    ["punch", () => punch(wednesday(null, null), "8:30")],
    ["editTime", () => editTime(wednesday("08:30", null), "arrivee", "8:30")],
  ])(
    "%s lève une RangeError sur une heure qui n'est pas HH:MM, même seule",
    (_, call) => {
      expect(call).toThrow(
        new RangeError("heure invalide : « 8:30 », attendu HH:MM"),
      );
    },
  );
});
