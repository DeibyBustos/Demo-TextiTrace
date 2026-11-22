import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { PhoneLayout } from '../Layout.jsx';
import { api } from '../lib/api.js';

export default function QRGenerado() {
  const { loteId } = useParams();
  const navigate = useNavigate();
  const [lote, setLote] = useState(null);

  useEffect(() => {
    api.getLote(loteId).then(setLote).catch(() => {});
  }, [loteId]);

  if (!lote) return <PhoneLayout title="Generando QR…" />;

  const qrValue = `textitrace://lote/${lote.codigo}`;

  function descargar() {
    const svg = document.getElementById('qr-svg');
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lote.codigo}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PhoneLayout title="Lote generado" subtitle={`${lote.codigo} · ${lote.pesoInicial} kg`}>
      <div className="qr-wrap">
        <QRCodeSVG id="qr-svg" value={qrValue} size={200} fgColor="#1F2A22" />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700 }}>{lote.codigo} · {lote.pesoInicial} kg</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{lote.material} · {lote.puntoOrigen}</div>
        </div>
      </div>
      <div className="spacer" />
      <button className="btn btn-secondary" onClick={descargar}>Descargar QR</button>
      <button className="btn btn-primary" onClick={() => navigate(`/operador/escanear/${lote.id}`)}>
        Continuar: escanear y registrar evento
      </button>
    </PhoneLayout>
  );
}
