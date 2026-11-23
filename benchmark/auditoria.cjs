// Auditoria de invariantes de TextiTrace sobre la base de datos SQLite.
// Revisa TODOS los lotes y eventos que haya (por ejemplo, los creados por el benchmark
// y por las pruebas) y verifica que el balance de masa y la genealogia se conservan.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const ruta = process.env.DB || path.join(__dirname, '..', 'server', 'textitrace.sqlite');
if (!fs.existsSync(ruta)) { console.error('No se encontro la base de datos: ' + ruta); process.exit(1); }
const db = new DatabaseSync(ruta);

const lotes = db.prepare('SELECT * FROM lotes').all();
const eventos = db.prepare('SELECT *, rowid AS orden FROM eventos ORDER BY created_at, rowid').all()
  .map((e) => ({ ...e, payload: JSON.parse(e.payload || '{}') }));
const traspasos = db.prepare('SELECT * FROM traspasos').all();
const porId = new Map(lotes.map((l) => [l.id, l]));
const eventosDe = new Map();
for (const e of eventos) { if (!eventosDe.has(e.lote_id)) eventosDe.set(e.lote_id, []); eventosDe.get(e.lote_id).push(e); }

const cerca = (a, b) => Math.abs(a - b) < 0.011;
const fallas = {};
const registrar = (regla, detalle) => { (fallas[regla] ||= []).push(detalle); };
const conteo = {};
const cuenta = (regla) => { conteo[regla] = (conteo[regla] || 0) + 1; };

// Peso que tenia un lote justo antes de un evento: creacion o ultimo traspaso aceptado.
function pesoAntesDe(loteId, evento) {
  let peso = null;
  for (const e of eventosDe.get(loteId) || []) {
    if (e.orden >= evento.orden) break;
    if (e.tipo === 'creacion') peso = e.payload.peso;
    if (e.tipo === 'traspaso_aceptado') peso = e.payload.pesoRecibido;
    if (e.tipo === 'creacion_por_division') peso = e.payload.peso;
  }
  return peso;
}

// R1: dividir = suma de hijos + merma igual al peso del padre
for (const e of eventos.filter((x) => x.tipo === 'division')) {
  cuenta('R1');
  const hijos = e.payload.hijos || [];
  const suma = hijos.reduce((a, h) => a + h.peso, 0) + (e.payload.merma || 0);
  const antes = pesoAntesDe(e.lote_id, e);
  const padre = porId.get(e.lote_id);
  if (antes === null || !cerca(suma, antes)) registrar('R1 Division con balance de masa exacto', `${padre?.codigo}: hijos + merma = ${suma} kg, peso del padre = ${antes} kg`);
}

// R2: mezclar = peso del lote nuevo igual a la suma de los aportes de los origenes
for (const e of eventos.filter((x) => x.tipo === 'mezcla')) {
  cuenta('R2');
  const suma = (e.payload.origenes || []).reduce((a, o) => a + o.peso, 0);
  const nuevo = porId.get(e.lote_id);
  if (!nuevo || !cerca(suma, e.payload.pesoTotal) || !cerca(suma, nuevo.peso_inicial)) {
    registrar('R2 Mezcla suma los aportes de cada origen', `${nuevo?.codigo}: aportes ${suma} kg, total ${e.payload.pesoTotal} kg, lote ${nuevo?.peso_inicial} kg`);
  }
}

// R3: un lote dividido o mezclado queda cerrado y sin kilos (no se cuenta dos veces)
for (const l of lotes.filter((x) => ['dividido', 'mezclado'].includes(x.estado_lote))) {
  cuenta('R3');
  if (!cerca(l.peso_actual, 0)) registrar('R3 Lote cerrado sin kilos', `${l.codigo} esta ${l.estado_lote} con ${l.peso_actual} kg`);
}

// R4: todo lote con padres apunta a lotes que existen y los cita en su historial
for (const l of lotes) {
  const padres = JSON.parse(l.parent_ids || '[]');
  if (!padres.length) continue;
  cuenta('R4');
  const faltan = padres.filter((p) => !porId.has(p));
  if (faltan.length) registrar('R4 Todo padre existe', `${l.codigo} cita padres inexistentes: ${faltan.join(', ')}`);
}

// R5: todo lote tiene un primer evento de origen
for (const l of lotes) {
  cuenta('R5');
  const primero = (eventosDe.get(l.id) || [])[0];
  if (!primero || !['creacion', 'creacion_por_division', 'mezcla'].includes(primero.tipo)) {
    registrar('R5 Todo lote tiene evento de origen', `${l.codigo}: primer evento = ${primero ? primero.tipo : 'ninguno'}`);
  }
}

// R6: no se crean kilos de la nada (los kilos activos no superan los recolectados mas el exceso recibido)
const raiz = lotes.filter((l) => JSON.parse(l.parent_ids || '[]').length === 0);
const recolectado = raiz.reduce((a, l) => a + l.peso_inicial, 0);
const excesoRecibido = traspasos.filter((t) => t.estado === 'aceptado')
  .reduce((a, t) => a + Math.max(0, (t.peso_recibido || 0) - t.peso_enviado), 0);
const activos = lotes.filter((l) => !['dividido', 'mezclado'].includes(l.estado_lote)).reduce((a, l) => a + l.peso_actual, 0);
cuenta('R6');
if (activos > recolectado + excesoRecibido + 0.011) {
  registrar('R6 No se crean kilos', `kilos activos ${activos.toFixed(2)} > recolectados ${recolectado.toFixed(2)} + exceso recibido ${excesoRecibido.toFixed(2)}`);
}

// R7: todo traspaso aceptado tiene peso recibido y su diferencia esta bien calculada
for (const t of traspasos.filter((x) => x.estado === 'aceptado')) {
  cuenta('R7');
  const esperada = Math.abs(t.peso_recibido - t.peso_enviado) / t.peso_enviado * 100;
  if (t.peso_recibido == null || Math.abs(esperada - t.discrepancia_pct) > 0.01) {
    registrar('R7 Discrepancia de traspaso bien calculada', `traspaso ${t.id.slice(0, 8)}: guardada ${t.discrepancia_pct} %, esperada ${esperada.toFixed(2)} %`);
  }
}

// R8: ningun lote en transito sin un traspaso pendiente
const pendientes = new Set(traspasos.filter((t) => t.estado === 'pendiente').map((t) => t.lote_id));
for (const l of lotes.filter((x) => x.estado_lote === 'en_transito')) {
  cuenta('R8');
  if (!pendientes.has(l.id)) registrar('R8 Lote en transito con traspaso pendiente', `${l.codigo} esta en transito sin traspaso pendiente`);
}

const nombres = {
  R1: 'R1 Division con balance de masa exacto',
  R2: 'R2 Mezcla suma los aportes de cada origen',
  R3: 'R3 Lote cerrado sin kilos',
  R4: 'R4 Todo padre existe',
  R5: 'R5 Todo lote tiene evento de origen',
  R6: 'R6 No se crean kilos',
  R7: 'R7 Discrepancia de traspaso bien calculada',
  R8: 'R8 Lote en transito con traspaso pendiente',
};
console.log(`Base: ${ruta}`);
console.log(`Lotes: ${lotes.length} | Eventos: ${eventos.length} | Traspasos: ${traspasos.length} | Kg recolectados: ${recolectado.toFixed(1)} | Kg activos: ${activos.toFixed(1)}\n`);
const filas = [];
for (const k of Object.keys(nombres)) {
  const malos = (fallas[nombres[k]] || []).length;
  filas.push({ Regla: nombres[k], Revisados: conteo[k] || 0, Violaciones: malos, Resultado: malos === 0 ? 'Cumple' : 'Falla' });
}
console.table(filas);
let total = 0;
for (const [regla, lista] of Object.entries(fallas)) {
  total += lista.length;
  console.log(`\n${regla}: ${lista.length} violaciones. Primeras:`);
  lista.slice(0, 5).forEach((d) => console.log('  - ' + d));
}
console.log(total === 0 ? '\nResultado: todas las reglas se cumplen.' : `\nResultado: ${total} violaciones.`);

const carpeta = path.join(__dirname, 'resultados');
fs.mkdirSync(carpeta, { recursive: true });
const sello = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(path.join(carpeta, `auditoria-${sello}.json`), JSON.stringify({ ruta, lotes: lotes.length, eventos: eventos.length, traspasos: traspasos.length, filas, fallas }, null, 2));
const enc = Object.keys(filas[0]);
fs.writeFileSync(path.join(carpeta, `auditoria-${sello}.md`), [
  '| ' + enc.join(' | ') + ' |', '| ' + enc.map(() => '---').join(' | ') + ' |',
  ...filas.map((f) => '| ' + enc.map((k) => f[k]).join(' | ') + ' |'),
].join('\n') + '\n');
process.exit(total === 0 ? 0 : 1);