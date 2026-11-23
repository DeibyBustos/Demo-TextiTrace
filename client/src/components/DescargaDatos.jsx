import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

// Panel para descargar los lotes filtrados por una categoría (GeoJSON para el mapa o CSV para Excel).
export default function DescargaDatos() {
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState('material');
  const [valor, setValor] = useState('');

  useEffect(() => {
    api.categoriasExport().then(setCategorias).catch(() => {});
  }, []);

  const valores = categorias.find((c) => c.key === categoria)?.valores || [];
  const url = (formato) => {
    const q = new URLSearchParams({ formato });
    if (valor) { q.set('categoria', categoria); q.set('valor', valor); }
    return `/api/export?${q}`;
  };

  return (
    <div className="panel">
      <strong>Descargar datos por categoría</strong>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
        El archivo GeoJSON se puede volver a importar en el mapa o abrir en QGIS / geojson.io. El CSV abre en Excel.
      </span>
      <div className="dl-row">
        <div className="field">
          <label>Categoría</label>
          <select value={categoria} onChange={(e) => { setCategoria(e.target.value); setValor(''); }}>
            {categorias.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Valor</label>
          <select value={valor} onChange={(e) => setValor(e.target.value)}>
            <option value="">Todos los lotes</option>
            {valores.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <a className="btn btn-primary dl-btn" href={url('geojson')} download>GeoJSON</a>
        <a className="btn btn-secondary dl-btn" href={url('csv')} download>CSV</a>
      </div>
    </div>
  );
}
