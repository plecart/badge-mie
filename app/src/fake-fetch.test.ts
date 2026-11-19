import { describe, expect, it } from "vitest";
import { stubFetch } from "./fake-fetch";

describe("stubFetch", () => {
  it("lève à l'appel même, hors de sa promesse, un appel de fetch sans réponse prévue", () => {
    stubFetch();
    expect(() => fetch("https://exemple.test/semaine", {})).toThrow(
      "appel de fetch inattendu",
    );
  });
});
