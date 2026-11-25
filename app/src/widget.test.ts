import {
  emptyDay,
  mondayOf,
  type PresenceDay,
  weekDates,
} from "@badge-mie/week";
import { describe, expect, it } from "vitest";
import type { WeekView } from "./week-store";
import {
  isStillShown,
  punchAt,
  showPhase,
  tapEffect,
  widgetModel,
  type WidgetState,
} from "./widget";

/** Le mercredi 25 novembre 2026, jour ouvré, à 9 h, heure locale. */
const WEDNESDAY_9AM = new Date(2026, 10, 25, 9, 0);

/** Le même mercredi à 08:52:40, l'instant du toucher des critères « Pointage » de l'issue #20. */
const WEDNESDAY_08_52_40 = new Date(2026, 10, 25, 8, 52, 40);

/** Le samedi 28 novembre 2026, jour non travaillé, à 9 h. */
const SATURDAY_9AM = new Date(2026, 10, 28, 9, 0);

/** La journée d'une date, arrivée à 08:52, sans départ. */
function arrivedAt(jour: string): PresenceDay {
  return { jour, arrivee: "08:52", depart: null };
}

/** La semaine lue qui porte cette journée ; ses autres journées sont vides. */
function weekOf(day: PresenceDay): WeekView {
  return {
    days: weekDates(mondayOf(day.jour)).map((jour) =>
      jour === day.jour ? day : emptyDay(jour),
    ),
    unreachable: false,
  };
}

/** Une semaine jamais lue, dont le chargement s'est terminé sans réseau. */
const UNREACHABLE: WeekView = { days: null, unreachable: true };

/** L'instant `ms` millisecondes après `instant`. */
function after(instant: Date, ms: number): Date {
  return new Date(instant.getTime() + ms);
}

/**
 * Ce que lit le widget sur la semaine `view` à `now` : par défaut, un jeton saisi, aucun jour en
 * attente d'envoi, le bouton au repos.
 */
function state(
  view: WeekView,
  now: Date,
  more: Partial<WidgetState> = {},
): WidgetState {
  return { view, now, pending: 0, hasToken: true, phase: null, ...more };
}

/** La semaine du mercredi 25, journée vide. */
const EMPTY = weekOf(emptyDay("2026-11-25"));

/** La semaine du mercredi 25, arrivée à 08:52 et départ vide. */
const ARRIVED = weekOf(arrivedAt("2026-11-25"));

/** La semaine du mercredi 25, journée terminée. */
const FINISHED = weekOf({
  jour: "2026-11-25",
  arrivee: "08:52",
  depart: "17:30",
});

describe("widgetModel — contenu", () => {
  it("montre l'arrivée 08:52, le départ vide et « Pointer le départ » sur l'accent", () => {
    expect(widgetModel(state(ARRIVED, WEDNESDAY_9AM))).toEqual({
      dot: "accent",
      arrival: "08:52",
      departure: "—",
      button: {
        label: "Pointer le départ",
        background: "accent",
        color: "accentInk",
        tap: "punch",
      },
    });
  });

  it("éteint « Journée terminée », sans effet au toucher, sur une journée terminée", () => {
    expect(widgetModel(state(FINISHED, WEDNESDAY_9AM)).button).toEqual({
      label: "Journée terminée",
      background: "surface2",
      color: "muted",
      tap: "none",
    });
  });

  it.each([
    [0, "accent"],
    [1, "pending"],
    [3, "pending"],
  ])(
    "colore la pastille d'envoi, %i jour(s) en attente d'envoi, en %s",
    (pending, dot) => {
      expect(widgetModel(state(ARRIVED, WEDNESDAY_9AM, { pending })).dot).toBe(
        dot,
      );
    },
  );

  it("montre deux heures vides sur une semaine jamais lue et injoignable, qui se pointe", () => {
    const model = widgetModel(state(UNREACHABLE, WEDNESDAY_9AM));
    expect(model).toMatchObject({
      arrival: "—",
      departure: "—",
      button: { label: "Pointer l'arrivée", tap: "punch" },
    });
  });

  it("éteint le bouton, sans effet au toucher, tant que la semaine jamais lue se charge", () => {
    const loading = { days: null, unreachable: false };
    expect(widgetModel(state(loading, WEDNESDAY_9AM)).button).toEqual({
      label: "Pointer l'arrivée",
      background: "surface2",
      color: "muted",
      tap: "none",
    });
  });
});

describe("widgetModel — jour non travaillé", () => {
  it.each([
    ["le samedi 2026-11-28", "2026-11-28", SATURDAY_9AM],
    [
      "le mercredi 2026-11-11, férié",
      "2026-11-11",
      new Date(2026, 10, 11, 9, 0),
    ],
  ])(
    "grise le bouton %s, qui garde le libellé de son état et pointe",
    (_, jour, now) => {
      expect(widgetModel(state(weekOf(arrivedAt(jour)), now)).button).toEqual({
        label: "Pointer le départ",
        background: "surface2",
        color: "fg",
        tap: "punch",
      });
    },
  );

  it("ne grise pas le bouton d'un jour ouvré, le mercredi 2026-11-25", () => {
    expect(widgetModel(state(ARRIVED, WEDNESDAY_9AM)).button.background).toBe(
      "accent",
    );
  });
});

describe("widgetModel — état armé et refus affiché", () => {
  it("inverse les couleurs du bouton armé : « Confirmer le départ », fond accentInk, texte et bord accent", () => {
    const phase = showPhase("armed", WEDNESDAY_9AM);
    expect(
      widgetModel(state(ARRIVED, WEDNESDAY_9AM, { phase })).button,
    ).toEqual({
      label: "Confirmer le départ",
      background: "accentInk",
      color: "accent",
      border: "accent",
      tap: "punch",
    });
  });

  it("demande de confirmer l'arrivée quand le bouton armé pointe l'arrivée", () => {
    const phase = showPhase("armed", WEDNESDAY_9AM);
    expect(
      widgetModel(state(EMPTY, WEDNESDAY_9AM, { phase })).button.label,
    ).toBe("Confirmer l'arrivée");
  });

  it("garde un jour grisé les couleurs grisées du bouton armé, qui se lit à son texte", () => {
    const phase = showPhase("armed", SATURDAY_9AM);
    const view = weekOf(arrivedAt("2026-11-28"));
    expect(widgetModel(state(view, SATURDAY_9AM, { phase })).button).toEqual({
      label: "Confirmer le départ",
      background: "surface2",
      color: "fg",
      tap: "punch",
    });
  });

  it.each([
    [2999, "Confirmer le départ"],
    [3000, "Pointer le départ"],
  ])(
    "montre le bouton armé %i ms après son affichage sous « %s »",
    (elapsed, label) => {
      const phase = showPhase("armed", WEDNESDAY_9AM);
      const now = after(WEDNESDAY_9AM, elapsed);
      expect(widgetModel(state(ARRIVED, now, { phase })).button.label).toBe(
        label,
      );
    },
  );

  it("affiche « Départ trop tôt » aux couleurs du repos après un pointage refusé", () => {
    const phase = showPhase("refused", WEDNESDAY_9AM);
    expect(
      widgetModel(state(ARRIVED, WEDNESDAY_9AM, { phase })).button,
    ).toEqual({
      label: "Départ trop tôt",
      background: "accent",
      color: "accentInk",
      tap: "punch",
    });
  });

  it.each([
    [2999, "Départ trop tôt"],
    [3000, "Pointer le départ"],
  ])(
    "montre le refus %i ms après son affichage sous « %s »",
    (elapsed, label) => {
      const phase = showPhase("refused", WEDNESDAY_9AM);
      const now = after(WEDNESDAY_9AM, elapsed);
      expect(widgetModel(state(ARRIVED, now, { phase })).button.label).toBe(
        label,
      );
    },
  );

  it("éteint « Journée terminée » même si une phase armée est rangée", () => {
    const phase = showPhase("armed", WEDNESDAY_9AM);
    expect(
      widgetModel(state(FINISHED, WEDNESDAY_9AM, { phase })).button,
    ).toMatchObject({ label: "Journée terminée", tap: "none" });
  });
});

describe("widgetModel — sans jeton", () => {
  it("affiche « Ouvrir l'app » aux couleurs du repos, et un toucher ouvre l'app", () => {
    expect(
      widgetModel(state(ARRIVED, WEDNESDAY_9AM, { hasToken: false })).button,
    ).toEqual({
      label: "Ouvrir l'app",
      background: "accent",
      color: "accentInk",
      tap: "openApp",
    });
  });

  it("calcule les heures et la pastille comme d'habitude", () => {
    const model = widgetModel(
      state(ARRIVED, WEDNESDAY_9AM, { hasToken: false, pending: 2 }),
    );
    expect(model).toMatchObject({
      dot: "pending",
      arrival: "08:52",
      departure: "—",
    });
  });

  it("ouvre l'app même si une phase armée est rangée", () => {
    const phase = showPhase("armed", WEDNESDAY_9AM);
    expect(
      widgetModel(state(ARRIVED, WEDNESDAY_9AM, { hasToken: false, phase }))
        .button,
    ).toMatchObject({ label: "Ouvrir l'app", tap: "openApp" });
  });
});

describe("tapEffect — double toucher", () => {
  it("arme le bouton au premier toucher", () => {
    expect(tapEffect(null, WEDNESDAY_9AM)).toBe("arm");
  });

  it.each([
    [2999, "punch"],
    [3000, "arm"],
  ])(
    "rend, sur un second toucher %i ms après l'affichage de l'état armé, « %s »",
    (elapsed, effect) => {
      const phase = showPhase("armed", WEDNESDAY_9AM);
      expect(tapEffect(phase, after(WEDNESDAY_9AM, elapsed))).toBe(effect);
    },
  );

  it("compte les 3 s depuis l'affichage de l'état armé, pas depuis le premier toucher", () => {
    // Le processus de l'app arrêté, le dessin suit le toucher de 2,1 s (ADR-0002).
    const shown = after(WEDNESDAY_9AM, 2100);
    const phase = showPhase("armed", shown);
    expect(tapEffect(phase, after(WEDNESDAY_9AM, 4000))).toBe("punch");
  });

  it("arme le bouton sur un toucher pendant un refus affiché", () => {
    const phase = showPhase("refused", WEDNESDAY_9AM);
    expect(tapEffect(phase, after(WEDNESDAY_9AM, 1000))).toBe("arm");
  });
});

describe("isStillShown — retour au repos différé", () => {
  it("revient au repos quand la phase rangée est celle qu'il a posée", () => {
    const phase = showPhase("armed", WEDNESDAY_9AM);
    expect(isStillShown(phase, phase)).toBe(true);
  });

  it("ne revient pas au repos quand la phase rangée porte un autre identifiant, même affichée au même instant", () => {
    const first = showPhase("armed", WEDNESDAY_9AM);
    const second = showPhase("armed", WEDNESDAY_9AM);
    expect(isStillShown(second, first)).toBe(false);
  });

  it("ne revient pas au repos quand le bouton y est déjà", () => {
    const phase = showPhase("armed", WEDNESDAY_9AM);
    expect(isStillShown(null, phase)).toBe(false);
  });

  it("reconnaît sa phase relue du stockage, en JSON", () => {
    const phase = showPhase("armed", WEDNESDAY_9AM);
    const stored = JSON.parse(JSON.stringify(phase));
    expect([
      isStillShown(stored, phase),
      tapEffect(stored, after(WEDNESDAY_9AM, 1000)),
    ]).toEqual([true, "punch"]);
  });
});

describe("punchAt — pointage", () => {
  it("enregistre l'arrivée 08:52 de la journée du 2026-11-25 sur un toucher à 08:52:40", () => {
    expect(punchAt(EMPTY, WEDNESDAY_08_52_40)).toEqual({
      day: { jour: "2026-11-25", arrivee: "08:52", depart: null },
    });
  });

  it("pointe la date du toucher juste après minuit, pas la veille qu'affichait le widget", () => {
    // Le widget affichait mardi 24, commencé : un pointage sur lui en serait le départ.
    const view = weekOf({ jour: "2026-11-24", arrivee: "08:30", depart: null });
    expect(punchAt(view, new Date(2026, 10, 25, 0, 0, 30))).toEqual({
      day: { jour: "2026-11-25", arrivee: "00:00", depart: null },
    });
  });

  it("recalcule le lundi d'un toucher juste après le minuit du dimanche au lundi", () => {
    expect(punchAt(UNREACHABLE, new Date(2026, 10, 30, 0, 0, 30))).toEqual({
      day: { jour: "2026-11-30", arrivee: "00:00", depart: null },
    });
  });

  it("pointe une semaine jamais lue et injoignable comme l'app, sur une journée vide", () => {
    expect(punchAt(UNREACHABLE, WEDNESDAY_08_52_40)).toEqual({
      day: { jour: "2026-11-25", arrivee: "08:52", depart: null },
    });
  });

  it("ne pointe rien sur une journée terminée", () => {
    expect(punchAt(FINISHED, new Date(2026, 10, 25, 18, 0))).toBeNull();
  });

  it("refuse un départ à 08:52 sur une arrivée de 08:52, sans changer d'heure, et affiche « Départ trop tôt »", () => {
    // Un refus ne porte aucune journée : rien n'est enregistré, la vue reste celle d'avant.
    expect(punchAt(ARRIVED, WEDNESDAY_08_52_40)).toEqual({
      refusal: "departureMustFollowArrival",
    });
    const phase = showPhase("refused", WEDNESDAY_08_52_40);
    expect(
      widgetModel(state(ARRIVED, WEDNESDAY_08_52_40, { phase })),
    ).toMatchObject({
      arrival: "08:52",
      departure: "—",
      button: { label: "Départ trop tôt" },
    });
  });
});
