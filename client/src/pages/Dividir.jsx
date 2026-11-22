import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PhoneLayout } from '../Layout.jsx';
import { useRole } from '../RoleContext.jsx';
import { api } from '../lib/api.js';

export default function Dividir() {
  const { loteId } = useParams();
  const navigate = useNavigate();
  const { nombre } = useRole();
  const [lote, setLote] = useState(null);
  const [pesoA, setPesoA] = useState('');
  const [pesoB, setPesoB] = useState('');
  const [merma, setMerma] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getLote(loteId).then(setLote).catch(() => {});
  }, [loteId]);

  if (!lote) return <PhoneLayout title="Cargando…" />;

  const a = Number(pesoA) || 0;
  const b = Number(pesoB) || 0;
  const m = Number(merma) || 0;
  const suma = a + b + m;
  const balanceOk = Math.abs(suma - lote.pesoActual) < 0.01 && a > 0 && b > 0;
  const intentoValido = pesoA !== '' && pesoB !== '';

  async function confirmar() {
    setLoading(true);
    setError(null);
    try {
      await api.dividir(loteId, { hijos: [{ peso: a }, { peso: b }], merma: m, actorNombre: nombre });
      navigate('/mezclar');
    } catch (e) {
      setError(e.data?.mensaje || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PhoneLayout title="Dividir lote" subtitle={`${lote.codigo} · ${lote.pesoActual} kg disponibles`}>
      <div className="field">
        <label>Lote hijo A (peso)</label>
        <input type="number" step="0.1" value={pesoA} onChange={(e) => setPesoA(e.target.value)} />
      </div>
      <div className="field">
        <label>Lote hijo B (peso)</label>
        <input type="number" step="0.1" value={pesoB} onChange={(e) => setPesoB(e.target.value)} />
      </div>
      <div className="field">
        <label>Merma / pérdida de proceso</label>
        <input type="number" step="0.1" value={merma} onChange={(e) => setMerma(e.target.value)} />
      </div>

      {intentoValido && (
        balanceOk ? (
          <div className="card soft">
            <div className="kv"><span className="label">Suma hijos + merma</span><span className="value">{a} + {b} + {m} = {suma.toFixed(2)} kg</span></div>
            <div className="kv"><span className="label">Peso del lote original</span><span className="value">{lote.pesoActual} kg</span></div>
            <strong style={{ color: 'var(--accent-dark)', fontSize: 12.5 }}>✔ Balance de masa correcto</strong>
          </div>
        ) : (
          <div className="error-box">
            <span>⚠</span>
            <div>
              <strong>División rechazada</strong>
              <span>{a} + {b} + {m} = {suma.toFixed(2)} kg ≠ {lote.pesoActual} kg. El sistema no permite registrar lotes hijos cuya suma no coincida con el lote original.</span>
            </div>
          </div>
        )
      )}
      {error && <div className="error-box"><span>⚠</span><div><strong>El servidor rechazó la división</strong><span>{error}</span></div></div>}

      <div className="spacer" />
      <button className="btn btn-primary" onClick={confirmar} disabled={!balanceOk || loading}>
        {loading ? 'Confirmando…' : `Confirmar división${balanceOk ? ` → crea 2 lotes nuevos` : ''}`}
      </button>
    </PhoneLayout>
  );
}
