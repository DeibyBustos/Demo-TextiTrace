import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../Layout.jsx';
import { api } from '../lib/api.js';
import { Link } from 'react-router-dom';
import DescargaDatos from '../components/DescargaDatos.jsx';

export default function Dashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.dashboard().then(setD).catch(() => {});
    const id = setInterval(() => api.dashboard().then(setD).catch(() => {}), 5000);
    return () => clearInterval(id);
  }, []);

  if (!d) return <DashboardLayout>Cargando…</DashboardLayout>;

  const maxRuta = Math.max(...d.porRuta.map((r) => r.pct), 1);
  const maxPunto = Math.max(...d.porPunto.map((p) => p.kg), 1);

  return (
    <DashboardLayout>
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="label">Kg recolectados</span>
          <span className="value">{d.kgRecolectados.toLocaleString('es-CO')} kg</span>
          <span className="sub">{d.totalLotes} lotes registrados</span>
        </div>
        <div className="kpi-card">
          <span className="label">Kg clasificados</span>
          <span className="value">{d.kgClasificados.toLocaleString('es-CO')} kg</span>
          <span className="sub">{d.pctClasificados}% del total activo</span>
        </div>
        <div className="kpi-card">
          <span className="label">Lotes sin destino</span>
          <span className="value">{d.lotesSinDestino} lotes</span>
          <span className="sub">pendientes de traspaso</span>
        </div>
        <div className="kpi-card">
          <span className="label">Alertas de discrepancia</span>
          <span className="value">{d.alertasDiscrepancia} casos</span>
          <span className="sub">&gt; 5% de diferencia en peso</span>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <strong>% por ruta de aprovechamiento</strong>
          {d.porRuta.map((r) => (
            <div className="bar-row" key={r.ruta}>
              <div className="bar-row-top"><span>{r.ruta}</span><strong style={{ color: 'var(--accent-dark)' }}>{r.pct}%</strong></div>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.pct / maxRuta) * 100}%` }} /></div>
            </div>
          ))}
          {d.porRuta.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Aún no hay lotes clasificados.</span>}
        </div>
        <div className="panel">
          <strong>Kg por punto de recolección</strong>
          {d.porPunto.map((p) => (
            <div className="pt-row" key={p.punto}><span>{p.punto}</span><strong>{p.kg} kg</strong></div>
          ))}
          {d.porPunto.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Sin datos todavía.</span>}
          <Link className="btn btn-secondary" to="/dashboard/mapa" style={{ marginTop: 'auto', textAlign: 'center', textDecoration: 'none' }}>
            Ver en el mapa
          </Link>
        </div>
      </div>

      <DescargaDatos />
    </DashboardLayout>
  );
}
