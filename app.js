import { store, onlyDigits, validCpf, maskCpfEnd } from './store.js';
import * as C from './calc.js';

// ================= utilidades =================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view');
const sheetRoot = $('#sheet');
const now = () => new Date();
const thisY = () => now().getFullYear();
const thisM = () => now().getMonth() + 1;

const I = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  trophy: '<svg class="ico" viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  ball: '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10z"/><path d="M12 3v4M16 10l4.5-1.5M14.5 14.5 17 19M9.5 14.5 7 19M8 10 3.5 8.5"/></svg>',
  pass: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 17c4-8 10-10 16-10"/><path d="M16 4l4 3-3 4"/><circle cx="5" cy="18" r="2"/></svg>',
  star: '<svg class="ico" viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>',
  glove: '<svg class="ico" viewBox="0 0 24 24"><path d="M7 21v-5l-3-4V8a1.5 1.5 0 0 1 3 0v3M7 8V4.5a1.5 1.5 0 0 1 3 0V10M10 4a1.5 1.5 0 0 1 3 0v6M13 5a1.5 1.5 0 0 1 3 0v6l1-1.5a1.6 1.6 0 0 1 2.7 1.7L17 16v5"/></svg>',
  share: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  edit: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/></svg>',
  person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4.2"/><path d="M3.5 22c1-5 4.5-7.5 8.5-7.5s7.5 2.5 8.5 7.5z"/></svg>',
  shuffle: '<svg class="ico" viewBox="0 0 24 24"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  whats: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.8z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8c-1-.4-1.9-1.3-2.3-2.3l.8-1-1-2z"/></svg>'
};

const STAT_L = [
  { k: 'pts', l: 'Pontos' }, { k: 'g', l: 'Gols' }, { k: 'a', l: 'Assistências' }, { k: 'p', l: 'Presenças' },
  { k: 'w', l: 'Vitórias' }, { k: 'd', l: 'Empates' }, { k: 'l', l: 'Derrotas' }, { k: 't', l: 'Títulos' },
  { k: 'wr', l: 'Aproveitamento' }, { k: 'art', l: 'Artilheiro da noite' }, { k: 'gar', l: 'Garçom da noite' }, { k: 'cards', l: 'Cartões' }
];
const STAT_G = [
  { k: 'pts', l: 'Pontos' }, { k: 'cs', l: 'Sem sofrer gol' }, { k: 'p', l: 'Presenças' }, { k: 'g', l: 'Gols' }, { k: 'a', l: 'Assistências' }
];
const TEAM_COLORS = ['#d63050', '#8fb3d9', '#f2ece0', '#3c8ea6'];
const TEAM_NAMES = ['Time A', 'Time B', 'Time C', 'Time D'];
const TEAM_EMOJI = ['🔴', '🔵', '⚪', '🟢'];

function statVal(t, k) {
  if (!t) return 0;
  if (k === 'wr') return C.winRate(t) ?? -1;
  if (k === 'cards') return t.y + t.r * 2;
  return t[k] || 0;
}
function statShow(t, k) {
  if (k === 'wr') { const v = C.winRate(t); return v == null ? '–' : `${v}<small>%</small>`; }
  if (k === 'cards') return `<span class="card-y"></span>${t.y} <span class="card-r"></span>${t.r}`;
  return String(t[k] || 0);
}

const playerById = id => store.players.find(p => p.id === id);
const dn = p => p ? (p.nick || p.name) : 'Atleta removido';
const initials = p => {
  const n = dn(p).trim().split(/\s+/);
  return ((n[0]?.[0] || '?') + (n.length > 1 ? n[n.length - 1][0] : '')).toUpperCase();
};
const colorClass = id => 'c' + ((String(id).split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 4) + 1);

function avatar(p, size = '') {
  if (!p) return `<span class="av ${size} c1">?</span>`;
  if (p.photo) return `<span class="av ${size}"><img src="${p.photo}" alt="" loading="lazy"></span>`;
  return `<span class="av ${size} ${colorClass(p.id)}">${esc(initials(p))}</span>`;
}

function figurinha(p, opts = {}) {
  const t = opts.totals;
  const tag = p.pos === 'G' ? 'Goleiro' : 'Linha';
  const photo = p.photo
    ? `<img src="${p.photo}" alt="Foto de ${esc(dn(p))}" loading="lazy">`
    : `<span class="ini">${I.person}</span>`;
  const stats = t ? (p.pos === 'G'
    ? `<span><b>${t.cs}</b> sem sofrer</span><span><b>${t.p}</b> jogos</span>`
    : `<span><b>${t.g}</b> gols</span><span><b>${t.a}</b> assist.</span>`) : '';
  const inner = `
    <div class="ph">${photo}${p.num ? `<span class="shirt">${esc(p.num)}</span>` : ''}<span class="tag">${tag}</span></div>
    <div class="band"><div class="n">${esc(dn(p))}</div>${stats ? `<div class="s">${stats}</div>` : (p.nick && opts.full ? `<div class="s">${esc(p.name)}</div>` : '')}</div>`;
  if (opts.link === false) return `<div class="fig ${p.active === false ? 'off' : ''}">${inner}</div>`;
  return `<a class="fig ${p.active === false ? 'off' : ''}" href="#/atleta/${esc(p.id)}">${inner}</a>`;
}

let toastTimer;
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast' + (err ? ' err' : ''); }, err ? 4200 : 2600);
}
window.addEventListener('capelota:error', e => toast(e.detail, true));

// ================= estado =================
function loadLS(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }
const drawSaved = loadLS('capelota:draw', {});
const state = {
  pers: {
    dash: { type: 'month', y: thisY(), m: thisM(), date: null },
    rank: { type: 'month', y: thisY(), m: thisM(), date: null },
    prof: { type: 'year', y: thisY(), m: thisM(), date: null }
  },
  rankGroup: 'L', rankStat: 'pts',
  albumFilter: 'all', search: '',
  awards: null,
  draw: { sel: new Set(drawSaved.sel || []), n: drawSaved.n || 2, mode: drawSaved.mode || 'equilibrado', result: null, animate: false },
  editor: null,
  installPrompt: null,
  firstDataRender: false
};
function saveDraw() { localStorage.setItem('capelota:draw', JSON.stringify({ sel: [...state.draw.sel], n: state.draw.n, mode: state.draw.mode })); }

// ================= roteador =================
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, ...rest] = h.split('/');
  return { name: name || 'inicio', arg: rest.join('/') ? decodeURIComponent(rest.join('/')) : null };
}

// Torcedor (sem login): só times sorteados, ranking e craque/time ideal. Masters veem tudo.
const PUBLIC_ROUTES = ['sorteio', 'ranking', 'premios', 'ajustes'];
const TABS_MASTER = [['inicio', 'Início', 'home'], ['ranking', 'Ranking', 'rank'], ['atletas', 'Atletas', 'cards'], ['sorteio', 'Sorteio', 'shuffle'], ['premios', 'Prêmios', 'trophy']];
const TABS_PUBLIC = [['sorteio', 'Times', 'shirt'], ['ranking', 'Ranking', 'rank'], ['premios', 'Craque do mês', 'trophy']];
const TAB_ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  rank: '<path d="M4 21V11M10 21V4M16 21v-7M22 21H2"/>',
  cards: '<rect x="4" y="3" width="11" height="15" rx="1.5"/><path d="M9 21h10a1 1 0 0 0 1-1V7"/><circle cx="9.5" cy="9" r="2.3"/><path d="M6.5 15c.6-1.8 1.7-2.6 3-2.6s2.4.8 3 2.6"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  shirt: '<path d="M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3c-.5 1.7-2 3-4 3s-3.5-1.3-4-3Z"/>'
};
let tabsFor = null;
function drawTabs() {
  const M = store.isMaster;
  if (tabsFor === M) return;
  tabsFor = M;
  const tabs = M ? TABS_MASTER : TABS_PUBLIC;
  const nav = $('.tabbar');
  nav.style.gridTemplateColumns = `repeat(${tabs.length}, 1fr)`;
  nav.innerHTML = tabs.map(([k, l, ic]) => `<a href="#/${k}" data-tab="${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${TAB_ICONS[ic]}</svg><span>${l}</span></a>`).join('');
  $('.brand').setAttribute('href', M ? '#/inicio' : '#/sorteio');
}

function render() {
  let r = route();
  drawTabs();
  if (!store.isMaster && !PUBLIC_ROUTES.includes(r.name)) {
    history.replaceState(null, '', '#/sorteio'); r = route();
  }
  const tab = { inicio: 'inicio', rodada: 'inicio', lancar: 'inicio', ranking: 'ranking', atletas: 'atletas', atleta: 'atletas', sorteio: 'sorteio', premios: 'premios' }[r.name];
  $$('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  const chip = $('#masterChip');
  chip.hidden = !store.isMaster;
  chip.textContent = store.isMaster ? `Master${store.user?.name ? ': ' + store.user.name : ''}` : '';

  if (!store.ready) {
    view.innerHTML = `<div class="boot"><img src="icons/logo-256.png" alt="" width="120"><p>Carregando a resenha…</p></div>`;
    return;
  }
  view.classList.remove('has-savebar');
  const views = { inicio: vInicio, ranking: vRanking, atletas: vAtletas, atleta: vAtleta, sorteio: vSorteio, premios: vPremios, ajustes: vAjustes, rodada: vRodada, lancar: vLancar };
  const fn = views[r.name] || vInicio;
  view.innerHTML = fn(r.arg);
}

let lastRoute = '';
window.addEventListener('hashchange', () => {
  const r = location.hash;
  if (!r.startsWith('#/lancar')) state.editor = null;
  render();
  if (r !== lastRoute) { window.scrollTo(0, 0); lastRoute = r; }
});

// na primeira carga: se o mês atual ainda não tem rodada, abre o painel no mês da última rodada
function firstData() {
  if (state.firstDataRender || !store.ready) return;
  state.firstDataRender = true;
  const last = C.sortedRounds(store.rounds)[0];
  if (last && !store.rounds.some(r => C.inPeriod(r.date, { type: 'month', y: thisY(), m: thisM() }))) {
    const y = +last.date.slice(0, 4), m = +last.date.slice(5, 7);
    Object.assign(state.pers.dash, { y, m }); Object.assign(state.pers.rank, { y, m });
  }
}

store.subscribe(() => {
  firstData();
  const r = route();
  // não redesenha o editor enquanto alguém está lançando a rodada
  if (r.name === 'lancar' && state.editor) {
    const chip = $('#masterChip'); chip.hidden = !store.isMaster;
    return;
  }
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
});

// ================= período =================
function roundDates() { return C.sortedRounds(store.rounds.filter(r => !r.summary)).map(r => r.date); }
const realRounds = () => store.rounds.filter(r => !r.summary);
const roundById = id => store.rounds.find(r => r.id === id) || store.rounds.find(r => r.date === id && !r.summary);
const roundLabel = r => r.summary ? `${C.MONTHS[+r.date.slice(5, 7) - 1]} (resumo)` : C.fmtDate(r.date, { year: false });

function periodBar(key, types = ['round', 'month', 'year', 'all']) {
  const per = state.pers[key];
  const names = { round: 'Rodada', month: 'Mês', year: 'Ano', all: 'Geral' };
  const seg = `<div class="seg" role="tablist">${types.map(t => `<button role="tab" aria-selected="${per.type === t}" class="${per.type === t ? 'on' : ''}" data-act="per-type" data-key="${key}" data-type="${t}">${names[t]}</button>`).join('')}</div>`;
  let prevOff = false, nextOff = false;
  if (per.type === 'round') {
    const ds = roundDates(); const i = ds.indexOf(per.date);
    prevOff = i < 0 || i >= ds.length - 1; nextOff = i <= 0;
  } else if (per.type === 'month') {
    nextOff = per.y > thisY() || (per.y === thisY() && per.m >= thisM());
  } else if (per.type === 'year') {
    nextOff = per.y >= thisY();
  }
  const nav = per.type === 'all' ? '' : `
    <div class="stepnav">
      <button aria-label="Anterior" data-act="per-step" data-key="${key}" data-d="-1" ${prevOff ? 'disabled' : ''}>${I.prev}</button>
      <div class="lbl">${esc(C.periodLabel(per).replace('Rodada de ', ''))}</div>
      <button aria-label="Próximo" data-act="per-step" data-key="${key}" data-d="1" ${nextOff ? 'disabled' : ''}>${I.next}</button>
    </div>`;
  return `<div class="period">${seg}${nav}</div>`;
}

function setPerType(key, type) {
  const per = state.pers[key];
  per.type = type;
  if (type === 'round' && (!per.date || !store.rounds.some(r => r.date === per.date))) per.date = roundDates()[0] || null;
  if (type === 'month' && per.date) { per.y = +per.date.slice(0, 4); per.m = +per.date.slice(5, 7); }
}
function stepPer(key, d) {
  const per = state.pers[key];
  if (per.type === 'round') {
    const ds = roundDates(); const i = ds.indexOf(per.date);
    const j = i - d; if (ds[j]) per.date = ds[j];
  } else if (per.type === 'month') {
    let m = per.m + d, y = per.y; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    per.m = m; per.y = y;
  } else if (per.type === 'year') per.y += d;
}

// ================= INÍCIO =================
function heroHTML() {
  const n = now(), ng = C.nextGame(n);
  const isTue = n.getDay() === 2;
  let when, count, live = false;
  if (isTue && n.getHours() >= 19 && n.getHours() < 22) {
    when = 'Bola rolando'; count = 'Terça de Capelota, agora'; live = true;
  } else if (isTue && n.getHours() < 19) {
    const mins = Math.round((ng - n) / 60000);
    when = 'Hoje tem Capelota'; count = `Começa em ${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
  } else {
    const days = Math.ceil((new Date(ng.getFullYear(), ng.getMonth(), ng.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
    when = `Terça, ${String(ng.getDate()).padStart(2, '0')}/${String(ng.getMonth() + 1).padStart(2, '0')}`;
    count = days === 1 ? 'É amanhã' : `Faltam ${days} dias`;
  }
  return `<section class="hero ${live ? 'live' : ''}" aria-label="Próxima pelada">
    <div class="hero-grid">
      <div><div class="when">${when}<small>${live ? 'Até as 22h' : '19h, como sempre'}</small></div>
      <span class="count" id="heroCount"><i></i>${count}</span></div>
      <img src="icons/logo-256.png" alt="Logo da Capelota">
    </div>
  </section>`;
}

function hlCard(label, icon, players, value, unit, extra = '') {
  if (!players || !players.length) {
    return `<div class="hl empty ${extra}"><div class="lbl">${icon}${label}</div><div class="who">Ninguém ainda</div></div>`;
  }
  const list = players.slice(0, 3);
  const names = players.length > 2 ? `${esc(dn(players[0]))} e mais ${players.length - 1}` : players.map(p => esc(dn(p))).join(' e ');
  const href = players.length === 1 ? `href="#/atleta/${esc(players[0].id)}"` : '';
  const tag = href ? 'a' : 'div';
  return `<${tag} class="hl ${extra}" ${href}>
    <div class="lbl">${icon}${label}</div>
    <div class="val">${value}<small>${unit}</small></div>
    <div class="who"><span class="stack">${list.map(p => avatar(p, 's')).join('')}</span><span class="nm">${names}</span></div>
  </${tag}>`;
}

function leaders(T, key, filter = () => true) {
  const ps = store.players.filter(p => T[p.id] && filter(p));
  if (!ps.length) return { list: [], v: 0 };
  const max = Math.max(...ps.map(p => statVal(T[p.id], key)));
  if (max <= 0) return { list: [], v: 0 };
  return { list: ps.filter(p => statVal(T[p.id], key) === max), v: max };
}

function vInicio() {
  const per = state.pers.dash;
  if (per.type === 'round' && !per.date) per.date = roundDates()[0] || null;
  const { totals: T, rounds, nRounds: nR } = C.aggregate(store.rounds, store.players, per, store.settings);
  const sum = k => Object.values(T).reduce((s, t) => s + t[k], 0);
  const presAvg = nR ? Math.round(sum('p') / nR) : 0;
  const fab = store.isMaster ? `<a class="fab" href="#/lancar">${I.plus}Lançar rodada</a>` : '';

  if (!store.players.length && !store.rounds.length) {
    return heroHTML() + `<div class="empty"><img src="icons/logo-256.png" alt=""><h3>Bem-vindo à Capelota</h3>
      <p>${store.isMaster ? 'Comece cadastrando os atletas. Depois é só lançar a rodada de cada terça.' : 'Assim que um master cadastrar os atletas e lançar a primeira rodada, as estatísticas aparecem aqui.'}</p>
      ${store.isMaster ? `<a class="btn primary" href="#/atletas">Cadastrar atletas</a>` : `<a class="btn" href="#/ajustes">Entrar como master</a>`}</div>`;
  }

  let hl;
  if (per.type === 'round') {
    const r = rounds[0];
    if (r) {
      const aw = C.nightAwards(r);
      const champs = Object.entries(r.entries || {}).filter(([, e]) => e.p && e.t).map(([id]) => playerById(id)).filter(Boolean);
      const mvp = leaders(T, 'pts');
      hl = `<div class="highlights">
        ${hlCard('Artilheiro da noite', I.ball, aw.art.map(playerById).filter(Boolean), aw.maxG, aw.maxG === 1 ? 'gol' : 'gols')}
        ${hlCard('Garçom da noite', I.pass, aw.gar.map(playerById).filter(Boolean), aw.maxA, aw.maxA === 1 ? 'assist.' : 'assist.')}
        ${hlCard('Craque da noite', I.star, mvp.list, mvp.v, 'pts', 'mvp')}
        ${hlCard('Campeões', I.trophy, champs, champs.length, champs.length === 1 ? 'atleta' : 'atletas')}
      </div>`;
    }
  } else {
    const art = leaders(T, 'g'), gar = leaders(T, 'a'), mvp = leaders(T, 'pts'), par = leaders(T, 'cs', p => p.pos === 'G');
    hl = `<div class="highlights">
      ${hlCard('Artilheiro', I.ball, art.list, art.v, art.v === 1 ? 'gol' : 'gols')}
      ${hlCard('Garçom', I.pass, gar.list, gar.v, 'assist.')}
      ${hlCard('Craque', I.star, mvp.list, mvp.v, 'pts', 'mvp')}
      ${hlCard('Paredão', I.glove, par.list, par.v, 'sem sofrer')}
    </div>`;
  }

  let bottom = '';
  if (per.type === 'round') {
    const r = rounds[0];
    bottom = r ? `<section class="sec"><div class="sec-head"><h2>Súmula</h2><a href="#/rodada/${r.id}">Abrir rodada</a></div>${roundSheet(r)}</section>` : '';
  } else {
    const top = store.players.filter(p => T[p.id]).sort((a, b) => T[b.id].pts - T[a.id].pts || T[b.id].g - T[a.id].g).slice(0, 5);
    bottom = `
      <section class="sec"><div class="sec-head"><h2>Top 5 em pontos</h2><a href="#/ranking">Ranking completo</a></div>
        ${top.length ? `<div class="board">${top.map((p, i) => `
          <a class="row ${i < 3 ? 'top' + (i + 1) : ''}" href="#/atleta/${esc(p.id)}">
            <span class="pos">${i + 1}</span>${avatar(p)}
            <span><span class="nm">${esc(dn(p))}</span><br><span class="sub">${T[p.id].pts} pontos</span></span>
            <span class="mini-cols">${p.pos === 'G'
              ? `<span><b>${T[p.id].cs}</b><em>SG</em></span><span><b>${T[p.id].g}</b><em>Gols</em></span><span><b>${T[p.id].p}</b><em>Pres.</em></span>`
              : `<span><b>${T[p.id].g}</b><em>Gols</em></span><span><b>${T[p.id].a}</b><em>Assist.</em></span><span><b>${T[p.id].p}</b><em>Pres.</em></span>`}</span>
          </a>`).join('')}</div>` : `<div class="empty"><p>Nenhuma rodada nesse período.</p></div>`}
      </section>
      <section class="sec"><div class="sec-head"><h2>Rodadas</h2><span class="muted small">${nR} no período</span></div>
        ${nR ? `<div class="rounds">${rounds.slice(0, 10).map(roundItem).join('')}</div>` : `<div class="empty"><p>Sem rodadas lançadas em ${esc(C.periodLabel(per))}.</p>${store.isMaster ? `<a class="btn primary" href="#/lancar">Lançar rodada</a>` : ''}</div>`}
      </section>`;
  }

  return `${heroHTML()}
    ${periodBar('dash')}
    ${store.isMaster && per.type === 'month' ? `<button class="btn sm block" style="margin:-6px 0 14px" data-act="edit-month" data-y="${per.y}" data-m="${per.m}">${I.edit}Editar estatísticas de ${C.MONTHS[per.m - 1].toLowerCase()}</button>` : ''}
    <div class="kpis">
      <div class="kpi"><b>${nR}</b><span>${nR === 1 ? 'Rodada' : 'Rodadas'}</span></div>
      <div class="kpi"><b>${sum('g')}</b><span>Gols</span></div>
      <div class="kpi"><b>${sum('a')}</b><span>Assist.</span></div>
      <div class="kpi"><b>${presAvg}</b><span>${per.type === 'round' ? 'Presentes' : 'Média pres.'}</span></div>
    </div>
    <section class="sec">${hl || `<div class="empty"><p>Nenhuma rodada lançada ainda.</p></div>`}</section>
    ${bottom}
    ${fab}`;
}

function roundItem(r) {
  const d = C.parseDate(r.date);
  const es = Object.entries(r.entries || {}).filter(([, e]) => e.p);
  const goals = es.reduce((s, [, e]) => s + (e.g || 0), 0);
  const aw = C.nightAwards(r);
  const art = aw.art.map(playerById).filter(Boolean);
  if (r.summary) {
    const top = es.slice().sort((x, y) => (y[1].g || 0) - (x[1].g || 0))[0];
    return `<a class="rd" href="#/rodada/${r.id}">
    <span class="day"><b style="font-size:22px">${C.MONTHS_SHORT[d.getMonth()]}</b><span>resumo</span></span>
    <span class="info"><strong>${r.rounds} rodadas, ${goals} gols</strong><br>${top && top[1].g ? `Artilheiro: ${esc(dn(playerById(top[0])))} (${top[1].g})` : 'Resumo da planilha'}</span>
    <span class="ico" style="color:var(--texto-3)">${I.next.replace('<svg', '<svg style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2"')}</span>
  </a>`;
  }
  return `<a class="rd" href="#/rodada/${r.id}">
    <span class="day"><b>${String(d.getDate()).padStart(2, '0')}</b><span>${C.MONTHS_SHORT[d.getMonth()]}</span></span>
    <span class="info"><strong>${es.length} presentes, ${goals} gols</strong><br>${art.length ? `Artilheiro: ${art.map(p => esc(dn(p))).join(', ')} (${aw.maxG})` : 'Sem gols registrados'}</span>
    <span class="ico" style="color:var(--texto-3)">${I.next.replace('<svg', '<svg style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2"')}</span>
  </a>`;
}

// ================= SÚMULA DA RODADA =================
function roundSheet(r) {
  const aw = C.nightAwards(r);
  const present = Object.entries(r.entries || {}).filter(([, e]) => e.p);
  const rowFor = ([pid, e]) => {
    const p = playerById(pid);
    const badges = [
      e.t ? `<span class="badge cream">${e.t > 1 ? e.t + ' títulos' : 'Campeão'}</span>` : '',
      aw.art.includes(pid) ? '<span class="badge">Artilheiro</span>' : '',
      aw.gar.includes(pid) ? '<span class="badge blue">Garçom</span>' : ''
    ].join('');
    const isG = p?.pos === 'G';
    const line = isG
      ? `<span><b>${e.g || 0}</b> G</span><span><b>${e.a || 0}</b> A</span><span><b>${e.cs || 0}</b> SG</span>`
      : `${r.summary ? `<span><b>${e.p}</b> pres.</span>` : ''}<span><b>${e.g || 0}</b> G</span><span><b>${e.a || 0}</b> A</span><span><b>${e.w || 0}</b>V <b>${e.d || 0}</b>E <b>${e.l || 0}</b>D</span>${e.y ? `<span><span class="card-y"></span>${e.y}</span>` : ''}${e.r ? `<span><span class="card-r"></span>${e.r}</span>` : ''}`;
    return `<a class="st-row" href="${p ? '#/atleta/' + esc(pid) : '#/rodada/' + r.id}">${avatar(p, 's')}
      <span class="nm">${esc(dn(p))}${isG ? '<small>Goleiro</small>' : ''}</span>
      <span class="line">${badges}${line}</span></a>`;
  };
  if (!present.length) return `<div class="empty"><p>Ninguém marcado como presente.</p></div>`;
  const sortFn = (a, b) => (r.summary ? ((b[1].p || 0) - (a[1].p || 0)) : 0) || ((b[1].g || 0) - (a[1].g || 0)) || ((b[1].a || 0) - (a[1].a || 0)) || dn(playerById(a[0])).localeCompare(dn(playerById(b[0])));
  if (r.teams && r.teams.length) {
    const inTeam = new Set(r.teams.flatMap(t => t.ids || []));
    let html = r.teams.map((t, i) => {
      const rows = present.filter(([pid]) => (t.ids || []).includes(pid)).sort(sortFn);
      if (!rows.length) return '';
      return `<div class="group-title" style="display:flex;align-items:center;gap:8px"><span class="dot" style="background:${TEAM_COLORS[i % 4]}"></span>${esc(t.name || TEAM_NAMES[i])}</div><div class="sheet-table">${rows.map(rowFor).join('')}</div>`;
    }).join('');
    const rest = present.filter(([pid]) => !inTeam.has(pid)).sort(sortFn);
    if (rest.length) html += `<div class="group-title">Fora dos times</div><div class="sheet-table">${rest.map(rowFor).join('')}</div>`;
    return html;
  }
  const gk = present.filter(([pid]) => playerById(pid)?.pos === 'G').sort(sortFn);
  const ln = present.filter(([pid]) => playerById(pid)?.pos !== 'G').sort(sortFn);
  return (ln.length ? `<div class="group-title">Linha</div><div class="sheet-table">${ln.map(rowFor).join('')}</div>` : '')
    + (gk.length ? `<div class="group-title">Goleiros</div><div class="sheet-table">${gk.map(rowFor).join('')}</div>` : '');
}

function vRodada(id) {
  const r = roundById(id);
  if (!r) return `<a class="back" href="#/inicio">${I.back}Início</a><div class="empty"><h3>Rodada não encontrada</h3><p>Ela pode ter sido apagada.</p></div>`;
  const es = Object.values(r.entries || {}).filter(e => e.p);
  const goals = es.reduce((s, e) => s + (e.g || 0), 0);
  const d = C.parseDate(r.date);
  if (r.summary) {
    return `<a class="back" href="#/inicio">${I.back}Início</a>
    <div class="page-head"><div><h1>${C.MONTHS[d.getMonth()]} ${d.getFullYear()}</h1><p>Resumo do mês importado da planilha: os números de cada atleta somados nas ${r.rounds} rodadas.</p></div></div>
    <div class="kpis"><div class="kpi"><b>${r.rounds}</b><span>Rodadas</span></div><div class="kpi"><b>${es.length}</b><span>Atletas</span></div>
      <div class="kpi"><b>${goals}</b><span>Gols</span></div><div class="kpi"><b>${es.reduce((s, e) => s + (e.a || 0), 0)}</b><span>Assist.</span></div></div>
    <section class="sec">${roundSheet(r)}</section>
    ${store.isMaster ? `<div class="btn-row sec"><a class="btn primary" href="#/lancar/${r.id}">${I.edit}Editar números do mês</a><button class="btn danger" data-act="round-del" data-date="${r.id}">Apagar resumo</button></div>` : ''}`;
  }
  return `<a class="back" href="#/inicio">${I.back}Início</a>
    <div class="page-head"><div><h1>Rodada de ${C.fmtDate(r.date, { year: false })}</h1>
    <p>${['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d.getDay()]}, ${d.getDate()} de ${C.MONTHS[d.getMonth()].toLowerCase()} de ${d.getFullYear()}</p></div></div>
    <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi"><b>${es.length}</b><span>Presentes</span></div>
      <div class="kpi"><b>${goals}</b><span>Gols</span></div>
      <div class="kpi"><b>${es.reduce((s, e) => s + (e.a || 0), 0)}</b><span>Assist.</span></div>
    </div>
    ${r.note ? `<p class="sec muted" style="margin-top:14px">${esc(r.note)}</p>` : ''}
    <section class="sec">${roundSheet(r)}</section>
    ${store.isMaster ? `<div class="btn-row sec"><a class="btn primary" href="#/lancar/${r.date}">${I.edit}Editar rodada</a><button class="btn danger" data-act="round-del" data-date="${r.date}">Apagar rodada</button></div>
    ${r.updatedBy ? `<p class="hint" style="margin-top:10px">Última edição por ${esc(r.updatedBy)}.</p>` : ''}` : ''}`;
}

// ================= RANKING =================
function vRanking() {
  const per = state.pers.rank;
  if (!store.isMaster && per.type === 'all') setPerType('rank', 'month');
  if (per.type === 'round' && !per.date) per.date = roundDates()[0] || null;
  const { totals: T } = C.aggregate(store.rounds, store.players, per, store.settings);
  const g = state.rankGroup;
  const stats = g === 'G' ? STAT_G : STAT_L;
  if (!stats.some(s => s.k === state.rankStat)) state.rankStat = 'pts';
  const k = state.rankStat;
  let list = store.players.filter(p => T[p.id] && (g === 'G' ? p.pos === 'G' : p.pos !== 'G'));
  if (k === 'wr') list = list.filter(p => C.games(T[p.id]) > 0);
  list.sort((a, b) => (statVal(T[b.id], k) - statVal(T[a.id], k)) || (T[b.id].pts - T[a.id].pts) || dn(a).localeCompare(dn(b)));
  // posição com empate
  let lastV = null, lastPos = 0;
  const rows = list.map((p, i) => {
    const v = statVal(T[p.id], k);
    const pos = v === lastV ? lastPos : i + 1; lastV = v; lastPos = pos;
    const t = T[p.id];
    const sub = g === 'G' ? `${t.p} presenças, ${t.pts} pts` : (k === 'pts' ? `${t.g} gols, ${t.a} assist., ${t.p} pres.` : `${t.p} presenças, ${t.pts} pts`);
    const tag = store.isMaster ? `a href="#/atleta/${esc(p.id)}"` : 'div';
    return `<${tag} class="row ${pos <= 3 ? 'top' + pos : ''}">
      <span class="pos">${pos}</span>${avatar(p)}
      <span><span class="nm">${esc(dn(p))}</span><br><span class="sub">${sub}</span></span>
      <span class="v" style="${k === 'cards' ? 'font-size:18px' : ''}">${statShow(t, k)}</span></${store.isMaster ? 'a' : 'div'}>`;
  }).join('');
  return `<div class="page-head"><div><h1>Ranking</h1><p>${store.isMaster ? 'Toque num atleta para ver o perfil.' : 'Por rodada, mês ou ano.'}</p></div></div>
    ${periodBar('rank', store.isMaster ? ['round', 'month', 'year', 'all'] : ['round', 'month', 'year'])}
    ${store.isMaster && per.type === 'month' ? `<button class="btn sm block" style="margin:-6px 0 14px" data-act="edit-month" data-y="${per.y}" data-m="${per.m}">${I.edit}Editar estatísticas de ${C.MONTHS[per.m - 1].toLowerCase()}</button>` : ''}
    ${store.isMaster && per.type === 'round' && per.date ? `<a class="btn sm block" style="margin:-6px 0 14px" href="#/lancar/${per.date}">${I.edit}Editar esta rodada</a>` : ''}
    <div class="seg" style="margin-bottom:12px">
      <button class="${g === 'L' ? 'on' : ''}" data-act="rank-group" data-g="L">Linha</button>
      <button class="${g === 'G' ? 'on' : ''}" data-act="rank-group" data-g="G">Goleiros</button>
    </div>
    <div class="chips" role="tablist">${stats.map(s => `<button class="chip ${s.k === k ? 'on' : ''}" data-act="rank-stat" data-k="${s.k}">${s.l}</button>`).join('')}</div>
    ${rows ? `<div class="board">${rows}</div>` : `<div class="empty"><p>Ninguém pontuou em ${esc(C.periodLabel(per).toLowerCase())}.</p></div>`}
    ${k === 'pts' ? `<p class="hint" style="margin-top:12px">${pointsHint()}</p>` : ''}`;
}

function pointsHint() {
  const w = store.settings.weights;
  if ((store.settings.scoring || 'capelota') === 'capelota') return 'Pontos da planilha da Capelota: gols × 1100 ÷ artilheiro do período, assistências × 850 ÷ maior garçom, aproveitamento × 1250 ÷ melhor aproveitamento, mais 250 por título e 100 por presença.';
  return `Pontos da linha: gol ${w.goal}, assistência ${w.assist}, vitória ${w.win}, empate ${w.draw}, título ${w.title}, presença ${w.presence}, amarelo ${w.yellow}, vermelho ${w.red}. Goleiro: jogo sem sofrer gol ${w.cleanSheet}, mais gols, assistências e presença.`;
}

// ================= ATLETAS (álbum) =================
function vAtletas() {
  const { totals: T } = C.aggregate(store.rounds, store.players, { type: 'year', y: thisY() }, store.settings);
  const q = state.search.trim().toLowerCase();
  const f = state.albumFilter;
  const list = store.players
    .filter(p => f === 'all' || (f === 'G' ? p.pos === 'G' : p.pos !== 'G'))
    .filter(p => !q || (p.name + ' ' + (p.nick || '')).toLowerCase().includes(q))
    .sort((a, b) => dn(a).localeCompare(dn(b)));
  const act = list.filter(p => p.active !== false), off = list.filter(p => p.active === false);
  const card = p => figurinha(p, { totals: T[p.id] || C.zero() });
  return `<div class="page-head"><div><h1>Atletas</h1><p>${store.players.filter(p => p.active !== false).length} no elenco. Números de ${thisY()}.</p></div>
      ${store.isMaster ? `<button class="btn primary sm" data-act="player-new">${I.plus.replace('<svg', '<svg style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round"')}Novo atleta</button>` : ''}</div>
    ${store.players.length ? `<input class="search" type="search" placeholder="Buscar atleta" value="${esc(state.search)}" data-input="search" aria-label="Buscar atleta">
    <div class="chips" style="margin-top:10px">
      <button class="chip ${f === 'all' ? 'on' : ''}" data-act="album-filter" data-f="all">Todos</button>
      <button class="chip ${f === 'L' ? 'on' : ''}" data-act="album-filter" data-f="L">Linha</button>
      <button class="chip ${f === 'G' ? 'on' : ''}" data-act="album-filter" data-f="G">Goleiros</button>
    </div>` : ''}
    <div id="albumBody">${albumBody(act, off, card)}</div>`;
}
function albumBody(act, off, card) {
  if (!store.players.length) return `<div class="empty"><img src="icons/logo-256.png" alt=""><h3>O álbum está vazio</h3><p>${store.isMaster ? 'Cadastre cada atleta com nome, apelido, posição e foto.' : 'Um master precisa cadastrar os atletas.'}</p>${store.isMaster ? `<button class="btn primary" data-act="player-new">Cadastrar primeiro atleta</button>` : ''}</div>`;
  if (!act.length && !off.length) return `<div class="empty"><p>Ninguém com esse nome.</p></div>`;
  return `<div class="album">${act.map(card).join('')}</div>${off.length ? `<div class="group-title" style="margin-top:24px">Fora do elenco</div><div class="album">${off.map(card).join('')}</div>` : ''}`;
}

// ================= PERFIL =================
function vAtleta(id) {
  const p = playerById(id);
  if (!p) return `<a class="back" href="#/atletas">${I.back}Atletas</a><div class="empty"><h3>Atleta não encontrado</h3></div>`;
  const per = state.pers.prof;
  const w = store.settings;
  const { totals: T } = C.aggregate(store.rounds, store.players, per, w);
  const t = T[p.id] || C.zero();
  const { totals: TA } = C.aggregate(store.rounds, store.players, { type: 'all' }, w);
  const ta = TA[p.id] || C.zero();
  const isG = p.pos === 'G';
  const tiles = isG
    ? [['p', 'Presenças'], ['cs', 'Sem sofrer gol', 1], ['g', 'Gols'], ['a', 'Assist.'], ['pts', 'Pontos', 1], ['art', 'Artilheiro da noite'], ['gar', 'Garçom da noite'], ['cards', 'Cartões']]
    : [['p', 'Presenças'], ['g', 'Gols', 1], ['a', 'Assist.', 1], ['pts', 'Pontos'], ['w', 'Vitórias'], ['d', 'Empates'], ['l', 'Derrotas'], ['t', 'Títulos'], ['wr', 'Aproveit.'], ['art', 'Artilheiro da noite'], ['gar', 'Garçom da noite'], ['cards', 'Cartões']];
  const tr = C.playerTrophies(store.rounds, store.players, p.id, store.settings);
  const trophies = [
    [tr.mvp, 'Craque do mês'], [tr.art, 'Artilheiro do mês'], [tr.gar, 'Garçom do mês'], [tr.sel, 'Seleção do mês'],
    ...(isG ? [[tr.paredao, 'Paredão do mês']] : []), [ta.t, 'Títulos'], [ta.art, 'Artilheiro da noite'], [ta.gar, 'Garçom da noite']
  ].filter(([n]) => n > 0);

  // evolução por mês no ano escolhido
  const yr = per.type === 'all' ? thisY() : (per.y || thisY());
  const months = Array.from({ length: 12 }, (_, i) => {
    const { totals } = C.aggregate(store.rounds, store.players, { type: 'month', y: yr, m: i + 1 }, w);
    const x = totals[p.id] || C.zero();
    return isG ? [x.cs, x.g] : [x.g, x.a];
  });
  const maxV = Math.max(1, ...months.flat());
  const s1 = isG ? 'Sem sofrer gol' : 'Gols', s2 = isG ? 'Gols' : 'Assistências';
  const chart = `<div class="chart" role="img" aria-label="${s1} e ${s2} por mês em ${yr}">
    <div class="legend"><span><i style="background:var(--sombrero)"></i>${s1}</span><span><i style="background:var(--braco-claro)"></i>${s2}</span></div>
    <div class="bars">${months.map(([a, b], i) => `<div class="m"><div class="pair">
      <div class="b g" style="height:${(a / maxV) * 100}%">${a ? `<em>${a}</em>` : ''}</div>
      <div class="b a" style="height:${(b / maxV) * 100}%">${b ? `<em>${b}</em>` : ''}</div></div>
      <span class="ml">${C.MONTHS_SHORT[i][0].toUpperCase()}</span></div>`).join('')}</div></div>`;

  const hist = C.sortedRounds(store.rounds).filter(r => r.entries?.[p.id]?.p).slice(0, 8);
  const level = p.level || 3;
  return `<a class="back" href="#/atletas">${I.back}Atletas</a>
    <div class="profile">
      ${figurinha(p, { link: false, full: true })}
      <div class="meta">
        <h1>${esc(dn(p))}</h1>
        ${p.nick ? `<p class="nick">${esc(p.name)}</p>` : ''}
        <div class="facts">
          <span class="pill ${isG ? '' : 'red'}">${isG ? 'Goleiro' : 'Linha'}</span>
          ${p.num ? `<span class="pill">Camisa ${esc(p.num)}</span>` : ''}
          ${store.isPlayerMaster(p.id) ? `<span class="pill red">Comissão</span>` : ''}
          <span class="pill">${ta.p} ${ta.p === 1 ? 'presença' : 'presenças'}</span>
          ${store.isMaster ? `<span class="pill" title="Nível para o sorteio (só masters veem)"><span class="stars">${'★'.repeat(level)}</span>${'☆'.repeat(5 - level)}</span>` : ''}
          ${p.active === false ? `<span class="pill">Fora do elenco</span>` : ''}
        </div>
      </div>
    </div>
    <div class="btn-row sec" style="margin-top:22px">
      <button class="btn" data-act="share-player" data-id="${esc(p.id)}">${I.share}Compartilhar figurinha</button>
      ${store.isMaster ? `<button class="btn" data-act="player-edit" data-id="${esc(p.id)}">${I.edit}Editar</button>` : ''}
    </div>
    <section class="sec">${periodBar('prof', ['month', 'year', 'all'])}
      <div class="stats">${tiles.map(([k, l, hot]) => `<div class="stat ${hot ? 'hot' : ''}"><b>${statShow(t, k)}</b><span>${l}</span></div>`).join('')}</div>
    </section>
    <section class="sec"><div class="sec-head"><h2>Conquistas</h2><span class="muted small">Desde o começo</span></div>
      ${trophies.length ? `<div class="trophies">${trophies.map(([n, l]) => `<div class="tro"><b>${n}</b><span>${l}</span></div>`).join('')}</div>` : `<div class="empty"><p>Ainda sem troféus. A próxima terça é a chance.</p></div>`}
    </section>
    <section class="sec"><div class="sec-head"><h2>Mês a mês</h2><span class="muted small">${yr}</span></div>${chart}</section>
    <section class="sec"><div class="sec-head"><h2>Últimas rodadas</h2></div>
      ${hist.length ? `<div class="sheet-table">${hist.map(r => {
        const e = r.entries[p.id]; const aw = C.nightAwards(r);
        return `<a class="st-row hist" href="#/rodada/${r.id}"><span class="num" style="font-size:${r.summary ? 17 : 20}px">${r.summary ? C.MONTHS_SHORT[+r.date.slice(5, 7) - 1] : C.fmtDate(r.date, { year: false })}</span>
          <span class="nm">${r.summary ? `<span class="badge blue">${e.p} pres.</span> ` : ''}${e.t ? `<span class="badge cream">${e.t > 1 ? e.t + ' títulos' : 'Campeão'}</span> ` : ''}${aw.art.includes(p.id) ? '<span class="badge">Artilheiro</span> ' : ''}${aw.gar.includes(p.id) ? '<span class="badge blue">Garçom</span>' : ''}</span>
          <span class="line">${isG ? `<span><b>${e.cs || 0}</b> SG</span>` : `<span><b>${e.w || 0}</b>V <b>${e.d || 0}</b>E <b>${e.l || 0}</b>D</span>`}<span><b>${e.g || 0}</b> G</span><span><b>${e.a || 0}</b> A</span></span></a>`;
      }).join('')}</div>` : `<div class="empty"><p>Nenhuma rodada ainda.</p></div>`}
    </section>`;
}

// ================= SORTEIO =================
function publishedTeams(compact) {
  const pub = store.draw;
  if (!pub || !pub.teams?.length) return '';
  const when = pub.date ? C.fmtDate(pub.date, { year: false }) : '';
  return `<div class="teams">${pub.teams.map((t, i) => `
      <div class="team"><div class="team-h"><span class="dot" style="background:${TEAM_COLORS[i % 4]}"></span><h3>${esc(t.name || TEAM_NAMES[i])}</h3><span class="str">${t.ids.length} atletas</span></div>
        <ul>${t.ids.map(id => { const p = playerById(id); return `<li>${avatar(p, 's')}${esc(dn(p))}${p?.pos === 'G' ? '<span class="gk">GOL</span>' : ''}</li>`; }).join('')}</ul></div>`).join('')}</div>
    ${compact ? '' : `<p class="hint" style="margin-top:10px">Sorteio de ${when}${pub.by ? `, publicado por ${esc(pub.by)}` : ''}.</p>`}`;
}

function vTimesPublic() {
  const pub = store.draw;
  const when = pub?.date ? C.parseDate(pub.date) : null;
  return heroHTML() + `<div class="page-head"><div><h1>Times</h1><p>${pub ? `Sorteio para ${['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][when.getDay()]}, ${C.fmtDate(pub.date, { year: false })}. Ache seu nome e veja seu time.` : 'Os times aparecem aqui assim que a comissão fizer o sorteio.'}</p></div></div>
    ${pub ? `<input class="search" type="search" placeholder="Ache seu nome" data-input="team-search" aria-label="Ache seu nome" style="margin-bottom:12px">` : ''}
    <div id="pubTeams">${pub ? publishedTeams() : `<div class="empty"><img src="icons/logo-256.png" alt=""><h3>Sorteio ainda não saiu</h3><p>Volte mais perto das 19h de terça.</p></div>`}</div>`;
}

function vSorteio() {
  if (!store.isMaster) return vTimesPublic();
  const d = state.draw;
  const active = store.players.filter(p => p.active !== false).sort((a, b) => (a.pos === 'G' ? -1 : 0) - (b.pos === 'G' ? -1 : 0) || dn(a).localeCompare(dn(b)));
  [...d.sel].forEach(id => { if (!active.some(p => p.id === id)) d.sel.delete(id); });
  const sel = active.filter(p => d.sel.has(p.id));
  const nG = sel.filter(p => p.pos === 'G').length, nL = sel.length - nG;
  const per = d.n ? Math.floor(nL / d.n) : 0, extra = d.n ? nL % d.n : 0;
  if (!active.length) return `<div class="page-head"><div><h1>Sorteio</h1></div></div><div class="empty"><h3>Sem atletas para sortear</h3><p>Cadastre os atletas primeiro.</p><a class="btn primary" href="#/atletas">Ir para Atletas</a></div>`;

  let result = '';
  if (d.result) {
    const lastSum = t => t.reduce((s, id) => s + (playerById(id)?.level || 3), 0);
    result = `<section class="sec" id="drawResult"><div class="sec-head"><h2>Times sorteados</h2><span class="muted small">${C.fmtDate(C.isoDate(now()), { year: false })}</span></div>
      <div class="teams ${d.animate ? 'reveal' : ''}">${d.result.map((t, i) => `
        <div class="team"><div class="team-h"><span class="dot" style="background:${TEAM_COLORS[i]}"></span><h3>${TEAM_NAMES[i]}</h3>
          <span class="str">${t.length} atletas${store.isMaster ? `, força ${lastSum(t)}` : ''}</span></div>
          <ul>${t.map((id, j) => { const p = playerById(id); return `<li style="animation-delay:${(j * d.result.length + i) * 70}ms">${avatar(p, 's')}${esc(dn(p))}${p?.pos === 'G' ? '<span class="gk">GOL</span>' : ''}</li>`; }).join('')}</ul>
        </div>`).join('')}</div>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn" data-act="draw-share">${I.whats}Mandar no grupo</button>
        <button class="btn" data-act="draw-go">${I.shuffle}Sortear de novo</button>
      </div>
      <button class="btn primary block" style="margin-top:10px" data-act="draw-publish">Publicar para a galera</button>
      <button class="btn block" style="margin-top:10px" data-act="draw-to-round">Lançar rodada com esses times</button>
    </section>`;
  }

  const pubBlock = store.draw?.teams?.length ? `<details class="panel" style="margin-bottom:18px"><summary style="cursor:pointer;font-weight:700">Times publicados para a galera (${C.fmtDate(store.draw.date, { year: false })})</summary><div style="margin-top:12px">${publishedTeams()}</div></details>` : '';
  return `<div class="page-head"><div><h1>Sorteio</h1><p>Marque quem chegou e escolha quantos times. Depois publique para a galera ver.</p></div></div>
    ${pubBlock}
    <div class="sec-head"><h3>Quem vai jogar</h3><span class="muted small"><b class="num" style="font-size:20px;color:var(--texto)">${sel.length}</b> marcados</span></div>
    <div class="chips" style="margin-bottom:10px">
      <button class="chip" data-act="draw-all">Marcar todos</button>
      <button class="chip" data-act="draw-last">Mesmos da última rodada</button>
      <button class="chip" data-act="draw-none">Limpar</button>
    </div>
    <div class="pick">${active.map(p => `<button class="pk ${d.sel.has(p.id) ? 'on' : ''}" data-act="draw-toggle" data-id="${esc(p.id)}" aria-pressed="${d.sel.has(p.id)}">
      ${p.pos === 'G' ? '<span class="gk">GOL</span>' : ''}${avatar(p)}<span class="nm">${esc(dn(p))}</span></button>`).join('')}</div>

    <section class="sec">
      <div class="field"><span class="lab">Quantos times</span>
        <div class="seg">${[2, 3, 4].map(n => `<button class="${d.n === n ? 'on' : ''}" data-act="draw-n" data-n="${n}">${n} times</button>`).join('')}</div></div>
      <div class="field"><span class="lab">Como sortear</span>
        <div class="seg">
          <button class="${d.mode === 'equilibrado' ? 'on' : ''}" data-act="draw-mode" data-m="equilibrado">Equilibrado</button>
          <button class="${d.mode === 'aleatorio' ? 'on' : ''}" data-act="draw-mode" data-m="aleatorio">Na sorte</button>
        </div>
        <span class="hint">${d.mode === 'equilibrado' ? 'Usa o nível de cada atleta (definido pelos masters) para deixar os times parelhos. Goleiros vão um para cada lado.' : 'Totalmente aleatório. Goleiros vão um para cada lado.'}</span>
      </div>
      <p class="hint" style="margin-bottom:12px">${nL} na linha e ${nG} ${nG === 1 ? 'goleiro' : 'goleiros'}: ${per} por time na linha${extra ? `, ${extra} ${extra === 1 ? 'time fica' : 'times ficam'} com 1 a mais` : ''}.</p>
      <button class="btn primary block" data-act="draw-go" ${sel.length < d.n ? 'disabled' : ''}>${I.shuffle}Sortear times</button>
    </section>
    ${result}`;
}

function drawShareText() {
  const d = state.draw;
  const lines = [`⚽ Capelota, times de ${C.fmtDate(C.isoDate(now()), { year: false })}`, ''];
  d.result.forEach((t, i) => {
    lines.push(`${TEAM_EMOJI[i]} ${TEAM_NAMES[i]}`);
    t.forEach(id => { const p = playerById(id); lines.push(`• ${dn(p)}${p?.pos === 'G' ? ' (goleiro)' : ''}`); });
    lines.push('');
  });
  return lines.join('\n').trim();
}

// ================= PRÊMIOS =================
const FORMATION = { 1: [1], 2: [2], 3: [2, 1], 4: [2, 2], 5: [2, 1, 2], 6: [3, 3], 7: [3, 2, 2], 8: [3, 3, 2], 9: [3, 3, 3], 10: [4, 3, 3] };

function vPremios() {
  if (!state.awards) {
    const ms = C.monthsWithRounds(store.rounds);
    state.awards = ms[0] ? { ...ms[0] } : { y: thisY(), m: thisM() };
  }
  const { y, m } = state.awards;
  const A = C.monthAwards(store.rounds, store.players, y, m, store.settings);
  const T = A.totals;
  const isCur = y === thisY() && m === thisM();
  const nextOff = y > thisY() || isCur;
  const nav = `<div class="stepnav" style="margin:0 0 18px">
      <button aria-label="Mês anterior" data-act="aw-step" data-d="-1">${I.prev}</button>
      <div class="lbl">${C.MONTHS[m - 1]} ${y}</div>
      <button aria-label="Próximo mês" data-act="aw-step" data-d="1" ${nextOff ? 'disabled' : ''}>${I.next}</button></div>`;
  const head = `<div class="page-head"><div><h1>${store.isMaster ? 'Prêmios do mês' : 'Craque do mês'}</h1><p>Calculados sozinhos a partir das rodadas.${isCur ? ' O mês ainda está rolando.' : ''}</p></div></div>`;
  if (!A.rounds.length) return head + nav + `<div class="empty"><img src="icons/logo-256.png" alt=""><h3>Sem rodadas em ${C.MONTHS[m - 1].toLowerCase()}</h3><p>Os prêmios aparecem assim que a primeira rodada do mês for lançada.</p></div>` + (store.isMaster ? yearList(y) : '');

  const mvp = A.mvp; const tm = T[mvp.id];
  const M = store.isMaster;
  const craque = `<${M ? `a href="#/atleta/${esc(mvp.id)}"` : 'div'} class="craque">
      ${figurinha(mvp, { link: false })}
      <div><div class="k">Craque do mês</div><h2>${esc(dn(mvp))}</h2>
        <div class="pts">${tm.pts}<small> pts</small></div>
        <div class="line">${mvp.pos === 'G' ? `<span class="pill">${tm.cs} sem sofrer</span>` : `<span class="pill">${tm.g} gols</span><span class="pill">${tm.a} assist.</span>`}<span class="pill">${tm.p}/${A.nRounds} presenças</span></div>
      </div></${M ? 'a' : 'div'}>`;
  const val = (list, k) => list.length ? T[list[0].id][k] : 0;
  const hls = `<div class="highlights sec">
    ${hlCard('Artilheiro do mês', I.ball, A.artilheiro, val(A.artilheiro, 'g'), 'gols')}
    ${hlCard('Garçom do mês', I.pass, A.garcom, val(A.garcom, 'a'), 'assist.')}
    ${hlCard('Paredão do mês', I.glove, A.paredao ? [A.paredao] : [], A.paredao ? T[A.paredao.id].cs : 0, 'sem sofrer')}
    <div class="hl"><div class="lbl">${I.trophy}Rodadas no mês</div><div class="val">${A.nRounds}</div>
      <div class="who" style="color:var(--texto-2);font-size:13.5px">${A.rounds.map(r => r.summary ? 'Resumo da planilha' : C.fmtDate(r.date, { year: false })).reverse().join(', ')}</div></div>
  </div>`;

  const line = A.time.line;
  const rows = FORMATION[line.length] || [line.length];
  let k = 0;
  const bdg = monthBadges(A);
  const spot = (p, gk) => `<${M ? `a href="#/atleta/${esc(p.id)}"` : 'span'} class="spot ${gk ? 'gk' : ''}"><span class="spot-av">${avatar(p)}${(bdg[p.id] || []).map((k, i) => `<span class="award a${i}" title="${AWARD_LABEL[k]}">${AWARD_SVG[k]}</span>`).join('')}</span><span class="nm">${esc(dn(p))}</span><span class="pt">${T[p.id].pts} pts</span></${M ? 'a' : 'span'}>`;
  const pitch = `<div class="pitch" role="img" aria-label="Time ideal do mês">
    ${rows.map(n => `<div class="line">${line.slice(k, k += n).map(p => spot(p)).join('')}</div>`).join('')}
    ${A.time.gk ? `<div class="line">${spot(A.time.gk, true)}</div>` : ''}
  </div>`;

  if (!M) {
    return head + nav + craque + `
    <section class="sec"><div class="sec-head"><h2>Time ideal</h2><span class="muted small">Os ${line.length} de linha${A.time.gk ? ' e o goleiro' : ''} com mais pontos</span></div>${pitch}
      <p class="legend-awards"><span>${AWARD_SVG.crown}Craque</span><span>${AWARD_SVG.boot}Artilheiro</span><span>${AWARD_SVG.hat}Garçom</span></p></section>`;
  }
  return head + nav + craque + hls + `
    <section class="sec"><div class="sec-head"><h2>Time ideal</h2><span class="muted small">Os ${line.length} de linha${A.time.gk ? ' e o goleiro' : ''} com mais pontos</span></div>${pitch}
      <p class="legend-awards"><span>${AWARD_SVG.crown}Craque</span><span>${AWARD_SVG.boot}Artilheiro</span><span>${AWARD_SVG.hat}Garçom</span></p></section>
    <div class="btn-row sec"><button class="btn primary" data-act="share-month">${I.share}Compartilhar no Instagram</button></div>
    <p class="hint" style="margin-top:8px">Gera duas imagens, no tamanho do feed ou do story: o time ideal e os destaques do mês.</p>
    ${yearList(y)}`;
}

function yearList(y) {
  const ms = C.monthsWithRounds(store.rounds).filter(x => x.y === y);
  if (!ms.length) return '';
  return `<section class="sec"><div class="sec-head"><h2>Craques de ${y}</h2></div><div class="year-list">${ms.map(({ m }) => {
    const A = C.monthAwards(store.rounds, store.players, y, m, store.settings);
    return `<button class="yl" style="text-align:left;width:100%;color:inherit" data-act="aw-go" data-y="${y}" data-m="${m}"><span class="mo">${C.MONTHS[m - 1].slice(0, 3)}</span>
      <span class="who">Craque: <b>${esc(dn(A.mvp))}</b><br>Artilheiro: ${A.artilheiro.length ? A.artilheiro.map(p => esc(dn(p))).join(', ') + ` (${A.totals[A.artilheiro[0].id].g})` : '–'}</span></button>`;
  }).join('')}</div></section>`;
}

// ================= AJUSTES =================
function vAjustes() {
  const w = store.settings.weights;
  const M = store.isMaster;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const sc = store.settings.scoring || 'capelota';
  const wf = (k, l) => `<label>${l}<input type="number" inputmode="numeric" step="1" data-w="${k}" value="${w[k]}" ${M ? '' : 'disabled'}></label>`;
  const install = standalone ? '' : `<div class="panel"><h3>Colocar na tela inicial</h3>
      ${state.installPrompt ? `<p>Instale o Capelota como app, com ícone próprio.</p><button class="btn primary" data-act="install">Instalar app</button>`
        : isIOS ? `<p>No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".</p>`
        : `<p>No Chrome, abra o menu ⋮ e toque em "Instalar app" ou "Adicionar à tela inicial".</p>`}
    </div>`;
  if (!M) {
    return `<div class="page-head"><div><h1>Ajustes</h1></div></div>
    <div class="panel"><h3>Acesso da comissão</h3><p>Quem é da comissão entra com CPF e senha para lançar rodadas, sortear times e cuidar dos atletas.</p>
      <button class="btn primary" data-act="login">Entrar como master</button></div>
    ${install}
    <p class="hint" style="text-align:center;margin-top:22px">Capelota, terças às 19h.</p>`;
  }
  return `<div class="page-head"><div><h1>Ajustes</h1></div></div>
    <div class="panel"><h3>Acesso master</h3>
      ${M ? `<p>Você está como master${store.user?.name ? `: <b style="color:var(--texto)">${esc(store.user.name)}</b>` : ''}. Pode cadastrar atletas, lançar, editar e apagar rodadas.</p>
        <div class="group-title" style="margin-top:4px">Comissão</div>
        <div class="sheet-table" style="margin-bottom:12px">${store.commission.map(m => { const pl = playerById(m.playerId); return `<a class="st-row" href="${pl ? '#/atleta/' + esc(pl.id) : '#/ajustes'}">${avatar(pl || { id: m.name, name: m.name }, 's')}<span class="nm">${esc(m.name)}<small>${m.founder ? 'Fundador' : m.cpfEnd ? 'CPF ' + maskCpfEnd('000000' + m.cpfEnd) : 'Master'}</small></span><span></span></a>`; }).join('')}</div>
        <p class="hint" style="margin-bottom:12px">Para dar acesso a mais alguém, abra o perfil do atleta, toque em Editar e ligue "Comissão".</p>
        <button class="btn" data-act="logout">Sair do acesso master</button>`
      : `<p>Todo mundo vê as estatísticas. Só masters (CPF e senha) podem cadastrar, editar e apagar.</p>
        <button class="btn primary" data-act="login">Entrar como master</button>`}
    </div>
    <div class="panel"><h3>Banco de dados</h3>
      ${store.mode === 'cloud'
        ? `<div class="status ok"><i></i><span>Banco compartilhado ligado. Todo mundo que abre o app vê os mesmos números, em tempo real.</span></div>`
        : `<div class="status"><i></i><span>Modo local: os dados ficam só neste aparelho. Para a galera toda acompanhar, ligue o banco compartilhado (passo a passo no README do projeto).</span></div>`}
      <p>${store.players.length} atletas e ${C.roundCount(store.rounds)} rodadas guardados${store.usingSeed ? ', vindos da planilha oficial publicada com o app' : ''}.</p>
      ${M ? `<button class="btn" data-act="load-seed">Carregar dados da planilha</button>` : ''}
    </div>
    <div class="panel"><h3>Backup</h3>
      <p>Baixe um arquivo com todos os atletas, fotos e rodadas. Para restaurar, escolha um backup baixado antes: ele substitui os dados atuais.</p>
      <div class="btn-row">
        <button class="btn" data-act="backup">Baixar backup</button>
        <button class="btn ${M ? '' : 'ghost'}" data-act="restore" ${M ? '' : 'disabled'}>Restaurar backup</button>
      </div>
      ${M ? '' : '<p class="hint" style="margin:10px 0 0">Restaurar é só para masters.</p>'}
    </div>
    <div class="panel"><h3>Pontuação e time ideal</h3>
      <p>Os pontos decidem o craque, o ranking geral e o time ideal do mês.</p>
      <div class="seg" style="margin-bottom:12px">
        <button class="${sc === 'capelota' ? 'on' : ''}" data-act="scoring" data-v="capelota" ${M ? '' : 'disabled'}>Fórmula da planilha</button>
        <button class="${sc === 'pesos' ? 'on' : ''}" data-act="scoring" data-v="pesos" ${M ? '' : 'disabled'}>Pesos simples</button>
      </div>
      <p class="hint" style="margin-bottom:12px">${pointsHint()}</p>
      <div class="weights" ${sc === 'capelota' ? 'hidden' : ''}>
        ${wf('goal', 'Gol')}${wf('assist', 'Assistência')}${wf('win', 'Vitória')}${wf('draw', 'Empate')}
        ${wf('title', 'Título')}${wf('presence', 'Presença')}${wf('yellow', 'Amarelo')}${wf('red', 'Vermelho')}
        ${wf('cleanSheet', 'Sem sofrer gol')}
        <label>Linha no time ideal<input type="number" inputmode="numeric" min="1" max="10" data-per value="${store.settings.perTeam}" ${M ? '' : 'disabled'}></label>
      </div>
      <div class="weights" ${sc === 'capelota' ? '' : 'hidden'}><label>Linha no time ideal<input type="number" inputmode="numeric" min="1" max="10" data-per2 value="${store.settings.perTeam}" ${M ? '' : 'disabled'}></label></div>
      ${M ? '<button class="btn primary block" style="margin-top:14px" data-act="save-weights">Salvar pontuação</button>' : ''}
    </div>
    ${standalone ? '' : `<div class="panel"><h3>Colocar na tela inicial</h3>
      ${state.installPrompt ? `<p>Instale o Capelota como app, com ícone próprio.</p><button class="btn primary" data-act="install">Instalar app</button>`
        : isIOS ? `<p>No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".</p>`
        : `<p>No Chrome, abra o menu ⋮ e toque em "Instalar app" ou "Adicionar à tela inicial".</p>`}
    </div>`}
    <p class="hint" style="text-align:center;margin-top:22px">Capelota, terças às 19h. Versão 9.</p>`;
}

// ================= EDITOR DE RODADA =================
function newEditor(date, teams) {
  const ex = store.rounds.find(r => r.date === date && !r.summary);
  if (ex && !teams) {
    return { date, origId: ex.id, entries: JSON.parse(JSON.stringify(ex.entries || {})), teams: ex.teams ? JSON.parse(JSON.stringify(ex.teams)) : null, note: ex.note || '' };
  }
  // vindo do sorteio: rodada nova só com os sorteados presentes (se a data já existir, o salvar avisa)
  const entries = {};
  (teams || []).forEach(t => t.ids.forEach(id => { entries[id] = { p: 1 }; }));
  return { date, origId: null, entries, teams: teams || null, note: '' };
}

function defaultRoundDate() {
  const n = now();
  return C.isoDate(n.getDay() === 2 ? n : C.lastTuesday(n));
}

function edEntry(pid) { return state.editor.entries[pid] || (state.editor.entries[pid] = { p: 0 }); }

function stepper(pid, f, label, v, html) {
  return `<div class="st"><span class="l">${html || label}</span><div class="c">
    <button data-act="ed-step" data-pid="${esc(pid)}" data-f="${f}" data-d="-1" aria-label="Menos ${label}">−</button>
    <b id="v-${esc(pid)}-${f}">${v || 0}</b>
    <button data-act="ed-step" data-pid="${esc(pid)}" data-f="${f}" data-d="1" aria-label="Mais ${label}">+</button></div></div>`;
}

function edPlayer(p) {
  const e = state.editor.entries[p.id] || { p: 0 };
  const on = !!e.p;
  const isG = p.pos === 'G';
  const S = state.editor.summary;
  const stats = !on ? '' : S
    ? (isG
      ? `<div class="pe-stats">${stepper(p.id, 'p', 'Presenças', e.p, 'Presenças')}${stepper(p.id, 'g', 'Gols', e.g)}${stepper(p.id, 'a', 'Assist.', e.a)}${stepper(p.id, 'cs', 'Sem sofrer', e.cs)}</div>`
      : `<div class="pe-stats">
        ${stepper(p.id, 'p', 'Presenças', e.p, 'Pres.')}${stepper(p.id, 'g', 'Gols', e.g)}${stepper(p.id, 'a', 'Assist.', e.a)}${stepper(p.id, 't', 'Títulos', e.t)}
        ${stepper(p.id, 'w', 'Vitórias', e.w)}${stepper(p.id, 'd', 'Empates', e.d)}${stepper(p.id, 'l', 'Derrotas', e.l)}${stepper(p.id, 'y', 'cartão amarelo', e.y, '<span class="card-y"></span>Amar.')}
        ${stepper(p.id, 'r', 'cartão vermelho', e.r, '<span class="card-r"></span>Verm.')}</div>`)
    : isG
    ? `<div class="pe-stats gk">${stepper(p.id, 'g', 'Gols', e.g)}${stepper(p.id, 'a', 'Assist.', e.a)}${stepper(p.id, 'cs', 'Sem sofrer', e.cs)}</div>`
    : `<div class="pe-stats">
        ${stepper(p.id, 'g', 'Gols', e.g)}${stepper(p.id, 'a', 'Assist.', e.a)}
        ${stepper(p.id, 'y', 'cartão amarelo', e.y, '<span class="card-y"></span>Amar.')}${stepper(p.id, 'r', 'cartão vermelho', e.r, '<span class="card-r"></span>Verm.')}
        ${stepper(p.id, 'w', 'Vitórias', e.w)}${stepper(p.id, 'd', 'Empates', e.d)}${stepper(p.id, 'l', 'Derrotas', e.l)}
        <button class="st title ${e.t ? 'on' : ''}" data-act="ed-title" data-pid="${esc(p.id)}" aria-pressed="${!!e.t}">${I.trophy.replace('class="ico"', '')}<span class="l">${e.t ? 'Campeão' : 'Título?'}</span></button>
      </div>`;
  return `<div class="pe ${on ? 'on' : ''}" id="pe-${esc(p.id)}">
    <button class="pe-head" data-act="ed-toggle" data-pid="${esc(p.id)}" aria-pressed="${on}">${avatar(p)}
      <span class="nm">${esc(dn(p))}<small>${isG ? 'Goleiro' : 'Linha'}${on ? '' : ', toque para marcar presença'}</small></span>
      <span class="check">${I.check}</span></button>
    ${stats}</div>`;
}

function teamResBox(i) {
  const ed = state.editor; const t = ed.teams[i];
  const fid = t.ids.find(id => ed.entries[id]?.p && playerById(id)?.pos !== 'G');
  const first = fid ? ed.entries[fid] : {};
  const tv = f => first[f] || 0;
  return `<div class="team-res">
    ${['w', 'd', 'l'].map(f => `<div class="st"><span class="l">${{ w: 'Vitórias', d: 'Empates', l: 'Derrotas' }[f]}</span><div class="c">
      <button data-act="ed-team" data-i="${i}" data-f="${f}" data-d="-1" aria-label="Menos">−</button><b>${tv(f)}</b>
      <button data-act="ed-team" data-i="${i}" data-f="${f}" data-d="1" aria-label="Mais">+</button></div></div>`).join('')}
    <button class="st title ${tv('t') ? 'on' : ''}" data-act="ed-team-title" data-i="${i}">${I.trophy.replace('class="ico"', '')}<span class="l">${tv('t') ? 'Campeão' : 'Título?'}</span></button>
  </div>`;
}

function vLancar(date) {
  if (!store.isMaster) {
    return `<a class="back" href="#/inicio">${I.back}Início</a><div class="empty"><h3>Só masters lançam rodadas</h3><p>Entre com CPF e senha de master para continuar.</p><button class="btn primary" data-act="login">Entrar como master</button></div>`;
  }
  let sumRound = date ? store.rounds.find(r => r.id === date && r.summary) : null;
  // resumo novo para um mês sem dados (ex.: #/lancar/resumo-2026-03)
  const mNew = !sumRound && date && /^resumo-(\d{4})-(\d{2})$/.exec(date);
  if (mNew) {
    const yy = +mNew[1], mm = +mNew[2];
    let tues = 0; for (let d = 1; d <= new Date(yy, mm, 0).getDate(); d++) if (new Date(yy, mm - 1, d).getDay() === 2) tues++;
    sumRound = { id: date, date: `${mNew[1]}-${mNew[2]}-01`, summary: true, rounds: tues, entries: {}, note: '' };
  }
  if (sumRound) {
    if (!state.editor || state.editor.origId !== sumRound.id) {
      state.editor = { summary: true, origId: sumRound.id, date: sumRound.date, rounds: sumRound.rounds || 1, entries: JSON.parse(JSON.stringify(sumRound.entries || {})), teams: null, note: sumRound.note || '' };
    }
    return vLancarSummary();
  }
  if (!state.editor || (date && state.editor.date !== date && state.editor.origId !== date)) state.editor = newEditor(date || defaultRoundDate());
  const ed = state.editor;
  view.classList.add('has-savebar');
  const byName = (a, b) => dn(a).localeCompare(dn(b));
  const involved = new Set(Object.keys(ed.entries).filter(id => ed.entries[id].p));
  const pool = store.players.filter(p => p.active !== false || involved.has(p.id));
  let body;
  if (ed.teams && ed.teams.length) {
    const inTeam = new Set(ed.teams.flatMap(t => t.ids));
    body = ed.teams.map((t, i) => `<div class="team-box"><div class="tb-head"><span class="dot" style="background:${TEAM_COLORS[i % 4]}"></span><h3>${esc(t.name || TEAM_NAMES[i])}</h3><span class="hint">vale para o time todo</span></div>
      ${teamResBox(i)}
      ${t.ids.map(playerById).filter(Boolean).map(edPlayer).join('')}</div>`).join('')
      + `<div class="group-title">Outros atletas</div>` + pool.filter(p => !inTeam.has(p.id)).sort(byName).map(edPlayer).join('');
  } else {
    const gk = pool.filter(p => p.pos === 'G').sort(byName), ln = pool.filter(p => p.pos !== 'G').sort(byName);
    body = (ln.length ? `<div class="group-title">Linha</div>${ln.map(edPlayer).join('')}` : '') + (gk.length ? `<div class="group-title">Goleiros</div>${gk.map(edPlayer).join('')}` : '');
  }
  const exists = store.rounds.find(r => r.date === ed.date && !r.summary);
  return `<a class="back" href="#/inicio">${I.back}Início</a>
    <div class="page-head"><div><h1>${ed.origId ? 'Editar rodada' : 'Lançar rodada'}</h1><p>Marque quem jogou e some os números de cada um.</p></div></div>
    <div class="field"><label for="edDate">Data da rodada</label><input class="input" type="date" id="edDate" value="${ed.date}" data-input="ed-date">
      ${exists && exists.id !== ed.origId ? `<span class="warn">Já existe uma rodada nessa data. Salvar vai substituir.</span>` : ''}</div>
    ${pool.length ? body : `<div class="empty"><p>Cadastre os atletas antes de lançar a rodada.</p><a class="btn primary" href="#/atletas">Ir para Atletas</a></div>`}
    <div class="field" style="margin-top:18px"><label for="edNote">Observação (opcional)</label><textarea class="input" id="edNote" data-input="ed-note" placeholder="Ex.: chuva, jogo até 22h, golaço do Fulano">${esc(ed.note)}</textarea></div>
    ${ed.origId ? `<button class="btn danger block" data-act="round-del" data-date="${ed.origId}">Apagar esta rodada</button>` : ''}
    <div class="savebar"><span class="sum" id="edSum">${edSummary()}</span><button class="btn primary" data-act="ed-save">Salvar rodada</button></div>`;
}

function vLancarSummary() {
  const ed = state.editor;
  view.classList.add('has-savebar');
  const mi = +ed.date.slice(5, 7) - 1;
  const byName = (a, b) => dn(a).localeCompare(dn(b));
  const involved = new Set(Object.keys(ed.entries).filter(id => ed.entries[id].p));
  const pool = store.players.filter(p => p.active !== false || involved.has(p.id));
  const on = pool.filter(p => involved.has(p.id)).sort(byName), off = pool.filter(p => !involved.has(p.id)).sort(byName);
  return `<a class="back" href="#/rodada/${esc(ed.origId)}">${I.back}Voltar</a>
    <div class="page-head"><div><h1>Editar ${C.MONTHS[mi].toLowerCase()}</h1><p>Resumo do mês: os números de cada atleta somados no mês inteiro.</p></div></div>
    <div class="team-res" style="grid-template-columns:1fr;max-width:220px;margin-bottom:16px"><div class="st"><span class="l">Rodadas no mês</span><div class="c">
      <button data-act="ed-rounds" data-d="-1" aria-label="Menos rodadas">−</button><b id="edRounds">${ed.rounds}</b>
      <button data-act="ed-rounds" data-d="1" aria-label="Mais rodadas">+</button></div></div></div>
    <div class="group-title">Jogaram no mês</div>${on.map(edPlayer).join('') || '<p class="hint">Ninguém marcado.</p>'}
    <div class="group-title">Outros atletas</div>${off.map(edPlayer).join('')}
    <div class="savebar"><span class="sum" id="edSum">${edSummary()}</span><button class="btn primary" data-act="ed-save">Salvar mês</button></div>`;
}

function edSummary() {
  const es = Object.values(state.editor.entries).filter(e => e.p);
  return `<b>${es.length}</b> presentes<br><b>${es.reduce((s, e) => s + (e.g || 0), 0)}</b> gols`;
}
function refreshPlayer(pid) {
  const p = playerById(pid); const el = $(`#pe-${CSS.escape(pid)}`);
  if (p && el) el.outerHTML = edPlayer(p);
  const s = $('#edSum'); if (s) s.innerHTML = edSummary();
}

// ================= FOLHAS (bottom sheets) =================
function openSheet(html, onMount) {
  sheetRoot.innerHTML = `<div class="sheet-bg" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  sheetRoot.hidden = false;
  document.body.style.overflow = 'hidden';
  if (onMount) onMount($('.sheet', sheetRoot));
  const f = $('.sheet [autofocus]', sheetRoot); if (f) setTimeout(() => f.focus(), 60);
}
function closeSheet() { sheetRoot.hidden = true; sheetRoot.innerHTML = ''; document.body.style.overflow = ''; }

function confirmSheet(title, text, okLabel = 'Confirmar', danger = true) {
  return new Promise(res => {
    openSheet(`<h2>${esc(title)}</h2><p class="muted" style="margin-bottom:18px">${text}</p>
      <div class="btn-row"><button class="btn" id="cfNo">Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cfOk">${esc(okLabel)}</button></div>`, s => {
      $('#cfNo', s).onclick = () => { closeSheet(); res(false); };
      $('#cfOk', s).onclick = () => { closeSheet(); res(true); };
    });
  });
}

// Pede a senha do master logado; roda a ação e mostra o erro ali mesmo se a senha estiver errada
function passwordSheet(title, action) {
  return new Promise(res => {
    openSheet(`<h2>${esc(title)}</h2><p class="muted" style="margin-bottom:14px">Confirme com a sua senha de master.</p>
      <form id="cpForm"><div class="field"><label for="cpPass">Sua senha</label><input class="input" id="cpPass" type="password" autocomplete="current-password" required autofocus></div>
      <p class="warn" id="cpErr" hidden></p>
      <button class="btn primary block" type="submit" id="cpOk">Confirmar e salvar</button>
      <button class="btn ghost block" type="button" id="cpNo" style="margin-top:8px">Cancelar</button></form>`, s => {
      $('#cpNo', s).onclick = () => { closeSheet(); res(false); };
      $('.sheet-bg', sheetRoot).dataset.act = '';
      $('.sheet-bg', sheetRoot).onclick = () => { closeSheet(); res(false); };
      $('#cpForm', s).addEventListener('submit', async ev => {
        ev.preventDefault();
        const btn = $('#cpOk', s), err = $('#cpErr', s);
        btn.disabled = true; btn.textContent = 'Conferindo…'; err.hidden = true;
        try { await action($('#cpPass', s).value); closeSheet(); res(true); }
        catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Confirmar e salvar'; }
      });
    });
  });
}

// Master: escolher o que editar num mês (rodadas lançadas e/ou resumo)
function editMonthSheet(y, m) {
  const key = `${y}-${String(m).padStart(2, '0')}`;
  const rs = C.sortedRounds(store.rounds.filter(r => r.date.startsWith(key))).reverse();
  const sum = rs.find(r => r.summary);
  const item = (href, title, sub) => `<a class="rd" href="${href}" data-act="sheet-close-go"><span class="day"><b style="font-size:20px">${title}</b></span><span class="info">${sub}</span><span class="ico" style="color:var(--texto-3)">${I.edit}</span></a>`;
  openSheet(`<h2>Editar ${C.MONTHS[m - 1].toLowerCase()} de ${y}</h2>
    <p class="muted" style="margin-bottom:14px">Escolha o que corrigir. As estatísticas, o ranking e os prêmios do mês se atualizam na hora.</p>
    <div class="rounds">
      ${rs.filter(r => !r.summary).map(r => item(`#/lancar/${r.id}`, C.fmtDate(r.date, { year: false }), `Rodada: ${Object.values(r.entries || {}).filter(e => e.p).length} presentes`)).join('')}
      ${sum ? item(`#/lancar/${sum.id}`, C.MONTHS_SHORT[m - 1], `Resumo do mês: ${sum.rounds} rodadas, ${Object.keys(sum.entries || {}).length} atletas`) : ''}
      ${!sum ? item(`#/lancar/resumo-${key}`, C.MONTHS_SHORT[m - 1], rs.length ? 'Criar resumo do mês (para somar números que não estão nas rodadas)' : 'Criar resumo do mês com os números de cada atleta') : ''}
      ${item('#/lancar', '+', 'Lançar uma rodada nova')}
    </div>`);
}

function loginSheet() {
  openSheet(`<h2>Entrar como master</h2>
    <form id="loginForm" autocomplete="on">
      <div class="field"><label for="lgCpf">CPF</label><input class="input" id="lgCpf" name="username" inputmode="numeric" autocomplete="username" placeholder="000.000.000-00" maxlength="14" required autofocus></div>
      <div class="field"><label for="lgPass">Senha</label><input class="input" id="lgPass" name="password" type="password" autocomplete="current-password" required></div>
      <p class="warn" id="lgErr" hidden></p>
      <button class="btn primary block" type="submit" id="lgBtn">Entrar</button>
    </form>`, s => {
    const cpf = $('#lgCpf', s);
    cpf.addEventListener('input', () => {
      const d = onlyDigits(cpf.value).slice(0, 11);
      cpf.value = d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
    });
    $('#loginForm', s).addEventListener('submit', async ev => {
      ev.preventDefault();
      const btn = $('#lgBtn', s), err = $('#lgErr', s);
      btn.disabled = true; btn.textContent = 'Entrando…'; err.hidden = true;
      try {
        await store.login(cpf.value, $('#lgPass', s).value);
        closeSheet();
        if (store.mode === 'cloud' && !store.user?.name) nameSheet();
        else toast(`Bem-vindo, ${store.user?.name || 'master'}!`);
      } catch (e) {
        err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Entrar';
      }
    });
  });
}

function nameSheet() {
  openSheet(`<h2>Como você quer aparecer?</h2><p class="muted" style="margin-bottom:14px">Seu nome aparece como autor das rodadas que você lançar.</p>
    <form id="nmForm"><div class="field"><input class="input" id="nmIn" required maxlength="30" placeholder="Ex.: Cícero" autofocus></div>
    <button class="btn primary block" type="submit">Salvar nome</button></form>`, s => {
    $('#nmForm', s).addEventListener('submit', async ev => {
      ev.preventDefault();
      try { await store.setDisplayName($('#nmIn', s).value.trim()); closeSheet(); toast('Nome salvo'); } catch (e) { toast(e.message, true); }
    });
  });
}

let formPhoto = null;
function playerSheet(p) {
  const isNew = !p;
  p = p || { name: '', nick: '', pos: 'L', num: '', level: 3, active: true, photo: '' };
  formPhoto = p.photo || '';
  let pos = p.pos || 'L', level = p.level || 3, active = p.active !== false;
  const wasMaster = !isNew && store.isPlayerMaster(p.id);
  const founder = !isNew && store.commission.some(m => m.playerId === p.id && m.founder);
  const mrec = !isNew ? store.commission.find(m => m.playerId === p.id) : null;
  let masterOn = wasMaster;
  p.cpf = '';
  const fmtCpf = v => { const d = onlyDigits(v).slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4'); };
  const draw = () => `
    <h2>${isNew ? 'Novo atleta' : 'Editar atleta'}</h2>
    <div class="photo-pick">${formPhoto ? `<span class="av"><img src="${formPhoto}" alt=""></span>` : `<span class="av ${colorClass(p.id || 'x')}">${I.person.replace('<svg', '<svg style="width:46px;fill:rgba(255,255,255,.8)"')}</span>`}
      <div class="btn-row" style="flex-direction:column;flex:1">
        <button type="button" class="btn sm" data-pf="photo">${formPhoto ? 'Trocar foto' : 'Escolher foto'}</button>
        ${formPhoto ? '<button type="button" class="btn sm ghost" data-pf="nophoto">Tirar foto</button>' : ''}
      </div></div>
    <div class="field"><label for="pfName">Nome</label><input class="input" id="pfName" required maxlength="40" value="${esc(p.name)}" placeholder="Nome do atleta"></div>
    <div class="field"><label for="pfNick">Apelido</label><input class="input" id="pfNick" maxlength="20" value="${esc(p.nick)}" placeholder="Como a galera chama"><span class="hint">Se preencher, o apelido aparece no lugar do nome.</span></div>
    <div class="field"><span class="lab">Posição</span><div class="seg"><button type="button" class="${pos === 'L' ? 'on' : ''}" data-pf="pos" data-v="L">Linha</button><button type="button" class="${pos === 'G' ? 'on' : ''}" data-pf="pos" data-v="G">Goleiro</button></div></div>
    <div class="field"><label for="pfNum">Número da camisa</label><input class="input" id="pfNum" inputmode="numeric" maxlength="3" value="${esc(p.num)}" placeholder="Opcional"></div>
    <div class="field"><span class="lab">Nível para o sorteio</span><div class="level-pick">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${n <= level ? 'on' : ''}" data-pf="level" data-v="${n}" aria-label="Nível ${n}">${n}</button>`).join('')}</div>
      <span class="hint">Só os masters veem. Serve para equilibrar os times.</span></div>
    <div class="toggle-row"><span><b>No elenco</b><br><span class="hint">Desligue para tirar do álbum e do sorteio sem apagar as estatísticas.</span></span>
      <button type="button" class="switch" role="switch" aria-checked="${active}" data-pf="active" aria-label="No elenco"></button></div>
    <div class="master-box ${masterOn ? 'on' : ''}">
      <div class="toggle-row" style="padding:0"><span><b>Comissão (acesso master)</b><br><span class="hint">Pode lançar rodadas, sortear, editar atletas e compartilhar.</span></span>
        <button type="button" class="switch" role="switch" aria-checked="${masterOn}" data-pf="master" aria-label="Acesso master" ${founder ? 'disabled' : ''}></button></div>
      ${masterOn && !wasMaster ? `<div class="field" style="margin:14px 0 0"><label for="pfCpf">CPF do novo master</label><input class="input" id="pfCpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" value="${esc(p.cpf)}">
        <span class="hint">Ele entra com esse CPF e a senha geral da comissão. Para salvar, você confirma com a sua senha.</span></div>` : ''}
      ${wasMaster ? `<p class="hint" style="margin-top:10px">${founder ? 'Master fundador.' : `Faz parte da comissão${mrec?.cpfEnd ? `, CPF ${maskCpfEnd('000000' + mrec.cpfEnd)}` : ''}${mrec?.addedBy ? `, adicionado por ${esc(mrec.addedBy)}` : ''}.`}${!founder && !masterOn ? ' Ao salvar, ele perde o acesso.' : ''}</p>` : ''}
    </div>
    <button class="btn primary block" data-pf="save">Salvar atleta</button>
    ${isNew ? '' : '<button class="btn danger block" style="margin-top:10px" data-pf="del">Apagar atleta</button>'}`;
  const keep = s => ({ name: $('#pfName', s)?.value ?? p.name, nick: $('#pfNick', s)?.value ?? p.nick, num: $('#pfNum', s)?.value ?? p.num, cpf: $('#pfCpf', s)?.value ?? p.cpf });
  openSheet(`<div id="pfBody">${draw()}</div>`, s => {
    const redraw = () => { Object.assign(p, keep(s)); $('#pfBody', s).innerHTML = draw(); };
    s.addEventListener('input', ev => { if (ev.target.id === 'pfCpf') ev.target.value = fmtCpf(ev.target.value); });
    s.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-pf]'); if (!b) return;
      const a = b.dataset.pf;
      if (a === 'pos') { pos = b.dataset.v; redraw(); }
      if (a === 'level') { level = +b.dataset.v; redraw(); }
      if (a === 'active') { active = !active; b.setAttribute('aria-checked', active); }
      if (a === 'master' && !founder) { masterOn = !masterOn; redraw(); if (masterOn && !wasMaster) setTimeout(() => $('#pfCpf', s)?.focus(), 50); }
      if (a === 'nophoto') { formPhoto = ''; redraw(); }
      if (a === 'photo') {
        const inp = $('#filePhoto'); inp.value = '';
        inp.onchange = async () => {
          const f = inp.files[0]; if (!f) return;
          try { formPhoto = await resizePhoto(f); redraw(); } catch (e) { toast('Não consegui ler essa imagem. Tente outra.', true); }
        };
        inp.click();
      }
      if (a === 'save') {
        const v = keep(s);
        if (!v.name.trim()) { $('#pfName', s).focus(); toast('Coloque o nome do atleta', true); return; }
        const promote = masterOn && !wasMaster, demote = !masterOn && wasMaster;
        if (promote && !validCpf(v.cpf)) { $('#pfCpf', s)?.focus(); toast('CPF inválido. Confira os números.', true); return; }
        const id = p.id || store.newId();
        const data = { id, createdAt: p.createdAt || Date.now(), name: v.name.trim(), nick: v.nick.trim(), num: onlyDigits(v.num), pos, level, active, photo: formPhoto };
        if (promote || demote) {
          const who = data.nick || data.name;
          closeSheet();
          const ok = await passwordSheet(promote ? `Dar acesso master a ${who}` : `Tirar ${who} da comissão`, async pass => {
            await store.confirmPassword(pass);
            await store.savePlayer(data);
            if (promote) await store.addMaster({ cpf: v.cpf, playerId: id, name: who }, pass);
            else await store.removeMaster(id, pass);
          });
          if (ok) toast(promote ? `${who} agora é master` : `${who} saiu da comissão`);
          else toast('Nada foi salvo');
          return;
        }
        b.disabled = true;
        try {
          await store.savePlayer(data);
          closeSheet(); toast(isNew ? 'Atleta cadastrado' : 'Atleta salvo');
        } catch (e) { toast(e.message, true); b.disabled = false; }
      }
      if (a === 'del') {
        closeSheet();
        const ok = await confirmSheet(`Apagar ${dn(p)}?`, 'As estatísticas dele somem dos rankings. Para só tirar do elenco, edite e desligue "No elenco".', 'Apagar atleta');
        if (!ok) return;
        try { await store.deletePlayer(p.id); toast('Atleta apagado'); location.hash = '#/atletas'; } catch (e) { toast(e.message, true); }
      }
    });
  });
}

async function resizePhoto(file, size = 360) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - s) / 2, sy = (img.naturalHeight - s) / 2.6;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, Math.max(0, sy), s, s, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}

// ================= CARDS PARA COMPARTILHAR (tamanho story: 1080 x 1920) =================
// Formatos do Instagram: story 1080x1920 (9:16) e feed 1080x1350 (4:5)
const W = 1080;
let H = 1920, FEED = false;
function setFormat(f) { FEED = f === 'feed'; H = FEED ? 1350 : 1920; }
// Ícones dos prêmios: coroa (craque), chuteira (artilheiro), cartola (garçom)
const AWARD_SVG = {
  crown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M10 47 6 20l14 11 12-20 12 20 14-11-4 27z" fill="#f2c230" stroke="#0a0f1e" stroke-width="3.5" stroke-linejoin="round"/><rect x="9" y="46" width="46" height="9" rx="2.5" fill="#e0a12a" stroke="#0a0f1e" stroke-width="3.5"/><circle cx="32" cy="11" r="4.5" fill="#d63050" stroke="#0a0f1e" stroke-width="3"/><circle cx="6" cy="20" r="4" fill="#d63050" stroke="#0a0f1e" stroke-width="3"/><circle cx="58" cy="20" r="4" fill="#d63050" stroke="#0a0f1e" stroke-width="3"/><circle cx="32" cy="38" r="3.5" fill="#3c8ea6"/></svg>`,
  boot: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M5 40c0-7 3-15 9-18l11-3c2 6 8 10 16 11l13 2c6 1 8 6 6 10l-2 5H8c-2-2-3-4-3-7z" fill="#d63050" stroke="#0a0f1e" stroke-width="3.5" stroke-linejoin="round"/><path d="M14 31c8 4 20 6 33 5" fill="none" stroke="#f2ece0" stroke-width="3.5" stroke-linecap="round"/><path d="M24 23l3 4M29 21l3 4M34 22l2 4" stroke="#f2ece0" stroke-width="2.6" stroke-linecap="round"/><rect x="7" y="47" width="51" height="5" rx="2" fill="#0a0f1e"/><path d="M13 52v6M23 52v6M41 52v6M51 52v6" stroke="#0a0f1e" stroke-width="5" stroke-linecap="round"/></svg>`,
  hat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M18 9h28l-2 35H20z" fill="#1d2232" stroke="#0a0f1e" stroke-width="3.5" stroke-linejoin="round"/><path d="M19.4 33h25.2l-.5 8H19.9z" fill="#d63050"/><ellipse cx="32" cy="46" rx="27" ry="8" fill="#1d2232" stroke="#0a0f1e" stroke-width="3.5"/><path d="M23 13h4l-1 18h-3z" fill="#ffffff" opacity=".22"/></svg>`
};
const awardImgs = {};
async function awardImg(k) {
  if (!awardImgs[k]) awardImgs[k] = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(AWARD_SVG[k]));
  return awardImgs[k];
}
const AWARD_LABEL = { crown: 'Craque do mês', boot: 'Artilheiro do mês', hat: 'Garçom do mês' };

const loadImg = src => new Promise(res => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
const FD = '"Big Shoulders Display", Barlow, sans-serif', FB = 'Barlow, sans-serif';
function fit(x, text, maxW) { let t = text; while (x.measureText(t).width > maxW && t.length > 3) t = t.slice(0, -2) + '…'; return t !== text && !t.endsWith('…') ? t + '…' : t; }

async function cardBase(title, subtitle) {
  await Promise.all(['900 80px "Big Shoulders Display"', '800 40px "Big Shoulders Display"', '600 30px Barlow', '700 30px Barlow'].map(f => document.fonts.load(f, 'Capelota 0123'))).catch(() => {});
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#0a0f1e'; x.fillRect(0, 0, W, H);
  let g = x.createRadialGradient(1000, 100, 40, 1000, 100, 1100); g.addColorStop(0, 'rgba(214,48,80,.45)'); g.addColorStop(1, 'rgba(214,48,80,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  g = x.createRadialGradient(0, H, 40, 0, H, 1100); g.addColorStop(0, 'rgba(58,97,136,.5)'); g.addColorStop(1, 'rgba(58,97,136,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const pat = ['#d63050', '#3c8ea6', '#f2ece0', '#3c8ea6'], wd = [36, 16, 8, 16];
  for (let px = 0, i = 0; px < W; px += wd[i % 4], i++) { x.fillStyle = pat[i % 4]; x.fillRect(px, H - 28, wd[i % 4], 28); }
  const logo = await loadImg('icons/logo-512.png');
  const oy = FEED ? -40 : 0, ls = FEED ? 130 : 160;
  if (logo) x.drawImage(logo, 60, 90 + oy, ls, ls * logo.height / logo.width);
  x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  const tx = 60 + ls + 20;
  x.fillStyle = '#f2ece0'; x.font = `900 ${FEED ? 80 : 92}px ${FD}`; x.fillText('Capelota', tx, 175 + oy - (FEED ? 8 : 0));
  x.fillStyle = '#a7b0c5'; x.font = `600 ${FEED ? 30 : 34}px ${FB}`; x.fillText(subtitle, tx + 3, 225 + oy - (FEED ? 12 : 0));
  x.fillStyle = '#ff7088'; x.font = `600 ${FEED ? 32 : 36}px ${FB}`; x.textAlign = 'right'; x.fillText(title, 1020, 175 + oy - (FEED ? 8 : 0)); x.textAlign = 'left';
  return { c, x };
}

async function drawSticker(x, p, cx, cy, w, h, rot) {
  x.save(); x.translate(cx, cy); x.rotate(rot);
  x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 40; x.shadowOffsetY = 18;
  x.fillStyle = '#f2ece0'; rr(x, -w / 2, -h / 2, w, h, w * 0.04); x.fill();
  x.shadowColor = 'transparent';
  const pad = w * 0.03, band = h * 0.17, phH = h - band - pad * 1.6;
  x.save(); rr(x, -w / 2 + pad, -h / 2 + pad, w - pad * 2, phH, w * 0.025); x.clip();
  const g = x.createLinearGradient(0, -h / 2, 0, -h / 2 + phH); g.addColorStop(0, '#3a6188'); g.addColorStop(1, '#22395a');
  x.fillStyle = g; x.fillRect(-w / 2, -h / 2, w, h);
  const img = await loadImg(p.photo);
  if (img) x.drawImage(img, -w / 2 + pad, -h / 2 + pad, w - pad * 2, phH);
  else { x.fillStyle = 'rgba(255,255,255,.78)'; x.font = `900 ${Math.round(w * 0.38)}px ${FD}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(initials(p), 0, -h / 2 + pad + phH / 2); x.textBaseline = 'alphabetic'; x.textAlign = 'left'; }
  x.restore();
  if (p.num) {
    const r = w * 0.07, bx = -w / 2 + pad + r + 12, by = -h / 2 + pad + r + 12;
    x.fillStyle = '#d63050'; x.beginPath(); x.arc(bx, by, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.font = `900 ${Math.round(r * 1.15)}px ${FD}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(p.num, bx, by + 2); x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  }
  x.fillStyle = '#0a0f1e'; x.fillRect(-w / 2, h / 2 - band, w, band);
  x.fillStyle = '#d63050'; x.fillRect(-w / 2, h / 2 - band, w, Math.max(6, band * 0.08));
  x.fillStyle = '#f2ece0'; x.font = `900 ${Math.round(band * 0.55)}px ${FD}`; x.textAlign = 'center';
  x.fillText(fit(x, dn(p), w - 40), 0, h / 2 - band * 0.3); x.textAlign = 'left';
  x.restore();
}

async function drawBadge(x, kind, cx, cy, r) {
  x.save();
  x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 16; x.shadowOffsetY = 6;
  x.fillStyle = '#f2ece0'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  x.shadowColor = 'transparent';
  x.lineWidth = Math.max(3, r * 0.09); x.strokeStyle = kind === 'crown' ? '#f2c230' : '#d63050'; x.stroke();
  const img = await awardImg(kind);
  if (img) x.drawImage(img, cx - r * 0.72, cy - r * 0.72, r * 1.44, r * 1.44);
  x.restore();
}

async function drawAvatar(x, p, cx, cy, r, ring) {
  x.save();
  x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 24; x.shadowOffsetY = 10;
  x.fillStyle = ring; x.beginPath(); x.arc(cx, cy, r + 7, 0, Math.PI * 2); x.fill();
  x.shadowColor = 'transparent';
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();
  const g = x.createLinearGradient(0, cy - r, 0, cy + r); g.addColorStop(0, '#3a6188'); g.addColorStop(1, '#22395a');
  x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  const img = await loadImg(p.photo);
  if (img) x.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  else { x.fillStyle = '#fff'; x.font = `900 ${Math.round(r * 0.8)}px ${FD}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(initials(p), cx, cy + 3); }
  x.restore();
}

function statTiles(x, items, y, th = 190) {
  const n = items.length, gap = 18, w = (960 - gap * (n - 1)) / n, k = th / 190;
  items.forEach(([v, l], i) => {
    const px = 60 + i * (w + gap);
    x.fillStyle = 'rgba(24,35,60,.92)'; rr(x, px, y, w, th, 24); x.fill();
    x.strokeStyle = '#27365a'; x.lineWidth = 2; x.stroke();
    x.fillStyle = '#f2ece0'; x.font = `900 ${Math.round((String(v).length > 3 ? 72 : 92) * k)}px ${FD}`; x.textAlign = 'center'; x.fillText(String(v), px + w / 2, y + 112 * k);
    x.fillStyle = '#a7b0c5'; x.font = `600 ${Math.round(30 * k)}px ${FB}`; x.fillText(l, px + w / 2, y + 160 * k); x.textAlign = 'left';
  });
}

async function canvasFile(c, name) {
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return new File([blob], name, { type: 'image/png' });
}
async function shareFiles(files) {
  if (navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ files, title: 'Capelota' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  for (const f of files) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    await new Promise(r => setTimeout(r, 400));
  }
  toast(files.length > 1 ? 'Imagens baixadas' : 'Imagem baixada');
}

async function sharePlayer(id, fmt) {
  const p = playerById(id); if (!p) return;
  setFormat(fmt);
  const per = state.pers.prof;
  const { totals: T } = C.aggregate(store.rounds, store.players, per, store.settings);
  const t = T[p.id] || C.zero();
  const { c, x } = await cardBase(C.periodLabel(per), 'Terças, 19h');
  const items = p.pos === 'G' ? [[t.p, 'Presenças'], [t.cs, 'Sem sofrer'], [t.g, 'Gols'], [t.pts, 'Pontos']] : [[t.p, 'Presenças'], [t.g, 'Gols'], [t.a, 'Assist.'], [t.pts, 'Pontos']];
  if (FEED) {
    await drawSticker(x, p, 540, 605, 540, 690, -0.04);
    statTiles(x, items, 1010, 180);
    if (p.pos !== 'G') { x.fillStyle = '#a7b0c5'; x.font = `600 30px ${FB}`; x.textAlign = 'center'; x.fillText(`${t.w} vitórias, ${t.d} empates, ${t.l} derrotas, ${t.t} títulos`, 540, 1255); x.textAlign = 'left'; }
  } else {
    await drawSticker(x, p, 540, 860, 720, 920, -0.04);
    statTiles(x, items, 1450);
    if (p.pos !== 'G') statTiles(x, [[t.w, 'Vitórias'], [t.d, 'Empates'], [t.l, 'Derrotas'], [t.t, 'Títulos']], 1662);
  }
  await shareFiles([await canvasFile(c, `capelota-${dn(p).toLowerCase().replace(/\W+/g, '-')}-${FEED ? 'feed' : 'story'}.png`)]);
}

// Quem leva cada ícone no mês
function monthBadges(A) {
  const b = {};
  const add = (id, k) => { (b[id] = b[id] || []).push(k); };
  if (A.mvp) add(A.mvp.id, 'crown');
  A.artilheiro.forEach(p => add(p.id, 'boot'));
  A.garcom.forEach(p => add(p.id, 'hat'));
  return b;
}

async function cardTimeIdeal(A) {
  const T = A.totals, { y, m } = A, badges = monthBadges(A);
  const { c, x } = await cardBase(`${C.MONTHS[m - 1]} ${y}`, 'Time ideal do mês');
  // campo
  const fx = 50, fy = FEED ? 220 : 300, fw = 980, fh = FEED ? 900 : 1290;
  x.save(); rr(x, fx, fy, fw, fh, 36); x.clip();
  for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? '#12303a' : '#0f2a33'; x.fillRect(fx, fy + i * fh / 12, fw, fh / 12 + 1); }
  x.strokeStyle = 'rgba(242,236,224,.2)'; x.lineWidth = 4;
  rr(x, fx + 24, fy + 24, fw - 48, fh - 48, 10); x.stroke();
  x.beginPath(); x.arc(fx + fw / 2, fy + 24, FEED ? 95 : 120, 0, Math.PI); x.stroke();
  const ah = FEED ? 120 : 170, gh = FEED ? 50 : 70;
  x.strokeRect(fx + fw / 2 - 210, fy + fh - 24 - ah, 420, ah);
  x.strokeRect(fx + fw / 2 - 100, fy + fh - 24 - gh, 200, gh);
  x.restore();
  const line = A.time.line, rows = FORMATION[line.length] || [line.length];
  const nRows = rows.length + (A.time.gk ? 1 : 0);
  const top = fy + (FEED ? 105 : 150), bottom = fy + fh - (FEED ? 140 : 170), step = nRows > 1 ? (bottom - top) / (nRows - 1) : 0;
  const R = FEED ? (nRows > 3 ? 56 : 66) : (line.length > 6 ? 78 : 92);
  const k0 = FEED ? 0.8 : 1;
  const spots = []; let k = 0;
  rows.forEach((n, ri) => { const ps = line.slice(k, k += n); ps.forEach((p, i) => spots.push({ p, cx: fx + fw * (i + 1) / (n + 1), cy: top + ri * step })); });
  if (A.time.gk) spots.push({ p: A.time.gk, cx: fx + fw / 2, cy: top + rows.length * step, gk: true });
  for (const s of spots) {
    await drawAvatar(x, s.p, s.cx, s.cy, R, s.gk ? '#3c8ea6' : '#f2ece0');
    const bs = badges[s.p.id] || [];
    for (let i = 0; i < bs.length; i++) {
      const ang = -Math.PI / 4 - i * 0.75;
      await drawBadge(x, bs[i], s.cx + Math.cos(ang) * (R + 8), s.cy + Math.sin(ang) * (R + 8), Math.round(40 * k0));
    }
    x.font = `800 ${Math.round(36 * k0)}px ${FD}`; x.textAlign = 'center';
    const nm = fit(x, dn(s.p), 230), tw = x.measureText(nm).width;
    const lh = Math.round(50 * k0);
    x.fillStyle = 'rgba(10,15,30,.86)'; rr(x, s.cx - tw / 2 - 14, s.cy + R + 14, tw + 28, lh, 12); x.fill();
    x.fillStyle = '#f2ece0'; x.fillText(nm, s.cx, s.cy + R + 14 + lh * 0.76);
    x.fillStyle = '#c9cfdc'; x.font = `600 ${Math.round(26 * k0)}px ${FB}`; x.fillText(`${T[s.p.id].pts} pts`, s.cx, s.cy + R + 14 + lh + 30 * k0);
    x.textAlign = 'left';
  }
  // legenda
  const leg = [['crown', A.mvp ? `${dn(A.mvp)}` : '–', 'Craque'], ['boot', A.artilheiro.length ? `${A.artilheiro.map(dn).join(', ')} (${T[A.artilheiro[0].id].g})` : '–', 'Artilheiro'], ['hat', A.garcom.length ? `${A.garcom.map(dn).join(', ')} (${T[A.garcom[0].id].a})` : '–', 'Garçom']];
  if (FEED) {
    for (let i = 0; i < leg.length; i++) {
      const [kind, who, lab] = leg[i], lx = 60 + i * 330;
      await drawBadge(x, kind, lx + 30, 1215, 30);
      x.fillStyle = '#a7b0c5'; x.font = `600 24px ${FB}`; x.fillText(lab, lx + 72, 1203);
      x.fillStyle = '#f2ece0'; x.font = `700 28px ${FB}`; x.fillText(fit(x, who, 245), lx + 72, 1239);
    }
  } else {
    let ly = 1640;
    for (const [kind, who, lab] of leg) {
      await drawBadge(x, kind, 98, ly + 30, 34);
      x.fillStyle = '#a7b0c5'; x.font = `600 28px ${FB}`; x.fillText(lab, 150, ly + 18);
      x.fillStyle = '#f2ece0'; x.font = `700 34px ${FB}`; x.fillText(fit(x, who, 860), 150, ly + 56);
      ly += 82;
    }
  }
  return canvasFile(c, `capelota-time-ideal-${y}-${String(m).padStart(2, '0')}-${FEED ? 'feed' : 'story'}.png`);
}

async function cardDestaques(A) {
  const T = A.totals, { y, m } = A;
  const { c, x } = await cardBase(`${C.MONTHS[m - 1]} ${y}`, 'Destaques do mês');
  const mvp = A.mvp;
  // craque
  const L = FEED
    ? { sx: 250, sy: 480, sw: 330, sh: 420, bx: 395, by: 285, br: 50, tx: 470, k: 0.85, t0: 380 }
    : { sx: 330, sy: 690, sw: 440, sh: 560, bx: 515, by: 430, br: 62, tx: 600, k: 1, t0: 520 };
  await drawSticker(x, mvp, L.sx, L.sy, L.sw, L.sh, -0.05);
  await drawBadge(x, 'crown', L.bx, L.by, L.br);
  const k = L.k, t0 = L.t0;
  x.fillStyle = '#ff7088'; x.font = `600 ${Math.round(36 * k)}px ${FB}`; x.fillText('Craque do mês', L.tx, t0);
  x.fillStyle = '#f2ece0'; x.font = `900 ${Math.round(96 * k)}px ${FD}`; x.fillText(fit(x, dn(mvp), 1020 - L.tx), L.tx - 4, t0 + 95 * k);
  x.font = `900 ${Math.round(150 * k)}px ${FD}`; x.fillText(String(T[mvp.id].pts), L.tx - 4, t0 + 255 * k);
  x.fillStyle = '#a7b0c5'; x.font = `800 ${Math.round(44 * k)}px ${FD}`; x.fillText('pontos', L.tx, t0 + 310 * k);
  x.fillStyle = '#c9cfdc'; x.font = `600 ${Math.round(32 * k)}px ${FB}`;
  x.fillText(mvp.pos === 'G' ? `${T[mvp.id].cs} sem sofrer gol` : `${T[mvp.id].g} gols, ${T[mvp.id].a} assist.`, L.tx, t0 + 370 * k);
  x.fillText(`${T[mvp.id].p} presenças`, L.tx, t0 + 416 * k);
  // artilheiro e garçom
  const B = FEED
    ? { by: 765, bh: 530, lab: 56, scy: 235, sw: 210, sh: 270, bdx: 95, bdy: 110, bdr: 40, vy: 470, vf: 96, uy: 512 }
    : { by: 1060, bh: 760, lab: 70, scy: 330, sw: 300, sh: 380, bdx: 140, bdy: 150, bdr: 50, vy: 660, vf: 120, uy: 712 };
  const box = async (kind, list, val, unit, bx) => {
    const by = B.by, bw = 470, bh = B.bh;
    x.fillStyle = 'rgba(24,35,60,.9)'; rr(x, bx, by, bw, bh, 32); x.fill(); x.strokeStyle = '#27365a'; x.lineWidth = 2; x.stroke();
    x.fillStyle = '#ff7088'; x.font = `600 ${FEED ? 30 : 34}px ${FB}`; x.textAlign = 'center'; x.fillText(AWARD_LABEL[kind], bx + bw / 2, by + B.lab); x.textAlign = 'left';
    if (!list.length) { x.fillStyle = '#6f7a94'; x.font = `600 34px ${FB}`; x.textAlign = 'center'; x.fillText('Ninguém ainda', bx + bw / 2, by + bh / 2); x.textAlign = 'left'; return; }
    const p = list[0];
    await drawSticker(x, p, bx + bw / 2, by + B.scy, B.sw, B.sh, kind === 'boot' ? -0.04 : 0.04);
    await drawBadge(x, kind, bx + bw / 2 + B.bdx, by + B.bdy, B.bdr);
    x.textAlign = 'center';
    x.fillStyle = '#f2ece0'; x.font = `900 ${B.vf}px ${FD}`; x.fillText(String(val), bx + bw / 2, by + B.vy);
    x.fillStyle = '#a7b0c5'; x.font = `700 ${FEED ? 28 : 32}px ${FB}`; x.fillText(list.length > 1 ? `${unit}, empatados: ${list.length}` : unit, bx + bw / 2, by + B.uy);
    x.textAlign = 'left';
  };
  await box('boot', A.artilheiro, A.artilheiro.length ? T[A.artilheiro[0].id].g : 0, 'gols', 50);
  await box('hat', A.garcom, A.garcom.length ? T[A.garcom[0].id].a : 0, 'assistências', 560);
  return canvasFile(c, `capelota-destaques-${y}-${String(m).padStart(2, '0')}-${FEED ? 'feed' : 'story'}.png`);
}

async function shareMonth(fmt) {
  const { y, m } = state.awards;
  const A = C.monthAwards(store.rounds, store.players, y, m, store.settings);
  if (!A.mvp) return;
  setFormat(fmt);
  toast('Montando as imagens…');
  const files = [await cardTimeIdeal(A), await cardDestaques(A)];
  await shareFiles(files);
}

// Pergunta onde vai postar: feed (4:5) ou story (9:16)
function askFormat(title) {
  return new Promise(res => {
    openSheet(`<h2>${esc(title)}</h2><p class="muted" style="margin-bottom:16px">Onde você vai postar no Instagram?</p>
      <div class="fmt-pick">
        <button class="fmt" data-fmt="feed"><span class="shape feed"></span><b>Feed</b><span>1080 × 1350</span></button>
        <button class="fmt" data-fmt="story"><span class="shape story"></span><b>Story</b><span>1080 × 1920</span></button>
      </div>
      <button class="btn ghost block" style="margin-top:12px" data-fmt="">Cancelar</button>`, s => {
      s.addEventListener('click', ev => {
        const b = ev.target.closest('[data-fmt]'); if (!b) return;
        closeSheet(); res(b.dataset.fmt || null);
      });
    });
  });
}

// ================= BACKUP =================
function downloadBackup() {
  const data = store.exportAll();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const name = `capelota-backup-${C.isoDate(now())}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  const isMobile = /android|iphone|ipad/i.test(navigator.userAgent);
  if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Backup Capelota' }).catch(() => {});
    return;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Backup baixado');
}

function restoreBackup() {
  const inp = $('#fileBackup'); inp.value = '';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); } catch (e) { toast('Esse arquivo não é um backup válido.', true); return; }
    if (data?.app !== 'capelota') { toast('Esse arquivo não é um backup do Capelota.', true); return; }
    const when = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('pt-BR') : 'data desconhecida';
    const ok = await confirmSheet('Restaurar backup?', `Backup de ${esc(when)} com ${data.players?.length || 0} atletas e ${data.rounds?.length || 0} rodadas. Isso substitui todos os dados atuais${store.mode === 'cloud' ? ' para todo mundo' : ''}.`, 'Restaurar backup');
    if (!ok) return;
    try { const r = await store.importAll(data); toast(`Backup restaurado: ${r.players} atletas e ${r.rounds} rodadas`); } catch (e) { toast(e.message, true); }
  };
  inp.click();
}

// ================= AÇÕES =================
const actions = {
  'per-type': el => { setPerType(el.dataset.key, el.dataset.type); render(); },
  'per-step': el => { stepPer(el.dataset.key, +el.dataset.d); render(); },
  'rank-group': el => { state.rankGroup = el.dataset.g; render(); },
  'rank-stat': el => { state.rankStat = el.dataset.k; render(); },
  'album-filter': el => { state.albumFilter = el.dataset.f; render(); },
  'player-new': () => store.isMaster ? playerSheet(null) : loginSheet(),
  'player-edit': el => playerSheet(JSON.parse(JSON.stringify(playerById(el.dataset.id)))),
  'share-player': async el => {
    const fmt = await askFormat('Compartilhar figurinha'); if (!fmt) return;
    el.disabled = true; try { await sharePlayer(el.dataset.id, fmt); } finally { el.disabled = false; }
  },
  'share-month': async el => {
    const fmt = await askFormat('Compartilhar prêmios do mês'); if (!fmt) return;
    el.disabled = true; try { await shareMonth(fmt); } finally { el.disabled = false; }
  },
  'login': () => loginSheet(),
  'logout': async () => { await store.logout(); toast('Você saiu do acesso master'); },
  'sheet-close': () => closeSheet(),
  'backup': () => downloadBackup(),
  'restore': () => { if (!store.isMaster) return loginSheet(); restoreBackup(); },
  'install': async () => { const p = state.installPrompt; if (!p) return; p.prompt(); await p.userChoice.catch(() => {}); state.installPrompt = null; render(); },
  'save-weights': async () => {
    const wts = { ...store.settings.weights };
    $$('[data-w]').forEach(i => { const v = parseInt(i.value, 10); if (!isNaN(v)) wts[i.dataset.w] = v; });
    const sc = state.scoringDraft || store.settings.scoring || 'capelota';
    const perIn = sc === 'capelota' ? $('[data-per2]') : $('[data-per]');
    const per = Math.min(10, Math.max(1, parseInt(perIn.value, 10) || 5));
    try { await store.saveSettings({ ...store.settings, weights: wts, perTeam: per, scoring: sc }); state.scoringDraft = null; toast('Pontuação salva'); } catch (e) { toast(e.message, true); }
  },
  'scoring': el => {
    state.scoringDraft = el.dataset.v;
    $$('[data-act=scoring]').forEach(b => b.classList.toggle('on', b === el));
    const ws = $$('.weights'); ws[0].hidden = el.dataset.v === 'capelota'; ws[1].hidden = el.dataset.v !== 'capelota';
  },
  'load-seed': async () => {
    try {
      const data = await store.fetchSeed();
      const ok = await confirmSheet('Carregar dados da planilha?', `São ${data.players.length} atletas e o resumo de ${data.rounds.length} meses de 2026. Isso substitui os dados atuais${store.mode === 'cloud' ? ' para todo mundo' : ' deste aparelho'}.`, 'Carregar dados', false);
      if (!ok) return;
      const r = await store.importAll(data); toast(`Dados da planilha carregados: ${r.players} atletas`);
    } catch (e) { toast(e.message, true); }
  },
  'edit-month': el => editMonthSheet(+el.dataset.y, +el.dataset.m),
  'sheet-close-go': el => { closeSheet(); location.hash = el.getAttribute('href'); },
  'aw-step': el => {
    let { y, m } = state.awards; m += +el.dataset.d;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    state.awards = { y, m }; render(); window.scrollTo(0, 0);
  },
  'aw-go': el => { state.awards = { y: +el.dataset.y, m: +el.dataset.m }; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },

  // sorteio
  'draw-toggle': el => { const id = el.dataset.id; state.draw.sel.has(id) ? state.draw.sel.delete(id) : state.draw.sel.add(id); saveDraw(); state.draw.animate = false; render(); },
  'draw-all': () => { store.players.filter(p => p.active !== false).forEach(p => state.draw.sel.add(p.id)); saveDraw(); render(); },
  'draw-none': () => { state.draw.sel.clear(); state.draw.result = null; saveDraw(); render(); },
  'draw-last': () => {
    const r = C.sortedRounds(realRounds())[0] || C.sortedRounds(store.rounds)[0];
    if (!r) { toast('Ainda não tem rodada lançada', true); return; }
    state.draw.sel = new Set(Object.keys(r.entries || {}).filter(id => r.entries[id].p && playerById(id)?.active !== false));
    saveDraw(); render();
  },
  'draw-n': el => { state.draw.n = +el.dataset.n; saveDraw(); render(); },
  'draw-mode': el => { state.draw.mode = el.dataset.m; saveDraw(); render(); },
  'draw-go': () => {
    const ps = [...state.draw.sel].map(playerById).filter(Boolean);
    if (ps.length < state.draw.n) { toast('Marque mais atletas', true); return; }
    state.draw.result = C.drawTeams(ps, state.draw.n, state.draw.mode).map(t => t.map(p => p.id));
    state.draw.animate = true; render();
    setTimeout(() => $('#drawResult')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  },
  'draw-share': async () => {
    const text = drawShareText();
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  },
  'draw-publish': async el => {
    const teams = state.draw.result.map((ids, i) => ({ name: TEAM_NAMES[i], ids }));
    const n = now(); const date = C.isoDate(n.getDay() === 2 ? n : C.nextGame(n));
    el.disabled = true;
    try { await store.saveDraw({ date, teams }); toast('Times publicados para a galera'); } catch (e) { toast(e.message, true); el.disabled = false; }
  },
  'draw-to-round': () => {
    const teams = state.draw.result.map((ids, i) => ({ name: TEAM_NAMES[i], ids }));
    state.editor = newEditor(defaultRoundDate(), teams);
    location.hash = '#/lancar';
  },

  // editor
  'ed-toggle': el => {
    const pid = el.dataset.pid; const e = edEntry(pid); e.p = e.p ? 0 : 1;
    // se a pessoa está num time, herda o resultado do time
    if (e.p && state.editor.teams) {
      const ti = state.editor.teams.findIndex(t => t.ids.includes(pid));
      if (ti >= 0 && playerById(pid)?.pos !== 'G') {
        const mate = state.editor.teams[ti].ids.map(id => state.editor.entries[id]).find(x => x && x.p && x !== e && (x.w || x.d || x.l || x.t));
        if (mate) ['w', 'd', 'l', 't'].forEach(f => { e[f] = mate[f] || 0; });
      }
    }
    refreshPlayer(pid);
  },
  'ed-step': el => {
    const { pid, f } = el.dataset; const e = edEntry(pid);
    e[f] = Math.max(0, Math.min(99, (e[f] || 0) + +el.dataset.d));
    const b = document.getElementById(`v-${pid}-${f}`); if (b) b.textContent = e[f];
    const s = $('#edSum'); if (s) s.innerHTML = edSummary();
  },
  'ed-rounds': el => {
    state.editor.rounds = Math.max(1, Math.min(6, state.editor.rounds + +el.dataset.d));
    const b = $('#edRounds'); if (b) b.textContent = state.editor.rounds;
  },
  'ed-title': el => { const e = edEntry(el.dataset.pid); e.t = e.t ? 0 : 1; refreshPlayer(el.dataset.pid); },
  'ed-team': el => {
    const i = +el.dataset.i, f = el.dataset.f, ed = state.editor;
    const members = ed.teams[i].ids.filter(id => playerById(id)?.pos !== 'G');
    const cur = members.map(id => ed.entries[id]).find(e => e && e.p)?.[f] || 0;
    const nv = Math.max(0, Math.min(99, cur + +el.dataset.d));
    members.forEach(id => { const e = edEntry(id); if (e.p) e[f] = nv; });
    render();
  },
  'ed-team-title': el => {
    const i = +el.dataset.i, ed = state.editor;
    const members = ed.teams[i].ids.filter(id => playerById(id)?.pos !== 'G');
    const cur = members.map(id => ed.entries[id]).find(e => e && e.p)?.t || 0;
    members.forEach(id => { const e = edEntry(id); if (e.p) e.t = cur ? 0 : 1; });
    render();
  },
  'ed-save': async el => {
    const ed = state.editor;
    if (ed.summary) {
      const entries = {};
      Object.entries(ed.entries).forEach(([id, e]) => {
        if (!e.p) return;
        const clean = {}; C.FIELDS.forEach(f => { if (e[f]) clean[f] = e[f]; }); entries[id] = clean;
      });
      el.disabled = true;
      try {
        const rounds = Math.max(ed.rounds, ...Object.values(entries).map(e => e.p), 1);
        const r = await store.saveRound({ id: ed.origId, date: ed.date, summary: true, rounds, entries, note: ed.note || '' }, ed.origId);
        const id = ed.origId; state.editor = null;
        toast(r === 'queued' ? 'Salvo. Sincroniza quando a internet voltar.' : 'Mês salvo');
        location.hash = '#/rodada/' + id;
      } catch (e) { toast(e.message, true); el.disabled = false; }
      return;
    }
    if (!ed.date) { toast('Escolha a data da rodada', true); return; }
    const entries = {};
    Object.entries(ed.entries).forEach(([id, e]) => {
      if (!e.p) return;
      const clean = { p: 1 };
      C.FIELDS.forEach(f => { if (f !== 'p' && e[f]) clean[f] = e[f]; });
      entries[id] = clean;
    });
    if (!Object.keys(entries).length) { toast('Marque pelo menos um atleta presente', true); return; }
    const exists = store.rounds.find(r => r.date === ed.date && !r.summary);
    if (exists && exists.id !== ed.origId) {
      const ok = await confirmSheet('Substituir rodada?', `Já existe uma rodada em ${C.fmtDate(ed.date)}. Salvar agora troca os números dela por estes.`, 'Substituir');
      if (!ok) return;
    }
    el.disabled = true;
    try {
      const round = { date: ed.date, entries, note: ed.note || '' };
      if (ed.teams && ed.teams.length) round.teams = ed.teams.map(t => ({ name: t.name, ids: [...t.ids] }));
      const r = await store.saveRound(round, ed.origId);
      const date = ed.date;
      state.editor = null;
      toast(r === 'queued' ? 'Rodada salva. Sincroniza quando a internet voltar.' : 'Rodada salva');
      state.pers.dash = { ...state.pers.dash, type: 'round', date };
      location.hash = '#/rodada/' + date;
    } catch (e) { toast(e.message, true); el.disabled = false; }
  },
  'round-del': async el => {
    const date = el.dataset.date;
    const rr0 = roundById(date);
    const ok = await confirmSheet(rr0?.summary ? 'Apagar resumo do mês?' : 'Apagar rodada?', `${rr0?.summary ? 'O resumo de ' + C.MONTHS[+rr0.date.slice(5, 7) - 1].toLowerCase() : 'A rodada de ' + C.fmtDate(rr0?.date || date)} e todos os números somem das estatísticas.`, 'Apagar');
    if (!ok) return;
    try { await store.deleteRound(date); state.editor = null; toast('Apagado'); location.hash = '#/inicio'; } catch (e) { toast(e.message, true); }
  }
};

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) { ev.preventDefault(); fn(el, ev); }
});

document.addEventListener('input', ev => {
  const k = ev.target.dataset?.input;
  if (k === 'search') {
    state.search = ev.target.value;
    // atualiza só o álbum para não perder o foco
    const { totals: T } = C.aggregate(store.rounds, store.players, { type: 'year', y: thisY() }, store.settings);
    const q = state.search.trim().toLowerCase(), f = state.albumFilter;
    const list = store.players.filter(p => f === 'all' || (f === 'G' ? p.pos === 'G' : p.pos !== 'G'))
      .filter(p => !q || (p.name + ' ' + (p.nick || '')).toLowerCase().includes(q)).sort((a, b) => dn(a).localeCompare(dn(b)));
    $('#albumBody').innerHTML = albumBody(list.filter(p => p.active !== false), list.filter(p => p.active === false), p => figurinha(p, { totals: T[p.id] || C.zero() }));
  }
  if (k === 'ed-note' && state.editor) state.editor.note = ev.target.value;
  if (k === 'team-search') {
    const q = ev.target.value.trim().toLowerCase();
    $$('#pubTeams .team').forEach(t => {
      let hit = false;
      $$('li', t).forEach(li => { const m = q && li.textContent.toLowerCase().includes(q); li.classList.toggle('hit', !!m); hit = hit || m; });
      t.classList.toggle('dim', !!q && !hit);
    });
  }
});
document.addEventListener('change', ev => {
  if (ev.target.dataset?.input === 'ed-date' && state.editor) {
    const d = ev.target.value; if (!d) return;
    const ex = store.rounds.find(r => r.date === d && !r.summary);
    if (ex && ex.id !== state.editor.origId && !state.editor.teams && !Object.values(state.editor.entries).some(e => e.p)) {
      state.editor = newEditor(d); toast(`Abri a rodada de ${C.fmtDate(d)} para editar`);
    } else state.editor.date = d;
    render();
  }
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !sheetRoot.hidden) closeSheet(); });

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.installPrompt = e; if (route().name === 'ajustes') render(); });

setInterval(() => { if (route().name === 'inicio' && !sheetRoot.innerHTML) { const y = window.scrollY; render(); window.scrollTo(0, y); } }, 60000);

// ================= início =================
(async () => {
  if (!location.hash) history.replaceState(null, '', '#/inicio');
  render();
  await store.init();
  firstData();
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => {});
    // quando sai versão nova do app, recarrega sozinho uma vez
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  }
})();

// iPhone: bloqueia o zoom de pinça e de toque duplo
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
let lastTouch = 0;
document.addEventListener('touchend', e => { const t = Date.now(); if (t - lastTouch < 320) e.preventDefault(); lastTouch = t; }, { passive: false });
