// SanoEntrenador — Asistencia: resultado al escanear el carnet, sesión suelta y escáner QR
import { store, memberStatus, statusBadge } from './store.js';
import { checkAttendance, registerAttendance, toMin } from './ops.js';
import { openModal, esc, toast, fmtDate } from './utils.js';
import { icon } from './icons.js';
import { avatar, hydratePhotos, memberPhoto } from './member.js';
import { requirePin } from './auth.js';
import { membershipLine } from './membership.js';

/** Tarjeta grande con el resultado de la asistencia */
export function accessCardHTML(m, r, { compact = false, session = null } = {}) {
  const cls = r.level === 'deny' ? 'deny' : r.level === 'warn' ? 'warn' : 'ok';
  const ms = m?.membership;
  return `<div class="access ${cls} ${compact ? 'compact' : ''}">
    <div class="access-top"><span class="access-ic">${icon(cls === 'deny' ? 'x' : cls === 'warn' ? 'alert' : 'check')}</span><div><div class="access-title">${cls === 'deny' ? 'NO PUEDE ENTRENAR' : cls === 'warn' ? 'A ENTRENAR, CON AVISO' : '¡A ENTRENAR!'}</div><div class="access-time">${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}${session ? ` · sesión de las ${esc(session.time)}` : ''}</div></div></div>
    ${m ? `<div class="access-who">${avatar(m, 'avatar-xl')}<div class="grow" style="min-width:0"><div class="access-name">${esc(m.name)}</div><div class="t-sub">${esc(m.number)}${m.goal ? ' · ' + esc(m.goal) : ''}</div><div class="mt-xs">${statusBadge(memberStatus(m))}</div></div></div>
    ${ms ? `<div class="access-plan"><b>${esc(ms.planName)}</b><span>${membershipLine(m, false)}</span><span class="faint">Vigencia ${fmtDate(ms.start)} al ${fmtDate(ms.end)}</span></div>` : ''}` : ''}
    ${r.reasons.length ? `<ul class="access-list deny">${r.reasons.map((x) => `<li>${icon('x')}${esc(x)}</li>`).join('')}</ul>` : ''}
    ${r.notes.length ? `<ul class="access-list">${r.notes.map((x) => `<li>${icon('info')}${esc(x)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

/**
 * Marca la asistencia (QR, búsqueda o ficha): si tiene sesión hoy la marca «asistió»; si no, registra una sesión fuera de agenda.
 * Si no puede entrenar, ofrece renovar, cobrar una sesión suelta o autorizar con PIN.
 */
export async function doCheckin(m, { via = 'manual' } = {}) {
  if (!m) return null;
  const r = checkAttendance(m);
  let res = null;
  if (r.level !== 'deny') res = await registerAttendance(m, { via, check: r });
  const fresh = store.member(m.id) || m;
  return new Promise((resolve) => {
    const md = openModal({
      size: 'md',
      body: accessCardHTML(fresh, res?.check || r, { session: res?.session }),
      footer: r.level === 'deny'
        ? `<button class="btn btn-ghost" data-force>${icon('unlock')} Autorizar (PIN)</button><span class="grow"></span>${store.activePlans.some((p) => p.kind === 'pase') ? `<button class="btn btn-secondary" data-pass>${icon('ticket')} Sesión suelta</button>` : ''}<button class="btn btn-primary" data-renew>${icon('refresh')} ${fresh.membership ? 'Renovar' : 'Vender plan'}</button>`
        : `<button class="btn btn-secondary" data-open>${icon('user')} Ficha</button>${(Number(fresh.balance) || 0) > 0.009 ? `<button class="btn btn-secondary" data-debt>${icon('dollar')} Cobrar deuda</button>` : ''}<button class="btn btn-primary" data-close autofocus>Listo</button>`,
      onClose: () => resolve(res)
    });
    hydratePhotos(md.el);
    const q = (s) => md.el.querySelector(s);
    q('[data-open]')?.addEventListener('click', async () => { md.close(); const { openMember } = await import('./member.js'); openMember(fresh.id); });
    q('[data-debt]')?.addEventListener('click', async () => { md.close(); const { payDebtModal } = await import('./membership.js'); payDebtModal(fresh); });
    const sell = async (planId = null) => {
      md.close();
      const { sellModal } = await import('./membership.js');
      const out = await sellModal(fresh, { planId });
      if (out?.member) setTimeout(() => doCheckin(store.member(fresh.id) || out.member, { via }), 400);
    };
    q('[data-renew]')?.addEventListener('click', () => sell());
    q('[data-pass]')?.addEventListener('click', () => sell(store.activePlans.find((p) => p.kind === 'pase')?.id));
    q('[data-force]')?.addEventListener('click', async () => {
      if (!(await requirePin('Autorizar la sesión'))) return;
      res = await registerAttendance(fresh, { via, force: true, check: r });
      md.close(); toast(`Asistencia autorizada: ${fresh.name}`, 'warning');
    });
  });
}

// ======================================================================
// ESCÁNER QR CON LA CÁMARA (BarcodeDetector; los lectores USB escriben el código + Enter)
// ======================================================================
export const cameraScanSupported = () => 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
export function scanQR({ title = 'Escanear carnet' } = {}) {
  return new Promise((resolve) => {
    let stream = null; let stop = false; let found = null;
    const m = openModal({
      title, sub: 'Apunta la cámara al código QR del carnet del alumno', size: 'md',
      body: `<div class="scan-box"><video playsinline muted></video><div class="scan-frame"></div></div><div class="error-msg mt" data-err></div>`,
      footer: '<button class="btn btn-secondary" data-close>Cancelar</button>',
      onClose: () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); resolve(found); }
    });
    const video = m.el.querySelector('video');
    (async () => {
      try {
        const det = new window.BarcodeDetector({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream; await video.play();
        const loop = async () => {
          if (stop) return;
          try { const codes = await det.detect(video); if (codes[0]?.rawValue) { found = codes[0].rawValue; m.close(); return; } } catch (_) {}
          setTimeout(loop, 180);
        };
        loop();
      } catch (e) { m.el.querySelector('[data-err]').textContent = 'No se pudo abrir la cámara: ' + (e.message || e); }
    })();
  });
}
export { memberPhoto, toMin };
