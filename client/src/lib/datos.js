// Lectura de los archivos exportados (GeoJSON o CSV) y agregación por punto para el mapa.
// Todo ocurre en el navegador: importar un archivo NO escribe en la base de datos.

const NUMERICOS = ['pesoInicial', 'pesoActual', 'lat', 'lng'];

// Los lotes divididos o mezclados ya están contados en sus lotes resultantes.
export const ESTADOS_CERRADOS = ['dividido', 'mezclado'];

export function desdeGeoJSON(obj) {
  if (!obj || obj.type !== 'FeatureCollection' || !Array.isArray(obj.features)) {
    throw new Error('El archivo no es un GeoJSON FeatureCollection exportado por TextiTrace.');
  }
  return obj.features.map((f) => {
    const [lng, lat] = f.geometry?.type === 'Point' ? f.geometry.coordinates : [null, null];
    return normalizar({ ...f.properties, lat, lng });
  });
}

function parseCSV(text) {
  const filas = [];
  let fila = [];
  let celda = '';
  let comillas = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (comillas) {
      if (c === '"' && text[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(celda); celda = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      fila.push(celda); filas.push(fila); fila = []; celda = '';
    } else celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  return filas.filter((f) => f.some((c) => c !== ''));
}

export function desdeCSV(text) {
  const [encabezado, ...filas] = parseCSV(text.replace(/^﻿/, ''));
  const requeridas = ['codigo', 'puntoOrigen', 'pesoActual', 'lat', 'lng'];
  const faltan = requeridas.filter((c) => !encabezado?.includes(c));
  if (faltan.length) throw new Error(`Al CSV le faltan columnas: ${faltan.join(', ')}.`);
  return filas.map((f) => normalizar(Object.fromEntries(encabezado.map((k, i) => [k, f[i] ?? '']))));
}

function normalizar(r) {
  const out = { ...r };
  NUMERICOS.forEach((k) => {
    out[k] = out[k] === '' || out[k] === null || out[k] === undefined ? null : Number(out[k]);
    if (Number.isNaN(out[k])) out[k] = null;
  });
  ['rutaAprovechamiento', 'estadoPrenda'].forEach((k) => { if (out[k] === '') out[k] = null; });
  return out;
}

export async function leerArchivo(file) {
  const text = await file.text();
  if (/\.csv$/i.test(file.name)) return desdeCSV(text);
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('No se pudo leer el archivo: no es JSON/GeoJSON válido ni CSV.'); }
  return desdeGeoJSON(obj);
}

// Agrupa lotes activos por punto de recolección, con desglose por la categoría elegida.
export function agregarPorPunto(registros, categoria) {
  const puntos = new Map();
  registros.forEach((r) => {
    if (r.lat === null || r.lng === null) return;
    const key = r.puntoOrigen;
    if (!puntos.has(key)) {
      puntos.set(key, { punto: key, localidad: r.localidad, lat: r.lat, lng: r.lng, kg: 0, lotes: 0, desglose: {} });
    }
    const p = puntos.get(key);
    const kg = r.pesoActual || 0;
    const valor = r[categoria] ?? 'Sin asignar';
    p.kg += kg;
    p.lotes += 1;
    p.desglose[valor] = (p.desglose[valor] || 0) + kg;
  });
  return [...puntos.values()].map((p) => {
    const dominante = Object.entries(p.desglose).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { ...p, dominante };
  });
}

export const PALETA = ['#2F5D45', '#C97B4A', '#4A7BA8', '#8E5A9B', '#C9A23A', '#5C6B61', '#B23A3A'];

export function colorPara(valores) {
  const m = {};
  valores.forEach((v, i) => { m[v] = PALETA[i % PALETA.length]; });
  return m;
}
