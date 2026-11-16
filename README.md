# SanoEntrenador 🏋️

Software para **entrenadores personales y de gimnasio** de la línea **Sano** (SanoGym, Sano Doctor, Sano Dental, SanoTaller…).
PWA instalable (PC, tablet, Android, iPhone) y mundial: el país se elige la primera vez y define moneda, formas de pago y código de WhatsApp (Venezuela con tasa BCV diaria).

**Producción:** https://sano-entrenador.web.app · **Credenciales:** `CREDENCIALES_SANO_ENTRENADOR.txt` (no se sube a git)

## Qué hace

| Módulo | Detalle |
|---|---|
| Inicio | Alumnos activos, sesiones de hoy, lo cobrado, lo pendiente, lo que registran tus alumnos desde su carnet, a quién escribir hoy y los mejores avances. |
| Agenda | Sesiones presenciales, online, evaluaciones y grupo reducido; series semanales; asistió / faltó / canceló; horas libres del día; confirmar mañana por WhatsApp. |
| Asistencia con QR | Escanea el carnet del alumno con la cámara: marca la sesión y descuenta del paquete (sin doble descuento). |
| Alumnos | Ficha con objetivo, meta de peso, salud y lesiones; pestañas de progreso, rutina, sesiones, plan, bitácora y salud. |
| Planes y cobros | Paquetes de sesiones, mensualidades, asesoría online, parejas; abonos, deudas, recibos imprimibles o por WhatsApp. |
| Rutinas y ejercicios | Más de 120 ejercicios (gimnasio y casa) con guía paso a paso, músculos trabajados en un mapa corporal, consejos y errores comunes. Generador de rutinas a la medida (objetivo, nivel, días, lugar, minutos). |
| Alimentación | Más de 80 alimentos (incluye comida criolla) con calorías y macros, más de 70 comidas armadas y 10 planes listos (bajar de peso, definición, masa muscular, vegetariano, criollo económico, bajo en carbohidratos). Generador a la medida con las calorías del alumno; planes semanales (7 días) o mensuales (4 semanas), editor por día y comida, lista de compras e impresión. |
| Evaluaciones | Peso, % grasa, masa muscular, perímetros; IMC, masa magra, metabolismo basal; antes y ahora. |
| Carnet del alumno | `/alumno/CÓDIGO`: QR, plan, próximas sesiones, **modo entrenamiento** (series, cargas, descanso con temporizador, esfuerzo) y **comidas** (menú del día, comidas cumplidas, lista de compras) y **mi progreso** (curva de peso, medidas, meta, logros). El alumno puede registrar su peso. |
| Página pública | `/coach/tu-nombre`: tu presentación, planes y botón de WhatsApp para captar alumnos. |
| Recordatorios | Lista diaria por WhatsApp: confirmar sesiones, planes por vencer, pocas sesiones, pagos, cumpleaños, ausencias, evaluaciones. |
| Reportes | Ingresos, asistencia, retención y planes (con PIN). |
| Demo | 30 minutos sin registro con un entrenador de ejemplo (PIN 1234) y recorrido guiado; todo se borra al terminar. |

## Estructura

- `public/` — la app (JavaScript sin compilación + Firebase 10.14.1). `js/views/` una pantalla por archivo; `js/ops.js` reglas de negocio; `js/gym.js` ejercicios y fórmulas; `js/exguide.js` guías, mapa corporal y generador de rutinas; `js/store.js` datos en tiempo real.
- `firestore.rules` — cada entrenador solo ve lo suyo (`tenants/{uid}`); `cards/{código}` se lee solo por código exacto; `pages/{slug}` es pública.
- `scripts/` — aprovisionamiento y pruebas.

## Pruebas

```sh
cd scripts && npm install
firebase emulators:start --only auth,firestore,hosting   # en otra terminal
sh test-emu.sh            # E2E (37 comprobaciones)
node smoke.mjs http://127.0.0.1:5151 390   # todas las pantallas en teléfono
node prod-smoke.mjs       # producción
node pwa-check.mjs https://sano-entrenador.web.app
```
