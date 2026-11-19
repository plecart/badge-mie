/**
 * Exporte l'icône adaptative Android depuis sa source unique, `assets/icon.svg` (PRD #1,
 * « Icône ») : le premier plan tel quel, et la couche monochrome des icônes à thème d'Android 13+,
 * le même motif d'une seule couleur. Les deux PNG sont commités ; `app.json` les déclare sous
 * `android.adaptiveIcon`.
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

if (import.meta.main) {
  const asset = (name: string) => new URL(`../assets/${name}`, import.meta.url);
  const svg = readFileSync(asset("icon.svg"), "utf8");
  writeFileSync(asset("icon-foreground.png"), renderIcon(svg).asPng());
  // ponytail: ne recolore que l'accent ; une seconde couleur ajoutée à la source garderait sa
  // teinte dans la couche monochrome, passer alors par un filtre feFlood + feComposite.
  writeFileSync(
    asset("icon-monochrome.png"),
    renderIcon(svg.replaceAll(ACCENT, MONOCHROME)).asPng(),
  );
}
