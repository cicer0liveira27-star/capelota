// Partida ao vivo: 8 minutos ou 2 gols (o que vier primeiro), rodízio de times e lançamento automático da rodada.
// Regras da Capelota:
//  - a comissão escolhe livremente quais times jogam cada partida (o app só sugere: quem vence fica)
//  - antes do primeiro jogo de cada time, confirma-se se o time está completo; se faltar alguém,
//    entra um jogador de um time que está de fora, e gols/assistências contam para quem fez
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
    queue: teams.map((_, i) => i), // ordem sugerida
    match: null,
    history: []
  };
  l.teams.forEach(t => { t.absent = []; t.confirmed = false; });
  return l;
}

export function newMatch(a, b, n, gkA = null, gkB = null, lineups = {}) {
  return { n, a, b, gkA, gkB, lineups, elapsed: 0, runningSince: null, events: [], ended: false };
}

// Escalação padrão de um time: o elenco menos quem está marcado como ausente
export function defaultLineup(l, ti) { const t = l.teams[ti]; return t.ids.filter(id => !(t.absent || []).includes(id)); }
// Quem está escalado por um time na partida em andamento
export function lineupOf(l, ti) { const m = l.match; return (m && m.lineups && m.lineups[ti]) || defaultLineup(l, ti); }

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
  l.history.push({ n: m.n, a: m.a, b: m.b, ga, gb, winner, gkA: m.gkA || null, gkB: m.gkB || null, lineups: { [m.a]: lineupOf(l, m.a), [m.b]: lineupOf(l, m.b) }, events: m.events, time: elapsed(m) });
  // fila só para sugerir o próximo jogo: quem jogou vai para o fim (o vencedor fica)
  const out = winner != null ? [winner === m.a ? m.b : m.a] : [m.a, m.b];
  l.queue = l.queue.filter(i => !out.includes(i) && i !== winner).concat(out);
  l.stay = winner;
  l.lastGk = { [m.a]: m.gkA || null, [m.b]: m.gkB || null };
  l.match = null;
  return { winner, ga, gb };
}

// Sugestão do próximo confronto (a comissão pode trocar à vontade): [time A, time B]
export function nextPair(l) {
  if (!l.history.length) return [0, 1];
  const waiting = l.queue.filter(i => i !== l.stay);
  if (l.stay != null) return [l.stay, waiting[0]];
  return [waiting[0], waiting[1]];
}

// Começa a partida entre os times a e b
// Goleiros: quem estava no gol de um time continua com ele; os outros vão para quem entra.
export function startMatch(l, a, b) {
  // o vencedor que não for escalado agora volta para a frente da fila
  if (l.stay != null && l.stay !== a && l.stay !== b && !l.queue.includes(l.stay)) l.queue.unshift(l.stay);
  l.queue = l.queue.filter(i => i !== a && i !== b);
  const prev = l.lastGk || {};
  const gks = l.gks || [];
  let gkA = prev[a] || null, gkB = prev[b] || null;
  const used = new Set([gkA, gkB].filter(Boolean));
  const free = gks.filter(g => !used.has(g));
  if (!gkA) gkA = free.shift() || null;
  if (!gkB) gkB = free.shift() || null;
  if (gkA && gkA === gkB) gkB = free.shift() || null;
  l.match = newMatch(a, b, l.history.length + 1, gkA, gkB, { [a]: defaultLineup(l, a), [b]: defaultLineup(l, b) });
  l.stay = null;
  return l.match;
}
export function nextMatch(l, opp) { const [a, b] = nextPair(l); return startMatch(l, a, opp != null && opp !== a ? opp : b); }

// Soma a noite inteira em estatísticas por atleta (formato das rodadas do app)
export function nightEntries(l, posOf) {
  const E = {};
  const get = pid => E[pid] || (E[pid] = { p: 1 });
  const inc = (pid, f, v = 1) => { const e = get(pid); e[f] = (e[f] || 0) + v; };
  // presença: quem entrou em campo em alguma partida (ou o elenco, em noites sem escalação registrada)
  const hasLineups = l.history.some(h => h.lineups);
  if (hasLineups) l.history.forEach(h => Object.values(h.lineups || {}).forEach(ids => ids.forEach(get)));
  else l.teams.forEach(t => t.ids.forEach(get));
  (l.gks || []).forEach(get);
  const wins = l.teams.map(() => 0);
  l.history.forEach(h => {
    const res = (ti, gf, gc, gk) => {
      ((h.lineups && h.lineups[ti]) || l.teams[ti].ids).forEach(pid => {
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
  // título: primeiro da classificação (pontos, saldo, gols feitos)
  const st = standings(l), top = st[0];
  if (top && top.pts > 0) st.filter(t => t.pts === top.pts && t.sg === top.sg && t.gf === top.gf).forEach(t => l.teams[t.i].ids.forEach(pid => { if (posOf(pid) !== 'G' && E[pid]) inc(pid, 't'); }));
  // limpa zeros (menos gols sofridos de goleiro que jogou)
  Object.values(E).forEach(e => Object.keys(e).forEach(k => { if (!e[k] && !(k === 'gc' && e.mj)) delete e[k]; }));
  Object.values(E).forEach(e => { e.p = 1; });
  return { entries: E, wins };
}

// Classificação da noite: vitória 3, empate 1, derrota 0. Desempate: saldo de gols, depois gols feitos.
export function standings(l) {
  const T = l.teams.map((t, i) => ({ i, j: 0, v: 0, e: 0, d: 0, pts: 0, gf: 0, gs: 0, sg: 0 }));
  l.history.forEach(h => {
    const add = (ti, gf, gs) => { const t = T[ti]; t.j++; t.gf += gf; t.gs += gs; if (gf > gs) { t.v++; t.pts += 3; } else if (gf === gs) { t.e++; t.pts += 1; } else t.d++; };
    add(h.a, h.ga, h.gb); add(h.b, h.gb, h.ga);
  });
  T.forEach(t => { t.sg = t.gf - t.gs; });
  return T.sort((x, y) => (y.pts - x.pts) || (y.sg - x.sg) || (y.gf - x.gf) || (x.i - y.i));
}

// Destaques ao vivo (partidas encerradas + a que está rolando): artilheiro, garçom e goleiro menos vazado
export function liveLeaders(l) {
  const g = {}, a = {}, gk = {};
  const matches = [...l.history, ...(l.match ? [{ ...l.match, ga: score(l.match)[0], gb: score(l.match)[1], gkA: l.match.gkA, gkB: l.match.gkB, live: true }] : [])];
  matches.forEach(h => {
    (h.events || []).forEach(e => { if (e.type === 'g') { if (e.pid) g[e.pid] = (g[e.pid] || 0) + 1; if (e.ast) a[e.ast] = (a[e.ast] || 0) + 1; } });
    const add = (id, gc) => { if (!id) return; const x = gk[id] || (gk[id] = { id, mj: 0, gc: 0, cs: 0 }); x.mj++; x.gc += gc; if (!gc && !h.live) x.cs++; };
    if (!h.live || h.events?.length || h.elapsed || h.runningSince) { add(h.gkA, h.gb); add(h.gkB, h.ga); }
  });
  const top = o => { const max = Math.max(0, ...Object.values(o)); return max ? { v: max, ids: Object.keys(o).filter(k => o[k] === max) } : { v: 0, ids: [] }; };
  const gks = Object.values(gk);
  const maxMj = Math.max(0, ...gks.map(x => x.mj));
  const ok = gks.filter(x => x.mj >= Math.ceil(maxMj / 2)).sort((x, y) => (x.gc - y.gc) || (y.cs - x.cs) || (y.mj - x.mj));
  const best = ok[0] ? ok.filter(x => x.gc === ok[0].gc && x.cs === ok[0].cs && x.mj === ok[0].mj) : [];
  return { art: top(g), gar: top(a), gk: best.length ? { ids: best.map(x => x.id), gc: best[0].gc, mj: best[0].mj } : { ids: [], gc: 0, mj: 0 } };
}

export function teamWins(l) {
  const w = l.teams.map(() => 0);
  l.history.forEach(h => { if (h.winner != null) w[h.winner]++; });
  return w;
}

export { C };
