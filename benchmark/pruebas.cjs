// Pruebas automaticas de integridad de TextiTrace (escenarios E1 a E6 + eventos de solo alta).

const fs = require('fs');
const path = require('path');

const HOST = process.env.HOST || 'http://localhost:3000';
const API = process.env.API_PREFIX || '/api';
const BASE = HOST + API;

async function api(method, p, body) {
  const r = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = txt; }
  return { status: r.status, data };
}
const ok = async (method, p, body) => {
  const r = await api(method, p, body);
  if (r.status >= 300) throw new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
};
const crear = (peso) => ok('POST', '/lotes', { material: 'algodon', estadoPrenda: 'bueno', peso, puntoOrigen: 'Punto Prueba', responsableNombre: 'Prueba' });
const clasificar = (id, ruta = 'reciclaje') => ok('POST', `/lotes/${id}/clasificar`, { rutaAprovechamiento: ruta });
const crearClasificado = async (peso, ruta) => { const l = await crear(peso); await clasificar(l.id, ruta); return l; };
const traspasar = async (id, peso, recibido = peso) => {
  const t = await ok('POST', `/lotes/${id}/traspaso/enviar`, { destinatarioRol: 'gestor', destinatarioNombre: 'Gestor Prueba', pesoEnviado: peso });
  return ok('POST', `/traspasos/${t.id}/resolver`, { pesoRecibido: recibido, accion: 'aceptar' });
};
const cerca = (a, b) => Math.abs(a - b) < 0.01;

// Cada prueba devuelve { pasa: boolean, obtenido: string }
const PRUEBAS = [
  {
    id: 'E1',
    nombre: 'Dividir 100 kg en 60 kg y 38 kg con 2 kg de merma',
    esperado: 'Padre cerrado; dos hijos con QR propio y enlazados al padre',
    run: async () => {
      const padre = await crearClasificado(100);
      const r = await api('POST', `/lotes/${padre.id}/dividir`, { hijos: [{ peso: 60 }, { peso: 38 }], merma: 2 });
      if (r.status !== 201) return { pasa: false, obtenido: `Respuesta ${r.status}: ${JSON.stringify(r.data)}` };
      const { loteOrigen, hijos } = r.data;
      const codigos = new Set([padre.codigo, ...hijos.map((h) => h.codigo)]);
      const enlazados = hijos.every((h) => h.parentIds.length === 1 && h.parentIds[0] === padre.id);
      const pesos = hijos.map((h) => h.pesoActual).sort((a, b) => a - b);
      const pasa = loteOrigen.estadoLote === 'dividido' && hijos.length === 2 && codigos.size === 3 && enlazados
        && cerca(pesos[0], 38) && cerca(pesos[1], 60);
      return { pasa, obtenido: `Padre ${loteOrigen.estadoLote}; hijos ${hijos.map((h) => `${h.codigo} (${h.pesoActual} kg)`).join(' y ')}; ${enlazados ? 'enlazados al padre' : 'SIN enlace al padre'}` };
    },
  },
  {
    id: 'E2',
    nombre: 'Dividir 100 kg en 60 kg y 45 kg',
    esperado: 'El sistema rechaza la operacion por balance de masa',
    run: async () => {
      const padre = await crearClasificado(100);
      const antes = (await ok('GET', '/lotes')).length;
      const r = await api('POST', `/lotes/${padre.id}/dividir`, { hijos: [{ peso: 60 }, { peso: 45 }], merma: 0 });
      const despues = (await ok('GET', '/lotes')).length;
      const intacto = await ok('GET', `/lotes/${padre.id}`);
      const pasa = r.status === 400 && r.data.error === 'balance_de_masa_invalido' && antes === despues
        && intacto.estadoLote === 'clasificado' && cerca(intacto.pesoActual, 100);
      return { pasa, obtenido: `Respuesta ${r.status} (${r.data.error || 'sin codigo'}); lotes antes/despues: ${antes}/${despues}; padre ${intacto.estadoLote} con ${intacto.pesoActual} kg` };
    },
  },
  {
    id: 'E3',
    nombre: 'Mezclar un lote de 38 kg con otro de 30 kg, misma ruta',
    esperado: 'Lote nuevo de 68 kg con los aportes de cada origen',
    run: async () => {
      const a = await crearClasificado(38, 'reciclaje');
      const b = await crearClasificado(30, 'reciclaje');
      const r = await api('POST', '/lotes/mezclar', { loteIds: [a.id, b.id] });
      if (r.status !== 201) return { pasa: false, obtenido: `Respuesta ${r.status}: ${JSON.stringify(r.data)}` };
      const nuevo = r.data;
      const ea = await ok('GET', `/lotes/${a.id}`);
      const eb = await ok('GET', `/lotes/${b.id}`);
      const h = await ok('GET', `/lotes/${nuevo.id}/historial`);
      const mezcla = h.timeline.find((e) => e.tipo === 'mezcla');
      const aportes = mezcla ? mezcla.payload.origenes.map((o) => o.peso).sort((x, y) => x - y) : [];
      const pasa = cerca(nuevo.pesoActual, 68) && nuevo.parentIds.length === 2 && ea.estadoLote === 'mezclado'
        && eb.estadoLote === 'mezclado' && aportes.length === 2 && cerca(aportes[0], 30) && cerca(aportes[1], 38);
      return { pasa, obtenido: `Lote ${nuevo.codigo} de ${nuevo.pesoActual} kg; aportes ${aportes.join(' y ')} kg; origenes ${ea.estadoLote}/${eb.estadoLote}` };
    },
  },
  {
    id: 'E4',
    nombre: 'Mezclar dos lotes con rutas de aprovechamiento distintas',
    esperado: 'El sistema rechaza la mezcla',
    run: async () => {
      const a = await crearClasificado(20, 'reciclaje');
      const b = await crearClasificado(20, 'reutilizacion');
      const r = await api('POST', '/lotes/mezclar', { loteIds: [a.id, b.id] });
      const ea = await ok('GET', `/lotes/${a.id}`);
      const pasa = r.status === 400 && r.data.error === 'ruta_incompatible' && ea.estadoLote === 'clasificado';
      return { pasa, obtenido: `Respuesta ${r.status} (${r.data.error || 'sin codigo'}); origen sigue ${ea.estadoLote}` };
    },
  },
  {
    id: 'E5',
    nombre: 'Traspaso en dos pasos entre punto y gestor',
    esperado: 'El responsable cambia solo tras la aceptacion; una diferencia de peso mayor a 5 % genera alerta',
    run: async () => {
      const l = await crearClasificado(100);
      const t = await ok('POST', `/lotes/${l.id}/traspaso/enviar`, { destinatarioRol: 'gestor', destinatarioNombre: 'Gestor Prueba', pesoEnviado: 100 });
      const enTransito = await ok('GET', `/lotes/${l.id}`);
      const sinCambio = enTransito.estadoLote === 'en_transito' && enTransito.responsableRol === 'operador';
      await ok('POST', `/traspasos/${t.id}/resolver`, { pesoRecibido: 100, accion: 'aceptar' });
      const aceptado = await ok('GET', `/lotes/${l.id}`);
      const cambio = aceptado.responsableRol === 'gestor';

      // Discrepancia de 10 %: debe exigir decision explicita
      const l2 = await crearClasificado(100);
      const t2 = await ok('POST', `/lotes/${l2.id}/traspaso/enviar`, { destinatarioRol: 'gestor', destinatarioNombre: 'Gestor Prueba', pesoEnviado: 100 });
      const r2 = await api('POST', `/traspasos/${t2.id}/resolver`, { pesoRecibido: 90, accion: 'aceptar' });
      const siguePendiente = (await ok('GET', `/lotes/${l2.id}`)).responsableRol === 'operador';
      const r3 = await api('POST', `/traspasos/${t2.id}/resolver`, { pesoRecibido: 90, accion: 'aceptar_con_observacion' });
      const alerta = r2.status === 409 && r2.data.error === 'discrepancia_requiere_decision'
        && r3.status === 200 && r3.data.discrepanciaPct > 5;
      const pasa = sinCambio && cambio && siguePendiente && alerta;
      return { pasa, obtenido: `En transito: responsable ${enTransito.responsableRol}; tras aceptar: ${aceptado.responsableRol}; con 10 % de diferencia: ${r2.status} (${r2.data.error || '-'}), luego aceptado con observacion (${r3.data.discrepanciaPct} %)` };
    },
  },
  {
    id: 'E6',
    nombre: 'Consultar el historial de un lote despues de traspasar, dividir y mezclar',
    esperado: 'Historial completo hasta el lote original, eventos en orden y kilos consistentes',
    run: async () => {
      const l1 = await crearClasificado(100);
      await traspasar(l1.id, 100);
      const div = await ok('POST', `/lotes/${l1.id}/dividir`, { hijos: [{ peso: 60 }, { peso: 38 }], merma: 2 });
      const hijoB = div.hijos.find((h) => cerca(h.pesoActual, 38));
      const l2 = await crearClasificado(30);
      const l3 = await ok('POST', '/lotes/mezclar', { loteIds: [hijoB.id, l2.id] });
      const h = await ok('GET', `/lotes/${l3.id}/historial`);
      const tl = h.timeline;
      const tipos = new Set(tl.map((e) => e.tipo));
      const codigos = new Set(tl.map((e) => e.loteCodigo));
      const ordenado = tl.every((e, i) => i === 0 || tl[i - 1].createdAt <= e.createdAt);
      const llegaAlOrigen = codigos.has(l1.codigo) && tl.some((e) => e.loteCodigo === l1.codigo && e.tipo === 'creacion');
      const tiene = ['creacion', 'traspaso_enviado', 'traspaso_aceptado', 'division', 'mezcla'].every((t) => tipos.has(t));
      const kilos = cerca(l3.pesoActual, 68) && cerca(hijoB.pesoActual + l2.pesoActual, l3.pesoActual);
      const pasa = llegaAlOrigen && tiene && ordenado && kilos;
      return { pasa, obtenido: `${tl.length} eventos de ${codigos.size} lotes (${[...codigos].join(', ')}); ${ordenado ? 'en orden' : 'DESORDENADOS'}; ${llegaAlOrigen ? 'llega a ' + l1.codigo : 'NO llega al lote original'}; kilos ${l3.pesoActual} = ${hijoB.pesoActual} + ${l2.pesoActual}` };
    },
  },
  {
    id: 'E7',
    nombre: 'Intentar editar o borrar un evento por la API',
    esperado: 'No existe ninguna ruta para editar o borrar eventos (solo alta)',
    run: async () => {
      const l = await crear(10);
      const h = await ok('GET', `/lotes/${l.id}/historial`);
      const ev = h.timeline[0];
      const intentos = [];
      for (const [m, p] of [['PUT', `/eventos/${ev.id}`], ['PATCH', `/eventos/${ev.id}`], ['DELETE', `/eventos/${ev.id}`],
        ['DELETE', `/lotes/${l.id}`], ['PUT', `/lotes/${l.id}/historial`]]) {
        const r = await api(m, p, { tipo: 'x' });
        intentos.push(`${m} ${p.split('/')[1]}: ${r.status}`);
        if (r.status < 400 || r.status >= 500) return { pasa: false, obtenido: `Una ruta respondio ${r.status}: ${m} ${p}` };
      }
      const igual = (await ok('GET', `/lotes/${l.id}/historial`)).timeline.length === h.timeline.length;
      return { pasa: igual, obtenido: `${intentos.join('; ')}; historial sin cambios: ${igual ? 'si' : 'NO'}` };
    },
  },
];

(async () => {
  try { await ok('GET', '/lotes'); } catch (e) {
    console.error('No se pudo conectar con el servidor. Revise HOST y API_PREFIX.\n', e.message);
    process.exit(1);
  }
  const filas = [];
  for (const t of PRUEBAS) {
    let res;
    try { res = await t.run(); } catch (e) { res = { pasa: false, obtenido: 'Error: ' + e.message }; }
    filas.push({ Id: t.id, Escenario: t.nombre, 'Resultado esperado': t.esperado, 'Resultado obtenido': res.obtenido, Resultado: res.pasa ? 'Pasa' : 'Falla' });
    console.log(`${t.id} ${res.pasa ? 'PASA ' : 'FALLA'} - ${t.nombre}\n      ${res.obtenido}`);
  }
  const pasan = filas.filter((f) => f.Resultado === 'Pasa').length;
  const e16 = filas.filter((f) => /^E[1-6]$/.test(f.Id));
  console.log(`\nEscenarios E1 a E6 superados: ${e16.filter((f) => f.Resultado === 'Pasa').length} de 6`);
  console.log(`Pruebas superadas en total: ${pasan} de ${filas.length}`);

  const carpeta = path.join(__dirname, 'resultados');
  fs.mkdirSync(carpeta, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(carpeta, `pruebas-${sello}.json`), JSON.stringify({ HOST, API, fecha: new Date().toISOString(), node: process.version, filas }, null, 2));
  const enc = Object.keys(filas[0]);
  fs.writeFileSync(path.join(carpeta, `pruebas-${sello}.md`), [
    '| ' + enc.join(' | ') + ' |', '| ' + enc.map(() => '---').join(' | ') + ' |',
    ...filas.map((f) => '| ' + enc.map((k) => String(f[k]).replace(/\|/g, '/')).join(' | ') + ' |'),
  ].join('\n') + '\n');
  console.log('Guardado en benchmark/resultados/');
  process.exit(pasan === filas.length ? 0 : 1);
})();