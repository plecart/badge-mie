import { describe, expect, it } from "vitest";
import { createApp } from "./app";

const TOKEN = "jeton-de-test";
const AUTHORIZED = { Authorization: `Bearer ${TOKEN}` };

const app = createApp({ token: TOKEN });

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
    const response = await app.request("/semaines/2026-11-16", { headers });
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("rend 401 sur une route inconnue sans jeton", async () => {
    const response = await app.request("/inconnue");
    expect(response.status).toBe(401);
  });

  it("laisse passer le bon jeton : une route inconnue rend alors 404", async () => {
    const response = await app.request("/inconnue", { headers: AUTHORIZED });
    expect(response.status).toBe(404);
  });
});
