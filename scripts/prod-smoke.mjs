// Prueba rápida contra producción (no deja datos: la demo se borra al terminar)
// Uso: node prod-smoke.mjs <carpeta de capturas>
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';
const acc = JSON.parse(readFileSync(new URL('./.accounts.json', import.meta.url), 'utf8'));
const URL_ = process.env.SE_URL || 'https://sano-entrenador.web.app';
const OUT = process.argv[2] || '.';
mkdirSync(OUT, { recursive: true });
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errs = []; let fails = 0;
const ok = (n, c, x = '') => { console.log(c ? '  ✔' : '  ✘', n, x); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function page() {
  const ctx = await b.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport({ width: 1366, height: 860 });
  p.on('pageerror', (e) => errs.push(e.message));
  return { ctx, p };
}
const st = (p, fn) => p.evaluate(async (src) => { const { store } = await import('/js/store.js'); return (0, eval)(src)(store); }, fn.toString());
try {
  let codes = [];
  let { ctx, p } = await page();
  await p.goto(URL_, { waitUntil: 'networkidle2' });
  await p.waitForSelector('#lg-demo');
  ok('Producción carga el login', true);
  await p.click('#lg-demo');
  await p.waitForSelector('.country-grid [data-c="MX"]', { timeout: 60000 });
  ok('La demo pide el país', true);
  await p.click('.country-grid [data-c="MX"]'); await sleep(300);
  await p.evaluate(() => [...document.querySelectorAll('.modal [data-ok]')].pop().click());
  await p.waitForFunction(() => document.body.innerText.includes('Modo demo'), { timeout: 90000 });
  await p.waitForSelector('.tour-tip', { timeout: 20000 }).catch(() => {});
  ok('Recorrido guiado abierto al entrar', !!(await p.$('.tour-tip')));
  await p.screenshot({ path: OUT + '/prod-demo-tour.png' });
  await p.evaluate(async () => (await import('/js/tour.js')).stopTour());
  const n = await st(p, (s) => ({ alumnos: s.members.length, sesiones: s.sessions.length, ventas: s.recentSales.length, plantillas: s.templates.length, moneda: s.settings.currency }));
  ok('Demo real con datos (en pesos mexicanos)', n.alumnos >= 10 && n.sesiones >= 10 && n.ventas >= 5 && n.moneda === 'MXN', JSON.stringify(n));
  codes = await st(p, (s) => s.members.map((m) => m.cardCode).filter(Boolean));
  const valeria = await st(p, (s) => s.members.find((m) => /Valeria/.test(m.name))?.cardCode);
  const pub = await b.newPage();
  pub.on('pageerror', (e) => errs.push('portal: ' + e.message));
  await pub.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
  await pub.goto(`${URL_}/alumno/${valeria}`, { waitUntil: 'networkidle2' });
  await pub.waitForSelector('.pt-nav', { timeout: 30000 }).catch(() => {});
  ok('Portal del alumno /alumno/CÓDIGO', await pub.evaluate(() => document.body.innerText.includes('Valeria') && !!document.querySelector('.pt-nav')), valeria);
  await pub.screenshot({ path: OUT + '/prod-portal.png' });
  await pub.evaluate(() => document.querySelector('.pt-nav [data-t="progreso"]').click()); await sleep(1500);
  ok('El alumno ve su progreso (peso y medidas)', await pub.evaluate(() => /kg/.test(document.body.innerText) && /cm/.test(document.body.innerText)));
  await pub.screenshot({ path: OUT + '/prod-portal-progreso.png' });
  await pub.close();
  const pins = await st(p, (s) => Promise.all([s.verifyPin('1234'), s.verifyPin('9999')]));
  ok('PIN de la demo 1234 (y rechaza otros)', pins[0] === true && pins[1] === false, JSON.stringify(pins));
  const uid = await p.evaluate(async () => (await import('/js/firebase.js')).auth.currentUser.uid);
  await p.evaluate(() => document.getElementById('demo-end').click());
  await p.waitForSelector('.modal [data-yes]'); await p.click('.modal [data-yes]');
  await p.waitForSelector('#login-form', { timeout: 90000 });
  ok('Demo terminada y limpiada', true, uid.slice(0, 6));
  await ctx.close();

  ({ ctx, p } = await page());
  await p.goto(URL_, { waitUntil: 'networkidle2' });
  await p.waitForSelector('#login-form');
  await p.type('#lg-user', 'entrenador01'); await p.type('#lg-pass', acc.entrenador01.password); await p.click('#lg-btn');
  await p.waitForSelector('.sb-nav, .country-grid', { timeout: 30000 });
  await sleep(2500);
  ok('entrenador01 entra en producción', true, (await p.$('.country-grid')) ? '(pide el país la primera vez)' : '');
  await p.screenshot({ path: OUT + '/prod-entrenador01.png' });
  await ctx.close();

  ({ ctx, p } = await page());
  await p.goto(URL_, { waitUntil: 'networkidle2' });
  await p.waitForSelector('#login-form');
  await p.type('#lg-user', 'admin'); await p.type('#lg-pass', acc.admin.password); await p.click('#lg-btn');
  await p.waitForSelector('[data-enter]', { timeout: 30000 });
  await sleep(3000);
  const count = await p.$$eval('[data-enter]', (x) => x.length);
  ok('Admin ve los 20 entrenadores', count === 20, String(count));
  const gone = await p.evaluate(async (u, cs) => {
    const f = await import('/js/firebase.js');
    if ((await f.getDoc(f.doc(f.db, 'tenants', u))).exists()) return false;
    for (const c of cs.slice(0, 5)) if ((await f.getDoc(f.doc(f.db, 'cards', c))).exists()) return false;
    return true;
  }, uid, codes);
  ok('Sin rastros de la demo ni de sus carnets', gone);
  await p.screenshot({ path: OUT + '/prod-admin.png' });
  await ctx.close();
} catch (e) { console.log('ERROR', e.message); fails++; }
await b.close();
console.log('Errores de página:', errs.length ? errs.join(' | ') : 'ninguno');
console.log(fails ? `FALLAS: ${fails}` : 'PRODUCCIÓN OK');
process.exit(fails ? 1 : 0);
