// Now playing + remote control of the user's active Spotify device (Spotify Connect).
// GET  /api/spotify/player            -> { connected, playing, track, device }
// GET  /api/spotify/player?playlists=1 -> { playlists: [...] }
// POST /api/spotify/player { action: "play"|"pause"|"next"|"previous"|"playlist", uri? }
import { spAccess, spConfigured } from "./_sp.js";

const API = "https://api.spotify.com/v1";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!spConfigured()) {
    // Only variable NAMES are reported (never values) so typos / missing redeploys are easy to spot.
    const missing = ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"].filter((k) => !(process.env[k] || "").trim());
    const seen = Object.keys(process.env).filter((k) => /spot/i.test(k));
    return res.status(503).json({ error: "not_configured", missing, seen, env: process.env.VERCEL_ENV || null });
  }
  let token;
  try { token = await spAccess(req, res); } catch { return res.status(401).json({ error: "login" }); }
  if (!token) return res.status(401).json({ error: "login" });
  const call = (path, opts = {}) => fetch(API + path, { ...opts, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(opts.headers || {}) } });
  try {
    if (req.method === "GET" && req.query.playlists) {
      const r = await call("/me/playlists?limit=50");
      if (!r.ok) return res.status(r.status === 401 ? 401 : 502).json({ error: "spotify" });
      const j = await r.json();
      return res.status(200).json({ playlists: (j.items || []).filter(Boolean).map((p) => ({ name: p.name, uri: p.uri, image: p.images && p.images.length ? p.images[p.images.length - 1].url : null })) });
    }
    if (req.method === "GET") {
      const r = await call("/me/player?additional_types=episode");
      if (r.status === 204) return res.status(200).json({ connected: true, playing: false, track: null, device: null });
      if (r.status === 401) return res.status(401).json({ error: "login" });
      if (!r.ok) return res.status(502).json({ error: "spotify" });
      const j = await r.json(), it = j.item || {};
      return res.status(200).json({
        connected: true, playing: !!j.is_playing,
        device: j.device ? { name: j.device.name, type: j.device.type } : null,
        track: it.name ? { name: it.name, artist: (it.artists || []).map((a) => a.name).join(", ") || (it.show && it.show.name) || "", image: ((it.album && it.album.images) || it.images || []).slice(-2)[0]?.url || null, progress: j.progress_ms || 0, duration: it.duration_ms || 0 } : null,
      });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const map = { play: ["PUT", "/me/player/play"], pause: ["PUT", "/me/player/pause"], next: ["POST", "/me/player/next"], previous: ["POST", "/me/player/previous"], playlist: ["PUT", "/me/player/play"] };
      const m = map[body.action]; if (!m) return res.status(400).json({ error: "action" });
      const payload = body.action === "playlist" && typeof body.uri === "string" && /^spotify:(playlist|album):[A-Za-z0-9]+$/.test(body.uri) ? JSON.stringify({ context_uri: body.uri }) : undefined;
      const r = await call(m[1], { method: m[0], body: payload });
      if (r.status === 404) return res.status(409).json({ error: "no_device" });
      if (r.status === 403) return res.status(403).json({ error: "premium" });
      if (r.status === 401) return res.status(401).json({ error: "login" });
      if (!r.ok && r.status !== 204) return res.status(502).json({ error: "spotify" });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "method" });
  } catch (e) {
    console.error("spotify player", String(e));
    return res.status(502).json({ error: "spotify" });
  }
}
