import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Max age of a Login Widget payload, in seconds. Telegram's own recommendation is one day. */
const MAX_AUTH_AGE_S = 24 * 60 * 60;

export type WidgetPayload = Record<string, string> & { id: string; hash: string; auth_date: string };

/**
 * Check a Telegram Login Widget payload, as described in Telegram's "Login Widget" docs:
 * secret = SHA256(bot token), HMAC-SHA256(secret, sorted "key=value" lines) must equal `hash`.
 */
export function verifyLoginWidget(payload: WidgetPayload, botToken: string, nowS = Math.floor(Date.now() / 1000)): boolean {
  const { hash, ...fields } = payload;
  if (!hash || !/^\d+$/.test(fields.id ?? "")) return false;
  const authDate = Number(fields.auth_date);
  if (!Number.isFinite(authDate) || nowS - authDate > MAX_AUTH_AGE_S) return false;

  const dataCheck = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheck).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(hash, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
