// Controle de caixa da Capelota (só masters): mensalidades, diárias, despesas e resultado do mês.
export const DEFAULT_PRICES = { mensal: 50, diaria: 17 };
export const EXPENSE_CATS = ['Aluguel do Campo', 'Goleiros', 'Água', 'Outros'];
export const METHODS = ['PIX', 'Dinheiro', 'Cartão'];

// O caixa começou a ser controlado em outubro/2026: meses anteriores estão todos quitados
export const FINANCE_START = '2026-10';

export const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const monthKey = (y, m) => `${y}-${String(m).padStart(2, '0')}`;

export function emptyMonth(prices) {
  return { prices: { ...DEFAULT_PRICES, ...(prices || {}) }, fees: {}, daily: {}, expenses: [], income: [] };
}

// Junta o que está salvo com quem deveria pagar no mês
// players: lista do app; rounds: rodadas; doc: caixa do mês salvo (ou null)
export function monthView(players, rounds, y, m, doc) {
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

  const feePaid = fees.filter(f => f.paid).reduce((s, f) => s + f.amount, 0);
  const feeDue = fees.filter(f => !f.paid).reduce((s, f) => s + f.amount, 0);
  const dayPaid = daily.filter(f => f.paid).reduce((s, f) => s + f.amount, 0);
  const dayDue = daily.filter(f => !f.paid).reduce((s, f) => s + f.amount, 0);
  const other = (d.income || []).reduce((s, x) => s + (+x.amount || 0), 0);
  const out = (d.expenses || []).reduce((s, x) => s + (+x.amount || 0), 0);
  const entradas = feePaid + dayPaid + other;
  return { key, doc: d, fees, daily, totals: { feePaid, feeDue, dayPaid, dayDue, other, entradas, saidas: out, resultado: entradas - out, aReceber: feeDue + dayDue } };
}

const name = p => p?.nick || p?.name || '';

// Vencimento da mensalidade: dia da primeira pelada do mês (primeira terça)
export function dueDate(y, m) {
  const d = new Date(y, m - 1, 1);
  while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Quem está devendo a mensalidade do mês depois do vencimento (lista vazia antes do dia)
export function overdue(players, rounds, finance, today) {
  const y = +today.slice(0, 4), m = +today.slice(5, 7);
  const key = monthKey(y, m);
  if (key < FINANCE_START || today < dueDate(y, m)) return [];
  return monthView(players, rounds, y, m, finance?.[key]).fees.filter(f => !f.paid);
}

// Resultado de todos os meses salvos até (e incluindo) o mês pedido
export function saldoAcumulado(players, rounds, finance, y, m) {
  const until = monthKey(y, m);
  return Object.keys(finance || {}).filter(k => k <= until).sort().reduce((s, k) => {
    const [yy, mm] = k.split('-').map(Number);
    return s + monthView(players, rounds, yy, mm, finance[k]).totals.resultado;
  }, 0);
}

// Guarda no doc só o necessário
export function toDoc(view) {
  const d = view.doc;
  return { prices: d.prices, pix: d.pix || '', fees: d.fees || {}, daily: d.daily || {}, expenses: d.expenses || [], income: d.income || [] };
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
