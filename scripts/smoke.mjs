// SanoEntrenador — Recorrido completo en teléfono: demo, todas las vistas, ficha del alumno, ejercicios,
// generador de rutinas, portal del alumno (todas las pestañas + entrenar + pesaje) y página pública.
// Uso: node smoke.mjs [url=http://127.0.0.1:5151] [ancho=390] [carpeta]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || 'http://127.0.0.1:5151';
const W = Number(process.argv[3] || 390);
const OUT = process.argv[4] || path.join(here, 'shots', 'smoke-' + W);
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEWS = ['inicio', 'agenda', 'asistencia', 'alumnos', 'rutinas', 'alimentacion', 'avisos', 'cobros', 'reportes', 'ajustes'];
let fails = 0; const errs = [];

const measure = (W) => ({
  sw: document.documentElement.scrollWidth,
  over: [...document.querySelectorAll('body *')].filter((el) => {
    const r = el.getBoundingClientRect(); if (!r.width || r.right <= W + 1) return false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return false; }
    return ![...el.children].some((c) => c.getBoundingClientRect().right > W + 1);
  }).slice(0, 6).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} → ${Math.round(el.getBoundingClientRect().right)}px`)
});

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 300000 });
const page = await browser.newPage();
await page.setViewport({ width: W, height: W < 600 ? 844 : 900, isMobile: W < 900, hasTouch: W < 900, deviceScaleFactor: W < 900 ? 2 : 1 });
page.on('pageerror', (e) => errs.push(`[pageerror] ${e.message} ${(e.stack || '').split(String.fromCharCode(10)).slice(1, 4).join(' | ')}`));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource|websocket|WebChannel/i.test(m.text())) errs.push(`[console] ${m.text().slice(0, 240)}`); });
page.on('dialog', (d) => { errs.push('[dialog] ' + d.message()); d.dismiss(); });

const check = async (label, shot = true) => {
  if (process.env.TRACE) console.log('  ·', label);
  const m = await page.evaluate(measure, W);
  const bad = m.sw > W + 1 || m.over.length;
  if (bad) { fails++; console.log(`✗ ${label}: doc ${m.sw}px`, m.over); } else console.log(`✓ ${label}`);
  if (shot || bad) await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: true });
};
const closeModals = () => page.evaluate(() => document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove()));
const killTour = () => page.evaluate(async () => { try { (await import('/js/tour.js')).stopTour(); } catch (_) {} document.querySelectorAll('.tour').forEach((x) => x.remove()); });
const nav = async (v) => { if (process.env.TRACE) console.log('  → nav', v); await killTour(); await page.evaluate((v) => { import('/js/main.js').then((m) => m.navigate(v)); }, v); await sleep(1600); };

// ---------- Demo ----------
await page.goto(BASE + '/?emu=1', { waitUntil: 'networkidle2' });
await check('login');
await page.click('#lg-demo');
await page.waitForSelector('.country-grid [data-c="VE"]', { timeout: 60000 });
await page.click('.country-grid [data-c="VE"]'); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll('.modal [data-ok]')].pop().click());
await page.waitForFunction(() => document.body.innerText.includes('Modo demo'), { timeout: 120000 });
await page.waitForSelector('.tour-tip', { timeout: 10000 }).catch(() => {}); await sleep(800);
await killTour();
await closeModals();
for (const v of VIEWS) {
  await nav(v);
  if (await page.$('.modal [data-pin]')) { await page.type('.modal [data-pin]', '1234'); await page.evaluate(() => document.querySelector('.modal [data-ok]').click()); await sleep(1500); }
  await check('v-' + v);
}
// Configuración: todas las secciones
await nav('ajustes');
for (const s of ['pagina', 'planes', 'agenda', 'mensajes', 'moneda', 'recibos', 'seguridad', 'apps']) {
  await page.evaluate((s) => document.querySelector(`[data-s="${s}"]`)?.click(), s); await sleep(500); await check('ajustes-' + s, false);
}
// Rutinas: biblioteca, ficha de ejercicio y generador
await nav('rutinas');
await page.evaluate(() => document.querySelector('#rt-tabs [data-t="ejercicios"]').click()); await sleep(600);
await check('rutinas-biblioteca');
await page.evaluate(() => document.querySelector('[data-x="sq"]').click()); await sleep(600);
await check('ficha-sentadilla'); await closeModals();
await page.evaluate(() => document.querySelector('#rt-gen').click()); await sleep(700);
await page.evaluate(() => document.querySelector('[data-n="place"][data-v="casa"]').click()); await sleep(300);
await check('generador'); await closeModals();
// Alimentación: plantillas, alimentos, asignados, ficha de plan, generador y editor
await nav('alimentacion');
await page.evaluate(() => document.querySelector('#nt-b [data-i="0"]').click()); await sleep(700);
await check('alim-plantilla'); await closeModals();
await page.evaluate(() => document.querySelector('#nt-tabs [data-t="alimentos"]').click()); await sleep(600);
await check('alim-alimentos');
await page.evaluate(() => document.querySelector('#nt-tabs [data-t="asignados"]').click()); await sleep(600);
await check('alim-asignados', false);
await page.evaluate(() => document.querySelector('#nt-gen').click()); await sleep(700);
await page.evaluate(() => document.querySelector('[data-n="period"][data-v="mensual"]').click()); await sleep(400);
await check('alim-generador');
await page.evaluate(() => [...document.querySelectorAll('.modal [data-ok]')].pop().click()); await sleep(900);
await check('alim-editor');
await page.evaluate(() => document.querySelector('.modal [data-iadd="0"]').click()); await sleep(600);
await check('alim-buscar-alimento', false); await closeModals();
// Ficha del alumno: todas las pestañas
const mid = await page.evaluate(async () => { const { store } = await import('/js/store.js'); const m = store.members.find((x) => (x.evalHist || []).length > 2) || store.members[0]; return m.id; });
await page.evaluate(async (id) => (await import('/js/member.js')).openMember(id), mid); await sleep(1500);
for (const t of ['resumen', 'progreso', 'rutina', 'alimentacion', 'sesiones', 'plan', 'bitacora', 'salud']) {
  await page.evaluate((t) => document.querySelector(`.modal [data-tab="${t}"], .modal [data-t="${t}"]`)?.click(), t); await sleep(700); await check('alumno-' + t, ['resumen', 'progreso', 'rutina', 'alimentacion'].includes(t));
}
await closeModals();
// Portal del alumno
const code = await page.evaluate(async (id) => { const { store } = await import('/js/store.js'); return store.member(id).cardCode; }, mid);
const portal = await browser.newPage();
await portal.setViewport({ width: W, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
portal.on('pageerror', (e) => errs.push(`[portal] ${e.message}`));
portal.on('console', (m) => { if (m.type() === 'error' && !/favicon|net::|Failed to load resource/i.test(m.text())) errs.push(`[portal console] ${m.text().slice(0, 240)}`); });
const pcheck = async (label) => { const m = await portal.evaluate(measure, W); const bad = m.sw > W + 1 || m.over.length; if (bad) { fails++; console.log(`✗ ${label}`, m.over); } else console.log(`✓ ${label}`); await portal.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: true }); };
await portal.goto(`${BASE}/alumno/${code}?emu=1`, { waitUntil: 'networkidle2' }); await sleep(2500);
await pcheck('portal-inicio');
for (const t of ['comidas', 'progreso', 'historial', 'entrenar']) { await portal.evaluate((t) => document.querySelector(`.pt-nav [data-t="${t}"]`).click(), t); await sleep(900); await pcheck('portal-' + t); }
await portal.evaluate(() => document.querySelector('[data-start]')?.click()); await sleep(800);
await portal.evaluate(() => document.querySelector('[data-set="0-0"]')?.click()); await sleep(900);
await pcheck('portal-entrenando');
await portal.evaluate(() => document.querySelector('[data-how="0"]')?.click()); await sleep(700);
await pcheck('portal-ficha-ejercicio');
await portal.evaluate(() => document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove()));
await portal.evaluate(() => document.querySelector('[data-load="0"]').value = '40 kg');
await portal.evaluate(() => { const i = document.querySelector('[data-load="0"]'); i.dispatchEvent(new Event('input')); document.querySelector('[data-finish]').click(); }); await sleep(700);
await pcheck('portal-terminar');
await portal.evaluate(() => document.querySelector('.modal [data-ok]').click()); await sleep(2500);
await pcheck('portal-celebracion');
const saved = await portal.evaluate(() => !!document.querySelector('.pt-done'));
console.log(saved ? '✓ entreno guardado' : '✗ el entreno no se guardó'); if (!saved) fails++;
await portal.evaluate(() => document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove()));
await portal.evaluate(() => document.querySelector('.pt-nav [data-t="progreso"]').click()); await sleep(700);
await portal.evaluate(() => document.querySelector('[data-weigh]').click()); await sleep(500);
await portal.type('.modal [name="w"]', '71,4'); await portal.evaluate(() => document.querySelector('.modal [data-ok]').click()); await sleep(2500);
const w = await portal.evaluate(() => document.body.innerText.includes('Peso guardado') || !!document.querySelector('.pchart'));
console.log(w ? '✓ pesaje guardado' : '✗ pesaje'); if (!w) fails++;
await pcheck('portal-progreso-con-pesaje');
await portal.goto(`${BASE}/alumno/?emu=1`, { waitUntil: 'networkidle2' }); await sleep(1200); await pcheck('portal-codigo');
await portal.goto(`${BASE}/alumno/NOEXISTE?emu=1`, { waitUntil: 'networkidle2' }); await sleep(2000); await pcheck('portal-no-existe');
// El entrenador ve el entreno en su panel
await nav('inicio'); await sleep(1500);
const seen = await page.evaluate(() => document.body.innerText.includes('Entrenó'));
console.log(seen ? '✓ el entreno aparece en el panel del entrenador' : '· (el panel no mostró el entreno aún)');
await check('inicio-tras-entreno');
// Página pública (no publicada en demo)
await portal.goto(`${BASE}/coach/demo-coach?emu=1`, { waitUntil: 'networkidle2' }); await sleep(1500); await pcheck('coach-no-publicada');
console.log('\nErrores:', errs.length ? '\n' + [...new Set(errs)].join('\n') : 'ninguno');
console.log(fails ? `\n${fails} problema(s) de diseño` : '\nSin desbordes');
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
