// Personal data store (rest days, pins, ticks, feedback, logs, settings) in Upstash Redis.
// Each Strava athlete gets their own keys; nobody can read or write another athlete's data.
import { COOKIE, cookies, unseal, env } from "./_lib.js";

const COLS = ["entries", "checks", "fb", "logs", "cfg"];
const url = () => env("KV_REST_API_URL") || env("UPSTASH_REDIS_REST_URL");
const tok = () => env("KV_REST_API_TOKEN") || env("UPSTASH_REDIS_REST_TOKEN");

async function redis(cmds) {
  const r = await fetch(url() + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + tok(), "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const s = unseal(cookies(req)[COOKIE] || "");
  if (!s || !s.id) return res.status(401).json({ error: "login" });
  const owner = env("OWNER_ATHLETE_ID");
  if (owner && String(s.id) !== owner) return res.status(403).json({ error: "forbidden" });
  if (!url() || !tok()) return res.status(503).json({ error: "nodb" });
  const key = (c) => `wa:${s.id}:${c}`;
  try {
    if (req.method === "GET") {
      const out = await redis(COLS.map((c) => ["HGETALL", key(c)]));
      const data = {};
      COLS.forEach((c, i) => {
        const arr = (out[i] && out[i].result) || [], o = {};
        for (let j = 0; j < arr.length; j += 2) { try { o[arr[j]] = JSON.parse(arr[j + 1]); } catch { /* skip broken value */ } }
        data[c] = o;
      });
      return res.status(200).json(data);
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const ops = Array.isArray(body.ops) ? body.ops : [];
      if (!ops.length) return res.status(200).json({ ok: true });
      if (ops.length > 500) return res.status(400).json({ error: "too_many" });
      const cmds = [];
      for (const o of ops) {
        if (!o || !COLS.includes(o.col) || typeof o.id !== "string" || !/^[\w.:-]{1,40}$/.test(o.id)) return res.status(400).json({ error: "bad_op" });
        if (o.value === null || o.value === undefined) cmds.push(["HDEL", key(o.col), o.id]);
        else {
          const v = JSON.stringify(o.value);
          if (v.length > 60000) return res.status(413).json({ error: "too_large" });
          cmds.push(["HSET", key(o.col), o.id, v]);
        }
      }
      await redis(cmds);
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method" });
  } catch (e) {
    console.error("data store", String(e));
    return res.status(502).json({ error: "db" });
  }
}
