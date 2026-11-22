import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../RoleContext.jsx';

export default function RoleSelect() {
  const { elegirRol } = useRole();
  const navigate = useNavigate();

  function go(key) {
    elegirRol(key);
    if (key === 'operador') navigate('/operador/crear');
    else if (key === 'gestor') navigate('/dashboard-gestor');
    else navigate('/dashboard');
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <h1>TextiTrace</h1>
        <p>Selecciona tu rol para continuar</p>
      </div>
      <div className="content">
        <button className="role-card" onClick={() => go('operador')}>
          <h3>Operador</h3>
          <p>Registra entregas en un punto de RenovaModa o Manos Reparadoras y escanea lotes para clasificarlos.</p>
        </button>
        <button className="role-card" onClick={() => go('gestor')}>
          <h3>Gestor</h3>
          <p>Recibe traspasos, divide lotes en sub-lotes y mezcla lotes con la misma ruta de aprovechamiento.</p>
        </button>
        <button className="role-card" onClick={() => go('entidad')}>
          <h3>Entidad (solo lectura)</h3>
          <p>SDA / ANDI: consulta el panel de indicadores agregados de todo el sistema.</p>
        </button>
      </div>
    </div>
  );
}
