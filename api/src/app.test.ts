import { describe, expect, it } from "vitest";
import type { PresenceDay } from "@badge-mie/week";
import type { Hono } from "hono";
import { createApp } from "./app";

const TOKEN = "jeton-de-test";
const AUTHORIZED = { Authorization: `Bearer ${TOKEN}` };

/**
 * Une application sur un dépôt factice en mémoire, une ligne par date, rempli de `days`. Le dépôt
 * rend toutes ses lignes quelle que soit la plage demandée, et note chaque plage lue et chaque
 * journée écrite.
 */
function appWith(days: PresenceDay[] = []) {
  const rows = new Map(days.map((day) => [day.jour, day]));
  const reads: [string, string][] = [];
  const writes: PresenceDay[] = [];
  const app = createApp({
    token: TOKEN,
    repository: {
      readDays: async (from, to) => {
        reads.push([from, to]);
        return [...rows.values()];
      },
      writeDay: async (day) => {
        writes.push(day);
        rows.set(day.jour, day);
      },
    },
  });
  return { app, reads, writes };
}

/**
 * Envoie `body` en `PUT /jours/:date`, avec le bon jeton par défaut : un texte tel quel, toute
 * autre valeur encodée en JSON.
 */
function put(
  app: Hono,
  date: string,
  body: unknown,
  headers: Record<string, string> = AUTHORIZED,
) {
  return app.request(`/jours/${date}`, {
    method: "PUT",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Lit les journées de la semaine du lundi `monday` par `GET /semaines/:lundi`. */
async function weekOf(app: Hono, monday: string): Promise<PresenceDay[]> {
  const response = await app.request(`/semaines/${monday}`, {
    headers: AUTHORIZED,
  });
  return response.json();
}

describe("garde du jeton", () => {
  it.each([
    ["sans en-tête Authorization", {}],
    ["avec un mauvais jeton", { Authorization: "Bearer autre-jeton" }],
    ["avec le schéma Basic", { Authorization: `Basic ${TOKEN}` }],
    ["avec Bearer sans valeur", { Authorization: "Bearer" }],
    ["avec le jeton sans schéma", { Authorization: TOKEN }],
    ["avec le schéma en minuscules", { Authorization: `bearer ${TOKEN}` }],
    ["avec deux espaces", { Authorization: `Bearer  ${TOKEN}` }],
    [
      "avec le jeton tronqué",
      { Authorization: `Bearer ${TOKEN.slice(0, -1)}` },
    ],
    ["avec le jeton prolongé", { Authorization: `Bearer ${TOKEN}x` }],
  ])("rend 401 %s", async (_, headers) => {
    const response = await appWith().app.request("/semaines/2026-11-16", {
      headers,
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("rend 401 sur une route inconnue sans jeton", async () => {
    const response = await appWith().app.request("/inconnue");
    expect(response.status).toBe(401);
  });

  it("rend 401 sans jeton avant de valider le lundi", async () => {
    const response = await appWith().app.request("/semaines/2026-11-17");
    expect(response.status).toBe(401);
  });

  it("laisse passer le bon jeton : une route inconnue rend alors 404", async () => {
    const response = await appWith().app.request("/inconnue", {
      headers: AUTHORIZED,
    });
    expect(response.status).toBe(404);
  });
});

describe("GET /semaines/:lundi", () => {
  it.each([
    ["2026-11-17", "un mardi"],
    ["2026-02-30", "une date impossible"],
    ["16-11-2026", "une date hors format AAAA-MM-JJ"],
  ])("rend 400 pour %s, %s", async (lundi) => {
    const response = await appWith().app.request(`/semaines/${lundi}`, {
      headers: AUTHORIZED,
    });
    expect(response.status).toBe(400);
  });

  it("rend 7 journées, du 2026-11-16 au 2026-11-22 dans l'ordre, à null sans ligne", async () => {
    const { app } = appWith([
      { jour: "2026-11-16", arrivee: "08:12", depart: "15:54" },
      { jour: "2026-11-18", arrivee: "08:00", depart: null },
      { jour: "2026-11-21", arrivee: "09:00", depart: "11:00" },
    ]);
    const response = await app.request("/semaines/2026-11-16", {
      headers: AUTHORIZED,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { jour: "2026-11-16", arrivee: "08:12", depart: "15:54" },
      { jour: "2026-11-17", arrivee: null, depart: null },
      { jour: "2026-11-18", arrivee: "08:00", depart: null },
      { jour: "2026-11-19", arrivee: null, depart: null },
      { jour: "2026-11-20", arrivee: null, depart: null },
      { jour: "2026-11-21", arrivee: "09:00", depart: "11:00" },
      { jour: "2026-11-22", arrivee: null, depart: null },
    ]);
  });

  it("lit le dépôt du lundi au dimanche de la semaine demandée", async () => {
    const { app, reads } = appWith();
    await app.request("/semaines/2026-11-16", { headers: AUTHORIZED });
    expect(reads).toEqual([["2026-11-16", "2026-11-22"]]);
  });
});

/** Les heures d'une journée complète, valides. */
const FULL_DAY = { arrivee: "08:30", depart: "17:00" };

describe("PUT /jours/:date", () => {
  it.each([
    ["complète", FULL_DAY],
    ["au départ seul", { arrivee: null, depart: "17:00" }],
  ])("crée une journée %s, que la semaine rend ensuite", async (_, hours) => {
    const { app } = appWith();
    const response = await put(app, "2026-11-18", hours);
    expect(response.status).toBe(204);
    expect(await weekOf(app, "2026-11-16")).toContainEqual({
      jour: "2026-11-18",
      ...hours,
    });
  });

  it("ignore les clés en plus des deux heures", async () => {
    const { app, writes } = appWith();
    const response = await put(app, "2026-11-18", { ...FULL_DAY, note: "x" });
    expect(response.status).toBe(204);
    expect(writes).toEqual([{ jour: "2026-11-18", ...FULL_DAY }]);
  });

  it("rend le même état quand le même PUT est rejoué", async () => {
    const { app } = appWith();
    expect((await put(app, "2026-11-18", FULL_DAY)).status).toBe(204);
    const once = await weekOf(app, "2026-11-16");
    expect((await put(app, "2026-11-18", FULL_DAY)).status).toBe(204);
    expect(await weekOf(app, "2026-11-16")).toEqual(once);
  });

  it("vide un jour rempli quand les deux heures sont null", async () => {
    const { app } = appWith([{ jour: "2026-11-18", ...FULL_DAY }]);
    const response = await put(app, "2026-11-18", {
      arrivee: null,
      depart: null,
    });
    expect(response.status).toBe(204);
    expect(await weekOf(app, "2026-11-16")).toContainEqual({
      jour: "2026-11-18",
      arrivee: null,
      depart: null,
    });
  });

  it("rend 401 sans jeton, sans rien écrire", async () => {
    const { app, writes } = appWith();
    const response = await put(app, "2026-11-18", FULL_DAY, {});
    expect(response.status).toBe(401);
    expect(writes).toEqual([]);
  });

  it.each([
    ["une date impossible", "2026-02-30", FULL_DAY],
    ["un corps non JSON", "2026-11-18", "arrivee=08:30&depart=17:00"],
    ["un corps null", "2026-11-18", null],
    ["un corps sans clé arrivee", "2026-11-18", { depart: "17:00" }],
    ["un corps sans clé depart", "2026-11-18", { arrivee: "08:30" }],
    [
      "une arrivée sur un chiffre",
      "2026-11-18",
      { ...FULL_DAY, arrivee: "8:30" },
    ],
    ["un départ à 24:00", "2026-11-18", { ...FULL_DAY, depart: "24:00" }],
    ["une arrivée en nombre", "2026-11-18", { arrivee: 830, depart: null }],
    ["un départ en nombre", "2026-11-18", { arrivee: null, depart: 1700 }],
    [
      "une arrivée en tableau",
      "2026-11-18",
      { arrivee: ["08:30"], depart: null },
    ],
    [
      "un départ égal à l'arrivée",
      "2026-11-18",
      { arrivee: "09:00", depart: "09:00" },
    ],
    [
      "un départ avant l'arrivée",
      "2026-11-18",
      { arrivee: "10:00", depart: "09:00" },
    ],
  ])("rend 400 pour %s, sans rien écrire", async (_, date, body) => {
    const { app, writes } = appWith();
    const response = await put(app, date, body);
    expect(response.status).toBe(400);
    expect(writes).toEqual([]);
  });

  it("contrôle la date avant de lire le corps", async () => {
    const response = await put(appWith().app, "2026-02-30", "pas du json");
    expect(await response.text()).toBe(
      "date invalide : attendu une date AAAA-MM-JJ",
    );
  });

  it.each([
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21",
    "2026-11-22",
  ])(
    "écrit une arrivée le %s, quel que soit le jour de la semaine",
    async (jour) => {
      const { app, writes } = appWith();
      const hours = { arrivee: "09:00", depart: null };
      const response = await put(app, jour, hours);
      expect(response.status).toBe(204);
      expect(writes).toEqual([{ jour, ...hours }]);
    },
  );
});
