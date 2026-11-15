// SanoEntrenador — Portal del alumno: /alumno/CODIGO (sin sesión)
// Su carnet con QR, su plan, sus próximas sesiones, su rutina en modo "Entrenar",
// su progreso (peso, medidas, meta y logros) y su historial. Puede registrar entrenos y pesajes.
import { getCard } from '../store.js';
import { db, collection, addDoc, getDocs, query, orderBy, limit } from '../firebase.js';
import { esc, num, fmtDate, todayKey, fromKey, waLink, applyLocale, fmtAgo, toast, openModal, parseNum, confirmDialog } from '../utils.js';
import { icon } from '../icons.js';
import { qrDataURL } from '../shared.js';
import { SESSION_TYPES } from '../gym.js';
import { exerciseSheet, nextLoad, guide, bodyMapHTML } from '../exguide.js';
import { progressSummaryHTML, bindProgress, weightSeries, goalInfo, goalBarHTML, achievements, badgesHTML, PROG_MEASURES } from '../progress.js';

const LAST = 'se_last_card';
const exThumb = (x) => { const g = guide(x.exId || x.name); return `<span class="ex-thumb">${bodyMapHTML(g?.primary || [], g?.secondary || [], { size: 'sm' })}</span>`; };
const days = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 864e5);
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dk = (l) => keyOf(new Date(l.at));
const weekOf = (k) => { const d = fromKey(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return keyOf(d); };
const ls = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }, del(k) { try { localStorage.removeItem(k); } catch (_) {} } };
const WD = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function prettyDay(k) {
  const t = todayKey(); const d = days(t, k);
  if (d === 0) return 'Hoy'; if (d === 1) return 'Mañana';
  const x = fromKey(k); return `${WD[x.getDay()]} ${x.getDate()} de ${MONTHS[x.getMonth()]}`;
}
const hour = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`; };

function statusOf(c) {
  const t = todayKey(); const p = c.plan;
  if (!c.active) return ['baja', 'Inactivo', 'neutral'];
  if (!p || p.status === 'anulada') return ['sin', 'Sin plan activo', 'neutral'];
  if (p.frozenUntil && p.frozenUntil >= t && (!p.frozenFrom || p.frozenFrom <= t)) return ['frz', `Pausado hasta ${fmtDate(p.frozenUntil)}`, 'info'];
  if (p.start > t) return ['pen', `Inicia el ${fmtDate(p.start)}`, 'violet'];
  if (p.end < t) return ['ven', 'Plan vencido', 'danger'];
  if (p.kind !== 'tiempo' && Number(p.visitsLeft ?? 1) <= 0) return ['ago', 'Sin sesiones', 'danger'];
  const d = days(t, p.end);
  return d <= 5 ? ['pv', d === 0 ? 'Vence hoy' : `Vence en ${d} día${d === 1 ? '' : 's'}`, 'warning'] : ['ok', 'Plan activo', 'success'];
}

function ring(pct, big, small, color = 'var(--pt-accent)') {
  const r = 34; const c = 2 * Math.PI * r; const v = Math.max(0, Math.min(100, pct));
  return `<div class="pt-ring"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${r}" class="pt-ring-bg"/><circle cx="40" cy="40" r="${r}" stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}" class="pt-ring-fg"/></svg><div><b>${big}</b><small>${small}</small></div></div>`;
}

// ---------- Pantalla para escribir el código ----------
function askCode(root, wrong = '') {
  const last = ls.get(LAST, '');
  root.innerHTML = `<div class="pt-page pt-ask"><div class="pt-ask-card">
    <img src="/assets/logo.svg" alt="" width="72" height="72">
    <h1>Mi progreso</h1><p>Escribe el código de tu carnet. Te lo envía tu entrenador por WhatsApp (son 8 letras y números).</p>
    ${wrong ? `<div class="pt-alert">${icon('alert')} El código <b>${esc(wrong)}</b> no existe o fue renovado. Pídele a tu entrenador tu enlace actualizado.</div>` : ''}
    <form data-f><input class="input pt-code" name="code" maxlength="12" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="K7P3QXZ2" value="${esc(wrong ? '' : last)}" aria-label="Código del carnet"><button class="btn btn-primary btn-lg btn-block">${icon('arrowRight')} Entrar</button></form>
    ${last && !wrong ? '' : last ? `<a class="pt-link" href="/alumno/${esc(last)}">Abrir mi último carnet (${esc(last)})</a>` : ''}
    <a class="pt-link" href="/">Soy entrenador</a>
  </div><p class="pt-by">${icon('shieldCheck')} Tu carnet es privado: solo lo ve quien tiene tu código.</p></div>`;
  root.querySelector('[data-f]').onsubmit = (e) => { e.preventDefault(); const v = e.target.elements.code.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (v) location.href = '/alumno/' + v; };
}

export async function mount(root) {
  document.documentElement.dataset.theme = 'dark';
  document.title = 'Mi progreso · SanoEntrenador';
  const code = (/\/(?:alumno|carnet)\/([A-Z0-9]+)/i.exec(location.pathname)?.[1] || '').toUpperCase();
  if (!code) { askCode(root); return; }
  root.innerHTML = '<div class="pt-page"><div class="pt-loading"><div class="spinner"></div><span>Cargando tu carnet…</span></div></div>';
  let c = null;
  try { c = await getCard(code); } catch (e) { console.error(e); }
  if (!c) { ls.del(LAST); askCode(root, code); return; }
  ls.set(LAST, code);
  try { applyLocale(c.country || 'VE'); } catch (_) {}

  const logsRef = collection(db, 'cards', code, 'logs');
  let logs = [];
  const loadLogs = async () => { try { logs = (await getDocs(query(logsRef, orderBy('at', 'desc'), limit(150)))).docs.map((d) => ({ id: d.id, ...d.data() })); } catch (e) { console.warn(e); } };
  await loadLogs();

  const p = c.plan; const evals = c.evals || [];
  const first = (c.name || '').split(' ')[0];
  const qrP = qrDataURL(location.origin + '/alumno/' + code, 6);
  const coachWa = (text) => (c.coachPhone ? waLink(c.coachPhone, text) : '');
  const tabs = { inicio: ['home', 'Inicio'], entrenar: ['dumbbell', 'Entrenar'], progreso: ['trend', 'Progreso'], historial: ['history', 'Historial'] };
  let tab = new URLSearchParams(location.search).get('tab'); if (!tabs[tab]) tab = 'inicio';
  const WK = `se_wk_${code}`;

  const weighins = () => { const by = {}; logs.filter((l) => l.kind === 'peso' && l.weight).forEach((l) => { const d = dk(l); if (!by[d] || by[d].at < l.at) by[d] = { ...l, day: d }; }); return Object.values(by); };
  const trainings = () => logs.filter((l) => l.kind === 'entreno');
  const streak = () => {
    const wk = new Set([...trainings().map((l) => weekOf(dk(l))), ...(c.lastCheckinAt ? [weekOf(keyOf(new Date(c.lastCheckinAt)))] : [])]);
    let w = weekOf(todayKey()); if (!wk.has(w)) { const d = fromKey(w); d.setDate(d.getDate() - 7); w = keyOf(d); }
    let n = 0; while (wk.has(w)) { n++; const d = fromKey(w); d.setDate(d.getDate() - 7); w = keyOf(d); }
    return n;
  };

  // ---------- Inicio ----------
  function inicioHTML() {
    const [st, label, tone] = statusOf(c);
    const total = p && p.start && p.end ? Math.max(1, days(p.start, p.end) + 1) : 0;
    const left = p && p.end ? Math.max(0, days(todayKey(), p.end)) : 0;
    const sesRing = p && p.kind !== 'tiempo' && p.visits ? ring(((p.visitsLeft ?? 0) / p.visits) * 100, p.visitsLeft ?? 0, `de ${p.visits}<br>sesiones`) : p && total ? ring((left / total) * 100, left, 'días<br>restantes') : '';
    const ser = weightSeries(evals, weighins());
    const wNow = ser.length ? ser[ser.length - 1].y : null; const wDiff = ser.length > 1 ? Math.round((wNow - ser[0].y) * 10) / 10 : null;
    const gi = goalInfo(evals, weighins(), c.goalWeight);
    const ach = achievements({ evals, weighins: weighins(), visits: c.visits, streak: streak(), logs: trainings().length, goalWeight: c.goalWeight, goal: c.goal });
    const next = (c.next || []).filter((s) => s.date >= todayKey());
    const wk = ls.get(WK, null);
    return `
      <section class="pt-hero st-${st}">
        <div class="pt-hero-top"><div><small>${esc(c.brand || c.coach || 'Mi entrenador')}</small><h1>Hola, ${esc(first)} 💪</h1></div><span class="pt-badge tone-${tone}">${esc(label)}</span></div>
        <div class="pt-id">
          <button class="pt-qr" data-qr aria-label="Ampliar QR"><img data-qrimg alt="QR de tu carnet"></button>
          <div class="pt-id-info"><span class="pt-k">Alumno</span><b class="pt-name">${esc(c.name)}</b><span class="pt-k">N° ${esc(c.number || '—')} · ${esc(code)}</span>
            ${c.goal ? `<span class="pt-goal">${icon('target')} ${esc(c.goal)}</span>` : ''}</div>
        </div>
        <p class="pt-hint">${icon('scan')} Muestra tu QR al llegar a la sesión. Toca el código para verlo grande.</p>
      </section>
      ${c.debt ? `<div class="pt-alert">${icon('alert')} Tienes un saldo pendiente con tu entrenador.${coachWa('') ? ` <a href="${coachWa(`Hola ${c.coach || ''}, soy ${c.name}. Quiero ponerme al día con mi pago.`)}" target="_blank" rel="noopener">Escribirle</a>` : ''}</div>` : ''}
      ${wk && wk.date === todayKey() ? `<button class="pt-resume" data-go="entrenar">${icon('zap')}<span><b>Tienes un entreno en curso</b><small>${esc(wk.dayName || '')} · toca para continuar</small></span>${icon('chevronRight')}</button>` : ''}
      <div class="pt-grid2">
        <section class="pt-card pt-plan">${p ? `${sesRing}<div class="grow"><span class="pt-k">Mi plan</span><b>${esc(p.name)}</b>${p.online ? '<span class="pt-chip">Online</span>' : ''}<small>${fmtDate(p.start)} – ${fmtDate(p.end)}</small></div>` : `<div class="grow"><span class="pt-k">Mi plan</span><b>Sin plan activo</b><small>Escríbele a tu entrenador para renovar.</small></div>`}</section>
        <section class="pt-card pt-stats">
          <div><b>${c.visits || 0}</b><small>entrenos</small></div>
          <div><b>${streak()}</b><small>sem. seguidas</small></div>
          <div><b>${wNow != null ? num(wNow, 1) : '—'}</b><small>${wDiff ? `kg · <span class="${wDiff < 0 ? 'up' : 'dn'}">${wDiff > 0 ? '+' : ''}${num(wDiff, 1)}</span>` : 'kg hoy'}</small></div>
        </section>
      </div>
      ${gi ? goalBarHTML(gi) : ''}
      <section class="pt-card"><div class="pt-ct">${icon('calendar')} Mis próximas sesiones</div>
        ${next.length ? `<div class="pt-next">${next.map((s) => { const T = SESSION_TYPES[s.type] || SESSION_TYPES.presencial; return `<div class="pt-ses" style="--c:${T.color}"><div class="pt-ses-d"><b>${esc(prettyDay(s.date))}</b><small>${hour(s.time)} · ${s.minutes || 60} min</small></div><div class="grow"><span>${icon(T.icon)} ${esc(T.label)}</span>${s.place ? `<small>${icon('pin')} ${esc(s.place)}</small>` : ''}</div>${coachWa('') ? `<a class="pt-mini" href="${coachWa(`Hola ${c.coach || ''}, soy ${c.name}. Confirmo mi sesión de ${prettyDay(s.date).toLowerCase()} a las ${hour(s.time)}. ✅`)}" target="_blank" rel="noopener" aria-label="Confirmar por WhatsApp">${icon('check')}</a>` : ''}</div>`; }).join('')}</div>`
          : `<p class="pt-muted">No tienes sesiones agendadas.${coachWa('') ? ` <a href="${coachWa(`Hola ${c.coach || ''}, soy ${c.name}. Quiero agendar mi próxima sesión.`)}" target="_blank" rel="noopener">Pedir una sesión</a>` : ''}</p>`}
      </section>
      ${c.routine ? `<button class="pt-cta" data-go="entrenar">${icon('dumbbell')}<span><b>Entrenar ahora</b><small>${esc(c.routine.name)} · ${(c.routine.days || []).length} día(s)</small></span>${icon('arrowRight')}</button>` : ''}
      ${ach.length ? `<section class="pt-card"><div class="pt-ct between">${icon('medal')} Mis logros <button class="pt-more" data-go="progreso">Ver todo</button></div>${badgesHTML(ach, { limit: 4 })}</section>` : ''}
      <section class="pt-card pt-coach"><div class="pt-coach-av">${icon('user')}</div><div class="grow"><span class="pt-k">Mi entrenador</span><b>${esc(c.coach || c.brand || 'Entrenador')}</b>${c.specialty ? `<small>${esc(c.specialty)}</small>` : ''}</div>
        <div class="pt-coach-a">${coachWa('') ? `<a class="btn btn-whatsapp btn-sm" href="${coachWa(`Hola ${c.coach || ''}, soy ${c.name}.`)}" target="_blank" rel="noopener">${icon('whatsapp')} Escribir</a>` : ''}${c.coachIg ? `<a class="btn btn-secondary btn-sm" href="https://instagram.com/${esc(String(c.coachIg).replace(/^@/, ''))}" target="_blank" rel="noopener">@${esc(String(c.coachIg).replace(/^@/, ''))}</a>` : ''}</div></section>`;
  }

  // ---------- Entrenar ----------
  function entrenarHTML() {
    const R = c.routine;
    if (!R || !(R.days || []).length) return `<div class="pt-empty">${icon('dumbbell')}<b>Aún no tienes rutina</b><span>Cuando tu entrenador te asigne una rutina aparecerá aquí con tus series, repeticiones y descansos.</span></div>`;
    let wk = ls.get(WK, null); if (wk && wk.date !== todayKey()) { ls.del(WK); wk = null; }
    const lastLoads = {}; trainings().slice().reverse().forEach((l) => Object.entries(l.loads || {}).forEach(([k, v]) => { if (v) lastLoads[k] = v; }));
    if (!wk) {
      const suggested = (() => { const last = trainings()[0]; if (!last) return 0; const i = R.days.findIndex((d) => d.name === last.dayName); return i < 0 ? 0 : (i + 1) % R.days.length; })();
      return `<section class="pt-card pt-rhead"><span class="pt-k">Mi rutina</span><h2>${esc(R.name)}</h2><div class="pt-tags">${R.goal ? `<span class="pt-chip">${esc(R.goal)}</span>` : ''}${R.level ? `<span class="pt-chip">${esc(R.level)}</span>` : ''}${R.weeks ? `<span class="pt-chip">${R.weeks} semanas</span>` : ''}</div>${R.note ? `<p class="pt-note">${esc(R.note)}</p>` : ''}</section>
        <div class="pt-ct">${icon('zap')} ¿Qué día te toca hoy?</div>
        <div class="pt-days">${R.days.map((d, i) => `<button class="pt-day ${i === suggested ? 'sug' : ''}" data-start="${i}"><span class="pt-day-n">${i + 1}</span><span class="grow"><b>${esc(d.name)}</b><small>${d.items.length} ejercicios · ${d.items.reduce((a, x) => a + (Number(x.sets) || 1), 0)} series</small></span>${i === suggested ? '<span class="pt-chip">Te toca</span>' : ''}${icon('chevronRight')}</button>`).join('')}</div>
        ${R.days.map((d, i) => `<details class="pt-prev"><summary>${icon('list')} Ver ${esc(d.name)}</summary>${d.items.map((x, j) => `<div class="pt-prev-i" data-prev="${i}-${j}" role="button" tabindex="0"><span>${j + 1}</span><b class="grow">${esc(x.name)}</b><small>${x.sets ? x.sets + ' × ' : ''}${esc(x.reps || '')}${x.weight ? ' · ' + esc(x.weight) : ''}</small></div>`).join('')}</details>`).join('')}`;
    }
    const D = R.days[wk.day] || R.days[0];
    const lastDay = trainings().find((l) => l.dayName === D.name);
    const lastDone = !!lastDay && Number(lastDay.done) >= Number(lastDay.total) && Number(lastDay.total) > 0;
    const totalSets = D.items.reduce((a, x) => a + (Number(x.sets) || 1), 0);
    const done = Object.values(wk.sets || {}).filter(Boolean).length;
    return `<section class="pt-card pt-live"><div class="between"><div><span class="pt-k">Entrenando · ${esc(R.name)}</span><h2>${esc(D.name)}</h2></div>${ring((done / Math.max(1, totalSets)) * 100, done, `de ${totalSets}<br>series`)}</div>
        <div class="pt-live-meta"><span>${icon('clock')} <b data-elapsed>0:00</b></span><button class="pt-more" data-cancel>${icon('x')} Cancelar</button></div></section>
      <div class="pt-exs">${D.items.map((x, i) => { const n = Math.max(1, Number(x.sets) || 1); const all = Array.from({ length: n }, (_, s) => wk.sets?.[`${i}-${s}`]).every(Boolean); const prevLoad = lastLoads[x.name]; const up = nextLoad(prevLoad, lastDone); return `
        <article class="pt-ex ${all ? 'done' : ''}" data-ex="${i}">
          <div class="pt-ex-h"><span class="pt-ex-n">${all ? icon('check') : i + 1}</span><div class="grow"><b>${esc(x.name)}</b><small>${x.sets ? x.sets + ' series × ' : ''}${esc(x.reps || '')} reps${x.rest ? ` · descanso ${x.rest} s` : ''}${x.weight ? ` · ${esc(x.weight)}` : ''}</small></div><button type="button" class="pt-how" data-how="${i}" aria-label="Cómo se hace">${exThumb(x)}<small>Cómo</small></button></div>
          ${prevLoad ? `<p class="pt-prog">${icon('trend')} Última vez: <b>${esc(prevLoad)}</b>${up ? ` · ¡Completaste todo! Prueba <b>${esc(up)}</b> hoy 💪` : ''}</p>` : ''}
          ${x.note ? `<p class="pt-ex-note">${icon('info')} ${esc(x.note)}</p>` : ''}
          <div class="pt-sets">${Array.from({ length: n }, (_, s) => `<button class="pt-set ${wk.sets?.[`${i}-${s}`] ? 'on' : ''}" data-set="${i}-${s}" data-rest="${Number(x.rest) || 0}"><small>Serie</small><b>${s + 1}</b></button>`).join('')}</div>
          <label class="pt-load"><span>${icon('dumbbell')} Peso usado</span><input class="input" data-load="${i}" value="${esc(wk.loads?.[i] || '')}" placeholder="${prevLoad ? 'Última vez: ' + esc(prevLoad) : 'Ej.: 20 kg'}" maxlength="20"></label>
        </article>`; }).join('')}</div>
      <button class="pt-cta pt-finish" data-finish>${icon('trophy')}<span><b>Terminar entreno</b><small>${done} de ${totalSets} series completadas</small></span>${icon('arrowRight')}</button>`;
  }

  // ---------- Progreso ----------
  function progresoHTML() {
    const W = weighins();
    const list = [...evals].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return `<section class="pt-card pt-weigh"><div class="grow"><span class="pt-k">¿Te pesaste hoy?</span><b>Registra tu peso y mira tu curva</b><small>Tus pesajes salen en azul en la gráfica.</small></div><button class="btn btn-primary" data-weigh>${icon('scale')} Registrar</button></section>
      <section class="pt-card">${progressSummaryHTML({ evals, weighins: W, goalWeight: c.goalWeight, goal: c.goal, visits: c.visits, streak: streak(), logs: trainings().length })}</section>
      ${list.length ? `<section class="pt-card"><div class="pt-ct">${icon('ruler')} Mis evaluaciones</div><div class="pt-evals">${list.map((e) => `<details class="pt-ev"><summary><b>${fmtDate(e.date)}</b><span class="grow"></span>${e.weight ? `<span>${num(e.weight, 1)} kg</span>` : ''}${e.fat ? `<span>${num(e.fat, 1)} %</span>` : ''}</summary><div class="pt-ev-g">${PROG_MEASURES.filter(([k]) => e[k]).map(([k, l, u]) => `<div><small>${esc(l)}</small><b>${num(e[k], 1)}${u ? ' ' + u : ''}</b></div>`).join('')}</div></details>`).join('')}</div></section>` : ''}
      ${coachWa('') && (evals.length || W.length) ? `<a class="pt-cta pt-cta-wa" href="${coachWa(`Hola ${c.coach || ''}, soy ${c.name}. Estoy viendo mi progreso en mi carnet 💪 ¿Cuándo hacemos la próxima evaluación?`)}" target="_blank" rel="noopener">${icon('whatsapp')}<span><b>Pedir mi próxima evaluación</b><small>Escríbele a tu entrenador</small></span>${icon('arrowRight')}</a>` : ''}`;
  }

  // ---------- Historial ----------
  function historialHTML() {
    const items = [...logs.map((l) => ({ t: l.at, l })), ...evals.map((e) => ({ t: e.date + 'T12:00', e }))].sort((a, b) => String(b.t).localeCompare(String(a.t)));
    if (!items.length) return `<div class="pt-empty">${icon('history')}<b>Tu historial está vacío</b><span>Aquí verás cada entreno que registres, tus pesajes y tus evaluaciones.</span></div>`;
    let lastM = '';
    return `<div class="pt-tl">${items.map(({ t, l, e }) => {
      const m = String(t).slice(0, 7); const head = m !== lastM ? `<div class="pt-tl-m">${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}</div>` : ''; lastM = m;
      if (e) return `${head}<div class="pt-tl-i k-eval"><span class="pt-tl-ic">${icon('ruler')}</span><div class="grow"><b>Evaluación con tu entrenador</b><small>${fmtDate(e.date)}${e.weight ? ` · ${num(e.weight, 1)} kg` : ''}${e.fat ? ` · ${num(e.fat, 1)} % grasa` : ''}${e.waist ? ` · cintura ${num(e.waist, 1)} cm` : ''}</small></div></div>`;
      if (l.kind === 'peso') return `${head}<div class="pt-tl-i k-peso"><span class="pt-tl-ic">${icon('scale')}</span><div class="grow"><b>Pesaje · ${num(l.weight, 1)} kg</b><small>${fmtAgo(l.at)}</small></div></div>`;
      const loads = Object.entries(l.loads || {}).filter(([, v]) => v).slice(0, 4).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(' · ');
      return `${head}<div class="pt-tl-i k-train"><span class="pt-tl-ic">${icon('dumbbell')}</span><div class="grow"><b>${esc(l.dayName || 'Entreno')}</b><small>${fmtAgo(l.at)} · ${l.done ?? 0}/${l.total ?? 0} series${l.mins ? ` · ${l.mins} min` : ''}${l.rpe ? ` · esfuerzo ${l.rpe}/10` : ''}</small>${loads ? `<small class="pt-tl-x">${loads}</small>` : ''}${l.note ? `<small class="pt-tl-x">“${esc(l.note)}”</small>` : ''}</div></div>`;
    }).join('')}</div>`;
  }

  // ---------- Armado ----------
  let tick = null; let restT = null;
  function draw() {
    clearInterval(tick);
    const body = tab === 'entrenar' ? entrenarHTML() : tab === 'progreso' ? progresoHTML() : tab === 'historial' ? historialHTML() : inicioHTML();
    root.innerHTML = `<div class="pt-page">
      <header class="pt-top"><img src="/assets/logo.svg" alt="" width="34" height="34"><div class="grow"><b>${esc(c.brand || c.coach || 'SanoEntrenador')}</b><small>${esc(tabs[tab][1] === 'Inicio' ? 'Mi carnet' : tabs[tab][1])}</small></div><span class="pt-avatar">${esc((first[0] || 'A').toUpperCase())}</span></header>
      <main class="pt-main" data-tab="${tab}">${body}</main>
      <p class="pt-by">Hecho con <b>SanoEntrenador</b> · Agrega esta página a tu pantalla de inicio para tenerla siempre a mano.</p>
      <nav class="pt-nav">${Object.entries(tabs).map(([k, [ic, l]]) => `<button class="${tab === k ? 'on' : ''}" data-t="${k}">${icon(ic)}<span>${l}</span></button>`).join('')}</nav>
      <div class="pt-rest" data-restbar hidden><div class="pt-rest-in"><span class="pt-k">Descanso</span><b data-rest-t>0:00</b><div class="pt-rest-bar"><i data-rest-i></i></div><div class="row"><button class="pt-more" data-rest-add>+15 s</button><button class="pt-more" data-rest-skip>Saltar</button></div></div></div>
    </div>`;
    root.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t; history.replaceState(null, '', location.pathname + (tab === 'inicio' ? '' : '?tab=' + tab)); draw(); window.scrollTo(0, 0); });
    root.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { tab = b.dataset.go; history.replaceState(null, '', location.pathname + '?tab=' + tab); draw(); window.scrollTo(0, 0); });
    qrP.then((src) => { const i = root.querySelector('[data-qrimg]'); if (i) i.src = src; });
    root.querySelector('[data-qr]')?.addEventListener('click', async () => {
      const src = await qrP;
      const m = openModal({ size: 'sm', body: `<div class="pt-qr-big"><img src="${src}" alt="QR"><b>${esc(c.name)}</b><span class="mono">${esc(code)}</span><small>Sube el brillo de la pantalla</small></div>` });
      m.el.querySelector('.pt-qr-big').onclick = () => m.close();
    });
    if (tab === 'progreso') { bindProgress(root); root.querySelector('[data-weigh]').onclick = weighModal; }
    if (tab === 'entrenar') bindTrain();
  }

  function weighModal() {
    const ser = weightSeries(evals, weighins()); const last = ser.length ? ser[ser.length - 1].y : '';
    const m = openModal({
      title: 'Registrar mi peso', size: 'sm',
      body: `<form class="stack" data-f><div class="pt-weigh-in"><input class="input" name="w" inputmode="decimal" placeholder="${last ? num(last, 1) : '70,0'}" autofocus><span>kg</span></div>
        <p class="small muted" style="margin:0">Pésate en ayunas, a la misma hora y en la misma báscula para comparar mejor.</p><div class="error-msg" data-err></div></form>`,
      footer: `<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-ok>${icon('check')} Guardar</button>`
    });
    const F = m.el.querySelector('[data-f]');
    const save = async () => {
      const w = Math.round(parseNum(F.elements.w.value) * 10) / 10;
      if (!(w > 20 && w < 400)) { m.el.querySelector('[data-err]').textContent = 'Escribe un peso válido en kilos.'; return; }
      const btn = m.el.querySelector('[data-ok]'); btn.disabled = true;
      try {
        await addDoc(logsRef, { at: new Date().toISOString(), kind: 'peso', weight: w, tenantId: c.tenantId, name: c.name });
        m.close(); await loadLogs(); draw();
        const prev = last ? Math.round((w - last) * 10) / 10 : 0;
        toast(prev ? `Peso guardado: ${num(w, 1)} kg (${prev > 0 ? '+' : ''}${num(prev, 1)} kg)` : `Peso guardado: ${num(w, 1)} kg`);
      } catch (e) { console.error(e); m.el.querySelector('[data-err]').textContent = 'No se pudo guardar. Revisa tu conexión.'; btn.disabled = false; }
    };
    F.onsubmit = (e) => { e.preventDefault(); save(); };
    m.el.querySelector('[data-ok]').onclick = save;
  }

  function startRest(sec) {
    clearInterval(restT);
    const bar = root.querySelector('[data-restbar]'); if (!bar || !sec) return;
    let total = sec; let end = Date.now() + sec * 1000;
    const upd = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      bar.querySelector('[data-rest-t]').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      bar.querySelector('[data-rest-i]').style.width = `${(left / total) * 100}%`;
      if (!left) { clearInterval(restT); bar.hidden = true; try { navigator.vibrate?.([200, 100, 200]); } catch (_) {} toast('¡A la siguiente serie! 💪'); }
    };
    bar.hidden = false; upd(); restT = setInterval(upd, 250);
    bar.querySelector('[data-rest-add]').onclick = () => { end += 15000; total += 15; upd(); };
    bar.querySelector('[data-rest-skip]').onclick = () => { clearInterval(restT); bar.hidden = true; };
  }

  function bindTrain() {
    const R = c.routine;
    root.querySelectorAll('[data-prev]').forEach((b) => b.onclick = () => { const [di, j] = b.dataset.prev.split('-').map(Number); const x = R.days[di].items[j]; exerciseSheet(x.exId || x.name, { item: x, goal: c.goal }); });
    root.querySelectorAll('[data-how]').forEach((b) => b.onclick = () => { const cur = ls.get(WK, null); const D = R.days[cur?.day ?? 0] || R.days[0]; const x = D.items[Number(b.dataset.how)]; exerciseSheet(x.exId || x.name, { item: x, goal: c.goal }); });
    root.querySelectorAll('[data-start]').forEach((b) => b.onclick = () => { const i = Number(b.dataset.start); ls.set(WK, { date: todayKey(), day: i, dayName: R.days[i].name, start: Date.now(), sets: {}, loads: {} }); draw(); window.scrollTo(0, 0); });
    const wk = ls.get(WK, null); if (!wk) return;
    const el = root.querySelector('[data-elapsed]');
    const upd = () => { if (!el.isConnected) return clearInterval(tick); const s = Math.floor((Date.now() - wk.start) / 1000); el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    upd(); tick = setInterval(upd, 1000);
    root.querySelectorAll('[data-set]').forEach((b) => b.onclick = () => {
      const cur = ls.get(WK, wk); const on = !cur.sets[b.dataset.set]; cur.sets[b.dataset.set] = on; ls.set(WK, cur);
      if (!on) clearInterval(restT);
      const y = window.scrollY; draw(); window.scrollTo(0, y);
      if (on) startRest(Number(b.dataset.rest));
    });
    root.querySelectorAll('[data-load]').forEach((i) => i.oninput = () => { const cur = ls.get(WK, wk); cur.loads[i.dataset.load] = i.value.trim(); ls.set(WK, cur); });
    root.querySelector('[data-cancel]').onclick = async () => { if (!(await confirmDialog({ title: 'Cancelar entreno', message: '¿Cancelar este entreno? No se guardará.', confirmText: 'Cancelar entreno', danger: true }))) return; ls.del(WK); clearInterval(restT); draw(); };
    root.querySelector('[data-finish]').onclick = finishModal;
  }

  function finishModal() {
    const wk = ls.get(WK, null); if (!wk) return;
    const D = c.routine.days[wk.day] || c.routine.days[0];
    const total = D.items.reduce((a, x) => a + (Math.max(1, Number(x.sets) || 1)), 0);
    const done = Object.values(wk.sets || {}).filter(Boolean).length;
    const mins = Math.max(1, Math.round((Date.now() - wk.start) / 60000));
    let rpe = 7;
    const RPE = { 1: 'Muy suave', 3: 'Suave', 5: 'Moderado', 7: 'Duro', 9: 'Muy duro', 10: 'Al máximo' };
    const m = openModal({
      title: '¡Buen trabajo! 🔥', size: 'sm',
      body: `<div class="stack"><div class="pt-sum"><div><b>${done}/${total}</b><small>series</small></div><div><b>${mins}</b><small>minutos</small></div><div><b>${D.items.length}</b><small>ejercicios</small></div></div>
        <div class="field"><label>¿Qué tan duro fue? <b data-rl></b></label><div class="pt-rpe">${Array.from({ length: 10 }, (_, i) => `<button type="button" data-rpe="${i + 1}" class="${i + 1 === rpe ? 'on' : ''}">${i + 1}</button>`).join('')}</div></div>
        <div class="field"><label>Nota para tu entrenador (opcional)</label><textarea class="textarea" data-note rows="2" maxlength="300" placeholder="Ej.: me molestó un poco la rodilla en la sentadilla"></textarea></div>
        <div class="error-msg" data-err></div></div>`,
      footer: `<button class="btn btn-secondary" data-close>Seguir entrenando</button><button class="btn btn-primary" data-ok>${icon('check')} Guardar entreno</button>`
    });
    const rl = () => { const k = Object.keys(RPE).map(Number).filter((x) => x <= rpe).pop(); m.el.querySelector('[data-rl]').textContent = `· ${RPE[k]}`; };
    m.el.querySelectorAll('[data-rpe]').forEach((b) => b.onclick = () => { rpe = Number(b.dataset.rpe); m.el.querySelectorAll('[data-rpe]').forEach((x) => x.classList.toggle('on', x === b)); rl(); }); rl();
    m.el.querySelector('[data-ok]').onclick = async () => {
      const btn = m.el.querySelector('[data-ok]'); btn.disabled = true;
      const loads = {}; D.items.forEach((x, i) => { const v = (wk.loads?.[i] || '').trim(); if (v && Object.keys(loads).length < 40) loads[String(x.name).slice(0, 60)] = v.slice(0, 20); });
      const note = m.el.querySelector('[data-note]').value.trim().slice(0, 300);
      const log = { at: new Date().toISOString(), kind: 'entreno', day: Number(wk.day) || 0, dayName: String(D.name).slice(0, 80), done, total, rpe, mins, loads, tenantId: c.tenantId, name: c.name, ...(note ? { note } : {}) };
      try {
        await addDoc(logsRef, log);
        ls.del(WK); clearInterval(restT); m.close(); await loadLogs();
        celebrate(log);
      } catch (e) { console.error(e); m.el.querySelector('[data-err]').textContent = 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.'; btn.disabled = false; }
    };
  }

  function celebrate(log) {
    const n = trainings().length; const s = streak();
    const text = `💪 ¡Entreno completado!\n${log.dayName} · ${log.done}/${log.total} series · ${log.mins} min · esfuerzo ${log.rpe}/10${Object.keys(log.loads).length ? '\n' + Object.entries(log.loads).map(([k, v]) => `• ${k}: ${v}`).join('\n') : ''}${log.note ? `\n📝 ${log.note}` : ''}\n— ${c.name}`;
    const m = openModal({
      size: 'sm',
      body: `<div class="pt-done"><div class="pt-burst">${icon('trophy')}</div><h2>¡Entreno guardado!</h2><p>${esc(log.dayName)} · ${log.done}/${log.total} series · ${log.mins} min</p>
        <div class="pt-sum"><div><b>${n}</b><small>entrenos registrados</small></div><div><b>${s}</b><small>semanas seguidas</small></div></div>
        ${coachWa('') ? `<a class="btn btn-whatsapp btn-block" href="${coachWa(text)}" target="_blank" rel="noopener">${icon('whatsapp')} Contárselo a mi entrenador</a>` : ''}
        <button class="btn btn-secondary btn-block" data-close>Listo</button></div>`
    });
    m.el.querySelector('.modal')?.classList.add('pt-modal-done');
    tab = 'inicio'; history.replaceState(null, '', location.pathname); draw(); window.scrollTo(0, 0);
  }

  draw();
}
