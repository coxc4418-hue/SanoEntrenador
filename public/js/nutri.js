// SanoEntrenador — Planes de nutrición (metas de calorías y macros, agua, horarios, suplementos, hábitos).
// Sin sesión: lo usan el panel del entrenador y el carnet del alumno.
// Distinto del plan alimenticio (menú día por día, js/nutrition.js): aquí van las metas y las pautas.

export const NUTRI_GOALS = ['Bajar de peso', 'Definición', 'Ganar masa muscular', 'Recomposición corporal', 'Rendimiento deportivo', 'Mantener el peso', 'Salud general', 'Adulto mayor activo'];
export const NUTRI_TYPES = { todo: 'Come de todo', veg: 'Vegetariano' };

// Gramos por kg de peso: proteína (p) y grasa (f) · ajuste de calorías sobre el gasto diario (k)
const G = {
  'Bajar de peso': { p: 2.0, f: 0.8, k: 0.8 },
  'Definición': { p: 2.2, f: 0.8, k: 0.88 },
  'Ganar masa muscular': { p: 1.8, f: 1.0, k: 1.12 },
  'Recomposición corporal': { p: 2.0, f: 0.9, k: 0.95 },
  'Rendimiento deportivo': { p: 1.6, f: 1.0, k: 1.05 },
  'Mantener el peso': { p: 1.6, f: 0.9, k: 1 },
  'Salud general': { p: 1.4, f: 0.9, k: 1 },
  'Adulto mayor activo': { p: 1.3, f: 0.9, k: 1 }
};
export const goalRule = (goal) => G[goal] || G['Mantener el peso'];
const r5 = (n) => Math.round(n / 5) * 5;
const r1 = (n) => Math.round(n * 10) / 10;

/** Calorías sugeridas para el objetivo desde el gasto diario (o un valor típico) */
export function nutriKcal(goal, tdee = null) {
  return Math.round(((Number(tdee) || 2100) * goalRule(goal).k) / 50) * 50;
}
/** Metas diarias de macros con el peso y las calorías */
export function nutriMacros({ goal, weight, kcal, pkg = null, fkg = null }) {
  const w = Math.max(35, Math.min(200, Number(weight) || 70)); const k = Math.max(1000, Number(kcal) || 2000);
  const rule = goalRule(goal);
  const P = pkg || rule.p; const F = fkg || rule.f;
  const protein = r5(P * w);
  const fat = r5(Math.max(F * w, (k * 0.22) / 9));
  const carbs = r5(Math.max(60, (k - protein * 4 - fat * 9) / 4));
  return { protein, fat, carbs, pkg: P, fkg: F };
}

// ======================================================================
// CONTENIDO POR OBJETIVO
// ======================================================================
const TIMING = {
  base: [
    ['Al despertar', 'Un vaso grande de agua antes del café.'],
    ['Desayuno', 'Proteína + carbohidrato de calidad + fruta (ej.: huevos, arepa integral, lechosa).'],
    ['Pre-entreno · 60–90 min antes', 'Carbohidrato fácil de digerir + algo de proteína (ej.: avena con yogur, cambur con pan y queso).'],
    ['Post-entreno · hasta 2 h después', 'Proteína (25–40 g) + carbohidratos para recuperar (ej.: pollo con arroz, batido de proteína con cambur).'],
    ['Cena', 'Proteína magra + vegetales; carbohidrato moderado según el objetivo.']
  ],
  'Bajar de peso': [['Meriendas', 'Solo si hay hambre real: fruta, yogur natural o un puñado de maní.'], ['Cena', 'Ligera y 2–3 h antes de dormir: proteína + mucha ensalada.']],
  'Definición': [['Cena', 'Proteína + vegetales; deja los carbohidratos para el desayuno y alrededor del entreno.']],
  'Ganar masa muscular': [['Meriendas', 'Agrega 2 meriendas con proteína (yogur, sándwich de pollo, batido).'], ['Antes de dormir', 'Proteína lenta: yogur griego, queso o leche.']],
  'Recomposición corporal': [['Días sin entreno', 'Baja un poco los carbohidratos y mantén la proteína.']],
  'Rendimiento deportivo': [['Durante el entreno (más de 60 min)', 'Agua con electrolitos; si es largo, 30–60 g de carbohidrato por hora (bebida deportiva, fruta).']],
  'Adulto mayor activo': [['Meriendas', 'Lácteo o fruta a media mañana y media tarde para llegar a la proteína y el calcio.']]
};
const SUPP = {
  creatina: (w) => ({ name: 'Creatina monohidratada', dose: `${Math.max(3, Math.min(5, Math.round(w * 0.06)))} g al día`, when: 'Cualquier hora, todos los días (también en descanso)' }),
  proteina: () => ({ name: 'Proteína en polvo (whey o vegetal)', dose: '1 servicio (25–30 g)', when: 'Post-entreno o cuando no llegues a tu meta de proteína' }),
  cafeina: (w) => ({ name: 'Cafeína (o café negro)', dose: `${Math.round((w * 3) / 10) * 10} mg (≈ 3 mg por kg)`, when: '30–60 min antes de entrenar; no después de las 4 p. m.' }),
  electrolitos: () => ({ name: 'Electrolitos', dose: '1 sobre en 500–750 ml de agua', when: 'Entrenos de más de 60 min o con mucho calor' }),
  omega: () => ({ name: 'Omega 3', dose: '1–2 g al día', when: 'Con una comida' }),
  vitd: () => ({ name: 'Vitamina D', dose: 'Según indicación médica', when: 'Con el desayuno (solo si tu médico lo indica)' }),
  b12: () => ({ name: 'Vitamina B12', dose: 'Según indicación médica', when: 'Imprescindible en dieta vegetariana estricta' }),
  calcio: () => ({ name: 'Calcio', dose: 'Según indicación médica', when: 'Si no llegas con lácteos (2–3 porciones al día)' })
};
export const SUPPLEMENTS = Object.values(SUPP).map((f) => f(70));
const SUPP_BY_GOAL = {
  'Bajar de peso': ['proteina', 'cafeina'],
  'Definición': ['creatina', 'proteina', 'cafeina'],
  'Ganar masa muscular': ['creatina', 'proteina'],
  'Recomposición corporal': ['creatina', 'proteina'],
  'Rendimiento deportivo': ['creatina', 'cafeina', 'electrolitos'],
  'Mantener el peso': ['proteina'],
  'Salud general': ['omega', 'vitd'],
  'Adulto mayor activo': ['proteina', 'vitd', 'calcio', 'omega']
};
const FOODS_BY_GOAL = {
  base: {
    prioritize: ['Pollo, pescado, huevos, carne magra', 'Granos: caraotas, lentejas, garbanzos', 'Vegetales de todos los colores', 'Frutas enteras', 'Avena, arroz, papa, yuca, arepa', 'Agua'],
    moderate: ['Aceite, mantequilla, aguacate (son buenos, pero muy calóricos)', 'Queso amarillo y embutidos', 'Café con azúcar', 'Pan blanco y pasta'],
    avoid: ['Refrescos y jugos con azúcar', 'Frituras y comida rápida', 'Dulces, galletas y chucherías', 'Alcohol']
  },
  'Bajar de peso': { prioritize: ['Ensaladas y vegetales en cada comida (llenan con pocas calorías)', 'Proteína en cada comida'], avoid: ['Picar entre comidas', 'Comer viendo el teléfono o la TV'] },
  'Definición': { prioritize: ['Pescado y pollo a la plancha', 'Claras y huevos'], moderate: ['Sal y salsas'] },
  'Ganar masa muscular': { prioritize: ['Batidos caseros: leche, avena, cambur, mantequilla de maní', 'Arroz, pasta, papa, plátano'], moderate: ['Exceso de vegetales en la cena (llenan y quitan apetito)'], avoid: ['Saltarte comidas'] },
  'Rendimiento deportivo': { prioritize: ['Carbohidratos antes y después del entreno', 'Frutas con potasio: cambur, naranja, melón'] },
  'Salud general': { prioritize: ['Frutos secos y semillas', 'Pescado azul 2 veces por semana'] },
  'Adulto mayor activo': { prioritize: ['Lácteos: leche, yogur, queso blanco', 'Proteína fácil de masticar: huevos, pescado, pollo desmechado'], moderate: ['Sal'] }
};
const VEG = {
  prioritize: ['Granos: caraotas, lentejas, garbanzos, frijoles', 'Huevos, yogur y queso', 'Tofu, soya texturizada', 'Frutos secos y semillas'],
  moderate: ['Pasta y pan blanco (combínalos con granos)'],
  note: 'Combina granos con cereales (arroz con caraotas, arepa con frijoles) para obtener proteína completa.'
};
const HABITS = {
  base: ['Tomar {water} L de agua', 'Proteína en cada comida', '2 porciones de vegetales', 'Dormir 7–8 horas'],
  'Bajar de peso': ['Cero bebidas azucaradas', 'Comer despacio (20 min por comida)', 'Caminar 8.000 pasos'],
  'Definición': ['Cero bebidas azucaradas', 'Pesar o medir las porciones', 'Caminar 8.000 pasos'],
  'Ganar masa muscular': ['Hacer todas las comidas del día', 'Merienda con proteína antes de dormir'],
  'Recomposición corporal': ['Cero bebidas azucaradas', 'Entrenar fuerza según la rutina'],
  'Rendimiento deportivo': ['Comer antes y después de entrenar', 'Hidratarse durante el entreno'],
  'Mantener el peso': ['Comer a tus horas', '1–2 frutas al día'],
  'Salud general': ['1–2 frutas al día', 'Cero frituras', 'Caminar 30 minutos'],
  'Adulto mayor activo': ['2–3 lácteos al día', 'Caminar 30 minutos', 'Tomar sol 15 minutos']
};
const PHASES = {
  'Bajar de peso': [['Semana 1 · Orden', 'Respeta horarios y porciones. Quita bebidas azucaradas y frituras.'], ['Semana 2 · Hábitos', 'Proteína y vegetales en todas las comidas. Pésate 1 vez en ayunas.'], ['Semana 3 · Ajuste', 'Si no bajaste 0,3–1 kg por semana, quita 100–150 kcal (menos aceite o carbohidrato en la cena).'], ['Semana 4 · Consolidar', 'Mantén lo logrado, toma medidas y prepara la siguiente etapa con tu entrenador.']],
  'Definición': [['Semana 1 · Base', 'Proteína alta y porciones medidas.'], ['Semana 2 · Ajuste fino', 'Carbohidratos alrededor del entreno; cena más ligera.'], ['Semana 3 · Revisión', 'Si el peso no se mueve, baja 100 kcal; si pierdes fuerza, súbelas en días de pierna.'], ['Semana 4 · Mantener', 'Constancia: sin cambios bruscos. Fotos y medidas al final.']],
  'Ganar masa muscular': [['Semana 1 · Llegar a las calorías', 'Haz todas las comidas aunque no tengas hambre.'], ['Semana 2 · Proteína repartida', '4–5 tomas de proteína de 25–40 g.'], ['Semana 3 · Ajuste', 'Si no subiste 0,25–0,5 kg por semana, agrega 150–200 kcal (un batido).'], ['Semana 4 · Consolidar', 'Revisa medidas: brazo, pecho y pierna deben subir más que la cintura.']],
  base: [['Semana 1 · Adaptación', 'Aprende las porciones y los horarios.'], ['Semana 2 · Hábitos', 'Cumple la lista de hábitos todos los días.'], ['Semana 3 · Ajuste', 'Revisa con tu entrenador cómo te sientes y si hay que ajustar calorías.'], ['Semana 4 · Consolidar', 'Mantén lo aprendido y mide tus resultados.']]
};
const NOTES = {
  'Bajar de peso': 'El objetivo es bajar 0,5–1 % del peso por semana sin perder músculo. No te saltes comidas: reparte las calorías.',
  'Definición': 'Mantén la fuerza en el gimnasio: si cae mucho, el déficit es demasiado grande.',
  'Ganar masa muscular': 'Subir de peso despacio (0,25–0,5 kg por semana) para que sea músculo y no grasa.',
  'Recomposición corporal': 'Bajar grasa y ganar músculo al mismo tiempo: la báscula se mueve poco, guíate por las medidas y las fotos.',
  'Rendimiento deportivo': 'Los carbohidratos son tu combustible: no los recortes en días de entreno fuerte.',
  'Mantener el peso': 'Come variado y en horarios regulares; ajusta si el peso cambia más de 1 kg en un mes.',
  'Salud general': 'Comida real, poca procesada, y moverte todos los días.',
  'Adulto mayor activo': 'La proteína y el calcio protegen músculos y huesos. Consulta a tu médico antes de tomar suplementos.'
};
export const NUTRI_DISCLAIMER = 'Pautas generales de nutrición deportiva. Si tienes una condición médica, embarazo o tomas medicamentos, consulta a tu médico antes de cambiar tu alimentación o tomar suplementos.';

/** Arma el plan de nutrición completo */
export function generateNutri({ goal = 'Mantener el peso', weight = 70, kcal = null, type = 'todo', trainDays = 3, period = 'semanal', meals = null } = {}) {
  const w = Math.max(35, Math.min(200, Number(weight) || 70));
  const k = Number(kcal) || nutriKcal(goal);
  const mac = nutriMacros({ goal, weight: w, kcal: k });
  const water = r1(w * 0.033 + (trainDays >= 4 ? 0.5 : 0.3));
  const fiber = Math.round((k / 1000) * 14);
  const F = FOODS_BY_GOAL[goal] || {};
  const veg = type === 'veg';
  const uniq = (a) => [...new Set(a)];
  const supp = uniq([...(SUPP_BY_GOAL[goal] || ['proteina']), ...(veg ? ['b12'] : [])]).map((id) => SUPP[id](w));
  const timing = [...TIMING.base.filter(([w0]) => !(TIMING[goal] || []).some(([x]) => x === w0)), ...(TIMING[goal] || [])].map(([when, text]) => ({ when, text }));
  return {
    name: `Nutrición · ${goal}${veg ? ' (vegetariano)' : ''}`, goal, type: veg ? 'veg' : 'todo', period: period === 'mensual' ? 'mensual' : 'semanal',
    weight: w, kcal: k, protein: mac.protein, carbs: mac.carbs, fat: mac.fat, pkg: mac.pkg, fkg: mac.fkg, water, fiber,
    meals: Number(meals) || (/masa/i.test(goal) ? 5 : 4), trainDays: Number(trainDays) || 3,
    timing,
    supplements: supp,
    prioritize: uniq([...(F.prioritize || []), ...(veg ? VEG.prioritize : FOODS_BY_GOAL.base.prioritize)]),
    moderate: uniq([...(F.moderate || []), ...FOODS_BY_GOAL.base.moderate, ...(veg ? VEG.moderate : [])]),
    avoid: uniq([...(F.avoid || []), ...FOODS_BY_GOAL.base.avoid]),
    habits: uniq([...HABITS.base, ...(HABITS[goal] || [])]).map((h) => h.replace('{water}', String(water).replace('.', ','))).slice(0, 8),
    phases: (PHASES[goal] || PHASES.base).map(([title, text]) => ({ title, text })),
    note: [NOTES[goal] || '', veg ? VEG.note : ''].filter(Boolean).join(' '),
    params: { goal, type: veg ? 'veg' : 'todo', trainDays: Number(trainDays) || 3, period: period === 'mensual' ? 'mensual' : 'semanal' }
  };
}
/** Ajusta un plan (plantilla) al peso y las calorías de un alumno, conservando sus textos */
export function fitNutri(plan, { weight, kcal }) {
  const w = Number(weight) || plan.weight || 70; const k = Number(kcal) || plan.kcal;
  const mac = nutriMacros({ goal: plan.goal, weight: w, kcal: k, pkg: plan.pkg, fkg: plan.fkg });
  const water = r1(w * 0.033 + ((plan.trainDays || 3) >= 4 ? 0.5 : 0.3));
  const oldW = String(plan.water || '').replace('.', ',');
  return { ...plan, weight: w, kcal: k, protein: mac.protein, carbs: mac.carbs, fat: mac.fat, water, fiber: Math.round((k / 1000) * 14),
    habits: (plan.habits || []).map((h) => (oldW && h.includes(`${oldW} L`) ? h.replace(`${oldW} L`, `${String(water).replace('.', ',')} L`) : h)) };
}

const TPL = [
  ['n_bajar', 'Bajar de peso', 'todo', 4, 'Déficit moderado con proteína alta para no perder músculo. Hábitos para controlar el hambre.', 72, 1650],
  ['n_def', 'Definición', 'todo', 5, 'Para marcar: proteína muy alta, carbohidratos alrededor del entreno y ajustes semanales.', 70, 1900],
  ['n_masa', 'Ganar masa muscular', 'todo', 5, 'Superávit controlado, 5 comidas y creatina. Para subir músculo sin acumular grasa.', 70, 2700],
  ['n_recomp', 'Recomposición corporal', 'todo', 4, 'Bajar grasa y subir músculo a la vez: calorías casi de mantenimiento y proteína alta.', 72, 2050],
  ['n_rend', 'Rendimiento deportivo', 'todo', 5, 'Para deportistas: carbohidratos como combustible, hidratación y electrolitos.', 68, 2600],
  ['n_salud', 'Salud y energía', 'todo', 4, 'Comer mejor sin contar todo: comida real, agua, fibra y moverse a diario.', 70, 2000, 'Salud general'],
  ['n_veg', 'Vegetariano deportivo', 'veg', 4, 'Proteína completa sin carne (granos + cereales, huevos, lácteos) y vitamina B12.', 65, 2100, 'Ganar masa muscular'],
  ['n_mayor', 'Adulto mayor activo', 'todo', 5, 'Proteína, calcio y vitamina D para cuidar músculos y huesos.', 68, 1800]
];
/** Plantillas incluidas (referencia: peso indicado; al asignarlas se ajustan al alumno) */
export function nutriTemplates() {
  return TPL.map(([id, name, type, meals, desc, w, k, goal]) => {
    const p = generateNutri({ goal: goal || name, weight: w, kcal: k, type, meals, period: 'mensual', trainDays: 4 });
    return { ...p, id, name, desc, builtin: true, template: true };
  });
}

/** Lo que se publica en el carnet del alumno */
export function nutriSummary(p) {
  const s = (a) => (a || []).map((x) => String(x || '').slice(0, 200)).filter(Boolean).slice(0, 14);
  return {
    name: p.name || 'Plan de nutrición', goal: p.goal || '', type: p.type || 'todo', period: p.period || 'semanal', start: p.start || null, end: p.end || null,
    kcal: Number(p.kcal) || null, protein: Number(p.protein) || null, carbs: Number(p.carbs) || null, fat: Number(p.fat) || null,
    water: Number(p.water) || null, fiber: Number(p.fiber) || null, meals: Number(p.meals) || null, weight: Number(p.weight) || null,
    timing: (p.timing || []).slice(0, 12).map((t) => ({ when: String(t.when || '').slice(0, 80), text: String(t.text || '').slice(0, 240) })),
    supplements: (p.supplements || []).slice(0, 10).map((x) => ({ name: String(x.name || '').slice(0, 80), dose: String(x.dose || '').slice(0, 80), when: String(x.when || '').slice(0, 160) })),
    prioritize: s(p.prioritize), moderate: s(p.moderate), avoid: s(p.avoid), habits: s(p.habits),
    phases: p.period === 'mensual' ? (p.phases || []).slice(0, 4).map((x) => ({ title: String(x.title || '').slice(0, 80), text: String(x.text || '').slice(0, 260) })) : [],
    note: String(p.note || '').slice(0, 600), trainer: p.trainer || ''
  };
}
/** Semana del plan (0..3) para una fecha */
export function nutriWeek(p, today) {
  if (!p?.start) return 0;
  const d = Math.round((new Date(today + 'T12:00') - new Date(p.start + 'T12:00')) / 864e5);
  return Math.max(0, Math.min(3, Math.floor(d / 7)));
}
