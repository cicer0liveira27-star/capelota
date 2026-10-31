// Controle de caixa da Capelota (só masters): mensalidades, diárias, despesas e resultado do mês.
export const DEFAULT_PRICES = { mensal: 50, diaria: 17 };
export const EXPENSE_CATS = ['Aluguel do Campo', 'Goleiros', 'Água'];
// Tipos de despesa e receita. freq: 'mes' (todo mês), 'pelada' (toda pelada) ou 'avulsa' (lança quando acontece)
export const FREQS = { mes: 'Todo mês', pelada: 'Toda pelada', avulsa: 'Avulsa' };
export const DEFAULT_CONFIG = {
  exp: [
    { name: 'Aluguel do Campo', amount: 900, freq: 'mes' },
    { name: 'Goleiros', amount: 50, freq: 'pelada' },
    { name: 'Água', amount: 8, freq: 'pelada' }
  ],
  inc: []
};
export const CONFIG_ID = '_config';
// Nome que aparece para um lançamento: o tipo (se tiver) ou a descrição
export const entryLabel = x => (x.cat && x.cat !== 'Outros') ? x.cat + (x.desc ? ' · ' + x.desc : '') : (x.desc || 'Sem descrição');
const entryGroup = x => (x.cat && x.cat !== 'Outros') ? x.cat : (x.desc || 'Sem descrição');
export function getConfig(finance) {
  const c = finance?.[CONFIG_ID] || {};
  // "Outros" deixou de existir: lançamento sem tipo usa a própria descrição
  const clean = l => l.filter(t => !(t.name === 'Outros' && !(+t.amount)));
  return { exp: clean(c.exp || DEFAULT_CONFIG.exp), inc: clean(c.inc || DEFAULT_CONFIG.inc) };
}
const isMonthKey = k => /^\d{4}-\d{2}$/.test(k);
export const METHODS = ['PIX', 'Dinheiro', 'Cartão'];

// O caixa só conta a partir de outubro/2026: meses anteriores ficam fora das contas (todos quitados)
export const FINANCE_START = '2026-10';

export const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const monthKey = (y, m) => `${y}-${String(m).padStart(2, '0')}`;

export function emptyMonth(prices) {
  return { prices: { ...DEFAULT_PRICES, ...(prices || {}) }, fees: {}, daily: {}, expenses: [], income: [], fixed: { exp: {}, inc: {} } };
}

// Junta o que está salvo com quem deveria pagar no mês
// players: lista do app; rounds: rodadas; doc: caixa do mês salvo (ou null)
// Quantas peladas teve no mês (rodadas lançadas ou o resumo da planilha)
export function peladasNoMes(rounds, key) {
  const list = rounds.filter(r => r.date.slice(0, 7) === key);
  const real = list.filter(r => !r.summary).length;
  const sum = list.filter(r => r.summary).reduce((a, r) => a + (+r.rounds || 0), 0);
  return Math.max(real, sum);
}

export function monthView(players, rounds, y, m, doc, cfg) {
  const d = { ...emptyMonth(doc?.prices), ...(doc || {}) };
  d.prices = { ...DEFAULT_PRICES, ...(doc?.prices || {}) };
  const key = monthKey(y, m);
  const tipo = p => p.tipo || 'M';
  // mensalistas: quem é Mensalista e está no elenco, mais quem já tem lançamento no mês
  const feeIds = new Set(players.filter(p => tipo(p) === 'M' && p.active !== false).map(p => p.id));
  Object.entries(d.fees || {}).forEach(([id, f]) => { if (f?.excluded) feeIds.delete(id); else feeIds.add(id); });
  const fees = [...feeIds].map(id => {
    const p = players.find(x => x.id === id);
    const f = d.fees?.[id] || {};
    const paid = f.paid != null ? !!f.paid : key < FINANCE_START;
    return { id, p, paid, amount: f.amount ?? d.prices.mensal, paidAt: f.paidAt || '', method: f.method || '', receiptId: f.receiptId || '', receiptName: f.receiptName || '', note: f.note || '' };
  }).filter(x => x.p).sort((a, b) => (a.paid - b.paid) || name(a.p).localeCompare(name(b.p)));
  // diárias: presenças de quem não é mensalista nas rodadas do mês
  const pres = {};
  rounds.filter(r => r.date.slice(0, 7) === key).forEach(r => Object.entries(r.entries || {}).forEach(([pid, e]) => { if (e?.p) pres[pid] = (pres[pid] || 0) + (+e.p || 0); }));
  // quem paga mensalidade no mês não paga diária; quem é Mensalista mas ficou fora da lista do mês paga diária
  const dayIds = new Set(Object.keys(pres).filter(id => { const p = players.find(x => x.id === id); return p && !feeIds.has(id); }));
  Object.keys(d.daily || {}).forEach(id => dayIds.add(id));
  const daily = [...dayIds].map(id => {
    const p = players.find(x => x.id === id);
    const dd = d.daily?.[id] || {};
    const count = dd.count ?? pres[id] ?? 0;
    return { id, p, count, amount: dd.amount ?? count * d.prices.diaria, paid: dd.paid !== false, receiptId: dd.receiptId || '', receiptName: dd.receiptName || '' };
  }).filter(x => x.p && x.count > 0).sort((a, b) => (a.paid - b.paid) || name(a.p).localeCompare(name(b.p)));

  // despesas e receitas fixas: entram sozinhas a partir de outubro/2026 (dá para ajustar o valor do mês)
  cfg = cfg || DEFAULT_CONFIG;
  const nPel = peladasNoMes(rounds, key);
  d.fixed = { exp: { ...(d.fixed?.exp || {}) }, inc: { ...(d.fixed?.inc || {}) } };
  // fixas só a partir do início do caixa
  const fixedOf = kind => key < FINANCE_START ? [] : (cfg[kind] || []).filter(t => t.freq !== 'avulsa' && +t.amount > 0).map(t => {
    const o = d.fixed[kind][t.name] || {};
    const base = t.freq === 'mes' ? +t.amount : +t.amount * nPel;
    return { name: t.name, freq: t.freq, unit: +t.amount, n: nPel, amount: o.amount ?? base, custom: o.amount != null, off: !!o.off };
  }).filter(x => !x.off && x.amount > 0);
  const fixedExp = fixedOf('exp'), fixedInc = fixedOf('inc');

  const feePaid = fees.filter(f => f.paid).reduce((s, f) => s + f.amount, 0);
  const feeDue = fees.filter(f => !f.paid).reduce((s, f) => s + f.amount, 0);
  const dayPaid = daily.filter(f => f.paid).reduce((s, f) => s + f.amount, 0);
  const dayDue = daily.filter(f => !f.paid).reduce((s, f) => s + f.amount, 0);
  const other = (d.income || []).reduce((s, x) => s + (+x.amount || 0), 0) + fixedInc.reduce((s, x) => s + x.amount, 0);
  const out = (d.expenses || []).reduce((s, x) => s + (+x.amount || 0), 0) + fixedExp.reduce((s, x) => s + x.amount, 0);
  // total por tipo (fixas + lançadas)
  const byCat = (kind, list, fixed) => {
    const names = [...(cfg[kind] || []).map(t => t.name)];
    list.forEach(x => { const c = entryGroup(x); if (!names.includes(c)) names.push(c); });
    return names.map(n => ({ name: n, typed: (cfg[kind] || []).some(t => t.name === n), amount: fixed.filter(f => f.name === n).reduce((a, f) => a + f.amount, 0) + list.filter(x => entryGroup(x) === n).reduce((a, x) => a + (+x.amount || 0), 0) }));
  };
  const entradas = feePaid + dayPaid + other;
  return { key, doc: d, fees, daily, nPel, fixedExp, fixedInc, expByCat: byCat('exp', d.expenses || [], fixedExp), incByCat: byCat('inc', d.income || [], fixedInc), totals: { feePaid, feeDue, dayPaid, dayDue, other, entradas, saidas: out, resultado: entradas - out, aReceber: feeDue + dayDue } };
}

const name = p => p?.nick || p?.name || '';

// Vencimento da mensalidade: dia da primeira pelada do mês (primeira terça)
export function dueDate(y, m) {
  const d = new Date(y, m - 1, 1);
  while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Quem está devendo mensalidade: meses anteriores em aberto + o mês atual depois do vencimento
export function overdue(players, rounds, finance, today) {
  const y = +today.slice(0, 4), m = +today.slice(5, 7);
  const out = [];
  let yy = +FINANCE_START.slice(0, 4), mm = +FINANCE_START.slice(5, 7);
  while (yy < y || (yy === y && mm <= m)) {
    const key = monthKey(yy, mm);
    if (!(yy === y && mm === m) || today >= dueDate(y, m))
      monthView(players, rounds, yy, mm, finance?.[key]).fees.filter(f => !f.paid).forEach(f => out.push({ ...f, y: yy, m: mm }));
    mm++; if (mm > 12) { mm = 1; yy++; }
  }
  return out;
}

// Meses com caixa: de outubro/2026 até o mês pedido (e qualquer mês que tenha lançamento salvo)
function caixaMonths(finance, y, m) {
  const until = monthKey(y, m), set = new Set(Object.keys(finance || {}).filter(k => isMonthKey(k) && k >= FINANCE_START));
  let yy = +FINANCE_START.slice(0, 4), mm = +FINANCE_START.slice(5, 7);
  while (monthKey(yy, mm) <= until) { set.add(monthKey(yy, mm)); mm++; if (mm > 12) { mm = 1; yy++; } }
  return [...set].sort();
}

// Caixa total: soma mês a mês até o mês atual e, dos meses seguintes, só o que já foi pago ou lançado
// (mensalidade adiantada, receita ou despesa lançada); fixas e pendências de meses futuros não entram.
export function totalView(players, rounds, finance, y, m) {
  const cfg = getConfig(finance), now = monthKey(y, m);
  const exp = {}, inc = {};
  const months = caixaMonths(finance, y, m).map(k => {
    const [yy, mm] = k.split('-').map(Number);
    const future = k > now;
    const v = monthView(players, rounds, yy, mm, finance?.[k], future ? { exp: [], inc: [] } : cfg);
    const t = { ...v.totals };
    if (future) { t.feeDue = 0; t.dayDue = 0; t.aReceber = 0; }
    v.expByCat.forEach(c => { if (c.amount) exp[c.name] = (exp[c.name] || 0) + c.amount; });
    v.incByCat.forEach(c => { if (c.amount) inc[c.name] = (inc[c.name] || 0) + c.amount; });
    return { key: k, y: yy, m: mm, nPel: v.nPel, future, ...t };
  }).filter(x => !x.future || x.entradas || x.saidas);
  const sum = f => months.reduce((a, x) => a + x[f], 0);
  const list = o => Object.entries(o).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  return { months, first: months[0]?.key, expByCat: list(exp), incByCat: list(inc), entradas: sum('entradas'), saidas: sum('saidas'), saldo: sum('resultado'), aReceber: sum('aReceber'), feePaid: sum('feePaid'), dayPaid: sum('dayPaid'), other: sum('other') };
}

export function saldoAcumulado(players, rounds, finance, y, m) {
  const until = monthKey(y, m);
  return totalView(players, rounds, finance, y, m).months.filter(x => x.key <= until).reduce((a, x) => a + x.resultado, 0);
}

// Guarda no doc só o necessário
export function toDoc(view) {
  const d = view.doc;
  return { prices: d.prices, pix: d.pix || '', fees: d.fees || {}, daily: d.daily || {}, expenses: d.expenses || [], income: d.income || [], fixed: d.fixed || { exp: {}, inc: {} } };
}

// Lê arquivo (foto ou PDF) e devolve dataURL leve para guardar
export async function readReceipt(file) {
  if (!file) return null;
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > 700 * 1024) throw new Error('PDF muito grande (máx. 700 KB). Mande uma foto do comprovante.');
    const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    return { name: file.name, type: 'pdf', data };
  }
  // imagem: reduz para no máximo 1280 px e JPEG
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let q = 0.75, data = c.toDataURL('image/jpeg', q);
    while (data.length > 900 * 1024 && q > 0.35) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
    return { name: file.name || 'comprovante.jpg', type: 'img', data };
  } finally { URL.revokeObjectURL(url); }
}
