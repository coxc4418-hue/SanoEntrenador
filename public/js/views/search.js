// SanoEntrenador — Búsqueda global (Ctrl + K): alumnos, recibos y rutinas
import { store, memberStatus, statusBadge } from '../store.js';
import { openModal, esc, usd, normalize, debounce, fmtDate, fmtAgo } from '../utils.js';
import { icon } from '../icons.js';
import { avatar, hydratePhotos } from '../member.js';
import { membershipLine } from '../membership.js';

export function openSearch() {
  if (document.querySelector('.search-modal')) return;
  const m = openModal({
    size: 'lg',
    body: `<div class="search search-big">${icon('search')}<input data-q placeholder="Alumno, teléfono, N° (A-0012), código del carnet, recibo (R-000045) o rutina…" autofocus autocomplete="off"><kbd>Esc</kbd></div><div data-res class="search-results"></div>`
  });
  m.el.querySelector('.modal').classList.add('search-modal');
  const input = m.el.querySelector('[data-q]');
  const res = m.el.querySelector('[data-res]');
  let token = 0;

  async function run() {
    const raw = input.value.trim();
    const t = normalize(raw);
    const digits = raw.replace(/\D/g, '');
    const my = ++token;
    if (!t) { res.innerHTML = hint(); bind(); return; }
    const exact = store.findMember(raw);
    const mems = [...(exact ? [exact] : []), ...store.members.filter((p) => p !== exact && (normalize(`${p.name} ${p.number} ${p.email || ''} ${p.goal || ''}`).includes(t)
      || (digits.length >= 3 && (`${p.idDoc || ''}`.replace(/\D/g, '').includes(digits) || `${p.phone || ''}`.replace(/\D/g, '').includes(digits)))))].slice(0, 8);
    const sales = store.recentSales.filter((s) => normalize(`${s.number} ${s.memberName}`).includes(t)).slice(0, 5);
    const tpls = store.templates.filter((r) => normalize(r.name).includes(t)).slice(0, 4);
    draw(mems, sales, tpls);
    const up = raw.toUpperCase().replace(/\s/g, '');
    const pre = (store.settings.invoicePrefix || 'R').toUpperCase();
    if (!new RegExp(`^${pre}-?\\d+$`).test(up)) return;
    const num = `${pre}-` + up.replace(/\D/g, '').padStart(6, '0');
    let found = [];
    try { found = await store.listEq('sales', 'number', num); } catch (_) {}
    if (my !== token) return;
    const extra = found.filter((s) => !sales.some((x) => x.id === s.id));
    if (extra.length) draw(mems, [...extra, ...sales], tpls);
  }

  function draw(mems, sales, tpls) {
    res.innerHTML = (mems.length || sales.length || tpls.length) ? `
      ${mems.length ? `<div class="section-title">Alumnos</div>${mems.map((p) => `<button class="sitem" data-m="${p.id}">${avatar(p)}<span class="grow"><b>${esc(p.name)}</b><small>${esc(p.number)} · ${membershipLine(p)}</small></span>${statusBadge(memberStatus(p))}</button>`).join('')}` : ''}
      ${sales.length ? `<div class="section-title">Recibos</div>${sales.map((s) => `<button class="sitem" data-s="${s.id}"><span class="kpi-icon tone-violet" style="width:36px;height:36px">${icon('receipt')}</span><span class="grow"><b>${esc(s.number)} · ${esc(s.memberName)}</b><small>${fmtDate(s.date)} · ${esc((s.items || []).map((i) => i.name).join(' + ')).slice(0, 80)}</small></span><b>${usd(s.total)}</b></button>`).join('')}` : ''}
      ${tpls.length ? `<div class="section-title">Plantillas de rutina</div>${tpls.map((r) => `<button class="sitem" data-r="${r.id}"><span class="kpi-icon tone-brand" style="width:36px;height:36px">${icon('dumbbell')}</span><span class="grow"><b>${esc(r.name)}</b><small>${(r.days || []).length} día(s)${r.goal ? ' · ' + esc(r.goal) : ''}</small></span></button>`).join('')}` : ''}`
      : `<div class="empty">${icon('search')}<b>Sin resultados</b><span>Para recibos antiguos escribe el número exacto (ej. R-000045).</span></div>`;
    bind();
  }

  function hint() {
    const list = store.members.filter((p) => p.lastCheckinAt).sort((a, b) => b.lastCheckinAt.localeCompare(a.lastCheckinAt)).slice(0, 6);
    return list.length ? `<div class="section-title">Entrenaron recientemente</div>${list.map((p) => `<button class="sitem" data-m="${p.id}">${avatar(p)}<span class="grow"><b>${esc(p.name)}</b><small>${fmtAgo(p.lastCheckinAt)} · ${membershipLine(p)}</small></span>${statusBadge(memberStatus(p))}</button>`).join('')}`
      : `<div class="empty">${icon('search')}<b>Busca en todo</b><span>Alumnos, recibos y rutinas.</span></div>`;
  }

  function bind() {
    hydratePhotos(res, 14);
    res.querySelectorAll('[data-m]').forEach((b) => b.onclick = async () => { m.close(); (await import('../member.js')).openMember(b.dataset.m); });
    res.querySelectorAll('[data-s]').forEach((b) => b.onclick = async () => { m.close(); (await import('../main.js')).navigate('cobros'); });
    res.querySelectorAll('[data-r]').forEach((b) => b.onclick = async () => { m.close(); (await import('../main.js')).navigate('rutinas'); });
  }

  input.oninput = debounce(run, 140);
  input.onkeydown = (e) => { if (e.key === 'Enter') { const first = res.querySelector('.sitem'); if (first) first.click(); } };
  res.innerHTML = hint(); bind();
}
