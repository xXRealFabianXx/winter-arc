"use strict";
/* Winter Arc — training mode. Full-screen view for the session you are doing right now.
   Strength: one exercise at a time, set by set, with a rest timer. Bike: interval timer with target watts.
   Progress is kept in localStorage ("wa.live") so a reload continues where you left off.
   Loaded before app.js; it only touches app.js globals when the user starts a session. */
const Focus = (function () {
  const LK = "wa.live";
  let F = null, tick = null, wake = null, audio = null;
  const el = () => document.getElementById("focus");
  const fc = () => { const f = el(); let c = document.getElementById("fcontent"); if (!c) { f.innerHTML = '<div id="fcontent"></div><div id="fmusic" class="f-music"></div>'; c = document.getElementById("fcontent"); } return c; };
  const save = () => { try { if (F) localStorage.setItem(LK, JSON.stringify(F)); else localStorage.removeItem(LK); } catch (_) {} };
  const loadLive = () => { try { return JSON.parse(localStorage.getItem(LK) || "null"); } catch (_) { return null; } };
  const mmss = (sec) => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s2 = sec % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s2).padStart(2, "0"); };

  /* ---------- helpers ---------- */
  function dayFor(date) { const i = idx(date); return (R && R.allDays[i]) || { i, d: (new Date(date + "T12:00:00").getDay() + 6) % 7, date, extraEx: [], done: [], keys: [], e: {}, status: "free" }; }
  function sessFor(date, key) { if (key === "free") return { key: "free", cat: "bike", title: "Freie Fahrt", detail: "", min: 0, free: true }; return sessFor0(date, key); }
  function sessFor0(date, key) { const w = Math.max(0, Math.floor(idx(date) / 7)); const day = dayFor(date); if (CAT[key] === "bike") { const s = day.keys[0] === key ? sessOf(day) : sess(key, w); return s; } return sess(key, w); }
  function targetReps(r) { const m = String(r).match(/(\d+)\s*[–-]\s*(\d+)/); if (m) return +m[2]; const n = parseInt(r, 10); return n > 0 ? n : 8; }
  async function keepAwake() { try { if ("wakeLock" in navigator && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (_) { wake = null; } }
  function releaseAwake() { try { if (wake) wake.release(); } catch (_) {} wake = null; }
  function beep() {
    try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch (_) {}
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.22].forEach((t) => { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.0001, audio.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.18); o.connect(g).connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.2); });
    } catch (_) {}
  }

  /* ---------- bike: build segments from the workout text ---------- */
  function bikeSegments(s) {
    const total = s.min * 60, txt = s.detail, segs = [];
    const zone = (k) => (Z[k] ? k : "Z2");
    const label = { Z2: "Grundlage", TEMPO: "Tempo", SS: "Sweetspot", SCHW: "Schwelle", VO2: "VO2max" };
    if (/FTP/.test(s.title)) return [{ n: "FTP-Test auf Zwift", z: null, d: total, info: "Workout „FTP Test“ in Zwift starten. Danach den 20′-Schnitt unter Tests eintragen." }];
    const m = txt.match(/(\d+)\s*×\s*(\d+)\s*([′″])\s*(?:@\s*\{(\w+)\}|Sprint)/);
    if (s.easy || !m) return [{ n: s.easy ? "Locker" : s.title, z: "Z2", d: total }];
    const reps = +m[1], work = +m[2] * (m[3] === "″" ? 1 : 60), z = m[4] ? zone(m[4]) : "VO2";
    const restM = txt.match(/(\d+)\s*′\s*locker/), rest = restM ? +restM[1] * 60 : Math.max(60, Math.round(work / 2));
    const block = reps * work + (reps - 1) * rest, warm = Math.min(15 * 60, Math.max(8 * 60, Math.round((total - block) * 0.55)));
    segs.push({ n: "Einfahren", z: "Z2", d: warm });
    for (let i = 0; i < reps; i++) { segs.push({ n: (m[4] ? label[z] || "Intervall" : "Sprint") + " " + (i + 1) + "/" + reps, z: m[4] ? z : null, d: work, hard: true, info: m[4] ? "" : "Voll antreten" }); if (i < reps - 1) segs.push({ n: "Locker", z: "Z2", d: rest }); }
    const after = total - warm - block; if (after > 60) segs.push({ n: txt.includes("Rest Z2") || after > 20 * 60 ? "Grundlage" : "Ausfahren", z: "Z2", d: after });
    return segs;
  }
  const watts = (z) => (z ? fillW("{" + z + "}") : "");

  /* ---------- lifecycle ---------- */
  function start(date, key) {
    const live = loadLive();
    if (live && live.date === date && live.key === key) { F = live; if (F.phase === "rest") F.phase = "go"; }
    else {
      const s = sessFor(date, key);
      const clone = (o) => (o === undefined || o === null ? null : JSON.parse(JSON.stringify(o)));
      const snap = { L: clone(S.L[date]), C: clone(S.C[date]), F: clone(S.F[date]), E: clone(S.E[date]) };
      F = { snap, date, key, cat: key === "free" ? "bike" : CAT[key], free: key === "free", laps: [], phase: "go", started: Date.now(), i: 0, set: 0, restEnd: 0, restDur: 90, elapsed: 0, runFrom: 0 };
      if (F.cat === "gym" && !(S.L[date] && S.L[date].key === key)) { logOf(date, key); saveLog(date); }
      if (F.cat === "bike") F.segs = F.free ? [] : bikeSegments(s);
    }
    save(); open();
  }
  function musicBar() {
    const m = document.getElementById("fmusic"); if (!m) return;
    const url = musicUrl(), emb = spotifyEmbed(url);
    if (m.dataset.url === (emb || "") && m.childElementCount) return; // keep the player (and the music) running
    m.dataset.url = emb || "";
    if (emb) m.innerHTML = `<button type="button" class="f-mtoggle" data-fm="toggle"><span>♫</span><b>Musik</b><span class="label">Spotify</span></button><div class="f-mplayer" hidden><iframe src="${emb}" title="Spotify-Player" width="100%" height="152" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>`;
    else m.innerHTML = `<button type="button" class="f-mtoggle" data-fm="toggle"><span>♫</span><b>Playlist verbinden</b><span class="label">Spotify</span></button><div class="f-mplayer" hidden><form class="exadd" data-fmusic="1"><input type="text" name="u" placeholder="Spotify-Link der Playlist" aria-label="Spotify-Link"><button class="btn sm rad" type="submit">Speichern</button></form><span class="label" style="letter-spacing:.06em">In Spotify: Playlist → Teilen → Link kopieren.</span></div>`;
  }
  function open() {
    const f = el(); fc(); f.hidden = false; document.body.classList.add("focus-open"); musicBar();
    f.dataset.cat = F.cat; f.dataset.intro = "1"; setTimeout(() => { f.dataset.intro = "0"; }, 2800); keepAwake(); draw();
    clearInterval(tick); tick = setInterval(onTick, 250);
  }
  function close(keep) {
    clearInterval(tick); tick = null; releaseAwake();
    if (!keep) { F = null; save(); }
    el().hidden = true; document.body.classList.remove("focus-open"); render();
  }
  /* discard the session: restore what was there before it started (or clear the day if unknown) */
  let armed = 0;
  function reset(date) {
    const live = F && F.date === date ? F : loadLive(); if (!live || live.date !== date) return;
    let snap = live.snap;
    if (!snap) { const e = S.E[date] ? Object.assign({}, S.E[date]) : null; if (e) delete e.manual; snap = { L: null, C: null, F: null, E: e && Object.keys(e).length ? e : null }; }
    if (!("E" in snap)) { const e = S.E[date] ? Object.assign({}, S.E[date]) : null; if (e) delete e.manual; snap.E = e && Object.keys(e).length ? e : null; }
    [["L", "logs"], ["C", "checks"], ["F", "fb"], ["E", "entries"]].forEach(([k, col]) => {
      const v = snap[k];
      if (v) { S[k][date] = v; DB.doc(col + "/" + date).set(v).catch(() => {}); }
      else { delete S[k][date]; DB.doc(col + "/" + date).delete().catch(() => {}); }
    });
    F = live; close(false); toast("Training verworfen");
  }
  function confirmReset(btn, date) {
    if (armed && Date.now() - armed < 4000) { armed = 0; reset(date); return; }
    armed = Date.now(); if (btn) { btn.textContent = "Wirklich verwerfen?"; btn.classList.add("danger"); }
    setTimeout(() => { if (armed && Date.now() - armed >= 4000) { armed = 0; if (btn && btn.isConnected) { btn.textContent = btn.dataset.label || "Training verwerfen"; btn.classList.remove("danger"); } } }, 4100);
  }
  function isLive(date) { const l = loadLive(); return !!(l && l.date === date); }

  /* ---------- strength ---------- */
  function list() { const day = dayFor(F.date), s = sessFor(F.date, F.key); return { day, s, items: sessionList(day, s) }; }
  function setVals(name, setIdx) {
    const L = S.L[F.date], cur = L && L.ex[name] && L.ex[name].sets ? L.ex[name].sets : [];
    if (cur[setIdx]) return cur[setIdx];
    const prevSet = setIdx > 0 && cur[setIdx - 1] ? cur[setIdx - 1] : null;
    const last = lastLog(name, F.date), lastSet = last && last.sets && last.sets[setIdx];
    return { kg: (prevSet && prevSet.kg) || (lastSet && lastSet.kg) || (last && last.kg) || 0, r: (prevSet && prevSet.r) || (lastSet && lastSet.r) || (last && last.r) || null };
  }
  function setOf(name, i) { const L = S.L[F.date], e = L && L.ex[name]; return e && e.sets && e.sets[i] ? e.sets[i] : null; }
  function writeSet(name, i, patch) {
    const L = logOf(F.date, F.key), e = Object.assign({}, L.ex[name] || {}); e.sets = (e.sets || []).slice();
    const cur = Object.assign({}, e.sets[i] || {}, patch); Object.keys(cur).forEach((k) => { if (cur[k] === null || cur[k] === "" || cur[k] === 0 || cur[k] === false) delete cur[k]; });
    e.sets[i] = Object.keys(cur).length ? cur : null;
    const ss = e.sets.filter(Boolean), last = ss.slice().reverse().find((z) => z.kg || z.r);
    e.s = ss.filter((z) => z.done || z.kg || z.r).length; if (last) { if (last.kg) e.kg = last.kg; else delete e.kg; if (last.r) e.r = last.r; else delete e.r; } else { delete e.kg; delete e.r; }
    if (ss.length) L.ex[name] = e; else delete L.ex[name];
    saveLog(F.date);
    const c = S.C[F.date], has = c && c.key === F.key && c.ex.includes(name), any = e.sets.some((z) => z && z.done);
    if (any !== !!has) toggleEx(F.date, F.key, name, true);
  }
  function toggleSet(i) { const { items } = list(), it = items[F.i]; if (!it) return; const cur = setOf(it.n, i); writeSet(it.n, i, { done: !(cur && cur.done) }); draw(); }
  function doneSet() { // tick the next open set; values stay optional
    const { s, items } = list(), it = items[F.i]; if (!it) return;
    const sets = s.test ? 1 : it.s; let i = 0; while (i < sets && setOf(it.n, i) && setOf(it.n, i).done) i++;
    if (i < sets) { writeSet(it.n, i, { done: true }); i++; }
    if (i >= sets) { if (F.i + 1 < items.length) { F.i++; toast("Weiter: " + items[F.i].n); } else F.phase = "summary"; }
    F.phase = F.phase === "summary" ? "summary" : "go"; save(); draw();
  }
  function onSetInput(inp) { const v = parseFloat(String(inp.value).replace(",", ".")); writeSet(inp.dataset.n, +inp.dataset.si, { [inp.dataset.fk]: v > 0 ? v : null }); }
  function startRest() { F.phase = "rest"; F.restEnd = Date.now() + F.restDur * 1000; F.beeped = false; }
  function jump(i) { const { items } = list(); if (i < 0 || i >= items.length) return; F.i = i; F.set = Math.min(F.set, 0); F.phase = "go"; const L = S.L[F.date], e = L && L.ex[items[i].n]; F.set = e && e.sets ? Math.min(e.sets.filter(Boolean).length, (items[i].s || 3) - 1) : 0; save(); draw(); }

  /* ---------- bike timer ---------- */
  function bikeElapsed() { return F.elapsed + (F.runFrom ? (Date.now() - F.runFrom) / 1000 : 0); }
  function bikeToggle0() { if (F.runFrom) { F.elapsed = bikeElapsed(); F.runFrom = 0; } else { F.runFrom = Date.now(); if (F.phase === "go") F.phase = "ride"; } save(); draw(); }
  function bikeSkip(dir) { const segs = F.segs; let t = 0, cur = 0; const e = bikeElapsed(); for (let i = 0; i < segs.length; i++) { if (e < t + segs[i].d) { cur = i; break; } t += segs[i].d; cur = i; } const target = Math.max(0, Math.min(segs.length - 1, cur + dir)); let start2 = 0; for (let i = 0; i < target; i++) start2 += segs[i].d; F.elapsed = start2 + 0.5; if (F.runFrom) F.runFrom = Date.now(); save(); draw(); }

  function bikeToggle() { bikeToggle0(); }

  /* ---------- ticking ---------- */
  function onTick() {
    if (!F) return;
    if (F.cat === "gym" && F.phase === "rest") {
      const left = (F.restEnd - Date.now()) / 1000;
      if (left <= 0 && !F.beeped) { F.beeped = true; beep(); save(); }
      const t = document.getElementById("rtime"), ring = document.getElementById("rring");
      if (t) t.textContent = left > 0 ? mmss(left) : "Los!";
      if (ring) { const L2 = 2 * Math.PI * 88; ring.style.strokeDashoffset = (L2 * (1 - Math.max(0, left) / F.restDur)).toFixed(1); }
    }
    if (F.free) { const t2 = document.getElementById("bfree"); if (t2) t2.textContent = mmss(bikeElapsed()); const lp = document.getElementById("blap"); if (lp) lp.textContent = mmss(bikeElapsed() - (F.laps.length ? F.laps[F.laps.length - 1] : 0)); return; }
    if (F.cat === "bike" && F.runFrom) {
      const e = bikeElapsed(), segs = F.segs; let t = 0, cur = segs.length - 1;
      for (let i = 0; i < segs.length; i++) { if (e < t + segs[i].d) { cur = i; break; } t += segs[i].d; }
      if (F.cur !== undefined && cur !== F.cur) { beep(); draw(); }
      F.cur = cur;
      const seg = segs[cur], segLeft = t + seg.d - e, total = segs.reduce((a, b) => a + b.d, 0);
      const st = document.getElementById("bseg"), bt = document.getElementById("btotal"), bar = document.getElementById("bbar"), sb = document.getElementById("bsegbar");
      if (st) st.textContent = mmss(segLeft); if (bt) bt.textContent = mmss(e) + " / " + mmss(total);
      if (bar) bar.style.width = Math.min(100, (e / total) * 100).toFixed(1) + "%";
      if (sb) sb.style.width = Math.min(100, ((seg.d - segLeft) / seg.d) * 100).toFixed(1) + "%";
      if (e >= total && F.phase !== "summary") { F.elapsed = total; F.runFrom = 0; F.phase = "summary"; beep(); save(); draw(); }
    }
  }

  /* ---------- drawing ---------- */
  function head(title, sub) {
    return `<header class="f-top"><button type="button" class="f-x" data-f="close" aria-label="Trainingsmodus schließen">✕</button><div class="f-tt"><span class="label">${esc(sub)}</span><b>${esc(title)}</b></div><span class="f-clock num" id="fclock">${mmss((Date.now() - F.started) / 1000)}</span></header>`;
  }
  function draw() {
    const f = el(); if (!F) return;
    f.dataset.run = "0";
    if (F.cat === "bike" && !F.free && F.segs && F.segs.length) { const e = bikeElapsed(); let t = 0, c = F.segs.length - 1; for (let i = 0; i < F.segs.length; i++) { if (e < t + F.segs[i].d) { c = i; break; } t += F.segs[i].d; } f.dataset.hard = F.segs[c].hard && F.runFrom ? "1" : "0"; } else f.dataset.hard = "0";
    if (F.cat === "bike") return drawBike(f);
    const { s, items } = list(), it = items[F.i];
    const dots = `<div class="f-dots">${items.map((x, i) => { const L = S.L[F.date], e = L && L.ex[x.n], n = e && e.sets ? e.sets.filter(Boolean).length : 0; return `<button type="button" class="f-dot${i === F.i ? " cur" : ""}${n ? " ok" : ""}" data-fj="${i}" aria-label="${esc(x.n)}"></button>`; }).join("")}</div>`;
    if (F.phase === "summary") return drawSummary(f, s, items);
    const st = el().scrollTop, ln = lastNote(F.key, F.date);
    let tot = 0, dn = 0;
    const cards = items.map((x) => {
      const sets = x.s || 1, last = lastLog(x.n, F.date);
      for (let i = 0; i < sets; i++) { tot++; const z = setOf(x.n, i); if (z && z.done) dn++; }
      const tag = x.extra ? "Nachholen · " : x.added ? "Zusätzlich · " : "";
      return `<section class="f-excard" data-sort-id="${esc(x.n)}"><div class="f-exh"><span class="grip" role="button" tabindex="0" aria-label="${esc(x.n)} verschieben: festhalten und ziehen">⠿</span>
        <div class="f-exn"><b class="${x.n.length > 13 ? "long" : ""}">${esc(x.n)}</b><span class="label">${tag}${s.test ? "Test · 6 saubere Wdh." : esc(sets + " × " + x.r + " Wdh.")}${last ? " · zuletzt " + esc(logTxt(last)) : ""}</span></div>
        <button type="button" class="f-rm" data-frm="${esc(x.n)}" aria-label="${esc(x.n)} aus diesem Training entfernen">✕</button></div>${setTable(x, sets, last)}
        <div class="f-setsadj"><button type="button" class="btn sm" data-fsets="-1" data-n="${esc(x.n)}" data-cur="${sets}" ${sets <= 1 ? "disabled" : ""}>− Satz</button><span class="label">${sets} ${sets === 1 ? "Satz" : "Sätze"}</span><button type="button" class="btn sm" data-fsets="1" data-n="${esc(x.n)}" data-cur="${sets}" ${sets >= 10 ? "disabled" : ""}>+ Satz</button></div></section>`;
    }).join("");
    fc().innerHTML = head(s.title, s.test ? "Testtraining" : "Krafttraining") + `<div class="f-session calm"><div><span class="label">Im Training seit</span><b class="num" id="fsess">${mmss((Date.now() - F.started) / 1000)}</b></div><div class="f-prog"><span class="label">Sätze</span><b class="num" id="fprog">${dn}/${tot}</b></div><button type="button" class="btn sm kraft f-addbtn" data-f="addopen">+ Übung</button></div>
      <div class="f-addpanel" id="faddpanel" ${F.addOpen ? "" : "hidden"}><form class="exadd" data-fadd="1"><input type="text" name="n" placeholder="Name der Übung" maxlength="40" autocomplete="off" required aria-label="Übung zu diesem Training hinzufügen"><button class="btn sm kraft" type="submit">Hinzufügen</button></form>
        <div class="f-sugg">${suggestions(items).map((n) => `<button type="button" class="opt sm" data-fsugg="${esc(n)}"><b>+ ${esc(n)}</b></button>`).join("")}</div></div>
      <div class="f-body">
      ${ln ? `<div class="lastnote"><span class="label">Notiz vom letzten Mal · ${dm(ln.date)}</span><p>${esc(ln.note)}</p></div>` : ""}
      <div class="f-exlist" data-sort="sess|${F.date}|${F.key}">${cards || `<p class="empty">Keine Übungen. Füg unten welche hinzu.</p>`}</div>
      <button type="button" class="btn f-addwide" data-f="addopen">+ Übung hinzufügen</button>
      <span class="label" style="letter-spacing:.06em">Kreis antippen hakt den Satz ab. Gewicht und Wiederholungen sind optional, trag sie ein, wann du willst. Reihenfolge am Griff ⠿ ändern.</span>
      <button type="button" class="btn kraft f-cta" data-f="summary">Training abschließen</button>
      <button type="button" class="btn ghost-danger" data-f="reset" data-label="Training verwerfen">Training verwerfen</button></div>`;
    el().scrollTop = st;
  }
  function suggestions(items) {
    const have = new Set(items.map((x) => x.n.toLowerCase())), out = [];
    ["push", "pull", "legs"].forEach((k) => baseList(k).forEach((e) => { if (!have.has(e.n.toLowerCase()) && !out.includes(e.n)) out.push(e.n); }));
    Object.values(S.L).forEach((l) => (l.extra || []).forEach((n) => { if (!have.has(n.toLowerCase()) && !out.includes(n)) out.push(n); }));
    return out.slice(0, 12);
  }
  function refreshProgress() { const f = el(); let tot = 0, dn = 0; f.querySelectorAll(".f-exlist .f-setrow").forEach((r) => { tot++; if (r.classList.contains("ok")) dn++; }); const p = document.getElementById("fprog"); if (p) p.textContent = dn + "/" + tot; }
  function setTable(it, sets, last) {
    const rows = Array.from({ length: sets }, (_, i) => {
      const v = setOf(it.n, i) || {}, ls = last && last.sets && last.sets[i];
      const phKg = ls && ls.kg ? fN(ls.kg, 1) : last && last.kg ? fN(last.kg, 1) : "–", phR = ls && ls.r ? ls.r : last && last.r ? last.r : targetReps(it.r);
      return `<div class="f-setrow${v.done ? " ok" : ""}"><button type="button" class="f-chk" data-fset="${i}" data-n="${esc(it.n)}" aria-pressed="${!!v.done}" aria-label="Satz ${i + 1} ${v.done ? "offen setzen" : "abhaken"}">${v.done ? "✓" : i + 1}</button>
        <label><input type="number" inputmode="decimal" step="0.5" min="0" value="${v.kg || ""}" placeholder="${phKg}" data-fin data-n="${esc(it.n)}" data-si="${i}" data-fk="kg" aria-label="Satz ${i + 1} Gewicht"><span>kg</span></label>
        <label><input type="number" inputmode="numeric" step="1" min="0" value="${v.r || ""}" placeholder="${phR}" data-fin data-n="${esc(it.n)}" data-si="${i}" data-fk="r" aria-label="Satz ${i + 1} Wiederholungen"><span>Wdh.</span></label></div>`;
    }).join("");
    return `<div class="f-settable">${rows}</div>`;
  }
  function nextLabel(it, sets, items) {
    let i = 0; while (i < sets && setOf(it.n, i) && setOf(it.n, i).done) i++;
    if (i < sets) return "Satz " + (i + 1) + " abhaken";
    return F.i + 1 < items.length ? "Nächste Übung ›" : "Zum Abschluss ›";
  }
  function drawSummary(f, s, items) {
    const L = S.L[F.date] || { ex: {} }; let vol = 0, setsN = 0;
    const rows = items.map((x) => {
      const e = L.ex[x.n], ss = e && e.sets ? e.sets.filter((z) => z && (z.done || z.kg || z.r)) : [];
      ss.forEach((z) => { vol += (z.kg || 0) * (z.r || 0); setsN++; });
      return `<li><span>${esc(x.n)}</span><span class="num">${ss.length ? ss.map((z) => (z.kg ? fN(z.kg, 1) : "–") + "×" + (z.r || "–")).join("  ") : "ausgelassen"}</span></li>`;
    }).join("");
    const mins = Math.round((Date.now() - F.started) / 60000);
    fc().innerHTML = head(s.title, "Abschluss") + `<div class="f-body sum">
      <h2 class="xl grad-done">Stark.</h2>
      <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="kpi"><span class="label">Sätze</span><span class="v num">${setsN}</span></div><div class="kpi"><span class="label">Bewegt</span><span class="v num">${fN(vol / 1000, 1)}<small>t</small></span></div><div class="kpi"><span class="label">Dauer</span><span class="v num">${mins}<small>min</small></span></div></div>
      <ul class="f-sum">${rows}</ul>
      <label class="note"><span class="label">Notiz zum Training</span><textarea rows="3" maxlength="600" placeholder="Wie lief's? Was nächstes Mal ändern?" data-note="${F.date}" data-k="${F.key}">${esc(L.note || "")}</textarea></label>
      ${feedbackBlock(dayFor(F.date), s)}
      <button type="button" class="btn kraft f-cta" data-f="finish">Training beenden</button>
      <button type="button" class="btn" data-f="back">Zurück zur Übersicht</button>
      <button type="button" class="btn ghost-danger" data-f="reset" data-label="Training verwerfen">Training verwerfen</button></div>`;
  }
  function drawFree(f) {
    const e = bikeElapsed(), s = sessFor(F.date, "free");
    const zones = [["Z1", "Erholung", "{Z2}", 0], ["Z2", "Grundlage", "{Z2}"], ["Z3", "Tempo", "{TEMPO}"], ["SS", "Sweetspot", "{SS}"], ["Z4", "Schwelle", "{SCHW}"], ["Z5", "VO2max", "{VO2}"]].slice(1);
    if (F.phase === "summary") {
      fc().innerHTML = head("Freie Fahrt", "Geschafft") + `<div class="f-body sum"><h2 class="xl grad-rad">Stark.</h2>
        <div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="kpi"><span class="label">Gefahren</span><span class="v num">${mmss(e)}</span></div><div class="kpi"><span class="label">Runden</span><span class="v num">${F.laps.length}</span></div></div>
        ${F.laps.length ? `<ul class="f-sum">${F.laps.map((x, i) => `<li><span>Runde ${i + 1}</span><span class="num">${mmss(x - (i ? F.laps[i - 1] : 0))}</span></li>`).join("")}</ul>` : ""}
        ${feedbackBlock(dayFor(F.date), { cat: "gym" })}
        <button type="button" class="btn rad f-cta" data-f="finish">Fahrt beenden</button>
        <span class="label" style="letter-spacing:.06em">Die Fahrt zählt automatisch als Radeinheit, sobald sie in Strava ist. War eigentlich ein Intervalltraining dran, gib unter Heute „Andere Einheit“ an, dann wird es nachgeholt.</span></div>`;
      return;
    }
    fc().innerHTML = head("Freie Fahrt", F.runFrom ? "Läuft" : F.phase === "go" ? "Bereit" : "Pause") + `<div class="f-body bike">
      <div class="f-ex"><span class="label">Einfach fahren</span><h2 class="xl grad-rad">Ohne Plan</h2><span class="f-last">Keine Vorgaben. Die Zonen unten helfen bei der Orientierung.</span></div>
      <div class="f-bigwrap"><span class="f-ripple" aria-hidden="true"><i></i><i></i><i></i></span><div class="f-big num" id="bfree">${mmss(e)}</div></div>
      <div class="f-total"><span class="label">Aktuelle Runde</span><span class="num" id="blap">${mmss(e - (F.laps.length ? F.laps[F.laps.length - 1] : 0))}</span></div>
      <div class="f-adj"><button type="button" class="btn ${F.runFrom ? "" : "rad"} f-play" data-f="play">${F.runFrom ? "Pause" : F.phase === "go" ? "▶ Start" : "▶ Weiter"}</button><button type="button" class="btn" data-f="lap" ${F.runFrom ? "" : "disabled"}>Runde</button></div>
      <div class="f-zones">${zones.map((z) => `<div><span class="label">${z[0]} · ${z[1]}</span><b class="num">${esc(fillW(z[2]))}</b></div>`).join("")}</div>
      ${F.laps.length ? `<ul class="f-sum">${F.laps.slice().reverse().slice(0, 5).map((x, j) => { const i = F.laps.length - 1 - j; return `<li><span>Runde ${i + 1}</span><span class="num">${mmss(x - (i ? F.laps[i - 1] : 0))}</span></li>`; }).join("")}</ul>` : ""}
      <button type="button" class="btn" data-f="end">Fahrt beenden</button>
      <button type="button" class="btn ghost-danger" data-f="reset" data-label="Fahrt verwerfen">Fahrt verwerfen</button></div>`;
  }
  function drawBike(f) {
    if (F.free) return drawFree(f);
    const s = sessFor(F.date, F.key), segs = F.segs, e = bikeElapsed(), total = segs.reduce((a, b) => a + b.d, 0);
    let t = 0, cur = segs.length - 1; for (let i = 0; i < segs.length; i++) { if (e < t + segs[i].d) { cur = i; break; } t += segs[i].d; } F.cur = cur;
    const seg = segs[cur], next = segs[cur + 1];
    if (F.phase === "summary") {
      fc().innerHTML = head(s.title, "Geschafft") + `<div class="f-body sum"><h2 class="xl grad-rad">Stark.</h2>
        <div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="kpi"><span class="label">Gefahren</span><span class="v num">${mmss(e)}</span></div><div class="kpi"><span class="label">Abschnitte</span><span class="v num">${segs.length}</span></div></div>
        ${feedbackBlock(dayFor(F.date), s)}
        ${/FTP/.test(s.title) ? `<button type="button" class="btn rad f-cta" data-f="tests">20′-Schnitt eintragen</button>` : ""}
        <button type="button" class="btn ${/FTP/.test(s.title) ? "" : "rad f-cta"}" data-f="finish">Training beenden</button>
        <span class="label" style="letter-spacing:.06em">Die Fahrt zählt automatisch, sobald sie in Strava ist.</span></div>`;
      return;
    }
    fc().innerHTML = head(s.title, F.runFrom ? "Läuft" : F.phase === "go" ? "Bereit" : "Pause") + `<div class="f-body bike">
      <div class="f-segs">${segs.map((x, i) => `<span class="${i < cur ? "ok" : i === cur ? "cur" : ""}${x.hard ? " hard" : ""}" style="flex:${x.d}"></span>`).join("")}</div>
      <div class="f-ex"><span class="label">${next ? "Abschnitt " + (cur + 1) + " von " + segs.length : "Letzter Abschnitt"}</span><h2 class="xl ${seg.hard ? "grad-rad" : ""}">${esc(seg.n)}</h2>
        ${seg.z ? `<span class="f-watt num">${esc(watts(seg.z))}</span>` : ""}${seg.info ? `<span class="f-last">${esc(seg.info)}</span>` : ""}</div>
      <div class="f-bigwrap"><span class="f-ripple" aria-hidden="true"><i></i><i></i><i></i></span><div class="f-big num" id="bseg">${mmss(seg.d - (e - t))}</div></div>
      <div class="track rad"><i id="bsegbar" style="width:${Math.min(100, ((e - t) / seg.d) * 100).toFixed(1)}%"></i></div>
      ${next ? `<div class="f-next"><span class="label">Danach</span><b>${esc(next.n)}</b><span>${mmss(next.d)}${next.z ? " · " + esc(watts(next.z)) : ""}</span></div>` : ""}
      <div class="f-adj"><button type="button" class="btn" data-f="seg-" ${cur === 0 ? "disabled" : ""}>‹ Zurück</button><button type="button" class="btn ${F.runFrom ? "" : "rad"} f-play" data-f="play">${F.runFrom ? "Pause" : F.phase === "go" ? "▶ Start" : "▶ Weiter"}</button><button type="button" class="btn" data-f="seg+" ${next ? "" : "disabled"}>Weiter ›</button></div>
      <div class="f-total"><span class="label">Gesamt</span><span class="num" id="btotal">${mmss(e)} / ${mmss(total)}</span></div>
      <div class="track"><i id="bbar" style="width:${Math.min(100, (e / total) * 100).toFixed(1)}%"></i></div>
      <button type="button" class="btn" data-f="end">Einheit beenden</button>
      <button type="button" class="btn ghost-danger" data-f="reset" data-label="Training verwerfen">Training verwerfen</button></div>`;
  }

  /* ---------- events ---------- */
  document.addEventListener("click", (ev) => {
    const f = el(); if (!f || f.hidden || !f.contains(ev.target)) return;
    const fb = ev.target.closest("[data-fb]"); if (fb) { setFeedback(fb.dataset.date, fb.dataset.fb, fb.dataset.val); draw(); return; }
    const j = ev.target.closest("[data-fj]"); if (j) { jump(+j.dataset.fj); return; }
    const fs0 = ev.target.closest("[data-fset][data-n]"); if (fs0 && F && F.cat === "gym" && F.phase !== "summary") {
      const name = fs0.dataset.n, i = +fs0.dataset.fset, cur = setOf(name, i), on = !(cur && cur.done);
      writeSet(name, i, { done: on });
      const row = fs0.closest(".f-setrow"); row.classList.toggle("ok", on); fs0.setAttribute("aria-pressed", String(on)); fs0.textContent = on ? "✓" : String(i + 1);
      refreshProgress(); try { if (on && navigator.vibrate) navigator.vibrate(12); } catch (_) {} return;
    }
    const fm = ev.target.closest("[data-fm]"); if (fm) { const p = el().querySelector(".f-mplayer"); if (p) { p.hidden = !p.hidden; fm.classList.toggle("on", !p.hidden); } return; }
    const sg = ev.target.closest("[data-fsugg]"); if (sg) { sessionEx(F.date, F.key, sg.dataset.fsugg, "add"); F.addOpen = false; save(); draw(); const L = el().querySelector(".f-exlist"); if (L && L.lastElementChild) L.lastElementChild.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    const ss = ev.target.closest("[data-fsets]"); if (ss && !ss.disabled) { const n = Math.max(1, Math.min(10, +ss.dataset.cur + +ss.dataset.fsets)); setSetsN(F.date, F.key, ss.dataset.n, n); draw(); return; }
    const rmx = ev.target.closest("[data-frm]"); if (rmx) { sessionEx(F.date, F.key, rmx.dataset.frm, "remove"); draw(); return; }
    const fs = ev.target.closest("[data-fset]"); if (fs) { const box = fs.closest(".f-sumex"); if (box) { const name = box.querySelector("summary span").textContent; const cur = setOf(name, +fs.dataset.fset); writeSet(name, +fs.dataset.fset, { done: !(cur && cur.done) }); const open = [...el().querySelectorAll(".f-sumex")].map((d) => d.open); draw(); el().querySelectorAll(".f-sumex").forEach((d, k) => { d.open = open[k]; }); } else toggleSet(+fs.dataset.fset); return; }
    const b = ev.target.closest("[data-f]"); if (!b || b.disabled) return;
    const a = b.dataset.f, kg = document.getElementById("fkg"), rp = document.getElementById("freps");
    if (a === "close") close(true);
    else if (a === "kg-" || a === "kg+") { const v = (parseFloat(String(kg.value).replace(",", ".")) || 0) + (a === "kg+" ? 2.5 : -2.5); kg.value = Math.max(0, v); }
    else if (a === "r-" || a === "r+") { rp.value = Math.max(0, (parseInt(rp.value, 10) || 0) + (a === "r+" ? 1 : -1)); }
    else if (a === "set") doneSet();
    else if (a === "addopen") { F.addOpen = !F.addOpen; save(); const p = document.getElementById("faddpanel"); if (p) { p.hidden = !F.addOpen; if (F.addOpen) { el().scrollTo({ top: 0, behavior: "smooth" }); const i = p.querySelector("input"); if (i) setTimeout(() => i.focus(), 250); } } }
    else if (a === "summary") { F.phase = "summary"; save(); draw(); el().scrollTop = 0; }
    else if (a === "skip") { F.phase = "go"; save(); draw(); }
    else if (a === "rest-" || a === "rest+") { const d = a === "rest+" ? 15 : -15; F.restDur = Math.max(15, F.restDur + d); F.restEnd += d * 1000; save(); onTick(); }
    else if (a === "prev") jump(F.i - 1);
    else if (a === "next") { const { items } = list(); if (F.i + 1 < items.length) jump(F.i + 1); else { F.phase = "summary"; save(); draw(); } }
    else if (a === "back") { F.phase = "go"; save(); draw(); }
    else if (a === "play") bikeToggle();
    else if (a === "lap") { F.laps.push(bikeElapsed()); save(); draw(); }
    else if (a === "seg-") bikeSkip(-1);
    else if (a === "seg+") bikeSkip(1);
    else if (a === "end") { F.elapsed = bikeElapsed(); F.runFrom = 0; F.phase = "summary"; save(); draw(); }
    else if (a === "tests") { close(false); go("tests", true); }
    else if (a === "finish") {
      const date = F.date, key = F.key, k = F.free ? null : key, d = dayFor(date);
      const counted = d.done && d.done.some((o) => o.k === k || (k && CAT[o.k] === CAT[k] && o.a));
      close(false);
      if (k && !counted && idx(date) >= 0 && idx(date) < DAYS) { const e = Object.assign({}, S.E[date] || {}); delete e.rest; e.manual = k; writeEntry(date, e); toast("Training beendet · zählt als Einheit"); }
      else toast("Training beendet");
    }
    else if (a === "reset") confirmReset(b, F.date);
  });
  document.addEventListener("submit", (ev) => { const f = el(); if (!f || f.hidden || !f.contains(ev.target)) return; const fm = ev.target; if (fm.dataset.fmusic) { ev.preventDefault(); if (setMusic(fm.elements.u.value.trim())) { const m = document.getElementById("fmusic"); m.dataset.url = "x"; musicBar(); const p = el().querySelector(".f-mplayer"); if (p) p.hidden = false; } return; } if (fm.dataset.fadd) { ev.preventDefault(); sessionEx(F.date, F.key, fm.elements.n.value, "add"); F.addOpen = false; save(); draw(); const L = el().querySelector(".f-exlist"); if (L && L.lastElementChild) L.lastElementChild.scrollIntoView({ block: "center" }); } });
  document.addEventListener("change", (ev) => { const f = el(); if (!f || f.hidden || !f.contains(ev.target)) return; const fi = ev.target.closest("[data-fin]"); if (fi) { onSetInput(fi); return; } const nt = ev.target.closest("[data-note]"); if (nt) setNote(nt.dataset.note, nt.dataset.k, nt.value); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && F && !el().hidden) { keepAwake(); onTick(); } });
  setInterval(() => { if (!F) return; const t = mmss((Date.now() - F.started) / 1000); const c = document.getElementById("fclock"); if (c) c.textContent = t; const s2 = document.getElementById("fsess"); if (s2) s2.textContent = t; }, 1000);

  /* resume after a reload */
  function resume() { const l = loadLive(); if (l && l.date === TODAY) { F = l; open(); } else if (l) { try { localStorage.removeItem(LK); } catch (_) {} } }
  return { start, isLive, resume, confirmReset, redraw: () => { if (F && !el().hidden) draw(); } };
})();
