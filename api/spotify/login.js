import crypto from "node:crypto";
import { env } from "../_lib.js";
import { SP_REDIRECT, spConfigured } from "./_sp.js";

export default function handler(req, res) {
  if (!spConfigured()) { res.status(500).send("SPOTIFY_CLIENT_ID und SPOTIFY_CLIENT_SECRET fehlen in den Vercel-Umgebungsvariablen."); return; }
  const state = crypto.randomBytes(16).toString("hex");
  res.setHeader("Set-Cookie", `wa_sp_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  const u = new URL("https://accounts.spotify.com/authorize");
  u.search = new URLSearchParams({
    client_id: env("SPOTIFY_CLIENT_ID"),
    response_type: "code",
    redirect_uri: SP_REDIRECT(),
    scope: "user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative",
    state,
  }).toString();
  res.redirect(302, u.toString());
}
