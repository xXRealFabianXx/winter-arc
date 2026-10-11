"use strict";
/* Winter Arc — app shell: routing, views, editing sheet, storage, Strava. Uses globals from logic.js. */

let R = null;
const VIEWS = ["heute", "woche", "rad", "kraft", "tests", "erfolge"];
let kraftTab = "plan", testRound = null;
let view = "heute";

/* ---------- small helpers ---------- */
const catName = (c) => (c === "bike" ? "Rad" : "Kraft");
const catCls = (c) => (c === "bike" ? "rad" : "kraft");
const levelOf = (xp) => { let lv = 0; LEVELS.forEach((l, i) => { if (xp >= l[0]) lv = i; }); return lv; };
const upcoming = (cat, n) => R.allDays.filter((x) => !x.locked && x.keys.length && x.i >= Math.max(TI, 0) && (!cat || CAT[x.keys[0]] === cat)).slice(0, n);
const stampTxt = () => new Date(S.stamp).toLocaleString("de-DE", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
const ftpProg = () => (S.ftp && S.ftpBase && ftpGoal() > S.ftpBase ? (S.ftp - S.ftpBase) / (ftpGoal() - S.ftpBase) : 0);
const pct = (a, b) => Math.max(0, Math.min(100, b ? (a / b) * 100 : 0)).toFixed(1);
function todayDay() { if (TI < 0) return R.allDays[0]; if (TI >= DAYS) return null; return R.allDays[TI]; }

function statusChip(x) {
  if (x.status === "done" && x.done.some((o) => o.partial)) return `<span class="chip pin">Teilweise</span>`;
  if (x.mod && x.mod.easy && !x.locked) return `<span class="chip pin">Locker</span>`;
  const m = { done: ["done", "Erledigt"], rest: ["", "Ruhetag"], planned: ["", "Geplant"], pin: ["pin", "Festgelegt"], free: ["", "Frei"], empty: ["miss", "Kein Training"], extra: ["", "Extra"] }[x.status] || ["", "Geplant"];
  return `<span class="chip ${m[0]}">${m[1]}</span>`;
}
function dayRow(x, opts) {
  const w = Math.floor(x.i / 7), k = x.keys[0], s = sessOf(x);
  let title = s ? s.title : x.status === "rest" ? "Ruhetag" : x.status === "empty" ? "Kein Training" : "Frei";
  if (x.keys.length > 1) title += " + " + x.keys.slice(1).map((z) => sess(z, w).title).join(" + ");
  let meta = "";
  if (x.done.length) meta = x.done.map((o) => (o.manual ? "ohne Strava eingetragen" : o.a.name + (o.a.cat === "bike" ? " · " + fN(o.a.km, 1) + " km" : " · " + fH(o.a.min) + " h")) + (o.skipped && o.skipped.length ? " · " + o.skipped.length + " ausgelassen" : "")).join(" · ");
  else if (s) meta = s.cat === "bike" ? s.min + "′ · " + fillW(s.detail).split(".")[0] : s.summary + " · " + s.min + "′" + (x.extraEx && x.extraEx.length ? " · +" + x.extraEx.length + " nachholen" : "");
  else if (x.extra.length) meta = x.extra.map((a) => a.name).join(" · ");
  const bar = s ? catCls(s.cat) : "";
  return `<button type="button" class="row${x.i === TI ? " today-row" : ""}" data-i="${x.i}" aria-label="${DOWL[x.d]} ${dm(x.date)} bearbeiten">
    <span class="d"><b>${DOW[x.d]}</b><span class="num">${dm(x.date)}</span></span><span class="bar ${bar}"></span>
    <span class="t"><b>${esc(title)}</b><span>${esc(meta)}</span></span>${opts && opts.noChip ? "" : statusChip(x)}</button>`;
}
function kpi(label, v, small, sub) { return `<div class="kpi"><span class="label">${label}</span><span class="v num">${v}${small ? `<small>${small}</small>` : ""}</span>${sub ? `<span class="s">${sub}</span>` : ""}</div>`; }
function goal(label, cur, target, unit, cls, fmt, bar) {
  const f = fmt || ((n) => fN(n));
  const w = bar === undefined ? pct(cur, target) : Math.max(0, Math.min(100, bar * 100)).toFixed(1);
  return `<div class="goal"><span class="label">${label}</span><div class="v num">${f(cur)} <small>/ ${f(target)} ${unit}</small></div><div class="track ${cls}"><i style="width:${w}%"></i></div></div>`;
}
function weekChart(series, opts) {
  const narrow = window.innerWidth < 600, Wd = narrow ? 380 : 720, H = narrow ? 190 : 200, L = 30, Rp = 4, T = 10, Bt = 22, FS = narrow ? 9.5 : 10, bw = (Wd - L - Rp) / WEEKS, cw = curW();
  const mx = Math.max(opts.min || 1, ...series.map((s) => Math.max(s.plan || 0, s.val)));
  const step = opts.step, top = Math.ceil(mx / step) * step;
  const y = (v) => T + (H - T - Bt) * (1 - v / top);
  let g = "";
  for (let v = 0; v <= top; v += step) g += `<line x1="${L}" x2="${Wd - Rp}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1" fill="none"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="${FS}" font-family="Geist Mono, monospace" fill="var(--muted)">${opts.tick(v)}</text>`;
  series.forEach((s, k) => {
    const x0 = L + k * bw, pw = bw * 0.72, px = x0 + (bw - pw) / 2, aw = bw * 0.46, ax = x0 + (bw - aw) / 2;
    if (s.plan) g += `<rect x="${px}" y="${y(s.plan)}" width="${pw}" height="${y(0) - y(s.plan)}" rx="5" fill="none" stroke="var(--muted)" stroke-dasharray="3 3" stroke-width="1"/>`;
    if (s.val > 0) g += `<rect x="${ax}" y="${y(s.val)}" width="${aw}" height="${Math.max(0, y(0) - y(s.val))}" rx="4" fill="url(#${opts.grad})"/>`;
    g += `<text x="${x0 + bw / 2}" y="${H - 7}" text-anchor="middle" font-size="${FS}" font-family="Geist Mono, monospace" fill="${k === cw ? "var(--ink)" : "var(--muted)"}" font-weight="${k === cw ? 600 : 400}">${narrow && k % 2 && k !== cw ? "" : k + 1}</text>`;
  });
  const defs = `<defs><linearGradient id="gRad" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--rad)"/><stop offset="1" stop-color="var(--rad2)"/></linearGradient><linearGradient id="gKraft" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--kraft)"/><stop offset="1" stop-color="var(--kraft2)"/></linearGradient><linearGradient id="gAll" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--violet)"/><stop offset="1" stop-color="var(--done)"/></linearGradient></defs>`;
  return `<div class="chart"><svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="${esc(opts.aria)}">${defs}${g}</svg></div>`;
}
const recentList = (cat, n) => {
  const list = S.acts.filter((a) => !cat || a.cat === cat).slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, n);
  if (!S.live) return `<p class="empty">Erscheint, sobald Strava verbunden ist.</p>`;
  if (!list.length) return `<p class="empty">Noch keine Einheiten.</p>`;
  const col = { bike: "var(--rad)", gym: "var(--kraft)", other: "var(--faint)" };
  return `<ul class="feed">${list.map((a) => `<li><span style="display:flex;gap:10px;align-items:center;min-width:0"><span class="dot" style="background:${col[a.cat]}"></span><a href="https://www.strava.com/activities/${encodeURIComponent(a.id)}" target="_blank" rel="noopener">${esc(a.name)}</a></span><span class="m num">${dm(a.date)} · ${a.cat === "bike" ? fN(a.km, 1) + " km" : fH(a.min) + " h"}</span></li>`).join("")}</ul>`;
};

/* ---------- views ---------- */
function vHeute() {
  const cw = curW(), W = R.weeks[cw], day = todayDay();
  const eyebrow = !day ? "Saison beendet" : TI < 0 ? "Start morgen · " + DOWL[0] + " " + dm(day.date) : DOWL[day.d] + " " + dm(day.date) + " · Etappe " + (cw + 1);
  let heroTitle = "Ziellinie", heroCls = "grad-done", heroSub = "16 Etappen geschafft.";
  let card = "", extraLog = "";
  if (TI < 0 || TI >= DAYS) extraLog = logCard(pseudoToday());
  if (day && TI < 0) { heroTitle = "Kraft"; heroCls = "grad-kraft"; const s0 = sessOf(day); heroSub = "Plan startet morgen mit " + (s0 ? s0.title : "dem ersten Training") + "."; }
  if (day && TI >= 0) {
    const k = day.keys[0], w = Math.floor(day.i / 7), s = sessOf(day), isToday = day.i === TI, canWrite = S.dbOK;
    if (day.status === "done") { heroTitle = "Erledigt"; heroCls = "grad-done"; heroSub = s ? s.title + " ist im Kasten." : "Stark."; }
    else if (day.status === "rest") { heroTitle = "Ruhetag"; heroCls = ""; heroSub = "Erholung gehört zum Plan. Die Woche ist neu verteilt."; }
    else if (!s) { heroTitle = "Frei"; heroCls = ""; heroSub = "Heute steht nichts an."; }
    else { heroTitle = s.cat === "bike" ? "Rad" : "Kraft"; heroCls = s.cat === "bike" ? "grad-rad" : "grad-kraft"; heroSub = s.title + " · " + s.min + " Minuten"; }
    let body = "";
    if (s) {
      body += `<span class="label">${isToday ? "Geplantes Training" : "Erstes Training"}</span><div class="card-h"><span class="chip ${catCls(s.cat)}"><i></i>${catName(s.cat)} · ${s.min}′</span>${day.status === "done" ? `<span class="chip done">Erledigt</span>` : day.pinned ? `<span class="chip pin">Festgelegt</span>` : ""}</div>
        <div class="t-title ${s.cat === "bike" ? "grad-rad" : "grad-kraft"}">${esc(s.title)}</div>
        <div class="t-detail">${esc(s.cat === "bike" ? fillW(s.detail) : s.test ? s.detail : s.detail + " · " + RIR(w))}</div>`;
      if (s.cat === "bike") body += `<div class="specs">${S.ftp ? `<span class="spec"><span>Z2</span>${fillW("{Z2}")}</span><span class="spec"><span>FTP</span>${S.ftp} W</span>` : `<span class="spec"><span>Zonen</span>in % FTP</span>`}<span class="spec"><span>Dauer</span>${s.min}′</span></div>`;
      if (s.ex) body += exChecklist(day, logSess(day, s));
      if (day.status === "done" || (isToday && day.done.length)) body += feedbackBlock(day, s);
    } else {
      body += `<div class="t-title">${day.status === "rest" ? "Ruhetag" : "Frei"}</div><div class="t-detail">${day.status === "rest" ? "Eingetragen. Die übrigen Einheiten rücken nach." : "Keine Einheit geplant. Leg eine fest, wenn du Lust hast."}</div>`;
    }
    let a = "";
    if (isToday && k) { const ls = s.cat === "gym" ? logSess(day, s) : s; a += `<button class="btn ${s.cat === "bike" ? "rad" : "kraft"} start" type="button" data-start="${ls.key}" data-date="${day.date}">${Focus.isLive(day.date) ? "▶ Training fortsetzen" : "▶ Training starten"}</button>`; }
    if (isToday && Focus.isLive(day.date)) a += `<button class="btn ghost-danger" type="button" data-discard="${day.date}" data-label="Training verwerfen">Training verwerfen</button>`;
    if (isToday && (!s || s.cat === "bike" || day.status === "rest")) a += `<button class="btn" type="button" data-start="free" data-date="${day.date}">Einfach fahren</button>`;
    if (isToday && day.status !== "done" && k) a += `<button class="btn" type="button" data-act="manual" data-k="${k}" ${canWrite ? "" : "disabled"}>✓ Erledigt</button>`;
    if (day.status !== "done") a += `<button class="btn" type="button" data-act="${day.e.rest ? "auto" : "rest"}" ${canWrite ? "" : "disabled"}>${day.e.rest ? "Ruhetag aufheben" : "Ruhetag"}</button>`;
    if (s && (s.test || /FTP-Test/.test(s.title))) a += `<button class="btn" type="button" data-go="tests">Testwerte eintragen</button>`;
    a += `<button class="btn" type="button" data-act="sheet" data-i="${day.i}">Ändern</button>`;
    if (day.status !== "done" && day.i >= 0) body += changeRow(day);
    card = `<section class="card today span-8 ${s ? "accent-" + catCls(s.cat) : ""}" data-date="${day.date}">${body}<div class="btns" data-actions data-date="${day.date}">${a}</div></section>`;
  }
  const quota = R.doneAll + R.lost ? Math.round((R.doneAll / (R.doneAll + R.lost)) * 100) : null;
  const rings = `<section class="card span-4"><div class="card-h"><h3>Diese Woche</h3><span class="label">Etappe ${cw + 1}</span></div>
     <div class="goals" style="grid-template-columns:1fr;gap:14px">
       ${goal("Rad", W.bikeN, 3, "Einheiten", "rad", (n) => n)}
       ${goal("Kraft", W.gymN, 4, "Einheiten", "kraft", (n) => n)}
       ${goal("Gesamt", W.doneN, 7, "Einheiten", "", (n) => n)}
     </div></section>`;
  const next = upcoming(null, 3);
  const nextCard = `<section class="card span-6"><div class="card-h"><h3>Als Nächstes</h3><button class="btn sm" type="button" data-go="woche">Ganze Woche</button></div><div class="rows">${next.length ? next.map((x) => dayRow(x)).join("") : `<p class="empty">Nichts mehr geplant.</p>`}</div></section>`;
  const ch = W.ch, chP = Math.min(ch.cur / ch.target, 1);
  const chTxt = !W.started ? "Startet " + dm(iso(cw * 7)) : !S.live ? "Wartet auf Strava" : ch.won ? "Geschafft" : ch.target === 1 ? "Offen" : (ch.unit === " h" ? fN(ch.cur, 1) : fN(ch.cur)) + " / " + fN(ch.target) + ch.unit;
  const chCard = `<section class="card span-6"><div class="card-h"><h3>Wochen-Challenge</h3><span class="chip pin">+150 XP</span></div><div style="font-size:1.25rem;font-weight:600;letter-spacing:-.01em">${esc(CH[cw].t)}</div><div class="track gold"><i style="width:${S.live && W.started ? Math.round(chP * 100) : 0}%"></i></div><span class="label num">${esc(chTxt)}</span></section>`;
  const adj = adjustCard(W);
  return {
    hero: `<span class="label">${esc(eyebrow)}</span><h1 class="xl"><span class="${heroCls}">${esc(heroTitle)}</span></h1><p class="sub">${esc(heroSub)}</p>`,
    body: extraLog + card + rings + adj + nextCard + chCard + `<section class="card span-12"><div class="kpis">${kpi("Level", levelOf(R.xp) + 1, "", esc(LEVELS[levelOf(R.xp)][1]))}${kpi("XP", fN(R.xp))}${kpi("Serie", R.wStreak, " Wo", R.dStreak + " Tage im Plan")}${kpi("Plan-Quote", quota === null ? "–" : quota, quota === null ? "" : " %")}</div></section>`,
  };
}
/* last logged values for an exercise and last note of the same session type, before a date */
function lastLog(name, before) {
  const ds = Object.keys(S.L).filter((d) => d < before).sort().reverse();
  for (const d of ds) { const e = S.L[d].ex && S.L[d].ex[name]; if (e && (e.kg || e.r)) return Object.assign({ date: d }, e); }
  return null;
}
function lastNote(key, before) {
  const ds = Object.keys(S.L).filter((d) => d < before && S.L[d].key === key && S.L[d].note).sort().reverse();
  return ds.length ? { date: ds[0], note: S.L[ds[0]].note } : null;
}
const logTxt = (e) => [e.kg ? fN(e.kg, 1) + " kg" : "", e.s && e.r ? e.s + "×" + e.r : e.r ? e.r + " Wdh." : ""].filter(Boolean).join(" · ");
function sessionList(day, s) {
  const log = (S.L[day.date] && S.L[day.date].key === s.key) ? S.L[day.date] : { ex: {} };
  const rm = log.removed || [], addl = log.extra || [];
  const list = s.ex.filter((e) => !rm.includes(e.n)).map((e) => ({ n: e.n, s: e.s, r: e.r }))
    .concat((day.extraEx || []).filter((n) => !rm.includes(n)).map((n) => ({ n, s: 2, r: "6–8", extra: true })))
    .concat(addl.filter((n) => !s.ex.some((e) => e.n === n)).map((n) => ({ n, s: s.key === "legs" ? 2 : 3, r: "6–8", added: true })));
  const ord = log.order || [];
  if (ord.length) list.sort((a, b) => { const ia = ord.indexOf(a.n), ib = ord.indexOf(b.n); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
  return list;
}
function exChecklist(day, s) {
  const can = day.i === TI && S.dbOK, canPlan = S.dbOK && day.i >= TI && !(day.locked && day.i < TI);
  const log = (S.L[day.date] && S.L[day.date].key === s.key) ? S.L[day.date] : { ex: {} };
  const list = sessionList(day, s);
  const on = new Set(S.C[day.date] && S.C[day.date].key === s.key ? S.C[day.date].ex : []);
  const n = list.filter((e) => on.has(e.n)).length;
  const addForm = canPlan ? `<form class="exadd" data-sessadd="${day.date}" data-k="${s.key}"><input type="text" name="n" placeholder="Übung für dieses Training hinzufügen" maxlength="40" autocomplete="off" required aria-label="Übung für dieses Training hinzufügen"><button class="btn sm kraft" type="submit">Hinzufügen</button></form>` : "";
  if (!list.length) return `<p class="empty">Keine Übungen in diesem Training.</p>` + addForm;
  const ln = lastNote(s.key, day.date);
  const items = list.map((e) => {
    const L = log.ex[e.n] || {}, prev = lastLog(e.n, day.date), done = on.has(e.n);
    const plan = s.test ? "6 Wdh. Test" : e.s + "×" + e.r;
    return `<div class="exlog${done ? " on" : ""}${e.extra ? " extra" : ""}${canPlan ? " sortable" : ""}" data-sort-id="${esc(e.n)}">${canPlan ? `<span class="grip" aria-label="${esc(e.n)} verschieben: festhalten und ziehen" role="button" tabindex="0">⠿</span>` : ""}
      <button type="button" class="ex-h" data-ex="${esc(e.n)}" data-date="${day.date}" data-k="${s.key}" aria-pressed="${done}" ${can ? "" : "disabled"}><span class="box">✓</span><span class="nm">${esc(e.n)}</span><span class="sx">${e.extra ? "nachholen" : e.added ? "zusätzlich" : esc(plan)}</span></button>${canPlan ? `<button type="button" class="ex-rm" data-exrm="${esc(e.n)}" data-date="${day.date}" data-k="${s.key}" aria-label="${esc(e.n)} aus diesem Training entfernen">✕</button>` : ""}
      ${prev ? `<span class="prev">Zuletzt ${esc(logTxt(prev))} · ${DOW[(idx(prev.date) % 7 + 7) % 7]} ${dm(prev.date)}</span>` : ""}
      ${can ? `<div class="lg"><label><span>kg</span><input type="number" inputmode="decimal" step="0.5" min="0" max="500" value="${L.kg || ""}" placeholder="${prev && prev.kg ? fN(prev.kg, 1) : "–"}" data-log="kg" data-ex="${esc(e.n)}" data-date="${day.date}" data-k="${s.key}" aria-label="${esc(e.n)} Gewicht"></label>
        <label><span>Sätze</span><input type="number" inputmode="numeric" step="1" min="1" max="10" value="${L.s || ""}" placeholder="${s.test ? 1 : e.s}" data-log="s" data-ex="${esc(e.n)}" data-date="${day.date}" data-k="${s.key}" aria-label="${esc(e.n)} Sätze"></label>
        <label><span>Wdh.</span><input type="number" inputmode="numeric" step="1" min="1" max="50" value="${L.r || ""}" placeholder="${prev && prev.r ? prev.r : s.test ? 6 : 8}" data-log="r" data-ex="${esc(e.n)}" data-date="${day.date}" data-k="${s.key}" aria-label="${esc(e.n)} Wiederholungen"></label></div>` : (L.kg || L.r ? `<span class="prev" style="color:var(--ink2)">${esc(logTxt(L))}</span>` : "")}
    </div>`;
  }).join("");
  return `<div style="display:flex;flex-direction:column;gap:10px">
    ${ln ? `<div class="lastnote"><span class="label">Notiz vom letzten ${esc(s.title.replace("-Test", ""))} · ${dm(ln.date)}</span><p>${esc(ln.note)}</p></div>` : ""}
    <div class="card-h"><span class="label">${can ? "Übungen eintragen" : canPlan ? "Übungen anpassen" : "Übungen"}</span><span class="label num" style="color:${n === list.length ? "var(--done)" : "var(--muted)"}">${n}/${list.length}</span></div>
    <div class="track"><i style="width:${Math.round((n / list.length) * 100)}%"></i></div>
    <div class="exlist"${canPlan ? ` data-sort="sess|${day.date}|${s.key}"` : ""}>${items}</div>${addForm}
    ${can && (Object.keys(log.ex || {}).length || on.size || (S.E[day.date] && S.E[day.date].manual)) && !Focus.isLive(day.date) ? `<button type="button" class="btn ghost-danger sm" data-clearday="${day.date}" data-label="Einträge dieses Trainings löschen">Einträge dieses Trainings löschen</button>` : ""}
    ${can ? `<label class="note"><span class="label">Notiz zum Training</span><textarea rows="2" maxlength="600" placeholder="z. B. Schulter zwickt, nächstes Mal 2,5 kg mehr" data-note="${day.date}" data-k="${s.key}">${esc(log.note || "")}</textarea></label>
    <span class="label" style="letter-spacing:.06em">Antippen hakt ab, Gewicht eintragen auch. ✕ entfernt eine Übung nur aus diesem Training, dauerhaft änderst du sie unter Kraft → Übungen.</span>` : canPlan ? `<span class="label" style="letter-spacing:.06em">Abhaken und Gewichte am Trainingstag. Hinzufügen und ✕ gelten nur für dieses Training.</span>` : log.note ? `<div class="lastnote"><span class="label">Notiz</span><p>${esc(log.note)}</p></div>` : ""}</div>`;
}
function logSess(day, s) { const lk = S.L[day.date] && S.L[day.date].key; return lk && GYM[lk] ? sess(lk, Math.max(0, Math.floor(day.i / 7))) : s; }
function pseudoToday() { const d = (new Date(TODAY + "T12:00:00").getDay() + 6) % 7; return { i: TI, d, date: TODAY, extraEx: [], done: [], keys: [], e: {}, status: "free" }; }
function changeRow(day) {
  const w = Math.floor(day.i / 7), cur = day.e.rest ? "rest" : day.keys[0], pinned = !!(day.e.pin || day.e.rest);
  const opt = (id, label, cls) => `<button type="button" class="opt sm ${cls || ""}${cur === id ? " on" : ""}" data-change="${id}" data-date="${day.date}"><b>${label}</b></button>`;
  return `<details class="change"${pinned ? " open" : ""}><summary><span class="fb-q">Training ändern</span><span class="label">${pinned ? "Geändert" : "Tauschen oder Ruhetag"}</span></summary>
    <div class="fb-row">${["push", "pull", "legs", "upper"].map((k) => opt(k, GYM[k].n, "kraft")).join("")}</div>
    <div class="fb-row">${["int", "base", "long"].map((k) => opt(k, sess(k, w).title, "rad")).join("")}</div>
    <div class="fb-row">${opt("rest", "Ruhetag")}${pinned ? `<button type="button" class="opt sm" data-change="auto" data-date="${day.date}"><b>Zurück zum Plan</b></button>` : ""}</div>
    <span class="label" style="letter-spacing:.06em">Der Rest der Woche wird automatisch neu verteilt. Nach Beinen plant er kein Rad.</span></details>`;
}
function splitPicker(date, cur, q) {
  return `<div class="fb"><span class="fb-q">${q}</span><div class="fb-row">${["push", "pull", "legs", "upper"].map((k) => `<button type="button" class="opt sm${cur === k ? " on" : ""}" data-logkey="${k}" data-date="${date}"><b>${GYM[k].n}</b></button>`).join("")}</div></div>`;
}
function logCard(day) {
  const lk = S.L[day.date] && S.L[day.date].key, w = Math.max(0, Math.floor(day.i / 7));
  return `<section class="card accent-kraft span-12"><div class="card-h"><h3>Heute Kraft trainiert?</h3><span class="label">${TI < 0 ? "Vor dem Planstart" : "Auch außerhalb des Plans"}</span></div>
    ${splitPicker(day.date, lk || "push", "Welche Einheit?")}<div class="btns"><button class="btn kraft start" type="button" data-start="${lk && GYM[lk] ? lk : "push"}" data-date="${day.date}">${Focus.isLive(day.date) ? "▶ Training fortsetzen" : "▶ Training starten"}</button>${Focus.isLive(day.date) ? `<button class="btn ghost-danger" type="button" data-discard="${day.date}" data-label="Training verwerfen">Training verwerfen</button>` : `<button class="btn" type="button" data-start="free" data-date="${day.date}">Oder einfach Rad fahren</button>`}</div>${exChecklist(day, sess(lk && GYM[lk] ? lk : "push", w))}</section>`;
}
const HOW = [["plan", "Wie geplant"], ["kuerzer", "Kürzer"], ["locker", "Lockerer"], ["haerter", "Härter"], ["anders", "Andere Einheit"]];
const FEEL = [["frisch", "Frisch"], ["ok", "Okay"], ["muede", "Müde"], ["platt", "Platt"]];
function feedbackBlock(day, s) {
  const fb = S.F[day.date] || {}, bike = s && s.cat === "bike";
  const chips = (field, opts) => opts.map((o) => `<button type="button" class="opt sm${fb[field] === o[0] ? " on" : ""}" data-fb="${field}" data-val="${o[0]}" data-date="${day.date}"><b>${o[1]}</b></button>`).join("");
  return `<div class="fb"><span class="label">Rückmeldung</span>
    ${bike ? `<span class="fb-q">Wie lief's?</span><div class="fb-row">${chips("how", HOW)}</div>` : ""}
    <span class="fb-q">${bike ? "Wie sind die Beine?" : "Wie fühlst du dich?"}</span><div class="fb-row">${chips("feel", FEEL)}</div></div>`;
}
function adjustCard(W) {
  const w = W.w, lines = [];
  (W.notes || []).forEach((m) => lines.push(esc(m)));
  W.moves.forEach((m) => lines.push(esc(m)));
  W.dropped.forEach((k) => lines.push(esc(sess(k, w).title) + (W.ended ? " wurde verpasst" : " passt diese Woche nicht mehr rein")));
  if (!lines.length && !W.suggestRest) return "";
  const sug = W.suggestRest ? `<div class="btns" data-date="${W.suggestRest}"><span style="flex-basis:100%;font-size:.92rem">Beine platt: ${DOWL[(idx(W.suggestRest) % 7 + 7) % 7]} lieber Ruhetag?</span><button class="btn rad sm" type="button" data-act="rest">Ruhetag übernehmen</button></div>` : "";
  return `<section class="card adjust span-12"><div class="card-h"><h3>Plan angepasst</h3><span class="label">Etappe ${w + 1}</span></div>${lines.length ? `<ul>${lines.map((l) => "<li>" + l + "</li>").join("")}</ul>` : ""}${sug}</section>`;
}
function vWoche() {
  const w = S.sel, W = R.weeks[w], cw = curW();
  const season = `<div class="season" id="season">${R.weeks.map((x) => `<button type="button" class="wk${x.w === S.sel ? " sel" : ""}${x.w === cw && TI >= 0 ? " now" : ""}" data-w="${x.w}" aria-label="Etappe ${x.w + 1}"><span class="n">${x.w + 1}</span><span class="bars">${Array.from({ length: 7 }, (_, j) => `<i class="${j < x.doneN ? "d" : ""}"></i>`).join("")}</span><span class="p">${esc(PHASE[x.w])}</span></button>`).join("")}</div>`;
  const list = `<section class="card span-7"><div class="card-h"><div><span class="label">Etappe ${w + 1} / 16 · ${dm(iso(w * 7))} – ${dm(iso(w * 7 + 6))}</span><h3 style="font-size:1.3rem;margin-top:2px">${esc(PHASE[w])}${w === cw ? " · jetzt" : ""}</h3></div>
      <div class="weeknav"><button class="circ" type="button" data-wk="-1" aria-label="Vorherige Woche" ${w === 0 ? "disabled" : ""}>‹</button><button class="btn sm" type="button" data-wk="0">Heute</button><button class="circ" type="button" data-wk="1" aria-label="Nächste Woche" ${w === WEEKS - 1 ? "disabled" : ""}>›</button></div></div>
    <div class="rows">${W.days.map((x) => dayRow(x)).join("")}</div>
    <p class="empty" style="font-size:.82rem">Tag antippen für Ruhetag, Einheit festlegen oder ohne Strava abhaken. Die Woche plant sich selbst neu, nach Beinen kommt nie Rad.</p></section>`;
  const sum = `<section class="card span-5"><div class="card-h"><h3>Fortschritt</h3><span class="label num">${W.doneN} / 7</span></div><div class="track"><i style="width:${Math.round((W.doneN / 7) * 100)}%"></i></div>
    <div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))">${kpi("Rad", W.bikeN, "/3")}${kpi("Kraft", W.gymN, "/4")}${kpi("Rad-km", fN(W.km))}${kpi("Höhenmeter", fN(W.hm))}</div></section>`;
  const chart = `<section class="card span-12"><div class="card-h"><h3>Einheiten pro Etappe</h3><div class="legend label"><span><i style="background:var(--violet)"></i>Erledigt</span><span><i style="border:1.5px dashed var(--muted)"></i>Plan 7</span></div></div>${weekChart(R.weeks.map((x) => ({ val: x.doneN, plan: 7 })), { step: 1, min: 7, tick: (v) => (v % 2 ? "" : v), grad: "gAll", aria: "Erledigte Einheiten je Etappe" })}</section>`;
  return {
    hero: `<span class="label">Etappe ${w + 1} · ${esc(PHASE[w])}</span><h1 class="xl">Woche</h1><p class="sub">${W.doneN} von 7 Einheiten · Rad ${W.bikeN}/3 · Kraft ${W.gymN}/4</p>`,
    body: `<div class="span-12">${season}</div>` + adjustCard(W) + list + sum + chart,
  };
}
function vRad() {
  const cw = curW(), W = R.weeks[cw], fg = ftpGoal();
  const wkg = S.ftp && S.weight ? S.ftp / S.weight : null;
  const zones = [["Z1", "Erholung", 0, 55, "#6b7280"], ["Z2", "Grundlage", 56, 75, "#2f9e6e"], ["Z3", "Tempo", 76, 90, "#3b82f6"], ["Z4", "Schwelle", 91, 105, "#f59e0b"], ["Z5", "VO2max", 106, 120, "#f97316"], ["Z6", "Anaerob", 121, 150, "#ef4444"], ["Z7", "Sprint", 151, 999, "#a855f7"]];
  const zoneRows = zones.map((z) => {
    const w = S.ftp ? (z[3] > 900 ? "> " + Math.round(S.ftp * z[2] / 100) + " W" : Math.round(S.ftp * z[2] / 100) + "–" + Math.round(S.ftp * z[3] / 100) + " W") : (z[3] > 900 ? "> " + z[2] + " %" : z[2] + "–" + z[3] + " %");
    return `<div class="zone"><span class="zn">${z[0]}</span><span class="zb" style="background:${z[4]};width:${Math.min(100, 44 + z[2] * 0.36)}%">${z[1]}</span><span class="zw num">${w}</span></div>`;
  }).join("");
  const next = upcoming("bike", 3);
  return {
    hero: `<span class="label">${S.bike ? esc(S.bike.name) + " · " + fN(S.bike.km) + " km" : "Dein Rad"}</span><h1 class="xl"><span class="grad-rad">Rad</span></h1><p class="sub">${S.ftp ? "FTP " + S.ftp + " W" + (wkg ? " · " + fN(wkg, 2) + " W/kg" : "") : "FTP aus Strava"} · Ziel ${fg ? fg + " W" : "+10 %"}</p>`,
    body: `<section class="card accent-rad span-12 free-ride"><div><h3>Einfach fahren</h3><span class="muted" style="font-size:.88rem">Ohne Vorgaben: Stoppuhr, Runden und deine Wattzonen als Orientierung.</span></div><button class="btn rad start" type="button" data-start="free" data-date="${TODAY}">▶ Freie Fahrt starten</button></section>` + `<div class="span-12 kpis">${kpi("Diese Woche", fN(W.km), " km", W.bikeN + " von 3 Ausfahrten")}${kpi("Rad-Zeit", fH(W.bikeMin), " h")}${kpi("Höhenmeter", fN(W.hm), " Hm")}${kpi("Längste", fH(W.maxRide), " h", "Ausfahrt der Woche")}</div>` +
      `<section class="card accent-rad span-7"><div class="card-h"><h3>Nächste Ausfahrten</h3><span class="label">3 pro Woche</span></div><div class="rows">${next.length ? next.map((x) => dayRow(x)).join("") : `<p class="empty">Keine Ausfahrt mehr geplant.</p>`}</div></section>` +
      `<section class="card span-5"><div class="card-h"><h3>Wattzonen</h3><span class="label">${S.ftp ? "FTP " + S.ftp + " W" : "% FTP"}</span></div><div class="zones">${zoneRows}</div><span class="label">Sweetspot ${fillW("{SS}")}</span></section>` +
      `<section class="card span-12"><div class="card-h"><h3>Radeinheiten pro Etappe</h3><div class="legend label"><span><i style="background:var(--rad)"></i>Erledigt</span><span><i style="border:1.5px dashed var(--muted)"></i>Plan 3</span></div></div>${weekChart(R.weeks.map((x) => ({ val: x.bikeN, plan: 3 })), { step: 1, min: 3, tick: (v) => v, grad: "gRad", aria: "Radeinheiten je Etappe" })}</section>` +
      `<section class="card span-6"><div class="card-h"><h3>Ziele bis 31. Januar</h3></div><div class="goals" style="grid-template-columns:1fr">${goal("Rad-Kilometer", R.tot.km, 2000, "km", "rad")}${goal("Höhenmeter", R.tot.hm, 3000, "Hm", "violet")}${goal("FTP", S.ftp || 0, fg || 220, "W", "gold", (n) => (n ? fN(n) : "–"), ftpProg())}</div></section>` +
      `<section class="card span-6"><div class="card-h"><h3>Letzte Ausfahrten</h3></div>${recentList("bike", 6)}</section>`,
  };
}
function vKraft() {
  const cw = curW(), W = R.weeks[cw];
  const lastDone = (k) => { for (let i = R.allDays.length - 1; i >= 0; i--) { const x = R.allDays[i]; if (x.locked && x.done.some((o) => o.k === k)) return x; } return null; };
  const splits = ["push", "pull", "legs", "upper"].map((k) => {
    const s = sess(k, cw), dayThis = W.days.find((x) => x.keys.includes(k) || x.done.some((o) => o.k === k)), ld = lastDone(k);
    const st = dayThis ? (dayThis.done.some((o) => o.k === k) ? `<span class="chip done">Erledigt ${DOW[dayThis.d]}</span>` : `<span class="chip kraft"><i></i>${DOW[dayThis.d]} ${dm(dayThis.date)}</span>`) : `<span class="chip miss">Fällt aus</span>`;
    return `<section class="card split accent-kraft span-6"><div class="card-h"><span class="xl grad-kraft">${s.title}</span>${st}</div>
      <ol>${s.ex.length ? s.ex.map((e) => { const p = lastLog(e.n, "9999"); return `<li><span class="li-n">${esc(e.n)}${p ? `<small>Zuletzt ${esc(logTxt(p))}</small>` : ""}</span><span>${e.s} × ${esc(e.r)}</span></li>`; }).join("") : `<li class="muted">Keine Übungen</li>`}</ol>
      <span class="label">${ld ? "Zuletzt " + DOW[ld.d] + " " + dm(ld.date) : "Noch nicht trainiert"} · ca. ${s.min}′</span></section>`;
  }).join("");
  const blocks = [["1–3", "Technik & Startgewichte", "RIR 2"], ["5–7", "Gewicht steigern", "RIR 1"], ["9–11", "Schwerste Phase", "RIR 0–1"], ["13–15", "Kraft halten", "RIR 1"]];
  const phaseCard = `<section class="card span-5"><div class="card-h"><h3>Phase</h3><span class="label">Etappe ${cw + 1}</span></div><div style="font-size:1.15rem;font-weight:600">${esc(RIR(cw))}</div>
    <div class="rows">${blocks.map((b) => `<div class="row" style="grid-template-columns:64px minmax(0,1fr) auto;min-height:48px"><span class="label">Etappe ${b[0]}</span><span>${b[1]}</span><span class="chip kraft">${b[2]}</span></div>`).join("")}</div>
    <span class="label">Entlastung in Etappe 4, 8 und 12: Gewicht −10 %, Push & Pull 2 Sätze</span></section>`;
  const next = upcoming("gym", 4);
  const seg = `<div class="span-12 seg" role="tablist"><button type="button" role="tab" aria-selected="${kraftTab === "plan"}" data-ktab="plan">Plan</button><button type="button" role="tab" aria-selected="${kraftTab === "uebungen"}" data-ktab="uebungen">Übungen</button></div>`;
  const hero = `<span class="label">${esc(RIR(cw))}</span><h1 class="xl"><span class="grad-kraft">Kraft</span></h1><p class="sub">${W.gymN} von 4 Einheiten diese Woche · ${R.tot.gym} von 64 gesamt</p>`;
  if (kraftTab === "uebungen") return { hero, body: seg + exEditor() };
  return {
    hero,
    body: seg + `<div class="span-12 kpis">${kpi("Diese Woche", W.gymN, "/4")}${kpi("Gesamt", R.tot.gym, "/64")}${kpi("Nächste", next[0] ? esc(sess(next[0].keys[0], Math.floor(next[0].i / 7)).title) : "–", "", next[0] ? DOWL[next[0].d] + " " + dm(next[0].date) : "")}${TESTW.has(cw) ? kpi("Testwoche", "6", " Wdh.", "Gewicht für 6 saubere Wdh.") : kpi("Satzbereich", "6–8", " Wdh.")}</div>` +
      splits + phaseCard +
      `<section class="card span-7"><div class="card-h"><h3>Krafteinheiten pro Etappe</h3><div class="legend label"><span><i style="background:var(--kraft)"></i>Ist</span><span><i style="border:1.5px dashed var(--muted)"></i>Plan 4</span></div></div>${weekChart(R.weeks.map((x) => ({ val: x.gymN, plan: 4 })), { step: 1, min: 4, tick: (v) => v, grad: "gKraft", aria: "Krafteinheiten je Etappe" })}</section>` +
      `<section class="card span-12"><div class="card-h"><h3>Letzte Krafteinheiten</h3></div>${recentList("gym", 6)}</section>`,
  };
}
function vErfolge() {
  const lv = levelOf(R.xp), nx = LEVELS[lv + 1], cw = curW();
  const quota = R.doneAll + R.lost ? Math.round((R.doneAll / (R.doneAll + R.lost)) * 100) : null;
  const arcDay = Math.min(Math.max(Math.round((Date.parse(TODAY) - Date.parse(ARC0)) / DAY) + 1, 0), 90);
  const got = R.badges.filter((b) => b.got).length, won = R.weeks.filter((w) => w.ch.won).length;
  const fg = ftpGoal();
  const account = S.live
    ? `<div class="card-h"><span style="display:flex;gap:8px;align-items:center"><span class="led on"></span>Strava verbunden${S.name ? " als " + esc(S.name) : ""}</span><span class="label">Stand ${stampTxt()}</span></div>
       <div class="card-h"><span style="display:flex;gap:8px;align-items:center"><span class="led${S.sync === "on" ? " on" : ""}"></span>${S.sync === "on" ? "Einträge werden auf allen Geräten synchronisiert" : S.sync === "nodb" ? "Datenbank fehlt noch: Einträge nur in diesem Browser" : "Einträge gerade nur in diesem Browser"}</span></div><div class="btns"><button class="btn" type="button" data-act="refresh">Aktualisieren</button><a class="btn" href="/api/auth/logout">Strava trennen</a></div>`
    : `<div class="card-h"><span style="display:flex;gap:8px;align-items:center"><span class="led"></span>Strava nicht verbunden</span></div><div class="btns"><a class="btn rad" href="/api/auth/login">Mit Strava verbinden</a></div>`;
  const base = S.acts.filter((a) => a.date >= "2026-09-14" && a.date <= "2026-10-11"), bk = base.filter((a) => a.cat === "bike");
  return {
    hero: `<span class="label">Level ${lv + 1} · ${esc(LEVELS[lv][1])}</span><h1 class="xl"><span class="grad-gold">Erfolge</span></h1><p class="sub">${fN(R.xp)} XP${nx ? " · noch " + fN(nx[0] - R.xp) + " bis " + esc(nx[1]) : ""}</p>`,
    body: `<section class="card span-7"><div class="card-h"><h3>Level ${lv + 1} · ${esc(LEVELS[lv][1])}</h3><span class="label num">${fN(R.xp)} XP</span></div><div class="track gold"><i style="width:${nx ? pct(R.xp - LEVELS[lv][0], nx[0] - LEVELS[lv][0]) : 100}%"></i></div><span class="label">${nx ? "Nächstes Level: " + esc(nx[1]) + " bei " + fN(nx[0]) + " XP" : "Höchstes Level erreicht"}</span>
        <div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))">${kpi("Winter Arc", arcDay, "/90")}${kpi("Wochen-Serie", R.wStreak, " Wo")}${kpi("Tage im Plan", R.dStreak)}${kpi("Plan-Quote", quota === null ? "–" : quota, quota === null ? "" : " %")}</div></section>` +
      `<section class="card span-5"><div class="card-h"><h3>Wochen-Challenges</h3><span class="label">${won} / 16</span></div><div style="font-size:1.1rem;font-weight:600">${esc(CH[cw].t)}</div><span class="label">Diese Woche · +150 XP</span><div class="chs">${R.weeks.map((w) => `<span class="${w.ch.won ? "won" : ""}${w.w === cw ? " now" : ""}" title="${esc(CH[w.w].t)}">${w.ch.won ? "✓" : w.w + 1}</span>`).join("")}</div></section>` +
      `<section class="card span-12"><div class="card-h"><h3>Ziele bis 31. Januar</h3><span class="label">${Math.max(0, DAYS - Math.max(TI, 0))} Tage übrig</span></div><div class="goals">${goal("Rad-Kilometer", R.tot.km, 2000, "km", "rad")}${goal("Einheiten", R.doneAll, 112, "", "", (n) => n)}${goal("Krafteinheiten", R.tot.gym, 64, "", "kraft")}${goal("Höhenmeter", R.tot.hm, 3000, "Hm", "violet")}${goal("FTP", S.ftp || 0, fg || 220, "W", "gold", (n) => (n ? fN(n) : "–"), ftpProg())}</div></section>` +
      `<section class="card span-12"><div class="card-h"><h3>Abzeichen</h3><span class="label">${got} / ${R.badges.length} · je +100 XP</span></div><div class="badges">${R.badges.map((b) => `<div class="badge${b.got ? " got" : ""}"><span class="medal">${esc(b.k)}</span><div style="min-width:0"><div class="bt">${esc(b.t)}</div><div class="bd">${esc(b.d)}</div></div></div>`).join("")}</div></section>` +
      `<section class="card span-7"><div class="card-h"><h3>Strava</h3></div>${account}</section>` +
      `<section class="card span-5"><div class="card-h"><h3>Ausgangslage</h3><span class="label">Ø pro Woche · 14.9.–11.10.</span></div>${S.live ? `<div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))">${kpi("Rad", fN(bk.reduce((t, a) => t + a.km, 0) / 4), " km")}${kpi("Rad-Zeit", fN(bk.reduce((t, a) => t + a.min, 0) / 240, 1), " h")}${kpi("Kraft", fN(base.filter((a) => a.cat === "gym").length / 4, 1), "×")}${kpi("Gesamt", fN(base.reduce((t, a) => t + a.min, 0) / 240, 1), " h")}</div>` : `<p class="empty">Erscheint, sobald Strava verbunden ist.</p>`}</section>`,
  };
}

/* ---------- exercise editor (Kraft → Übungen) ---------- */
const REPS = ["6–8", "8–10", "10–12", "12–15", "5", "6"];
function exEditor() {
  const cards = ["push", "pull", "legs"].map((k) => {
    const list = baseList(k);
    return `<section class="card accent-kraft span-4"><div class="card-h"><span class="xl grad-kraft" style="font-size:2.3rem">${GYM[k].n}</span><span class="label">${list.length} Übungen</span></div>
      <div class="exedit" data-sort="ex|${k}">${list.map((e, i) => `<div class="exrow" data-sort-id="${esc(e.n)}"><span class="grip" aria-label="${esc(e.n)} verschieben: festhalten und ziehen" role="button" tabindex="0">⠿</span><span class="nm">${esc(e.n)}</span>
        <span class="step"><button type="button" data-exed="sets" data-k="${k}" data-n="${i}" data-d="-1" aria-label="${esc(e.n)}: ein Satz weniger">−</button><b class="num">${e.s}</b><button type="button" data-exed="sets" data-k="${k}" data-n="${i}" data-d="1" aria-label="${esc(e.n)}: ein Satz mehr">+</button></span>
        <button type="button" class="rep" data-exed="reps" data-k="${k}" data-n="${i}" aria-label="Wiederholungen ändern">${esc(e.r)}</button>
        <span class="ord"><button type="button" data-exed="del" data-k="${k}" data-n="${i}" aria-label="${esc(e.n)} entfernen">✕</button></span></div>`).join("") || `<p class="empty">Noch keine Übungen.</p>`}</div>
      <form class="exadd" data-k="${k}"><input type="text" id="add-${k}" name="n" placeholder="Übung hinzufügen" maxlength="40" autocomplete="off" required><button class="btn sm kraft" type="submit">Hinzufügen</button></form></section>`;
  }).join("");
  return cards + `<section class="card span-12"><div class="card-h"><h3>So wirkt es</h3>${EXC ? `<button class="btn sm" type="button" data-exed="reset">Standard wiederherstellen</button>` : ""}</div>
    <p class="empty" style="color:var(--ink2)">Oberkörper am Sonntag besteht automatisch aus allen Push- und Pull-Übungen mit höchstens 2 Sätzen. In Entlastungswochen gehen Push und Pull auf 2 Sätze. Änderungen gelten ab sofort für alle kommenden Einheiten. Satzzahl mit − und +, Wiederholungen durch Antippen ändern, Reihenfolge am Griff ⠿ festhalten und ziehen.</p></section>`;
}
function editEx(act, k, n, d) {
  if (act === "reset") { EXC = null; saveCfg("ex", null); render(); toast("Standard-Übungen wiederhergestellt"); return; }
  if (!EXC) EXC = { push: baseList("push").map((e) => ({ ...e })), pull: baseList("pull").map((e) => ({ ...e })), legs: baseList("legs").map((e) => ({ ...e })) };
  const L = EXC[k]; if (!L) return; const e = L[n];
  if (act === "sets" && e) e.s = Math.max(1, Math.min(6, e.s + d));
  else if (act === "reps" && e) e.r = REPS[(REPS.indexOf(e.r) + 1) % REPS.length];
  else if (act === "up" && n > 0) [L[n - 1], L[n]] = [L[n], L[n - 1]];
  else if (act === "down" && n < L.length - 1) [L[n + 1], L[n]] = [L[n], L[n + 1]];
  else if (act === "del" && e) { L.splice(n, 1); toast(e.n + " entfernt"); }
  saveCfg("ex", EXC); render();
}
function addEx(k, name) {
  name = String(name || "").trim(); if (!name) return;
  if (!EXC) EXC = { push: baseList("push").map((e) => ({ ...e })), pull: baseList("pull").map((e) => ({ ...e })), legs: baseList("legs").map((e) => ({ ...e })) };
  if (EXC[k].some((e) => e.n.toLowerCase() === name.toLowerCase())) { toast(name + " ist schon drin"); return; }
  EXC[k].push({ n: name, s: k === "legs" ? 2 : 3, r: "6–8" }); saveCfg("ex", EXC); render(); toast(name + " hinzugefügt");
}

/* ---------- tests ---------- */
function roundState(t) { const a = t.w * 7, b = a + 6; return TI > b ? "done" : TI >= a ? "now" : "next"; }
function vTests() {
  const cur = TESTS.find((t) => roundState(t) !== "done") || TESTS[TESTS.length - 1];
  if (testRound === null) testRound = (TESTS.slice().reverse().find((t) => roundState(t) !== "next") || TESTS[0]).n;
  const fts = testFtps(), base = S.ftpBase || S.ftpStrava, latest = fts.length ? fts[fts.length - 1].ftp : null;
  const delta = latest && base ? latest - base : null, gain = strengthGain();
  const wkg = (latest || S.ftp) && S.weight ? (latest || S.ftp) / S.weight : null;
  const dates = (t) => dm(iso(t.w * 7)) + " – " + dm(iso(t.w * 7 + 6));
  const daysTo = Math.max(0, cur.w * 7 - TI);
  const timeline = `<section class="card span-12"><div class="card-h"><h3>Testplan</h3><span class="label">Alle 4 Wochen · in den Entlastungswochen</span></div>
    <div class="tl">${TESTS.map((t) => { const st = roundState(t), f = fts.find((x) => x.n === t.n); return `<button type="button" class="tl-i ${st}${t.n === testRound ? " sel" : ""}" data-round="${t.n}"><span class="tl-dot"></span><span class="label">Test ${t.n}</span><b class="xl">Etappe ${t.w + 1}</b><span class="muted" style="font-size:.8rem">${dates(t)}</span><span class="chip ${st === "done" ? "done" : st === "now" ? "pin" : ""}">${st === "done" ? (f ? "FTP " + f.ftp + " W" : "Vorbei") : st === "now" ? "Diese Woche" : "Geplant"}</span></button>`; }).join("")}</div></section>`;
  // FTP chart
  const pts = [{ l: "Start", v: base }].concat(TESTS.map((t) => ({ l: "T" + t.n, v: (fts.find((x) => x.n === t.n) || {}).ftp || null })));
  const vals = pts.map((p) => p.v).filter(Boolean), lo = Math.floor((Math.min(...vals, base || 200) - 10) / 10) * 10, hi = Math.ceil((Math.max(...vals, (ftpGoal() || 220)) + 10) / 10) * 10;
  const cw2 = 360, ch2 = 170, px = (i) => 30 + i * ((cw2 - 50) / 4), py = (v) => 14 + (ch2 - 40) * (1 - (v - lo) / (hi - lo));
  let svg = `<line x1="30" x2="${cw2 - 12}" y1="${py(ftpGoal() || 220)}" y2="${py(ftpGoal() || 220)}" stroke="var(--rad2)" stroke-dasharray="4 4" stroke-width="1" fill="none"/><text x="${cw2 - 12}" y="${py(ftpGoal() || 220) - 6}" text-anchor="end" font-size="9.5" font-family="Geist Mono, monospace" fill="var(--rad2)">Ziel ${ftpGoal() || 220} W</text>`;
  const known = pts.map((p, i) => ({ ...p, i })).filter((p) => p.v);
  if (known.length > 1) svg += `<polyline points="${known.map((p) => px(p.i) + "," + py(p.v)).join(" ")}" fill="none" stroke="url(#gV)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
  pts.forEach((p, i) => { svg += `<text x="${px(i)}" y="${ch2 - 6}" text-anchor="middle" font-size="10" font-family="Geist Mono, monospace" fill="var(--muted)">${p.l}</text>`; if (p.v) svg += `<circle cx="${px(i)}" cy="${py(p.v)}" r="6" fill="var(--bg)" stroke="var(--violet)" stroke-width="3"/><text x="${px(i)}" y="${py(p.v) - 12}" text-anchor="middle" font-size="11" font-weight="600" font-family="Geist, sans-serif" fill="var(--ink)">${p.v}</text>`; });
  const ftpChart = `<div class="chart"><svg viewBox="0 0 ${cw2} ${ch2}" role="img" aria-label="FTP-Verlauf über die Tests"><defs><linearGradient id="gV" x1="0" x2="1"><stop offset="0" stop-color="var(--violet)"/><stop offset="1" stop-color="var(--rad)"/></linearGradient></defs>${svg}</svg></div>`;
  // selected round inputs
  const t = TESTS.find((x) => x.n === testRound), st = roundState(t), open = st !== "next" && S.dbOK;
  const p20 = (S.T.ftp || {})[t.n] || "";
  const ftpCard = `<section class="card accent-rad span-6"><div class="card-h"><h3>FTP-Test · Test ${t.n}</h3><span class="label">Zwift · 20 Minuten</span></div>
    ${ftpChart}
    <form class="tform" data-tform="ftp" data-n="${t.n}"><label for="p20-${t.n}" class="label">20′-Durchschnitt in Watt</label>
      <div class="tin"><input id="p20-${t.n}" name="v" type="number" inputmode="numeric" min="50" max="600" step="1" value="${p20}" placeholder="z. B. 220" ${open ? "" : "disabled"}><span class="tout">FTP <b class="num">${p20 ? ftpFrom20(+p20) + " W" : "–"}</b></span><button class="btn sm rad" type="submit" ${open ? "" : "disabled"}>Speichern</button></div></form>
    <span class="label" style="letter-spacing:.06em">${open ? "FTP = 95 % des 20′-Schnitts. Trag den neuen Wert danach auch in Strava ein." : "Eintragen ab " + dm(iso(t.w * 7)) + "."}</span></section>`;
  const K = (S.T.kraft || {})[t.n] || {}, prevN = t.n > 1 ? t.n - 1 : null, P = prevN ? (S.T.kraft || {})[prevN] || {} : {};
  const groups = ["push", "pull", "legs"].map((k) => `<div class="tgroup"><span class="label">${GYM[k].n}</span>${baseList(k).map((e) => {
    const v = K[e.n] || "", pv = P[e.n], d = v && pv ? ((v - pv) / pv) * 100 : null;
    return `<div class="trow"><span class="nm">${esc(e.n)}</span>${d !== null ? `<span class="delta ${d >= 0 ? "up" : "down"}">${d >= 0 ? "+" : ""}${fN(d, 0)} %</span>` : pv ? `<span class="delta">vorher ${fN(pv, 1)}</span>` : "<span></span>"}<input type="number" inputmode="decimal" step="0.5" min="0" max="500" value="${v}" placeholder="kg" aria-label="${esc(e.n)} Gewicht für 6 Wiederholungen" data-tex="${esc(e.n)}" data-n="${t.n}" ${open ? "" : "disabled"}><span class="unit">kg</span></div>`;
  }).join("")}</div>`).join("");
  const kraftCard = `<section class="card accent-kraft span-6"><div class="card-h"><h3>Krafttest · Test ${t.n}</h3><span class="label">6 Wiederholungen</span></div>
    <p class="empty" style="color:var(--ink2)">Pro Übung aufwärmen und das Gewicht eintragen, mit dem du genau 6 saubere Wiederholungen schaffst. Die Prozentzahl zeigt die Veränderung zum vorherigen Test.</p>${groups}
    <span class="label" style="letter-spacing:.06em">${open ? "Wird beim Verlassen des Feldes gespeichert." : "Eintragen ab " + dm(iso(t.w * 7)) + "."}</span></section>`;
  return {
    hero: `<span class="label">${roundState(cur) === "now" ? "Testwoche · jetzt" : "Nächster Test in " + daysTo + " Tagen · Etappe " + (cur.w + 1)}</span><h1 class="xl"><span class="grad-violet">Tests</span></h1><p class="sub">FTP-Test über 20 Minuten auf Zwift und Krafttest mit 6 Wiederholungen, alle 4 Wochen.</p>`,
    body: `<div class="span-12 kpis">${kpi("FTP", latest || base || "–", latest || base ? " W" : "", latest ? "aus Test " + fts[fts.length - 1].n : "Startwert aus Strava")}${kpi("Seit Start", delta === null ? "–" : (delta >= 0 ? "+" : "") + delta, delta === null ? "" : " W", base ? "Start " + base + " W" : "")}${kpi("W/kg", wkg ? fN(wkg, 2) : "–")}${kpi("Kraft", gain ? (gain >= 0 ? "+" : "") + fN(gain * 100, 1) : "–", gain ? " %" : "", "Ø Steigerung im 6-Wdh.-Test")}</div>` +
      timeline + ftpCard + kraftCard,
  };
}
const RENDER = { heute: vHeute, tests: vTests, woche: vWoche, rad: vRad, kraft: vKraft, erfolge: vErfolge };

/* ---------- render ---------- */
function render() {
  R = compute();
  const out = RENDER[view]();
  $("hero").innerHTML = out.hero;
  $("content").innerHTML = out.body;
  $("arcTag").textContent = "Tag " + Math.min(Math.max(Math.round((Date.parse(TODAY) - Date.parse(ARC0)) / DAY) + 1, 0), 90) + "/90";
  if (window.Stage) {
    const W = R.weeks[curW()], lv = levelOf(R.xp);
    Stage.update({
      rings: [W.bikeN / 3, W.gymN / 4, W.doneN / 7],
      week: R.weeks[view === "woche" ? S.sel : curW()].days.map((x) => { const k = x.keys[0]; return { min: k ? sess(k, Math.floor(x.i / 7)).min : 0, cat: k ? CAT[k] : null, done: x.status === "done", rest: !k, today: x.i === TI }; }),
      level: { n: lv + 1, name: LEVELS[lv][1] },
      ftp: S.ftp || 0, ftpSub: S.ftp && S.weight ? fN(S.ftp / S.weight, 2) + " W/KG" : "WATT",
    });
  }
}
function go(v, push) {
  if (!VIEWS.includes(v)) v = "heute";
  const changed = v !== view; view = v;
  document.body.dataset.view = v;
  document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-current", t.dataset.v === v ? "page" : "false"));
  if (push && location.hash !== "#" + v) history.pushState(null, "", "#" + v);
  if (window.Stage) Stage.show(v);
  const m = $("main"); m.classList.remove("view"); void m.offsetWidth; m.classList.add("view");
  render();
  if (changed) window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

/* ---------- interactions ---------- */
document.querySelector(".tabbar").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) go(b.dataset.v, true); });
window.addEventListener("popstate", () => go((location.hash || "#heute").slice(1), false));
$("main").addEventListener("click", (e) => {
  const t = e.target;
  const ed = t.closest("[data-exed]"); if (ed && !ed.disabled) { editEx(ed.dataset.exed, ed.dataset.k, +ed.dataset.n, +ed.dataset.d || 0); return; }
  const kt = t.closest("[data-ktab]"); if (kt) { kraftTab = kt.dataset.ktab; render(); return; }
  const rd = t.closest("[data-round]"); if (rd) { testRound = +rd.dataset.round; render(); return; }
  const dsc = t.closest("[data-discard]"); if (dsc) { Focus.confirmReset(dsc, dsc.dataset.discard); return; }
  const clr = t.closest("[data-clearday]"); if (clr) { confirmClear(clr, clr.dataset.clearday); return; }
  const st = t.closest("[data-start]"); if (st) { Focus.start(st.dataset.date, st.dataset.start); return; }
  const chg = t.closest("[data-change]"); if (chg) { const v = chg.dataset.change; writeEntry(chg.dataset.date, v === "auto" ? null : v === "rest" ? { rest: true } : { pin: v }); return; }
  const lkb = t.closest("[data-logkey]"); if (lkb) { setLogKey(lkb.dataset.date, lkb.dataset.logkey); return; }
  const rmb = t.closest("[data-exrm]"); if (rmb) { sessionEx(rmb.dataset.date, rmb.dataset.k, rmb.dataset.exrm, "remove"); return; }
  const fb = t.closest("[data-fb]"); if (fb) { setFeedback(fb.dataset.date, fb.dataset.fb, fb.dataset.val); return; }
  const ex = t.closest("button[data-ex]"); if (ex && !ex.disabled) { toggleEx(ex.dataset.date, ex.dataset.k, ex.dataset.ex); return; }
  const row = t.closest("[data-i]"); if (row && row.classList.contains("row")) { openSheet(+row.dataset.i); return; }
  const wk = t.closest("[data-wk]"); if (wk) { const d = +wk.dataset.wk; S.sel = d === 0 ? curW() : clampW(S.sel + d); render(); return; }
  const sw = t.closest("[data-w]"); if (sw) { S.sel = +sw.dataset.w; render(); return; }
  const g = t.closest("[data-go]"); if (g) { go(g.dataset.go, true); return; }
  const a = t.closest("[data-act]"); if (!a || a.disabled) return;
  const act = a.dataset.act, wrap = a.closest("[data-date]"), date = wrap ? wrap.dataset.date : null;
  if (act === "sheet") openSheet(+a.dataset.i);
  else if (act === "rest") writeEntry(date, { rest: true });
  else if (act === "auto") writeEntry(date, null);
  else if (act === "manual") writeEntry(date, { manual: a.dataset.k });
  else if (act === "refresh") load();
});
$("main").addEventListener("submit", (e) => {
  const f = e.target; e.preventDefault();
  if (f.dataset.sessadd) { sessionEx(f.dataset.sessadd, f.dataset.k, f.elements.n.value, "add"); return; }
  if (f.classList.contains("exadd")) { addEx(f.dataset.k, f.elements.n.value); return; }
  if (f.dataset.tform === "ftp") { const v = +f.elements.v.value; setTest("ftp", +f.dataset.n, null, v > 0 ? v : null); toast(v > 0 ? "FTP " + ftpFrom20(v) + " W gespeichert" : "FTP-Wert gelöscht"); }
});
$("main").addEventListener("change", (e) => {
  const lg = e.target.closest("[data-log]"); if (lg) { setLog(lg.dataset.date, lg.dataset.k, lg.dataset.ex, lg.dataset.log, lg.value); return; }
  const nt = e.target.closest("[data-note]"); if (nt) { setNote(nt.dataset.note, nt.dataset.k, nt.value); return; }
  const i = e.target.closest("[data-tex]"); if (!i) return;
  const v = parseFloat(String(i.value).replace(",", ".")); setTest("kraft", +i.dataset.n, i.dataset.tex, v > 0 ? v : null);
});
/* reorder exercises: hold the grip and drag */
function saveOrder(spec, ids) {
  const [kind, a, b] = spec.split("|");
  if (kind === "ex") {
    if (!EXC) EXC = { push: baseList("push").map((e) => ({ ...e })), pull: baseList("pull").map((e) => ({ ...e })), legs: baseList("legs").map((e) => ({ ...e })) };
    const L = EXC[a]; L.sort((x, y) => ids.indexOf(x.n) - ids.indexOf(y.n)); saveCfg("ex", EXC);
  } else if (kind === "sess") { const L = logOf(a, b); L.order = ids; saveLog(a); }
  render(); if (!$("scrim").hidden && sheetI !== null) openSheet(sheetI);
  toast("Reihenfolge gespeichert");
}
(function () {
  let drag = null;
  document.addEventListener("pointerdown", (e) => {
    const g = e.target.closest(".grip"); if (!g) return;
    const item = g.closest("[data-sort-id]"), list = item && item.parentElement; if (!list || !list.dataset.sort) return;
    e.preventDefault();
    drag = { item, list, y0: e.clientY, id: e.pointerId, moved: false };
    item.classList.add("dragging"); try { g.setPointerCapture(e.pointerId); } catch (_) {}
    try { if (navigator.vibrate) navigator.vibrate(15); } catch (_) {}
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { item, list } = drag; let dy = e.clientY - drag.y0; drag.moved = true;
    const next = item.nextElementSibling, prev = item.previousElementSibling, gap = 8;
    if (next && next.dataset.sortId !== undefined && dy > next.offsetHeight / 2) { list.insertBefore(next, item); drag.y0 += next.offsetHeight + gap; dy = e.clientY - drag.y0; }
    else if (prev && prev.dataset.sortId !== undefined && dy < -prev.offsetHeight / 2) { list.insertBefore(item, prev); drag.y0 -= prev.offsetHeight + gap; dy = e.clientY - drag.y0; }
    item.style.transform = `translateY(${dy}px)`;
    if (e.clientY < 90) window.scrollBy(0, -12); else if (e.clientY > window.innerHeight - 110) window.scrollBy(0, 12);
  });
  const end = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const { item, list, moved } = drag; drag = null;
    item.classList.remove("dragging"); item.style.transform = "";
    if (moved) saveOrder(list.dataset.sort, [...list.querySelectorAll(":scope > [data-sort-id]")].map((x) => x.dataset.sortId));
  };
  document.addEventListener("pointerup", end); document.addEventListener("pointercancel", end);
})();

/* drag the 3D object on the hero area */
(function () {
  const h = $("hero"); let x0 = null;
  h.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
  window.addEventListener("pointermove", (e) => { if (x0 === null) return; if (window.Stage) Stage.nudge(e.clientX - x0); x0 = e.clientX; }, { passive: true });
  window.addEventListener("pointerup", () => { x0 = null; });
  window.addEventListener("pointercancel", () => { x0 = null; });
})();
window.addEventListener("scroll", () => $("topbar").classList.toggle("scrolled", window.scrollY > 8), { passive: true });

let toastT = null;
function toast(m) { const t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2400); }
function notice(h) { const n = $("notice"); if (!h) { n.hidden = true; n.innerHTML = ""; return; } n.innerHTML = "<div>" + h + "</div>"; n.hidden = false; }
function setLive(t, on) { $("liveText").textContent = t; $("led").classList.toggle("on", !!on); }

/* ---------- edit sheet ---------- */
let sheetI = null;
function openSheet(i) {
  sheetI = i; const x = R.allDays[i]; if (!x) return; const w = Math.floor(i / 7), past = i <= TI;
  const cur = x.e.rest ? "rest" : x.e.manual ? "m:" + x.e.manual : x.e.pin ? "p:" + x.e.pin : "auto";
  const now = x.keys.length ? x.keys.map((k) => sess(k, w).title).join(" + ") : x.status === "rest" ? "Ruhetag" : "nichts";
  const opts = KEYS.map((k) => { const s = sess(k, w), id = (past ? "m:" : "p:") + k; return `<button type="button" class="opt ${catCls(s.cat)}${cur === id ? " on" : ""}" data-set="${id}"><b>${esc(s.title)}</b><span>${catName(s.cat)} · ${s.min}′</span></button>`; }).join("");
  $("sheet").innerHTML = `<div class="grab"></div><div class="card-h"><div><span class="label">Etappe ${w + 1} · ${esc(PHASE[w])}</span><h2 class="xl" id="sheetTitle" style="font-size:2.4rem;margin-top:4px">${DOWL[x.d]} ${dm(x.date)}</h2></div><button type="button" class="circ" data-close aria-label="Schließen">✕</button></div>
    <span class="muted" style="font-size:.9rem">Aktuell: <b style="color:var(--ink)">${esc(now)}</b>${x.done.some((o) => o.a) ? " · aus Strava" : ""}</span>
    <div class="optgrid"><button type="button" class="opt${cur === "auto" ? " on" : ""}" data-set="auto"><b>Automatisch</b><span>Plan entscheidet</span></button><button type="button" class="opt${cur === "rest" ? " on" : ""}" data-set="rest"><b>Ruhetag</b><span>Rest der Woche rückt nach</span></button></div>
    <span class="label">${past ? "Ohne Strava erledigt" : "Diese Einheit festlegen"}</span><div class="optgrid">${opts}</div>
    <span class="muted" style="font-size:.8rem">${past ? "Was in Strava steht, wird automatisch erkannt." : "Am Tag nach Beinen plant der Plan kein Rad. Festlegungen haben Vorrang."}</span>
    ${past && x.done.length ? feedbackBlock(x, sess(x.done[0].k, w)) : ""}
    ${(() => { const ss = sessOf(x); return ss && ss.cat === "gym" && x.i >= TI ? `<div class="sheet-ex">${exChecklist(x, logSess(x, ss))}</div>` : ""; })()}`;
  $("scrim").hidden = false;
}
function closeSheet() { $("scrim").hidden = true; sheetI = null; }
$("scrim").addEventListener("click", (e) => {
  if (e.target === $("scrim") || e.target.closest("[data-close]")) { closeSheet(); return; }
  const rmb = e.target.closest("[data-exrm]"); if (rmb) { const i = sheetI; sessionEx(rmb.dataset.date, rmb.dataset.k, rmb.dataset.exrm, "remove"); openSheet(i); return; }
  const exb = e.target.closest("button[data-ex]"); if (exb && !exb.disabled) { const i = sheetI; toggleEx(exb.dataset.date, exb.dataset.k, exb.dataset.ex); openSheet(i); return; }
  const fbb = e.target.closest("[data-fb]"); if (fbb) { const i = sheetI; setFeedback(fbb.dataset.date, fbb.dataset.fb, fbb.dataset.val); openSheet(i); return; }
  const b = e.target.closest("[data-set]"); if (!b || sheetI === null) return;
  const v = b.dataset.set;
  writeEntry(iso(sheetI), v === "auto" ? null : v === "rest" ? { rest: true } : v.startsWith("m:") ? { manual: v.slice(2) } : { pin: v.slice(2) });
  closeSheet();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("scrim").hidden) closeSheet(); });
$("scrim").addEventListener("submit", (e) => { const f = e.target; e.preventDefault(); if (f.dataset.sessadd) { const i = sheetI; sessionEx(f.dataset.sessadd, f.dataset.k, f.elements.n.value, "add"); openSheet(i); } });
$("scrim").addEventListener("change", (e) => { const lg = e.target.closest("[data-log]"); if (lg) setLog(lg.dataset.date, lg.dataset.k, lg.dataset.ex, lg.dataset.log, lg.value); const nt = e.target.closest("[data-note]"); if (nt) setNote(nt.dataset.note, nt.dataset.k, nt.value); });

/* ---------- storage (browser for now) ---------- */
let DB = null;
async function writeEntry(date, val) {
  if (!DB) return;
  if (val) S.E[date] = val; else delete S.E[date];
  render();
  try { const ref = DB.doc("entries/" + date); if (val) await ref.set(val); else await ref.delete(); } catch (_) {}
  toast(val ? (val.rest ? "Ruhetag eingetragen · Woche neu geplant" : val.manual ? "Als erledigt eingetragen" : "Einheit festgelegt · Woche neu geplant") : "Zurück auf automatisch");
}
function toggleEx(date, key, name, soft) {
  if (!DB) return;
  const c = S.C[date] && S.C[date].key === key ? S.C[date].ex.slice() : [];
  const i = c.indexOf(name); if (i >= 0) c.splice(i, 1); else c.push(name);
  if (c.length) S.C[date] = { key, ex: c }; else delete S.C[date];
  if (soft) { // keep focus while typing values: update just this row
    let total = 0, done = 0;
    document.querySelectorAll("button.ex-h[data-date='" + date + "']").forEach((b) => { if (b.dataset.ex === name) { b.setAttribute("aria-pressed", "true"); b.closest(".exlog").classList.add("on"); } total++; if (b.closest(".exlog").classList.contains("on")) done++; });
    const box = document.querySelector("button.ex-h[data-date='" + date + "']"); const wrap = box && box.closest(".exlist") && box.closest(".exlist").parentElement;
    if (wrap) { const cnt = wrap.querySelector(".card-h .label.num"); if (cnt) cnt.textContent = done + "/" + total; const bar = wrap.querySelector(".track > i"); if (bar) bar.style.width = Math.round((done / total) * 100) + "%"; }
  } else render();
  const dd = R && R.allDays[idx(date)], total = (GYM[key] ? exOf(key, Math.floor(idx(date) / 7)).length : 0) + (dd && dd.extraEx ? dd.extraEx.length : 0);
  if (i < 0 && c.length >= total) toast("Alle Übungen geschafft");
  const ref = DB.doc("checks/" + date); (c.length ? ref.set({ key, ex: c }) : ref.delete()).catch(() => {});
}
function setFeedback(date, field, val) {
  if (!DB) return;
  const cur = Object.assign({}, S.F[date] || {});
  if (cur[field] === val) delete cur[field]; else cur[field] = val;
  if (Object.keys(cur).length) S.F[date] = cur; else delete S.F[date];
  render();
  const ref = DB.doc("fb/" + date); (Object.keys(cur).length ? ref.set(cur) : ref.delete()).catch(() => {});
  const W = R.weeks[Math.floor(idx(date) / 7)];
  toast(W && (W.notes.length || W.suggestRest) ? "Gespeichert · Plan angepasst" : "Rückmeldung gespeichert");
}
function logOf(date, key) { const L = S.L[date] && S.L[date].key === key ? S.L[date] : { key, ex: {}, note: "", extra: [], removed: [] }; S.L[date] = L; return L; }
function saveLog(date) { if (!DB) return; DB.doc("logs/" + date).set(S.L[date]).catch(() => {}); }
function setLog(date, key, name, field, raw) {
  if (!DB) return;
  const v = parseFloat(String(raw).replace(",", ".")), L = logOf(date, key), e = Object.assign({}, L.ex[name] || {});
  if (v > 0) e[field] = v; else delete e[field];
  if (Object.keys(e).length) L.ex[name] = e; else delete L.ex[name];
  saveLog(date);
  const c = S.C[date] && S.C[date].key === key ? S.C[date].ex : [];
  if (v > 0 && !c.includes(name)) { toggleEx(date, key, name, true); return; }
  toast("Gespeichert");
}
function setLogKey(date, key) {
  if (!DB) return;
  const L = S.L[date];
  if (L && L.key === key) return;
  if (L && (Object.keys(L.ex || {}).length || L.note) && !confirmSwitch(date)) return;
  S.L[date] = { key, ex: {}, note: "", extra: [], removed: [] }; saveLog(date);
  if (S.C[date] && S.C[date].key !== key) { delete S.C[date]; DB.doc("checks/" + date).delete().catch(() => {}); }
  render(); toast(GYM[key].n + " ausgewählt");
}
let switchArm = null;
function confirmSwitch(date) { if (switchArm === date) { switchArm = null; return true; } switchArm = date; toast("Nochmal tippen: Einträge dieses Trainings werden ersetzt"); setTimeout(() => { if (switchArm === date) switchArm = null; }, 4000); return false; }
function sessionEx(date, key, name, act) {
  if (!DB) return; name = String(name || "").trim(); if (!name) return;
  const L = logOf(date, key); L.extra = L.extra || []; L.removed = L.removed || [];
  if (act === "add") { L.removed = L.removed.filter((n) => n !== name); if (!L.extra.includes(name)) L.extra.push(name); toast(name + " zu diesem Training hinzugefügt"); }
  else {
    if (L.extra.includes(name)) L.extra = L.extra.filter((n) => n !== name); else if (!L.removed.includes(name)) L.removed.push(name);
    if (L.ex && L.ex[name]) delete L.ex[name];
    const c = S.C[date]; if (c && c.key === key && c.ex.includes(name)) { c.ex = c.ex.filter((n) => n !== name); DB.doc("checks/" + date).set(c).catch(() => {}); }
    toast(name + " aus diesem Training entfernt");
  }
  saveLog(date); render();
}
let clearArmed = 0;
function confirmClear(btn, date) {
  if (clearArmed && Date.now() - clearArmed < 4000) {
    clearArmed = 0;
    const keep = S.L[date] ? { key: S.L[date].key, ex: {}, note: "", extra: S.L[date].extra || [], removed: S.L[date].removed || [], order: S.L[date].order || [] } : null;
    if (keep && (keep.extra.length || keep.removed.length || keep.order.length)) { S.L[date] = keep; DB.doc("logs/" + date).set(keep).catch(() => {}); } else { delete S.L[date]; DB.doc("logs/" + date).delete().catch(() => {}); }
    delete S.C[date]; DB.doc("checks/" + date).delete().catch(() => {});
    delete S.F[date]; DB.doc("fb/" + date).delete().catch(() => {});
    if (S.E[date] && S.E[date].manual) { const e = Object.assign({}, S.E[date]); delete e.manual; if (Object.keys(e).length) { S.E[date] = e; DB.doc("entries/" + date).set(e).catch(() => {}); } else { delete S.E[date]; DB.doc("entries/" + date).delete().catch(() => {}); } }
    render(); toast("Einträge gelöscht"); return;
  }
  clearArmed = Date.now(); btn.textContent = "Wirklich löschen?"; btn.classList.add("danger");
  setTimeout(() => { if (btn.isConnected && Date.now() - clearArmed >= 4000) { btn.textContent = btn.dataset.label; btn.classList.remove("danger"); } }, 4100);
}
function setNote(date, key, txt) { if (!DB) return; const L = logOf(date, key); L.note = String(txt || "").trim(); saveLog(date); toast(L.note ? "Notiz gespeichert" : "Notiz gelöscht"); }
function saveCfg(key, val) { if (!DB) return; const ref = DB.doc("cfg/" + key); (val ? ref.set(val) : ref.delete()).catch(() => {}); }
function setTest(kind, n, name, val) {
  if (kind === "ftp") { if (val) S.T.ftp[n] = val; else delete S.T.ftp[n]; }
  else { const r = Object.assign({}, S.T.kraft[n] || {}); if (val) r[name] = val; else delete r[name]; S.T.kraft[n] = r; }
  saveCfg("tests", S.T); recalcFtp(); render();
}
function recalcFtp() { const f = testFtps(); S.ftp = f.length ? f[f.length - 1].ftp : S.ftpStrava || null; }
/* storage: browser first (instant, offline), synced to the personal database when signed in */
const COLS = ["entries", "checks", "fb", "logs", "cfg"];
function makeDB() {
  const L = localDB(), PK = "wa.pending";
  const pend = () => { try { return JSON.parse(localStorage.getItem(PK) || "[]") || []; } catch (_) { return []; } };
  const savePend = (a) => { try { localStorage.setItem(PK, JSON.stringify(a.slice(-500))); } catch (_) {} };
  let remote = false, flushing = false;
  async function flush() {
    if (!remote || flushing) return; const ops = pend(); if (!ops.length) return; flushing = true;
    try {
      const r = await fetch("/api/data", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ops }) });
      if (r.ok) {
        const sent = new Set(ops.map((o) => o.col + "/" + o.id + "/" + JSON.stringify(o.value)));
        savePend(pend().filter((o) => !sent.has(o.col + "/" + o.id + "/" + JSON.stringify(o.value)))); S.sync = "on";
      }
      else if ([401, 403, 503].includes(r.status)) { remote = false; S.sync = r.status === 503 ? "nodb" : "off"; }
    } catch (_) { /* offline: stays pending */ }
    flushing = false;
    if (remote && pend().length && S.sync === "on") setTimeout(flush, 300);
  }
  function queue(col, id, value) { const a = pend().filter((o) => !(o.col === col && o.id === id)); a.push({ col, id, value }); savePend(a); flush(); }
  return {
    load: L.load, pend, savePend, flush,
    setRemote(b) { remote = b; },
    doc(p) { const [col, id] = p.split("/"), l = L.doc(p); return { async set(v) { await l.set(v); queue(col, id, v); }, async delete() { await l.delete(); queue(col, id, null); } }; },
  };
}
function loadState() {
  const L = DB;
  S.E = L.load("wa.entries"); S.F = L.load("wa.fb"); S.L = L.load("wa.logs");
  const cfg = L.load("wa.cfg"); EXC = cfg.ex && typeof cfg.ex === "object" ? cfg.ex : null;
  S.T = cfg.tests && typeof cfg.tests === "object" ? { ftp: cfg.tests.ftp || {}, kraft: cfg.tests.kraft || {} } : { ftp: {}, kraft: {} };
  if (cfg.base && cfg.base.ftp) S.ftpBase = cfg.base.ftp;
  const C = L.load("wa.checks"), CC = {}; Object.keys(C).forEach((k) => { const v = C[k]; if (v && Array.isArray(v.ex)) CC[k] = { key: v.key, ex: v.ex.slice() }; }); S.C = CC;
  recalcFtp();
}
function bootDb() { DB = makeDB(); S.dbOK = true; S.sync = "local"; loadState(); }
async function syncRemote() {
  try {
    const r = await fetch("/api/data", { credentials: "same-origin", cache: "no-store" });
    if (!r.ok) { S.sync = r.status === 503 ? "nodb" : "local"; render(); return; }
    const D = await r.json(); DB.setRemote(true);
    const empty = COLS.every((c) => !D[c] || !Object.keys(D[c]).length);
    if (empty) { // first connection: upload everything from this browser
      const ops = []; COLS.forEach((c) => { const o = DB.load("wa." + c); Object.keys(o).forEach((id) => ops.push({ col: c, id, value: o[id] })); });
      const keep = DB.pend().filter((p) => !ops.some((o) => o.col === p.col && o.id === p.id)); DB.savePend(ops.concat(keep));
    } else { // database wins, unsent local edits are applied on top
      let migrated = false; try { migrated = localStorage.getItem("wa.migrated") === "1"; } catch (_) {}
      if (!migrated) { // this browser's entries from before the database existed: merge them in once
        const ops = []; COLS.forEach((c) => { const o = DB.load("wa." + c), rem = D[c] || {}; Object.keys(o).forEach((id) => { if (!(id in rem)) ops.push({ col: c, id, value: o[id] }); }); });
        const cur = DB.pend(); DB.savePend(cur.concat(ops.filter((o) => !cur.some((p) => p.col === o.col && p.id === o.id))));
      }
      const pending = DB.pend();
      COLS.forEach((c) => {
        const o = Object.assign({}, D[c] || {});
        pending.filter((p) => p.col === c).forEach((p) => { if (p.value === null || p.value === undefined) delete o[p.id]; else o[p.id] = p.value; });
        try { localStorage.setItem("wa." + c, JSON.stringify(o)); } catch (_) {}
      });
      loadState();
    }
    try { localStorage.setItem("wa.migrated", "1"); } catch (_) {}
    S.sync = "on"; await DB.flush(); render();
  } catch (_) { S.sync = "local"; render(); }
}

/* ---------- Strava ---------- */
const LOGIN_NOTE = 'Verbinde einmal dein Strava-Konto, dann füllen sich Ringe, Woche und Erfolge mit deinen Einheiten. <a class="btn rad sm" href="/api/auth/login">Mit Strava verbinden</a>';
function applyStrava(P) {
  S.acts = (P.activities || []).map(norm); S.stamp = P.fetchedAt || Date.now();
  const A = P.athlete || {}; S.name = A.first_name || null; S.weight = A.weight || null; S.ftpStrava = A.ftp || null;
  let base = S.ftpBase || null; if (!base) { try { base = +localStorage.getItem("wa.ftpBase") || null; } catch (_) {} }
  if (!base && S.ftpStrava) base = S.ftpStrava;
  if (base && !(DB && DB.load("wa.cfg").base)) saveCfg("base", { ftp: base });
  S.ftpBase = base; recalcFtp();
  const bikes = A.bikes || [], b = bikes.find((x) => x.primary && !x.retired) || bikes.find((x) => !x.retired);
  if (b) S.bike = { name: b.name, km: b.km };
}
async function load() {
  setLive("Lädt", false);
  try {
    const r = await fetch("/api/strava", { credentials: "same-origin", cache: "no-store" });
    if (r.status === 401) {
      S.live = false; S.acts = []; S.bike = null; S.name = null; S.ftpStrava = null; recalcFtp();
      try { localStorage.removeItem("wa.cache"); } catch (_) {}
      DB.setRemote(false); S.sync = "local"; notice(LOGIN_NOTE); setLive("Offline", false); return;
    }
    if (r.status === 429) { notice("Strava bremst gerade. Versuch es in 15 Minuten erneut."); setLive(S.live ? "Strava" : "Pausiert", S.live); return; }
    if (!r.ok) { notice("Strava antwortet gerade nicht. Deine letzten Daten bleiben sichtbar."); setLive(S.live ? "Strava" : "Offline", S.live); return; }
    const P = await r.json(); applyStrava(P); S.live = true;
    try { localStorage.setItem("wa.cache", JSON.stringify(P)); } catch (_) {}
    notice(null); setLive("Strava", true);
    syncRemote();
  } catch (_) { setLive(S.live ? "Strava" : "Offline", S.live); }
  finally { render(); }
}

/* new day while the page stayed open: start fresh */
function dayCheck() { if (new Date().toLocaleDateString("sv-SE") !== TODAY) location.reload(); }
document.addEventListener("visibilitychange", () => { if (!document.hidden) dayCheck(); });
window.addEventListener("focus", dayCheck);
setInterval(dayCheck, 60000);

/* ---------- boot ---------- */
(function boot() {
  bootDb();
  try { const c = JSON.parse(localStorage.getItem("wa.cache") || "null"); if (c) { applyStrava(c); S.live = true; setLive("Strava", true); } } catch (_) {}
  const qs = new URLSearchParams(location.search), q = qs.get("strava"), feld = qs.get("feld");
  if (q) {
    const m = { ok: "Strava verbunden", abgelehnt: "Strava-Verbindung abgebrochen", rechte: "Bitte erlaube den Zugriff auf deine Aktivitäten", state: "Anmeldung abgelaufen, bitte nochmal verbinden", token: "Strava hat die Anmeldung abgelehnt", fehler: "Strava-Verbindung fehlgeschlagen" }[q];
    if (m) toast(m);
    if (q === "token") notice("Strava hat die Anmeldung abgelehnt" + (feld ? " (Feld: " + esc(feld) + ")" : "") + ". Prüfe Client ID und Secret in Vercel, dann Redeploy. " + '<a class="btn sm" href="/api/auth/login">Nochmal verbinden</a>');
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (_) {}
  }
  go((location.hash || "#heute").slice(1), false);
  load();
  Focus.resume();
})();
