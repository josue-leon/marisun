(() => {
  "use strict";

  // ---------- Estado ----------
  const STORAGE_KEY = "ruleta-visionfund";
  const PALETTE = ["#7fb3f5", "#f59e9e", "#fcd27b", "#a8e6a1", "#c3a6f5", "#ffb37a", "#8fd8e8", "#f5a6d6"];
  const TAU = Math.PI * 2;

  const state = {
    title: "Gran Rifa Navideña · Priostes del Niñito Jesús",
    base: range(1, 400),     // lista completa (para reiniciar)
    tickets: range(1, 400),  // boletos que siguen en la ruleta
    history: [],
    autoRemove: true,
    duration: 10,
    muted: false,
  };
  load();

  let angle = 0;          // rotación actual de la ruleta (rad)
  let spinning = false;
  let lastWinner = null;  // índice del ganador mostrado en el modal

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const wheel = $("wheel"), ctx = wheel.getContext("2d");
  const lensCanvas = $("lensCanvas"), lctx = lensCanvas.getContext("2d");
  const lens = $("lens"), wrap = $("wheelWrap");
  const current = $("current");
  const offscreen = document.createElement("canvas");

  // ---------- Utilidades ----------
  function range(a, b) {
    const out = [];
    for (let i = a; i <= b; i++) out.push(String(i));
    return out;
  }

  function parseTicket(text) {
    const m = text.match(/^\s*([^\s\-–:|]+)\s*[-–:|]\s*(.+)$/);
    return m ? { num: m[1], name: m[2].trim() } : { num: text.trim(), name: "" };
  }

  function randomInt(max) {
    // Aleatorio criptográfico y sin sesgo de módulo
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    do crypto.getRandomValues(buf); while (buf[0] >= limit);
    return buf[0] % max;
  }

  const mod = (a, n) => ((a % n) + n) % n;
  const segAngle = () => TAU / state.tickets.length;
  const indexAt = (a) => Math.floor(mod(-a, TAU) / segAngle()) % state.tickets.length;
  const colorOf = (i) => PALETTE[i % PALETTE.length];

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* sin almacenamiento */ }
  }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.tickets) && saved.tickets.length) Object.assign(state, saved);
    } catch (e) { /* ignorar */ }
  }

  // ---------- Dibujo de la ruleta ----------
  function renderWheel() {
    const dpr = window.devicePixelRatio || 1;
    const size = Math.round(wheel.clientWidth * dpr);
    wheel.width = wheel.height = offscreen.width = offscreen.height = size;

    const o = offscreen.getContext("2d");
    const r = size / 2, inner = r * 0.94; // borde blanco exterior
    const n = state.tickets.length, s = TAU / n;
    o.clearRect(0, 0, size, size);
    o.fillStyle = "#fff";
    o.beginPath(); o.arc(r, r, r, 0, TAU); o.fill();

    for (let i = 0; i < n; i++) {
      o.fillStyle = colorOf(i);
      o.beginPath();
      o.moveTo(r, r);
      o.arc(r, r, inner, i * s, (i + 1) * s + (n > 1 ? 0.002 : 0));
      o.closePath();
      o.fill();
    }

    // Con pocos boletos sí caben los números sobre la ruleta
    if (n <= 80) {
      o.strokeStyle = "rgba(255,255,255,.8)";
      o.lineWidth = Math.max(1, size / 600);
      for (let i = 0; i < n && n > 1; i++) {
        o.beginPath(); o.moveTo(r, r);
        o.lineTo(r + inner * Math.cos(i * s), r + inner * Math.sin(i * s)); o.stroke();
      }
      const fs = Math.min(inner * s * 0.55, size / 22);
      o.fillStyle = "#1d2027";
      o.font = `700 ${fs}px Inter, sans-serif`;
      o.textAlign = "right"; o.textBaseline = "middle";
      for (let i = 0; i < n; i++) {
        o.save(); o.translate(r, r); o.rotate((i + 0.5) * s);
        o.fillText(clip(parseTicket(state.tickets[i]).num, 10), inner - fs * 0.6, 0);
        o.restore();
      }
    }
    drawWheel();
  }

  function drawWheel() {
    const size = wheel.width, r = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(r, r);
    ctx.rotate(angle);
    ctx.drawImage(offscreen, -r, -r);
    ctx.restore();
  }

  const clip = (t, max) => (t.length > max ? t.slice(0, max - 1) + "…" : t);

  // ---------- Lupa: zoom sobre la punta del selector ----------
  function drawLens() {
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(lensCanvas.clientWidth * dpr);
    const H = Math.round(lensCanvas.clientHeight * dpr);
    if (!W || !H) return;
    if (lensCanvas.width !== W || lensCanvas.height !== H) { lensCanvas.width = W; lensCanvas.height = H; }

    const n = state.tickets.length, s = TAU / n;
    const segPx = H * 0.17;                              // alto de cada boleto en la lupa
    const R = Math.max(W * 1.3, segPx / s);              // radio "ampliado" de la ruleta
    const tipX = W * 0.8;                                // borde de la ruleta en la lupa
    const cx = tipX - R, cy = H / 2;
    const rim = H * 0.05;
    const inner = Math.max(0, R - W * 1.1);
    const cur = indexAt(angle);
    const k = Math.min(Math.ceil(Math.asin(Math.min(1, (H / 2) / (R - rim))) / s) + 2, Math.ceil(n / 2));

    lctx.clearRect(0, 0, W, H);
    lctx.fillStyle = "#fff";
    lctx.fillRect(0, 0, W, H);

    lctx.save();
    lctx.translate(cx, cy);
    lctx.rotate(angle);
    const fs = Math.min(segPx * 0.55, H * 0.12);
    lctx.font = `800 ${fs}px Inter, sans-serif`;
    lctx.textAlign = "right"; lctx.textBaseline = "middle";

    for (let d = -k; d <= k; d++) {
      const i = mod(cur + d, n);
      const a0 = i * s, a1 = (i + 1) * s;
      lctx.beginPath();
      lctx.arc(0, 0, R - rim, a0, a1);
      lctx.arc(0, 0, inner, a1, a0, true);
      lctx.closePath();
      lctx.fillStyle = colorOf(i);
      lctx.fill();
      lctx.strokeStyle = "rgba(255,255,255,.9)";
      lctx.lineWidth = Math.max(2, H / 120);
      lctx.stroke();

      lctx.save();
      lctx.rotate((i + 0.5) * s);
      lctx.fillStyle = i === cur ? "#000" : "rgba(29,32,39,.75)";
      const t = parseTicket(state.tickets[i]);
      lctx.fillText(clip(t.name ? `${t.num} · ${t.name}` : t.num, 22), R - rim - fs * 0.5, 0);
      lctx.restore();
    }
    lctx.restore();

    // Borde exterior blanco de la ruleta
    lctx.beginPath();
    lctx.arc(cx, cy, R, -0.5, 0.5);
    lctx.arc(cx, cy, R - rim, 0.5, -0.5, true);
    lctx.fillStyle = "#fff";
    lctx.fill();

    // Viñeta para efecto lupa
    const g = lctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(255,255,255,.95)");
    g.addColorStop(0.22, "rgba(255,255,255,0)");
    g.addColorStop(0.78, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(255,255,255,.95)");
    lctx.fillStyle = g;
    lctx.fillRect(0, 0, W, H);

    // Selector ampliado
    const pw = W - tipX + H * 0.12, ph = H * 0.2;
    const px = tipX - H * 0.1;
    lctx.save();
    lctx.shadowColor = "rgba(0,0,0,.25)"; lctx.shadowOffsetX = 4; lctx.shadowOffsetY = 4;
    lctx.fillStyle = "#111";
    lctx.beginPath();
    lctx.moveTo(px, cy);
    lctx.lineTo(px + pw * 0.55, cy - ph / 2);
    lctx.lineTo(W + 10, cy - ph / 2);
    lctx.lineTo(W + 10, cy + ph / 2);
    lctx.lineTo(px + pw * 0.55, cy + ph / 2);
    lctx.closePath();
    lctx.fill();
    lctx.restore();
    lctx.fillStyle = "#fff";
    lctx.beginPath(); lctx.arc(px + pw * 0.72, cy, ph * 0.17, 0, TAU); lctx.fill();
  }

  // ---------- Sonido ----------
  let audio = null, lastTick = 0;
  function ac() {
    if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* sin audio */ } }
    if (audio && audio.state === "suspended") audio.resume();
    return audio;
  }
  function tone(freq, start, dur, type = "square", vol = 0.06) {
    const a = ac(); if (!a || state.muted) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, a.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + start); o.stop(a.currentTime + start + dur + 0.02);
  }
  function tick() {
    const now = performance.now();
    if (now - lastTick < 40) return;
    lastTick = now;
    tone(1400, 0, 0.03, "square", 0.04);
  }
  function fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.35, "triangle", 0.12));
    tone(1319, 0.5, 0.7, "triangle", 0.1);
  }

  // ---------- Giro ----------
  const ease = (t) => 1 - Math.pow(1 - t, 3.6);

  function spin() {
    const n = state.tickets.length;
    if (spinning || n < 1) return;
    closeAll();
    ac();
    spinning = true;
    document.body.classList.add("spinning");

    const winner = randomInt(n);
    const s = TAU / n;
    const offset = 0.2 + Math.random() * 0.6;              // no caer justo en la línea
    const turns = 8 + randomInt(4);
    const start = angle;
    let target = -(winner + offset) * s;
    target += Math.ceil((start + turns * TAU - target) / TAU) * TAU;
    const total = target - start;
    const dur = state.duration * 1000;
    const t0 = performance.now();
    let lastIdx = indexAt(angle), zoomed = false;

    function frame(now) {
      const t = Math.min(1, (now - t0) / dur);
      angle = start + total * ease(t);
      drawWheel();

      const idx = indexAt(angle);
      if (idx !== lastIdx) { lastIdx = idx; tick(); current.textContent = state.tickets[idx]; }

      // Cuando la ruleta empieza a frenar: zoom hacia la punta del selector
      if (!zoomed && t > 0.45) {
        zoomed = true;
        wrap.classList.add("zoom");
        lens.classList.add("show");
      }
      if (zoomed) drawLens();

      if (t < 1) requestAnimationFrame(frame);
      else finish(winner);
    }
    requestAnimationFrame(frame);
  }

  function finish(winner) {
    angle = mod(angle, TAU);
    const idx = indexAt(angle);       // coincide con winner
    current.textContent = state.tickets[idx];
    drawLens();
    setTimeout(() => {
      spinning = false;
      document.body.classList.remove("spinning");
      showWinner(idx);
    }, 700);
  }

  function showWinner(idx) {
    lastWinner = idx;
    const raw = state.tickets[idx];
    const t = parseTicket(raw);
    $("winNumber").textContent = t.num;
    $("winName").textContent = t.name;
    state.history.unshift({ ticket: raw, at: new Date().toISOString() });
    save();
    renderHistory();
    $("btnRemove").style.display = state.autoRemove ? "none" : "";
    $("btnKeep").textContent = state.autoRemove ? "Continuar" : "Cerrar";
    $("winner").classList.add("open");
    fanfare();
    confetti();
  }

  function closeWinner() {
    if (!$("winner").classList.contains("open")) return;
    $("winner").classList.remove("open");
    wrap.classList.remove("zoom");
    lens.classList.remove("show");
    if (state.autoRemove) removeTicket(lastWinner);
    lastWinner = null;
  }

  function removeTicket(idx) {
    if (idx == null || state.tickets.length <= 1) return;
    state.tickets.splice(idx, 1);
    save();
    renderWheel();
    updateCount();
  }

  // ---------- Confeti ----------
  function confetti() {
    const c = $("confetti"), g = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    const colors = ["#ff5a00", "#ffb37a", "#1d2027", "#7fb3f5", "#fcd27b", "#a8e6a1", "#f59e9e"];
    const parts = Array.from({ length: 220 }, () => ({
      x: c.width / 2 + (Math.random() - 0.5) * c.width * 0.3,
      y: c.height * 0.45,
      vx: (Math.random() - 0.5) * 26 * dpr,
      vy: (-Math.random() * 24 - 8) * dpr,
      w: (6 + Math.random() * 8) * dpr, h: (8 + Math.random() * 10) * dpr,
      r: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.4,
      color: colors[randomInt(colors.length)],
    }));
    const t0 = performance.now();
    (function step(now) {
      const t = now - t0;
      g.clearRect(0, 0, c.width, c.height);
      g.globalAlpha = Math.max(0, 1 - Math.max(0, t - 2800) / 1000);
      for (const p of parts) {
        p.vy += 0.6 * dpr; p.vx *= 0.99; p.vy *= 0.99;
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r);
        g.fillStyle = p.color; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        g.restore();
      }
      if (t < 3800) requestAnimationFrame(step); else g.clearRect(0, 0, c.width, c.height);
    })(t0);
  }

  // ---------- UI ----------
  function updateCount() {
    $("count").textContent = `${state.tickets.length} boletos en la ruleta`;
  }

  function renderHistory() {
    const list = $("historyList");
    list.innerHTML = "";
    state.history.slice().reverse().forEach((h) => {
      const li = document.createElement("li");
      const t = parseTicket(h.ticket);
      const b = document.createElement("b"); b.textContent = t.num;
      li.append(b, t.name ? ` · ${t.name}` : "");
      const sm = document.createElement("small");
      sm.textContent = new Date(h.at).toLocaleString("es-EC");
      li.append(sm);
      list.append(li);
    });
  }

  function openDrawer(id) {
    closeAll();
    if (id === "editor") {
      $("ticketsInput").value = state.tickets.join("\n");
      $("titleInput").value = state.title;
    }
    $(id).classList.add("open");
  }
  function closeAll() {
    document.querySelectorAll(".drawer.open").forEach((d) => d.classList.remove("open"));
  }

  function applyTickets(list) {
    const clean = list.map((t) => t.trim()).filter(Boolean);
    if (!clean.length) { alert("Ingresa al menos un boleto."); return; }
    state.tickets = clean.slice();
    state.base = clean.slice();
    angle = 0;
    save();
    renderWheel();
    updateCount();
    current.innerHTML = "&nbsp;";
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function updateSoundIcon() {
    $("soundWaves").style.display = state.muted ? "none" : "";
    $("soundOff").style.display = state.muted ? "" : "none";
  }

  // Eventos
  $("hub").addEventListener("click", spin);
  wheel.addEventListener("click", spin);
  $("btnKeep").addEventListener("click", closeWinner);
  $("btnRemove").addEventListener("click", () => {
    const idx = lastWinner;
    closeWinner();
    removeTicket(idx);
  });
  $("winner").addEventListener("click", (e) => { if (e.target.id === "winner") closeWinner(); });

  $("btnEdit").addEventListener("click", () => openDrawer("editor"));
  $("btnHistory").addEventListener("click", () => openDrawer("history"));
  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => $(b.dataset.close).classList.remove("open")));

  $("btnRange").addEventListener("click", () => {
    const a = parseInt($("from").value, 10), b = parseInt($("to").value, 10);
    if (isNaN(a) || isNaN(b) || b < a || b - a > 5000) { alert("Rango inválido (máx. 5000 boletos)."); return; }
    $("ticketsInput").value = range(a, b).join("\n");
  });
  $("btnShuffle").addEventListener("click", () => {
    $("ticketsInput").value = shuffle($("ticketsInput").value.split("\n").filter((l) => l.trim())).join("\n");
  });
  $("btnApply").addEventListener("click", () => {
    state.title = $("titleInput").value.trim();
    $("eventTitle").textContent = state.title;
    applyTickets($("ticketsInput").value.split("\n"));
    closeAll();
  });
  $("autoRemove").addEventListener("change", (e) => { state.autoRemove = e.target.checked; save(); });
  $("duration").addEventListener("input", (e) => {
    state.duration = +e.target.value; $("durLabel").textContent = state.duration; save();
  });

  $("btnReset").addEventListener("click", () => {
    if (spinning) return;
    if (confirm(`¿Reiniciar la ruleta con los ${state.base.length} boletos originales? (El historial de ganadores se conserva)`)) {
      applyTickets(state.base);
    }
  });
  $("btnClearHistory").addEventListener("click", () => {
    if (confirm("¿Borrar el historial de ganadores?")) { state.history = []; save(); renderHistory(); }
  });
  $("btnSound").addEventListener("click", () => { state.muted = !state.muted; updateSoundIcon(); save(); });
  $("btnFull").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  });

  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
    if (e.key === "Escape") { closeWinner(); closeAll(); return; }
    if (typing) return;
    if (e.code === "Space" || e.key === "Enter") {
      e.preventDefault();
      if ($("winner").classList.contains("open")) closeWinner();
      else spin();
    }
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { renderWheel(); if (lens.classList.contains("show")) drawLens(); }, 100);
  });

  // Inicio
  $("eventTitle").textContent = state.title;
  $("autoRemove").checked = state.autoRemove;
  $("duration").value = state.duration;
  $("durLabel").textContent = state.duration;
  updateSoundIcon();
  updateCount();
  renderHistory();
  renderWheel();
  document.fonts?.ready.then(renderWheel);
})();
