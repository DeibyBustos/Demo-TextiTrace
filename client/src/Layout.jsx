import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRole } from './RoleContext.jsx';

export function PhoneLayout({ title, subtitle, children }) {
  const { rol, ROLES } = useRole();
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <div className="topbar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {rol && (
            <button className="linklike" onClick={() => navigate('/')} style={{ fontSize: 11 }}>
              {ROLES[rol].label} · cambiar
            </button>
          )}
        </div>
      </div>
      <div className="content">{children}</div>
    </div>
  );
}

export function DashboardLayout({ children }) {
  const navigate = useNavigate();
  return (
    <div className="app-shell wide">
      <div className="topnav">
        <div>
          <h1>Panel de indicadores</h1>
          <p>TextiTrace · Vista de solo lectura · Rol: Entidad (SDA / ANDI)</p>
        </div>
        <button className="linklike" onClick={() => navigate('/')}>Cambiar rol</button>
      </div>
      <div className="dash-body">{children}</div>
    </div>
  );
}
