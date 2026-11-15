// SanoEntrenador — Inicio: el día del entrenador de un vistazo
import { store, daysBetween } from '../store.js';
import { esc, usd, fmtLongDate, todayKey, dayKey, addDays, emptyState, fmtAgo, num } from '../utils.js';
import { icon } from '../icons.js';
import { avatar, hydratePhotos, openMember, memberForm, logItemHTML } from '../member.js';
import { sessionRowHTML, bindSessionRows, sessionForm } from './agenda.js';
import { autoReminders, isSent, dueCustom, REM_CATS } from '../reminders.js';

export function mount(el, { navigate }) {
  const h = new Date().getHours();
  const hello = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  const first = String(store.coachName || '').split(' ')[0];
  el.innerHTML = `
    <div class="view-header"><div><h1 class="view-title">${hello}${first ? ', ' + esc(first) : ''} ${h < 12 ? '☀️' : h < 19 ? '💪' : '🌙'}</h1><p class="view-sub">${fmtLongDate()}</p></div>
      <div class="view-actions quick-actions" data-tour="quick">
        <button class="btn btn-primary" data-q="ses">${icon('calendar')} Agendar sesión</button>
        <button class="btn btn-secondary" data-q="in">${icon('qr')} Asistencia</button>
        <button class="btn btn-secondary" data-q="new">${icon('userPlus')} Nuevo alumno</button>
        <button class="btn btn-secondary" data-q="sell">${icon('ticket')} Vender plan</button>
      </div></div>
    <div class="kpis" data-tour="kpis" id="d-kpis"></div>
    <div class="grid-main">
      <div class="stack">
        <div class="card" data-tour="today"><div class="card-head"><div class="card-title">${icon('calendar')} Sesiones de hoy</div><button class="btn btn-ghost btn-sm" data-go="agenda">Agenda</button></div><div id="d-today" class="stack"></div></div>
        <div class="card"><div class="card-head"><div class="card-title">${icon('clipboard')} Lo que registran tus alumnos</div><span class="small muted">desde su carnet</span></div><div id="d-logs"></div></div>
      </div>
      <div class="stack">
        <div class="card"><div class="card-head"><div class="card-title">${icon('bell')} Para escribir hoy</div><button class="btn btn-ghost btn-sm" data-go="avisos">Ver todo</button></div><div id="d-rem"></div></div>
        <div class="card"><div class="card-head"><div class="card-title">${icon('calendar')} Mañana</div><button class="btn btn-ghost btn-sm" data-tomorrow>${icon('whatsapp')} Confirmar</button></div><div id="d-tom"></div></div>
        <div class="card"><div class="card-head"><div class="card-title">${icon('trophy')} Mejores avances</div></div><div id="d-best"></div></div>
      </div>
    </div>`;
  const $ = (s) => el.querySelector(s);
  el.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => navigate(b.dataset.go));
  $('[data-q="ses"]').onclick = () => sessionForm();
  $('[data-q="in"]').onclick = () => navigate('asistencia');
  $('[data-q="new"]').onclick = async () => { const m = await memberForm(); if (m) { const { sellModal } = await import('../membership.js'); sellModal(m); } };
  $('[data-q="sell"]').onclick = async () => { const { sellModal } = await import('../membership.js'); sellModal(); };
  $('[data-tomorrow]').onclick = async () => { const { confirmQueue } = await import('./agenda.js'); confirmQueue(store.sessionsOn(dayKey(addDays(new Date(), 1)))); };

  function kpis() {
    const t = todayKey(); const month = t.slice(0, 7);
    const active = store.activeMembers.length;
    const newMonth = store.members.filter((m) => (m.createdAt || '').slice(0, 7) === month).length;
    const today = store.todaySessions;
    const pend = today.reduce((a, s) => a + (s.memberIds || []).filter((id) => !(s.att || {})[id]).length, 0);
    const done = today.reduce((a, s) => a + Object.values(s.att || {}).filter((v) => v === 'asistio').length, 0);
    const sales = store.recentSales.filter((s) => s.status !== 'voided' && (s.dayKey || '').slice(0, 7) === month);
    const income = sales.reduce((a, s) => a + (s.total || 0), 0);
    const todayIn = sales.filter((s) => s.dayKey === t).reduce((a, s) => a + (s.total || 0), 0);
    $('#d-kpis').innerHTML = `
      <div class="card kpi kpi-link" data-go2="alumnos"><div class="kpi-top"><span class="kpi-label">Alumnos activos</span><span class="kpi-icon tone-brand">${icon('users')}</span></div><div class="kpi-value">${active}</div><div class="kpi-sub">${newMonth} nuevo(s) este mes</div></div>
      <div class="card kpi kpi-link" data-go2="agenda"><div class="kpi-top"><span class="kpi-label">Sesiones hoy</span><span class="kpi-icon tone-info">${icon('calendar')}</span></div><div class="kpi-value">${today.length}</div><div class="kpi-sub">${done} asistencia(s) · ${pend} por marcar</div></div>
      <div class="card kpi kpi-link" data-go2="cobros"><div class="kpi-top"><span class="kpi-label">Cobrado este mes</span><span class="kpi-icon tone-success">${icon('dollar')}</span></div><div class="kpi-value">${usd(income)}</div><div class="kpi-sub">hoy ${usd(todayIn)}</div></div>
      <div class="card kpi kpi-link" data-go2="cobros"><div class="kpi-top"><span class="kpi-label">Por cobrar</span><span class="kpi-icon tone-${store.debtors.length ? 'danger' : 'neutral'}">${icon('wallet')}</span></div><div class="kpi-value">${usd(store.totalDebt)}</div><div class="kpi-sub">${store.debtors.length} alumno(s) con saldo</div></div>`;
    el.querySelectorAll('[data-go2]').forEach((b) => b.onclick = () => navigate(b.dataset.go2));
  }

  function today() {
    const list = store.todaySessions.slice().sort((a, b) => a.time.localeCompare(b.time));
    $('#d-today').innerHTML = list.length ? list.map((s) => sessionRowHTML(s, { compact: true })).join('') : emptyState('calendar', 'Hoy no tienes sesiones', 'Agenda una sesión o crea una serie semanal para tus alumnos fijos.');
    bindSessionRows($('#d-today'), () => store.sessions, () => { kpis(); today(); });
  }

  function tomorrow() {
    const list = store.sessionsOn(dayKey(addDays(new Date(), 1))).sort((a, b) => a.time.localeCompare(b.time));
    $('#d-tom').innerHTML = list.length ? `<div class="list">${list.map((s) => `<div class="list-item"><span class="cls-time">${esc(s.time)}</span><div class="grow" style="min-width:0"><b class="ellipsis">${esc((s.members || []).map((p) => p.name.split(' ')[0]).join(', '))}</b><div class="t-sub">${esc(s.place || '')}</div></div></div>`).join('')}</div>` : '<div class="small muted">Sin sesiones mañana.</div>';
  }

  function rem() {
    const list = autoReminders().filter((r) => !isSent(r.key));
    const custom = dueCustom();
    const counts = {}; list.forEach((r) => { counts[r.cat] = (counts[r.cat] || 0) + 1; });
    const cats = Object.entries(counts);
    $('#d-rem').innerHTML = cats.length || custom.length ? `<div class="rem-mini">${cats.map(([k, n]) => `<button class="rem-pill tone-${REM_CATS[k].tone}" data-rc="${k}">${icon(REM_CATS[k].icon)}<span class="grow">${esc(REM_CATS[k].label)}</span><b>${n}</b></button>`).join('')}
      ${custom.map((r) => `<button class="rem-pill tone-neutral" data-rc="propios">${icon('edit')}<span class="grow ellipsis">${esc(r.text)}</span></button>`).join('')}</div>` : emptyState('checkCircle', 'Todo al día', 'No hay recordatorios pendientes.');
    el.querySelectorAll('[data-rc]').forEach((b) => b.onclick = () => navigate('avisos', { params: { cat: b.dataset.rc } }));
  }

  async function logs() {
    let list = [];
    try { list = await store.recentLogs(10); } catch (e) { console.warn(e); }
    if (!el.isConnected) return;
    const byCode = new Map(store.members.map((m) => [m.cardCode, m]));
    $('#d-logs').innerHTML = list.length ? `<div class="list">${list.slice(0, 8).map((l) => `<button class="list-item-btn" data-lm="${byCode.get(l.code)?.id || ''}">${logItemHTML({ ...l, name: byCode.get(l.code)?.name || l.name }, { showName: true })}</button>`).join('')}</div>`
      : emptyState('clipboard', 'Sin registros recientes', 'Cuando tus alumnos marquen sus entrenos o su peso desde el carnet, aparecen aquí.');
    el.querySelectorAll('[data-lm]').forEach((b) => b.onclick = () => b.dataset.lm && openMember(b.dataset.lm, { tab: 'bitacora' }));
  }

  function best() {
    const rows = store.liveMembers.filter((m) => (m.evalHist || []).length > 1).map((m) => {
      const h = m.evalHist; const a = h[0]; const b = h[h.length - 1];
      const gain = /masa|fuerza|músculo/i.test(m.goal || '');
      const dw = (b.weight || 0) - (a.weight || 0);
      const cm = ['waist', 'hip'].reduce((s, k) => s + (a[k] && b[k] ? b[k] - a[k] : 0), 0);
      const score = gain ? dw + ((b.muscle || 0) - (a.muscle || 0)) * 2 : -dw - cm * 0.3;
      return { m, dw, cm, score, gain };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
    $('#d-best').innerHTML = rows.length ? `<div class="list">${rows.map((x) => `<button class="list-item" data-bm="${x.m.id}">${avatar(x.m)}<div class="grow" style="min-width:0"><b class="ellipsis">${esc(x.m.name)}</b><div class="t-sub">${esc(x.m.goal || '')}</div></div><div class="r"><b class="text-success">${x.dw > 0 ? '+' : ''}${num(x.dw, 1)} kg</b>${x.cm ? `<div class="t-sub">${x.cm > 0 ? '+' : ''}${num(x.cm, 1)} cm</div>` : ''}</div></button>`).join('')}</div>` : '<div class="small muted">Con dos evaluaciones o más verás aquí a quién le va mejor.</div>';
    el.querySelectorAll('[data-bm]').forEach((b) => b.onclick = () => openMember(b.dataset.bm, { tab: 'progreso' }));
    hydratePhotos($('#d-best'));
  }

  const all = () => { kpis(); today(); tomorrow(); rem(); best(); };
  all(); logs();
  const tick = setInterval(() => { kpis(); today(); }, 60000);
  const off = store.on('*', (evt) => {
    if (evt === 'sessions') { kpis(); today(); tomorrow(); rem(); }
    if (evt === 'members') { kpis(); rem(); best(); }
    if (['sales', 'rate', 'settings'].includes(evt)) kpis();
    if (['reminders', 'remlog'].includes(evt)) rem();
  });
  return () => { off(); clearInterval(tick); };
}
export { daysBetween, fmtAgo };
