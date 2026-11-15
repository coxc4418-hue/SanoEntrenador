// SanoEntrenador — Rutinas: editor, biblioteca de ejercicios, plantillas e impresión
import { store } from './store.js';
import { saveRoutine, deleteRoutine } from './ops.js';
import { EXERCISES, MUSCLE_GROUPS, ROUTINE_TEMPLATES, GOALS, LEVELS, exercise } from './gym.js';
import { openModal, esc, toast, setBusy, normalize, debounce, emptyState, fmtDate, confirmDialog, promptDialog } from './utils.js';
import { icon } from './icons.js';
import { printDoc, waMember } from './shared.js';
import { guide, bodyMapHTML, exerciseSheet, generateRoutine, atHome } from './exguide.js';

const restTxt = (s) => (!s ? '' : s >= 60 ? `${Math.floor(s / 60)}′${s % 60 ? (s % 60) + '″' : ''}` : `${s}″`);
export const allTemplates = () => [...store.templates.map((t) => ({ ...t, custom: true })), ...ROUTINE_TEMPLATES];

export function routineCardHTML(r) {
  return `<div class="routine">
    <div class="routine-meta">${r.goal ? `<span class="tag">${icon('target')} ${esc(r.goal)}</span>` : ''}${r.level ? `<span class="tag">${esc(r.level)}</span>` : ''}${r.weeks ? `<span class="tag">${r.weeks} semanas</span>` : ''}${r.trainer ? `<span class="tag">${icon('user')} ${esc(r.trainer)}</span>` : ''}${r.updatedAt ? `<span class="t-sub">Actualizada ${fmtDate(r.updatedAt)}</span>` : ''}</div>
    ${r.note ? `<div class="box small">${icon('info')} ${esc(r.note)}</div>` : ''}
    <div class="routine-days">${(r.days || []).map((d) => `<div class="rday"><div class="rday-h">${icon('dumbbell')} ${esc(d.name)}</div>
      ${(d.items || []).map((x, i) => `<div class="rex"><span class="rex-n">${i + 1}</span><div class="grow"><b>${esc(x.name)}</b>${x.note ? `<div class="t-sub">${esc(x.note)}</div>` : ''}</div><span class="rex-sr">${x.sets ? `${x.sets}×` : ''}${esc(x.reps)}</span>${x.weight ? `<span class="rex-w">${esc(x.weight)}</span>` : ''}${x.rest ? `<span class="rex-rest">${icon('clock')}${restTxt(x.rest)}</span>` : ''}</div>`).join('')}
    </div>`).join('')}</div></div>`;
}

/** Recomendación de plantillas según objetivo y nivel del alumno */
function score(t, m) {
  let s = 0;
  if (m?.goal && t.goal === m.goal) s += 3;
  if (m?.goal && /bajar|tonific/i.test(m.goal) && /bajar|tonific/i.test(t.goal || '')) s += 1;
  if (m?.goal && /masa|fuerza/i.test(m.goal) && /masa|fuerza/i.test(t.goal || '')) s += 1;
  if (m?.level && t.level === m.level) s += 2;
  if (m?.health?.conditions?.length && t.level === 'Principiante') s += 1;
  return s;
}

/** Crear una rutina a la medida (objetivo, nivel, días, lugar y tiempo) */
export function generatorModal(member = null, preset = {}) {
  return new Promise((resolve) => {
    let out = null;
    const v = { goal: member?.goal || preset.goal || 'Ganar masa muscular', level: member?.level || preset.level || 'Principiante', days: 3, place: member?.place === 'casa' ? 'casa' : 'gym', minutes: 60, focus: '' };
    const opt = (name, list, cur) => list.map(([k, l]) => `<button type="button" class="seg-b ${String(cur) === String(k) ? 'on' : ''}" data-n="${name}" data-v="${k}">${l}</button>`).join('');
    const m = openModal({
      title: 'Crear rutina a la medida', sub: member ? esc(member.name) : 'Se arma sola: luego la ajustas como quieras.', size: 'md',
      body: `<div class="stack gen">
        <div class="field"><label>Objetivo</label><select class="select" data-g>${GOALS.map((g) => `<option ${g === v.goal ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
        <div class="field"><label>Nivel</label><div class="seg">${opt('level', LEVELS.map((l) => [l, l]), v.level)}</div></div>
        <div class="field"><label>Días por semana</label><div class="seg">${opt('days', [2, 3, 4, 5, 6].map((d) => [d, d]), v.days)}</div></div>
        <div class="field"><label>Dónde entrena</label><div class="seg">${opt('place', [['gym', `${icon('dumbbell')} Gimnasio`], ['casa', `${icon('home')} En casa`]], v.place)}</div></div>
        <div class="field"><label>Tiempo por sesión</label><div class="seg">${opt('minutes', [[30, '30 min'], [45, '45 min'], [60, '1 h'], [75, '1 h 15']], v.minutes)}</div></div>
        <div class="field"><label>Énfasis</label><div class="seg">${opt('focus', [['', 'Equilibrado'], ['gluteo', 'Glúteos y piernas']], v.focus)}</div></div>
        <div class="gen-prev" data-prev></div></div>`,
      footer: `<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-ok>${icon('sparkle')} Usar esta rutina</button>`,
      onClose: () => resolve(out)
    });
    const prev = () => {
      v.goal = m.el.querySelector('[data-g]').value;
      const r = generateRoutine(v);
      m.el.querySelector('[data-prev]').innerHTML = `<div class="gen-h"><b>${esc(r.name)}</b><small>${esc(r.note)}</small></div>${r.days.map((d) => `<div class="gen-d"><b>${esc(d.name)}</b><span>${d.items.map((x) => esc(x.name)).join(' · ')}</span></div>`).join('')}`;
      return r;
    };
    m.el.querySelector('[data-g]').onchange = prev;
    m.el.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => { v[b.dataset.n] = b.dataset.n === 'days' || b.dataset.n === 'minutes' ? Number(b.dataset.v) : b.dataset.v; m.el.querySelectorAll(`[data-n="${b.dataset.n}"]`).forEach((x) => x.classList.toggle('on', x === b)); prev(); });
    m.el.querySelector('[data-ok]').onclick = () => { out = prev(); if (member) out.name = `${out.name} · ${String(member.name).split(' ')[0]}`; m.close(); };
    prev();
  });
}

/** Elegir una plantilla para el alumno → abre el editor con una copia */
export function assignTemplate(member) {
  return new Promise((resolve) => {
    let out = null;
    const list = allTemplates().map((t) => ({ t, s: score(t, member) })).sort((a, b) => b.s - a.s);
    const m = openModal({
      title: 'Elegir plantilla', sub: `${esc(member.name)}${member.goal ? ' · objetivo: ' + esc(member.goal) : ''}${member.level ? ' · ' + esc(member.level) : ''}`, size: 'lg',
      body: `<div class="tpl-grid"><button type="button" class="tpl tpl-gen" data-gen><span class="plan-flag">A su medida</span><b>${icon('sparkle')} Crear rutina automática</b><small>Según su objetivo, nivel, días y si entrena en casa o en el gimnasio</small></button>${list.map(({ t, s }, i) => `<button type="button" class="tpl ${i === 0 && s > 0 ? 'rec' : ''}" data-i="${i}">
        ${i === 0 && s > 0 ? '<span class="plan-flag">Recomendada</span>' : t.custom ? '<span class="plan-flag alt">Tuya</span>' : ''}
        <b>${esc(t.name)}</b><small>${esc(t.goal || '')} · ${esc(t.level || '')}${t.weeks ? ` · ${t.weeks} sem.` : ''}</small>
        <span class="t-sub">${(t.days || []).map((d) => esc(d.name)).join(' · ')}</span></button>`).join('')}</div>`,
      footer: '<button class="btn btn-secondary" data-close>Cancelar</button>',
      onClose: () => resolve(out)
    });
    m.el.querySelector('[data-gen]').onclick = async () => {
      m.close();
      const g = await generatorModal(member);
      out = g ? await routineEditor(g, { member, fresh: true }) : null;
      resolve(out);
    };
    m.el.querySelectorAll('[data-i]').forEach((b) => b.onclick = async () => {
      const t = list[+b.dataset.i].t;
      const copy = JSON.parse(JSON.stringify({ name: t.name, goal: t.goal, level: t.level, weeks: t.weeks, note: t.note, days: t.days }));
      m.close();
      out = await routineEditor(copy, { member, fresh: true });
      resolve(out);
    });
  });
}

/** Editor de rutina. member: rutina del alumno · sin member: plantilla para tus alumnos */
export function routineEditor(routine = null, { member = null, fresh = false } = {}) {
  const r = JSON.parse(JSON.stringify(routine || { name: member ? `Rutina de ${String(member.name).split(' ')[0]}` : 'Nueva plantilla', goal: member?.goal || '', level: member?.level || 'Principiante', weeks: 4, note: '', days: [{ name: 'Día A', items: [] }] }));
  if (!r.days?.length) r.days = [{ name: 'Día A', items: [] }];
  const id = fresh ? null : routine?.id || null;
  let day = 0;
  return new Promise((resolve) => {
    let saved = null;
    const m = openModal({
      title: member ? (id ? 'Editar rutina' : 'Nueva rutina') : (id ? 'Editar plantilla' : 'Nueva plantilla'), sub: member ? esc(member.name) : 'Las plantillas se asignan a los alumnos con un toque.', size: 'xl',
      body: `<div class="form-grid form-grid-3">
          <div class="field"><label>Nombre</label><input class="input" data-k="name"></div>
          <div class="field"><label>Objetivo</label><select class="select" data-k="goal"><option value="">—</option>${GOALS.map((g) => `<option>${g}</option>`).join('')}</select></div>
          <div class="field"><label>Nivel</label><select class="select" data-k="level">${LEVELS.map((g) => `<option>${g}</option>`).join('')}</select></div>
          <div class="field"><label>Duración (semanas)</label><input class="input" data-k="weeks" inputmode="numeric"></div>
          <div class="field full" style="grid-column:span 2"><label>Indicaciones generales</label><input class="input" data-k="note" placeholder="Calentamiento, progresión, cuidados…"></div>
        </div>
        <div class="rdays-tabs mt-lg" data-days></div>
        <div class="redit" data-items></div>
        <div class="row row-wrap mt"><button class="btn btn-secondary btn-sm" data-add>${icon('plus')} Agregar ejercicio</button><button class="btn btn-ghost btn-sm" data-free>${icon('edit')} Ejercicio libre</button><span class="grow"></span><button class="btn btn-ghost btn-sm" data-gen>${icon('sparkle')} Generar automáticamente</button></div>
        <div class="error-msg mt" data-err></div>`,
      footer: `${id ? `<button class="btn btn-danger-soft" data-del style="margin-right:auto">${icon('trash')} Eliminar</button>` : ''}<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-ok>${icon('check')} Guardar${member ? ' y publicar en su carnet' : ''}</button>`,
      onClose: () => resolve(saved)
    });
    const $ = (q) => m.el.querySelector(q);
    m.el.querySelectorAll('[data-k]').forEach((inp) => { inp.value = r[inp.dataset.k] ?? ''; inp.oninput = inp.onchange = () => { r[inp.dataset.k] = inp.value; }; });

    function drawDays() {
      $('[data-days]').innerHTML = r.days.map((d, i) => `<button type="button" class="chip ${i === day ? 'on' : ''}" data-d="${i}">${esc(d.name)} <span class="count">${d.items.length}</span></button>`).join('') + `<button type="button" class="chip" data-dadd>${icon('plus')} Día</button>`;
      m.el.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { day = +b.dataset.d; drawDays(); drawItems(); });
      $('[data-dadd]').onclick = () => { r.days.push({ name: `Día ${String.fromCharCode(65 + r.days.length)}`, items: [] }); day = r.days.length - 1; drawDays(); drawItems(); };
    }
    function drawItems() {
      const d = r.days[day];
      $('[data-items]').innerHTML = `<div class="row mb"><input class="input input-sm" data-dn value="${esc(d.name)}" style="max-width:320px"><span class="grow"></span>${r.days.length > 1 ? `<button class="btn btn-ghost btn-sm" data-drm>${icon('trash')} Quitar día</button>` : ''}</div>
        ${d.items.length ? `<div class="redit-head"><span>Ejercicio</span><span>Series</span><span>Reps / tiempo</span><span>Descanso (s)</span><span>Carga</span><span></span></div>` + d.items.map((x, i) => `<div class="redit-row">
          <div class="redit-name"><button type="button" class="linkish" data-info="${i}" title="Ver cómo se hace"><b>${esc(x.name)}</b></button><input class="input input-sm" data-f="note" data-i="${i}" value="${esc(x.note || '')}" placeholder="Nota (técnica, tempo…)"></div>
          <input class="input input-sm" data-f="sets" data-i="${i}" value="${esc(x.sets ?? '')}" inputmode="numeric" aria-label="Series">
          <input class="input input-sm" data-f="reps" data-i="${i}" value="${esc(x.reps ?? '')}" aria-label="Repeticiones">
          <input class="input input-sm" data-f="rest" data-i="${i}" value="${esc(x.rest ?? '')}" inputmode="numeric" aria-label="Descanso">
          <input class="input input-sm" data-f="weight" data-i="${i}" value="${esc(x.weight ?? '')}" placeholder="kg" aria-label="Carga">
          <div class="row" style="gap:2px"><button class="btn btn-ghost btn-icon btn-sm" data-up="${i}" title="Subir">${icon('arrowUp')}</button><button class="btn btn-ghost btn-icon btn-sm" data-rm="${i}" title="Quitar">${icon('x')}</button></div>
        </div>`).join('') : emptyState('dumbbell', 'Sin ejercicios en este día', 'Agrégalos desde la biblioteca.')}`;
      $('[data-dn]').oninput = (e) => { d.name = e.target.value; m.el.querySelector(`[data-d="${day}"]`).firstChild.textContent = e.target.value + ' '; };
      $('[data-drm]')?.addEventListener('click', () => { r.days.splice(day, 1); day = Math.max(0, day - 1); drawDays(); drawItems(); });
      m.el.querySelectorAll('[data-f]').forEach((inp) => inp.oninput = () => { d.items[+inp.dataset.i][inp.dataset.f] = inp.value; });
      m.el.querySelectorAll('[data-info]').forEach((b) => b.onclick = () => { const x = d.items[+b.dataset.info]; exerciseSheet(x.exId || x.name, { item: x, goal: r.goal }); });
      m.el.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { d.items.splice(+b.dataset.rm, 1); drawDays(); drawItems(); });
      m.el.querySelectorAll('[data-up]').forEach((b) => b.onclick = () => { const i = +b.dataset.up; if (i > 0) { [d.items[i - 1], d.items[i]] = [d.items[i], d.items[i - 1]]; drawItems(); } });
    }
    $('[data-add]').onclick = async () => {
      const picked = await pickExercises();
      if (picked.length) { r.days[day].items.push(...picked.map((e) => ({ exId: e.id, name: e.name, sets: e.group === 'Cardio' || e.group === 'Movilidad' ? 1 : 3, reps: e.group === 'Cardio' ? '15 min' : e.group === 'Movilidad' ? '5 min' : '12', rest: e.group === 'Cardio' || e.group === 'Movilidad' ? 0 : 60, weight: '', note: '' }))); drawDays(); drawItems(); }
    };
    $('[data-gen]').onclick = async () => {
      const hasItems = r.days.some((d) => d.items.length);
      if (hasItems && !(await confirmDialog({ title: 'Generar rutina', message: 'Se reemplazarán los días y ejercicios actuales por una rutina nueva. ¿Continuar?', confirmText: 'Generar' }))) return;
      const g = await generatorModal(member, { goal: r.goal, level: r.level });
      if (!g) return;
      const keepName = r.name && !/^(Nueva plantilla|Rutina de )/.test(r.name);
      Object.assign(r, { goal: g.goal, level: g.level, weeks: g.weeks, note: g.note, days: g.days, name: keepName || member ? r.name : g.name });
      m.el.querySelectorAll('[data-k]').forEach((inp) => { inp.value = r[inp.dataset.k] ?? ''; });
      day = 0; drawDays(); drawItems(); toast('Rutina generada: revísala y ajusta lo que quieras');
    };
    $('[data-free]').onclick = async () => { const n = await promptDialog({ title: 'Ejercicio libre', label: 'Nombre del ejercicio', confirmText: 'Agregar' }); if (n && n.trim()) { r.days[day].items.push({ exId: null, name: n.trim(), sets: 3, reps: '12', rest: 60, weight: '', note: '' }); drawDays(); drawItems(); } };
    $('[data-del]')?.addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'Eliminar', message: `¿Eliminar <b>${esc(r.name)}</b>?`, confirmText: 'Eliminar', danger: true }))) return;
      await deleteRoutine({ id }); saved = { deleted: true }; m.close(); toast('Eliminada', 'warning');
    });
    $('[data-ok]').onclick = async (e) => {
      const btn = e.currentTarget; setBusy(btn, true, 'Guardando…');
      try { saved = await saveRoutine(r, id, member); m.close(); toast(member ? 'Rutina guardada y publicada en su carnet' : 'Plantilla guardada'); if (member && member.phone && !id) setTimeout(() => offerWa(member, saved), 200); }
      catch (ex) { $('[data-err]').textContent = ex.message; setBusy(btn, false); }
    };
    drawDays(); drawItems();
  });
}
function offerWa(member, r) {
  const m = openModal({ size: 'sm', title: 'Rutina lista', body: `<p class="muted">¿Le avisas a ${esc(member.name.split(' ')[0])} por WhatsApp? La verá en su carnet digital.</p>`, footer: `<button class="btn btn-secondary" data-close>No</button><button class="btn btn-whatsapp" data-y>${icon('whatsapp')} Avisar</button>` });
  m.el.querySelector('[data-y]').onclick = () => { waMember('rutina', { member: { ...member, routineName: r.name } }); m.close(); };
}

/** Biblioteca de ejercicios (selección múltiple) */
export function pickExercises() {
  return new Promise((resolve) => {
    const sel = new Set();
    let group = ''; let q = ''; let place = '';
    const m = openModal({
      title: 'Biblioteca de ejercicios', sub: `${EXERCISES.length} ejercicios · toca para seleccionar varios · ⓘ para ver cómo se hace`, size: 'lg',
      body: `<div class="stack"><label class="search">${icon('search')}<input data-q placeholder="Buscar ejercicio, músculo o equipo…" autofocus></label><div class="seg seg-sm" data-p></div><div class="chips chips-scroll" data-g></div><div class="ex-grid" data-l></div></div>`,
      footer: `<span class="small muted" data-n style="margin-right:auto"></span><button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-ok>${icon('plus')} Agregar</button>`,
      onClose: () => resolve(done ? EXERCISES.filter((e) => sel.has(e.id)) : [])
    });
    let done = false;
    const draw = () => {
      m.el.querySelector('[data-g]').innerHTML = ['', ...MUSCLE_GROUPS].map((g) => `<button class="chip ${g === group ? 'on' : ''}" data-gg="${esc(g)}">${g || 'Todos'}</button>`).join('');
      m.el.querySelectorAll('[data-gg]').forEach((b) => b.onclick = () => { group = b.dataset.gg; draw(); });
      m.el.querySelector('[data-p]').innerHTML = [['', 'Todos'], ['gym', 'Gimnasio'], ['casa', 'En casa']].map(([k, l]) => `<button type="button" class="seg-b ${k === place ? 'on' : ''}" data-pp="${k}">${l}</button>`).join('');
      m.el.querySelectorAll('[data-pp]').forEach((b) => b.onclick = () => { place = b.dataset.pp; draw(); });
      const list = filterExercises({ q, group, place });
      m.el.querySelector('[data-l]').innerHTML = list.map((e) => `<div class="ex ex-pick ${sel.has(e.id) ? 'on' : ''}" data-e="${e.id}" role="button" tabindex="0">${exThumb(e)}<span class="grow"><b>${esc(e.name)}</b><small>${esc(e.group)} · ${esc(e.eq)}</small></span><button type="button" class="ex-i" data-xi="${e.id}" aria-label="Cómo se hace">${icon('info')}</button></div>`).join('') || emptyState('search', 'Sin resultados');
      m.el.querySelectorAll('[data-xi]').forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); exerciseSheet(b.dataset.xi); });
      m.el.querySelectorAll('[data-e]').forEach((b) => b.onclick = () => { sel.has(b.dataset.e) ? sel.delete(b.dataset.e) : sel.add(b.dataset.e); b.classList.toggle('on'); count(); });
      count();
    };
    const count = () => { m.el.querySelector('[data-n]').textContent = sel.size ? `${sel.size} seleccionado(s)` : ''; };
    m.el.querySelector('[data-q]').oninput = debounce((e) => { q = e.target.value; draw(); }, 80);
    m.el.querySelector('[data-ok]').onclick = () => { done = true; m.close(); };
    draw();
  });
}

/** Filtro común de la biblioteca: texto (nombre, grupo, equipo o músculo), grupo, lugar y equipo */
export function filterExercises({ q = '', group = '', place = '', eq = '' } = {}) {
  const t = normalize(q);
  return EXERCISES.filter((e) => (!group || e.group === group) && (!eq || e.eq === eq) && (!place || (place === 'casa' ? atHome(e) : !atHome(e) || e.eq === 'Mancuernas'))
    && (!t || normalize(`${e.name} ${e.eq} ${e.group} ${guide(e).primary.join(' ')}`).includes(t)));
}
/** Miniatura con el mapa muscular */
export const exThumb = (e) => { const g = guide(e); return `<span class="ex-thumb">${bodyMapHTML(g.primary, g.secondary, { size: 'sm' })}</span>`; };

export function printRoutine(r, member = null) {
  printDoc(`Rutina: ${r.name}${member ? ' · ' + member.name : ''}`, `
    <div class="kpis">${member ? `<div class="kpi">Alumno<b>${esc(member.name)}</b>${esc(member.number || '')}</div>` : ''}${r.goal ? `<div class="kpi">Objetivo<b>${esc(r.goal)}</b></div>` : ''}${r.level ? `<div class="kpi">Nivel<b>${esc(r.level)}</b></div>` : ''}${r.weeks ? `<div class="kpi">Duración<b>${r.weeks} semanas</b></div>` : ''}${r.trainer ? `<div class="kpi">Entrenador<b>${esc(r.trainer)}</b></div>` : ''}</div>
    ${r.note ? `<p>${esc(r.note)}</p>` : ''}
    ${(r.days || []).map((d) => `<div class="day"><h2>${esc(d.name)}</h2><table><thead><tr><th>#</th><th>Ejercicio</th><th class="c">Series</th><th class="c">Reps</th><th class="c">Descanso</th><th class="c">Carga</th><th>✓ ✓ ✓ ✓</th></tr></thead><tbody>
      ${(d.items || []).map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(x.name)}</b>${x.note ? `<div class="muted">${esc(x.note)}</div>` : ''}</td><td class="c">${x.sets || ''}</td><td class="c">${esc(x.reps)}</td><td class="c">${restTxt(x.rest)}</td><td class="c">${esc(x.weight || '')}</td><td></td></tr>`).join('')}</tbody></table></div>`).join('')}`);
}
export { exercise };
