import { emptyDay, type PresenceDay, weekDates } from "@badge-mie/week";
import { describe, expect, it } from "vitest";
import { ServerUnreachableError, TokenRejectedError } from "./api";
import { memoryStorage, storageHolding } from "./memory-storage";
import { pressPunch } from "./punch";
import {
  type KeyValueStorage,
  loadWeek,
  saveDay,
  saveWeek,
  type WeekView,
} from "./week-store";

const MONDAY = "2026-11-16";

/** Une semaine dont chaque journée porte l'arrivée `arrivee`, pour distinguer deux versions. */
function weekArrivingAt(monday: string, arrivee: string): PresenceDay[] {
  return weekDates(monday).map((jour) => ({ jour, arrivee, depart: null }));
}

const LOCAL = weekArrivingAt(MONDAY, "08:00");
const SERVER = weekArrivingAt(MONDAY, "09:00");
/** Une journée pointée de la semaine de `MONDAY`, le mercredi, distincte de `LOCAL` et `SERVER`. */
const POINTED: PresenceDay = {
  jour: "2026-11-18",
  arrivee: "07:45",
  depart: "16:30",
};

/** Le mardi de la semaine de `MONDAY`, en attente d'envoi : l'arrivée pointée, pas le départ. */
const PENDING_TUESDAY: PresenceDay = {
  jour: "2026-11-17",
  arrivee: "08:30",
  depart: null,
};

/** La semaine de `MONDAY` reconstruite depuis `PENDING_TUESDAY` : ses journées vides, sous lui. */
const REBUILT_WEEK: PresenceDay[] = [
  { jour: "2026-11-16", arrivee: null, depart: null },
  PENDING_TUESDAY,
  { jour: "2026-11-18", arrivee: null, depart: null },
  { jour: "2026-11-19", arrivee: null, depart: null },
  { jour: "2026-11-20", arrivee: null, depart: null },
  { jour: "2026-11-21", arrivee: null, depart: null },
  { jour: "2026-11-22", arrivee: null, depart: null },
];

/**
 * La semaine de `MONDAY` rangée par la version d'avant la PR #41 : ses cinq journées, du lundi
 * au vendredi.
 */
const FIVE_DAY_LOCAL = LOCAL.slice(0, 5);

/** `FIVE_DAY_LOCAL` telle qu'elle se lit : complétée du samedi et du dimanche vides. */
const FIVE_DAY_LOCAL_READ: PresenceDay[] = [
  ...FIVE_DAY_LOCAL,
  emptyDay("2026-11-21"),
  emptyDay("2026-11-22"),
];

/** Le samedi de la semaine de `MONDAY`, pointé à l'arrivée. */
const SATURDAY: PresenceDay = {
  jour: "2026-11-21",
  arrivee: "09:00",
  depart: null,
};

/** Un stockage dont la lecture lève : l'état local ne se lit pas. */
const UNREADABLE: KeyValueStorage = {
  getItem: async () => {
    throw new Error("stockage indisponible");
  },
  setItem: async () => {},
};

/** Les états locaux tenus pour absents : manquant, pas du JSON, pas de la forme d'une semaine. */
const ABSENT_LOCAL: [string, KeyValueStorage][] = [
  ["manquant", storageHolding(null)],
  ["qui n'est pas du JSON", storageHolding("[{ pas du JSON")],
  [
    "qui n'a pas la forme d'une semaine",
    storageHolding(JSON.stringify(weekArrivingAt(MONDAY, "08:00:00"))),
  ],
  [
    "de cinq journées qui ne vont pas du lundi au vendredi",
    storageHolding(JSON.stringify(LOCAL.slice(1, 6))),
  ],
];

/** Une lecture sans réseau. */
async function offline(): Promise<PresenceDay[]> {
  throw new ServerUnreachableError();
}

/** Les journées `days`, celle du jour de `replacement` remplacée par lui. */
function withDay(days: PresenceDay[], replacement: PresenceDay): PresenceDay[] {
  return days.map((day) => (day.jour === replacement.jour ? replacement : day));
}

/** Les journées `days`, le mercredi remplacé par `POINTED`. */
function withPointed(days: PresenceDay[]): PresenceDay[] {
  return withDay(days, POINTED);
}

type Dependencies = Parameters<typeof loadWeek>[1];

/**
 * Charge une semaine et rend les vues affichées, dans l'ordre ; sans `pending`, aucun jour
 * n'attend d'envoi.
 */
async function viewsOf(
  monday: string,
  dependencies: Omit<Dependencies, "pending"> &
    Partial<Pick<Dependencies, "pending">>,
): Promise<WeekView[]> {
  const views: WeekView[] = [];
  await loadWeek(monday, { pending: async () => [], ...dependencies }, (view) =>
    views.push(view),
  );
  return views;
}

describe("loadWeek", () => {
  it("affiche d'abord la semaine déjà lue depuis l'état local, puis la réponse du serveur", async () => {
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, LOCAL);

    const views = await viewsOf(MONDAY, { storage, read: async () => SERVER });

    expect(views).toEqual([
      { days: LOCAL, unreachable: false },
      { days: SERVER, unreachable: false },
    ]);
  });

  it("garde la réponse du serveur dans l'état local, pour la lecture suivante", async () => {
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, LOCAL);
    await viewsOf(MONDAY, { storage, read: async () => SERVER });

    const views = await viewsOf(MONDAY, { storage, read: offline });

    expect(views[0]).toEqual({ days: SERVER, unreachable: false });
  });

  it("garde affichée la semaine déjà lue quand le serveur est injoignable", async () => {
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, LOCAL);

    const views = await viewsOf(MONDAY, { storage, read: offline });

    expect(views).toEqual([
      { days: LOCAL, unreachable: false },
      { days: LOCAL, unreachable: false },
    ]);
  });

  it("signale le serveur injoignable pour une semaine jamais lue", async () => {
    const views = await viewsOf(MONDAY, {
      storage: memoryStorage(),
      read: offline,
    });

    expect(views).toEqual([
      { days: null, unreachable: false },
      { days: null, unreachable: true },
    ]);
  });

  it("laisse remonter un jeton refusé sans toucher l'état local", async () => {
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, LOCAL);
    const rejected = async (): Promise<PresenceDay[]> => {
      throw new TokenRejectedError();
    };

    await expect(viewsOf(MONDAY, { storage, read: rejected })).rejects.toThrow(
      TokenRejectedError,
    );

    expect(await viewsOf(MONDAY, { storage, read: offline })).toEqual([
      { days: LOCAL, unreachable: false },
      { days: LOCAL, unreachable: false },
    ]);
  });

  it("ne mélange pas deux semaines", async () => {
    const nextMonday = "2026-11-23";
    const nextWeek = weekArrivingAt(nextMonday, "07:30");
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, LOCAL);

    const nextViews = await viewsOf(nextMonday, {
      storage,
      read: async () => nextWeek,
    });
    const views = await viewsOf(MONDAY, { storage, read: offline });

    expect([nextViews[0], views[0]]).toEqual([
      { days: null, unreachable: false },
      { days: LOCAL, unreachable: false },
    ]);
  });

  it("garde affichée la réponse du serveur, et signale le serveur injoignable, quand l'état local ne peut pas la garder", async () => {
    const storage: KeyValueStorage = {
      getItem: async () => null,
      setItem: async () => {
        throw new Error("stockage plein");
      },
    };

    const views = await viewsOf(MONDAY, { storage, read: async () => SERVER });

    expect(views).toEqual([
      { days: null, unreachable: false },
      { days: SERVER, unreachable: false },
      { days: SERVER, unreachable: true },
    ]);
  });

  it("signale le serveur injoignable quand l'état local ne se lit pas", async () => {
    const views = await viewsOf(MONDAY, {
      storage: UNREADABLE,
      read: async () => SERVER,
    });

    expect(views).toEqual([{ days: null, unreachable: true }]);
  });

  it("garde affichée la semaine déjà lue, et signale le serveur injoignable, sur toute autre panne de la lecture", async () => {
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, LOCAL);

    const views = await viewsOf(MONDAY, {
      storage,
      read: async () => {
        throw new TypeError("panne inattendue");
      },
    });

    expect(views).toEqual([
      { days: LOCAL, unreachable: false },
      { days: LOCAL, unreachable: true },
    ]);
  });

  it("affiche en sept journées, ses heures gardées, une semaine rangée à cinq journées par la version d'avant la PR #41", async () => {
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, FIVE_DAY_LOCAL);

    const views = await viewsOf(MONDAY, { storage, read: offline });

    expect(views).toEqual([
      { days: FIVE_DAY_LOCAL_READ, unreachable: false },
      { days: FIVE_DAY_LOCAL_READ, unreachable: false },
    ]);
  });

  it("tient un état local illisible pour absent", async () => {
    const views = await viewsOf(MONDAY, {
      storage: storageHolding("[{ pas du JSON"),
      read: offline,
    });

    expect(views).toEqual([
      { days: null, unreachable: false },
      { days: null, unreachable: true },
    ]);
  });

  it("tient un état local de forme inattendue pour absent", async () => {
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, weekArrivingAt(MONDAY, "08:00:00"));

    const views = await viewsOf(MONDAY, { storage, read: offline });

    expect(views).toEqual([
      { days: null, unreachable: false },
      { days: null, unreachable: true },
    ]);
  });
});

describe("saveDay", () => {
  it("crée la semaine absente de l'état local, aux heures nulles hors du jour rangé", async () => {
    const storage = memoryStorage();

    await saveDay(storage, POINTED);

    const views = await viewsOf(MONDAY, { storage, read: offline });
    const empty = weekDates(MONDAY).map((jour) => ({
      jour,
      arrivee: null,
      depart: null,
    }));
    expect(views[0]).toEqual({ days: withPointed(empty), unreachable: false });
  });

  it("range un samedi dans une semaine rangée à cinq journées par la version d'avant la PR #41, sans en perdre aucune", async () => {
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, FIVE_DAY_LOCAL);

    await saveDay(storage, SATURDAY);

    const views = await viewsOf(MONDAY, { storage, read: offline });
    expect(views[0]).toEqual({
      days: withDay(FIVE_DAY_LOCAL_READ, SATURDAY),
      unreachable: false,
    });
  });

  it("remplace le jour rangé dans une semaine déjà enregistrée, sans toucher les autres", async () => {
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, LOCAL);

    await saveDay(storage, POINTED);

    const views = await viewsOf(MONDAY, { storage, read: offline });
    expect(views[0]).toEqual({ days: withPointed(LOCAL), unreachable: false });
  });
});

describe("loadWeek, avec des jours en attente d'envoi", () => {
  it("montre un jour en attente à la place de la valeur du serveur", async () => {
    const views = await viewsOf(MONDAY, {
      storage: memoryStorage(),
      read: async () => SERVER,
      pending: async () => [POINTED],
    });

    expect(views[1]).toEqual({ days: withPointed(SERVER), unreachable: false });
  });

  it("montre un jour en attente à la place de l'état local", async () => {
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, LOCAL);

    const views = await viewsOf(MONDAY, {
      storage,
      read: offline,
      pending: async () => [POINTED],
    });

    expect(views[0]).toEqual({ days: withPointed(LOCAL), unreachable: false });
  });

  it("montre un jour en attente dans une semaine rangée à cinq journées par la version d'avant la PR #41, sans réseau", async () => {
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, FIVE_DAY_LOCAL);

    const views = await viewsOf(MONDAY, {
      storage,
      read: offline,
      pending: async () => [SATURDAY],
    });

    expect(views[0]).toEqual({
      days: withDay(FIVE_DAY_LOCAL_READ, SATURDAY),
      unreachable: false,
    });
  });

  it("ne change rien pour un jour en attente d'une autre semaine", async () => {
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, LOCAL);
    const nextWeekDay = { ...POINTED, jour: "2026-11-23" };

    const views = await viewsOf(MONDAY, {
      storage,
      read: async () => SERVER,
      pending: async () => [nextWeekDay],
    });

    expect(views).toEqual([
      { days: LOCAL, unreachable: false },
      { days: SERVER, unreachable: false },
    ]);
  });

  it("garde dans l'état local le jour en attente plutôt que la valeur du serveur, pour le relire hors ligne une fois envoyé", async () => {
    const storage = memoryStorage();
    await viewsOf(MONDAY, {
      storage,
      read: async () => SERVER,
      pending: async () => [POINTED],
    });

    const views = await viewsOf(MONDAY, { storage, read: offline });

    expect(views[0]).toEqual({ days: withPointed(SERVER), unreachable: false });
  });

  it("montre un jour envoyé pendant la lecture à la place d'une réponse du serveur qui le précède", async () => {
    let queue = [POINTED];

    const views = await viewsOf(MONDAY, {
      storage: memoryStorage(),
      read: async () => {
        queue = [];
        return SERVER;
      },
      pending: async () => queue,
    });

    expect(views[1]).toEqual({ days: withPointed(SERVER), unreachable: false });
  });

  it("montre un jour enregistré pendant la lecture à la place de la valeur du serveur", async () => {
    let queue: PresenceDay[] = [];

    const views = await viewsOf(MONDAY, {
      storage: memoryStorage(),
      read: async () => {
        queue = [POINTED];
        return SERVER;
      },
      pending: async () => queue,
    });

    expect(views[1]).toEqual({ days: withPointed(SERVER), unreachable: false });
  });

  it("montre un jour enregistré pendant une lecture sans réseau dans la semaine gardée affichée en repli", async () => {
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, LOCAL);
    let queue: PresenceDay[] = [];

    const views = await viewsOf(MONDAY, {
      storage,
      read: async () => {
        queue = [POINTED];
        throw new ServerUnreachableError();
      },
      pending: async () => queue,
    });

    expect(views[1]).toEqual({ days: withPointed(LOCAL), unreachable: false });
  });

  it.each(ABSENT_LOCAL)(
    "montre dès la première vue le jour en attente parmi des journées vides, l'état local %s, sans réseau",
    async (_, storage) => {
      const views = await viewsOf(MONDAY, {
        storage,
        read: offline,
        pending: async () => [PENDING_TUESDAY],
      });

      expect(views).toEqual([
        { days: REBUILT_WEEK, unreachable: false },
        { days: REBUILT_WEEK, unreachable: false },
      ]);
    },
  );

  it("montre le jour en attente parmi des journées vides, et signale le serveur injoignable, quand l'état local ne se lit pas", async () => {
    const views = await viewsOf(MONDAY, {
      storage: UNREADABLE,
      read: offline,
      pending: async () => [PENDING_TUESDAY],
    });

    expect(views).toEqual([{ days: REBUILT_WEEK, unreachable: true }]);
  });

  it("pointe le départ sur le jour en attente quand l'état local ne se lit pas, sans écraser son arrivée", async () => {
    const views = await viewsOf(MONDAY, {
      storage: UNREADABLE,
      read: offline,
      pending: async () => [PENDING_TUESDAY],
    });

    const press = pressPunch(views.at(-1)!, MONDAY, "2026-11-17", "17:05");

    expect(press?.outcome).toEqual({
      day: { jour: "2026-11-17", arrivee: "08:30", depart: "17:05" },
    });
  });

  it("n'enregistre pas la semaine reconstruite sans réseau", async () => {
    const storage = memoryStorage();
    await viewsOf(MONDAY, {
      storage,
      read: offline,
      pending: async () => [PENDING_TUESDAY],
    });

    const views = await viewsOf(MONDAY, { storage, read: offline });

    expect(views[0]).toEqual({ days: null, unreachable: false });
  });

  it("ne fabrique pas de semaine pour un jour entré dans la file pendant le chargement", async () => {
    let queue: PresenceDay[] = [];

    const views = await viewsOf(MONDAY, {
      storage: memoryStorage(),
      read: async () => {
        queue = [PENDING_TUESDAY];
        throw new ServerUnreachableError();
      },
      pending: async () => queue,
    });

    expect(views).toEqual([
      { days: null, unreachable: false },
      { days: null, unreachable: true },
    ]);
  });

  it.each([...ABSENT_LOCAL, ["qui ne se lit pas", UNREADABLE]])(
    "ne fabrique pas de semaine pour un jour en attente d'une autre semaine, l'état local %s",
    async (_, storage) => {
      const views = await viewsOf(MONDAY, {
        storage,
        read: offline,
        pending: async () => [{ ...PENDING_TUESDAY, jour: "2026-11-24" }],
      });

      expect(views.at(-1)).toEqual({ days: null, unreachable: true });
    },
  );

  it("montre la semaine sans jours en attente quand la file ne se lit pas", async () => {
    const storage = memoryStorage();
    await saveWeek(storage, MONDAY, LOCAL);

    const views = await viewsOf(MONDAY, {
      storage,
      read: async () => SERVER,
      pending: async () => {
        throw new Error("stockage indisponible");
      },
    });

    expect(views).toEqual([
      { days: LOCAL, unreachable: false },
      { days: SERVER, unreachable: false },
    ]);
  });
});
