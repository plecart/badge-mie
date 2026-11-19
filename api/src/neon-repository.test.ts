import { describe, expect, it } from "vitest";
import { withVerifiedTls } from "./neon-repository";

// Utilisateur, mot de passe, hôte et base : la réécriture les garde tels quels.
const BASE = "postgresql://u:p@h.neon.tech/db";

describe("mode TLS de la connexion à la base", () => {
  it.each([
    [
      "remplace require et garde channel_binding",
      "?sslmode=require&channel_binding=require",
      "?sslmode=verify-full&channel_binding=require",
    ],
    ["ajoute verify-full à une URL sans sslmode", "", "?sslmode=verify-full"],
    ["garde verify-full", "?sslmode=verify-full", "?sslmode=verify-full"],
    ["remplace disable", "?sslmode=disable", "?sslmode=verify-full"],
  ])("%s", (_, query, expected) => {
    expect(withVerifiedTls(BASE + query)).toBe(BASE + expected);
  });

  it("refuse une URL illisible sans la recopier dans l'erreur", () => {
    // Vitest compare aussi le nom et `input`, où le TypeError de `new URL` recopierait l'URL.
    expect(() => withVerifiedTls("host=h password=secret")).toThrow(
      new Error("URL de connexion illisible"),
    );
  });
});
