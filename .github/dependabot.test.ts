import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import semver from "semver";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

/** Une entrée `packages` de `package-lock.json`. */
type Lock = { version: string; peerDependencies?: Record<string, string> };

/** Les champs lus ici, dans un `package.json`, `package-lock.json` ou `dependabot.yml`. */
type Loaded = {
  devEngines: { runtime: { version: string } };
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  packages: Record<string, Lock>;
  updates: { "package-ecosystem": string; ignore?: unknown }[];
};

/** Lit et analyse un fichier JSON ou YAML relatif au dossier `.github/`. */
const load = (path: string) =>
  parse(readFileSync(new URL(path, import.meta.url), "utf8")) as Loaded;

const lock = load("../package-lock.json").packages;
const app = load("../app/package.json");

/** La table des versions que le SDK Expo de l'app impose, résolue depuis `app/`. */
const expoTable: Record<string, string> = createRequire(
  new URL("../app/package.json", import.meta.url),
)("expo/bundledNativeModules.json");

/** Les dépendances de l'app dont le SDK Expo fixe la version. */
const expoManaged = Object.keys({ ...app.dependencies, ...app.devDependencies })
  .filter((name) => name in expoTable)
  .sort();

/** La majeure minimale de Node qu'exige `devEngines.runtime` à la racine. */
const runtimeMajor = semver.minVersion(
  load("../package.json").devEngines.runtime.version,
)!.major;

describe("dependabot.yml — les refus, figés", () => {
  it("l'entrée npm refuse ces majeures et toute montée d'une dépendance fixée par Expo", () => {
    const npm = load("./dependabot.yml").updates.find(
      (u) => u["package-ecosystem"] === "npm",
    );
    const major = ["version-update:semver-major"];
    expect(npm?.ignore).toEqual([
      { "dependency-name": "@types/node", "update-types": major },
      { "dependency-name": "typescript", "update-types": major },
      ...expoManaged.map((name) => ({ "dependency-name": name })),
    ]);
  });
});

// Les causes des refus, lues là où elles vivent (raison et réexamen : commentaires de
// `dependabot.yml`).
describe("@types/node suit la majeure du runtime", () => {
  const installed = Object.entries(lock).filter(([path]) =>
    path.endsWith("node_modules/@types/node"),
  );
  it("le verrou en installe au moins un", () => {
    expect(installed).not.toHaveLength(0);
  });
  it.each(installed)("%s", (_path, { version }) => {
    expect(semver.major(version)).toBe(runtimeMajor);
  });
});

describe("typescript-eslint n'accepte pas encore la majeure suivante de typescript", () => {
  it("sa plage de pairs exclut la majeure au-dessus de celle installée", () => {
    const next = `${semver.major(lock["node_modules/typescript"].version) + 1}.0.0`;
    const peer =
      lock["node_modules/typescript-eslint"].peerDependencies!.typescript;
    expect(semver.satisfies(next, peer)).toBe(false);
  });
});

describe("les dépendances fixées par Expo sont à la version de sa table", () => {
  it("l'app en déclare au moins une", () => {
    expect(expoManaged).not.toHaveLength(0);
  });
  it.each(expoManaged)("%s", (name) => {
    const { version } =
      lock[`app/node_modules/${name}`] ?? lock[`node_modules/${name}`];
    expect(semver.satisfies(version, expoTable[name])).toBe(true);
  });
});
