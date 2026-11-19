import { type PresenceDay, weekDates } from "@badge-mie/week";
import { describe, expect, it } from "vitest";
import { ServerUnreachableError, TokenRejectedError } from "./api";
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

/** Une lecture sans réseau. */
async function offline(): Promise<PresenceDay[]> {
  throw new ServerUnreachableError();
}

/** Un stockage clé-valeur en mémoire, vide au départ. */
function memoryStorage(): KeyValueStorage {
  const items = new Map<string, string>();
  return {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => {
      items.set(key, value);
    },
  };
}

/** Les journées `days`, le mercredi remplacé par `POINTED`. */
function withPointed(days: PresenceDay[]): PresenceDay[] {
  return days.map((day) => (day.jour === POINTED.jour ? POINTED : day));
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
    const storage: KeyValueStorage = {
      getItem: async () => {
        throw new Error("stockage indisponible");
      },
      setItem: async () => {},
    };

    const views = await viewsOf(MONDAY, { storage, read: async () => SERVER });

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

  it("tient un état local illisible pour absent", async () => {
    const corrupted: KeyValueStorage = {
      getItem: async () => "[{ pas du JSON",
      setItem: async () => {},
    };

    const views = await viewsOf(MONDAY, { storage: corrupted, read: offline });

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

  it("ne fabrique pas de semaine pour un jour en attente quand aucune n'est connue", async () => {
    const views = await viewsOf(MONDAY, {
      storage: memoryStorage(),
      read: offline,
      pending: async () => [POINTED],
    });

    expect(views).toEqual([
      { days: null, unreachable: false },
      { days: null, unreachable: true },
    ]);
  });

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
