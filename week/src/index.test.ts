import { describe, expect, it } from "vitest";
import {
  dayDuration,
  formatDuration,
  isIsoDate,
  isMonday,
  isoWeek,
  mondayOf,
  weekDates,
  weekDays,
  weekRangeLabel,
  weekTotal,
} from "@badge-mie/week";

// Garde du fuseau épinglé par `vitest.config.ts` : sans lui, une méthode de date locale prise
// pour sa jumelle UTC passerait inaperçue dans ce module.
describe("fuseau de la suite", () => {
  it.each([
    ["en hiver", "2026-01-15T00:00:00Z"],
    ["en été", "2026-07-15T00:00:00Z"],
  ])("place minuit UTC la veille, %s", (_, instant) => {
    expect(new Date(instant).getDate()).toBe(14);
  });
});

describe("isIsoDate", () => {
  it.each(["2026-11-16", "2024-02-29", "0099-12-31"])(
    "accepte la date réelle %s",
    (value) => {
      expect(isIsoDate(value)).toBe(true);
    },
  );

  it.each([
    "2026-02-30",
    "2026-13-01",
    "16-11-2026",
    "2026-1-5",
    "2025-02-29",
    "",
  ])("refuse « %s », qui n'est pas une date réelle AAAA-MM-JJ", (value) => {
    expect(isIsoDate(value)).toBe(false);
  });
});

describe("mondayOf", () => {
  it.each([
    ["2026-11-22", "2026-11-16"],
    ["2026-11-16", "2026-11-16"],
    ["2026-12-01", "2026-11-30"],
    ["2027-01-01", "2026-12-28"],
    ["2026-01-01", "2025-12-29"],
  ])("rend le lundi de la semaine du %s : %s", (date, monday) => {
    expect(mondayOf(date)).toBe(monday);
  });
});

describe("isMonday", () => {
  it.each([
    ["2026-11-16", true],
    ["2026-11-17", false],
    ["2026-11-22", false],
    ["2026-02-30", false],
    ["16-11-2026", false],
  ])("dit si %s est un lundi AAAA-MM-JJ réel : %s", (value, expected) => {
    expect(isMonday(value)).toBe(expected);
  });
});

describe("isoWeek", () => {
  it.each([
    ["2026-01-01", 1],
    ["2026-12-31", 53],
    ["2026-11-18", 47],
    ["2027-01-01", 53],
    ["2025-12-31", 1],
  ])("rend le numéro de semaine ISO 8601 du %s : %i", (date, week) => {
    expect(isoWeek(date)).toBe(week);
  });
});

describe("weekDates", () => {
  it("rend les cinq dates du lundi au vendredi, d'une année sur l'autre", () => {
    expect(weekDates("2026-12-28")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
    ]);
  });
});

describe("weekRangeLabel", () => {
  it.each([
    ["2026-11-16", "16 – 20 novembre"],
    ["2026-01-05", "5 – 9 janvier"],
  ])("écrit la semaine du %s dans un seul mois : « %s »", (monday, label) => {
    expect(weekRangeLabel(monday)).toBe(label);
  });

  it.each([
    ["2026-11-30", "30 nov. – 4 déc."],
    ["2026-12-28", "28 déc. – 1 janv."],
  ])(
    "abrège les deux mois de la semaine du %s, à cheval : « %s »",
    (monday, label) => {
      expect(weekRangeLabel(monday)).toBe(label);
    },
  );
});

describe("weekDays", () => {
  it("marque aujourd'hui et les jours à venir de la semaine en cours", () => {
    expect(weekDays("2026-11-16", "2026-11-18")).toEqual([
      { date: "2026-11-16", isToday: false, isFuture: false },
      { date: "2026-11-17", isToday: false, isFuture: false },
      { date: "2026-11-18", isToday: true, isFuture: false },
      { date: "2026-11-19", isToday: false, isFuture: true },
      { date: "2026-11-20", isToday: false, isFuture: true },
    ]);
  });

  it.each([
    ["d'une semaine passée", "2026-11-09", "2026-11-18"],
    ["de la semaine en cours le samedi", "2026-11-16", "2026-11-21"],
    ["de la semaine en cours le dimanche", "2026-11-16", "2026-11-22"],
  ])("ne marque aucun jour %s", (_, monday, today) => {
    const marked = weekDays(monday, today).filter(
      (day) => day.isToday || day.isFuture,
    );
    expect(marked).toEqual([]);
  });
});

describe("dates invalides", () => {
  it.each([
    ["mondayOf", () => mondayOf("2026-02-30")],
    ["isoWeek", () => isoWeek("2026-02-30")],
    ["weekDates", () => weekDates("2026-02-30")],
    ["weekDays (lundi)", () => weekDays("2026-02-30", "2026-11-18")],
    ["weekDays (aujourd'hui)", () => weekDays("2026-11-16", "2026-02-30")],
    ["weekRangeLabel", () => weekRangeLabel("2026-02-30")],
  ])("%s lève une RangeError qui nomme la date", (_, call) => {
    expect(call).toThrow(
      new RangeError("date invalide : « 2026-02-30 », attendu AAAA-MM-JJ"),
    );
  });
});

describe("lundis invalides", () => {
  it.each([
    ["weekDates", () => weekDates("2026-11-18")],
    ["weekDays", () => weekDays("2026-11-18", "2026-11-18")],
    ["weekRangeLabel", () => weekRangeLabel("2026-11-18")],
  ])("%s lève une RangeError sur un mercredi", (_, call) => {
    expect(call).toThrow(
      new RangeError("lundi invalide : « 2026-11-18 », attendu un lundi"),
    );
  });
});

describe("dayDuration", () => {
  it("rend la présence d'un jour complet en minutes", () => {
    expect(dayDuration("08:12", "15:54")).toBe(462);
  });

  it.each([
    ["arrivée seule", "08:12", null],
    ["départ seul", null, "15:54"],
    ["aucune heure", null, null],
  ])("rend null pour un jour incomplet : %s", (_, arrival, departure) => {
    expect(dayDuration(arrival, departure)).toBeNull();
  });
});

describe("weekTotal", () => {
  it("additionne les durées des jours complets et ignore les autres", () => {
    const durations = [
      dayDuration("08:00", "15:05"),
      dayDuration("08:12", "15:54"),
      dayDuration("09:00", "17:30"),
      dayDuration("08:00", null),
    ];
    expect(weekTotal(durations)).toBe(1397);
  });

  it("rend 0 pour une semaine sans jour complet", () => {
    expect(weekTotal([null, null])).toBe(0);
  });
});

describe("formatDuration", () => {
  it.each([
    [425, "7 h 05"],
    [462, "7 h 42"],
    [1397, "23 h 17"],
    [2400, "40 h 00"],
  ])("écrit %i minutes « %s »", (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text);
  });
});

describe("heures invalides", () => {
  it.each(["8:12", "24:00", "07:60", "08:12:00", ""])(
    "dayDuration lève une RangeError qui nomme l'arrivée « %s »",
    (arrival) => {
      expect(() => dayDuration(arrival, "15:54")).toThrow(
        new RangeError(`heure invalide : « ${arrival} », attendu HH:MM`),
      );
    },
  );

  it("dayDuration lève une RangeError qui nomme le départ", () => {
    expect(() => dayDuration("08:12", "24:00")).toThrow(
      new RangeError("heure invalide : « 24:00 », attendu HH:MM"),
    );
  });
});
