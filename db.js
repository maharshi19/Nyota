/**
 * db.js – SQLite database module for Nyota
 * Manages users table with bcrypt-hashed passwords.
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, './data');
const DB_PATH  = path.join(DATA_DIR, 'nyota.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    email        TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'MCO Case Manager',
    access_level TEXT NOT NULL DEFAULT 'user',
    department   TEXT DEFAULT '',
    initials     TEXT DEFAULT '',
    color        TEXT DEFAULT 'bg-teal-600',
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );
`);

// ─── Seed default admin (only if table is empty) ──────────────────────────────
const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (count === 0) {
  const hash = bcrypt.hashSync('Admin@2024', 10);
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, access_level, department, initials, color)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    crypto.randomUUID(),
    'System Admin',
    'admin@nyota.health',
    hash,
    'Admin',
    'admin',
    'System Administration',
    'SA',
    'bg-slate-700'
  );
  console.log('✅ Default admin created: admin@nyota.health / Admin@2024');
}

  // ─── Seed careforce team members (idempotent) ─────────────────────────────────
  const careforceSeed = [
    { name: 'Maria Rodriguez',  email: 'maria.rodriguez@nyota.health',  role: 'CHW',           accessLevel: 'user',       department: 'Community Health',    initials: 'MR', color: 'bg-teal-600' },
    { name: 'Jane Smith',       email: 'jane.smith@nyota.health',       role: 'Doula',         accessLevel: 'user',       department: 'Continuous Support',  initials: 'JS', color: 'bg-pink-500' },
    { name: 'Dr. Alan Grant',   email: 'alan.grant@nyota.health',       role: 'MD',            accessLevel: 'supervisor', department: 'Clinical Services',   initials: 'AG', color: 'bg-slate-600' },
    { name: 'Elena Fisher',     email: 'elena.fisher@nyota.health',     role: 'Nurse',         accessLevel: 'user',       department: 'Postpartum Care',     initials: 'EF', color: 'bg-emerald-500' },
    { name: 'Sarah Connor',     email: 'sarah.connor@nyota.health',     role: 'CHW',           accessLevel: 'user',       department: 'Community Health',    initials: 'SC', color: 'bg-teal-500' },
    { name: 'Dr. Lisa Park',    email: 'lisa.park@nyota.health',        role: 'Midwife',       accessLevel: 'user',       department: 'Clinical Services',   initials: 'LP', color: 'bg-violet-500' },
    { name: 'James Okafor',     email: 'james.okafor@nyota.health',     role: 'CHW',           accessLevel: 'user',       department: 'Community Health',    initials: 'JO', color: 'bg-cyan-600' },
    { name: 'Priya Nair',       email: 'priya.nair@nyota.health',       role: 'Doula',         accessLevel: 'user',       department: 'Continuous Support',  initials: 'PN', color: 'bg-rose-500' },
    { name: 'Dr. Chen Wei',     email: 'chen.wei@nyota.health',         role: 'OB/GYN Attending', accessLevel: 'supervisor', department: 'Clinical Services', initials: 'CW', color: 'bg-indigo-600' },
    { name: 'Tamara Jenkins',   email: 'tamara.jenkins@nyota.health',   role: 'Charge Nurse',  accessLevel: 'user',       department: 'Labor & Delivery',    initials: 'TJ', color: 'bg-green-600' },
  ];

  const insertCareforce = db.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, password_hash, role, access_level, department, initials, color)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);
  const cfPassword = bcrypt.hashSync('Care@2024', 10);
  for (const m of careforceSeed) {
    insertCareforce.run(crypto.randomUUID(), m.name, m.email, cfPassword, m.role, m.accessLevel, m.department, m.initials, m.color);
  }
  console.log('✅ Careforce seed members ensured');

// ─── Helper: strip sensitive fields for API responses ────────────────────────
function sanitize(u) {
  if (!u) return null;
  return {
    id:          u.id,
    name:        u.name,
    email:       u.email,
    role:        u.role,
    accessLevel: u.access_level,
    department:  u.department || '',
    initials:    u.initials   || '',
    color:       u.color      || 'bg-teal-600',
    isActive:    u.is_active === 1,
    createdAt:   u.created_at,
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────
export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE LOWER(email)=LOWER(?) AND is_active=1').get(email);
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id=? AND is_active=1').get(id);
}

export function getAllUsers() {
  return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(sanitize);
}

export function createUser({ name, email, password, role, accessLevel, department, initials, color }) {
  const id   = crypto.randomUUID();
  const hash = bcrypt.hashSync(password, 10);
  const ini  = initials || name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, access_level, department, initials, color)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(id, name, email.toLowerCase().trim(), hash, role, accessLevel || 'user', department || '', ini, color || 'bg-teal-600');
  return sanitize(getUserById(id));
}

export function updateUser(id, updates) {
  const fields = [];
  const values = [];

  const set = (col, val) => { fields.push(`${col}=?`); values.push(val); };

  if (updates.name      !== undefined) set('name',         updates.name);
  if (updates.email     !== undefined) set('email',        updates.email.toLowerCase().trim());
  if (updates.role      !== undefined) set('role',         updates.role);
  if (updates.accessLevel !== undefined) set('access_level', updates.accessLevel);
  if (updates.department  !== undefined) set('department',   updates.department);
  if (updates.initials    !== undefined) set('initials',     updates.initials);
  if (updates.color       !== undefined) set('color',        updates.color);
  if (updates.isActive    !== undefined) set('is_active',    updates.isActive ? 1 : 0);
  if (updates.password) set('password_hash', bcrypt.hashSync(updates.password, 10));

  if (fields.length === 0) return sanitize(getUserById(id));

  fields.push("updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')");
  values.push(id);

  db.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).run(...values);
  return sanitize(getUserById(id));
}

export function deactivateUser(id) {
  db.prepare("UPDATE users SET is_active=0, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?").run(id);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

export default db;
