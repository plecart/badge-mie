/**
 * L'application HTTP de Badge Mie (ADR-0001, « Décision », points 3 et 6). Elle ne lit ni
 * l'environnement ni l'horloge : ce dont elle dépend arrive en argument de {@link createApp}.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { Hono, type MiddlewareHandler } from "hono";

/** Empreinte SHA-256 : deux textes de longueurs quelconques se comparent à longueur égale. */
function sha256(text: string): Buffer {
  return createHash("sha256").update(text).digest();
}

/**
 * Garde du jeton : un en-tête `Authorization` qui n'est pas exactement `Bearer <token>` rend 401,
 * qu'il manque, porte un autre schéma, une autre valeur ou une autre forme. Les deux en-têtes se
 * comparent en temps constant, par leurs empreintes SHA-256.
 *
 * @param token - Le jeton fixe attendu.
 */
function requireToken(token: string): MiddlewareHandler {
  const expected = sha256(`Bearer ${token}`);
  return async (c, next) => {
    const received = sha256(c.req.header("Authorization") ?? "");
    if (!timingSafeEqual(received, expected)) {
      return c.text("Unauthorized", 401, { "WWW-Authenticate": "Bearer" });
    }
    await next();
  };
}

/**
 * Crée l'application. La garde du jeton passe avant tout le reste, route inconnue comprise.
 *
 * @param options.token - Le jeton fixe attendu.
 */
export function createApp({ token }: { token: string }): Hono {
  const app = new Hono();
  app.use(requireToken(token));
  return app;
}
