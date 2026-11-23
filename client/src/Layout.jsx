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

export function DashboardLayout({ children, title = 'Panel de indicadores', subtitle, back, actions }) {
  const navigate = useNavigate();
  return (
    <div className="app-shell wide">
      <div className="topnav">
        <div>
          <h1>{title}</h1>
          <p>{subtitle || 'TextiTrace · Vista de solo lectura · Rol: Entidad (SDA / ANDI)'}</p>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {actions}
          {back && <button className="linklike" onClick={() => navigate(back)}>← Volver al panel</button>}
          <button className="linklike" onClick={() => navigate('/')}>Cambiar rol</button>
        </div>
      </div>
      <div className="dash-body">{children}</div>
    </div>
  );
}
