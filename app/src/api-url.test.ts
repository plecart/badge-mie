import { afterEach, describe, expect, it, vi } from "vitest";

const MAIN =
  "https://br-restless-boat-bhqb3o3o-api.compute.c-10.eu-central-1.aws.neon.tech";

/** Relit `api-url.ts` à neuf : la constante se calcule au chargement du module. */
async function loadApiUrl(): Promise<string> {
  vi.resetModules();
  return (await import("./api-url")).API_URL;
}

describe("API_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["absente", undefined],
    ["vide", ""],
  ])(
    "vise la Function de la branche main quand EXPO_PUBLIC_API_URL est %s",
    async (_, value) => {
      vi.stubEnv("EXPO_PUBLIC_API_URL", value);
      expect(await loadApiUrl()).toBe(MAIN);
    },
  );

  it("vise l'adresse que donne EXPO_PUBLIC_API_URL au lancement de Metro", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_URL", "https://qa-pointage.example.test");
    expect(await loadApiUrl()).toBe("https://qa-pointage.example.test");
  });
});
