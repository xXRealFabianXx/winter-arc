// Returns the athlete's activities since 14 Sept 2026 plus FTP, weight and bikes.
import { COOKIE, cookies, unseal, sessionCookie, tokenRequest } from "./_lib.js";

const AFTER = Math.floor(Date.UTC(2026, 8, 13) / 1000);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  let s = unseal(cookies(req)[COOKIE] || "");
  if (!s || !s.r) return res.status(401).json({ error: "login" });
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
      if (!r.ok) throw { status: 502 };
      return r.json();
    };
    const acts = [];
    for (let page = 1; page <= 5; page++) {
      const a = await get(`/athlete/activities?after=${AFTER}&per_page=200&page=${page}`);
      acts.push(...a);
      if (a.length < 200) break;
    }
    const ath = await get("/athlete");
    res.status(200).json({
      fetchedAt: Date.now(),
      athlete: {
        first_name: ath.firstname || null,
        weight: ath.weight || null,
        ftp: ath.ftp || null,
        bikes: (ath.bikes || []).map((b) => ({ name: b.name, km: (b.distance || 0) / 1000, primary: !!b.primary, retired: !!b.retired })),
      },
      activities: acts.map((a) => ({
        id: String(a.id),
        name: a.name,
        sport_type: a.sport_type || a.type,
        start_local: a.start_date_local,
        summary: { moving_time: a.moving_time, distance: a.distance, elevation_gain: a.total_elevation_gain },
        poly: (a.map && a.map.summary_polyline) || null,
        watts: a.average_watts || null,
        np: a.weighted_average_watts || null,
        hr: a.average_heartrate || null,
        kmh: a.average_speed ? Math.round(a.average_speed * 36) / 10 : null,
      })),
    });
  } catch (e) {
    const st = e && e.status;
    res.status(st === 401 ? 401 : st === 429 ? 429 : 502).json({ error: st === 401 ? "login" : st === 429 ? "limit" : "strava" });
  }
}
