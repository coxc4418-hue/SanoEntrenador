// SanoEntrenador — Alimentación: plantillas de planes, base de alimentos y planes asignados a los alumnos
import { store } from '../store.js';
import { esc, emptyState, debounce, normalize, todayKey } from '../utils.js';
import { icon } from '../icons.js';
import { FOODS, FOOD_GROUPS } from '../nutrition.js';
import { allDietTemplates, viewDiet, dietGenerator, dietEditor, assignDietTemplate, portionText, dietBadge } from '../diet.js';
import { avatar, hydratePhotos, openMember, pickMember } from '../member.js';

export function mount(el) {
  let tab = 'plantillas'; let q = ''; let g = '';
  el.innerHTML = `
    <div class="view-header"><div><h1 class="view-title">Planes de alimentación</h1><p class="view-sub">Planes semanales o mensuales para tus alumnos, con porciones, calorías y lista de compras. Lo ven en su carnet, en «Comidas».</p></div>
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

  function render() {
    const assigned = store.members.filter((m) => m.active !== false && m.dietId);
    const T = { plantillas: `Plantillas (${allDietTemplates().length})`, alimentos: `Alimentos (${FOODS.length})`, asignados: `Asignados (${assigned.length})` };
    $('#nt-tabs').innerHTML = Object.entries(T).map(([k, v]) => `<button class="${tab === k ? 'on' : ''}" data-t="${k}">${v}</button>`).join('');
    el.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t; render(); });
    const B = $('#nt-b');
    if (tab === 'plantillas') {
      const list = allDietTemplates();
      B.innerHTML = `<div class="tpl-grid"><button type="button" class="tpl tpl-gen" data-gen><span class="plan-flag">A la medida</span><b>${icon('sparkle')} Crear un plan automático</b><small>Elige objetivo, calorías, tipo de comida y si es semanal o mensual</small></button>
        ${list.map((t, i) => `<button type="button" class="tpl" data-i="${i}">${t.custom ? '<span class="plan-flag alt">Tuya</span>' : ''}<b>${esc(t.name)}</b><small>${esc(t.desc || t.note || '').slice(0, 100)}</small><span class="t-sub">${t.meals || ''} comidas al día · ${t.period === 'mensual' ? '4 semanas' : '7 días'}</span></button>`).join('')}</div>`;
      B.querySelector('[data-gen]').onclick = async () => { const p = await dietGenerator(null); if (p) dietEditor(p, { fresh: true }); };
      B.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => openTpl(list[Number(b.dataset.i)]));
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
      B.innerHTML = assigned.length ? `<div class="list">${assigned.sort((a, b) => (b.dietStart || '').localeCompare(a.dietStart || '')).map((m) => `<button class="list-item" data-m="${m.id}">${avatar(m)}<div class="grow" style="min-width:0"><b class="ellipsis">${esc(m.name)}</b><div class="t-sub ellipsis">${esc(m.dietName || '')}${m.dietPeriod ? ` · ${m.dietPeriod}` : ''}${m.dietEnd ? ` · hasta ${m.dietEnd.split('-').reverse().slice(0, 2).join('/')}` : ''}</div></div>${dietBadge(m)}</button>`).join('')}</div>
        ${assigned.some((m) => m.dietEnd && m.dietEnd < t) ? '<p class="hint mt">Los planes terminados siguen visibles en el carnet hasta que asignes uno nuevo.</p>' : ''}`
        : emptyState('utensils', 'Ningún alumno tiene plan de alimentación', 'Asigna una plantilla o crea uno a su medida. Lo ve en su carnet con el menú de cada día y la lista de compras.');
      B.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => openMember(b.dataset.m, { tab: 'alimentacion' }));
      hydratePhotos(B);
    }
  }
  $('#nt-new').onclick = () => dietEditor(null);
  $('#nt-gen').onclick = async () => { const p = await dietGenerator(null); if (p) dietEditor(p, { fresh: true }); };
  $('#nt-assign').onclick = () => assign();
  render();
  const off = store.on('*', (e) => { if (e === 'dietTemplates' || (e === 'members' && tab === 'asignados')) render(); });
  return () => off();
}
