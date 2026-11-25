import { emptyDay, type PresenceDay } from "@badge-mie/week";
import { describe, expect, it } from "vitest";
import {
  clockLine,
  CONFIRM_LABELS,
  DEPARTURE_TOO_EARLY,
  durationText,
  editHint,
  editMessage,
  HOLD_HINT,
  HOLD_TO_PUNCH,
  OPEN_APP,
  pendingText,
  PUNCH_LABELS,
  punchMessage,
  REFUSAL_TEXTS,
  WIDGET_CONFIRM,
  WIDGET_PUNCH_LABELS,
} from "./labels";

describe("PUNCH_LABELS", () => {
  it.each([
    ["arrival", "Pointer l'arrivée"],
    ["departure", "Pointer le départ"],
    ["done", "Journée terminée"],
  ] as const)(
    "donne au bouton de pointage l'action %s sous le libellé « %s »",
    (action, label) => {
      expect(PUNCH_LABELS[action]).toBe(label);
    },
  );
});

describe("CONFIRM_LABELS", () => {
  it.each([
    ["arrival", "Confirmer l'arrivée"],
    ["departure", "Confirmer le départ"],
  ] as const)(
    "dit à TalkBack, sur le widget armé, l'action %s à confirmer par « %s »",
    (action, label) => {
      expect(CONFIRM_LABELS[action]).toBe(label);
    },
  );
});

describe("WIDGET_PUNCH_LABELS", () => {
  it.each([
    ["arrival", "Badger"],
    ["departure", "Badger"],
    ["done", "Journée terminée"],
  ] as const)(
    "affiche sur le bouton du widget l'action %s sous le libellé court « %s »",
    (action, label) => {
      expect(WIDGET_PUNCH_LABELS[action]).toBe(label);
    },
  );
});

describe("WIDGET_CONFIRM", () => {
  it("affiche sur le bouton du widget armé « Confirmer »", () => {
    expect(WIDGET_CONFIRM).toBe("Confirmer");
  });
});

describe("DEPARTURE_TOO_EARLY", () => {
  it("dit sur le bouton du widget un départ refusé", () => {
    expect(DEPARTURE_TOO_EARLY).toBe("Départ trop tôt");
  });
});

describe("OPEN_APP", () => {
  it("renvoie vers l'app un widget sans jeton", () => {
    expect(OPEN_APP).toBe("Ouvrir l'app");
  });
});

describe("REFUSAL_TEXTS", () => {
  it.each([
    ["departureMustFollowArrival", "Le départ doit suivre l'arrivée"],
    ["clearDepartureFirst", "Effacez d'abord le départ de ce jour"],
  ] as const)("dit le refus %s par « %s »", (refusal, text) => {
    expect(REFUSAL_TEXTS[refusal]).toBe(text);
  });
});

describe("HOLD_TO_PUNCH", () => {
  it("rappelle, après un appui interrompu, de maintenir le bouton", () => {
    expect(HOLD_TO_PUNCH).toBe("Maintiens le bouton pour pointer");
  });
});

describe("HOLD_HINT", () => {
  it("annonce à TalkBack que le bouton se maintient hors de lui", () => {
    expect(HOLD_HINT).toBe("Sans TalkBack, maintiens le bouton pour pointer");
  });
});

describe("punchMessage", () => {
  it.each([
    ["arrival", "Arrivée pointée à 08:30"],
    ["departure", "Départ pointé à 08:30"],
  ] as const)(
    "confirme un pointage de l'action %s : « %s »",
    (action, message) => {
      expect(punchMessage(action, "08:30")).toBe(message);
    },
  );
});

describe("editMessage", () => {
  it.each([
    ["arrivee", "08:30", "Arrivée corrigée à 08:30"],
    ["depart", "17:05", "Départ corrigé à 17:05"],
  ] as const)(
    "confirme une correction de %s à %s : « %s »",
    (field, time, message) => {
      expect(editMessage(field, time)).toBe(message);
    },
  );

  it.each([
    ["arrivee", "Arrivée effacée"],
    ["depart", "Départ effacé"],
  ] as const)("confirme un effacement de %s : « %s »", (field, message) => {
    expect(editMessage(field, null)).toBe(message);
  });
});

/** La journée du mercredi 18 novembre 2026, jour ouvré, aux heures données. */
function workday(arrivee: string | null, depart: string | null): PresenceDay {
  return { jour: "2026-11-18", arrivee, depart };
}

/** La journée du mercredi 11 novembre 2026, férié en semaine, aux heures données. */
function holiday(arrivee: string | null, depart: string | null): PresenceDay {
  return { jour: "2026-11-11", arrivee, depart };
}

describe("durationText", () => {
  it.each([
    ["un jour passé complet", false, "8 h 35", workday("08:30", "17:05")],
    ["aujourd'hui complet", true, "8 h 35", workday("08:30", "17:05")],
    [
      "aujourd'hui commencé et non terminé",
      true,
      "en cours",
      workday("08:30", null),
    ],
    ["un jour passé sans départ", false, "—", workday("08:30", null)],
    ["un jour passé qui n'a qu'un départ", false, "—", workday(null, "17:05")],
    ["aujourd'hui qui n'a qu'un départ", true, "—", workday(null, "17:05")],
    ["un jour sans aucune heure", false, "", workday(null, null)],
    ["aujourd'hui sans aucune heure", true, "", workday(null, null)],
    [
      "un férié en semaine sans aucune heure",
      false,
      "8 h 30",
      holiday(null, null),
    ],
    [
      "un férié en semaine pointé de 09:00 à 12:00",
      false,
      "3 h 00",
      holiday("09:00", "12:00"),
    ],
    [
      "un férié en semaine passé, à la seule arrivée",
      false,
      "—",
      holiday("09:00", null),
    ],
    [
      "aujourd'hui, un férié en semaine commencé",
      true,
      "en cours",
      holiday("09:00", null),
    ],
    [
      "un férié un dimanche sans aucune heure",
      false,
      "",
      emptyDay("2026-11-01"),
    ],
  ])("affiche pour %s (aujourd'hui : %s) « %s »", (_, isToday, text, day) => {
    expect(durationText(day, isToday)).toBe(text);
  });
});

describe("pendingText", () => {
  it.each([
    [0, "Enregistré"],
    [1, "En attente d'envoi (1)"],
    [3, "En attente d'envoi (3)"],
  ])("indique %i jour(s) en attente d'envoi par « %s »", (count, text) => {
    expect(pendingText(count)).toBe(text);
  });
});

describe("clockLine", () => {
  it("écrit la date du jour et l'heure courante, séparées d'un point médian", () => {
    expect(clockLine("2026-11-18", "09:05")).toBe(
      "mercredi 18 novembre · 09:05",
    );
  });
});

describe("editHint", () => {
  it.each([
    ["arrivee", "Modifier l'arrivée du mercredi 18 novembre"],
    ["depart", "Modifier le départ du mercredi 18 novembre"],
  ] as const)("indique le geste qui corrige %s : « %s »", (field, hint) => {
    expect(editHint(field, "2026-11-18")).toBe(hint);
  });
});
