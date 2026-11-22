import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PhoneLayout } from '../Layout.jsx';
import { api } from '../lib/api.js';

const LABELS = {
  creacion: (p) => `Entrega registrada · ${p.peso} kg`,
  creacion_por_division: (p) => `Creado por división de ${p.loteOrigenCodigo} · ${p.peso} kg`,
  clasificacion: (p) => `Clasificado: ${p.rutaAprovechamiento}`,
  traspaso_enviado: (p) => `Enviado a ${p.destinatarioNombre} · ${p.pesoEnviado} kg`,
  traspaso_aceptado: (p) => `Traspaso aceptado · recibido ${p.pesoRecibido} kg${p.discrepanciaPct > 5 ? ` (discrepancia ${p.discrepanciaPct}%)` : ''}`,
  traspaso_rechazado: (p) => `Traspaso rechazado · diferencia ${p.discrepanciaPct?.toFixed ? p.discrepanciaPct.toFixed(1) : p.discrepanciaPct}%`,
  division: (p) => `Dividido en ${p.hijos.map((h) => h.codigo).join(' + ')} · merma ${p.merma} kg`,
  mezcla: (p) => `Mezclado desde ${p.origenes.map((o) => o.codigo).join(' + ')} → ${p.pesoTotal} kg`,
  cerrado_por_mezcla: (p) => `Cerrado: fusionado en ${p.nuevoLoteCodigo}`,
};

export default function Historial() {
  const { loteId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.historial(loteId).then(setData).catch(() => {});
  }, [loteId]);

  if (!data) return <PhoneLayout title="Cargando…" />;

  const { lote, timeline } = data;

  return (
    <PhoneLayout title={`Historial · ${lote.codigo}`} subtitle={`${lote.pesoActual || lote.pesoInicial} kg · ${lote.rutaAprovechamiento || 'sin clasificar'}`}>
      <div>
        {timeline.map((ev, i) => (
          <div className="timeline-item" key={ev.id}>
            <div className="timeline-dot-col">
              <div className="timeline-dot" />
              {i < timeline.length - 1 && <div className="timeline-line" />}
            </div>
            <div className="timeline-text">
              <h4>{ev.loteCodigo} · {LABELS[ev.tipo] ? LABELS[ev.tipo](ev.payload) : ev.tipo}</h4>
              <p>{ev.actorNombre} · {new Date(ev.createdAt).toLocaleString('es-CO')}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card muted">
        <strong style={{ fontSize: 12.5 }}>Trazabilidad append-only</strong>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          Ningún evento se edita ni se elimina. Una corrección se registra como un nuevo evento que referencia al original.
        </span>
      </div>

      <div className="spacer" />
      <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
        Ver panel de indicadores (rol Entidad)
      </button>
    </PhoneLayout>
  );
}
