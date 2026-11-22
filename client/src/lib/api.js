async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.mensaje || data.error || 'Error de red');
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  crearLote: (body) => request('/lotes', { method: 'POST', body: JSON.stringify(body) }),
  listarLotes: () => request('/lotes'),
  getLote: (id) => request(`/lotes/${id}`),
  clasificar: (id, body) => request(`/lotes/${id}/clasificar`, { method: 'POST', body: JSON.stringify(body) }),
  enviarTraspaso: (id, body) => request(`/lotes/${id}/traspaso/enviar`, { method: 'POST', body: JSON.stringify(body) }),
  listarTraspasos: (estado) => request(`/traspasos${estado ? `?estado=${estado}` : ''}`),
  getTraspaso: (id) => request(`/traspasos/${id}`),
  resolverTraspaso: (id, body) => request(`/traspasos/${id}/resolver`, { method: 'POST', body: JSON.stringify(body) }),
  dividir: (id, body) => request(`/lotes/${id}/dividir`, { method: 'POST', body: JSON.stringify(body) }),
  mezclar: (body) => request('/lotes/mezclar', { method: 'POST', body: JSON.stringify(body) }),
  historial: (id) => request(`/lotes/${id}/historial`),
  dashboard: () => request('/dashboard'),
};
