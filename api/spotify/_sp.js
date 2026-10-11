// Spotify helpers: OAuth tokens live in their own encrypted cookie, separate from Strava.
import { seal, unseal, cookies, env, HOST } from "../_lib.js";

export const SP_COOKIE = "wa_sp";
export const SP_REDIRECT = () => "https://" + HOST + "/api/spotify/callback";
export const spConfigured = () => !!(env("SPOTIFY_CLIENT_ID") && env("SPOTIFY_CLIENT_SECRET"));
export const spCookie = (obj) => `${SP_COOKIE}=${seal(obj)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 180}`;
export const spRead = (req) => unseal(cookies(req)[SP_COOKIE] || "");

export async function spToken(params) {
  const basic = Buffer.from(env("SPOTIFY_CLIENT_ID") + ":" + env("SPOTIFY_CLIENT_SECRET")).toString("base64");
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: "Basic " + basic, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error("spotify token"), { status: 401, detail: j });
  return j;
}

/* returns a valid access token (refreshing if needed) and sets the updated cookie on res */
export async function spAccess(req, res) {
  let s = spRead(req);
  if (!s || !s.r) return null;
  if (!s.e || s.e * 1000 < Date.now() + 60_000) {
    const t = await spToken({ grant_type: "refresh_token", refresh_token: s.r });
    s = { a: t.access_token, r: t.refresh_token || s.r, e: Math.floor(Date.now() / 1000) + (t.expires_in || 3600) };
    res.setHeader("Set-Cookie", spCookie(s));
  }
  return s.a;
}
