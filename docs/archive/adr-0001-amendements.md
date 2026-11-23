# Archive — amendements de l'ADR-0001 (Badge Mie)

> **Non normatif.** Ce fichier garde le raisonnement des amendements de
> `docs/adr/0001-stack-et-architecture.md`. Rien ne s'y décide : l'ADR fait foi.

## Action 6 — le moyen de vérification des versions

**Date :** 2026-11-19 · **Décideur :** le mainteneur · **Session :** `cycle-pr`, PR #7 (lot 2 de #3)

- **Contradiction.**
  - Avant : « Vérifier par context7, au moment de coder, les versions et l'API… ».
  - Ce qui s'est passé : le quota mensuel de context7 était épuisé (relevé le 2026-11-18 par
    `vers-prd`, puis le 2026-11-19 pendant le lot 2). La vérification s'est donc faite à la
    documentation officielle.
  - Ce que demandait le brief de #3 : cocher l'action au merge du lot 2. La cocher telle quelle
    aurait affirmé une vérification par context7 qui n'a pas eu lieu.
- **Options.**
  - (1a) Laisser l'action ouverte jusqu'au retour du quota.
  - (1b) La cocher avec une note sur le moyen utilisé. Écartée, parce que le texte fixait le
    moyen.
  - (2) Amender le moyen.
- **Retenu : (2).** L'intention de l'action est de ne pas coder de mémoire, et la documentation
  officielle la remplit autant que context7. Sources de la vérification :
  - Expo SDK 58, EAS Build et `expo-secure-store` : docs.expo.dev, le 2026-11-19 (Notes de la
    PR #7) ;
  - Neon Functions : la doc Neon, au lot 1 (PR #5) ;
  - le sélecteur d'heure : le README de `@react-native-community/datetimepicker`, relu à
    l'interrogatoire du PRD #1.
- **§§ répercutés :** aucun, la cascade a été mesurée à zéro.
  - `docs/` : seule l'archive du PRD #1 nomme context7, et elle n'est pas normative.
  - PRD #1 (« Dépendances côté client ») : il renvoie à l'ADR sans nommer le moyen.
  - Issue #3 : son critère « action 6 » est soldé par ce commit.
  - `CLAUDE.md` et `pipeline.config.md` : rien à changer.

## Décision (point 1) et Propositions UX — l'appui maintenu et le widget

**Date :** 2026-11-19 · **Décideur :** le mainteneur · **Session :** `vers-issues` (appui maintenu
et widget Android)

- **Contradictions.**
  - Propositions UX. Avant : « "Annuler" pendant quelques secondes après un pointage (barre en
    bas), plutôt qu'une confirmation avant ». Décision : dans l'app, le pointage se déclenche par
    un appui maintenu, pour éviter les pointages accidentels.
  - Décision, point 1. Avant : « Pendant le développement, l'application tourne sur le téléphone
    via Expo Go. » Décision : l'application propose un widget d'écran d'accueil, dont le code
    natif ne tourne pas dans Expo Go (docs.expo.dev, page `expo-widgets`, lue le 2026-11-19 :
    « This library is not available in the Expo Go app »).
- **Options.**
  - Appui maintenu : (1a) garder le toucher et « Annuler » seuls ; (1b) allonger ou rendre plus
    visible « Annuler » ; (2) amender.
  - Widget : (1a) renoncer au widget ; (1b) garder Expo Go et isoler le widget, vérifié seulement
    sur l'APK, au prix d'un build cloud par essai ; (2) passer sur un build de développement.
- **Retenu : (2) pour les deux.**
  - L'appui maintenu reste un seul geste. « Annuler » est gardé, parce qu'un appui voulu peut
    porter une heure fausse. Le mainteneur a retenu environ 1,5 s plutôt que les 2 s d'abord
    évoquées : 2 s font un geste lent, répété deux fois par jour.
  - Un widget ne reçoit pas d'appui maintenu : RemoteViews et Glance n'exposent que le clic, et
    l'appui long sur un widget appartient au lanceur (developer.android.com, lu le 2026-11-19).
    RemoteCompose, en alpha (1.0.0-alpha24), ne documente pas cet usage dans un widget. Le widget
    pointe donc par deux touchers ; le rendu de l'état armé se décide à l'interrogatoire de son
    issue.
  - Le point 1 est amendé en place plutôt que remplacé par un nouvel ADR : Expo n'est pas
    remplacé, seul le mode de développement change. Le choix de la bibliothèque du widget fera
    l'objet de l'ADR-0002, dans la PR du widget.
- **§§ répercutés :** aucun autre dans les documents ; le § Contexte (« en un geste ») reste vrai.
  - À propager aux issues après le merge : #1 (stories 20 et 55) et #12 (observations du
    pointage).
  - La commande `run local` de `pipeline.config.md` change avec le widget, pas avec cet
    amendement.

## Propositions UX — l'appui maintenu ramené à environ 1 s

**Date :** 2026-11-19 · **Décideur :** le mainteneur · **Session :** `cycle-pr`, PR #16 (#14)

- **Contradiction.**
  - Avant : « Dans l'app, un appui maintenu déclenche le pointage : environ 1,5 s […] ».
  - Décision : à l'arrêt visuel de l'appui maintenu (PR #16), le mainteneur a demandé une durée
    d'appui de 1 s.
- **Options.**
  - (1a) Garder 1,5 s.
  - (1b) Déplacer l'effet : remplir la jauge en 1 s et ne pointer qu'à 1,5 s, ou rendre la durée
    réglable. Écartée : la première ment à l'œil, la seconde fait un écran de réglages, hors
    périmètre du PRD #1.
  - (2) Amender la durée.
- **Retenu : (2).** Vu en main sur le téléphone, 1,5 s est plus long que nécessaire pour un
  geste répété deux fois par jour ; 1 s garde l'appui délibéré qui évite le pointage accidentel.
- **§§ répercutés :** aucun autre dans les documents.
  - Issue #14 (point 4, critère « Appui maintenu », décision du 2026-11-19) : amendée par la
    session PR de #14.
  - Code : `HOLD_MS` de `app/src/hold.ts`, dans la PR #16.

## Contexte, Décision (points 5 et 6) et Propositions UX — la semaine de 7 jours, les fériés et les congés

**Date :** 2026-11-20 · **Décideur :** le mainteneur · **Session :** dialogue hors cycle (semaine
de 7 jours, fériés et congés)

- **Contradiction.**
  - Avant : « une heure d'arrivée et une heure de départ par jour ouvré, du lundi au vendredi »
    (Contexte) ; « `GET /semaines/:lundi` rend les 5 jours de la semaine » (Décision, point 6) ;
    « Elle affiche les 5 jours en cartes » (Propositions UX).
  - Décision : afficher les 7 jours. Le samedi et le dimanche sont grisés mais pointables, parce
    qu'il arrive de travailler le week-end. Les jours fériés français sont grisés et comptent
    8 h quand ils tombent en semaine. Des jours de congé se posent dans un calendrier et
    comptent 8 h.
- **Options.**
  - (1a) Garder la semaine de 5 jours et le refus du week-end.
  - (1b) Garder 5 lignes et montrer le week-end sur un écran à part. Écartée : plus lourd que la
    demande, et le pointage du week-end resterait hors de l'écran principal.
  - (2) Amender.
- **Retenu : (2).**
  - Amendé en place plutôt que par un nouvel ADR : la stack, la sécurité et le hors ligne ne
    changent pas, seuls la semaine et le modèle de données s'étendent. Le numéro ADR-0002 reste
    réservé à la bibliothèque du widget.
  - Les congés tiennent dans une colonne `conge` de `presence` plutôt que dans une table : l'ADR
    garde une table et deux routes, et la file hors ligne rejoue le même `PUT`.
  - Les fériés se calculent dans `week/`, sans réseau ni stockage : ils se déduisent de la date
    (dates fixes et dates liées à Pâques). Candidats relevés le 2026-11-20 sur le registre npm :
    `@socialgouv/jours-feries` 2.0.0, sans dépendance, inchangé depuis 2022 ; `date-holidays`
    3.39.2, mondial, quatre dépendances. Le choix se fait dans l'issue.
  - Un congé ou un férié tombé un samedi ou un dimanche compte 0 h, comme le week-end :
    hypothèse retenue le 2026-11-20, à confirmer à l'interrogatoire de l'issue des congés.
- **§§ répercutés :** Contexte (deux passages), Décision points 5 et 6, Propositions UX (deux
  passages et un point ajouté).
  - Documents : rien d'autre. `docs/`, `CLAUDE.md`, `CONTRIBUTING.md` et `pipeline.config.md`
    parcourus : aucun autre « 5 jours » ni « lundi au vendredi ».
  - À propager aux issues après le merge : #1 (semaine de 5 jours, story 15, refus du week-end,
    hors périmètre « Pointage le week-end »), #20 (critère « Week-end »), #8 et #12 (cinq
    cartes, bouton désactivé le week-end).
  - Code devenu faux, traité par les issues à venir : le refus 400 du week-end dans l'API,
    l'action `weekend` du bouton.

## Décision (point 5) — la journée de 8 h 30 et le férié pointé

**Date :** 2026-11-23 · **Décideur :** le mainteneur · **Session :** dialogue hors cycle (objectif
journalier de 8 h 30)

- **Contradiction.**
  - Avant : « Un jour férié ou de congé qui tombe du lundi au vendredi compte 8 h ; un samedi ou
    un dimanche ne compte rien, même férié ou en congé. »
  - Décision : « Un jour fait bien 8h30 » ; « par défaut, un jour férié vaille 8h30, mais si
    jamais on met un badge, alors on le compte comme un jour normal » ; « si jamais les jours
    fériés tombent sur un week-end… ils ne valent pas 8h30 ».
- **Options.**
  - (1a) Garder le crédit de 8 h, et afficher l'objectif de 8 h 30 seulement à l'écran. Écartée :
    une semaine de congé afficherait 40 h 00 sur un objectif de 42 h 30.
  - (1b) Déplacer la durée de la journée hors de l'ADR, dans une constante du code. Écartée : le
    crédit des fériés et des congés est déjà une règle de l'ADR, la valeur doit y être juste.
  - (2) Amender.
- **Retenu : (2).**
  - Une journée de travail fait 8 h 30 ; l'objectif de la semaine est de 42 h 30 (8 h 30 × 5).
  - Un férié ou un congé du lundi au vendredi sans pointage compte 8 h 30 ; pointé, il compte ses
    heures réelles, comme un jour normal. Cela tranche deux questions ouvertes : le férié
    travaillé et pointé (#25), le congé pointé (#26).
  - Le week-end ne reçoit aucun crédit, même férié ou en congé : l'hypothèse du 2026-11-20 est
    confirmée par le mainteneur (#26).
  - Le seuil de 8 h 30 sert aussi à l'écran (objectif de la semaine, couleur de la durée d'un
    jour) : c'est l'objet d'une issue à venir, pas de l'ADR.
- **§§ répercutés :** aucun autre dans les documents.
  - `docs/`, `README.md`, `CLAUDE.md`, `CONTRIBUTING.md` et `pipeline.config.md` parcourus : le
    seul « 8 h » est celui du point 5. Le § Contexte (« ne sont pas travaillés, mais restent
    pointables ») reste vrai.
  - Issues amendées le 2026-11-23 par la session qui a décidé : #1 (story 8, § Solution,
    § Cadre, module « Calendrier de semaine »), #25 et #26.
  - Code devenu faux, traité par #25 et #26, pas encore livrées : aucun crédit n'est codé à ce
    jour.
