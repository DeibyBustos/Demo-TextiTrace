import { Router } from 'express';
import {
  db, nextCode, uuid, nowIso, logEvento,
  getLote, getLoteByCodigo, listLotes, getEventosDeLote
} from './db.js';

export const router = Router();

const DISCREPANCIA_UMBRAL_PCT = 5;
const TOLERANCIA_KG = 0.01;

function serializeLote(l) {
  if (!l) return null;
  return {
    id: l.id,
    codigo: l.codigo,
    material: l.material,
    estadoPrenda: l.estado_prenda,
    pesoInicial: l.peso_inicial,
    pesoActual: l.peso_actual,
    puntoOrigen: l.punto_origen,
    rutaAprovechamiento: l.ruta_aprovechamiento,
    responsableRol: l.responsable_rol,
    responsableNombre: l.responsable_nombre,
    estadoLote: l.estado_lote,
    parentIds: JSON.parse(l.parent_ids || '[]'),
    createdAt: l.created_at,
  };
}

function serializeEvento(e) {
  return {
    id: e.id,
    loteId: e.lote_id,
    tipo: e.tipo,
    payload: JSON.parse(e.payload || '{}'),
    actorRol: e.actor_rol,
    actorNombre: e.actor_nombre,
    correctionOf: e.correction_of,
    createdAt: e.created_at,
  };
}

function serializeTraspaso(t) {
  if (!t) return null;
  return {
    id: t.id,
    loteId: t.lote_id,
    emisorRol: t.emisor_rol,
    emisorNombre: t.emisor_nombre,
    destinatarioRol: t.destinatario_rol,
    destinatarioNombre: t.destinatario_nombre,
    pesoEnviado: t.peso_enviado,
    pesoRecibido: t.peso_recibido,
    discrepanciaPct: t.discrepancia_pct,
    estado: t.estado,
    createdAt: t.created_at,
    resueltoAt: t.resuelto_at,
  };
}

// ---------- Lotes ----------

// Crear entrega (operador)
router.post('/lotes', (req, res) => {
  const { material, estadoPrenda, peso, puntoOrigen, responsableNombre } = req.body;
  if (!material || !peso || !puntoOrigen) {
    return res.status(400).json({ error: 'material, peso y puntoOrigen son obligatorios' });
  }
  const pesoNum = Number(peso);
  if (!(pesoNum > 0)) return res.status(400).json({ error: 'peso debe ser mayor a 0' });

  const id = uuid();
  const codigo = nextCode();
  const createdAt = nowIso();
  db.prepare(`
    INSERT INTO lotes (id, codigo, material, estado_prenda, peso_inicial, peso_actual, punto_origen,
                        ruta_aprovechamiento, responsable_rol, responsable_nombre, estado_lote, parent_ids, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'operador', ?, 'creado', '[]', ?)
  `).run(id, codigo, material, estadoPrenda || null, pesoNum, pesoNum, puntoOrigen, responsableNombre || 'Operador', createdAt);

  logEvento({
    loteId: id,
    tipo: 'creacion',
    payload: { material, estadoPrenda, peso: pesoNum, puntoOrigen },
    actorRol: 'operador',
    actorNombre: responsableNombre || 'Operador',
  });

  res.status(201).json(serializeLote(getLote(id)));
});

router.get('/lotes', (_req, res) => {
  res.json(listLotes().map(serializeLote));
});

router.get('/lotes/:id', (req, res) => {
  const lote = getLote(req.params.id) || getLoteByCodigo(req.params.id);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
  res.json(serializeLote(lote));
});

// Clasificar (escanear -> asignar ruta de aprovechamiento)
router.post('/lotes/:id/clasificar', (req, res) => {
  const lote = getLote(req.params.id);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
  const { rutaAprovechamiento, actorNombre } = req.body;
  if (!rutaAprovechamiento) return res.status(400).json({ error: 'rutaAprovechamiento es obligatoria' });

  db.prepare(`UPDATE lotes SET ruta_aprovechamiento = ?, estado_lote = 'clasificado' WHERE id = ?`)
    .run(rutaAprovechamiento, lote.id);

  logEvento({
    loteId: lote.id,
    tipo: 'clasificacion',
    payload: { rutaAprovechamiento },
    actorRol: 'operador',
    actorNombre: actorNombre || lote.responsable_nombre,
  });

  res.json(serializeLote(getLote(lote.id)));
});

// ---------- Traspasos (paso 1: emisor envía) ----------

router.post('/lotes/:id/traspaso/enviar', (req, res) => {
  const lote = getLote(req.params.id);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
  if (lote.estado_lote === 'en_transito') {
    return res.status(409).json({ error: 'El lote ya está en tránsito' });
  }
  const { destinatarioRol, destinatarioNombre, pesoEnviado, emisorNombre } = req.body;
  if (!destinatarioRol || !destinatarioNombre || !pesoEnviado) {
    return res.status(400).json({ error: 'destinatarioRol, destinatarioNombre y pesoEnviado son obligatorios' });
  }

  const traspasoId = uuid();
  const createdAt = nowIso();
  db.prepare(`
    INSERT INTO traspasos (id, lote_id, emisor_rol, emisor_nombre, destinatario_rol, destinatario_nombre,
                            peso_enviado, estado, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)
  `).run(traspasoId, lote.id, lote.responsable_rol, emisorNombre || lote.responsable_nombre,
    destinatarioRol, destinatarioNombre, Number(pesoEnviado), createdAt);

  db.prepare(`UPDATE lotes SET estado_lote = 'en_transito' WHERE id = ?`).run(lote.id);

  logEvento({
    loteId: lote.id,
    tipo: 'traspaso_enviado',
    payload: { traspasoId, destinatarioRol, destinatarioNombre, pesoEnviado: Number(pesoEnviado) },
    actorRol: lote.responsable_rol,
    actorNombre: emisorNombre || lote.responsable_nombre,
  });

  res.status(201).json(serializeTraspaso(db.prepare(`SELECT * FROM traspasos WHERE id = ?`).get(traspasoId)));
});

router.get('/traspasos', (req, res) => {
  const { estado } = req.query;
  let rows = db.prepare(`SELECT * FROM traspasos ORDER BY created_at DESC`).all();
  if (estado) rows = rows.filter((t) => t.estado === estado);
  const withLote = rows.map((t) => ({ ...serializeTraspaso(t), lote: serializeLote(getLote(t.lote_id)) }));
  res.json(withLote);
});

router.get('/traspasos/:id', (req, res) => {
  const t = db.prepare(`SELECT * FROM traspasos WHERE id = ?`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Traspaso no encontrado' });
  res.json(serializeTraspaso(t));
});

// ---------- Traspasos (paso 2: receptor acepta/rechaza) ----------
// accion: 'aceptar' | 'aceptar_con_observacion' | 'rechazar'
// Si la discrepancia > 5% y accion === 'aceptar', se rechaza la petición (409) exigiendo
// que el front muestre la alerta y el usuario elija explícitamente 'aceptar_con_observacion' o 'rechazar'.
router.post('/traspasos/:id/resolver', (req, res) => {
  const t = db.prepare(`SELECT * FROM traspasos WHERE id = ?`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Traspaso no encontrado' });
  if (t.estado !== 'pendiente') return res.status(409).json({ error: 'Este traspaso ya fue resuelto' });

  const { pesoRecibido, accion = 'aceptar', actorNombre } = req.body;
  if (pesoRecibido === undefined || pesoRecibido === null) {
    return res.status(400).json({ error: 'pesoRecibido es obligatorio' });
  }
  const pesoRecibidoNum = Number(pesoRecibido);
  const discrepanciaPct = Math.abs(pesoRecibidoNum - t.peso_enviado) / t.peso_enviado * 100;
  const lote = getLote(t.lote_id);
  const resuelto_at = nowIso();

  if (discrepanciaPct > DISCREPANCIA_UMBRAL_PCT && accion === 'aceptar') {
    return res.status(409).json({
      error: 'discrepancia_requiere_decision',
      discrepanciaPct: Number(discrepanciaPct.toFixed(2)),
      mensaje: `Diferencia de ${discrepanciaPct.toFixed(1)}% (> ${DISCREPANCIA_UMBRAL_PCT}%). Se requiere "aceptar_con_observacion" o "rechazar".`,
    });
  }

  if (accion === 'rechazar') {
    db.prepare(`UPDATE traspasos SET estado = 'rechazado', peso_recibido = ?, discrepancia_pct = ?, resuelto_at = ? WHERE id = ?`)
      .run(pesoRecibidoNum, discrepanciaPct, resuelto_at, t.id);
    db.prepare(`UPDATE lotes SET estado_lote = 'clasificado' WHERE id = ?`).run(lote.id);
    logEvento({
      loteId: lote.id,
      tipo: 'traspaso_rechazado',
      payload: { traspasoId: t.id, pesoEnviado: t.peso_enviado, pesoRecibido: pesoRecibidoNum, discrepanciaPct },
      actorRol: t.destinatario_rol,
      actorNombre: actorNombre || t.destinatario_nombre,
    });
    return res.json(serializeTraspaso(db.prepare(`SELECT * FROM traspasos WHERE id = ?`).get(t.id)));
  }

  // aceptar | aceptar_con_observacion
  db.prepare(`UPDATE traspasos SET estado = 'aceptado', peso_recibido = ?, discrepancia_pct = ?, resuelto_at = ? WHERE id = ?`)
    .run(pesoRecibidoNum, discrepanciaPct, resuelto_at, t.id);
  db.prepare(`
    UPDATE lotes SET peso_actual = ?, responsable_rol = ?, responsable_nombre = ?,
                      estado_lote = ? WHERE id = ?
  `).run(pesoRecibidoNum, t.destinatario_rol, t.destinatario_nombre,
    lote.ruta_aprovechamiento ? 'clasificado' : 'creado', lote.id);

  logEvento({
    loteId: lote.id,
    tipo: 'traspaso_aceptado',
    payload: {
      traspasoId: t.id, pesoEnviado: t.peso_enviado, pesoRecibido: pesoRecibidoNum,
      discrepanciaPct: Number(discrepanciaPct.toFixed(2)), conObservacion: accion === 'aceptar_con_observacion',
    },
    actorRol: t.destinatario_rol,
    actorNombre: actorNombre || t.destinatario_nombre,
  });

  res.json(serializeTraspaso(db.prepare(`SELECT * FROM traspasos WHERE id = ?`).get(t.id)));
});

// ---------- Dividir lote ----------
// Rechaza (400) si la suma de hijos + merma no coincide (con tolerancia) con el peso actual del lote.
router.post('/lotes/:id/dividir', (req, res) => {
  const lote = getLote(req.params.id);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
  const { hijos, merma = 0, actorNombre } = req.body;
  if (!Array.isArray(hijos) || hijos.length < 2) {
    return res.status(400).json({ error: 'Se requieren al menos 2 lotes hijos' });
  }
  const pesosHijos = hijos.map((h) => Number(h.peso));
  if (pesosHijos.some((p) => !(p > 0))) {
    return res.status(400).json({ error: 'Cada lote hijo debe tener un peso mayor a 0' });
  }
  const mermaNum = Number(merma) || 0;
  const sumaTotal = pesosHijos.reduce((a, b) => a + b, 0) + mermaNum;
  const esperado = lote.peso_actual;

  if (Math.abs(sumaTotal - esperado) > TOLERANCIA_KG) {
    return res.status(400).json({
      error: 'balance_de_masa_invalido',
      mensaje: `La suma de los lotes hijos y la merma (${sumaTotal} kg) no coincide con el peso del lote original (${esperado} kg).`,
      sumaTotal,
      esperado,
    });
  }

  const createdAt = nowIso();
  const hijosCreados = pesosHijos.map((peso) => {
    const id = uuid();
    const codigo = nextCode();
    db.prepare(`
      INSERT INTO lotes (id, codigo, material, estado_prenda, peso_inicial, peso_actual, punto_origen,
                          ruta_aprovechamiento, responsable_rol, responsable_nombre, estado_lote, parent_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'clasificado', ?, ?)
    `).run(id, codigo, lote.material, lote.estado_prenda, peso, peso, lote.punto_origen,
      lote.ruta_aprovechamiento, lote.responsable_rol, lote.responsable_nombre,
      JSON.stringify([lote.id]), createdAt);
    logEvento({
      loteId: id,
      tipo: 'creacion_por_division',
      payload: { loteOrigenId: lote.id, loteOrigenCodigo: lote.codigo, peso },
      actorRol: lote.responsable_rol,
      actorNombre: actorNombre || lote.responsable_nombre,
    });
    return serializeLote(getLote(id));
  });

  db.prepare(`UPDATE lotes SET estado_lote = 'dividido', peso_actual = 0 WHERE id = ?`).run(lote.id);
  logEvento({
    loteId: lote.id,
    tipo: 'division',
    payload: { hijos: hijosCreados.map((h) => ({ id: h.id, codigo: h.codigo, peso: h.pesoActual })), merma: mermaNum },
    actorRol: lote.responsable_rol,
    actorNombre: actorNombre || lote.responsable_nombre,
  });

  res.status(201).json({ loteOrigen: serializeLote(getLote(lote.id)), hijos: hijosCreados });
});

// ---------- Mezclar lotes ----------
// Solo permite mezclar lotes con la misma ruta de aprovechamiento.
router.post('/lotes/mezclar', (req, res) => {
  const { loteIds, actorNombre } = req.body;
  if (!Array.isArray(loteIds) || loteIds.length < 2) {
    return res.status(400).json({ error: 'Se requieren al menos 2 lotes para mezclar' });
  }
  const lotes = loteIds.map((id) => getLote(id));
  if (lotes.some((l) => !l)) return res.status(404).json({ error: 'Alguno de los lotes no existe' });
  if (lotes.some((l) => ['dividido', 'mezclado', 'en_transito'].includes(l.estado_lote))) {
    return res.status(409).json({ error: 'Alguno de los lotes no está disponible para mezclar (ya fue dividido, mezclado o está en tránsito)' });
  }
  const rutas = new Set(lotes.map((l) => l.ruta_aprovechamiento));
  if (rutas.size > 1 || rutas.has(null)) {
    return res.status(400).json({
      error: 'ruta_incompatible',
      mensaje: 'Solo se pueden mezclar lotes con la misma ruta de aprovechamiento (y ya clasificados).',
    });
  }

  const pesoTotal = lotes.reduce((a, l) => a + l.peso_actual, 0);
  const id = uuid();
  const codigo = nextCode();
  const createdAt = nowIso();
  db.prepare(`
    INSERT INTO lotes (id, codigo, material, estado_prenda, peso_inicial, peso_actual, punto_origen,
                        ruta_aprovechamiento, responsable_rol, responsable_nombre, estado_lote, parent_ids, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'clasificado', ?, ?)
  `).run(id, codigo, 'mixto', null, pesoTotal, pesoTotal, lotes[0].punto_origen,
    lotes[0].ruta_aprovechamiento, lotes[0].responsable_rol, lotes[0].responsable_nombre,
    JSON.stringify(lotes.map((l) => l.id)), createdAt);

  logEvento({
    loteId: id,
    tipo: 'mezcla',
    payload: { origenes: lotes.map((l) => ({ id: l.id, codigo: l.codigo, peso: l.peso_actual })), pesoTotal },
    actorRol: lotes[0].responsable_rol,
    actorNombre: actorNombre || lotes[0].responsable_nombre,
  });

  lotes.forEach((l) => {
    db.prepare(`UPDATE lotes SET estado_lote = 'mezclado', peso_actual = 0 WHERE id = ?`).run(l.id);
    logEvento({
      loteId: l.id,
      tipo: 'cerrado_por_mezcla',
      payload: { nuevoLoteId: id, nuevoLoteCodigo: codigo },
      actorRol: lotes[0].responsable_rol,
      actorNombre: actorNombre || lotes[0].responsable_nombre,
    });
  });

  res.status(201).json(serializeLote(getLote(id)));
});

// ---------- Historial / genealogía ----------

function construirHistorial(loteId, visitados = new Set()) {
  if (visitados.has(loteId)) return [];
  visitados.add(loteId);
  const lote = getLote(loteId);
  if (!lote) return [];
  const eventos = getEventosDeLote(loteId).map((e) => ({ ...serializeEvento(e), loteCodigo: lote.codigo }));
  const parentIds = JSON.parse(lote.parent_ids || '[]');
  const ancestros = parentIds.flatMap((pid) => construirHistorial(pid, visitados));
  return [...ancestros, ...eventos];
}

router.get('/lotes/:id/historial', (req, res) => {
  const lote = getLote(req.params.id);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
  const timeline = construirHistorial(lote.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  res.json({ lote: serializeLote(lote), timeline });
});

// ---------- Dashboard (rol Entidad, solo lectura) ----------

router.get('/dashboard', (_req, res) => {
  const lotes = listLotes().map(serializeLote);

  const raiz = lotes.filter((l) => l.parentIds.length === 0);
  const kgRecolectados = raiz.reduce((a, l) => a + l.pesoInicial, 0);

  // Solo lotes "activos" (no consumidos por una división o mezcla posterior) para no
  // contar el mismo kilo dos veces cuando un lote se parte o se une a otro.
  const activos = lotes.filter((l) => !['dividido', 'mezclado'].includes(l.estadoLote));
  const kgClasificados = activos
    .filter((l) => l.rutaAprovechamiento)
    .reduce((a, l) => a + l.pesoActual, 0);
  const lotesSinDestino = activos.filter((l) => ['creado', 'clasificado'].includes(l.estadoLote)).length;

  const traspasos = db.prepare(`SELECT * FROM traspasos`).all().map(serializeTraspaso);
  const alertasDiscrepancia = traspasos.filter((t) => (t.discrepanciaPct || 0) > DISCREPANCIA_UMBRAL_PCT).length;

  const porRutaMap = {};
  activos.filter((l) => l.rutaAprovechamiento).forEach((l) => {
    porRutaMap[l.rutaAprovechamiento] = (porRutaMap[l.rutaAprovechamiento] || 0) + l.pesoActual;
  });
  const totalRuta = Object.values(porRutaMap).reduce((a, b) => a + b, 0) || 1;
  const porRuta = Object.entries(porRutaMap).map(([ruta, kg]) => ({
    ruta, kg, pct: Number(((kg / totalRuta) * 100).toFixed(1)),
  }));

  const porPuntoMap = {};
  raiz.forEach((l) => {
    porPuntoMap[l.puntoOrigen] = (porPuntoMap[l.puntoOrigen] || 0) + l.pesoInicial;
  });
  const porPunto = Object.entries(porPuntoMap).map(([punto, kg]) => ({ punto, kg }));

  res.json({
    kgRecolectados,
    kgClasificados,
    pctClasificados: kgRecolectados ? Number(((kgClasificados / kgRecolectados) * 100).toFixed(1)) : 0,
    lotesSinDestino,
    alertasDiscrepancia,
    porRuta,
    porPunto,
    totalLotes: lotes.length,
  });
});
