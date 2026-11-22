import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { RoleProvider } from './RoleContext.jsx';
import RoleSelect from './pages/RoleSelect.jsx';
import CrearEntrega from './pages/CrearEntrega.jsx';
import QRGenerado from './pages/QRGenerado.jsx';
import Escanear from './pages/Escanear.jsx';
import TraspasoPaso1 from './pages/TraspasoPaso1.jsx';
import GestorHome from './pages/GestorHome.jsx';
import TraspasoPaso2 from './pages/TraspasoPaso2.jsx';
import Dividir from './pages/Dividir.jsx';
import Mezclar from './pages/Mezclar.jsx';
import Historial from './pages/Historial.jsx';
import Dashboard from './pages/Dashboard.jsx';

export default function App() {
  return (
    <RoleProvider>
      <Routes>
        <Route path="/" element={<RoleSelect />} />
        <Route path="/operador/crear" element={<CrearEntrega />} />
        <Route path="/operador/qr/:loteId" element={<QRGenerado />} />
        <Route path="/operador/escanear/:loteId" element={<Escanear />} />
        <Route path="/traspaso/:loteId/enviar" element={<TraspasoPaso1 />} />
        <Route path="/dashboard-gestor" element={<GestorHome />} />
        <Route path="/traspaso/:traspasoId/aceptar" element={<TraspasoPaso2 />} />
        <Route path="/lotes/:loteId/dividir" element={<Dividir />} />
        <Route path="/mezclar" element={<Mezclar />} />
        <Route path="/lotes/:loteId/historial" element={<Historial />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </RoleProvider>
  );
}
