import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '../Layout.jsx';
import MapaLotes from '../components/MapaLotes.jsx';
import { api } from '../lib/api.js';
import { leerArchivo, desdeGeoJSON, agregarPorPunto, colorPara, ESTADOS_CERRADOS } from '../lib/datos.js';

const CATEGORIAS = [
  { key: 'material', label: 'Material' },
  { key: 'rutaAprovechamiento', label: 'Ruta de aprovechamiento' },
  { key: 'estadoLote', label: 'Estado del lote' },
  { key: 'estadoPrenda', label: 'Estado de la prenda' },
];

const kgFmt = (n) => `${Number(n.toFixed(1)).toLocaleString('es-CO')} kg`;

export default function Mapa() {
  const [fuente, setFuente] = useState({ tipo: 'bd', nombre: 'Base de datos' });
  const [registros, setRegistros] = useState(null);
  const [error, setError] = useState(null);
  const [categoria, setCategoria] = useState('material');
  const [filtro, setFiltro] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const inputRef = useRef(null);

  async function cargarBD() {
    setError(null);
    try {
      const geo = await api.exportGeojson();
      setRegistros(desdeGeoJSON(geo));
      setFuente({ tipo: 'bd', nombre: 'Base de datos' });
    } catch (e) {
      setError(e.message);
    }
  }

  async function importar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const datos = await leerArchivo(file);
      setRegistros(datos);
      setFuente({ tipo: 'archivo', nombre: file.name });
      setFiltro('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { cargarBD(); }, []);

  const activos = useMemo(
    () => (registros || []).filter((r) => !ESTADOS_CERRADOS.includes(r.estadoLote)),
    [registros],
  );
  const valores = useMemo(
    () => [...new Set(activos.map((r) => r[categoria] ?? 'Sin asignar'))].sort(),
    [activos, categoria],
  );
  const colores = useMemo(() => colorPara(valores), [valores]);
  const visibles = useMemo(
    () => (filtro ? activos.filter((r) => (r[categoria] ?? 'Sin asignar') === filtro) : activos),
    [activos, categoria, filtro],
  );
  const puntos = useMemo(() => agregarPorPunto(visibles, categoria), [visibles, categoria]);
  const sinUbicacion = visibles.filter((r) => r.lat === null || r.lng === null).length;
  const totalKg = puntos.reduce((a, p) => a + p.kg, 0);

  return (
    <DashboardLayout
      title="Mapa de lotes"
      subtitle="Kg activos por punto de recolección · Bogotá"
      back="/dashboard"
    >
      <div className="panel map-toolbar">
        <div className="field">
          <label>Origen de los datos</label>
          <div className="chips">
            <button type="button" className={`chip ${fuente.tipo === 'bd' ? 'active' : ''}`} onClick={cargarBD}>
              Base de datos
            </button>
            <button type="button" className={`chip ${fuente.tipo === 'archivo' ? 'active' : ''}`} onClick={() => inputRef.current.click()}>
              Importar archivo…
            </button>
            <input ref={inputRef} type="file" accept=".geojson,.json,.csv" hidden onChange={importar} />
          </div>
        </div>
        <div className="field">
          <label>Colorear por</label>
          <select value={categoria} onChange={(e) => { setCategoria(e.target.value); setFiltro(''); }}>
            {CATEGORIAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Filtrar</label>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos</option>
            {valores.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="error-box"><span>⚠</span><div><strong>No se pudieron cargar los datos</strong><span>{error}</span></div></div>
      )}

      <div className="map-layout">
        <MapaLotes puntos={puntos} colores={colores} seleccionado={seleccionado} />

        <div className="panel map-side">
          <div>
            <strong>{kgFmt(totalKg)}</strong>
            <span className="map-src">
              {visibles.length} lote(s) activos · fuente: {fuente.nombre}
            </span>
          </div>

          <div className="legend">
            {valores.map((v) => (
              <button
                key={v}
                type="button"
                className={`legend-item ${filtro === v ? 'active' : ''}`}
                onClick={() => setFiltro(filtro === v ? '' : v)}
              >
                <i style={{ background: colores[v] }} />{v}
              </button>
            ))}
          </div>

          <div>
            {[...puntos].sort((a, b) => b.kg - a.kg).map((p) => (
              <button
                key={p.punto}
                type="button"
                className="pt-row pt-btn"
                onClick={() => setSeleccionado({ punto: p.punto, n: Date.now() })}
              >
                <span><i className="dot" style={{ background: colores[p.dominante] }} />{p.punto}</span>
                <strong>{kgFmt(p.kg)}</strong>
              </button>
            ))}
            {registros && puntos.length === 0 && (
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>No hay lotes activos con ubicación para mostrar.</span>
            )}
          </div>

          {sinUbicacion > 0 && (
            <span className="map-src">{sinUbicacion} lote(s) sin coordenadas no aparecen en el mapa.</span>
          )}
          <span className="map-src">
            Los lotes divididos o mezclados no se dibujan: su peso ya está en los lotes resultantes.
            Importar un archivo solo lo visualiza; no modifica la base de datos.
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}
