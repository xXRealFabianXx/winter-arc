"use strict";
/* Winter Arc — app shell: routing, views, editing sheet, storage, Strava. Uses globals from logic.js. */

let R = null;
const VIEWS = ["heute", "woche", "rad", "kraft", "erfolge"];
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
  const m = { done: ["done", "Erledigt"], rest: ["", "Ruhetag"], planned: ["", "Geplant"], pin: ["pin", "Festgelegt"], free: ["", "Frei"], empty: ["miss", "Kein Training"], extra: ["", "Extra"] }[x.status] || ["", "Geplant"];
  return `<span class="chip ${m[0]}">${m[1]}</span>`;
}
function dayRow(x, opts) {
  const w = Math.floor(x.i / 7), k = x.keys[0], s = k ? sess(k, w) : null;
  let title = s ? s.title : x.status === "rest" ? "Ruhetag" : x.status === "empty" ? "Kein Training" : "Frei";
  if (x.keys.length > 1) title += " + " + x.keys.slice(1).map((z) => sess(z, w).title).join(" + ");
  let meta = "";
  if (x.done.length) meta = x.done.map((o) => (o.manual ? "ohne Strava eingetragen" : o.a.name + (o.a.cat === "bike" ? " · " + fN(o.a.km, 1) + " km" : " · " + fH(o.a.min) + " h"))).join(" · ");
  else if (s) meta = s.cat === "bike" ? s.min + "′ · " + fillW(s.detail).split(".")[0] : s.sets + " Sätze × 6–8 · " + s.min + "′";
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
  let card = "";
  if (day) {
    const k = day.keys[0], w = Math.floor(day.i / 7), s = k ? sess(k, w) : null, isToday = day.i === TI, canWrite = S.dbOK;
    if (day.status === "done") { heroTitle = "Erledigt"; heroCls = "grad-done"; heroSub = s ? s.title + " ist im Kasten." : "Stark."; }
    else if (day.status === "rest") { heroTitle = "Ruhetag"; heroCls = ""; heroSub = "Erholung gehört zum Plan. Die Woche ist neu verteilt."; }
    else if (!s) { heroTitle = "Frei"; heroCls = ""; heroSub = "Heute steht nichts an."; }
    else { heroTitle = s.cat === "bike" ? "Rad" : "Kraft"; heroCls = s.cat === "bike" ? "grad-rad" : "grad-kraft"; heroSub = s.title + " · " + s.min + " Minuten"; }
    let body = "";
    if (s) {
      body += `<div class="card-h"><span class="chip ${catCls(s.cat)}"><i></i>${catName(s.cat)} · ${s.min}′</span>${day.status === "done" ? `<span class="chip done">Erledigt</span>` : day.pinned ? `<span class="chip pin">Festgelegt</span>` : ""}</div>
        <div class="t-title ${s.cat === "bike" ? "grad-rad" : "grad-kraft"}">${esc(s.title)}</div>
        <div class="t-detail">${esc(s.cat === "bike" ? fillW(s.detail) : s.detail + " · " + RIR(w))}</div>`;
      if (s.cat === "bike") body += `<div class="specs">${S.ftp ? `<span class="spec"><span>Z2</span>${fillW("{Z2}")}</span><span class="spec"><span>FTP</span>${S.ftp} W</span>` : `<span class="spec"><span>Zonen</span>in % FTP</span>`}<span class="spec"><span>Dauer</span>${s.min}′</span></div>`;
      if (s.ex) body += exChecklist(day, s);
    } else {
      body += `<div class="t-title">${day.status === "rest" ? "Ruhetag" : "Frei"}</div><div class="t-detail">${day.status === "rest" ? "Eingetragen. Die übrigen Einheiten rücken nach." : "Keine Einheit geplant. Leg eine fest, wenn du Lust hast."}</div>`;
    }
    let a = "";
    if (isToday && day.status !== "done" && k) a += `<button class="btn primary" type="button" data-act="manual" data-k="${k}" ${canWrite ? "" : "disabled"}>✓ Erledigt</button>`;
    if (day.status !== "done") a += `<button class="btn" type="button" data-act="${day.e.rest ? "auto" : "rest"}" ${canWrite ? "" : "disabled"}>${day.e.rest ? "Ruhetag aufheben" : "Ruhetag"}</button>`;
    a += `<button class="btn" type="button" data-act="sheet" data-i="${day.i}">Ändern</button>`;
    card = `<section class="card today span-8 ${s ? "accent-" + catCls(s.cat) : ""}" data-date="${day.date}">${body}<div class="btns" data-actions data-date="${day.date}">${a}</div></section>`;
  }
  const quota = R.doneAll + R.lost ? Math.round((R.doneAll / (R.doneAll + R.lost)) * 100) : null;
  const rings = `<section class="card span-4"><div class="card-h"><h3>Diese Woche</h3><span class="label">Etappe ${cw + 1}</span></div>
     <div class="goals" style="grid-template-columns:1fr;gap:14px">
       ${goal("Rad", W.bikeN, 3, "Einheiten", "rad", (n) => n)}
       ${goal("Kraft", W.gymN, 4, "Einheiten", "kraft", (n) => n)}
       ${goal("Zeit", W.total / 60, W.planned / 60, "h", "", (n) => fN(n, 1))}
     </div></section>`;
  const next = upcoming(null, 3);
  const nextCard = `<section class="card span-6"><div class="card-h"><h3>Als Nächstes</h3><button class="btn sm" type="button" data-go="woche">Ganze Woche</button></div><div class="rows">${next.length ? next.map((x) => dayRow(x)).join("") : `<p class="empty">Nichts mehr geplant.</p>`}</div></section>`;
  const ch = W.ch, chP = Math.min(ch.cur / ch.target, 1);
  const chTxt = !W.started ? "Startet " + dm(iso(cw * 7)) : !S.live ? "Wartet auf Strava" : ch.won ? "Geschafft" : ch.target === 1 ? "Offen" : (ch.unit === " h" ? fN(ch.cur, 1) : fN(ch.cur)) + " / " + fN(ch.target) + ch.unit;
  const chCard = `<section class="card span-6"><div class="card-h"><h3>Wochen-Challenge</h3><span class="chip pin">+150 XP</span></div><div style="font-size:1.25rem;font-weight:600;letter-spacing:-.01em">${esc(CH[cw].t)}</div><div class="track gold"><i style="width:${S.live && W.started ? Math.round(chP * 100) : 0}%"></i></div><span class="label num">${esc(chTxt)}</span></section>`;
  const adj = adjustCard(W);
  return {
    hero: `<span class="label">${esc(eyebrow)}</span><h1 class="xl"><span class="${heroCls}">${esc(heroTitle)}</span></h1><p class="sub">${esc(heroSub)}</p>`,
    body: card + rings + adj + nextCard + chCard + `<section class="card span-12"><div class="kpis">${kpi("Level", levelOf(R.xp) + 1, "", esc(LEVELS[levelOf(R.xp)][1]))}${kpi("XP", fN(R.xp))}${kpi("Serie", R.wStreak, " Wo", R.dStreak + " Tage im Plan")}${kpi("Plan-Quote", quota === null ? "–" : quota, quota === null ? "" : " %")}</div></section>`,
  };
}
function exChecklist(day, s) {
  const can = day.i === TI && S.dbOK;
  const on = new Set(S.C[day.date] && S.C[day.date].key === s.key ? S.C[day.date].ex : []);
  const n = s.ex.filter((e) => on.has(e)).length;
  return `<div style="display:flex;flex-direction:column;gap:10px"><div class="card-h"><span class="label">${can ? "Übungen abhaken" : "Übungen"}</span><span class="label num" style="color:${n === s.ex.length ? "var(--done)" : "var(--muted)"}">${n}/${s.ex.length}</span></div>
    <div class="track"><i style="width:${Math.round((n / s.ex.length) * 100)}%"></i></div>
    <div class="exgrid">${s.ex.map((e) => `<button type="button" class="ex${on.has(e) ? " on" : ""}" data-ex="${esc(e)}" data-date="${day.date}" data-k="${s.key}" aria-pressed="${on.has(e)}" ${can ? "" : "disabled"}><span class="box">✓</span><span class="nm">${esc(e)}</span><span class="sx">${s.sets}×6–8</span></button>`).join("")}</div></div>`;
}
function adjustCard(W) {
  const w = W.w, lines = [];
  W.moves.forEach((m) => lines.push(esc(m)));
  W.dropped.forEach((k) => lines.push(esc(sess(k, w).title) + (W.ended ? " wurde verpasst" : " passt diese Woche nicht mehr rein")));
  if (!lines.length) return "";
  return `<section class="card adjust span-12"><div class="card-h"><h3>Plan angepasst</h3><span class="label">Etappe ${w + 1}</span></div><ul>${lines.map((l) => "<li>" + l + "</li>").join("")}</ul></section>`;
}
function vWoche() {
  const w = S.sel, W = R.weeks[w], cw = curW();
  const season = `<div class="season" id="season">${R.weeks.map((x) => `<button type="button" class="wk${x.w === S.sel ? " sel" : ""}${x.w === cw && TI >= 0 ? " now" : ""}" data-w="${x.w}" aria-label="Etappe ${x.w + 1}"><span class="n">${x.w + 1}</span><span class="bars">${Array.from({ length: 7 }, (_, j) => `<i class="${j < x.doneN ? "d" : ""}"></i>`).join("")}</span><span class="p">${esc(PHASE[x.w])}</span></button>`).join("")}</div>`;
  const list = `<section class="card span-7"><div class="card-h"><div><span class="label">Etappe ${w + 1} / 16 · ${dm(iso(w * 7))} – ${dm(iso(w * 7 + 6))}</span><h3 style="font-size:1.3rem;margin-top:2px">${esc(PHASE[w])}${w === cw ? " · jetzt" : ""}</h3></div>
      <div class="weeknav"><button class="circ" type="button" data-wk="-1" aria-label="Vorherige Woche" ${w === 0 ? "disabled" : ""}>‹</button><button class="btn sm" type="button" data-wk="0">Heute</button><button class="circ" type="button" data-wk="1" aria-label="Nächste Woche" ${w === WEEKS - 1 ? "disabled" : ""}>›</button></div></div>
    <div class="rows">${W.days.map((x) => dayRow(x)).join("")}</div>
    <p class="empty" style="font-size:.82rem">Tag antippen für Ruhetag, Einheit festlegen oder ohne Strava abhaken. Die Woche plant sich selbst neu, nach Beinen kommt nie Rad.</p></section>`;
  const sum = `<section class="card span-5"><div class="card-h"><h3>Fortschritt</h3><span class="label num">${W.doneN} / 7</span></div><div class="track"><i style="width:${Math.round((W.doneN / 7) * 100)}%"></i></div>
    <div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))">${kpi("Rad", W.bikeN, "/3")}${kpi("Kraft", W.gymN, "/4")}${kpi("km", fN(W.km))}${kpi("Zeit", fH(W.total), " h")}</div></section>`;
  const chart = `<section class="card span-12"><div class="card-h"><h3>Umfang pro Etappe</h3><div class="legend label"><span><i style="background:var(--violet)"></i>Ist</span><span><i style="border:1.5px dashed var(--muted)"></i>Plan</span></div></div>${weekChart(R.weeks.map((x) => ({ val: x.total, plan: x.planned })), { step: 120, tick: (v) => v / 60 + "h", grad: "gAll", aria: "Trainingsstunden je Etappe" })}</section>`;
  return {
    hero: `<span class="label">Etappe ${w + 1} · ${esc(PHASE[w])}</span><h1 class="xl">Woche</h1><p class="sub">${W.doneN} von 7 Einheiten · ${fH(W.total)} von ${fH(W.planned)} h</p>`,
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
    body: `<div class="span-12 kpis">${kpi("Diese Woche", fN(W.km), " km", W.bikeN + " von 3 Ausfahrten")}${kpi("Rad-Zeit", fH(W.bikeMin), " h")}${kpi("Höhenmeter", fN(W.hm), " Hm")}${kpi("Längste", fH(W.maxRide), " h", "Ausfahrt der Woche")}</div>` +
      `<section class="card accent-rad span-7"><div class="card-h"><h3>Nächste Ausfahrten</h3><span class="label">3 pro Woche</span></div><div class="rows">${next.length ? next.map((x) => dayRow(x)).join("") : `<p class="empty">Keine Ausfahrt mehr geplant.</p>`}</div></section>` +
      `<section class="card span-5"><div class="card-h"><h3>Wattzonen</h3><span class="label">${S.ftp ? "FTP " + S.ftp + " W" : "% FTP"}</span></div><div class="zones">${zoneRows}</div><span class="label">Sweetspot ${fillW("{SS}")}</span></section>` +
      `<section class="card span-12"><div class="card-h"><h3>Rad-Stunden pro Etappe</h3><div class="legend label"><span><i style="background:var(--rad)"></i>Ist</span><span><i style="border:1.5px dashed var(--muted)"></i>Plan</span></div></div>${weekChart(R.weeks.map((x) => ({ val: x.bikeMin, plan: ["int", "base", "long"].reduce((t, k) => t + sess(k, x.w).min, 0) })), { step: 120, tick: (v) => v / 60 + "h", grad: "gRad", aria: "Rad-Stunden je Etappe" })}</section>` +
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
      <ol>${s.ex.map((e) => `<li>${esc(e)}<span>${s.sets} × 6–8</span></li>`).join("")}</ol>
      <span class="label">${ld ? "Zuletzt " + DOW[ld.d] + " " + dm(ld.date) : "Noch nicht trainiert"} · ca. ${s.min}′</span></section>`;
  }).join("");
  const blocks = [["1–3", "Technik & Startgewichte", "RIR 2"], ["5–7", "Gewicht steigern", "RIR 1"], ["9–11", "Schwerste Phase", "RIR 0–1"], ["13–15", "Kraft halten", "RIR 1"]];
  const phaseCard = `<section class="card span-5"><div class="card-h"><h3>Phase</h3><span class="label">Etappe ${cw + 1}</span></div><div style="font-size:1.15rem;font-weight:600">${esc(RIR(cw))}</div>
    <div class="rows">${blocks.map((b) => `<div class="row" style="grid-template-columns:64px minmax(0,1fr) auto;min-height:48px"><span class="label">Etappe ${b[0]}</span><span>${b[1]}</span><span class="chip kraft">${b[2]}</span></div>`).join("")}</div>
    <span class="label">Entlastung in Etappe 4, 8 und 12: Gewicht −10 %, Push & Pull 2 Sätze</span></section>`;
  const next = upcoming("gym", 4);
  return {
    hero: `<span class="label">${esc(RIR(cw))}</span><h1 class="xl"><span class="grad-kraft">Kraft</span></h1><p class="sub">${W.gymN} von 4 Einheiten diese Woche · ${R.tot.gym} von 64 gesamt</p>`,
    body: `<div class="span-12 kpis">${kpi("Diese Woche", W.gymN, "/4")}${kpi("Gesamt", R.tot.gym, "/64")}${kpi("Nächste", next[0] ? esc(sess(next[0].keys[0], Math.floor(next[0].i / 7)).title) : "–", "", next[0] ? DOWL[next[0].d] + " " + dm(next[0].date) : "")}${kpi("Satzbereich", "6–8", " Wdh.")}</div>` +
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
    ? `<div class="card-h"><span style="display:flex;gap:8px;align-items:center"><span class="led on"></span>Strava verbunden${S.name ? " als " + esc(S.name) : ""}</span><span class="label">Stand ${stampTxt()}</span></div><div class="btns"><button class="btn" type="button" data-act="refresh">Aktualisieren</button><a class="btn" href="/api/auth/logout">Strava trennen</a></div>`
    : `<div class="card-h"><span style="display:flex;gap:8px;align-items:center"><span class="led"></span>Strava nicht verbunden</span></div><div class="btns"><a class="btn rad" href="/api/auth/login">Mit Strava verbinden</a></div>`;
  const base = S.acts.filter((a) => a.date >= "2026-09-14" && a.date <= "2026-10-11"), bk = base.filter((a) => a.cat === "bike");
  return {
    hero: `<span class="label">Level ${lv + 1} · ${esc(LEVELS[lv][1])}</span><h1 class="xl"><span class="grad-gold">Erfolge</span></h1><p class="sub">${fN(R.xp)} XP${nx ? " · noch " + fN(nx[0] - R.xp) + " bis " + esc(nx[1]) : ""}</p>`,
    body: `<section class="card span-7"><div class="card-h"><h3>Level ${lv + 1} · ${esc(LEVELS[lv][1])}</h3><span class="label num">${fN(R.xp)} XP</span></div><div class="track gold"><i style="width:${nx ? pct(R.xp - LEVELS[lv][0], nx[0] - LEVELS[lv][0]) : 100}%"></i></div><span class="label">${nx ? "Nächstes Level: " + esc(nx[1]) + " bei " + fN(nx[0]) + " XP" : "Höchstes Level erreicht"}</span>
        <div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))">${kpi("Winter Arc", arcDay, "/90")}${kpi("Wochen-Serie", R.wStreak, " Wo")}${kpi("Tage im Plan", R.dStreak)}${kpi("Plan-Quote", quota === null ? "–" : quota, quota === null ? "" : " %")}</div></section>` +
      `<section class="card span-5"><div class="card-h"><h3>Wochen-Challenges</h3><span class="label">${won} / 16</span></div><div style="font-size:1.1rem;font-weight:600">${esc(CH[cw].t)}</div><span class="label">Diese Woche · +150 XP</span><div class="chs">${R.weeks.map((w) => `<span class="${w.ch.won ? "won" : ""}${w.w === cw ? " now" : ""}" title="${esc(CH[w.w].t)}">${w.ch.won ? "✓" : w.w + 1}</span>`).join("")}</div></section>` +
      `<section class="card span-12"><div class="card-h"><h3>Ziele bis 31. Januar</h3><span class="label">${Math.max(0, DAYS - Math.max(TI, 0))} Tage übrig</span></div><div class="goals">${goal("Rad-Kilometer", R.tot.km, 2000, "km", "rad")}${goal("Stunden", R.tot.min / 60, 150, "h", "")}${goal("Krafteinheiten", R.tot.gym, 64, "", "kraft")}${goal("Höhenmeter", R.tot.hm, 3000, "Hm", "violet")}${goal("FTP", S.ftp || 0, fg || 220, "W", "gold", (n) => (n ? fN(n) : "–"), ftpProg())}</div></section>` +
      `<section class="card span-12"><div class="card-h"><h3>Abzeichen</h3><span class="label">${got} / ${R.badges.length} · je +100 XP</span></div><div class="badges">${R.badges.map((b) => `<div class="badge${b.got ? " got" : ""}"><span class="medal">${esc(b.k)}</span><div style="min-width:0"><div class="bt">${esc(b.t)}</div><div class="bd">${esc(b.d)}</div></div></div>`).join("")}</div></section>` +
      `<section class="card span-7"><div class="card-h"><h3>Strava</h3></div>${account}</section>` +
      `<section class="card span-5"><div class="card-h"><h3>Ausgangslage</h3><span class="label">Ø pro Woche · 14.9.–11.10.</span></div>${S.live ? `<div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))">${kpi("Rad", fN(bk.reduce((t, a) => t + a.km, 0) / 4), " km")}${kpi("Rad-Zeit", fN(bk.reduce((t, a) => t + a.min, 0) / 240, 1), " h")}${kpi("Kraft", fN(base.filter((a) => a.cat === "gym").length / 4, 1), "×")}${kpi("Gesamt", fN(base.reduce((t, a) => t + a.min, 0) / 240, 1), " h")}</div>` : `<p class="empty">Erscheint, sobald Strava verbunden ist.</p>`}</section>`,
  };
}
const RENDER = { heute: vHeute, woche: vWoche, rad: vRad, kraft: vKraft, erfolge: vErfolge };

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
      rings: [W.bikeN / 3, W.gymN / 4, W.planned ? W.total / W.planned : 0],
      week: R.weeks[view === "woche" ? S.sel : curW()].days.map((x) => { const k = x.keys[0]; return { min: k ? sess(k, Math.floor(x.i / 7)).min : 0, cat: k ? CAT[k] : null, done: x.status === "done", rest: !k, today: x.i === TI }; }),
      level: { n: lv + 1, name: LEVELS[lv][1] },
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
  const ex = t.closest("[data-ex]"); if (ex && !ex.disabled) { toggleEx(ex.dataset.date, ex.dataset.k, ex.dataset.ex); return; }
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
    <span class="muted" style="font-size:.8rem">${past ? "Was in Strava steht, wird automatisch erkannt." : "Am Tag nach Beinen plant der Plan kein Rad. Festlegungen haben Vorrang."}</span>`;
  $("scrim").hidden = false;
}
function closeSheet() { $("scrim").hidden = true; sheetI = null; }
$("scrim").addEventListener("click", (e) => {
  if (e.target === $("scrim") || e.target.closest("[data-close]")) { closeSheet(); return; }
  const b = e.target.closest("[data-set]"); if (!b || sheetI === null) return;
  const v = b.dataset.set;
  writeEntry(iso(sheetI), v === "auto" ? null : v === "rest" ? { rest: true } : v.startsWith("m:") ? { manual: v.slice(2) } : { pin: v.slice(2) });
  closeSheet();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("scrim").hidden) closeSheet(); });

/* ---------- storage (browser for now) ---------- */
let DB = null;
async function writeEntry(date, val) {
  if (!DB) return;
  if (val) S.E[date] = val; else delete S.E[date];
  render();
  try { const ref = DB.doc("entries/" + date); if (val) await ref.set(val); else await ref.delete(); } catch (_) {}
  toast(val ? (val.rest ? "Ruhetag eingetragen · Woche neu geplant" : val.manual ? "Als erledigt eingetragen" : "Einheit festgelegt · Woche neu geplant") : "Zurück auf automatisch");
}
function toggleEx(date, key, name) {
  if (!DB) return;
  const c = S.C[date] && S.C[date].key === key ? S.C[date].ex.slice() : [];
  const i = c.indexOf(name); if (i >= 0) c.splice(i, 1); else c.push(name);
  if (c.length) S.C[date] = { key, ex: c }; else delete S.C[date];
  render();
  if (i < 0 && c.length === (GYM[key] ? GYM[key].ex.length : 0)) toast("Alle Übungen geschafft");
  const ref = DB.doc("checks/" + date); (c.length ? ref.set({ key, ex: c }) : ref.delete()).catch(() => {});
}
function bootDb() {
  const L = localDB(); DB = L; S.dbOK = true; S.E = L.load("wa.entries");
  const C = L.load("wa.checks"), CC = {}; Object.keys(C).forEach((k) => { const v = C[k]; if (v && Array.isArray(v.ex)) CC[k] = { key: v.key, ex: v.ex.slice() }; }); S.C = CC;
}

/* ---------- Strava ---------- */
const LOGIN_NOTE = 'Verbinde einmal dein Strava-Konto, dann füllen sich Ringe, Woche und Erfolge mit deinen Einheiten. <a class="btn rad sm" href="/api/auth/login">Mit Strava verbinden</a>';
function applyStrava(P) {
  S.acts = (P.activities || []).map(norm); S.stamp = P.fetchedAt || Date.now();
  const A = P.athlete || {}; S.name = A.first_name || null; S.weight = A.weight || null; S.ftp = A.ftp || null;
  let base = null; try { base = +localStorage.getItem("wa.ftpBase") || null; } catch (_) {}
  if (!base && S.ftp) { base = S.ftp; try { localStorage.setItem("wa.ftpBase", String(S.ftp)); } catch (_) {} }
  S.ftpBase = base;
  const bikes = A.bikes || [], b = bikes.find((x) => x.primary && !x.retired) || bikes.find((x) => !x.retired);
  if (b) S.bike = { name: b.name, km: b.km };
}
async function load() {
  setLive("Lädt", false);
  try {
    const r = await fetch("/api/strava", { credentials: "same-origin", cache: "no-store" });
    if (r.status === 401) { S.live = false; notice(LOGIN_NOTE); setLive("Offline", false); return; }
    if (r.status === 429) { notice("Strava bremst gerade. Versuch es in 15 Minuten erneut."); setLive(S.live ? "Strava" : "Pausiert", S.live); return; }
    if (!r.ok) { notice("Strava antwortet gerade nicht. Deine letzten Daten bleiben sichtbar."); setLive(S.live ? "Strava" : "Offline", S.live); return; }
    const P = await r.json(); applyStrava(P); S.live = true;
    try { localStorage.setItem("wa.cache", JSON.stringify(P)); } catch (_) {}
    notice(null); setLive("Strava", true);
  } catch (_) { setLive(S.live ? "Strava" : "Offline", S.live); }
  finally { render(); }
}

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
})();
