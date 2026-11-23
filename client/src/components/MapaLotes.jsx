import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const BOGOTA = [4.6797, -74.0937];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const kgFmt = (n) => `${Number(n.toFixed(1)).toLocaleString('es-CO')} kg`;

// puntos: salida de agregarPorPunto; colores: { valor: '#hex' };
// seleccionado: { punto, n } — n cambia en cada clic para poder re-enfocar el mismo punto
export default function MapaLotes({ puntos, colores, seleccionado }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const capaRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    const map = L.map(divRef.current, { center: BOGOTA, zoom: 11, scrollWheelZoom: true });
    // Teselas estándar de OpenStreetMap: no requieren API key (uso ligero, con atribución obligatoria).
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    capaRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    const capa = capaRef.current;
    capa.clearLayers();
    markersRef.current = {};
    const maxKg = Math.max(...puntos.map((p) => p.kg), 1);

    puntos.forEach((p) => {
      const color = colores[p.dominante] || '#5C6B61';
      const radio = 10 + 22 * Math.sqrt(p.kg / maxKg);
      const filas = Object.entries(p.desglose).sort((a, b) => b[1] - a[1]).map(([v, kg]) => (
        `<div class="pop-row"><span><i style="background:${colores[v] || '#5C6B61'}"></i>${esc(v)}</span><b>${kgFmt(kg)}</b></div>`
      )).join('');
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: radio, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.85,
      }).bindPopup(
        `<div class="pop"><strong>${esc(p.punto)}</strong><span class="pop-sub">${esc(p.localidad || '')} · ${p.lotes} lote(s) · ${kgFmt(p.kg)}</span>${filas}</div>`,
      ).bindTooltip(`${esc(p.punto)} · ${kgFmt(p.kg)}`, { direction: 'top', offset: [0, -radio] });
      marker.addTo(capa);
      markersRef.current[p.punto] = marker;
    });

    if (puntos.length) {
      mapRef.current.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng])).pad(0.3), { maxZoom: 13 });
    }
  }, [puntos, colores]);

  useEffect(() => {
    const m = markersRef.current[seleccionado?.punto];
    if (m) {
      mapRef.current.flyTo(m.getLatLng(), 14, { duration: 0.6 });
      m.openPopup();
    }
  }, [seleccionado]);

  return <div ref={divRef} className="mapa" />;
}
