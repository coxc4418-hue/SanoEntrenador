// SanoEntrenador — Recorrido guiado: ilumina zonas de la pantalla y explica para qué sirven
import { esc, openModal, closeAllModals } from './utils.js';
import { icon } from './icons.js';

// Cada paso: { route, sel: [selectores alternativos], title, text }. Sin elemento visible → tarjeta centrada.
export const TOURS = {
  general: {
    name: 'Recorrido general', desc: 'Lo esencial del sistema en 1 minuto', icon: 'sparkle',
    steps: [
      { route: 'inicio', title: '¡Bienvenido a SanoEntrenador! 💪', text: 'En un minuto te mostramos cómo llevar a tus alumnos aquí: agenda, asistencia, planes, rutinas, avances y recordatorios por WhatsApp. Usa «Siguiente» para avanzar o «Salir» cuando quieras. Puedes repetirlo desde el menú › Ayuda.' },
      { route: 'inicio', sel: ['.sb-nav', '.bottom-nav'], title: 'Menú principal', text: 'Agenda, asistencia con QR, alumnos, rutinas, recordatorios, cobros, reportes y configuración. Los números de colores son avisos: sesiones por marcar y recordatorios pendientes.' },
      { route: 'inicio', sel: ['[data-tour="kpis"]'], title: 'Tu día en números', text: 'Alumnos activos, sesiones de hoy, lo cobrado en el mes y lo que te deben. Toca cualquiera para ver el detalle.' },
      { route: 'inicio', sel: ['[data-tour="today"]'], title: 'Sesiones de hoy', text: 'Tu agenda del día: marca asistió, faltó o canceló con un toque. Asistió descuenta una sesión del paquete del alumno automáticamente.' },
      { route: 'inicio', sel: ['[data-tour="quick"]'], title: 'Accesos rápidos', text: 'Agendar una sesión, registrar un alumno, cobrar un plan o escanear un carnet. Atajos en la computadora: F1 asistencia, F2 alumno nuevo, F3 alumnos, F4 agenda.' },
      { route: 'agenda', sel: ['[data-tour="week"]'], title: 'Agenda semanal', text: 'Tus sesiones por día y hora: presenciales, online, evaluaciones o en grupo reducido. Puedes crear series semanales (ej. lunes, miércoles y viernes a las 6:00 por 8 semanas) y enviar la confirmación por WhatsApp.' },
      { route: 'alumnos', sel: ['[data-tour="filters"]'], title: 'Tus alumnos', text: 'Filtra por activos, por vencer, vencidos, pausados o con deuda. Cada ficha tiene plan y pagos, sesiones, rutina, evaluaciones con gráficas, su bitácora de entrenos y salud (PAR-Q).' },
      { route: 'avisos', sel: ['[data-tour="rem-cats"]'], title: 'Recordatorios por WhatsApp', text: 'El sistema arma la lista del día: sesiones de mañana por confirmar, planes por vencer, pocas sesiones, deudas, cumpleaños, alumnos que dejaron de venir y a quién le toca reevaluarse. Envíalos uno tras otro con «Siguiente».' },
      { route: 'rutinas', sel: ['[data-tour="routines"]'], title: 'Rutinas para compartir', text: 'Más de 120 ejercicios con guía y plantillas listas. Asigna una rutina y el alumno la abre en su carnet con el modo «Entrenar»: marca series, cronómetro de descanso, cargas y video de cada ejercicio.' },
      { route: 'alimentacion', sel: ['[data-tour="diets"]'], title: 'Alimentación y nutrición', text: 'Planes alimenticios (menú de cada día con porciones y lista de compras) y planes de nutrición (calorías, proteína, agua, suplementos y hábitos), semanales o mensuales. Tus alumnos los ven en su carnet, en «Comidas».' },
      { route: 'inicio', title: 'El carnet del alumno 📲', text: 'Cada alumno recibe un enlace con su QR, su plan, sus próximas sesiones, su rutina y «Mi progreso»: gráficas de peso, % de grasa y medidas, antes y ahora, meta y logros. También puede registrar su peso y sus entrenos, y tú lo ves en su bitácora.', final: true }
    ]
  },
  alumno: {
    name: 'Registrar alumno y venderle un plan', desc: 'Ficha, PAR-Q, planes, abonos y carnet digital', icon: 'userPlus',
    steps: [
      { route: 'alumnos', sel: ['[data-tour="new-member"]'], title: 'Alumno nuevo', text: 'Nombre, teléfono, objetivo, meta de peso y el cuestionario de salud PAR-Q. Si responde «sí» a alguna pregunta, te recordamos pedir la constancia médica.' },
      { route: 'alumnos', sel: ['[data-tour="filters"]'], title: 'Planes', text: 'Paquetes de sesiones (8, 12, 20), mensualidad ilimitada, sesión suelta, asesoría online o entrenamiento en pareja. Al renovar un paquete, las sesiones que le quedaban se suman al nuevo.' },
      { route: 'alumnos', title: 'Cobro con abonos', text: 'Cobra en efectivo, transferencia, pago móvil o tarjeta, incluso mezclando formas de pago. Si paga una parte, el resto queda como deuda y aparece en Recordatorios.' },
      { route: 'alumnos', title: 'Carnet y bienvenida', text: 'Al vender el plan envías por WhatsApp la bienvenida con el enlace de su carnet. Con ese QR marcas su asistencia y él ve todo su progreso.', final: true }
    ]
  },
  progreso: {
    name: 'Rutinas, evaluaciones y avances', desc: 'Plantillas, mediciones y lo que ve el alumno', icon: 'trend',
    steps: [
      { route: 'rutinas', sel: ['[data-tour="routines"]'], title: 'Plantillas', text: 'Crea tus plantillas (fuerza, hipertrofia, pérdida de grasa, principiante) y asígnalas con un toque. Ajusta series, repeticiones, descanso y carga para cada alumno.' },
      { route: 'alimentacion', sel: ['[data-tour="diets"]'], title: 'Alimentación y nutrición', text: '10 planes alimenticios y 8 planes de nutrición listos, más de 80 alimentos. Todo se ajusta al peso y las calorías del alumno. Si su plan incluye alimentación o nutrición y aún no se la asignas, aparece en «Pendientes».' },
      { route: 'alumnos', title: 'Evaluación física', text: 'En la ficha › Progreso: peso, estatura y perímetros. Calcula IMC, % de grasa, masa magra, riesgo por cintura, calorías y proteína según su objetivo.' },
      { route: 'alumnos', title: 'Lo que ve el alumno', text: 'Cada evaluación se publica en su carnet: gráficas, tabla de antes y ahora con flechas verdes o rojas según su objetivo, barra de meta y medallas por kilos y centímetros perdidos, sesiones y racha.', final: true }
    ]
  },
  negocio: {
    name: 'Cobros, recordatorios y reportes', desc: 'Lo que entra, lo que te deben y tu página', icon: 'wallet',
    steps: [
      { route: 'cobros', sel: ['[data-tour="pay-kpis"]'], title: 'Cobros', text: 'Todo lo cobrado por día y forma de pago, los recibos (imprimibles o por WhatsApp) y quién te debe. Cobro libre para evaluaciones o planes de alimentación.' },
      { route: 'avisos', sel: ['[data-tour="rem-cats"]'], title: 'Recordatorios propios', text: 'Además de los automáticos, crea los tuyos: «llamar a Ana el viernes», repetidos cada semana o cada mes.' },
      { route: 'ajustes', sel: ['[data-tour="settings-tabs"]'], title: 'Tu perfil y tu página', text: 'Tu perfil, planes y precios, horario de la agenda, plantillas de mensajes y tu página pública para compartir en Instagram, con tus planes y un botón de WhatsApp.' },
      { route: 'reportes', title: 'Reportes (PIN)', text: 'Ingresos por mes y por plan, asistencia, alumnos nuevos y retención. Protegidos con tu PIN.', final: true }
    ]
  }
};

let state = null;

const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden'; };
async function findTarget(sels = [], timeout = 2500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    for (const s of sels) { const el = [...document.querySelectorAll(s)].find(visible); if (el) return el; }
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}

/** Inicia un recorrido (por defecto el general). */
export async function startTour(id = 'general') {
  stopTour();
  const tour = TOURS[id];
  if (!tour) return;
  const root = document.createElement('div');
  root.className = 'tour';
  root.innerHTML = '<div class="tour-block"></div><div class="tour-spot"></div><div class="tour-tip" role="dialog" aria-live="polite"></div>';
  document.body.appendChild(root);
  state = { id, tour, i: 0, root, target: null };
  const onKey = (e) => {
    if (!state) return;
    if (e.key === 'Escape') { e.stopPropagation(); stopTour(); }
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  };
  const onResize = () => place();
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onResize, true);
  state.cleanup = () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onResize, true); };
  await show();
}

export function stopTour() {
  if (!state) return;
  state.cleanup?.();
  state.root.remove();
  state = null;
  try { localStorage.setItem('se_tour_done', '1'); } catch (_) {}
}
export const tourActive = () => !!state;

async function go(d) {
  if (!state) return;
  const n = state.i + d;
  if (n < 0) return;
  if (n >= state.tour.steps.length) { stopTour(); return; }
  state.i = n;
  await show();
}

async function show() {
  const s = state.tour.steps[state.i];
  const tip = state.root.querySelector('.tour-tip');
  tip.classList.add('busy');
  const { navigate } = await import('./main.js');
  if (s.route && location.hash.replace(/^#\/?/, '') !== s.route) {
    await navigate(s.route);
    await new Promise((r) => setTimeout(r, 350));
  }
  if (!state) return;
  closeAllModals();
  state.target = s.sel ? await findTarget(s.sel) : null;
  if (!state) return;
  if (state.target) state.target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  const total = state.tour.steps.length;
  tip.innerHTML = `
    <div class="tour-step">${state.i + 1} de ${total}</div>
    <div class="tour-title">${esc(s.title)}</div>
    <div class="tour-text">${esc(s.text)}</div>
    <div class="tour-dots">${Array.from({ length: total }, (_, k) => `<i class="${k === state.i ? 'on' : ''}"></i>`).join('')}</div>
    <div class="tour-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-t="stop">${s.final ? 'Cerrar' : 'Salir'}</button>
      <span class="grow"></span>
      ${state.i > 0 ? `<button type="button" class="btn btn-secondary btn-sm" data-t="prev">${icon('arrowLeft')}</button>` : ''}
      ${s.final && videoOk ? `<button type="button" class="btn btn-secondary btn-sm" data-t="video">${icon('eye')} Ver video</button>` : ''}
      <button type="button" class="btn btn-primary btn-sm" data-t="next">${state.i === total - 1 ? 'Terminar' : 'Siguiente'} ${state.i === total - 1 ? '' : icon('arrowRight')}</button>
    </div>`;
  tip.querySelector('[data-t="stop"]').onclick = stopTour;
  tip.querySelector('[data-t="next"]').onclick = () => go(1);
  const pv = tip.querySelector('[data-t="prev"]'); if (pv) pv.onclick = () => go(-1);
  const vd = tip.querySelector('[data-t="video"]'); if (vd) vd.onclick = () => { stopTour(); openVideo(); };
  tip.classList.remove('busy');
  place();
  tip.querySelector('[data-t="next"]').focus({ preventScroll: true });
}

function place() {
  if (!state) return;
  const spot = state.root.querySelector('.tour-spot');
  const tip = state.root.querySelector('.tour-tip');
  const vw = innerWidth, vh = innerHeight, pad = 8;
  const el = state.target;
  if (!el || !document.contains(el)) {
    spot.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0;`;
    tip.className = 'tour-tip center';
    tip.style.left = `${Math.max(12, (vw - tip.offsetWidth) / 2)}px`;
    tip.style.top = `${Math.max(12, (vh - tip.offsetHeight) / 2)}px`;
    return;
  }
  const r = el.getBoundingClientRect();
  const x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad);
  const w = Math.min(vw - x - 4, r.width + pad * 2), h = Math.min(vh - y - 4, r.height + pad * 2);
  spot.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`;
  const tw = tip.offsetWidth, th = tip.offsetHeight, gap = 14;
  let left, top, side;
  if (y + h + gap + th <= vh - 8) { side = 'bottom'; top = y + h + gap; left = x + w / 2 - tw / 2; }
  else if (y - gap - th >= 8) { side = 'top'; top = y - gap - th; left = x + w / 2 - tw / 2; }
  else if (x + w + gap + tw <= vw - 8) { side = 'right'; left = x + w + gap; top = y + h / 2 - th / 2; }
  else if (x - gap - tw >= 8) { side = 'left'; left = x - gap - tw; top = y + h / 2 - th / 2; }
  else { side = 'inside'; left = vw / 2 - tw / 2; top = vh - th - 16; }
  left = Math.max(10, Math.min(vw - tw - 10, left));
  top = Math.max(10, Math.min(vh - th - 10, top));
  tip.className = `tour-tip side-${side}`;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

// ======================================================================
// Ayuda: lista de recorridos y video tutorial
// ======================================================================
export const VIDEO_URL = '/tutorial/sano-entrenador-tutorial.mp4';

export function openVideo() {
  const m = openModal({
    title: 'Video tutorial', sub: 'Cómo usar SanoEntrenador, paso a paso', size: 'xl',
    body: `<video class="tutorial-video" src="${VIDEO_URL}" poster="/tutorial/portada.jpg" controls autoplay playsinline preload="metadata"></video>`,
    footer: '<a class="btn btn-secondary" href="' + VIDEO_URL + '" download>' + icon('download') + ' Descargar</a><button class="btn btn-primary" data-close>Cerrar</button>'
  });
  return m;
}

let videoOk = null;
async function hasVideo() {
  if (videoOk != null) return videoOk;
  try { const r = await fetch(VIDEO_URL, { method: 'HEAD' }); videoOk = r.ok && /video/.test(r.headers.get('content-type') || ''); } catch (_) { videoOk = false; }
  return videoOk;
}

export async function openHelp() {
  const video = await hasVideo();
  const m = openModal({
    title: 'Ayuda', sub: video ? 'Elige un recorrido guiado o mira el video tutorial' : 'Elige un recorrido guiado', size: 'md',
    body: `<div class="stack">
      ${video ? `<button type="button" class="help-video" data-video><span class="help-play">${icon('arrowRight')}</span><span><b>Video tutorial</b><small>Las funciones principales explicadas con voz</small></span></button>` : ''}
      <div class="section-title">Recorridos guiados</div>
      <div class="help-list">${Object.entries(TOURS).map(([k, t]) => `<button type="button" class="help-item" data-tour-id="${k}"><span class="kpi-icon tone-brand" style="width:36px;height:36px">${icon(t.icon)}</span><span class="grow"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></span>${icon('arrowRight')}</button>`).join('')}</div>
    </div>`,
    footer: '<button class="btn btn-primary" data-close>Cerrar</button>'
  });
  const vb = m.el.querySelector('[data-video]'); if (vb) vb.onclick = () => { m.close(); openVideo(); };
  m.el.querySelectorAll('[data-tour-id]').forEach((b) => b.onclick = () => { m.close(); startTour(b.dataset.tourId); });
}
