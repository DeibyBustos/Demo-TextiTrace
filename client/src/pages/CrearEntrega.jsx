import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneLayout } from '../Layout.jsx';
import { useRole } from '../RoleContext.jsx';
import { api } from '../lib/api.js';

const MATERIALES = ['Algodón', 'Poliéster', 'Mezcla sintética', 'Denim', 'Lana'];
const ESTADOS = ['Usada - buen estado', 'Usada - desgastada', 'Nueva con defecto', 'No reutilizable'];

export default function CrearEntrega() {
  const { nombre } = useRole();
  const navigate = useNavigate();
  const [material, setMaterial] = useState('Algodón');
  const [estadoPrenda, setEstadoPrenda] = useState('Usada - buen estado');
  const [peso, setPeso] = useState('100');
  const [puntoOrigen, setPuntoOrigen] = useState('RenovaModa Chapinero');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function generar() {
    setLoading(true);
    setError(null);
    try {
      const lote = await api.crearLote({
        material, estadoPrenda, peso: Number(peso), puntoOrigen, responsableNombre: nombre,
      });
      navigate(`/operador/qr/${lote.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PhoneLayout title="Nueva entrega" subtitle={nombre}>
      <div className="field">
        <label>Tipo de material</label>
        <select value={material} onChange={(e) => setMaterial(e.target.value)}>
          {MATERIALES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Estado de la prenda</label>
        <div className="chips">
          {ESTADOS.map((e) => (
            <button
              key={e}
              type="button"
              className={`chip ${estadoPrenda === e ? 'active' : ''}`}
              onClick={() => setEstadoPrenda(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Peso (kg)</label>
        <input type="number" min="0.1" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} />
      </div>
      <div className="field">
        <label>Punto de recolección</label>
        <select value={puntoOrigen} onChange={(e) => setPuntoOrigen(e.target.value)}>
          <option>RenovaModa Chapinero</option>
          <option>RenovaModa Kennedy</option>
          <option>Manos Reparadoras Suba</option>
        </select>
      </div>
      {error && (
        <div className="error-box"><span>⚠</span><div><strong>No se pudo crear la entrega</strong><span>{error}</span></div></div>
      )}
      <div className="spacer" />
      <button className="btn btn-primary" onClick={generar} disabled={loading}>
        {loading ? 'Generando…' : 'Generar lote y QR'}
      </button>
    </PhoneLayout>
  );
}
