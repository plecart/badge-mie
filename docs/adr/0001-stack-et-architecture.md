# ADR-0001 : Stack et architecture de Badge Mie

**Statut :** Accepté (2026-11-18)
**Date :** 2026-11-18
**Décideur :** le mainteneur (seul utilisateur)

## Contexte

Badge Mie relève les horaires de présence d'**une seule personne** dans un bâtiment : une heure
d'arrivée et une heure de départ par jour, du lundi au dimanche. Le samedi, le dimanche, les
jours fériés et les jours de congé ne sont pas travaillés, mais restent pointables.

Contraintes posées :

- **Vite fait, très simple** : le minimum de fonctionnalités, le minimum de pièces mobiles.
- **Mobile uniquement**, installé par **APK** (pas de store, pas de version web).
- **Mono-utilisateur, sans authentification** : ni compte, ni écran de connexion.
- **Données stockées dans Neon** (Postgres managé), et **protégées** malgré l'absence d'auth.
- À l'ouverture, l'écran montre la **semaine en cours** (7 lignes, du lundi au dimanche) et
  permet de pointer l'arrivée et le départ **en un geste**. Toute heure pointée reste
  **modifiable à la main**.

Il y a aussi des contraintes qui ne sont pas écrites mais qui pèsent sur le choix :

- **Le réseau du bâtiment n'est pas garanti.** Le pointage se fait à l'entrée, souvent là où le
  réseau est le plus faible. Un pointage perdu faute de réseau, c'est exactement ce que l'outil
  doit empêcher.
- **L'APK ne se construit pas sur le poste** (Windows). Android Studio, son SDK et son JDK y sont
  installés, mais ne servent qu'à l'émulateur, pour le code natif (point 1) : tenir la
  construction de l'APK en local coûte plus de temps que tout le reste.
- **Le savoir-faire existant porte sur TypeScript et Python** (projet Portfolio), pas sur Dart ni
  Kotlin.

## Décision

1. **Client : Expo (React Native + TypeScript)**. L'APK est construit dans le cloud par EAS Build
   (profil qui produit un `.apk`), et seulement pour une release. Pendant le développement, rien
   n'est construit par EAS : l'application tourne sur le téléphone via Expo Go tant qu'elle
   n'embarque aucun code natif. Le widget d'écran d'accueil en embarque : dès qu'il entre, le
   développement passe sur un build de développement (`expo-dev-client`), construit sur le poste
   par `npx expo run:android` et installé sur l'émulateur d'Android Studio.
2. **Backend : une Neon Function** (Hono, Node.js) dans la région `aws-eu-central-1`, à côté de
   la base. Elle reçoit `DATABASE_URL` automatiquement. **L'application ne parle jamais
   directement à Postgres.**
3. **Sécurité : un jeton fixe (« bearer »)**, aléatoire et long, connu seulement de la Function
   (variable secrète) et du téléphone (stockage sécurisé, `expo-secure-store`). Il est **saisi
   une fois au premier lancement**, et non compilé dans l'APK. La Function le compare en temps
   constant et refuse toute requête sans le bon jeton.
4. **Hors ligne : écriture locale d'abord, puis envoi.** Un pointage enregistre l'heure
   **du téléphone, au moment du geste**, dans un cache local. Il part ensuite vers l'API par une
   file d'attente rejouée au retour du réseau et à chaque ouverture de l'app. L'API est
   **idempotente** (un `PUT` par date, le dernier écrit l'emporte) : rejouer un envoi n'abîme rien.
5. **Données : une table, une ligne par jour.**

```sql
create table presence (
  jour        date primary key,          -- la date complète ; le jour de la semaine s'en déduit
  arrivee     time,                      -- heure locale (Europe/Paris), à la minute
  depart      time,
  conge       boolean not null default false, -- jour de congé posé par le calendrier
  modifie_le  timestamptz not null default now(),
  check (arrivee is null or depart is null or depart > arrivee)
);
```

   Les jours fériés français ne se stockent pas : ils se calculent à partir de la date, dans
   `week/`, sans réseau. Une journée de travail fait 8 h 30, et l'objectif de la semaine est de
   42 h 30 (8 h 30 × 5). Un jour férié ou de congé qui tombe du lundi au vendredi compte 8 h 30
   s'il n'est pas pointé ; pointé, il compte comme un jour normal, ses heures réelles. Un samedi
   ou un dimanche, même férié ou en congé, est un jour de week-end : il ne compte aucun crédit,
   seulement ses heures pointées.

6. **API : deux routes.**
   - `GET /semaines/:lundi` rend les 7 jours de la semaine, du lundi au dimanche (les jours vides
     ont des heures nulles).
   - `PUT /jours/:date` avec `{ arrivee, depart, conge }` crée ou remplace la ligne du jour, quel
     que soit le jour de la semaine.

## Options étudiées

### Client mobile

#### A. Expo / React Native + TypeScript — **retenue**

| Dimension | Évaluation |
|---|---|
| Complexité | Faible : un seul langage, un sélecteur d'heure natif prêt à l'emploi |
| Coût | Gratuit à ce volume (offre gratuite d'EAS Build ; quota à vérifier sur la page de tarifs d'Expo au moment du premier build) |
| Construction de l'APK | Dans le cloud, sans Android Studio |
| Familiarité | Bonne : TypeScript, React |

**Pour :** APK sans boîte à outils locale ; boucle de dev immédiate sur le téléphone ; composants
natifs (sélecteur d'heure Android, retour haptique, stockage sécurisé).
**Contre :** les skills de design du Portfolio (`emil-design-eng`, `prototype`) raisonnent en
CSS et DOM, donc seuls leurs principes passent, pas leur code. EAS Build exige un compte Expo.

#### B. Capacitor + React (Vite) dans une WebView

| Dimension | Évaluation |
|---|---|
| Complexité | Faible côté interface, moyenne côté construction |
| Construction de l'APK | Gradle en local, donc Android Studio, SDK et JDK sur le poste (ou une CI dédiée) |
| Familiarité | Très bonne : React web |

**Pour :** les skills de design et un prototype HTML se réutilisent tels quels ;
`<input type="time">` ouvre le sélecteur natif d'Android.
**Contre :** toute la boîte à outils Android à installer et maintenir sous Windows ; ressenti
d'application web.

#### C. Flutter

**Pour :** excellent rendu mobile, construction d'APK maîtrisée.
**Contre :** Dart, un nouveau langage, plus la boîte à outils Android en local. Écarté pour
« vite fait ».

#### D. PWA installée

**Contre :** pas d'APK ; Android peut vider le stockage d'une PWA (ce qui casse la file hors
ligne). Écarté, car l'APK est une contrainte.

### Accès aux données

#### A. Neon Function + jeton fixe — **retenue**

**Pour :** un seul fournisseur ; la Function tourne à côté de la base ; les identifiants Postgres
ne quittent jamais le serveur ; le jeton, s'il fuit, ne donne accès qu'aux deux routes, jamais
à la base.
**Contre :** Neon Functions n'est disponible que dans quatre régions ; le projet Neon doit être
créé en `aws-eu-central-1`.

#### B. Fonction Vercel + jeton fixe

Même modèle de sécurité que A, mais avec un second fournisseur, un second compte et des variables
d'environnement à synchroniser. **Repli** si Neon Functions pose problème.

#### C. Neon Data API (PostgREST) appelée depuis l'app

**Contre :** elle impose Neon Auth (des JWT), donc un système d'authentification, ce que le
besoin exclut. Neon déconseille par ailleurs son usage pour une application neuve (politiques
RLS faciles à mal régler). Écartée.

#### D. Connexion Postgres directe depuis l'app

**Contre :** l'URL de connexion, avec son mot de passe, serait dans l'APK, et quiconque a le
fichier a la base entière. Écartée sans appel.

### Comportement hors ligne

| Option | Pour | Contre |
|---|---|---|
| En ligne seulement | Zéro code de synchronisation | Pointage perdu ou retardé sans réseau ; l'heure enregistrée serait celle du serveur, pas celle du geste |
| **Local d'abord + file idempotente — retenue** | Le pointage ne se perd jamais ; l'heure est celle du geste | Une file locale et sa relance, à écrire et tester |
| Synchronisation bidirectionnelle (SQLite local, résolution de conflits) | Robuste sur plusieurs appareils | Inutile pour un seul utilisateur sur un seul téléphone |

## Analyse des compromis

- **Vitesse ou réutilisation des skills web.** Capacitor permettrait de réutiliser le code des
  skills de design, mais l'installation de la boîte à outils Android sous Windows coûte plus que
  ce gain. Expo l'emporte parce que l'APK sort du cloud.
- **Jeton fixe ou authentification.** Le jeton n'est pas une authentification au sens utilisateur.
  C'est une **clé d'API**. Dans le pire cas, s'il fuit, on lit et modifie des horaires, jamais la
  base. Ce risque est accepté, à deux conditions : le jeton n'est pas dans l'APK (il est saisi au
  premier lancement) et on peut le **tourner** (changer le secret de la Function, puis le ressaisir).
- **Hors ligne.** La file locale est la seule complexité ajoutée au-delà du strict minimum. Elle
  est retenue parce que le pointage à l'entrée du bâtiment est le cas d'usage principal, et aussi
  celui où le réseau manque le plus.
- **Ce qu'on ne stocke pas.** Le nom du jour se déduit de la date, donc pas de colonne `jour_nom`.
  Une seule paire arrivée/départ par jour : les pauses ne sont pas suivies (voir « À revoir »).

## Conséquences

**Plus simple :**
- Un seul langage (TypeScript) du téléphone à la Function.
- Pas de compte, pas d'écran de connexion, pas de gestion de session.
- Rejouer un envoi est sans risque, puisque `PUT` est idempotent.

**Plus difficile :**
- Changer de téléphone demande de ressaisir le jeton (ce qui est voulu).
- Une heure de téléphone fausse donne un pointage faux, puisqu'il n'y a pas d'horloge serveur de
  référence. C'est acceptable : l'heure reste modifiable à la main.
- Deux comptes à tenir : Neon et Expo.

**À revoir si le besoin change :**
- Plusieurs arrivées et départs par jour (pauses), ce qui demanderait une table d'événements au
  lieu d'une ligne par jour.
- Plusieurs utilisateurs : il faudrait alors une vraie authentification, et le jeton fixe ne
  suffirait plus.
- Pointage automatique par géorepérage : écarté pour l'instant (permissions de localisation en
  arrière-plan, batterie, fiabilité).

## Propositions UX (à trancher par le prototype, puis le PRD)

**Tranché le 2026-11-18 par le prototype** (https://claude.ai/artifact/NwrBfuBW1u2KnpdxjGnRae, page
privée) : on retient la variante **« Pouce »**. Elle affiche les 7 jours en cartes (jour, arrivée,
départ, durée), avec le jour courant mis en évidence. Un seul bouton contextuel est fixé en bas,
au-dessus de la date et de l'heure courante. La variante prototypée affiche aussi le total de la
semaine et les flèches de navigation entre semaines ; ces deux éléments restent à confirmer au PRD.
Les variantes écartées sont « Journée » (horloge en grand, semaine en tableau compact) et
« Ligne » (pointage dans la carte du jour, sans bouton global).

Elles ne relèvent pas de l'architecture, mais elles en découlent. Les voici pour mémoire :

- **Un seul bouton contextuel** en bas de l'écran, dans la zone du pouce, au lieu de deux :
  « Je suis arrivé » le matin, puis « Je pars » une fois l'arrivée pointée, puis il se désactive
  (« Journée terminée »). Avec deux boutons toujours visibles, on peut appuyer sur le mauvais.
- **Le bouton vise toujours aujourd'hui.** Les autres jours se corrigent en touchant leur heure.
- **Toucher une heure ouvre le sélecteur d'heure natif d'Android**, prérempli. Une heure vide
  touchée s'ouvre sur l'heure courante.
- **Dans l'app, un appui maintenu** déclenche le pointage : environ 0,5 s, avec une progression
  dessinée sur le contour du bouton, qui revient en arrière si le doigt se lève avant la fin ; un
  toucher bref affiche « Maintiens le bouton pour pointer ».
- **Sur le widget**, qui ne reçoit que des touchers, **deux touchers** : le premier arme le bouton,
  de façon visible, le second pointe.
- **« Annuler » reste visible quelques secondes** après un pointage (barre en bas) : l'appui
  maintenu évite le pointage accidentel, « Annuler » répare une heure fausse.
- **Aujourd'hui mis en évidence** dans les 7 lignes ; un retour haptique au pointage ; un petit
  indicateur « en attente d'envoi » quand la file hors ligne n'est pas vide.
- **Un jour non travaillé** (samedi, dimanche, férié, congé) a sa carte grisée ; le bouton
  y est grisé mais reste actif. Les congés se posent dans un calendrier mensuel, en glissant le
  doigt sur les jours.
- **À décider :** le total d'heures de la semaine (une ligne de plus) et la navigation vers les
  semaines précédentes (deux flèches). Les deux sont utiles mais pas indispensables.

## Actions

1. [x] Valider cet ADR (statut : Accepté).
2. [x] Créer le projet Neon en `aws-eu-central-1` et la table `presence`.
3. [x] Générer le jeton (32 octets aléatoires) et le poser en secret de la Function, jamais dans
       le dépôt.
4. [ ] `init-projet` : stack TypeScript / Expo / Neon Function ; cet ADR devient une source de
       vérité de rang 1.
5. [x] Prototyper l'écran unique (voir les propositions UX) avant le PRD : variante « Pouce » retenue.
6. [x] Vérifier par context7 ou la documentation officielle, au moment de coder, les versions et
       l'API d'Expo SDK, d'EAS Build, d'`expo-secure-store`, du sélecteur d'heure et de Neon
       Functions. Aucune version n'est figée ici.
