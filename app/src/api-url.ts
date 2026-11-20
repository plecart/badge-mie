/**
 * L'adresse de l'API : la Neon Function `api`, déployée sur la branche Neon `main` par défaut.
 *
 * `EXPO_PUBLIC_API_URL`, posée au lancement de Metro, la remplace — pour viser la Function d'une
 * branche Neon de QA depuis Expo Go sans toucher aux vrais pointages de `main` :
 * `EXPO_PUBLIC_API_URL="$QA_API" npm run start -w app -- --clear`. Absente ou vide, c'est `main`
 * (l'APK de production). Expo n'intègre la variable que lue telle quelle, `process.env.EXPO_…`,
 * jamais déstructurée (`babel-preset-expo` 58.0.26, `build/plugins/inline-env-vars.js`, lu le
 * 2026-11-20).
 *
 * Ce n'est pas un secret, elle est compilée dans l'application. Le jeton, lui, ne l'est jamais :
 * il est saisi au premier lancement et gardé dans le coffre du téléphone (ADR-0001, « Décision »,
 * point 3).
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://br-restless-boat-bhqb3o3o-api.compute.c-10.eu-central-1.aws.neon.tech";
