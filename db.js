import Database from 'better-sqlite3';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, './data');
const DB_PATH = path.join(DATA_DIR, 'nyota.db');
const USE_POSTGRES = Boolean(process.env.DATABASE_URL || process.env.DB_HOST);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let sqlite = null;
let pool = null;

if (USE_POSTGRES) {
  pool = new Pool(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT) || 5432,
          database: process.env.DB_NAME || 'nyota',
          user: process.env.DB_USER || 'nyota_user',
          password: process.env.DB_PASSWORD,
        }
  );
  console.log('Using PostgreSQL database');
} else {
  sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  console.log('Using local SQLite database');
}

function toIso(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function sqliteNowExpr() {
  return "strftime('%Y-%m-%dT%H:%M:%SZ','now')";
}

function normalizeDbUser(u) {
  if (!u) return null;
  return {
    ...u,
    is_active: u.is_active === true || u.is_active === 1 ? 1 : 0,
    created_at: u.created_at instanceof Date ? toIso(u.created_at) : u.created_at,
    updated_at: u.updated_at instanceof Date ? toIso(u.updated_at) : u.updated_at,
    trial_started_at: u.trial_started_at instanceof Date ? toIso(u.trial_started_at) : u.trial_started_at,
    trial_ends_at: u.trial_ends_at instanceof Date ? toIso(u.trial_ends_at) : u.trial_ends_at,
  };
}

function sanitize(user) {
  const u = normalizeDbUser(user);
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    accessLevel: u.access_level,
    department: u.department || '',
    initials: u.initials || '',
    color: u.color || 'bg-teal-600',
    isActive: u.is_active === 1,
    subscriptionStatus: u.subscription_status || 'active',
    trialStartedAt: u.trial_started_at || null,
    trialEndsAt: u.trial_ends_at || null,
    trialDaysRemaining: getTrialDaysRemaining(u),
    createdAt: u.created_at,
  };
}

export function getTrialDaysRemaining(user) {
  if (!user?.trial_ends_at) return null;
  const msRemaining = new Date(user.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
}

export function isUserTrialExpired(user) {
  if (user?.subscription_status === 'expired' || user?.subscription_status === 'canceled') return true;
  return user?.subscription_status === 'trialing'
    && user.trial_ends_at
    && new Date(user.trial_ends_at).getTime() <= Date.now();
}

export function publicUser(user) {
  return sanitize(user);
}

async function initSchema() {
  if (USE_POSTGRES) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        name text NOT NULL,
        email text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        role text NOT NULL DEFAULT 'MCO Case Manager',
        access_level text NOT NULL DEFAULT 'user',
        department text DEFAULT '',
        initials text DEFAULT '',
        color text DEFAULT 'bg-teal-600',
        is_active boolean NOT NULL DEFAULT true,
        subscription_status text NOT NULL DEFAULT 'active',
        trial_started_at timestamptz,
        trial_ends_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS mco_submissions (
        id text PRIMARY KEY,
        mco_id text NOT NULL,
        patient_id text NOT NULL,
        name text,
        age integer,
        zip_code text,
        clinical_data jsonb NOT NULL DEFAULT '{}',
        environmental_data jsonb NOT NULL DEFAULT '{}',
        resource_data jsonb NOT NULL DEFAULT '{}',
        status text,
        estimated_savings numeric DEFAULT 0,
        source text,
        submitted_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    return;
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'MCO Case Manager',
      access_level TEXT NOT NULL DEFAULT 'user',
      department TEXT DEFAULT '',
      initials TEXT DEFAULT '',
      color TEXT DEFAULT 'bg-teal-600',
      is_active INTEGER NOT NULL DEFAULT 1,
      subscription_status TEXT NOT NULL DEFAULT 'active',
      trial_started_at TEXT,
      trial_ends_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );
  `);

  for (const [column, definition] of [
    ['subscription_status', "TEXT NOT NULL DEFAULT 'active'"],
    ['trial_started_at', 'TEXT'],
    ['trial_ends_at', 'TEXT'],
  ]) {
    const columns = sqlite.prepare('PRAGMA table_info(users)').all();
    if (!columns.some((col) => col.name === column)) {
      sqlite.exec(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
    }
  }
}

const careforceSeed = [
  { name: 'Maria Rodriguez', email: 'maria.rodriguez@nyota.health', role: 'CHW', accessLevel: 'user', department: 'Community Health', initials: 'MR', color: 'bg-teal-600' },
  { name: 'Jane Smith', email: 'jane.smith@nyota.health', role: 'Doula', accessLevel: 'user', department: 'Continuous Support', initials: 'JS', color: 'bg-pink-500' },
  { name: 'Dr. Alan Grant', email: 'alan.grant@nyota.health', role: 'MD', accessLevel: 'supervisor', department: 'Clinical Services', initials: 'AG', color: 'bg-slate-600' },
  { name: 'Elena Fisher', email: 'elena.fisher@nyota.health', role: 'Nurse', accessLevel: 'user', department: 'Postpartum Care', initials: 'EF', color: 'bg-emerald-500' },
  { name: 'Sarah Connor', email: 'sarah.connor@nyota.health', role: 'CHW', accessLevel: 'user', department: 'Community Health', initials: 'SC', color: 'bg-teal-500' },
  { name: 'Dr. Lisa Park', email: 'lisa.park@nyota.health', role: 'Midwife', accessLevel: 'user', department: 'Clinical Services', initials: 'LP', color: 'bg-violet-500' },
  { name: 'James Okafor', email: 'james.okafor@nyota.health', role: 'CHW', accessLevel: 'user', department: 'Community Health', initials: 'JO', color: 'bg-cyan-600' },
  { name: 'Priya Nair', email: 'priya.nair@nyota.health', role: 'Doula', accessLevel: 'user', department: 'Continuous Support', initials: 'PN', color: 'bg-rose-500' },
  { name: 'Dr. Chen Wei', email: 'chen.wei@nyota.health', role: 'OB/GYN Attending', accessLevel: 'supervisor', department: 'Clinical Services', initials: 'CW', color: 'bg-indigo-600' },
  { name: 'Tamara Jenkins', email: 'tamara.jenkins@nyota.health', role: 'Charge Nurse', accessLevel: 'user', department: 'Labor & Delivery', initials: 'TJ', color: 'bg-green-600' },
];

async function seedUsers() {
  const count = USE_POSTGRES
    ? Number((await pool.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count)
    : sqlite.prepare('SELECT COUNT(*) AS count FROM users').get().count;

  if (count === 0) {
    await insertUserRow({
      name: 'System Admin',
      email: 'admin@nyota.health',
      password: 'Admin@2024',
      role: 'Admin',
      accessLevel: 'admin',
      department: 'System Administration',
      initials: 'SA',
      color: 'bg-slate-700',
      subscriptionStatus: 'active',
    });
    console.log('Default admin created: admin@nyota.health / Admin@2024');
  }

  for (const member of careforceSeed) {
    const existing = await getUserByEmail(member.email);
    if (!existing) {
      await insertUserRow({
        ...member,
        password: 'Care@2024',
        subscriptionStatus: 'active',
      });
    }
  }
  console.log('Careforce seed members ensured');
}

async function insertUserRow({ name, email, password, role, accessLevel, department, initials, color, subscriptionStatus = 'active', trialStartedAt = null, trialEndsAt = null }) {
  const id = crypto.randomUUID();
  const hash = bcrypt.hashSync(password, 10);
  const ini = initials || name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const values = [
    id,
    name,
    email.toLowerCase().trim(),
    hash,
    role || 'MCO Case Manager',
    accessLevel || 'user',
    department || '',
    ini,
    color || 'bg-teal-600',
    subscriptionStatus,
    trialStartedAt,
    trialEndsAt,
  ];

  if (USE_POSTGRES) {
    await pool.query(`
      INSERT INTO users (
        id, name, email, password_hash, role, access_level, department, initials, color,
        subscription_status, trial_started_at, trial_ends_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    `, values);
  } else {
    sqlite.prepare(`
      INSERT INTO users (
        id, name, email, password_hash, role, access_level, department, initials, color,
        subscription_status, trial_started_at, trial_ends_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(...values);
  }

  return id;
}

export async function getUserByEmail(email) {
  if (USE_POSTGRES) {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1) AND is_active=true', [email]);
    return normalizeDbUser(result.rows[0]);
  }
  return normalizeDbUser(sqlite.prepare('SELECT * FROM users WHERE LOWER(email)=LOWER(?) AND is_active=1').get(email));
}

export async function getUserById(id) {
  if (USE_POSTGRES) {
    const result = await pool.query('SELECT * FROM users WHERE id=$1 AND is_active=true', [id]);
    return normalizeDbUser(result.rows[0]);
  }
  return normalizeDbUser(sqlite.prepare('SELECT * FROM users WHERE id=? AND is_active=1').get(id));
}

export async function getAllUsers() {
  if (USE_POSTGRES) {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows.map(sanitize);
  }
  return sqlite.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(sanitize);
}

export async function createUser({ name, email, password, role, accessLevel, department, initials, color }) {
  const id = await insertUserRow({ name, email, password, role, accessLevel, department, initials, color, subscriptionStatus: 'active' });
  return sanitize(await getUserById(id));
}

export async function createTrialUser({ name, email, password }) {
  const now = new Date();
  const trialStartedAt = toIso(now);
  const trialEndsAt = toIso(addDays(now, Number(process.env.TRIAL_DAYS) || 30));
  const id = await insertUserRow({
    name,
    email,
    password,
    role: 'MCO Case Manager',
    accessLevel: 'user',
    department: 'Trial',
    color: 'bg-teal-600',
    subscriptionStatus: 'trialing',
    trialStartedAt,
    trialEndsAt,
  });
  return sanitize(await getUserById(id));
}

export async function assignTrialToUser({ email, days = 30, password }) {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const now = new Date();
  const updates = {
    subscriptionStatus: 'trialing',
    trialStartedAt: toIso(now),
    trialEndsAt: toIso(addDays(now, Number(days) || 30)),
    isActive: true,
  };
  if (password) updates.password = password;
  return updateUser(user.id, updates);
}

export async function updateUser(id, updates) {
  const allowed = [
    ['name', 'name', (v) => v],
    ['email', 'email', (v) => v.toLowerCase().trim()],
    ['role', 'role', (v) => v],
    ['accessLevel', 'access_level', (v) => v],
    ['department', 'department', (v) => v],
    ['initials', 'initials', (v) => v],
    ['color', 'color', (v) => v],
    ['isActive', 'is_active', (v) => (USE_POSTGRES ? Boolean(v) : v ? 1 : 0)],
    ['subscriptionStatus', 'subscription_status', (v) => v],
    ['trialStartedAt', 'trial_started_at', (v) => v],
    ['trialEndsAt', 'trial_ends_at', (v) => v],
  ];

  const fields = [];
  const values = [];
  for (const [key, column, transform] of allowed) {
    if (updates[key] !== undefined) {
      fields.push(column);
      values.push(transform(updates[key]));
    }
  }
  if (updates.password) {
    fields.push('password_hash');
    values.push(bcrypt.hashSync(updates.password, 10));
  }

  if (!fields.length) return sanitize(await getUserById(id));

  if (USE_POSTGRES) {
    const sets = fields.map((field, index) => `${field}=$${index + 1}`);
    values.push(id);
    await pool.query(
      `UPDATE users SET ${sets.join(',')}, updated_at=now() WHERE id=$${values.length}`,
      values
    );
  } else {
    const sets = fields.map((field) => `${field}=?`);
    values.push(id);
    sqlite.prepare(`UPDATE users SET ${sets.join(',')}, updated_at=${sqliteNowExpr()} WHERE id=?`).run(...values);
  }

  return sanitize(await getUserById(id));
}

export async function deactivateUser(id) {
  if (USE_POSTGRES) {
    await pool.query('UPDATE users SET is_active=false, updated_at=now() WHERE id=$1', [id]);
  } else {
    sqlite.prepare(`UPDATE users SET is_active=0, updated_at=${sqliteNowExpr()} WHERE id=?`).run(id);
  }
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

export async function listMcoSubmissions() {
  if (USE_POSTGRES) {
    const result = await pool.query('SELECT * FROM mco_submissions ORDER BY submitted_at ASC');
    return result.rows.map((row) => ({
      id: row.id,
      mcoId: row.mco_id,
      patientId: row.patient_id,
      name: row.name || '',
      age: row.age,
      zipCode: row.zip_code || '',
      clinicalData: row.clinical_data || {},
      environmentalData: row.environmental_data || {},
      resourceData: row.resource_data || {},
      status: row.status,
      estimatedSavings: Number(row.estimated_savings) || 0,
      source: row.source,
      submittedAt: row.submitted_at instanceof Date ? toIso(row.submitted_at) : row.submitted_at,
    }));
  }
  return null;
}

export async function saveMcoSubmission(submission) {
  if (!USE_POSTGRES) return false;
  await pool.query(`
    INSERT INTO mco_submissions (
      id, mco_id, patient_id, name, age, zip_code, clinical_data,
      environmental_data, resource_data, status, estimated_savings, source, submitted_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    ON CONFLICT (id) DO UPDATE SET
      mco_id=EXCLUDED.mco_id,
      patient_id=EXCLUDED.patient_id,
      name=EXCLUDED.name,
      age=EXCLUDED.age,
      zip_code=EXCLUDED.zip_code,
      clinical_data=EXCLUDED.clinical_data,
      environmental_data=EXCLUDED.environmental_data,
      resource_data=EXCLUDED.resource_data,
      status=EXCLUDED.status,
      estimated_savings=EXCLUDED.estimated_savings,
      source=EXCLUDED.source,
      submitted_at=EXCLUDED.submitted_at
  `, [
    submission.id,
    submission.mcoId,
    submission.patientId,
    submission.name || null,
    submission.age || null,
    submission.zipCode || null,
    submission.clinicalData || {},
    submission.environmentalData || {},
    submission.resourceData || {},
    submission.status || null,
    submission.estimatedSavings || 0,
    submission.source || null,
    submission.submittedAt || toIso(new Date()),
  ]);
  return true;
}

export const usingPostgres = USE_POSTGRES;

await initSchema();
await seedUsers();

export default {
  usingPostgres,
  pool,
  sqlite,
};
