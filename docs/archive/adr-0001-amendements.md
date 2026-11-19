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
