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
    dashboardAccess: u.dashboard_access || null,
    communityCareAccess: u.community_care_access === 1 || u.community_care_access === true,
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

      ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_access text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS community_care_access boolean NOT NULL DEFAULT false;

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

      CREATE TABLE IF NOT EXISTS chat_messages (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chat_type text NOT NULL DEFAULT 'team',
        sender text NOT NULL,
        name text NOT NULL,
        text text NOT NULL,
        message_type text NOT NULL DEFAULT 'message',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS chat_messages_user_type_created_idx
        ON chat_messages (user_id, chat_type, created_at);

      CREATE TABLE IF NOT EXISTS member_documents (
        id text PRIMARY KEY,
        uploaded_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        member_ref text NOT NULL,
        file_name text NOT NULL,
        mime_type text NOT NULL,
        byte_size integer NOT NULL,
        metadata_iv text NOT NULL,
        metadata_tag text NOT NULL,
        metadata_data bytea NOT NULL,
        content_iv text NOT NULL,
        content_tag text NOT NULL,
        content_data bytea NOT NULL,
        text_iv text NOT NULL,
        text_tag text NOT NULL,
        text_data bytea NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      ALTER TABLE member_documents ADD COLUMN IF NOT EXISTS metadata_iv text;
      ALTER TABLE member_documents ADD COLUMN IF NOT EXISTS metadata_tag text;
      ALTER TABLE member_documents ADD COLUMN IF NOT EXISTS metadata_data bytea;

      CREATE TABLE IF NOT EXISTS member_document_shares (
        document_id text NOT NULL REFERENCES member_documents(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (document_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS member_document_shares_user_idx
        ON member_document_shares (user_id, document_id);
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

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      chat_type TEXT NOT NULL DEFAULT 'team',
      sender TEXT NOT NULL,
      name TEXT NOT NULL,
      text TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'message',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS chat_messages_user_type_created_idx
      ON chat_messages (user_id, chat_type, created_at);

    CREATE TABLE IF NOT EXISTS member_documents (
      id TEXT PRIMARY KEY,
      uploaded_by TEXT NOT NULL,
      member_ref TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      metadata_iv TEXT NOT NULL,
      metadata_tag TEXT NOT NULL,
      metadata_data BLOB NOT NULL,
      content_iv TEXT NOT NULL,
      content_tag TEXT NOT NULL,
      content_data BLOB NOT NULL,
      text_iv TEXT NOT NULL,
      text_tag TEXT NOT NULL,
      text_data BLOB NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS member_document_shares (
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (document_id, user_id),
      FOREIGN KEY (document_id) REFERENCES member_documents(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS member_document_shares_user_idx
      ON member_document_shares (user_id, document_id);
  `);

  for (const [column, definition] of [
    ['metadata_iv', 'TEXT'],
    ['metadata_tag', 'TEXT'],
    ['metadata_data', 'BLOB'],
  ]) {
    const columns = sqlite.prepare('PRAGMA table_info(member_documents)').all();
    if (!columns.some((col) => col.name === column)) {
      sqlite.exec(`ALTER TABLE member_documents ADD COLUMN ${column} ${definition}`);
    }
  }

  for (const [column, definition] of [
    ['subscription_status', "TEXT NOT NULL DEFAULT 'active'"],
    ['trial_started_at', 'TEXT'],
    ['trial_ends_at', 'TEXT'],
    ['dashboard_access', 'TEXT'],
    ['community_care_access', 'INTEGER NOT NULL DEFAULT 0'],
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

async function insertUserRow({ name, email, password, role, accessLevel, department, initials, color, subscriptionStatus = 'active', trialStartedAt = null, trialEndsAt = null, dashboardAccess = null, communityCareAccess = false }) {
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
    dashboardAccess,
    USE_POSTGRES ? Boolean(communityCareAccess) : communityCareAccess ? 1 : 0,
  ];

  if (USE_POSTGRES) {
    await pool.query(`
      INSERT INTO users (
        id, name, email, password_hash, role, access_level, department, initials, color,
        subscription_status, trial_started_at, trial_ends_at, dashboard_access, community_care_access
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    `, values);
  } else {
    sqlite.prepare(`
      INSERT INTO users (
        id, name, email, password_hash, role, access_level, department, initials, color,
        subscription_status, trial_started_at, trial_ends_at, dashboard_access, community_care_access
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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

export async function createUser({ name, email, password, role, accessLevel, department, initials, color, dashboardAccess, communityCareAccess }) {
  const id = await insertUserRow({
    name, email, password, role, accessLevel, department, initials, color,
    dashboardAccess, communityCareAccess, subscriptionStatus: 'active',
  });
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
    ['dashboardAccess', 'dashboard_access', (v) => v || null],
    ['communityCareAccess', 'community_care_access', (v) => (USE_POSTGRES ? Boolean(v) : v ? 1 : 0)],
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

function normalizeChatMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    chatType: row.chat_type,
    sender: row.sender,
    name: row.name,
    text: row.text,
    type: row.message_type,
    timestamp: row.created_at instanceof Date ? toIso(row.created_at) : row.created_at,
  };
}

export async function listChatMessages(userId, chatType = 'team', limit = 50) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
  if (chatType === 'team') {
    const postgresQuery = `
      SELECT * FROM (
        SELECT m.*
        FROM chat_messages m
        JOIN users author ON author.id = m.user_id
        WHERE m.chat_type = $2 AND EXISTS (
          SELECT 1 FROM users viewer
          WHERE viewer.id = $1
            AND viewer.department = author.department
            AND (viewer.department NOT IN ('', 'Trial') OR viewer.id = author.id)
        )
        ORDER BY m.created_at DESC
        LIMIT $3
      ) recent
      ORDER BY created_at ASC
    `;
    const sqliteQuery = `
      SELECT * FROM (
        SELECT m.*
        FROM chat_messages m
        JOIN users author ON author.id = m.user_id
        WHERE m.chat_type = ? AND EXISTS (
          SELECT 1 FROM users viewer
          WHERE viewer.id = ?
            AND viewer.department = author.department
            AND (viewer.department NOT IN ('', 'Trial') OR viewer.id = author.id)
        )
        ORDER BY m.created_at DESC
        LIMIT ?
      ) recent
      ORDER BY created_at ASC
    `;
    const rows = USE_POSTGRES
      ? (await pool.query(postgresQuery, [userId, chatType, safeLimit])).rows
      : sqlite.prepare(sqliteQuery).all(chatType, userId, safeLimit);
    return rows.map(normalizeChatMessage);
  }

  if (USE_POSTGRES) {
    const result = await pool.query(`
      SELECT * FROM (
        SELECT *
        FROM chat_messages
        WHERE user_id=$1 AND chat_type=$2
        ORDER BY created_at DESC
        LIMIT $3
      ) recent
      ORDER BY created_at ASC
    `, [userId, chatType, safeLimit]);
    return result.rows.map(normalizeChatMessage);
  }

  return sqlite.prepare(`
    SELECT * FROM (
      SELECT *
      FROM chat_messages
      WHERE user_id=? AND chat_type=?
      ORDER BY created_at DESC
      LIMIT ?
    ) recent
    ORDER BY created_at ASC
  `).all(userId, chatType, safeLimit).map(normalizeChatMessage);
}

export async function saveChatMessage({ userId, chatType = 'team', sender, name, text, type = 'message' }) {
  const id = crypto.randomUUID();
  const createdAt = toIso(new Date());
  const values = [
    id,
    userId,
    chatType,
    sender,
    name,
    text,
    type,
    createdAt,
  ];

  if (USE_POSTGRES) {
    await pool.query(`
      INSERT INTO chat_messages (
        id, user_id, chat_type, sender, name, text, message_type, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, values);
  } else {
    sqlite.prepare(`
      INSERT INTO chat_messages (
        id, user_id, chat_type, sender, name, text, message_type, created_at
      )
      VALUES (?,?,?,?,?,?,?,?)
    `).run(...values);
  }

  return normalizeChatMessage({
    id,
    user_id: userId,
    chat_type: chatType,
    sender,
    name,
    text,
    message_type: type,
    created_at: createdAt,
  });
}

export async function clearChatMessages(userId, chatType = 'team') {
  if (USE_POSTGRES) {
    await pool.query('DELETE FROM chat_messages WHERE user_id=$1 AND chat_type=$2', [userId, chatType]);
  } else {
    sqlite.prepare('DELETE FROM chat_messages WHERE user_id=? AND chat_type=?').run(userId, chatType);
  }
}

export async function listMemberDocuments(userId, limit = 100) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const query = `
    SELECT d.id, d.mime_type, d.byte_size, d.created_at,
      d.metadata_iv, d.metadata_tag, d.metadata_data,
      u.name AS uploader_name
    FROM member_documents d
    JOIN users u ON u.id = d.uploaded_by
    WHERE d.uploaded_by = $1 OR EXISTS (
      SELECT 1 FROM member_document_shares s
      WHERE s.document_id = d.id AND s.user_id = $1
    )
    ORDER BY d.created_at DESC
    LIMIT $2
  `;
  const sqliteQuery = `
    SELECT d.id, d.mime_type, d.byte_size, d.created_at,
      d.metadata_iv, d.metadata_tag, d.metadata_data,
      u.name AS uploader_name
    FROM member_documents d
    JOIN users u ON u.id = d.uploaded_by
    WHERE d.uploaded_by = ? OR EXISTS (
      SELECT 1 FROM member_document_shares s
      WHERE s.document_id = d.id AND s.user_id = ?
    )
    ORDER BY d.created_at DESC
    LIMIT ?
  `;
  const rows = USE_POSTGRES
    ? (await pool.query(query, [userId, safeLimit])).rows
    : sqlite.prepare(sqliteQuery).all(userId, userId, safeLimit);
  return rows.map((row) => ({
    id: row.id,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    uploadedAt: row.created_at instanceof Date ? toIso(row.created_at) : row.created_at,
    uploaderName: row.uploader_name,
    metadataIv: row.metadata_iv,
    metadataTag: row.metadata_tag,
    metadataData: row.metadata_data,
  }));
}

export async function listAccessibleMemberDocumentContent(userId, limit = 100) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const query = `
    SELECT d.*
    FROM member_documents d
    WHERE d.uploaded_by = $1 OR EXISTS (
      SELECT 1 FROM member_document_shares s
      WHERE s.document_id = d.id AND s.user_id = $1
    )
    ORDER BY d.created_at DESC
    LIMIT $2
  `;
  const sqliteQuery = `
    SELECT d.*
    FROM member_documents d
    WHERE d.uploaded_by = ? OR EXISTS (
      SELECT 1 FROM member_document_shares s
      WHERE s.document_id = d.id AND s.user_id = ?
    )
    ORDER BY d.created_at DESC
    LIMIT ?
  `;
  return USE_POSTGRES
    ? (await pool.query(query, [userId, safeLimit])).rows
    : sqlite.prepare(sqliteQuery).all(userId, userId, safeLimit);
}

export async function saveMemberDocument(document, recipientIds) {
  const values = [
    document.id,
    document.uploadedBy,
    document.memberRef,
    document.fileName,
    document.mimeType,
    document.byteSize,
    document.metadataIv,
    document.metadataTag,
    document.metadataData,
    document.contentIv,
    document.contentTag,
    document.contentData,
    document.textIv,
    document.textTag,
    document.textData,
    document.createdAt,
  ];

  if (USE_POSTGRES) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO member_documents (
          id, uploaded_by, member_ref, file_name, mime_type, byte_size,
          metadata_iv, metadata_tag, metadata_data,
          content_iv, content_tag, content_data, text_iv, text_tag, text_data, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      `, values);
      for (const userId of recipientIds) {
        await client.query(
          'INSERT INTO member_document_shares (document_id, user_id) VALUES ($1,$2)',
          [document.id, userId]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return;
  }

  const insert = sqlite.transaction(() => {
    sqlite.prepare(`
      INSERT INTO member_documents (
        id, uploaded_by, member_ref, file_name, mime_type, byte_size,
        metadata_iv, metadata_tag, metadata_data,
        content_iv, content_tag, content_data, text_iv, text_tag, text_data, created_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(...values);
    const insertShare = sqlite.prepare(
      'INSERT INTO member_document_shares (document_id, user_id) VALUES (?,?)'
    );
    for (const userId of recipientIds) insertShare.run(document.id, userId);
  });
  insert();
}

export async function getAccessibleMemberDocument(documentId, userId) {
  const query = `
    SELECT d.*
    FROM member_documents d
    WHERE d.id = $1 AND (
      d.uploaded_by = $2 OR EXISTS (
        SELECT 1 FROM member_document_shares s
        WHERE s.document_id = d.id AND s.user_id = $2
      )
    )
  `;
  const sqliteQuery = `
    SELECT d.*
    FROM member_documents d
    WHERE d.id = ? AND (
      d.uploaded_by = ? OR EXISTS (
        SELECT 1 FROM member_document_shares s
        WHERE s.document_id = d.id AND s.user_id = ?
      )
    )
  `;
  const row = USE_POSTGRES
    ? (await pool.query(query, [documentId, userId])).rows[0]
    : sqlite.prepare(sqliteQuery).get(documentId, userId, userId);
  return row || null;
}

export const usingPostgres = USE_POSTGRES;

await initSchema();
await seedUsers();

export default {
  usingPostgres,
  pool,
  sqlite,
};
