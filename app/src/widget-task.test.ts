import type { PresenceDay } from "@badge-mie/week";
import { describe, expect, it } from "vitest";
import { ServerUnreachableError, TokenRejectedError } from "./api";
import { memoryStorage, storageHolding } from "./memory-storage";
import { createSendQueue, readPendingDays } from "./send-queue";
import {
  PHASE_MS,
  showPhase,
  type WidgetModel,
  type WidgetPhase,
} from "./widget";
import {
  PHASE_KEY,
  PUNCH_CLICK,
  readPhase,
  runWidgetTask,
  SEND_WAIT_MS,
  type WidgetTaskDependencies,
} from "./widget-task";
import {
  type KeyValueStorage,
  loadWeek,
  saveDay,
  type WeekView,
} from "./week-store";

/** Le mercredi 25 novembre 2026 à 08:52:40, l'instant du toucher du critère « Pointage ». */
const TAP = new Date(2026, 10, 25, 8, 52, 40);

/** La date de `TAP`, et le lundi de sa semaine. */
const DATE = "2026-11-25";
const MONDAY = "2026-11-23";

/** La journée de `TAP` après le pointage de son arrivée. */
const ARRIVAL: PresenceDay = { jour: DATE, arrivee: "08:52", depart: null };

/** La journée de `TAP`, terminée. */
const FINISHED: PresenceDay = { jour: DATE, arrivee: "08:52", depart: "17:30" };

/** L'instant `ms` millisecondes après `instant`. */
function after(instant: Date, ms: number): Date {
  return new Date(instant.getTime() + ms);
}

/** Un envoi, ou une lecture, sans réseau. */
async function unreachable(): Promise<never> {
  throw new ServerUnreachableError();
}

/**
 * Le gestionnaire et ses faux : un stockage en mémoire, un coffre qui tient `token`, un envoi qui
 * passe par `send`, une horloge réglée à la main sur `TAP`, une attente qui rend la main à la tâche
 * suivante sans toucher l'horloge, et un dessin qui garde chaque modèle avec le texte de la phase
 * rangée à cet instant.
 */
function harness({
  token = "jeton-de-test",
  send = async () => {},
}: {
  token?: string | null;
  send?: (day: PresenceDay) => Promise<void>;
} = {}) {
  const memory = memoryStorage();
  // Le texte de la phase rangée, suivi à chaque écriture, sans attendre le stockage.
  let phaseText: string | null = null;
  const storage: KeyValueStorage = {
    getItem: memory.getItem,
    setItem: async (key, value) => {
      if (key === PHASE_KEY) phaseText = value;
      await memory.setItem(key, value);
    },
  };
  const drawn: WidgetModel[] = [];
  const phaseAtDraw: (string | null)[] = [];
  const sent: PresenceDay[] = [];
  const waits: number[] = [];
  const clock = { now: TAP };
  let vault = token;
  const deps: WidgetTaskDependencies = {
    storage,
    readToken: async () => vault,
    clearToken: async () => {
      vault = null;
    },
    send: async (_, day) => {
      sent.push(day);
      await send(day);
    },
    now: () => clock.now,
    wait: (ms) => {
      waits.push(ms);
      return new Promise((resolve) => setTimeout(resolve, 0));
    },
    draw: (model) => {
      drawn.push(model);
      phaseAtDraw.push(phaseText);
    },
  };
  return {
    storage,
    deps,
    clock,
    drawn,
    phaseAtDraw,
    sent,
    waits,
    vault: () => vault,
    labels: () => drawn.map((model) => model.button.label),
  };
}

/** Un toucher sur le bouton de pointage. */
function tap(deps: WidgetTaskDependencies): Promise<void> {
  return runWidgetTask(
    { widgetAction: "WIDGET_CLICK", clickAction: PUNCH_CLICK },
    deps,
  );
}

/** Range une phase du bouton, comme l'aurait fait un toucher précédent. */
function storePhase(storage: KeyValueStorage, phase: WidgetPhase | null) {
  return storage.setItem(PHASE_KEY, JSON.stringify(phase));
}

/** L'état armé affiché une seconde avant `TAP` : un toucher à `TAP` le confirme. */
const ARMED_BEFORE_TAP = showPhase("armed", after(TAP, -1000));

/** La semaine de `TAP` que montrerait l'app hors réseau. */
async function localView(storage: KeyValueStorage): Promise<WeekView> {
  let view: WeekView = { days: null, unreachable: true };
  await loadWeek(
    MONDAY,
    {
      storage,
      read: unreachable,
      pending: () => readPendingDays(storage),
    },
    (shown) => {
      view = shown;
    },
  );
  return view;
}

describe("runWidgetTask — dessin", () => {
  it.each(["WIDGET_ADDED", "WIDGET_UPDATE", "WIDGET_RESIZED"] as const)(
    "dessine sur %s l'arrivée 08:52, le départ vide et « Pointer le départ », depuis l'état local",
    async (widgetAction) => {
      const h = harness();
      await saveDay(h.storage, ARRIVAL);

      await runWidgetTask({ widgetAction }, h.deps);

      expect(h.drawn).toEqual([
        {
          dot: "accent",
          arrival: "08:52",
          departure: "—",
          button: {
            label: "Pointer le départ",
            background: "accent",
            color: "accentInk",
            tap: "punch",
          },
        },
      ]);
    },
  );

  it("montre un jour en attente d'envoi par-dessus l'état local, pastille en attente", async () => {
    const h = harness();
    await createSendQueue({ storage: h.storage, send: unreachable }).record(
      ARRIVAL,
    );

    await runWidgetTask({ widgetAction: "WIDGET_UPDATE" }, h.deps);

    expect(h.drawn).toMatchObject([{ dot: "pending", arrival: "08:52" }]);
  });

  it("propose de pointer l'arrivée d'une semaine jamais vue, comme l'app hors réseau", async () => {
    const h = harness();

    await runWidgetTask({ widgetAction: "WIDGET_UPDATE" }, h.deps);

    expect(h.drawn).toMatchObject([
      { button: { label: "Pointer l'arrivée", tap: "punch" } },
    ]);
  });

  it.each([
    ["sans jeton", async () => null],
    ["sur un coffre illisible", () => Promise.reject(new Error("coffre"))],
  ])("affiche « Ouvrir l'app » %s", async (_, readToken) => {
    const h = harness();
    h.deps.readToken = readToken;

    await runWidgetTask({ widgetAction: "WIDGET_UPDATE" }, h.deps);

    expect(h.drawn).toMatchObject([
      { button: { label: "Ouvrir l'app", tap: "openApp" } },
    ]);
  });

  it("dessine quand même sur un stockage illisible, comme une semaine jamais vue", async () => {
    const h = harness();
    h.deps.storage = {
      getItem: () => Promise.reject(new Error("stockage")),
      setItem: () => Promise.reject(new Error("stockage")),
    };

    await runWidgetTask({ widgetAction: "WIDGET_UPDATE" }, h.deps);

    expect(h.drawn).toMatchObject([
      { dot: "accent", button: { label: "Pointer l'arrivée", tap: "punch" } },
    ]);
  });

  it("ne dessine rien quand le widget est retiré", async () => {
    const h = harness();

    await runWidgetTask({ widgetAction: "WIDGET_DELETED" }, h.deps);

    expect(h.drawn).toEqual([]);
  });
});

describe("runWidgetTask — double toucher", () => {
  it("arme au premier toucher, puis revient seul à « Pointer le départ » au bout de 3 s", async () => {
    const h = harness();
    await saveDay(h.storage, ARRIVAL);

    await tap(h.deps);

    expect([h.labels(), h.waits, h.sent]).toEqual([
      ["Confirmer le départ", "Pointer le départ"],
      [PHASE_MS.armed],
      [],
    ]);
    expect(h.drawn[0]?.button).toMatchObject({
      background: "accentInk",
      color: "accent",
      border: "accent",
    });
    expect(await readPhase(h.storage)).toBeNull();
  });

  it("pointe sur un second toucher 2,999 s après le dessin armé, même 3,499 s après le premier toucher", async () => {
    const h = harness();
    // Le dessin prend 500 ms : l'état armé s'affiche à `TAP` + 500 ms.
    const draw = h.deps.draw;
    h.deps.draw = (model) => {
      draw(model);
      h.clock.now = after(h.clock.now, 500);
    };
    const wait = h.deps.wait;
    let second: Promise<void> | undefined;
    h.deps.wait = async (ms) => {
      if (second === undefined) {
        h.clock.now = after(TAP, 500 + 2999);
        second = tap(h.deps);
        await second;
      }
      await wait(ms);
    };

    await tap(h.deps);

    expect(h.sent).toEqual([ARRIVAL]);
  });

  it("réarme sans pointer sur un toucher après l'expiration de l'état armé", async () => {
    const h = harness();
    await storePhase(h.storage, showPhase("armed", after(TAP, -3000)));

    await tap(h.deps);

    expect([h.labels()[0], h.sent]).toEqual(["Confirmer l'arrivée", []]);
  });

  it("laisse en place l'état armé qu'un autre toucher a rangé pendant les 3 s", async () => {
    const h = harness();
    const other = showPhase("armed", after(TAP, 3100));
    h.deps.wait = async () => {
      await storePhase(h.storage, other);
    };

    await tap(h.deps);

    expect([h.labels(), await readPhase(h.storage)]).toEqual([
      ["Confirmer l'arrivée"],
      other,
    ]);
  });

  it("range la phase sous sa propre clé, sans toucher la File d'envoi ni l'état local", async () => {
    const h = harness();
    await createSendQueue({ storage: h.storage, send: unreachable }).record(
      ARRIVAL,
    );
    const before = [
      await readPendingDays(h.storage),
      await localView(h.storage),
    ];

    await tap(h.deps);

    expect([
      await readPendingDays(h.storage),
      await localView(h.storage),
    ]).toEqual(before);
  });
});

describe("runWidgetTask — pointage", () => {
  it("enregistre l'arrivée 08:52 de la journée du 2026-11-25, par la File d'envoi, dans le même état local qu'un pointage de l'app", async () => {
    const h = harness({ send: unreachable });
    await storePhase(h.storage, ARMED_BEFORE_TAP);
    const app = memoryStorage();
    await createSendQueue({ storage: app, send: unreachable }).record(ARRIVAL);

    await tap(h.deps);

    expect([
      await readPendingDays(h.storage),
      await localView(h.storage),
    ]).toEqual([await readPendingDays(app), await localView(app)]);
    expect(await readPendingDays(h.storage)).toEqual([ARRIVAL]);
  });

  it("redessine la pastille en attente après l'enregistrement, puis revenue à l'accent après l'envoi", async () => {
    const h = harness();
    await storePhase(h.storage, ARMED_BEFORE_TAP);

    await tap(h.deps);

    expect([h.sent, h.drawn.map(({ dot }) => dot)]).toEqual([
      [ARRIVAL],
      ["pending", "accent"],
    ]);
    expect(h.drawn.at(-1)).toMatchObject({
      arrival: "08:52",
      button: { label: "Pointer le départ" },
    });
  });

  it("garde le jour en file sans réseau, pastille en attente", async () => {
    const h = harness({ send: unreachable });
    await storePhase(h.storage, ARMED_BEFORE_TAP);

    await tap(h.deps);

    expect([await readPendingDays(h.storage), h.drawn.at(-1)?.dot]).toEqual([
      [ARRIVAL],
      "pending",
    ]);
  });

  it("n'attend pas la relance au-delà de sa borne, et laisse le jour en file", async () => {
    const h = harness({ send: () => new Promise(() => {}) });
    await storePhase(h.storage, ARMED_BEFORE_TAP);

    await tap(h.deps);

    expect([h.waits, await readPendingDays(h.storage)]).toEqual([
      [SEND_WAIT_MS],
      [ARRIVAL],
    ]);
  });

  it("range le repos avant de redessiner : un troisième toucher dans la fenêtre réarme sans pointer", async () => {
    const h = harness();
    await storePhase(h.storage, ARMED_BEFORE_TAP);

    await tap(h.deps);
    h.clock.now = after(TAP, 1000);
    await tap(h.deps);

    expect([h.phaseAtDraw[0], h.sent, h.labels().at(-2)]).toEqual([
      "null",
      [ARRIVAL],
      "Confirmer le départ",
    ]);
  });

  it("refuse un départ à 08:52 sur une arrivée de 08:52 : aucune heure ne change, « Départ trop tôt » 3 s", async () => {
    const h = harness();
    await saveDay(h.storage, ARRIVAL);
    await storePhase(h.storage, ARMED_BEFORE_TAP);

    await tap(h.deps);

    expect([h.labels(), h.waits, h.sent]).toEqual([
      ["Départ trop tôt", "Pointer le départ"],
      [PHASE_MS.refused],
      [],
    ]);
    expect([
      await readPendingDays(h.storage),
      (await localView(h.storage)).days?.find(({ jour }) => jour === DATE),
    ]).toEqual([[], ARRIVAL]);
  });

  it("efface le jeton refusé par le serveur, puis redessine « Ouvrir l'app »", async () => {
    const h = harness({
      send: async () => {
        throw new TokenRejectedError();
      },
    });
    await storePhase(h.storage, ARMED_BEFORE_TAP);

    await tap(h.deps);

    expect([h.vault(), h.drawn.at(-1)?.button.tap]).toEqual([null, "openApp"]);
  });

  it.each([
    [
      "sans jeton, effacé depuis le dernier dessin",
      null,
      ARRIVAL,
      "Ouvrir l'app",
    ],
    ["sur une journée terminée", "jeton-de-test", FINISHED, "Journée terminée"],
  ])(
    "ne fait que redessiner, sans armer, sur un toucher %s",
    async (_, token, day, label) => {
      const h = harness({ token });
      await saveDay(h.storage, day);

      await tap(h.deps);

      expect([h.labels(), h.waits, h.sent]).toEqual([[label], [], []]);
    },
  );
});

describe("readPhase — la phase rangée, frontière de confiance", () => {
  it("relit la phase rangée par un toucher", async () => {
    const phase = showPhase("refused", TAP);
    const storage = memoryStorage();
    await storePhase(storage, phase);

    expect(await readPhase(storage)).toEqual(phase);
  });

  it.each([
    ["absente", null],
    ["illisible", "{pas du JSON"],
    ["au repos", "null"],
    ["un nombre", "42"],
    ["un texte", '"armed"'],
    ["un tableau", "[]"],
    ["un objet vide", "{}"],
    ["d'une phase inconnue", '{"kind":"idle","shownAt":1,"id":"a"}'],
    ["d'une phase héritée", '{"kind":"toString","shownAt":1,"id":"a"}'],
    ["sans phase", '{"shownAt":1,"id":"a"}'],
    ["à l'instant en texte", '{"kind":"armed","shownAt":"1","id":"a"}'],
    ["à l'instant nul", '{"kind":"armed","shownAt":null,"id":"a"}'],
    ["à l'instant infini", '{"kind":"armed","shownAt":1e999,"id":"a"}'],
    ["sans instant", '{"kind":"armed","id":"a"}'],
    ["à l'identifiant nombre", '{"kind":"armed","shownAt":1,"id":7}'],
    ["sans identifiant", '{"kind":"armed","shownAt":1}'],
  ])("compte une phase rangée %s comme le repos", async (_, text) => {
    expect(await readPhase(storageHolding(text))).toBeNull();
  });

  it("compte un stockage illisible comme le repos", async () => {
    const storage = storageHolding(null);
    storage.getItem = () => Promise.reject(new Error("stockage"));

    expect(await readPhase(storage)).toBeNull();
  });
});
