// SanoEntrenador — Operaciones: alumnos, planes, cobros, agenda, asistencia, rutinas, evaluaciones, recordatorios y página pública
import { auth, db, doc, getDoc, writeBatch } from './firebase.js';
import { store, memberStatus, daysBetween, LIVE_STATUS } from './store.js';
import { round2, round4, nowISO, todayKey, dayKey, addDays, fromKey, loc, usd, fmtDate, shortId } from './utils.js';
import { planEnd, evalCalc, exercise } from './gym.js';
import { dietSummary, planEndKey } from './nutrition.js';
import { nutriSummary } from './nutri.js';

export const APP_URL = 'https://sano-entrenador.web.app';
export const by = () => (auth.currentUser?.isAnonymous ? 'demo' : (auth.currentUser?.email || '').split('@')[0] || '—');

const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function genCode(n = 8) {
  return Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => CODE_ALPHA[x % CODE_ALPHA.length]).join('');
}
export const cardUrl = (code) => `${APP_URL}/alumno/${code}`;
export const pageUrl = (slug) => `${APP_URL}/coach/${slug}`;
export const fmtSeq = (prefix, n, len = 5) => `${prefix}-${String(n).padStart(len, '0')}`;
export const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
export const minToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// ======================================================================
// COBROS (sin caja: cada pago queda registrado con su forma de pago)
// ======================================================================
export function itemsTotal(items) { return round2((items || []).reduce((a, i) => a + (Number(i.price) || 0) * (Number(i.qty) || 0), 0)); }
export function cleanItems(items) {
  return (items || []).filter((i) => i && i.name && Number(i.qty) > 0).map((i) => ({
    planId: i.planId || null, name: String(i.name), qty: round4(Number(i.qty)), price: round2(Number(i.price) || 0), kind: i.kind || 'servicio'
  }));
}
export function normalizePays(payments) {
  return (payments || []).filter((p) => p.amount > 0.004).map((p) => ({ method: p.method, currency: loc().cur, amount: round2(p.amount), usd: round4(p.amount) }));
}
/** Lo que queda por forma de pago: lo pagado menos el vuelto (sale del efectivo) */
export function methodNet(sale) {
  const m = {};
  (sale.payments || []).forEach((p) => { m[p.method] = round4((m[p.method] || 0) + (p.usd || 0)); });
  const ch = Number(sale.changeUSD) || 0;
  if (ch > 0.004) m.efectivo = round4((m.efectivo || 0) - ch);
  return m;
}
function preparePayment({ amount, payments }) {
  const pays = normalizePays(payments);
  const paidUSD = round4(pays.reduce((a, p) => a + p.usd, 0));
  if (paidUSD < amount - 0.01) throw new Error(`Falta por cobrar ${usd(amount - paidUSD)}.`);
  const changeUSD = round2(Math.max(0, paidUSD - amount));
  return { pays, paidUSD, changeUSD, received: round2(paidUSD - changeUSD) };
}
export function memberFields(m) {
  return { memberId: m?.id || null, memberName: m?.name || 'Cliente', memberPhone: m?.phone || '', memberIdDoc: m?.idDoc || '', memberNumber: m?.number || '' };
}
function newSale(b, { kind, items, discount = 0, pay, member, extra = {} }) {
  const seq = store.nextSeq(b, 'inv');
  const number = fmtSeq(store.settings.invoicePrefix || 'R', seq, 6);
  const ref = store.newRef('sales');
  const subtotal = itemsTotal(items);
  const total = round2(subtotal - discount);
  const sale = {
    number, seq, kind, date: nowISO(), dayKey: todayKey(), items: items.map((x) => ({ ...x, total: round2(x.price * x.qty) })), subtotal, discount: round2(discount), total,
    rate: 1, payments: pay.pays, paidUSD: pay.paidUSD, changeUSD: pay.changeUSD, method: pay.pays.length === 1 ? pay.pays[0].method : pay.pays.length ? 'mixto' : 'ninguno',
    received: pay.received, fxRate: Number(store.settings.fx?.enabled ? store.settings.fx.rate : 0) || 0, ...memberFields(member), status: 'completed', by: by(), ...extra
  };
  b.set(ref, sale);
  return { id: ref.id, ...sale };
}

// ======================================================================
// CARNET DEL ALUMNO (colección pública cards/{código}: su plan, sesiones, rutina y avances)
// ======================================================================
const EVAL_KEYS = ['weight', 'bmi', 'fat', 'muscle', 'neck', 'chest', 'waist', 'hip', 'arm', 'thigh', 'calf'];
export function compactEval(ev, member = {}) {
  const c = evalCalc(ev, member);
  const o = { date: ev.date };
  for (const k of EVAL_KEYS) { const v = k === 'bmi' ? c.bmi : k === 'fat' ? c.fat : ev[k]; if (v != null && v !== '' && Number(v) > 0) o[k] = Math.round(Number(v) * 10) / 10; }
  return o;
}
function upcomingFor(memberId) {
  return store.memberSessions(memberId).filter((s) => s.date > todayKey() || (s.date === todayKey() && !(s.att || {})[memberId])).slice(0, 6)
    .map((s) => ({ date: s.date, time: s.time, minutes: s.minutes || 60, type: s.type || 'presencial', place: s.place || '' }));
}
export function cardData(m, extra = {}) {
  const ms = m.membership || null;
  const first = String(m.name || '').trim().split(/\s+/);
  const S = store.settings;
  return {
    tenantId: store.tenantId, coach: store.coachName, brand: store.businessName, coachPhone: S.whatsapp || S.phone || '', coachIg: S.instagram || '', specialty: S.specialty || '', coachPage: S.page?.published && S.page?.slug ? S.page.slug : '',
    country: S.country || '', name: first.length > 1 ? `${first[0]} ${first[first.length - 1]}` : first[0] || 'Alumno', number: m.number || '',
    active: m.active !== false, plan: ms ? { name: ms.planName, kind: ms.kind, start: ms.start, end: ms.end, visitsLeft: ms.visitsLeft ?? null, visits: ms.visits ?? null, frozenFrom: ms.frozenFrom || null, frozenUntil: ms.frozenUntil || null, status: ms.status || 'activa', online: !!ms.online, withDiet: !!ms.withDiet, withNutri: !!ms.withNutri } : null,
    debt: (Number(m.balance) || 0) > 0.009, visits: Number(m.visits) || 0, lastCheckinAt: m.lastCheckinAt || null, since: m.createdAt || null,
    goal: m.goal || '', goalWeight: Number(m.goalWeight) || null, sex: m.sex || '', height: m.height || null,
    evals: (m.evalHist || []).slice(-36), lastEval: m.lastEval || null, next: upcomingFor(m.id),
    updatedAt: nowISO(), ...extra
  };
}
function putCard(b, m, extra = {}) {
  if (!m?.cardCode) return;
  b.set(store.cardRef(m.cardCode), cardData(m, extra), { merge: true });
}
/** Vuelve a publicar el carnet (p. ej. tras cambiar la agenda o el perfil del entrenador) */
export async function refreshCards(members) {
  const list = (members || []).filter((m) => m?.cardCode);
  for (let i = 0; i < list.length; i += 80) {
    const b = store.batch();
    list.slice(i, i + 80).forEach((m) => putCard(b, m));
    await store.commit(b);
  }
}
export function routineSummary(r) {
  if (!r) return null;
  return { name: r.name, goal: r.goal || '', level: r.level || '', note: r.note || '', weeks: r.weeks || 0, updatedAt: nowISO(),
    days: (r.days || []).map((d) => ({ name: d.name, items: (d.items || []).map((i) => ({ exId: i.exId || null, name: i.name, sets: i.sets, reps: i.reps, rest: i.rest, weight: i.weight || '', note: i.note || '' })) })) };
}

// ======================================================================
// ALUMNOS
// ======================================================================
const MEMBER_FIELDS = ['name', 'idDoc', 'birthDate', 'sex', 'phone', 'email', 'address', 'occupation', 'photo', 'emergencyName', 'emergencyPhone',
  'goal', 'level', 'activity', 'referredBy', 'notes', 'health', 'tags', 'goalWeight', 'availability', 'place'];
export function cleanMember(data) {
  const out = {};
  for (const k of MEMBER_FIELDS) {
    if (data[k] === undefined) continue;
    out[k] = Array.isArray(data[k]) ? data[k].map((x) => String(x).trim()).filter(Boolean) : typeof data[k] === 'object' && data[k] ? data[k] : String(data[k] ?? '').trim();
  }
  if (out.name) out.name = out.name.replace(/\s+/g, ' ');
  if (out.idDoc) out.idDoc = out.idDoc.toUpperCase().replace(/\s+/g, '');
  if (out.activity) out.activity = Number(out.activity) || 1.55;
  if (out.goalWeight !== undefined) out.goalWeight = Number(String(out.goalWeight).replace(',', '.')) || null;
  return out;
}
const docKey = (v) => String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^[VEJPG]/, '');
export function findByIdDoc(idDoc, exceptId = null) {
  const k = docKey(idDoc);
  if (k.length < 5) return null;
  return store.members.find((p) => p.id !== exceptId && docKey(p.idDoc) === k) || null;
}
function newMemberDoc(b, data) {
  const clean = cleanMember(data);
  if (!clean.name) throw new Error('Escribe el nombre del alumno.');
  const dup = clean.idDoc && findByIdDoc(clean.idDoc);
  if (dup) throw new Error(`Ya existe un alumno con ese documento: ${dup.name} (${dup.number}).`);
  const ref = store.newRef('members');
  const seq = store.nextSeq(b, 'mem');
  const date = nowISO();
  const m = { ...clean, number: fmtSeq('A', seq, 4), seq, cardCode: genCode(8), active: true, visits: 0, totalSpent: 0, balance: 0, noShows: 0, membership: null, lastCheckinAt: null, evalHist: [], createdAt: date, updatedAt: date, by: by() };
  b.set(ref, m);
  const out = { id: ref.id, ...m };
  putCard(b, out);
  return out;
}
export async function saveMember(data, id = null) {
  const b = store.batch();
  if (!id) { const m = newMemberDoc(b, data); await store.commit(b); return m; }
  const clean = cleanMember(data);
  const dup = clean.idDoc && findByIdDoc(clean.idDoc, id);
  if (dup) throw new Error(`Ya existe un alumno con ese documento: ${dup.name} (${dup.number}).`);
  b.set(store.ref('members', id), { ...clean, updatedAt: nowISO() }, { merge: true });
  const m = { ...(store.member(id) || {}), ...clean, id };
  putCard(b, m);
  await store.commit(b);
  return m;
}
export async function setMemberActive(m, active, reason = '') {
  const b = store.batch();
  b.set(store.ref('members', m.id), { active, updatedAt: nowISO(), ...(active ? { leftAt: null, leftReason: '' } : { leftAt: nowISO(), leftReason: reason }) }, { merge: true });
  putCard(b, { ...m, active });
  await store.commit(b);
}
export async function renewCardCode(m) {
  const b = store.batch();
  const code = genCode(8);
  if (m.cardCode) b.delete(store.cardRef(m.cardCode));
  b.set(store.ref('members', m.id), { cardCode: code, updatedAt: nowISO() }, { merge: true });
  const r = m.routineId ? await store.getDocById('routines', m.routineId).catch(() => null) : null;
  putCard(b, { ...m, cardCode: code }, r ? { routine: routineSummary(r) } : {});
  await store.commit(b);
  return code;
}

// ======================================================================
// PLANES DEL ALUMNO
// ======================================================================
export function needsEnroll(m) {
  if ((Number(store.access.enrollFee) || 0) <= 0) return false;
  if (!m?.membership) return true;
  const ms = m.membership;
  if (ms.status === 'anulada') return !m.enrolledAt;
  return ms.end < dayKey(addDays(new Date(), -(Number(store.access.reenrollDays) || 60)));
}
/** Inicio sugerido: el día siguiente al vencimiento si aún está vigente (plan por tiempo); si no, hoy */
export function suggestStart(m) {
  const t = todayKey();
  const ms = m?.membership;
  if (ms && ms.status !== 'anulada' && ms.end >= t && ms.kind === 'tiempo') return dayKey(addDays(fromKey(ms.end), 1));
  return t;
}
export function quoteMembership({ member, plan, start, discount = 0, enroll = null }) {
  const s = start || suggestStart(member);
  const end = planEnd(plan, s);
  const price = round2(Number(plan.price) || 0);
  const withEnroll = enroll == null ? needsEnroll(member) : enroll;
  const enrollFee = withEnroll && plan.kind !== 'pase' ? round2(Number(store.access.enrollFee) || 0) : 0;
  const disc = round2(Math.min(price + enrollFee, Math.max(0, Number(discount) || 0)));
  return { start: s, end, price, enrollFee, discount: disc, total: round2(price + enrollFee - disc) };
}
function snapOf(msId, plan, q, extra = {}) {
  return {
    id: msId, planId: plan.id, planName: plan.name, kind: plan.kind, start: q.start, end: q.end,
    visits: plan.kind === 'tiempo' ? null : Number(plan.visits) || 1, visitsLeft: plan.kind === 'tiempo' ? null : Number(plan.visits) || 1,
    status: 'activa', freezeDays: Number(plan.freezeDays) || 0, freezeUsed: 0, frozenFrom: null, frozenUntil: null, online: !!plan.online, withDiet: !!plan.withDiet, withNutri: !!plan.withNutri, ...extra
  };
}
/**
 * Vende un plan. paid: lo que se cobra ahora (si es menos que el total, el resto queda como deuda).
 * Si el alumno renueva un paquete con sesiones sin usar, se suman al nuevo.
 */
export async function sellMembership({ member, plan, start, discount = 0, enroll = null, paid = null, payments = [], note = '', carry = true }) {
  if (!plan) throw new Error('Elige un plan.');
  const b = store.batch();
  let m = member;
  if (!m?.id) m = newMemberDoc(b, member || {});
  const q = quoteMembership({ member: m, plan, start, discount, enroll });
  if (q.end < todayKey()) throw new Error('El plan quedaría vencido: revisa la fecha de inicio.');
  const pay = paid == null ? q.total : round2(Math.min(q.total, Math.max(0, Number(paid) || 0)));
  const balance = round2(q.total - pay);
  const date = nowISO();
  const msRef = store.newRef('memberships');
  const cur = m.membership;
  const leftover = carry && cur && cur.status !== 'anulada' && cur.kind === 'sesiones' && plan.kind === 'sesiones' && cur.end >= todayKey() ? Math.max(0, Number(cur.visitsLeft) || 0) : 0;
  const items = cleanItems([
    { name: `${plan.name} · ${fmtDate(q.start)} al ${fmtDate(q.end)}`, price: q.price, qty: 1, planId: plan.id, kind: 'plan' },
    ...(q.enrollFee ? [{ name: 'Inscripción', price: q.enrollFee, qty: 1, kind: 'inscripcion' }] : [])
  ]);
  let sale = null;
  if (pay > 0.004) {
    const p = preparePayment({ amount: pay, payments });
    const saleItems = balance > 0.009 ? cleanItems([{ name: `Abono: ${plan.name} (${fmtDate(q.start)} al ${fmtDate(q.end)})`, price: pay, qty: 1, planId: plan.id, kind: 'abono' }]) : items;
    sale = newSale(b, { kind: balance > 0.009 ? 'abono' : 'plan', items: saleItems, discount: balance > 0.009 ? 0 : q.discount, pay: p, member: m, extra: { membershipId: msRef.id, planId: plan.id, note } });
  }
  const visits = plan.kind === 'tiempo' ? null : (Number(plan.visits) || 1) + leftover;
  const ms = {
    ...memberFields(m), planId: plan.id, planName: plan.name, kind: plan.kind, start: q.start, end: q.end, visits, visitsLeft: visits, carried: leftover,
    price: q.price, enrollFee: q.enrollFee, discount: q.discount, total: q.total, paid: pay, balance, status: 'activa', online: !!plan.online, withDiet: !!plan.withDiet, withNutri: !!plan.withNutri,
    freezes: [], saleIds: sale ? [sale.id] : [], prev: cur || null, renewal: !!(cur && cur.status !== 'anulada'), note, createdAt: date, by: by()
  };
  b.set(msRef, ms);
  const live = cur && cur.status !== 'anulada' && LIVE_STATUS.includes(memberStatus(m));
  const snap = snapOf(msRef.id, plan, q, { visits, visitsLeft: visits, ...(live && q.start > todayKey() ? { start: cur.start, paidFrom: q.start } : {}) });
  b.set(store.ref('members', m.id), { membership: snap, totalSpent: store.inc(pay), balance: store.inc(balance), updatedAt: date, ...(q.enrollFee ? { enrolledAt: date } : {}) }, { merge: true });
  const after = { ...m, membership: snap, balance: (Number(m.balance) || 0) + balance };
  putCard(b, after);
  await store.commit(b);
  return { member: after, membership: { id: msRef.id, ...ms }, sale, quote: q, balance, carried: leftover };
}
export async function payBalance(m, { amount, payments, note = '' }) {
  const bal = round2(Number(m.balance) || 0);
  const amt = round2(Math.min(bal, Number(amount) || 0));
  if (!(amt > 0)) throw new Error('Indica el monto a abonar.');
  const b = store.batch();
  const p = preparePayment({ amount: amt, payments });
  const msId = m.membership?.id || null;
  const sale = newSale(b, { kind: 'abono', items: cleanItems([{ name: `Abono a deuda${m.membership ? ' · ' + m.membership.planName : ''}`, price: amt, qty: 1, kind: 'abono' }]), pay: p, member: m, extra: { membershipId: msId, note } });
  b.set(store.ref('members', m.id), { balance: store.inc(-amt), totalSpent: store.inc(amt), updatedAt: nowISO() }, { merge: true });
  if (msId) b.set(store.ref('memberships', msId), { paid: store.inc(amt), balance: store.inc(-amt), updatedAt: nowISO() }, { merge: true });
  putCard(b, { ...m, balance: bal - amt });
  await store.commit(b);
  return { sale };
}
/** Cobro libre: evaluación, plan de alimentación, servicio extra… (con o sin alumno) */
export async function chargeService({ lines, member = null, discount = 0, payments = [], note = '' }) {
  const clean = cleanItems(lines);
  if (!clean.length) throw new Error('No hay nada para cobrar.');
  const total = round2(itemsTotal(clean) - Math.max(0, Number(discount) || 0));
  const pay = preparePayment({ amount: total, payments });
  const b = store.batch();
  const sale = newSale(b, { kind: 'servicio', items: clean, discount, pay, member, extra: { note } });
  if (member?.id && store.member(member.id)) b.update(store.ref('members', member.id), { totalSpent: store.inc(total) });
  await store.commit(b);
  return { sale };
}
/** Pausa el plan N días (viaje, lesión): el vencimiento se corre esos días */
export async function freezeMembership(m, { from, days, reason = '', force = false }) {
  const ms = m.membership;
  if (!ms || ms.status === 'anulada') throw new Error('El alumno no tiene un plan para pausar.');
  if (ms.kind === 'pase') throw new Error('Una sesión suelta no se puede pausar.');
  const d = Math.round(Number(days) || 0);
  if (d < 1) throw new Error('Indica los días a pausar.');
  if (from > ms.end) throw new Error('La fecha de inicio es posterior al vencimiento.');
  const allowed = Math.max(0, (Number(ms.freezeDays) || 0) - (Number(ms.freezeUsed) || 0));
  if (d > allowed && !force) throw new Error(allowed ? `Este plan permite pausar ${allowed} día(s) más.` : 'Este plan no incluye días de pausa.');
  const until = dayKey(addDays(fromKey(from), d - 1));
  const end = dayKey(addDays(fromKey(ms.end), d));
  const snap = { ...ms, frozenFrom: from, frozenUntil: until, end, freezeUsed: (Number(ms.freezeUsed) || 0) + d };
  const b = store.batch();
  b.set(store.ref('members', m.id), { membership: snap, updatedAt: nowISO() }, { merge: true });
  b.set(store.ref('memberships', ms.id), { end, freezeUsed: snap.freezeUsed, freezes: [...(ms.freezes || []), { from, until, days: d, reason, at: nowISO(), by: by() }], updatedAt: nowISO() }, { merge: true });
  putCard(b, { ...m, membership: snap });
  await store.commit(b);
  return snap;
}
export async function unfreezeMembership(m) {
  const ms = m.membership;
  const t = todayKey();
  if (!ms?.frozenUntil || ms.frozenUntil < t) throw new Error('El plan no está pausado.');
  const startAt = ms.frozenFrom && ms.frozenFrom > t ? ms.frozenFrom : t;
  const unused = daysBetween(startAt, ms.frozenUntil) + 1;
  const end = dayKey(addDays(fromKey(ms.end), -unused));
  const snap = { ...ms, frozenUntil: ms.frozenFrom && ms.frozenFrom > t ? null : dayKey(addDays(new Date(), -1)), frozenFrom: ms.frozenFrom && ms.frozenFrom > t ? null : ms.frozenFrom, end, freezeUsed: Math.max(0, (Number(ms.freezeUsed) || 0) - unused) };
  const b = store.batch();
  b.set(store.ref('members', m.id), { membership: snap, updatedAt: nowISO() }, { merge: true });
  b.set(store.ref('memberships', ms.id), { end, freezeUsed: snap.freezeUsed, updatedAt: nowISO() }, { merge: true });
  putCard(b, { ...m, membership: snap });
  await store.commit(b);
  return snap;
}
export async function adjustMembership(m, { end, visitsLeft, reason = '' }) {
  const ms = m.membership;
  if (!ms) throw new Error('El alumno no tiene plan.');
  if (end && ms.start && end < ms.start) throw new Error('El vencimiento no puede ser anterior al inicio del plan.');
  const snap = { ...ms, ...(end ? { end } : {}), ...(visitsLeft != null && ms.kind !== 'tiempo' ? { visitsLeft: Math.max(0, Math.round(visitsLeft)) } : {}) };
  const b = store.batch();
  b.set(store.ref('members', m.id), { membership: snap, updatedAt: nowISO() }, { merge: true });
  b.set(store.ref('memberships', ms.id), { end: snap.end, visitsLeft: snap.visitsLeft ?? null, adjustments: [...(ms.adjustments || []), { at: nowISO(), by: by(), from: ms.end, to: snap.end, visits: snap.visitsLeft ?? null, reason }], updatedAt: nowISO() }, { merge: true });
  putCard(b, { ...m, membership: snap });
  await store.commit(b);
  return snap;
}
/** Anula un recibo: si era de un plan, lo anula; si era un abono, devuelve la deuda */
export async function voidSale(sale, reason = '') {
  if (sale.status === 'voided') throw new Error('El recibo ya está anulado.');
  const b = store.batch();
  const date = nowISO();
  b.update(store.ref('sales', sale.id), { status: 'voided', voidedAt: date, voidReason: reason || '', voidedBy: by() });
  const m = sale.memberId ? store.member(sale.memberId) : null;
  if (sale.membershipId && sale.kind === 'plan') {
    const ms = await store.getDocById('memberships', sale.membershipId);
    b.set(store.ref('memberships', sale.membershipId), { status: 'anulada', voidedAt: date, voidReason: reason, balance: 0 }, { merge: true });
    if (m) {
      const patch = { totalSpent: store.inc(-(sale.total || 0)), balance: store.inc(-(Number(ms?.balance) || 0)), updatedAt: date };
      if (m.membership?.id === sale.membershipId) patch.membership = ms?.prev || null;
      b.set(store.ref('members', m.id), patch, { merge: true });
      putCard(b, { ...m, ...(m.membership?.id === sale.membershipId ? { membership: ms?.prev || null } : {}) });
    }
  } else if (sale.membershipId && sale.kind === 'abono') {
    b.set(store.ref('memberships', sale.membershipId), { paid: store.inc(-(sale.total || 0)), balance: store.inc(sale.total || 0) }, { merge: true });
    if (m) b.set(store.ref('members', m.id), { balance: store.inc(sale.total || 0), totalSpent: store.inc(-(sale.total || 0)) }, { merge: true });
  } else if (m) b.update(store.ref('members', m.id), { totalSpent: store.inc(-(sale.total || 0)) });
  await store.commit(b);
}

// ======================================================================
// ASISTENCIA
// ======================================================================
/** ¿Puede entrenar hoy? → { level: 'ok' | 'warn' | 'deny', reasons, notes, consume } */
export function checkAttendance(m, now = new Date()) {
  const t = dayKey(now);
  const reasons = []; const notes = [];
  if (!m) return { level: 'deny', reasons: ['El código no corresponde a ningún alumno.'], notes, consume: false };
  const ms = m.membership;
  let consume = false;
  if (m.active === false) reasons.push('El alumno está dado de baja.');
  else if (!ms || ms.status === 'anulada') reasons.push('No tiene un plan activo. Véndele un plan o una sesión suelta.');
  else {
    const st = memberStatus(m, t);
    if (st === 'congelado') reasons.push(`Plan pausado hasta el ${fmtDate(ms.frozenUntil)}.`);
    else if (st === 'pendiente') reasons.push(`Su plan empieza el ${fmtDate(ms.start)}.`);
    else if (ms.end < t) {
      const late = daysBetween(ms.end, t);
      if (late <= (Number(store.access.graceDays) || 0)) notes.push(`Venció hace ${late} día(s): entrena por los días de gracia. Recuérdale renovar.`);
      else reasons.push(`Plan vencido desde el ${fmtDate(ms.end)} (hace ${late} días).`);
    } else {
      const left = daysBetween(t, ms.end);
      if (left === 0) notes.push('Su plan vence HOY. Ofrécele renovar.');
      else if (left <= (store.settings.remindDays ?? 5)) notes.push(`Vence en ${left} día(s) (${fmtDate(ms.end)}).`);
    }
    if (ms.kind !== 'tiempo' && !reasons.length) {
      if (Number(ms.visitsLeft ?? 0) <= 0) reasons.push('Ya usó todas las sesiones de su paquete.');
      else { consume = true; const after = Number(ms.visitsLeft) - 1; notes.push(after <= 2 ? `Le quedarán ${after} sesión(es).` : `Sesión ${Number(ms.visits) - after} de ${ms.visits}.`); }
    }
  }
  if ((Number(m.balance) || 0) > 0.009) notes.push(`Tiene un saldo pendiente de ${usd(m.balance)}.`);
  if (m.health?.conditions?.length) notes.push(`Salud: ${m.health.conditions.join(', ')}.`);
  if (m.birthDate && m.birthDate.slice(5) === t.slice(5)) notes.unshift('🎂 ¡Hoy es su cumpleaños!');
  const level = reasons.length ? 'deny' : notes.some((n) => !/cumplea|Sesión \d|Salud:/.test(n)) ? 'warn' : 'ok';
  return { level, reasons, notes, consume };
}

function checkinDoc(m, { via, sessionId = null, consumed = false, note = '', date = nowISO() }) {
  const ms = m.membership || null; const d = new Date(date);
  return { ...memberFields(m), date, dayKey: dayKey(d), hour: d.getHours(), weekday: d.getDay(), via, result: 'ok', planName: ms?.planName || '', membershipId: ms?.id || null, sessionId, consumed, note, by: by() };
}
/** Aplica (+1) o revierte (−1) una sesión consumida en el alumno */
function applyConsume(b, m, delta, date) {
  const ms = m.membership;
  const patch = { updatedAt: nowISO() };
  let after = { ...m };
  if (delta > 0) { patch.visits = store.inc(1); patch.lastCheckinAt = date; after = { ...after, visits: (Number(m.visits) || 0) + 1, lastCheckinAt: date }; }
  else patch.visits = store.inc(-1);
  if (ms && ms.kind !== 'tiempo' && ms.status !== 'anulada') {
    const snap = { ...ms, visitsLeft: Math.max(0, Number(ms.visitsLeft || 0) - delta) };
    patch.membership = snap; after.membership = snap;
    b.set(store.ref('memberships', ms.id), { visitsLeft: store.inc(-delta), updatedAt: nowISO() }, { merge: true });
  }
  b.set(store.ref('members', m.id), patch, { merge: true });
  return after;
}

/**
 * Marca la asistencia de un alumno a una sesión de la agenda.
 * status: 'asistio' | 'falto' | 'cancelo' | null (sin marcar). Asistió descuenta una sesión; faltó también si así se configuró.
 */
export async function setAttendance(session, memberId, status) {
  const m = store.member(memberId);
  if (!m) throw new Error('Alumno no encontrado.');
  const prev = (session.att || {})[memberId] || null;
  if (prev === status) return;
  const consumes = (s) => s === 'asistio' || (s === 'falto' && store.access.noShowConsumes !== false);
  const was = !!(session.consumed || {})[memberId];
  const will = consumes(status);
  const b = store.batch();
  const date = session.date === todayKey() ? nowISO() : new Date(`${session.date}T${session.time || '12:00'}:00`).toISOString();
  let after = m;
  if (!was && will) after = applyConsume(b, m, 1, date);
  if (was && !will) after = applyConsume(b, m, -1, date);
  const ckId = `${session.id}_${memberId}`;
  if (status === 'asistio') b.set(store.ref('checkins', ckId), checkinDoc(m, { via: 'sesion', sessionId: session.id, consumed: will, date }));
  else if (prev === 'asistio') b.delete(store.ref('checkins', ckId));
  if (status === 'falto' && prev !== 'falto') b.set(store.ref('members', memberId), { noShows: store.inc(1) }, { merge: true });
  if (prev === 'falto' && status !== 'falto') b.set(store.ref('members', memberId), { noShows: store.inc(-1) }, { merge: true });
  const att = { ...(session.att || {}) }; const cons = { ...(session.consumed || {}) };
  if (status) att[memberId] = status; else delete att[memberId];
  if (will) cons[memberId] = true; else delete cons[memberId];
  b.set(store.ref('sessions', session.id), { att, consumed: cons, updatedAt: nowISO() }, { merge: true });
  putCard(b, after);
  await store.commit(b);
}

/** Asistencia por QR o manual: si tiene una sesión hoy la marca; si no, registra una sesión fuera de agenda. */
export async function registerAttendance(m, { via = 'qr', check = null, force = false } = {}) {
  const r = check || checkAttendance(m);
  if (r.level === 'deny' && !force) return { ok: false, check: r };
  const today = store.sessionsOn(todayKey()).filter((s) => (s.memberIds || []).includes(m.id) && !(s.att || {})[m.id]);
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  const session = today.sort((a, b) => Math.abs(toMin(a.time) - nowM) - Math.abs(toMin(b.time) - nowM))[0];
  if (session) { await setAttendance(session, m.id, 'asistio'); return { ok: true, check: r, session }; }
  const already = store.todayCheckins.find((c) => c.memberId === m.id && !c.sessionId);
  if (already) return { ok: true, check: { ...r, notes: ['Ya registró asistencia hoy: no se descuenta otra sesión.', ...r.notes] }, duplicate: true };
  const b = store.batch();
  const date = nowISO();
  const consume = r.consume || (force && m.membership?.kind !== 'tiempo' && Number(m.membership?.visitsLeft) > 0);
  let after = m;
  if (consume) after = applyConsume(b, m, 1, date);
  else { b.set(store.ref('members', m.id), { lastCheckinAt: date, visits: store.inc(1), updatedAt: date }, { merge: true }); after = { ...m, lastCheckinAt: date, visits: (Number(m.visits) || 0) + 1 }; }
  b.set(store.newRef('checkins'), checkinDoc(m, { via, consumed: !!consume, note: force ? 'Autorizado por el entrenador' : '' }));
  putCard(b, after);
  await store.commit(b);
  return { ok: true, check: r };
}

// ======================================================================
// AGENDA
// ======================================================================
/**
 * Crea o edita una sesión. repeat: { weeks, days: [0..6] } crea una serie semanal.
 * data: { date, time, minutes, type, place, note, memberIds }
 */
export async function saveSession(data, id = null, { repeat = null } = {}) {
  const ids = [...new Set(data.memberIds || [])].filter((x) => store.member(x));
  if (!ids.length) throw new Error('Elige al menos un alumno.');
  if (!data.date || !data.time) throw new Error('Indica la fecha y la hora.');
  const members = ids.map((x) => { const m = store.member(x); return { id: m.id, name: m.name, phone: m.phone || '' }; });
  const base = { time: data.time, minutes: Math.max(15, Number(data.minutes) || 60), type: data.type || 'presencial', place: String(data.place || '').trim(), note: String(data.note || '').trim(), memberIds: ids, members, updatedAt: nowISO() };
  const b = store.batch();
  const dates = [];
  if (id) {
    b.set(store.ref('sessions', id), { ...base, date: data.date }, { merge: true });
    dates.push(data.date);
  } else {
    const seriesId = repeat?.weeks > 1 ? shortId(10) : null;
    const days = repeat?.days?.length ? repeat.days : [fromKey(data.date).getDay()];
    const start = fromKey(data.date);
    const weeks = Math.min(26, Math.max(1, Number(repeat?.weeks) || 1));
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(start, i);
      if (!days.includes(d.getDay())) continue;
      const dk = dayKey(d);
      dates.push(dk);
      b.set(store.newRef('sessions'), { ...base, date: dk, status: 'programada', att: {}, consumed: {}, seriesId, createdAt: nowISO(), by: by() });
      if (dates.length >= 120) break;
    }
  }
  await store.commit(b);
  await new Promise((r) => setTimeout(r, 150));
  await refreshCards(ids.map((x) => store.member(x)));
  return { count: dates.length };
}
export async function cancelSession(s, { series = false, reason = '' } = {}) {
  const list = series && s.seriesId ? store.sessions.filter((x) => x.seriesId === s.seriesId && x.date >= s.date && x.status !== 'cancelada' && !Object.keys(x.consumed || {}).length) : [s];
  for (let i = 0; i < list.length; i += 80) {
    const b = store.batch();
    list.slice(i, i + 80).forEach((x) => b.set(store.ref('sessions', x.id), { status: 'cancelada', cancelReason: reason, cancelledAt: nowISO() }, { merge: true }));
    await store.commit(b);
  }
  await refreshCards((s.memberIds || []).map((x) => store.member(x)));
  return list.length;
}
/** Marca todas las asistencias pendientes de una sesión como "asistió" */
export async function completeSession(s) {
  for (const id of s.memberIds || []) {
    const cur = store.sessions.find((x) => x.id === s.id) || s;
    if (!(cur.att || {})[id]) await setAttendance(cur, id, 'asistio');
  }
}

// ======================================================================
// RUTINAS
// ======================================================================
export function cleanRoutine(r) {
  return {
    name: String(r.name || 'Rutina').trim(), goal: r.goal || '', level: r.level || '', weeks: Number(r.weeks) || 0, note: String(r.note || '').trim(),
    days: (r.days || []).map((d, i) => ({ name: String(d.name || `Día ${i + 1}`).trim(), items: (d.items || []).filter((x) => x && x.name).map((x) => ({
      exId: x.exId || null, name: String(x.name).trim(), sets: Number(x.sets) || 0, reps: String(x.reps ?? '').trim(), rest: Number(x.rest) || 0, weight: String(x.weight ?? '').trim(), note: String(x.note ?? '').trim()
    })) }))
  };
}
/** Guarda una rutina. Si es de un alumno, queda como su rutina activa y se publica en su carnet. */
export async function saveRoutine(data, id = null, member = null) {
  const r = cleanRoutine(data);
  if (!r.days.length || !r.days.some((d) => d.items.length)) throw new Error('Agrega al menos un ejercicio.');
  const b = store.batch();
  const ref = id ? store.ref('routines', id) : store.newRef('routines');
  const docData = { ...r, template: !member, memberId: member?.id || null, memberName: member?.name || '', trainer: store.coachName, active: true, updatedAt: nowISO(), ...(id ? {} : { createdAt: nowISO(), by: by() }) };
  b.set(ref, docData, { merge: true });
  if (member) {
    b.set(store.ref('members', member.id), { routineId: ref.id, routineName: r.name, routineAt: nowISO(), updatedAt: nowISO() }, { merge: true });
    putCard(b, member, { routine: routineSummary(docData) });
  }
  await store.commit(b);
  return { id: ref.id, ...docData };
}
export async function deleteRoutine(r) { await store.remove('routines', r.id); }

// ======================================================================
// PLANES DE ALIMENTACIÓN (semanal = 7 días · mensual = 28 días). El del alumno se publica en su carnet.
// ======================================================================
const cleanItem = (it) => (it.f ? { f: String(it.f), q: Math.round((Number(it.q) || 0) * 100) / 100 } : { n: String(it.n || '').trim().slice(0, 80), q: String(it.q || '').trim().slice(0, 30), k: Math.round(Number(it.k) || 0) });
export function cleanDiet(d) {
  return {
    name: String(d.name || '').trim() || 'Plan de alimentación', goal: String(d.goal || ''), type: d.type || 'todo',
    kcal: Math.round(Number(String(d.kcal ?? '').replace(',', '.')) || 0) || null, meals: Number(d.meals) || (d.days?.[0]?.meals || []).length || 5,
    period: d.period === 'mensual' ? 'mensual' : 'semanal', water: Number(d.water) || null, note: String(d.note || '').trim(),
    params: d.params || null,
    days: (d.days || []).map((x) => ({ meals: (x.meals || []).map((m) => ({ slot: m.slot || '', name: String(m.name || '').trim(), time: String(m.time || ''), title: String(m.title || '').trim(), items: (m.items || []).map(cleanItem).filter((i) => (i.f ? i.q > 0 : i.n)) })) }))
  };
}
export async function saveDiet(data, id = null, member = null) {
  const d = cleanDiet(data);
  if (!d.days.length || !d.days.some((x) => x.meals.some((m) => m.items.length))) throw new Error('Agrega al menos una comida con alimentos.');
  if (member) {
    d.start = data.start || todayKey();
    d.end = planEndKey(d.start, d.period);
  }
  const b = store.batch();
  const ref = id ? store.ref('diets', id) : store.newRef('diets');
  const docData = { ...d, template: !member, memberId: member?.id || null, memberName: member?.name || '', trainer: store.coachName, active: true, updatedAt: nowISO(), ...(id ? {} : { createdAt: nowISO(), by: by() }) };
  b.set(ref, docData, { merge: true });
  if (member) {
    b.set(store.ref('members', member.id), { dietId: ref.id, dietName: d.name, dietStart: d.start, dietEnd: d.end, dietPeriod: d.period, updatedAt: nowISO() }, { merge: true });
    putCard(b, member, { diet: dietSummary(docData) });
  }
  await store.commit(b);
  return { id: ref.id, ...docData };
}
/** Quita el plan del carnet del alumno (el historial se conserva) */
export async function removeMemberDiet(member) {
  const b = store.batch();
  b.set(store.ref('members', member.id), { dietId: null, dietName: '', dietStart: null, dietEnd: null, dietPeriod: null, updatedAt: nowISO() }, { merge: true });
  putCard(b, member, { diet: null });
  await store.commit(b);
}
export async function deleteDiet(d) { await store.remove('diets', d.id); }
// ======================================================================
// PLANES DE NUTRICIÓN (metas, horarios, suplementos y hábitos). El del alumno se publica en su carnet.
// ======================================================================
const txt = (v, n = 200) => String(v ?? '').trim().slice(0, n);
const lines = (a) => (Array.isArray(a) ? a : String(a || '').split('\n')).map((x) => txt(x)).filter(Boolean).slice(0, 14);
const numOr = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return n > 0 ? Math.round(n * 10) / 10 : null; };
export function cleanNutri(d) {
  return {
    name: txt(d.name, 90) || 'Plan de nutrición', goal: txt(d.goal, 60), type: d.type === 'veg' ? 'veg' : 'todo', period: d.period === 'mensual' ? 'mensual' : 'semanal',
    weight: numOr(d.weight), kcal: Math.round(numOr(d.kcal) || 0) || null, protein: Math.round(numOr(d.protein) || 0) || null, carbs: Math.round(numOr(d.carbs) || 0) || null, fat: Math.round(numOr(d.fat) || 0) || null,
    pkg: numOr(d.pkg), fkg: numOr(d.fkg), water: numOr(d.water), fiber: Math.round(numOr(d.fiber) || 0) || null, meals: Number(d.meals) || null, trainDays: Number(d.trainDays) || null,
    timing: (d.timing || []).map((t) => ({ when: txt(t.when, 80), text: txt(t.text, 240) })).filter((t) => t.when || t.text).slice(0, 12),
    supplements: (d.supplements || []).map((x) => ({ name: txt(x.name, 80), dose: txt(x.dose, 80), when: txt(x.when, 160) })).filter((x) => x.name).slice(0, 10),
    prioritize: lines(d.prioritize), moderate: lines(d.moderate), avoid: lines(d.avoid), habits: lines(d.habits),
    phases: (d.phases || []).map((x) => ({ title: txt(x.title, 80), text: txt(x.text, 260) })).filter((x) => x.title || x.text).slice(0, 4),
    note: txt(d.note, 600), params: d.params || null
  };
}
export async function saveNutri(data, id = null, member = null) {
  const d = cleanNutri(data);
  if (!d.kcal && !d.protein && !d.habits.length && !d.timing.length) throw new Error('Indica al menos las calorías o los hábitos del plan.');
  if (member) { d.start = data.start || todayKey(); d.end = planEndKey(d.start, d.period); }
  const b = store.batch();
  const ref = id ? store.ref('nutris', id) : store.newRef('nutris');
  const docData = { ...d, template: !member, memberId: member?.id || null, memberName: member?.name || '', trainer: store.coachName, active: true, updatedAt: nowISO(), ...(id ? {} : { createdAt: nowISO(), by: by() }) };
  b.set(ref, docData, { merge: true });
  if (member) {
    b.set(store.ref('members', member.id), { nutriId: ref.id, nutriName: d.name, nutriStart: d.start, nutriEnd: d.end, nutriPeriod: d.period, updatedAt: nowISO() }, { merge: true });
    putCard(b, member, { nutri: nutriSummary(docData) });
  }
  await store.commit(b);
  return { id: ref.id, ...docData };
}
export async function removeMemberNutri(member) {
  const b = store.batch();
  b.set(store.ref('members', member.id), { nutriId: null, nutriName: '', nutriStart: null, nutriEnd: null, nutriPeriod: null, updatedAt: nowISO() }, { merge: true });
  putCard(b, member, { nutri: null });
  await store.commit(b);
}
export async function deleteNutri(d) { await store.remove('nutris', d.id); }
/** Lo que el plan del alumno incluye y aún no se le ha asignado */
export function pendingExtras(m, today = todayKey()) {
  const ms = m?.membership;
  if (!ms || ms.status === 'anulada' || (ms.end && ms.end < today) || m.active === false) return [];
  const out = [];
  if (ms.withDiet && (!m.dietId || (m.dietEnd && m.dietEnd < today))) out.push('diet');
  if (ms.withNutri && (!m.nutriId || (m.nutriEnd && m.nutriEnd < today))) out.push('nutri');
  return out;
}
export const exLine = (id, sets = 3, reps = '12', rest = 60) => { const e = exercise(id); return { exId: id, name: e?.name || id, sets, reps, rest, weight: '', note: '' }; };

// ======================================================================
// EVALUACIONES (cada una se publica en el carnet: el alumno ve sus avances)
// ======================================================================
const EVAL_NUM = ['weight', 'height', 'fat', 'muscle', 'visceral', 'neck', 'chest', 'waist', 'hip', 'arm', 'thigh', 'calf', 'restHr'];
async function rebuildHist(b, member, list) {
  const sorted = [...list].sort((a, b2) => (a.date || '').localeCompare(b2.date || ''));
  const hist = sorted.map((e) => compactEval(e, member)).slice(-36);
  const first = sorted[0]; const last = sorted[sorted.length - 1];
  const sum = (e) => (e ? { date: e.date, weight: e.weight, bmi: evalCalc(e, member).bmi, fat: evalCalc(e, member).fat, height: e.height || null } : null);
  const patch = { evalHist: hist, firstEval: sum(first), lastEval: sum(last), height: last?.height || member.height || null, updatedAt: nowISO() };
  b.set(store.ref('members', member.id), patch, { merge: true });
  putCard(b, { ...member, ...patch });
}
export async function saveEvaluation(member, data, id = null) {
  const ev = { date: data.date || todayKey(), bp: String(data.bp || '').trim(), notes: String(data.notes || '').trim(), activity: Number(data.activity) || member.activity || 1.55 };
  for (const k of EVAL_NUM) { const v = Number(String(data[k] ?? '').replace(',', '.')); if (v > 0) ev[k] = Math.round(v * 10) / 10; }
  if (!ev.weight) throw new Error('Indica al menos el peso.');
  if (!ev.height && member.height) ev.height = member.height;
  const c = evalCalc(ev, member);
  Object.assign(ev, { bmi: c.bmi, fatCalc: c.fat, lean: c.lean, bmr: c.energy?.bmr || null, memberId: member.id, memberName: member.name, by: by(), updatedAt: nowISO() });
  const list = (await store.memberEvals(member.id)).filter((x) => x.id !== id);
  const b = store.batch();
  const ref = id ? store.ref('evaluations', id) : store.newRef('evaluations');
  b.set(ref, { ...ev, ...(id ? {} : { createdAt: nowISO() }) }, { merge: true });
  await rebuildHist(b, store.member(member.id) || member, [...list, { id: ref.id, ...ev }]);
  await store.commit(b);
  return { id: ref.id, ...ev, calc: c };
}
export async function deleteEvaluation(ev, member) {
  const list = (await store.memberEvals(member.id)).filter((x) => x.id !== ev.id);
  const b = store.batch();
  b.delete(store.ref('evaluations', ev.id));
  await rebuildHist(b, store.member(member.id) || member, list);
  await store.commit(b);
}
/** Meta de peso del alumno (se ve en su carnet con una barra de progreso) */
export async function setGoalWeight(member, kg) {
  const v = Number(String(kg).replace(',', '.')) || null;
  const b = store.batch();
  b.set(store.ref('members', member.id), { goalWeight: v, updatedAt: nowISO() }, { merge: true });
  putCard(b, { ...member, goalWeight: v });
  await store.commit(b);
}

// ======================================================================
// RECORDATORIOS
// ======================================================================
/** Registra que se envió un recordatorio (para no repetirlo) */
export async function logSent(key, data = {}) {
  await store.save('remlog', key.replace(/[/.#$[\]]/g, '_'), { at: nowISO(), ...data, by: by() }, false);
}
export async function saveReminder(data, id = null) {
  if (!String(data.text || '').trim()) throw new Error('Escribe el recordatorio.');
  const m = data.memberId ? store.member(data.memberId) : null;
  const doc2 = { text: String(data.text).trim(), date: data.date || todayKey(), memberId: m?.id || null, memberName: m?.name || '', memberPhone: m?.phone || '', wa: !!data.wa && !!m, repeat: data.repeat || '', done: false, updatedAt: nowISO(), ...(id ? {} : { createdAt: nowISO(), by: by() }) };
  await store.save('reminders', id || store.newRef('reminders').id, doc2, !!id);
}
export async function doneReminder(r) {
  if (r.repeat) {
    const next = r.repeat === 'semanal' ? addDays(fromKey(r.date), 7) : r.repeat === 'mensual' ? new Date(fromKey(r.date).setMonth(fromKey(r.date).getMonth() + 1)) : addDays(fromKey(r.date), 1);
    await store.save('reminders', r.id, { date: dayKey(next), lastDoneAt: nowISO() });
  } else await store.save('reminders', r.id, { done: true, doneAt: nowISO() });
}
export async function deleteReminder(r) { await store.remove('reminders', r.id); }

// ======================================================================
// PÁGINA PÚBLICA DEL ENTRENADOR (pages/{usuario})
// ======================================================================
export const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
export async function publishPage({ slug, published = true, showPrices = true, photo = '' }) {
  const s = slugify(slug);
  if (s.length < 3) throw new Error('La dirección debe tener al menos 3 letras o números.');
  const ref = doc(db, 'pages', s);
  const cur = await getDoc(ref).catch(() => null);
  if (cur?.exists() && cur.data().tenantId !== store.tenantId) throw new Error('Esa dirección ya la usa otro entrenador. Prueba con otra.');
  const S = store.settings;
  const old = S.page?.slug && S.page.slug !== s ? doc(db, 'pages', S.page.slug) : null;
  const b = writeBatch(db);
  b.set(ref, {
    tenantId: store.tenantId, slug: s, published, coach: store.coachName, brand: store.businessName, specialty: S.specialty || '', bio: S.bio || '', certifications: S.certifications || '',
    city: S.city || '', address: S.address || '', instagram: S.instagram || '', whatsapp: S.whatsapp || S.phone || '', country: S.country || '', currency: S.currency || '',
    places: S.places || [], hours: S.agenda ? { start: S.agenda.start, end: S.agenda.end, days: S.agenda.days } : null, photo: photo || S.page?.photo || '',
    plans: showPrices ? store.activePlans.map((p) => ({ name: p.name, price: p.price, kind: p.kind, visits: p.visits || null, months: p.months || 0, days: p.days || 0, online: !!p.online, popular: !!p.popular, withDiet: !!p.withDiet, withNutri: !!p.withNutri, note: p.note || '', color: p.color || '' })) : [],
    students: store.activeMembers.length, updatedAt: nowISO()
  });
  if (old) b.delete(old);
  await b.commit();
  await store.saveSettings({ page: { ...S.page, slug: s, published, showPrices, ...(photo ? { photo } : {}) } });
  return s;
}

export { addDays, dayKey };
