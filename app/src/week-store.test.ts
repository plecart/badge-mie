import { type PresenceDay, weekDates } from "@badge-mie/week";
import { describe, expect, it } from "vitest";
import { ServerUnreachableError, TokenRejectedError } from "./api";
import {
  type KeyValueStorage,
  loadWeek,
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

/** Charge une semaine et rend les vues affichées, dans l'ordre. */
async function viewsOf(
  monday: string,
  dependencies: Parameters<typeof loadWeek>[1],
): Promise<WeekView[]> {
  const views: WeekView[] = [];
  await loadWeek(monday, dependencies, (view) => views.push(view));
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

    await expect(
      loadWeek(MONDAY, { storage, read: rejected }, () => {}),
    ).rejects.toThrow(TokenRejectedError);

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

  it("affiche la réponse du serveur même quand l'état local ne peut pas la garder", async () => {
    const failure = new Error("stockage plein");
    const storage: KeyValueStorage = {
      getItem: async () => null,
      setItem: async () => {
        throw failure;
      },
    };
    const views: WeekView[] = [];

    await expect(
      loadWeek(MONDAY, { storage, read: async () => SERVER }, (view) =>
        views.push(view),
      ),
    ).rejects.toBe(failure);

    expect(views).toEqual([
      { days: null, unreachable: false },
      { days: SERVER, unreachable: false },
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
