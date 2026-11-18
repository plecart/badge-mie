# Configuration pipeline

## Dépôt GitHub
- repo : `plecart/badge-mie` (privé)
- branche trunk : `main`

## Sources de vérité
Ordre de normativité : **en cas de contradiction, le rang le plus haut l'emporte**. Lu par le skill
`contradiction` et par la règle `.claude/rules/decisions-vs-doc.md`.

| Rang | Fichier | Portée | Où s'inscrit un amendement |
|---|---|---|---|
| 1 | `docs/adr/0001-stack-et-architecture.md` | stack, architecture, sécurité (jeton fixe), modèle de données, API, comportement hors ligne, variante d'écran retenue (« Pouce ») | le § concerné ; une décision qui le remplace passe par un nouvel ADR (`docs/adr/000N-…`) qui marque l'ancien « Remplacé » |
| n | issues GitHub ouvertes | découpage et planification, **dérivés** des rangs supérieurs | le corps de l'issue, jamais un commentaire — voir `repercussions` |

**Non normatif :** `docs/archive/` — le raisonnement et les options écartées ; rien ne s'y décide.

Toute référence croisée cite un **§ ou un titre de section**, jamais un numéro de ligne.

## Stack
- langages : TypeScript
- frameworks : Expo (React Native) pour `app/` ; Hono sur une Neon Function pour `api/`
- gestionnaire de paquets : npm (workspaces `app/` et `api/`)
- runtime + version : node 24 (le runtime des Neon Functions) — épinglage à poser à la première PR de code

## Commandes du projet
Lues par `cycle-pr`, `execution-qa` et la génération de CI. `n/a` = étape absente du projet.
- install      : npm ci                         # vérifiée le 2026-11-18, sortie 0
- test         : npm test                       # vérifiée le 2026-11-18, sortie 0 — Vitest, logique pure
- test ciblé   : npm test -- <chemin|motif>     # vérifiée le 2026-11-18, sortie 0 — motif = filtre sur le chemin du fichier
- test brut    : n/a
- lint         : npm run lint                   # vérifiée le 2026-11-18, sortie 0 — ESLint
- format       : npm run format                 # vérifiée le 2026-11-18, sortie 0 — Prettier, écrit
- format:check : npm run format:check           # vérifiée le 2026-11-18, sortie 0 — Prettier, vérifie sans écrire
- typecheck    : npm run typecheck              # vérifiée le 2026-11-18, sortie 0 — `tsc --noEmit` de chaque workspace
- audit        : npm audit --audit-level=high   # vérifiée le 2026-11-18, sortie 0
- build        : n/a                            # l'APK se construit par EAS Build (cloud), hors CI
- run local    : npm run start -w app           # non vérifiée — Expo, puis Expo Go sur le téléphone

## Qualité
- seuil de couverture : aucun
- règles sensibles à la plateforme : à établir à la première PR de code (poste Windows, CI Linux)
- gates bloquants en CI : audit, lint, format:check, typecheck, test
- services requis en CI : aucun

## Périmètre
- domaines (nom métier → chemin) — servent aussi de thèmes/milestones à `triage` :
  - Pointage : `app/` — l'écran de la semaine, le bouton de pointage, l'édition d'une heure, la file hors ligne
  - Données : `api/`, `neon.ts`, schéma SQL — la Neon Function, le jeton, la table `presence`
- zones sensibles (arrêt humain — cadence dans `.claude/rules/contraintes.md`) : écrans à valider visuellement
- hors périmètre : iOS, version web, publication sur un store, plusieurs utilisateurs ou authentification, pointage automatique par géorepérage
- surfaces exposées — ce que la QA a le droit de vérifier :
  interface mobile Android, API HTTP, persistance
- surfaces visibles par un utilisateur : interface mobile Android

## Langue
- skills / issues / PRD / descriptions : français
- identifiants du code : anglais
- commentaires / docstrings / noms de tests : français
- préfixe conventional commit : anglais (feat/fix/chore/docs/refactor)

## Mapping labels (rôle canonique → label GitHub)
- bug → `bug`
- enhancement → `enhancement`
- needs-triage → `needs-triage`
- needs-info → `needs-info`
- needs-interrogation → `needs-interrogation`
- ready-for-agent → `ready-for-agent`
- ready-for-human → `ready-for-human`
- wontfix → `wontfix`
- qa-plan → `qa-plan`
- qa-finding → `qa-finding`
- prd → `prd`   # label de nature (document parent) — hors machine à états, ni rôle d'état ni thème
- documentation → `documentation`   # label de nature (PR `docs(…)` sans issue liée) — hors machine à états

**Métadonnées d'une PR** — posées à l'Étape 2 de `cycle-pr`, vérifiées à l'Étape 5, corrigées
avant la sortie du draft si elles dévient. Toute PR qui n'est pas l'œuvre d'un bot porte :
- **assignee** : son auteur ;
- **un** label de catégorie : celui de l'issue qu'elle ferme ; sans issue, dérivé du type
  conventional commit — `feat` / `chore` / `refactor` / `ci` → `enhancement`, `fix` → `bug`,
  `docs` → `documentation` ;
- **le milestone** du domaine de ses fichiers (section « Périmètre »).

## Skills du projet
- Maison (copiés du boilerplate) : `init-projet`, `vers-prd`, `vers-issues`, `triage`, `interroge-moi`,
  `cycle-pr`, `contradiction`, `repercussions`, `pr-paralleles`, `plan-qa`, `execution-qa`,
  `bug-vers-issue`, `audit-spec-ui`, `schema-architecture`
- Socle embarqué : `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`,
  `ponytail-help`, `task-observer`
- Publics Expo (`expo/skills`, MIT, commit `dfdebcc6`) : `expo-overview`, `expo-data-fetching`,
  `expo-project-structure`, `expo-native-ui` — `expo-overview` aiguille aussi vers des skills
  `expo-*` / `eas-*` non installés : les ajouter ici au besoin
- Repris du projet Portfolio (MIT) : `emil-design-eng`, `prototype`
- Écartés : `claude-code-setup` — plugin non installé, repli sur la recherche directe du dépôt
  officiel `expo/skills` ; relancer `init-projet` une fois le plugin installé complétera la liste.
  Skills Neon — déjà fournis par le plugin Neon de la session, pas de copie dans le dépôt.
