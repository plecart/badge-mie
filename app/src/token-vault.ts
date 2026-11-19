/**
 * Le coffre du jeton : le jeton d'accès, gardé dans `expo-secure-store` (ADR-0001, « Décision »,
 * point 3). Sur Android, la valeur est chiffrée par le Keystore du système.
 *
 * Adaptateur mince, non testé (PRD #1, « Décisions de test ») : aucun module testé ne l'importe,
 * car `expo-secure-store` est un module natif.
 */

import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";

/** La clé du jeton dans le coffre ; `expo-secure-store` n'accepte que `[A-Za-z0-9._-]`. */
const TOKEN_KEY = "jeton";

/** Rend le jeton enregistré, ou `null` s'il n'y en a pas. */
export function readToken(): Promise<string | null> {
  return getItemAsync(TOKEN_KEY);
}

/** Enregistre le jeton, en remplaçant le précédent. */
export function saveToken(token: string): Promise<void> {
  return setItemAsync(TOKEN_KEY, token);
}

/** Efface le jeton : à faire quand le serveur le refuse. */
export function clearToken(): Promise<void> {
  return deleteItemAsync(TOKEN_KEY);
}
