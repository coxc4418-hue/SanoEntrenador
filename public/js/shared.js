// SanoEntrenador — Componentes compartidos: país y moneda, QR, WhatsApp al alumno e impresión
import { store, memberStatus, daysBetween } from './store.js';
import { openModal, toast, num, esc, fmtDateTime, fmtDate, setBusy, usd, bs, fx, methodLabel, qtyFmt, printHTML, todayKey, waLink, COUNTRIES, loc, flagImg, fmtTime } from './utils.js';
import { icon } from './icons.js';
import { DEFAULT_MSGS, fillTemplate } from './gym.js';

export const APP_NAME = 'SanoEntrenador';
export const APP_URL = 'https://sano-entrenador.web.app';
export const SALES_PHONE = '584221906045';
export const SALES_PHONE_FMT = '+58 422-190 6045';
export const salesWa = (msg = 'Hola, me interesa SanoEntrenador para gestionar mis alumnos. ¿Me pueden dar más información?') =>
  `https://wa.me/${SALES_PHONE}?text=${encodeURIComponent(msg)}`;

// ======================================================================
// PAÍS DE TRABAJO (se elige una sola vez, al entrar por primera vez)
// ======================================================================
/** Selector de país. force: no se puede cerrar sin elegir. Resuelve con el código del país. */
export function openCountryPicker({ force = false } = {}) {
  return new Promise((resolve) => {
    let picked = store.settings.country || '';
    let cur = store.settings.currency || '';
    const list = Object.entries(COUNTRIES).sort((a, b) => a[1].name.localeCompare(b[1].name, 'es'));
    const m = openModal({
      title: force ? '¿En qué país trabajas?' : 'País y moneda', size: 'md', dismissible: !force,
      sub: 'Según el país, SanoEntrenador trabaja con su moneda, sus formas de pago y el código telefónico para WhatsApp.',
      body: `<div class="stack"><label class="search"><svg></svg><input data-q placeholder="Buscar país…" autocomplete="off"></label><div class="country-grid" data-l></div><div data-cur></div><div class="error-msg" data-err></div></div>`,
      footer: `${force ? '' : '<button class="btn btn-secondary" data-close>Cancelar</button>'}<button class="btn btn-primary btn-lg" data-ok disabled>Continuar</button>`,
      onClose: () => resolve(picked && store.settings.country === picked ? picked : null)
    });
    m.el.querySelector('.search svg').outerHTML = icon('search');
    const draw = (qv = '') => {
      const t = qv.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      m.el.querySelector('[data-l]').innerHTML = list.filter(([, c]) => !t || c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t)).map(([k, c]) =>
        `<button type="button" class="country ${picked === k ? 'on' : ''}" data-c="${k}"><span class="flag">${flagImg(k, 24)}</span><span class="grow"><b>${esc(c.name)}</b><small>${esc(c.curName)} · ${esc(c.sym)}</small></span></button>`).join('');
      m.el.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { picked = b.dataset.c; cur = COUNTRIES[picked].cur; draw(m.el.querySelector('[data-q]').value); });
      const c = COUNTRIES[picked];
      m.el.querySelector('[data-cur]').innerHTML = c ? `<div class="card stack" style="padding:12px 14px"><div class="row" style="gap:10px"><span class="flag">${flagImg(picked, 30)}</span><div class="grow"><b>${esc(c.name)}</b><div class="t-sub">Formas de pago: Efectivo, tarjetas, transferencia${(c.extra || []).length ? ' y otras locales' : ''} · WhatsApp +${esc(c.dial)}</div></div></div>
        ${c.alt ? `<div class="field"><label>Moneda con la que cobras</label><div class="seg seg-block">${[[c.cur, c.curName + ' (' + c.sym + ')'], [c.alt.cur, c.alt.curName + ' (' + c.alt.sym + ')']].map(([k, l]) => `<button type="button" data-mc="${k}" class="${cur === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div></div>` : `<div class="small">Moneda: <b>${esc(c.curName)} (${esc(c.sym)})</b></div>`}
        ${store.settings.country && store.settings.country !== picked ? `<div class="vital-alert warning">Los montos ya registrados no se convierten: revisa los precios de los planes después de cambiar de país.</div>` : ''}</div>` : '';
      m.el.querySelectorAll('[data-mc]').forEach((b) => b.onclick = () => { cur = b.dataset.mc; draw(m.el.querySelector('[data-q]').value); });
      m.el.querySelector('[data-ok]').disabled = !picked;
    };
    m.el.querySelector('[data-q]').oninput = (e) => draw(e.target.value);
    m.el.querySelector('[data-ok]').onclick = async (e) => {
      if (!picked) return;
      setBusy(e.currentTarget, true, 'Guardando…');
      try { await store.setCountry(picked, cur); await (await import('./bcv.js')).onCountryChanged().catch(() => {}); toast(`Listo: trabajarás en ${loc().curName} (${loc().sym})`); m.close(); }
      catch (ex) { m.el.querySelector('[data-err]').textContent = ex.message; setBusy(e.currentTarget, false); }
    };
    draw();
  });
}

// ======================================================================
// QR
// ======================================================================
let qrLoad = null;
function loadQR() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  qrLoad ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = '/js/vendor/qrcode.js';
    s.onload = () => res(window.qrcode); s.onerror = rej;
    document.head.appendChild(s);
  });
  return qrLoad;
}
/** Imagen (data URL) con el código QR del texto */
export async function qrDataURL(text, cell = 4) {
  try {
    const q = await loadQR();
    const qr = q(0, 'M'); qr.addData(text); qr.make();
    return qr.createDataURL(cell, 2);
  } catch (_) { return ''; }
}

// ======================================================================
// WHATSAPP AL ALUMNO (plantillas editables en Ajustes › Mensajes)
// ======================================================================
export const cardLink = (m) => (m?.cardCode ? `${APP_URL}/alumno/${m.cardCode}` : '');
const whenTxt = (date) => {
  if (!date) return '';
  const d = daysBetween(todayKey(), date);
  return d === 0 ? 'hoy' : d === 1 ? 'mañana' : d === -1 ? 'ayer' : `el ${fmtDate(date)}`;
};
/** Variables de las plantillas para un alumno (y opcionalmente una sesión) */
export function msgVars(member = {}, { session = null, extra = {} } = {}) {
  const ms = member.membership || {};
  const left = ms.end ? daysBetween(todayKey(), ms.end) : null;
  return {
    nombre: String(member.name || '').trim().split(/\s+/)[0] || '',
    entrenador: store.coachName,
    plan: ms.planName || '',
    vence: ms.end ? fmtDate(ms.end) : '',
    dias: left == null ? '' : left < 0 ? `hace ${-left} días` : left === 0 ? 'hoy' : left === 1 ? 'mañana' : `en ${left} días (${fmtDate(ms.end)})`,
    sesiones: ms.kind !== 'tiempo' && ms.visitsLeft != null ? String(ms.visitsLeft) : '',
    fecha: session ? whenTxt(session.date) : '',
    hora: session?.time || '',
    lugar: session?.place ? ` en ${session.place}` : session?.type === 'online' ? ' (online)' : '',
    monto: (Number(member.balance) || 0) > 0.009 ? usd(member.balance) : '',
    enlace: cardLink(member),
    rutina: member.routineName || '',
    alimentacion: member.dietName || '',
    resultados: '',
    ...extra
  };
}
export function memberMessage(kind, { member = {}, session = null, extra = {}, text = null } = {}) {
  const tpl = text ?? store.msg(kind);
  return fillTemplate(tpl, msgVars(member, { session, extra })).replace(/\n{3,}/g, '\n\n').trim();
}
export function waMember(kind, ctx = {}) {
  const phone = ctx.member?.phone || '';
  const text = memberMessage(kind, ctx);
  window.open(phone ? waLink(phone, text) : 'https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
}
/** Mensaje sugerido según el estado del alumno */
export function suggestedMessage(m) {
  if ((Number(m.balance) || 0) > 0.009) return 'deuda';
  const st = memberStatus(m);
  if (st === 'por_vencer' && m.membership?.kind === 'sesiones' && Number(m.membership.visitsLeft) <= (store.access.lowSessions ?? 2)) return 'pocas_sesiones';
  return { por_vencer: 'por_vencer', vencido: 'vencido', agotado: 'pocas_sesiones', sin_plan: 'vencido' }[st] || 'libre';
}
/** Ventana para revisar/editar el mensaje antes de abrir WhatsApp */
export function composeWa(member, kind = null, ctx = {}) {
  let k = kind || suggestedMessage(member);
  const opts = Object.entries(DEFAULT_MSGS).map(([id, v]) => `<option value="${id}" ${id === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
  const m = openModal({
    title: `WhatsApp a ${esc(String(member.name || '').split(' ')[0])}`, sub: member.phone ? esc(member.phone) : 'Sin teléfono: elegirás el contacto en WhatsApp', size: 'md',
    body: `<div class="stack"><div class="field"><label>Mensaje</label><select class="input" data-k>${opts}</select></div>
      <textarea class="input" data-t rows="9" style="font-size:.95rem"></textarea><p class="hint">Puedes editar el texto. Las plantillas se cambian en Ajustes › Mensajes.</p></div>`,
    footer: `<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-whatsapp" data-send>${icon('whatsapp')} Abrir WhatsApp</button>`
  });
  const ta = m.el.querySelector('[data-t]');
  const fill = () => { ta.value = memberMessage(k, { member, ...ctx }); };
  m.el.querySelector('[data-k]').onchange = (e) => { k = e.target.value; fill(); };
  m.el.querySelector('[data-send]').onclick = () => {
    const text = ta.value.trim();
    window.open(member.phone ? waLink(member.phone, text) : 'https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    ctx.onSent?.(k); m.close();
  };
  fill();
  return m;
}
/** Texto con los resultados de una evaluación para enviar por WhatsApp */
export function evalResultsText(ev, prev = null) {
  const L = [];
  const diff = (k, unit, dec = 1) => {
    if (ev[k] == null) return;
    const d = prev && prev[k] != null ? Number(ev[k]) - Number(prev[k]) : null;
    L.push(`• ${({ weight: 'Peso', fat: '% grasa', muscle: 'Masa muscular', waist: 'Cintura', hip: 'Cadera', bmi: 'IMC', arm: 'Brazo', thigh: 'Muslo', chest: 'Pecho' })[k]}: *${num(ev[k], dec)}${unit}*${d != null && Math.abs(d) >= 0.05 ? ` (${d > 0 ? '+' : ''}${num(d, dec)}${unit})` : ''}`);
  };
  diff('weight', ' kg'); diff('bmi', ''); diff('fat', '%'); diff('muscle', ' kg'); diff('chest', ' cm'); diff('waist', ' cm'); diff('hip', ' cm'); diff('arm', ' cm'); diff('thigh', ' cm');
  return L.join('\n');
}

// ======================================================================
// IMPRESIÓN: recibos y documentos
// ======================================================================
export const PRINT_HEAD = '<meta charset="utf-8"><meta name="color-scheme" content="light"><style>:root{color-scheme:light}html,body{background:#fff;color:#000}</style>';
function ticketCSS(fmt) {
  const width = fmt === '58mm' ? '200px' : fmt === 'carta' ? '100%' : '290px';
  const font = fmt === 'carta' ? '13px' : fmt === '58mm' ? '10.5px' : '11.5px';
  return `@page { margin: ${fmt === 'carta' ? '12mm' : '2mm'}; }
    body { font-family: ${fmt === 'carta' ? 'Arial, Helvetica, sans-serif' : "'Courier New', monospace"}; font-size: ${font}; width: ${width}; margin: 0 auto; color: #000; }
    .c { text-align: center; } .b { font-weight: bold; } .hr { border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; } td { vertical-align: top; } .r { text-align: right; white-space: nowrap; padding-left: 6px; }
    .big { font-size: 1.25em; font-weight: bold; } .sm { font-size: .85em; }`;
}
function headerHTML() {
  const s = store.settings;
  return `<div class="c b" style="font-size:1.3em">${esc(store.businessName)}</div>${store.settings.coachName && store.settings.coachName !== store.businessName ? `<div class="c">${esc(store.settings.coachName)}</div>` : ''}
    ${s.rif ? `<div class="c">${esc(loc().tax)}: ${esc(s.rif)}</div>` : ''}
    ${s.address ? `<div class="c">${esc(s.address)}</div>` : ''}
    ${s.phone ? `<div class="c">Tel: ${esc(s.phone)}</div>` : ''}`;
}

/** Recibo de cobro (ticket o carta) */
export function receiptHTML(sale) {
  const s = store.settings;
  const rate = Number(sale.fxRate) || 0; const F = fx();
  const eq = (v) => (rate > 0 && F ? `${F.sym} ${num(v * rate, 2)}` : '');
  const ivaPct = Number(s.iva) || 0;
  const iva = ivaPct > 0 ? (sale.total - sale.total / (1 + ivaPct / 100)) : 0;
  const pays = (sale.payments || []).map((p) => `<tr><td colspan="2">${esc(methodLabel(p.method))}</td><td class="r">${usd(p.amount)}</td></tr>`).join('');
  const m = sale.memberId ? store.member(sale.memberId) : null;
  return `<!DOCTYPE html><html><head>${PRINT_HEAD}<title>${esc(sale.number)}</title><style>${ticketCSS(s.receiptFormat)}</style></head><body>
    ${headerHTML()}
    <div class="hr"></div>
    <div class="c big">${esc(s.docTitle || 'RECIBO')}</div>
    <div class="c b">N° ${esc(sale.number)}</div>
    <div>Fecha: ${fmtDateTime(sale.date)}</div>
    <div>Alumno: ${esc(sale.memberName || 'Cliente')}${sale.memberNumber ? ` (${esc(sale.memberNumber)})` : ''}</div>
    ${sale.memberIdDoc ? `<div>${esc(loc().id)}: ${esc(sale.memberIdDoc)}</div>` : ''}
    ${sale.status === 'voided' ? '<div class="c b">*** DOCUMENTO ANULADO ***</div>' : ''}
    <div class="hr"></div>
    <table>${(sale.items || []).map((it) => `<tr><td colspan="2" style="padding-top:3px">${qtyFmt(it.qty)} x ${esc(it.name)}</td><td class="r">${usd(it.total ?? it.price * it.qty)}</td></tr>`).join('')}</table>
    <div class="hr"></div>
    <table>
      <tr><td colspan="2">Subtotal</td><td class="r">${usd(sale.subtotal)}</td></tr>
      ${sale.discount > 0 ? `<tr><td colspan="2">Descuento</td><td class="r">-${usd(sale.discount)}</td></tr>` : ''}
      <tr class="big"><td colspan="2">TOTAL</td><td class="r">${usd(sale.total)}</td></tr>
      ${eq(sale.total) ? `<tr><td colspan="2">Equivalente</td><td class="r">${eq(sale.total)}</td></tr><tr><td colspan="3" class="sm">Tasa: 1 ${esc(loc().sym)} = ${num(rate, 2)} ${esc(F.sym)}</td></tr>` : ''}
      ${iva > 0.009 ? `<tr><td colspan="2">Impuesto ${num(ivaPct, 0)}% incluido</td><td class="r">${usd(iva)}</td></tr>` : ''}
    </table>
    ${pays ? `<div class="hr"></div><table>${pays}</table>` : ''}
    ${sale.changeUSD > 0.009 ? `<div>Vuelto: ${usd(sale.changeUSD)}</div>` : ''}
    ${m?.membership && sale.membershipId === m.membership.id ? `<div class="hr"></div><div class="b">Plan: ${esc(m.membership.planName)}</div><div>Vigencia: ${fmtDate(m.membership.paidFrom || m.membership.start)} al ${fmtDate(m.membership.end)}</div>${(Number(m.balance) || 0) > 0.009 ? `<div class="b">Saldo pendiente: ${usd(m.balance)}</div>` : ''}` : ''}
    ${sale.note ? `<div>Nota: ${esc(sale.note)}</div>` : ''}
    <div class="hr"></div>
    <div class="c">${esc(s.receiptFooter || '¡Gracias por entrenar conmigo!')}</div>
    <div class="c sm" style="margin-top:4px">SanoEntrenador</div>
  </body></html>`;
}
export function printReceipt(sale) { printHTML(receiptHTML(sale)); }

/** Documento imprimible genérico (reportes, listas, rutinas, evaluaciones) */
export function printDoc(title, inner, { accent = '#ea580c' } = {}) {
  printHTML(`<!DOCTYPE html><html><head>${PRINT_HEAD}<title>${esc(title)}</title>
  <style>
    @page { margin: 14mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 2px; } h2 { font-size: 14px; margin: 16px 0 6px; }
    .muted { color: #555; } table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { background: ${accent}; color: #fff; text-align: left; padding: 6px; font-size: 11px; }
    td { padding: 5px 6px; border-bottom: 1px solid #ddd; } .r { text-align: right; } .c { text-align: center; }
    .kpis { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
    .kpi { border: 1px solid #ccc; border-radius: 6px; padding: 8px 10px; min-width: 140px; }
    .kpi b { display: block; font-size: 15px; }
    .day { page-break-inside: avoid; }
  </style></head><body>
  <h1>${esc(store.businessName)}</h1>
  <div class="muted">${esc(title)} · Generado ${fmtDateTime(new Date().toISOString())}</div>
  ${inner}
  <p class="muted" style="margin-top:20px;font-size:10px">SanoEntrenador — Tus alumnos, rutinas y cobros en un solo lugar</p>
  </body></html>`);
}

export { usd, bs, fmtTime };
