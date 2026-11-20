# Archive — raisonnement du PRD #1 (Badge Mie)

> **Non normatif.** Ce fichier garde le raisonnement et les options écartées lors de la rédaction
> du PRD (issue #1, label `prd`). Rien ne s'y décide : le PRD et l'ADR-0001 font foi.

**Date :** 2026-11-18 · **Décideur :** le mainteneur · **Session :** `vers-prd`

## Points tranchés par le mainteneur

Les quatre points ont été présentés en une fois, avec une recommandation chacun. Le mainteneur a
retenu les quatre recommandations.

| Point | Retenu | Écarté | Pourquoi |
|---|---|---|---|
| Modules et tests | 6 modules ; tests Vitest sur Calendrier de semaine, Pointage du jour, File d'envoi, API Données ; écrans validés à l'œil | tests de composants React Native (jest-expo + Testing Library) | un second lanceur de tests et du code de plus pour des écrans qui passent de toute façon par l'arrêt visuel |
| Total et flèches (prototype « Pouce ») | les deux | total seul ; ni l'un ni l'autre | le total est une somme ; les flèches sont le seul moyen de corriger un vendredi oublié une fois le lundi venu, et `GET /semaines/:lundi` sert déjà toute semaine |
| Icône | badge d'accès stylisé, vert `#2C6A54` sur fond clair, SVG versionné, PNG exportés par script | cadran d'horloge ; image fournie par le mainteneur | motif propre à l'usage (badger), palette du prototype, source modifiable dans le dépôt |
| Premier lancement et indicateur d'envoi | écran du jeton à un champ, validé par une lecture de la semaine, retour à cet écran sur 401 ; point vert « Enregistré » / orange « En attente d'envoi (n) » | point seul, sans texte ; écran de réglages pour changer le jeton | le 401 couvre la rotation du jeton sans écran de plus ; le texte dit ce que le point veut dire |

## Décisions techniques (voie T)

- **« Effacer » par le bouton neutre du sélecteur natif.** Le prototype utilise une feuille HTML
  avec « Effacer » ; sur Android, le sélecteur natif de `@react-native-community/datetimepicker`
  offre un bouton neutre (`neutralButton`, `onNeutralButtonPress`) — ce qui garde le sélecteur
  natif voulu par l'ADR sans feuille sur mesure.
- **Retour du réseau par `expo-network`** (`Network.addNetworkStateListener`) plutôt que
  `@react-native-community/netinfo` : un paquet Expo, même besoin couvert.
- **File regroupée par date** : un `PUT` porte l'état complet du jour ; deux modifications en
  attente du même jour ne font qu'un envoi. Découle de l'idempotence du `PUT` fixée par l'ADR.
- **« Annuler » pendant 5 s** : précision de « quelques secondes » (ADR-0001, « Propositions UX »),
  durée du prototype.

## Provenance des vérifications

context7 a rendu « Monthly quota exceeded » le 2026-11-18 ; les points de bibliothèque ont été lus
à la source le même jour :

- docs.expo.dev, guide « Splash screen and app icon » : clés `android.adaptiveIcon`
  (`foregroundImage`, `backgroundColor`, `backgroundImage`, `monochromeImage`).
- developer.android.com, « Adaptive icons » : calques de 108 × 108 dp, zone sûre de 66 × 66 dp,
  couche monochrome pour les icônes à thème (Android 13+).
- README de `react-native-datetimepicker/datetimepicker` : `neutralButton`, `is24Hour`,
  `DateTimePickerAndroid.open` recommandé sur Android, paquet intégré à Expo Go.
- docs.expo.dev, `expo-network` : `addNetworkStateListener`, `useNetworkState`, champs
  `isConnected` et `isInternetReachable`.

## Amendements

### 2026-11-19 — « Décisions de test » : le délai maximal des requêtes se teste (#14, PR #16)

**Décideur :** le mainteneur · **Session :** session PR de #14, `contradiction`

- **Contradiction.** Le PRD disait « Non testés unitairement : […] l'adaptateur mince du client
  API et du coffre ». Le critère v3 de #14 demande de tester le délai maximal de 10 s sur la
  lecture d'une semaine et l'écriture d'un jour, temps simulé.
- **Options.** (1a) Ne pas tester le délai : il ne se vérifierait qu'à l'œil, et le mode avion ne
  le reproduit pas, `fetch` y échouant aussitôt. (1b) Tester seule une fonction qui pose le
  signal : le PRD reste vrai, mais la levée de « serveur injoignable » au délai ne se vérifie
  qu'à la lecture. (2) Amender le PRD.
- **Retenu : (2).** Le délai est la seule logique de l'adaptateur qui mérite un test, et les
  critères de #14, validés à l'interrogatoire, le demandent.
- **§§ répercutés.** Corps de #1, « Décisions de test » et « Journal de spec » ; en-tête de
  `app/src/api.ts`.

### 2026-11-20 — « Hors périmètre » : les rappels de pointage en sortent (story 56)

**Décideur :** le mainteneur · **Session :** `vers-issues`, `contradiction`

- **Contradiction.** Le PRD disait « Synchronisation entre plusieurs téléphones ; écran de
  réglages ; export des heures ; notifications ou rappels de pointage. » Le mainteneur veut être
  notifié à 10 h et à 19 h s'il manque un pointage du jour, sauf le week-end, un jour férié ou un
  jour de congé.
- **Options.** (1a) Abandonner les rappels. (1b) Déplacer l'effet hors de ce que le PRD exclut :
  un indice « arrivée manquante » sur le widget de #20, sans notification ; il faut alors
  regarder l'écran d'accueil pour le voir. (2) Amender le PRD.
- **Retenu : (2).** Le rappel n'a de valeur que s'il vient à l'utilisateur.
- **Mécanisme envisagé, à trancher au cycle de l'issue.** Des notifications locales programmées
  sur le téléphone, pas des notifications push. Le serveur ne voit pas un pointage resté dans la
  File d'envoi, et l'on pointe là où le réseau est le plus faible : un rappel parti du serveur
  préviendrait d'un oubli qui n'en est pas un. Les push demanderaient aussi des identifiants
  FCM, un jeton push en base et une tâche planifiée sur la Function. L'écran de réglages reste
  hors périmètre : les heures sont fixes.
- **§§ répercutés.** Corps de #1 : « Solution », « User Stories » (section « Rappels »,
  story 56), « Hors périmètre » et « Journal de spec ».
