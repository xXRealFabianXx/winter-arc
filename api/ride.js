// Analyses one Strava ride: your description + the power stream → sustained efforts ("blocks").
// GET /api/ride?id=<activityId>&ftp=<watts>  ->  { id, desc, power, blocks: [[seconds, avgWatts], ...], b20 }
// Two Strava calls per ride, done once; the site caches the result.
import { COOKIE, cookies, unseal, sessionCookie, tokenRequest } from "./_lib.js";

export function findBlocks(w, ftp) {
  // w: watts per second. Smooth over 30 s, a block is ≥ 60 s at ≥ 75 % FTP (short dips up to 20 s allowed).
  const n = w.length, sm = new Array(n), T = 0.75 * ftp;
  let acc = 0;
  for (let i = 0; i < n; i++) { acc += w[i]; if (i >= 30) acc -= w[i - 30]; sm[i] = acc / Math.min(i + 1, 30); }
  const blocks = [];
  let start = -1, below = 0;
  const close = (end) => {
    // trim the smoothing tail, then average the raw power
    let a = Math.max(0, start - 15), b = end;
    while (a < b && w[a] < T) a++;
    while (b > a && w[b - 1] < T) b--;
    const len = b - a;
    if (len >= 60) { let s = 0; for (let i = a; i < b; i++) s += w[i]; blocks.push([len, Math.round(s / len)]); }
  };
  for (let i = 0; i < n; i++) {
    if (sm[i] >= T) { if (start < 0) start = i; below = 0; }
    else if (start >= 0 && ++below > 20) { close(i - below + 1); start = -1; below = 0; }
  }
  if (start >= 0) close(n - below);
  // best 20 minutes
  let b20 = null;
  if (n >= 1200) { let s = 0; for (let i = 0; i < n; i++) { s += w[i]; if (i >= 1200) s -= w[i - 1200]; if (i >= 1199) b20 = Math.max(b20 || 0, s / 1200); } b20 = Math.round(b20); }
  return { blocks, b20 };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  let s = unseal(cookies(req)[COOKIE] || "");
  if (!s || !s.r) return res.status(401).json({ error: "login" });
  const id = String(req.query.id || "");
  if (!/^\d{1,20}$/.test(id)) return res.status(400).json({ error: "id" });
  const ftp = Math.min(600, Math.max(80, +req.query.ftp || 200));
  try {
    if (!s.e || s.e * 1000 < Date.now() + 60_000) {
      const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: s.r });
      s = { ...s, a: t.access_token, r: t.refresh_token || s.r, e: t.expires_at };
      res.setHeader("Set-Cookie", sessionCookie(s));
    }
    const get = async (p) => {
      const r = await fetch("https://www.strava.com/api/v3" + p, { headers: { Authorization: "Bearer " + s.a } });
      if (r.status === 401) throw { status: 401 };
      if (r.status === 429) throw { status: 429 };
      if (r.status === 404) return null;
      if (!r.ok) throw { status: 502 };
      return r.json();
    };
    const act = await get(`/activities/${id}`);
    if (!act) return res.status(404).json({ error: "notfound" });
    const desc = String(act.description || "").slice(0, 500);
    let power = false, blocks = [], b20 = null;
    if (act.device_watts) {
      const st = await get(`/activities/${id}/streams?keys=watts,time&key_by_type=true`);
      const W = st && st.watts && st.watts.data, Tm = st && st.time && st.time.data;
      if (Array.isArray(W) && W.length > 60) {
        // one value per second of elapsed time (pauses count as 0 W)
        const len = Math.min(Array.isArray(Tm) && Tm.length ? Tm[Tm.length - 1] + 1 : W.length, 6 * 3600 * 2);
        const sec = new Array(len).fill(0);
        for (let i = 0; i < W.length; i++) { const t = Tm ? Tm[i] : i; if (t < len) sec[t] = W[i] || 0; }
        if (Tm) for (let t = 1; t < len; t++) if (sec[t] === 0) { /* fill 1–2 s recording gaps */ const p = sec[t - 1]; if (p && t + 1 < len && sec[t + 1]) sec[t] = p; }
        ({ blocks, b20 } = findBlocks(sec, ftp));
        power = true;
      }
    }
    return res.status(200).json({ id, desc, power, blocks, b20, ftp });
  } catch (e) {
    const st = e && e.status;
    return res.status(st === 401 ? 401 : st === 429 ? 429 : 502).json({ error: st === 401 ? "login" : st === 429 ? "limit" : "strava" });
  }
}
