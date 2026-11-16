// SanoEntrenador — Planes de nutrición en el panel: visor, generador, plantillas, editor e impresión
import { store } from './store.js';
import { saveNutri, deleteNutri } from './ops.js';
import { openModal, esc, toast, setBusy, debounce, confirmDialog, todayKey, fmtDate } from './utils.js';
import { icon } from './icons.js';
import { printDoc, waMember } from './shared.js';
import { ageOf, energyOf } from './gym.js';
import { dietStatus } from './nutrition.js';
import { NUTRI_GOALS, NUTRI_TYPES, NUTRI_DISCLAIMER, SUPPLEMENTS, generateNutri, fitNutri, nutriTemplates, nutriKcal, nutriMacros } from './nutri.js';

const n0 = (n) => Math.round(Number(n) || 0).toLocaleString('es-VE');
const dec = (n) => String(n ?? '').replace('.', ',');
export const allNutriTemplates = () => [...store.nutriTemplates.map((t) => ({ ...t, custom: true })), ...nutriTemplates()];

/** Objetivo de nutrición a partir del objetivo del alumno */
export function nutriGoalOf(goal = '') {
  if (/bajar/i.test(goal)) return 'Bajar de peso';
  if (/tonific|defin/i.test(goal)) return 'Definición';
  if (/masa|fuerza/i.test(goal)) return 'Ganar masa muscular';
  if (/rendim|deport|resist|correr/i.test(goal)) return 'Rendimiento deportivo';
  if (/salud|rehab|movil|flexib/i.test(goal)) return 'Salud general';
  return 'Mantener el peso';
}
/** Peso y calorías del alumno (de su última evaluación) */
export function memberRef(member, goal) {
  const ev = member?.lastEval; const weight = ev?.weight || null;
  const e = weight && (ev.height || member.height) ? energyOf({ sex: member.sex, weight, height: ev.height || member.height, age: ageOf(member.birthDate) || 30, activity: member.activity || 1.55, goal: member.goal || '' }) : null;
  return { weight, kcal: nutriKcal(goal, e?.tdee), from: weight ? `Con su última evaluación: ${dec(weight)} kg${e ? ` · gasto diario ≈ ${n0(e.tdee)} kcal` : ''}` : 'Sin evaluación: se usa un peso de referencia de 70 kg' };
}
export function nutriBadge(m) {
  if (!m?.nutriId) return '';
  const st = dietStatus({ start: m.nutriStart, end: m.nutriEnd }, todayKey());
  return `<span class="badge badge-${st?.k === 'ven' ? 'neutral' : st?.k === 'pen' ? 'violet' : 'success'}">${esc(st?.label || '')}</span>`;
}

// ======================================================================
// VISOR
// ======================================================================
export function nutriMacrosHTML(p) {
  const k = Math.max(1, (p.protein || 0) * 4 + (p.carbs || 0) * 4 + (p.fat || 0) * 9);
  const pc = (g, f) => Math.round(((g || 0) * f * 100) / k);
  return `<div class="nu-mac">
    <div class="nu-k"><b>${n0(p.kcal)}</b><small>kcal al día</small></div>
    <div class="nu-m p"><b>${n0(p.protein)} g</b><small>Proteína · ${pc(p.protein, 4)} %</small></div>
    <div class="nu-m c"><b>${n0(p.carbs)} g</b><small>Carbohidratos · ${pc(p.carbs, 4)} %</small></div>
    <div class="nu-m f"><b>${n0(p.fat)} g</b><small>Grasa · ${pc(p.fat, 9)} %</small></div>
    <div class="nu-m w"><b>${dec(p.water || '—')} L</b><small>Agua</small></div>
    <div class="nu-m"><b>${n0(p.fiber)} g</b><small>Fibra</small></div>
  </div>`;
}
const ul = (a) => `<ul>${(a || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
export function nutriViewHTML(p) {
  return `<div class="stack">
    <div class="t-sub">${esc(p.goal || '')}${p.type === 'veg' ? ' · Vegetariano' : ''} · ${p.period === 'mensual' ? 'Mensual (4 semanas)' : 'Semanal (7 días)'}${p.weight ? ` · peso de referencia ${dec(p.weight)} kg` : ''}${p.meals ? ` · ${p.meals} comidas al día` : ''}${p.start ? ` · ${fmtDate(p.start)} → ${fmtDate(p.end)}` : ''}</div>
    ${nutriMacrosHTML(p)}
    ${(p.timing || []).length ? `<div><div class="section-title">${icon('clock')} Horarios</div><div class="nu-time">${p.timing.map((t) => `<div><b>${esc(t.when)}</b><span>${esc(t.text)}</span></div>`).join('')}</div></div>` : ''}
    ${(p.supplements || []).length ? `<div><div class="section-title">${icon('sparkle')} Suplementos</div><div class="nu-sup">${p.supplements.map((x) => `<div><b>${esc(x.name)}</b><span>${esc(x.dose)}</span><small>${esc(x.when)}</small></div>`).join('')}</div></div>` : ''}
    <div class="nu-cols"><div class="nu-col ok"><b>${icon('check')} Prioriza</b>${ul(p.prioritize)}</div><div class="nu-col mid"><b>${icon('info')} Modera</b>${ul(p.moderate)}</div><div class="nu-col no"><b>${icon('x')} Evita</b>${ul(p.avoid)}</div></div>
    ${(p.habits || []).length ? `<div><div class="section-title">${icon('checkCircle')} Hábitos diarios <small class="muted">(el alumno los marca en su carnet)</small></div><div class="chips">${p.habits.map((h) => `<span class="chip">${esc(h)}</span>`).join('')}</div></div>` : ''}
    ${p.period === 'mensual' && (p.phases || []).length ? `<div><div class="section-title">${icon('layers')} Las 4 semanas</div><div class="nu-time">${p.phases.map((x) => `<div><b>${esc(x.title)}</b><span>${esc(x.text)}</span></div>`).join('')}</div></div>` : ''}
    ${p.note ? `<div class="box small">${icon('info')} ${esc(p.note)}</div>` : ''}
    <p class="hint">${esc(NUTRI_DISCLAIMER)}</p>
  </div>`;
}
export function viewNutri(p, { member = null } = {}) {
  const m = openModal({ title: p.name, sub: member ? esc(member.name) : p.desc ? esc(p.desc) : 'Plan de nutrición', size: 'lg', body: nutriViewHTML(p),
    footer: `<button class="btn btn-secondary btn-icon" data-pr aria-label="Imprimir">${icon('print')}</button><span class="grow"></span><button class="btn btn-secondary" data-close>Cerrar</button>` });
  m.el.querySelector('[data-pr]').onclick = () => printNutri(p, member);
  return m;
}

// ======================================================================
// GENERADOR A LA MEDIDA
// ======================================================================
export function nutriGenerator(member = null, preset = {}) {
  return new Promise((resolve) => {
    let out = null;
    const goal = preset.goal || nutriGoalOf(member?.goal);
    const ref = memberRef(member, goal);
    const v = { goal, weight: preset.weight || ref.weight || 70, kcal: preset.kcal || ref.kcal, type: preset.type || 'todo', trainDays: preset.trainDays || 4, period: preset.period || 'mensual' };
    const opt = (name, list, cur) => list.map(([k, l]) => `<button type="button" class="seg-b ${String(cur) === String(k) ? 'on' : ''}" data-n="${name}" data-v="${k}">${l}</button>`).join('');
    const m = openModal({
      title: 'Plan de nutrición a la medida', sub: member ? esc(member.name) : 'Se calcula solo: luego cambias lo que quieras.', size: 'md',
      body: `<div class="stack gen">
        <div class="form-grid"><div class="field full"><label>Objetivo</label><select class="select" data-g>${NUTRI_GOALS.map((g) => `<option ${g === v.goal ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
        <div class="field"><label>Peso (kg)</label><input class="input" data-w inputmode="decimal" value="${dec(v.weight)}"><small class="hint">${esc(member ? ref.from : 'Peso del alumno')}</small></div>
        <div class="field"><label>Calorías por día</label><input class="input" data-k inputmode="numeric" value="${v.kcal}"><small class="hint">Según el objetivo</small></div></div>
        <div class="field"><label>Alimentación</label><div class="seg">${opt('type', Object.entries(NUTRI_TYPES), v.type)}</div></div>
        <div class="field"><label>Días de entreno por semana</label><div class="seg">${opt('trainDays', [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']], v.trainDays)}</div></div>
        <div class="field"><label>Duración</label><div class="seg">${opt('period', [['semanal', `${icon('calendar')} Semanal`], ['mensual', `${icon('layers')} Mensual (4 fases)`]], v.period)}</div></div>
        <div class="gen-prev" data-prev></div></div>`,
      footer: `<span class="grow"></span><button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-ok>${icon('sparkle')} Usar este plan</button>`,
      onClose: () => resolve(out)
    });
    const $ = (s) => m.el.querySelector(s);
    const prev = () => {
      v.goal = $('[data-g]').value;
      v.weight = Math.max(35, Math.min(200, Number(String($('[data-w]').value).replace(',', '.')) || v.weight));
      v.kcal = Math.max(1000, Math.min(5000, Number($('[data-k]').value) || v.kcal));
      const p = generateNutri(v);
      $('[data-prev]').innerHTML = `<div class="gen-h"><b>${esc(p.name)}</b><small>${p.supplements.length} suplementos sugeridos · ${p.habits.length} hábitos · ${p.timing.length} horarios</small></div>${nutriMacrosHTML(p)}`;
      return p;
    };
    $('[data-g]').onchange = () => { $('[data-k]').value = memberRef(member, $('[data-g]').value).kcal; prev(); };
    $('[data-k]').oninput = debounce(prev, 300); $('[data-w]').oninput = debounce(prev, 300);
    m.el.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => { v[b.dataset.n] = b.dataset.n === 'trainDays' ? Number(b.dataset.v) : b.dataset.v; m.el.querySelectorAll(`[data-n="${b.dataset.n}"]`).forEach((x) => x.classList.toggle('on', x === b)); prev(); });
    $('[data-ok]').onclick = () => { out = prev(); if (member) out.name = `${out.name} · ${String(member.name).split(' ')[0]}`; m.close(); };
    prev();
  });
}

// ======================================================================
// ELEGIR PLANTILLA PARA UN ALUMNO (se ajusta a su peso y calorías)
// ======================================================================
const copyNutri = (t) => { const c = JSON.parse(JSON.stringify(t)); for (const k of ['id', 'custom', 'builtin', 'template', 'desc', 'start', 'end', 'memberId', 'memberName', 'createdAt', 'updatedAt', 'by']) delete c[k]; return c; };
export function assignNutriTemplate(member) {
  return new Promise((resolve) => {
    let out = null;
    const goal = nutriGoalOf(member.goal); const ref = memberRef(member, goal);
    const list = allNutriTemplates().map((t) => ({ t, s: (t.goal === goal ? 3 : 0) + (t.custom ? 0.5 : 0) })).sort((a, b) => b.s - a.s);
    const m = openModal({
      title: 'Plan de nutrición', sub: `${esc(member.name)} · sugerido: ${esc(goal)}${ref.weight ? ` · ${dec(ref.weight)} kg` : ''}`, size: 'lg',
      body: `<p class="hint mb">La plantilla se ajusta sola a su peso y sus calorías. Antes de guardar puedes cambiar todo.</p><div class="tpl-grid"><button type="button" class="tpl tpl-gen" data-gen><span class="plan-flag">A su medida</span><b>${icon('sparkle')} Calcular su plan</b><small>Con su peso, su objetivo y sus días de entreno</small></button>${list.map(({ t }, i) => `<button type="button" class="tpl" data-i="${i}">
        ${i === 0 && !t.custom ? '<span class="plan-flag">Recomendado</span>' : t.custom ? '<span class="plan-flag alt">Tuyo</span>' : ''}
        <b>${esc(t.name)}</b><small>${esc(t.desc || t.note || '').slice(0, 90)}</small><span class="t-sub">${esc(t.goal)} · ${t.period === 'mensual' ? 'mensual' : 'semanal'}</span></button>`).join('')}</div>`,
      footer: '<button class="btn btn-secondary" data-close>Cancelar</button>',
      onClose: () => resolve(out)
    });
    m.el.querySelector('[data-gen]').onclick = async () => { m.close(); const g = await nutriGenerator(member); out = g ? await nutriEditor(g, { member, fresh: true }) : null; resolve(out); };
    m.el.querySelectorAll('[data-i]').forEach((b) => b.onclick = async () => {
      const t = list[+b.dataset.i].t; m.close();
      const r = memberRef(member, t.goal);
      const fit = fitNutri(copyNutri(t), { weight: r.weight || t.weight, kcal: r.weight ? r.kcal : t.kcal });
      fit.name = `${t.name} · ${String(member.name).split(' ')[0]}`;
      out = await nutriEditor(fit, { member, fresh: true }); resolve(out);
    });
  });
}

// ======================================================================
// EDITOR
// ======================================================================
/** Editor del plan de nutrición. member: se publica en su carnet · sin member: plantilla */
export function nutriEditor(plan = null, { member = null, fresh = false } = {}) {
  const goal0 = nutriGoalOf(member?.goal);
  const ref0 = memberRef(member, goal0);
  const r = JSON.parse(JSON.stringify(plan || { ...generateNutri({ goal: goal0, weight: ref0.weight || 70, kcal: ref0.kcal, period: 'mensual' }), name: member ? `Nutrición de ${String(member.name).split(' ')[0]}` : 'Nuevo plan de nutrición' }));
  if (member) r.start = r.start && !fresh ? r.start : todayKey(); else delete r.start;
  const id = fresh ? null : plan?.id || null;
  r.timing ||= []; r.supplements ||= []; r.phases ||= [];
  return new Promise((resolve) => {
    let saved = null;
    const F = (k, label, attrs = '') => `<div class="field"><label>${label}</label><input class="input" data-k="${k}" ${attrs}></div>`;
    const TA = (k, label, hint) => `<div class="field"><label>${label}</label><textarea class="textarea" rows="5" data-k="${k}"></textarea><small class="hint">${hint}</small></div>`;
    const m = openModal({
      title: member ? (id ? 'Editar plan de nutrición' : 'Plan de nutrición') : (id ? 'Editar plantilla de nutrición' : 'Nueva plantilla de nutrición'), sub: member ? esc(member.name) : 'Las plantillas se ajustan al peso de cada alumno al asignarlas.', size: 'xl',
      body: `<div class="stack nu-ed">
        <div class="form-grid form-grid-3">
          <div class="field" style="grid-column:span 2"><label>Nombre</label><input class="input" data-k="name"></div>
          <div class="field"><label>Objetivo</label><select class="select" data-k="goal">${NUTRI_GOALS.map((g) => `<option>${g}</option>`).join('')}</select></div>
          <div class="field"><label>Duración</label><div class="seg" data-per><button type="button" class="seg-b" data-p="semanal">Semanal</button><button type="button" class="seg-b" data-p="mensual">Mensual</button></div></div>
          <div class="field"><label>Alimentación</label><select class="select" data-k="type">${Object.entries(NUTRI_TYPES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
          ${member ? '<div class="field"><label>Empieza</label><input class="input" type="date" data-k="start"></div>' : F('meals', 'Comidas al día', 'inputmode="numeric"')}
        </div>
        <div class="section-title">${icon('target')} Metas diarias</div>
        <div class="form-grid form-grid-4">
          ${F('weight', 'Peso de referencia (kg)', 'inputmode="decimal"')}${F('kcal', 'Calorías (kcal)', 'inputmode="numeric"')}${F('protein', 'Proteína (g)', 'inputmode="numeric"')}${F('carbs', 'Carbohidratos (g)', 'inputmode="numeric"')}
          ${F('fat', 'Grasa (g)', 'inputmode="numeric"')}${F('water', 'Agua (litros)', 'inputmode="decimal"')}${F('fiber', 'Fibra (g)', 'inputmode="numeric"')}
          <div class="field"><label>&nbsp;</label><button type="button" class="btn btn-secondary" data-calc>${icon('refresh')} Recalcular macros</button></div>
        </div>
        <div class="small muted" data-chk></div>
        <div class="section-title">${icon('clock')} Horarios</div><div class="nu-rows" data-rows="timing"></div>
        <button type="button" class="btn btn-ghost btn-sm" data-add="timing">${icon('plus')} Agregar horario</button>
        <div class="section-title">${icon('sparkle')} Suplementos</div><div class="nu-rows" data-rows="supplements"></div>
        <div class="row row-wrap"><button type="button" class="btn btn-ghost btn-sm" data-add="supplements">${icon('plus')} Agregar suplemento</button><span class="chips">${SUPPLEMENTS.map((s, i) => `<button type="button" class="chip" data-qs="${i}">+ ${esc(s.name.split(' (')[0])}</button>`).join('')}</span></div>
        <div class="section-title">${icon('utensils')} Alimentos</div>
        <div class="form-grid form-grid-3">${TA('prioritize', 'Prioriza', 'Uno por línea')}${TA('moderate', 'Modera', 'Uno por línea')}${TA('avoid', 'Evita', 'Uno por línea')}</div>
        <div class="form-grid">${TA('habits', 'Hábitos diarios', 'Uno por línea · el alumno los marca cada día en su carnet')}<div class="field"><label>Indicaciones generales</label><textarea class="textarea" rows="5" data-k="note"></textarea></div></div>
        <div data-ph></div>
        <div class="error-msg" data-err></div></div>`,
      footer: `${id ? `<button class="btn btn-danger-soft" data-del>${icon('trash')} Eliminar</button>` : ''}<button class="btn btn-ghost" data-gen>${icon('sparkle')} Calcular automáticamente</button><span class="grow"></span><button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-ok>${icon('check')} Guardar${member ? ' y publicar en su carnet' : ''}</button>`,
      onClose: () => resolve(saved)
    });
    const $ = (s) => m.el.querySelector(s);
    const K = (k) => m.el.querySelector(`[data-k="${k}"]`);
    const ROWS = { timing: [['when', 'Momento'], ['text', 'Qué comer o hacer']], supplements: [['name', 'Suplemento'], ['dose', 'Dosis'], ['when', 'Cuándo']] };
    const blank = { timing: { when: '', text: '' }, supplements: { name: '', dose: '', when: '' } };
    function fill() {
      for (const k of ['name', 'goal', 'type', 'weight', 'kcal', 'protein', 'carbs', 'fat', 'water', 'fiber', 'start', 'meals']) { const el = K(k); if (el) el.value = k === 'weight' || k === 'water' ? dec(r[k] ?? '') : r[k] ?? ''; }
      for (const k of ['prioritize', 'moderate', 'avoid', 'habits']) K(k).value = (r[k] || []).join('\n');
      K('note').value = r.note || '';
      drawRows('timing'); drawRows('supplements'); drawPer(); chk();
    }
    function drawRows(kind) {
      const box = $(`[data-rows="${kind}"]`);
      box.innerHTML = r[kind].map((row, i) => `<div class="nu-row nu-row-${kind}">${ROWS[kind].map(([f, ph]) => `<input class="input" data-rk="${kind}" data-i="${i}" data-f="${f}" placeholder="${ph}" value="${esc(row[f] || '')}">`).join('')}<button type="button" class="btn btn-ghost btn-icon btn-sm" data-rx="${kind}" data-i="${i}" aria-label="Quitar">${icon('x')}</button></div>`).join('') || '<div class="small muted">Nada todavía.</div>';
      box.querySelectorAll('[data-rk]').forEach((inp) => inp.oninput = () => { r[kind][+inp.dataset.i][inp.dataset.f] = inp.value; });
      box.querySelectorAll('[data-rx]').forEach((b) => b.onclick = () => { r[kind].splice(+b.dataset.i, 1); drawRows(kind); });
    }
    function drawPer() {
      m.el.querySelectorAll('[data-p]').forEach((b) => b.classList.toggle('on', b.dataset.p === r.period));
      const ph = $('[data-ph]');
      if (r.period !== 'mensual') { ph.innerHTML = ''; return; }
      if (r.phases.length < 4) r.phases = generateNutri({ goal: K('goal').value }).phases;
      ph.innerHTML = `<div class="section-title">${icon('layers')} Las 4 semanas del mes</div><div class="nu-rows">${r.phases.map((x, i) => `<div class="nu-row nu-row-phase"><input class="input" data-ph="${i}" data-f="title" value="${esc(x.title)}"><input class="input" data-ph="${i}" data-f="text" value="${esc(x.text)}"></div>`).join('')}</div>`;
      ph.querySelectorAll('[data-ph]').forEach((inp) => inp.oninput = () => { r.phases[+inp.dataset.ph][inp.dataset.f] = inp.value; });
    }
    const numv = (k) => Number(String(K(k)?.value || '').replace(',', '.')) || 0;
    function chk() {
      const sum = numv('protein') * 4 + numv('carbs') * 4 + numv('fat') * 9; const k = numv('kcal');
      const w = numv('weight');
      $('[data-chk]').innerHTML = sum ? `Los macros suman <b>${n0(sum)} kcal</b>${k ? ` (${sum > k * 1.06 || sum < k * 0.94 ? '<span class="text-warning">no coincide con la meta: usa «Recalcular macros»</span>' : 'coincide con la meta'})` : ''}${w ? ` · proteína ${dec(Math.round((numv('protein') / w) * 10) / 10)} g por kg` : ''}` : '';
    }
    ['kcal', 'protein', 'carbs', 'fat', 'weight'].forEach((k) => K(k).addEventListener('input', debounce(chk, 200)));
    function read() {
      const o = { ...r };
      for (const k of ['name', 'goal', 'type', 'start', 'note']) { const el = K(k); if (el) o[k] = el.value; }
      for (const k of ['weight', 'kcal', 'protein', 'carbs', 'fat', 'water', 'fiber', 'meals']) { if (K(k)) o[k] = numv(k) || null; }
      for (const k of ['prioritize', 'moderate', 'avoid', 'habits']) o[k] = K(k).value.split('\n').map((x) => x.trim()).filter(Boolean);
      if (o.weight && o.protein) o.pkg = Math.round((o.protein / o.weight) * 10) / 10;
      if (o.weight && o.fat) o.fkg = Math.round((o.fat / o.weight) * 10) / 10;
      return o;
    }
    m.el.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { r.period = b.dataset.p; drawPer(); });
    m.el.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => { r[b.dataset.add].push({ ...blank[b.dataset.add] }); drawRows(b.dataset.add); });
    m.el.querySelectorAll('[data-qs]').forEach((b) => b.onclick = () => { const w = numv('weight') || 70; const s = { ...SUPPLEMENTS[+b.dataset.qs] }; if (/Cafeína/.test(s.name)) s.dose = `${Math.round((w * 3) / 10) * 10} mg (≈ 3 mg por kg)`; if (r.supplements.some((x) => x.name === s.name)) return toast('Ya está en la lista', 'warning'); r.supplements.push(s); drawRows('supplements'); });
    $('[data-calc]').onclick = () => {
      const o = read(); const mac = nutriMacros({ goal: o.goal, weight: o.weight || 70, kcal: o.kcal || nutriKcal(o.goal) });
      K('protein').value = mac.protein; K('carbs').value = mac.carbs; K('fat').value = mac.fat; if (!o.kcal) K('kcal').value = nutriKcal(o.goal);
      if (o.weight) { K('water').value = dec(Math.round((o.weight * 0.033 + ((o.trainDays || 3) >= 4 ? 0.5 : 0.3)) * 10) / 10); }
      K('fiber').value = Math.round(((numv('kcal') || 2000) / 1000) * 14); chk();
    };
    $('[data-gen]').onclick = async () => {
      if (!(await confirmDialog({ title: 'Calcular plan', message: 'Se reemplazarán metas, horarios, suplementos, alimentos y hábitos. ¿Continuar?', confirmText: 'Calcular' }))) return;
      const o = read();
      const g = await nutriGenerator(member, { goal: o.goal, weight: o.weight, kcal: o.kcal, type: o.type, trainDays: o.trainDays, period: r.period });
      if (!g) return;
      const keep = o.name && !/^(Nuevo plan|Nutrición de )/.test(o.name);
      Object.assign(r, { ...g, name: keep || member ? o.name : g.name, start: o.start });
      fill(); toast('Plan calculado: revísalo y ajusta lo que quieras');
    };
    $('[data-del]')?.addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'Eliminar', message: `¿Eliminar <b>${esc(r.name)}</b>?`, confirmText: 'Eliminar', danger: true }))) return;
      await deleteNutri({ id }); saved = { deleted: true }; m.close(); toast('Eliminado', 'warning');
    });
    $('[data-ok]').onclick = async (e) => {
      const btn = e.currentTarget; setBusy(btn, true, 'Guardando…');
      const o = read(); o.period = r.period; o.timing = r.timing; o.supplements = r.supplements; o.phases = r.phases;
      try { saved = await saveNutri(o, id, member); m.close(); toast(member ? 'Plan de nutrición publicado en su carnet' : 'Plantilla guardada'); if (member && member.phone && !id) setTimeout(() => offerWa(member, saved), 200); }
      catch (ex) { $('[data-err]').textContent = ex.message; setBusy(btn, false); }
    };
    r.period = r.period === 'mensual' ? 'mensual' : 'semanal';
    fill();
  });
}
function offerWa(member, d) {
  const m = openModal({ size: 'sm', title: 'Plan listo', body: `<p class="muted">¿Le avisas a ${esc(member.name.split(' ')[0])} por WhatsApp? Lo verá en su carnet, en «Comidas › Nutrición».</p>`, footer: `<button class="btn btn-secondary" data-close>No</button><button class="btn btn-whatsapp" data-y>${icon('whatsapp')} Avisar</button>` });
  m.el.querySelector('[data-y]').onclick = () => { waMember('nutricion', { member: { ...member, nutriName: d.name } }); m.close(); };
}

// ======================================================================
// IMPRESIÓN
// ======================================================================
export function printNutri(p, member = null) {
  const list = (t, a) => ((a || []).length ? `<td><b>${t}</b><ul>${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></td>` : '');
  printDoc(`Plan de nutrición: ${p.name}${member ? ' · ' + member.name : ''}`, `
    <div class="kpis">${member ? `<div class="kpi">Alumno<b>${esc(member.name)}</b>${esc(member.number || '')}</div>` : ''}<div class="kpi">Calorías<b>${n0(p.kcal)} kcal/día</b></div><div class="kpi">Proteína<b>${n0(p.protein)} g</b></div><div class="kpi">Carbohidratos<b>${n0(p.carbs)} g</b></div><div class="kpi">Grasa<b>${n0(p.fat)} g</b></div><div class="kpi">Agua<b>${dec(p.water)} L</b></div>${p.start ? `<div class="kpi">Vigencia<b>${p.period === 'mensual' ? '4 semanas' : '7 días'}</b>${fmtDate(p.start)} → ${fmtDate(p.end)}</div>` : ''}</div>
    ${p.goal ? `<p><b>Objetivo:</b> ${esc(p.goal)}${p.type === 'veg' ? ' · vegetariano' : ''}${p.fiber ? ` · fibra ${n0(p.fiber)} g` : ''}${p.meals ? ` · ${p.meals} comidas al día` : ''}</p>` : ''}
    ${(p.timing || []).length ? `<div class="day"><h2>Horarios</h2><table><tbody>${p.timing.map((t) => `<tr><td style="width:30%"><b>${esc(t.when)}</b></td><td>${esc(t.text)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${(p.supplements || []).length ? `<div class="day"><h2>Suplementos</h2><table><tbody>${p.supplements.map((x) => `<tr><td style="width:30%"><b>${esc(x.name)}</b></td><td>${esc(x.dose)}</td><td>${esc(x.when)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="day"><h2>Alimentos</h2><table><tbody><tr>${list('Prioriza', p.prioritize)}${list('Modera', p.moderate)}${list('Evita', p.avoid)}</tr></tbody></table></div>
    ${(p.habits || []).length ? `<div class="day"><h2>Hábitos diarios</h2><table><tbody>${p.habits.map((h) => `<tr><td style="width:6%">☐</td><td>${esc(h)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${p.period === 'mensual' && (p.phases || []).length ? `<div class="day"><h2>Las 4 semanas</h2><table><tbody>${p.phases.map((x) => `<tr><td style="width:30%"><b>${esc(x.title)}</b></td><td>${esc(x.text)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${p.note ? `<p>${esc(p.note)}</p>` : ''}<p style="color:#666;font-size:11px">${esc(NUTRI_DISCLAIMER)}</p>`);
}
