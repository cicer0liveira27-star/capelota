// Camada de dados do Capelota.
// Modo nuvem (Firebase): um banco único, leitura pública, escrita só para masters.
// Modo local: tudo no localStorage deste aparelho (usado enquanto o Firebase não está configurado).
import { FIREBASE_CONFIG } from './firebase-config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const LS_DATA = 'capelota:data:v1';
const LS_MASTER = 'capelota:master';
const EMAIL_DOMAIN = '@capelota.app';

export const DEFAULT_SETTINGS = {
  perTeam: 5,
  scoring: 'capelota', // 'capelota' = fórmula da planilha; 'pesos' = soma simples com os pesos abaixo
  weights: { goal: 3, assist: 2, win: 2, draw: 1, title: 3, presence: 1, yellow: -1, red: -3, cleanSheet: 3 }
};

// Só para o modo local: hash PBKDF2 de "cpf|senha". Os CPFs não ficam escritos no código.
// Fundador do site: só o Cícero. Os membros da comissão ficam guardados nos dados (lista "masters").
const LOCAL_MASTERS = [
  { h: '9919eab5c385c3519d2ab89589228b53289fbfa5b90b84ba22b9a01aae07cfa0', name: 'Cícero', playerId: 'pl-cicero', founder: true }
];
// Senha geral da comissão (só o hash; usada no primeiro acesso dos membros aprovados)
const GENERAL_PASS_H = 'df1e9f4eb05ca46e0b98c40fc21dbe260af9b9b6e6736d63928ca3d2a695f432';
// Comissão inicial (pode ser removida pelo app como qualquer membro)
const DEFAULT_MEMBERS = [
  { id: 'm-alyson', h: 'd07b0a51fe7deba48f9efbfd964b01f298dd22c612b25c2824974c4263013699', name: 'Alyson', playerId: 'pl-alyson', cpfEnd: '42447', addedBy: 'Cícero' }
];

// Confere os dígitos verificadores do CPF
export function validCpf(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dig = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); return (s * 10) % 11 % 10; };
  return dig(9) === +d[9] && dig(10) === +d[10];
}
export const maskCpfEnd = d => `***.***.${d.slice(6, 9)}-${d.slice(9)}`;

async function pbkdf2(text) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(text), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('capelota-v1'), iterations: 150000 }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const onlyDigits = s => String(s || '').replace(/\D/g, '');

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function normSettings(s) {
  const d = clone(DEFAULT_SETTINGS);
  if (!s) return d;
  return { ...d, ...s, weights: { ...d.weights, ...(s.weights || {}) } };
}

class Store {
  constructor() {
    this.players = [];
    this.rounds = [];
    this.settings = clone(DEFAULT_SETTINGS);
    this.draw = null; // último sorteio publicado pelos masters
    this.live = null; // rodada ao vivo publicada (todo mundo acompanha)
    this.finance = {}; // caixa por mês: { 'AAAA-MM': {...} } (só masters)
    this.masters = []; // comissão: [{ id, playerId, name, cpfEnd, h? }] (só masters enxergam)
    this.user = null; // { name, uid? }
    this.mode = 'local';
    this.loaded = { players: false, rounds: false, settings: false };
    this.version = 0;
    this._subs = new Set();
    this.fb = null;
  }

  subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); }
  _mergedSeedPlayers() {
    const cloud = this._cloudPlayers || [];
    const byId = new Map((this._seedData?.players || []).map(p => [p.id, p]));
    cloud.forEach(p => byId.set(p.id, { ...(byId.get(p.id) || {}), ...p }));
    return [...byId.values()];
  }
  _emit() {
    if (this.mode === 'cloud' && this.usingSeed && this._seedData && this._cloudEmpty && this._cloudEmpty()) {
      this.players = this._mergedSeedPlayers(); this.rounds = this._seedData.rounds || [];
    }
    this.version++; this._subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

  get isMaster() { return !!this.user; }
  get ready() { return this.loaded.players && this.loaded.rounds; }

  async init() {
    if (FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId) {
      try { await this._initCloud(); return; } catch (e) { console.error('Firebase falhou, usando modo local', e); }
    }
    await this._initLocal();
  }

  // ---------- modo local ----------
  async fetchSeed() {
    const res = await fetch('data/seed.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Não encontrei os dados da planilha.');
    return res.json();
  }

  async _initLocal() {
    this.mode = 'local';
    this.authReady = true;
    let data = null;
    try { data = JSON.parse(localStorage.getItem(LS_DATA) || 'null'); } catch (e) { data = null; }
    // Sem nada salvo neste aparelho: mostra os dados oficiais publicados junto com o app (planilha).
    this.usingSeed = false;
    if (!data) { try { data = await this.fetchSeed(); this.usingSeed = true; } catch (e) { data = null; } }
    this.players = data?.players || [];
    this.rounds = data?.rounds || [];
    this.settings = normSettings(data?.settings);
    this.draw = data?.draw || null;
    this.finance = data?.finance || {};
    this.masters = Array.isArray(data?.masters) ? data.masters : clone(DEFAULT_MEMBERS);
    try { const m = JSON.parse(localStorage.getItem(LS_MASTER) || 'null'); if (m?.name) this.user = { name: m.name, cpf: m.cpf || '' }; } catch (e) {}
    this.loaded = { players: true, rounds: true, settings: true };
    this._emit();
  }
  _persistLocal() {
    this.usingSeed = false;
    try {
      localStorage.setItem(LS_DATA, JSON.stringify({ players: this.players, rounds: this.rounds, settings: this.settings, draw: this.draw, masters: this.masters, finance: this.finance }));
    } catch (e) {
      throw new Error('Sem espaço no aparelho. Use fotos menores ou ligue o banco na nuvem.');
    }
  }

  // ---------- modo nuvem ----------
  async _initCloud() {
    const [appM, authM, fsM] = await Promise.all([
      import(FB + 'firebase-app.js'),
      import(FB + 'firebase-auth.js'),
      import(FB + 'firebase-firestore.js')
    ]);
    const app = appM.initializeApp(FIREBASE_CONFIG);
    let db;
    try {
      db = fsM.initializeFirestore(app, { localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }) });
    } catch (e) {
      db = fsM.getFirestore(app);
    }
    const auth = authM.getAuth(app);
    this.fb = { app, db, auth, authM, fsM };
    this.mode = 'cloud';

    let unsubMasters = null, unsubFin = null;
    authM.onAuthStateChanged(auth, u => {
      this.authReady = true;
      this.user = u ? { uid: u.uid, name: u.displayName || '', email: u.email } : null;
      if (unsubMasters) { unsubMasters(); unsubMasters = null; this.masters = []; }
      if (unsubFin) { unsubFin(); unsubFin = null; this.finance = {}; }
      // caixa: só masters leem
      if (u) unsubFin = fsM.onSnapshot(fsM.collection(db, 'finance'), snap => {
        this.finance = Object.fromEntries(snap.docs.map(d => [d.id, d.data()])); this.financeLoaded = true; this._emit();
      }, err => console.error(err));
      // a lista da comissão só pode ser lida por masters
      if (u) unsubMasters = fsM.onSnapshot(fsM.collection(db, 'masters'), snap => {
        this.masters = snap.docs.map(d => ({ ...d.data(), id: d.id })); this._emit();
      }, err => console.error(err));
      this._emit();
    });
    // Enquanto o banco estiver vazio, mostra os dados da planilha publicados com o app (só leitura)
    let seedP = null;
    // Banco sem nenhuma estatística ainda: completa com a planilha (o que já está no banco tem prioridade)
    const seedIfEmpty = async () => {
      if (!this.loaded.players || !this.loaded.rounds) return;
      if (!this._cloudEmpty()) { if (this.usingSeed) { this.usingSeed = false; this._emit(); } return; }
      try { seedP = seedP || this.fetchSeed(); const sd = await seedP; if (this._cloudEmpty()) { this.usingSeed = true; this._seedData = sd; this._emit(); } } catch (e) {}
    };
    this._cloudEmpty = () => this._rawRounds === 0;
    fsM.onSnapshot(fsM.collection(db, 'players'), snap => {
      this._rawPlayers = snap.size;
      this._cloudPlayers = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      this.players = this._cloudPlayers;
      this.loaded.players = true; this._emit(); seedIfEmpty();
    }, err => { console.error(err); this.loaded.players = true; this._emit(); });
    fsM.onSnapshot(fsM.collection(db, 'rounds'), snap => {
      this._rawRounds = snap.size;
      this.rounds = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      if (snap.size) this.usingSeed = false;
      this.loaded.rounds = true; this._emit(); seedIfEmpty();
    }, err => { console.error(err); this.loaded.rounds = true; this._emit(); });
    fsM.onSnapshot(fsM.doc(db, 'settings', 'live'), snap => {
      const d = snap.exists() ? snap.data() : null;
      try { this.live = d?.json ? { ...JSON.parse(d.json), _at: d.at, _by: d.by } : null; } catch (e) { this.live = null; }
      this._emit();
    }, err => console.error(err));
    fsM.onSnapshot(fsM.doc(db, 'settings', 'draw'), snap => {
      this.draw = snap.exists() ? snap.data() : null; this._emit();
    }, err => console.error(err));
    fsM.onSnapshot(fsM.doc(db, 'settings', 'main'), snap => {
      this.settings = normSettings(snap.exists() ? snap.data() : null);
      this.loaded.settings = true; this._emit();
    }, err => { console.error(err); this.loaded.settings = true; this._emit(); });
  }

  // Escritas no Firestore: com cache offline a promessa só resolve quando o servidor confirma.
  // Esperamos no máximo 2,5s; depois disso a escrita fica na fila e sincroniza sozinha.
  async _cloudWrite(promise) {
    let failed = null;
    const p = promise.catch(e => { failed = e; throw e; });
    const r = await Promise.race([p.then(() => 'ok'), new Promise(res => setTimeout(() => res('queued'), 2500))]).catch(e => { throw this._fbError(e); });
    if (r === 'queued') p.catch(e => window.dispatchEvent(new CustomEvent('capelota:error', { detail: this._fbError(e).message })));
    return r;
  }
  _fbError(e) {
    const code = e?.code || '';
    if (code.includes('permission-denied')) return new Error('Sem permissão: entre com um acesso master para editar.');
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found') || code.includes('invalid-email')) return new Error('CPF ou senha incorretos.');
    if (code.includes('too-many-requests')) return new Error('Muitas tentativas. Espere alguns minutos e tente de novo.');
    if (code.includes('network')) return new Error('Sem conexão com a internet.');
    return new Error(e?.message || 'Não foi possível salvar.');
  }
  _requireMaster() { if (!this.isMaster) throw new Error('Entre com um acesso master para editar.'); }

  // ---------- auth ----------
  async login(cpf, pass) {
    const d = onlyDigits(cpf);
    if (d.length !== 11) throw new Error('O CPF precisa ter 11 dígitos.');
    if (this.mode === 'cloud') {
      const { auth, authM } = this.fb;
      try { await authM.signInWithEmailAndPassword(auth, d + EMAIL_DOMAIN, pass); }
      catch (e) {
        // Primeiro acesso do fundador: cria a conta dele no Firebase com a senha que ele digitou
        const code = String(e?.code || '');
        const founderHash = await pbkdf2(d + '|' + pass);
        if (LOCAL_MASTERS.some(m => m.h === founderHash) && (code.includes('invalid-credential') || code.includes('user-not-found'))) {
          try {
            const cred = await authM.createUserWithEmailAndPassword(auth, d + EMAIL_DOMAIN, pass);
            const m = LOCAL_MASTERS.find(x => x.h === founderHash);
            await authM.updateProfile(cred.user, { displayName: m.name }).catch(() => {});
            this.user = { ...this.user, name: m.name }; this._emit();
            return;
          } catch (e2) { throw this._fbError(String(e2?.code || '').includes('email-already-in-use') ? e : e2); }
        }
        // Primeiro acesso de um membro já aprovado pela comissão (lista "masters"), com a senha geral
        if ((code.includes('invalid-credential') || code.includes('user-not-found')) && (await pbkdf2('geral|' + pass)) === GENERAL_PASS_H) {
          let cred = null;
          try { cred = await authM.createUserWithEmailAndPassword(auth, d + EMAIL_DOMAIN, pass); }
          catch (e2) { throw this._fbError(String(e2?.code || '').includes('email-already-in-use') ? e : e2); }
          const { fsM, db } = this.fb;
          let snap = null;
          try { snap = await fsM.getDoc(fsM.doc(db, 'masters', d + EMAIL_DOMAIN)); } catch (e3) { snap = null; }
          if (snap && snap.exists()) {
            const nm = snap.data().name || '';
            await authM.updateProfile(cred.user, { displayName: nm }).catch(() => {});
            this.user = { ...this.user, name: nm }; this._emit();
            return;
          }
          // não está na comissão: desfaz a conta criada
          await cred.user.delete().catch(() => authM.signOut(auth));
          throw new Error('CPF ou senha incorretos.');
        }
        throw this._fbError(e);
      }
      return;
    }
    const h = await pbkdf2(d + '|' + pass);
    const m = [...LOCAL_MASTERS, ...this.masters].find(x => x.h === h);
    if (!m) throw new Error('CPF ou senha incorretos.');
    this.user = { name: m.name, cpf: d };
    localStorage.setItem(LS_MASTER, JSON.stringify({ name: m.name, cpf: d }));
    this._emit();
  }

  // Confere a senha de quem está logado antes de mexer na comissão
  async confirmPassword(pass) {
    this._requireMaster();
    if (!pass) throw new Error('Digite sua senha.');
    if (this.mode === 'cloud') {
      const { auth, authM } = this.fb;
      try { await authM.reauthenticateWithCredential(auth.currentUser, authM.EmailAuthProvider.credential(auth.currentUser.email, pass)); }
      catch (e) { throw new Error(String(e?.code || '').includes('too-many') ? 'Muitas tentativas. Espere alguns minutos.' : 'Senha incorreta.'); }
      return true;
    }
    if (!this.user.cpf) throw new Error('Saia do acesso master e entre de novo para confirmar.');
    const h = await pbkdf2(this.user.cpf + '|' + pass);
    if (![...LOCAL_MASTERS, ...this.masters].some(x => x.h === h)) throw new Error('Senha incorreta.');
    return true;
  }

  // Lista da comissão (fundadores + adicionados)
  get commission() {
    const list = [...LOCAL_MASTERS.map(m => ({ playerId: m.playerId, name: m.name, founder: true })), ...this.masters];
    const seen = new Set();
    return list.filter(m => { const k = m.playerId || m.name; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  isPlayerMaster(pid) { return this.commission.some(m => m.playerId === pid); }

  // Dá acesso master a um atleta. A senha dele é a senha geral da comissão (a mesma que o master confirmou).
  async addMaster({ cpf, playerId, name }, pass) {
    await this.confirmPassword(pass);
    const d = onlyDigits(cpf);
    if (!validCpf(d)) throw new Error('CPF inválido. Confira os números.');
    const rec = { playerId, name, cpfEnd: d.slice(6), addedBy: this.user?.name || '', at: Date.now() };
    if (this.mode === 'cloud') {
      const { fsM, db, authM } = this.fb;
      const appM = await import(FB + 'firebase-app.js');
      // app secundário: cria o login do novo master sem derrubar a sessão de quem está cadastrando
      const sec = appM.initializeApp(FIREBASE_CONFIG, 'cadastro-' + Date.now());
      try {
        const sa = authM.getAuth(sec);
        try { await authM.createUserWithEmailAndPassword(sa, d + EMAIL_DOMAIN, pass); }
        catch (e) { if (!String(e?.code || '').includes('email-already-in-use')) throw this._fbError(e); }
        await authM.signOut(sa).catch(() => {});
      } finally { appM.deleteApp(sec).catch(() => {}); }
      await this._cloudWrite(fsM.setDoc(fsM.doc(db, 'masters', d + EMAIL_DOMAIN), rec));
      return 'ok';
    }
    if ([...LOCAL_MASTERS, ...this.masters].some(m => m.cpfEnd === rec.cpfEnd && m.playerId === playerId)) return 'ok';
    rec.h = await pbkdf2(d + '|' + pass);
    rec.id = 'm-' + Date.now().toString(36);
    this.masters = this.masters.filter(m => m.playerId !== playerId);
    this.masters.push(rec);
    this._persistLocal(); this._emit(); return 'ok';
  }

  async removeMaster(playerId, pass) {
    await this.confirmPassword(pass);
    if (LOCAL_MASTERS.some(m => m.playerId === playerId)) throw new Error('O fundador do site não pode ser removido.');
    const m = this.masters.find(x => x.playerId === playerId);
    if (!m) return 'ok';
    if (this.mode === 'cloud') { const { fsM, db } = this.fb; return this._cloudWrite(fsM.deleteDoc(fsM.doc(db, 'masters', m.id))); }
    this.masters = this.masters.filter(x => x.playerId !== playerId);
    this._persistLocal(); this._emit(); return 'ok';
  }
  async logout() {
    if (this.mode === 'cloud') { await this.fb.authM.signOut(this.fb.auth); return; }
    this.user = null; localStorage.removeItem(LS_MASTER); this._emit();
  }
  async setDisplayName(name) {
    if (this.mode !== 'cloud' || !this.fb.auth.currentUser) return;
    await this.fb.authM.updateProfile(this.fb.auth.currentUser, { displayName: name });
    this.user = { ...this.user, name }; this._emit();
  }

  // Banco ainda vazio mostrando a planilha: antes da 1ª edição, grava a planilha inteira no banco,
  // para que a edição de um atleta não faça os outros sumirem para todo mundo.
  async _ensureBase() {
    if (this.mode !== 'cloud' || !this.usingSeed || !this._seedData) return;
    if (this._basing) return this._basing;
    this._basing = (async () => {
      const sd = this._seedData;
      await this.importAll({ app: 'capelota', version: 1, players: this._mergedSeedPlayers(), rounds: sd.rounds, settings: sd.settings });
      this.usingSeed = false; this._seedData = null;
    })();
    try { await this._basing; } finally { this._basing = null; }
  }

  // ---------- players ----------
  newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  async savePlayer(p) {
    this._requireMaster();
    await this._ensureBase();
    const data = { ...p };
    if (!data.id) { data.id = this.newId(); data.createdAt = Date.now(); }
    data.updatedAt = Date.now();
    if (this.mode === 'cloud') {
      const { db, fsM } = this.fb; const { id, ...rest } = data;
      return this._cloudWrite(fsM.setDoc(fsM.doc(db, 'players', id), rest));
    }
    const i = this.players.findIndex(x => x.id === data.id);
    if (i >= 0) this.players[i] = data; else this.players.push(data);
    this._persistLocal(); this._emit(); return 'ok';
  }
  async deletePlayer(id) {
    this._requireMaster();
    await this._ensureBase();
    if (this.mode === 'cloud') { const { db, fsM } = this.fb; return this._cloudWrite(fsM.deleteDoc(fsM.doc(db, 'players', id))); }
    this.players = this.players.filter(x => x.id !== id);
    this._persistLocal(); this._emit(); return 'ok';
  }

  // ---------- rounds (id = data AAAA-MM-DD) ----------
  async saveRound(r, previousId) {
    this._requireMaster();
    await this._ensureBase();
    const data = { ...r, id: r.id || r.date, updatedAt: Date.now(), updatedBy: this.user?.name || '' };
    if (this.mode === 'cloud') {
      const { db, fsM } = this.fb; const { id, ...rest } = data;
      if (previousId && previousId !== id) await this._cloudWrite(fsM.deleteDoc(fsM.doc(db, 'rounds', previousId)));
      return this._cloudWrite(fsM.setDoc(fsM.doc(db, 'rounds', id), rest));
    }
    this.rounds = this.rounds.filter(x => x.id !== data.id && x.id !== previousId);
    this.rounds.push(data);
    this._persistLocal(); this._emit(); return 'ok';
  }
  async deleteRound(id) {
    this._requireMaster();
    await this._ensureBase();
    if (this.mode === 'cloud') { const { db, fsM } = this.fb; return this._cloudWrite(fsM.deleteDoc(fsM.doc(db, 'rounds', id))); }
    this.rounds = this.rounds.filter(x => x.id !== id);
    this._persistLocal(); this._emit(); return 'ok';
  }

  // ---------- settings ----------
  async saveSettings(s) {
    this._requireMaster();
    await this._ensureBase();
    const data = normSettings(s);
    if (this.mode === 'cloud') { const { db, fsM } = this.fb; return this._cloudWrite(fsM.setDoc(fsM.doc(db, 'settings', 'main'), data)); }
    this.settings = data; this._persistLocal(); this._emit(); return 'ok';
  }

  // ---------- caixa (só masters) ----------
  async saveFinance(month, data) {
    this._requireMaster();
    const doc = { ...data, updatedAt: Date.now(), updatedBy: this.user?.name || '' };
    if (this.mode === 'cloud') { const { db, fsM } = this.fb; return this._cloudWrite(fsM.setDoc(fsM.doc(db, 'finance', month), doc)); }
    this.finance = { ...this.finance, [month]: doc }; this._persistLocal(); this._emit(); return 'ok';
  }
  // Comprovantes ficam numa coleção à parte (foto ou PDF em base64, até ~900 KB)
  async saveReceipt(rec) {
    this._requireMaster();
    const id = 'rc-' + this.newId();
    const doc = { ...rec, at: Date.now(), by: this.user?.name || '' };
    if (this.mode === 'cloud') { const { db, fsM } = this.fb; await this._cloudWrite(fsM.setDoc(fsM.doc(db, 'receipts', id), doc)); return id; }
    const all = JSON.parse(localStorage.getItem('capelota:receipts') || '{}'); all[id] = doc;
    try { localStorage.setItem('capelota:receipts', JSON.stringify(all)); } catch (e) { throw new Error('Sem espaço no aparelho para o comprovante.'); }
    return id;
  }
  async getReceipt(id) {
    if (!id) return null;
    if (this.mode === 'cloud') { const { db, fsM } = this.fb; const snap = await fsM.getDoc(fsM.doc(db, 'receipts', id)); return snap.exists() ? snap.data() : null; }
    return JSON.parse(localStorage.getItem('capelota:receipts') || '{}')[id] || null;
  }
  async deleteReceipt(id) {
    if (!id) return;
    if (this.mode === 'cloud') { const { db, fsM } = this.fb; return this._cloudWrite(fsM.deleteDoc(fsM.doc(db, 'receipts', id))); }
    const all = JSON.parse(localStorage.getItem('capelota:receipts') || '{}'); delete all[id]; localStorage.setItem('capelota:receipts', JSON.stringify(all));
  }

  // ---------- rodada ao vivo (publicada para todo mundo acompanhar) ----------
  async saveLive(l) {
    if (!this.isMaster) return;
    const data = { json: l ? JSON.stringify(l) : null, at: Date.now(), by: this.user?.name || '' };
    if (this.mode === 'cloud') { const { db, fsM } = this.fb; return this._cloudWrite(fsM.setDoc(fsM.doc(db, 'settings', 'live'), data)); }
    this.live = l ? { ...l, _at: data.at, _by: data.by } : null; this._emit(); return 'ok';
  }

  // ---------- sorteio publicado ----------
  async saveDraw(d) {
    this._requireMaster();
    await this._ensureBase();
    const data = { ...d, at: Date.now(), by: this.user?.name || '' };
    if (this.mode === 'cloud') { const { db, fsM } = this.fb; return this._cloudWrite(fsM.setDoc(fsM.doc(db, 'settings', 'draw'), data)); }
    this.draw = data; this._persistLocal(); this._emit(); return 'ok';
  }

  // Dados que ficaram salvos neste aparelho antes do banco compartilhado
  get deviceData() {
    if (this.mode !== 'cloud') return null;
    try { const d = JSON.parse(localStorage.getItem(LS_DATA) || 'null'); return d && Array.isArray(d.players) && d.players.length ? d : null; } catch (e) { return null; }
  }
  clearDeviceData() { try { localStorage.removeItem(LS_DATA); } catch (e) {} this._emit(); }

  // ---------- backup ----------
  exportAll() {
    return {
      app: 'capelota', version: 1, exportedAt: new Date().toISOString(),
      players: this.players, rounds: this.rounds, settings: this.settings
    };
  }
  async importAll(data) {
    this._requireMaster();
    if (!data || data.app !== 'capelota' || !Array.isArray(data.players) || !Array.isArray(data.rounds)) {
      throw new Error('Esse arquivo não é um backup do Capelota.');
    }
    const players = data.players.filter(p => p && p.id && p.name);
    const rounds = data.rounds.filter(r => r && r.date).map(r => ({ ...r, id: r.id || r.date }));
    const settings = normSettings(data.settings);
    if (this.mode === 'cloud') {
      const { db, fsM } = this.fb;
      const ops = [];
      const keepP = new Set(players.map(p => p.id)), keepR = new Set(rounds.map(r => r.id));
      this.players.filter(p => !keepP.has(p.id)).forEach(p => ops.push(b => b.delete(fsM.doc(db, 'players', p.id))));
      this.rounds.filter(r => !keepR.has(r.id)).forEach(r => ops.push(b => b.delete(fsM.doc(db, 'rounds', r.id))));
      players.forEach(({ id, ...rest }) => ops.push(b => b.set(fsM.doc(db, 'players', id), rest)));
      rounds.forEach(({ id, ...rest }) => ops.push(b => b.set(fsM.doc(db, 'rounds', id), rest)));
      ops.push(b => b.set(fsM.doc(db, 'settings', 'main'), settings));
      for (let i = 0; i < ops.length; i += 25) {
        const batch = fsM.writeBatch(db);
        ops.slice(i, i + 25).forEach(fn => fn(batch));
        await this._cloudWrite(batch.commit());
      }
      return { players: players.length, rounds: rounds.length };
    }
    this.players = players; this.rounds = rounds; this.settings = settings;
    this._persistLocal(); this._emit();
    return { players: players.length, rounds: rounds.length };
  }
}

// Atualização vinda da planilha: troca só as ESTATÍSTICAS dos meses que vieram nela.
// Regras: só entram atletas que JÁ EXISTEM no app (por id, nome, apelido ou grafia antiga da planilha);
// nomes da planilha que não estão no app são ignorados; o perfil (foto, número, apelido, vínculo...) não é tocado.
const normKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
Store.prototype.planSheet = function (data) {
  if (!data || !Array.isArray(data.players) || !Array.isArray(data.rounds)) throw new Error('Esses dados da planilha não são válidos.');
  const front = this.players;
  const byId = new Map(front.map(p => [p.id, p]));
  const byKey = new Map();
  front.forEach(p => [p.name, p.nick].filter(Boolean).forEach(n => { const k = normKey(n); if (!byKey.has(k)) byKey.set(k, p); }));
  const map = {}, ignored = [], matched = [];
  data.players.forEach(sp => {
    let f = byId.get(sp.id);
    if (!f) for (const n of [sp.name, ...(sp.aliases || [])]) { f = byKey.get(normKey(n)); if (f) break; }
    if (f) { map[sp.id] = f.id; matched.push(sp.name); } else ignored.push(sp.name);
  });
  const usedIgnored = new Set();
  const rounds = data.rounds.map(r => {
    const entries = {};
    Object.entries(r.entries || {}).forEach(([sid, e]) => {
      const fid = map[sid];
      if (!fid) { usedIgnored.add(sid); return; }
      if (entries[fid]) { const t = entries[fid]; Object.keys(e).forEach(k => { t[k] = (t[k] || 0) + e[k]; }); t.p = Math.max(t.p || 0, e.p || 0); }
      else entries[fid] = { ...e };
    });
    return { ...r, id: r.id || r.date, entries };
  });
  const months = new Set(rounds.map(r => r.date.slice(0, 7)));
  const replaced = this.rounds.filter(r => months.has(r.date.slice(0, 7)) && !r.summary).length;
  const ignoredWithStats = data.players.filter(p => usedIgnored.has(p.id)).map(p => p.name).sort((a, b) => a.localeCompare(b));
  return { rounds, months, matched: matched.length, ignored: ignoredWithStats, replaced };
};
Store.prototype.importSheet = async function (data, plan) {
  this._requireMaster();
  await this._ensureBase();
  plan = plan || this.planSheet(data);
  const { rounds, months } = plan;
  const dropRounds = this.rounds.filter(r => months.has(r.date.slice(0, 7)));
  if (this.mode === 'cloud') {
    const { db, fsM } = this.fb;
    const ops = [];
    const keep = new Set(rounds.map(r => r.id));
    dropRounds.filter(r => !keep.has(r.id)).forEach(r => ops.push(b => b.delete(fsM.doc(db, 'rounds', r.id))));
    rounds.forEach(({ id, ...rest }) => ops.push(b => b.set(fsM.doc(db, 'rounds', id), rest)));
    for (let i = 0; i < ops.length; i += 25) {
      const batch = fsM.writeBatch(db);
      ops.slice(i, i + 25).forEach(fn => fn(batch));
      await this._cloudWrite(batch.commit());
    }
  } else {
    this.rounds = [...this.rounds.filter(r => !months.has(r.date.slice(0, 7))), ...rounds];
    this._persistLocal(); this._emit();
  }
  return { months: months.size, matched: plan.matched, ignored: plan.ignored.length };
};

export const store = new Store();
