import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PhoneLayout } from '../Layout.jsx';
import { api } from '../lib/api.js';

const RUTAS = ['Reciclaje textil', 'Reutilización', 'Upcycling / diseño', 'Disposición final'];

export default function Escanear() {
  const { loteId } = useParams();
  const navigate = useNavigate();
  const [lote, setLote] = useState(null);
  const [ruta, setRuta] = useState(RUTAS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getLote(loteId).then(setLote).catch(() => {});
  }, [loteId]);

  async function clasificarYContinuar() {
    setLoading(true);
    setError(null);
    try {
      await api.clasificar(loteId, { rutaAprovechamiento: ruta });
      navigate(`/traspaso/${loteId}/enviar`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!lote) return <PhoneLayout title="Escaneando…" />;

  return (
    <PhoneLayout title="Escanear lote" subtitle="Operador">
      <div className="card" style={{ background: 'var(--text)', color: '#fff', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Lote detectado: {lote.codigo}</div>
        <div style={{ fontSize: 12, color: '#C9D3CC' }}>{lote.pesoInicial} kg · entregado en {lote.puntoOrigen}</div>
      </div>

      <div className="card">
        <strong>Registrar evento</strong>
        <div className="field">
          <label>Ruta de aprovechamiento</label>
          <select value={ruta} onChange={(e) => setRuta(e.target.value)}>
            {RUTAS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="kv"><span className="label">Responsable actual</span><span className="value">{lote.responsableNombre}</span></div>
      </div>

      <div className="field">
        <label>¿Qué pasa ahora con el lote?</label>
        <div className="option-row">Traspasar a un gestor</div>
      </div>

      {error && <div className="error-box"><span>⚠</span><div><strong>Error</strong><span>{error}</span></div></div>}

      <div className="spacer" />
      <button className="btn btn-primary" onClick={clasificarYContinuar} disabled={loading}>
        {loading ? 'Guardando…' : 'Continuar'}
      </button>
    </PhoneLayout>
  );
}
