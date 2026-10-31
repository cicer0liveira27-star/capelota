// Partida ao vivo: 8 minutos ou 2 gols (o que vier primeiro), rodízio de times e lançamento automático da rodada.
// Regras da Capelota:
//  - quem vence fica; quem perde vai para o fim da fila
//  - empate: as duas equipes saem; na volta, joga primeiro quem tiver menos partidas disputadas
//  - cartão azul: 2 minutos fora; amarelo: continua; vermelho: fora até o fim da partida (volta no outro jogo)
//  - goleiros ficam soltos: a cada partida escolhe-se quem está no gol de cada time
// O estado fica no aparelho do master que está contando e é publicado no banco para todo mundo acompanhar.
import * as C from './calc.js';

const LS = 'capelota:live';
export const MATCH_MS = 8 * 60 * 1000;
export const GOALS_TO_WIN = 2;
export const BLUE_MS = 2 * 60 * 1000;

let publisher = null;
export function setPublisher(fn) { publisher = fn; }

export function loadLive() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }
export function saveLive(l) {
  try { if (l) localStorage.setItem(LS, JSON.stringify(l)); else localStorage.removeItem(LS); } catch (e) {}
  try { publisher?.(l); } catch (e) {}
}

// teams: [{ name, ids }]; gks: ids dos goleiros soltos
export function newNight(teams, date, gks = []) {
  const l = {
    id: 'n-' + Date.now().toString(36),
    date, teams: teams.map((t, i) => ({ name: t.name || ['Time A', 'Time B', 'Time C', 'Time D'][i], ids: [...t.ids] })),
    gks: [...gks],
    queue: teams.map((_, i) => i).slice(2), // quem espera, em ordem
    match: null,
    history: []
  };
  l.match = newMatch(0, 1, 1, gks[0] || null, gks[1] || null);
  return l;
}

export function newMatch(a, b, n, gkA = null, gkB = null) {
  return { n, a, b, gkA, gkB, elapsed: 0, runningSince: null, events: [], ended: false };
}

export function elapsed(m) { return m.elapsed + (m.runningSince ? Date.now() - m.runningSince : 0); }
export function remaining(m) { return Math.max(0, MATCH_MS - elapsed(m)); }
export function fmtClock(ms) { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

export function score(m) {
  let a = 0, b = 0;
  m.events.forEach(e => { if (e.type === 'g') { if (e.team === m.a) a++; else b++; } });
  return [a, b];
}

// Quem está fora agora: azul (2 min) e vermelho (até o fim da partida)
export function suspended(m) {
  const now = elapsed(m), out = [];
  m.events.forEach(e => {
    if (e.type === 'r') out.push({ pid: e.pid, team: e.team, kind: 'r', left: null });
    if (e.type === 'b' && now - (e.at || 0) < BLUE_MS) out.push({ pid: e.pid, team: e.team, kind: 'b', left: BLUE_MS - (now - (e.at || 0)) });
  });
  return out;
}

export function toggleClock(l) {
  const m = l.match;
  if (m.runningSince) { m.elapsed += Date.now() - m.runningSince; m.runningSince = null; }
  else if (!m.ended) m.runningSince = Date.now();
}

export function pause(l) { const m = l.match; if (m.runningSince) { m.elapsed += Date.now() - m.runningSince; m.runningSince = null; } }

export function addEvent(l, ev) { l.match.events.push({ ...ev, at: elapsed(l.match) }); }
export function undo(l) { return l.match.events.pop(); }

// Partidas disputadas por cada time na noite
export function playedCount(l) {
  const c = l.teams.map(() => 0);
  l.history.forEach(h => { c[h.a]++; c[h.b]++; });
  return c;
}

// Fecha a partida. Vitória: vencedor fica, perdedor vai para o fim da fila.
// Empate: os dois saem e voltam para a fila, primeiro quem jogou menos.
export function endMatch(l) {
  const m = l.match; pause(l);
  const [ga, gb] = score(m);
  const winner = ga > gb ? m.a : gb > ga ? m.b : null;
  l.history.push({ n: m.n, a: m.a, b: m.b, ga, gb, winner, gkA: m.gkA || null, gkB: m.gkB || null, events: m.events, time: elapsed(m) });
  if (winner != null) {
    const leave = winner === m.a ? m.b : m.a;
    l.queue = l.queue.filter(i => i !== leave).concat(leave);
    l.stay = winner;
  } else {
    const pc = playedCount(l);
    const back = [m.a, m.b].sort((x, y) => pc[x] - pc[y] || x - y);
    l.queue = l.queue.filter(i => i !== m.a && i !== m.b).concat(back);
    l.stay = null;
  }
  l.lastGk = { [m.a]: m.gkA || null, [m.b]: m.gkB || null };
  l.match = null;
  return { winner, ga, gb };
}

// Próximo confronto sugerido: [time A, time B]
export function nextPair(l) {
  if (l.stay != null) return [l.stay, l.queue[0]];
  return [l.queue[0], l.queue[1]];
}

// Próxima partida. opp: adversário escolhido (opcional).
// Goleiros: quem estava no gol do time que ficou continua com ele; o outro vai para o time que entra.
export function nextMatch(l, opp) {
  let [a, b] = nextPair(l);
  if (opp != null && opp !== a) b = opp;
  l.queue = l.queue.filter(i => i !== a && i !== b);
  const prev = l.lastGk || {};
  const gks = l.gks || [];
  let gkA = prev[a] || null, gkB = prev[b] || null;
  const used = new Set([gkA, gkB].filter(Boolean));
  const free = gks.filter(g => !used.has(g));
  if (!gkA) gkA = free.shift() || null;
  if (!gkB) gkB = free.shift() || null;
  if (gkA && gkA === gkB) gkB = free.shift() || null;
  l.match = newMatch(a, b, l.history.length + 1, gkA, gkB);
  l.stay = null;
  return l.match;
}

// Soma a noite inteira em estatísticas por atleta (formato das rodadas do app)
export function nightEntries(l, posOf) {
  const E = {};
  const get = pid => E[pid] || (E[pid] = { p: 1 });
  const inc = (pid, f, v = 1) => { const e = get(pid); e[f] = (e[f] || 0) + v; };
  l.teams.forEach(t => t.ids.forEach(get));
  (l.gks || []).forEach(get);
  const wins = l.teams.map(() => 0);
  l.history.forEach(h => {
    const res = (ti, gf, gc, gk) => {
      l.teams[ti].ids.forEach(pid => {
        if (posOf(pid) === 'G') { if (!gk) { inc(pid, 'mj'); inc(pid, 'gc', gc); if (gc === 0) inc(pid, 'cs'); } return; }
        inc(pid, gf > gc ? 'w' : gf === gc ? 'd' : 'l');
      });
      // goleiro solto que estava no gol desse time
      if (gk) { inc(gk, 'mj'); inc(gk, 'gc', gc); if (gc === 0) inc(gk, 'cs'); }
    };
    res(h.a, h.ga, h.gb, h.gkA); res(h.b, h.gb, h.ga, h.gkB);
    if (h.winner != null) wins[h.winner]++;
    h.events.forEach(e => {
      if (e.type === 'g') { if (e.pid) inc(e.pid, 'g'); if (e.ast) inc(e.ast, 'a'); }
      if (e.type === 'y' && e.pid) inc(e.pid, 'y');
      if (e.type === 'r' && e.pid) inc(e.pid, 'r');
      if (e.type === 'b' && e.pid) inc(e.pid, 'b');
    });
  });
  const best = Math.max(0, ...wins);
  if (best > 0) wins.forEach((w, ti) => { if (w === best) l.teams[ti].ids.forEach(pid => { if (posOf(pid) !== 'G') inc(pid, 't'); }); });
  // limpa zeros (menos gols sofridos de goleiro que jogou)
  Object.values(E).forEach(e => Object.keys(e).forEach(k => { if (!e[k] && !(k === 'gc' && e.mj)) delete e[k]; }));
  Object.values(E).forEach(e => { e.p = 1; });
  return { entries: E, wins };
}

export function teamWins(l) {
  const w = l.teams.map(() => 0);
  l.history.forEach(h => { if (h.winner != null) w[h.winner]++; });
  return w;
}

export { C };
