// Coordenadas aproximadas de los puntos de recolección (Bogotá) y categorías exportables.
// Si se agrega un punto nuevo en CrearEntrega.jsx, hay que agregar aquí sus coordenadas
// para que aparezca en el mapa (si no, se exporta con geometría nula).

export const PUNTOS = {
  'RenovaModa Chapinero': { lat: 4.6486, lng: -74.0628, localidad: 'Chapinero' },
  'RenovaModa Kennedy': { lat: 4.6280, lng: -74.1469, localidad: 'Kennedy' },
  'Manos Reparadoras Suba': { lat: 4.7411, lng: -74.0840, localidad: 'Suba' },
};

// key = propiedad del lote serializado
export const CATEGORIAS = [
  { key: 'material', label: 'Material' },
  { key: 'rutaAprovechamiento', label: 'Ruta de aprovechamiento' },
  { key: 'puntoOrigen', label: 'Punto de recolección' },
  { key: 'estadoLote', label: 'Estado del lote' },
  { key: 'estadoPrenda', label: 'Estado de la prenda' },
];

export const COLUMNAS = [
  'codigo', 'material', 'estadoPrenda', 'pesoInicial', 'pesoActual', 'puntoOrigen', 'localidad',
  'rutaAprovechamiento', 'estadoLote', 'responsableRol', 'responsableNombre', 'createdAt', 'lat', 'lng',
];

export function conUbicacion(lote) {
  const p = PUNTOS[lote.puntoOrigen];
  return { ...lote, localidad: p?.localidad ?? null, lat: p?.lat ?? null, lng: p?.lng ?? null };
}
