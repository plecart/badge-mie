import { describe, expect, it } from "vitest";
import type { PresenceDay } from "@badge-mie/week";
import { createApp } from "./app";

const TOKEN = "jeton-de-test";
const AUTHORIZED = { Authorization: `Bearer ${TOKEN}` };

/** Une application sur un dépôt factice qui rend `days` et note chaque plage lue. */
function appWith(days: PresenceDay[] = []) {
  const reads: [string, string][] = [];
  const app = createApp({
    token: TOKEN,
    repository: {
      readDays: async (from, to) => {
        reads.push([from, to]);
        return days;
      },
    },
  });
  return { app, reads };
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

  it("rend les 5 journées du lundi au vendredi, à null pour un jour sans ligne", async () => {
    const { app } = appWith([
      { jour: "2026-11-16", arrivee: "08:12", depart: "15:54" },
      { jour: "2026-11-18", arrivee: "08:00", depart: null },
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
    ]);
  });

  it("lit le dépôt du lundi au vendredi de la semaine demandée", async () => {
    const { app, reads } = appWith();
    await app.request("/semaines/2026-11-16", { headers: AUTHORIZED });
    expect(reads).toEqual([["2026-11-16", "2026-11-20"]]);
  });
});
