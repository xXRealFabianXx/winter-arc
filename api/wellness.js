// Garmin wellness (VO2max, resting HR, HRV, sleep, readiness, weight, fitness/fatigue) via intervals.icu.
// Garmin's own developer API is closed to new apps; intervals.icu is an official Garmin partner and offers
// every user a personal API key. Only the site owner (Strava login = OWNER_ATHLETE_ID) may read this.
import { COOKIE, cookies, unseal, env } from "./_lib.js";

const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const s = unseal(cookies(req)[COOKIE] || "");
  if (!s || !s.id) return res.status(401).json({ error: "login" });
  const owner = env("OWNER_ATHLETE_ID");
  if (owner && String(s.id) !== owner) return res.status(403).json({ error: "forbidden" });
  const key = env("INTERVALS_API_KEY"), athlete = env("INTERVALS_ATHLETE_ID") || "0";
  if (!key) return res.status(503).json({ error: "not_configured" });
  const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  const oldest = req.query.oldest && /^\d{4}-\d{2}-\d{2}$/.test(req.query.oldest) ? req.query.oldest : day(-120);
  try {
    const r = await fetch(`https://intervals.icu/api/v1/athlete/${encodeURIComponent(athlete)}/wellness?oldest=${oldest}&newest=${day(1)}`, {
      headers: { Authorization: "Basic " + Buffer.from("API_KEY:" + key).toString("base64"), Accept: "application/json" },
    });
    if (r.status === 401 || r.status === 403) return res.status(502).json({ error: "key" });
    if (r.status === 404) return res.status(502).json({ error: "athlete" });
    if (!r.ok) return res.status(502).json({ error: "intervals", status: r.status });
    const rows = await r.json();
    const days = (Array.isArray(rows) ? rows : []).map((w) => ({
      date: String(w.id || "").slice(0, 10),
      vo2: num(w.vo2max), rhr: num(w.restingHR), hrv: num(w.hrv), sleep: num(w.sleepSecs), sleepScore: num(w.sleepScore),
      ready: num(w.readiness), weight: num(w.weight), steps: num(w.steps), ctl: num(w.ctl), atl: num(w.atl),
    })).filter((d) => d.date).sort((a, b) => (a.date < b.date ? -1 : 1));
    return res.status(200).json({ fetchedAt: Date.now(), days });
  } catch (e) {
    console.error("wellness", String(e));
    return res.status(502).json({ error: "intervals" });
  }
}
