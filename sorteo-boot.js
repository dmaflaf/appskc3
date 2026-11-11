/* Página del sorteo de la Fase 2 para los DT.
   - La configuración (tabla final, pedidos, semilla, abierto/cerrado) la publica el organizador desde la herramienta
     del torneo en un gist que solo él puede modificar; aquí solo se lee.
   - Lo que saca cada DT viaja por ntfy.sh para que el panel En vivo se llene en todos los teléfonos.
     El resultado no depende de esos mensajes: lo fija la semilla. */
(function () {
const CFG_FILE = 'sorteo-fase2.json';
const NTFY = 'https://ntfy.sh/';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const G = new URLSearchParams(location.search).get('g') || '';        // dueño/id del gist del sorteo
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

async function fetchCfg() {
  if (!/^[\w-]+\/\w+$/.test(G)) throw new Error('link');
  const [owner, id] = G.split('/');
  const tries = [
    async () => { const r = await fetch('https://gist.githubusercontent.com/' + owner + '/' + id + '/raw/' + CFG_FILE + '?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error('raw ' + r.status); return r.json(); },
    async () => { const r = await fetch('https://api.github.com/gists/' + id, { cache: 'no-store' }); if (!r.ok) throw new Error('api ' + r.status); const j = await r.json(); return JSON.parse(j.files[CFG_FILE].content); }
  ];
  let err;
  for (const t of tries) { try { const c = await t(); if (c && c.v === 1 && c.orig && c.seed) return c; err = new Error('cfg'); } catch (e) { err = e; } }
  throw err;
}

let CFG = null, started = false, waitTimer = 0;
function banner() {
  const b = $('#banner');
  if (CFG && CFG.test) { b.hidden = false; b.className = 'banner test'; b.textContent = 'Sorteo de PRUEBA: no es el sorteo real.'; }
  else if (CFG && !CFG.open && started) { b.hidden = false; b.className = 'banner'; b.textContent = 'El sorteo está cerrado. Ya no se pueden sacar horarios; puedes ver los resultados.'; }
  else b.hidden = true;
}
function waitHtml(c) {
  return '<div class="gatewait"><p class="lbl">Sorteo Fase 2</p><p class="big">Todavía no abre</p><p class="dt-sub" style="margin-top:0">' +
    esc(c && c.abre ? 'Se abre ' + c.abre + '.' : 'El organizador todavía no abrió el sorteo.') + ' Deja esta página abierta: se activa sola.</p>' +
    (c && c.seed ? '<p class="seedbox">Semilla anunciada: <b>' + esc(c.seed) + '</b></p>' : '') + '</div>';
}
async function boot() {
  try { CFG = await fetchCfg(); }
  catch (e) {
    $('#boot').innerHTML = e.message === 'link'
      ? '<p class="banner">Este link está incompleto. Pide al organizador el link del sorteo.</p>'
      : '<p class="banner">No se pudo cargar el sorteo. Revisa tu internet; se reintenta solo.</p>';
    if (e.message !== 'link') { clearTimeout(waitTimer); waitTimer = setTimeout(boot, 15000); }
    return;
  }
  if (!CFG.open && !CFG.closedAt) { $('#boot').innerHTML = waitHtml(CFG); banner(); clearTimeout(waitTimer); waitTimer = setTimeout(boot, 30000); return; }
  $('#boot').hidden = true; $('#app').hidden = false;
  start(CFG); banner();
}
window.KCSorteo = { reload: boot };
boot();

/* ------------------------------------------------------------------ */
function start(cfg) {
  started = true;
  const K = KCDraw.create(cfg.orig, cfg.pedidos);
  const { DAYS, ST_NAME, SLOTS, TEAMS, CODES, DEFAULT_RESTR } = K;
  const res = K.runDraw(cfg.seed, DEFAULT_RESTR, cfg.variety !== false);
  if (!res) { $('#dtView').innerHTML = '<p class="banner">La configuración del sorteo no es válida. Avisa al organizador.</p>'; return; }
  const SHORT_DAY = ['Vie', 'Sáb', 'Dom'];
  const F0 = KCDraw.FECHA0;
  const fl = j => 'Fecha ' + (F0 + j);
  const dateOf = (j, d) => (cfg.dates && cfg.dates[j] ? cfg.dates[j][d] + ' ' + (cfg.mes || 'nov') : '');
  const state = { me: null, open: -1, dtMode: 'wheel', shown: new Set(), drawnBy: {}, drawAt: {}, liveF: 0, mapClub: -1, busy: false, skip: null };
  const SLOT_ORDER = SLOTS.slice().sort((a, b) => a.dayIdx - b.dayIdx || a.hour - b.hour || (a.st === b.st ? 0 : a.st === 'SM' ? -1 : 1));
  const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canDraw = () => cfg.open;
  const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const teamMatches = id => K.teamMatches(res, id);

  /* ---------- Vista del DT ---------- */
  function groupCard(cup, g, me) {
    let h = '<div class="gcard"><h4>Grupo ' + (g + 1) + '</h4><ol>';
    TEAMS.filter(t => t.cup === cup && t.g === g).forEach(t => {
      h += '<li' + (t.id === me ? ' class="me"' : '') + '><span class="gp">' + t.rank + 'º ' + t.from + '</span><b>' + esc(t.name) + '</b>' +
        (cup === 'Plata' && t.p >= 2 ? '<small>sin viernes</small>' : '') + '</li>';
    });
    return h + '</ol></div>';
  }
  function resultBlock(m, mi) {
    const id = state.me, rival = m.a === id ? m.b : m.a, by = state.drawnBy[mi];
    return '<div class="th"><span class="tf">' + fl(m.j) + '</span><span class="chip ' + m.st + '">' + ST_NAME[m.st] + '</span></div><div class="td"><span class="dd">' + m.slot.day +
      (dateOf(m.j, m.slot.dayIdx) ? ' ' + esc(dateOf(m.j, m.slot.dayIdx)) : '') + '</span><span class="tt">' + m.slot.time + '</span></div><div class="tr">vs <b>' + esc(TEAMS[rival].name) + '</b>' +
      (by !== undefined && by !== id ? ' · lo sacó ' + esc(TEAMS[by].name) : '') + '</div>';
  }
  function gateHtml() {
    return '<h2 class="step">Entra con el código de tu club</h2>' +
      '<p class="dt-sub" style="margin-top:0">El organizador te mandó por WhatsApp este link y un código personal (por ejemplo LEG2). El código dice qué club eres.</p>' +
      '<form id="gateForm" class="seedrow" autocomplete="off" style="margin-top:16px"><div class="f"><label for="gateCode">Código del club</label>' +
      '<input id="gateCode" maxlength="8" spellcheck="false" autocapitalize="characters"></div><button type="submit" class="btn1 go2">Entrar</button></form>' +
      '<p class="rmsg" id="gateMsg" role="alert"></p><p class="seedbox">Semilla del sorteo: <b>' + esc(cfg.seed) + '</b></p>' +
      (cfg.test ? '<p class="hint">Prueba: usa por ejemplo ' + [0, 9, 21].map(i => '<b>' + CODES[i] + '</b> (' + esc(TEAMS[i].name) + ')').join(', ') + '.</p>' : '');
  }
  function wheelSvg() {
    const cx = 160, cy = 160, R = 152, step = 22.5;
    const pt = (a, r) => { const t = a * Math.PI / 180; return [cx + r * Math.sin(t), cy - r * Math.cos(t)]; };
    let s = '<svg id="wheelSvg" viewBox="0 0 320 320" aria-hidden="true">';
    SLOT_ORDER.forEach((sl, i) => {
      const a0 = i * step, a1 = a0 + step, am = a0 + step / 2, p0 = pt(a0, R), p1 = pt(a1, R), tp = pt(am, 106);
      const rot = am > 180 ? am + 90 : am - 90;
      s += '<path class="sec ' + sl.st + '" data-i="' + i + '" d="M' + cx + ' ' + cy + 'L' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + 'A' + R + ' ' + R + ' 0 0 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + 'Z"/>';
      s += '<text class="lab" data-i="' + i + '" transform="rotate(' + rot.toFixed(2) + ' ' + tp[0].toFixed(2) + ' ' + tp[1].toFixed(2) + ')" x="' + tp[0].toFixed(2) + '" y="' + tp[1].toFixed(2) + '" text-anchor="middle" dominant-baseline="central">' + SHORT_DAY[sl.dayIdx] + ' ' + sl.time.replace('h00', 'h') + '</text>';
    });
    return s + '<circle class="rim" cx="160" cy="160" r="152"/></svg>';
  }
  function drawboxHtml(m, mi, done) {
    const wheel = state.dtMode === 'wheel';
    let h = '<div class="drawbox" id="drawbox">';
    if (!done) h += '<div class="seg2" role="tablist" aria-label="Forma de sorteo"><button type="button" role="tab" data-act="mode" data-v="wheel" aria-selected="' + wheel + '">Rueda</button><button type="button" role="tab" data-act="mode" data-v="balls" aria-selected="' + !wheel + '">Bolillero</button></div>';
    h += '<div class="stage" id="stage">' + (wheel
      ? '<div class="wheel"><i class="ptr"></i>' + wheelSvg() + '<button type="button" class="hub" id="spinGo"' + (done ? ' disabled' : '') + '>Girar</button></div>'
      : '<canvas id="ballsCv" class="cv" role="img" aria-label="Bolillero con 16 bolitas, una por horario"></canvas>') + '</div>';
    h += '<div class="legend2"><span><i style="background:var(--sm)"></i>San Miguel</span><span><i style="background:var(--sa)"></i>Los Sauces</span></div>';
    if (!wheel && !done) h += '<div class="row" style="justify-content:center"><button type="button" class="btn1 go2" id="spinGo">Sacar bolita</button></div>';
    h += '<div class="row" style="justify-content:center"><button type="button" class="btn2" id="skipGo" hidden>Saltar animación</button></div>';
    h += '<p class="hint">Son los 16 horarios de la fecha. Rival y horario salen juntos. El resultado ya lo fija la semilla del sorteo; ' + (wheel ? 'la rueda' : 'el bolillero') + ' solo lo muestra.</p>';
    h += '<div id="drawRes">' + (done ? '<div class="ti resbox">' + resultBlock(m, mi) + '</div><div class="row" style="justify-content:center"><button type="button" class="btn1 go2" data-act="close">Listo</button></div>' : '') + '</div></div>';
    return h;
  }
  function renderDT() {
    ballsStop(); state.busy = false; state.skip = null;
    const v = $('#dtView');
    if (state.me === null) { v.innerHTML = gateHtml(); return; }
    const id = state.me, t = TEAMS[id], ms = teamMatches(id);
    const fri = (t.cup === 'Oro' || t.p < 2) ? 'Juegas un viernes en esta fase.' : 'No juegas viernes: tus 3 partidos son sábado o domingo. Es la regla para los 7º y 8º de la tabla en Copa Plata.';
    let h = '<div class="who"><div><p class="lbl">Hola, DT de</p><h2 class="club">' + esc(t.name) + '</h2><p class="tmeta">Copa ' + t.cup + ' · Grupo ' + (t.g + 1) + ' · ' + t.rank + 'º del grupo ' + t.from +
      '</p></div><button type="button" class="linkbtn" data-act="logout">Salir</button></div><p style="margin:8px 0 0">' + fri + '</p>';
    if (DEFAULT_RESTR[id]) h += '<p class="note">Tu pedido se respetó: ' + esc(K.RESTR_LONG[DEFAULT_RESTR[id]]) + '.</p>';
    h += '<h2 class="step">Tu grupo</h2><div class="gboard">' + groupCard(t.cup, t.g, id) + '</div>';
    h += '<h2 class="step">Tus fechas</h2><ol class="tlist">';
    ms.forEach((m, k) => {
      const mi = res.matches.indexOf(m);
      const done = state.shown.has(mi), prevDone = k === 0 || state.shown.has(res.matches.indexOf(ms[k - 1]));
      const head = '<div class="th"><span class="tf">' + fl(m.j) + '</span></div><div class="tr">Rival y horario por sortear</div>';
      if (state.open === k) h += '<li class="ti">' + head + drawboxHtml(m, mi, done) + '</li>';
      else if (done) h += '<li class="ti">' + resultBlock(m, mi) + '</li>';
      else if (!canDraw()) h += '<li class="ti locked">' + head + '<p class="hint" style="margin:0">El sorteo está cerrado.</p></li>';
      else if (prevDone) h += '<li class="ti">' + head + '<button type="button" class="btn1 go2" data-act="open" data-k="' + k + '" style="justify-self:start;margin-top:6px">Sacar rival y horario</button></li>';
      else h += '<li class="ti locked">' + head + '<p class="hint" style="margin:0">Se abre cuando saques tu horario de la ' + fl(m.j - 1) + '.</p></li>';
    });
    h += '</ol><p class="seedbox">Semilla del sorteo: <b>' + esc(cfg.seed) + '</b>. Con la misma semilla sale siempre lo mismo.</p>';
    h += '<div class="row"><button type="button" class="btn2" data-act="live">Ver el panel en vivo</button></div>';
    if (NET.err) h += '<p class="syncnote">No se pudo enviar tu sorteo al panel en vivo. Se reintenta solo; tu resultado ya está fijo por la semilla.</p>';
    h += '<details><summary>Todos los grupos</summary>';
    ['Oro', 'Plata'].forEach(cup => {
      h += '<h3 class="bh">Copa ' + cup + '</h3><div class="gboard">';
      for (let g = 0; g < 4; g++) h += groupCard(cup, g, id);
      h += '</div>';
    });
    v.innerHTML = h + '</details>';
    if (state.open >= 0 && state.dtMode === 'balls' && $('#ballsCv') && !state.shown.has(res.matches.indexOf(ms[state.open]))) ballsSetup($('#ballsCv'));
  }

  /* Rueda */
  function spinWheel(slot, cb) {
    const svg = $('#wheelSvg');
    const idx = SLOT_ORDER.findIndex(s => s.id === slot.id);
    const total = 360 * 5 + (360 - (idx + 0.5) * 22.5 - (Math.random() - 0.5) * 12);
    let timer = 0, over = false;
    const end = () => {
      if (over) return; over = true; clearTimeout(timer);
      document.querySelectorAll('#wheelSvg [data-i="' + idx + '"]').forEach(el => el.classList.add('win'));
      cb();
    };
    if (RM) { svg.style.transform = 'rotate(' + total + 'deg)'; setTimeout(end, 0); return; }
    svg.style.transition = 'transform 4.6s cubic-bezier(.12,.62,.08,1)';
    void svg.getBoundingClientRect();
    svg.style.transform = 'rotate(' + total + 'deg)';
    timer = setTimeout(end, 4700);
    state.skip = () => { svg.style.transition = 'none'; svg.style.transform = 'rotate(' + total + 'deg)'; end(); };
  }

  /* Bolillero */
  const BW = 340, BH = 430, DCX = 170, DCY = 168, DR = 160, TRX = 170, TRY = 372;
  const BA = { raf: 0, cv: null, ctx: null, balls: [], phase: 'idle', t0: 0, target: -1, cb: null, p0: null };
  function ballsStop() { if (BA.raf) cancelAnimationFrame(BA.raf); BA.raf = 0; BA.cv = null; }
  function ballsSetup(cv) {
    ballsStop();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = BW * dpr; cv.height = BH * dpr;
    BA.cv = cv; BA.ctx = cv.getContext('2d'); BA.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    BA.balls = SLOT_ORDER.map((sl, i) => ({ slot: sl, n: i + 1, x: DCX - 88 + (i % 5) * 44 + (Math.floor(i / 5) % 2) * 22, y: DCY + 90 - Math.floor(i / 5) * 44, vx: 0, vy: 0, r: 22, out: false }));
    for (let k = 0; k < 240; k++) ballsStep(false);
    BA.phase = 'idle'; BA.target = -1; BA.cb = null;
    ballsDraw();
    BA.raf = requestAnimationFrame(ballsLoop);
  }
  function ballsStep(agit) {
    const B = BA.balls, g = agit ? 0.1 : 0.4;
    B.forEach(b => {
      if (b.out) return;
      b.vy += g;
      if (agit) {
        const dx0 = b.x - DCX, dy0 = b.y - DCY;
        b.vx += -dy0 * 0.0025 + (Math.random() - 0.5) * 1.1;
        b.vy += dx0 * 0.0025 + (Math.random() - 0.5) * 1.1;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 9) { b.vx *= 9 / sp; b.vy *= 9 / sp; }
      }
      b.vx *= 0.995; b.vy *= 0.995;
      b.x += b.vx; b.y += b.vy;
      const dx = b.x - DCX, dy = b.y - DCY, d = Math.hypot(dx, dy) || 1, max = DR - b.r - 4;
      if (d > max) {
        const nx = dx / d, ny = dy / d;
        b.x = DCX + nx * max; b.y = DCY + ny * max;
        const vn = b.vx * nx + b.vy * ny;
        if (vn > 0) { b.vx -= 1.7 * vn * nx; b.vy -= 1.7 * vn * ny; }
      }
    });
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
      const a = B[i], c = B[j];
      if (a.out || c.out) continue;
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), min = a.r + c.r;
      if (d < min && d > 0.001) {
        const nx = dx / d, ny = dy / d, ov = (min - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
        const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (vn < 0) { const imp = -vn * 0.85; a.vx -= imp * nx; a.vy -= imp * ny; c.vx += imp * nx; c.vy += imp * ny; }
      }
    }
  }
  function ballsPlace(e) {
    const b = BA.balls[BA.target], p0 = BA.p0, c = [DCX, DCY + DR + 24], p1 = [TRX, TRY];
    b.x = (1 - e) * (1 - e) * p0[0] + 2 * (1 - e) * e * c[0] + e * e * p1[0];
    b.y = (1 - e) * (1 - e) * p0[1] + 2 * (1 - e) * e * c[1] + e * e * p1[1];
    b.r = 22 + (52 - 22) * e;
  }
  function ballsLoop(ts) {
    if (!BA.cv || !document.body.contains(BA.cv)) { BA.raf = 0; return; }
    const now = ts || performance.now();
    if (BA.phase === 'agit') {
      ballsStep(true);
      if (now - BA.t0 > 2400) { BA.phase = 'out'; BA.t0 = now; const b = BA.balls[BA.target]; b.out = true; BA.p0 = [b.x, b.y]; }
    } else if (BA.phase === 'out') {
      ballsStep(false);
      const t = Math.min(1, (now - BA.t0) / 1100);
      ballsPlace(t * t * (3 - 2 * t));
      if (t >= 1) { BA.phase = 'show'; const f = BA.cb; BA.cb = null; if (f) f(); }
    } else ballsStep(false);
    ballsDraw();
    BA.raf = requestAnimationFrame(ballsLoop);
  }
  function ballsDraw() {
    const ctx = BA.ctx, cs = getComputedStyle(document.documentElement);
    const C = n => cs.getPropertyValue(n).trim();
    ctx.clearRect(0, 0, BW, BH);
    ctx.beginPath(); ctx.arc(DCX, DCY, DR, 0, Math.PI * 2); ctx.fillStyle = C('--surface'); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = C('--line'); ctx.stroke();
    ctx.beginPath(); ctx.arc(TRX, TRY, 58, 0, Math.PI * 2); ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.strokeStyle = C('--line'); ctx.stroke(); ctx.setLineDash([]);
    const one = b => {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = C(b.slot.st === 'SM' ? '--sm' : '--sa'); ctx.fill();
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.26, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill();
      ctx.fillStyle = C('--bg'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (b.out && BA.phase === 'show') {
        ctx.font = '700 15px Barlow, system-ui, sans-serif'; ctx.fillText(b.slot.day, b.x, b.y - 24);
        ctx.font = 'italic 800 30px "Barlow Condensed", "Arial Narrow", sans-serif'; ctx.fillText(b.slot.time, b.x, b.y + 1);
        ctx.font = '600 11px Barlow, system-ui, sans-serif'; ctx.fillText(ST_NAME[b.slot.st], b.x, b.y + 26);
      } else {
        ctx.font = '700 ' + Math.round(b.r * 0.72) + 'px Barlow, system-ui, sans-serif'; ctx.fillText(String(b.n), b.x, b.y + 1);
      }
    };
    BA.balls.forEach(b => { if (!b.out) one(b); });
    BA.balls.forEach(b => { if (b.out) one(b); });
  }
  function ballsPlay(slotId, cb) {
    BA.target = BA.balls.findIndex(b => b.slot.id === slotId);
    BA.cb = cb; BA.phase = 'agit'; BA.t0 = performance.now();
    if (RM) ballsFinishNow();
  }
  function ballsFinishNow() {
    if (BA.target < 0 || BA.phase === 'show') return;
    const b = BA.balls[BA.target];
    if (!b.out) { b.out = true; BA.p0 = [b.x, b.y]; }
    ballsPlace(1); BA.phase = 'show';
    const f = BA.cb; BA.cb = null;
    if (f) setTimeout(f, 0);
  }

  function burst(host) {
    if (RM || !host) return;
    const cols = ['--accent', '--day', '--sa', '--oro'];
    for (let i = 0; i < 30; i++) {
      const e = document.createElement('i'); e.className = 'cf';
      const ang = Math.random() * Math.PI * 2, d = 90 + Math.random() * 120;
      e.style.setProperty('--dx', (Math.cos(ang) * d).toFixed(0) + 'px');
      e.style.setProperty('--dy', (Math.sin(ang) * d - 40).toFixed(0) + 'px');
      e.style.setProperty('--rot', Math.floor(Math.random() * 720) + 'deg');
      e.style.background = 'var(' + cols[i % 4] + ')';
      host.appendChild(e);
      setTimeout(() => e.remove(), 1400);
    }
  }
  function startDraw() {
    if (state.busy || state.open < 0 || state.me === null || !canDraw()) return;
    const m = teamMatches(state.me)[state.open], mi = res.matches.indexOf(m);
    if (state.shown.has(mi)) return;
    state.busy = true;
    const spin = $('#spinGo'); if (spin) spin.disabled = true;
    const tg = document.querySelector('.seg2'); if (tg) tg.hidden = true;
    const sk = $('#skipGo'); if (sk) sk.hidden = false;
    const finish = () => {
      state.busy = false; state.skip = null;
      if (!state.shown.has(mi)) { state.shown.add(mi); state.drawnBy[mi] = state.me; state.drawAt[mi] = Date.now(); }
      sendDraw(mi, state.me); renderLive();
      const k = $('#skipGo'); if (k) k.hidden = true;
      const box = $('#drawRes');
      if (box) box.innerHTML = '<div class="ti in resbox">' + resultBlock(m, mi) + '</div><div class="row" style="justify-content:center"><button type="button" class="btn1 go2" data-act="close">Listo</button></div>';
      burst($('#stage'));
      if (box && box.scrollIntoView) box.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'nearest' });
      if (NET.pendingApply) { NET.pendingApply = false; applyNet(false); }
    };
    if (state.dtMode === 'wheel') spinWheel(m.slot, finish);
    else { ballsPlay(m.slot.id, finish); state.skip = ballsFinishNow; }
  }
  $('#dtView').addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#spinGo')) { startDraw(); return; }
    if (t.closest('#skipGo')) { if (state.skip) state.skip(); return; }
    const a = t.closest('[data-act]');
    if (!a || state.busy) return;
    const act = a.dataset.act;
    if (act === 'logout') { state.me = null; state.open = -1; lsSet('kc3me', null); renderDT(); }
    else if (act === 'live') setMode('live');
    else if (act === 'open') {
      state.open = +a.dataset.k; renderDT();
      const bx = $('#drawbox'); if (bx && bx.scrollIntoView) bx.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
    }
    else if (act === 'mode') { state.dtMode = a.dataset.v; renderDT(); }
    else if (act === 'close') { state.open = -1; renderDT(); }
  });
  $('#dtView').addEventListener('submit', e => {
    if (e.target.id !== 'gateForm') return;
    e.preventDefault();
    const id = CODES.findIndex(c => normCode(c) === normCode($('#gateCode').value));
    if (id < 0) { $('#gateMsg').textContent = 'Ese código no existe. Revisa que esté bien escrito.'; return; }
    state.me = id; state.open = -1; lsSet('kc3me', normCode(CODES[id])); renderDT();
  });
  function setMode(mode) {
    document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-selected', String(x.dataset.mode === mode)));
    $('#dtView').hidden = mode !== 'dt';
    $('#liveView').hidden = mode !== 'live';
    $('#mapView').hidden = mode !== 'map';
    if (mode === 'live') renderLive();
    if (mode === 'map') renderMap();
  }
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

  /* ---------- Panel en vivo y mapa ---------- */
  let lastShown = new Set();
  const fmtTime = ts => { try { return new Date(ts).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  function renderMap() {
    const v = $('#mapView');
    if (v.hidden) return;
    const hl = state.mapClub, keys = [];
    SLOT_ORDER.forEach(sl => { const k = sl.dayIdx + '-' + sl.hour; if (!keys.includes(k)) keys.push(k); });
    let h = '';
    keys.forEach(k => {
      const sls = SLOT_ORDER.filter(sl => sl.dayIdx + '-' + sl.hour === k);
      h += '<h3 class="lday">' + DAYS[sls[0].dayIdx] + ' ' + sls[0].time + '</h3>';
      [0, 1, 2].forEach(j => {
        h += '<div class="mrow"><b>F' + (F0 + j) + '</b><div>';
        sls.forEach(sl => {
          const mi = res.matches.findIndex(m => m.j === j && m.slot.id === sl.id), m = res.matches[mi];
          const on = mi >= 0 && state.shown.has(mi);
          const mine = on && hl >= 0 && (m.a === hl || m.b === hl);
          h += '<div class="ml' + (mine ? ' hl' : '') + '"><span class="chip ' + sl.st + '">' + ST_NAME[sl.st] + '</span>' +
            (on ? '<span>' + esc(TEAMS[m.a].name) + ' vs ' + esc(TEAMS[m.b].name) + '</span>' : '<span class="free">por sortear</span>') + '</div>';
        });
        h += '</div></div>';
      });
    });
    $('#mapBody').innerHTML = h;
  }
  const sel = $('#mapClub');
  sel.innerHTML = '<option value="-1">Resaltar un club (todos)</option>' + TEAMS.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map(t => '<option value="' + t.id + '">' + esc(t.name) + '</option>').join('');
  sel.addEventListener('change', () => { state.mapClub = +sel.value; renderMap(); });
  function renderLive() {
    renderMap();
    const v = $('#liveView');
    if (v.hidden) { lastShown = new Set(state.shown); return; }
    const per = [0, 1, 2].map(j => res.matches.filter((m, i) => m.j === j && state.shown.has(i)).length);
    const total = per[0] + per[1] + per[2], f = state.liveF;
    let h = '<div class="liveh"><div class="big">' + total + '<small> / 48 partidos</small></div><span class="pill"><i class="dot' + (NET.live ? ' on' : '') + '"></i>' + (NET.live ? 'En vivo, se actualiza solo' : 'Conectando con el panel…') + '</span></div>';
    h += '<div class="bars">' + per.map((n, j) => '<div class="bar"><span>' + fl(j) + '</span><span class="tr"><i style="width:' + Math.round(n / 16 * 100) + '%"></i></span><b>' + n + '/16</b></div>').join('') + '</div>';
    h += '<div class="tabs" role="tablist" aria-label="Fecha del panel">' + [0, 1, 2].map(j => '<button type="button" role="tab" data-lf="' + j + '" aria-selected="' + (j === f) + '">' + fl(j) + '</button>').join('') + '</div>';
    [0, 1, 2].forEach(d => {
      h += '<h3 class="lday">' + DAYS[d] + (dateOf(f, d) ? ' ' + esc(dateOf(f, d)) : '') + '</h3>';
      SLOT_ORDER.filter(sl => sl.dayIdx === d).forEach(sl => {
        const mi = res.matches.findIndex(m => m.j === f && m.slot.id === sl.id);
        const m = res.matches[mi], on = mi >= 0 && state.shown.has(mi);
        h += '<div class="ls' + (on && !lastShown.has(mi) && !RM ? ' pop' : '') + '"><span class="t">' + sl.time + '</span><span class="chip ' + sl.st + '">' + ST_NAME[sl.st] + '</span>' +
          (on ? '<span><b>' + esc(TEAMS[m.a].name) + '</b> vs <b>' + esc(TEAMS[m.b].name) + '</b><span class="cupt ' + m.cup + '">' + m.cup + '</span></span>' : '<span class="free">por sortear</span>') + '</div>';
      });
    });
    const recent = Object.keys(state.drawAt).map(Number).filter(mi => state.shown.has(mi)).sort((a, b) => state.drawAt[b] - state.drawAt[a]).slice(0, 8);
    h += '<h3 class="lday">Últimos sorteos</h3>';
    h += recent.length ? '<ul class="feed">' + recent.map(mi => {
      const m = res.matches[mi], by = state.drawnBy[mi], other = m.a === by ? m.b : m.a;
      return '<li><time>' + fmtTime(state.drawAt[mi]) + '</time><b>' + esc(TEAMS[by !== undefined ? by : m.a].name) + '</b> sacó ' + fl(m.j).toLowerCase() + ': vs ' + esc(TEAMS[other].name) + ', ' + m.slot.day + ' ' + m.slot.time + ', ' + ST_NAME[m.st] + '</li>';
    }).join('') + '</ul>' : '<p class="hint">Todavía nadie ha sorteado.</p>';
    v.innerHTML = h;
    lastShown = new Set(state.shown);
  }
  $('#liveView').addEventListener('click', e => {
    const b = e.target.closest('button[data-lf]');
    if (b) { state.liveF = +b.dataset.lf; lastShown = new Set(state.shown); renderLive(); }
  });

  /* ---------- Panel compartido por ntfy.sh ---------- */
  const NET = { live: false, err: false, msgs: new Map(), es: null, pollT: 0, lastId: '', fails: 0, pendingApply: false, outbox: [] };
  const topic = cfg.topic;
  function onMsg(o) {
    if (!o || o.event !== 'message' || !o.id || NET.msgs.has(o.id)) return false;
    let x = null; try { x = JSON.parse(o.message); } catch (e) { return false; }
    NET.msgs.set(o.id, { t: o.time || 0, x }); NET.lastId = o.id;
    if (x && x.k === 'close') setTimeout(() => window.KCSorteo.reload(), 500);
    return true;
  }
  function applyNet(render) {
    if (state.busy) { NET.pendingApply = true; renderLive(); return; }
    const list = Array.from(NET.msgs.values()).sort((a, b) => a.t - b.t);
    list.forEach(({ t, x }) => {
      if (!x || x.k !== 'draw' || x.seed !== cfg.seed || !Number.isInteger(x.mi) || !res.matches[x.mi]) return;
      const m = res.matches[x.mi];
      if (x.by !== m.a && x.by !== m.b) return;          // solo uno de los dos clubes del partido puede sacarlo
      if (state.shown.has(x.mi) && state.drawnBy[x.mi] !== undefined) return;
      state.shown.add(x.mi); state.drawnBy[x.mi] = x.by; state.drawAt[x.mi] = (x.at && Math.abs(x.at - t * 1000) < 6e5) ? x.at : t * 1000;
    });
    if (render !== false) { if (state.me !== null && state.open < 0) renderDT(); renderLive(); }
  }
  function startStream() {
    if (typeof EventSource !== 'function') { startPoll(); return; }
    try {
      const es = new EventSource(NTFY + encodeURIComponent(topic) + '/sse?since=all');
      NET.es = es;
      es.onopen = () => { NET.live = true; NET.fails = 0; renderLive(); };
      es.onmessage = ev => { let o = null; try { o = JSON.parse(ev.data); } catch (e) { return; } if (onMsg(o)) applyNet(); };
      es.onerror = () => { NET.live = false; renderLive(); if (++NET.fails >= 4) { es.close(); NET.es = null; startPoll(); } };
    } catch (e) { startPoll(); }
  }
  async function poll() {
    try {
      const r = await fetch(NTFY + encodeURIComponent(topic) + '/json?poll=1&since=' + (NET.lastId || 'all'), { cache: 'no-store' });
      if (!r.ok) throw new Error('http ' + r.status);
      const txt = await r.text(); let ch = false;
      txt.split('\n').forEach(l => { if (!l.trim()) return; try { if (onMsg(JSON.parse(l))) ch = true; } catch (e) { /* línea rota */ } });
      NET.live = true; if (ch) applyNet(); else renderLive();
    } catch (e) { NET.live = false; renderLive(); }
    NET.pollT = setTimeout(poll, 8000);
  }
  function startPoll() { clearTimeout(NET.pollT); poll(); }
  async function sendDraw(mi, by) {
    const body = JSON.stringify({ k: 'draw', seed: cfg.seed, mi, by, code: CODES[by], at: Date.now() });
    NET.outbox.push(body); flush();
  }
  let flushing = false;
  async function flush() {
    if (flushing) return; flushing = true;
    while (NET.outbox.length) {
      try {
        const r = await fetch(NTFY + encodeURIComponent(topic), { method: 'POST', body: NET.outbox[0] });
        if (!r.ok) throw new Error('http ' + r.status);
        NET.outbox.shift(); NET.err = false;
      } catch (e) {
        if (!NET.err) { NET.err = true; if (!state.busy && state.me !== null && state.open < 0) renderDT(); }
        await new Promise(r => setTimeout(r, 5000));
      }
    }
    if (NET.err === false && state.me !== null && state.open < 0 && !state.busy) renderDT();
    flushing = false;
  }

  /* La configuración se revisa cada minuto (por si el organizador cierra el sorteo). */
  setInterval(async () => {
    try { const c = await fetchCfg(); if (c.seed === cfg.seed && c.open !== cfg.open) { cfg.open = c.open; CFG.open = c.open; banner(); if (!state.busy) renderDT(); } }
    catch (e) { /* se vuelve a intentar */ }
  }, 60000);
  window.KCSorteo.reload = async () => {
    try { const c = await fetchCfg(); if (c.seed === cfg.seed) { cfg.open = c.open; CFG.open = c.open; banner(); if (!state.busy) renderDT(); } else location.reload(); }
    catch (e) { /* sin cambios */ }
  };

  const saved = lsGet('kc3me');
  if (saved) { const id = CODES.findIndex(c => normCode(c) === saved); if (id >= 0) state.me = id; }
  renderDT();
  startStream();
}
})();
