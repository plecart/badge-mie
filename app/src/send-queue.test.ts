import { mondayOf, type PresenceDay } from "@badge-mie/week";
import { describe, expect, it, vi } from "vitest";
import {
  DayRejectedError,
  ServerUnreachableError,
  TokenRejectedError,
} from "./api";
import { memoryStorage } from "./memory-storage";
import { createSendQueue } from "./send-queue";
import { type KeyValueStorage, loadWeek, type WeekView } from "./week-store";

/** Une journée pointée, le lundi. */
const MONDAY_DAY: PresenceDay = {
  jour: "2026-11-16",
  arrivee: "08:30",
  depart: null,
};

/** Une autre journée pointée, le mercredi de la même semaine. */
const WEDNESDAY_DAY: PresenceDay = {
  jour: "2026-11-18",
  arrivee: "07:45",
  depart: "16:30",
};

/** Un envoi, ou une lecture, sans réseau. */
async function unreachable(): Promise<never> {
  throw new ServerUnreachableError();
}

/** Un stockage dont la file attend déjà `days`, enregistrés sans réseau, dans cet ordre. */
async function storageWaiting(
  ...days: PresenceDay[]
): Promise<KeyValueStorage> {
  const storage = memoryStorage();
  const queue = createSendQueue({ storage, send: unreachable });
  for (const day of days) await queue.record(day);
  await queue.flush();
  return storage;
}

/**
 * Un envoi retenu : chaque appel attend qu'on le règle par son `settle`, sans argument pour un
 * succès, avec l'erreur de l'échec sinon. `call(n)` attend le `n`-ième appel, compté depuis 1, et
 * le rend.
 */
function heldSend() {
  const calls: { day: PresenceDay; settle: (error?: Error) => void }[] = [];
  const send = (day: PresenceDay) =>
    new Promise<void>((resolve, reject) => {
      calls.push({
        day,
        settle: (error) => (error ? reject(error) : resolve()),
      });
    });
  const call = (n: number) =>
    vi.waitFor(() => {
      const found = calls[n - 1];
      if (!found)
        throw new Error(`envoi n° ${n} attendu, ${calls.length} reçus`);
      return found;
    });
  return { send, calls, call };
}

describe("createSendQueue", () => {
  it("garde un pointage sur le téléphone avant tout envoi", async () => {
    const storage = memoryStorage();
    let storedWhenSent: PresenceDay[] = [];
    const queue = createSendQueue({
      storage,
      send: async () => {
        // Une autre file sur le même stockage : ce qu'elle lit survit à la fermeture de
        // l'application.
        storedWhenSent = await createSendQueue({
          storage,
          send: unreachable,
        }).pendingDays();
      },
    });

    await queue.record(MONDAY_DAY);
    await queue.flush();

    expect(storedWhenSent).toEqual([MONDAY_DAY]);
  });

  it.each([
    ["le réseau manque", new ServerUnreachableError()],
    ["l'envoi échoue autrement", new TypeError("panne inattendue")],
  ])("garde la file et arrête la relance quand %s", async (_, failure) => {
    const storage = await storageWaiting(MONDAY_DAY, WEDNESDAY_DAY);
    const sent: PresenceDay[] = [];
    const queue = createSendQueue({
      storage,
      send: async (day) => {
        sent.push(day);
        throw failure;
      },
    });

    await queue.flush();

    expect([sent, await queue.pendingDays()]).toEqual([
      [MONDAY_DAY],
      [MONDAY_DAY, WEDNESDAY_DAY],
    ]);
  });

  it("retire de la file un pointage envoyé, et dit qu'aucun jour n'attend plus", async () => {
    const counts: number[] = [];
    const queue = createSendQueue({
      storage: memoryStorage(),
      send: async () => {},
      onChange: (pending) => counts.push(pending),
    });

    await queue.record(MONDAY_DAY);
    await queue.flush();

    expect([await queue.pendingDays(), counts.at(-1)]).toEqual([[], 0]);
  });

  it("dit le nombre de jours en attente après chaque pointage", async () => {
    const counts: number[] = [];
    const queue = createSendQueue({
      storage: memoryStorage(),
      send: unreachable,
      onChange: (pending) => counts.push(pending),
    });

    await queue.record(MONDAY_DAY);
    await queue.record(WEDNESDAY_DAY);

    expect(counts).toEqual([1, 2]);
  });

  it("n'envoie qu'une fois, dans son état final, un jour modifié deux fois en attente", async () => {
    let online = false;
    const sent: PresenceDay[] = [];
    const queue = createSendQueue({
      storage: memoryStorage(),
      send: async (day) => {
        if (!online) throw new ServerUnreachableError();
        sent.push(day);
      },
    });
    const departed = { ...MONDAY_DAY, depart: "17:00" };

    await queue.record(MONDAY_DAY);
    await queue.record(departed);
    await queue.flush();
    online = true;
    await queue.flush();

    expect(sent).toEqual([departed]);
  });

  it.each([
    ["l'arrivée corrigée", { ...MONDAY_DAY, arrivee: "08:15" }],
    ["le départ pointé", { ...MONDAY_DAY, depart: "17:00" }],
  ])(
    "garde en file %s pendant l'envoi du jour, puis l'envoie",
    async (_, modified) => {
      const { send, call } = heldSend();
      const queue = createSendQueue({ storage: memoryStorage(), send });

      await queue.record(MONDAY_DAY);
      const first = await call(1);
      await queue.record(modified);
      first.settle();
      const second = await call(2);

      expect([second.day, await queue.pendingDays()]).toEqual([
        modified,
        [modified],
      ]);
    },
  );

  it("arrête la relance sur un jeton refusé, garde la file et le signale", async () => {
    const storage = await storageWaiting(MONDAY_DAY, WEDNESDAY_DAY);
    const sent: PresenceDay[] = [];
    let rejections = 0;
    const queue = createSendQueue({
      storage,
      send: async (day) => {
        sent.push(day);
        throw new TokenRejectedError();
      },
      onTokenRejected: () => rejections++,
    });

    await queue.flush();

    expect([sent, rejections, await queue.pendingDays()]).toEqual([
      [MONDAY_DAY],
      1,
      [MONDAY_DAY, WEDNESDAY_DAY],
    ]);
  });

  it("garde en file un jour refusé par le serveur, sans arrêter l'envoi des jours suivants", async () => {
    const storage = await storageWaiting(MONDAY_DAY, WEDNESDAY_DAY);
    const queue = createSendQueue({
      storage,
      send: async (day) => {
        if (day.jour === MONDAY_DAY.jour) throw new DayRejectedError();
      },
    });

    await queue.flush();

    expect(await queue.pendingDays()).toEqual([MONDAY_DAY]);
  });

  it("ne lance qu'une relance à la fois, et la fait repartir une seule fois pour les déclencheurs reçus pendant qu'elle tourne", async () => {
    const storage = await storageWaiting(MONDAY_DAY);
    const { send: held, calls, call } = heldSend();
    let sending = 0;
    let mostSending = 0;
    const queue = createSendQueue({
      storage,
      send: async (day) => {
        mostSending = Math.max(mostSending, ++sending);
        try {
          await held(day);
        } finally {
          sending--;
        }
      },
    });

    const flushes = [queue.flush()];
    const first = await call(1);
    flushes.push(queue.flush(), queue.flush(), queue.flush());
    first.settle(new ServerUnreachableError());
    (await call(2)).settle(new ServerUnreachableError());
    await Promise.all(flushes);

    expect([calls.length, mostSending]).toEqual([2, 1]);
  });

  it("n'écrase pas un pointage enregistré pendant la sortie d'un jour envoyé", async () => {
    // Chaque lecture rend l'état du moment où elle part, une tâche plus tard : deux
    // lectures-écritures qui se chevauchent y lisent le même état.
    const memory = memoryStorage();
    const storage: KeyValueStorage = {
      getItem: async (key) => {
        const text = await memory.getItem(key);
        await new Promise((resolve) => setTimeout(resolve, 0));
        return text;
      },
      setItem: memory.setItem,
    };
    const recorded: Promise<void>[] = [];
    const queue = createSendQueue({
      storage,
      send: async (day) => {
        if (day.jour === WEDNESDAY_DAY.jour) throw new ServerUnreachableError();
        recorded.push(queue.record(WEDNESDAY_DAY));
      },
    });

    await queue.record(MONDAY_DAY);
    await queue.flush();
    await Promise.all(recorded);
    await queue.flush();

    expect(await queue.pendingDays()).toEqual([WEDNESDAY_DAY]);
  });

  it("range le pointage dans l'état local de sa semaine", async () => {
    const storage = memoryStorage();
    const queue = createSendQueue({ storage, send: unreachable });

    await queue.record(WEDNESDAY_DAY);

    const views: WeekView[] = [];
    await loadWeek(
      mondayOf(WEDNESDAY_DAY.jour),
      { storage, read: unreachable, pending: async () => [] },
      (view) => views.push(view),
    );
    expect(views[0]?.days).toContainEqual(WEDNESDAY_DAY);
  });

  it("rend les jours en attente par date croissante, quel que soit l'ordre des pointages", async () => {
    const storage = await storageWaiting(WEDNESDAY_DAY, MONDAY_DAY);
    const queue = createSendQueue({ storage, send: unreachable });

    expect(await queue.pendingDays()).toEqual([MONDAY_DAY, WEDNESDAY_DAY]);
  });

  it("refuse un pointage que le stockage n'a pas pu garder, sans bloquer les suivants", async () => {
    const memory = memoryStorage();
    let failures = 1;
    const storage: KeyValueStorage = {
      getItem: memory.getItem,
      setItem: async (key, value) => {
        if (failures-- > 0) throw new Error("stockage plein");
        await memory.setItem(key, value);
      },
    };
    const queue = createSendQueue({ storage, send: unreachable });

    await expect(queue.record(MONDAY_DAY)).rejects.toThrow("stockage plein");
    await queue.record(WEDNESDAY_DAY);

    expect(await queue.pendingDays()).toEqual([WEDNESDAY_DAY]);
  });

  it("garde en file un pointage dont l'état local n'a pas pu s'écrire", async () => {
    const memory = memoryStorage();
    let writes = 0;
    // La première écriture, celle de la file, passe ; la seconde, celle de la semaine, échoue.
    const storage: KeyValueStorage = {
      getItem: memory.getItem,
      setItem: async (key, value) => {
        if (++writes === 2) throw new Error("stockage plein");
        await memory.setItem(key, value);
      },
    };
    const queue = createSendQueue({ storage, send: unreachable });

    await expect(queue.record(MONDAY_DAY)).rejects.toThrow("stockage plein");

    expect(await queue.pendingDays()).toEqual([MONDAY_DAY]);
  });
});

describe("lecture de la file d'envoi", () => {
  /** Une file sur un stockage qui rend `text` pour toute clé. */
  function queueReading(text: string) {
    return createSendQueue({
      storage: { getItem: async () => text, setItem: async () => {} },
      send: unreachable,
    });
  }

  it.each([
    ["illisible", "{ pas du JSON"],
    ["nul", "null"],
    ["en nombre", "42"],
    ["en texte", '"file"'],
    ["en tableau", JSON.stringify([MONDAY_DAY])],
  ])("tient pour vide une file au stockage %s", async (_, text) => {
    expect(await queueReading(text).pendingDays()).toEqual([]);
  });

  const date = WEDNESDAY_DAY.jour;
  it.each([
    [
      "à une date irréelle",
      { "2026-02-30": { ...MONDAY_DAY, jour: "2026-02-30" } },
    ],
    ["rangée sous une autre date que la sienne", { [date]: MONDAY_DAY }],
    ["sans jour", { [date]: { arrivee: null, depart: null } }],
    ["sans arrivée", { [date]: { jour: date, depart: null } }],
    [
      "à l'arrivée mal formée",
      { [date]: { ...WEDNESDAY_DAY, arrivee: "7:45" } },
    ],
    ["à l'arrivée en nombre", { [date]: { ...WEDNESDAY_DAY, arrivee: 745 } }],
    ["sans départ", { [date]: { jour: date, arrivee: null } }],
    ["au départ mal formé", { [date]: { ...WEDNESDAY_DAY, depart: "16h30" } }],
    [
      "au départ en tableau",
      { [date]: { ...WEDNESDAY_DAY, depart: ["16:30"] } },
    ],
    ["nulle", { [date]: null }],
    ["en texte", { [date]: "07:45" }],
  ])("tient pour absente une entrée %s", async (_, entry) => {
    const text = JSON.stringify({ [MONDAY_DAY.jour]: MONDAY_DAY, ...entry });

    expect(await queueReading(text).pendingDays()).toEqual([MONDAY_DAY]);
  });
});
