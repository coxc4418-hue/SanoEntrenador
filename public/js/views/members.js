// SanoEntrenador — Alumnos: lista con filtros, búsqueda, avances y exportación
import { store, memberStatus, statusBadge, MEMBER_STATUS } from '../store.js';
import { esc, usd, num, normalize, debounce, emptyState, toCSV, download, fmtDate, todayKey } from '../utils.js';
import { icon } from '../icons.js';
import { avatar, hydratePhotos, openMember, memberForm } from '../member.js';
import { membershipLine } from '../membership.js';
import { composeWa } from '../shared.js';

const FILTERS = [
  ['todos', 'Todos'], ['activo', 'Activos'], ['por_vencer', 'Por vencer'], ['vencido', 'Vencidos'], ['agotado', 'Sin sesiones'],
  ['congelado', 'Pausados'], ['deuda', 'Con deuda'], ['online', 'Online'], ['sin_plan', 'Sin plan'], ['baja', 'De baja']
];
let lastFilter = 'todos';

export function mount(el) {
  let filter = lastFilter; let q = ''; let sort = 'name'; let view = 'cards';
  try { view = localStorage.getItem('se_mview') || 'cards'; } catch (_) {}
  el.innerHTML = `
    <div class="view-header"><div><h1 class="view-title">Alumnos</h1><p class="view-sub" data-sub></p></div>
      <div class="view-actions"><button class="btn btn-ghost btn-icon" data-csv title="Exportar a Excel (CSV)" aria-label="Exportar">${icon('download')}</button><button class="btn btn-primary" data-new data-tour="new-member">${icon('userPlus')} Nuevo alumno</button></div></div>
    <div class="toolbar">
      <label class="search grow">${icon('search')}<input data-q placeholder="Buscar por nombre, teléfono, N° o documento…" autocomplete="off"></label>
      <select class="select select-sm" data-sort aria-label="Ordenar"><option value="name">A–Z</option><option value="end">Vencimiento</option><option value="last">Última sesión</option><option value="new">Más recientes</option><option value="progress">Mejor avance</option></select>
      <div class="seg" data-view><button data-v="cards" title="Tarjetas" aria-label="Tarjetas">${icon('grid')}</button><button data-v="list" title="Lista" aria-label="Lista">${icon('list')}</button></div>
    </div>
    <div class="chips chips-scroll mt" data-tour="filters" data-f></div>
    <div class="mt" data-list></div>`;
  const $ = (s) => el.querySelector(s);
  const t = todayKey();
  const match = (m, f) => {
    const st = memberStatus(m, t);
    if (f === 'todos') return m.active !== false;
    if (f === 'deuda') return m.active !== false && (Number(m.balance) || 0) > 0.009;
    if (f === 'online') return m.active !== false && !!m.membership?.online;
    return st === f;
  };
  const delta = (m) => { const h = m.evalHist || []; if (h.length < 2) return null; return Math.round(((h[h.length - 1].weight || 0) - (h[0].weight || 0)) * 10) / 10; };
  const progressScore = (m) => { const d = delta(m); if (d == null) return -999; return /masa|fuerza|músculo/i.test(m.goal || '') ? d : -d; };

  function chips() {
    $('[data-f]').innerHTML = FILTERS.map(([k, l]) => { const n = store.members.filter((m) => match(m, k)).length; return (n || k === 'todos' || k === filter) ? `<button class="chip ${k === filter ? 'on' : ''}" data-fk="${k}">${l} <span class="chip-n">${n}</span></button>` : ''; }).join('');
    el.querySelectorAll('[data-fk]').forEach((b) => b.onclick = () => { filter = lastFilter = b.dataset.fk; chips(); draw(); });
  }
  function draw() {
    const tq = normalize(q);
    let list = store.members.filter((m) => match(m, filter) && (!tq || normalize(`${m.name} ${m.phone || ''} ${m.number || ''} ${m.idDoc || ''} ${m.goal || ''}`).includes(tq)));
    if (sort === 'end') list.sort((a, b) => (a.membership?.end || '9999').localeCompare(b.membership?.end || '9999'));
    if (sort === 'last') list.sort((a, b) => (b.lastCheckinAt || '').localeCompare(a.lastCheckinAt || ''));
    if (sort === 'new') list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (sort === 'progress') list.sort((a, b) => progressScore(b) - progressScore(a));
    $('[data-sub]').textContent = `${store.activeMembers.length} activos · ${store.liveMembers.length} en total`;
    el.querySelectorAll('[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === view));
    if (!list.length) {
      $('[data-list]').innerHTML = `<div class="card">${emptyState('users', store.members.length ? 'Sin resultados' : 'Registra a tu primer alumno', store.members.length ? 'Prueba con otro filtro o búsqueda.' : 'Con su teléfono, objetivo y cuestionario de salud. Después le vendes un plan y le envías su carnet.')}</div>`;
      return;
    }
    if (view === 'list') {
      $('[data-list]').innerHTML = `<div class="card card-flush"><div class="table-wrap"><table class="table table-hover"><thead><tr><th>Alumno</th><th class="hide-sm">Plan</th><th class="hide-sm">Objetivo</th><th class="r">Avance</th><th class="c">Estado</th><th></th></tr></thead><tbody>
        ${list.map((m) => { const d = delta(m); return `<tr data-m="${m.id}"><td><div class="row" style="gap:10px">${avatar(m)}<div style="min-width:0"><b class="ellipsis">${esc(m.name)}</b><div class="t-sub">${esc(m.number)}${m.phone ? ' · ' + esc(m.phone) : ''}</div></div></div></td>
          <td class="small hide-sm">${membershipLine(m)}</td><td class="small hide-sm">${esc(m.goal || '—')}</td>
          <td class="r num">${d == null ? '<span class="faint">—</span>' : `<b class="${(/masa|fuerza|músculo/i.test(m.goal || '') ? d > 0 : d < 0) ? 'text-success' : 'text-danger'}">${d > 0 ? '+' : ''}${num(d, 1)} kg</b>`}</td>
          <td class="c">${statusBadge(memberStatus(m, t))}${(Number(m.balance) || 0) > 0.009 ? `<div class="t-sub text-danger">debe ${usd(m.balance)}</div>` : ''}</td>
          <td class="r"><button class="btn btn-whatsapp btn-icon btn-sm" data-wa="${m.id}" aria-label="WhatsApp">${icon('whatsapp')}</button></td></tr>`; }).join('')}</tbody></table></div></div>`;
    } else {
      $('[data-list]').innerHTML = `<div class="mgrid">${list.map((m) => {
        const st = memberStatus(m, t); const d = delta(m); const ms = m.membership;
        const gain = /masa|fuerza|músculo/i.test(m.goal || '');
        const pct = ms && ms.kind !== 'tiempo' && ms.visits ? Math.round(((ms.visits - (ms.visitsLeft ?? 0)) / ms.visits) * 100) : null;
        return `<div class="mtile tone-${MEMBER_STATUS[st]?.tone || 'neutral'}" data-m="${m.id}" role="button" tabindex="0">
          <div class="mtile-top">${avatar(m, 'avatar-lg')}<div class="grow" style="min-width:0"><b class="ellipsis">${esc(m.name)}</b><div class="t-sub ellipsis">${esc(m.goal || m.number)}</div></div>${statusBadge(st)}</div>
          <div class="mtile-plan">${membershipLine(m)}</div>
          ${pct != null ? `<div class="progress mt-xs" title="Sesiones usadas"><i style="width:${pct}%"></i></div>` : ''}
          <div class="mtile-foot">
            <span title="Avance de peso">${icon('trend')} ${d == null ? '<span class="faint">sin evaluación</span>' : `<b class="${(gain ? d > 0 : d < 0) ? 'text-success' : d ? 'text-danger' : ''}">${d > 0 ? '+' : ''}${num(d, 1)} kg</b>`}</span>
            ${(Number(m.balance) || 0) > 0.009 ? `<span class="text-danger small">debe ${usd(m.balance)}</span>` : m.lastCheckinAt ? `<span class="t-sub">${icon('clock')} ${fmtDate(m.lastCheckinAt).slice(0, 5)}</span>` : ''}
            <button class="btn btn-whatsapp btn-icon btn-sm" data-wa="${m.id}" aria-label="WhatsApp a ${esc(m.name)}">${icon('whatsapp')}</button>
          </div></div>`;
      }).join('')}</div>`;
    }
    el.querySelectorAll('[data-m]').forEach((r) => { r.onclick = (e) => { if (!e.target.closest('[data-wa]')) openMember(r.dataset.m); }; r.onkeydown = (e) => { if (e.key === 'Enter') openMember(r.dataset.m); }; });
    el.querySelectorAll('[data-wa]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); composeWa(store.member(b.dataset.wa)); });
    hydratePhotos($('[data-list]'), 80);
  }
  $('[data-q]').oninput = debounce((e) => { q = e.target.value; draw(); }, 100);
  $('[data-sort]').onchange = (e) => { sort = e.target.value; draw(); };
  el.querySelectorAll('[data-v]').forEach((b) => b.onclick = () => { view = b.dataset.v; try { localStorage.setItem('se_mview', view); } catch (_) {} draw(); });
  $('[data-new]').onclick = async () => { const m = await memberForm(); if (m) { const { sellModal } = await import('../membership.js'); sellModal(m); } };
  $('[data-csv]').onclick = () => {
    const rows = [['N°', 'Nombre', 'Documento', 'Teléfono', 'Correo', 'Objetivo', 'Estado', 'Plan', 'Inicio', 'Vence', 'Sesiones restantes', 'Saldo', 'Total pagado', 'Sesiones asistidas', 'Peso inicial', 'Peso actual', 'Meta']];
    store.members.forEach((m) => { const h = m.evalHist || []; rows.push([m.number, m.name, m.idDoc || '', m.phone || '', m.email || '', m.goal || '', MEMBER_STATUS[memberStatus(m)]?.label || '', m.membership?.planName || '', m.membership?.start || '', m.membership?.end || '', m.membership?.visitsLeft ?? '', m.balance || 0, m.totalSpent || 0, m.visits || 0, h[0]?.weight ?? '', h[h.length - 1]?.weight ?? '', m.goalWeight || '']); });
    download(`alumnos-${todayKey()}.csv`, '﻿' + toCSV(rows), 'text/csv;charset=utf-8');
  };
  chips(); draw();
  const off = store.on('members', () => { chips(); draw(); });
  return () => off();
}
