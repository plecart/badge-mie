import type { PresenceDay } from "@badge-mie/week";
import { describe, expect, it } from "vitest";
import {
  parseWeekResponse,
  ServerUnreachableError,
  TokenRejectedError,
  weekRequest,
} from "./api";
import { API_URL } from "./api-url";

const MONDAY = "2026-11-16";

const WEEK: PresenceDay[] = [
  { jour: "2026-11-16", arrivee: "08:30", depart: "17:12" },
  { jour: "2026-11-17", arrivee: "08:45", depart: null },
  { jour: "2026-11-18", arrivee: null, depart: null },
  { jour: "2026-11-19", arrivee: null, depart: null },
  { jour: "2026-11-20", arrivee: null, depart: null },
];

/** La semaine de référence, dont la première journée est remplacée par `day`. */
function withFirstDay(day: unknown): unknown[] {
  return [day, ...WEEK.slice(1)];
}

/** Des heures qui ne sont pas `HH:MM` : avec secondes, sur un chiffre, hors bornes. */
const MALFORMED_TIMES = ["08:00:00", "8:00", "24:00"];

describe("weekRequest", () => {
  it("vise la route de la semaine du lundi", () => {
    expect(weekRequest("jeton-de-test", "2026-11-16").url).toBe(
      `${API_URL}/semaines/2026-11-16`,
    );
  });

  it("porte le jeton en en-tête Authorization Bearer", () => {
    const { init } = weekRequest("jeton-de-test", "2026-11-16");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer jeton-de-test",
    );
  });
});

describe("parseWeekResponse", () => {
  it("rend les cinq journées d'une réponse 200", () => {
    expect(parseWeekResponse(200, WEEK, MONDAY)).toEqual(WEEK);
  });

  it.each([
    ["illisible", undefined],
    ["de cinq journées", WEEK],
  ])(
    "lève TokenRejectedError quand le serveur refuse le jeton (401), corps %s",
    (_, body) => {
      expect(() => parseWeekResponse(401, body, MONDAY)).toThrow(
        TokenRejectedError,
      );
    },
  );

  it.each([500, 503, 404, 300, 199])(
    "lève ServerUnreachableError sur un statut %i, même avec cinq journées",
    (status) => {
      expect(() => parseWeekResponse(status, WEEK, MONDAY)).toThrow(
        ServerUnreachableError,
      );
    },
  );

  it("accepte tout statut 2xx", () => {
    expect(parseWeekResponse(299, WEEK, MONDAY)).toEqual(WEEK);
  });

  it("lève une RangeError sur un 2xx quand le lundi demandé n'en est pas un", () => {
    expect(() => parseWeekResponse(200, WEEK, "2026-11-18")).toThrow(
      new RangeError("lundi invalide : « 2026-11-18 », attendu un lundi"),
    );
  });

  it.each([
    ["un corps illisible", undefined],
    ["un objet", { jours: WEEK }],
    ["null", null],
    ["un texte", "[]"],
    ["quatre journées", WEEK.slice(0, 4)],
    ["six journées", [...WEEK, WEEK[0]]],
    ["une journée nulle", withFirstDay(null)],
    ["une journée en texte", withFirstDay("2026-11-16")],
    ["une journée sans jour", withFirstDay({ arrivee: null, depart: null })],
    [
      "une journée sans arrivée",
      withFirstDay({ jour: "2026-11-16", depart: null }),
    ],
    [
      "une journée sans départ",
      withFirstDay({ jour: "2026-11-16", arrivee: null }),
    ],
    [
      "un jour qui n'est pas un texte",
      withFirstDay({ jour: 20261116, arrivee: null, depart: null }),
    ],
    [
      "un jour qui n'est pas une date réelle",
      withFirstDay({ jour: "2026-11-31", arrivee: null, depart: null }),
    ],
    [
      "un jour d'une autre semaine",
      withFirstDay({ jour: "2026-11-23", arrivee: null, depart: null }),
    ],
    [
      "une arrivée qui n'est ni un texte ni null",
      withFirstDay({ jour: "2026-11-16", arrivee: ["08:30"], depart: null }),
    ],
    [
      "un départ qui n'est ni un texte ni null",
      withFirstDay({ jour: "2026-11-16", arrivee: null, depart: false }),
    ],
    ...MALFORMED_TIMES.flatMap((time): [string, unknown][] => [
      [
        `une arrivée « ${time} »`,
        withFirstDay({ jour: "2026-11-16", arrivee: time, depart: null }),
      ],
      [
        `un départ « ${time} »`,
        withFirstDay({ jour: "2026-11-16", arrivee: null, depart: time }),
      ],
    ]),
  ])("lève ServerUnreachableError sur un 200 qui porte %s", (_, body) => {
    expect(() => parseWeekResponse(200, body, MONDAY)).toThrow(
      ServerUnreachableError,
    );
  });
});
