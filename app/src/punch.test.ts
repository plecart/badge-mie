import {
  emptyDay,
  mondayOf,
  type PresenceDay,
  weekDates,
} from "@badge-mie/week";
import { describe, expect, it } from "vitest";
import {
  canPunch,
  editTime,
  pressPunch,
  punch,
  punchAction,
  punchButton,
} from "./punch";
import type { WeekView } from "./week-store";

/** Le mercredi 18 novembre 2026, aujourd'hui. */
const WEDNESDAY = "2026-11-18";

/** Le lundi de la semaine affichée, celle de {@link WEDNESDAY}. */
const MONDAY = "2026-11-16";

/** La journée de {@link WEDNESDAY}, aux heures données. */
function wednesday(arrivee: string | null, depart: string | null): PresenceDay {
  return { jour: WEDNESDAY, arrivee, depart };
}

/** La semaine affichée, lue, avec cette journée ; ses autres journées sont terminées. */
function knownWeek(day: PresenceDay): WeekView {
  return {
    days: weekDates(MONDAY).map((jour) =>
      jour === day.jour ? day : { jour, arrivee: "08:00", depart: "17:00" },
    ),
    unreachable: false,
  };
}

/** Une semaine jamais lue, en cours de chargement. */
const LOADING: WeekView = { days: null, unreachable: false };

/** Une semaine jamais lue, dont le chargement s'est terminé sans réseau. */
const UNREACHABLE: WeekView = { days: null, unreachable: true };

/** Les cas où le bouton n'a rien à pointer : le cas, la vue, la date du jour, l'action affichée. */
const NOTHING_TO_PUNCH = [
  ["une semaine jamais lue, en chargement", LOADING, WEDNESDAY, "arrival"],
  [
    "une semaine jamais lue et injoignable, un jour d'une autre semaine",
    UNREACHABLE,
    "2026-11-23",
    "arrival",
  ],
  [
    "une journée terminée",
    knownWeek(wednesday("08:30", "17:00")),
    WEDNESDAY,
    "done",
  ],
] as const;

/** Les jours non travaillés : le cas, la date. */
const NON_WORKING_DAYS = [
  ["un samedi", "2026-11-21"],
  ["un dimanche", "2026-11-22"],
  ["un férié", "2026-11-11"],
] as const;

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

  it.each(NON_WORKING_DAYS)(
    "propose l'arrivée %s, comme un jour ouvré",
    (_, jour) => {
      expect(punchAction(emptyDay(jour))).toBe("arrival");
    },
  );

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
      refusal: "departureMustFollowArrival",
    });
  });

  it("lève une RangeError sur une journée terminée, au bouton désactivé", () => {
    expect(() => punch(wednesday("08:30", "17:00"), "18:00")).toThrow(
      new RangeError("rien à pointer le 2026-11-18 : done"),
    );
  });
});

describe("punchButton", () => {
  it.each(NOTHING_TO_PUNCH)(
    "désactive le bouton sur %s",
    (_, view, date, action) => {
      expect(punchButton(view, MONDAY, date)).toEqual({
        action,
        enabled: false,
        muted: false,
      });
    },
  );

  it.each([
    [
      "l'arrivée d'une semaine jamais lue et injoignable",
      UNREACHABLE,
      "arrival",
    ],
    [
      "le départ d'une journée commencée",
      knownWeek(wednesday("08:30", null)),
      "departure",
    ],
  ] as const)("active %s", (_, view, action) => {
    expect(punchButton(view, MONDAY, WEDNESDAY)).toEqual({
      action,
      enabled: true,
      muted: false,
    });
  });

  it.each(NON_WORKING_DAYS)(
    "grise le bouton %s, sans le désactiver",
    (_, date) => {
      expect(punchButton(UNREACHABLE, mondayOf(date), date)).toEqual({
        action: "arrival",
        enabled: true,
        muted: true,
      });
    },
  );
});

describe("pressPunch", () => {
  it.each(NOTHING_TO_PUNCH)("ignore l'appui sur %s", (_, view, date) => {
    expect(pressPunch(view, MONDAY, date, "18:00")).toBeNull();
  });

  it("pointe l'arrivée d'une semaine jamais lue et injoignable sur une journée vide, avec le retour haptique", () => {
    expect(pressPunch(UNREACHABLE, MONDAY, WEDNESDAY, "08:30")).toEqual({
      before: wednesday(null, null),
      action: "arrival",
      outcome: { day: wednesday("08:30", null) },
      haptic: true,
    });
  });

  it("pointe l'arrivée d'un samedi, avec le retour haptique", () => {
    const saturday = emptyDay("2026-11-21");

    expect(
      pressPunch(knownWeek(saturday), MONDAY, saturday.jour, "09:00"),
    ).toEqual({
      before: saturday,
      action: "arrival",
      outcome: { day: { ...saturday, arrivee: "09:00" } },
      haptic: true,
    });
  });

  it("pointe le départ avec le retour haptique, et rend la journée d'avant pour l'annuler", () => {
    expect(
      pressPunch(
        knownWeek(wednesday("08:30", null)),
        MONDAY,
        WEDNESDAY,
        "17:00",
      ),
    ).toEqual({
      before: wednesday("08:30", null),
      action: "departure",
      outcome: { day: wednesday("08:30", "17:00") },
      haptic: true,
    });
  });

  it("refuse un départ dans la même minute que l'arrivée, sans retour haptique", () => {
    expect(
      pressPunch(
        knownWeek(wednesday("08:30", null)),
        MONDAY,
        WEDNESDAY,
        "08:30",
      ),
    ).toEqual({
      before: wednesday("08:30", null),
      action: "departure",
      outcome: { refusal: "departureMustFollowArrival" },
      haptic: false,
    });
  });
});

describe("editTime", () => {
  it.each([
    [
      "un départ corrigé avant l'arrivée",
      () => editTime(wednesday("08:30", "17:00"), "depart", "08:00"),
      "departureMustFollowArrival",
    ],
    [
      "une arrivée corrigée après le départ",
      () => editTime(wednesday("08:30", "17:00"), "arrivee", "18:00"),
      "departureMustFollowArrival",
    ],
    [
      "l'effacement de l'arrivée d'une journée qui a un départ",
      () => editTime(wednesday("08:30", "17:00"), "arrivee", null),
      "clearDepartureFirst",
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
