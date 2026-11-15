// SanoEntrenador — Página pública del entrenador: /coach/USUARIO (sin sesión)
// Perfil, especialidad, planes y botón de WhatsApp para que los interesados escriban directo.
import { getPage } from '../store.js';
import { esc, waLink, applyLocale, usd, openModal } from '../utils.js';
import { icon } from '../icons.js';
import { planDuration } from '../gym.js';

const DS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const hour = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'a. m.' : 'p. m.'}`; };
const daysText = (d = []) => { const s = [1, 2, 3, 4, 5, 6, 0].filter((x) => d.includes(x)); if (s.length === 7) return 'Todos los días'; if (s.join() === '1,2,3,4,5') return 'Lunes a viernes'; if (s.join() === '1,2,3,4,5,6') return 'Lunes a sábado'; return s.map((x) => DS[x]).join(' · '); };
const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'E';

export function pageHTML(d, { preview = false } = {}) {
  const wa = d.whatsapp ? waLink(d.whatsapp, `Hola ${d.coach || ''}, vi tu página y quiero información para entrenar contigo 💪`) : '';
  const planWa = (p) => (d.whatsapp ? waLink(d.whatsapp, `Hola ${d.coach || ''}, me interesa el plan «${p.name}». ¿Cómo empiezo?`) : '');
  const ig = String(d.instagram || '').replace(/^@/, '');
  const certs = String(d.certifications || '').split(/[·,;\n]/).map((x) => x.trim()).filter(Boolean);
  const plans = (d.plans || []);
  const perSes = (p) => (p.kind === 'sesiones' && p.visits > 1 ? `<small class="cp-per">${usd(p.price / p.visits)} por sesión</small>` : '');
  return `<div class="cp-page ${preview ? 'cp-preview' : ''}">
    <section class="cp-hero">
      <div class="cp-glow"></div>
      <div class="cp-photo">${d.photo ? `<img src="${d.photo}" alt="${esc(d.coach)}">` : `<span>${esc(initials(d.coach || d.brand))}</span>`}</div>
      <span class="cp-tag">${icon('dumbbell')} Entrenador personal</span>
      <h1>${esc(d.coach || d.brand || 'Entrenador')}</h1>
      ${d.brand && d.brand !== d.coach ? `<div class="cp-brand">${esc(d.brand)}</div>` : ''}
      ${d.specialty ? `<p class="cp-spec">${esc(d.specialty)}</p>` : ''}
      <div class="cp-facts">${d.city ? `<span>${icon('pin')} ${esc(d.city)}</span>` : ''}${d.students ? `<span>${icon('users')} ${d.students} alumno${d.students === 1 ? '' : 's'} entrenando</span>` : ''}${d.hours ? `<span>${icon('clock')} ${esc(daysText(d.hours.days))} · ${hour(d.hours.start)} a ${hour(d.hours.end)}</span>` : ''}</div>
      <div class="cp-cta">${wa ? `<a class="btn btn-whatsapp btn-lg" href="${wa}" target="_blank" rel="noopener">${icon('whatsapp')} Quiero entrenar</a>` : ''}${ig ? `<a class="btn btn-secondary btn-lg" href="https://instagram.com/${esc(ig)}" target="_blank" rel="noopener">@${esc(ig)}</a>` : ''}</div>
    </section>
    ${d.bio || certs.length ? `<section class="cp-sec"><h2>${icon('user')} Sobre mí</h2>${d.bio ? `<p class="cp-bio">${esc(d.bio).replace(/\n/g, '<br>')}</p>` : ''}${certs.length ? `<div class="cp-certs">${certs.map((x) => `<span>${icon('shieldCheck')} ${esc(x)}</span>`).join('')}</div>` : ''}</section>` : ''}
    <section class="cp-sec"><h2>${icon('sparkle')} Qué incluye entrenar conmigo</h2>
      <div class="cp-feats">
        <div>${icon('clipboard')}<b>Rutina a tu medida</b><small>En tu teléfono, con series, cargas y descansos.</small></div>
        <div>${icon('trend')}<b>Tu progreso en gráficas</b><small>Peso, medidas, meta y logros en tu carnet digital.</small></div>
        <div>${icon('calendar')}<b>Sesiones agendadas</b><small>Recordatorios por WhatsApp antes de cada sesión.</small></div>
        <div>${icon('ruler')}<b>Evaluaciones físicas</b><small>Antes y ahora para ver lo que has logrado.</small></div>
      </div></section>
    ${plans.length ? `<section class="cp-sec"><h2>${icon('ticket')} Planes</h2><div class="cp-plans">${plans.map((p) => `<article class="cp-plan ${p.popular ? 'pop' : ''}" style="--pc:${esc(p.color || '#f97316')}">
        ${p.popular ? '<span class="cp-pop">Más elegido</span>' : ''}<div class="cp-plan-h"><b>${esc(p.name)}</b>${p.online ? '<span class="cp-on">Online</span>' : ''}</div>
        <div class="cp-price">${usd(p.price)}</div>${perSes(p)}
        <small class="cp-dur">${esc(planDuration(p))}</small>${p.note ? `<p>${esc(p.note)}</p>` : ''}
        ${planWa(p) ? `<a class="btn ${p.popular ? 'btn-primary' : 'btn-secondary'} btn-block" href="${planWa(p)}" target="_blank" rel="noopener">${icon('whatsapp')} Lo quiero</a>` : ''}</article>`).join('')}</div></section>` : ''}
    ${(d.places || []).length || d.address ? `<section class="cp-sec"><h2>${icon('pin')} Dónde entreno</h2><div class="cp-places">${[...(d.places || []), ...(d.address && !(d.places || []).includes(d.address) ? [d.address] : [])].map((x) => `<span>${icon('pin')} ${esc(x)}</span>`).join('')}</div></section>` : ''}
    <section class="cp-final"><h2>¿Empezamos?</h2><p>Escríbeme y armamos tu plan. La primera conversación no tiene compromiso.</p>${wa ? `<a class="btn btn-whatsapp btn-lg" href="${wa}" target="_blank" rel="noopener">${icon('whatsapp')} Escribir por WhatsApp</a>` : ''}</section>
    <p class="cp-by"><img src="/assets/logo.svg" alt="" width="18" height="18"> Hecho con <a href="/">SanoEntrenador</a></p>
  </div>`;
}

export async function mount(root) {
  document.documentElement.dataset.theme = 'dark';
  const slug = (/\/coach\/([a-z0-9-]+)/i.exec(location.pathname)?.[1] || '').toLowerCase();
  root.innerHTML = '<div class="cp-page"><div class="pt-loading"><div class="spinner"></div></div></div>';
  let d = null;
  try { d = slug ? await getPage(slug) : null; } catch (e) { console.error(e); }
  if (!d || d.published === false) {
    document.title = 'Página no encontrada · SanoEntrenador';
    root.innerHTML = `<div class="pt-page pt-ask"><div class="pt-ask-card"><img src="/assets/logo.svg" alt="" width="72" height="72"><h1>Página no disponible</h1><p>La página <b>/coach/${esc(slug || '—')}</b> no existe o no está publicada.</p><a class="btn btn-primary btn-block" href="/">Ir a SanoEntrenador</a></div></div>`;
    return;
  }
  try { applyLocale(d.country || 'VE', d.currency || null); } catch (_) {}
  document.title = `${d.coach || d.brand} · Entrenador personal`;
  const meta = document.querySelector('meta[name="description"]'); if (meta) meta.content = `${d.coach || d.brand}${d.specialty ? ' · ' + d.specialty : ''}. Planes y contacto por WhatsApp.`;
  root.innerHTML = pageHTML(d);
}

/** Vista previa desde Configuración (con los datos actuales, sin publicar) */
export async function previewPage(photo = '') {
  const { store } = await import('../store.js');
  const S = store.settings;
  const d = { coach: store.coachName, brand: store.businessName, specialty: S.specialty, bio: S.bio, certifications: S.certifications, city: S.city, address: S.address, instagram: S.instagram, whatsapp: S.whatsapp || S.phone, places: S.places || [], photo,
    hours: S.agenda ? { start: S.agenda.start, end: S.agenda.end, days: S.agenda.days } : null, students: store.activeMembers.length,
    plans: S.page?.showPrices === false ? [] : store.activePlans.map((p) => ({ name: p.name, price: p.price, kind: p.kind, visits: p.visits, months: p.months, days: p.days, online: !!p.online, popular: !!p.popular, note: p.note || '', color: p.color })) };
  const m = openModal({ title: 'Vista previa de tu página', size: 'lg', body: pageHTML(d, { preview: true }) });
  m.el.querySelector('.modal')?.classList.add('cp-modal');
}
