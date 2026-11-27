/**
 * L'adresse de l'API : la Neon Function `api` de la branche Neon que vise le build.
 *
 * - Build de développement (`__DEV__` vrai) : la Function de la branche Neon `preprod`, la
 *   pré-prod.
 * - APK de release (`__DEV__` faux) : la Function de la branche Neon `main`, la production et ses
 *   vrais pointages.
 *
 * `__DEV__` est posé par le prélude du bundle, selon le mode de Metro (`metro` 0.87.1,
 * `src/lib/getPreludeCode.js`, lu le 2026-11-27).
 *
 * `EXPO_PUBLIC_API_URL`, posée au lancement de Metro, force une autre adresse, quel que soit le
 * build : `EXPO_PUBLIC_API_URL=<adresse> npm run start -w app -- --clear`. Absente ou vide, le
 * build décide. Expo n'intègre la variable que lue telle quelle, `process.env.EXPO_…`, jamais
 * déstructurée (`babel-preset-expo` 58.0.26, `build/plugins/inline-env-vars.js`, et
 * `@expo/metro-config`, `transform-worker/noxcturnal/plugins/process-env.js`, lus le 2026-11-20).
 *
 * Ce n'est pas un secret, elle est compilée dans l'application. Le jeton, lui, ne l'est jamais :
 * il est saisi au premier lancement et gardé dans le coffre du téléphone (ADR-0001, « Décision »,
 * point 3).
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__
    ? "https://br-sweet-mouse-bhmcqyys-api.compute.c-10.eu-central-1.aws.neon.tech"
    : "https://br-restless-boat-bhqb3o3o-api.compute.c-10.eu-central-1.aws.neon.tech");
