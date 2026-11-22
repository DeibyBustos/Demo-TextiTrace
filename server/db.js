// Capa de datos: SQLite embebido (node:sqlite, built-in desde Node 22.5).
// Un solo archivo de base de datos, sin servicios externos ni dependencias nativas que compilar.
// Modelo "append-only": la tabla eventos nunca se actualiza ni se borra; una corrección
// se registra como un nuevo evento que referencia al evento original (correction_of).

import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'textitrace.sqlite');

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS lotes (
    id TEXT PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    material TEXT NOT NULL,
    estado_prenda TEXT,
    peso_inicial REAL NOT NULL,
    peso_actual REAL NOT NULL,
    punto_origen TEXT NOT NULL,
    ruta_aprovechamiento TEXT,
    responsable_rol TEXT NOT NULL,
    responsable_nombre TEXT NOT NULL,
    estado_lote TEXT NOT NULL DEFAULT 'creado',
    parent_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS eventos (
    id TEXT PRIMARY KEY,
    lote_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    actor_rol TEXT,
    actor_nombre TEXT,
    correction_of TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (lote_id) REFERENCES lotes(id)
  );

  CREATE TABLE IF NOT EXISTS traspasos (
    id TEXT PRIMARY KEY,
    lote_id TEXT NOT NULL,
    emisor_rol TEXT NOT NULL,
    emisor_nombre TEXT NOT NULL,
    destinatario_rol TEXT NOT NULL,
    destinatario_nombre TEXT NOT NULL,
    peso_enviado REAL NOT NULL,
    peso_recibido REAL,
    discrepancia_pct REAL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    created_at TEXT NOT NULL,
    resuelto_at TEXT,
    FOREIGN KEY (lote_id) REFERENCES lotes(id)
  );

  CREATE TABLE IF NOT EXISTS counters (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );
`);

export function nextCode() {
  const row = db.prepare(`SELECT value FROM counters WHERE name = 'lote'`).get();
  const next = row ? row.value + 1 : 1;
  if (row) {
    db.prepare(`UPDATE counters SET value = ? WHERE name = 'lote'`).run(next);
  } else {
    db.prepare(`INSERT INTO counters (name, value) VALUES ('lote', ?)`).run(next);
  }
  return `L-${String(next).padStart(3, '0')}`;
}

export function uuid() {
  return randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export function logEvento({ loteId, tipo, payload = {}, actorRol, actorNombre, correctionOf = null }) {
  const id = uuid();
  db.prepare(`
    INSERT INTO eventos (id, lote_id, tipo, payload, actor_rol, actor_nombre, correction_of, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, loteId, tipo, JSON.stringify(payload), actorRol || null, actorNombre || null, correctionOf, nowIso());
  return id;
}

export function getLote(id) {
  return db.prepare(`SELECT * FROM lotes WHERE id = ?`).get(id);
}

export function getLoteByCodigo(codigo) {
  return db.prepare(`SELECT * FROM lotes WHERE codigo = ?`).get(codigo);
}

export function listLotes() {
  return db.prepare(`SELECT * FROM lotes ORDER BY created_at DESC`).all();
}

export function getEventosDeLote(loteId) {
  return db.prepare(`SELECT * FROM eventos WHERE lote_id = ? ORDER BY created_at ASC`).all(loteId);
}
