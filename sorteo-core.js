/* Motor del sorteo de la Fase 2 (Copa Oro / Copa Plata). Lo usan la página del sorteo y la herramienta del torneo.
   KCDraw.create(orig, pedidos) arma los 32 equipos desde la tabla final y devuelve las funciones del sorteo. */
(function () {
function create(orig, pedidos) {

const DAYS = ['Viernes', 'Sábado', 'Domingo'];
const ST_NAME = { SM: 'San Miguel', SA: 'Los Sauces' };
const SLOTS = [
  ['Viernes', '19h00', 19, 'SM'], ['Viernes', '21h00', 21, 'SM'], ['Viernes', '19h00', 19, 'SA'], ['Viernes', '21h00', 21, 'SA'],
  ['Sábado', '15h00', 15, 'SM'], ['Sábado', '17h00', 17, 'SM'], ['Sábado', '19h00', 19, 'SM'], ['Sábado', '17h00', 17, 'SA'], ['Sábado', '19h00', 19, 'SA'],
  ['Domingo', '9h00', 9, 'SM'], ['Domingo', '11h00', 11, 'SM'], ['Domingo', '13h00', 13, 'SM'], ['Domingo', '15h00', 15, 'SM'], ['Domingo', '17h00', 17, 'SM'],
  ['Domingo', '15h00', 15, 'SA'], ['Domingo', '17h00', 17, 'SA']
].map((s, i) => ({ id: i, day: s[0], dayIdx: DAYS.indexOf(s[0]), time: s[1], hour: s[2], st: s[3] }));

const RESTR = {
  noVie: 'Sin viernes',
  noSab: 'Sin sábado',
  noDom: 'Sin domingo',
  noMan: 'Sin domingo temprano',
  sab19: 'Sábado solo 19h',
  sab17: 'Sábado desde las 17h',
  fixDVS: 'Fechas fijas'
};
const RESTR_LONG = {
  noVie: 'Ningún partido el viernes',
  noSab: 'Ningún partido el sábado',
  noDom: 'Ningún partido el domingo',
  noMan: 'Ningún partido el domingo antes de las 13h00',
  sab19: 'Si juega el sábado, solo a las 19h00',
  sab17: 'Ningún partido el sábado antes de las 17h00',
  fixDVS: 'Fecha 1 domingo, fecha 2 viernes y fecha 3 sábado'
};

/* La tabla (puestos 1 a 8 de cada grupo A-D) y los pedidos llegan de la configuración del organizador. */
const ORIG = orig;
const TEAMS = [];
['Oro', 'Plata'].forEach(cup => {
  for (let g = 0; g < 4; g++) for (let p = 0; p < 4; p++) {
    const from = 'ABCD'[(g + p) % 4];
    const rank = (cup === 'Oro' ? 1 : 5) + p;
    TEAMS.push({ id: TEAMS.length, cup, g, p, from, rank, name: ORIG[from][rank - 1] });
  }
});
/* Pedidos de los clubes, por nombre: {"Legacy": "noSab", ...} */
const DEFAULT_RESTR = {};
Object.keys(pedidos || {}).forEach(n => { const t = TEAMS.find(x => x.name === n); if (t && pedidos[n]) DEFAULT_RESTR[t.id] = pedidos[n]; });
const tid = (cup, g, p) => (cup === 'Oro' ? 0 : 16) + g * 4 + p;
const MATCHINGS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const makeRng = seed => mulberry32(xmur3(String(seed))());
function shuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; }
  return a;
}

function allowed(code, slot, j) {
  switch (code) {
    case 'sab19': return slot.dayIdx !== 1 || slot.hour === 19;
    case 'sab17': return slot.dayIdx !== 1 || slot.hour >= 17;
    case 'fixDVS': return j === undefined || slot.dayIdx === [2, 0, 1][j];
    case 'noVie': return slot.dayIdx !== 0;
    case 'noSab': return slot.dayIdx !== 1;
    case 'noDom': return slot.dayIdx !== 2;
    case 'noMan': return !(slot.dayIdx === 2 && slot.hour < 13);
    default: return true;
  }
}
const okMatch = (m, slot, restr) => allowed(restr[m.a], slot, m.j) && allowed(restr[m.b], slot, m.j);

/* Con la regla de viernes (todo Oro y las 2 primeras posiciones de Plata) cada fecha necesita
   4 partidos de viernes, 2 en cada estadio. Esto revisa si el reparto de estadios lo permite. */
function fridayOk(matches) {
  const q = [0, 0, 0], qs = [0, 0, 0], saF = [0, 0, 0, 0];
  matches.forEach(m => {
    if (m.cup === 'Plata' && m.pa < 2 && m.pb < 2) { q[m.j]++; if (m.st === 'SA') qs[m.j]++; }
    if (m.cup === 'Oro' && m.st === 'SA') saF[m.g] = m.j;
  });
  for (let code = 0; code < 81; code++) {
    const k = [0, 0, 0], ks = [0, 0, 0];
    let c = code;
    for (let g = 0; g < 4; g++) { const f = c % 3; c = Math.floor(c / 3); k[f]++; if (f === saF[g]) ks[f]++; }
    let ok = true;
    for (let j = 0; j < 3; j++) if (2 * k[j] + q[j] !== 4 || 2 * ks[j] + qs[j] !== 2) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

/* Paso 1: orden de las fechas por grupo y estadio de cada partido. */
function planStadiums(rnd, needFriday) {
  for (let tries = 0; tries < 40000; tries++) {
    const matches = [];
    const plataPaths = new Set(shuffle([0, 1, 2, 3], rnd).slice(0, 2));
    for (const cup of ['Oro', 'Plata']) {
      const base = cup === 'Oro' ? 0 : 16;
      for (let g = 0; g < 4; g++) {
        const order = shuffle([0, 1, 2], rnd); /* se sortea en qué fecha va cada cruce */
        const gm = [];
        MATCHINGS.forEach((mm, k) => mm.forEach(([a, b]) => {
          gm.push({ cup, g, a: base + g * 4 + a, b: base + g * 4 + b, pa: a, pb: b, k, j: order[k], st: 'SM', slot: null });
        }));
        if (cup === 'Oro' || !plataPaths.has(g)) {
          const kk = Math.floor(rnd() * 3);
          gm.forEach(m => { if (m.k === kk) m.st = 'SA'; });
        } else {
          const path = shuffle([0, 1, 2, 3], rnd);
          const edges = [[path[0], path[1]], [path[1], path[2]], [path[2], path[3]]];
          gm.forEach(m => {
            if (edges.some(e => (e[0] === m.pa && e[1] === m.pb) || (e[0] === m.pb && e[1] === m.pa))) m.st = 'SA';
          });
        }
        for (const m of gm) matches.push(m);
      }
    }
    const perJ = [0, 0, 0];
    matches.forEach(m => { if (m.st === 'SA') perJ[m.j]++; });
    if (perJ.some(x => x !== 6)) continue;
    const saJ = {};
    matches.forEach(m => {
      if (m.st === 'SA') { (saJ[m.a] = saJ[m.a] || []).push(m.j); (saJ[m.b] = saJ[m.b] || []).push(m.j); }
    });
    let bad = false;
    for (const id in saJ) { const js = saJ[id].slice().sort(); if (js.length > 1 && js[1] - js[0] === 1) bad = true; }
    if (bad) continue;
    if (needFriday && !fridayOk(matches)) continue;
    return matches;
  }
  return null;
}

/* Emparejamiento válido partido-horario (si existe), con orden aleatorio. */
function kuhn(ms, slots, restr, rnd, used) {
  const n = ms.length;
  const owner = new Array(n).fill(-1);
  const adj = ms.map(m => shuffle(slots.map((_, i) => i).filter(i => okMatch(m, slots[i], restr) && free(used, m, slots[i])), rnd));
  function tryK(i, seen) {
    for (const s of adj[i]) {
      if (seen[s]) continue;
      seen[s] = true;
      if (owner[s] < 0 || tryK(owner[s], seen)) { owner[s] = i; return true; }
    }
    return false;
  }
  for (const i of shuffle(ms.map((_, i) => i), rnd)) {
    if (!tryK(i, new Array(n).fill(false))) return null;
  }
  const res = new Array(n);
  owner.forEach((i, s) => { res[i] = slots[s]; });
  return res;
}

/* Rellena una clase (misma fecha, estadio y día) con horarios al azar. */
const hkey = s => s.dayIdx + '-' + s.hour;
const free = (used, m, s) => !used || (!used[m.a].has(hkey(s)) && !used[m.b].has(hkey(s)));
function markUsed(used, ms) { if (used) ms.forEach(m => { used[m.a].add(hkey(m.slot)); used[m.b].add(hkey(m.slot)); }); }
function fillClass(ms, sl, restr, rnd, used) {
  if (ms.length !== sl.length) return false;
  const fallback = kuhn(ms, sl, restr, rnd, used);
  if (!fallback) return false;
  let pick = null;
  for (let t = 0; t < 400 && !pick; t++) {
    const perm = shuffle(sl, rnd);
    if (ms.every((m, i) => okMatch(m, perm[i], restr) && free(used, m, perm[i]))) pick = perm;
  }
  (pick || fallback).forEach((s, i) => { ms[i].slot = s; });
  markUsed(used, ms);
  return true;
}

/* Paso 2 sin regla de variedad: horario al azar dentro de cada estadio. */
function assignSlots(matches, restr, rnd) {
  const used = TEAMS.map(() => new Set());
  for (let j = 0; j < 3; j++) {
    for (const st of ['SM', 'SA']) {
      if (!fillClass(matches.filter(m => m.j === j && m.st === st), SLOTS.filter(s => s.st === st), restr, rnd, used)) return false;
    }
  }
  return true;
}

/* Paso 2 con variedad: primero el día de cada partido, después la hora. */
const DAY_COUNTS = { SM: [2, 3, 5], SA: [2, 2, 2] };
function assignDays(matches, restr, rnd) {
  const cls = [];
  for (let j = 0; j < 3; j++) for (const st of ['SM', 'SA']) cls.push(matches.filter(m => m.j === j && m.st === st));
  const nf = TEAMS.map(t => t.cup === 'Plata' && t.p >= 2);
  const pen = (c, r, id) => {
    let p = 0;
    if (nf[id]) p += 1000 * c[0];
    if (c[0] > 1) p += 100 * (c[0] - 1);
    if (c[1] > 1) p += 4 * (c[1] - 1);
    if (c[2] === 3) p += 100;
    if (r === 'noVie') p += 1000 * c[0]; else if (r === 'noSab') p += 1000 * c[1]; else if (r === 'noDom') p += 1000 * c[2];
    return p;
  };
  matches.forEach(m => {
    m.pin = undefined;
    [m.a, m.b].forEach(id => { if (restr[id] === 'fixDVS') m.pin = [2, 0, 1][m.j]; });
  });
  let bestDays = null, bestScore = Infinity, pinFail = false;
  for (let rs = 0; rs < 12 && bestScore > 4; rs++) {
    cls.forEach(ms => {
      let pool = [].concat(...DAY_COUNTS[ms[0].st].map((c, d) => new Array(c).fill(d)));
      const rest = [];
      ms.forEach(m => {
        if (m.pin === undefined) { rest.push(m); return; }
        const ix = pool.indexOf(m.pin);
        if (ix < 0) pinFail = true; else { pool.splice(ix, 1); m.day = m.pin; }
      });
      pool = shuffle(pool, rnd);
      rest.forEach((m, i) => { m.day = pool[i]; });
    });
    const C = TEAMS.map(() => [0, 0, 0]);
    matches.forEach(m => { C[m.a][m.day]++; C[m.b][m.day]++; });
    let total = 0;
    TEAMS.forEach(t => { total += pen(C[t.id], restr[t.id], t.id); });
    if (total < bestScore) { bestScore = total; bestDays = matches.map(m => m.day); }
    for (let it = 0; it < 3000 && total > 4; it++) {
      const ms = cls[Math.floor(rnd() * cls.length)];
      const x = ms[Math.floor(rnd() * ms.length)], y = ms[Math.floor(rnd() * ms.length)];
      if (x.day === y.day || x.pin !== undefined || y.pin !== undefined) continue;
      const ids = [x.a, x.b, y.a, y.b];
      let before = 0; ids.forEach(id => { before += pen(C[id], restr[id], id); });
      const swap = () => {
        C[x.a][x.day]--; C[x.b][x.day]--; C[y.a][y.day]--; C[y.b][y.day]--;
        const d = x.day; x.day = y.day; y.day = d;
        C[x.a][x.day]++; C[x.b][x.day]++; C[y.a][y.day]++; C[y.b][y.day]++;
      };
      swap();
      let after = 0; ids.forEach(id => { after += pen(C[id], restr[id], id); });
      if (after <= before || rnd() < 0.03) {
        total += after - before;
        if (total < bestScore) { bestScore = total; bestDays = matches.map(m => m.day); }
      } else swap();
    }
  }
  if (pinFail || bestScore >= 100) return false;
  matches.forEach((m, i) => { m.day = bestDays[i]; });
  return true;
}
function assignWithVariety(matches, restr, rnd) {
  if (!assignDays(matches, restr, rnd)) return false;
  const used = TEAMS.map(() => new Set());
  for (let j = 0; j < 3; j++) for (const st of ['SM', 'SA']) for (let d = 0; d < 3; d++) {
    const ms = matches.filter(m => m.j === j && m.st === st && m.day === d);
    const sl = SLOTS.filter(s => s.st === st && s.dayIdx === d);
    if (!fillClass(ms, sl, restr, rnd, used)) return false;
  }
  return true;
}

function satRepeats(matches) {
  const c = new Array(32).fill(0);
  matches.forEach(m => { if (m.day === 1) { c[m.a]++; c[m.b]++; } });
  return c.filter(x => x > 1).length;
}

function runDraw(seed, restr, variety) {
  if (variety === undefined) variety = true;
  const rnd = makeRng(seed);
  if (!variety) {
    for (let t = 0; t < 60; t++) {
      const matches = planStadiums(rnd, false);
      if (!matches) return null;
      if (assignSlots(matches, restr, rnd)) return { seed: String(seed), matches, variety };
    }
    return null;
  }
  /* Con variedad se prueban varios repartos y se queda el que menos repite sábado. */
  let best = null, bestScore = Infinity, wins = 0;
  for (let t = 0; t < 40 && bestScore > 1 && wins < 6; t++) {
    const matches = planStadiums(rnd, true);
    if (!matches) break;
    if (!assignWithVariety(matches, restr, rnd)) continue;
    wins++;
    const sc = satRepeats(matches);
    if (sc < bestScore) { bestScore = sc; best = matches; }
  }
  return best ? { seed: String(seed), matches: best, variety } : null;
}

/* Cuántos equipos juegan 0, 1, 2 o 3 veces cada día. */
function dayStats(res) {
  const C = TEAMS.map(() => [0, 0, 0]);
  res.matches.forEach(m => { C[m.a][m.slot.dayIdx]++; C[m.b][m.slot.dayIdx]++; });
  const table = [0, 1, 2].map(d => [0, 1, 2, 3].map(k => C.filter(c => c[d] === k).length));
  return { C, table };
}

function verify(res, restr, variety) {
  const M = res.matches;
  const checks = [];
  let a = 0;
  for (let j = 0; j < 3; j++) {
    const c = new Array(32).fill(0);
    M.filter(m => m.j === j).forEach(m => { c[m.a]++; c[m.b]++; });
    a += c.filter(x => x === 1).length;
  }
  checks.push({ t: 'Cada equipo juega una sola vez por fecha', got: a, of: 96 });
  let b = 0;
  for (let j = 0; j < 3; j++) b += new Set(M.filter(m => m.j === j).map(m => m.slot.id)).size;
  checks.push({ t: 'Cada horario se usa una sola vez por fecha', got: b, of: 48 });
  let rv = 0;
  TEAMS.forEach(t => { const rs = teamMatches(res, t.id).map(m => (m.a === t.id ? m.b : m.a)); if (new Set(rs).size === 3) rv++; });
  checks.push({ t: 'Cada equipo enfrenta a sus 3 rivales una sola vez', got: rv, of: 32 });
  let nr = 0;
  TEAMS.forEach(t => { const hs = teamMatches(res, t.id).map(m => hkey(m.slot)); if (new Set(hs).size === hs.length) nr++; });
  checks.push({ t: 'Nadie repite día y hora (aunque sea en el otro estadio)', got: nr, of: 32 });
  const sa = new Array(32).fill(0), sm = new Array(32).fill(0);
  M.forEach(m => { const k = m.st === 'SA' ? sa : sm; k[m.a]++; k[m.b]++; });
  const oro = TEAMS.filter(t => t.cup === 'Oro' && sm[t.id] === 2 && sa[t.id] === 1).length;
  checks.push({ t: 'Copa Oro: 2 partidos en San Miguel y 1 en Los Sauces', got: oro, of: 16 });
  const pl = TEAMS.filter(t => t.cup === 'Plata' && (sa[t.id] === 1 || sa[t.id] === 2)).length;
  const dbl = TEAMS.filter(t => t.cup === 'Plata' && sa[t.id] === 2).length;
  checks.push({ t: 'Copa Plata: 1 o 2 partidos en Los Sauces, nunca 0 ni 3', got: pl, of: 16, note: (16 - dbl) + ' equipos con 1 y ' + dbl + ' con 2' });
  let consec = 0;
  TEAMS.forEach(t => {
    const js = M.filter(m => m.st === 'SA' && (m.a === t.id || m.b === t.id)).map(m => m.j).sort();
    if (js.length > 1 && js[1] - js[0] === 1) consec++;
  });
  checks.push({ t: 'Nadie juega en Los Sauces dos fechas seguidas', got: 32 - consec, of: 32 });
  const rids = Object.keys(restr).map(Number);
  let rOk = 0;
  rids.forEach(id => {
    if (M.filter(m => m.a === id || m.b === id).every(m => allowed(restr[id], m.slot, m.j))) rOk++;
  });
  checks.push({ t: 'Las restricciones declaradas se respetan', got: rOk, of: rids.length });
  if (variety) {
    const st = dayStats(res);
    checks.push({ t: 'Copa Oro: cada equipo juega un viernes', got: TEAMS.filter(t => t.cup === 'Oro' && st.C[t.id][0] === 1).length, of: 16 });
    checks.push({ t: 'Copa Plata: viernes solo para los 5º y 6º de la tabla', got: TEAMS.filter(t => t.cup === 'Plata' && st.C[t.id][0] === (t.p < 2 ? 1 : 0)).length, of: 16, note: '8 equipos sin viernes: los 7º y 8º de la tabla' });
    checks.push({ t: 'Nadie juega sus 3 partidos en domingo', got: 32 - st.C.filter(c => c[2] === 3).length, of: 32 });
  }
  checks.forEach(c => { c.ok = c.got === c.of; });
  return checks;
}

function teamMatches(res, id) {
  return res.matches.filter(m => m.a === id || m.b === id).sort((x, y) => x.j - y.j);
}


/* Código de cada club: 3 primeras letras + puesto en la tabla. Si dos chocan, iniciales de cada palabra; si siguen chocando, 4 letras. */
const CODES = (() => {
  const clean = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const L = t => clean(t.name).replace(/[^A-Z]/g, '') + 'XXXX';
  const ini = t => clean(t.name).split(/[^A-Z0-9]+/).filter(Boolean).map(w => w[0]).join('');
  const base = TEAMS.map(t => L(t).slice(0, 3) + t.rank);
  const dup = (arr, i) => arr.filter(c => c === arr[i]).length > 1;
  const alt = TEAMS.map((t, i) => (dup(base, i) && ini(t).length > 1 ? ini(t) + t.rank : base[i]));
  return TEAMS.map((t, i) => (dup(alt, i) ? L(t).slice(0, 4) + t.rank : alt[i]));
})();
return { DAYS, ST_NAME, SLOTS, RESTR, RESTR_LONG, ORIG, TEAMS, DEFAULT_RESTR, CODES, tid, MATCHINGS, makeRng, shuffle, allowed, okMatch, runDraw, dayStats, verify, teamMatches, hkey, satRepeats };
}
const FECHA0 = 8;   /* la Fase 2 son las Fechas 8, 9 y 10 del torneo */
window.KCDraw = { create, FECHA0 };
})();
