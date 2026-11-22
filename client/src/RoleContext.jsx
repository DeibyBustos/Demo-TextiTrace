import React, { createContext, useContext, useState } from 'react';

const RoleContext = createContext(null);

const ROLES = {
  operador: { label: 'Operador', nombreDefault: 'Operador · RenovaModa Chapinero' },
  gestor: { label: 'Gestor', nombreDefault: 'Gestor · Centro de Acopio El Rosal' },
  entidad: { label: 'Entidad (solo lectura)', nombreDefault: 'SDA / ANDI' },
};

export function RoleProvider({ children }) {
  const [rol, setRol] = useState(null);
  const [nombre, setNombre] = useState('');

  function elegirRol(key) {
    setRol(key);
    setNombre(ROLES[key].nombreDefault);
  }

  return (
    <RoleContext.Provider value={{ rol, nombre, elegirRol, ROLES }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}

export { ROLES };
