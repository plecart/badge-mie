import { readFileSync } from "node:fs";
import semver from "semver";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

/** Les champs lus ici, dans `package.json`, `package-lock.json` ou `dependabot.yml`. */
type Loaded = {
  devEngines: { runtime: { version: string } };
  packages: Record<string, { version: string }>;
  updates: { "package-ecosystem": string; ignore?: unknown }[];
};

/** Lit et analyse un fichier JSON ou YAML relatif au dossier `.github/`. */
const load = (path: string) =>
  parse(readFileSync(new URL(path, import.meta.url), "utf8")) as Loaded;

/** La majeure minimale de Node qu'exige `devEngines.runtime` à la racine. */
const runtimeMajor = semver.minVersion(
  load("../package.json").devEngines.runtime.version,
)!.major;

describe("dependabot.yml — les refus, figés", () => {
  it("l'entrée npm ne refuse que les montées majeures de @types/node", () => {
    const npm = load("./dependabot.yml").updates.find(
      (u) => u["package-ecosystem"] === "npm",
    );
    expect(npm?.ignore).toEqual([
      {
        "dependency-name": "@types/node",
        "update-types": ["version-update:semver-major"],
      },
    ]);
  });
});

// La cause du refus, lue là où elle vit : chaque `@types/node` que le verrou installe, face à la
// majeure du runtime (raison et réexamen : commentaire de `dependabot.yml`).
describe("@types/node suit la majeure du runtime", () => {
  const installed = Object.entries(
    load("../package-lock.json").packages,
  ).filter(([path]) => path.endsWith("node_modules/@types/node"));
  it("le verrou en installe au moins un", () => {
    expect(installed).not.toHaveLength(0);
  });
  it.each(installed)("%s", (_path, { version }) => {
    expect(semver.major(version)).toBe(runtimeMajor);
  });
});
