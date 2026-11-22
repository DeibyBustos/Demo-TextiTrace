import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PhoneLayout } from '../Layout.jsx';
import { useRole } from '../RoleContext.jsx';
import { api } from '../lib/api.js';

export default function TraspasoPaso2() {
  const { traspasoId } = useParams();
  const navigate = useNavigate();
  const { nombre } = useRole();
  const [traspaso, setTraspaso] = useState(null);
  const [pesoRecibido, setPesoRecibido] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [discrepancia, setDiscrepancia] = useState(null); // { pct, mensaje }

  useEffect(() => {
    api.getTraspaso(traspasoId).then((t) => { setTraspaso(t); setPesoRecibido(String(t.pesoEnviado)); });
  }, [traspasoId]);

  async function resolver(accion) {
    setLoading(true);
    setError(null);
    try {
      await api.resolverTraspaso(traspasoId, { pesoRecibido: Number(pesoRecibido), accion, actorNombre: nombre });
      if (accion === 'rechazar') {
        navigate('/dashboard-gestor');
      } else {
        const t = await api.getTraspaso(traspasoId);
        navigate(`/lotes/${t.loteId}/dividir`);
      }
    } catch (e) {
      if (e.data && e.data.error === 'discrepancia_requiere_decision') {
        setDiscrepancia({ pct: e.data.discrepanciaPct, mensaje: e.data.mensaje });
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function intentarAceptar() {
    setDiscrepancia(null);
    resolver('aceptar');
  }

  if (!traspaso) return <PhoneLayout title="Cargando…" />;

  return (
    <PhoneLayout title="Aceptar traspaso" subtitle={`Paso 2 de 2 · Receptor: ${nombre}`}>
      <div className="card">
        <strong>{traspaso.lote ? traspaso.lote.codigo : ''} · en tránsito</strong>
        <div className="kv"><span className="label">Peso enviado por el emisor</span><span className="value">{traspaso.pesoEnviado} kg</span></div>
        <div className="field">
          <label>Peso recibido (verificado)</label>
          <input
            type="number" step="0.1"
            className={discrepancia ? 'invalid' : ''}
            value={pesoRecibido}
            onChange={(e) => { setPesoRecibido(e.target.value); setDiscrepancia(null); }}
          />
        </div>
      </div>

      {discrepancia && (
        <div className="error-box">
          <span>⚠</span>
          <div>
            <strong>Diferencia de {discrepancia.pct}% (&gt; 5%)</strong>
            <span>Se genera una alerta de discrepancia antes de aceptar el traspaso.</span>
          </div>
        </div>
      )}
      {error && <div className="error-box"><span>⚠</span><div><strong>Error</strong><span>{error}</span></div></div>}

      <div className="spacer" />
      {discrepancia ? (
        <>
          <button className="btn btn-secondary" onClick={() => resolver('aceptar_con_observacion')} disabled={loading}>
            Aceptar y dejar observación
          </button>
          <button className="btn btn-danger" onClick={() => resolver('rechazar')} disabled={loading}>
            Rechazar y notificar al emisor
          </button>
        </>
      ) : (
        <button className="btn btn-primary" onClick={intentarAceptar} disabled={loading}>
          {loading ? 'Procesando…' : 'Aceptar traspaso'}
        </button>
      )}
    </PhoneLayout>
  );
}
