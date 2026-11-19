/** Le stockage clé-valeur des tests : en mémoire, sans `AsyncStorage`. */

import type { KeyValueStorage } from "./week-store";

/** Rend un stockage clé-valeur en mémoire, vide au départ. */
export function memoryStorage(): KeyValueStorage {
  const items = new Map<string, string>();
  return {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => {
      items.set(key, value);
    },
  };
}
