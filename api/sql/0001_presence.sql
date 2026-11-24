-- Table des présences : une ligne par jour pointé.
-- Schéma repris tel quel de l'ADR-0001 (« Décision », point 5). Appliqué une fois ; une
-- évolution ajoute un fichier `0002_…`, sans outil de migration.
create table presence (
  jour        date primary key,          -- la date complète ; le jour de la semaine s'en déduit
  arrivee     time,                      -- heure locale (Europe/Paris), à la minute
  depart      time,
  modifie_le  timestamptz not null default now(),
  check (arrivee is null or depart is null or depart > arrivee)
);
