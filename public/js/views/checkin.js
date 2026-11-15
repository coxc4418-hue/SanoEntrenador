// SanoEntrenador — Asistencia: escanear el carnet (cámara o lector), buscar alumno y sesiones de hoy
import { store, memberStatus, statusBadge } from '../store.js';
import { esc, normalize, debounce, emptyState, fmtAgo, todayKey } from '../utils.js';
import { icon } from '../icons.js';
import { avatar, hydratePhotos, openMember } from '../member.js';
import { doCheckin, scanQR, cameraScanSupported } from '../access.js';
import { membershipLine } from '../membership.js';
import { sessionRowHTML, bindSessionRows } from './agenda.js';

export function mount(el) {
  el.innerHTML = `
    <div class="view-header"><div><h1 class="view-title">Asistencia</h1><p class="view-sub">Escanea el QR del carnet del alumno o búscalo por nombre</p></div></div>
    <div class="grid-main">
      <div class="stack">
        <div class="card scan-card" data-tour="scan">
          <button class="scan-hero" data-cam>${icon('camera')}<b>Escanear carnet con la cámara</b><span>Apunta al QR del teléfono del alumno</span></button>
          <div class="auth-or"><span>o escribe</span></div>
          <label class="search search-big">${icon('search')}<input data-q placeholder="Nombre, N° de alumno, código del carnet o documento" autocomplete="off" inputmode="search"></label>
          <p class="hint">Con un lector USB de códigos QR se registra solo: el lector escribe el código y Enter.</p>
          <div data-res class="mt"></div>
        </div>
        <div class="card"><div class="card-head"><div class="card-title">${icon('calendar')} Sesiones de hoy</div><span class="small muted" data-cnt></span></div><div data-today class="stack"></div></div>
      </div>
      <div class="stack"><div class="card card-flush"><div class="card-head" style="padding:16px 18px 0"><div class="card-title">${icon('userCheck')} Asistencias de hoy</div></div><div data-feed></div></div></div>
    </div>`;
  const $ = (s) => el.querySelector(s);
  const input = $('[data-q]');
  const go = async (m) => { input.value = ''; $('[data-res]').innerHTML = ''; await doCheckin(m, { via: 'qr' }); input.focus(); };
  const search = () => {
    const v = input.value.trim(); const t = normalize(v);
    if (!t) { $('[data-res]').innerHTML = ''; return; }
    const exact = store.findMember(v);
    const list = exact ? [exact] : store.members.filter((m) => m.active !== false && normalize(`${m.name} ${m.phone || ''} ${m.number}`).includes(t)).slice(0, 8);
    $('[data-res]').innerHTML = list.length ? `<div class="list">${list.map((m) => `<button class="list-item" data-pick="${m.id}">${avatar(m)}<div class="grow" style="min-width:0"><b class="ellipsis">${esc(m.name)}</b><div class="t-sub">${membershipLine(m)}</div></div>${statusBadge(memberStatus(m))}</button>`).join('')}</div>` : emptyState('search', 'Sin resultados', 'Revisa el nombre o el código.');
    el.querySelectorAll('[data-pick]').forEach((b) => b.onclick = () => go(store.member(b.dataset.pick)));
    hydratePhotos($('[data-res]'));
  };
  input.oninput = debounce(search, 90);
  input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); const m = store.findMember(input.value); if (m) go(m); else search(); } };
  $('[data-cam]').onclick = async () => {
    if (!cameraScanSupported()) { input.focus(); const { toast } = await import('../utils.js'); toast('Este navegador no permite leer QR con la cámara. Usa Chrome en Android o escribe el código.', 'warning', 5000); return; }
    const code = await scanQR();
    if (!code) return;
    const m = store.findMember(code);
    if (m) go(m); else { input.value = code; search(); }
  };
  function today() {
    const list = store.todaySessions.slice().sort((a, b) => a.time.localeCompare(b.time));
    $('[data-cnt]').textContent = `${list.length} sesión(es)`;
    $('[data-today]').innerHTML = list.length ? list.map((s) => sessionRowHTML(s, { compact: true })).join('') : '<div class="small muted">Sin sesiones agendadas hoy. Igual puedes marcar asistencia: se registra como sesión fuera de agenda.</div>';
    bindSessionRows($('[data-today]'), () => store.sessions, today);
  }
  function feed() {
    const list = store.todayCheckins;
    $('[data-feed]').innerHTML = list.length ? `<div class="list" style="padding:6px 10px 10px">${list.map((c) => { const m = store.member(c.memberId); return `<button class="list-item" data-m="${c.memberId}">${avatar(m || { name: c.memberName })}<div class="grow" style="min-width:0"><b class="ellipsis">${esc(c.memberName)}</b><div class="t-sub">${esc(c.planName || '')}${c.sessionId ? '' : ' · fuera de agenda'}${m?.membership?.kind === 'sesiones' ? ` · quedan ${m.membership.visitsLeft ?? 0}` : ''}</div></div><span class="t-sub">${fmtAgo(c.date)}</span></button>`; }).join('')}</div>`
      : `<div style="padding:14px">${emptyState('userCheck', 'Aún no hay asistencias hoy')}</div>`;
    el.querySelectorAll('[data-feed] [data-m]').forEach((b) => b.onclick = () => openMember(b.dataset.m));
    hydratePhotos($('[data-feed]'), 30);
  }
  today(); feed();
  setTimeout(() => input.focus(), 60);
  const off = store.on('*', (evt) => { if (evt === 'checkins') feed(); if (evt === 'sessions' || evt === 'members') { today(); feed(); } });
  return () => off();
}
export { todayKey };
