import { cookies, sessionCookie, tokenRequest } from "../_lib.js";

export default async function handler(req, res) {
  const { code, state, error, scope } = req.query;
  const c = cookies(req);
  const clearState = "wa_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
  if (error || !code) return res.setHeader("Set-Cookie", clearState).redirect(302, "/?strava=abgelehnt");
  if (!state || state !== c.wa_state) return res.setHeader("Set-Cookie", clearState).redirect(302, "/?strava=fehler");
  if (!String(scope || "").includes("activity:read")) return res.setHeader("Set-Cookie", clearState).redirect(302, "/?strava=rechte");
  try {
    const t = await tokenRequest({ code, grant_type: "authorization_code" });
    res.setHeader("Set-Cookie", [
      sessionCookie({ a: t.access_token, r: t.refresh_token, e: t.expires_at, id: t.athlete && t.athlete.id }),
      clearState,
    ]);
    res.redirect(302, "/?strava=ok");
  } catch {
    res.setHeader("Set-Cookie", clearState).redirect(302, "/?strava=fehler");
  }
}
