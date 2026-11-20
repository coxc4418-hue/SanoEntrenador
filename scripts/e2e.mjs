// SanoEntrenador — Prueba de punta a punta contra los emuladores (cuentas creadas por test-emu.sh)
// Recorre lo que hace un entrenador real: país, alumno, plan, agenda, asistencia, rutina, evaluación,
// página pública, portal del alumno (entrenar y pesarse), reglas de seguridad y panel admin.
// Uso: node e2e.mjs [url=http://127.0.0.1:5151] [carpeta de capturas]
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] || 'http://127.0.0.1:5151';
const BASE = ROOT + '/?emu=1';
const OUT = path.resolve(here, process.argv[3] || 'shots');
mkdirSync(OUT, { recursive: true });
const acc = JSON.parse(readFileSync(path.join(here, '.accounts-emu.json'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; let passed = 0;
const ok = (name, cond, extra = '') => { console.log(cond ? '  ✔' : '  ✘', name, extra); if (cond) passed++; else fails++; };
const errs = [];

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
async function newPage(mobile = false) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport(mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { width: 1366, height: 860 });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.dismiss());
  return { ctx, p };
}
// Ejecuta una función con acceso a los módulos de la app
const run = (p, fn, arg = null) => p.evaluate(async (src, a) => {
  const M = { store: (await import('/js/store.js')).store, ops: await import('/js/ops.js'), utils: await import('/js/utils.js'), guide: await import('/js/exguide.js'), fb: await import('/js/firebase.js') };
  return (0, eval)(src)(M, a);
}, fn.toString(), arg);
const until = async (p, fn, arg = null, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await run(p, fn, arg).catch(() => false)) return true; await sleep(300); } return false; };
const text = (p) => p.evaluate(() => document.body.innerText);
const login = async (p, user, pass) => {
  await p.goto(BASE, { waitUntil: 'networkidle2' });
  await p.waitForSelector('#login-form');
  await p.type('#lg-user', user); await p.type('#lg-pass', pass); await p.click('#lg-btn');
};
const pickCountry = async (p, code) => {
  await p.waitForSelector(`.country-grid [data-c="${code}"]`, { timeout: 60000 });
  await p.click(`.country-grid [data-c="${code}"]`); await sleep(250);
  await p.evaluate(() => [...document.querySelectorAll('.modal [data-ok]')].pop().click());
  await sleep(1500);
};
const T = acc.entrenador01;

try {
  // ==================================================================
  console.log('1) Inicio de sesión y país');
  let { ctx, p } = await newPage();
  await login(p, 'entrenador01', T.password);
  await pickCountry(p, 'VE');
  await p.waitForSelector('.sb-nav', { timeout: 30000 });
  await p.evaluate(async () => { try { (await import('/js/tour.js')).stopTour(); } catch (_) {} document.querySelectorAll('.tour').forEach((x) => x.remove()); });
  ok('entrenador01 entra y elige Venezuela', (await run(p, ({ store }) => store.settings.country)) === 'VE', await run(p, ({ store }) => store.settings.currency));
  await p.screenshot({ path: path.join(OUT, 'e2e-01-inicio.png') });

  // ==================================================================
  console.log('2) Alumno nuevo con carnet');
  const m = await run(p, async ({ ops }) => ops.saveMember({ name: 'Laura   Prueba', phone: '04141234567', idDoc: 'V-20.111.222', goal: 'Bajar de peso', goalWeight: '64', sex: 'F', birth: '1995-04-10' }));
  ok('Alumno creado con número y código de carnet', /^A-\d{4}$/.test(m.number) && m.cardCode?.length === 8, `${m.number} ${m.cardCode}`);
  ok('El nombre se limpia', m.name === 'Laura Prueba');
  ok('Aparece en la lista', await until(p, ({ store }, id) => !!store.member(id), m.id));
  const dup = await run(p, async ({ ops }) => { try { await ops.saveMember({ name: 'Otra', idDoc: '20111222' }); return false; } catch (e) { return /Ya existe/.test(e.message); } });
  ok('No deja repetir la cédula', dup);
  ok('Carnet público creado', await run(p, async ({ fb }, c) => (await fb.getDoc(fb.doc(fb.db, 'cards', c))).exists(), m.cardCode));

  // ==================================================================
  console.log('3) Plan de sesiones y cobro');
  const plan = await run(p, ({ store }) => store.activePlans.find((x) => Number(x.visits) > 0) || store.activePlans[0]);
  await run(p, async ({ ops, store, utils }, a) => { await ops.sellMembership({ member: store.member(a.id), plan: a.plan, start: utils.todayKey(), payments: [{ method: 'efectivo', amount: 1e9 }] }); }, { id: m.id, plan });
  ok('Vende el plan y queda activo', await until(p, ({ store }, id) => !!store.member(id)?.membership, m.id), plan.name);
  ok('El cobro queda registrado', await until(p, ({ store }) => store.recentSales.length >= 1));
  const left0 = await run(p, ({ store }, id) => store.member(id).membership?.visitsLeft ?? null, m.id);

  // ==================================================================
  console.log('4) Agenda y asistencia');
  await run(p, async ({ ops, utils }, id) => { await ops.saveSession({ date: utils.todayKey(), time: '23:30', minutes: 60, type: 'presencial', place: 'Gimnasio', memberIds: [id] }); }, m.id);
  ok('Sesión agendada para hoy', await until(p, ({ store }) => store.todaySessions.some((s) => s.time === '23:30')));
  const att = await run(p, async ({ ops, store }, id) => { const r = await ops.registerAttendance(store.member(id), { via: 'qr' }); return { ok: r.ok, ses: !!r.session }; }, m.id);
  ok('El QR marca la asistencia en la sesión de hoy', att.ok && att.ses, JSON.stringify(att));
  if (left0 != null) ok('Descuenta una sesión del paquete', await until(p, ({ store }, a) => store.member(a.id).membership?.visitsLeft === a.left - 1, { id: m.id, left: left0 }), `${left0} → ${left0 - 1}`);
  await sleep(800);
  await run(p, async ({ ops, store }, id) => ops.registerAttendance(store.member(id), { via: 'qr' }), m.id);
  await sleep(800);
  ok('Marcar dos veces no descuenta otra sesión', await run(p, ({ store }, a) => a.left == null || store.member(a.id).membership?.visitsLeft === a.left - 1, { id: m.id, left: left0 }));

  // ==================================================================
  console.log('5) Rutina a la medida y evaluación');
  const rt = await run(p, async ({ ops, store, guide }, id) => {
    const g = guide.generateRoutine({ goal: 'Bajar de peso', level: 'Principiante', days: 3, place: 'casa', minutes: 45 });
    const r = await ops.saveRoutine(g, null, store.member(id));
    return { days: g.days.length, items: g.days.reduce((a, d) => a + d.items.length, 0), id: r.id };
  }, m.id);
  ok('Genera una rutina en casa de 3 días', rt.days === 3 && rt.items >= 9, JSON.stringify(rt));
  ok('La rutina llega al carnet', await until(p, async ({ fb }, c) => !!(await fb.getDoc(fb.doc(fb.db, 'cards', c))).data()?.routine?.days?.length, m.cardCode));
  await run(p, async ({ ops, store, utils }, id) => {
    await ops.saveEvaluation(store.member(id), { date: utils.dayKey(utils.addDays(new Date(), -30)), weight: '70,5', height: '165', waist: '82', hip: '102', fat: '31' });
    await new Promise((r) => setTimeout(r, 800));
    await ops.saveEvaluation(store.member(id), { date: utils.todayKey(), weight: '68,9', height: '165', waist: '79', hip: '100', fat: '29,5' });
  }, m.id);
  ok('Dos evaluaciones en el historial', await until(p, ({ store }, id) => (store.member(id).evalHist || []).length === 2, m.id));
  ok('El carnet trae el avance (−1,6 kg)', await until(p, async ({ fb }, c) => { const h = (await fb.getDoc(fb.doc(fb.db, 'cards', c))).data()?.evals || []; return h.length === 2 && Math.abs(h[1].weight - h[0].weight + 1.6) < 0.01; }, m.cardCode));

  // ==================================================================
  console.log('5b) Plan de alimentación');
  const dt = await run(p, async ({ ops, store }, id) => { const n = await import('/js/nutrition.js'); const g = n.generateDiet({ goal: 'Bajar de peso', kcal: 1600, type: 'criollo', meals: 4, period: 'mensual' }); const r = await ops.saveDiet(g, null, store.member(id)); return { days: r.days.length, start: r.start, end: r.end }; }, m.id);
  ok('Plan mensual de 28 días asignado', dt.days === 28 && !!dt.end, JSON.stringify(dt));
  ok('El plan llega al carnet', await until(p, async ({ fb }, c) => (await fb.getDoc(fb.doc(fb.db, 'cards', c))).data()?.diet?.days?.length === 28, m.cardCode));
  ok('La ficha del alumno marca su plan', await until(p, ({ store }, id) => !!store.member(id)?.dietId, m.id));
  await run(p, async ({ ops }) => { const n = await import('/js/nutrition.js'); const t = n.dietTemplates()[0]; await ops.saveDiet({ ...t, name: 'Mi plantilla E2E' }); });
  ok('Guarda plantillas de alimentación propias', await until(p, ({ store }) => store.dietTemplates.some((x) => x.name === 'Mi plantilla E2E')));
  const wk = await run(p, async ({ ops, store }) => { const n = await import('/js/nutrition.js'); const sel = store.activePlans.length; void sel; const g = n.generateDiet({ goal: 'Ganar masa muscular', kcal: 2800 }); return g.days.length; });
  ok('Plan semanal de 7 días', wk === 7);

  // ==================================================================
  console.log('5c) Tarifas con plan alimenticio y de nutrición');
  const full = { id: 'full40', name: 'Personalizado + alimenticio + nutrición', kind: 'tiempo', months: 1, days: 0, price: 40, color: '#8b5cf6', withDiet: true, withNutri: true, active: true };
  await run(p, async ({ store }, f) => { await store.saveSettings({ plans: [...store.settings.plans, f] }); }, full);
  await run(p, async ({ ops, store, utils }, a) => { await ops.sellMembership({ member: store.member(a.id), plan: store.plan(a.pid), start: utils.todayKey(), payments: [{ method: 'efectivo', amount: 1e9 }] }); }, { id: m.id, pid: full.id });
  ok('La membresía guarda lo que incluye', await until(p, ({ store }, id) => { const x = store.member(id)?.membership; return x?.planId === 'full40' && x.withDiet && x.withNutri; }, m.id));
  const pend = await run(p, async ({ ops, store }, id) => ops.pendingExtras(store.member(id)), m.id);
  ok('Marca como pendiente solo la nutrición (ya tiene plan alimenticio)', JSON.stringify(pend) === '["nutri"]', JSON.stringify(pend));
  const nt = await run(p, async ({ ops, store }, id) => { const n = await import('/js/nutri.js'); const g = n.generateNutri({ goal: 'Bajar de peso', weight: 70, period: 'mensual' }); const r = await ops.saveNutri(g, null, store.member(id)); return { kcal: r.kcal, protein: r.protein, habits: r.habits.length, end: r.end }; }, m.id);
  ok('Asigna un plan de nutrición mensual', nt.kcal > 1000 && nt.protein > 100 && nt.habits >= 5 && !!nt.end, JSON.stringify(nt));
  ok('La nutrición llega al carnet', await until(p, async ({ fb }, c) => { const d = (await fb.getDoc(fb.doc(fb.db, 'cards', c))).data(); return (d?.nutri?.habits || []).length >= 5 && d?.nutri?.phases?.length === 4 && d?.plan?.withNutri === true; }, m.cardCode));
  ok('Ya no queda nada pendiente', await until(p, async ({ ops, store }, id) => ops.pendingExtras(store.member(id)).length === 0, m.id));
  await run(p, async ({ ops }) => { const n = await import('/js/nutri.js'); await ops.saveNutri({ ...n.nutriTemplates()[2], name: 'Mi nutrición E2E' }); });
  ok('Guarda plantillas de nutrición propias', await until(p, ({ store }) => store.nutriTemplates.some((x) => x.name === 'Mi nutrición E2E')));

  // ==================================================================
  console.log('6) Vistas del entrenador');
  for (const v of ['inicio', 'agenda', 'asistencia', 'alumnos', 'rutinas', 'alimentacion', 'avisos', 'cobros', 'reportes', 'ajustes']) {
    await p.evaluate((v) => { import('/js/main.js').then((x) => x.navigate(v)); }, v); await sleep(1300);
    if (await p.$('.modal [data-pin]')) { await p.type('.modal [data-pin]', T.pin); await p.evaluate(() => document.querySelector('.modal [data-ok]').click()); await sleep(900); }
  }
  ok('Recorre todas las vistas sin errores', !errs.length, errs.slice(0, 2).join(' | '));
  await p.evaluate(() => { import('/js/main.js').then((x) => x.navigate('alumnos')); }); await sleep(1300);
  ok('La lista muestra a Laura', /Laura Prueba/.test(await text(p)));
  await p.screenshot({ path: path.join(OUT, 'e2e-02-alumnos.png') });
  const verify = await run(p, ({ store }, pin) => Promise.all([store.verifyPin(pin), store.verifyPin('0000')]), T.pin);
  ok('PIN correcto sí, otro no', verify[0] === true && verify[1] === false);

  // ==================================================================
  console.log('7) Página pública');
  const slug = await run(p, async ({ ops }) => ops.publishPage({ slug: 'Coach Prueba E2E', published: true }));
  ok('Publica su página', slug === 'coach-prueba-e2e', slug);
  const pub = await newPage(true);
  await pub.p.goto(`${ROOT}/coach/${slug}?emu=1`, { waitUntil: 'networkidle2' }); await sleep(2000);
  const ctext = await text(pub.p);
  ok('La página pública abre sin sesión', /WhatsApp/i.test(ctext));
  ok('La página muestra lo que incluye cada plan', /Plan de nutrición/.test(ctext) && /Plan alimenticio/.test(ctext));
  await pub.p.screenshot({ path: path.join(OUT, 'e2e-03-coach.png'), fullPage: true });

  // ==================================================================
  console.log('8) Portal del alumno (sin cuenta)');
  await pub.p.goto(`${ROOT}/alumno/${m.cardCode}?emu=1`, { waitUntil: 'networkidle2' });
  await pub.p.waitForSelector('.pt-nav', { timeout: 20000 }).catch(() => {});
  const home = await text(pub.p);
  ok('El alumno abre su carnet', /Laura/.test(home));
  ok('Su carnet dice qué incluye su plan', /Plan alimenticio/.test(home) && /Plan de nutrición/.test(home) && /Mis hábitos de hoy/.test(home));
  await pub.p.evaluate(() => document.querySelector('.pt-nav [data-t="progreso"]').click()); await sleep(900);
  const pt = await text(pub.p);
  ok('Ve su progreso en peso y medidas', /1,6\s*kg/.test(pt) && /cm/.test(pt));
  await pub.p.screenshot({ path: path.join(OUT, 'e2e-04-portal-progreso.png'), fullPage: true });
  await pub.p.evaluate(() => document.querySelector('.pt-nav [data-t="entrenar"]').click()); await sleep(900);
  await pub.p.evaluate(() => document.querySelector('[data-start]')?.click()); await sleep(700);
  await pub.p.evaluate(() => document.querySelector('[data-set="0-0"]')?.click()); await sleep(400);
  await pub.p.evaluate(() => document.querySelector('[data-finish]')?.click()); await sleep(600);
  await pub.p.evaluate(() => document.querySelector('.modal [data-ok]')?.click()); await sleep(2000);
  ok('Registra su entrenamiento', !!(await pub.p.$('.pt-done')));
  await pub.p.evaluate(() => document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove()));
  await pub.p.evaluate(() => document.querySelector('.pt-nav [data-t="progreso"]').click()); await sleep(700);
  await pub.p.evaluate(() => document.querySelector('[data-weigh]').click()); await sleep(400);
  await pub.p.type('.modal [name="w"]', '68,4'); await pub.p.evaluate(() => document.querySelector('.modal [data-ok]').click()); await sleep(2000);
  ok('Registra su peso', /68,4/.test(await text(pub.p)));
  ok('El entrenador ve lo que registró el alumno', await until(p, async ({ fb }, c) => (await fb.getDocs(fb.collection(fb.db, 'cards', c, 'logs'))).size >= 2, m.cardCode));
  const bad = await pub.p.evaluate(async (c) => { const f = await import('/js/firebase.js'); try { await f.setDoc(f.doc(f.db, 'cards', c), { name: 'hack' }, { merge: true }); return false; } catch (_) { return true; } }, m.cardCode);
  await pub.p.evaluate(() => document.querySelector('.pt-nav [data-t="comidas"]').click()); await sleep(900);
  const ct = await text(pub.p);
  ok('El alumno ve su menú del día en «Comidas»', /plan mensual/i.test(ct) && /kcal/.test(ct) && /Lista de compras/.test(ct));
  await pub.p.evaluate(() => document.querySelector('[data-mk="0"]')?.click()); await sleep(500);
  ok('Marca una comida como cumplida', /1 de 4 comidas cumplidas/.test(await text(pub.p)));
  await pub.p.screenshot({ path: path.join(OUT, 'e2e-04b-portal-comidas.png'), fullPage: true });
  await pub.p.evaluate(() => document.querySelector('[data-cs="nutri"]')?.click()); await sleep(700);
  const nx = await text(pub.p);
  ok('Ve su plan de nutrición en «Comidas › Nutrición»', /Mis metas de cada día/.test(nx) && /Suplementos/.test(nx) && /Prioriza/.test(nx) && /semana a semana/i.test(nx));
  await pub.p.evaluate(() => document.querySelector('[data-hb="0"]')?.click()); await sleep(500);
  await pub.p.evaluate(() => document.querySelector('[data-gl="1"]')?.click()); await sleep(500);
  const nx2 = await text(pub.p);
  ok('Marca hábitos y vasos de agua', /1\/\d+/.test(nx2) && /0,5 \//.test(nx2), nx2.match(/\d,?\d* \/ [\d,]+ L/)?.[0]);
  await pub.p.screenshot({ path: path.join(OUT, 'e2e-04c-portal-nutricion.png'), fullPage: true });
  ok('Un extraño no puede modificar el carnet', bad);
  ok('La ficha del ejercicio abre videos de la técnica', await pub.p.evaluate(async () => { const g = await import('/js/exguide.js'); const E = (await import('/js/gym.js')).EXERCISES; g.exerciseSheet((Array.isArray(E) ? E[0] : Object.values(E)[0]).id); await new Promise((r) => setTimeout(r, 300)); const t = document.getElementById('modals').innerHTML; document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove()); return /youtube/i.test(t); }));
  await pub.ctx.close();

  // ==================================================================
  console.log('9) Aislamiento entre entrenadores');
  const uid1 = await run(p, ({ store }) => store.tenantId);
  await ctx.close();
  ({ ctx, p } = await newPage());
  await login(p, 'entrenador02', acc.entrenador02.password);
  await pickCountry(p, 'CO');
  await p.waitForSelector('.sb-nav', { timeout: 30000 });
  ok('entrenador02 empieza vacío', (await run(p, ({ store }) => store.members.length)) === 0);
  const blocked = await run(p, async ({ fb }, u) => { try { await fb.getDocs(fb.collection(fb.db, 'tenants', u, 'members')); return false; } catch (_) { return true; } }, uid1);
  ok('No puede leer los alumnos de entrenador01', blocked);
  await ctx.close();

  // ==================================================================
  console.log('10) Panel del administrador');
  ({ ctx, p } = await newPage());
  await login(p, 'admin', acc.admin.password);
  await p.waitForSelector('[data-enter]', { timeout: 30000 }); await sleep(1500);
  ok('El admin ve las cuentas', (await p.$$eval('[data-enter]', (x) => x.length)) >= 3);
  await p.screenshot({ path: path.join(OUT, 'e2e-05-admin.png') });
  await ctx.close();
} catch (e) { console.log('ERROR', e.stack || e.message); fails++; }
await browser.close();
const pageErrs = [...new Set(errs)].filter((e) => !/Missing or insufficient permissions/.test(e));
console.log('Errores de página:', pageErrs.length ? pageErrs.join(' | ') : 'ninguno');
console.log(`\n${passed} OK · ${fails} fallas`);
process.exit(fails || pageErrs.length ? 1 : 0);
