// SanoEntrenador — Alimentación: base de alimentos, comidas armadas, generador de planes y utilidades.
// No depende de la sesión: lo usan el panel del entrenador y el carnet público del alumno.
// Valores aproximados por porción (tablas de composición de alimentos). Es una guía de entrenamiento, no una prescripción médica.

// ======================================================================
// ALIMENTOS
// u: 'g' / 'ml' (valores por 100) o [singular, plural] (valores por unidad)
// t: etiquetas → v: apto vegetariano · e: económico / criollo · l: bajo en carbohidratos
// ======================================================================
export const FOOD_GROUPS = ['Proteínas', 'Lácteos', 'Cereales y tubérculos', 'Leguminosas', 'Frutas', 'Verduras', 'Grasas saludables', 'Bebidas y otros'];
const U = { u: ['unidad', 'unidades'], reb: ['rebanada', 'rebanadas'], cda: ['cucharada', 'cucharadas'], cdta: ['cucharadita', 'cucharaditas'], taza: ['taza', 'tazas'], med: ['medida', 'medidas'], vaso: ['vaso', 'vasos'] };
const F = (id, name, g, u, kcal, p, c, f, t = '') => ({ id, name, group: FOOD_GROUPS[g], u: typeof u === 'string' && U[u] ? U[u] : u, kcal, p, c, f, tags: t });
export const FOODS = [
  // Proteínas
  F('pollo', 'Pechuga de pollo a la plancha', 0, 'g', 165, 31, 0, 3.6, 'el'),
  F('muslo', 'Muslo de pollo sin piel', 0, 'g', 209, 26, 0, 11, 'el'),
  F('pmech', 'Pollo desmechado', 0, 'g', 170, 29, 1, 5, 'el'),
  F('cmolida', 'Carne molida magra', 0, 'g', 215, 26, 0, 12, 'l'),
  F('cmech', 'Carne mechada', 0, 'g', 190, 28, 2, 8, 'el'),
  F('bistec', 'Bistec de res magro', 0, 'g', 190, 29, 0, 8, 'l'),
  F('cerdo', 'Lomo de cerdo', 0, 'g', 165, 29, 0, 5, 'l'),
  F('pescado', 'Pescado blanco (merluza, tilapia, corvina)', 0, 'g', 110, 23, 0, 2, 'l'),
  F('salmon', 'Salmón', 0, 'g', 208, 20, 0, 13, 'l'),
  F('atun', 'Atún en agua (escurrido)', 0, 'g', 116, 26, 0, 1, 'el'),
  F('sardina', 'Sardinas en lata', 0, 'g', 208, 25, 0, 11, 'el'),
  F('pavo', 'Pechuga de pavo en lonjas', 0, 'g', 105, 18, 3, 2, 'l'),
  F('camaron', 'Camarones', 0, 'g', 99, 24, 0, 0.3, 'l'),
  F('huevo', 'Huevo entero', 0, 'u', 72, 6.3, 0.4, 4.8, 'vel'),
  F('clara', 'Clara de huevo', 0, 'u', 17, 3.6, 0.2, 0, 'vel'),
  F('tofu', 'Tofu firme', 0, 'g', 144, 15, 3, 9, 'vl'),
  F('whey', 'Proteína en polvo (1 medida)', 0, 'med', 120, 24, 3, 1.5, 'vl'),
  // Lácteos
  F('queso', 'Queso blanco semiduro', 1, 'g', 280, 20, 2, 21, 'vel'),
  F('requeson', 'Requesón (queso cottage)', 1, 'g', 98, 11, 3.4, 4.3, 'vl'),
  F('qfresco', 'Queso fresco bajo en grasa', 1, 'g', 175, 18, 3, 10, 'vl'),
  F('griego', 'Yogur griego natural', 1, 'g', 97, 9, 4, 5, 'vl'),
  F('yogur', 'Yogur natural descremado', 1, 'g', 56, 5.7, 7.7, 0.2, 'v'),
  F('leche', 'Leche descremada', 1, 'ml', 35, 3.4, 5, 0.1, 've'),
  F('lechee', 'Leche entera', 1, 'ml', 61, 3.2, 4.8, 3.3, 've'),
  F('almendra', 'Bebida de almendras sin azúcar', 1, 'ml', 15, 0.5, 0.6, 1.1, 'vl'),
  // Cereales y tubérculos
  F('arepa', 'Arepa asada (mediana)', 2, 'u', 200, 4.5, 43, 1, 've'),
  F('cachapa', 'Cachapa (mediana)', 2, 'u', 290, 7, 52, 7, 've'),
  F('pani', 'Pan integral', 2, 'reb', 70, 3.5, 12, 1, 'v'),
  F('pan', 'Pan blanco', 2, 'reb', 75, 2.5, 14, 1, 've'),
  F('tortilla', 'Tortilla de maíz', 2, 'u', 52, 1.4, 11, 0.7, 've'),
  F('wrap', 'Tortilla de trigo integral (wrap)', 2, 'u', 130, 4, 22, 3, 'v'),
  F('avena', 'Avena en hojuelas', 2, 'g', 389, 17, 66, 7, 've'),
  F('granola', 'Granola sin azúcar añadida', 2, 'g', 450, 10, 64, 17, 'v'),
  F('arroz', 'Arroz blanco cocido', 2, 'g', 130, 2.7, 28, 0.3, 've'),
  F('arrozi', 'Arroz integral cocido', 2, 'g', 112, 2.6, 23.5, 0.9, 'v'),
  F('pasta', 'Pasta cocida', 2, 'g', 158, 5.8, 31, 0.9, 've'),
  F('pastai', 'Pasta integral cocida', 2, 'g', 124, 5.3, 26.5, 0.5, 'v'),
  F('papa', 'Papa sancochada', 2, 'g', 87, 1.9, 20, 0.1, 've'),
  F('batata', 'Batata (camote) horneada', 2, 'g', 90, 2, 21, 0.1, 've'),
  F('yuca', 'Yuca sancochada', 2, 'g', 160, 1.4, 38, 0.3, 've'),
  F('platano', 'Plátano maduro horneado', 2, 'g', 122, 1.3, 32, 0.4, 've'),
  F('quinoa', 'Quinoa cocida', 2, 'g', 120, 4.4, 21, 1.9, 'v'),
  F('garroz', 'Galleta de arroz', 2, 'u', 35, 0.7, 7.3, 0.3, 'v'),
  // Leguminosas
  F('caraotas', 'Caraotas (frijoles) negras cocidas', 3, 'g', 132, 8.9, 23.7, 0.5, 've'),
  F('lentejas', 'Lentejas cocidas', 3, 'g', 116, 9, 20, 0.4, 've'),
  F('garbanzos', 'Garbanzos cocidos', 3, 'g', 164, 8.9, 27, 2.6, 've'),
  F('hummus', 'Hummus', 3, 'g', 166, 8, 14, 10, 'v'),
  // Frutas
  F('cambur', 'Cambur (banana)', 4, 'u', 105, 1.3, 27, 0.4, 've'),
  F('manzana', 'Manzana', 4, 'u', 95, 0.5, 25, 0.3, 've'),
  F('naranja', 'Naranja', 4, 'u', 62, 1.2, 15.4, 0.2, 've'),
  F('mandarina', 'Mandarina', 4, 'u', 47, 0.7, 12, 0.3, 've'),
  F('pera', 'Pera', 4, 'u', 100, 0.6, 27, 0.2, 'v'),
  F('guayaba', 'Guayaba', 4, 'u', 37, 1.4, 8, 0.5, 've'),
  F('lechosa', 'Lechosa (papaya)', 4, 'g', 43, 0.5, 11, 0.3, 've'),
  F('patilla', 'Patilla (sandía)', 4, 'g', 30, 0.6, 7.6, 0.2, 've'),
  F('pina', 'Piña', 4, 'g', 50, 0.5, 13, 0.1, 've'),
  F('mango', 'Mango', 4, 'g', 60, 0.8, 15, 0.4, 've'),
  F('melon', 'Melón', 4, 'g', 34, 0.8, 8, 0.2, 've'),
  F('fresas', 'Fresas', 4, 'g', 32, 0.7, 7.7, 0.3, 'vl'),
  // Verduras
  F('ensalada', 'Ensalada (lechuga, tomate, pepino)', 5, 'g', 18, 1, 3.5, 0.2, 'vel'),
  F('brocoli', 'Brócoli al vapor', 5, 'g', 35, 2.4, 7, 0.4, 'vl'),
  F('vegetales', 'Vegetales salteados', 5, 'g', 45, 2, 8, 0.5, 'vel'),
  F('espinaca', 'Espinaca', 5, 'g', 23, 2.9, 3.6, 0.4, 'vl'),
  F('tomate', 'Tomate', 5, 'g', 18, 0.9, 3.9, 0.2, 'vel'),
  F('zanahoria', 'Zanahoria', 5, 'g', 41, 0.9, 10, 0.2, 've'),
  F('calabacin', 'Calabacín', 5, 'g', 17, 1.2, 3.1, 0.3, 'vl'),
  F('vainitas', 'Vainitas', 5, 'g', 31, 1.8, 7, 0.1, 'vel'),
  F('auyama', 'Auyama (calabaza)', 5, 'g', 26, 1, 6.5, 0.1, 've'),
  F('champi', 'Champiñones', 5, 'g', 22, 3.1, 3.3, 0.3, 'vl'),
  F('pepino', 'Pepino', 5, 'g', 15, 0.7, 3.6, 0.1, 'vel'),
  // Grasas saludables
  F('aguacate', 'Aguacate', 6, 'g', 160, 2, 8.5, 14.7, 'vel'),
  F('aceite', 'Aceite de oliva', 6, 'cda', 119, 0, 0, 13.5, 'vl'),
  F('mani', 'Maní tostado sin sal', 6, 'g', 585, 24, 21, 50, 'vel'),
  F('almendras', 'Almendras', 6, 'g', 579, 21, 22, 50, 'vl'),
  F('nueces', 'Nueces', 6, 'g', 654, 15, 14, 65, 'vl'),
  F('pmani', 'Mantequilla de maní natural', 6, 'cda', 95, 3.5, 3.5, 8, 'vl'),
  F('chia', 'Semillas de chía', 6, 'cda', 58, 2, 5, 3.7, 'vl'),
  // Bebidas y otros
  F('cafe', 'Café negro o con poca leche', 7, 'taza', 5, 0.3, 0.5, 0, 'vel'),
  F('infusion', 'Té o infusión sin azúcar', 7, 'taza', 2, 0, 0.5, 0, 'vel'),
  F('jugo', 'Jugo natural sin azúcar', 7, 'vaso', 110, 1, 26, 0.3, 've'),
  F('miel', 'Miel o papelón', 7, 'cdta', 21, 0, 5.7, 0, 've'),
  F('chocolate', 'Chocolate oscuro 70 %', 7, 'g', 600, 7.8, 46, 43, 'v'),
  F('gelatina', 'Gelatina sin azúcar', 7, 'taza', 10, 1.5, 0, 0, 'vl'),
  F('cacao', 'Cacao en polvo sin azúcar', 7, 'cda', 12, 1, 3, 0.7, 'vl')
];
const FOOD_MAP = new Map(FOODS.map((f) => [f.id, f]));
export const food = (id) => FOOD_MAP.get(id) || null;

// ======================================================================
// COMIDAS ARMADAS (porción base; el generador las escala a las calorías del plan)
// s: comidas donde va (d desayuno · m merienda · a almuerzo · c cena) · t: etiquetas como en los alimentos
// items: [alimento, cantidad, fija] (fija = no se escala: café, condimentos)
// ======================================================================
const O = (n, s, t, items) => ({ n, s, t, items });
export const MEAL_OPTIONS = [
  // Desayunos
  O('Arepa con huevos revueltos y queso blanco', 'd', 've', [['arepa', 1], ['huevo', 2], ['queso', 30], ['cafe', 1, 1]]),
  O('Arepa con pollo desmechado y aguacate', 'dc', 'e', [['arepa', 1], ['pmech', 80], ['aguacate', 40]]),
  O('Arepa dominó light (caraotas y queso)', 'dc', 've', [['arepa', 1], ['caraotas', 100], ['queso', 30]]),
  O('Avena cocida con cambur y canela', 'd', 've', [['avena', 50], ['leche', 200], ['cambur', 1]]),
  O('Panquecas de avena y claras con fresas', 'd', 'v', [['avena', 40], ['clara', 3], ['huevo', 1], ['fresas', 100], ['miel', 1, 1]]),
  O('Tostadas integrales con huevo, aguacate y tomate', 'd', 'v', [['pani', 2], ['huevo', 2], ['aguacate', 40], ['tomate', 50]]),
  O('Yogur griego con granola y fresas', 'dm', 'v', [['griego', 170], ['granola', 30], ['fresas', 100]]),
  O('Omelette de espinaca, tomate y queso con pan integral', 'dc', 'v', [['huevo', 2], ['clara', 2], ['espinaca', 50], ['tomate', 50], ['queso', 20], ['pani', 1]]),
  O('Cachapa con queso blanco', 'd', 've', [['cachapa', 1], ['queso', 30], ['cafe', 1, 1]]),
  O('Batido de proteína con cambur y avena', 'dm', 'v', [['whey', 1], ['leche', 250], ['cambur', 1], ['avena', 30]]),
  O('Huevos revueltos con pavo, pan integral y lechosa', 'd', '', [['huevo', 2], ['pavo', 50], ['pani', 1], ['lechosa', 150]]),
  O('Tortillas de maíz con huevo y caraotas', 'd', 've', [['tortilla', 2], ['huevo', 2], ['caraotas', 60], ['tomate', 50]]),
  O('Huevos con aguacate y espinaca salteada', 'd', 'vl', [['huevo', 3], ['aguacate', 50], ['espinaca', 60], ['cafe', 1, 1]]),
  O('Yogur griego con nueces y chía', 'dm', 'vl', [['griego', 200], ['nueces', 15], ['chia', 1]]),
  O('Tofu revuelto con vegetales y pan integral', 'd', 'v', [['tofu', 150], ['vegetales', 100], ['pani', 1]]),
  O('Arepa con queso blanco y tomate', 'd', 've', [['arepa', 1], ['queso', 40], ['tomate', 60], ['cafe', 1, 1]]),
  O('Omelette de claras con champiñones y queso', 'dc', 'vl', [['huevo', 1], ['clara', 4], ['champi', 80], ['qfresco', 30], ['tomate', 50]]),
  // Meriendas
  O('Manzana con mantequilla de maní', 'm', 'v', [['manzana', 1], ['pmani', 1]]),
  O('Puñado de almendras y una mandarina', 'm', 'vl', [['almendras', 20], ['mandarina', 1]]),
  O('Galletas de arroz con requesón', 'm', 'v', [['garroz', 3], ['requeson', 60]]),
  O('Cambur con maní', 'm', 've', [['cambur', 1], ['mani', 15]]),
  O('Huevos duros con tomate', 'm', 'vel', [['huevo', 2], ['tomate', 80]]),
  O('Lechosa con yogur natural', 'm', 've', [['lechosa', 200], ['yogur', 150]]),
  O('Hummus con zanahoria y pepino', 'm', 'v', [['hummus', 50], ['zanahoria', 80], ['pepino', 80]]),
  O('Requesón con piña', 'm', 'v', [['requeson', 120], ['pina', 120]]),
  O('Batido de proteína con agua', 'm', 'vl', [['whey', 1]]),
  O('Pavo con queso fresco y pepino', 'm', 'l', [['pavo', 50], ['qfresco', 30], ['pepino', 100]]),
  O('Guayabas con queso blanco', 'm', 've', [['guayaba', 2], ['queso', 25]]),
  O('Gelatina sin azúcar y nueces', 'm', 'vl', [['gelatina', 1], ['nueces', 15]]),
  O('Patilla con yogur griego', 'm', 'v', [['patilla', 250], ['griego', 100]]),
  O('Pera con chocolate oscuro', 'm', 'v', [['pera', 1], ['chocolate', 10]]),
  O('Mango con queso blanco', 'm', 've', [['mango', 150], ['queso', 25]]),
  // Almuerzos
  O('Pabellón light: carne mechada, arroz, caraotas y plátano', 'a', 'e', [['cmech', 120], ['arroz', 120], ['caraotas', 100], ['platano', 60]]),
  O('Pollo a la plancha con arroz, caraotas y ensalada', 'a', 'e', [['pollo', 140], ['arroz', 130], ['caraotas', 80], ['ensalada', 120], ['aceite', 0.5, 1]]),
  O('Pollo con arroz integral y brócoli', 'a', '', [['pollo', 150], ['arrozi', 150], ['brocoli', 150], ['aceite', 0.5, 1]]),
  O('Pescado con papas y ensalada', 'ac', '', [['pescado', 180], ['papa', 200], ['ensalada', 150], ['aceite', 1, 1]]),
  O('Pasta integral con carne molida y vegetales', 'a', '', [['pastai', 180], ['cmolida', 110], ['vegetales', 120]]),
  O('Lentejas con arroz y ensalada', 'a', 've', [['lentejas', 200], ['arroz', 120], ['ensalada', 120], ['aceite', 0.5, 1]]),
  O('Pollo al horno con yuca y ensalada', 'a', 'e', [['muslo', 150], ['yuca', 150], ['ensalada', 150]]),
  O('Salmón con quinoa y vegetales', 'a', '', [['salmon', 140], ['quinoa', 150], ['vegetales', 150]]),
  O('Bistec con batata y ensalada', 'a', '', [['bistec', 150], ['batata', 180], ['ensalada', 150], ['aceite', 0.5, 1]]),
  O('Lomo de cerdo con arroz y vainitas', 'a', '', [['cerdo', 140], ['arroz', 140], ['vainitas', 150]]),
  O('Pasta con atún y salsa de tomate', 'a', 'e', [['pasta', 180], ['atun', 100], ['tomate', 120], ['aceite', 0.5, 1]]),
  O('Garbanzos guisados con arroz integral', 'a', 'v', [['garbanzos', 180], ['arrozi', 120], ['vegetales', 100]]),
  O('Tofu salteado con arroz integral y vegetales', 'a', 'v', [['tofu', 180], ['arrozi', 150], ['vegetales', 150], ['aceite', 0.5, 1]]),
  O('Pollo con vegetales salteados y aguacate', 'ac', 'l', [['pollo', 170], ['vegetales', 200], ['aguacate', 60]]),
  O('Pescado con ensalada grande y aguacate', 'ac', 'l', [['pescado', 200], ['ensalada', 250], ['aguacate', 60], ['aceite', 0.5, 1]]),
  O('Carne molida con calabacín y champiñones', 'ac', 'l', [['cmolida', 150], ['calabacin', 150], ['champi', 100], ['tomate', 80]]),
  O('Caraotas con huevo, arroz y tajadas horneadas', 'a', 've', [['caraotas', 150], ['huevo', 2], ['arroz', 120], ['platano', 60]]),
  O('Sopa de pollo con verduras (sancocho)', 'a', 'e', [['pollo', 130], ['papa', 100], ['yuca', 80], ['auyama', 100], ['zanahoria', 60]]),
  O('Carne mechada con arroz y ensalada', 'a', 'e', [['cmech', 130], ['arroz', 140], ['ensalada', 150]]),
  O('Pollo al curry con arroz y vegetales', 'a', '', [['pollo', 150], ['arroz', 130], ['vegetales', 150], ['aceite', 0.5, 1]]),
  O('Camarones salteados con arroz y vegetales', 'a', '', [['camaron', 160], ['arroz', 130], ['vegetales', 150], ['aceite', 0.5, 1]]),
  O('Lentejas con huevo, papa y ensalada', 'a', 've', [['lentejas', 180], ['huevo', 1], ['papa', 120], ['ensalada', 120]]),
  O('Bistec con ensalada y vegetales al vapor', 'ac', 'l', [['bistec', 160], ['ensalada', 200], ['brocoli', 150], ['aceite', 1, 1]]),
  // Cenas
  O('Arepa con atún y ensalada', 'c', 'e', [['arepa', 1], ['atun', 90], ['ensalada', 100]]),
  O('Pescado al horno con vegetales al vapor', 'c', 'l', [['pescado', 170], ['brocoli', 120], ['zanahoria', 80], ['aceite', 0.5, 1]]),
  O('Pollo con ensalada y batata', 'c', '', [['pollo', 130], ['ensalada', 150], ['batata', 120]]),
  O('Ensalada de atún con aguacate y huevo', 'c', 'l', [['atun', 100], ['ensalada', 200], ['aguacate', 50], ['huevo', 1]]),
  O('Crema de auyama con pollo desmechado', 'c', 'e', [['auyama', 250], ['pmech', 100], ['papa', 80]]),
  O('Wrap integral de pollo y vegetales', 'c', '', [['wrap', 1], ['pollo', 100], ['vegetales', 80], ['requeson', 30]]),
  O('Sardinas con arepa y tomate', 'c', 'e', [['sardina', 90], ['arepa', 1], ['tomate', 80]]),
  O('Sándwich integral de pavo y queso', 'c', '', [['pani', 2], ['pavo', 60], ['qfresco', 30], ['tomate', 50], ['ensalada', 60]]),
  O('Huevos con arepa pequeña y aguacate', 'c', 've', [['huevo', 2], ['arepa', 0.5], ['aguacate', 40], ['tomate', 60]]),
  O('Tofu a la plancha con ensalada y quinoa', 'c', 'v', [['tofu', 150], ['ensalada', 150], ['quinoa', 100]]),
  O('Pollo con brócoli y aguacate', 'c', 'l', [['pollo', 150], ['brocoli', 200], ['aguacate', 40]]),
  O('Salmón con espinaca salteada', 'c', 'l', [['salmon', 130], ['espinaca', 150], ['aceite', 0.5, 1]]),
  O('Arepa con queso blanco y aguacate', 'c', 've', [['arepa', 1], ['queso', 40], ['aguacate', 40]]),
  O('Requesón con pan integral y tomate', 'c', 'v', [['requeson', 150], ['pani', 2], ['tomate', 80]]),
  O('Tortillas de maíz con pollo y ensalada', 'c', 'e', [['tortilla', 3], ['pmech', 100], ['ensalada', 120]]),
  O('Caraotas con queso y ensalada', 'c', 've', [['caraotas', 150], ['queso', 30], ['ensalada', 150]]),
  O('Camarones con calabacín salteado', 'c', 'l', [['camaron', 150], ['calabacin', 200], ['aceite', 0.5, 1]])
];

// ======================================================================
// CÁLCULOS
// ======================================================================
const isPer100 = (f) => f.u === 'g' || f.u === 'ml';
const r1 = (n) => Math.round(n * 10) / 10;
/** Nutrientes de un ítem { f: id, q } o libre { n, q, k, p, c, g } */
export function itemNut(it) {
  const f = it.f ? food(it.f) : null;
  if (!f) return { kcal: Number(it.k) || 0, p: Number(it.p) || 0, c: Number(it.c) || 0, f: Number(it.g) || 0 };
  const m = isPer100(f) ? (Number(it.q) || 0) / 100 : Number(it.q) || 0;
  return { kcal: f.kcal * m, p: f.p * m, c: f.c * m, f: f.f * m };
}
export function sumNut(items) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const it of items || []) { const n = itemNut(it); t.kcal += n.kcal; t.p += n.p; t.c += n.c; t.f += n.f; }
  return { kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), f: Math.round(t.f) };
}
export const mealNut = (meal) => sumNut(meal.items);
export const dayNut = (day) => sumNut((day.meals || []).flatMap((m) => m.items || []));
const FR = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
export function fmtQty(q) {
  const n = Number(q) || 0; const w = Math.floor(n); const fr = Math.round((n - w) * 4) / 4;
  if (fr && FR[fr]) return `${w || ''}${FR[fr]}`;
  return String(Math.round(n * 10) / 10).replace('.', ',');
}
/** "150 g", "2 unidades", "½ taza" */
export function qtyText(it) {
  const f = it.f ? food(it.f) : null;
  if (!f) return String(it.q || '');
  if (isPer100(f)) return `${Math.round(Number(it.q) || 0)} ${f.u}`;
  const n = Number(it.q) || 0;
  return `${fmtQty(n)} ${n > 1 ? f.u[1] : f.u[0]}`;
}
export const itemName = (it) => (it.f ? food(it.f)?.name || it.n || '' : it.n || '');
const roundQty = (f, q) => {
  if (isPer100(f)) { const step = q < 40 ? 5 : 10; return Math.max(step, Math.round(q / step) * step); }
  return Math.max(0.5, Math.round(q * 2) / 2);
};
/** Escala las porciones de una comida para acercarla a las calorías pedidas */
export function scaleMeal(items, kcal) {
  const base = sumNut(items.map(([f, q]) => ({ f, q }))).kcal || 1;
  const fixedK = sumNut(items.filter((x) => x[2]).map(([f, q]) => ({ f, q }))).kcal;
  const k = Math.min(2.6, Math.max(0.55, (kcal - fixedK) / Math.max(1, base - fixedK)));
  return items.map(([f, q, fixed]) => ({ f, q: fixed ? q : roundQty(food(f), q * k) }));
}

// ======================================================================
// GENERADOR DE PLANES
// ======================================================================
export const DIET_TYPES = { todo: 'Come de todo', criollo: 'Criollo económico', veg: 'Vegetariano', lowc: 'Bajo en carbohidratos' };
export const DIET_GOALS = ['Bajar de peso', 'Mantener el peso', 'Ganar masa muscular', 'Definición', 'Salud general'];
export const MEAL_SLOTS = {
  3: [['d', 'Desayuno', '7:00', 0.3], ['a', 'Almuerzo', '12:30', 0.4], ['c', 'Cena', '19:00', 0.3]],
  4: [['d', 'Desayuno', '7:00', 0.25], ['a', 'Almuerzo', '12:30', 0.35], ['m', 'Merienda', '16:00', 0.15], ['c', 'Cena', '19:30', 0.25]],
  5: [['d', 'Desayuno', '7:00', 0.25], ['m', 'Merienda', '10:00', 0.1], ['a', 'Almuerzo', '13:00', 0.33], ['m', 'Merienda', '16:30', 0.12], ['c', 'Cena', '19:30', 0.2]]
};
export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/** Calorías sugeridas según el objetivo, desde el gasto diario (o un valor típico si no hay evaluación) */
export function kcalFor(goal, tdee = null) {
  const base = Number(tdee) || 2100;
  const k = /bajar/i.test(goal) ? 0.8 : /defin/i.test(goal) ? 0.88 : /masa/i.test(goal) ? 1.12 : 1;
  return Math.round((base * k) / 50) * 50;
}
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function poolFor(slot, type) {
  const all = MEAL_OPTIONS.filter((o) => o.s.includes(slot));
  const by = (t) => all.filter((o) => o.t.includes(t));
  if (type === 'veg') return by('v');
  if (type === 'lowc') { const l = by('l'); return l.length >= 4 ? l : all; }
  if (type === 'criollo') { const e = by('e'); return e.length >= 4 ? e : all; }
  return all;
}
/**
 * Arma un plan: semanal = 7 días distintos · mensual = 4 semanas (28 días) con menús que rotan.
 * Devuelve { name, goal, type, kcal, meals, period, days: [{ meals: [{ slot, name, time, title, items: [{ f, q }] }] }], note, water }
 */
export function generateDiet({ goal = 'Mantener el peso', kcal = 2000, type = 'todo', meals = 5, period = 'semanal', seed = 7 } = {}) {
  const slots = MEAL_SLOTS[meals] || MEAL_SLOTS[5];
  const n = period === 'mensual' ? 28 : 7;
  const rand = rng(seed * 97 + Math.round(kcal));
  const pools = {}; const used = {};
  const pick = (slot, avoid) => {
    const key = slot;
    if (!pools[key]) { pools[key] = poolFor(slot, type).slice(); used[key] = []; }
    let list = pools[key].filter((o) => !used[key].includes(o) && !avoid.includes(o));
    if (!list.length) { used[key] = []; list = pools[key].filter((o) => !avoid.includes(o)); }
    if (!list.length) list = pools[key];
    const o = list[Math.floor(rand() * list.length)];
    used[key].push(o);
    return o;
  };
  const days = [];
  for (let i = 0; i < n; i++) {
    const today = [];
    days.push({
      meals: slots.map(([slot, name, time, share]) => {
        const o = pick(slot, today); today.push(o);
        return { slot, name, time, title: o.n, items: scaleMeal(o.items, kcal * share) };
      })
    });
  }
  const tname = type === 'todo' ? '' : ` · ${DIET_TYPES[type]}`;
  const water = kcal >= 2600 ? 3 : kcal >= 2000 ? 2.5 : 2;
  return {
    name: `${goal}${tname} · ${num0(kcal)} kcal`, goal, type, kcal: Math.round(kcal), meals: slots.length, period, days, water,
    note: NOTES[goalKind(goal)]
  };
}
const num0 = (n) => Math.round(n).toLocaleString('es-VE');
const goalKind = (g) => (/bajar|defin/i.test(g || '') ? 'perder' : /masa/i.test(g || '') ? 'ganar' : 'mantener');
const NOTES = {
  perder: 'Come despacio y sin saltarte comidas. Prefiere a la plancha, al horno o sancochado. Evita refrescos, jugos azucarados y frituras. Puedes cambiar una comida por otra del mismo tipo del plan.',
  ganar: 'No te saltes comidas: el músculo crece con calorías y proteína suficientes. Come algo con proteína 1 a 2 horas después de entrenar. Si no subes de peso en 2 semanas, avísale a tu entrenador.',
  mantener: 'Mantén horarios regulares y porciones como las del plan. Prefiere comida casera, agua y frutas enteras. Puedes cambiar una comida por otra del mismo tipo del plan.'
};
export const DIET_TIPS = [
  'Toma agua durante todo el día: lleva una botella contigo.',
  'Llena la mitad del plato con vegetales en almuerzo y cena.',
  'Pesa los alimentos la primera semana: luego aprenderás a calcular a ojo.',
  'Si un día te sales del plan, retómalo en la siguiente comida. Lo que cuenta es la constancia.',
  'Cocina de una vez la proteína de 2 o 3 días y guárdala en la nevera.',
  'Duerme 7 a 8 horas: el descanso también ayuda a cumplir tu objetivo.'
];

// ======================================================================
// PLANTILLAS LISTAS (se generan siempre igual)
// ======================================================================
const T = (id, goal, kcal, type, meals, seed, desc) => ({ id: 'd_' + id, builtin: true, desc, ...generateDiet({ goal, kcal, type, meals, seed }), params: { goal, kcal, type, meals, seed } });
let _tpl = null;
export function dietTemplates() {
  if (_tpl) return _tpl;
  _tpl = [
    T('p15', 'Bajar de peso', 1500, 'todo', 5, 11, 'Déficit moderado, alto en proteína y saciante.'),
    T('p18', 'Bajar de peso', 1800, 'todo', 5, 12, 'Para bajar de peso entrenando 3 a 5 días.'),
    T('crio', 'Bajar de peso', 1700, 'criollo', 4, 13, 'Arepa, caraotas, plátano y sopa: comida de casa, económica.'),
    T('lowc', 'Definición', 1600, 'lowc', 4, 14, 'Menos harinas, más proteína, vegetales y grasas buenas.'),
    T('def', 'Definición', 2000, 'todo', 5, 15, 'Para marcar sin perder fuerza.'),
    T('mant', 'Mantener el peso', 2200, 'todo', 4, 16, 'Equilibrado para mantener el peso con energía.'),
    T('veg', 'Salud general', 1800, 'veg', 5, 17, 'Vegetariano con huevo y lácteos.'),
    T('m26', 'Ganar masa muscular', 2600, 'todo', 5, 18, 'Superávit suave para ganar músculo.'),
    T('m30', 'Ganar masa muscular', 3000, 'todo', 5, 19, 'Para quienes cuesta subir de peso.'),
    T('vegm', 'Ganar masa muscular', 2500, 'veg', 5, 20, 'Masa muscular sin carne.')
  ];
  return _tpl;
}

// ======================================================================
// UTILIDADES DEL PLAN ASIGNADO
// ======================================================================
/** Índice del día del plan para una fecha (los menús rotan si el plan es más corto) */
export function dayIndexFor(plan, dateKey) {
  if (!plan?.start || !plan.days?.length) return 0;
  const [y, m, d] = plan.start.split('-').map(Number); const [y2, m2, d2] = dateKey.split('-').map(Number);
  const diff = Math.round((new Date(y2, m2 - 1, d2) - new Date(y, m - 1, d)) / 864e5);
  const n = plan.days.length;
  return ((diff % n) + n) % n;
}
export function planEndKey(start, period) {
  const [y, m, d] = start.split('-').map(Number);
  const e = period === 'mensual' ? new Date(y, m - 1, d + 27) : new Date(y, m - 1, d + 6);
  return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
/** Nombre del día: con fecha de inicio → "Lunes 17/11"; sin fecha → "Día 3" o "Semana 2 · Día 3" */
export function dayLabel(plan, i, { short = false } = {}) {
  if (plan.start) {
    const [y, m, d] = plan.start.split('-').map(Number); const x = new Date(y, m - 1, d + i);
    const wd = WEEKDAYS[x.getDay()];
    return short ? `${wd.slice(0, 3)} ${x.getDate()}` : `${wd} ${x.getDate()}/${x.getMonth() + 1}`;
  }
  if ((plan.days || []).length > 7) return short ? `S${Math.floor(i / 7) + 1}·D${(i % 7) + 1}` : `Semana ${Math.floor(i / 7) + 1} · Día ${(i % 7) + 1}`;
  return `Día ${i + 1}`;
}
/** Lista de compras de una semana del plan (week: 0..3) */
export function shoppingList(plan, week = 0) {
  const days = (plan.days || []).slice(week * 7, week * 7 + 7);
  const tot = new Map();
  for (const d of days) for (const m of d.meals || []) for (const it of m.items || []) {
    const f = it.f ? food(it.f) : null; if (!f || f.group === 'Bebidas y otros' && ['cafe', 'infusion'].includes(f.id)) continue;
    tot.set(f.id, (tot.get(f.id) || 0) + (Number(it.q) || 0));
  }
  const out = {};
  for (const [id, q] of tot) {
    const f = food(id); (out[f.group] ||= []).push({ name: f.name, qty: qtyText({ f: id, q: isPer100(f) ? Math.ceil(q / 50) * 50 : Math.ceil(q) }) });
  }
  return FOOD_GROUPS.filter((g) => out[g]).map((g) => ({ group: g, items: out[g].sort((a, b) => a.name.localeCompare(b.name)) }));
}
/** Resumen compacto para el carnet */
export function dietSummary(p) {
  return {
    name: p.name || 'Plan de alimentación', goal: p.goal || '', type: p.type || 'todo', kcal: Number(p.kcal) || null, period: p.period || 'semanal',
    start: p.start || null, end: p.end || null, water: Number(p.water) || null, note: p.note || '', trainer: p.trainer || '',
    days: (p.days || []).map((d) => ({ meals: (d.meals || []).map((m) => ({ slot: m.slot || '', name: m.name || '', time: m.time || '', title: m.title || '', items: (m.items || []).map((it) => (it.f ? { f: it.f, q: Number(it.q) || 0 } : { n: it.n || '', q: it.q || '', k: Number(it.k) || 0 })) })) }))
  };
}
export function dietStatus(p, today) {
  if (!p) return null;
  if (p.start && p.start > today) return { k: 'pen', label: `Empieza el ${p.start.split('-').reverse().slice(0, 2).join('/')}` };
  if (p.end && p.end < today) return { k: 'ven', label: 'Plan terminado' };
  if (p.end) { const left = Math.round((new Date(p.end + 'T12:00') - new Date(today + 'T12:00')) / 864e5); return { k: 'ok', label: left === 0 ? 'Termina hoy' : `Quedan ${left + 1} días` }; }
  return { k: 'ok', label: 'Vigente' };
}
export const macroPct = (n) => { const k = Math.max(1, n.p * 4 + n.c * 4 + n.f * 9); return { p: Math.round((n.p * 4 * 100) / k), c: Math.round((n.c * 4 * 100) / k), f: Math.round((n.f * 9 * 100) / k) }; };
export { r1 };
