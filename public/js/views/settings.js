// SanoEntrenador — Configuración: perfil, página pública, planes, agenda, mensajes, recibos y seguridad
import { store, updateTenant, DAYS_SHORT, DEFAULT_SERVICES } from '../store.js';
import { requirePin, changePassword, authErrorMessage, session } from '../auth.js';
import { esc, num, toast, parseNum, setBusy, toggleTheme, download, nowISO, round2, openModal, shortId, confirmDialog, emptyState, loc, flagImg, usd, scaleUSD, compressImage } from '../utils.js';
import { icon } from '../icons.js';
import { fxSectionHTML, bindFxSection } from '../bcv.js';
import { openCountryPicker, salesWa, SALES_PHONE_FMT, memberMessage, qrDataURL } from '../shared.js';
import { isStandalone, bindInstallButtons } from '../install.js';
import { PLAN_KINDS, PLAN_COLORS, planDuration, DEFAULT_MSGS, MSG_VARS } from '../gym.js';
import { publishPage, pageUrl, slugify, refreshCards } from '../ops.js';
import { usernameOf } from '../auth.js';

const SECTIONS = { perfil: 'Mi perfil', pagina: 'Mi página', planes: 'Planes y precios', agenda: 'Agenda y reglas', mensajes: 'Mensajes', moneda: 'Moneda y tasa', recibos: 'Recibos', seguridad: 'Seguridad', apps: 'Instalar y respaldo' };
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const SAMPLE = { name: 'María Pérez', phone: '', membership: { planName: '12 sesiones', end: new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10), kind: 'sesiones', visitsLeft: 2 }, balance: 20, cardCode: 'K7P3QXZ2', routineName: 'Fuerza 3 días' };

export function mount(el, { params = {} }) {
  let sec = SECTIONS[params.tab || params.sec] ? (params.tab || params.sec) : 'perfil';
  el.innerHTML = `
    <div class="view-header"><div><h1 class="view-title">Configuración</h1><p class="view-sub">Tu perfil, tus planes, tu horario y cómo le escribes a tus alumnos.</p></div></div>
    <div class="tabs tabs-scroll" data-tour="settings-tabs">${Object.entries(SECTIONS).map(([k, v]) => `<button data-s="${k}">${v}</button>`).join('')}</div>
    <div id="s-body" style="max-width:980px"></div>`;
  const $ = (q) => el.querySelector(q);
  const s = () => store.settings;

  function render() {
    el.querySelectorAll('[data-s]').forEach((b) => b.classList.toggle('on', b.dataset.s === sec));
    const body = $('#s-body');

    if (sec === 'perfil') {
      body.innerHTML = `<form class="card stack" id="f-biz">
        <div class="form-grid">
          <div class="field"><label>Tu nombre</label><input class="input" name="coachName" value="${esc(s().coachName || '')}" placeholder="Ej.: Carlos Rivas"><span class="hint">Así firmas los mensajes y apareces en el carnet de tus alumnos.</span></div>
          <div class="field"><label>Nombre de tu marca</label><input class="input" name="businessName" value="${esc(s().businessName || store.tenant?.name || '')}" placeholder="Ej.: Rivas Training"></div>
          <div class="field full"><label>Especialidad</label><input class="input" name="specialty" value="${esc(s().specialty || '')}" placeholder="Ej.: Entrenador personal · Fuerza y pérdida de grasa"></div>
          <div class="field"><label>WhatsApp</label><input class="input" name="whatsapp" inputmode="tel" value="${esc(s().whatsapp || '')}"><span class="hint">Tus alumnos te escriben desde su carnet.</span></div>
          <div class="field"><label>Teléfono</label><input class="input" name="phone" inputmode="tel" value="${esc(s().phone || '')}"></div>
          <div class="field"><label>Instagram</label><input class="input" name="instagram" value="${esc(s().instagram || '')}" placeholder="@tuusuario"></div>
          <div class="field"><label>Correo</label><input class="input" name="email" type="email" value="${esc(s().email || '')}"></div>
          <div class="field"><label>Ciudad</label><input class="input" name="city" value="${esc(s().city || '')}"></div>
          <div class="field"><label>${esc(loc().tax)} (opcional)</label><input class="input" name="rif" value="${esc(s().rif || '')}"></div>
          <div class="field full"><label>Dirección o gimnasio donde entrenas</label><input class="input" name="address" value="${esc(s().address || '')}"></div>
          <div class="field full"><label>Sobre ti</label><textarea class="textarea" name="bio" rows="3" placeholder="Tu experiencia y cómo trabajas. Aparece en tu página pública.">${esc(s().bio || '')}</textarea></div>
          <div class="field full"><label>Certificaciones</label><input class="input" name="certifications" value="${esc(s().certifications || '')}" placeholder="Ej.: NSCA-CPT · Lic. en Educación Física"></div>
          <div class="field full"><label>Lugares donde entrenas (separados por coma)</label><input class="input" name="places" value="${esc((s().places || []).join(', '))}"></div>
          <div class="field full"><label>Normas para tus alumnos</label><textarea class="textarea" name="rules" rows="2">${esc(s().rules || '')}</textarea><span class="hint">Aparecen en el carnet del alumno.</span></div>
        </div>
        <div class="row" style="justify-content:flex-end"><button class="btn btn-primary">${icon('check')} Guardar perfil</button></div>
      </form>
      <div class="card mt-lg between row-wrap"><div class="row" style="gap:12px"><span class="flag">${flagImg(loc().code, 30)}</span><div><div class="bold">País: ${esc(loc().name)} · ${esc(loc().curName)} (${esc(loc().sym)})</div><div class="small muted">Moneda, formas de pago y prefijo de WhatsApp.</div></div></div><button class="btn btn-secondary" id="s-rate">${icon('globe')} Cambiar país</button></div>
      <div class="card mt-lg between row-wrap"><div><div class="bold">Tema de la aplicación</div><div class="small muted">Claro u oscuro.</div></div><button class="btn btn-secondary" id="s-theme">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')} Cambiar tema</button></div>`;
      $('#f-biz').onsubmit = async (e) => {
        e.preventDefault(); const F = e.target.elements;
        const patch = {}; for (const k of ['coachName', 'businessName', 'specialty', 'whatsapp', 'phone', 'instagram', 'email', 'city', 'rif', 'address', 'bio', 'certifications', 'rules']) patch[k] = F[k].value.trim();
        patch.places = F.places.value.split(',').map((x) => x.trim()).filter(Boolean);
        const btn = e.target.querySelector('button.btn-primary'); setBusy(btn, true, 'Guardando…');
        await store.saveSettings(patch);
        if (patch.businessName && patch.businessName !== store.tenant?.name && !store.isDemo) updateTenant(store.tenantId, { name: patch.businessName, updatedAt: nowISO() }).catch(() => {});
        refreshCards(store.members).catch(() => {});
        if (s().page?.published && s().page?.slug && !store.isDemo) publishPage({ ...s().page }).catch(() => {});
        setBusy(btn, false); toast('Perfil guardado: se actualizó en el carnet de tus alumnos');
      };
      $('#s-rate').onclick = async () => { if (!(await requirePin('Cambiar el país y la moneda'))) return; if (await openCountryPicker()) location.reload(); };
      $('#s-theme').onclick = (e) => { const n = toggleTheme(); e.currentTarget.innerHTML = `${icon(n === 'dark' ? 'sun' : 'moon')} Cambiar tema`; };
    }

    if (sec === 'pagina') {
      const P = s().page || {};
      const suggested = P.slug || slugify(s().coachName || s().businessName || usernameOf(session.user?.email) || '');
      body.innerHTML = `<div class="grid-2">
        <form class="card stack" id="f-page"><div class="card-title">${icon('globe')} Tu página pública</div>
          <p class="small muted" style="margin:0">Una página con tu foto, tu perfil, tus planes y un botón de WhatsApp para compartir en Instagram o en tu estado. Los interesados te escriben directo.</p>
          ${store.isDemo ? `<div class="box small box-warn">${icon('info')} En la demo no se publican páginas. Mira el ejemplo con «Vista previa».</div>` : ''}
          <div class="photo-pick" data-pp>${P.photo ? `<span class="avatar avatar-xl has-img"><img src="${P.photo}" alt=""></span>` : `<span class="avatar avatar-xl">${icon('camera')}</span>`}<label class="btn btn-secondary btn-sm">${icon('camera')} Tu foto<input type="file" accept="image/*" data-file hidden></label></div>
          <div class="field"><label>Dirección de tu página</label><div class="input-group"><span class="prefix">/coach/</span><input class="input" name="slug" value="${esc(suggested)}" maxlength="30" autocapitalize="off" spellcheck="false"></div><span class="hint">Solo letras, números y guiones.</span></div>
          <label class="check"><input type="checkbox" name="showPrices" ${P.showPrices !== false ? 'checked' : ''}> <span>Mostrar mis planes y precios</span></label>
          <label class="check"><input type="checkbox" name="published" ${P.published || !P.slug ? 'checked' : ''}> <span>Página visible</span></label>
          <div class="error-msg" data-err></div>
          <div class="row row-wrap"><button class="btn btn-primary" ${store.isDemo ? 'disabled' : ''}>${icon('check')} ${P.slug ? 'Actualizar página' : 'Publicar página'}</button><button type="button" class="btn btn-secondary" data-prev>${icon('eye')} Vista previa</button></div>
        </form>
        <div class="card stack center" style="align-items:center"><div class="card-title">${icon('qr')} Comparte tu página</div>
          ${P.slug && P.published ? `<img class="qr-img lg" data-qr alt="QR de tu página"><div class="mono small">${esc(pageUrl(P.slug))}</div>
            <div class="row row-wrap" style="justify-content:center"><button class="btn btn-secondary btn-sm" data-copy>${icon('copy')} Copiar enlace</button><a class="btn btn-secondary btn-sm" href="${pageUrl(P.slug)}" target="_blank" rel="noopener">${icon('eye')} Abrir</a><button class="btn btn-whatsapp btn-sm" data-share>${icon('whatsapp')} Compartir</button></div>`
            : emptyState('globe', 'Aún no publicada', 'Publícala para obtener tu enlace y tu código QR.')}
        </div></div>`;
      let photo = null;
      body.querySelector('[data-file]').onchange = async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        try { photo = await compressImage(f, 360, 0.78); body.querySelector('[data-pp] .avatar').outerHTML = `<span class="avatar avatar-xl has-img"><img src="${photo}" alt=""></span>`; } catch (_) { toast('No se pudo leer la imagen', 'warning'); }
      };
      if (P.slug && P.published) qrDataURL(pageUrl(P.slug), 5).then((src) => { const i = body.querySelector('[data-qr]'); if (i) i.src = src; });
      body.querySelector('[data-copy]')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(pageUrl(P.slug)); toast('Enlace copiado'); } catch (_) { toast(pageUrl(P.slug), 'info', 6000); } });
      body.querySelector('[data-share]')?.addEventListener('click', () => window.open('https://wa.me/?text=' + encodeURIComponent(`💪 ¿Quieres entrenar conmigo? Aquí están mis planes y mi contacto:\n${pageUrl(P.slug)}`), '_blank', 'noopener'));
      body.querySelector('[data-prev]').onclick = async () => { const { previewPage } = await import('./coach.js'); previewPage(photo || P.photo || ''); };
      $('#f-page').onsubmit = async (e) => {
        e.preventDefault(); if (store.isDemo) return;
        const F = e.target.elements; const err = body.querySelector('[data-err]'); err.textContent = '';
        const btn = e.target.querySelector('.btn-primary'); setBusy(btn, true, 'Publicando…');
        try { await publishPage({ slug: F.slug.value, published: F.published.checked, showPrices: F.showPrices.checked, photo: photo || '' }); toast('¡Página publicada!'); render(); }
        catch (ex) { err.textContent = ex.message; setBusy(btn, false); }
      };
    }

    if (sec === 'planes') {
      const plans = s().plans; const svcs = s().services || [];
      body.innerHTML = `<div class="card stack">
        <div class="between row-wrap"><div><div class="card-title">${icon('ticket')} Tus planes</div><p class="small muted" style="margin:4px 0 0">Paquetes de sesiones (8, 12, 20), mensualidad ilimitada, sesión suelta, asesoría online o en pareja.</p></div><button class="btn btn-primary" id="p-add">${icon('plus')} Nuevo plan</button></div>
        <div class="list">${plans.map((p) => `<div class="list-item" style="${p.active === false ? 'opacity:.5' : ''}"><span class="plan-dot" style="background:${p.color || 'var(--brand)'}"></span><div class="grow" style="min-width:0"><b class="ellipsis">${esc(p.name)}${p.popular ? ' <span class="badge badge-success">Más vendido</span>' : ''}${p.online ? ' <span class="badge badge-info">Online</span>' : ''}${p.withDiet ? ' <span class="badge badge-warning">+ Alimenticio</span>' : ''}${p.withNutri ? ' <span class="badge badge-violet">+ Nutrición</span>' : ''}${p.active === false ? ' <span class="badge badge-neutral">Inactivo</span>' : ''}</b><div class="t-sub">${esc(PLAN_KINDS[p.kind]?.label || '')} · ${esc(planDuration(p))}${p.kind === 'sesiones' ? ` · ${p.visits} sesiones · ${usd(p.price / (p.visits || 1))} c/u` : ''}${p.freezeDays ? ` · pausa hasta ${p.freezeDays} días` : ''}</div></div><b class="num">${usd(p.price)}</b><button class="btn btn-ghost btn-sm" data-ep="${esc(p.id)}" aria-label="Editar">${icon('edit')}</button></div>`).join('')}</div>
      </div>
      <div class="grid-2 mt-lg">
        <form class="card stack" id="f-enroll"><div class="card-title">${icon('userPlus')} Inscripción</div>
          <div class="field"><label>Costo de inscripción (${esc(loc().sym)})</label><input class="input" name="enrollFee" inputmode="decimal" value="${num(s().access.enrollFee || 0, loc().dec)}"><span class="hint">Se cobra con el primer plan. 0 = sin inscripción.</span></div>
          <div class="field"><label>Se vuelve a cobrar si estuvo vencido más de (días)</label><input class="input" name="reenrollDays" inputmode="numeric" value="${esc(s().access.reenrollDays ?? 60)}"></div>
          <button class="btn btn-primary">${icon('check')} Guardar</button></form>
        <div class="card stack"><div class="between"><div class="card-title">${icon('star')} Servicios extra</div><button class="btn btn-ghost btn-sm" id="sv-add">${icon('plus')} Agregar</button></div>
          <p class="small muted" style="margin:0">Se cobran en <b>Cobros › Cobro libre</b>: evaluación, plan de alimentación, recargo a domicilio…</p>
          ${svcs.length ? `<div class="list">${svcs.map((x, i) => `<div class="list-item"><div class="grow"><b>${esc(x.name)}</b></div><b class="num">${usd(x.price)}</b><button class="btn btn-ghost btn-sm" data-sv="${i}" aria-label="Editar">${icon('edit')}</button></div>`).join('')}</div>` : emptyState('star', 'Sin servicios')}</div>
      </div>`;
      $('#p-add').onclick = () => planForm();
      body.querySelectorAll('[data-ep]').forEach((b) => b.onclick = () => planForm(plans.find((p) => p.id === b.dataset.ep)));
      $('#f-enroll').onsubmit = async (e) => {
        e.preventDefault(); const F = e.target.elements;
        await store.saveSettings({ access: { ...s().access, enrollFee: round2(parseNum(F.enrollFee.value)), reenrollDays: Math.max(0, Math.round(parseNum(F.reenrollDays.value))) } });
        toast('Inscripción guardada');
      };
      $('#sv-add').onclick = () => serviceForm(null);
      body.querySelectorAll('[data-sv]').forEach((b) => b.onclick = () => serviceForm(Number(b.dataset.sv)));
    }

    if (sec === 'agenda') {
      const A = s().agenda; const a = s().access;
      body.innerHTML = `<form class="card stack" id="f-ag"><div class="card-title">${icon('calendar')} Tu horario de trabajo</div>
        <div class="form-grid form-grid-3">
          <div class="field"><label>Desde</label><input class="input" type="time" name="start" value="${esc(A.start)}"></div>
          <div class="field"><label>Hasta</label><input class="input" type="time" name="end" value="${esc(A.end)}"></div>
          <div class="field"><label>Duración de cada sesión</label><select class="select" name="minutes">${[30, 45, 60, 75, 90].map((v) => `<option value="${v}" ${Number(A.minutes) === v ? 'selected' : ''}>${v} min</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Días que trabajas</label><div class="chips">${WEEK.map((d) => `<label class="chip ${(A.days || []).includes(d) ? 'on' : ''}"><input type="checkbox" name="d${d}" ${(A.days || []).includes(d) ? 'checked' : ''} hidden>${DAYS_SHORT[d]}</label>`).join('')}</div></div>
        <div class="card-title mt">${icon('shieldCheck')} Reglas</div>
        <div class="form-grid">
          <div class="field"><label>Días de gracia tras el vencimiento</label><input class="input" name="graceDays" inputmode="numeric" value="${esc(a.graceDays ?? 0)}"><span class="hint">Puede entrenar con aviso estos días.</span></div>
          <div class="field"><label>Avisar «por vencer» desde (días antes)</label><input class="input" name="remindDays" inputmode="numeric" value="${esc(s().remindDays ?? 5)}"></div>
          <div class="field"><label>Avisar «pocas sesiones» cuando queden</label><input class="input" name="lowSessions" inputmode="numeric" value="${esc(a.lowSessions ?? 2)}"></div>
          <div class="field"><label>«No ha venido» después de (días)</label><input class="input" name="inactiveDays" inputmode="numeric" value="${esc(a.inactiveDays ?? 10)}"></div>
          <div class="field"><label>Reevaluar cada (días)</label><input class="input" name="reevalDays" inputmode="numeric" value="${esc(a.reevalDays ?? 30)}"></div>
        </div>
        <label class="check box box-white"><span class="switch"><input type="checkbox" name="noShowConsumes" ${a.noShowConsumes !== false ? 'checked' : ''}><span></span></span><span><b>Si falta sin avisar, se descuenta la sesión</b><br><small class="muted">Si cancela a tiempo («Canceló») nunca se descuenta.</small></span></label>
        <div class="row" style="justify-content:flex-end"><button class="btn btn-primary">${icon('check')} Guardar</button></div></form>`;
      body.querySelectorAll('label.chip input').forEach((i) => i.onchange = () => i.parentElement.classList.toggle('on', i.checked));
      $('#f-ag').onsubmit = async (e) => {
        e.preventDefault(); const F = e.target.elements; const n = (k) => Math.max(0, Math.round(parseNum(F[k].value)) || 0);
        if (F.start.value >= F.end.value) { toast('La hora de inicio debe ser antes de la de cierre.', 'warning'); return; }
        await store.saveSettings({ remindDays: n('remindDays'), agenda: { start: F.start.value, end: F.end.value, minutes: Number(F.minutes.value), days: WEEK.filter((d) => F['d' + d].checked) },
          access: { ...a, graceDays: n('graceDays'), lowSessions: n('lowSessions'), inactiveDays: n('inactiveDays') || 10, reevalDays: n('reevalDays') || 30, noShowConsumes: F.noShowConsumes.checked } });
        toast('Agenda y reglas guardadas');
      };
    }

    if (sec === 'mensajes') {
      const keys = Object.keys(DEFAULT_MSGS);
      let k = params.msg && DEFAULT_MSGS[params.msg] ? params.msg : keys[0];
      body.innerHTML = `<div class="msg-ed">
        <div class="card card-flush msg-list">${keys.map((x) => `<button class="msg-k" data-k="${x}">${icon('whatsapp')}<span class="grow">${esc(DEFAULT_MSGS[x].label)}</span>${s().msgs?.[x] ? '<span class="badge badge-brand">Editado</span>' : ''}</button>`).join('')}</div>
        <div class="card stack"><div class="between"><div class="card-title" data-title></div><button class="btn btn-ghost btn-sm" data-reset>${icon('refresh')} Original</button></div>
          <textarea class="textarea" data-t rows="9"></textarea>
          <div class="chips chips-wrap">${MSG_VARS.map((v) => `<button type="button" class="chip chip-xs" data-v="${v}">{${v}}</button>`).join('')}</div>
          <div class="small muted">Vista previa (alumno de ejemplo):</div><div class="wa-preview" data-prev></div>
          <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" data-save>${icon('check')} Guardar mensaje</button></div></div></div>`;
      const ta = body.querySelector('[data-t]');
      const prev = () => { body.querySelector('[data-prev]').innerHTML = esc(memberMessage(k, { member: SAMPLE, session: { date: new Date(Date.now() + 864e5).toISOString().slice(0, 10), time: '07:00', place: s().places?.[0] || '' }, text: ta.value })).replace(/\n/g, '<br>').replace(/\*([^*\n]+)\*/g, '<b>$1</b>'); };
      const pick = (x) => { k = x; body.querySelectorAll('[data-k]').forEach((b) => b.classList.toggle('on', b.dataset.k === k)); body.querySelector('[data-title]').textContent = DEFAULT_MSGS[k].label; ta.value = store.msg(k); prev(); };
      body.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => pick(b.dataset.k));
      body.querySelectorAll('[data-v]').forEach((b) => b.onclick = () => { const p = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, p) + `{${b.dataset.v}}` + ta.value.slice(ta.selectionEnd ?? p); ta.focus(); prev(); });
      ta.oninput = prev;
      body.querySelector('[data-reset]').onclick = () => { ta.value = DEFAULT_MSGS[k].text; prev(); };
      body.querySelector('[data-save]').onclick = async () => { const msgs = { ...(s().msgs || {}) }; if (ta.value.trim() === DEFAULT_MSGS[k].text) delete msgs[k]; else msgs[k] = ta.value; await store.saveSettings({ msgs }); toast('Mensaje guardado'); render(); pick(k); };
      pick(k);
    }

    if (sec === 'recibos') {
      body.innerHTML = `<form class="card stack" id="f-docs">
        <div class="form-grid">
          <div class="field"><label>Título del recibo</label><input class="input" name="docTitle" value="${esc(s().docTitle || 'RECIBO')}"><span class="hint">Ej.: RECIBO, NOTA DE COBRO.</span></div>
          <div class="field"><label>Formato</label><select class="select" name="receiptFormat">${[['80mm', 'Ticket 80 mm'], ['58mm', 'Ticket 58 mm'], ['carta', 'Hoja carta']].map(([v, l]) => `<option value="${v}" ${s().receiptFormat === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field"><label>Prefijo de numeración</label><input class="input" name="invoicePrefix" value="${esc(s().invoicePrefix || 'R')}" maxlength="4"></div>
          <div class="field"><label>Impuesto incluido en los precios (%)</label><input class="input" name="iva" inputmode="decimal" value="${num(s().iva || 0, 0)}"><span class="hint">0 para no mostrarlo.</span></div>
          <div class="field full"><label>Mensaje al pie del recibo</label><input class="input" name="receiptFooter" value="${esc(s().receiptFooter || '')}"></div>
        </div>
        <div class="row" style="justify-content:flex-end"><button class="btn btn-primary">${icon('check')} Guardar</button></div></form>`;
      $('#f-docs').onsubmit = async (e) => {
        e.preventDefault(); const F = e.target.elements;
        await store.saveSettings({ docTitle: F.docTitle.value.trim().toUpperCase() || 'RECIBO', receiptFormat: F.receiptFormat.value, invoicePrefix: F.invoicePrefix.value.trim().toUpperCase() || 'R', iva: parseNum(F.iva.value), receiptFooter: F.receiptFooter.value.trim() });
        toast('Recibos guardados');
      };
    }

    if (sec === 'moneda') { body.innerHTML = fxSectionHTML(); bindFxSection(body, render); }

    if (sec === 'seguridad') {
      body.innerHTML = `<div class="grid-2">
        <form class="card stack" id="f-pin"><div class="card-title">${icon('lock')} PIN de administrador</div><p class="small muted" style="margin:0">Protege reportes, anulaciones, ajustes de planes, autorizar sesiones sin plan, descargar respaldos y cambiar el país.</p>
          <div class="field"><label>Nuevo PIN (4 a 12 dígitos)</label><input class="input" name="pin" type="password" inputmode="numeric" maxlength="12" autocomplete="new-password"></div>
          <div class="field"><label>Repetir PIN</label><input class="input" name="pin2" type="password" inputmode="numeric" maxlength="12" autocomplete="new-password"></div>
          <button class="btn btn-primary">${icon('check')} Cambiar PIN</button></form>
        ${session.user?.isAnonymous ? `<div class="card stack"><div class="card-title">${icon('shield')} Contraseña</div><p class="muted" style="margin:0">En la demo no hay contraseña. Contrata SanoEntrenador para tener tu propia cuenta.</p><a class="btn btn-whatsapp" href="${salesWa()}" target="_blank" rel="noopener">${icon('whatsapp')} ${SALES_PHONE_FMT}</a></div>`
          : `<form class="card stack" id="f-pass"><div class="card-title">${icon('shield')} Contraseña de acceso</div>
          <div class="field"><label>Contraseña actual</label><input class="input" name="cur" type="password" autocomplete="current-password"></div>
          <div class="field"><label>Nueva contraseña (mínimo 8)</label><input class="input" name="next" type="password" autocomplete="new-password"></div>
          <div class="error-msg" data-err></div>
          <button class="btn btn-primary">${icon('check')} Cambiar contraseña</button></form>`}
      </div>
      <div class="box small mt-lg">${icon('shieldCheck')} Los datos de tus alumnos solo son visibles con tu usuario. El carnet de cada alumno es privado: solo lo abre quien tiene su código, y muestra su plan, su rutina y su propio progreso.</div>`;
      $('#f-pin').onsubmit = async (e) => {
        e.preventDefault(); const F = e.target.elements;
        if (store.isDemo) { toast('En la demo el PIN siempre es 1234.', 'info'); return; }
        if (!/^\d{4,12}$/.test(F.pin.value)) { toast('El PIN debe tener de 4 a 12 dígitos', 'warning'); return; }
        if (F.pin.value !== F.pin2.value) { toast('Los PIN no coinciden', 'warning'); return; }
        if (store.hasPin() && !(await requirePin('Cambiar el PIN'))) return;
        await store.setPin(F.pin.value); e.target.reset(); toast('PIN actualizado');
      };
      const fp = $('#f-pass');
      if (fp) fp.onsubmit = async (e) => {
        e.preventDefault(); const F = e.target.elements; const err = fp.querySelector('[data-err]'); err.textContent = '';
        if (F.next.value.length < 8) { err.textContent = 'La nueva contraseña debe tener al menos 8 caracteres.'; return; }
        const btn = fp.querySelector('button'); setBusy(btn, true);
        try { await changePassword(F.cur.value, F.next.value); e.target.reset(); toast('Contraseña actualizada'); }
        catch (ex) { err.textContent = authErrorMessage(ex); }
        setBusy(btn, false);
      };
    }

    if (sec === 'apps') {
      body.innerHTML = `<div class="grid-2">
        <div class="card stack"><div class="card-title">${icon('install')} Instalar la app</div>
          <p class="small muted" style="margin:0">Llévala en tu teléfono como una app más: agenda, alumnos y WhatsApp a un toque, incluso entre sesión y sesión.</p>
          ${isStandalone() ? `<div class="pay-status ok"><span>${icon('check')} Estás usando la app instalada</span><span></span></div>` : `<button class="btn btn-primary btn-lg" data-install>${icon('install')} Instalar en este equipo</button>`}
          <div class="list">
            <div class="list-item"><span class="kpi-icon tone-success" style="width:34px;height:34px">${icon('phone')}</span><div class="grow"><b>Android</b><div class="t-sub">Chrome › menú ⋮ › Instalar app</div></div></div>
            <div class="list-item"><span class="kpi-icon tone-violet" style="width:34px;height:34px">${icon('phone')}</span><div class="grow"><b>iPhone / iPad</b><div class="t-sub">Safari › Compartir › Agregar a inicio</div></div></div>
            <div class="list-item"><span class="kpi-icon tone-info" style="width:34px;height:34px">${icon('laptop')}</span><div class="grow"><b>Computadora</b><div class="t-sub">Chrome o Edge › ícono de instalar en la barra de direcciones</div></div></div>
          </div>
          <div class="box small">${icon('qr')} <b>Tus alumnos también la instalan:</b> al abrir su carnet pueden agregarlo a su pantalla de inicio y ver su rutina y su progreso como una app.</div></div>
        <div class="card stack"><div class="card-title">${icon('download')} Respaldo de datos</div>
          <p class="small muted" style="margin:0">Descarga una copia de tus alumnos, planes, sesiones, asistencias, rutinas, evaluaciones, cobros, avisos y configuración (archivo JSON). Protegido con PIN.</p>
          <button class="btn btn-secondary" id="s-backup">${icon('download')} Descargar respaldo completo</button>
          <div class="divider"></div>
          <div class="card-title">${icon('whatsapp')} Soporte</div>
          <p class="small muted" style="margin:0">¿Dudas o sugerencias? Escríbenos.</p>
          <a class="btn btn-whatsapp" href="${salesWa('Hola, necesito soporte con SanoEntrenador.')}" target="_blank" rel="noopener">${icon('whatsapp')} ${SALES_PHONE_FMT}</a></div>
      </div>`;
      bindInstallButtons(body);
      $('#s-backup').onclick = async (e) => {
        const btn = e.currentTarget;
        if (!(await requirePin('Descargar el respaldo'))) return;
        setBusy(btn, true, 'Preparando…');
        try {
          const { getDocs } = await import('../firebase.js');
          const names = ['memberships', 'sessions', 'checkins', 'routines', 'diets', 'nutris', 'evaluations', 'sales', 'reminders'];
          const all = async (n) => (await getDocs(store.col(n))).docs.map((d) => ({ id: d.id, ...d.data() }));
          const got = await Promise.all(names.map(all));
          const data = { app: 'SanoEntrenador', exportedAt: nowISO(), business: store.businessName, settings: store.settings, members: store.members };
          names.forEach((n, i) => { data[n] = got[i]; });
          download(`respaldo-${(store.businessName || 'sano-entrenador').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
          toast('Respaldo descargado');
        } catch (ex) { toast('No se pudo generar el respaldo: ' + ex.message, 'danger'); }
        setBusy(btn, false);
      };
    }
  }

  // ---------- Planes ----------
  function planForm(p = null) {
    const x = p || { id: '', name: '', kind: 'sesiones', months: 1, days: 0, visits: 12, price: 0, color: PLAN_COLORS[0], freezeDays: 7 };
    const unit = Number(x.months) > 0 ? 'months' : 'days';
    const m = openModal({
      title: p ? 'Editar plan' : 'Nuevo plan', size: 'md',
      body: `<form class="stack" data-f><div class="form-grid">
        <div class="field full"><label>Nombre *</label><input class="input" name="name" value="${esc(x.name)}" placeholder="Ej.: 12 sesiones, Mensual ilimitado, Online" autofocus></div>
        <div class="field"><label>Tipo</label><select class="select" name="kind">${Object.entries(PLAN_KINDS).map(([k, v]) => `<option value="${k}" ${x.kind === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
        <div class="field"><label>Precio (${esc(loc().sym)}) *</label><input class="input" name="price" inputmode="decimal" value="${num(x.price || 0, loc().dec)}"></div>
        <div class="field" data-k="ses"><label>Número de sesiones</label><input class="input" name="visits" inputmode="numeric" value="${esc(x.visits || 12)}"></div>
        <div class="field" data-k="dur"><label>Vigencia</label><div class="row" style="flex-wrap:nowrap"><input class="input" name="len" inputmode="numeric" value="${unit === 'months' ? x.months : x.days || 30}" style="max-width:90px"><select class="select" name="unit"><option value="months" ${unit === 'months' ? 'selected' : ''}>meses</option><option value="days" ${unit === 'days' ? 'selected' : ''}>días</option></select></div></div>
        <div class="field"><label>Días de pausa permitidos</label><input class="input" name="freezeDays" inputmode="numeric" value="${esc(x.freezeDays || 0)}"><span class="hint">Por viaje, lesión o enfermedad.</span></div>
        <div class="field"><label>Color</label><div class="row">${PLAN_COLORS.map((c) => `<label class="color-dot"><input type="radio" name="color" value="${c}" ${x.color === c ? 'checked' : ''} hidden><span style="background:${c}"></span></label>`).join('')}</div></div>
        <div class="field full"><label>Qué incluye (opcional)</label><input class="input" name="note" value="${esc(x.note || '')}" placeholder="Ej.: Rutina personalizada + evaluación mensual"></div>
      </div>
      <div class="box small"><b>${icon('plus')} Servicios incluidos</b> <span class="muted">(además del entrenamiento)</span>
        <label class="check mt"><input type="checkbox" name="withDiet" ${x.withDiet ? 'checked' : ''}> ${icon('utensils')} Incluye plan alimenticio (menú de cada día)</label>
        <label class="check"><input type="checkbox" name="withNutri" ${x.withNutri ? 'checked' : ''}> ${icon('droplet')} Incluye plan de nutrición (metas, suplementos y hábitos)</label></div>
      <label class="check"><input type="checkbox" name="online" ${x.online ? 'checked' : ''}> Plan online (rutina y seguimiento a distancia)</label>
      <label class="check"><input type="checkbox" name="popular" ${x.popular ? 'checked' : ''}> Destacar como “más vendido”</label>
      <label class="check"><input type="checkbox" name="active" ${x.active !== false ? 'checked' : ''}> Activo (se ofrece al cobrar y en tu página)</label>
      <div class="box small" data-ppu></div>
      <div class="error-msg" data-err></div></form>`,
      footer: `${p ? `<button class="btn btn-ghost text-danger" data-del>${icon('trash')} Eliminar</button>` : ''}<span class="grow"></span><button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-ok>${icon('check')} Guardar</button>`
    });
    const F = m.el.querySelector('[data-f]').elements;
    const sync = () => {
      m.el.querySelector('[data-k="ses"]').hidden = F.kind.value !== 'sesiones'; m.el.querySelector('[data-k="dur"]').hidden = F.kind.value === 'pase';
      const v = F.kind.value === 'sesiones' ? Math.max(1, parseNum(F.visits.value) || 1) : F.kind.value === 'pase' ? 1 : 0;
      const ppu = m.el.querySelector('[data-ppu]'); ppu.hidden = !v; if (v) ppu.innerHTML = `${icon('info')} Cada sesión sale en <b>${usd(parseNum(F.price.value) / v)}</b>.`;
    };
    F.kind.onchange = sync; F.visits.oninput = sync; F.price.oninput = sync; sync();
    m.el.querySelector('[data-ok]').onclick = async () => {
      const name = F.name.value.trim(); const err = m.el.querySelector('[data-err]');
      if (!name) { err.textContent = 'Escribe el nombre del plan.'; return; }
      const len = Math.max(1, Math.round(parseNum(F.len.value)) || 1);
      const plan = { ...(p || {}), id: p?.id || shortId(6), name, kind: F.kind.value, price: round2(parseNum(F.price.value)), color: F.color.value || PLAN_COLORS[0],
        months: F.kind.value !== 'pase' && F.unit.value === 'months' ? len : 0, days: F.kind.value === 'pase' ? 1 : F.unit.value === 'days' ? len : 0,
        visits: F.kind.value === 'sesiones' ? Math.max(1, Math.round(parseNum(F.visits.value)) || 1) : F.kind.value === 'pase' ? 1 : null,
        freezeDays: Math.max(0, Math.round(parseNum(F.freezeDays.value)) || 0), note: F.note.value.trim(), withDiet: F.withDiet.checked, withNutri: F.withNutri.checked, online: F.online.checked, popular: F.popular.checked, active: F.active.checked };
      const plans = p ? s().plans.map((y) => (y.id === p.id ? plan : y)) : [...s().plans, plan];
      await store.saveSettings({ plans }); m.close(); toast('Plan guardado');
      if (s().page?.published && !store.isDemo) publishPage({ ...s().page }).catch(() => {});
    };
    m.el.querySelector('[data-del]')?.addEventListener('click', async () => {
      const used = store.members.some((mb) => mb.membership?.planId === p.id && mb.active !== false);
      if (!(await confirmDialog({ title: 'Eliminar plan', message: used ? `Hay alumnos con el plan “${p.name}”. Sus planes actuales no cambian, pero ya no podrás venderlo. ¿Eliminar?` : `¿Eliminar el plan “${p.name}”?`, confirmText: 'Eliminar', danger: true }))) return;
      await store.saveSettings({ plans: s().plans.filter((y) => y.id !== p.id) }); m.close(); toast('Plan eliminado');
    });
  }

  async function serviceForm(i) {
    const svcs = [...(s().services || [])]; const x = i == null ? { name: '', price: 0 } : svcs[i];
    const m = openModal({
      title: i == null ? 'Nuevo servicio' : 'Editar servicio', size: 'sm',
      body: `<form class="stack" data-f><div class="field"><label>Nombre</label><input class="input" name="name" value="${esc(x.name)}" autofocus></div><div class="field"><label>Precio (${esc(loc().sym)})</label><input class="input" name="price" inputmode="decimal" value="${num(x.price || 0, loc().dec)}"></div></form>`,
      footer: `${i != null ? `<button class="btn btn-ghost text-danger" data-del>${icon('trash')}</button>` : `<button class="btn btn-ghost" data-def>Restaurar sugeridos</button>`}<span class="grow"></span><button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-ok>Guardar</button>`
    });
    const F = m.el.querySelector('[data-f]').elements;
    m.el.querySelector('[data-ok]').onclick = async () => {
      if (!F.name.value.trim()) return;
      const item = { name: F.name.value.trim(), price: round2(parseNum(F.price.value)) };
      if (i == null) svcs.push(item); else svcs[i] = item;
      await store.saveSettings({ services: svcs }); m.close(); toast('Servicio guardado');
    };
    m.el.querySelector('[data-del]')?.addEventListener('click', async () => { svcs.splice(i, 1); await store.saveSettings({ services: svcs }); m.close(); });
    m.el.querySelector('[data-def]')?.addEventListener('click', async () => { await store.saveSettings({ services: DEFAULT_SERVICES.map((y) => ({ ...y, price: scaleUSD(y.price) })) }); m.close(); toast('Servicios sugeridos restaurados'); });
  }

  el.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { sec = b.dataset.s; render(); });
  render();
  return store.on('*', (evt) => { if (evt === 'settings' && sec === 'planes') render(); });
}
