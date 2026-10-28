// Controle de caixa da Capelota (só masters): mensalidades, diárias, despesas e resultado do mês.
export const DEFAULT_PRICES = { mensal: 50, diaria: 17 };
export const EXPENSE_CATS = ['Aluguel do Campo', 'Goleiros', 'Água', 'Outros'];
// Tipos de despesa e receita. freq: 'mes' (todo mês), 'pelada' (toda pelada) ou 'avulsa' (lança quando acontece)
export const FREQS = { mes: 'Todo mês', pelada: 'Toda pelada', avulsa: 'Avulsa' };
export const DEFAULT_CONFIG = {
  exp: [
    { name: 'Aluguel do Campo', amount: 900, freq: 'mes' },
    { name: 'Goleiros', amount: 50, freq: 'pelada' },
    { name: 'Água', amount: 8, freq: 'pelada' },
    { name: 'Outros', amount: 0, freq: 'avulsa' }
  ],
  inc: [{ name: 'Outros', amount: 0, freq: 'avulsa' }]
};
export const CONFIG_ID = '_config';
export function getConfig(finance) {
  const c = finance?.[CONFIG_ID] || {};
  return { exp: c.exp?.length ? c.exp : DEFAULT_CONFIG.exp, inc: c.inc?.length ? c.inc : DEFAULT_CONFIG.inc };
}
const isMonthKey = k => /^\d{4}-\d{2}$/.test(k);
export const METHODS = ['PIX', 'Dinheiro', 'Cartão'];

// O caixa começou a ser controlado em outubro/2026: meses anteriores estão todos quitados
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
    list.forEach(x => { const c = x.cat || 'Outros'; if (!names.includes(c)) names.push(c); });
    return names.map(n => ({ name: n, amount: fixed.filter(f => f.name === n).reduce((a, f) => a + f.amount, 0) + list.filter(x => (x.cat || 'Outros') === n).reduce((a, x) => a + (+x.amount || 0), 0) }));
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
