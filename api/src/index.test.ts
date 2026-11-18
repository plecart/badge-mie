import { afterEach, describe, expect, it, vi } from "vitest";

const TOKEN = "jeton-de-test";
// Jamais contactée : le pool `pg` n'ouvre de connexion qu'à la première requête SQL.
const DATABASE_URL = "postgresql://localhost/badge-mie";

/** Importe l'entrée de la Function sous un environnement donné, à neuf. */
function start(env: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return import("./index");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("démarrage de la Function", () => {
  it.each([
    ["JETON_API", "absent", { JETON_API: undefined, DATABASE_URL }],
    ["JETON_API", "vide", { JETON_API: "", DATABASE_URL }],
    ["DATABASE_URL", "absent", { JETON_API: TOKEN, DATABASE_URL: undefined }],
  ])("refuse de démarrer avec %s %s", async (name, _, env) => {
    await expect(start(env)).rejects.toThrow(
      `variable d'environnement manquante : ${name}`,
    );
  });

  it("garde l'API par le jeton de JETON_API", async () => {
    const { default: app } = await start({ JETON_API: TOKEN, DATABASE_URL });
    const response = await app.request("/inconnue", {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(response.status).toBe(404);
  });
});
