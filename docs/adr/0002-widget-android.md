# ADR-0002 : Le widget Android avec `react-native-android-widget`

**Statut :** Accepté (2026-11-25)
**Date :** 2026-11-25
**Décideur :** la session PR de #20, voie T (`.claude/rules/contraintes.md`, « Règle d'or »), sur
la documentation officielle des deux bibliothèques et un essai sur l'émulateur

## Contexte

L'issue #20 ajoute un widget d'écran d'accueil Android de 2×1 cellules : 4×1 jusqu'au premier
arrêt visuel du 2026-11-25, puis 2×2, essayé jusqu'au second, le même jour (« Refonte du
widget »). L'issue #48 l'a reposé en 2×2, redimensionnable en hauteur (même section, quatrième
regard). Il montre sur une ligne une pastille d'envoi, l'arrivée et le départ du jour, et juste
en dessous le bouton de pointage. Le lanceur garde l'appui long
sur un widget : le bouton pointe donc en **deux touchers** (ADR-0001, « Propositions UX »). Le
premier l'arme pour 3 s, le second pointe, et sans second toucher le bouton revient **seul** à son
état normal. Le pointage suit le chemin de l'app : écriture locale à l'heure du téléphone, puis la
File d'envoi, avec le jeton gardé dans `expo-secure-store` (ADR-0001, « Décision », points 3 et 4).

Un widget embarque du code natif. Le développement quitte donc Expo Go pour un build de
développement (ADR-0001, « Décision », point 1).

L'issue demande de comparer deux bibliothèques sur trois points :

1. **pointer hors de l'app ouverte** : lire et écrire le stockage local, envoyer par la File
   d'envoi, lire le jeton dans `expo-secure-store` ;
2. **l'état armé et son retour seul** au bout de 3 s ;
3. **la mise à jour du widget depuis l'app**, après un pointage ou une correction.

Chaque affirmation de cet ADR porte sa provenance :

- **doc** : la documentation officielle, lue le 2026-11-24 et relue le 2026-11-25, URL citée ;
- **source** : le code du paquet installé (`node_modules/react-native-android-widget`, 0.26.0), lu
  le 2026-11-25 ;
- **essai** : la mesure décrite dans la section « Essai sur l'émulateur ».

Les pages de `react-native-android-widget` sont sous
`https://saleksovski.github.io/react-native-android-widget/docs/`, abrégé `rnaw/` ci-dessous. La
page d'`expo-widgets` est `https://docs.expo.dev/versions/latest/sdk/widgets/`.

## Décision

1. **`react-native-android-widget`** (0.26.0, licence MIT) porte le widget. Son plugin Expo le
   déclare dans `app/app.json` : un widget `Today`, 2×2, redimensionnable en hauteur, rafraîchi
   toutes les 30 min (issue #48 ; 2×1 non redimensionnable avant). Le test `app/app.test.ts`
   épingle cette déclaration.
   - `targetCellWidth` 2 et `targetCellHeight` 2 fixent la taille posée sur Android 12 et plus.
   - `resizeMode` `vertical` laisse l'utilisateur l'étirer ou le réduire en hauteur seulement ; la
     largeur reste 2 cases. Le plugin n'expose pas `minResizeHeight` (source :
     `lib/typescript/config-plugin.type.d.ts`), et la hauteur minimale de redimensionnement vaut
     alors `minHeight` : le widget se réduit jusqu'à une rangée. Un widget déjà posé garde sa
     taille à la mise à jour de l'app.
   - `minWidth` 110dp et `minHeight` 40dp fixent la taille posée sur Android 11 et moins : 2×1,
     étirable en hauteur comme ailleurs. Sur un écran de
     5×4 cellules, la largeur de `n` cellules en portrait vaut `73n − 16` dp et la hauteur de `m`
     cellules en paysage `66m − 15` dp ; `minWidth` se prend en portrait et `minHeight` en paysage
     (doc : developer.android.com/develop/ui/views/appwidgets/layouts, « Determine a size for
     your widget », lu le 2026-11-25). 110dp dépasse une cellule de large (57dp) sans dépasser
     deux (130dp), et 40dp tient dans une de haut (51dp).
   - `updatePeriodMillis` vaut 1 800 000 ms, le plancher : une mise à jour périodique « will not
     be delivered more than once every 30 minutes » (doc : `rnaw/update-widget`), et le plugin
     relève toute valeur plus basse à 30 min (source : `app.plugin.js`, `Math.max`).
2. **Le développement passe sur un build `expo-dev-client`**, construit sur le poste par
   `npm run android -w app` (`expo run:android`) et installé sur l'émulateur d'Android Studio.
   `app/eas.json` ne reçoit aucun profil : EAS ne construit que l'APK d'une release (ADR-0001,
   « Décision », point 1).
3. **Le double toucher tient dans une seule invocation du gestionnaire de tâche** : rendu armé,
   attente de 3 s, rendu au repos. C'est l'essai qui l'établit, la documentation n'en dit rien.
   Depuis la refonte du widget, l'attente se découpe en cadres redessinés à chaque changement du
   chiffre du décompte (« Refonte du widget »).

## Options étudiées

### A. `react-native-android-widget` — retenue

| Point | Ce qu'en disent la doc, la source et l'essai |
|---|---|
| Pointer hors de l'app ouverte | Le gestionnaire de tâche est une fonction asynchrone, `WidgetTaskHandler = (props) => Promise<void>`, enregistrée dans le fichier d'entrée de l'app (doc : `rnaw/public-api`, `rnaw/tutorial/register-task-handler`). Android l'exécute en tâche JS sans écran (*headless*), lancée par WorkManager, avec un délai de 30 s (source : `RNWidgetBackgroundTaskWorker.java`, `HeadlessJsTaskConfig(…, 30 * 1000, …)` ; CHANGELOG 0.11.0, « Increased background task timeout to 30s »). Le bundle JS est celui de l'app : le gestionnaire importe ses modules, sans copie. Lecture et écriture d'AsyncStorage dans le gestionnaire, lecture d'`expo-secure-store` : **essai**. Envoi : non mesuré, aucun jeton n'étant saisi en développement. Le processus de l'app vivant, la tâche tourne dans son contexte JS : elle reprend le `ReactHost` de l'application et son contexte courant (source : `HeadlessJsTaskWorker.java`, `getReactHost`). |
| L'état armé et son retour seul | `renderWidget` redessine le widget (doc : `rnaw/public-api`). Deux rendus dans une même invocation, séparés par une attente : ni la doc ni le CHANGELOG n'en parlent, **essai**. |
| La mise à jour depuis l'app | `requestWidgetUpdate({ widgetName, renderWidget })`, appelable depuis l'app (doc : `rnaw/api/request-widget-update`). |
| Thème clair ou sombre | `renderWidget({ light, dark })` : « The host system will choose the appropriate one », les deux arbres ayant la même structure (doc : `rnaw/tutorial/dark-mode-widget`). |

**Pour :** du JS asynchrone au toucher, dans le bundle de l'app, ce qui donne au widget la logique
de pointage, la File d'envoi et le coffre du jeton sans les recopier ; les palettes claire et
sombre rendues ensemble ; un plugin Expo.
**Contre :** une dépendance compilée, en 0.x, d'un seul mainteneur (`npm view … maintainers`,
relevé le 2026-11-25). Le widget est dessiné en image, à la taille exacte que l'on doit connaître
(doc : `rnaw/limitations`). Ses composants ne prennent ni hooks ni rendu asynchrone (doc :
`rnaw/tutorial/widget-design`).

### B. `expo-widgets` (58.0.29, option `enableAndroid`)

| Point | Ce qu'en dit la doc |
|---|---|
| Pointer hors de l'app ouverte | La fonction du widget « cannot perform asynchronous work, import other modules, or access your app's runtime or in-memory state » (doc : section « The 'widget' directive ») : ni stockage, ni coffre, ni envoi. `addUserInteractionListener` « only fires while the app process is alive » (section « Interactive widgets »). |
| L'état armé et son retour seul | Le `onPress` d'un bouton rend les nouvelles propriétés du widget, sans processus de l'app, mais « Interactive widgets require iOS 17 or later » (section « Interactive widgets »). Les chronologies (`updateTimeline`) sont « available only on iOS » (section « Android widgets »). Rien ne programme un retour seul sur Android. |
| La mise à jour depuis l'app | `updateSnapshot` (section « Android widgets »). |
| Thème clair ou sombre | « The environment argument provides only colorScheme on Android » (section « Android widgets »). |

**Pour :** maintenue par Expo, alignée sur chaque SDK ; une seule API pour Android et iOS.
**Contre :** le runtime du widget ne fait aucun travail asynchrone, ce qui exclut le pointage
hors de l'app ouverte, raison d'être du widget.

## Analyse des compromis

- **Ce qui a fait pencher la balance : le point 1.** Pointer depuis le widget, c'est lire le
  stockage, écrire le jour, lire le jeton et envoyer, quatre opérations asynchrones. La
  documentation d'`expo-widgets` les exclut ; celle de `react-native-android-widget` les permet, et
  l'essai le confirme pour le stockage. Le point 2 aurait suffi à départager : seule
  `react-native-android-widget` sait faire revenir le bouton seul, et c'est l'essai qui le montre.
- **Âge et entretien.** Le paquet est publié sur npm depuis le 2023-01-09, en 52 versions, dont
  la 0.26.0 le 2026-10-29, « Compatibility with Expo 58 » (CHANGELOG). Le dépôt GitHub
  `sAleksovski/react-native-android-widget` n'est pas archivé ; son dernier envoi date du
  2026-11-22 ; il compte 900 étoiles et 3 issues ou PR ouvertes (`gh api`, relevé le 2026-11-25
  à 13 h). Le paquet a été téléchargé 232 264 fois la semaine du 2026-11-18 au 2026-11-24
  (`api.npmjs.org`, même relevé). Ces trois chiffres sont une population vivante : ils décrivent
  l'état au relevé, pas une garantie.
- **Le risque d'une dépendance compilée.** Chaque montée du SDK Expo attend la version de la
  bibliothèque qui le prend en charge, comme la 0.26.0 pour le SDK 58. Elle n'est pas dans la
  table des versions d'Expo (`expo/bundledNativeModules.json`) : Dependabot la propose donc, et
  la CI la juge comme toute dépendance.
- **Le successeur possible : `expo-widgets`.** Le jour où son runtime Android saura faire un
  travail asynchrone au toucher sans le processus de l'app, il remplacera cette bibliothèque
  sans dépendance tierce. À réexaminer à chaque montée du SDK Expo.

## Essai sur l'émulateur

**Résultat : positif.** Le widget revient seul à son état normal, et le repli verrouillé de
l'issue ne s'applique pas (brief de #20, « Décisions verrouillées ») : l'état armé qui expire
quand même au bout de 3 s, un toucher plus tard réarmant au lieu de pointer ; « Confirmer … »
affiché jusqu'au toucher suivant ou au prochain rafraîchissement ; pas de refus bref.

**Conditions.** Essai du 2026-11-25 :

- AVD `Medium_Phone` de l'émulateur d'Android Studio : Android 16 (API 36), 1080×2400, 420 dpi.
- Build de développement construit par `npm run android -w app` depuis un worktree du dépôt à
  racine courte (voir « Conséquences »).
- Code d'essai jetable, jamais versionné. Le widget affiche « Repos » ou « Armé » et un compteur.
  À chaque toucher, le gestionnaire lit le compteur dans AsyncStorage et y écrit sa valeur plus
  un. Il dessine ensuite l'état armé, attend 3 s (`await` d'une promesse sur `setTimeout`), puis
  dessine le repos.
- Chaque étape écrit un horodatage dans le journal (`adb logcat`, étiquette `ReactNativeJS`).
  Les captures viennent d'`adb exec-out screencap -p`.
- Le widget, alors déclaré en 4×1, a été posé par `requestPinWidget`. Le lanceur l'a annoncé
  « 4 × 1 », et `widgetInfo` lui donne 360×109 dp.
- Aucun jeton n'a été saisi, et l'adresse de l'API visait `http://127.0.0.1:9`.

**Mesures :**

- **Le toucher redessine le widget.** « Armé · 1 » est affiché sur la capture prise entre 0,7 s
  et 1,2 s après le toucher.
- **Le retour seul, dans la même invocation.** « Repos · 1 » est affiché sur la capture prise
  4 s après le toucher, sans nouveau toucher. Sur six invocations, le second rendu a suivi l'état
  armé de 3,003 à 3,012 s.
- **AsyncStorage, lu et écrit dans le gestionnaire.** Le compteur est passé de 0 à 6, une unité
  par toucher. Il a survécu à deux arrêts du processus de l'app (`adb shell am kill`).
- **La latence.** Elle est mesurée en build de développement, sur l'horloge de l'émulateur.
  Processus de l'app vivant : 0,08 s du toucher au rendu armé. Processus arrêté : 2,1 s, qui
  comprennent le démarrage de React (source : `HeadlessJsTaskWorker.java`, `reactHost.start()`).
  C'est un ordre de grandeur, qui varie avec le poste. Le délai de 3 s se compte donc à partir du
  rendu armé, comme le veut l'issue, et non à partir du toucher.
- **Deux touchers à moins de 3 s.** Deux touchers à 1,1 s d'écart ont lancé deux invocations, qui
  ont tourné en même temps. Le retour au repos de la première a effacé l'état armé de la seconde,
  1,1 s avant la fin de sa fenêtre. Le gestionnaire réel ne revient donc au repos que si
  l'armement qu'il a posé est toujours le dernier.

**Le gestionnaire réel**, mesuré le même jour sur le même AVD, sans jeton saisi, l'adresse de
l'API sur `http://127.0.0.1:9`, par une sonde de journal jetable, jamais versionnée :

- **`expo-secure-store` se lit dans le gestionnaire.** `getItemAsync` a rendu `null`, sans
  erreur, le processus de l'app vivant comme après un redémarrage de l'émulateur, où la tâche
  `WIDGET_UPDATE` a tourné sans que l'app s'ouvre. Le widget a dessiné « Ouvrir l'app ».
- **La durée d'une tâche de dessin**, du début du gestionnaire à sa fin : 15 à 64 ms le processus
  vivant, 199 et 341 ms dans un processus neuf, après un arrêt forcé puis après le redémarrage.
  C'est un ordre de grandeur. Celle d'une tâche de pointage n'est pas mesurée : il y faut un
  jeton.

## Refonte du widget

Trois regards du mainteneur, le 2026-11-25, l'ont refait le même jour (issue #20, « Décisions ») :

1. le premier : un 2×2, les heures au-dessus du bouton, sous des libellés courts (« Badger »,
   « Confirmer »), et un armement animé : transition du bouton plein au bouton inversé, puis une
   bande qui se vidait derrière le libellé pendant les 3 s ;
2. le second : le 2×2, jugé trop gros, devient un 2×1, les heures sur une ligne et le bouton,
   rectangulaire, juste en dessous ; la bande, essayée, est retirée, et un petit chiffre dans un
   coin du bouton décompte les secondes qui restent, 3, 2, 1 ;
3. le troisième : le 2×1 est validé ; la transition, essayée, est retirée, jugée trop saccadée :
   le bouton passe d'un coup aux couleurs inversées, et le chiffre reste.

Un quatrième regard, le 2026-11-25 sur l'APK 1.1.0 (issue #48, « Décisions ») : sur le téléphone
du mainteneur, une rangée fait moins de 86 dp, et le 2×1 n'y montre que le bouton, la ligne des
heures retirée. Le 2×2, jugé trop gros sur l'émulateur où une rangée faisait 109 dp, devient le
bon format sur un lanceur réel aux rangées plus basses : le widget se pose en 2×2 et s'étire ou se
réduit à la main en hauteur, jusqu'à une rangée. La mise en page ne change pas : le bouton prend
toute la hauteur sous les heures.

Les mesures de l'essai ci-dessus, faites sur le 4×1, restent vraies, et celles du 2×2 et du 2×1
ci-dessous aussi : elles décrivent ce qui a été essayé.

Un widget ne joue pas d'animation : le gestionnaire redessine l'état armé cadre par cadre, à
l'instant de l'horloge, et relit la phase rangée avant chacun pour céder la main à un autre
toucher. Depuis le troisième regard, il dessine l'état armé à son affichage, puis à chaque
changement du chiffre, à 1 s et à 2 s (`FRAME_MS`) : 3 cadres en 3 s, contre 7 avec la transition
(toutes les 100 ms pendant ses 400 ms) et 30 avec la bande. Les 3 s comptent depuis le premier
cadre. Le cadre de mi-transition, le seul dont le contraste descendait sous 4,5:1 (mesures du 2×1
ci-dessous), disparaît avec elle : dès le premier cadre, le libellé et le chiffre ont 6,37:1 en
clair et 10,16:1 en sombre sur le bouton armé.

Le bouton s'arrondit en concentrique au widget : son rayon est celui du widget, 22 dp, moins la
marge, 10 dp, soit 12 dp. C'est la règle des arrondis imbriqués (doc Android, page Glance
« Implement rounded corners » : « calculate a proportional radius for your inner content »,
formule `systemRadiusValue - widgetPadding`,
developer.android.com/develop/ui/compose/glance/create-app-widget, lue par la session de la PR le
2026-11-25), essayée en direct et validée au troisième regard.

Les hauteurs du widget suivent celle que donne le lanceur (`widgetLayout`). Avant, 68 dp fixes
au-dessus du bouton (marges, ligne des heures, écart) lui laissaient la hauteur moins 68 dp : rien
sous 68 dp, −17 dp sur une cellule de 51 dp. Désormais, la ligne des heures garde ses titres tant
que le bouton garde 32 dp, puis les perd, puis disparaît, la marge se resserrant au besoin : le
bouton garde au moins 32 dp sur toute hauteur d'au moins 40 dp, la hauteur minimale déclarée.
Cela donne 41 dp sur le 2×1 de 109 dp et 33 dp sur 51 dp. 32 dp, c'est ce que laissent ces 40 dp
sous une marge de 4 dp en haut et en bas.

**Mesures du 2×2, avec la bande**, le 2026-11-25 sur le même AVD, processus de l'app vivant, un
cadre toutes les 100 ms pendant les 3 s, par une sonde de journal jetable et par
`adb shell screenrecord`, ni l'une ni l'autre versionnées. Ce sont des ordres de grandeur, qui
varient avec le poste :

- **La taille.** Le lanceur Pixel annonce « 2 × 2 », et `widgetInfo` donne 172×234 dp en portrait.
- **Le dessin natif limite la cadence.** Chaque cadre rend deux images, claire et sombre, puis
  les écrit en PNG (source : `RNWidget.java`, `drawWidget`) : 84 à 130 ms par cadre, 105 ms en
  médiane, sur 25 cadres. Les cadres partent toutes les 117 ms en médiane, soit 25 cadres armés
  en 3 s, environ 8 par seconde. Un intervalle plus court empilerait des dessins que le natif ne
  suit pas.
- **À l'écran**, filmé : 20 images armées en 3,08 s, espacées de 100 à 186 ms (164 ms en médiane,
  environ 6 par seconde), dont 4 pour la transition. Le film charge lui-même l'émulateur : pendant
  qu'il tourne, les cadres partent toutes les 153 à 163 ms en médiane.
- **La relecture de la phase** avant chaque cadre prend 1 ms en médiane (0 à 28 ms), sans film.
- **Le retour au repos** suit le premier cadre armé de 3,03 à 3,08 s (deux films).
- **Le libellé ne se mélange pas.** Mélangés, libellé et fond se rejoignent à mi-transition : sur
  un cadre filmé, « Confirmer » s'y effaçait. Le libellé change donc de couleur d'un coup, à
  mi-chemin, ce qui lui garde un contraste d'environ 2,5:1 sur ce seul cadre, dans les deux thèmes
  (calcul sur les palettes).
- **Les libellés tiennent sur une ligne.** Aux métriques des polices, « Journée terminée »
  (171 dp à 20 sp) et « Départ trop tôt » (141 dp) dépassent les 132 dp du bouton : l'ajustement
  uniforme d'Android (`adjustsFontSizeToFit`) les réduit, et c'est ce que montre l'émulateur.
- **En paysage**, avec la rotation de l'écran d'accueil permise (réglage du lanceur, rendu à son
  état ensuite), la cellule mesure 332×137 dp (`dumpsys activity top`). Le lanceur ne redessine
  pas le widget à la rotation : il réduit l'image du portrait dans la cellule, proportions
  gardées, sans débordement. Les zones touchables, calées sur le portrait, s'y écrasent, et la
  bibliothèque ignore un toucher d'une taille périmée jusqu'au dessin suivant (source :
  `RNWidgetProvider.java`, `hasOutdatedSize`) : en paysage, un toucher reste sans effet jusqu'à la
  prochaine mise à jour. Un dessin à 332×137 dp donnerait 53 dp au bouton et 52 aux heures
  (calcul) : la hauteur du bouton suit l'espace réel.

**Mesures du 2×1, avec le chiffre**, le même jour sur le même AVD, sans sonde, par
`adb shell screenrecord` et `uiautomator dump` :

- **La taille.** Le lanceur annonce « 2 × 1 », et sa vue hôte mesure 172×109 dp : le bouton y a
  152×41 dp, la ligne des heures 42 dp.
- **Les cadres à l'écran.** Après le premier cadre armé, trois images de transition, puis le
  chiffre passe à 2 et à 1 à 0,94–0,97 s et 1,94–1,96 s du premier cadre affiché, et le repos
  revient à 2,92–3,03 s (deux films, clair et sombre).
- **Les libellés tiennent sur une ligne.** Aux métriques des polices, « Journée terminée »
  (171 dp à 20 sp) et « Départ trop tôt » (141 dp) dépassent les 136 dp du bouton, réduits par
  l'ajustement uniforme d'Android ; vus tous deux sur l'émulateur, par une sonde jetable qui
  relibellait les cadres armés. Les titres (« ARRIVÉE » : 41 dp, « DÉPART » : 39 dp) et les heures
  (« 08:52 » : 55 dp) tiennent dans leurs cases, de 57 dp au plus étroit.
- **Le contraste du chiffre**, de la couleur du libellé (calcul sur les palettes) : 6,37:1 en
  clair et 10,16:1 en sombre sur le bouton armé, 14,19:1 et 12,64:1 sur le bouton grisé d'un jour
  non travaillé. Pendant la transition seulement, le cadre du milieu descend à 2,85:1 en clair et
  3,01:1 en sombre, pour le chiffre comme pour le libellé.

## Conséquences

**Plus simple :**

- Le widget appelle la logique de pointage, la File d'envoi et le coffre du jeton de l'app : un
  seul chemin d'écriture.
- Ses couleurs viennent des palettes de l'app, rendues en clair et en sombre par un seul appel.

**Plus difficile :**

- L'app ne tourne plus dans Expo Go. Le développement demande un build natif sur le poste
  (Gradle, un JDK 17 ou plus, le SDK Android) et l'émulateur d'Android Studio. Un changement natif
  (une dépendance compilée, une option de plugin) se reconstruit par `npm run android -w app`.
- Sous Windows, ce build dépasse les limites de longueur de chemin. Le C++ généré des
  bibliothèques natives donne des objets dont le chemin reprend deux fois la racine du dépôt.
  - Mesuré le 2026-11-25 : 288 caractères pour un fichier et 261 pour un dossier, même depuis une
    racine de 5 caractères. Windows plafonne un dossier à 248 caractères.
  - Le plugin `app/plugins/with-cmake-object-path-max.ts` fait raccourcir ces chemins par CMake.
    Avec lui, le build aboutit depuis la racine courte de l'essai.
  - Avec lui, le build aboutit aussi depuis la racine de 60 caractères d'un worktree de
    `.claude/worktrees/` (mesuré le 2026-11-25, sur l'ABI de l'émulateur). CMake y avertit qu'un
    objet de `@react-native-community/datetimepicker` « cannot be safely placed » sous son dossier
    de 194 caractères, sans faire échouer le build. La ligne `run local` de
    `.claude/pipeline.config.md` tient la mesure à jour.
- Une montée du SDK Expo attend la version de `react-native-android-widget` qui le suit.
- Le décompte de l'armement redessine toute l'image à chaque seconde (« Refonte du widget ») : un
  téléphone plus lent affichera chaque chiffre plus tard, le délai de 3 s restant compté à
  l'horloge.

**À revoir si le besoin change :**

- `expo-widgets`, quand son runtime Android fera du travail asynchrone au toucher.
