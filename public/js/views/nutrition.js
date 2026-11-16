// SanoEntrenador — Alimentación: plantillas de planes, base de alimentos y planes asignados a los alumnos
import { store } from '../store.js';
import { esc, emptyState, debounce, normalize, todayKey } from '../utils.js';
import { icon } from '../icons.js';
import { FOODS, FOOD_GROUPS } from '../nutrition.js';
import { allDietTemplates, viewDiet, dietGenerator, dietEditor, assignDietTemplate, portionText, dietBadge } from '../diet.js';
import { allNutriTemplates, viewNutri, nutriGenerator, nutriEditor, assignNutriTemplate, nutriBadge } from '../nutriui.js';
import { pendingExtras } from '../ops.js';
import { avatar, hydratePhotos, openMember, pickMember } from '../member.js';

export function mount(el) {
  let tab = 'plantillas'; let q = ''; let g = '';
  el.innerHTML = `
    <div class="view-header"><div><h1 class="view-title">Alimentación y nutrición</h1><p class="view-sub">Planes alimenticios (menú de cada día) y planes de nutrición (metas, agua, suplementos y hábitos), semanales o mensuales. Tus alumnos los ven en su carnet, en «Comidas».</p></div>
      <div class="view-actions"><button class="btn btn-secondary" id="nt-assign">${icon('userCheck')} Asignar a un alumno</button><button class="btn btn-secondary" id="nt-gen">${icon('sparkle')} Crear a la medida</button><button class="btn btn-primary" id="nt-new">${icon('plus')} Nueva plantilla</button></div></div>
    <div class="card card-flush" data-tour="diets"><div class="tabs" id="nt-tabs" style="padding:0 12px"></div><div id="nt-b" style="padding:16px"></div></div>`;
  const $ = (s) => el.querySelector(s);

  const openTpl = (t) => {
    const md = viewDiet(t);
    const foot = md.el.querySelector('.modal-footer');
    foot.insertAdjacentHTML('beforeend', `<button class="btn btn-secondary" data-edit>${icon('edit')} ${t.custom ? 'Editar' : 'Copiar y editar'}</button><button class="btn btn-primary" data-as>${icon('userCheck')} Asignar</button>`);
    foot.querySelector('[data-edit]').onclick = () => { md.close(); const c = JSON.parse(JSON.stringify(t)); if (!t.custom) { delete c.id; c.name = `${t.name} (mi versión)`; } dietEditor(c, { fresh: !t.custom }); };
    foot.querySelector('[data-as]').onclick = () => { md.close(); assign(t); };
  };
  async function assign(t = null) {
    const m = await pickMember({ title: t ? `Asignar: ${t.name}` : 'Asignar plan de alimentación', allowNew: false });
    if (!m) return;
    if (!t) return assignDietTemplate(m);
    const c = JSON.parse(JSON.stringify(t)); delete c.id; delete c.custom; delete c.builtin; delete c.template;
    return dietEditor(c, { member: m, fresh: true });
  }

  const openNtpl = (t) => {
    const md = viewNutri(t);
    const foot = md.el.querySelector('.modal-footer');
    foot.insertAdjacentHTML('beforeend', `<button class="btn btn-secondary" data-edit>${icon('edit')} ${t.custom ? 'Editar' : 'Copiar y editar'}</button><button class="btn btn-primary" data-as>${icon('userCheck')} Asignar</button>`);
    foot.querySelector('[data-edit]').onclick = () => { md.close(); const c = JSON.parse(JSON.stringify(t)); if (!t.custom) { delete c.id; c.name = `${t.name} (mi versión)`; } nutriEditor(c, { fresh: !t.custom }); };
    foot.querySelector('[data-as]').onclick = async () => { md.close(); const m = await pickMember({ title: `Asignar: ${t.name}`, allowNew: false }); if (m) assignNutriTemplate(m); };
  };
  function render() {
    const assigned = store.members.filter((m) => m.active !== false && (m.dietId || m.nutriId));
    const pend = store.members.map((m) => ({ m, p: pendingExtras(m) })).filter((x) => x.p.length);
    const T = { plantillas: `Alimenticios (${allDietTemplates().length})`, nutricion: `Nutrición (${allNutriTemplates().length})`, alimentos: `Alimentos (${FOODS.length})`, asignados: `Asignados (${assigned.length})${pend.length ? ` · ${pend.length} pendiente(s)` : ''}` };
    $('#nt-tabs').innerHTML = Object.entries(T).map(([k, v]) => `<button class="${tab === k ? 'on' : ''}" data-t="${k}">${v}</button>`).join('');
    el.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t; render(); });
    const B = $('#nt-b');
    if (tab === 'plantillas') {
      const list = allDietTemplates();
      B.innerHTML = `<div class="tpl-grid"><button type="button" class="tpl tpl-gen" data-gen><span class="plan-flag">A la medida</span><b>${icon('sparkle')} Crear un plan automático</b><small>Elige objetivo, calorías, tipo de comida y si es semanal o mensual</small></button>
        ${list.map((t, i) => `<button type="button" class="tpl" data-i="${i}">${t.custom ? '<span class="plan-flag alt">Tuya</span>' : ''}<b>${esc(t.name)}</b><small>${esc(t.desc || t.note || '').slice(0, 100)}</small><span class="t-sub">${t.meals || ''} comidas al día · ${t.period === 'mensual' ? '4 semanas' : '7 días'}</span></button>`).join('')}</div>`;
      B.querySelector('[data-gen]').onclick = async () => { const p = await dietGenerator(null); if (p) dietEditor(p, { fresh: true }); };
      B.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => openTpl(list[Number(b.dataset.i)]));
    } else if (tab === 'nutricion') {
      const list = allNutriTemplates();
      B.innerHTML = `<p class="hint mb">Metas diarias (calorías, proteína, carbohidratos, grasa, agua y fibra), horarios, suplementos, qué priorizar o evitar y hábitos que el alumno marca cada día. Al asignarlo se ajusta a su peso.</p>
        <div class="tpl-grid"><button type="button" class="tpl tpl-gen" data-ngen><span class="plan-flag">A la medida</span><b>${icon('sparkle')} Calcular un plan de nutrición</b><small>Con el peso, el objetivo y los días de entreno</small></button>
        <button type="button" class="tpl" data-nnew><b>${icon('plus')} Nueva plantilla</b><small>Arma tu propio plan de nutrición desde cero</small></button>
        ${list.map((t, i) => `<button type="button" class="tpl" data-ni="${i}">${t.custom ? '<span class="plan-flag alt">Tuya</span>' : ''}<b>${esc(t.name)}</b><small>${esc(t.desc || t.note || '').slice(0, 100)}</small><span class="t-sub">${Math.round(t.kcal || 0)} kcal · ${Math.round(t.protein || 0)} g proteína (ref. ${String(t.weight || 70).replace('.', ',')} kg)</span></button>`).join('')}</div>`;
      B.querySelector('[data-ngen]').onclick = async () => { const p = await nutriGenerator(null); if (p) nutriEditor(p, { fresh: true }); };
      B.querySelector('[data-nnew]').onclick = () => nutriEditor(null);
      B.querySelectorAll('[data-ni]').forEach((b) => b.onclick = () => openNtpl(list[Number(b.dataset.ni)]));
    } else if (tab === 'alimentos') {
      B.innerHTML = `<div class="stack"><div class="search">${icon('search')}<input class="input" id="nt-q" placeholder="Buscar alimento…" value="${esc(q)}"></div><div class="chips chips-scroll" id="nt-g"></div><div class="small muted" id="nt-n"></div><div class="food-grid" id="nt-l"></div></div>`;
      const draw = () => {
        B.querySelector('#nt-g').innerHTML = ['', ...FOOD_GROUPS].map((x) => `<button class="chip ${x === g ? 'on' : ''}" data-g="${esc(x)}">${x || 'Todos'}</button>`).join('');
        B.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => { g = b.dataset.g; draw(); });
        const nq = normalize(q);
        const list = FOODS.filter((f) => (!g || f.group === g) && (!nq || normalize(f.name).includes(nq)));
        B.querySelector('#nt-n').textContent = `${list.length} alimento(s) · valores aproximados por porción`;
        B.querySelector('#nt-l').innerHTML = list.map((f) => `<div class="food-c"><b>${esc(f.name)}</b><small>${esc(f.group)} · ${portionText(f)}</small>
          <div class="food-m"><span class="fk">${Math.round(f.kcal)} kcal</span><span>P ${f.p}</span><span>C ${f.c}</span><span>G ${f.f}</span></div>
          <div class="food-t">${f.tags.includes('v') ? '<span class="tag">Vegetariano</span>' : ''}${f.tags.includes('l') ? '<span class="tag">Bajo en carbohidratos</span>' : ''}${f.tags.includes('e') ? '<span class="tag">Económico</span>' : ''}</div></div>`).join('') || emptyState('search', 'Sin resultados', '');
      };
      B.querySelector('#nt-q').oninput = debounce((e) => { q = e.target.value; draw(); }, 100);
      draw();
    } else {
      const t = todayKey();
      const PL = { diet: ['utensils', 'Plan alimenticio', 'alimentacion'], nutri: ['droplet', 'Plan de nutrición', 'nutricion'] };
      const pendHTML = pend.length ? `<div class="card card-warn mb"><div class="card-title">${icon('alert')} Pagaron y aún no lo tienen (${pend.length})</div><div class="list">${pend.map(({ m, p }) => `<div class="list-item">${avatar(m)}<div class="grow" style="min-width:0"><b class="ellipsis">${esc(m.name)}</b><div class="t-sub ellipsis">${esc(m.membership?.planName || '')}</div></div><div class="row row-wrap">${p.map((k) => `<button class="btn btn-primary btn-sm" data-pm="${m.id}" data-pt="${PL[k][2]}">${icon(PL[k][0])} ${PL[k][1]}</button>`).join('')}</div></div>`).join('')}</div></div>` : '';
      const line = (m) => [m.dietId ? `${icon('utensils')} ${esc(m.dietName || '')}` : '', m.nutriId ? `${icon('droplet')} ${esc(m.nutriName || '')}` : ''].filter(Boolean).join(' · ');
      B.innerHTML = pendHTML + (assigned.length ? `<div class="list">${assigned.sort((a, b) => ((b.dietStart || b.nutriStart || '')).localeCompare(a.dietStart || a.nutriStart || '')).map((m) => `<button class="list-item" data-m="${m.id}" data-mt="${m.dietId ? 'alimentacion' : 'nutricion'}">${avatar(m)}<div class="grow" style="min-width:0"><b class="ellipsis">${esc(m.name)}</b><div class="t-sub ellipsis">${line(m)}</div></div>${dietBadge(m) || nutriBadge(m)}</button>`).join('')}</div>
        ${assigned.some((m) => m.dietEnd && m.dietEnd < t) ? '<p class="hint mt">Los planes terminados siguen visibles en el carnet hasta que asignes uno nuevo.</p>' : ''}`
        : emptyState('utensils', 'Ningún alumno tiene plan asignado', 'Asigna una plantilla o crea uno a su medida. Lo ve en su carnet, en «Comidas».'));
      B.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => openMember(b.dataset.m, { tab: b.dataset.mt }));
      B.querySelectorAll('[data-pm]').forEach((b) => b.onclick = () => openMember(b.dataset.pm, { tab: b.dataset.pt }));
      hydratePhotos(B);
    }
  }
  $('#nt-new').onclick = () => dietEditor(null);
  $('#nt-gen').onclick = async () => { const p = await dietGenerator(null); if (p) dietEditor(p, { fresh: true }); };
  $('#nt-assign').onclick = () => assign();
  render();
  const off = store.on('*', (e) => { if (e === 'dietTemplates' || e === 'nutriTemplates' || e === 'members') render(); });
  return () => off();
}
