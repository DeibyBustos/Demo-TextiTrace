// Benchmark de TextiTrace

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

const HOST = process.env.HOST || 'http://localhost:3000';
const API = process.env.API_PREFIX || '/api';
const BASE = HOST + API;
const CONEXIONES = Number(process.env.CONEXIONES || 10);
const DURACION = Number(process.env.DURACION || 10); 
const PETICIONES = Number(process.env.PETICIONES || 200); 
const REPETICIONES = Number(process.env.REPETICIONES || 3);
const H = { 'Content-Type': 'application/json' };

// ---------- utilidades para preparar datos sinteticos ----------
async function api(method, p, body) {
  const r = await fetch(BASE + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = txt; }
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${txt}`);
  return data;
}
const crearLote = (peso = 100) =>
  api('POST', '/lotes', { material: 'algodon', estadoPrenda: 'bueno', peso, puntoOrigen: 'Punto Bench', responsableNombre: 'Bench' });
const clasificar = (id, ruta = 'reciclaje') =>
  api('POST', `/lotes/${id}/clasificar`, { rutaAprovechamiento: ruta });
async function crearClasificado(peso = 100, ruta = 'reciclaje') {
  const l = await crearLote(peso);
  await clasificar(l.id, ruta);
  return l;
}
const muchos = async (n, fabrica) => { const xs = []; for (let i = 0; i < n; i++) xs.push(await fabrica(i)); return xs; };

// Una peticion distinta por cada item (para escrituras que no se pueden repetir sobre el mismo lote).
function unaPorItem(method, items, construir) {
  let i = 0;
  return {
    url: BASE,
    method,
    headers: H,
    amount: items.length,
    requests: [{
      method,
      setupRequest: (req) => {
        const { ruta, body } = construir(items[i++ % items.length]);
        req.path = API + ruta;
        req.method = method;
        req.body = body ? JSON.stringify(body) : undefined;
        return req;
      },
    }],
  };
}

// ---------- escenarios ----------
const ESCENARIOS = [
  {
    nombre: 'Panel de indicadores (GET /dashboard)',
    meta: 300,
    preparar: async () => ({ url: BASE + '/dashboard', duration: DURACION }),
  },
  {
    nombre: 'Listar lotes (GET /lotes)',
    meta: 300,
    preparar: async () => ({ url: BASE + '/lotes', duration: DURACION }),
  },
  {
    nombre: 'Historial con division y mezcla (GET /lotes/:id/historial)',
    meta: 500,
    preparar: async () => {
      const origen = await crearClasificado(100);
      const div = await api('POST', `/lotes/${origen.id}/dividir`, { hijos: [{ peso: 60 }, { peso: 38 }], merma: 2 });
      const otro = await crearClasificado(30);
      const mezcla = await api('POST', '/lotes/mezclar', { loteIds: [div.hijos[1].id, otro.id] });
      return { url: BASE + `/lotes/${mezcla.id}/historial`, duration: DURACION };
    },
  },
  {
    nombre: 'Crear entrega (POST /lotes)',
    meta: 300,
    preparar: async () => ({
      url: BASE + '/lotes', method: 'POST', headers: H, amount: PETICIONES,
      body: JSON.stringify({ material: 'algodon', estadoPrenda: 'bueno', peso: 10, puntoOrigen: 'Punto Bench', responsableNombre: 'Bench' }),
    }),
  },
  {
    nombre: 'Clasificar lote (POST /lotes/:id/clasificar)',
    meta: 300,
    preparar: async () => {
      const lotes = await muchos(PETICIONES, () => crearLote(10));
      return unaPorItem('POST', lotes, (l) => ({ ruta: `/lotes/${l.id}/clasificar`, body: { rutaAprovechamiento: 'reciclaje' } }));
    },
  },
  {
    nombre: 'Traspaso paso 1: enviar (POST /lotes/:id/traspaso/enviar)',
    meta: 300,
    preparar: async () => {
      const lotes = await muchos(PETICIONES, () => crearLote(100));
      return unaPorItem('POST', lotes, (l) => ({
        ruta: `/lotes/${l.id}/traspaso/enviar`,
        body: { destinatarioRol: 'gestor', destinatarioNombre: 'Gestor Bench', pesoEnviado: 100 },
      }));
    },
  },
  {
    nombre: 'Traspaso paso 2: resolver (POST /traspasos/:id/resolver)',
    meta: 300,
    preparar: async () => {
      const traspasos = await muchos(PETICIONES, async () => {
        const l = await crearLote(100);
        return api('POST', `/lotes/${l.id}/traspaso/enviar`, { destinatarioRol: 'gestor', destinatarioNombre: 'Gestor Bench', pesoEnviado: 100 });
      });
      return unaPorItem('POST', traspasos, (t) => ({ ruta: `/traspasos/${t.id}/resolver`, body: { pesoRecibido: 100, accion: 'aceptar' } }));
    },
  },
  {
    nombre: 'Dividir lote (POST /lotes/:id/dividir)',
    meta: 500,
    preparar: async () => {
      const lotes = await muchos(PETICIONES, () => crearLote(100));
      return unaPorItem('POST', lotes, (l) => ({ ruta: `/lotes/${l.id}/dividir`, body: { hijos: [{ peso: 60 }, { peso: 38 }], merma: 2 } }));
    },
  },
  {
    nombre: 'Mezclar lotes (POST /lotes/mezclar)',
    meta: 500,
    preparar: async () => {
      const pares = await muchos(PETICIONES, async () => [await crearClasificado(40), await crearClasificado(30)]);
      return unaPorItem('POST', pares, (p) => ({ ruta: '/lotes/mezclar', body: { loteIds: [p[0].id, p[1].id] } }));
    },
  },
];

// ---------- ejecucion ----------
const correr = (opciones) =>
  new Promise((resolve, reject) =>
    autocannon({ connections: CONEXIONES, ...opciones }, (err, r) => (err ? reject(err) : resolve(r))));

const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

(async () => {
  // Verifica que el servidor responde antes de empezar.
  try { await api('GET', '/lotes'); } catch (e) {
    console.error('No se pudo conectar con el servidor. Revise HOST y API_PREFIX.\n', e.message);
    process.exit(1);
  }

  const filas = [];
  const crudo = [];

  for (const e of ESCENARIOS) {
    const p50 = [], p95 = [], rps = [], errores = [];
    for (let i = 0; i < REPETICIONES; i++) {
      process.stdout.write(`${e.nombre} (corrida ${i + 1}/${REPETICIONES})... `);
      const opciones = await e.preparar();
      const r = await correr(opciones);
      p50.push(r.latency.p50);
      p95.push(r.latency.p97_5); 
      rps.push(r.requests.average);
      errores.push(r.errors + r.non2xx);
      crudo.push({ escenario: e.nombre, corrida: i + 1, resultado: r });
      console.log('listo');
    }
    const p95m = mediana(p95);
    const err = errores.reduce((a, b) => a + b, 0);
    filas.push({
      Escenario: e.nombre,
      Conexiones: CONEXIONES,
      'p50 (ms)': mediana(p50),
      'p97,5 (ms)': p95m,
      'Peticiones/s': Math.round(mediana(rps)),
      Errores: err,
      'Meta (ms)': e.meta,
      Cumple: p95m <= e.meta && err === 0 ? 'Si' : 'No',
    });
  }

  console.log(`\nResultados (mediana de ${REPETICIONES} corridas):`);
  console.table(filas);

  const carpeta = path.join(__dirname, 'resultados');
  fs.mkdirSync(carpeta, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(carpeta, `bench-${sello}.json`), JSON.stringify({
    entorno: { node: process.version, plataforma: process.platform, HOST, API, CONEXIONES, DURACION, PETICIONES, REPETICIONES },
    resumen: filas,
    crudo,
  }, null, 2));
  const enc = Object.keys(filas[0]);
  const md = [
    '| ' + enc.join(' | ') + ' |',
    '| ' + enc.map(() => '---').join(' | ') + ' |',
    ...filas.map((f) => '| ' + enc.map((k) => f[k]).join(' | ') + ' |'),
  ].join('\n');
  fs.writeFileSync(path.join(carpeta, `bench-${sello}.md`), md + '\n');
  console.log('\nGuardado en benchmark/resultados/ (copie la tabla .md al informe).');
})().catch((e) => { console.error(e); process.exit(1); });