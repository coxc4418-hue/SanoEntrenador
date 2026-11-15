// SanoEntrenador — Capa de datos (Firestore en tiempo real + caché offline)
import {
  db, collection, collectionGroup, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, query, where, writeBatch, increment
} from './firebase.js';
import { addDays, startOfDay, sha256, toast, todayKey, dayKey, applyLocale, setFx, scaleUSD, fromKey } from './utils.js';
import { DEFAULT_PLANS, DEFAULT_MSGS } from './gym.js';

// ---------- Estado del alumno ----------
export const MEMBER_STATUS = {
  activo: { label: 'Activo', tone: 'success', icon: 'checkCircle' },
  por_vencer: { label: 'Por vencer', tone: 'warning', icon: 'clock' },
  vencido: { label: 'Vencido', tone: 'danger', icon: 'alert' },
  agotado: { label: 'Sin sesiones', tone: 'danger', icon: 'alert' },
  congelado: { label: 'Pausado', tone: 'info', icon: 'snow' },
  pendiente: { label: 'Inicia pronto', tone: 'violet', icon: 'calendar' },
  sin_plan: { label: 'Sin plan', tone: 'neutral', icon: 'user' },
  baja: { label: 'De baja', tone: 'neutral', icon: 'x' }
};
export const LIVE_STATUS = ['activo', 'por_vencer'];
export const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 864e5);

/** Estado de un alumno según su plan vigente (instantánea guardada en el alumno) */
export function memberStatus(m, today = todayKey()) {
  if (!m) return 'sin_plan';
  if (m.active === false) return 'baja';
  const ms = m.membership;
  if (!ms || ms.status === 'anulada') return 'sin_plan';
  if (ms.frozenUntil && ms.frozenUntil >= today && (!ms.frozenFrom || ms.frozenFrom <= today)) return 'congelado';
  if (ms.start > today) return 'pendiente';
  if (ms.end < today) return 'vencido';
  if (ms.kind !== 'tiempo' && Number(ms.visitsLeft ?? 1) <= 0) return 'agotado';
  if (daysBetween(today, ms.end) <= (store.settings.remindDays ?? 5)) return 'por_vencer';
  if (ms.kind === 'sesiones' && Number(ms.visitsLeft ?? 9) <= (store.settings.access?.lowSessions ?? 2)) return 'por_vencer';
  return 'activo';
}
export const statusBadge = (s) => {
  const st = MEMBER_STATUS[s] || { label: s, tone: 'neutral' };
  return `<span class="badge badge-${st.tone}"><i class="dotc"></i>${st.label}</span>`;
};
export function daysLeft(m, today = todayKey()) {
  const ms = m?.membership;
  return ms?.end ? daysBetween(today, ms.end) : null;
}

export const SEX = { F: 'Femenino', M: 'Masculino' };
export const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const DEFAULT_SERVICES = [
  { name: 'Evaluación física', price: 15 }, { name: 'Plan de alimentación', price: 25 }, { name: 'Rutina personalizada (sin seguimiento)', price: 20 }, { name: 'Recargo sesión a domicilio', price: 5 }
];
const DEFAULT_SETTINGS = {
  fx: { enabled: false, sym: 'Bs', name: 'Bolívares', rate: 0, updatedAt: '' },
  businessName: '',
  coachName: '',
  specialty: 'Entrenador personal',
  bio: '',
  certifications: '',
  rif: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  city: '',
  instagram: '',
  places: ['Gimnasio', 'Parque', 'A domicilio', 'Online'],
  receiptFooter: '¡Gracias por entrenar conmigo! Constancia, no perfección.',
  receiptFormat: '80mm',
  docTitle: 'RECIBO',
  country: '',
  currency: '',
  iva: 0,
  plans: DEFAULT_PLANS,
  services: DEFAULT_SERVICES,
  msgs: {},
  agenda: { start: '05:00', end: '21:00', minutes: 60, days: [1, 2, 3, 4, 5, 6] },
  access: { graceDays: 2, enrollFee: 0, reenrollDays: 60, lowSessions: 2, inactiveDays: 10, reevalDays: 30 },
  page: { slug: '', published: false, showPrices: true },
  remindDays: 5,
  rules: 'Llega 5 minutos antes, trae toalla e hidratación. Si no puedes asistir, avisa con 12 horas de anticipación para reprogramar.'
};

class Store {
  constructor() {
    this.tenantId = null;
    this.tenant = null;
    this.settings = { ...DEFAULT_SETTINGS };
    this.security = {};
    this.counters = {};
    this.announcement = null;
    this.members = [];
    this.sessions = [];
    this.todayCheckins = [];
    this.recentSales = [];
    this.templates = [];
    this.reminders = [];
    this.remlog = {};
    this.ready = false;
    this._unsubs = [];
    this._listeners = {};
    this._loaded = new Set();
  }

  // ---------- Eventos ----------
  on(evt, fn) { (this._listeners[evt] ||= new Set()).add(fn); return () => this._listeners[evt].delete(fn); }
  emit(evt, data) {
    (this._listeners[evt] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
    (this._listeners['*'] || []).forEach((fn) => { try { fn(evt); } catch (e) { console.error(e); } });
  }

  // ---------- Referencias ----------
  col(name) { return collection(db, 'tenants', this.tenantId, name); }
  ref(name, id) { return doc(db, 'tenants', this.tenantId, name, String(id)); }
  newRef(name) { return doc(this.col(name)); }
  tenantRef(id = this.tenantId) { return doc(db, 'tenants', id); }
  cardRef(code) { return doc(db, 'cards', String(code)); }
  batch() { return writeBatch(db); }
  get isDemo() { return this.tenant?.demo === true; }
  inc(n) { return increment(n); }

  /** Confirma un lote: la caché local lo aplica al instante (también sin internet); espera al servidor unos segundos como máximo. */
  async commit(batch) {
    const p = batch.commit();
    p.catch((err) => {
      console.error('[store] commit', err);
      toast(err?.code === 'permission-denied' ? 'Sin permiso para guardar. Verifica que tu cuenta esté activa.' : 'No se pudo sincronizar un cambio: ' + (err?.message || err), 'danger', 5000);
    });
    if (!navigator.onLine) return;
    await Promise.race([p.catch(() => {}), new Promise((r) => setTimeout(r, 3500))]);
  }
  async save(name, id, data, merge = true) { const b = this.batch(); b.set(this.ref(name, id), data, { merge }); await this.commit(b); }
  async remove(name, id) { const b = this.batch(); b.delete(this.ref(name, id)); await this.commit(b); }

  // ---------- Ciclo de vida ----------
  async start(tenantId) {
    this.stop();
    this.tenantId = tenantId;
    this._loaded = new Set();
    const need = ['tenant', 'settings', 'members', 'sessions', 'checkins', 'sales', 'templates', 'reminders', 'remlog'];
    let resolveReady;
    const readyP = new Promise((r) => { resolveReady = r; });
    const mark = (k) => { this._loaded.add(k); if (need.every((x) => this._loaded.has(x))) resolveReady(); };
    const fail = (k) => (err) => { console.error('[store]', k, err); mark(k); if (err?.code === 'permission-denied') this.emit('denied', err); };
    const listen = (q, k, fn) => this._unsubs.push(onSnapshot(q, (s) => { fn(s); mark(k); this.emit(k); this.emit('change', k); }, fail(k)));
    const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'es', { numeric: true });

    listen(this.tenantRef(), 'tenant', (s) => { this.tenant = s.exists() ? { id: s.id, ...s.data() } : null; });
    listen(this.ref('config', 'settings'), 'settings', (s) => {
      this.settings = { ...DEFAULT_SETTINGS, ...(s.exists() ? s.data() : {}) };
      applyLocale(this.settings.country || 'VE', this.settings.currency);
      this.settings.fx = { ...DEFAULT_SETTINGS.fx, ...(this.settings.fx || {}) };
      setFx(this.settings.fx);
      if (!Array.isArray(this.settings.plans) || !this.settings.plans.length) this.settings.plans = DEFAULT_PLANS;
      for (const k of ['services', 'places']) if (!Array.isArray(this.settings[k])) this.settings[k] = [];
      this.settings.agenda = { ...DEFAULT_SETTINGS.agenda, ...(this.settings.agenda || {}) };
      this.settings.access = { ...DEFAULT_SETTINGS.access, ...(this.settings.access || {}) };
      this.settings.page = { ...DEFAULT_SETTINGS.page, ...(this.settings.page || {}) };
      this.settings.msgs = { ...(this.settings.msgs || {}) };
    });
    this._unsubs.push(onSnapshot(this.ref('config', 'security'), (s) => { this.security = s.exists() ? s.data() : {}; }, () => {}));
    this._unsubs.push(onSnapshot(this.ref('config', 'counters'), (s) => { this.counters = s.exists() ? s.data() : {}; }, () => {}));
    this._unsubs.push(onSnapshot(doc(db, 'system', 'announcement'), (s) => { this.announcement = s.exists() ? s.data() : null; this.emit('announcement'); }, () => {}));
    listen(this.col('members'), 'members', (s) => { this.members = rows(s).sort(byName); this._mMap = null; });
    listen(query(this.col('sessions'), where('date', '>=', dayKey(addDays(new Date(), -21)))), 'sessions', (s) => {
      this.sessions = rows(s).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    });
    listen(query(this.col('checkins'), where('dayKey', '==', todayKey())), 'checkins', (s) => {
      this.todayCheckins = rows(s).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    });
    const since = startOfDay(addDays(new Date(), -40)).toISOString();
    listen(query(this.col('sales'), where('date', '>=', since)), 'sales', (s) => {
      this.recentSales = rows(s).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    });
    listen(query(this.col('routines'), where('template', '==', true)), 'templates', (s) => { this.templates = rows(s).sort(byName); });
    listen(query(this.col('reminders'), where('done', '==', false)), 'reminders', (s) => { this.reminders = rows(s).sort((a, b) => (a.date || '').localeCompare(b.date || '')); });
    listen(query(this.col('remlog'), where('at', '>=', startOfDay(addDays(new Date(), -30)).toISOString())), 'remlog', (s) => {
      this.remlog = {}; s.docs.forEach((d) => { this.remlog[d.id] = d.data(); });
    });

    await Promise.race([readyP, new Promise((r) => setTimeout(r, 8000))]);
    this.ready = true;
  }

  stop() {
    this._unsubs.forEach((u) => { try { u(); } catch (_) {} });
    this._unsubs = [];
    this.ready = false;
    this.tenant = null; this.members = []; this.sessions = []; this.todayCheckins = []; this.recentSales = []; this.templates = []; this.reminders = []; this.remlog = {};
    this.settings = { ...DEFAULT_SETTINGS }; this.security = {}; this.counters = {}; this._mMap = null;
  }

  // ---------- Ajustes ----------
  get rate() { return 1; }
  get country() { return this.settings.country || ''; }
  get businessName() { return this.settings.businessName || this.tenant?.name || 'Mi entrenamiento'; }
  get coachName() { return this.settings.coachName || this.tenant?.ownerName || this.businessName; }
  get access() { return this.settings.access; }
  plan(id) { return this.settings.plans.find((p) => p.id === id) || null; }
  get activePlans() { return this.settings.plans.filter((p) => p.active !== false); }
  msg(kind) { return this.settings.msgs?.[kind] || DEFAULT_MSGS[kind]?.text || DEFAULT_MSGS.libre.text; }

  async saveSettings(patch) {
    Object.assign(this.settings, patch);
    if (patch.fx) setFx(this.settings.fx);
    await this.save('config', 'settings', patch, true);
    this.emit('settings');
  }
  /** País de trabajo: moneda, formas de pago, prefijo de WhatsApp y nombres de documentos */
  async setCountry(code, currency = null) {
    const prevCur = this.settings.currency || 'USD';
    const first = !this.settings.country;
    const l = applyLocale(code, currency);
    const patch = { country: code, currency: l.cur, countrySetAt: new Date().toISOString() };
    if (first && prevCur !== l.cur) {
      const def = new Map(DEFAULT_PLANS.map((x) => [x.id, x.price]));
      patch.plans = (this.settings.plans || []).map((x) => (def.get(x.id) === x.price ? { ...x, price: scaleUSD(x.price, l.cur, l.dec) } : x));
      const defS = new Map(DEFAULT_SERVICES.map((x) => [x.name, x.price]));
      patch.services = (this.settings.services || []).map((x) => (defS.get(x.name) === x.price ? { ...x, price: scaleUSD(x.price, l.cur, l.dec) } : x));
    }
    await this.saveSettings(patch);
    this.emit('rate', 1);
  }

  /** Correlativo (alumnos "mem", recibos "inv"…). Se reserva en el mismo lote que el documento. */
  nextSeq(b, key) {
    const n = (Number(this.counters[key]) || 0) + 1;
    this.counters = { ...this.counters, [key]: n };
    b.set(this.ref('config', 'counters'), { [key]: n }, { merge: true });
    return n;
  }

  // ---------- PIN ----------
  hasPin() { return !!this.security.pinHash; }
  async verifyPin(pin) {
    if (!this.security.pinHash) {
      const s = await getDoc(this.ref('config', 'security')).catch(() => null);
      if (s?.exists()) this.security = s.data();
    }
    if (!this.security.pinHash) return true;
    return (await sha256(`${this.tenantId}:${pin}`)) === this.security.pinHash;
  }
  async setPin(pin) {
    const pinHash = await sha256(`${this.tenantId}:${pin}`);
    this.security = { ...this.security, pinHash, updatedAt: new Date().toISOString() };
    await this.save('config', 'security', this.security, true);
  }

  // ---------- Alumnos ----------
  member(id) {
    if (!this._mMap) this._mMap = new Map(this.members.map((p) => [p.id, p]));
    return this._mMap.get(id);
  }
  /** Busca por código del carnet (o su enlace), N° de alumno (A-0001) o documento */
  findMember(code) {
    const raw = String(code || '').trim();
    if (!raw) return null;
    const url = /\/(?:alumno|carnet)\/([A-Z0-9]+)/i.exec(raw);
    const v = (url ? url[1] : raw).toUpperCase().replace(/\s+/g, '');
    const digits = v.replace(/\D/g, '');
    return this.members.find((m) => (m.cardCode || '') === v)
      || this.members.find((m) => (m.number || '').toUpperCase() === v || (/^A-?\d+$/.test(v) && Number(m.seq) === Number(digits)))
      || (digits.length >= 5 ? this.members.find((m) => String(m.idDoc || '').replace(/\D/g, '') === digits) : null)
      || (/^\d{1,4}$/.test(v) ? this.members.find((m) => Number(m.seq) === Number(v)) : null)
      || null;
  }
  get liveMembers() { return this.members.filter((m) => m.active !== false); }
  get activeMembers() { const t = todayKey(); return this.members.filter((m) => LIVE_STATUS.includes(memberStatus(m, t))); }
  membersBy(status) { const t = todayKey(); return this.members.filter((m) => memberStatus(m, t) === status); }
  expiringIn(days = 7) {
    const t = todayKey(); const lim = dayKey(addDays(new Date(), days));
    return this.members.filter((m) => m.active !== false && m.membership && m.membership.status !== 'anulada' && m.membership.end >= t && m.membership.end <= lim && memberStatus(m, t) !== 'congelado')
      .sort((a, b) => a.membership.end.localeCompare(b.membership.end));
  }
  /** Paquetes vigentes con pocas sesiones restantes */
  lowSessions(n = this.access.lowSessions ?? 2) {
    const t = todayKey();
    return this.members.filter((m) => m.active !== false && m.membership && m.membership.status !== 'anulada' && m.membership.kind === 'sesiones' && m.membership.end >= t && Number(m.membership.visitsLeft ?? 99) <= n);
  }
  expiredWithin(days = 30) {
    const t = todayKey(); const from = dayKey(addDays(new Date(), -days));
    return this.members.filter((m) => m.active !== false && m.membership && m.membership.status !== 'anulada' && m.membership.end < t && m.membership.end >= from)
      .sort((a, b) => b.membership.end.localeCompare(a.membership.end));
  }
  get debtors() { return this.members.filter((m) => m.active !== false && (Number(m.balance) || 0) > 0.009).sort((a, b) => (b.balance || 0) - (a.balance || 0)); }
  get totalDebt() { return this.debtors.reduce((a, m) => a + (Number(m.balance) || 0), 0); }
  /** Alumnos con plan vigente que no entrenan hace N días */
  atRisk(days = this.access.inactiveDays || 10) {
    const lim = addDays(new Date(), -days).toISOString();
    const limDay = dayKey(addDays(new Date(), -days));
    const t = todayKey();
    return this.members.filter((m) => LIVE_STATUS.includes(memberStatus(m, t)) && !m.membership?.online && (m.lastCheckinAt ? m.lastCheckinAt < lim : (m.membership?.start || t) < limDay))
      .sort((a, b) => (a.lastCheckinAt || '').localeCompare(b.lastCheckinAt || ''));
  }
  get birthdaysToday() {
    const md = todayKey().slice(5);
    return this.members.filter((m) => m.active !== false && m.birthDate && m.birthDate.slice(5) === md);
  }
  /** Les toca reevaluarse (última evaluación hace más de N días, o nunca) */
  needEval(days = this.access.reevalDays || 30) {
    const lim = dayKey(addDays(new Date(), -days)); const t = todayKey();
    return this.members.filter((m) => LIVE_STATUS.includes(memberStatus(m, t)) && (!m.lastEval || m.lastEval.date < lim));
  }

  // ---------- Agenda ----------
  sessionsOn(date) { return this.sessions.filter((s) => s.date === date && s.status !== 'cancelada'); }
  memberSessions(memberId, { from = todayKey() } = {}) {
    return this.sessions.filter((s) => s.status !== 'cancelada' && s.date >= from && (s.memberIds || []).includes(memberId));
  }
  get todaySessions() { return this.sessionsOn(todayKey()); }

  // ---------- Consultas ----------
  async listBetween(name, field, fromISO, toISO) {
    const s = await getDocs(query(this.col(name), where(field, '>=', fromISO), where(field, '<=', toISO)));
    return s.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  async salesBetween(fromISO, toISO) { return this.listBetween('sales', 'date', fromISO, toISO); }
  async listEq(name, field, value) {
    const s = await getDocs(query(this.col(name), where(field, '==', value)));
    return s.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  async getDocById(name, id) {
    const s = await getDoc(this.ref(name, id));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  }
  async getMember(id) { return this.member(id) || this.getDocById('members', id); }
  async memberMemberships(id) { return (await this.listEq('memberships', 'memberId', id)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); }
  async memberCheckins(id) { return (await this.listEq('checkins', 'memberId', id)).sort((a, b) => (b.date || '').localeCompare(a.date || '')); }
  async memberEvals(id) { return (await this.listEq('evaluations', 'memberId', id)).sort((a, b) => (a.date || '').localeCompare(b.date || '')); }
  async memberRoutines(id) { return (await this.listEq('routines', 'memberId', id)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); }
  async memberSales(id) { return (await this.listEq('sales', 'memberId', id)).sort((a, b) => (b.date || '').localeCompare(a.date || '')); }
  async memberAllSessions(id) {
    const s = await getDocs(query(this.col('sessions'), where('memberIds', 'array-contains', id)));
    return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  }
  /** Bitácora del alumno (entrenamientos y pesajes que registra desde su carnet) */
  async memberLogs(code) {
    if (!code) return [];
    const s = await getDocs(collection(db, 'cards', String(code), 'logs'));
    return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  }
  /** Últimos registros de todos los alumnos (consulta por grupo de colecciones) */
  async recentLogs(days = 7) {
    const since = addDays(new Date(), -days).toISOString();
    const s = await getDocs(query(collectionGroup(db, 'logs'), where('tenantId', '==', this.tenantId), where('at', '>=', since)));
    return s.docs.map((d) => ({ id: d.id, code: d.ref.parent.parent.id, ...d.data() })).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  }
}

export const store = new Store();

// ---------- Administración de cuentas (solo administrador general) ----------
export async function listTenants() {
  const s = await getDocs(collection(db, 'tenants'));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || '', 'es', { numeric: true }));
}
export async function updateTenant(id, data) { await setDoc(doc(db, 'tenants', id), data, { merge: true }); }
export async function tenantSalesSince(tenantId, fromISO) {
  const s = await getDocs(query(collection(db, 'tenants', tenantId, 'sales'), where('date', '>=', fromISO)));
  return s.docs.map((d) => d.data());
}
export async function tenantCheckinsOn(tenantId, day) {
  const s = await getDocs(query(collection(db, 'tenants', tenantId, 'checkins'), where('dayKey', '==', day)));
  return s.docs.map((d) => d.data());
}
export async function getTenant(id) {
  const s = await getDoc(doc(db, 'tenants', id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}
export async function createTenantDoc(id, data) { await setDoc(doc(db, 'tenants', id), data); }
export async function getUsername(username) {
  const s = await getDoc(doc(db, 'usernames', String(username).toLowerCase()));
  return s.exists() ? s.data() : null;
}
export async function setUsername(username, data) { await setDoc(doc(db, 'usernames', String(username).toLowerCase()), data); }
export async function deleteUsername(username) { await deleteDoc(doc(db, 'usernames', String(username).toLowerCase())); }
export async function setAnnouncement(data) { await setDoc(doc(db, 'system', 'announcement'), data); }
export async function getAnnouncement() {
  const s = await getDoc(doc(db, 'system', 'announcement'));
  return s.exists() ? s.data() : null;
}
/** Carnet público del alumno (/alumno/CODIGO) */
export async function getCard(code) {
  const s = await getDoc(doc(db, 'cards', String(code).toUpperCase()));
  return s.exists() ? s.data() : null;
}
/** Página pública del entrenador (/coach/USUARIO) */
export async function getPage(slug) {
  const s = await getDoc(doc(db, 'pages', String(slug).toLowerCase()));
  return s.exists() ? s.data() : null;
}
export { DEFAULT_SETTINGS };
