import { describe, expect, it } from "vitest";
import {
  clockLine,
  durationText,
  editHint,
  editMessage,
  pendingText,
  PUNCH_LABELS,
  punchMessage,
} from "./labels";

describe("PUNCH_LABELS", () => {
  it.each([
    ["arrival", "Pointer l'arrivée"],
    ["departure", "Pointer le départ"],
    ["done", "Journée terminée"],
    ["weekend", "Pas de pointage le week-end"],
  ] as const)(
    "donne au bouton de pointage l'action %s sous le libellé « %s »",
    (action, label) => {
      expect(PUNCH_LABELS[action]).toBe(label);
    },
  );
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

describe("durationText", () => {
  it.each([
    ["un jour passé complet", "08:30", "17:05", false, "8 h 35"],
    ["aujourd'hui complet", "08:30", "17:05", true, "8 h 35"],
    ["aujourd'hui commencé et non terminé", "08:30", null, true, "en cours"],
    ["un jour passé sans départ", "08:30", null, false, "—"],
    ["un jour passé qui n'a qu'un départ", null, "17:05", false, "—"],
    ["aujourd'hui qui n'a qu'un départ", null, "17:05", true, "—"],
    ["un jour sans aucune heure", null, null, false, ""],
    ["aujourd'hui sans aucune heure", null, null, true, ""],
  ])(
    "affiche pour %s (%s → %s, aujourd'hui : %s) « %s »",
    (_, arrival, departure, isToday, text) => {
      expect(durationText(arrival, departure, isToday)).toBe(text);
    },
  );
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
