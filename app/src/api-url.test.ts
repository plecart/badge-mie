import { afterEach, describe, expect, it, vi } from "vitest";

const PREPROD =
  "https://br-sweet-mouse-bhmcqyys-api.compute.c-10.eu-central-1.aws.neon.tech";
const PROD =
  "https://br-restless-boat-bhqb3o3o-api.compute.c-10.eu-central-1.aws.neon.tech";
const FORCED = "https://api-forcee.example.test";

/** Relit `api-url.ts` à neuf sous le `__DEV__` donné : la constante se calcule au chargement. */
async function loadApiUrl(dev: boolean): Promise<string> {
  vi.stubGlobal("__DEV__", dev);
  vi.resetModules();
  return (await import("./api-url")).API_URL;
}

describe("API_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe.each([
    ["absente", undefined],
    ["vide", ""],
  ])("EXPO_PUBLIC_API_URL %s", (_, value) => {
    it.each([
      ["la pré-prod dans le build de développement", true, PREPROD],
      ["la production dans l'APK de release", false, PROD],
    ])("vise %s", async (_, dev, expected) => {
      vi.stubEnv("EXPO_PUBLIC_API_URL", value);
      expect(await loadApiUrl(dev)).toBe(expected);
    });
  });

  it.each([
    ["de développement", true],
    ["de release", false],
  ])(
    "vise l'adresse que donne EXPO_PUBLIC_API_URL, même dans le build %s",
    async (_, dev) => {
      vi.stubEnv("EXPO_PUBLIC_API_URL", FORCED);
      expect(await loadApiUrl(dev)).toBe(FORCED);
    },
  );
});
