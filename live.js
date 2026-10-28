// Partida ao vivo: 8 minutos ou 2 gols (o que vier primeiro), rodízio de times e lançamento automático da rodada.
// O estado fica no aparelho do master que está contando (sobrevive a fechar o app).
import * as C from './calc.js';

const LS = 'capelota:live';
export const MATCH_MS = 8 * 60 * 1000;
export const GOALS_TO_WIN = 2;

export function loadLive() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }
export function saveLive(l) { try { if (l) localStorage.setItem(LS, JSON.stringify(l)); else localStorage.removeItem(LS); } catch (e) {} }

// teams: [{ name, ids }]
export function newNight(teams, date) {
  return {
    date, teams: teams.map((t, i) => ({ name: t.name || ['Time A', 'Time B', 'Time C', 'Time D'][i], ids: [...t.ids] })),
    queue: teams.map((_, i) => i).slice(2), // quem espera, em ordem
    match: newMatch(0, 1, 1),
    history: []
  };
}

export function newMatch(a, b, n) {
  return { n, a, b, elapsed: 0, runningSince: null, events: [], ended: false };
}

export function elapsed(m) { return m.elapsed + (m.runningSince ? Date.now() - m.runningSince : 0); }
export function remaining(m) { return Math.max(0, MATCH_MS - elapsed(m)); }
export function fmtClock(ms) { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

export function score(m) {
  let a = 0, b = 0;
  m.events.forEach(e => { if (e.type === 'g') { if (e.team === m.a) a++; else b++; } });
  return [a, b];
}

export function toggleClock(l) {
  const m = l.match;
  if (m.runningSince) { m.elapsed += Date.now() - m.runningSince; m.runningSince = null; }
  else if (!m.ended) m.runningSince = Date.now();
}

export function pause(l) { const m = l.match; if (m.runningSince) { m.elapsed += Date.now() - m.runningSince; m.runningSince = null; } }

export function addEvent(l, ev) { l.match.events.push({ ...ev, at: elapsed(l.match) }); }
export function undo(l) { return l.match.events.pop(); }

// Fecha a partida. stay = índice do time que fica (necessário só no empate).
export function endMatch(l, stay) {
  const m = l.match; pause(l);
  const [ga, gb] = score(m);
  const winner = ga > gb ? m.a : gb > ga ? m.b : null;
  const keep = winner != null ? winner : stay;
  const leave = keep === m.a ? m.b : m.a;
  l.history.push({ n: m.n, a: m.a, b: m.b, ga, gb, winner, events: m.events, time: elapsed(m) });
  l.queue = l.queue.filter(i => i !== leave).concat(leave);
  l.stay = keep;
  l.match = null;
  return { winner, keep, leave, ga, gb };
}

// Próxima partida: quem ficou x primeiro da fila (ou o time escolhido)
export function nextMatch(l, opponent) {
  const keep = l.stay != null ? l.stay : 0;
  const opp = opponent != null ? opponent : l.queue[0];
  l.queue = l.queue.filter(i => i !== opp);
  l.match = newMatch(keep, opp, l.history.length + 1);
  return l.match;
}

// Soma a noite inteira em estatísticas por atleta (formato das rodadas do app)
export function nightEntries(l, posOf) {
  const E = {};
  const get = pid => E[pid] || (E[pid] = { p: 1 });
  const inc = (pid, f, v = 1) => { const e = get(pid); e[f] = (e[f] || 0) + v; };
  l.teams.forEach(t => t.ids.forEach(get));
  const wins = l.teams.map(() => 0);
  l.history.forEach(h => {
    const res = (ti, gf, gc) => {
      l.teams[ti].ids.forEach(pid => {
        if (posOf(pid) === 'G') { if (gc === 0) inc(pid, 'cs'); return; }
        inc(pid, gf > gc ? 'w' : gf === gc ? 'd' : 'l');
      });
    };
    res(h.a, h.ga, h.gb); res(h.b, h.gb, h.ga);
    if (h.winner != null) wins[h.winner]++;
    h.events.forEach(e => {
      if (e.type === 'g') { if (e.pid) inc(e.pid, 'g'); if (e.ast) inc(e.ast, 'a'); }
      if (e.type === 'y' && e.pid) inc(e.pid, 'y');
      if (e.type === 'r' && e.pid) inc(e.pid, 'r');
    });
  });
  const best = Math.max(0, ...wins);
  if (best > 0) wins.forEach((w, ti) => { if (w === best) l.teams[ti].ids.forEach(pid => { if (posOf(pid) !== 'G') inc(pid, 't'); }); });
  // limpa zeros
  Object.values(E).forEach(e => Object.keys(e).forEach(k => { if (!e[k]) delete e[k]; }));
  Object.values(E).forEach(e => { e.p = 1; });
  return { entries: E, wins };
}

export function teamWins(l) {
  const w = l.teams.map(() => 0);
  l.history.forEach(h => { if (h.winner != null) w[h.winner]++; });
  return w;
}

export { C };
