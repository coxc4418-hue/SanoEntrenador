// SanoEntrenador — Recordatorios: lista automática del día por WhatsApp + recordatorios propios
import { store } from '../store.js';
import { logSent, saveReminder, doneReminder, deleteReminder } from '../ops.js';
import { esc, toast, setBusy, todayKey, fmtDate, emptyState, openModal, confirmDialog } from '../utils.js';
import { icon } from '../icons.js';
import { avatar, hydratePhotos, openMember, pickMember } from '../member.js';
import { composeWa, memberMessage } from '../shared.js';
import { autoReminders, isSent, dueCustom, REM_CATS } from '../reminders.js';

export function mount(el, { params = {} } = {}) {
  let cat = params.cat || null;
  let showSent = false;
  el.innerHTML = `
    <div class="view-header"><div><h1 class="view-title">Recordatorios</h1><p class="view-sub" data-sub></p></div>
      <div class="view-actions"><button class="btn btn-secondary" data-add>${icon('plus')} Recordatorio propio</button><button class="btn btn-whatsapp" data-queue>${icon('send')} Enviar en cola</button></div></div>
    <div class="rem-cats" data-tour="rem-cats" data-cats></div>
    <div class="grid-main mt-lg">
      <div class="card"><div class="card-head"><div class="card-title" data-ctitle></div><label class="check small"><input type="checkbox" data-sent> <span>Ver enviados</span></label></div><div data-items></div></div>
      <div class="stack"><div class="card"><div class="card-head"><div class="card-title">${icon('edit')} Mis recordatorios</div><button class="btn btn-ghost btn-sm" data-add2>${icon('plus')}</button></div><div data-custom></div></div>
        <div class="box small">${icon('info')} Los textos se cambian en <b>Configuración › Mensajes</b>. Lo enviado queda marcado para no repetirlo.</div></div>
    </div>`;
  const $ = (s) => el.querySelector(s);

  function draw() {
    const all = autoReminders();
    const pend = all.filter((r) => !isSent(r.key));
    const custom = dueCustom();
    $('[data-sub]').textContent = pend.length + custom.length ? `${pend.length + custom.length} pendiente(s) hoy` : 'Todo al día';
    $('[data-cats]').innerHTML = `<button class="rem-cat ${!cat ? 'on' : ''}" data-c=""><span class="kpi-icon tone-brand">${icon('bell')}</span><b>${pend.length}</b><span>Todos</span></button>` + Object.entries(REM_CATS).map(([k, c]) => {
      const n = pend.filter((r) => r.cat === k).length; const tot = all.filter((r) => r.cat === k).length;
      return `<button class="rem-cat ${cat === k ? 'on' : ''} ${tot ? '' : 'empty'}" data-c="${k}"><span class="kpi-icon tone-${c.tone}">${icon(c.icon)}</span><b>${n}</b><span>${esc(c.label)}</span>${tot - n ? `<small>${tot - n} enviado(s)</small>` : ''}</button>`;
    }).join('');
    el.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { cat = b.dataset.c || null; draw(); });
    $('[data-ctitle]').innerHTML = cat ? `${icon(REM_CATS[cat].icon)} ${esc(REM_CATS[cat].label)}` : `${icon('bell')} Para escribir hoy`;
    const items = all.filter((r) => (!cat || r.cat === cat) && (showSent || !isSent(r.key)));
    $('[data-items]').innerHTML = items.length ? `<div class="list">${items.map((r) => {
      const sent = isSent(r.key);
      return `<div class="list-item rem-item ${sent ? 'sent' : ''}">${avatar(r.member)}<div class="grow" style="min-width:0"><button class="linkish" data-m="${r.member.id}"><b class="ellipsis">${esc(r.member.name)}</b></button>
        <div class="t-sub"><span class="badge badge-${REM_CATS[r.cat].tone}">${esc(REM_CATS[r.cat].label)}</span> ${esc(r.sub || '')}</div></div>
        ${sent ? `<span class="badge badge-success">${icon('check')} Enviado</span>` : `<button class="btn btn-ghost btn-icon btn-sm" data-done="${esc(r.key)}" title="Marcar como hecho" aria-label="Marcar como hecho">${icon('check')}</button><button class="btn btn-whatsapp btn-sm" data-send="${esc(r.key)}">${icon('whatsapp')}<span class="hide-sm"> Enviar</span></button>`}</div>`;
    }).join('')}</div>` : emptyState('checkCircle', cat ? 'Nada pendiente aquí' : '¡Todo al día!', 'Cuando haya sesiones por confirmar, planes por vencer, deudas o cumpleaños aparecen aquí.');
    const byKey = new Map(all.map((r) => [r.key, r]));
    el.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => openMember(b.dataset.m));
    el.querySelectorAll('[data-send]').forEach((b) => b.onclick = () => send(byKey.get(b.dataset.send)));
    el.querySelectorAll('[data-done]').forEach((b) => b.onclick = async () => { const r = byKey.get(b.dataset.done); await logSent(r.key, { memberId: r.member.id, cat: r.cat, manual: true }); toast('Marcado como hecho'); });
    hydratePhotos($('[data-items]'), 60);
    drawCustom();
  }
  function send(r) {
    if (!r) return;
    composeWa(r.member, r.msg, { session: r.session, extra: r.extra || {}, onSent: () => logSent(r.key, { memberId: r.member.id, cat: r.cat }) });
  }
  function drawCustom() {
    const list = store.reminders;
    const t = todayKey();
    $('[data-custom]').innerHTML = list.length ? `<div class="list">${list.map((r) => `<div class="list-item"><button class="chk ${r.date <= t ? 'due' : ''}" data-cd="${r.id}" aria-label="Hecho">${icon('check')}</button><div class="grow" style="min-width:0"><div class="small">${esc(r.text)}</div>
      <div class="t-sub">${r.date < t ? `<span class="text-danger">${fmtDate(r.date)}</span>` : r.date === t ? '<b>Hoy</b>' : fmtDate(r.date)}${r.repeat ? ` · ${icon('refresh')} ${esc(r.repeat)}` : ''}${r.memberName ? ` · ${esc(r.memberName)}` : ''}</div></div>
      ${r.wa && r.memberId ? `<button class="btn btn-whatsapp btn-icon btn-sm" data-cw="${r.id}" aria-label="WhatsApp">${icon('whatsapp')}</button>` : ''}<button class="btn btn-ghost btn-icon btn-sm" data-ce="${r.id}" aria-label="Editar">${icon('edit')}</button></div>`).join('')}</div>`
      : '<div class="small muted">Anota lo que no quieres olvidar: «llamar a Ana el viernes», «comprar bandas»… con repetición semanal o mensual.</div>';
    const get = (id) => list.find((r) => r.id === id);
    el.querySelectorAll('[data-cd]').forEach((b) => b.onclick = async () => { const r = get(b.dataset.cd); await doneReminder(r); toast(r.repeat ? 'Hecho: se reprogramó' : 'Hecho'); });
    el.querySelectorAll('[data-cw]').forEach((b) => b.onclick = () => { const r = get(b.dataset.cw); const m = store.member(r.memberId); if (m) composeWa(m, 'libre', { extra: {} }); });
    el.querySelectorAll('[data-ce]').forEach((b) => b.onclick = () => reminderForm(get(b.dataset.ce)));
  }
  function queue() {
    const items = autoReminders().filter((r) => (!cat || r.cat === cat) && !isSent(r.key));
    if (!items.length) { toast('No hay mensajes pendientes.', 'info'); return; }
    let i = 0;
    const m = openModal({ title: 'Enviar en cola', sub: cat ? esc(REM_CATS[cat].label) : 'Todos los pendientes de hoy', size: 'md', body: '<div data-b></div>', footer: '<button class="btn btn-secondary" data-close>Terminar</button><button class="btn btn-ghost" data-skip>Saltar</button><button class="btn btn-whatsapp" data-go></button>' });
    const draw1 = () => {
      const r = items[i];
      m.el.querySelector('[data-b]').innerHTML = `<div class="between mb"><span class="small muted">${i + 1} de ${items.length}</span><span class="badge badge-${REM_CATS[r.cat].tone}">${esc(REM_CATS[r.cat].label)}</span></div>
        <div class="progress mb"><i style="width:${Math.round((i / items.length) * 100)}%"></i></div>
        <div class="row mb">${avatar(r.member)}<div><b>${esc(r.member.name)}</b><div class="t-sub">${esc(r.member.phone || 'sin teléfono')} · ${esc(r.sub || '')}</div></div></div>
        <div class="wa-preview">${esc(memberMessage(r.msg, { member: r.member, session: r.session, extra: r.extra || {} })).replace(/\n/g, '<br>')}</div>`;
      m.el.querySelector('[data-go]').innerHTML = `${icon('whatsapp')} ${i < items.length - 1 ? 'Enviar y siguiente' : 'Enviar'}`;
      hydratePhotos(m.el);
    };
    const next = () => { i++; if (i >= items.length) { m.close(); toast('¡Listo! Cola terminada.'); } else draw1(); };
    m.el.querySelector('[data-skip]').onclick = next;
    m.el.querySelector('[data-go]').onclick = () => {
      const r = items[i];
      const text = memberMessage(r.msg, { member: r.member, session: r.session, extra: r.extra || {} });
      import('../utils.js').then(({ waLink }) => window.open(r.member.phone ? waLink(r.member.phone, text) : 'https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener'));
      logSent(r.key, { memberId: r.member.id, cat: r.cat });
      next();
    };
    draw1();
  }
  function reminderForm(r = null) {
    let member = r?.memberId ? store.member(r.memberId) : null;
    const m = openModal({
      title: r ? 'Editar recordatorio' : 'Nuevo recordatorio', size: 'sm',
      body: `<form class="stack" data-f><div class="field"><label>¿Qué tienes que hacer?</label><textarea class="textarea" name="text" rows="3" autofocus>${esc(r?.text || '')}</textarea></div>
        <div class="form-grid"><div class="field"><label>Fecha</label><input class="input" type="date" name="date" value="${r?.date || todayKey()}"></div>
        <div class="field"><label>Repetir</label><select class="select" name="repeat">${[['', 'No'], ['diario', 'Cada día'], ['semanal', 'Cada semana'], ['mensual', 'Cada mes']].map(([v, l]) => `<option value="${v}" ${r?.repeat === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
        <div class="field"><label>Alumno (opcional)</label><div class="row"><button type="button" class="btn btn-secondary btn-sm grow" data-pm>${member ? esc(member.name) : `${icon('user')} Elegir alumno`}</button>${member ? '<button type="button" class="btn btn-ghost btn-sm" data-nopm>Quitar</button>' : ''}</div></div>
        <label class="check"><input type="checkbox" name="wa" ${r?.wa ? 'checked' : ''}> <span>Mostrar botón de WhatsApp</span></label>
        <div class="error-msg" data-err></div></form>`,
      footer: `${r ? `<button class="btn btn-ghost" data-del style="margin-right:auto">${icon('trash')}</button>` : ''}<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-ok>${icon('check')} Guardar</button>`
    });
    const F = m.el.querySelector('[data-f]').elements;
    m.el.querySelector('[data-pm]').onclick = async () => { const p = await pickMember({ allowNew: false }); if (p) { member = p; m.el.querySelector('[data-pm]').textContent = p.name; F.wa.checked = true; } };
    m.el.querySelector('[data-nopm]')?.addEventListener('click', () => { member = null; m.el.querySelector('[data-pm]').textContent = 'Elegir alumno'; });
    m.el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await confirmDialog({ title: 'Eliminar recordatorio', message: '¿Eliminarlo?', confirmText: 'Eliminar', danger: true })) { await deleteReminder(r); m.close(); } });
    m.el.querySelector('[data-ok]').onclick = async (e) => {
      setBusy(e.currentTarget, true);
      try { await saveReminder({ text: F.text.value, date: F.date.value, repeat: F.repeat.value, memberId: member?.id || null, wa: F.wa.checked }, r?.id || null); m.close(); toast('Recordatorio guardado'); }
      catch (ex) { m.el.querySelector('[data-err]').textContent = ex.message; setBusy(e.currentTarget, false); }
    };
  }
  $('[data-sent]').onchange = (e) => { showSent = e.target.checked; draw(); };
  $('[data-queue]').onclick = queue;
  $('[data-add]').onclick = () => reminderForm();
  $('[data-add2]').onclick = () => reminderForm();
  draw();
  const off = store.on('*', (evt) => { if (['members', 'sessions', 'reminders', 'remlog', 'settings'].includes(evt)) draw(); });
  return () => off();
}
