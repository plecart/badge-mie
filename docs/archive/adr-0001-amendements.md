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
