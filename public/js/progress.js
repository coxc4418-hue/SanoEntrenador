// SanoEntrenador — Avances del alumno: gráficas, antes y ahora, meta y logros.
// Lo usan la ficha del entrenador y el carnet público del alumno (no depende de la sesión).
import { esc, num, fmtDate } from './utils.js';
import { icon } from './icons.js';

export const PROG_MEASURES = [
  ['weight', 'Peso', 'kg'], ['fat', '% grasa', '%'], ['muscle', 'Masa muscular', 'kg'], ['bmi', 'IMC', ''],
  ['waist', 'Cintura', 'cm'], ['hip', 'Cadera', 'cm'], ['chest', 'Pecho', 'cm'], ['arm', 'Brazo', 'cm'],
  ['thigh', 'Muslo', 'cm'], ['calf', 'Pantorrilla', 'cm'], ['neck', 'Cuello', 'cm']
];
const LABEL = Object.fromEntries(PROG_MEASURES.map(([k, l, u]) => [k, { l, u }]));
export const isGainGoal = (goal) => /masa|músculo|muscul|fuerza|ganar/i.test(goal || '');

/** ¿Qué dirección es buena para cada medida según el objetivo? 1 = subir, -1 = bajar, 0 = neutra */
export function goodDir(k, goal) {
  const gain = isGainGoal(goal);
  if (k === 'fat' || k === 'waist') return -1;
  if (k === 'muscle') return 1;
  if (k === 'weight' || k === 'bmi') return gain ? 1 : /bajar|tonificar|salud/i.test(goal || '') || !goal ? -1 : 0;
  if (k === 'hip') return gain ? 0 : -1;
  if (['chest', 'arm', 'thigh', 'calf'].includes(k)) return gain ? 1 : 0;
  return 0;
}
const r1 = (v) => Math.round(Number(v) * 10) / 10;
const has = (v) => v != null && v !== '' && Number(v) > 0;
const sortByDate = (a) => [...a].sort((x, y) => String(x.date).localeCompare(String(y.date)));

/** Serie de peso combinando evaluaciones del entrenador y pesajes del alumno */
export function weightSeries(evals = [], weighins = []) {
  const pts = [
    ...evals.filter((e) => has(e.weight)).map((e) => ({ date: e.date, y: Number(e.weight), src: 'eval' })),
    ...weighins.filter((w) => has(w.weight)).map((w) => ({ date: (w.day || w.at || '').slice(0, 10), y: Number(w.weight), src: 'self' }))
  ].filter((p) => p.date);
  return sortByDate(pts);
}

// ======================================================================
// GRÁFICA (SVG responsivo con área degradada; puntos propios en otro color)
// ======================================================================
let gid = 0;
export function progressChart(points, { unit = '', color = '#f97316', selfColor = '#38bdf8', goal = null, h = 170 } = {}) {
  const pts = points.filter((p) => p.y != null && !Number.isNaN(p.y));
  if (pts.length < 2) {
    return `<div class="pchart-empty">${icon('trend')}<span>${pts.length ? `Primer registro: <b>${num(pts[0].y, 1)}${unit}</b>. Con la próxima medición verás tu curva.` : 'Aún no hay registros.'}</span></div>`;
  }
  const id = `pg${++gid}`;
  const W = 600, H = h, PL = 34, PR = 14, PT = 22, PB = 26;
  const ys = pts.map((p) => p.y).concat(goal ? [goal] : []);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = Math.max(0.5, (hi - lo) * 0.18); lo -= pad; hi += pad;
  const t0 = new Date(pts[0].date).getTime(); const t1 = new Date(pts[pts.length - 1].date).getTime();
  const span = Math.max(1, t1 - t0);
  const X = (p, i) => PL + (t1 === t0 ? (i * (W - PL - PR)) / (pts.length - 1) : ((new Date(p.date).getTime() - t0) / span) * (W - PL - PR));
  const Y = (v) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p, i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  const grid = [0, 0.5, 1].map((f) => { const v = lo + (hi - lo) * f; return `<line x1="${PL}" x2="${W - PR}" y1="${Y(v)}" y2="${Y(v)}" class="pc-grid"/><text x="${PL - 6}" y="${Y(v) + 4}" text-anchor="end" class="pc-ax">${num(v, 1)}</text>`; }).join('');
  // Fechas del eje: separadas al menos 70 px; siempre la primera y la última
  const n1 = pts.length - 1; const xEnd = X(pts[n1], n1); const keep = new Set([0, n1]); let lx = X(pts[0], 0);
  for (let i = 1; i < n1; i++) { const x = X(pts[i], i); if (x - lx >= 70 && xEnd - x >= 70) { keep.add(i); lx = x; } }
  if (n1 > 0 && xEnd - X(pts[0], 0) < 70) keep.delete(0);
  const labels = pts.map((p, i) => (keep.has(i) ? `<text x="${X(p, i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === n1 ? 'end' : 'middle'}" class="pc-ax">${esc(fmtDate(p.date).slice(0, 5))}</text>` : '')).join('');
  const last = pts[pts.length - 1];
  return `<svg class="pchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de progreso">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    ${goal ? `<line x1="${PL}" x2="${W - PR}" y1="${Y(goal)}" y2="${Y(goal)}" class="pc-goal"/><text x="${W - PR}" y="${Y(goal) - 5}" text-anchor="end" class="pc-goal-t">Meta ${num(goal, 1)}${unit}</text>` : ''}
    <path d="${line} L${X(last, pts.length - 1).toFixed(1)} ${H - PB} L${X(pts[0], 0).toFixed(1)} ${H - PB}Z" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle cx="${X(p, i)}" cy="${Y(p.y)}" r="${i === pts.length - 1 ? 6 : 4}" fill="${p.src === 'self' ? selfColor : color}" stroke="var(--surface, #fff)" stroke-width="2"><title>${esc(fmtDate(p.date))}: ${num(p.y, 1)}${unit}${p.src === 'self' ? ' (registrado por ti)' : ''}</title></circle>`).join('')}
    <text x="${X(last, pts.length - 1)}" y="${Y(last.y) - 11}" text-anchor="end" class="pc-last">${num(last.y, 1)}${unit}</text>
    ${labels}
  </svg>`;
}

// ======================================================================
// ANTES Y AHORA
// ======================================================================
export function compareRows(evals, goal) {
  const list = sortByDate(evals);
  if (!list.length) return [];
  const first = list[0]; const last = list[list.length - 1];
  return PROG_MEASURES.filter(([k]) => list.some((e) => has(e[k]))).map(([k, l, u]) => {
    const a = list.find((e) => has(e[k]))?.[k];
    const b = [...list].reverse().find((e) => has(e[k]))?.[k];
    const d = a != null && b != null ? r1(b - a) : null;
    const dir = goodDir(k, goal);
    const tone = d == null || !d ? 'flat' : dir === 0 ? 'neutral' : Math.sign(d) === dir ? 'good' : 'bad';
    return { k, l, u, a, b, d, tone, firstDate: first.date, lastDate: last.date };
  });
}
export function compareTableHTML(evals, goal) {
  const rows = compareRows(evals, goal);
  if (!rows.length) return '';
  const list = sortByDate(evals);
  const one = list.length < 2;
  return `<div class="cmp">
    <div class="cmp-head"><span></span><span>${one ? 'Inicio' : `Antes<small>${fmtDate(list[0].date)}</small>`}</span>${one ? '' : `<span>Ahora<small>${fmtDate(list[list.length - 1].date)}</small></span><span>Cambio</span>`}</div>
    ${rows.map((r) => `<div class="cmp-row"><span class="cmp-l">${esc(r.l)}</span><b>${r.a != null ? num(r.a, 1) : '—'}<small>${esc(r.u)}</small></b>${one ? '' : `<b>${r.b != null ? num(r.b, 1) : '—'}<small>${esc(r.u)}</small></b>
      <span class="delta delta-${r.tone}">${r.d ? `${icon(r.d < 0 ? 'arrowDown' : 'arrowUp')}${num(Math.abs(r.d), 1)}` : '='}</span>`}</div>`).join('')}
  </div>`;
}

// ======================================================================
// META
// ======================================================================
export function goalInfo(evals, weighins, goalWeight) {
  const ser = weightSeries(evals, weighins);
  if (!goalWeight || !ser.length) return null;
  const start = ser[0].y; const now = ser[ser.length - 1].y; const g = Number(goalWeight);
  const total = g - start; const done = now - start;
  const pct = !total ? 100 : Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  const left = r1(Math.abs(g - now));
  const reached = total ? (total < 0 ? now <= g : now >= g) : true;
  return { start, now, goal: g, pct: reached ? 100 : pct, left, reached, down: total < 0 };
}
export function goalBarHTML(info) {
  if (!info) return '';
  return `<div class="goal-card ${info.reached ? 'reached' : ''}">
    <div class="between"><div><div class="goal-k">${icon('target')} Mi meta</div><div class="goal-v">${num(info.goal, 1)} kg</div></div>
      <div class="goal-pct">${info.pct}<small>%</small></div></div>
    <div class="goal-bar"><i style="width:${info.pct}%"></i></div>
    <div class="between small"><span>Inicio ${num(info.start, 1)} kg</span><b>${info.reached ? '¡Meta alcanzada! 🎉' : `Faltan ${num(info.left, 1)} kg`}</b><span>Hoy ${num(info.now, 1)} kg</span></div>
  </div>`;
}

// ======================================================================
// LOGROS
// ======================================================================
export function achievements({ evals = [], weighins = [], visits = 0, streak = 0, logs = 0, goalWeight = null, goal = '' }) {
  const list = sortByDate(evals);
  const first = list[0] || {}; const last = list[list.length - 1] || {};
  const ser = weightSeries(list, weighins);
  const wDiff = ser.length > 1 ? r1(ser[ser.length - 1].y - ser[0].y) : 0;
  const waistDiff = has(first.waist) && has(last.waist) ? r1(last.waist - first.waist) : 0;
  const fatDiff = has(first.fat) && has(last.fat) ? r1(last.fat - first.fat) : 0;
  const muscleDiff = has(first.muscle) && has(last.muscle) ? r1(last.muscle - first.muscle) : 0;
  const gain = isGainGoal(goal);
  const gi = goalInfo(list, weighins, goalWeight);
  const A = [];
  const add = (id, ic, title, desc, got, progress = null) => A.push({ id, ic, title, desc, got: !!got, progress });
  add('start', 'sparkle', 'Primer paso', 'Tu primera evaluación física', list.length >= 1);
  add('ses10', 'dumbbell', '10 sesiones', 'Constancia que se nota', visits >= 10, Math.min(1, visits / 10));
  add('ses25', 'medal', '25 sesiones', 'Ya es un hábito', visits >= 25, Math.min(1, visits / 25));
  add('ses50', 'trophy', '50 sesiones', 'Nivel imparable', visits >= 50, Math.min(1, visits / 50));
  add('ses100', 'star', '100 sesiones', 'Leyenda del entreno', visits >= 100, Math.min(1, visits / 100));
  add('streak4', 'flame', 'Racha de 4 semanas', 'Un mes sin fallar', streak >= 4, Math.min(1, streak / 4));
  add('streak12', 'zap', 'Racha de 12 semanas', 'Tres meses seguidos', streak >= 12, Math.min(1, streak / 12));
  if (gain) {
    add('gain2', 'trend', '+2 kg', 'Subiendo con fuerza', wDiff >= 2, Math.max(0, Math.min(1, wDiff / 2)));
    add('mus1', 'dumbbell', '+1 kg de músculo', 'Más masa muscular', muscleDiff >= 1, Math.max(0, Math.min(1, muscleDiff)));
  } else {
    add('kg1', 'scale', '−1 kg', 'El primer kilo menos', wDiff <= -1, Math.max(0, Math.min(1, -wDiff)));
    add('kg5', 'scale', '−5 kg', 'Cinco kilos menos', wDiff <= -5, Math.max(0, Math.min(1, -wDiff / 5)));
    add('kg10', 'trophy', '−10 kg', 'Transformación total', wDiff <= -10, Math.max(0, Math.min(1, -wDiff / 10)));
  }
  add('waist3', 'ruler', '−3 cm de cintura', 'Se nota en la ropa', waistDiff <= -3, Math.max(0, Math.min(1, -waistDiff / 3)));
  add('fat2', 'flame', '−2 % de grasa', 'Más definición', fatDiff <= -2, Math.max(0, Math.min(1, -fatDiff / 2)));
  add('evals3', 'clipboard', '3 evaluaciones', 'Midiendo tu evolución', list.length >= 3, Math.min(1, list.length / 3));
  add('log5', 'check', '5 entrenos registrados', 'Anotas cada sesión', logs >= 5, Math.min(1, logs / 5));
  if (gi) add('goal', 'target', 'Meta cumplida', `Llegaste a ${num(gi.goal, 1)} kg`, gi.reached, gi.pct / 100);
  return A;
}
export function badgesHTML(list, { limit = 0 } = {}) {
  const sorted = [...list].sort((a, b) => Number(b.got) - Number(a.got) || (b.progress || 0) - (a.progress || 0));
  const shown = limit ? sorted.slice(0, limit) : sorted;
  return `<div class="badges">${shown.map((a) => `<div class="medal ${a.got ? 'got' : ''}" title="${esc(a.desc)}">
    <span class="medal-ic">${icon(a.ic)}</span><b>${esc(a.title)}</b><small>${a.got ? esc(a.desc) : a.progress != null ? `${Math.round(a.progress * 100)} %` : 'Por lograr'}</small>
    ${!a.got && a.progress ? `<i class="medal-bar"><i style="width:${Math.round(a.progress * 100)}%"></i></i>` : ''}</div>`).join('')}</div>`;
}

// ======================================================================
// RESUMEN (titulares + meta + gráficas + antes/ahora + logros)
// ======================================================================
export function headlines(evals, weighins, goal) {
  const list = sortByDate(evals);
  const ser = weightSeries(list, weighins);
  const out = [];
  if (ser.length > 1) { const d = r1(ser[ser.length - 1].y - ser[0].y); const dir = goodDir('weight', goal); out.push({ k: 'Peso', v: `${d > 0 ? '+' : ''}${num(d, 1)} kg`, tone: !d ? 'flat' : dir === 0 ? 'neutral' : Math.sign(d) === dir ? 'good' : 'bad' }); }
  const cm = list.length > 1 ? ['waist', 'hip'].reduce((a, k) => (has(list[0][k]) && has(list[list.length - 1][k]) ? a + (list[list.length - 1][k] - list[0][k]) : a), 0) : 0;
  if (cm) out.push({ k: 'Cintura + cadera', v: `${cm > 0 ? '+' : ''}${num(cm, 1)} cm`, tone: cm < 0 ? 'good' : 'bad' });
  const f0 = list.find((e) => has(e.fat)); const f1 = [...list].reverse().find((e) => has(e.fat));
  if (f0 && f1 && f0 !== f1) { const d = r1(f1.fat - f0.fat); out.push({ k: '% grasa', v: `${d > 0 ? '+' : ''}${num(d, 1)} %`, tone: d < 0 ? 'good' : d > 0 ? 'bad' : 'flat' }); }
  return out;
}

export function progressSummaryHTML({ evals = [], weighins = [], goalWeight = null, goal = '', visits = 0, streak = 0, logs = 0, compact = false }) {
  const list = sortByDate(evals);
  if (!list.length && !weighins.length) {
    return `<div class="prog-empty">${icon('ruler')}<div><b>Aún no hay mediciones</b><span>Con la primera evaluación aparecen aquí las gráficas de peso, grasa y medidas, el antes y ahora, la meta y los logros.</span></div></div>`;
  }
  const hl = headlines(list, weighins, goal);
  const gi = goalInfo(list, weighins, goalWeight);
  const fat = list.filter((e) => has(e.fat)).map((e) => ({ date: e.date, y: Number(e.fat) }));
  const mus = list.filter((e) => has(e.muscle)).map((e) => ({ date: e.date, y: Number(e.muscle) }));
  const waist = list.filter((e) => has(e.waist)).map((e) => ({ date: e.date, y: Number(e.waist) }));
  const charts = [
    ['weight', 'Peso', 'kg', weightSeries(list, weighins), '#f97316', goalWeight],
    ['fat', '% de grasa', '%', fat, '#f43f5e', null],
    ['muscle', 'Masa muscular', 'kg', mus, '#8b5cf6', null],
    ['waist', 'Cintura', 'cm', waist, '#0ea5e9', null]
  ].filter((c) => c[3].length);
  return `<div class="prog">
    ${hl.length ? `<div class="hl-row">${hl.map((h) => `<div class="hl hl-${h.tone}"><span>${esc(h.k)}</span><b>${esc(h.v)}</b></div>`).join('')}</div>` : ''}
    ${goalBarHTML(gi)}
    <div class="pc-tabs" role="tablist">${charts.map((c, i) => `<button type="button" class="${i ? '' : 'on'}" data-pc="${c[0]}">${esc(c[1])}</button>`).join('')}</div>
    ${charts.map((c, i) => `<div class="pc-pane" data-pcp="${c[0]}" ${i ? 'hidden' : ''}>${progressChart(c[3], { unit: c[2] === '%' ? ' %' : ' ' + c[2], color: c[4], goal: c[5] })}
      ${c[0] === 'weight' && weighins.length ? `<div class="pc-legend"><span><i style="background:${c[4]}"></i>Evaluación</span><span><i style="background:#38bdf8"></i>Registrado por el alumno</span></div>` : ''}</div>`).join('')}
    ${compact ? '' : `<div class="section-title mt-lg">${icon('columns')} Antes y ahora</div>${compareTableHTML(list, goal)}
    <div class="section-title mt-lg">${icon('medal')} Logros</div>${badgesHTML(achievements({ evals: list, weighins, visits, streak, logs, goalWeight, goal }))}`}
  </div>`;
}
/** Activa las pestañas de gráficas dentro de un contenedor */
export function bindProgress(root) {
  root.querySelectorAll('.prog').forEach((p) => {
    p.querySelectorAll('[data-pc]').forEach((b) => b.addEventListener('click', () => {
      p.querySelectorAll('[data-pc]').forEach((x) => x.classList.toggle('on', x === b));
      p.querySelectorAll('[data-pcp]').forEach((x) => { x.hidden = x.dataset.pcp !== b.dataset.pc; });
    }));
  });
}
