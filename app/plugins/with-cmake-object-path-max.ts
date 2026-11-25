/**
 * Config plugin Expo : borne à 250 caractères le chemin complet de chaque objet C++ que CMake
 * compile pour le build Android, sans quoi le build échoue sous Windows.
 *
 * Les bibliothèques à composant natif (`react-native-safe-area-context`…) font compiler leur code
 * généré par le CMake de l'app. Ce code vit hors de l'arborescence CMake : le nom de chaque objet
 * reprend donc le chemin absolu de sa source, et la racine du dépôt y figure deux fois. Mesuré le
 * 2026-11-25 sur le poste : 288 caractères pour le plus long objet et 261 pour son dossier, même
 * depuis une racine de 5 caractères (`E:\bm`). Windows refuse un dossier de plus de 248 caractères
 * (« MAX_PATH minus 12 », learn.microsoft.com/windows/win32/fileio/maximum-file-path-limitation),
 * et le `ninja` 1.10.2 du SDK un chemin de plus de 260.
 *
 * `CMAKE_OBJECT_PATH_MAX` fait raccourcir par CMake, en le remplaçant par une empreinte, tout
 * chemin d'objet qui dépasse la limite (doc du CMake 3.22.1 du SDK,
 * `Help/variable/CMAKE_OBJECT_PATH_MAX.rst`). À 250, un objet tient sous les 260 d'un fichier, et
 * son dossier sous les 248. Le plugin Gradle de React Native ajoute ses propres arguments à la même
 * liste, `defaultConfig.externalNativeBuild.cmake.arguments` (`NdkConfiguratorUtils.kt`).
 */

import { type ConfigPlugin, withAppBuildGradle } from "expo/config-plugins";

/** L'argument que reçoit CMake. */
export const CMAKE_ARGUMENT = "-DCMAKE_OBJECT_PATH_MAX=250";

/** Le début du bloc `defaultConfig` d'un `app/build.gradle`. */
const DEFAULT_CONFIG = /defaultConfig\s*\{/;

/**
 * Ajoute l'argument CMake au bloc `defaultConfig`, une seule fois.
 *
 * @param gradle le contenu d'`android/app/build.gradle`
 * @returns ce contenu, l'argument ajouté s'il manquait
 * @throws si le fichier n'a pas de bloc `defaultConfig` : le build échouerait plus loin, sur un
 *   chemin trop long, sans dire pourquoi
 */
export function addCmakeArgument(gradle: string): string {
  if (gradle.includes(CMAKE_ARGUMENT)) return gradle;
  if (!DEFAULT_CONFIG.test(gradle)) {
    throw new Error("android/app/build.gradle n'a pas de bloc defaultConfig");
  }
  return gradle.replace(
    DEFAULT_CONFIG,
    (block) =>
      `${block}\n        externalNativeBuild { cmake { arguments "${CMAKE_ARGUMENT}" } }`,
  );
}

const withCmakeObjectPathMax: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (gradle) => {
    gradle.modResults.contents = addCmakeArgument(gradle.modResults.contents);
    return gradle;
  });

export default withCmakeObjectPathMax;
