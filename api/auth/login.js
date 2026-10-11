import crypto from "node:crypto";
import { origin, configured, env, HOST, reqHost } from "../_lib.js";

export default function handler(req, res) {
  if (!configured()) {
    res.status(500).send("STRAVA_CLIENT_ID und STRAVA_CLIENT_SECRET fehlen in den Vercel-Umgebungsvariablen.");
    return;
  }
  // Opened under another address (e.g. a preview URL)? Continue on the main address,
  // so the login cookie and the Strava callback live on the same domain.
  if (reqHost(req) !== HOST) {
    res.redirect(302, origin() + "/api/auth/login");
    return;
  }
  const state = crypto.randomBytes(16).toString("hex");
  res.setHeader("Set-Cookie", `wa_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  const u = new URL("https://www.strava.com/oauth/authorize");
  u.search = new URLSearchParams({
    client_id: env("STRAVA_CLIENT_ID"),
    response_type: "code",
    redirect_uri: origin() + "/api/auth/callback",
    approval_prompt: "auto",
    scope: "read,activity:read_all,profile:read_all",
    state,
  }).toString();
  res.redirect(302, u.toString());
}
