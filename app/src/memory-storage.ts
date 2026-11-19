/** Les stockages clé-valeur des tests, sans `AsyncStorage`. */

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

/** Rend un stockage qui lit `text` sous toute clé, et dont l'écriture n'a pas d'effet. */
export function storageHolding(text: string | null): KeyValueStorage {
  return { getItem: async () => text, setItem: async () => {} };
}
