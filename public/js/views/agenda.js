// SanoEntrenador — Agenda: sesiones de la semana, asistencia y series semanales
import { store, DAYS, DAYS_SHORT } from '../store.js';
import { saveSession, cancelSession, setAttendance, completeSession, toMin, minToTime } from '../ops.js';
import { SESSION_TYPES, ATT } from '../gym.js';
import { esc, toast, setBusy, todayKey, dayKey, addDays, fromKey, fmtDate, emptyState, openModal, confirmDialog, parseNum } from '../utils.js';
import { icon } from '../icons.js';
import { avatar, hydratePhotos, openMember, pickMember } from '../member.js';
import { composeWa } from '../shared.js';

const monday = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const longDay = (k) => { const d = fromKey(k); const t = todayKey(); const s = `${DAYS[d.getDay()]} ${d.getDate()} de ${d.toLocaleDateString('es', { month: 'long' })}`; return k === t ? `Hoy · ${s}` : k === dayKey(addDays(new Date(), 1)) ? `Mañana · ${s}` : s; };

/** Tarjeta de una sesión con botones de asistencia por alumno */
export function sessionRowHTML(s, { compact = false } = {}) {
  const ty = SESSION_TYPES[s.type] || SESSION_TYPES.presencial;
  const t = todayKey();
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  const start = toMin(s.time); const end = start + (Number(s.minutes) || 60);
  const live = s.date === t && start <= nowM && nowM < end;
  const past = s.date < t || (s.date === t && end <= nowM);
  const ids = s.memberIds || [];
  const pending = ids.filter((id) => !(s.att || {})[id]).length;
  return `<div class="ses ${s.status === 'cancelada' ? 'ses-off' : ''} ${live ? 'ses-live' : ''}" style="--sc:${ty.color}" data-ses="${s.id}">
    <div class="ses-time"><b>${esc(s.time)}</b><small>${minToTime(end)}</small>${live ? '<span class="ses-now">EN CURSO</span>' : ''}</div>
    <div class="ses-main">
      <div class="ses-head"><span class="ses-type">${icon(ty.icon)} ${esc(ty.label)}</span>${s.place ? `<span class="t-sub">${icon('pin')} ${esc(s.place)}</span>` : ''}${s.status === 'cancelada' ? '<span class="badge badge-neutral">Cancelada</span>' : ''}
        <span class="grow"></span>${s.status !== 'cancelada' ? `<button class="btn btn-ghost btn-icon btn-sm" data-smenu="${s.id}" aria-label="Opciones de la sesión">${icon('menu')}</button>` : ''}</div>
      ${s.note ? `<div class="small muted">${esc(s.note)}</div>` : ''}
      <div class="ses-people">${ids.map((id) => {
        const m = store.member(id) || (s.members || []).find((x) => x.id === id) || { id, name: 'Alumno' };
        const a = (s.att || {})[id];
        return `<div class="ses-p">
          <button class="ses-who" data-open="${id}">${avatar(m)}<span class="grow" style="min-width:0"><b class="ellipsis">${esc(m.name)}</b>${!compact && m.membership?.kind === 'sesiones' ? `<small>${m.membership.visitsLeft ?? 0} ses. restantes</small>` : ''}</span></button>
          ${s.status === 'cancelada' ? '' : `<div class="att" role="group" aria-label="Asistencia de ${esc(m.name)}">
            ${Object.entries(ATT).map(([k, v]) => `<button class="att-b att-${k} ${a === k ? 'on' : ''}" data-att="${k}" data-sid="${s.id}" data-mid="${id}" title="${v.label}" aria-label="${v.label}">${icon(v.icon)}</button>`).join('')}
            ${!past && !a ? `<button class="att-b att-wa" data-conf="${id}" data-sid="${s.id}" title="Confirmar por WhatsApp" aria-label="Confirmar por WhatsApp">${icon('whatsapp')}</button>` : ''}
          </div>`}
        </div>`;
      }).join('')}</div>
      ${past && pending && s.status !== 'cancelada' && ids.length > 1 ? `<button class="linkish small" data-all="${s.id}">${icon('check')} Marcar todos como asistió</button>` : ''}
    </div>
  </div>`;
}

/** Enlaza los botones de las tarjetas de sesión dentro de root. getList devuelve las sesiones visibles. */
export function bindSessionRows(root, getList, onChange = () => {}) {
  const find = (id) => store.sessions.find((x) => x.id === id) || getList().find((x) => x.id === id);
  root.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => openMember(b.dataset.open));
  root.querySelectorAll('[data-att]').forEach((b) => b.onclick = async () => {
    const s = find(b.dataset.sid); if (!s) return;
    const cur = (s.att || {})[b.dataset.mid];
    const next = cur === b.dataset.att ? null : b.dataset.att;
    b.disabled = true;
    try {
      await setAttendance(s, b.dataset.mid, next);
      const m = store.member(b.dataset.mid);
      if (next === 'asistio' && m?.membership?.kind === 'sesiones') {
        const left = Number(m.membership.visitsLeft);
        toast(left <= (store.access.lowSessions ?? 2) ? `Asistencia marcada. A ${m.name.split(' ')[0]} le quedan ${left} sesión(es).` : 'Asistencia marcada', left <= (store.access.lowSessions ?? 2) ? 'warning' : 'success');
      } else if (next) toast(ATT[next].label);
      onChange();
    } catch (e) { toast(e.message, 'danger'); b.disabled = false; }
  });
  root.querySelectorAll('[data-conf]').forEach((b) => b.onclick = () => { const s = find(b.dataset.sid); const m = store.member(b.dataset.conf); if (s && m) composeWa(m, 'sesion', { session: s }); });
  root.querySelectorAll('[data-all]').forEach((b) => b.onclick = async () => { const s = find(b.dataset.all); if (!s) return; setBusy(b, true); await completeSession(s); toast('Asistencias marcadas'); onChange(); });
  root.querySelectorAll('[data-smenu]').forEach((b) => b.onclick = () => sessionMenu(find(b.dataset.smenu), onChange));
  hydratePhotos(root, 40);
}

function sessionMenu(s, onChange) {
  if (!s) return;
  const mm = openModal({
    title: `${fmtDate(s.date)} · ${esc(s.time)}`, sub: esc(SESSION_TYPES[s.type]?.label || 'Sesión'), size: 'sm',
    body: `<div class="list">
      <button class="list-item" data-o="edit">${icon('edit')}<div class="grow"><b>Editar sesión</b><div class="t-sub">Fecha, hora, alumnos, lugar</div></div></button>
      <button class="list-item" data-o="wa">${icon('whatsapp')}<div class="grow"><b>Confirmar por WhatsApp</b><div class="t-sub">Uno por uno, con el mensaje listo</div></div></button>
      <button class="list-item" data-o="cancel">${icon('x')}<div class="grow"><b>Cancelar esta sesión</b><div class="t-sub">No descuenta sesiones</div></div></button>
      ${s.seriesId ? `<button class="list-item" data-o="series">${icon('layers')}<div class="grow"><b>Cancelar esta y las siguientes</b><div class="t-sub">De la misma serie semanal</div></div></button>` : ''}
    </div>`,
    footer: '<button class="btn btn-secondary" data-close>Cerrar</button>'
  });
  mm.el.querySelector('[data-o="edit"]').onclick = async () => { mm.close(); if (await sessionForm(s)) onChange(); };
  mm.el.querySelector('[data-o="wa"]').onclick = () => { mm.close(); confirmQueue([s]); };
  const cancel = async (series) => {
    mm.close();
    if (!(await confirmDialog({ title: series ? 'Cancelar la serie' : 'Cancelar sesión', message: series ? 'Se cancelan esta sesión y las siguientes de la serie que no tengan asistencia marcada.' : 'La sesión queda como cancelada y no descuenta sesiones.', confirmText: 'Cancelar sesión', danger: true }))) return;
    const n = await cancelSession(s, { series }); toast(`${n} sesión(es) cancelada(s)`, 'warning'); onChange();
  };
  mm.el.querySelector('[data-o="cancel"]').onclick = () => cancel(false);
  mm.el.querySelector('[data-o="series"]')?.addEventListener('click', () => cancel(true));
}

/** Envía la confirmación por WhatsApp a los alumnos de varias sesiones, uno tras otro */
export function confirmQueue(sessions) {
  const items = sessions.flatMap((s) => (s.memberIds || []).filter((id) => !(s.att || {})[id]).map((id) => ({ s, m: store.member(id) }))).filter((x) => x.m);
  if (!items.length) { toast('No hay alumnos por confirmar.', 'info'); return; }
  let i = 0;
  const m = openModal({ title: 'Confirmar sesiones', size: 'md', body: '<div data-b></div>', footer: '<button class="btn btn-secondary" data-close>Terminar</button><button class="btn btn-whatsapp" data-go></button>' });
  const draw = () => {
    const it = items[i];
    m.el.querySelector('[data-b]').innerHTML = `<div class="small muted mb">${i + 1} de ${items.length}</div><div class="row mb">${avatar(it.m)}<div><b>${esc(it.m.name)}</b><div class="t-sub">${longDay(it.s.date)} · ${esc(it.s.time)}</div></div></div>`;
    m.el.querySelector('[data-go]').innerHTML = `${icon('whatsapp')} ${i < items.length - 1 ? 'Enviar y siguiente' : 'Enviar'}`;
    hydratePhotos(m.el);
  };
  m.el.querySelector('[data-go]').onclick = () => {
    const it = items[i];
    composeWa(it.m, 'sesion', { session: it.s, onSent: async () => { const { logSent } = await import('../ops.js'); logSent(`sesion_${it.s.id}_${it.m.id}`, { memberId: it.m.id }); } });
    i++; if (i >= items.length) m.close(); else draw();
  };
  draw();
}

/** Crear o editar una sesión (con repetición semanal) */
export function sessionForm(s = null, preset = {}) {
  const A = store.settings.agenda;
  const x = { date: todayKey(), time: '', minutes: A.minutes || 60, type: 'presencial', place: '', note: '', memberIds: [], ...preset, ...(s || {}) };
  if (!x.time) { const h = Math.min(Math.max(new Date().getHours() + 1, toMin(A.start) / 60), toMin(A.end) / 60 - 1); x.time = `${String(Math.floor(h)).padStart(2, '0')}:00`; }
  if (!x.place && x.memberIds.length) x.place = store.member(x.memberIds[0])?.place || '';
  const ids = new Set(x.memberIds);
  let type = x.type;
  let repeat = false;
  const rdays = new Set([fromKey(x.date).getDay()]);
  return new Promise((resolve) => {
    let ok = false;
    const m = openModal({
      title: s ? 'Editar sesión' : 'Nueva sesión', sub: s ? longDay(s.date) : 'Agenda una sesión o una serie semanal', size: 'lg',
      body: `<form class="stack" data-f autocomplete="off">
        <div class="field"><label>Alumnos</label><div class="chips chips-wrap" data-ppl></div></div>
        <div class="field"><label>Tipo</label><div class="type-grid" data-types>${Object.entries(SESSION_TYPES).map(([k, v]) => `<button type="button" class="type-btn ${k === type ? 'on' : ''}" data-ty="${k}" style="--tc:${v.color}">${icon(v.icon)}<span>${esc(v.label)}</span></button>`).join('')}</div></div>
        <div class="form-grid form-grid-3">
          <div class="field"><label>Fecha</label><input class="input" type="date" name="date" value="${x.date}"></div>
          <div class="field"><label>Hora</label><input class="input" type="time" name="time" value="${esc(x.time)}" step="900"></div>
          <div class="field"><label>Duración</label><select class="select" name="minutes">${[30, 45, 60, 75, 90, 120].map((v) => `<option value="${v}" ${Number(x.minutes) === v ? 'selected' : ''}>${v} min</option>`).join('')}</select></div>
        </div>
        <div class="form-grid">
          <div class="field"><label>Lugar</label><input class="input" name="place" list="places-dl" value="${esc(x.place)}" placeholder="Gimnasio, parque, a domicilio…"><datalist id="places-dl">${(store.settings.places || []).map((p) => `<option value="${esc(p)}">`).join('')}</datalist></div>
          <div class="field"><label>Nota</label><input class="input" name="note" value="${esc(x.note)}" placeholder="Ej.: traer bandas, evaluación"></div>
        </div>
        ${s ? '' : `<label class="check"><input type="checkbox" data-rep> <span><b>Repetir cada semana</b> (crea la serie de una vez)</span></label>
        <div class="stack" data-repw hidden>
          <div class="field"><label>Días</label><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="chip ${rdays.has(d) ? 'on' : ''}" data-rd="${d}">${DAYS_SHORT[d]}</button>`).join('')}</div></div>
          <div class="field"><label>Durante</label><select class="select" name="weeks">${[2, 4, 6, 8, 12, 16].map((w) => `<option value="${w}" ${w === 4 ? 'selected' : ''}>${w} semanas</option>`).join('')}</select></div>
        </div>`}
        <div data-clash></div>
        <div class="error-msg" data-err></div>
      </form>`,
      footer: `<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-ok>${icon('check')} ${s ? 'Guardar' : 'Agendar'}</button>`,
      onClose: () => resolve(ok)
    });
    const F = m.el.querySelector('[data-f]').elements;
    const drawPeople = () => {
      m.el.querySelector('[data-ppl]').innerHTML = [...ids].map((id) => { const p = store.member(id); return p ? `<span class="chip on">${esc(p.name)} <button type="button" class="tag-x" data-rm="${id}" aria-label="Quitar">${icon('x')}</button></span>` : ''; }).join('')
        + `<button type="button" class="chip" data-add>${icon('plus')} ${ids.size ? 'Agregar otro' : 'Elegir alumno'}</button>`;
      m.el.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { ids.delete(b.dataset.rm); drawPeople(); });
      m.el.querySelector('[data-add]').onclick = async () => {
        const p = await pickMember({ title: 'Agregar alumno a la sesión', filter: (y) => !ids.has(y.id) });
        if (p) { ids.add(p.id); if (!F.place.value && p.place) F.place.value = p.place; drawPeople(); clash(); }
      };
    };
    const clash = () => {
      const d = F.date.value; const st = toMin(F.time.value); const en = st + Number(F.minutes.value);
      const hit = store.sessionsOn(d).filter((y) => y.id !== s?.id && toMin(y.time) < en && st < toMin(y.time) + (Number(y.minutes) || 60));
      m.el.querySelector('[data-clash]').innerHTML = hit.length ? `<div class="vital-alert warning">${icon('alert')} Se cruza con: ${hit.map((y) => `${esc(y.time)} ${esc((y.members || []).map((p) => p.name.split(' ')[0]).join(', '))}`).join(' · ')}</div>` : '';
    };
    m.el.querySelectorAll('[data-ty]').forEach((b) => b.onclick = () => { type = b.dataset.ty; m.el.querySelectorAll('[data-ty]').forEach((y) => y.classList.toggle('on', y === b)); if (type === 'online' && !F.place.value) F.place.value = 'Videollamada'; if (type === 'evaluacion' && Number(F.minutes.value) === 60) F.minutes.value = '45'; });
    const rep = m.el.querySelector('[data-rep]');
    if (rep) rep.onchange = () => { repeat = rep.checked; m.el.querySelector('[data-repw]').hidden = !repeat; };
    m.el.querySelectorAll('[data-rd]').forEach((b) => b.onclick = () => { const d = Number(b.dataset.rd); rdays.has(d) ? rdays.delete(d) : rdays.add(d); b.classList.toggle('on', rdays.has(d)); });
    F.date.onchange = () => { if (!repeat) { rdays.clear(); rdays.add(fromKey(F.date.value).getDay()); m.el.querySelectorAll('[data-rd]').forEach((b) => b.classList.toggle('on', rdays.has(Number(b.dataset.rd)))); } clash(); };
    F.time.onchange = clash; F.minutes.onchange = clash;
    drawPeople(); clash();
    m.el.querySelector('[data-ok]').onclick = async (e) => {
      const err = m.el.querySelector('[data-err]'); err.textContent = '';
      if (!ids.size) { err.textContent = 'Elige al menos un alumno.'; return; }
      if (repeat && !rdays.size) { err.textContent = 'Elige los días de la semana.'; return; }
      const btn = e.currentTarget; setBusy(btn, true, 'Guardando…');
      try {
        const out = await saveSession({ date: F.date.value, time: F.time.value, minutes: parseNum(F.minutes.value), type, place: F.place.value, note: F.note.value, memberIds: [...ids] }, s?.id || null, { repeat: repeat ? { days: [...rdays], weeks: parseNum(F.weeks.value) } : null });
        ok = true; m.close();
        toast(s ? 'Sesión actualizada' : out.count > 1 ? `${out.count} sesiones agendadas` : 'Sesión agendada');
      } catch (ex) { err.textContent = ex.message; setBusy(btn, false); }
    };
  });
}

export function mount(el, { params = {} } = {}) {
  let sel = params.date || todayKey();
  let week = monday(fromKey(sel));
  let extra = []; // sesiones antiguas consultadas aparte
  el.innerHTML = `
    <div class="view-header"><div><h1 class="view-title">Agenda</h1><p class="view-sub" data-sub></p></div>
      <div class="view-actions"><button class="btn btn-secondary" data-confirm>${icon('whatsapp')} Confirmar mañana</button><button class="btn btn-primary" data-new>${icon('plus')} Nueva sesión</button></div></div>
    <div class="card week-card" data-tour="week">
      <div class="between mb"><button class="btn btn-ghost btn-icon" data-w="-1" aria-label="Semana anterior">${icon('chevronLeft')}</button><b data-wlabel></b><div class="row"><button class="btn btn-ghost btn-sm" data-today>Hoy</button><button class="btn btn-ghost btn-icon" data-w="1" aria-label="Semana siguiente">${icon('chevronRight')}</button></div></div>
      <div class="wstrip" data-strip></div>
    </div>
    <div class="grid-main mt-lg">
      <div class="stack"><div class="between"><h2 class="day-title" data-dtitle></h2><button class="btn btn-ghost btn-sm" data-newday>${icon('plus')} Agendar este día</button></div><div data-day class="stack"></div></div>
      <div class="stack"><div class="card"><div class="card-title">${icon('chart')} Esta semana</div><div data-wsum class="mt"></div></div>
        <div class="card"><div class="card-title">${icon('clock')} Horas libres del día</div><div data-free class="mt"></div></div></div>
    </div>`;
  const $ = (q) => el.querySelector(q);
  const all = () => [...store.sessions, ...extra.filter((x) => !store.sessions.some((y) => y.id === x.id))];
  const weekKeys = () => Array.from({ length: 7 }, (_, i) => dayKey(addDays(week, i)));
  async function loadOld() {
    const from = dayKey(week); const lim = dayKey(addDays(new Date(), -21));
    if (from >= lim) { extra = []; return; }
    extra = await store.listBetween('sessions', 'date', from, dayKey(addDays(week, 6))).catch(() => []);
  }
  function draw() {
    const keys = weekKeys(); const t = todayKey();
    const list = all().filter((s) => keys.includes(s.date));
    $('[data-wlabel]').textContent = `${fmtDate(keys[0]).slice(0, 5)} – ${fmtDate(keys[6])}`;
    $('[data-sub]').textContent = `${store.todaySessions.length} sesión(es) hoy · ${list.filter((s) => s.status !== 'cancelada').length} esta semana`;
    $('[data-strip]').innerHTML = keys.map((k) => {
      const d = fromKey(k); const n = list.filter((s) => s.date === k && s.status !== 'cancelada');
      const pend = n.filter((s) => (s.memberIds || []).some((id) => !(s.att || {})[id])).length;
      return `<button class="wday-b ${k === sel ? 'on' : ''} ${k === t ? 'today' : ''}" data-d="${k}"><small>${DAYS_SHORT[d.getDay()]}</small><b>${d.getDate()}</b><span class="wdots">${n.slice(0, 5).map((s) => `<i style="background:${(SESSION_TYPES[s.type] || SESSION_TYPES.presencial).color}"></i>`).join('')}</span><em>${n.length ? n.length : ''}</em>${k < t && pend ? '<span class="wpend"></span>' : ''}</button>`;
    }).join('');
    el.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { sel = b.dataset.d; draw(); });
    $('[data-dtitle]').textContent = longDay(sel);
    const day = all().filter((s) => s.date === sel).sort((a, b) => a.time.localeCompare(b.time));
    $('[data-day]').innerHTML = day.length ? day.map((s) => sessionRowHTML(s)).join('') : `<div class="card">${emptyState('calendar', 'Día libre', 'No hay sesiones este día. Agenda una o crea una serie semanal.')}</div>`;
    bindSessionRows($('[data-day]'), all, draw);
    // Resumen de la semana
    const act = list.filter((s) => s.status !== 'cancelada');
    const cnt = (k) => act.reduce((a, s) => a + Object.values(s.att || {}).filter((v) => v === k).length, 0);
    const hours = act.reduce((a, s) => a + (Number(s.minutes) || 60), 0) / 60;
    const people = new Set(act.flatMap((s) => s.memberIds || [])).size;
    $('[data-wsum]').innerHTML = `<div class="kv-grid"><div><span>Sesiones</span><b>${act.length}</b></div><div><span>Horas</span><b>${Math.round(hours * 10) / 10}</b></div><div><span>Alumnos</span><b>${people}</b></div><div><span>Asistencias</span><b class="text-success">${cnt('asistio')}</b></div><div><span>Faltas</span><b class="${cnt('falto') ? 'text-danger' : ''}">${cnt('falto')}</b></div><div><span>Canceladas</span><b>${list.length - act.length + cnt('cancelo')}</b></div></div>
      <div class="type-legend mt">${Object.entries(SESSION_TYPES).map(([k, v]) => `<span><i style="background:${v.color}"></i>${esc(v.label)} · ${act.filter((s) => s.type === k).length}</span>`).join('')}</div>`;
    // Horas libres
    const A = store.settings.agenda;
    const busy = day.filter((s) => s.status !== 'cancelada').map((s) => [toMin(s.time), toMin(s.time) + (Number(s.minutes) || 60)]);
    const workDay = (A.days || []).includes(fromKey(sel).getDay());
    const slots = [];
    for (let mi = toMin(A.start); mi + (A.minutes || 60) <= toMin(A.end); mi += 60) if (!busy.some(([a, b]) => mi < b && a < mi + (A.minutes || 60))) slots.push(mi);
    const nowM = sel === t ? new Date().getHours() * 60 + new Date().getMinutes() : -1;
    const free = slots.filter((x) => x > nowM);
    $('[data-free]').innerHTML = !workDay ? '<div class="small muted">Día de descanso según tu horario (Configuración › Agenda).</div>' : free.length ? `<div class="chips chips-wrap">${free.map((x) => `<button class="chip" data-slot="${minToTime(x)}">${minToTime(x)}</button>`).join('')}</div><p class="hint mt">Toca una hora para agendar.</p>` : '<div class="small muted">Sin horas libres.</div>';
    el.querySelectorAll('[data-slot]').forEach((b) => b.onclick = async () => { if (await sessionForm(null, { date: sel, time: b.dataset.slot })) draw(); });
  }
  const go = async (n) => { week = addDays(week, 7 * n); sel = dayKey(n > 0 ? week : addDays(week, 0)); if (weekKeys().includes(todayKey())) sel = todayKey(); await loadOld(); draw(); };
  el.querySelectorAll('[data-w]').forEach((b) => b.onclick = () => go(Number(b.dataset.w)));
  $('[data-today]').onclick = async () => { sel = todayKey(); week = monday(new Date()); await loadOld(); draw(); };
  $('[data-new]').onclick = async () => { if (await sessionForm(null, { date: sel >= todayKey() ? sel : todayKey() })) draw(); };
  $('[data-newday]').onclick = async () => { if (await sessionForm(null, { date: sel })) draw(); };
  $('[data-confirm]').onclick = () => confirmQueue(store.sessionsOn(dayKey(addDays(new Date(), 1))));
  draw();
  const off = store.on('*', (evt) => { if (['sessions', 'members', 'settings'].includes(evt)) draw(); });
  const tick = setInterval(draw, 60000);
  return () => { off(); clearInterval(tick); };
}
