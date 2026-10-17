/* Winter Arc — 3D stage. One WebGL canvas at the top of the page; each view has its own object:
   heute = activity rings, woche = day columns, rad = the bike (built from the photo), kraft = dumbbell,
   erfolge = level medal. Switching views morphs the old object out and the new one in.
   Exposes window.Stage = { show(view), update(data), nudge(dx) } or stays undefined without WebGL. */
(function () {
  "use strict";
  if (!window.THREE) return;
  const canvas = document.getElementById("stage");
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" }); }
  catch (_) { canvas.remove(); return; }
  document.documentElement.classList.add("has3d");
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  /* soft studio environment for reflections (chrome, gold, clear coat) */
  (function env() {
    const pm = new THREE.PMREMGenerator(renderer);
    const es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0b0c12, side: THREE.BackSide })));
    const panel = (w, h, c, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
    panel(6, 2, 0xffffff, 0, 6, 2);
    panel(3, 5, 0xbfc8ff, -6, 1, 3);
    panel(3, 5, 0xffd2b8, 6, 1, -2);
    panel(8, 1, 0x8a5cff, 0, -3, -6);
    scene.environment = pm.fromScene(es, 0.04).texture;
  })();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x1b1530, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(2, 3, 3); scene.add(key);
  const back = new THREE.DirectionalLight(0xffffff, 0.7); back.position.set(-2, 1.5, -3); scene.add(back);
  const rimA = new THREE.PointLight(0xff6a2b, 2.2, 7); rimA.position.set(-2.2, 1, -1.2); scene.add(rimA);
  const rimB = new THREE.PointLight(0x4c7dff, 2.2, 7); rimB.position.set(2.2, 1.2, 1.2); scene.add(rimB);

  const C = { rad: 0xff6a2b, rad2: 0xffb23f, kraft: 0x4c7dff, kraft2: 0x7fd8ff, done: 0x2ee59d, violet: 0x8a5cff, gold: 0xf2c25b };
  const black = new THREE.MeshStandardMaterial({ color: 0x07070a, roughness: 0.6, metalness: 0.15 });

  /* floor halo shared by all objects */
  const halo = new THREE.Group(); scene.add(halo);
  const ringMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false });
  const haloA = new THREE.Mesh(new THREE.RingGeometry(0.95, 0.962, 128), ringMat(C.violet, 0.5));
  const haloB = new THREE.Mesh(new THREE.RingGeometry(1.08, 1.084, 128), ringMat(C.kraft2, 0.28));
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  [haloA, haloB, shadow].forEach((m) => { m.rotation.x = -Math.PI / 2; halo.add(m); });
  shadow.scale.set(1, 0.32, 1); halo.position.y = -0.62;

  const objects = {};
  const holder = (name, build) => { const g = new THREE.Group(); g.visible = false; g.scale.setScalar(0.001); scene.add(g); objects[name] = { g, ...build(g) }; };

  /* ---------- heute: activity rings ---------- */
  holder("heute", (g) => {
    const defs = [{ r: 0.62, c: C.rad, c2: C.rad2 }, { r: 0.47, c: C.kraft, c2: C.kraft2 }, { r: 0.32, c: C.done, c2: 0xb8f56a }];
    const T = 0.075, prog = [];
    defs.forEach((d) => {
      const track = new THREE.Mesh(new THREE.TorusGeometry(d.r, T, 20, 140), new THREE.MeshStandardMaterial({ color: d.c, transparent: true, opacity: 0.16, roughness: 0.4, depthWrite: false }));
      g.add(track);
      const mat = new THREE.MeshPhysicalMaterial({ color: d.c, emissive: d.c, emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.2, clearcoat: 1 });
      const p = new THREE.Mesh(new THREE.TorusGeometry(d.r, T, 20, 140, 0.001), mat);
      const capA = new THREE.Mesh(new THREE.SphereGeometry(T, 20, 14), mat), capB = capA.clone();
      const arm = new THREE.Group(); arm.add(p, capA, capB); arm.rotation.z = Math.PI / 2; arm.scale.x = -1; g.add(arm);
      prog.push({ p, capA, capB, d, v: 0 });
    });
    g.rotation.x = -0.35;
    return {
      set(vals) {
        vals.forEach((v, i) => {
          const o = prog[i]; v = Math.max(0, Math.min(1, v || 0)); if (Math.abs(v - o.v) < 1e-4 && o.p.geometry.parameters.arc > 0.001) return; o.v = v;
          const arc = Math.max(0.001, v * Math.PI * 2 * 0.999);
          o.p.geometry.dispose(); o.p.geometry = new THREE.TorusGeometry(o.d.r, T, 20, 140, arc);
          o.capA.position.set(o.d.r, 0, 0); o.capB.position.set(Math.cos(arc) * o.d.r, Math.sin(arc) * o.d.r, 0);
          o.capA.visible = o.capB.visible = v > 0.01;
        });
      },
      idle(t, g2) { g2.rotation.y = Math.sin(t * 0.5) * 0.45; g2.position.y = 0.05 + Math.sin(t * 0.9) * 0.025; },
    };
  });

  /* ---------- woche: 7 day columns ---------- */
  holder("woche", (g) => {
    const cols = [], W = 0.17, GAP = 0.08, base = new THREE.Mesh(new THREE.BoxGeometry(7 * W + 6 * GAP + 0.24, 0.03, W + 0.24), new THREE.MeshPhysicalMaterial({ color: 0x15171f, roughness: 0.35, metalness: 0.4, clearcoat: 1 }));
    base.position.y = -0.55; g.add(base);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(W, 1, W), new THREE.MeshPhysicalMaterial({ color: 0x444a55, roughness: 0.25, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9 }));
      m.position.x = (i - 3) * (W + GAP); g.add(m);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 1, W)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
      m.add(edge); cols.push({ m, edge, h: 0.1, target: 0.1 });
    }
    g.rotation.x = 0.12;
    return {
      set(days) {
        days.forEach((d, i) => {
          const c = cols[i]; if (!c) return;
          c.target = d.rest ? 0.06 : d.cat === "bike" ? 0.85 : 0.7;
          const col = d.cat === "bike" ? C.rad : d.cat === "gym" ? C.kraft : 0x50545f;
          c.m.material.color.setHex(col);
          c.m.material.emissive.setHex(d.done ? col : 0x000000); c.m.material.emissiveIntensity = d.done ? 0.45 : 0;
          c.m.material.opacity = d.done ? 1 : d.rest ? 0.35 : 0.55;
          c.edge.material.opacity = d.today ? 0.9 : 0;
        });
      },
      idle(t, g2, dt) {
        cols.forEach((c) => { c.h += (c.target - c.h) * Math.min(1, dt * 4); c.m.scale.y = c.h; c.m.position.y = -0.535 + c.h / 2; });
        g2.rotation.y = -0.5 + Math.sin(t * 0.35) * 0.35;
      },
    };
  });

  /* ---------- kraft: dumbbell ---------- */
  holder("kraft", (g) => {
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd9dde6, metalness: 1, roughness: 0.18 });
    const knurl = new THREE.MeshStandardMaterial({ color: 0x9aa1ad, metalness: 1, roughness: 0.45 });
    const rubber = new THREE.MeshPhysicalMaterial({ color: 0x0d0f15, roughness: 0.55, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.4 });
    const accent = new THREE.MeshPhysicalMaterial({ color: C.kraft, emissive: C.kraft, emissiveIntensity: 0.55, roughness: 0.3, clearcoat: 1 });
    const db = new THREE.Group(); g.add(db);
    const cyl = (r, l, m, x) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 48), m); c.rotation.z = Math.PI / 2; c.position.x = x; db.add(c); return c; };
    cyl(0.045, 0.46, knurl, 0);
    [-1, 1].forEach((s) => {
      cyl(0.05, 0.06, chrome, s * 0.26);
      cyl(0.2, 0.07, rubber, s * 0.33);
      cyl(0.205, 0.012, accent, s * 0.295);
      cyl(0.17, 0.065, rubber, s * 0.4);
      cyl(0.175, 0.01, accent, s * 0.4325);
      cyl(0.13, 0.055, rubber, s * 0.46);
      cyl(0.06, 0.04, chrome, s * 0.507);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), chrome);
      cap.rotation.z = -s * Math.PI / 2; cap.position.x = s * 0.527; cap.scale.y = 0.35; db.add(cap);
    });
    db.scale.setScalar(1.35);
    return { idle(t, g2) { g2.rotation.y = t * 0.55; g2.rotation.z = Math.sin(t * 0.6) * 0.18 + 0.12; g2.position.y = 0.02 + Math.sin(t * 1.1) * 0.03; } };
  });

  /* ---------- rad: bike built from the photo ---------- */
  holder("rad", (g) => {
    const IW = 1120, IH = 640, K = 1.7 / IW, X = (px) => (px - IW / 2) * K, Y = (py) => (IH / 2 - py) * K;
    const bike = new THREE.Group(); g.add(bike); bike.visible = false;
    let loaded = 0;
    const load = (u) => { const t = new THREE.TextureLoader().load(u, () => { if (++loaded === 2) bike.visible = true; }); t.encoding = THREE.sRGBEncoding; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; };
    const tex = load("/bike.webp?v=3"), core = load("/bike-core.webp?v=3");
    const geo = new THREE.PlaneGeometry(IW * K, IH * K);
    const LAYERS = 11, DEPTH = 0.05;
    for (let i = 0; i < LAYERS; i++) {
      const f = i / (LAYERS - 1), outer = i === 0 || i === LAYERS - 1, sh = outer ? 1 : 0.42 + 0.12 * Math.sin(f * Math.PI);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: outer ? tex : core, alphaTest: 0.5, side: THREE.DoubleSide, roughness: outer ? 0.38 : 0.7, metalness: outer ? 0.2 : 0.1, color: new THREE.Color(sh, sh, sh) }));
      m.position.z = (f - 0.5) * DEPTH; bike.add(m);
    }
    const V = (px, py, z) => new THREE.Vector3(X(px), Y(py), z);
    const tube = (pts, r) => bike.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r, 10, false), black));
    tube([V(400, 104, 0), V(386, 98, 0), V(370, 95, 0)], 0.017);
    tube([V(370, 95, -0.19), V(370, 95, 0), V(370, 95, 0.19)], 0.014);
    [-1, 1].forEach((sd) => {
      const z = sd * 0.19, zh = sd * 0.2;
      tube([V(370, 95, z), V(330, 92, sd * 0.195), V(285, 87, zh), V(245, 80, zh)], 0.014);
      tube([V(245, 80, zh), V(226, 84, zh), V(222, 104, zh), V(236, 138, zh), V(262, 170, zh), V(300, 186, zh), V(342, 190, zh)], 0.012);
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.03), black); hood.position.set(X(238), Y(78), zh); hood.rotation.z = 0.15; bike.add(hood);
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.12, 0.014), black); lever.position.set(X(214), Y(140), zh); lever.rotation.z = 0.12; bike.add(lever);
    });
    const saddle = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), black); saddle.scale.set(0.14, 0.02, 0.06); saddle.position.set(X(758), Y(34), 0); bike.add(saddle);
    bike.position.y = -0.62 - Y(IH) + 0.005;
    bike.scale.setScalar(0.95);
    return { idle(t, g2) { g2.rotation.y += 0; } , spin: true };
  });

  /* ---------- tests: stopwatch with FTP on the dial ---------- */
  holder("tests", (g) => {
    const metal = new THREE.MeshStandardMaterial({ color: 0x2a2d36, metalness: 0.9, roughness: 0.28 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd9dde6, metalness: 1, roughness: 0.18 });
    const glow = new THREE.MeshPhysicalMaterial({ color: C.violet, emissive: C.violet, emissiveIntensity: 0.6, roughness: 0.3, clearcoat: 1 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 96), metal); body.rotation.x = Math.PI / 2; g.add(body);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 20, 120), chrome); g.add(bezel);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 12, 120), glow); ring.position.z = 0.082; g.add(ring);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 32), chrome); crown.position.y = 0.64; g.add(crown);
    const crownTop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 32), chrome); crownTop.position.y = 0.71; g.add(crownTop);
    [-1, 1].forEach((s2) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 24), chrome); b.position.set(s2 * 0.42, 0.42, 0); b.rotation.z = -s2 * 0.75; g.add(b); });
    const cv = document.createElement("canvas"); cv.width = cv.height = 512;
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.49, 96), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.2 })); face.position.z = 0.081; g.add(face);
    const back = face.clone(); back.rotation.y = Math.PI; back.position.z = -0.081; g.add(back);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.4, 0.01), new THREE.MeshPhysicalMaterial({ color: C.rad, emissive: C.rad, emissiveIntensity: 0.6 }));
    hand.geometry.translate(0, 0.17, 0); hand.position.z = 0.092; g.add(hand);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 24), chrome); hub.rotation.x = Math.PI / 2; hub.position.z = 0.097; g.add(hub);
    let drawn = "";
    function draw(ftp, sub) {
      const k = ftp + "|" + sub; if (k === drawn) return; drawn = k;
      const x = cv.getContext("2d");
      const gr = x.createRadialGradient(256, 220, 30, 256, 256, 260); gr.addColorStop(0, "#1d1830"); gr.addColorStop(1, "#08070d");
      x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, L = i % 5 ? 14 : 30; x.strokeStyle = i % 5 ? "rgba(255,255,255,.35)" : "#ffffff"; x.lineWidth = i % 5 ? 3 : 6; x.beginPath(); x.moveTo(256 + Math.sin(a) * 236, 256 - Math.cos(a) * 236); x.lineTo(256 + Math.sin(a) * (236 - L), 256 - Math.cos(a) * (236 - L)); x.stroke(); }
      x.textAlign = "center"; x.fillStyle = "#b9a2ff"; x.font = "600 40px 'Geist', sans-serif"; x.fillText("FTP", 256, 190);
      x.fillStyle = "#ffffff"; x.font = "italic 900 150px 'Archivo', 'Arial Narrow', sans-serif"; x.fillText(ftp ? String(ftp) : "–", 256, 320);
      x.fillStyle = "#ff8a4a"; x.font = "600 34px 'Geist', sans-serif"; x.fillText(sub, 256, 380);
      tex.needsUpdate = true;
    }
    draw(0, "WATT");
    return { set(ftp, sub) { draw(ftp, sub || "WATT"); }, idle(t, g2) { g2.rotation.y = Math.sin(t * 0.5) * 0.7; g2.position.y = Math.sin(t * 1.0) * 0.03; hand.rotation.z = -t * 1.2; } };
  });

  /* ---------- erfolge: level medal ---------- */
  holder("erfolge", (g) => {
    const gold = new THREE.MeshStandardMaterial({ color: C.gold, metalness: 1, roughness: 0.22 });
    const cv = document.createElement("canvas"); cv.width = cv.height = 512;
    const faceTex = new THREE.CanvasTexture(cv); faceTex.encoding = THREE.sRGBEncoding;
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, metalness: 0.6, roughness: 0.35 });
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.09, 96), gold); coin.rotation.x = Math.PI / 2; g.add(coin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.035, 20, 120), gold); g.add(rim);
    [1, -1].forEach((s) => { const f = new THREE.Mesh(new THREE.CircleGeometry(0.44, 96), faceMat); f.position.z = s * 0.047; if (s < 0) f.rotation.y = Math.PI; g.add(f); });
    const ribbon = new THREE.MeshPhysicalMaterial({ color: C.violet, roughness: 0.5, clearcoat: 0.5 });
    [-1, 1].forEach((s) => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.02), ribbon); r.position.set(s * 0.12, 0.72, -0.02); r.rotation.z = s * 0.28; g.add(r); });
    let drawn = "";
    function draw(level, name) {
      const k = level + "|" + name; if (k === drawn) return; drawn = k;
      const x = cv.getContext("2d");
      const gr = x.createRadialGradient(256, 200, 40, 256, 256, 260); gr.addColorStop(0, "#2a2140"); gr.addColorStop(1, "#0c0a14");
      x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
      x.strokeStyle = "#f2c25b"; x.lineWidth = 10; x.beginPath(); x.arc(256, 256, 236, 0, Math.PI * 2); x.stroke();
      x.fillStyle = "#f2c25b"; x.textAlign = "center";
      x.font = "600 44px 'Geist', sans-serif"; x.fillText("LEVEL", 256, 170);
      x.font = "italic 900 230px 'Archivo', 'Arial Narrow', sans-serif"; x.fillText(String(level), 256, 360);
      x.font = "600 34px 'Geist', sans-serif"; x.fillStyle = "#e8e2ff"; x.fillText(String(name).toUpperCase(), 256, 430);
      faceTex.needsUpdate = true;
    }
    draw(1, "Rookie");
    return { set(level, name) { draw(level, name); }, idle(t, g2) { g2.rotation.y = Math.sin(t * 0.6) * 0.9; g2.position.y = 0.02 + Math.sin(t * 1.0) * 0.03; } };
  });

  /* ---------- layout, motion, transitions ---------- */
  let W = 0, H = 0, wide = false, current = null, prev = null, tIn = 1, spin = 0, spinV = 0.35, scrollF = 1;
  const easeOut = (x) => 1 - Math.pow(1 - x, 3), easeBack = (x) => { const c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight; wide = window.innerWidth >= 900;
    renderer.setSize(W, H, false); camera.aspect = W / Math.max(1, H); camera.updateProjectionMatrix();
    if (wide) { camera.position.set(0, 0.35, 4.1); camera.lookAt(0, 0, 0); }
    else { camera.position.set(0, 0.1, 5.0); camera.lookAt(0, -0.42, 0); }
  }
  window.addEventListener("resize", resize); resize();
  const FLAT = new Set(["woche", "kraft", "tests", "erfolge"]); // flatter stage on phones (see app.css)
  const baseX = () => (wide ? 0.95 : 0);
  const SCALE = { heute: 1, woche: 1.05, rad: 1, kraft: 1, tests: 0.9, erfolge: 0.8 };

  function show(name) {
    requestAnimationFrame(resize); // the stage is flatter on some tabs: re-measure after the view's CSS applies
    if (!objects[name] || name === current) return;
    prev = current; current = name; tIn = 0;
    const o = objects[name].g; o.visible = true;
    if (name === "rad") spin = -0.6;
  }
  let lastY = window.scrollY, boost = 0;
  window.addEventListener("scroll", () => { const y = window.scrollY; boost = Math.min(boost + Math.abs(y - lastY) * 0.002, 2.5); lastY = y; }, { passive: true });
  let dragV = 0, userRot = 0;
  function nudge(dx) { dragV += dx * 0.006; }

  let visible = true;
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; });
  let last = performance.now(), t0 = last;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.body.classList.contains("focus-open")) { last = now; return; } // training mode covers the stage: save battery
    const dt = Math.min((now - last) / 1000, 0.05); last = now; const t = (now - t0) / 1000;
    const sY = window.scrollY, fade = Math.max(0, 1 - sY / (H * 0.9));
    canvas.style.opacity = (0.15 + 0.85 * fade).toFixed(3);
    if (!visible || fade <= 0.001 && tIn >= 1) return;
    tIn = Math.min(1, tIn + dt / 0.75);
    boost *= 0.92; dragV *= 0.94;
    spin += dt * spinV + boost * dt + dragV;
    userRot = (userRot + dragV) * (1 - Math.min(1, dt * 0.8));
    for (const k in objects) {
      const o = objects[k], g = o.g;
      if (!g.visible) continue;
      let s;
      if (k === current) s = easeBack(tIn); else if (k === prev) s = 1 - easeOut(Math.min(1, tIn * 1.6)); else { g.visible = false; continue; }
      if (k === prev && s <= 0.002) { g.visible = false; continue; }
      g.scale.setScalar(Math.max(0.001, s) * (SCALE[k] || 1) * (wide ? 1 : FLAT.has(k) ? 0.8 : 0.92));
      g.position.x = baseX();
      if (k === "rad") { g.rotation.y = spin; g.position.y = Math.sin(t * 0.9) * 0.02; }
      else { o.idle && o.idle(t, g, dt); g.rotation.y += userRot; }
      if (k === prev) g.rotation.y += dt * 6;
      if (k === current && k !== "rad") g.rotation.y += (1 - easeOut(tIn)) * 2.4;
    }
    halo.position.x = baseX(); haloA.rotation.z += dt * 0.2; haloB.rotation.z -= dt * 0.12;
    halo.visible = current !== "heute";
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  window.Stage = {
    show,
    nudge,
    update(d) {
      if (d.rings) objects.heute.set(d.rings);
      if (d.week) objects.woche.set(d.week);
      if (d.level) objects.erfolge.set(d.level.n, d.level.name);
      if (d.ftp !== undefined) objects.tests.set(d.ftp, d.ftpSub);
    },
  };
})();
