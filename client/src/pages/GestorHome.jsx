import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneLayout } from '../Layout.jsx';
import { useRole } from '../RoleContext.jsx';
import { api } from '../lib/api.js';

export default function GestorHome() {
  const { nombre } = useRole();
  const navigate = useNavigate();
  const [pendientes, setPendientes] = useState([]);
  const [misLotes, setMisLotes] = useState([]);

  async function cargar() {
    const [traspasos, lotes] = await Promise.all([
      api.listarTraspasos('pendiente'),
      api.listarLotes(),
    ]);
    setPendientes(traspasos);
    setMisLotes(lotes.filter((l) => l.responsableRol === 'gestor' && l.estadoLote === 'clasificado'));
  }

  useEffect(() => { cargar(); }, []);

  return (
    <PhoneLayout title="Panel del gestor" subtitle={nombre}>
      <div className="field">
        <label>Traspasos por aceptar</label>
        {pendientes.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>No hay traspasos pendientes.</p>}
        {pendientes.map((t) => (
          <button key={t.id} className="lote-pick-item" onClick={() => navigate(`/traspaso/${t.id}/aceptar`)}>
            <span>{t.lote.codigo} · {t.pesoEnviado} kg</span>
            <span className="linklike">Aceptar →</span>
          </button>
        ))}
      </div>

      <div className="field">
        <label>Mis lotes (dividir / mezclar)</label>
        {misLotes.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Aún no tienes lotes recibidos.</p>}
        {misLotes.map((l) => (
          <div key={l.id} className="lote-pick-item">
            <span>{l.codigo} · {l.pesoActual} kg · {l.rutaAprovechamiento}</span>
            <span style={{ display: 'flex', gap: 10 }}>
              <button className="linklike" onClick={() => navigate(`/lotes/${l.id}/dividir`)}>Dividir</button>
              <button className="linklike" onClick={() => navigate(`/lotes/${l.id}/historial`)}>Historial</button>
            </span>
          </div>
        ))}
      </div>

      <div className="spacer" />
      <button className="btn btn-secondary" onClick={() => navigate('/mezclar')}>Mezclar lotes</button>
    </PhoneLayout>
  );
}
