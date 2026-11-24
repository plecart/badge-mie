import { describe, expect, it } from "vitest";
import {
  addWeeks,
  dayDuration,
  dayMinutes,
  dayLabel,
  departureFollowsArrival,
  emptyDay,
  formatDuration,
  holidays,
  isIsoDate,
  isMonday,
  isNonWorkingDay,
  isoWeek,
  isTime,
  isTimeOrNull,
  mondayOf,
  type PresenceDay,
  weekDates,
  weekDays,
  weekRangeLabel,
  weekTotal,
  WORKDAY_MINUTES,
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

describe("isTime", () => {
  it.each(["00:00", "08:05", "23:59"])("accepte l'heure %s", (value) => {
    expect(isTime(value)).toBe(true);
  });

  it.each(["08:00:00", "8:00", "24:00", "07:60", "08h00", ""])(
    "refuse « %s », qui n'est pas une heure HH:MM",
    (value) => {
      expect(isTime(value)).toBe(false);
    },
  );
});

describe("isTimeOrNull", () => {
  it.each([null, "08:30"])("accepte %j, une heure admise", (value) => {
    expect(isTimeOrNull(value)).toBe(true);
  });

  // Chaque cas dans son tableau : `it.each` étale un tableau nu en arguments.
  it.each([[830], [["08:30"]], ["8:30"], [undefined]])(
    "refuse %j, qui n'est ni une heure HH:MM ni null",
    (value) => {
      expect(isTimeOrNull(value)).toBe(false);
    },
  );
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

describe("holidays", () => {
  it.each([
    [
      2026,
      [
        "2026-01-01",
        "2026-04-06",
        "2026-05-01",
        "2026-05-08",
        "2026-05-14",
        "2026-05-25",
        "2026-07-14",
        "2026-08-15",
        "2026-11-01",
        "2026-11-11",
        "2026-12-25",
      ],
    ],
    [
      2027,
      [
        "2027-01-01",
        "2027-03-29",
        "2027-05-01",
        "2027-05-06",
        "2027-05-08",
        "2027-05-17",
        "2027-07-14",
        "2027-08-15",
        "2027-11-01",
        "2027-11-11",
        "2027-12-25",
      ],
    ],
  ])(
    "rend les onze fériés nationaux de %i, dans l'ordre du calendrier",
    (year, dates) => {
      expect(holidays(year)).toEqual(dates);
    },
  );

  it.each([
    [
      2008,
      "le 1er mai",
      [
        "2008-01-01",
        "2008-03-24",
        "2008-05-01",
        "2008-05-08",
        "2008-05-12",
        "2008-07-14",
        "2008-08-15",
        "2008-11-01",
        "2008-11-11",
        "2008-12-25",
      ],
    ],
    [
      2059,
      "le 8 mai",
      [
        "2059-01-01",
        "2059-03-31",
        "2059-05-01",
        "2059-05-08",
        "2059-05-19",
        "2059-07-14",
        "2059-08-15",
        "2059-11-01",
        "2059-11-11",
        "2059-12-25",
      ],
    ],
  ])(
    "rend dix dates distinctes en %i, l'Ascension tombée %s",
    (year, _, dates) => {
      expect(holidays(year)).toEqual(dates);
    },
  );

  it.each([
    [2285, "2285-03-23", "Pâques au plus tôt, le 22 mars"],
    [2038, "2038-04-26", "Pâques au plus tard, le 25 avril"],
    [2049, "2049-04-19", "la correction de l'algorithme pour le 18 avril"],
  ])("place le lundi de Pâques %i le %s, %s", (year, date) => {
    expect(holidays(year)).toContain(date);
  });
});

describe("isNonWorkingDay", () => {
  it.each([
    ["2026-11-21", "un samedi"],
    ["2026-11-22", "un dimanche"],
    ["2026-11-11", "un férié en semaine"],
    ["2026-11-01", "un férié un dimanche"],
    ["2027-01-01", "un férié d'une autre année"],
  ])("compte le %s, %s, en jour non travaillé", (value) => {
    expect(isNonWorkingDay(value)).toBe(true);
  });

  it.each([
    ["2026-11-18", "un mercredi ordinaire"],
    ["2026-04-03", "le Vendredi saint, férié en Alsace-Moselle seulement"],
    ["2026-02-30", "une date impossible"],
    ["21-11-2026", "un samedi hors format AAAA-MM-JJ"],
  ])("ne compte pas « %s », %s, en jour non travaillé", (value) => {
    expect(isNonWorkingDay(value)).toBe(false);
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
  it("rend les sept dates du lundi au dimanche, d'une année sur l'autre", () => {
    expect(weekDates("2026-12-28")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
});

describe("addWeeks", () => {
  it.each([
    ["2026-11-16", -1, "2026-11-09"],
    ["2026-11-09", 1, "2026-11-16"],
    ["2027-01-04", -1, "2026-12-28"],
    ["2026-11-30", 5, "2027-01-04"],
  ])(
    "rend le lundi de %s décalé de %i semaine(s) : %s",
    (monday, weeks, shifted) => {
      expect(addWeeks(monday, weeks)).toBe(shifted);
    },
  );
});

describe("weekRangeLabel", () => {
  it.each([
    ["2026-11-16", "16 – 22 novembre"],
    ["2026-01-05", "5 – 11 janvier"],
  ])("écrit la semaine du %s dans un seul mois : « %s »", (monday, label) => {
    expect(weekRangeLabel(monday)).toBe(label);
  });

  it.each([
    ["2026-11-30", "30 nov. – 6 déc."],
    ["2026-12-28", "28 déc. – 3 janv."],
    ["2026-10-26", "26 oct. – 1 nov."],
  ])(
    "abrège les deux mois de la semaine du %s, à cheval : « %s »",
    (monday, label) => {
      expect(weekRangeLabel(monday)).toBe(label);
    },
  );
});

describe("dayLabel", () => {
  it("écrit un jour ouvré en toutes lettres, sans l'année", () => {
    expect(dayLabel("2026-11-18")).toBe("mercredi 18 novembre");
  });

  it.each([
    ["2026-11-21", "samedi 21 novembre"],
    ["2026-11-22", "dimanche 22 novembre"],
  ])("écrit aussi un jour du week-end, le %s : « %s »", (date, label) => {
    expect(dayLabel(date)).toBe(label);
  });

  it("écrit le 1er du mois sans zéro", () => {
    expect(dayLabel("2025-12-01")).toBe("lundi 1 décembre");
  });
});

describe("weekDays", () => {
  it("marque aujourd'hui et les jours à venir de la semaine en cours", () => {
    expect(weekDays("2026-11-16", "2026-11-18")).toMatchObject([
      { date: "2026-11-16", isToday: false, isFuture: false },
      { date: "2026-11-17", isToday: false, isFuture: false },
      { date: "2026-11-18", isToday: true, isFuture: false },
      { date: "2026-11-19", isToday: false, isFuture: true },
      { date: "2026-11-20", isToday: false, isFuture: true },
      { date: "2026-11-21", isToday: false, isFuture: true },
      { date: "2026-11-22", isToday: false, isFuture: true },
    ]);
  });

  it("marque les jours non travaillés d'une semaine avec un férié, le mercredi 11 novembre", () => {
    const nonWorking = weekDays("2026-11-09", "2026-11-24")
      .filter((day) => day.isNonWorking)
      .map((day) => day.date);
    expect(nonWorking).toEqual(["2026-11-11", "2026-11-14", "2026-11-15"]);
  });

  it.each([
    ["un samedi", "2026-11-21"],
    ["un dimanche", "2026-11-22"],
  ])("marque aujourd'hui %s, le %s", (_, today) => {
    const marked = weekDays("2026-11-16", today).filter((day) => day.isToday);
    expect(marked.map((day) => day.date)).toEqual([today]);
  });

  it("ne marque aucun jour d'une semaine passée", () => {
    const marked = weekDays("2026-11-09", "2026-11-18").filter(
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
    ["addWeeks", () => addWeeks("2026-02-30", 1)],
    ["dayLabel", () => dayLabel("2026-02-30")],
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
    ["addWeeks", () => addWeeks("2026-11-18", 1)],
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

describe("departureFollowsArrival", () => {
  it("admet un départ après l'arrivée", () => {
    expect(departureFollowsArrival("08:30", "17:00")).toBe(true);
  });

  it.each([
    ["égal à l'arrivée", "09:00", "09:00"],
    ["avant l'arrivée", "10:00", "09:00"],
  ])("refuse un départ %s", (_, arrival, departure) => {
    expect(departureFollowsArrival(arrival, departure)).toBe(false);
  });

  it.each([
    ["arrivée seule", "08:30", null],
    ["départ seul", null, "17:00"],
    ["aucune heure", null, null],
  ])("admet un jour incomplet : %s", (_, arrival, departure) => {
    expect(departureFollowsArrival(arrival, departure)).toBe(true);
  });
});

describe("WORKDAY_MINUTES", () => {
  it("vaut une journée de 8 h 30", () => {
    expect(formatDuration(WORKDAY_MINUTES)).toBe("8 h 30");
  });
});

/**
 * Le total de la semaine du lundi `monday`, chaque jour compté par `dayMinutes` : les journées de
 * `days`, et des journées vides pour les autres jours.
 */
function totalOfWeek(monday: string, days: PresenceDay[] = []): number {
  const byDate = new Map(days.map((day) => [day.jour, day]));
  return weekTotal(
    weekDates(monday).map((jour) =>
      dayMinutes(byDate.get(jour) ?? emptyDay(jour)),
    ),
  );
}

describe("dayMinutes", () => {
  it.each([
    [
      "à un férié en semaine pointé à l'arrivée seule",
      { jour: "2026-11-11", arrivee: "09:00", depart: null },
    ],
    [
      "à un férié en semaine pointé au départ seul",
      { jour: "2026-11-11", arrivee: null, depart: "17:00" },
    ],
    ["à un férié un dimanche sans pointage", emptyDay("2026-11-01")],
    ["à un jour ouvré sans pointage", emptyDay("2026-11-10")],
    ["à un samedi sans pointage", emptyDay("2026-11-14")],
  ])("ne compte rien %s", (_, day) => {
    expect(dayMinutes(day)).toBeNull();
  });

  it("compte les heures pointées d'un samedi", () => {
    expect(
      dayMinutes({ jour: "2026-11-14", arrivee: "09:00", depart: "11:30" }),
    ).toBe(150);
  });

  it.each([
    ["2026-11-09", "sans pointage", [], WORKDAY_MINUTES],
    [
      "2026-11-09",
      "au férié pointé de 09:00 à 12:00",
      [{ jour: "2026-11-11", arrivee: "09:00", depart: "12:00" }],
      180,
    ],
    [
      "2026-11-09",
      "au férié pointé à l'arrivée seule",
      [{ jour: "2026-11-11", arrivee: "09:00", depart: null }],
      0,
    ],
    ["2026-10-26", "sans pointage, au férié un dimanche", [], 0],
  ])("totalise la semaine du %s %s : %i minutes", (monday, _, days, total) => {
    expect(totalOfWeek(monday, days)).toBe(total);
  });

  it.each([
    [
      "une date invalide",
      { jour: "2026-02-30", arrivee: null, depart: null },
      "date invalide : « 2026-02-30 », attendu AAAA-MM-JJ",
    ],
    [
      "une heure invalide",
      { jour: "2026-11-10", arrivee: "8:00", depart: "17:00" },
      "heure invalide : « 8:00 », attendu HH:MM",
    ],
  ])("lève une RangeError qui nomme %s", (_, day, message) => {
    expect(() => dayMinutes(day)).toThrow(new RangeError(message));
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

  it.each([
    ["l'arrivée", "8:30", "17:00", "8:30"],
    ["le départ", "08:30", "24:00", "24:00"],
  ])(
    "departureFollowsArrival lève une RangeError qui nomme %s",
    (_, arrival, departure, invalid) => {
      expect(() => departureFollowsArrival(arrival, departure)).toThrow(
        new RangeError(`heure invalide : « ${invalid} », attendu HH:MM`),
      );
    },
  );
});
