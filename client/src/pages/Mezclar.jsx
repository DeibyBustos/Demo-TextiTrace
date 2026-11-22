import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneLayout } from '../Layout.jsx';
import { useRole } from '../RoleContext.jsx';
import { api } from '../lib/api.js';

export default function Mezclar() {
  const navigate = useNavigate();
  const { nombre } = useRole();
  const [lotes, setLotes] = useState([]);
  const [seleccion, setSeleccion] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listarLotes().then((all) => {
      setLotes(all.filter((l) => !['dividido', 'mezclado', 'en_transito'].includes(l.estadoLote) && l.rutaAprovechamiento));
    });
  }, []);

  function toggle(id) {
    setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const seleccionados = lotes.filter((l) => seleccion.includes(l.id));
  const rutasDistintas = new Set(seleccionados.map((l) => l.rutaAprovechamiento)).size > 1;
  const pesoTotal = seleccionados.reduce((a, l) => a + l.pesoActual, 0);

  async function confirmar() {
    setLoading(true);
    setError(null);
    try {
      const nuevo = await api.mezclar({ loteIds: seleccion, actorNombre: nombre });
      navigate(`/lotes/${nuevo.id}/historial`);
    } catch (e) {
      setError(e.data?.mensaje || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PhoneLayout title="Mezclar lotes" subtitle="Solo lotes con la misma ruta de aprovechamiento">
      <div className="lote-pick">
        {lotes.map((l) => (
          <div
            key={l.id}
            className={`lote-pick-item ${seleccion.includes(l.id) ? 'selected' : ''}`}
            onClick={() => toggle(l.id)}
          >
            <span>{l.codigo} · {l.pesoActual} kg</span>
            <span style={{ color: 'var(--muted)' }}>{l.rutaAprovechamiento}</span>
          </div>
        ))}
        {lotes.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>No hay lotes clasificados disponibles para mezclar.</p>}
      </div>

      {seleccion.length >= 2 && !rutasDistintas && (
        <div className="card soft">
          <strong style={{ fontSize: 13.5 }}>Resultado de la mezcla</strong>
          <div className="kv"><span className="label">Lotes seleccionados</span><span className="value">{seleccionados.map((l) => l.codigo).join(' + ')}</span></div>
          <div className="kv"><span className="label">Peso total</span><span className="value">{pesoTotal} kg</span></div>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Conserva el vínculo con cada lote de origen en su historial (genealogía).</span>
        </div>
      )}
      {seleccion.length >= 2 && rutasDistintas && (
        <div className="error-box"><span>⚠</span><div><strong>Ruta incompatible</strong><span>Solo se pueden mezclar lotes con la misma ruta de aprovechamiento.</span></div></div>
      )}
      {error && <div className="error-box"><span>⚠</span><div><strong>Error</strong><span>{error}</span></div></div>}

      <div className="spacer" />
      <button className="btn btn-primary" onClick={confirmar} disabled={seleccion.length < 2 || rutasDistintas || loading}>
        {loading ? 'Confirmando…' : 'Confirmar mezcla'}
      </button>
    </PhoneLayout>
  );
}
