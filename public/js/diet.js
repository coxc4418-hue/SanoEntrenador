// SanoEntrenador — Planes de alimentación en el panel: visor, generador a la medida, plantillas, editor e impresión
import { store } from './store.js';
import { saveDiet, deleteDiet } from './ops.js';
import { ageOf, energyOf } from './gym.js';
import { openModal, esc, toast, setBusy, normalize, debounce, emptyState, confirmDialog, todayKey, fmtDate } from './utils.js';
import { icon } from './icons.js';
import { printDoc, waMember } from './shared.js';
import {
  FOODS, FOOD_GROUPS, MEAL_OPTIONS, MEAL_SLOTS, DIET_TYPES, DIET_GOALS, food, itemNut, sumNut, dayNut, qtyText, itemName, scaleMeal,
  generateDiet, dietTemplates, kcalFor, dayLabel, shoppingList, macroPct, dietStatus
} from './nutrition.js';

const n0 = (n) => Math.round(Number(n) || 0).toLocaleString('es-VE');
const per100 = (f) => f.u === 'g' || f.u === 'ml';
export const portionText = (f) => (per100(f) ? `100 ${f.u}` : `1 ${f.u[0]}`);
export const allDietTemplates = () => [...store.dietTemplates.map((t) => ({ ...t, custom: true })), ...dietTemplates()];
const copyPlan = (t) => JSON.parse(JSON.stringify({ name: t.name, goal: t.goal, type: t.type, kcal: t.kcal, meals: t.meals, period: t.period || 'semanal', water: t.water, note: t.note, days: t.days, params: t.params || null }));

/** Objetivo de alimentación a partir del objetivo de entrenamiento del alumno */
export function dietGoalOf(goal = '') {
  if (/bajar/i.test(goal)) return 'Bajar de peso';
  if (/tonific|defin/i.test(goal)) return 'Definición';
  if (/masa|fuerza/i.test(goal)) return 'Ganar masa muscular';
  if (/salud|rehab|movil|flexib/i.test(goal)) return 'Salud general';
  return 'Mantener el peso';
}
/** Calorías sugeridas para el alumno (con su última evaluación) */
export function memberKcal(m, goal) {
  const ev = m?.lastEval;
  const e = ev?.weight && (ev.height || m.height) ? energyOf({ sex: m.sex, weight: ev.weight, height: ev.height || m.height, age: ageOf(m.birthDate) || 30, activity: m.activity || 1.55, goal: m.goal || '' }) : null;
  return { kcal: kcalFor(goal, e?.tdee), from: e ? `Según su última evaluación (gasto diario ≈ ${n0(e.tdee)} kcal)` : 'Valor típico: regístrale una evaluación para calcularlo con su peso y estatura', protein: e?.protein || null };
}

// ======================================================================
// VISOR
// ======================================================================
export function macrosHTML(n, target = null) {
  const pc = macroPct(n);
  return `<div class="dmac">
    <div class="dmac-k"><b>${n0(n.kcal)}</b><small>kcal${target ? ` de ${n0(target)}` : ''}</small></div>
    <div class="dmac-bar"><span class="mp" style="width:${pc.p}%"></span><span class="mc" style="width:${pc.c}%"></span><span class="mf" style="width:${pc.f}%"></span></div>
    <div class="dmac-l"><span><i class="mp"></i>Proteína ${n.p} g</span><span><i class="mc"></i>Carbohidratos ${n.c} g</span><span><i class="mf"></i>Grasas ${n.f} g</span></div></div>`;
}
export function mealsHTML(day) {
  return (day?.meals || []).map((m) => { const t = sumNut(m.items); return `<div class="dmeal">
    <div class="dmeal-h"><span class="dmeal-n">${icon('utensils')} ${esc(m.name)}${m.time ? ` <small>${esc(m.time)}</small>` : ''}</span><span class="dmeal-k">${n0(t.kcal)} kcal</span></div>
    ${m.title ? `<div class="dmeal-t">${esc(m.title)}</div>` : ''}
    <ul class="dmeal-i">${(m.items || []).map((it) => `<li><span>${esc(itemName(it))}</span><b>${esc(qtyText(it))}</b></li>`).join('')}</ul></div>`; }).join('');
}
export function dietMetaHTML(p) {
  return `<div class="routine-meta">${p.goal ? `<span class="tag">${icon('target')} ${esc(p.goal)}</span>` : ''}${p.kcal ? `<span class="tag">${icon('flame')} ${n0(p.kcal)} kcal/día</span>` : ''}<span class="tag">${icon('calendar')} ${p.period === 'mensual' ? 'Mensual · 4 semanas' : 'Semanal · 7 días'}</span>${p.type && p.type !== 'todo' ? `<span class="tag">${esc(DIET_TYPES[p.type] || '')}</span>` : ''}${p.water ? `<span class="tag">${icon('droplet')} ${String(p.water).replace('.', ',')} L de agua</span>` : ''}${p.start ? `<span class="tag">${icon('clock')} ${fmtDate(p.start)} → ${fmtDate(p.end)}</span>` : ''}</div>
    ${p.note ? `<div class="box small">${icon('info')} ${esc(p.note)}</div>` : ''}`;
}
/** Ficha del plan con selector de semana y día (se usa en ventanas y en la ficha del alumno) */
export function mountDietView(el, p, { day = 0 } = {}) {
  let d = Math.min(day, (p.days || []).length - 1); if (d < 0) d = 0;
  const weeks = Math.ceil((p.days || []).length / 7);
  const draw = () => {
    const w = Math.floor(d / 7);
    el.innerHTML = `${dietMetaHTML(p)}
      ${weeks > 1 ? `<div class="seg seg-sm mt">${Array.from({ length: weeks }, (_, i) => `<button type="button" class="seg-b ${i === w ? 'on' : ''}" data-w="${i}">Semana ${i + 1}</button>`).join('')}</div>` : ''}
      <div class="chips chips-scroll mt">${p.days.slice(w * 7, w * 7 + 7).map((_, j) => { const i = w * 7 + j; return `<button type="button" class="chip ${i === d ? 'on' : ''}" data-dd="${i}">${esc(dayLabel(p, i, { short: true }))}</button>`; }).join('')}</div>
      <div class="dday mt"><div class="dday-h"><b>${esc(dayLabel(p, d))}</b></div>${macrosHTML(dayNut(p.days[d]), p.kcal)}<div class="dmeals">${mealsHTML(p.days[d])}</div></div>
      <button type="button" class="btn btn-ghost btn-sm mt" data-shop>${icon('cart')} Lista de compras de la semana ${w + 1}</button>`;
    el.querySelectorAll('[data-w]').forEach((b) => b.onclick = () => { d = Number(b.dataset.w) * 7; draw(); });
    el.querySelectorAll('[data-dd]').forEach((b) => b.onclick = () => { d = Number(b.dataset.dd); draw(); });
    el.querySelector('[data-shop]').onclick = () => shoppingModal(p, w);
  };
  if (p.days?.length) draw(); else el.innerHTML = emptyState('utensils', 'Plan vacío', '');
}
export function shoppingHTML(p, week) {
  return shoppingList(p, week).map((g) => `<div class="shop-g"><b>${esc(g.group)}</b><ul>${g.items.map((x) => `<li><span>${esc(x.name)}</span><b>${esc(x.qty)}</b></li>`).join('')}</ul></div>`).join('');
}
function shoppingModal(p, week) {
  openModal({ title: `Lista de compras · semana ${week + 1}`, sub: esc(p.name), size: 'md', body: `<div class="shop">${shoppingHTML(p, week)}</div><p class="hint mt">Cantidades aproximadas para 7 días, ya redondeadas.</p>`, footer: '<button class="btn btn-primary" data-close>Listo</button>' });
}
export function viewDiet(p, { member = null } = {}) {
  const m = openModal({ title: esc(p.name), sub: member ? esc(member.name) : p.custom ? 'Tu plantilla' : p.builtin ? 'Plantilla SanoEntrenador' : '', size: 'lg', body: '<div data-v></div>',
    footer: `<button class="btn btn-ghost" data-print>${icon('print')} Imprimir</button><span class="grow"></span><button class="btn btn-secondary" data-close>Cerrar</button>` });
  mountDietView(m.el.querySelector('[data-v]'), p);
  m.el.querySelector('[data-print]').onclick = () => printDiet(p, member);
  return m;
}

// ======================================================================
// GENERADOR A LA MEDIDA
// ======================================================================
export function dietGenerator(member = null, preset = {}) {
  return new Promise((resolve) => {
    let out = null;
    const goal = preset.goal || dietGoalOf(member?.goal);
    const sug = memberKcal(member, goal);
    const v = { goal, kcal: preset.kcal || sug.kcal, type: preset.type || 'todo', meals: preset.meals || 5, period: preset.period || 'semanal', seed: Math.floor(Math.random() * 1000) + 1 };
    const opt = (name, list, cur) => list.map(([k, l]) => `<button type="button" class="seg-b ${String(cur) === String(k) ? 'on' : ''}" data-n="${name}" data-v="${k}">${l}</button>`).join('');
    const m = openModal({
      title: 'Plan de alimentación a la medida', sub: member ? esc(member.name) : 'Se arma solo: luego cambias lo que quieras.', size: 'md',
      body: `<div class="stack gen">
        <div class="form-grid"><div class="field"><label>Objetivo</label><select class="select" data-g>${DIET_GOALS.map((g) => `<option ${g === v.goal ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
        <div class="field"><label>Calorías por día</label><input class="input" data-k inputmode="numeric" value="${v.kcal}"><small class="hint" data-kh>${esc(member ? sug.from : 'Valor típico para el objetivo')}</small></div></div>
        <div class="field"><label>Tipo de alimentación</label><div class="seg seg-wrap">${opt('type', Object.entries(DIET_TYPES), v.type)}</div></div>
        <div class="field"><label>Comidas al día</label><div class="seg">${opt('meals', [[3, '3'], [4, '4'], [5, '5']], v.meals)}</div></div>
        <div class="field"><label>Duración</label><div class="seg">${opt('period', [['semanal', `${icon('calendar')} Semanal (7 días)`], ['mensual', `${icon('layers')} Mensual (4 semanas)`]], v.period)}</div></div>
        <div class="gen-prev" data-prev></div></div>`,
      footer: `<button class="btn btn-ghost" data-alt>${icon('refresh')} Otra variante</button><span class="grow"></span><button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-ok>${icon('sparkle')} Usar este plan</button>`,
      onClose: () => resolve(out)
    });
    const $ = (s) => m.el.querySelector(s);
    const prev = () => {
      v.goal = $('[data-g]').value; v.kcal = Math.max(1000, Math.min(5000, Number($('[data-k]').value) || v.kcal));
      const p = generateDiet(v);
      p.params = { goal: v.goal, kcal: v.kcal, type: v.type, meals: v.meals, seed: v.seed };
      const avg = (k) => Math.round(p.days.reduce((a, d) => a + dayNut(d)[k], 0) / p.days.length);
      $('[data-prev]').innerHTML = `<div class="gen-h"><b>${esc(p.name)}</b><small>Promedio: ${n0(avg('kcal'))} kcal · ${avg('p')} g de proteína · ${p.days.length} días con menús distintos</small></div>
        ${p.days[0].meals.map((x) => `<div class="gen-d"><b>${esc(x.name)}</b><span>${esc(x.title)}</span></div>`).join('')}<div class="t-sub mt">Día 1 de ${p.days.length}. Los demás días cambian las comidas.</div>`;
      return p;
    };
    $('[data-g]').onchange = () => { const s = memberKcal(member, $('[data-g]').value); $('[data-k]').value = s.kcal; prev(); };
    $('[data-k]').oninput = debounce(prev, 300);
    m.el.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => { v[b.dataset.n] = b.dataset.n === 'meals' ? Number(b.dataset.v) : b.dataset.v; m.el.querySelectorAll(`[data-n="${b.dataset.n}"]`).forEach((x) => x.classList.toggle('on', x === b)); prev(); });
    $('[data-alt]').onclick = () => { v.seed += 1; prev(); };
    $('[data-ok]').onclick = () => { out = prev(); if (member) out.name = `${out.name} · ${String(member.name).split(' ')[0]}`; m.close(); };
    prev();
  });
}

// ======================================================================
// ELEGIR PLANTILLA PARA UN ALUMNO
// ======================================================================
export function assignDietTemplate(member) {
  return new Promise((resolve) => {
    let out = null;
    const goal = dietGoalOf(member.goal); const target = memberKcal(member, goal).kcal;
    const score = (t) => (t.goal === goal ? 3 : 0) - Math.abs((t.kcal || target) - target) / 400 + (t.custom ? 0.5 : 0);
    const list = allDietTemplates().map((t) => ({ t, s: score(t) })).sort((a, b) => b.s - a.s);
    const m = openModal({
      title: 'Plan de alimentación', sub: `${esc(member.name)} · sugerido: ${esc(goal)}, ≈ ${n0(target)} kcal`, size: 'lg',
      body: `<div class="tpl-grid"><button type="button" class="tpl tpl-gen" data-gen><span class="plan-flag">A su medida</span><b>${icon('sparkle')} Crear plan automático</b><small>Con sus calorías, su objetivo y lo que come: semanal o mensual</small></button>${list.map(({ t }, i) => `<button type="button" class="tpl" data-i="${i}">
        ${i === 0 && !t.custom ? '<span class="plan-flag">Recomendado</span>' : t.custom ? '<span class="plan-flag alt">Tuyo</span>' : ''}
        <b>${esc(t.name)}</b><small>${esc(t.desc || t.note || '').slice(0, 90)}</small><span class="t-sub">${t.meals || ''} comidas · ${t.period === 'mensual' ? '4 semanas' : '7 días'}</span></button>`).join('')}</div>`,
      footer: '<button class="btn btn-secondary" data-close>Cancelar</button>',
      onClose: () => resolve(out)
    });
    m.el.querySelector('[data-gen]').onclick = async () => { m.close(); const g = await dietGenerator(member); out = g ? await dietEditor(g, { member, fresh: true }) : null; resolve(out); };
    m.el.querySelectorAll('[data-i]').forEach((b) => b.onclick = async () => { const t = list[+b.dataset.i].t; m.close(); out = await dietEditor(copyPlan(t), { member, fresh: true }); resolve(out); });
  });
}

// ======================================================================
// BUSCADOR DE ALIMENTOS
// ======================================================================
export function pickFood() {
  return new Promise((resolve) => {
    let out = null; let q = ''; let g = '';
    const m = openModal({ title: 'Agregar alimento', sub: `${FOODS.length} alimentos con sus calorías por porción`, size: 'md',
      body: `<div class="stack"><div class="search">${icon('search')}<input class="input" data-q placeholder="Buscar: pollo, arepa, avena…" autofocus></div><div class="chips chips-scroll" data-g></div><div class="list food-list" data-l></div></div>`,
      footer: '<button class="btn btn-secondary" data-close>Cancelar</button>', onClose: () => resolve(out) });
    const draw = () => {
      m.el.querySelector('[data-g]').innerHTML = ['', ...FOOD_GROUPS].map((x) => `<button type="button" class="chip ${x === g ? 'on' : ''}" data-gg="${esc(x)}">${x || 'Todos'}</button>`).join('');
      m.el.querySelectorAll('[data-gg]').forEach((b) => b.onclick = () => { g = b.dataset.gg; draw(); });
      const nq = normalize(q);
      const list = FOODS.filter((f) => (!g || f.group === g) && (!nq || normalize(f.name).includes(nq)));
      m.el.querySelector('[data-l]').innerHTML = list.length ? list.map((f) => `<button type="button" class="list-item" data-f="${f.id}"><div class="grow" style="min-width:0"><b class="ellipsis">${esc(f.name)}</b><div class="t-sub">${esc(f.group)} · ${portionText(f)}: ${n0(f.kcal)} kcal · P ${f.p} · C ${f.c} · G ${f.f}</div></div>${icon('plus')}</button>`).join('') : emptyState('search', 'Sin resultados', '');
      m.el.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { out = food(b.dataset.f); m.close(); });
    };
    m.el.querySelector('[data-q]').oninput = debounce((e) => { q = e.target.value; draw(); }, 100);
    draw();
  });
}

// ======================================================================
// EDITOR
// ======================================================================
/** Editor del plan. member: plan del alumno (se publica en su carnet) · sin member: plantilla */
export function dietEditor(plan = null, { member = null, fresh = false } = {}) {
  const goal0 = dietGoalOf(member?.goal);
  const r = JSON.parse(JSON.stringify(plan || { ...generateDiet({ goal: goal0, kcal: memberKcal(member, goal0).kcal, meals: 5 }), name: member ? `Plan de ${String(member.name).split(' ')[0]}` : 'Nuevo plan' }));
  if (member) r.start = r.start && !fresh ? r.start : todayKey();
  else delete r.start;
  const id = fresh ? null : plan?.id || null;
  let day = 0;
  return new Promise((resolve) => {
    let saved = null;
    const m = openModal({
      title: member ? (id ? 'Editar plan de alimentación' : 'Plan de alimentación') : (id ? 'Editar plantilla' : 'Nueva plantilla de alimentación'), sub: member ? esc(member.name) : 'Las plantillas se asignan a los alumnos con un toque.', size: 'xl',
      body: `<div class="form-grid form-grid-3">
          <div class="field" style="grid-column:span 2"><label>Nombre</label><input class="input" data-k="name"></div>
          <div class="field"><label>Objetivo</label><select class="select" data-k="goal">${DIET_GOALS.map((g) => `<option>${g}</option>`).join('')}</select></div>
          <div class="field"><label>Calorías por día (meta)</label><input class="input" data-k="kcal" inputmode="numeric"></div>
          <div class="field"><label>Agua por día (litros)</label><input class="input" data-k="water" inputmode="decimal"></div>
          <div class="field"><label>Duración</label><div class="seg" data-per><button type="button" class="seg-b" data-p="semanal">Semanal</button><button type="button" class="seg-b" data-p="mensual">Mensual</button></div></div>
          ${member ? '<div class="field"><label>Empieza</label><input class="input" type="date" data-k="start"></div>' : ''}
          <div class="field" style="grid-column:span ${member ? 2 : 3}"><label>Indicaciones generales</label><input class="input" data-k="note" placeholder="Horarios, cambios permitidos, suplementos…"></div>
        </div>
        <div class="row row-wrap mt-lg" data-wk></div>
        <div class="rdays-tabs mt" data-days></div>
        <div data-day class="mt"></div>
        <div class="error-msg mt" data-err></div>`,
      footer: `${id ? `<button class="btn btn-danger-soft" data-del>${icon('trash')} Eliminar</button>` : ''}<button class="btn btn-ghost" data-gen>${icon('sparkle')} Generar automáticamente</button><span class="grow"></span><button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-ok>${icon('check')} Guardar${member ? ' y publicar en su carnet' : ''}</button>`,
      onClose: () => resolve(saved)
    });
    const $ = (q) => m.el.querySelector(q);
    const fill = () => m.el.querySelectorAll('[data-k]').forEach((inp) => { inp.value = r[inp.dataset.k] ?? ''; inp.oninput = inp.onchange = () => { r[inp.dataset.k] = inp.value; if (inp.dataset.k === 'start') drawDays(); if (inp.dataset.k === 'kcal') drawDay(); }; });
    const drawPer = () => m.el.querySelectorAll('[data-p]').forEach((b) => b.classList.toggle('on', b.dataset.p === r.period));
    m.el.querySelectorAll('[data-p]').forEach((b) => b.onclick = async () => {
      const to = b.dataset.p; if (to === r.period) return;
      if (to === 'mensual') {
        if (r.params) Object.assign(r, { days: generateDiet({ ...r.params, period: 'mensual' }).days });
        else r.days = [0, 1, 2, 3].flatMap(() => JSON.parse(JSON.stringify(r.days.slice(0, 7))));
        toast(r.params ? 'Se armaron 4 semanas con menús distintos' : 'Se repitió la semana 4 veces: cambia los menús que quieras');
      } else {
        if (!(await confirmDialog({ title: 'Pasar a semanal', message: 'Se conservan solo los primeros 7 días. ¿Continuar?', confirmText: 'Continuar' }))) return;
        r.days = r.days.slice(0, 7);
      }
      r.period = to; day = Math.min(day, r.days.length - 1); drawPer(); drawDays(); drawDay();
    });
    const lbl = (i, short) => dayLabel({ ...r, start: member ? r.start : null }, i, { short });
    function drawDays() {
      const w = Math.floor(day / 7); const weeks = Math.ceil(r.days.length / 7);
      $('[data-wk]').innerHTML = weeks > 1 ? `<div class="seg seg-sm">${Array.from({ length: weeks }, (_, i) => `<button type="button" class="seg-b ${i === w ? 'on' : ''}" data-w="${i}">Semana ${i + 1}</button>`).join('')}</div>` : '';
      m.el.querySelectorAll('[data-w]').forEach((b) => b.onclick = () => { day = Number(b.dataset.w) * 7; drawDays(); drawDay(); });
      $('[data-days]').innerHTML = r.days.slice(w * 7, w * 7 + 7).map((d, j) => { const i = w * 7 + j; return `<button type="button" class="chip ${i === day ? 'on' : ''}" data-d="${i}">${esc(lbl(i, true))} <span class="count">${n0(dayNut(d).kcal)}</span></button>`; }).join('');
      m.el.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { day = Number(b.dataset.d); drawDays(); drawDay(); });
    }
    function drawDay() {
      const d = r.days[day]; const target = Number(r.kcal) || null;
      $('[data-day]').innerHTML = `<div class="between row-wrap mb"><b>${esc(lbl(day))}</b><div class="row row-wrap"><button type="button" class="btn btn-ghost btn-sm" data-copy>${icon('copy')} Copiar a toda la semana</button><button type="button" class="btn btn-ghost btn-sm" data-madd>${icon('plus')} Comida</button></div></div>
        ${macrosHTML(dayNut(d), target)}
        <div class="dedit">${d.meals.map((ml, mi) => { const t = sumNut(ml.items); return `<div class="dedit-m">
          <div class="dedit-h"><input class="input input-sm" data-mf="name" data-mi="${mi}" value="${esc(ml.name)}" aria-label="Comida"><input class="input input-sm dedit-time" data-mf="time" data-mi="${mi}" value="${esc(ml.time || '')}" aria-label="Hora" placeholder="Hora"><span class="dedit-k">${n0(t.kcal)} kcal · P ${t.p} g</span>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" data-swap="${mi}" title="Cambiar por otra opción">${icon('refresh')}</button><button type="button" class="btn btn-ghost btn-icon btn-sm" data-mrm="${mi}" title="Quitar comida">${icon('trash')}</button></div>
          <input class="input input-sm" data-mf="title" data-mi="${mi}" value="${esc(ml.title || '')}" placeholder="Nombre del plato (ej.: Arepa con huevos)">
          ${ml.items.map((it, ii) => { const f = it.f ? food(it.f) : null; return `<div class="dedit-i"><span class="grow">${esc(itemName(it))}</span>
            ${f ? `<input class="input input-sm" data-q="${mi}.${ii}" value="${String(it.q).replace('.', ',')}" inputmode="decimal" aria-label="Cantidad"><small class="dedit-u">${per100(f) ? f.u : f.u[1]}</small>` : `<input class="input input-sm" data-qt="${mi}.${ii}" value="${esc(it.q)}" aria-label="Cantidad">`}
            <small class="dedit-ik">${n0(itemNut(it).kcal)}</small><button type="button" class="btn btn-ghost btn-icon btn-sm" data-irm="${mi}.${ii}" aria-label="Quitar">${icon('x')}</button></div>`; }).join('')}
          <button type="button" class="btn btn-ghost btn-sm" data-iadd="${mi}">${icon('plus')} Alimento</button></div>`; }).join('')}</div>`;
      const at = (s) => s.split('.').map(Number);
      m.el.querySelectorAll('[data-mf]').forEach((inp) => inp.oninput = () => { d.meals[+inp.dataset.mi][inp.dataset.mf] = inp.value; });
      m.el.querySelectorAll('[data-q]').forEach((inp) => inp.onchange = () => { const [mi, ii] = at(inp.dataset.q); d.meals[mi].items[ii].q = Math.max(0, Number(String(inp.value).replace(',', '.')) || 0); drawDays(); drawDay(); });
      m.el.querySelectorAll('[data-qt]').forEach((inp) => inp.oninput = () => { const [mi, ii] = at(inp.dataset.qt); d.meals[mi].items[ii].q = inp.value; });
      m.el.querySelectorAll('[data-irm]').forEach((b) => b.onclick = () => { const [mi, ii] = at(b.dataset.irm); d.meals[mi].items.splice(ii, 1); drawDays(); drawDay(); });
      m.el.querySelectorAll('[data-mrm]').forEach((b) => b.onclick = () => { d.meals.splice(+b.dataset.mrm, 1); drawDays(); drawDay(); });
      m.el.querySelectorAll('[data-iadd]').forEach((b) => b.onclick = async () => { const f = await pickFood(); if (!f) return; d.meals[+b.dataset.iadd].items.push({ f: f.id, q: per100(f) ? 100 : 1 }); drawDays(); drawDay(); });
      m.el.querySelectorAll('[data-swap]').forEach((b) => b.onclick = () => {
        const ml = d.meals[+b.dataset.swap]; const slot = ml.slot || (/desay/i.test(ml.name) ? 'd' : /almuer/i.test(ml.name) ? 'a' : /cena/i.test(ml.name) ? 'c' : 'm');
        const veg = r.type === 'veg'; const pool = MEAL_OPTIONS.filter((o) => o.s.includes(slot) && o.n !== ml.title && (!veg || o.t.includes('v')));
        const o = pool[Math.floor(Math.random() * pool.length)]; if (!o) return;
        const k = sumNut(ml.items).kcal || (Number(r.kcal) || 2000) * 0.25;
        Object.assign(ml, { slot, title: o.n, items: scaleMeal(o.items, k) }); drawDays(); drawDay();
      });
      $('[data-madd]').onclick = () => { d.meals.push({ slot: 'm', name: 'Merienda', time: '', title: '', items: [] }); drawDay(); };
      $('[data-copy]').onclick = async () => {
        if (!(await confirmDialog({ title: 'Copiar día', message: `Los demás días de esta semana quedarán igual a «${esc(lbl(day))}». ¿Continuar?`, confirmText: 'Copiar' }))) return;
        const w = Math.floor(day / 7); for (let i = w * 7; i < Math.min(r.days.length, w * 7 + 7); i++) if (i !== day) r.days[i] = JSON.parse(JSON.stringify(d));
        drawDays(); toast('Día copiado a toda la semana');
      };
    }
    $('[data-gen]').onclick = async () => {
      if (!(await confirmDialog({ title: 'Generar plan', message: 'Se reemplazarán todos los menús por un plan nuevo. ¿Continuar?', confirmText: 'Generar' }))) return;
      const g = await dietGenerator(member, { goal: r.goal, kcal: Number(r.kcal) || null, type: r.type, meals: r.meals, period: r.period });
      if (!g) return;
      const keep = r.name && !/^(Nuevo plan|Plan de )/.test(r.name);
      Object.assign(r, { goal: g.goal, type: g.type, kcal: g.kcal, meals: g.meals, period: g.period, water: g.water, note: g.note, days: g.days, params: g.params, name: keep || member ? r.name : g.name });
      fill(); drawPer(); day = 0; drawDays(); drawDay(); toast('Plan generado: revísalo y ajusta lo que quieras');
    };
    $('[data-del]')?.addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'Eliminar', message: `¿Eliminar <b>${esc(r.name)}</b>?`, confirmText: 'Eliminar', danger: true }))) return;
      await deleteDiet({ id }); saved = { deleted: true }; m.close(); toast('Eliminado', 'warning');
    });
    $('[data-ok]').onclick = async (e) => {
      const btn = e.currentTarget; setBusy(btn, true, 'Guardando…');
      try { saved = await saveDiet(r, id, member); m.close(); toast(member ? 'Plan guardado y publicado en su carnet' : 'Plantilla guardada'); if (member && member.phone && !id) setTimeout(() => offerWa(member, saved), 200); }
      catch (ex) { $('[data-err]').textContent = ex.message; setBusy(btn, false); }
    };
    r.period = r.period === 'mensual' ? 'mensual' : 'semanal';
    fill(); drawPer(); drawDays(); drawDay();
  });
}
function offerWa(member, d) {
  const m = openModal({ size: 'sm', title: 'Plan listo', body: `<p class="muted">¿Le avisas a ${esc(member.name.split(' ')[0])} por WhatsApp? Lo verá en su carnet, en «Comidas».</p>`, footer: `<button class="btn btn-secondary" data-close>No</button><button class="btn btn-whatsapp" data-y>${icon('whatsapp')} Avisar</button>` });
  m.el.querySelector('[data-y]').onclick = () => { waMember('alimentacion', { member: { ...member, dietName: d.name } }); m.close(); };
}
export function dietBadge(m) {
  if (!m?.dietId) return '';
  const st = dietStatus({ start: m.dietStart, end: m.dietEnd }, todayKey());
  return `<span class="badge badge-${st?.k === 'ven' ? 'neutral' : st?.k === 'pen' ? 'violet' : 'success'}">${esc(st?.label || '')}</span>`;
}

// ======================================================================
// IMPRESIÓN
// ======================================================================
export function printDiet(p, member = null) {
  const weeks = Math.ceil((p.days || []).length / 7);
  printDoc(`Plan de alimentación: ${p.name}${member ? ' · ' + member.name : ''}`, `
    <div class="kpis">${member ? `<div class="kpi">Alumno<b>${esc(member.name)}</b>${esc(member.number || '')}</div>` : ''}${p.goal ? `<div class="kpi">Objetivo<b>${esc(p.goal)}</b></div>` : ''}${p.kcal ? `<div class="kpi">Calorías<b>${n0(p.kcal)} kcal/día</b></div>` : ''}<div class="kpi">Duración<b>${p.period === 'mensual' ? '4 semanas' : '7 días'}</b>${p.start ? `${fmtDate(p.start)} → ${fmtDate(p.end)}` : ''}</div>${p.water ? `<div class="kpi">Agua<b>${String(p.water).replace('.', ',')} L/día</b></div>` : ''}${p.trainer ? `<div class="kpi">Entrenador<b>${esc(p.trainer)}</b></div>` : ''}</div>
    ${p.note ? `<p>${esc(p.note)}</p>` : ''}
    ${(p.days || []).map((d, i) => { const t = dayNut(d); return `<div class="day"><h2>${esc(dayLabel(p, i))} <small style="font-weight:normal;color:#666">· ${n0(t.kcal)} kcal · P ${t.p} g · C ${t.c} g · G ${t.f} g</small></h2><table><tbody>
      ${(d.meals || []).map((ml) => `<tr><td style="width:22%"><b>${esc(ml.name)}</b>${ml.time ? `<div class="muted">${esc(ml.time)}</div>` : ''}</td><td>${ml.title ? `<b>${esc(ml.title)}</b><br>` : ''}${(ml.items || []).map((it) => `${esc(qtyText(it))} ${esc(itemName(it).toLowerCase())}`).join(' · ')}</td><td class="c" style="width:12%">${n0(sumNut(ml.items).kcal)} kcal</td></tr>`).join('')}</tbody></table></div>`; }).join('')}
    ${Array.from({ length: weeks }, (_, w) => `<div class="day"><h2>Lista de compras · semana ${w + 1}</h2><table><tbody>${shoppingList(p, w).map((g) => `<tr><td style="width:22%"><b>${esc(g.group)}</b></td><td>${g.items.map((x) => `${esc(x.name)}: <b>${esc(x.qty)}</b>`).join(' · ')}</td></tr>`).join('')}</tbody></table></div>`).join('')}`);
}
