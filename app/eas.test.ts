import { readFileSync } from "node:fs";
import semver from "semver";
import { describe, expect, it } from "vitest";

/**
 * Lit un fichier JSON relatif à ce fichier de test.
 *
 * @param path chemin relatif au dossier `app/`
 * @returns le contenu analysé ; lève si le fichier manque ou n'est pas du JSON
 */
function readJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

/** L'exigence de runtime du workspace : `devEngines.runtime.version` du `package.json` racine. */
const required = (
  readJson("../package.json") as {
    devEngines: { runtime: { version: string } };
  }
).devEngines.runtime.version;

/** La configuration EAS : la source des numéros de version et les profils de build. */
const eas = readJson("./eas.json") as {
  cli: { appVersionSource: string };
  build: Record<string, { node?: string }>;
};

/** Les profils de build EAS, chacun avec sa version de Node éventuelle. */
const profiles = Object.entries(eas.build);

/** Le versionCode Android de la configuration Expo, absent tant qu'il n'est pas fixé. */
const { versionCode } = (
  readJson("./app.json") as { expo: { android: { versionCode?: number } } }
).expo.android;

/**
 * EAS Build installe tout le workspace depuis la racine (`npm ci`), où npm fait respecter
 * `devEngines.runtime`. L'image Android d'EAS porte Node 22, et EAS ne lit pas `devEngines` :
 * chaque profil fixe donc sa version de Node par son champ `node` (docs.expo.dev/eas/json),
 * seconde source que ce test tient alignée sur l'exigence de la racine — le jugement est celui
 * de `semver`, la bibliothèque même avec laquelle npm lit `devEngines`.
 */
describe("eas.json — la version de Node de chaque profil de build", () => {
  it("déclare au moins un profil", () => {
    expect(profiles).not.toEqual([]);
  });

  it.each(profiles)(
    "le profil « %s » fixe une version exacte qui satisfait devEngines",
    (_name, { node = "" }) => {
      expect(semver.valid(node)).not.toBeNull();
      expect(semver.satisfies(node, required)).toBe(true);
    },
  );
});

/**
 * En source locale, EAS Build construit le projet tel quel, sans écrire de numéro de version
 * (docs.expo.dev/build-reference/app-versions, « Local version source ») : sans
 * `android.versionCode`, l'APK porte 1, comme le build EAS 61984869 (`eas build:list`,
 * 2026-11-19), et Android refuse d'installer un APK de versionCode inférieur à celui en place
 * (developer.android.com/studio/publish/versioning, « Version settings »). Chaque APK distribué
 * fixe donc dans `app.json` un versionCode plus grand que celui de l'APK précédent.
 */
describe("eas.json — la source de version des builds", () => {
  it("est locale, et app.json fixe android.versionCode à un entier strictement positif", () => {
    expect(eas.cli.appVersionSource).toBe("local");
    expect(Number.isInteger(versionCode)).toBe(true);
    expect(versionCode).toBeGreaterThan(0);
  });
});
