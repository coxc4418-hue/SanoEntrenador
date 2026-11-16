// SanoEntrenador — Modo demo (sesión anónima de 30 minutos) con un entrenador y sus alumnos de ejemplo
import { auth, db, doc, collection, writeBatch, getDoc, getDocs, Timestamp, signInAnonymously, signOut } from './firebase.js';
import { store, DEFAULT_SETTINGS } from './store.js';
import { fmtSeq, genCode, cardData, routineSummary, compactEval, refreshCards } from './ops.js';
import { round2, nowISO, todayKey, dayKey, addDays, fromKey, sha256, scaleUSD } from './utils.js';
import { planEnd, evalCalc, ROUTINE_TEMPLATES, exercise } from './gym.js';
import { generateDiet, dietSummary, planEndKey } from './nutrition.js';
import { generateNutri, nutriSummary } from './nutri.js';

/** PIN de todas las demos (se muestra en pantalla) */
export const DEMO_PIN = '1234';
export const DEMO_MINUTES = 30;
const DATA_COLLECTIONS = ['members', 'memberships', 'checkins', 'sessions', 'routines', 'diets', 'nutris', 'evaluations', 'photos', 'sales', 'reminders', 'remlog', 'config'];
const BIZ = 'Rivas Training';
const COACH = 'Carlos Rivas';

export async function startDemo() { await signInAnonymously(auth); }

export function demoRemainingMs(tenant) {
  const exp = tenant?.expiresAt;
  if (!exp) return 0;
  const ms = typeof exp.toMillis === 'function' ? exp.toMillis() : new Date(exp).getTime();
  return ms - Date.now();
}

export async function createDemoTenant(uid) {
  const expiresAt = Timestamp.fromMillis(Date.now() + DEMO_MINUTES * 60 * 1000);
  const b1 = writeBatch(db);
  b1.set(doc(db, 'tenants', uid), { name: `${BIZ} (demo)`, code: 'demo', ownerUid: uid, ownerEmail: '', ownerName: COACH, active: true, demo: true, createdAt: nowISO(), expiresAt });
  await b1.commit();
  const ref = (name, id) => doc(db, 'tenants', uid, name, id);
  const b = writeBatch(db);
  b.set(ref('config', 'settings'), {
    ...DEFAULT_SETTINGS, businessName: BIZ, coachName: COACH, specialty: 'Entrenador personal · Fuerza y pérdida de grasa',
    bio: 'Ayudo a personas ocupadas a ponerse en forma con entrenamientos de 60 minutos, técnica cuidada y seguimiento real de sus avances. Más de 300 alumnos transformados.',
    certifications: 'Licenciado en Educación Física · Certificación NSCA-CPT · Nutrición deportiva', city: 'Valencia', phone: '0414-5550000', whatsapp: '0414-5550000',
    email: 'demo@sanoentrenador.app', address: 'Gimnasio Olimpo, Av. Bolívar Norte', instagram: '@rivas.training',
    places: ['Gimnasio Olimpo', 'Parque Negra Hipólita', 'A domicilio', 'Online'],
    receiptFooter: '¡Gracias por entrenar conmigo! Constancia, no perfección. 💪'
  });
  b.set(ref('config', 'security'), { pinHash: await sha256(`${uid}:${DEMO_PIN}`), updatedAt: nowISO() });
  await b.commit();
}

async function waitFor(cond, ms = 8000) {
  const t0 = Date.now();
  while (!cond() && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 120));
}
const at = (daysAgo, h, m = 0) => { const d = addDays(new Date(), -daysAgo); d.setHours(h, m, 0, 0); return d; };
const ago = (n) => dayKey(addDays(new Date(), -n));
const birth = (age, i) => { const t = new Date(); return `${t.getFullYear() - age}-${String(((t.getMonth() + 2 + i) % 12) + 1).padStart(2, '0')}-${String((i * 5) % 27 + 1).padStart(2, '0')}`; };
const birthdayToday = (age) => { const t = new Date(); return `${t.getFullYear() - age}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const rnd = (seed) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

/**
 * Alumnos de ejemplo. start: días desde que empezó el plan actual · days: días de la semana que entrena (0 = domingo)
 * since: días que lleva entrenando contigo · stopAt: días desde que dejó de venir · ev: evolución de sus evaluaciones
 */
const MEMBERS = [
  { k: 'valeria', name: 'Valeria Gómez', sex: 'F', age: 29, goal: 'Bajar de peso', level: 'Intermedio', plan: 'p12', start: 9, since: 120, days: [1, 3, 5], time: '06:00', place: 'Gimnasio Olimpo', goalWeight: 68, routine: 't-grasa',
    ev: { n: 5, every: 24, height: 164, weight: 78.4, dw: -1.4, waist: 88, dwaist: -2.1, hip: 106, dhip: -1.4, fat: 34.2, dfat: -1.3, muscle: 26.1, dmuscle: 0.2, arm: 31, darm: -0.3, thigh: 61, dthigh: -0.8, chest: 96, dchest: -0.9 }, logs: 'full' },
  { k: 'andres', name: 'Andrés Pérez', sex: 'M', age: 34, goal: 'Ganar masa muscular', level: 'Avanzado', plan: 'mensual', start: 12, since: 150, days: [1, 2, 4, 5], time: '18:00', place: 'Gimnasio Olimpo', goalWeight: 78, routine: 't-ppl',
    ev: { n: 4, every: 32, height: 178, weight: 71.8, dw: 1.2, waist: 80, dwaist: 0.3, hip: 94, dhip: 0.4, fat: 15.4, dfat: -0.4, muscle: 33.2, dmuscle: 0.8, arm: 33, darm: 0.6, chest: 98, dchest: 1.2, thigh: 55, dthigh: 0.7 }, logs: 'train' },
  { k: 'mariana', name: 'Mariana Silva', sex: 'F', age: 41, goal: 'Tonificar', level: 'Principiante', plan: 'p8', start: 25, since: 60, days: [2, 4], time: '07:00', place: 'Parque Negra Hipólita', routine: 't-inicio',
    ev: { n: 3, every: 25, height: 160, weight: 66.5, dw: -0.8, waist: 79, dwaist: -1.5, hip: 100, dhip: -1, fat: 31, dfat: -0.9 } },
  { k: 'jose', name: 'José Hernández', sex: 'M', age: 52, goal: 'Salud general', level: 'Principiante', plan: 'p12', start: 34, since: 95, expired: 4, days: [1, 3, 5], time: '17:00', place: 'Gimnasio Olimpo',
    ev: { n: 3, every: 30, height: 172, weight: 91, dw: -1.1, waist: 104, dwaist: -1.8, hip: 106, dhip: -0.8, fat: 29, dfat: -0.7 }, health: { conditions: ['Hipertensión'] } },
  { k: 'lucia', name: 'Lucía Martínez', sex: 'F', age: 24, goal: 'Resistencia y cardio', level: 'Intermedio', plan: 'online', start: 27, since: 58, online: true, place: 'Online', routine: 't-grasa',
    ev: { n: 2, every: 28, height: 168, weight: 61, dw: -0.9, waist: 70, dwaist: -1.2, hip: 96, dhip: -0.6 }, logs: 'online' },
  { k: 'pedro', name: 'Pedro Rodríguez', sex: 'M', age: 38, goal: 'Bajar de peso', level: 'Principiante', plan: 'p20', start: 5, since: 5, days: [1, 2, 3, 4, 5], time: '05:30', place: 'Gimnasio Olimpo', debt: 40, birthday: true, goalWeight: 88, routine: 't-inicio',
    ev: { n: 1, every: 0, height: 176, weight: 101.3, waist: 108, hip: 110, fat: 31.5 } },
  { k: 'carla', name: 'Carla Fernández', sex: 'F', age: 31, goal: 'Tonificar', level: 'Intermedio', plan: 'duo', start: 10, since: 70, days: [2, 4, 6], time: '19:00', place: 'A domicilio', pair: 'diego',
    ev: { n: 3, every: 28, height: 166, weight: 63.2, dw: -0.6, waist: 72, dwaist: -1.3, hip: 98, dhip: -0.9, fat: 27.5, dfat: -0.8 } },
  { k: 'diego', name: 'Diego Fernández', sex: 'M', age: 33, goal: 'Fuerza', level: 'Intermedio', plan: 'duo', start: 10, since: 70, days: [2, 4, 6], time: '19:00', place: 'A domicilio', pairOf: 'carla',
    ev: { n: 3, every: 28, height: 181, weight: 84, dw: 0.5, waist: 90, dwaist: -0.6, muscle: 36, dmuscle: 0.6, fat: 20, dfat: -0.6, arm: 35, darm: 0.4 } },
  { k: 'sofia', name: 'Sofía Ramírez', sex: 'F', age: 27, goal: 'Bajar de peso', level: 'Principiante', plan: 'mensual', start: 18, since: 50, days: [1, 3, 5], time: '19:00', place: 'Gimnasio Olimpo', stopAt: 13,
    ev: { n: 2, every: 30, height: 158, weight: 70.2, dw: -0.7, waist: 82, dwaist: -1 } },
  { k: 'raul', name: 'Raúl Castillo', sex: 'M', age: 45, goal: 'Rehabilitación', level: 'Principiante', plan: 'p8', start: 15, since: 100, days: [2, 4], time: '08:00', place: 'Gimnasio Olimpo', frozen: true,
    ev: { n: 3, every: 30, height: 175, weight: 86, dw: -0.5, waist: 96, dwaist: -1 }, health: { conditions: ['Dolor lumbar'], injuries: 'Hernia discal L4-L5 (2024)' } },
  { k: 'gabriela', name: 'Gabriela Torres', sex: 'F', age: 36, goal: 'Bajar de peso', level: 'Intermedio', plan: 'p12', start: 2, since: 200, days: [1, 3, 5], time: '09:00', place: 'Gimnasio Olimpo', goalWeight: 78, routine: 't-grasa', lastEvalAgo: 34,
    ev: { n: 6, every: 30, height: 167, weight: 92.6, dw: -1.9, waist: 99, dwaist: -2.4, hip: 115, dhip: -1.8, fat: 38.5, dfat: -1.4, muscle: 27, dmuscle: 0.3, arm: 34, darm: -0.5, thigh: 66, dthigh: -1, chest: 104, dchest: -1.2 }, logs: 'weigh' },
  { k: 'miguel', name: 'Miguel Ángel Rojas', sex: 'M', age: 29, goal: 'Preparación deportiva', level: 'Avanzado', plan: 'online3', start: 40, since: 40, online: true, place: 'Online', routine: 't-ppl',
    ev: { n: 2, every: 30, height: 183, weight: 79, dw: -0.4, fat: 13, dfat: -0.5 } },
  { k: 'elena', name: 'Elena Vargas', sex: 'F', age: 58, goal: 'Salud general', level: 'Principiante', plan: null, since: 1, place: 'Gimnasio Olimpo' }
];

/** Crea los datos de la demo (después de elegir el país, para que los precios estén en su moneda) */
export async function seedDemoActivity() {
  const money = (v) => scaleUSD(v);
  const t = todayKey();
  const R = rnd(7);
  const ops = []; // [ref, data]
  const put = (ref, data) => ops.push([ref, data]);
  const flush = async () => {
    for (let i = 0; i < ops.length; i += 80) {
      const b = store.batch();
      ops.slice(i, i + 80).forEach(([r, d]) => b.set(r, d));
      b.set(store.ref('config', 'counters'), store.counters, { merge: true });
      await b.commit();
    }
    ops.length = 0;
  };
  const tpl = (id) => ROUTINE_TEMPLATES.find((x) => x.id === id) || ROUTINE_TEMPLATES[0];
  const members = {};
  let inv = 0;
  const sale = (m, daysAgo, items, method, extra = {}) => {
    inv++; store.counters.inv = inv;
    const total = round2(items.reduce((a, i) => a + i.price, 0));
    const date = at(daysAgo, 9 + (inv % 9), (inv * 7) % 60).toISOString();
    put(store.ref('sales', 'demo_s' + inv), {
      number: fmtSeq('R', inv, 6), seq: inv, kind: extra.kind || 'plan', date, dayKey: dayKey(new Date(date)), items: items.map((i) => ({ ...i, qty: 1, total: i.price })), subtotal: total, discount: 0, total,
      rate: 1, payments: [{ method, currency: '', amount: total, usd: total }], paidUSD: total, changeUSD: 0, method, received: total, fxRate: 0,
      memberId: m.id, memberName: m.name, memberPhone: m.phone, memberIdDoc: m.idDoc, memberNumber: m.number, status: 'completed', by: 'demo', ...extra
    });
  };
  const methods = ['transferencia', 'pagomovil', 'efectivo', 'zelle', 'transferencia'];

  // 1) Alumnos, planes y pagos
  MEMBERS.forEach((s, i) => {
    const id = 'demo_' + s.k;
    const seq = i + 1; store.counters.mem = seq;
    const plan = s.plan ? store.plan(s.plan) : null;
    const m = {
      id, name: s.name, idDoc: `V-${String(12000000 + i * 1371137).slice(0, 8)}`, sex: s.sex, birthDate: s.birthday ? birthdayToday(s.age) : birth(s.age, i),
      phone: `0414-555${String(1000 + i * 137).slice(-4)}`, email: `${s.k}@correo.com`, goal: s.goal, level: s.level, activity: 1.55, place: s.place || '',
      availability: s.days ? `${s.days.map((d) => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d]).join('-')} ${s.time}` : s.online ? 'Entrena por su cuenta' : '',
      goalWeight: s.goalWeight || null, health: { parq: [false, false, false, false, false, false, false], conditions: [], clearance: !!s.health, answeredAt: ago(s.since), ...(s.health || {}) },
      emergencyName: 'Familiar de contacto', emergencyPhone: '0412-0000000', referredBy: ['Instagram', 'Recomendación de un alumno', 'Google'][i % 3],
      number: fmtSeq('A', seq, 4), seq, cardCode: genCode(8), active: true, visits: 0, totalSpent: 0, balance: 0, noShows: 0, membership: null, lastCheckinAt: null, evalHist: [],
      createdAt: at(s.since, 10).toISOString(), updatedAt: nowISO(), by: 'demo', spec: s
    };
    if (plan) {
      const start = ago(s.start);
      let end = planEnd(plan, start);
      if (s.expired) end = ago(s.expired);
      const visits = plan.kind === 'tiempo' ? null : Number(plan.visits) || 1;
      const debt = s.debt ? money(s.debt) : 0;
      const price = Number(plan.price) || 0;
      const msId = 'demo_ms_' + s.k;
      const ms = { id: msId, planId: plan.id, planName: plan.name, kind: plan.kind, start, end, visits, visitsLeft: visits, status: 'activa', freezeDays: Number(plan.freezeDays) || 0, freezeUsed: 0, frozenFrom: null, frozenUntil: null, online: !!plan.online, withDiet: !!plan.withDiet, withNutri: !!plan.withNutri };
      if (s.frozen) { ms.frozenFrom = ago(3); ms.frozenUntil = dayKey(addDays(new Date(), 6)); ms.freezeUsed = 10; ms.end = dayKey(addDays(fromKey(end), 10)); }
      m.membership = ms; m.balance = debt; m.totalSpent = round2(price - debt);
      m.msDoc = { memberId: id, memberName: m.name, memberPhone: m.phone, memberIdDoc: m.idDoc, memberNumber: m.number, planId: plan.id, planName: plan.name, kind: plan.kind, start, end: ms.end, visits, visitsLeft: visits,
        price, enrollFee: 0, discount: 0, total: price, paid: round2(price - debt), balance: debt, status: 'activa', online: !!plan.online, withDiet: !!plan.withDiet, withNutri: !!plan.withNutri,
        freezes: s.frozen ? [{ from: ms.frozenFrom, until: ms.frozenUntil, days: 10, reason: 'Lesión' }] : [], saleIds: [], prev: null, renewal: s.since > s.start + 5, note: '', createdAt: at(s.start, 9).toISOString(), by: 'demo' };
      if (price - debt > 0) sale(m, s.start, [{ name: `${plan.name} · ${start.split('-').reverse().join('/')}`, price: round2(price - debt), planId: plan.id, kind: debt ? 'abono' : 'plan' }], methods[i % methods.length], { kind: debt ? 'abono' : 'plan', membershipId: msId, planId: plan.id });
      // Renovaciones anteriores (historial para reportes)
      for (let p = 1; s.since - s.start - p * 30 >= 0 && p <= 5; p++) {
        m.totalSpent = round2(m.totalSpent + price);
        sale(m, s.start + p * 30, [{ name: `${plan.name} · renovación`, price, planId: plan.id, kind: 'plan' }], methods[(i + p) % methods.length], { planId: plan.id });
      }
    }
    members[s.k] = m;
  });
  // Evaluación suelta y plan de alimentación (cobros libres)
  sale(members.elena, 0, [{ name: 'Evaluación física', price: money(15), kind: 'servicio' }], 'efectivo', { kind: 'servicio' });
  sale(members.valeria, 6, [{ name: 'Plan de alimentación', price: money(25), kind: 'servicio' }], 'pagomovil', { kind: 'servicio' });

  // 2) Agenda: sesiones pasadas (con asistencia) y próximas
  const sess = [];
  for (const s of MEMBERS) {
    if (!s.days || s.pairOf) continue;
    const m = members[s.k];
    const ids = [m.id, ...(s.pair ? [members[s.pair].id] : [])];
    const from = Math.min(60, s.start);
    for (let d = -from; d <= 14; d++) {
      const day = addDays(new Date(), d); const dk = dayKey(day);
      if (!s.days.includes(day.getDay())) continue;
      if (m.membership && (dk < m.membership.start || dk > m.membership.end)) continue;
      if (s.stopAt && d > -s.stopAt) continue;
      if (m.membership?.frozenFrom && dk >= m.membership.frozenFrom && dk <= m.membership.frozenUntil) continue;
      const att = {}; const consumed = {};
      if (d < 0) ids.forEach((x) => { const r = R(); att[x] = r < 0.08 ? 'falto' : r < 0.12 ? 'cancelo' : 'asistio'; if (att[x] !== 'cancelo') consumed[x] = true; });
      sess.push({ id: `demo_se_${s.k}_${dk}`, date: dk, time: s.time, minutes: 60, type: ids.length > 1 ? 'grupal' : 'presencial', place: s.place || '', note: '', memberIds: ids,
        members: ids.map((x) => { const mm = Object.values(members).find((y) => y.id === x); return { id: x, name: mm.name, phone: mm.phone }; }),
        status: 'programada', att, consumed, seriesId: `demo_serie_${s.k}`, createdAt: at(from, 8).toISOString(), by: 'demo' });
    }
  }
  sess.push({ id: 'demo_se_eval_gabriela', date: ago(-1), time: '10:00', minutes: 45, type: 'evaluacion', place: 'Gimnasio Olimpo', note: 'Reevaluación mensual', memberIds: [members.gabriela.id], members: [{ id: members.gabriela.id, name: members.gabriela.name, phone: members.gabriela.phone }], status: 'programada', att: {}, consumed: {}, seriesId: null, createdAt: nowISO(), by: 'demo' });
  sess.push({ id: 'demo_se_online_lucia', date: ago(-1), time: '20:00', minutes: 30, type: 'online', place: 'Videollamada', note: 'Revisión semanal de técnica', memberIds: [members.lucia.id], members: [{ id: members.lucia.id, name: members.lucia.name, phone: members.lucia.phone }], status: 'programada', att: {}, consumed: {}, seriesId: null, createdAt: nowISO(), by: 'demo' });
  sess.push({ id: 'demo_se_elena', date: ago(-2), time: '08:00', minutes: 45, type: 'evaluacion', place: 'Gimnasio Olimpo', note: 'Evaluación inicial', memberIds: [members.elena.id], members: [{ id: members.elena.id, name: members.elena.name, phone: members.elena.phone }], status: 'programada', att: {}, consumed: {}, seriesId: null, createdAt: nowISO(), by: 'demo' });
  for (const x of sess) {
    put(store.ref('sessions', x.id), x);
    for (const mid of x.memberIds) {
      const m = Object.values(members).find((y) => y.id === mid);
      const a = x.att[mid];
      if (a === 'falto') m.noShows++;
      if (!x.consumed[mid]) continue;
      const ms = m.membership;
      if (ms && ms.kind !== 'tiempo' && x.date >= ms.start) ms.visitsLeft = Math.max(0, ms.visitsLeft - 1);
      if (a === 'asistio') {
        const [h, mi] = x.time.split(':').map(Number);
        const date = new Date(`${x.date}T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:00`).toISOString();
        m.visits++; if (!m.lastCheckinAt || date > m.lastCheckinAt) m.lastCheckinAt = date;
        put(store.ref('checkins', `${x.id}_${mid}`), { memberId: mid, memberName: m.name, memberPhone: m.phone, memberIdDoc: m.idDoc, memberNumber: m.number, date, dayKey: x.date, hour: h, weekday: new Date(date).getDay(), via: 'sesion', result: 'ok', planName: ms?.planName || '', membershipId: ms?.id || null, sessionId: x.id, consumed: true, note: '', by: 'demo' });
      }
    }
  }
  // Historial anterior (meses previos) para el calendario de asistencia y la racha
  for (const s of MEMBERS) {
    const m = members[s.k];
    if (!s.days || s.since - s.start < 10) continue;
    for (let d = Math.min(s.since, 98); d > Math.min(60, s.start); d--) {
      const day = addDays(new Date(), -d);
      if (!s.days.includes(day.getDay()) || R() < 0.15) continue;
      const [h, mi] = s.time.split(':').map(Number); day.setHours(h, mi, 0, 0);
      m.visits++;
      put(store.ref('checkins', `demo_old_${s.k}_${d}`), { memberId: m.id, memberName: m.name, memberPhone: m.phone, memberIdDoc: m.idDoc, memberNumber: m.number, date: day.toISOString(), dayKey: dayKey(day), hour: h, weekday: day.getDay(), via: 'sesion', result: 'ok', planName: m.membership?.planName || '', membershipId: null, sessionId: null, consumed: true, note: '', by: 'demo' });
    }
  }
  // Pocas sesiones: Mariana termina su paquete
  if (members.mariana.membership) members.mariana.membership.visitsLeft = Math.min(members.mariana.membership.visitsLeft, 1);

  // 3) Evaluaciones con su evolución (lo que el alumno ve en «Mi progreso»)
  for (const s of MEMBERS) {
    if (!s.ev) continue;
    const m = members[s.k]; const e = s.ev;
    const lastAgo = s.lastEvalAgo ?? Math.max(1, Math.min(s.start + 1, 6));
    const list = [];
    for (let j = 0; j < e.n; j++) {
      const daysAgo = lastAgo + (e.n - 1 - j) * (e.every || 0);
      const wob = () => (R() - 0.5) * 0.4;
      const v = (k) => (e[k] != null ? Math.round((e[k] + ((k === 'weight' ? e.dw : e['d' + k]) || 0) * j + (j ? wob() : 0)) * 10) / 10 : undefined);
      const ev = { date: ago(daysAgo), height: e.height, weight: v('weight'), waist: v('waist'), hip: v('hip'), fat: v('fat'), muscle: v('muscle'), arm: v('arm'), thigh: v('thigh'), chest: v('chest'), neck: s.sex === 'F' ? 33 : 38, activity: 1.55 };
      Object.keys(ev).forEach((k) => ev[k] === undefined && delete ev[k]);
      const c = evalCalc(ev, m);
      Object.assign(ev, { bmi: c.bmi, fatCalc: c.fat, lean: c.lean, bmr: c.energy?.bmr || null, memberId: m.id, memberName: m.name, notes: j === e.n - 1 && e.n > 1 ? '¡Muy buen avance! Mantener la constancia y la hidratación.' : j === 0 ? 'Evaluación inicial.' : '', by: 'demo', createdAt: at(daysAgo, 10).toISOString(), updatedAt: nowISO() });
      list.push(ev);
      put(store.ref('evaluations', `demo_ev_${s.k}_${j}`), ev);
    }
    m.evalHist = list.map((x) => compactEval(x, m));
    const sum = (x) => ({ date: x.date, weight: x.weight, bmi: evalCalc(x, m).bmi, fat: evalCalc(x, m).fat, height: x.height || null });
    m.firstEval = sum(list[0]); m.lastEval = sum(list[list.length - 1]); m.height = e.height;
  }

  // 4) Rutinas: una plantilla propia y las rutinas asignadas
  put(store.ref('routines', 'demo_tpl_express'), { ...routineSummary({ ...tpl('t-inicio'), name: 'Express 45 min · cuerpo completo' }), days: tpl('t-inicio').days.slice(0, 2), template: true, memberId: null, memberName: '', trainer: COACH, active: true, createdAt: at(40, 9).toISOString(), updatedAt: nowISO(), by: 'demo' });
  const routines = {};
  for (const s of MEMBERS) {
    if (!s.routine) continue;
    const m = members[s.k]; const r = tpl(s.routine);
    const data = { name: `${r.name} · ${m.name.split(' ')[0]}`, goal: r.goal, level: r.level, weeks: r.weeks, note: r.note, days: r.days, template: false, memberId: m.id, memberName: m.name, trainer: COACH, active: true, createdAt: at(Math.min(s.start, 20), 9).toISOString(), updatedAt: nowISO(), by: 'demo' };
    put(store.ref('routines', 'demo_r_' + s.k), data);
    m.routineId = 'demo_r_' + s.k; m.routineName = data.name; m.routineAt = data.createdAt;
    routines[s.k] = data;
  }

  // 4b) Planes de alimentación: una plantilla propia y los planes de algunos alumnos
  const dtpl = generateDiet({ goal: 'Bajar de peso', kcal: 1700, type: 'criollo', meals: 4, seed: 41 });
  put(store.ref('diets', 'demo_dtpl'), { ...dtpl, name: 'Mi plan criollo para bajar de peso', template: true, memberId: null, memberName: '', trainer: COACH, active: true, createdAt: nowISO(), updatedAt: nowISO(), by: 'demo', params: { goal: 'Bajar de peso', kcal: 1700, type: 'criollo', meals: 4, seed: 41 } });
  const diets = {};
  const DIETS = { valeria: ['Bajar de peso', 1600, 'todo', 5, 'semanal', 2], andres: ['Ganar masa muscular', 2900, 'todo', 5, 'mensual', 9], gabriela: ['Bajar de peso', 1700, 'criollo', 4, 'semanal', 1], lucia: ['Mantener el peso', 1900, 'veg', 5, 'mensual', 4] };
  for (const [k, [goal, kcal, type, meals, period, startAgo]] of Object.entries(DIETS)) {
    const m = members[k]; if (!m) continue;
    const g = generateDiet({ goal, kcal, type, meals, period, seed: k.length * 13 + kcal });
    const start = ago(startAgo); const end = planEndKey(start, period);
    const data = { ...g, name: `${g.name} · ${m.name.split(' ')[0]}`, start, end, template: false, memberId: m.id, memberName: m.name, trainer: COACH, active: true, createdAt: at(startAgo, 10).toISOString(), updatedAt: nowISO(), by: 'demo', params: { goal, kcal, type, meals, seed: k.length * 13 + kcal } };
    put(store.ref('diets', 'demo_d_' + k), data);
    Object.assign(m, { dietId: 'demo_d_' + k, dietName: data.name, dietStart: start, dietEnd: end, dietPeriod: period });
    diets[k] = data;
  }

  // 4c) Planes de nutrición: una plantilla propia y los de algunos alumnos
  const ntpl = generateNutri({ goal: 'Definición', weight: 75, kcal: 2000, trainDays: 5, period: 'mensual' });
  put(store.ref('nutris', 'demo_ntpl'), { ...ntpl, name: 'Mi definición de verano', template: true, memberId: null, memberName: '', trainer: COACH, active: true, createdAt: nowISO(), updatedAt: nowISO(), by: 'demo' });
  const nutris = {};
  const NUTRIS = { andres: ['Ganar masa muscular', 'mensual', 9, 5], valeria: ['Bajar de peso', 'semanal', 2, 4], gabriela: ['Bajar de peso', 'mensual', 12, 3] };
  for (const [k, [goal, period, startAgo, trainDays]] of Object.entries(NUTRIS)) {
    const m = members[k]; if (!m) continue;
    const w = m.lastEval?.weight || 70;
    const kcal = (diets[k]?.kcal) || null;
    const g = generateNutri({ goal, weight: w, kcal, period, trainDays });
    const start = ago(startAgo); const end = planEndKey(start, period);
    const data = { ...g, name: `${g.name} · ${m.name.split(' ')[0]}`, start, end, template: false, memberId: m.id, memberName: m.name, trainer: COACH, active: true, createdAt: at(startAgo, 11).toISOString(), updatedAt: nowISO(), by: 'demo' };
    put(store.ref('nutris', 'demo_n_' + k), data);
    Object.assign(m, { nutriId: 'demo_n_' + k, nutriName: data.name, nutriStart: start, nutriEnd: end, nutriPeriod: period });
    nutris[k] = data;
  }

  // 5) Planes, alumnos y recordatorios propios
  for (const s of MEMBERS) {
    const m = members[s.k];
    if (m.msDoc) { m.msDoc.visitsLeft = m.membership.visitsLeft; put(store.ref('memberships', m.membership.id), m.msDoc); }
    const { id, spec, msDoc, ...data } = m;
    put(store.ref('members', id), data);
  }
  put(store.ref('reminders', 'demo_rem1'), { text: 'Llamar a Elena para confirmar su evaluación inicial y explicarle los planes', date: t, memberId: members.elena.id, memberName: members.elena.name, memberPhone: members.elena.phone, wa: true, repeat: '', done: false, createdAt: nowISO(), updatedAt: nowISO(), by: 'demo' });
  put(store.ref('reminders', 'demo_rem2'), { text: 'Enviar los ajustes de la semana a los alumnos online', date: t, memberId: null, memberName: '', memberPhone: '', wa: false, repeat: 'semanal', done: false, createdAt: nowISO(), updatedAt: nowISO(), by: 'demo' });
  put(store.ref('reminders', 'demo_rem3'), { text: 'Comprar bandas elásticas nuevas para las sesiones a domicilio', date: ago(-2), memberId: null, memberName: '', memberPhone: '', wa: false, repeat: '', done: false, createdAt: nowISO(), updatedAt: nowISO(), by: 'demo' });
  await flush();

  // 6) Carnets públicos (con rutina y próximas sesiones) y lo que registraron los alumnos
  await waitFor(() => store.members.length >= MEMBERS.length && store.sessions.length > 10);
  const live = MEMBERS.map((s) => store.member('demo_' + s.k) || { ...members[s.k] });
  for (let i = 0; i < live.length; i += 40) {
    const b = store.batch();
    live.slice(i, i + 40).forEach((m) => { const s = MEMBERS.find((x) => 'demo_' + x.k === m.id); b.set(store.cardRef(m.cardCode), cardData(m, { ...(routines[s.k] ? { routine: routineSummary(routines[s.k]) } : {}), ...(diets[s.k] ? { diet: dietSummary(diets[s.k]) } : {}), ...(nutris[s.k] ? { nutri: nutriSummary(nutris[s.k]) } : {}) })); });
    await b.commit();
  }
  const logs = [];
  const log = (s, daysAgo, h, data) => { const m = members[s]; logs.push([doc(db, 'cards', m.cardCode, 'logs', `demo_${s}_${daysAgo}_${data.kind}`), { at: at(daysAgo, h, 20).toISOString(), tenantId: store.tenantId, name: m.name.split(' ')[0], ...data }]); };
  const rt = (k, di) => routines[k]?.days?.[di] || { name: 'Entreno', items: [] };
  const BASE_KG = { Pecho: 35, Espalda: 35, Hombros: 22, 'Bíceps': 16, 'Tríceps': 18, 'Cuádriceps': 50, 'Femorales y glúteos': 45, Pantorrillas: 40 };
  const kgOf = (x, f) => { const e = exercise(x.exId) || {}; let v = (BASE_KG[e.group] || 15) * f; if (e.eq === 'Mancuernas') v *= 0.4; if (e.eq === 'Peso corporal' || e.eq === 'Banda elástica') return ''; return `${Math.max(2, Math.round(v / 2.5) * 2.5).toString().replace('.', ',')} kg`; };
  const loadsOf = (k, di, f = 1) => Object.fromEntries((rt(k, di).items || []).filter((x) => !/min|s$/.test(String(x.reps)) && kgOf(x, 1)).slice(0, 5).map((x) => [x.name, kgOf(x, f)]));
  [[1, 0, 7], [3, 1, 8], [5, 2, 7], [8, 0, 8], [10, 1, 6], [12, 2, 7]].forEach(([d, di, rpe], j) => {
    const items = rt('valeria', di).items || [];
    const sets = items.reduce((a, x) => a + (Number(x.sets) || 0), 0);
    log('valeria', d, 7, { kind: 'entreno', day: di, dayName: rt('valeria', di).name, done: sets - (j % 3 === 2 ? 1 : 0), total: sets, rpe, mins: 52 + j, loads: loadsOf('valeria', di, 1 + (12 - d) / 60), note: j === 0 ? '¡Hoy subí peso en sentadilla! 💪' : '' });
  });
  [2, 9, 16].forEach((d, j) => log('valeria', d, 6, { kind: 'peso', weight: Math.round((members.valeria.lastEval.weight - 0.3 * (j - 2)) * 10) / 10, note: '' }));
  [1, 4, 6, 9].forEach((d, j) => {
    const items = rt('andres', j % 2).items || []; const sets = items.reduce((a, x) => a + (Number(x.sets) || 0), 0);
    log('andres', d, 19, { kind: 'entreno', day: j % 2, dayName: rt('andres', j % 2).name, done: sets, total: sets, rpe: 8 + (j % 2), mins: 70, loads: loadsOf('andres', j % 2, 1.7), note: j === 1 ? 'Press banca 4x8 con 70 kg' : '' });
  });
  [3, 10, 17, 24].forEach((d, j) => log('lucia', d, 7, { kind: 'peso', weight: Math.round((members.lucia.lastEval.weight + 0.3 * (j - 1)) * 10) / 10 }));
  [2, 5, 7].forEach((d, j) => { const items = rt('lucia', j).items || []; const sets = items.reduce((a, x) => a + (Number(x.sets) || 0), 0); log('lucia', d, 18, { kind: 'entreno', day: j, dayName: rt('lucia', j).name, done: sets, total: sets, rpe: 7, mins: 45, loads: {}, note: j === 2 ? 'Corrí 5 km después del circuito 🏃‍♀️' : '' }); });
  [5, 19].forEach((d, j) => log('gabriela', d, 8, { kind: 'peso', weight: Math.round((members.gabriela.lastEval.weight - 0.6 * (j + 1)) * 10) / 10 }));
  for (let i = 0; i < logs.length; i += 60) {
    const b = writeBatch(db);
    logs.slice(i, i + 60).forEach(([r, d]) => b.set(r, d));
    await b.commit().catch((e) => console.warn('[demo] bitácora', e?.code || e));
  }
  await refreshCards(store.members).catch(() => {});
}

/** Borra todos los datos de una cuenta (y sus carnets públicos con su bitácora). */
export async function purgeTenant(tenantId, onlyDemo = true) {
  try {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'members'));
    const codes = snap.docs.map((d) => d.data().cardCode).filter(Boolean);
    for (const c of codes) {
      try {
        const ls = await getDocs(collection(db, 'cards', c, 'logs'));
        if (ls.size) { const b = writeBatch(db); ls.docs.slice(0, 400).forEach((d) => b.delete(d.ref)); await b.commit(); }
      } catch (e) { console.warn('[purge] bitácora', e?.code || e); }
    }
    for (let i = 0; i < codes.length; i += 80) {
      const b = writeBatch(db);
      codes.slice(i, i + 80).forEach((c) => b.delete(doc(db, 'cards', c)));
      await b.commit().catch((e) => console.warn('[purge] carnets', e?.code || e));
    }
  } catch (e) { console.warn('[purge] carnets', e?.code || e); }
  for (const c of DATA_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, 'tenants', tenantId, c));
      for (let i = 0; i < snap.docs.length; i += 80) {
        const b = writeBatch(db);
        snap.docs.slice(i, i + 80).forEach((d) => b.delete(d.ref));
        await b.commit();
      }
    } catch (e) { console.warn('[purge]', c, e?.code || e); }
  }
  if (onlyDemo) {
    try {
      const t = await getDoc(doc(db, 'tenants', tenantId));
      if (t.exists() && t.data().demo === true) { const b = writeBatch(db); b.delete(t.ref); await b.commit(); }
    } catch (e) { console.warn('[purge] cuenta', e?.code || e); }
  }
}

/** Borra la demo actual y la cuenta anónima. */
export async function cleanupDemo(tenantId) {
  await purgeTenant(tenantId, true);
  const u = auth.currentUser;
  if (u && u.isAnonymous) {
    try { await u.delete(); } catch (_) { await signOut(auth).catch(() => {}); }
  }
}
