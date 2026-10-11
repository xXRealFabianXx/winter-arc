"use strict";
/* Winter Arc — plan, re-planning, gamification. Plain globals shared with app.js */
/* ================= Basics ================= */
const BASE=Date.UTC(2026,9,12),DAY=864e5,WEEKS=16,DAYS=112,ARC0="2026-10-05";
const iso=i=>new Date(BASE+i*DAY).toISOString().slice(0,10);
const idx=s=>{const p=s.split("-").map(Number);return Math.round((Date.UTC(p[0],p[1]-1,p[2])-BASE)/DAY)};
const TODAY=new Date().toLocaleDateString("sv-SE"),TI=idx(TODAY);
const DOW=["Mo","Di","Mi","Do","Fr","Sa","So"],DOWL=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
const dm=s=>{const p=s.split("-");return (+p[2])+"."+(+p[1])+"."};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $=id=>document.getElementById(id);
const fN=(n,d=0)=>(+n).toLocaleString("de-DE",{maximumFractionDigits:d,minimumFractionDigits:d});
const fH=m=>{const h=Math.floor(m/60),r=Math.round(m%60);return h+":"+String(r).padStart(2,"0")};
const clampW=k=>Math.min(Math.max(k,0),WEEKS-1);
const curW=()=>clampW(Math.floor(TI/7));

/* ================= Plan definition ================= */
const Z={Z2:[56,75],TEMPO:[76,90],SS:[88,94],SCHW:[95,105],VO2:[110,120]};
const PHASE=["Basis","Basis","Basis","Entlastung · Test","Sweetspot","Schwelle","Schwelle","Entlastung · Test","Aufbau","Aufbau","Weihnachten","Entlastung · Test","Peak","Peak","Peak","Taper · Finale"];
const DELOAD=new Set([3,7,11]);
/* per week: [Intervalle, Grundlage, Lang] → [title, detail, minutes] */
const B=[
 [["Sweetspot 3×10′","3 × 10′ @ {SS}, 5′ locker dazwischen. Rest Z2 @ {Z2}.",75],["Grundlage","Gleichmäßig Z2 @ {Z2}, Kadenz 85–95.",90],["Lange Ausfahrt","Z2 @ {Z2}, Anstiege nicht über {TEMPO}.",150]],
 [["Sweetspot 3×12′","3 × 12′ @ {SS}, 5′ locker.",75],["Grundlage","Z2 @ {Z2}.",90],["Lange Ausfahrt","Z2 @ {Z2}, letzte 20′ @ {TEMPO}.",165]],
 [["Sweetspot 3×15′","3 × 15′ @ {SS}, 5′ locker.",90],["Grundlage + Kadenz","Z2 @ {Z2}, 5 × 1′ Kadenz 110+.",100],["Lange Ausfahrt","Z2 @ {Z2}. Alle 45′ essen.",180]],
 [["Locker + Sprints","Z2 @ {Z2}, 4 × 15″ Sprint, voll erholen.",60],["FTP-Test","Auf Zwift: Workout „FTP Test“ (20 Minuten) fahren. Den 20′-Schnitt danach unter Tests eintragen.",75],["Ausfahrt locker","Z1–Z2, Gruppe genießen.",120]],
 [["Sweetspot 2×20′","2 × 20′ @ {SS}, 8′ locker.",90],["Grundlage","Z2 @ {Z2}.",90],["Lang + Tempo","Z2 @ {Z2}, darin 2 × 15′ @ {TEMPO}.",180]],
 [["Schwelle 3×10′","3 × 10′ @ {SCHW}, 5′ locker.",90],["Grundlage","Z2 @ {Z2}.",100],["Lange Ausfahrt","Z2 @ {Z2}.",195]],
 [["Schwelle 3×12′","3 × 12′ @ {SCHW}, 5′ locker.",90],["Grundlage + Tempo","Z2 @ {Z2}, 20′ @ {TEMPO} am Ende.",100],["Lange Ausfahrt","Z2 @ {Z2}, längste bisher.",210]],
 [["Locker","Z2 @ {Z2}.",60],["Openers","Z2 @ {Z2}, 3 × 1′ @ {VO2}. Früh schlafen.",60],["FTP-Test","Auf Zwift: Workout „FTP Test“ (20 Minuten) fahren. Den 20′-Schnitt danach unter Tests eintragen.",75]],
 [["VO2max 5×3′","5 × 3′ @ {VO2}, 3′ locker.",75],["Grundlage","Z2 @ {Z2}.",100],["Lang + Schwelle","Z2 @ {Z2}, darin 3 × 10′ @ {SCHW}.",210]],
 [["VO2max 5×4′","5 × 4′ @ {VO2}, 4′ locker.",80],["Schwelle 2×15′","2 × 15′ @ {SCHW}, 5′ locker.",90],["Lange Ausfahrt","Z2 @ {Z2}.",210]],
 [["Sweetspot 3×15′","3 × 15′ @ {SS}.",90],["Grundlage lang","Z2 @ {Z2}. Feiertage nutzen.",120],["Weihnachts-Kilometer","Z2 @ {Z2}: 4 h draußen oder 2:30 h indoor.",240]],
 [["Locker","Z2 @ {Z2}.",60],["FTP-Test","Auf Zwift: Workout „FTP Test“ (20 Minuten) fahren. Den 20′-Schnitt danach unter Tests eintragen.",75],["Tag 90: Neujahrsrunde","Locker in der Gruppe, Z1–Z2. Winter Arc geschafft.",120]],
 [["VO2max 4×5′","4 × 5′ @ {VO2}, 5′ locker.",85],["Schwelle 2×20′","2 × 20′ @ {SCHW}, 8′ locker.",100],["Lang + Schwelle","Z2 @ {Z2}, darin 3 × 12′ @ {SCHW}.",210]],
 [["VO2 + Sweetspot","6 × 3′ @ {VO2}, danach 15′ @ {SS}.",90],["Grundlage","Z2 @ {Z2}.",100],["Lange Ausfahrt","Z2 @ {Z2}, längste des Winters.",225]],
 [["Schwelle 2×20′","2 × 20′ @ {SCHW}.",90],["Grundlage","Z2 @ {Z2}.",90],["Lang + Sweetspot","Z2 @ {Z2}, darin 4 × 10′ @ {SS}.",210]],
 [["Openers","Z2 @ {Z2}, 3 × 3′ @ {SCHW}.",60],["Locker + Openers","Z2 @ {Z2}, 3 × 1′ @ {VO2}.",60],["Finaler FTP-Test","Auf Zwift wie in Etappe 4, 8 und 12. Ziel: {GOAL}. Den 20′-Schnitt danach unter Tests eintragen.",75]]
];
const PUSH=["Schrägbankdrücken","Flys","Trizeps","Seitheben"];
const PULL=["Latzug","Rudern","Rudern breit","Bizeps · Übung 1","Bizeps · Übung 2"];
const GYM={push:{n:"Push",ex:PUSH,sets:3,min:60},pull:{n:"Pull",ex:PULL,sets:3,min:60},legs:{n:"Beine",ex:["RDLs","Beinpresse","Beinstrecker","Beinbeuger","Waden"],sets:2,min:55},upper:{n:"Oberkörper",ex:PUSH.concat(PULL),sets:2,min:60}};
const gymSets=(k,w)=>{let s=GYM[k].sets;if((DELOAD.has(w)||w===15)&&(k==="push"||k==="pull"))s=2;return s};
const TESTW=new Set([3,7,11,15]);
const RIR=w=>TESTW.has(w)?"Testwoche · 6 Wdh. Test pro Übung, sonst locker":w<=2?"RIR 2 · Technik sauber, Startgewichte finden":DELOAD.has(w)?"Entlastung · Gewicht −10 %, RIR 3":w<=6?"RIR 1 · steigern, sobald 8 Wdh. sauber sitzen":w<=10?"RIR 0–1 · schwerste Phase":w<=14?"RIR 1 · Kraft halten, Rad hat Vorrang":"Taper · RIR 2";

/* Default week: Mo Push · Di Intervalle · Mi Beine · Do Pull · Fr Grundlage · Sa Lang · So Oberkörper (no bike the day after legs) */
const KEYS=["push","int","legs","pull","base","long","upper"];
const DEF={push:0,int:1,legs:2,pull:3,base:4,long:5,upper:6};
const CAT={push:"gym",pull:"gym",legs:"gym",upper:"gym",int:"bike",base:"bike",long:"bike"};
const PRIO={long:100,int:95,base:85,legs:80,push:70,pull:65,upper:40};
const BI={int:0,base:1,long:2};
/* Exercises: defaults above, user's own lists (Kraft → Übungen) override them.
   Each exercise: {n: name, s: sets, r: reps}. Oberkörper = Push + Pull with at most 2 sets. */
let EXC=null; // custom lists {push:[],pull:[],legs:[]}
const EX_DEFAULT={push:PUSH.map(n=>({n,s:3,r:"6–8"})),pull:PULL.map(n=>({n,s:3,r:"6–8"})),legs:GYM.legs.ex.map(n=>({n,s:2,r:"6–8"}))};
const baseList=k=>((EXC&&Array.isArray(EXC[k]))?EXC[k]:EX_DEFAULT[k]);
function exOf(k,w){
  if(k==="upper")return baseList("push").concat(baseList("pull")).map(e=>({n:e.n,s:Math.min(2,e.s),r:e.r}));
  const deload=(DELOAD.has(w)||w===15)&&(k==="push"||k==="pull");
  return baseList(k).map(e=>({n:e.n,s:deload?Math.min(2,e.s):e.s,r:e.r}));
}
function setsSummary(list){
  if(!list.length)return "keine Übungen";
  const s0=list[0].s,r0=list[0].r;
  return list.every(e=>e.s===s0&&e.r===r0)?s0+" × "+r0+" Wdh.":list.reduce((t,e)=>t+e.s,0)+" Sätze";
}
function sess(k,w){
  if(CAT[k]==="bike"){const b=B[w][BI[k]];return {key:k,cat:"bike",title:b[0],detail:b[1],min:b[2]}}
  const g=GYM[k];
  if(TESTW.has(w)&&k!=="upper"){const ex=exOf(k,w).map(e=>({n:e.n,s:1,r:"6 Wdh. Test"}));return {key:k,cat:"gym",title:g.n+"-Test",detail:"Pro Übung aufwärmen und das Gewicht für genau 6 saubere Wiederholungen ermitteln. Werte unter Tests eintragen.",min:g.min,ex:ex,sets:1,summary:"Test · 6 Wdh.",test:true}}
  const ex=exOf(k,w);
  return {key:k,cat:"gym",title:g.n,detail:ex.length+" Übungen · "+setsSummary(ex),min:g.min-(DELOAD.has(w)?10:0),ex:ex,sets:ex.length?Math.max(...ex.map(e=>e.s)):0,summary:setsSummary(ex)};
}
/* session for a planned day, including feedback modifications (e.g. intervals turned easy) */
function sessOf(x){
  const k=x.keys[0];if(!k)return null;const w=Math.floor(x.i/7),s=sess(k,w);
  if(x.mod&&x.mod.easy&&k==="int"){const b=sess("base",w);return Object.assign({},s,{title:"Locker statt "+s.title,detail:"Z2 @ {Z2}, keine Intervalle ("+x.mod.why+").",easy:true,min:Math.min(s.min,b.min)})}
  return s;
}

/* ================= Tests (every 4 weeks) ================= */
const TESTS=[{n:1,w:3},{n:2,w:7},{n:3,w:11},{n:4,w:15}];
const ftpFrom20=p=>p?Math.round(p*0.95):null;
function testFtps(){const o=[];TESTS.forEach(t=>{const p=S.T&&S.T.ftp&&S.T.ftp[t.n];if(p)o.push({n:t.n,ftp:ftpFrom20(p),p20:p})});return o}
function strengthGain(){ // average % change from first to latest value across exercises with ≥2 values
  const K=(S.T&&S.T.kraft)||{},by={};
  TESTS.forEach(t=>{const r=K[t.n]||{};Object.keys(r).forEach(n=>{if(r[n]>0)(by[n]=by[n]||[]).push(r[n])})});
  const d=Object.values(by).filter(a=>a.length>1).map(a=>(a[a.length-1]-a[0])/a[0]);
  return d.length?d.reduce((t,x)=>t+x,0)/d.length:0;
}

/* ================= State ================= */
const S={acts:[],E:{},C:{},F:{},L:{},T:{ftp:{},kraft:{}},bike:null,ftp:null,ftpBase:null,weight:null,name:null,live:false,stamp:null,dbOK:false,sel:curW()};
const ftpGoal=()=>S.ftpBase?Math.round(S.ftpBase*1.1):null;
function fillW(t){return t.replace(/\{(\w+)\}/g,(m,k)=>{
  if(k==="GOAL"){const g=ftpGoal();return g?g+" W":"+10 % FTP"}
  const z=Z[k];if(!z)return m;
  return S.ftp?Math.round(S.ftp*z[0]/100)+"–"+Math.round(S.ftp*z[1]/100)+" W":z[0]+"–"+z[1]+" % FTP"})}
const BIKE=new Set(["Ride","VirtualRide","GravelRide","MountainBikeRide","EBikeRide","EMountainBikeRide","Velomobile","Handcycle"]);
const GYMT=new Set(["WeightTraining","Workout","Crossfit"]);
function norm(a){const s=a.summary||{},st=a.start_local||"";
  return {id:String(a.id),name:a.name||"Aktivität",cat:BIKE.has(a.sport_type)?"bike":GYMT.has(a.sport_type)?"gym":"other",date:st.slice(0,10),hour:+st.slice(11,13)||0,min:(s.moving_time||0)/60,km:(s.distance||0)/1000,hm:s.elevation_gain||0}}
function gymKey(n){n=n.toLowerCase();if(/ober|upper/.test(n))return "upper";if(/bein|bene|leg|rdl|squat|kniebeuge/.test(n))return "legs";if(/pull|rücken|ruecken|back|latzug/.test(n))return "pull";if(/push|brust|chest|schräg|bank/.test(n))return "push";return null}

/* ================= Planner ================= */
function planWeek(w,prevLegs,byDate){
  const pool=new Set(KEYS),days=[];
  for(let d=0;d<7;d++){
    const i=w*7+d,date=iso(i),e=S.E[date]||{},acts=(byDate[date]||[]);
    const real=acts.filter(a=>a.cat!=="other");
    const locked=i<TI||(i===TI&&(real.length>0||!!e.manual));
    days.push({i:i,d:d,date:date,e:e,acts:acts,locked:locked,keys:[],done:[],extra:[],status:null});
  }
  // 1) what already happened
  days.filter(x=>x.locked).forEach(x=>{
    let absorb=null; // the session logged on the site and the Strava/Garmin recording of it count once
    if(x.e.manual){const k=pool.has(x.e.manual)?x.e.manual:null;if(k){pool.delete(k);x.done.push({k:k,manual:true});absorb=CAT[k]}}
    x.acts.slice().sort((a,b)=>b.min-a.min).forEach(a=>{
      if(absorb&&a.cat===absorb){absorb=null;const o=x.done.find(d=>d.manual&&!d.a);if(o)o.a=a;return}
      if(a.cat==="other"){x.extra.push(a);return}
      let k=null;const dk=x.e.pin||KEYS[x.d];
      if(a.cat==="gym"){k=gymKey(a.name);if(!k||!pool.has(k))k=(CAT[dk]==="gym"&&pool.has(dk))?dk:["push","pull","legs","upper"].find(z=>pool.has(z))||null}
      else{if((a.min>=150||a.km>=70)&&pool.has("long"))k="long";if(!k)k=(CAT[dk]==="bike"&&pool.has(dk))?dk:["int","base","long"].find(z=>pool.has(z))||null}
      if(k){pool.delete(k);x.done.push({k:k,a:a})}else x.extra.push(a);
    });
    x.keys=x.done.map(o=>o.k);
    x.status=x.done.length?"done":x.e.rest?"rest":x.extra.length?"extra":"empty";
  });
  // 1b) feedback rules: missed intervals, hard days, tired legs, skipped exercises
  const notes=[];let easy=null,suggestRest=null;const makeup=[],legsSkipped=[];
  days.filter(x=>x.locked).forEach(x=>{
    const fb=S.F[x.date]||{};
    const bd=x.done.find(o=>CAT[o.k]==="bike");
    if(bd&&bd.k==="int"&&(fb.how==="locker"||fb.how==="anders")&&pool.has("base")&&!DELOAD.has(w)&&w!==15&&!/FTP/.test(sess("base",w).title)){
      pool.delete("base");pool.add("int");bd.k="base";x.keys=x.done.map(o=>o.k);
      notes.push("Intervalle am "+DOW[x.d]+" nicht gefahren: werden nachgeholt, dafür entfällt die Grundlage");
    }
    if(fb.how==="haerter"||fb.feel==="muede"||fb.feel==="platt")easy={from:x.i,why:fb.feel==="platt"?"Beine platt":fb.feel==="muede"?"Beine müde":"zuletzt härter gefahren"};
    if(fb.feel==="platt"&&x.i>=TI-1)suggestRest=x.i+1;
    x.done.forEach(o=>{
      if(CAT[o.k]!=="gym")return;const c=S.C[x.date];if(!c||c.key!==o.k)return;
      const lg=S.L[x.date],rm=lg&&lg.key===o.k?lg.removed||[]:[];
      const list=exOf(o.k,w).filter(e=>!rm.includes(e.n)).concat((x.extraEx||[]).map(n=>({n}))),sk=list.filter(e=>!c.ex.includes(e.n)).map(e=>e.n);
      o.skipped=sk;o.partial=sk.length*2>list.length;
      if(o.k==="legs")legsSkipped.push(...sk);else makeup.push(...sk.filter(n=>!makeup.includes(n)));
    });
  });
  // 2) pins on open days
  days.filter(x=>!x.locked&&!x.e.rest&&x.e.pin&&pool.has(x.e.pin)).forEach(x=>{pool.delete(x.e.pin);x.keys=[x.e.pin];x.pinned=true});
  // 3) search the best placement for what is left
  const free=days.filter(x=>!x.locked&&!x.e.rest&&!x.pinned).map(x=>x.d);
  const rem=[...pool];
  const fixed=days.map(x=>x.keys.slice());
  const hasLegs=(arr,d)=>d<0?prevLegs:arr[d].includes("legs");
  const hasBike=(arr,d)=>arr[d].some(k=>CAT[k]==="bike");
  const valid=arr=>{for(let d=0;d<7;d++){if(hasBike(arr,d)&&hasLegs(arr,d-1))return false}return true};
  const score=arr=>{let s=0;
    for(let d=0;d<7;d++){
      if(free.includes(d)||days[d].pinned)arr[d].forEach(k=>{s+=PRIO[k]-6*Math.abs(d-DEF[k]);if(k==="long")s+=d===5?35:d===6?28:0});
      if(d>0){
        if(hasBike(arr,d)&&hasBike(arr,d-1))s-=8;
        const a=arr[d-1],b=arr[d],P=x=>x.includes("push")||x.includes("upper"),Q=x=>x.includes("pull")||x.includes("upper");
        if((P(a)&&P(b))||(Q(a)&&Q(b)))s-=20;
        if(a.includes("legs")&&b.includes("legs"))s-=40;
        if(a.includes("int")&&b.includes("long"))s-=10;
      }
    }return s};
  let best=null,bestS=-1e9;
  const cur=fixed.map(a=>a.slice()),used=new Set();
  (function dfs(j){
    if(j===free.length){if(valid(cur)){const s=score(cur);if(s>bestS){bestS=s;best=cur.map(a=>a.slice())}}return}
    const d=free[j];
    for(const k of rem){if(used.has(k))continue;
      if(CAT[k]==="bike"&&hasLegs(cur,d-1))continue;
      if(k==="legs"&&d<6&&!free.includes(d+1)&&hasBike(cur,d+1))continue;
      used.add(k);cur[d]=[k];dfs(j+1);cur[d]=fixed[d].slice();used.delete(k)}
    dfs(j+1);
  })(0);
  if(!best)best=fixed;
  const placed=new Set();
  days.forEach(x=>{
    if(!x.locked){x.keys=best[x.d].slice();x.keys.forEach(k=>placed.add(k));x.status=x.e.rest?"rest":x.keys.length?(x.pinned?"pin":"planned"):"free"}
  });
  const dropped=rem.filter(k=>!placed.has(k));
  const moves=[];
  days.forEach(x=>{if(!x.locked)x.keys.forEach(k=>{if(x.d!==DEF[k])moves.push(sess(k,w).title+": "+DOW[DEF[k]]+" → "+DOW[x.d])})});
  if(easy){const t=days.find(x=>!x.locked&&x.keys[0]==="int"&&x.i-easy.from<=2);if(t){t.mod={easy:true,why:easy.why};notes.push(DOW[t.d]+": Intervalle werden locker gefahren ("+easy.why+")")}}
  if(makeup.length){const t=days.find(x=>!x.locked&&["upper","push","pull"].includes(x.keys[0]));if(t){const have=exOf(t.keys[0],w).map(e=>e.n);t.extraEx=makeup.filter(n=>!have.includes(n));if(t.extraEx.length)notes.push(t.extraEx.length+" ausgelassene Übung"+(t.extraEx.length>1?"en":"")+" am "+DOW[t.d]+" nachholen")}}
  if(legsSkipped.length)notes.push("Beine: "+legsSkipped.join(", ")+" ausgelassen, beim nächsten Beintag zuerst machen");
  let rest=null;if(suggestRest!==null){const t=days.find(x=>x.i===suggestRest&&!x.locked&&!x.e.rest&&x.keys.length);if(t)rest=t.date}
  return {w:w,days:days,dropped:dropped,moves:moves,notes:notes,suggestRest:rest,doneN:7-pool.size,lastLegs:days[6].keys.includes("legs")};
}

/* ================= Gamification ================= */
const LEVELS=[[0,"Rookie"],[500,"Feierabendrunde"],[1200,"Gruppetto"],[2100,"Windschatten"],[3200,"Domestique"],[4500,"Tempomacher"],[6000,"Ausreißer"],[7700,"Bergfloh"],[9600,"Etappenjäger"],[11700,"Gesamtsieger"],[14000,"Legende"]];
const CH=[
 {t:"Alle 4 Gym-Einheiten",p:w=>[w.gymN,4,""]},
 {t:"120 km auf dem Rad",p:w=>[w.km,120," km"]},
 {t:"Eine Ausfahrt ≥ 3 h",p:w=>[w.maxRide/60,3," h"]},
 {t:"6 Einheiten trotz Entlastung",p:w=>[w.doneN,6,""]},
 {t:"500 Höhenmeter",p:w=>[w.hm,500," Hm"]},
 {t:"7 von 7 Einheiten",p:w=>[w.doneN,7,""]},
 {t:"150 km auf dem Rad",p:w=>[w.km,150," km"]},
 {t:"FTP-Test absolviert",p:w=>[w.acts.some(a=>a.cat==="bike"&&/ftp|test/i.test(a.name))?1:0,1,""]},
 {t:"2 Einheiten vor 9 Uhr",p:w=>[w.acts.filter(a=>a.cat!=="other"&&a.hour<9).length,2,""]},
 {t:"Alle 3 Radeinheiten",p:w=>[w.bikeN,3,""]},
 {t:"Weihnachtsblock: 7 von 7 Einheiten",p:w=>[w.doneN,7,""]},
 {t:"Silvester oder Neujahr aufs Rad",p:w=>[w.acts.some(a=>a.cat==="bike"&&(a.date==="2026-12-31"||a.date==="2027-01-01"))?1:0,1,""]},
 {t:"4 × Gym und 3 × Rad",p:w=>[Math.min(w.gymN,4)+Math.min(w.bikeN,3),7,""]},
 {t:"180 km auf dem Rad",p:w=>[w.km,180," km"]},
 {t:"800 Höhenmeter",p:w=>[w.hm,800," Hm"]},
 {t:"FTP-Ziel geknackt",p:w=>[S.ftp||0,ftpGoal()||999," W"]}
];
const BADGES=[
 {k:"GO",t:"Startschuss",d:"Erste Einheit im Plan",f:c=>c.plan.some(a=>a.cat!=="other")||c.manualN>0},
 {k:"100",t:"Der Hunni",d:"Ausfahrt ≥ 100 km",f:c=>c.plan.some(a=>a.cat==="bike"&&a.km>=100)},
 {k:"4H",t:"Sitzfleisch",d:"Ausfahrt ≥ 4 h",f:c=>c.plan.some(a=>a.cat==="bike"&&a.min>=240)},
 {k:"1K",t:"1.000 km",d:"Seit Planstart",f:c=>c.tot.km>=1000},
 {k:"2K",t:"2.000 km",d:"Seit Planstart",f:c=>c.tot.km>=2000},
 {k:"HM",t:"Bergziege",d:"3.000 Höhenmeter",f:c=>c.tot.hm>=3000},
 {k:"FE",t:"Eisenwoche",d:"4 Gym-Einheiten in einer Woche",f:c=>c.weeks.some(w=>w.gymN>=4)},
 {k:"7/7",t:"Volle Etappe",d:"7 von 7 Einheiten",f:c=>c.weeks.some(w=>w.doneN>=7)},
 {k:"ZZ",t:"Ehrlicher Ruhetag",d:"Einen Ruhetag eingetragen",f:c=>c.restN>0},
 {k:"21",t:"Nachteule",d:"5 Einheiten nach 21 Uhr",f:c=>c.plan.filter(a=>a.cat!=="other"&&a.hour>=21).length>=5},
 {k:"6AM",t:"Frühaufsteher",d:"Einheit vor 7 Uhr",f:c=>c.plan.some(a=>a.cat!=="other"&&a.hour<7)},
 {k:"4×",t:"Serie",d:"4 Etappen in Folge ≥ 6/7",f:c=>c.wStreak>=4},
 {k:"W↑",t:"Neue Wattzahl",d:"FTP über Startwert",f:()=>!!(S.ftp&&S.ftpBase&&S.ftp>S.ftpBase)},
 {k:"90",t:"Winter Arc",d:"Tag 90 mit ≥ 60 Einheiten",f:c=>TODAY>="2027-01-02"&&c.arcN>=60},
 {k:"T4",t:"Testpilot",d:"Alle 4 FTP-Tests eingetragen",f:()=>[1,2,3,4].every(n=>S.T&&S.T.ftp&&S.T.ftp[n])},
 {k:"KG↑",t:"Stärker",d:"Im Krafttest gesteigert",f:()=>strengthGain()>0},
 {k:"FIN",t:"Ziellinie",d:"Alle 16 Etappen ≥ 6/7",f:c=>c.weeks.every(w=>w.doneN>=6)}
];

function compute(){
  const byDate={};S.acts.forEach(a=>{(byDate[a.date]=byDate[a.date]||[]).push(a)});
  const plan=S.acts.filter(a=>{const k=idx(a.date);return k>=0&&k<DAYS});
  const weeks=[];let prevLegs=false;
  for(let w=0;w<WEEKS;w++){
    const P=planWeek(w,prevLegs,byDate);prevLegs=P.lastLegs;
    const wa=plan.filter(a=>Math.floor(idx(a.date)/7)===w);
    const sum=(f,c)=>wa.filter(a=>!c||a.cat===c).reduce((t,a)=>t+f(a),0);
    const doneKeys=P.days.flatMap(x=>x.locked?x.done.map(o=>o.k):[]);
    const manualMin=P.days.flatMap(x=>x.done.filter(o=>o.manual)).reduce((t,o)=>t+sess(o.k,w).min,0);
    Object.assign(P,{acts:wa,km:sum(a=>a.km,"bike"),hm:sum(a=>a.hm,"bike"),bikeMin:sum(a=>a.min,"bike"),gymMin:sum(a=>a.min,"gym"),otherMin:sum(a=>a.min,"other"),
      total:sum(a=>a.min)+manualMin,manualMin:manualMin,gymN:doneKeys.filter(k=>CAT[k]==="gym").length,bikeN:doneKeys.filter(k=>CAT[k]==="bike").length,
      maxRide:Math.max(0,...wa.filter(a=>a.cat==="bike").map(a=>a.min)),planned:KEYS.reduce((t,k)=>t+sess(k,w).min,0),
      started:w*7<=TI,ended:w*7+6<TI});
    const pr=CH[w].p(P);P.ch={cur:pr[0],target:pr[1],unit:pr[2],won:P.started&&S.live&&pr[0]>=pr[1]};
    weeks.push(P);
  }
  let wStreak=0;for(const w of weeks){if(!w.started)break;if(w.doneN>=6)wStreak++;else if(w.ended)wStreak=0}
  const allDays=weeks.flatMap(w=>w.days);
  let dStreak=0;for(let i=Math.min(TI,DAYS-1);i>=0;i--){const x=allDays[i];if(!x)break;if(x.i===TI&&!x.locked&&!x.e.rest)continue;if(x.status==="done"||x.status==="rest"||x.status==="extra")dStreak++;else break}
  const tot={km:0,hm:0,min:0,gym:0};plan.forEach(a=>{tot.min+=a.min;if(a.cat==="bike"){tot.km+=a.km;tot.hm+=a.hm}});
  weeks.forEach(w=>{tot.gym+=w.gymN;tot.min+=w.manualMin});
  const doneAll=weeks.reduce((t,w)=>t+w.doneN,0);
  const lost=weeks.filter(w=>w.started).reduce((t,w)=>t+(w.ended?7-w.doneN:w.dropped.length),0);
  const restN=allDays.filter(x=>x.e.rest&&x.i<=TI).length,manualN=allDays.filter(x=>x.e.manual).length;
  const arcN=S.acts.filter(a=>a.cat!=="other"&&a.date>=ARC0&&a.date<="2027-01-02").length+manualN;
  const ctx={plan:plan,weeks:weeks,tot:tot,wStreak:wStreak,arcN:arcN,restN:restN,manualN:manualN};
  const badges=BADGES.map(b=>Object.assign({},b,{got:(S.live||S.dbOK)&&b.f(ctx)}));
  let xp=0;plan.forEach(a=>{xp+=a.cat==="bike"?a.min+a.hm/10:a.cat==="gym"?Math.min(a.min,90):a.min*.5});
  xp+=doneAll*20+weeks.reduce((t,w)=>t+w.manualMin*.5,0)+weeks.filter(w=>w.ch.won).length*150+badges.filter(b=>b.got).length*100;
  return {weeks:weeks,allDays:allDays,tot:tot,wStreak:wStreak,dStreak:dStreak,doneAll:doneAll,lost:lost,arcN:arcN,badges:badges,xp:Math.round(xp)};
}

/* ================= Local storage helper ================= */
function localDB(){
  const load=k=>{try{return JSON.parse(localStorage.getItem(k)||"{}")||{}}catch(_){return {}}};
  const save=(k,o)=>{try{localStorage.setItem(k,JSON.stringify(o))}catch(_){}};
  return {load:load,doc(p){const parts=p.split("/"),key="wa."+parts[0],id=parts[1];
    return {async set(v){const o=load(key);o[id]=v;save(key,o)},async delete(){const o=load(key);delete o[id];save(key,o)}}}};
}
