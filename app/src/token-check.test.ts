import { type PresenceDay, weekDates } from "@badge-mie/week";
import { describe, expect, it } from "vitest";
import { ServerUnreachableError, TokenRejectedError } from "./api";
import { checkToken } from "./token-check";

const MONDAY = "2026-11-16";
const GOOD_TOKEN = "bon-jeton";
const WEEK: PresenceDay[] = weekDates(MONDAY).map((jour) => ({
  jour,
  arrivee: null,
  depart: null,
}));

/** Un serveur qui rend la semaine du lundi `MONDAY` au seul jeton `GOOD_TOKEN`. */
async function server(token: string, monday: string): Promise<PresenceDay[]> {
  if (token !== GOOD_TOKEN) throw new TokenRejectedError();
  if (monday !== MONDAY) throw new Error(`semaine inattendue : ${monday}`);
  return WEEK;
}

/** Des enregistrements factices, qui gardent ce qu'on leur confie. */
function recorder() {
  const saved = {
    tokens: [] as string[],
    weeks: new Map<string, PresenceDay[]>(),
  };
  return {
    saved,
    saveToken: async (token: string) => {
      saved.tokens.push(token);
    },
    saveWeek: async (monday: string, days: PresenceDay[]) => {
      saved.weeks.set(monday, days);
    },
  };
}

describe("checkToken", () => {
  it("accepte un jeton que le serveur reconnaît, et enregistre le jeton et la semaine lue", async () => {
    const { saved, ...saves } = recorder();

    const outcome = await checkToken(GOOD_TOKEN, MONDAY, {
      read: server,
      ...saves,
    });

    expect({ outcome, saved }).toEqual({
      outcome: "accepted",
      saved: { tokens: [GOOD_TOKEN], weeks: new Map([[MONDAY, WEEK]]) },
    });
  });

  it("refuse un jeton que le serveur rejette, sans rien enregistrer", async () => {
    const { saved, ...saves } = recorder();

    const outcome = await checkToken("mauvais-jeton", MONDAY, {
      read: server,
      ...saves,
    });

    expect({ outcome, saved }).toEqual({
      outcome: "rejected",
      saved: { tokens: [], weeks: new Map() },
    });
  });

  it("signale un serveur injoignable, sans rien enregistrer", async () => {
    const { saved, ...saves } = recorder();

    const outcome = await checkToken(GOOD_TOKEN, MONDAY, {
      read: async () => {
        throw new ServerUnreachableError();
      },
      ...saves,
    });

    expect({ outcome, saved }).toEqual({
      outcome: "unreachable",
      saved: { tokens: [], weeks: new Map() },
    });
  });

  it("laisse remonter toute autre erreur, sans rien enregistrer", async () => {
    const { saved, ...saves } = recorder();
    const failure = new TypeError("panne inattendue");

    await expect(
      checkToken(GOOD_TOKEN, MONDAY, {
        read: async () => {
          throw failure;
        },
        ...saves,
      }),
    ).rejects.toBe(failure);
    expect(saved).toEqual({ tokens: [], weeks: new Map() });
  });
});
