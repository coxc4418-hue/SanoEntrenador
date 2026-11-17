// SanoEntrenador — Guía de ejercicios: músculos que trabaja (mapa corporal propio en SVG),
// cómo hacerlo paso a paso, consejo y error común, prescripción por objetivo y generador de rutinas.
// No depende de la sesión: lo usan el entrenador y el carnet del alumno.
import { EXERCISES, MUSCLE_GROUPS, exercise } from './gym.js';
import { esc, openModal, normalize } from './utils.js';
import { icon } from './icons.js';

// ======================================================================
// MÚSCULOS
// ======================================================================
export const MUSCLES = {
  pec: 'Pectoral', del: 'Deltoides (hombro)', tra: 'Trapecio', bic: 'Bíceps', tri: 'Tríceps', ant: 'Antebrazo', abs: 'Recto abdominal', obl: 'Oblicuos',
  cua: 'Cuádriceps', adu: 'Aductores', fem: 'Isquiotibiales (femoral)', glu: 'Glúteos', pan: 'Pantorrillas', dor: 'Dorsal ancho', lum: 'Zona lumbar', cor: 'Corazón y pulmones'
};
/** Equipos que normalmente hay en casa */
export const HOME_EQ = ['Peso corporal', 'Mancuernas', 'Banda elástica', 'Colchoneta', 'Cuerda', 'Pesa rusa', 'Rodillo', 'Cajón', 'Balón medicinal', 'Rueda', 'TRX', 'Disco'];
export const atHome = (e) => HOME_EQ.includes(e?.eq);
export const EQUIPMENT = [...new Set(EXERCISES.map((e) => e.eq))].sort((a, b) => a.localeCompare(b, 'es'));

// ======================================================================
// GUÍAS: id → [principales, secundarios, pasos (|), consejo, error común]
// ======================================================================
const G = {
  pb: ['pec', 'tri del', 'Acuéstate en el banco con los ojos bajo la barra y los pies firmes en el piso.|Toma la barra un poco más ancha que los hombros, saca el pecho y junta las escápulas.|Baja controlado hasta rozar la parte baja del pecho.|Empuja hacia arriba y un poco hacia atrás hasta estirar los brazos sin bloquear.', 'Mantén los codos a unos 45° del cuerpo para cuidar el hombro.', 'Rebotar la barra en el pecho o levantar los glúteos del banco.'],
  pbm: ['pec', 'tri del', 'Siéntate con las mancuernas sobre los muslos y recuéstate llevándolas al pecho.|Con las palmas hacia los pies, empuja hasta estirar los brazos sobre el pecho.|Baja abriendo un poco los codos hasta sentir el estiramiento del pecho.|Sube juntando ligeramente las mancuernas arriba.', 'Las mancuernas permiten más recorrido que la barra: aprovéchalo sin forzar el hombro.', 'Bajar demasiado rápido y perder el control de las mancuernas.'],
  pi: ['pec', 'del tri', 'Ajusta el banco a 30–45° y recuéstate con los pies firmes.|Toma la barra algo más ancha que los hombros.|Baja hasta la parte alta del pecho, cerca de las clavículas.|Empuja hasta estirar los brazos.', 'La inclinación trabaja más la parte alta del pecho.', 'Inclinar demasiado el banco: se convierte en un ejercicio de hombro.'],
  pim: ['pec', 'del tri', 'Banco a 30–45°, mancuernas a la altura del pecho.|Empuja hacia arriba juntándolas sobre la cara.|Baja lento hasta sentir el estiramiento.|Repite sin perder la posición de la espalda.', 'Aprieta el pecho arriba durante un segundo.', 'Arquear demasiado la espalda baja.'],
  pd: ['pec', 'tri', 'Asegura los pies en el banco declinado.|Toma la barra a lo ancho de los hombros.|Baja hasta la parte baja del pecho.|Empuja hasta estirar los brazos.', 'Pide ayuda para sacar y dejar la barra.', 'Bajar la barra hacia el cuello.'],
  ap: ['pec', 'del', 'Acostado en el banco, sube las mancuernas con las palmas enfrentadas.|Con los codos un poco doblados, abre los brazos en arco.|Baja hasta sentir el estiramiento del pecho.|Cierra como si abrazaras un árbol.', 'Usa peso moderado: es un ejercicio de aislamiento.', 'Estirar los codos por completo y cargar la articulación.'],
  cc: ['pec', 'del', 'Párate en el centro de las poleas altas con un pie adelante.|Con los codos levemente doblados, lleva las manijas hacia abajo y al frente.|Junta las manos frente a la cadera y aprieta el pecho.|Regresa lento hasta sentir el estiramiento.', 'Inclina un poco el torso hacia adelante y mantenlo fijo.', 'Convertirlo en un empuje usando los tríceps.'],
  pec: ['pec', 'del', 'Ajusta el asiento para que las manijas queden a la altura del pecho.|Apoya la espalda completa en el respaldo.|Cierra los brazos hasta juntar las manijas.|Abre lento sin que las placas choquen.', 'Pausa un segundo con los brazos cerrados.', 'Despegar la espalda del respaldo.'],
  fl: ['pec', 'tri del abs', 'Manos en el piso un poco más anchas que los hombros, cuerpo recto de cabeza a talones.|Aprieta abdomen y glúteos.|Baja el pecho hasta casi tocar el piso con los codos a 45°.|Empuja hasta estirar los brazos.', 'Si cuesta, apoya las rodillas o las manos en un banco.', 'Dejar caer la cadera o subir los glúteos.'],
  fp: ['pec', 'tri del', 'Sujétate en las paralelas con los brazos estirados.|Inclina el torso un poco adelante.|Baja doblando los codos hasta que queden a 90°.|Empuja hasta volver arriba.', 'Más inclinación = más pecho; torso recto = más tríceps.', 'Bajar demasiado y forzar el hombro.'],
  dom: ['dor', 'bic tra ant', 'Cuélgate de la barra con las palmas al frente, algo más ancho que los hombros.|Lleva las escápulas hacia abajo y atrás.|Tira hasta pasar la barbilla sobre la barra.|Baja controlado hasta estirar los brazos.', 'Usa banda elástica o máquina asistida si aún no logras hacerlas.', 'Balancear el cuerpo para subir.'],
  jal: ['dor', 'bic tra', 'Siéntate y ajusta el soporte de los muslos.|Toma la barra ancha con las palmas al frente.|Tira hacia la parte alta del pecho sacando el pecho.|Sube lento hasta estirar los brazos.', 'Piensa en llevar los codos hacia los bolsillos.', 'Tirar la barra detrás de la nuca o echarse muy atrás.'],
  jalc: ['dor', 'bic', 'Usa el agarre en V o cerrado.|Siéntate con el pecho alto.|Tira hacia el pecho juntando las escápulas.|Regresa estirando por completo.', 'El agarre cerrado permite más recorrido.', 'Redondear la espalda al final.'],
  rb: ['dor', 'tra bic lum', 'Toma la barra y flexiona la cadera hasta que el torso quede a unos 45°.|Espalda recta y rodillas un poco dobladas.|Tira la barra hacia el ombligo juntando las escápulas.|Baja controlado.', 'Mantén el abdomen firme para proteger la zona lumbar.', 'Levantar el torso para ayudarse con impulso.'],
  rm: ['dor', 'bic tra', 'Apoya una rodilla y una mano en el banco con la espalda plana.|Toma la mancuerna con la otra mano y el brazo estirado.|Tira llevando el codo hacia la cadera.|Baja lento hasta estirar.', 'Imagina que arrancas una podadora: el codo pegado al cuerpo.', 'Girar el torso para subir más peso.'],
  rs: ['dor', 'tra bic', 'Siéntate con los pies en la plataforma y las rodillas un poco dobladas.|Toma la manija con la espalda recta.|Tira hacia el abdomen sacando el pecho.|Estira los brazos sin redondear la espalda.', 'Junta las escápulas al final de cada repetición.', 'Balancear el torso adelante y atrás.'],
  rt: ['dor', 'tra bic lum', 'Párate sobre la barra con la cadera flexionada y la espalda recta.|Toma las manijas.|Tira hacia el pecho.|Baja controlado.', 'Rodillas un poco dobladas y abdomen firme.', 'Redondear la espalda baja.'],
  pm: ['fem glu lum', 'dor tra cua ant', 'Pies a lo ancho de la cadera, barra sobre la mitad del pie.|Baja la cadera y toma la barra con la espalda recta y el pecho alto.|Empuja el piso con las piernas y sube la barra pegada al cuerpo.|Termina erguido apretando glúteos; baja con el mismo control.', 'Es el ejercicio más técnico: aprende con poco peso.', 'Redondear la espalda o alejar la barra del cuerpo.'],
  pul: ['dor', 'pec tri', 'Frente a la polea alta, toma la barra con los brazos casi estirados.|Inclina un poco el torso.|Lleva la barra en arco hasta los muslos.|Sube lento hasta sentir el estiramiento.', 'Los codos casi fijos durante todo el movimiento.', 'Doblar los codos y convertirlo en un jalón.'],
  hip: ['lum', 'glu fem', 'Ajusta el banco con la cadera apoyada en el borde.|Cruza los brazos en el pecho.|Baja el torso con la espalda recta.|Sube hasta alinear el cuerpo, sin pasarte.', 'Movimiento lento y controlado.', 'Hiperextender la espalda arriba.'],
  pmil: ['del', 'tri tra abs', 'De pie, barra sobre la parte alta del pecho y manos un poco más anchas que los hombros.|Aprieta abdomen y glúteos.|Empuja la barra sobre la cabeza.|Baja controlado a la clavícula.', 'Mete la cabeza hacia adelante cuando la barra pase.', 'Arquear mucho la espalda baja.'],
  pmm: ['del', 'tri tra', 'Sentado con respaldo, mancuernas a la altura de las orejas.|Empuja hacia arriba juntándolas un poco.|Baja hasta que los codos queden a 90°.|Repite.', 'Espalda pegada al respaldo.', 'Chocar las mancuernas arriba y perder tensión.'],
  arn: ['del', 'tri', 'Empieza con las mancuernas al frente y las palmas hacia ti.|Al empujar, gira las muñecas hasta que las palmas miren al frente.|Termina con los brazos estirados.|Baja deshaciendo el giro.', 'Trabaja las tres partes del hombro.', 'Hacer el giro muy rápido.'],
  el: ['del', 'tra', 'De pie, mancuernas a los lados con los codos un poco doblados.|Eleva los brazos hacia los lados hasta la altura de los hombros.|Pausa un segundo.|Baja lento.', 'Imagina que vacías dos jarras: el meñique un poco más alto.', 'Subir los hombros hacia las orejas o balancearse.'],
  ef: ['del', 'pec', 'Mancuernas frente a los muslos.|Eleva un brazo al frente hasta la altura de los ojos.|Baja lento y alterna.|Mantén el torso quieto.', 'No necesitas mucho peso.', 'Balancear el cuerpo para subir.'],
  pajp: ['del', 'tra dor', 'Inclina el torso adelante con la espalda recta.|Mancuernas colgando bajo el pecho.|Abre los brazos hacia los lados juntando las escápulas.|Baja controlado.', 'Trabaja la parte trasera del hombro, clave para la postura.', 'Usar demasiado peso y subir con la espalda.'],
  fp2: ['del', 'tra', 'Polea a la altura de la cara con cuerda.|Tira hacia la frente separando las manos.|Lleva los codos altos y hacia atrás.|Regresa lento.', 'Excelente para la salud del hombro.', 'Bajar los codos y convertirlo en un remo.'],
  rmen: ['del tra', 'bic', 'Barra frente a los muslos, agarre a lo ancho de los hombros.|Sube la barra pegada al cuerpo.|Los codos suben por encima de las manos hasta la altura del pecho.|Baja lento.', 'No subas más allá del pecho.', 'Agarre muy cerrado que pellizca el hombro.'],
  enc: ['tra', 'ant', 'De pie con mancuernas a los lados.|Sube los hombros hacia las orejas.|Pausa un segundo arriba.|Baja lento.', 'Sube recto, sin girar los hombros.', 'Hacer círculos con los hombros.'],
  cb: ['bic', 'ant', 'De pie, barra con las palmas al frente a lo ancho de los hombros.|Codos pegados al cuerpo.|Sube la barra doblando los codos.|Baja lento hasta estirar.', 'Controla la bajada: ahí también crece el músculo.', 'Balancear el cuerpo.'],
  cm: ['bic', 'ant', 'De pie con mancuernas y palmas hacia el cuerpo.|Sube una girando la palma hacia arriba.|Aprieta el bíceps arriba.|Baja lento y alterna.', 'Codo quieto junto al cuerpo.', 'Mover el codo hacia adelante.'],
  cmar: ['bic ant', '', 'Mancuernas con las palmas enfrentadas.|Sube sin girar la muñeca.|Pausa arriba.|Baja lento.', 'Trabaja el braquial y el antebrazo.', 'Balancear el torso.'],
  cpr: ['bic', 'ant', 'Apoya la parte trasera del brazo en el banco Scott.|Toma la barra con las palmas hacia arriba.|Sube hasta que el antebrazo quede vertical.|Baja sin estirar de golpe.', 'Aísla muy bien el bíceps.', 'Soltar la barra abajo y estirar el codo bruscamente.'],
  ccon: ['bic', 'ant', 'Sentado, apoya el codo en la parte interna del muslo.|Sube la mancuerna hacia el hombro.|Aprieta arriba.|Baja lento.', 'Ideal para sentir el músculo.', 'Ayudarse con el hombro.'],
  cpol: ['bic', 'ant', 'Frente a la polea baja con barra o cuerda.|Codos pegados al cuerpo.|Sube doblando los codos.|Baja controlado.', 'La polea mantiene la tensión todo el recorrido.', 'Inclinarse hacia atrás.'],
  ext: ['tri', '', 'Frente a la polea alta, toma la barra o cuerda.|Codos pegados a los costados.|Empuja hacia abajo hasta estirar los brazos.|Sube hasta 90° sin mover los codos.', 'Con cuerda, separa las manos abajo.', 'Mover los codos o usar el peso del cuerpo.'],
  pfr: ['tri', '', 'Acostado, barra sobre la frente con los brazos verticales.|Dobla solo los codos bajando la barra hacia la frente.|Estira los brazos.|Codos apuntando al techo todo el tiempo.', 'Usa barra Z para cuidar las muñecas.', 'Abrir los codos hacia afuera.'],
  pk: ['tri', '', 'Inclinado con apoyo, brazo pegado al cuerpo y codo a 90°.|Estira el brazo hacia atrás.|Aprieta el tríceps.|Regresa sin mover el codo.', 'Peso ligero y técnica perfecta.', 'Balancear el brazo.'],
  fb: ['tri', 'pec del', 'Manos en el borde de un banco detrás de ti, piernas al frente.|Baja doblando los codos hasta 90°.|Empuja hasta estirar.|Mantén la espalda cerca del banco.', 'Rodillas dobladas = más fácil.', 'Bajar demasiado y forzar el hombro.'],
  pcer: ['tri', 'pec del', 'Acostado, barra con agarre a lo ancho de los hombros.|Baja con los codos pegados al cuerpo.|Toca la parte baja del pecho.|Empuja.', 'No cierres demasiado el agarre.', 'Abrir los codos.'],
  extn: ['tri', '', 'Sentado o de pie, mancuerna sobre la cabeza con ambas manos.|Baja detrás de la nuca doblando los codos.|Estira los brazos.|Codos apuntando al frente.', 'Gran estiramiento de la cabeza larga del tríceps.', 'Arquear la espalda baja.'],
  sq: ['cua glu', 'fem lum abs', 'Barra apoyada en la parte alta de la espalda, pies a lo ancho de los hombros.|Toma aire, aprieta el abdomen.|Baja llevando la cadera atrás y abajo, rodillas en dirección a los pies.|Sube empujando el piso hasta quedar erguido.', 'Baja al menos hasta que el muslo quede paralelo si tu movilidad lo permite.', 'Juntar las rodillas o levantar los talones.'],
  sqg: ['cua glu', 'abs', 'Sostén una mancuerna o pesa rusa pegada al pecho.|Pies algo más anchos que la cadera.|Baja entre las piernas con el pecho alto.|Sube empujando con los talones.', 'Ideal para aprender a hacer sentadilla.', 'Inclinar el torso hacia adelante.'],
  sqf: ['cua', 'glu abs', 'Barra apoyada al frente sobre los hombros con codos altos.|Baja con el torso muy erguido.|Llega a paralelo o más.|Sube manteniendo los codos altos.', 'Exige movilidad de muñeca y tobillo.', 'Dejar caer los codos.'],
  pre: ['cua glu', 'fem', 'Espalda pegada al respaldo y pies a lo ancho de la cadera.|Libera los seguros.|Baja hasta 90° en las rodillas.|Empuja sin bloquear las rodillas arriba.', 'Pies más altos = más glúteo; más bajos = más cuádriceps.', 'Despegar la cadera del asiento al bajar.'],
  ext2: ['cua', '', 'Ajusta el rodillo sobre los tobillos.|Estira las piernas por completo.|Aprieta un segundo arriba.|Baja lento.', 'Bueno para calentar la rodilla antes de la sentadilla.', 'Dejar caer el peso.'],
  zan: ['cua glu', 'fem adu', 'De pie con mancuernas.|Da un paso largo al frente.|Baja hasta que ambas rodillas queden a 90°.|Empuja con el pie de adelante para volver.', 'El torso recto y la rodilla de adelante sobre el pie.', 'Pasos muy cortos que cargan la rodilla.'],
  bul: ['cua glu', 'adu', 'Pie de atrás apoyado en un banco.|Pie de adelante a un paso largo.|Baja recto hasta que el muslo quede paralelo.|Sube empujando con el talón de adelante.', 'Inclinar un poco el torso trabaja más el glúteo.', 'Pie de adelante muy cerca del banco.'],
  hack: ['cua', 'glu', 'Espalda pegada al respaldo, pies en la plataforma.|Libera los seguros.|Baja controlado.|Sube sin bloquear las rodillas.', 'Permite cargar sin estresar la espalda.', 'Bajar demasiado rápido.'],
  step: ['cua glu', 'pan', 'Frente a un cajón estable.|Sube un pie completo.|Empuja con esa pierna hasta quedar de pie arriba.|Baja controlado.', 'Empuja con la pierna de arriba, no con la de abajo.', 'Cajón muy alto al empezar.'],
  pmr: ['fem glu', 'lum', 'De pie con la barra frente a los muslos.|Rodillas un poco dobladas.|Lleva la cadera atrás bajando la barra pegada a las piernas.|Sube apretando glúteos.', 'Para cuando sientas el estiramiento del femoral.', 'Redondear la espalda.'],
  cfem: ['fem', 'pan', 'Acostado boca abajo, rodillo sobre los tobillos.|Dobla las rodillas llevando los talones al glúteo.|Pausa.|Baja lento.', 'Cadera pegada al banco.', 'Levantar la cadera.'],
  cfs: ['fem', '', 'Ajusta el rodillo bajo los tobillos.|Dobla las rodillas hacia abajo.|Aprieta.|Regresa lento.', 'Movimiento controlado.', 'Usar impulso.'],
  ht: ['glu', 'fem cua', 'Espalda alta apoyada en un banco, barra sobre la cadera con almohadilla.|Pies firmes, rodillas a 90° arriba.|Empuja la cadera hacia el techo apretando glúteos.|Baja controlado.', 'Mentón hacia el pecho y costillas abajo.', 'Arquear la espalda baja en lugar de usar el glúteo.'],
  pg: ['glu', 'fem', 'Acostado boca arriba, rodillas dobladas.|Pies firmes en el piso.|Sube la cadera apretando glúteos.|Baja lento.', 'Pausa de 2 segundos arriba.', 'Empujar con la espalda.'],
  pat: ['glu', 'fem', 'Tobillera en la polea baja.|Sujétate con el torso un poco inclinado.|Lleva la pierna hacia atrás apretando el glúteo.|Regresa lento.', 'No arquees la espalda.', 'Balancear la pierna.'],
  abd: ['glu', '', 'Sentado en la máquina con las piernas juntas.|Abre las piernas hacia afuera.|Pausa.|Cierra lento.', 'Inclinar el torso adelante trabaja más el glúteo.', 'Usar impulso.'],
  add: ['adu', '', 'Sentado con las piernas abiertas.|Cierra las piernas.|Aprieta.|Abre lento.', 'Controla la apertura.', 'Dejar que las placas choquen.'],
  kb: ['glu fem', 'lum abs del', 'Pies algo más anchos que la cadera, pesa rusa al frente.|Llévala entre las piernas flexionando la cadera.|Proyecta la cadera adelante con fuerza.|La pesa sube por impulso hasta el pecho.', 'El impulso sale de la cadera, no de los brazos.', 'Hacerlo como una sentadilla.'],
  pp: ['pan', '', 'De pie con la punta de los pies en el borde.|Baja los talones.|Sube lo más alto posible.|Pausa y baja.', 'Rango completo y pausa arriba.', 'Rebotar.'],
  ps: ['pan', '', 'Sentado con las rodillas bajo el soporte.|Baja los talones.|Sube.|Pausa.', 'Trabaja el sóleo.', 'Recorrido corto.'],
  ppr: ['pan', '', 'En la prensa, punta de los pies en el borde.|Piernas estiradas.|Empuja con la punta.|Regresa lento.', 'No bloquees las rodillas.', 'Dejar resbalar los pies.'],
  cr: ['abs', '', 'Acostado, rodillas dobladas, manos en el pecho.|Despega los hombros del piso contrayendo el abdomen.|Exhala arriba.|Baja lento.', 'Movimiento corto: el abdomen hace el trabajo.', 'Tirar del cuello con las manos.'],
  pl: ['abs', 'obl del glu', 'Antebrazos en el piso, codos bajo los hombros.|Cuerpo recto de cabeza a talones.|Aprieta abdomen y glúteos.|Respira sin perder la posición.', 'Mejor 20 s perfectos que 60 s mal hechos.', 'Dejar caer la cadera.'],
  pll: ['obl', 'abs glu', 'De lado, antebrazo bajo el hombro.|Sube la cadera hasta alinear el cuerpo.|Mantén.|Cambia de lado.', 'Rodilla apoyada para empezar.', 'Girar el torso.'],
  ep: ['abs', 'obl ant', 'Cuélgate de la barra.|Sube las piernas juntas.|Sin balanceo.|Baja lento.', 'Rodillas dobladas = más fácil.', 'Balancearse.'],
  rr: ['abs', 'dor del', 'De rodillas con la rueda al frente.|Rueda hacia adelante con el abdomen firme.|Llega hasta donde controles.|Regresa contrayendo el abdomen.', 'Empieza con recorridos cortos.', 'Arquear la espalda baja.'],
  rus: ['obl', 'abs', 'Sentado, torso inclinado y pies elevados o apoyados.|Sostén un disco.|Gira de lado a lado.|Mira el disco.', 'Gira desde el torso.', 'Mover solo los brazos.'],
  mc: ['abs', 'cua del cor', 'En posición de flexión.|Lleva una rodilla al pecho.|Alterna rápido.|Cadera baja.', 'Mantén el ritmo constante.', 'Subir la cadera.'],
  bic: ['abs obl', '', 'Acostado, manos tras la cabeza.|Lleva el codo hacia la rodilla contraria.|Alterna como pedaleando.|Controla el ritmo.', 'Gira el torso, no el cuello.', 'Tirar de la cabeza.'],
  pal: ['abs obl', '', 'De lado a la polea a la altura del pecho.|Lleva la manija al pecho.|Empuja al frente sin dejar que te gire.|Regresa.', 'Antirrotación: el core resiste.', 'Girar el cuerpo.'],
  cin: ['cor', 'cua pan', 'Empieza caminando 2–3 minutos.|Sube la velocidad o la inclinación.|Mantén un ritmo en el que puedas hablar entrecortado.|Baja el ritmo los últimos minutos.', 'Inclinación 6–10 % caminando quema mucha energía sin impacto.', 'Sostenerse de las barandas.'],
  eli: ['cor', 'cua glu', 'Sube y toma las manijas.|Empieza suave.|Empuja y tira con brazos y piernas.|Mantén la espalda recta.', 'Bajo impacto: ideal para rodillas.', 'Apoyarse en las manijas.'],
  bic2: ['cor', 'cua pan', 'Ajusta el sillín a la altura de la cadera.|Pedalea suave para calentar.|Sube la resistencia.|Mantén un ritmo constante.', 'La rodilla casi estirada abajo.', 'Sillín muy bajo.'],
  rem: ['cor', 'dor cua', 'Pies sujetos, toma la manija.|Empuja con las piernas.|Tira con los brazos al final.|Regresa en orden inverso.', 'Piernas, torso, brazos.', 'Tirar solo con los brazos.'],
  esc: ['cor', 'glu cua', 'Sube y empieza suave.|Pasos completos.|Erguido.|Sin apoyarte.', 'Gran trabajo de glúteo.', 'Encorvarse sobre la máquina.'],
  cue: ['cor', 'pan', 'Cuerda a la medida.|Salta suave sobre la punta de los pies.|Gira con las muñecas.|Ritmo constante.', 'Saltos bajos.', 'Saltar muy alto.'],
  hiit: ['cor', 'cua', 'Calienta 5 minutos.|30 s rápido.|60 s suave.|Repite.', 'La intensidad importa más que la duración.', 'No descansar entre intervalos.'],
  bur: ['cor', 'pec cua abs', 'De pie, baja las manos al piso.|Lleva los pies atrás a plancha.|Regresa los pies.|Salta arriba.', 'Sin flexión para empezar.', 'Caer con la espalda arqueada.'],
  wb: ['cua del', 'glu cor', 'Frente a la pared con el balón al pecho.|Sentadilla.|Al subir, lanza el balón al blanco.|Atrápalo y baja.', 'Un solo movimiento continuo.', 'Lanzar solo con los brazos.'],
  fw: ['ant tra', 'abs cor', 'Mancuernas pesadas a los lados.|Camina erguido.|Pasos cortos.|Hombros abajo.', 'Mejora el agarre.', 'Inclinarse de lado.'],
  bat: ['del cor', 'abs', 'Semisentadilla con una cuerda en cada mano.|Ondas alternas.|Ritmo intenso.|Core firme.', 'Intervalos cortos.', 'Torso muy erguido.'],
  box: ['cua glu', 'cor pan', 'Frente al cajón.|Impulso con brazos.|Aterriza suave arriba.|Baja caminando.', 'Aterriza con las rodillas dobladas.', 'Bajar saltando.'],
  tgu: ['del abs', 'glu obl', 'Acostado con la pesa arriba.|Apóyate en el codo y luego la mano.|Sube la cadera y pasa la pierna.|Ponte de pie y regresa.', 'Mira la pesa siempre.', 'Hacerlo con prisa.'],
  trx: ['dor', 'bic abs', 'Toma las manijas, cuerpo recto inclinado.|Tira el pecho hacia las manos.|Junta las escápulas.|Baja lento.', 'Más inclinado = más difícil.', 'Dejar caer la cadera.'],
  thr: ['cua del', 'glu tri cor', 'Barra al frente sobre los hombros.|Sentadilla frontal.|Al subir, empuja la barra arriba.|Encadena.', 'Un movimiento fluido.', 'Separar en dos movimientos.'],
  sled: ['cua glu', 'pan cor', 'Manos en el trineo.|Cuerpo inclinado.|Empuja con pasos cortos.|Constante.', 'Muy bajo impacto.', 'Torso muy erguido.'],
  mov1: ['glu adu', '', 'Sentado con ambas piernas a 90°.|Torso erguido.|Gira hacia el otro lado.|Mantén.', 'Respira profundo.', 'Forzar.'],
  mov2: ['fem', 'pan', 'Pierna estirada.|Inclínate desde la cadera.|Espalda recta.|Mantén 30 s.', 'Sin rebotes.', 'Redondear la espalda.'],
  mov3: ['lum', 'abs', 'En cuatro apoyos.|Redondea la espalda.|Luego arquea.|Lento.', 'Sincroniza con la respiración.', 'Hacerlo rápido.'],
  mov4: ['dor', 'obl', 'De lado, rodillas dobladas.|Abre el brazo de arriba.|Gira el torso.|Regresa.', 'Mira la mano.', 'Mover la cadera.'],
  mov5: ['cua fem', 'pan glu', 'Rodillo bajo el músculo.|Rueda lento.|Pausa en zonas tensas.|1–2 min por zona.', 'Antes o después de entrenar.', 'Rodar sobre las articulaciones.'],
  mov6: ['del', 'pec', 'Banda con brazos estirados.|Pasa sobre la cabeza.|Hasta atrás.|Regresa.', 'Agarre ancho al inicio.', 'Doblar los codos.'],
  fli: ['pec', 'tri del', 'Manos en un banco o silla firme.|Cuerpo recto.|Baja el pecho al borde.|Empuja.', 'Primer paso hacia la flexión completa.', 'Silla que se mueve.'],
  fldc: ['pec', 'del tri', 'Pies elevados en un banco.|Manos en el piso.|Baja el pecho.|Empuja.', 'Trabaja más la parte alta del pecho.', 'Dejar caer la cadera.'],
  pbb: ['pec', 'tri', 'Banda detrás de la espalda.|Manos a la altura del pecho.|Empuja al frente.|Regresa lento.', 'Un pie adelante para estabilidad.', 'Soltar de golpe.'],
  pps: ['pec', 'tri', 'Acostado en el piso con mancuernas.|Codos tocan el piso.|Empuja hacia arriba.|Baja lento.', 'El piso protege el hombro.', 'Rebotar los codos.'],
  rbe: ['dor', 'bic', 'Banda sujeta al frente.|Tira hacia el abdomen.|Junta escápulas.|Regresa.', 'Pecho alto.', 'Encorvar la espalda.'],
  sup: ['lum', 'glu', 'Boca abajo, brazos al frente.|Eleva brazos y piernas.|Mantén 2 s.|Baja.', 'Mirada al piso.', 'Levantar demasiado la cabeza.'],
  rmi: ['dor', 'bic', 'Acostado bajo una mesa firme.|Toma el borde.|Sube el pecho.|Baja lento.', 'Comprueba que la mesa resista.', 'Cadera caída.'],
  pike: ['del', 'tri', 'En V invertida.|Dobla codos llevando la cabeza al piso.|Empuja.|Cadera alta.', 'Paso previo a la vertical.', 'Abrir codos.'],
  elb: ['del', '', 'Pisa la banda.|Eleva los brazos a los lados.|Hasta el hombro.|Baja lento.', 'Codos un poco doblados.', 'Balancear.'],
  cbe: ['bic', 'ant', 'Pisa la banda.|Codos pegados.|Sube.|Baja lento.', 'Tensión todo el recorrido.', 'Mover el codo.'],
  fld: ['tri', 'pec', 'Manos juntas formando un diamante.|Cuerpo recto.|Baja el pecho a las manos.|Empuja.', 'Rodillas apoyadas si cuesta.', 'Abrir los codos.'],
  extb: ['tri', '', 'Banda arriba.|Codos fijos.|Estira hacia abajo.|Regresa.', 'Aprieta abajo.', 'Mover codos.'],
  sqc: ['cua glu', 'abs', 'Pies a lo ancho de hombros.|Brazos al frente.|Baja con cadera atrás.|Sube.', 'Talones en el piso.', 'Rodillas hacia adentro.'],
  zat: ['cua glu', 'fem', 'De pie.|Paso largo atrás.|Baja a 90°.|Regresa.', 'Más suave para la rodilla que la zancada al frente.', 'Torso inclinado.'],
  sqs: ['cua adu glu', '', 'Pies muy abiertos, puntas afuera.|Mancuerna entre las piernas.|Baja.|Sube.', 'Rodillas hacia las puntas.', 'Juntar rodillas.'],
  wsit: ['cua', 'glu', 'Espalda en la pared.|Baja a 90°.|Mantén.|Respira.', 'Muslos paralelos al piso.', 'Apoyar las manos en los muslos.'],
  sqj: ['cua glu', 'pan cor', 'Sentadilla.|Salta explosivo.|Aterriza suave.|Encadena.', 'Aterriza en las puntas.', 'Rodillas rígidas al caer.'],
  pmmn: ['fem glu', 'lum', 'Mancuernas frente a los muslos.|Cadera atrás.|Baja pegado a las piernas.|Sube.', 'Espalda neutra.', 'Doblar mucho las rodillas.'],
  pmu: ['fem glu', 'abs', 'De pie en una pierna.|Inclina el torso.|Pierna libre atrás.|Regresa.', 'Mira un punto fijo.', 'Girar la cadera.'],
  pg1: ['glu', 'fem', 'Acostado, una pierna estirada.|Empuja con el talón.|Sube la cadera.|Baja.', 'Cadera nivelada.', 'Inclinar la cadera.'],
  patc: ['glu', 'fem', 'En cuatro apoyos.|Patea arriba con rodilla doblada.|Aprieta.|Baja.', 'Espalda quieta.', 'Arquear la espalda.'],
  mons: ['glu', 'adu', 'Banda en las rodillas o tobillos.|Semisentadilla.|Pasos laterales.|Tensión constante.', 'Activa el glúteo medio.', 'Juntar los pies.'],
  ppc: ['pan', '', 'Punta del pie en un escalón.|Baja el talón.|Sube.|Pausa.', 'Sujétate de la pared.', 'Rebotar.'],
  pts: ['abs', 'obl del', 'Posición de flexión.|Toca un hombro.|Alterna.|Sin girar la cadera.', 'Pies separados = más fácil.', 'Mover la cadera.'],
  dbug: ['abs', '', 'Boca arriba, brazos y rodillas arriba.|Estira brazo y pierna contrarios.|Espalda baja pegada al piso.|Alterna.', 'Movimiento lento.', 'Despegar la espalda baja.'],
  ept: ['abs', '', 'Acostado, piernas arriba.|Baja lento.|Sin tocar el piso.|Sube.', 'Manos bajo los glúteos si molesta la espalda.', 'Arquear la espalda.'],
  jj: ['cor', 'pan del', 'Pies juntos.|Salta abriendo piernas y brazos.|Cierra.|Ritmo constante.', 'Versión sin salto: paso lateral.', 'Caer con los talones.'],
  skip: ['cor', 'cua abs', 'De pie.|Sube rodillas alternando.|Brazos acompañan.|Rápido.', 'Rodillas a la altura de la cadera.', 'Encorvarse.']
};
const FALLBACK = { Pecho: 'pec', Espalda: 'dor', Hombros: 'del', Bíceps: 'bic', Tríceps: 'tri', Cuádriceps: 'cua', 'Femorales y glúteos': 'fem glu', Pantorrillas: 'pan', 'Abdomen y core': 'abs', Cardio: 'cor', Funcional: 'cor', Movilidad: '' };

export const exerciseByName = (name) => { const n = normalize(name || ''); return EXERCISES.find((e) => normalize(e.name) === n) || null; };
/** Guía completa del ejercicio */
export function guide(exOrId) {
  const e = typeof exOrId === 'string' ? exercise(exOrId) || exerciseByName(exOrId) : exOrId;
  if (!e) return null;
  const g = G[e.id];
  const split = (s) => String(s || '').split(/\s+/).filter(Boolean);
  return { ...e, primary: split(g ? g[0] : FALLBACK[e.group]), secondary: split(g?.[1]), steps: g ? g[2].split('|') : [], tip: g?.[3] || '', mistake: g?.[4] || '', home: atHome(e) };
}

// ======================================================================
// MAPA CORPORAL (SVG propio): frente y espalda
// ======================================================================
const E = (cx, cy, rx, ry, r = 0) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${r ? ` transform="rotate(${r} ${cx} ${cy})"` : ''}/>`;
const P = (d) => `<path d="${d}"/>`;
/** Dibuja la forma del lado izquierdo y su espejo del lado derecho */
const M = (svg) => `${svg}<g transform="matrix(-1 0 0 1 110 0)">${svg}</g>`;
const BASE = `${E(55, 14, 8.5, 10)}${P('M49 22 L61 22 L63 31 L47 31Z')}
  ${P('M35 33 Q55 28 75 33 L79 45 Q77 64 69 80 L68 97 Q55 103 42 97 L41 80 Q33 64 31 45Z')}
  ${M(`${E(30, 58, 7.5, 15, 12)}${E(24, 87, 5.8, 15, 10)}${E(20.5, 106, 4.5, 6, 10)}`)}
  ${P('M42 95 Q55 103 68 95 L70 110 Q55 117 40 110Z')}
  ${M(`${P('M40 106 Q35 130 40 152 L53 152 Q56 128 55 110Z')}${E(46.5, 155, 6, 4.5)}${P('M41 158 Q38 173 42 190 L50 190 Q53 173 52 158Z')}${E(46, 194, 6.5, 3.5)}`)}`;
const FRONT = {
  base: BASE,
  tra: M(P('M48 31 Q52 32 55 32 L55 34 Q48 34 42 36Z')),
  del: M(P('M35 34 Q27 36 25.5 47 Q28 53 33 51 Q35 42 41 36Z')),
  pec: M(P('M42 37 Q53 35 54.3 39 L54.3 54 Q46 59 38 53 Q34 45 42 37Z')),
  bic: M(E(30, 59, 4.6, 10, 12)),
  ant: M(E(24, 86, 4.4, 11.5, 10)),
  abs: `${P('M48.5 58 L61.5 58 L62 92 Q55 97 48 92Z')}<path d="M48.5 66 H61.5 M48.5 74 H61.5 M48.5 82 H61.5 M55 58 V95" class="bm-cut"/>`,
  obl: M(P('M41.5 60 L47 63 L47 91 L42.5 85 Q39.5 72 41.5 60Z')),
  adu: M(P('M54.5 109 Q50 121 51.5 134 L54.5 128Z')),
  cua: M(P('M41.5 108 Q36.5 128 41.5 150 L50 151 Q52.5 132 51.5 112Z')),
  pan: M(P('M42.5 160 Q40.5 172 44 186 L47 186 Q46.5 172 47.5 160Z')),
  cor: P('M55 62 C49 54 41 60 47 67 L55 74 L63 67 C69 60 61 54 55 62Z')
};
const BACK = {
  base: BASE,
  tra: P('M55 27 L69 35 L62 50 L55 64 L48 50 L41 35Z'),
  del: FRONT.del,
  tri: M(E(30, 58, 5, 11, 12)),
  ant: FRONT.ant,
  dor: M(P('M40 41 Q47 46 53 61 L52.5 83 Q44 77 39 61 Q37 50 40 41Z')),
  lum: P('M48 83 Q55 86 62 83 L62.5 97 Q55 100 47.5 97Z'),
  glu: M(P('M41 100 Q48 97 54.5 101 L54.5 113 Q47 118 41 111Z')),
  fem: M(P('M41.5 116 Q37.5 132 42 150 L50 150 Q52.5 134 51.5 117Z')),
  pan: M(E(45.5, 170, 5.6, 12.5)),
  cor: ''
};
/** Mapa de músculos. size: 'lg' | 'sm' (solo la vista donde están los principales) */
export function bodyMapHTML(primary = [], secondary = [], { size = 'lg' } = {}) {
  const view = (V, label) => {
    const parts = Object.keys(V).filter((k) => k !== 'base');
    const cls = (k) => (primary.includes(k) ? 'bm-p' : secondary.includes(k) ? 'bm-s' : 'bm-n');
    return `<svg viewBox="0 0 110 202" class="bm-fig" role="img" aria-label="${label}"><g class="bm-base">${V.base}</g>${parts.map((k) => V[k] ? `<g class="${cls(k)}">${V[k]}</g>` : '').join('')}</svg>`;
  };
  const backKeys = ['tri', 'dor', 'lum', 'glu', 'fem'];
  const frontKeys = ['pec', 'bic', 'abs', 'obl', 'adu', 'cua', 'cor'];
  if (size === 'sm') {
    const back = primary.some((k) => backKeys.includes(k)) && !primary.some((k) => frontKeys.includes(k));
    return `<div class="bm bm-sm">${back ? view(BACK, 'Espalda') : view(FRONT, 'Frente')}</div>`;
  }
  return `<div class="bm"><figure>${view(FRONT, 'Vista de frente')}<figcaption>Frente</figcaption></figure><figure>${view(BACK, 'Vista de espalda')}<figcaption>Espalda</figcaption></figure></div>`;
}

// ======================================================================
// PRESCRIPCIÓN POR OBJETIVO
// ======================================================================
export const PRESCRIPTIONS = {
  fuerza: { label: 'Fuerza', sets: 5, reps: '4-6', rest: 150, rir: 'Deja 1–2 repeticiones en reserva', load: '80–90 % de tu máximo' },
  masa: { label: 'Masa muscular', sets: 4, reps: '8-12', rest: 90, rir: 'Termina a 1–2 repeticiones del fallo', load: '65–80 % de tu máximo' },
  tono: { label: 'Tonificar', sets: 3, reps: '12-15', rest: 60, rir: 'Las últimas 2–3 repeticiones deben costar', load: '55–70 % de tu máximo' },
  grasa: { label: 'Bajar grasa', sets: 3, reps: '15-20', rest: 40, rir: 'Ritmo constante, descansos cortos', load: '50–65 % de tu máximo' },
  salud: { label: 'Salud general', sets: 2, reps: '12-15', rest: 60, rir: 'Esfuerzo moderado (6/10)', load: 'Peso cómodo con técnica perfecta' }
};
export const goalKey = (goal = '') => /fuerza|deport/i.test(goal) ? 'fuerza' : /masa|músculo/i.test(goal) ? 'masa' : /tonific/i.test(goal) ? 'tono' : /bajar|grasa|resist|cardio/i.test(goal) ? 'grasa' : 'salud';

/** Ficha del ejercicio en un modal (entrenador y alumno) */
export function exerciseSheet(exOrId, { item = null, lastLoad = '', goal = '' } = {}) {
  const g = guide(exOrId) || { name: typeof exOrId === 'string' ? exOrId : exOrId?.name || 'Ejercicio', group: '', eq: '', primary: [], secondary: [], steps: [], tip: '', mistake: '', home: false };
  const P = PRESCRIPTIONS[goalKey(goal)];
  const cardio = g.group === 'Cardio' || g.group === 'Movilidad';
  const m = openModal({
    title: esc(g.name), sub: [g.group, g.eq, g.home ? 'Se puede en casa' : 'Gimnasio'].filter(Boolean).map(esc).join(' · '), size: 'lg',
    body: `<div class="exs">
      <div class="exs-map">${bodyMapHTML(g.primary, g.secondary)}
        <div class="exs-legend">${g.primary.length ? `<span><i class="bm-dot p"></i>${g.primary.map((k) => esc(MUSCLES[k] || k)).join(', ')}</span>` : ''}${g.secondary.length ? `<span><i class="bm-dot s"></i>${g.secondary.map((k) => esc(MUSCLES[k] || k)).join(', ')}</span>` : ''}</div></div>
      <div class="exs-info">
        ${item ? `<div class="exs-rx"><div><small>Series</small><b>${esc(item.sets || '—')}</b></div><div><small>Reps</small><b>${esc(item.reps || '—')}</b></div><div><small>Descanso</small><b>${item.rest ? esc(item.rest) + ' s' : '—'}</b></div>${item.weight || lastLoad ? `<div><small>Carga</small><b>${esc(item.weight || lastLoad)}</b></div>` : ''}</div>` : ''}
        ${g.steps.length ? `<div class="exs-h">${icon('list')} Cómo hacerlo</div><ol class="exs-steps">${g.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : '<p class="muted">Pídele a tu entrenador que te muestre la técnica.</p>'}
        ${g.tip ? `<div class="exs-tip">${icon('sparkle')}<span><b>Consejo:</b> ${esc(g.tip)}</span></div>` : ''}
        ${g.mistake ? `<div class="exs-bad">${icon('alert')}<span><b>Evita:</b> ${esc(g.mistake)}</span></div>` : ''}
        ${!item && !cardio ? `<div class="exs-h">${icon('target')} Recomendado según el objetivo</div><div class="exs-table">${Object.values(PRESCRIPTIONS).map((p) => `<div><b>${esc(p.label)}</b><span>${p.sets}×${esc(p.reps)}</span><small>${p.rest} s · ${esc(p.load)}</small></div>`).join('')}</div>` : ''}
        ${item && !cardio && P ? `<p class="small muted">${icon('info')} ${esc(P.rir)}.</p>` : ''}
      </div></div>`,
    footer: '<button class="btn btn-primary" data-close>Entendido</button>'
  });
  m.el.querySelector('.modal')?.classList.add('exs-modal');
  return m;
}

// ======================================================================
// GENERADOR DE RUTINAS
// ======================================================================
// Huecos por tipo de día: cada hueco es una lista de grupos/patrones posibles
const SLOTS = {
  full: [['Cuádriceps'], ['Pecho'], ['Espalda'], ['Femorales y glúteos'], ['Hombros'], ['Abdomen y core'], ['Bíceps', 'Tríceps'], ['Pantorrillas']],
  upper: [['Pecho'], ['Espalda'], ['Hombros'], ['Espalda'], ['Pecho'], ['Bíceps'], ['Tríceps'], ['Hombros']],
  lower: [['Cuádriceps'], ['Femorales y glúteos'], ['Cuádriceps'], ['Femorales y glúteos'], ['Pantorrillas'], ['Abdomen y core'], ['Abdomen y core'], ['Femorales y glúteos']],
  push: [['Pecho'], ['Hombros'], ['Pecho'], ['Tríceps'], ['Hombros'], ['Tríceps'], ['Pecho'], ['Abdomen y core']],
  pull: [['Espalda'], ['Espalda'], ['Bíceps'], ['Espalda'], ['Hombros'], ['Bíceps'], ['Abdomen y core'], ['Espalda']],
  legs: [['Cuádriceps'], ['Femorales y glúteos'], ['Cuádriceps'], ['Femorales y glúteos'], ['Pantorrillas'], ['Abdomen y core'], ['Cuádriceps'], ['Pantorrillas']],
  glute: [['Femorales y glúteos'], ['Cuádriceps'], ['Femorales y glúteos'], ['Femorales y glúteos'], ['Cuádriceps'], ['Abdomen y core'], ['Pantorrillas'], ['Femorales y glúteos']]
};
const SPLITS = {
  2: [['full', 'Cuerpo completo A'], ['full', 'Cuerpo completo B']],
  3: [['full', 'Cuerpo completo A'], ['full', 'Cuerpo completo B'], ['full', 'Cuerpo completo C']],
  4: [['upper', 'Tren superior A'], ['lower', 'Tren inferior A'], ['upper', 'Tren superior B'], ['lower', 'Tren inferior B']],
  5: [['push', 'Empuje (pecho, hombro, tríceps)'], ['pull', 'Tirón (espalda, bíceps)'], ['legs', 'Pierna'], ['upper', 'Tren superior'], ['lower', 'Tren inferior']],
  6: [['push', 'Empuje A'], ['pull', 'Tirón A'], ['legs', 'Pierna A'], ['push', 'Empuje B'], ['pull', 'Tirón B'], ['legs', 'Pierna B']]
};
// Orden de preferencia por grupo (gimnasio y casa): primero los básicos más efectivos
const PRIO_GYM = {
  Pecho: ['pb', 'pim', 'pbm', 'pi', 'fp', 'cc', 'pec', 'ap', 'fl', 'pd'], Espalda: ['dom', 'rb', 'jal', 'rs', 'rm', 'rt', 'jalc', 'pm', 'pul', 'trx', 'hip'],
  Hombros: ['pmm', 'el', 'pmil', 'fp2', 'arn', 'pajp', 'ef', 'rmen', 'enc'], Bíceps: ['cb', 'cm', 'cmar', 'cpr', 'cpol', 'ccon'], Tríceps: ['ext', 'pfr', 'pcer', 'extn', 'pk', 'fb'],
  Cuádriceps: ['sq', 'pre', 'bul', 'sqg', 'hack', 'zan', 'ext2', 'sqf', 'step'], 'Femorales y glúteos': ['pmr', 'ht', 'cfem', 'cfs', 'pg', 'abd', 'pat', 'kb', 'add'],
  Pantorrillas: ['pp', 'ps', 'ppr'], 'Abdomen y core': ['pl', 'cr', 'pal', 'ep', 'pll', 'rr', 'bic', 'rus', 'dbug']
};
const PRIO_HOME = {
  Pecho: ['fl', 'pps', 'fli', 'pbb', 'fldc', 'pbm', 'ap'], Espalda: ['rm', 'rmi', 'rbe', 'trx', 'sup'], Hombros: ['pmm', 'el', 'pike', 'elb', 'arn', 'pajp', 'ef', 'enc'],
  Bíceps: ['cm', 'cmar', 'cbe', 'ccon'], Tríceps: ['fld', 'fb', 'extn', 'extb', 'pk'], Cuádriceps: ['sqg', 'zan', 'bul', 'sqc', 'zat', 'sqs', 'step', 'wsit', 'sqj'],
  'Femorales y glúteos': ['pmmn', 'pg', 'pg1', 'kb', 'pmu', 'patc', 'mons'], Pantorrillas: ['ppc'], 'Abdomen y core': ['pl', 'dbug', 'cr', 'pll', 'bic', 'ept', 'pts', 'mc', 'rus', 'rr']
};
// Básicos primero (los compuestos van al inicio del día)
const COMPOUND = new Set(['pb', 'pbm', 'pi', 'pim', 'fl', 'fp', 'dom', 'jal', 'rb', 'rm', 'rs', 'pm', 'pmil', 'pmm', 'sq', 'sqg', 'sqf', 'pre', 'zan', 'bul', 'hack', 'pmr', 'ht', 'kb', 'thr', 'trx', 'fli', 'fldc', 'pps', 'rmi', 'rbe', 'pike', 'sqc', 'zat', 'sqs', 'pmmn', 'pmu', 'pcer', 'fld']);
const EASY = new Set(['pm', 'sqf', 'tgu', 'dom', 'fp', 'ep', 'rr', 'box', 'sqj', 'thr', 'pike', 'fldc']);

/**
 * Crea una rutina a la medida.
 * opts: { goal, level, days (2-6), place ('gym'|'casa'), minutes (30-90), focus ('' | 'gluteo') }
 */
export function generateRoutine({ goal = 'Salud general', level = 'Principiante', days = 3, place = 'gym', minutes = 60, focus = '' } = {}) {
  const gk = goalKey(goal); const P = PRESCRIPTIONS[gk];
  const begin = level === 'Principiante'; const adv = level === 'Avanzado';
  const n = Math.max(2, Math.min(6, Number(days) || 3));
  const perDay = Math.max(4, Math.min(8, Math.round((Number(minutes) || 60) / (gk === 'fuerza' ? 12 : 9)) - (begin ? 1 : 0)));
  const pool = EXERCISES.filter((e) => !['Cardio', 'Movilidad', 'Funcional'].includes(e.group) && (place !== 'casa' || atHome(e)) && !(begin && EASY.has(e.id)));
  const used = new Map();
  const order = place === 'casa' ? PRIO_HOME : PRIO_GYM;
  const rank = (e) => { const i = (order[e.group] || []).indexOf(e.id); return i < 0 ? 99 : i; };
  const pick = (groups, dayIds) => {
    const cand = pool.filter((e) => groups.includes(e.group) && !dayIds.has(e.id));
    if (!cand.length) return null;
    cand.sort((a, b) => (used.get(a.id) || 0) - (used.get(b.id) || 0) || rank(a) - rank(b));
    const e = cand[0]; used.set(e.id, (used.get(e.id) || 0) + 1); dayIds.add(e.id);
    return e;
  };
  let split = SPLITS[n];
  if (focus === 'gluteo' && n >= 3) split = split.map(([k, name], i) => (i % 2 === 0 ? ['glute', `Glúteos y piernas ${String.fromCharCode(65 + i / 2)}`] : [k === 'lower' || k === 'legs' ? 'upper' : k, k === 'lower' || k === 'legs' ? 'Tren superior' : name]));
  const cardio = place === 'casa' ? ['jj', 'skip', 'cue', 'mc'] : ['cin', 'eli', 'bic2', 'rem'];
  const mobility = ['mov2', 'mov3', 'mov4', 'mov1', 'mov6'];
  const outDays = split.map(([kind, name], di) => {
    const items = [];
    if (gk !== 'fuerza') items.push({ ex: exercise(cardio[di % cardio.length]), sets: 1, reps: begin ? '8 min' : '5 min', rest: 0, note: 'Calentamiento suave' });
    const slots = SLOTS[kind].slice(0, perDay); const dayIds = new Set();
    slots.forEach((groups, si) => {
      const e = pick(groups, dayIds); if (!e) return;
      const comp = COMPOUND.has(e.id);
      const core = e.group === 'Abdomen y core' || e.group === 'Pantorrillas';
      let sets = Math.min(5, P.sets - (begin ? 1 : 0) + (adv && comp ? 1 : 0)); if (!comp) sets = Math.min(sets, 3); if (core) sets = Math.min(3, Math.max(2, sets));
      let reps = comp ? P.reps : gk === 'fuerza' ? '8-10' : P.reps;
      if (/plancha|isométrica/i.test(e.name)) reps = begin ? '20 s' : '40 s';
      else if (core && !/plancha/i.test(e.name)) reps = gk === 'fuerza' ? '10-12' : '15';
      if (/a una (mano|pierna)|zancada|búlgara|subidas|patada|curl alterno|plancha lateral/i.test(e.name) && !/ s$/.test(reps)) reps = `${reps} c/l`;
      const rest = comp ? P.rest : Math.max(30, Math.round((P.rest * 0.7) / 5) * 5);
      items.push({ ex: e, sets: Math.max(1, sets), reps, rest: core ? Math.min(rest, 45) : rest, note: si === 0 && comp ? (begin ? 'Aprende la técnica con poco peso' : 'Ejercicio principal del día') : '' });
    });
    if (gk === 'grasa') items.push({ ex: exercise(place === 'casa' ? 'bur' : 'hiit'), sets: 1, reps: place === 'casa' ? '4 × 40 s' : '15 min', rest: 0, note: place === 'casa' ? '20 s de descanso entre series' : '30 s rápido / 60 s suave' });
    if (gk === 'salud' || begin) items.push({ ex: exercise(mobility[di % mobility.length]), sets: 1, reps: '5 min', rest: 0, note: 'Vuelta a la calma' });
    return { name: name, items: items.filter((x) => x.ex).map((x) => ({ exId: x.ex.id, name: x.ex.name, sets: x.sets, reps: String(x.reps), rest: x.rest, weight: '', note: x.note || '' })) };
  });
  const placeTxt = place === 'casa' ? 'en casa' : 'en el gimnasio';
  return {
    name: `${P.label} · ${n} días ${placeTxt}`, goal, level, weeks: begin ? 4 : 6,
    note: `${P.sets}×${P.reps} en los básicos, descanso ${P.rest} s. ${P.rir}. Carga: ${P.load}. Cuando completes todas las series en el rango alto, sube el peso un 2,5–5 %.`,
    days: outDays
  };
}

/** Sugerencia de progresión a partir de la carga anterior (ej. "40 kg" y el día completo → "42,5 kg") */
export function nextLoad(prev, completed) {
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|lb|lbs)?/i.exec(String(prev || ''));
  if (!m || !completed) return '';
  const v = parseFloat(m[1].replace(',', '.')); const unit = m[2] || 'kg';
  const step = /lb/i.test(unit) ? 5 : v >= 20 ? 2.5 : 1;
  return `${String(Math.round((v + step) * 10) / 10).replace('.', ',')} ${unit}`;
}

export { MUSCLE_GROUPS };
