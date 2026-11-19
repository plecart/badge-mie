/**
 * Exporte les icônes de l'app depuis leur source unique, `assets/icon.svg` (PRD #1, « Icône »).
 * Trois PNG, tous commités :
 * - l'icône d'application, `icon.png` : le motif sur le fond de l'icône adaptative, déclaré par
 *   `expo.icon` ;
 * - le premier plan de l'icône adaptative : le motif tel quel ;
 * - la couche monochrome des icônes à thème d'Android 13+ : le même motif, d'une seule couleur.
 *
 * Les deux derniers sont déclarés sous `android.adaptiveIcon` dans `app.json`.
 *
 * Lancé par `npm run icons -w app` : Node 24 exécute le TypeScript tel quel. Importé, le module
 * n'écrit rien ; ses tests rendent la source par {@link renderIcon}.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

/** Le côté des PNG exportés, en pixels : la taille que recommande Expo pour une icône. */
export const ICON_SIZE = 1024;

/** La couleur du motif dans la source : l'accent du thème clair. */
const ACCENT = "#2C6A54";

/** La couleur unie de la couche monochrome ; le lanceur la teinte selon le thème choisi. */
const MONOCHROME = "#000000";

/**
 * Rend un SVG carré en image de {@link ICON_SIZE} pixels de côté.
 *
 * Les polices du système ne sont pas chargées : le motif n'a pas de texte, et les charger ne
 * ferait que ralentir le rendu.
 *
 * @param svg - Le texte du SVG.
 * @returns L'image rendue : ses pixels RGBA, ou son encodage PNG par `asPng()`.
 */
export function renderIcon(svg: string) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: ICON_SIZE },
    font: { loadSystemFonts: false },
  }).render();
}

/**
 * Pose le motif sur un fond uni qui couvre tout le calque : l'icône d'application carrée, sans
 * transparence, que montrent les lanceurs sans icône adaptative et les outils d'Expo.
 *
 * @param svg - Le texte du SVG source, à fond transparent.
 * @param color - La couleur du fond, la même que celle de l'icône adaptative.
 * @returns Le SVG, un rectangle plein inséré sous le motif.
 */
export function withBackground(svg: string, color: string): string {
  return svg.replace(
    /<svg[^>]*>/,
    (open) => `${open}<rect width="100%" height="100%" fill="${color}"/>`,
  );
}

if (import.meta.main) {
  const asset = (name: string) => new URL(`../assets/${name}`, import.meta.url);
  const svg = readFileSync(asset("icon.svg"), "utf8");
  // Le fond vient d'`app.json`, seule source de la couleur de l'icône adaptative.
  const config = JSON.parse(
    readFileSync(new URL("../app.json", import.meta.url), "utf8"),
  );
  const background: string = config.expo.android.adaptiveIcon.backgroundColor;
  writeFileSync(
    asset("icon.png"),
    renderIcon(withBackground(svg, background)).asPng(),
  );
  writeFileSync(asset("icon-foreground.png"), renderIcon(svg).asPng());
  // ponytail: ne recolore que l'accent ; une seconde couleur ajoutée à la source garderait sa
  // teinte dans la couche monochrome, passer alors par un filtre feFlood + feComposite.
  writeFileSync(
    asset("icon-monochrome.png"),
    renderIcon(svg.replaceAll(ACCENT, MONOCHROME)).asPng(),
  );
}
