import { cookies } from "../_lib.js";
import { SP_REDIRECT, spCookie, spToken } from "./_sp.js";

export default async function handler(req, res) {
  const { code, state, error } = req.query;
  const clear = "wa_sp_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
  if (error || !code) return res.setHeader("Set-Cookie", clear).redirect(302, "/?spotify=abgelehnt#erfolge");
  if (!state || state !== cookies(req).wa_sp_state) return res.setHeader("Set-Cookie", clear).redirect(302, "/?spotify=fehler#erfolge");
  try {
    const t = await spToken({ grant_type: "authorization_code", code, redirect_uri: SP_REDIRECT() });
    res.setHeader("Set-Cookie", [spCookie({ a: t.access_token, r: t.refresh_token, e: Math.floor(Date.now() / 1000) + (t.expires_in || 3600) }), clear]);
    res.redirect(302, "/?spotify=ok#erfolge");
  } catch (e) {
    console.error("Spotify token exchange failed", JSON.stringify((e && e.detail) || String(e)));
    res.setHeader("Set-Cookie", clear).redirect(302, "/?spotify=fehler#erfolge");
  }
}
