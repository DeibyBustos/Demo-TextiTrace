// Exportación de datos por categoría (rol Entidad). Solo lectura: no modifica la base.
//   GET /api/export/categorias            -> categorías disponibles y sus valores actuales
//   GET /api/export?categoria=&valor=&formato=geojson|csv  -> descarga del archivo
// El GeoJSON descargado es el mismo formato que la pantalla de mapa sabe importar.

import { Router } from 'express';
import { listLotes } from './db.js';
import { serializeLote } from './routes.js';
import { CATEGORIAS, COLUMNAS, conUbicacion } from './geo.js';

export const exportRouter = Router();

function lotesConUbicacion() {
  return listLotes().map(serializeLote).map(conUbicacion);
}

function slug(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

exportRouter.get('/export/categorias', (_req, res) => {
  const lotes = lotesConUbicacion();
  res.json(CATEGORIAS.map((c) => ({
    ...c,
    valores: [...new Set(lotes.map((l) => l[c.key]).filter((v) => v !== null && v !== undefined))].sort(),
  })));
});

exportRouter.get('/export', (req, res) => {
  const { categoria, valor, formato = 'geojson' } = req.query;
  if (categoria && !CATEGORIAS.some((c) => c.key === categoria)) {
    return res.status(400).json({ error: `Categoría no válida: ${categoria}` });
  }
  if (!['geojson', 'csv'].includes(formato)) {
    return res.status(400).json({ error: 'formato debe ser geojson o csv' });
  }

  let lotes = lotesConUbicacion();
  if (categoria && valor) lotes = lotes.filter((l) => String(l[categoria]) === String(valor));

  const fecha = new Date().toISOString().slice(0, 10);
  const nombre = ['textitrace', categoria && slug(categoria), valor && slug(valor), fecha]
    .filter(Boolean).join('_');

  if (formato === 'csv') {
    const filas = [COLUMNAS.join(','), ...lotes.map((l) => COLUMNAS.map((k) => csvCell(l[k])).join(','))];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.csv"`);
    // BOM para que Excel lea bien las tildes
    return res.send('﻿' + filas.join('\r\n'));
  }

  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      fuente: 'TextiTrace',
      generado: new Date().toISOString(),
      filtro: categoria && valor ? { categoria, valor } : null,
      totalLotes: lotes.length,
    },
    features: lotes.map(({ lat, lng, ...props }) => ({
      type: 'Feature',
      geometry: lat !== null && lng !== null ? { type: 'Point', coordinates: [lng, lat] } : null,
      properties: props,
    })),
  };
  res.setHeader('Content-Type', 'application/geo+json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}.geojson"`);
  res.send(JSON.stringify(geojson, null, 2));
});
