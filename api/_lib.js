// Shared helpers for the Strava functions. Files starting with "_" are not routes on Vercel.
import crypto from "node:crypto";

export const COOKIE = "wa_session";

// Trim env values: copied secrets often carry stray spaces or line breaks.
export const env = (k) => (process.env[k] || "").trim();
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

// Session cookie is encrypted (AES-256-GCM) with a key derived from the Strava client secret.
const key = () => crypto.createHash("sha256").update("winter-arc-session:" + env("STRAVA_CLIENT_SECRET")).digest();

export function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64url");
}

export function unseal(s) {
  try {
    const b = Buffer.from(s, "base64url");
    const d = crypto.createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

export function cookies(req) {
  const o = {};
  (req.headers.cookie || "").split(/;\s*/).forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) o[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1));
  });
  return o;
}

export const sessionCookie = (obj) => `${COOKIE}=${seal(obj)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;

export function origin(req) {
  const h = req.headers["x-forwarded-host"] || req.headers.host;
  return "https://" + h;
}

export const configured = () => !!(env("STRAVA_CLIENT_ID") && env("STRAVA_CLIENT_SECRET"));

export async function tokenRequest(params) {
  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("STRAVA_CLIENT_ID"),
      client_secret: env("STRAVA_CLIENT_SECRET"),
      ...params,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error("token"), { status: 401, detail: j });
  return j;
}
