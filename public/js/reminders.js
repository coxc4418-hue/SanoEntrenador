// SanoEntrenador — Recordatorios automáticos: a quién escribirle hoy y por qué
import { store, daysBetween } from './store.js';
import { todayKey, dayKey, addDays, fmtDate, usd } from './utils.js';

export const REM_CATS = {
  sesion: { label: 'Confirmar sesiones', desc: 'Hoy y mañana', icon: 'calendar', tone: 'info', msg: 'sesion' },
  por_vencer: { label: 'Planes por vencer', desc: 'Renovación a tiempo', icon: 'clock', tone: 'warning', msg: 'por_vencer' },
  pocas: { label: 'Quedan pocas sesiones', desc: 'Paquetes por terminar', icon: 'ticket', tone: 'warning', msg: 'pocas_sesiones' },
  deuda: { label: 'Pagos pendientes', desc: 'Saldo por cobrar', icon: 'dollar', tone: 'danger', msg: 'deuda' },
  cumple: { label: 'Cumpleaños', desc: 'Hoy', icon: 'cake', tone: 'violet', msg: 'cumple' },
  inactivo: { label: 'No han venido', desc: 'Con plan vigente', icon: 'alert', tone: 'danger', msg: 'inactivo' },
  reevaluar: { label: 'Toca evaluación', desc: 'Medir avances', icon: 'ruler', tone: 'brand', msg: 'reevaluar' },
  vencido: { label: 'Recuperar alumnos', desc: 'Vencidos (30 días)', icon: 'refresh', tone: 'neutral', msg: 'vencido' }
};

const weekKey = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dayKey(x); };

/** Lista de recordatorios automáticos de hoy: [{ key, cat, msg, member, session, extra, sub }] */
export function autoReminders() {
  if (!store.ready) return [];
  const t = todayKey(); const tm = dayKey(addDays(new Date(), 1));
  const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes();
  const out = [];
  const push = (cat, member, key, sub, extra = {}) => { if (member && member.active !== false) out.push({ key, cat, msg: REM_CATS[cat].msg, member, sub, ...extra }); };
  for (const s of store.sessions) {
    if (s.status === 'cancelada' || (s.date !== t && s.date !== tm)) continue;
    const [h, mi] = String(s.time || '0:0').split(':').map(Number);
    if (s.date === t && h * 60 + (mi || 0) < nowMin) continue;
    for (const id of s.memberIds || []) {
      if ((s.att || {})[id]) continue;
      push('sesion', store.member(id), `sesion_${s.id}_${id}`, `${s.date === t ? 'Hoy' : 'Mañana'} ${s.time}${s.place ? ' · ' + s.place : ''}`, { session: s });
    }
  }
  const days = Number(store.settings.remindDays ?? 5);
  for (const m of store.expiringIn(days)) {
    if (m.membership.kind === 'pase') continue;
    const d = daysBetween(t, m.membership.end);
    push('por_vencer', m, `por_vencer_${m.id}_${m.membership.end}`, `${m.membership.planName} · ${d === 0 ? 'vence hoy' : d === 1 ? 'vence mañana' : `vence el ${fmtDate(m.membership.end)}`}`);
  }
  for (const m of store.lowSessions()) {
    if (m.membership.kind === 'pase') continue;
    push('pocas', m, `pocas_${m.id}_${m.membership.id}_${m.membership.visitsLeft}`, `${m.membership.planName} · ${m.membership.visitsLeft} sesión(es) restante(s)`);
  }
  for (const m of store.debtors) push('deuda', m, `deuda_${m.id}_${weekKey()}`, `Debe ${usd(m.balance)}`, { amount: m.balance });
  const y = t.slice(0, 4);
  for (const m of store.birthdaysToday) push('cumple', m, `cumple_${m.id}_${y}`, 'Cumple años hoy 🎂');
  for (const m of store.atRisk()) {
    const d = m.lastCheckinAt ? Math.floor((Date.now() - new Date(m.lastCheckinAt)) / 864e5) : null;
    push('inactivo', m, `inactivo_${m.id}_${(m.lastCheckinAt || 'nunca').slice(0, 10)}`, d != null ? `Última sesión hace ${d} días` : 'Aún no ha venido', { extra: { dias: d ?? '' } });
  }
  for (const m of store.needEval()) push('reevaluar', m, `reevaluar_${m.id}_${m.lastEval?.date || 'nunca'}`, m.lastEval ? `Última evaluación ${fmtDate(m.lastEval.date)}` : 'Sin evaluación inicial');
  for (const m of store.expiredWithin(30)) {
    push('vencido', m, `vencido_${m.id}_${m.membership.end}`, `${m.membership.planName} · venció el ${fmtDate(m.membership.end)}`);
  }
  return out;
}
export const isSent = (key) => !!store.remlog[key.replace(/[/.#$[\]]/g, '_')];
/** Recordatorios propios del entrenador que tocan hoy (o están atrasados) */
export const dueCustom = () => store.reminders.filter((r) => !r.done && (r.date || '') <= todayKey());
/** Pendientes para el aviso del menú */
export function pendingCount() {
  return autoReminders().filter((r) => !isSent(r.key)).length + dueCustom().length;
}
