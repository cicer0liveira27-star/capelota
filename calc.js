// Cálculos de estatísticas, prêmios e sorteio.

export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const FIELDS = ['p', 'g', 'a', 'w', 'd', 'l', 't', 'y', 'r', 'cs'];

export function zero() {
  return { p: 0, g: 0, a: 0, w: 0, d: 0, l: 0, t: 0, y: 0, r: 0, cs: 0, art: 0, gar: 0, pts: 0 };
}

export function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function fmtDate(s, opts = {}) {
  const d = parseDate(s);
  const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0');
  return opts.year === false ? `${dd}/${mm}` : `${dd}/${mm}/${d.getFullYear()}`;
}
export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function lastTuesday(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diff = (d.getDay() - 2 + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}
export function nextGame(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0);
  let add = (2 - d.getDay() + 7) % 7;
  if (add === 0 && now.getHours() >= 22) add = 7;
  d.setDate(d.getDate() + add);
  return d;
}

export function inPeriod(dateStr, per) {
  if (!per || per.type === 'all') return true;
  const y = +dateStr.slice(0, 4), m = +dateStr.slice(5, 7);
  if (per.type === 'year') return y === per.y;
  if (per.type === 'month') return y === per.y && m === per.m;
  if (per.type === 'round') return dateStr === per.date;
  return true;
}

export function periodLabel(per) {
  if (per.type === 'all') return 'Desde o começo';
  if (per.type === 'year') return String(per.y);
  if (per.type === 'month') return `${MONTHS[per.m - 1]} ${per.y}`;
  if (per.type === 'round') return per.date ? `Rodada de ${fmtDate(per.date)}` : 'Nenhuma rodada';
  return '';
}

export function sortedRounds(rounds) { return [...rounds].sort((a, b) => b.date.localeCompare(a.date)); }

// Artilheiro(s) e garçom(ns) da noite: quem mais fez na rodada (empates dividem).
export function nightAwards(round) {
  if (round.summary) return { art: [], gar: [], maxG: 0, maxA: 0 };
  let mg = 0, ma = 0;
  const es = Object.entries(round.entries || {}).filter(([, e]) => e && e.p);
  es.forEach(([, e]) => { mg = Math.max(mg, e.g || 0); ma = Math.max(ma, e.a || 0); });
  return {
    art: mg > 0 ? es.filter(([, e]) => (e.g || 0) === mg).map(([id]) => id) : [],
    gar: ma > 0 ? es.filter(([, e]) => (e.a || 0) === ma).map(([id]) => id) : [],
    maxG: mg, maxA: ma
  };
}

export function points(t, pos, w) {
  if (pos === 'G') return t.cs * w.cleanSheet + t.g * w.goal + t.a * w.assist + t.p * w.presence + t.y * w.yellow + t.r * w.red;
  return t.g * w.goal + t.a * w.assist + t.w * w.win + t.d * w.draw + t.t * w.title + t.p * w.presence + t.y * w.yellow + t.r * w.red;
}

export function games(t) { return t.w + t.d + t.l; }
export function roundCount(rounds) { return rounds.reduce((s, r) => s + (r.summary ? (r.rounds || 1) : 1), 0); }

// Pontuação da planilha da Capelota:
// gols x 1100 / maior nº de gols + assist. x 850 / maior nº de assist. + aproveitamento x 1250 / melhor aproveitamento
// + títulos x 250 + presenças x 100. Os "maiores" são do próprio período.
// O melhor aproveitamento considera só quem foi a pelo menos metade das rodadas (como na planilha).
// Goleiro: soma também jogos sem sofrer gol x 1100 / maior nº de jogos sem sofrer gol.
// scale: divisores usados na planilha da Capelota para o período ({ g, a, ap }).
// Sem scale, usa o maior número de gols, de assistências e o melhor aproveitamento
// (arredondado em %, como na planilha) entre quem foi a pelo menos metade das rodadas.
function capelotaScores(totals, posOf, scale) {
  const L = Object.entries(totals);
  if (!L.length) return;
  const ap = t => games(t) ? (t.w * 3 + t.d) / (games(t) * 3) : 0;
  const maxG = scale?.g || Math.max(1, ...L.map(([, t]) => t.g));
  const maxA = scale?.a || Math.max(1, ...L.map(([, t]) => t.a));
  const maxCs = Math.max(1, ...L.map(([, t]) => t.cs));
  const maxP = Math.max(1, ...L.map(([, t]) => t.p));
  const thr = Math.ceil(maxP / 2);
  const regs = L.filter(([, t]) => t.p >= thr && games(t) > 0).map(([, t]) => ap(t));
  const maxAp = scale?.ap || Math.max(0.01, Math.round(Math.max(0, ...(regs.length ? regs : L.map(([, t]) => ap(t)))) * 100) / 100);
  const apOf = t => scale?.apRound ? Math.round(ap(t) * 100) / 100 : ap(t);
  for (const [pid, t] of L) {
    let v = t.g * 1100 / maxG + t.a * 850 / maxA + apOf(t) * 1250 / maxAp + t.t * 250 + t.p * 100;
    if (posOf[pid] === 'G') v += t.cs * 1100 / maxCs;
    t.pts = Math.round(v);
  }
}
export function winRate(t) { const n = games(t); return n ? Math.round(((t.w * 3 + t.d) / (n * 3)) * 100) : null; }

// Soma tudo no período. Retorna { totals: {pid: tot}, rounds: [...] }
export function aggregate(rounds, players, per, settings) {
  const w = settings.weights || settings;
  const scoring = settings.weights ? (settings.scoring || 'capelota') : 'pesos';
  const posOf = Object.fromEntries(players.map(p => [p.id, p.pos]));
  const totals = {};
  const list = sortedRounds(rounds.filter(r => inPeriod(r.date, per) && !(per && per.type === 'round' && r.summary)));
  for (const r of list) {
    const aw = nightAwards(r);
    for (const [pid, e] of Object.entries(r.entries || {})) {
      if (!e || !e.p) continue;
      const t = totals[pid] || (totals[pid] = zero());
      FIELDS.forEach(f => { t[f] += +(e[f] || 0); });
      if (aw.art.includes(pid)) t.art++;
      if (aw.gar.includes(pid)) t.gar++;
    }
  }
  let scale = null;
  if (per && per.type === 'month') scale = list.find(r => r.summary && r.scale)?.scale || null;
  else if (per && per.type === 'year') scale = settings.scales?.[per.y] || null;
  else if (per && per.type === 'all') { const ys = [...new Set(list.map(r => r.date.slice(0, 4)))]; if (ys.length === 1) scale = settings.scales?.[ys[0]] || null; }
  if (scoring === 'capelota') capelotaScores(totals, posOf, scale);
  else for (const [pid, t] of Object.entries(totals)) t.pts = points(t, posOf[pid] || 'L', w);
  return { totals, rounds: list, nRounds: roundCount(list) };
}

const byPts = (T) => (a, b) => (T[b.id].pts - T[a.id].pts) || (T[b.id].g - T[a.id].g) || (T[b.id].a - T[a.id].a) || (T[b.id].p - T[a.id].p) || a.name.localeCompare(b.name);

function topGroup(list, T, key) {
  if (!list.length) return [];
  const max = Math.max(...list.map(p => T[p.id][key]));
  if (max <= 0) return [];
  return list.filter(p => T[p.id][key] === max);
}

// Prêmios do mês: artilheiro, garçom, MVP, paredão (goleiro) e time ideal.
export function monthAwards(rounds, players, y, m, settings) {
  const { totals: T, rounds: rs, nRounds } = aggregate(rounds, players, { type: 'month', y, m }, settings);
  const played = players.filter(p => T[p.id] && T[p.id].p > 0);
  const line = played.filter(p => p.pos !== 'G').sort(byPts(T));
  const gks = played.filter(p => p.pos === 'G').sort((a, b) => (T[b.id].cs - T[a.id].cs) || byPts(T)(a, b));
  const all = [...played].sort(byPts(T));
  return {
    y, m, rounds: rs, nRounds, totals: T,
    artilheiro: topGroup(played, T, 'g'),
    garcom: topGroup(played, T, 'a'),
    mvp: all[0] || null,
    paredao: gks[0] || null,
    time: { gk: gks[0] || null, line: line.slice(0, Math.max(1, settings.perTeam || 5)) }
  };
}

export function monthsWithRounds(rounds) {
  const set = new Set(rounds.map(r => r.date.slice(0, 7)));
  return [...set].sort().reverse().map(s => ({ y: +s.slice(0, 4), m: +s.slice(5, 7) }));
}

// Conquistas de um atleta somando todos os meses.
export function playerTrophies(rounds, players, pid, settings) {
  const res = { mvp: 0, art: 0, gar: 0, sel: 0, paredao: 0 };
  for (const { y, m } of monthsWithRounds(rounds)) {
    const a = monthAwards(rounds, players, y, m, settings);
    if (a.mvp?.id === pid) res.mvp++;
    if (a.artilheiro.some(p => p.id === pid)) res.art++;
    if (a.garcom.some(p => p.id === pid)) res.gar++;
    if (a.paredao?.id === pid) res.paredao++;
    if (a.time.gk?.id === pid || a.time.line.some(p => p.id === pid)) res.sel++;
  }
  return res;
}

// ---------- sorteio ----------
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// players: [{id, pos, level}], nTeams; mode: 'equilibrado' | 'aleatorio'
export function drawTeams(players, nTeams, mode = 'equilibrado') {
  const teams = Array.from({ length: nTeams }, () => []);
  const gks = shuffle(players.filter(p => p.pos === 'G'));
  const line = players.filter(p => p.pos !== 'G');
  gks.forEach((p, i) => teams[i % nTeams].push(p));

  if (mode === 'aleatorio') {
    const sh = shuffle(line);
    // completa primeiro os times com menos gente
    sh.forEach(p => { teams.sort((a, b) => a.length - b.length); teams[0].push(p); });
    return shuffle(teams);
  }

  const lvl = p => (p.level || 3) + Math.random() * 0.6;
  const sorted = [...line].sort((a, b) => lvl(b) - lvl(a));
  const lineTeams = Array.from({ length: nTeams }, () => []);
  // distribuição em "cobra": 1-2-3-3-2-1...
  sorted.forEach((p, i) => {
    const round = Math.floor(i / nTeams), k = i % nTeams;
    lineTeams[round % 2 === 0 ? k : nTeams - 1 - k].push(p);
  });
  const sum = t => t.reduce((s, p) => s + (p.level || 3), 0);
  // ajuste fino: trocas aleatórias que diminuem a diferença de força
  const spread = () => { const s = lineTeams.map(sum); return Math.max(...s) - Math.min(...s); };
  for (let it = 0; it < 300 && nTeams > 1; it++) {
    const i = Math.floor(Math.random() * nTeams); let j = Math.floor(Math.random() * nTeams);
    if (i === j || !lineTeams[i].length || !lineTeams[j].length) continue;
    const a = Math.floor(Math.random() * lineTeams[i].length), b = Math.floor(Math.random() * lineTeams[j].length);
    const before = spread();
    [lineTeams[i][a], lineTeams[j][b]] = [lineTeams[j][b], lineTeams[i][a]];
    if (spread() > before) [lineTeams[i][a], lineTeams[j][b]] = [lineTeams[j][b], lineTeams[i][a]];
  }
  // o time com goleiro mais fraco recebe a linha mais forte
  const order = teams.map((t, i) => ({ i, g: sum(t) })).sort((a, b) => a.g - b.g);
  const lineOrder = lineTeams.map((t, i) => ({ i, s: sum(t) })).sort((a, b) => b.s - a.s);
  order.forEach((o, k) => teams[o.i].push(...lineTeams[lineOrder[k].i]));
  return shuffle(teams);
}
