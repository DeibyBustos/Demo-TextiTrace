import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PhoneLayout } from '../Layout.jsx';
import { useRole } from '../RoleContext.jsx';
import { api } from '../lib/api.js';

export default function TraspasoPaso1() {
  const { loteId } = useParams();
  const navigate = useNavigate();
  const { nombre } = useRole();
  const [lote, setLote] = useState(null);
  const [destinatario, setDestinatario] = useState('Centro de Acopio El Rosal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getLote(loteId).then(setLote).catch(() => {});
  }, [loteId]);

  async function enviar() {
    setLoading(true);
    setError(null);
    try {
      const traspaso = await api.enviarTraspaso(loteId, {
        destinatarioRol: 'gestor',
        destinatarioNombre: destinatario,
        pesoEnviado: lote.pesoActual,
        emisorNombre: nombre,
      });
      navigate(`/traspaso/${traspaso.id}/aceptar`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!lote) return <PhoneLayout title="Cargando…" />;

  return (
    <PhoneLayout title="Traspasar lote" subtitle={`Paso 1 de 2 · Emisor: ${nombre}`}>
      <div className="card">
        <strong>{lote.codigo}</strong>
        <div className="kv"><span className="label">Peso a enviar</span><span className="value">{lote.pesoActual} kg</span></div>
        <div className="field">
          <label>Destino (gestor)</label>
          <select value={destinatario} onChange={(e) => setDestinatario(e.target.value)}>
            <option>Centro de Acopio El Rosal</option>
            <option>Centro de Acopio Kennedy</option>
          </select>
        </div>
        <span className="badge warn">En tránsito al confirmar</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>
        El lote queda "en tránsito" hasta que el receptor confirme el peso recibido. El responsable solo cambia tras la aceptación.
      </p>
      {error && <div className="error-box"><span>⚠</span><div><strong>Error</strong><span>{error}</span></div></div>}
      <div className="spacer" />
      <button className="btn btn-primary" onClick={enviar} disabled={loading}>
        {loading ? 'Enviando…' : 'Enviar lote (registrar envío)'}
      </button>
    </PhoneLayout>
  );
}
