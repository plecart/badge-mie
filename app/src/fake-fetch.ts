/**
 * Le réseau des tests : un `fetch` factice, et le délai maximal des requêtes piloté par les
 * minuteurs factices de Vitest. Chaque fonction défait ce qu'elle pose à la fin du test.
 */

import { onTestFinished, vi } from "vitest";

/** Ce que rend un appel au `fetch` factice : `response` au bout de `after` ms, ou rien (`null`). */
export type FakeAnswer = { after: number; response: Response } | null;

/**
 * Passe aux minuteurs factices de Vitest, `AbortSignal.timeout` compris.
 *
 * Celui de Node ne les suit pas : sous `vi.useFakeTimers()`, un `AbortSignal.timeout(10_000)`
 * n'est toujours pas abandonné après 20 s simulées (mesuré le 2026-11-19, Node 24.3.0, Vitest
 * 5.1.1), et les minuteurs que remplace `@sinonjs/fake-timers` ne le comprennent pas (objet
 * `timers` de `withGlobal`, `vitest/dist/chunks/index.DNcttN5a.js`, lu le même jour). Il est
 * remplacé par un signal qu'abandonne un `setTimeout`, que les minuteurs factices pilotent, d'une
 * `DOMException` `TimeoutError` : c'est ainsi que l'écrit le polyfill de l'application
 * (`static timeout` de `react-native/src/private/webapis/dom/abort-api/AbortSignal.js`,
 * react-native 0.88.1, lu le 2026-11-19).
 */
export function useFakeTimers(): void {
  vi.useFakeTimers();
  const timeout = vi
    .spyOn(AbortSignal, "timeout")
    .mockImplementation((delay) => {
      const controller = new AbortController();
      setTimeout(
        () =>
          controller.abort(new DOMException("délai dépassé", "TimeoutError")),
        delay,
      );
      return controller.signal;
    });
  onTestFinished(() => {
    timeout.mockRestore();
    vi.useRealTimers();
  });
}

/**
 * Pose en global un `fetch` factice, qui répond à chaque appel la réponse suivante d'`answers`,
 * et rejette comme `fetch`, de la raison du signal, quand le signal de la requête abandonne avant.
 *
 * @param answers - Une réponse par appel, dans l'ordre.
 * @returns Le `fetch` factice, pour lire ses appels.
 * @throws {Error} à un appel de plus, levée par `fetch` lui-même et non par sa promesse : le
 *   `catch` de la promesse de `fetch` dans `./api` la convertirait en `ServerUnreachableError`, et
 *   un test du délai passerait au vert sur un appel en trop.
 */
export function stubFetch(...answers: FakeAnswer[]) {
  const fetch = vi.fn((_url: string, init: RequestInit) => {
    const answer = answers.shift();
    if (answer === undefined) throw new Error("appel de fetch inattendu");
    return new Promise<Response>((resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      if (answer) setTimeout(() => resolve(answer.response), answer.after);
    });
  });
  vi.stubGlobal("fetch", fetch);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  return fetch;
}
