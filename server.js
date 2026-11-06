import express from 'express';
import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
import crypto from 'crypto';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Readable } from 'stream';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import jwt from 'jsonwebtoken';
import {
  getUserByEmail,
  getUserById,
  getAllUsers,
  createUser,
  createTrialUser,
  updateUser,
  deactivateUser,
  verifyPassword,
  publicUser,
  isUserTrialExpired,
  listMcoSubmissions,
  saveMcoSubmission,
  listChatMessages,
  saveChatMessage,
  clearChatMessages,
  listMemberDocuments,
  listAccessibleMemberDocumentContent,
  saveMemberDocument,
  getAccessibleMemberDocument,
  usingPostgres,
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const protocol = req.get('x-forwarded-proto')?.split(',')[0].trim() || req.protocol;
  const host = req.get('x-forwarded-host')?.split(',')[0].trim() || req.get('host');
  const requestOrigin = `${protocol}://${host}`;

  return cors({
    origin(origin, callback) {
      if (!origin || origin === requestOrigin) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed'));
    },
  })(req, res, next);
});

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; connect-src 'self' https:; font-src 'self' data: https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

const publicApiPaths = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
]);

app.use('/api', (req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const user = req.currentUser || {};
    console.log(JSON.stringify({
      type: 'audit',
      at: new Date().toISOString(),
      userId: user.id || null,
      email: user.email || null,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: req.ip,
    }));
  });
  next();
});

app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS' || publicApiPaths.has(req.path === '/health' ? '/api/health' : `/api${req.path}`)) {
    return next();
  }
  return requireAuth([])(req, res, next);
});

function bootstrapGeminiKey() {
  if (process.env.GEMINI_API_KEY) return;

  const candidates = [
    path.resolve(__dirname, '.env.local'),
    path.resolve(__dirname, '.env'),
  ];

  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const text = fs.readFileSync(filePath, 'utf8');
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, '');
        if (key && !(key in process.env)) {
          process.env[key] = value;
        }
      }
      if (process.env.GEMINI_API_KEY) {
        console.log(`✅ GEMINI_API_KEY loaded from ${path.basename(filePath)}`);
        return;
      }
    } catch (error) {
      console.warn(`⚠️ Failed reading ${filePath}:`, error.message);
    }
  }

  console.warn('⚠️ GEMINI_API_KEY not found in process env or .env.local');
}

bootstrapGeminiKey();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const DOCUMENT_KEY_PATH = path.resolve(__dirname, './data/member-document-key');
const DOCUMENT_TYPES = {
  '.pdf': { mimeType: 'application/pdf' },
  '.docx': { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  '.txt': { mimeType: 'text/plain' },
  '.csv': { mimeType: 'text/csv' },
};

class DocumentInputError extends Error {}

function getDocumentStorageKey() {
  if (process.env.DOCUMENT_STORAGE_KEY) {
    if (!/^[\da-fA-F]{64}$/.test(process.env.DOCUMENT_STORAGE_KEY)) {
      throw new Error('DOCUMENT_STORAGE_KEY must be exactly 64 hexadecimal characters.');
    }
    return Buffer.from(process.env.DOCUMENT_STORAGE_KEY, 'hex');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DOCUMENT_STORAGE_KEY must be configured in production.');
  }

  fs.mkdirSync(path.dirname(DOCUMENT_KEY_PATH), { recursive: true, mode: 0o700 });
  try {
    const key = fs.readFileSync(DOCUMENT_KEY_PATH);
    if (key.length !== 32) throw new Error('Local member document key has an invalid length.');
    return key;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const key = crypto.randomBytes(32);
    try {
      fs.writeFileSync(DOCUMENT_KEY_PATH, key, { flag: 'wx', mode: 0o600 });
      return key;
    } catch (writeError) {
      if (writeError.code !== 'EEXIST') throw writeError;
      const existingKey = fs.readFileSync(DOCUMENT_KEY_PATH);
      if (existingKey.length !== 32) throw new Error('Local member document key has an invalid length.');
      return existingKey;
    }
  }
}

function encryptDocumentData(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getDocumentStorageKey(), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: encrypted,
  };
}

function decryptDocumentData(data, iv, tag) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', getDocumentStorageKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

function decryptDocumentMetadata(document) {
  return JSON.parse(decryptDocumentData(
    document.metadata_data ?? document.metadataData,
    document.metadata_iv ?? document.metadataIv,
    document.metadata_tag ?? document.metadataTag
  ).toString('utf8'));
}

async function extractDocumentText(buffer, extension) {
  let text;
  if (extension === '.pdf') {
    let loadingTask;
    let pdf;
    try {
      loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        isEvalSupported: false,
        standardFontDataUrl: new URL('./node_modules/pdfjs-dist/standard_fonts/', import.meta.url).href,
      });
      pdf = await loadingTask.promise;
      if (pdf.numPages > 100) throw new Error('PDFs must contain 100 pages or fewer.');
      const pages = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => ('str' in item ? item.str : '')).join(' '));
      }
      text = pages.join('\n');
    } catch (error) {
      if (error instanceof DocumentInputError) throw error;
      throw new DocumentInputError(error.message || 'Could not read this PDF.');
    } finally {
      if (loadingTask) await loadingTask.destroy();
    }
  } else if (extension === '.docx') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } catch (error) {
      throw new DocumentInputError(error.message || 'Could not read this Word document.');
    }
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new DocumentInputError('This file is not valid UTF-8 text.');
    }
  }

  const normalized = text.replace(/\u0000/g, '').trim();
  if (!normalized) throw new DocumentInputError('No selectable text was found; scanned documents and images are not supported yet.');
  if (normalized.length > 250_000) throw new DocumentInputError('Extracted text exceeds 250,000 characters. Split the document and upload smaller files.');
  return normalized;
}

// Load ML model and metadata
let mlModel = null;
let modelMeta = null;
let featureImportance = null;
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || (process.platform === 'win32' ? 'python' : 'python3');
const PYTHON_INFERENCE_SCRIPT = path.resolve(__dirname, './utils/ml_predict.py');
const MODEL_DIR = path.resolve(__dirname, './models_senior_v4');
const MODEL_JOBLIB_PATH = path.join(MODEL_DIR, 'event72h_model.joblib');
const MODEL_META_PATH = path.join(MODEL_DIR, 'meta.json');
const MODEL_IMPORTANCE_PATH = path.join(MODEL_DIR, 'perm_importance_test.csv');

function getTierThresholds() {
  return {
    tier2: modelMeta?.tier_thresholds?.tier2 ?? 0.11788652035931896,
    tier3: modelMeta?.tier_thresholds?.tier3 ?? 0.19470706821788414,
    tier4: modelMeta?.tier_thresholds?.tier4 ?? 0.2805258371213723,
  };
}

function getRiskTier(prediction, thresholds) {
  if (prediction >= thresholds.tier4) return 'Critical';
  if (prediction >= thresholds.tier3) return 'High';
  if (prediction >= thresholds.tier2) return 'Medium';
  return 'Low';
}

function runPythonModelPrediction(features) {
  if (!fs.existsSync(PYTHON_INFERENCE_SCRIPT) || !fs.existsSync(MODEL_JOBLIB_PATH)) {
    return null;
  }

  const payload = JSON.stringify({
    modelPath: MODEL_JOBLIB_PATH,
    features,
  });

  const result = spawnSync(PYTHON_EXECUTABLE, [PYTHON_INFERENCE_SCRIPT, payload], {
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error([stderr, stdout].filter(Boolean).join('\n') || `Python inference exited with status ${result.status}`);
  }

  const output = (result.stdout || '').trim();
  if (!output) {
    throw new Error('Python inference returned empty output');
  }

  return JSON.parse(output);
}

function scoreFallback(features) {
  const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const sbp = toNumber(features.sbp, 120);
  const heatIslandIndex = toNumber(features.heat_island_index, 50);
  const map = toNumber(features.map, 90);
  const pulsePressure = toNumber(features.pulse_pressure, Math.max(35, sbp - map));
  const age = toNumber(features.age, 28);

  let logit = -2.25;
  if (sbp >= 160) logit += 1.2;
  else if (sbp >= 150) logit += 0.95;
  else if (sbp >= 140) logit += 0.7;

  if (map >= 110) logit += 0.7;
  else if (map >= 100) logit += 0.38;

  if (heatIslandIndex >= 85) logit += 0.5;
  else if (heatIslandIndex >= 70) logit += 0.24;

  if (pulsePressure >= 60) logit += 0.45;
  else if (pulsePressure >= 50) logit += 0.22;

  if (age >= 35) logit += 0.25;
  if (age >= 40) logit += 0.1;

  const rawPrediction = 1 / (1 + Math.exp(-logit));
  const prediction = Math.max(0.01, Math.min(0.99, rawPrediction));

  const thresholds = getTierThresholds();
  const nearestThresholdDistance = Math.min(
    Math.abs(prediction - thresholds.tier2),
    Math.abs(prediction - thresholds.tier3),
    Math.abs(prediction - thresholds.tier4)
  );
  const completeness = [features.sbp, features.map, features.heat_island_index, features.pulse_pressure, features.age]
    .filter(v => Number.isFinite(Number(v))).length / 5;
  const confidence = Math.max(
    0.7,
    Math.min(0.98, 0.72 + completeness * 0.12 + Math.min(nearestThresholdDistance * 2.2, 0.14))
  );

  return {
    prediction,
    confidence,
    features: {
      sbp,
      heat_island_index: heatIslandIndex,
      map,
      pulse_pressure: pulsePressure,
      age,
    },
  };
}

try {
  console.log('Loading ML model...');
  modelMeta = JSON.parse(fs.readFileSync(MODEL_META_PATH, 'utf8'));
  console.log('✅ ML model metadata loaded');
  
  // Load feature importance
  const importanceData = [];
  fs.createReadStream(MODEL_IMPORTANCE_PATH)
    .pipe(csvParser())
    .on('data', (row) => importanceData.push(row))
    .on('end', () => {
      featureImportance = importanceData
        .filter(item => parseFloat(item.importance_mean) > 0)
        .sort((a, b) => parseFloat(b.importance_mean) - parseFloat(a.importance_mean))
        .slice(0, 10); // Top 10 features
      console.log('✅ Feature importance loaded');
    });
} catch (error) {
  console.log('⚠️ ML model not available:', error.message);
}

const CSV_PATH = process.env.MATERNAL_DATA_CSV_PATH
  ? path.resolve(__dirname, process.env.MATERNAL_DATA_CSV_PATH)
  : path.resolve(__dirname, './data/maternal_data.csv');
const FACILITY_CSV_PATH = process.env.BIRTHING_FACILITIES_CSV_PATH
  ? path.resolve(__dirname, process.env.BIRTHING_FACILITIES_CSV_PATH)
  : path.resolve(__dirname, './data/birthing_facilities.csv');

let facilityCache = {
  mtimeMs: 0,
  facilities: [],
};

// CMS Hospital Compare star ratings cache (free, no API key needed)
let cmsRatingsCache = {
  fetchedAt: 0,
  byZipAndName: new Map(), // `${normName}|${zip5}` → { rating, isBirthingFriendly }
  byZip: new Map(),        // zip5 → [{ name, rating, isBirthingFriendly }]
};
const CMS_RATINGS_TTL_MS = 24 * 60 * 60 * 1000; // refresh every 24 h

async function fetchCmsRatings() {
  const now = Date.now();
  if (cmsRatingsCache.fetchedAt && (now - cmsRatingsCache.fetchedAt) < CMS_RATINGS_TTL_MS) {
    return cmsRatingsCache;
  }

  const byZipAndName = new Map();
  const byZip = new Map();

  try {
    console.log('🌐 Fetching CMS hospital quality ratings...');
    let offset = 0;
    const pageSize = 1500; // CMS API maximum is 1500
    let keepGoing = true;

    while (keepGoing) {
      const url =
        `https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0` +
        `?limit=${pageSize}&offset=${offset}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(20000),
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; NyotaApp/1.0)' },
      });
      if (!res.ok) throw new Error(`CMS API ${res.status}`);
      const json = await res.json();
      const results = Array.isArray(json.results) ? json.results : [];

      for (const h of results) {
        const rating = parseFloat(h.hospital_overall_rating);
        const isBirthingFriendly =
          String(h.meets_criteria_for_birthing_friendly_designation || '').trim().toUpperCase() === 'Y';

        const zip5 = String(h.zip_code || '').trim().replace(/[^0-9]/g, '').substring(0, 5);
        const normName = String(h.facility_name || '').trim().toLowerCase();
        if (!zip5 || !normName) continue;

        const entry = { name: normName, rating: Number.isFinite(rating) && rating >= 1 ? rating : 0, isBirthingFriendly };
        byZipAndName.set(`${normName}|${zip5}`, entry);
        if (!byZip.has(zip5)) byZip.set(zip5, []);
        byZip.get(zip5).push(entry);
      }

      offset += pageSize;
      keepGoing = results.length === pageSize;
    }

    cmsRatingsCache = { fetchedAt: now, byZipAndName, byZip };
    console.log(`✅ CMS ratings loaded: ${byZipAndName.size} hospitals`);
  } catch (err) {
    console.warn('⚠️  CMS ratings fetch failed, quality ratings may show as 0:', err.message);
    // cache empty result for 1 min so we don't hammer the API on every request
    cmsRatingsCache = { fetchedAt: now - CMS_RATINGS_TTL_MS + 60_000, byZipAndName, byZip };
  }

  return cmsRatingsCache;
}

function lookupCmsRating(name, zip, cache) {
  const normName = String(name || '').trim().toLowerCase();
  const zip5 = String(zip || '').trim().replace(/[^0-9]/g, '').substring(0, 5);
  if (!zip5 || !normName) return null;

  // 1. Exact match
  const exact = cache.byZipAndName.get(`${normName}|${zip5}`);
  if (exact !== undefined) return exact;

  // 2. Fuzzy: most shared meaningful words within same zip
  const zipEntries = cache.byZip.get(zip5);
  if (!zipEntries || zipEntries.length === 0) return null;

  const queryWords = new Set(
    normName.split(/\s+/).filter((w) => w.length > 3 && !['hospital', 'medical', 'center', 'health'].includes(w))
  );
  if (queryWords.size === 0) return null;

  let bestScore = 0;
  let bestEntry = null;
  for (const entry of zipEntries) {
    const score = entry.name.split(/\s+/).filter((w) => queryWords.has(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }
  return bestScore >= 2 ? bestEntry : null;
}

// Kick off CMS ratings fetch in the background at startup
fetchCmsRatings().catch(() => {});

const getCsvAny = (row, keys, fallback = '') => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return fallback;
};

const normalizeCsvRowKeys = (row) => {
  const normalized = {};
  for (const [key, value] of Object.entries(row || {})) {
    const nk = String(key)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    normalized[nk] = value;
  }
  return normalized;
};

const parseFacilityBool = (value) => {
  if (typeof value === 'boolean') return value;
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  if (['true', '1', 'yes', 'y'].includes(text)) return true;
  return text.includes('birthing-friendly') || text.includes('friendly');
};

const parseFacilityNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

function parseFacilityCsv() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(FACILITY_CSV_PATH)) {
      return resolve([]);
    }

    const stat = fs.statSync(FACILITY_CSV_PATH);
    if (facilityCache.mtimeMs === stat.mtimeMs && facilityCache.facilities.length) {
      return resolve(facilityCache.facilities);
    }

    const rows = [];
    fs.createReadStream(FACILITY_CSV_PATH)
      .pipe(csvParser())
      .on('data', (row) => rows.push(row))
      .on('end', () => {
        const mapped = rows
          .map((raw, idx) => {
            const r = normalizeCsvRowKeys(raw);
            const name = String(getCsvAny(r, ['hospital_name', 'facility_name', 'name', 'hospital'], '')).trim();
            const address = String(getCsvAny(r, ['address', 'street', 'street_address'], '')).trim();
            const city = String(getCsvAny(r, ['city'], '')).trim();
            const state = String(getCsvAny(r, ['state'], '')).trim();
            const zip = String(getCsvAny(r, ['zip', 'zip_code', 'zipcode'], '')).trim();
            const isBirthingFriendly = parseFacilityBool(getCsvAny(r, ['is_birthing_friendly', 'birthing_friendly', 'birthingfriendly', 'designation'], false));
            const qualityRating = parseFacilityNumber(getCsvAny(r, ['quality_rating', 'rating', 'overall_rating'], 0), 0);
            const tmahIntegrated = parseFacilityBool(getCsvAny(r, ['tmah_integrated', 'tmah', 'is_tmah_integrated'], false));
            const distanceRaw = String(getCsvAny(r, ['distance', 'distance_miles'], '')).trim();
            const distance = distanceRaw ? (distanceRaw.toLowerCase().includes('mi') ? distanceRaw : `${distanceRaw} mi`) : undefined;

            if (!name) return null;
            return {
              id: String(getCsvAny(r, ['id', 'facility_id'], `fac-${idx}`)),
              name,
              address,
              city,
              state,
              zip,
              isBirthingFriendly,
              qualityRating,
              tmahIntegrated,
              distance,
            };
          })
          .filter(Boolean);

        facilityCache = {
          mtimeMs: stat.mtimeMs,
          facilities: mapped,
        };
        resolve(mapped);
      })
      .on('error', reject);
  });
}

function parseCsv() {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(CSV_PATH)
      .pipe(csvParser())
      .on('data', row => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function makeBoardGroups(rows) {
  // Transform CSV rows into BoardItem structure with real data
  const items = rows.map((r, i) => {
    const sbp = Number(r.sbp) || 0;
    const dbp = Number(r.dbp) || 0;
    const aqi = Number(r.aqi) || 0;
    const ruleScore = Number(r.rule_score) || 0;
    const event72h = r.event_within_72h === '1' || r.event_within_72h === 'true';
    
    // Determine status based on BP and 72h prediction
    let status = 'Stable';
    if (event72h || ruleScore > 50) status = 'Critical';
    else if (sbp > 160 || dbp > 100 || aqi > 150) status = 'Reviewing';
    
    // NICU category based on risk score
    let nicuCategory = 'Low Prob';
    let nicuProbability = Math.min(95, Math.max(5, ruleScore * 2)); // Convert to 5-95% range
    if (ruleScore > 70) {
      nicuCategory = 'High Prob';
      nicuProbability = Math.min(95, Math.max(70, ruleScore));
    } else if (ruleScore > 50) {
      nicuCategory = 'Rising Prob';
      nicuProbability = Math.min(69, Math.max(40, ruleScore));
    } else {
      nicuProbability = Math.max(5, Math.min(39, ruleScore));
    }
    
    const lastVitals = `BP ${sbp.toFixed(0)}/${dbp.toFixed(0)} | AQI ${aqi.toFixed(0)}`;
    const memberId = String(r.member_id || `UNKNOWN-${i + 1}`);
    const name = `Member ${memberId}`;
    const mrn = `MRN-${memberId}`;
    
    return {
      id: `p-${i}`,
      name,
      mrn,
      status,
      triage: sbp > 160 ? '2 - Emergent' : sbp > 140 ? '3 - Urgent' : '4 - Less Urgent',
      riskRank: Math.round(ruleScore),
      assignee: null,
      lastVitals,
      updatesCount: event72h ? 3 : 0,
      lastUpdated: r.ts || 'Unknown',
      caseData: {
        patientId: memberId,
        age: r.age ? String(r.age) : 'Unknown',
        gestation: r.gestation || r.gestational_age || 'Unknown',
        parity: r.parity || 'Unknown',
        chiefComplaint: sbp > 160 ? 'Elevated blood pressure' : sbp > 140 ? 'Headache' : 'Routine visit',
        vitals: lastVitals,
        region: r.region,
        raceEthnicity: r.race_ethnicity,
        enrollmentDate: r.enrollment_date,
        pregnancyStartDate: r.pregnancy_start_date,
        deliveryDate: r.delivery_date,
        observedAt: r.ts,
        sbp,
        dbp,
        hrv: Number(r.hrv) || undefined,
        bmi: Number(r.bmi) || undefined,
        aqi,
        ruleScore,
        eventWithin72h: event72h,
        heatIslandIndex: Number(r.heat_island_index) || 0,
        environmental: {
          zipCode: r.zip || 'Unknown',
          airQuality: aqi.toString(),
          heatIndex: Number(r.temp_f) || 0,
        },
      },
      nicuCategory,
      nicuProbability: Math.round(nicuProbability),
      smmCondition: sbp > 160 ? 'Hypertension' : aqi > 150 ? 'Air Quality' : 'None',
      ppcPre: ruleScore < 30,
      ppcPost: ruleScore < 40,
      estimatedSavings: Math.round(ruleScore * 100),
    };
  });

  // Group by status for dashboard view (Critical, Reviewing, Stable)
  const criticalItems = items.filter(i => i.status === 'Critical');
  const reviewingItems = items.filter(i => i.status === 'Reviewing');
  const stableItems = items.filter(i => i.status === 'Stable');
  
  const groups = [];
  if (criticalItems.length > 0) {
    groups.push({
      id: 'g1',
      title: '🚨 72-Hour Critical Window',
      color: 'rose',
      items: criticalItems, // Remove slice(0, 10) to show all items
    });
  }
  if (reviewingItems.length > 0) {
    groups.push({
      id: 'g2',
      title: '⚠️ Elevated Monitoring',
      color: 'amber',
      items: reviewingItems, // Remove slice(0, 10) to show all items
    });
  }
  if (stableItems.length > 0) {
    groups.push({
      id: 'g3',
      title: '🛡️ Stable Members',
      color: 'emerald',
      items: stableItems, // Remove slice(0, 10) to show all items
    });
  }
  
  return groups.length > 0 ? groups : [
    { id: 'g0', title: 'All Members', color: 'indigo', items }
  ];
}

app.get('/api/board', async (req, res) => {
  try {
    const data = await buildAggregatedDataPayload();
    res.json(data);
  } catch (err) {
    console.error('Error fetching aggregated data:', err);
    // Fallback to CSV-only data
    try {
      const rows = await parseCsv();
      res.json({ groups: makeBoardGroups(rows) });
    } catch (fallbackErr) {
      console.error('Fallback also failed:', fallbackErr);
      res.status(500).json({ error: 'Failed to load data' });
    }
  }
});

app.get('/api/facilities', async (req, res) => {
  try {
    const q = String(req.query.q || '').toLowerCase().trim();
    const friendlyOnly = String(req.query.friendlyOnly || '').toLowerCase() === 'true';

    // Load CSV and CMS ratings in parallel
    const [facilities, cmsCache] = await Promise.all([
      parseFacilityCsv(),
      fetchCmsRatings(),
    ]);

    // Enrich facilities that have no rating with CMS star data
    const enriched = facilities.map((f) => {
      const cmsEntry = lookupCmsRating(f.name, f.zip, cmsCache);
      if (!cmsEntry) return f;
      return {
        ...f,
        qualityRating: f.qualityRating > 0 ? f.qualityRating : cmsEntry.rating,
        isBirthingFriendly: f.isBirthingFriendly || cmsEntry.isBirthingFriendly,
      };
    });

    const filtered = enriched
      .filter((f) => {
        const combined = `${f.name} ${f.address} ${f.city} ${f.state} ${f.zip}`.toLowerCase();
        const matchesQ = !q || combined.includes(q);
        const matchesFriendly = friendlyOnly ? !!f.isBirthingFriendly : true;
        return matchesQ && matchesFriendly;
      })
      .sort((a, b) => (b.qualityRating || 0) - (a.qualityRating || 0));

    res.json({
      sourcePath: FACILITY_CSV_PATH,
      total: filtered.length,
      facilities: filtered,
    });
  } catch (error) {
    console.error('Failed to read facilities CSV:', error);
    res.status(500).json({ error: 'Failed to load facilities data' });
  }
});

// ML Model endpoints
app.get('/api/ml/model-info', (req, res) => {
  if (!modelMeta) {
    return res.status(404).json({ error: 'ML model not available' });
  }
  
  res.json({
    version: modelMeta.version,
    target: modelMeta.target,
    metrics: {
      test: modelMeta.test_metrics,
      validation: modelMeta.val_metrics,
      cv: {
        mean: modelMeta.cv_ap_mean,
        std: modelMeta.cv_ap_std
      }
    },
    thresholds: modelMeta.tier_thresholds,
    alertThreshold: modelMeta.alert_threshold,
    dataset: {
      totalRows: 4000,
      positiveRate: 0.1253,
      uniqueMembers: 500,
      features: 39
    }
  });
});

app.get('/api/ml/feature-importance', (req, res) => {
  if (!featureImportance) {
    return res.status(404).json({ error: 'Feature importance not available' });
  }
  
  res.json({
    features: featureImportance.map(f => ({
      name: f.feature,
      importance: parseFloat(f.importance_mean),
      std: parseFloat(f.importance_std)
    }))
  });
});

app.post('/api/ml/predict', (req, res) => {
  const { features } = req.body;
  
  if (!features) {
    return res.status(400).json({ error: 'Features required' });
  }

  const thresholds = getTierThresholds();

  try {
    const modelOutput = runPythonModelPrediction(features);
    if (modelOutput && Number.isFinite(Number(modelOutput.prediction))) {
      const prediction = Math.max(0.01, Math.min(0.99, Number(modelOutput.prediction)));
      const confidence = Number.isFinite(Number(modelOutput.confidence))
        ? Math.max(0.5, Math.min(0.99, Number(modelOutput.confidence)))
        : 0.8;

      return res.json({
        prediction,
        probability: Math.round(prediction * 100),
        riskTier: getRiskTier(prediction, thresholds),
        confidence,
        thresholds,
        source: 'python-joblib',
        features: modelOutput.features || features,
      });
    }
  } catch (error) {
    console.warn('⚠️ Python model inference failed, using fallback scorer:', error.message);
  }

  const fallback = scoreFallback(features);
  const prediction = fallback.prediction;

  res.json({
    prediction,
    probability: Math.round(prediction * 100),
    riskTier: getRiskTier(prediction, thresholds),
    confidence: fallback.confidence,
    thresholds,
    source: 'js-fallback',
    features: fallback.features,
  });
});

// ===== MCO DATA MANAGEMENT =====

const DATA_DIR = path.resolve(__dirname, './data');
const MCO_STORE_PATH = path.join(DATA_DIR, 'mco-submissions.json');

function emptyMcoStore() {
  return {
    submissions: [],
    mcoStats: {},
    lastUpdated: null,
  };
}

let mcoDataStore = emptyMcoStore();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function rebuildMcoStats(submissions) {
  const mcoStats = {};
  for (const submission of submissions) {
    const mcoId = submission.mcoId;
    if (!mcoStats[mcoId]) {
      mcoStats[mcoId] = {
        totalSubmissions: 0,
        lastSubmission: null,
        patients: [],
        riskDistribution: { Critical: 0, Reviewing: 0, Stable: 0 },
      };
    }
    const stats = mcoStats[mcoId];
    stats.totalSubmissions += 1;
    stats.lastSubmission = submission.submittedAt;
    stats.patients = Array.from(new Set([...(stats.patients || []), submission.patientId]));
    stats.riskDistribution[submission.status] = (stats.riskDistribution[submission.status] || 0) + 1;
  }
  return mcoStats;
}

async function loadMcoStore() {
  try {
    if (usingPostgres) {
      const submissions = await listMcoSubmissions();
      mcoDataStore = {
        submissions: submissions || [],
        mcoStats: rebuildMcoStats(submissions || []),
        lastUpdated: submissions?.length ? submissions[submissions.length - 1].submittedAt : null,
      };
      console.log(`Loaded ${mcoDataStore.submissions.length} stored MCO submissions from PostgreSQL`);
      return;
    }

    ensureDataDir();
    if (!fs.existsSync(MCO_STORE_PATH)) {
      mcoDataStore = emptyMcoStore();
      return;
    }

    const raw = fs.readFileSync(MCO_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    mcoDataStore = {
      submissions: parsed.submissions || [],
      mcoStats: parsed.mcoStats || {},
      lastUpdated: parsed.lastUpdated || null,
    };

    console.log(`✅ Loaded ${mcoDataStore.submissions.length} stored MCO submissions`);
  } catch (error) {
    console.error('⚠️ Failed to load MCO store, starting fresh:', error.message);
    mcoDataStore = emptyMcoStore();
  }
}

function persistMcoStore() {
  if (usingPostgres) return;
  try {
    ensureDataDir();
    fs.writeFileSync(MCO_STORE_PATH, JSON.stringify(mcoDataStore, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to persist MCO store:', error.message);
  }
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'y';
  }
  return false;
}

function normalizeHeatIndex(value) {
  const heat = Number(value);
  if (!Number.isFinite(heat)) return 0;
  return heat <= 1 ? Math.round(heat * 100) : heat;
}

function buildMlPrediction(features) {
  const thresholds = getTierThresholds();
  const fallback = scoreFallback(features);
  return {
    prediction: fallback.prediction,
    probability: Math.round(fallback.prediction * 100),
    riskTier: getRiskTier(fallback.prediction, thresholds),
    confidence: fallback.confidence,
    source: 'js-fallback',
  };
}

function getField(row, keys, fallback = undefined) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return fallback;
}

function computeStatus(clinical = {}) {
  if (clinical.sbp > 160 || clinical.dbp > 100 || clinical.smmCondition) return 'Critical';
  if (clinical.sbp > 140 || clinical.dbp > 90 || clinical.hypertension || clinical.diabetes) return 'Reviewing';
  return 'Stable';
}

function normalizeSubmission(input, source = 'mco-form') {
  const patientId = String(input.patientId || '').trim();
  const mcoId = String(input.mcoId || '').trim();

  const clinicalData = {
    sbp: toNumber(input?.clinicalData?.sbp),
    dbp: toNumber(input?.clinicalData?.dbp),
    hr: toNumber(input?.clinicalData?.hr),
    temp: toNumber(input?.clinicalData?.temp),
    rr: toNumber(input?.clinicalData?.rr),
    spo2: toNumber(input?.clinicalData?.spo2),
    bmi: toNumber(input?.clinicalData?.bmi),
    hypertension: toBoolean(input?.clinicalData?.hypertension),
    diabetes: toBoolean(input?.clinicalData?.diabetes),
    smmCondition: String(input?.clinicalData?.smmCondition || '').trim(),
    nicuProbability: toNumber(input?.clinicalData?.nicuProbability),
    nicuCategory: input?.clinicalData?.nicuCategory,
  };

  const environmentalData = {
    heatIslandIndex: toNumber(input?.environmentalData?.heatIslandIndex),
    aqi: toNumber(input?.environmentalData?.aqi),
    humidity: toNumber(input?.environmentalData?.humidity),
    pollutionLevel: String(input?.environmentalData?.pollutionLevel || '').trim(),
  };

  const resourceData = {
    foodDesert: toBoolean(input?.resourceData?.foodDesert),
    transportationAccess: toBoolean(input?.resourceData?.transportationAccess),
    healthcareFacilities: toNumber(input?.resourceData?.healthcareFacilities),
    communityCenters: toNumber(input?.resourceData?.communityCenters),
    emergencyServices: String(input?.resourceData?.emergencyServices || '').trim(),
    pharmacyAccess: String(input?.resourceData?.pharmacyAccess || '').trim(),
  };

  const status = input.status || computeStatus(clinicalData);

  return {
    id: `mco-${patientId || 'submission'}-${Date.now()}`,
    mcoId,
    patientId,
    name: String(input.name || '').trim(),
    age: toNumber(input.age),
    zipCode: String(input.zipCode || '').trim(),
    clinicalData,
    environmentalData,
    resourceData,
    status,
    estimatedSavings: toNumber(input.estimatedSavings) || 0,
    submittedAt: new Date().toISOString(),
    source,
  };
}

function normalizeFlatRow(row, defaultMcoId) {
  return normalizeSubmission({
    mcoId: getField(row, ['mcoId', 'mco_id'], defaultMcoId),
    patientId: getField(row, ['patientId', 'patient_id', 'member_id', 'id']),
    name: getField(row, ['name', 'patientName', 'patient_name'], ''),
    age: getField(row, ['age']),
    zipCode: getField(row, ['zipCode', 'zip', 'zipcode'], ''),
    clinicalData: {
      sbp: getField(row, ['sbp']),
      dbp: getField(row, ['dbp']),
      hr: getField(row, ['hr', 'heart_rate']),
      temp: getField(row, ['temp', 'temperature']),
      rr: getField(row, ['rr', 'respiratory_rate']),
      spo2: getField(row, ['spo2', 'spO2']),
      bmi: getField(row, ['bmi']),
      hypertension: getField(row, ['hypertension']),
      diabetes: getField(row, ['diabetes']),
      smmCondition: getField(row, ['smmCondition', 'smm_condition'], ''),
      nicuProbability: getField(row, ['nicuProbability', 'nicu_probability']),
      nicuCategory: getField(row, ['nicuCategory', 'nicu_category']),
    },
    environmentalData: {
      heatIslandIndex: getField(row, ['heatIslandIndex', 'heat_island_index']),
      aqi: getField(row, ['aqi']),
      humidity: getField(row, ['humidity']),
      pollutionLevel: getField(row, ['pollutionLevel', 'pollution_level'], ''),
    },
    resourceData: {
      foodDesert: getField(row, ['foodDesert', 'food_desert']),
      transportationAccess: getField(row, ['transportationAccess', 'transportation_access']),
      healthcareFacilities: getField(row, ['healthcareFacilities', 'healthcare_facilities']),
      communityCenters: getField(row, ['communityCenters', 'community_centers']),
      emergencyServices: getField(row, ['emergencyServices', 'emergency_services'], ''),
      pharmacyAccess: getField(row, ['pharmacyAccess', 'pharmacy_access'], ''),
    },
    status: getField(row, ['status']),
    estimatedSavings: getField(row, ['estimatedSavings', 'estimated_savings']),
  }, 'mco-upload');
}

function parseCsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const rows = [];
    Readable.from([buffer]).pipe(csvParser())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function parseDelimitedText(text, delimiter = ',') {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(delimiter).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((v) => v.trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });
}

function parseTxtBuffer(buffer) {
  const text = buffer.toString('utf8').trim();
  if (!text) return [];

  if (text.startsWith('{') || text.startsWith('[')) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  if (text.includes(',') && text.split(/\r?\n/)[0].includes(',')) {
    return parseDelimitedText(text, ',');
  }

  if (text.includes('\t') && text.split(/\r?\n/)[0].includes('\t')) {
    return parseDelimitedText(text, '\t');
  }

  const blocks = text.split(/\r?\n\r?\n+/).filter(Boolean);
  const rows = blocks.map((block) => {
    const row = {};
    block.split(/\r?\n/).forEach((line) => {
      const idx = line.indexOf(':');
      if (idx > -1) {
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (key) row[key] = value;
      }
    });
    return row;
  }).filter((row) => Object.keys(row).length > 0);

  return rows;
}

async function parseUploadedRows(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext === '.csv') return await parseCsvBuffer(file.buffer);
  if (ext === '.txt') return parseTxtBuffer(file.buffer);
  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }
  throw new Error('Unsupported file format. Use CSV, TXT, XLSX, or XLS.');
}

function upsertStats(submission) {
  const mcoId = submission.mcoId;
  if (!mcoDataStore.mcoStats[mcoId]) {
    mcoDataStore.mcoStats[mcoId] = {
      totalSubmissions: 0,
      lastSubmission: null,
      patients: [],
      riskDistribution: { Critical: 0, Reviewing: 0, Stable: 0 },
    };
  }

  const stats = mcoDataStore.mcoStats[mcoId];
  stats.totalSubmissions += 1;
  stats.lastSubmission = submission.submittedAt;
  stats.patients = Array.from(new Set([...(stats.patients || []), submission.patientId]));
  stats.riskDistribution[submission.status] = (stats.riskDistribution[submission.status] || 0) + 1;
}

async function storeSubmission(submission) {
  mcoDataStore.submissions.push(submission);
  upsertStats(submission);
  mcoDataStore.lastUpdated = new Date().toISOString();
  await saveMcoSubmission(submission);
}

await loadMcoStore();

// MCO Form Submission Endpoint
app.post('/api/mco/submit-data', async (req, res) => {
  try {
    const payload = req.body;
    const normalized = normalizeSubmission(payload, 'mco-form');

    if (!normalized.patientId || !normalized.mcoId) {
      return res.status(400).json({ error: 'Patient ID and MCO ID are required' });
    }

    await storeSubmission(normalized);
    persistMcoStore();

    console.log(`✅ MCO ${normalized.mcoId} submitted data for patient ${normalized.patientId}`);

    res.json({
      success: true,
      submissionId: normalized.id,
      message: 'Data submitted and stored successfully',
      status: normalized.status,
    });

  } catch (error) {
    console.error('Error processing MCO submission:', error);
    res.status(500).json({
      error: 'Failed to process submission',
      details: error.message,
    });
  }
});

// MCO File Upload Endpoint (CSV, TXT, XLSX/XLS)
app.post('/api/mco/upload-data', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const defaultMcoId = String(req.body.mcoId || 'MCO_UPLOAD').trim();
    const rows = await parseUploadedRows(req.file);

    if (!rows.length) {
      return res.status(400).json({ error: 'No rows found in uploaded file' });
    }

    const accepted = [];
    const rejected = [];

    for (const [index, row] of rows.entries()) {
      try {
        const submission = normalizeFlatRow(row, defaultMcoId);

        if (!submission.patientId) {
          throw new Error('Missing patientId/patient_id/member_id');
        }
        if (!submission.mcoId) {
          throw new Error('Missing mcoId');
        }

        await storeSubmission(submission);
        accepted.push(submission.id);
      } catch (error) {
        rejected.push({
          row: index + 1,
          reason: error.message,
        });
      }
    }

    persistMcoStore();

    res.json({
      success: true,
      message: 'File processed successfully',
      fileName: req.file.originalname,
      totalRows: rows.length,
      acceptedRows: accepted.length,
      rejectedRows: rejected.length,
      rejected,
    });

  } catch (error) {
    console.error('Error uploading MCO file:', error);
    res.status(500).json({
      error: 'Failed to process uploaded file',
      details: error.message,
    });
  }
});

// Get aggregated MCO data for dashboard
async function buildAggregatedDataPayload() {
  // Get CSV data
  const csvRows = await parseCsv();

  // Convert MCO submissions to board item format
  const mcoItems = mcoDataStore.submissions.map((submission) => {
    const clinical = submission.clinicalData || {};
    const environmental = submission.environmentalData || {};
    const resource = submission.resourceData || {};
    const sbp = Number(clinical.sbp) || 120;
    const dbp = Number(clinical.dbp) || 80;
    const map = Math.round((sbp + 2 * dbp) / 3);
    const pulsePressure = Math.max(20, sbp - dbp);
    const heatIndex = normalizeHeatIndex(environmental.heatIslandIndex);
    const aqi = Number(environmental.aqi) || 0;
    const ml = buildMlPrediction({
      sbp,
      dbp,
      map,
      pulse_pressure: pulsePressure,
      heat_island_index: heatIndex,
      age: Number(submission.age) || 28,
    });

    let status = submission.status || 'Stable';
    if (ml.riskTier === 'Critical' || sbp >= 160 || dbp >= 100 || clinical.smmCondition) {
      status = 'Critical';
    } else if (ml.riskTier === 'High' || ml.riskTier === 'Medium' || sbp >= 140 || dbp >= 90 || clinical.hypertension || clinical.diabetes || aqi >= 150) {
      status = 'Reviewing';
    }

    const nicuProbability = Number(clinical.nicuProbability) || ml.probability;
    let nicuCategory = clinical.nicuCategory || 'Low Prob';
    if (!clinical.nicuCategory) {
      if (nicuProbability > 70) nicuCategory = 'High Prob';
      else if (nicuProbability > 50) nicuCategory = 'Rising Prob';
    }
    const vitals = `BP ${sbp}/${dbp} | HR ${clinical.hr || 'N/A'} | AQI ${aqi || 'N/A'}`;
    const submittedDate = submission.submittedAt ? new Date(submission.submittedAt) : null;

    return {
      id: submission.id,
      name: submission.name || `Member ${submission.patientId}`,
      mrn: `MRN-${submission.patientId}`,
      status,
      triage: sbp >= 160 || status === 'Critical' ? '2 - Emergent' : sbp >= 140 || status === 'Reviewing' ? '3 - Urgent' : '4 - Less Urgent',
      riskRank: Math.round(ml.probability),
      assignee: null,
      lastVitals: vitals,
      updatesCount: status === 'Critical' ? 2 : 0,
      lastUpdated: submittedDate ? submittedDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Just submitted',
      caseData: {
        patientId: submission.patientId,
        age: String(submission.age || 'Unknown'),
        gestation: 'Unknown',
        parity: 'Unknown',
        chiefComplaint: clinical.smmCondition || 'MCO Submission',
        vitals,
        observedAt: submission.submittedAt,
        sbp,
        dbp,
        map,
        pulsePressure,
        hr: clinical.hr,
        temp: clinical.temp,
        rr: clinical.rr,
        spo2: clinical.spo2,
        bmi: clinical.bmi,
        hypertension: clinical.hypertension,
        diabetes: clinical.diabetes,
        ruleScore: ml.probability,
        eventWithin72h: ml.riskTier === 'Critical',
        foodDesert: resource.foodDesert,
        foodInsecurity: resource.foodDesert,
        transportationAccess: !resource.transportationAccess,
        transportationBarrier: resource.transportationAccess,
        healthcareFacilities: resource.healthcareFacilities,
        communityCenters: resource.communityCenters,
        emergencyServices: resource.emergencyServices,
        pharmacyAccess: resource.pharmacyAccess,
        heatIslandIndex: heatIndex,
        aqi,
        mcoId: submission.mcoId,
        source: submission.source || 'mco-submission',
        environmental: {
          zipCode: submission.zipCode || 'Unknown',
          airQuality: String(aqi || 'Unknown'),
          heatIndex,
          isHeatIsland: heatIndex >= 70,
          foodDesertStatus: resource.foodDesert,
          transportationDesertStatus: resource.transportationAccess,
          maternityCareDesert: Number(resource.healthcareFacilities || 0) === 0,
        },
      },
      nicuCategory,
      nicuProbability: Math.round(nicuProbability),
      smmCondition: clinical.smmCondition || (clinical.hypertension ? 'Hypertension' : clinical.diabetes ? 'Diabetes' : 'None'),
      ppcPre: nicuProbability < 30,
      ppcPost: nicuProbability < 40,
      estimatedSavings: Math.round(nicuProbability * 50 + (status === 'Critical' ? 500 : status === 'Reviewing' ? 250 : 100)),
      mcoId: submission.mcoId,
      source: submission.source || 'mco-submission',
      mlPrediction: ml,
    };
  });

  // Combine CSV data with MCO data
  const allItems = [...csvRows.map((r, i) => {
    const sbp = Number(r.sbp) || 0;
    const dbp = Number(r.dbp) || 0;
    const aqi = Number(r.aqi) || 0;
    const ruleScore = Number(r.rule_score) || 0;
    const event72h = r.event_within_72h === '1' || r.event_within_72h === 'true';

    let status = 'Stable';
    if (event72h || ruleScore > 50) status = 'Critical';
    else if (sbp > 160 || dbp > 100 || aqi > 150) status = 'Reviewing';

    let nicuCategory = 'Low Prob';
    let nicuProbability = Math.min(95, Math.max(5, ruleScore * 2));
    if (ruleScore > 70) {
      nicuCategory = 'High Prob';
      nicuProbability = Math.min(95, Math.max(70, ruleScore));
    } else if (ruleScore > 50) {
      nicuCategory = 'Rising Prob';
      nicuProbability = Math.min(69, Math.max(40, ruleScore));
    } else {
      nicuProbability = Math.max(5, Math.min(39, ruleScore));
    }

    const lastVitals = `BP ${sbp.toFixed(0)}/${dbp.toFixed(0)} | AQI ${aqi.toFixed(0)}`;
    const memberId = String(r.member_id || `UNKNOWN-${i + 1}`);
    const name = `Member ${memberId}`;
    const mrn = `MRN-${memberId}`;

    return {
      id: `csv-${i}`,
      name,
      mrn,
      status,
      triage: sbp > 160 ? '2 - Emergent' : sbp > 140 ? '3 - Urgent' : '4 - Less Urgent',
      riskRank: Math.round(ruleScore),
      assignee: null,
      lastVitals,
      updatesCount: event72h ? 3 : 0,
      lastUpdated: r.ts || 'Unknown',
      caseData: {
        patientId: memberId,
        age: r.age ? String(r.age) : 'Unknown',
        gestation: r.gestation || r.gestational_age || 'Unknown',
        parity: r.parity || 'Unknown',
        chiefComplaint: sbp > 160 ? 'Elevated blood pressure' : sbp > 140 ? 'Headache' : 'Routine visit',
        vitals: lastVitals,
        region: r.region,
        raceEthnicity: r.race_ethnicity,
        enrollmentDate: r.enrollment_date,
        pregnancyStartDate: r.pregnancy_start_date,
        deliveryDate: r.delivery_date,
        observedAt: r.ts,
        sbp,
        dbp,
        hrv: Number(r.hrv) || undefined,
        bmi: Number(r.bmi) || undefined,
        aqi,
        ruleScore,
        eventWithin72h: event72h,
        heatIslandIndex: Number(r.heat_island_index) || 0,
        environmental: {
          zipCode: r.zip || 'Unknown',
          airQuality: aqi.toString(),
          heatIndex: Number(r.temp_f) || 0,
        },
      },
      nicuCategory,
      nicuProbability: Math.round(nicuProbability),
      smmCondition: sbp > 160 ? 'Hypertension' : aqi > 150 ? 'Air Quality' : 'None',
      ppcPre: ruleScore < 30,
      ppcPost: ruleScore < 40,
      estimatedSavings: Math.round(ruleScore * 100),
      source: 'csv-data',
    };
  }), ...mcoItems];

  // Group by status for dashboard view
  const criticalItems = allItems.filter(i => i.status === 'Critical');
  const reviewingItems = allItems.filter(i => i.status === 'Reviewing');
  const stableItems = allItems.filter(i => i.status === 'Stable');

  const groups = [];
  if (criticalItems.length > 0) {
    groups.push({ id: 'g1', title: '🚨 72-Hour Critical Window', color: 'rose', items: criticalItems });
  }
  if (reviewingItems.length > 0) {
    groups.push({ id: 'g2', title: '⚠️ Elevated Monitoring', color: 'amber', items: reviewingItems });
  }
  if (stableItems.length > 0) {
    groups.push({ id: 'g3', title: '🛡️ Stable Members', color: 'emerald', items: stableItems });
  }

  return {
    groups: groups.length > 0 ? groups : [{ id: 'g0', title: 'All Members', color: 'indigo', items: allItems.slice(0, 20) }],
    stats: {
      totalPatients: allItems.length,
      csvPatients: csvRows.length,
      mcoPatients: mcoItems.length,
      mcoStats: mcoDataStore.mcoStats,
      lastUpdated: mcoDataStore.lastUpdated,
    },
  };
}

app.get('/api/mco/aggregated-data', async (_req, res) => {
  try {
    const payload = await buildAggregatedDataPayload();
    res.json(payload);
  } catch (error) {
    console.error('Error aggregating MCO data:', error);
    res.status(500).json({ error: 'Failed to aggregate data' });
  }
});

// Get MCO statistics
app.get('/api/mco/stats', (req, res) => {
  res.json({
    mcoStats: mcoDataStore.mcoStats,
    totalSubmissions: mcoDataStore.submissions.length,
    lastUpdated: mcoDataStore.lastUpdated,
    submissionsByMCO: Object.keys(mcoDataStore.mcoStats).map(mcoId => ({
      mcoId,
      ...mcoDataStore.mcoStats[mcoId]
    }))
  });
});

// Get raw stored submissions
app.get('/api/mco/submissions', (req, res) => {
  res.json({
    total: mcoDataStore.submissions.length,
    submissions: mcoDataStore.submissions,
  });
});

// ===== END MCO DATA MANAGEMENT =====

function normalizeChatType(value) {
  return value === 'ai' ? 'ai' : 'team';
}

app.post('/api/messaging/send', async (req, res) => {
  const { name, text, type, chatType: requestedChatType } = req.body;
  const normalizedChatType = normalizeChatType(requestedChatType);
  if (typeof text !== 'string' || !text.trim() || text.length > 4000) {
    return res.status(400).json({ error: 'Message text is required and must be 4,000 characters or fewer.' });
  }

  const message = await saveChatMessage({
    userId: req.currentUser.id,
    chatType: normalizedChatType,
    sender: normalizedChatType === 'team' ? 'team' : (req.body?.sender || 'user'),
    name: normalizedChatType === 'team' ? req.currentUser.name : (name || req.currentUser.name || 'Unknown'),
    text: text.trim(),
    type: type || 'message'
  });

  res.json({
    success: true,
    message: message
  });
});

app.get('/api/messaging/history', async (req, res) => {
  const chatType = normalizeChatType(req.query.chatType);
  res.json({
    messages: await listChatMessages(req.currentUser.id, chatType, Number(req.query.limit) || 50)
  });
});

app.post('/api/messaging/alert', async (req, res) => {
  const { patientName, mrn, riskTier, probability } = req.body;
  
  if (!patientName || !riskTier) {
    return res.status(400).json({ error: 'Patient name and risk tier required' });
  }

  const alertMessage = await saveChatMessage({
    userId: req.currentUser.id,
    chatType: 'team',
    sender: 'system',
    name: `Clinical Alert: ${riskTier} Risk`,
    text: `${patientName} (${mrn}) - Risk Tier: ${riskTier} - Probability: ${probability}%`,
    type: 'clinical-alert'
  });

  res.json({
    success: true,
    alert: alertMessage
  });
});

app.post('/api/messaging/clear-history', async (req, res) => {
  await clearChatMessages(req.currentUser.id, normalizeChatType(req.body?.chatType));
  res.json({ success: true, message: 'Conversation history cleared' });
});

app.get('/api/member-documents/recipients', async (req, res) => {
  try {
    const users = await getAllUsers();
    const recipients = users
      .filter(user => user.isActive && user.role !== 'Admin' && user.id !== req.currentUser.id)
      .map(({ id, name, role, department }) => ({ id, name, role, department }));
    res.json({ recipients });
  } catch (error) {
    console.error('Member document recipients failed to load:', error);
    res.status(500).json({ error: 'Could not load active care-team users.' });
  }
});

app.get('/api/member-documents', async (req, res) => {
  try {
    const documents = await listMemberDocuments(req.currentUser.id);
    res.json({
      documents: documents.map(document => ({
        id: document.id,
        ...decryptDocumentMetadata(document),
        mimeType: document.mimeType,
        byteSize: document.byteSize,
        uploadedAt: document.uploadedAt,
        uploaderName: document.uploaderName,
      })),
    });
  } catch (error) {
    console.error('Member document list failed to load:', error);
    res.status(500).json({ error: 'Could not load member documents.' });
  }
});

app.post('/api/member-documents/upload', (req, res, next) => {
  upload.single('file')(req, res, error => {
    if (!error) return next();
    const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? 'Files must be 10 MB or smaller.' : error.message || 'Could not receive the uploaded file.',
    });
  });
}, async (req, res) => {
  const file = req.file;
  const memberRef = typeof req.body?.memberRef === 'string' ? req.body.memberRef.trim() : '';
  if (!file) return res.status(400).json({ error: 'Choose a document to upload.' });
  if (!memberRef || memberRef.length > 120) {
    return res.status(400).json({ error: 'Enter a member name or ID (up to 120 characters).' });
  }

  const extension = path.extname(file.originalname).toLowerCase();
  const documentType = DOCUMENT_TYPES[extension];
  if (!documentType) {
    return res.status(415).json({ error: 'Upload a PDF, DOCX, TXT, or CSV file.' });
  }
  const acceptedMimeTypes = [documentType.mimeType, 'application/octet-stream'];
  if (extension === '.csv') acceptedMimeTypes.push('application/vnd.ms-excel');
  if (!acceptedMimeTypes.includes(file.mimetype)) {
    return res.status(415).json({ error: 'The file contents do not match the selected document type.' });
  }
  if (extension === '.pdf' && !file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    return res.status(400).json({ error: 'This file is not a valid PDF.' });
  }
  if (extension === '.docx' && !file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    return res.status(400).json({ error: 'This file is not a valid DOCX document.' });
  }

  let sharedWith = [];
  try {
    sharedWith = req.body?.sharedWith ? JSON.parse(req.body.sharedWith) : [];
  } catch {
    return res.status(400).json({ error: 'The selected sharing list is invalid.' });
  }
  if (!Array.isArray(sharedWith) || sharedWith.length > 50 || sharedWith.some(id => typeof id !== 'string')) {
    return res.status(400).json({ error: 'Choose up to 50 active care-team users to share with.' });
  }
  const recipientIds = [...new Set(sharedWith)].filter(id => id !== req.currentUser.id);
  try {
    const users = await getAllUsers();
    const activeUserIds = new Set(users
      .filter(user => user.isActive && user.role !== 'Admin')
      .map(user => user.id));
    if (recipientIds.some(id => !activeUserIds.has(id))) {
      return res.status(400).json({ error: 'One or more selected users are no longer active.' });
    }

    const extractedText = await extractDocumentText(file.buffer, extension);
    const encryptedFile = encryptDocumentData(file.buffer);
    const encryptedText = encryptDocumentData(Buffer.from(extractedText, 'utf8'));
    const safeFileName = path.basename(file.originalname)
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .slice(0, 180) || `member-document${extension}`;
    const encryptedMetadata = encryptDocumentData(Buffer.from(JSON.stringify({
      fileName: safeFileName,
      memberRef,
    }), 'utf8'));
    const document = {
      id: crypto.randomUUID(),
      uploadedBy: req.currentUser.id,
      memberRef: 'encrypted',
      fileName: `member-document${extension}`,
      mimeType: documentType.mimeType,
      byteSize: file.size,
      metadataIv: encryptedMetadata.iv,
      metadataTag: encryptedMetadata.tag,
      metadataData: encryptedMetadata.data,
      contentIv: encryptedFile.iv,
      contentTag: encryptedFile.tag,
      contentData: encryptedFile.data,
      textIv: encryptedText.iv,
      textTag: encryptedText.tag,
      textData: encryptedText.data,
      createdAt: new Date().toISOString(),
    };
    await saveMemberDocument(document, recipientIds);
    res.status(201).json({
      document: {
        id: document.id,
        memberRef,
        fileName: safeFileName,
        mimeType: document.mimeType,
        byteSize: document.byteSize,
        uploadedAt: document.createdAt,
        uploaderName: req.currentUser.name,
      },
    });
  } catch (error) {
    if (error instanceof DocumentInputError) {
      return res.status(422).json({ error: error.message });
    }
    console.error('Member document upload failed:', error);
    res.status(500).json({
      error: process.env.NODE_ENV === 'production' && !process.env.DOCUMENT_STORAGE_KEY
        ? 'Secure document storage is not configured. Contact your administrator.'
        : 'The document could not be stored securely.',
    });
  }
});

app.get('/api/member-documents/:id/download', async (req, res) => {
  try {
    const document = await getAccessibleMemberDocument(req.params.id, req.currentUser.id);
    if (!document) return res.status(404).json({ error: 'Document not found.' });
    const content = decryptDocumentData(document.content_data, document.content_iv, document.content_tag);
    const metadata = decryptDocumentMetadata(document);
    res.setHeader('Content-Type', document.mime_type);
    res.setHeader('Content-Length', document.byte_size);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(metadata.fileName)}`);
    res.send(content);
  } catch (error) {
    console.error('Member document download failed:', error);
    res.status(500).json({ error: 'The document could not be opened.' });
  }
});

app.post('/api/member-documents/chat', async (req, res) => {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  const documentId = req.body?.documentId === 'all' ? null : req.body?.documentId;
  if (!question || question.length > 1000) {
    return res.status(400).json({ error: 'Enter a question up to 1,000 characters.' });
  }
  if (documentId !== null && typeof documentId !== 'string') {
    return res.status(400).json({ error: 'Choose a valid document.' });
  }

  try {
    const documents = documentId
      ? [await getAccessibleMemberDocument(documentId, req.currentUser.id)].filter(Boolean)
      : await listAccessibleMemberDocumentContent(req.currentUser.id, 100);
    if (documentId && documents.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    if (documents.length === 0) {
      return res.json({
        answer: 'No documents are available to you yet. Upload a document or ask its owner to share it with you.',
        matches: [],
        documentsSearched: 0,
      });
    }

    const stopWords = new Set(['the', 'and', 'for', 'are', 'was', 'were', 'with', 'from', 'that', 'this', 'have', 'has', 'what', 'when', 'where', 'which', 'who', 'how', 'can', 'could', 'would', 'should', 'about', 'into', 'does', 'did', 'please', 'show', 'find', 'tell', 'me']);
    const terms = [...new Set(question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])]
      .filter(term => !stopWords.has(term));
    if (terms.length === 0) {
      return res.status(400).json({ error: 'Please include a specific name, topic, or phrase in your question.' });
    }

    const matches = [];
    for (const document of documents) {
      const metadata = decryptDocumentMetadata(document);
      const text = decryptDocumentData(document.text_data, document.text_iv, document.text_tag).toString('utf8');
      const ranked = text.split(/[\r\n.!?]+/)
        .map(sentence => sentence.trim())
        .filter(Boolean)
        .map(sentence => ({
          sentence,
          score: terms.reduce((score, term) => score + (sentence.toLowerCase().includes(term) ? 1 : 0), 0),
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);
      for (const item of ranked) {
        matches.push({
          score: item.score,
          documentId: document.id,
          fileName: metadata.fileName,
          memberRef: metadata.memberRef,
          excerpt: item.sentence.slice(0, 900),
        });
      }
    }
    matches.sort((a, b) => b.score - a.score);
    const results = matches.slice(0, 8).map(({ score, ...match }) => match);
    res.json({
      answer: results.length
        ? 'I searched only documents you are allowed to access. These passages best match your question:'
        : 'I could not find a matching passage in the documents you can access. Try different keywords or choose another document.',
      matches: results,
      documentsSearched: documents.length,
    });
  } catch (error) {
    console.error('Member document chat failed:', error);
    res.status(500).json({ error: 'Could not search the accessible member documents.' });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, context } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on server' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `
You are Nyota Clinical AI Assistant for maternal health care teams.

Instructions:
- Be specific and practical.
- Keep response concise (3-6 sentences) unless user asks for detail.
- If clinical risk appears high, clearly suggest escalation.
- Do not output markdown tables.

Recent context:
${typeof context === 'string' ? context : ''}

User message:
${message}
`;

    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-3-pro-preview',
    ];

    let response = null;
    let selectedModel = '';
    let lastModelError = null;
    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        selectedModel = modelName;
        break;
      } catch (modelError) {
        lastModelError = modelError;
      }
    }

    if (!response) {
      throw lastModelError || new Error('No Gemini model succeeded');
    }

    let text = 'I could not generate a response right now. Please try again.';
    if (response?.candidates?.length) {
      const parts = response.candidates[0]?.content?.parts || [];
      const joined = parts.map((p) => p.text || '').join('\n').trim();
      if (joined) text = joined;
    }

    return res.json({ reply: text, model: selectedModel });
  } catch (error) {
    console.error('AI chat endpoint error:', error);
    const status = Number(error?.status || error?.code) || 500;
    const message =
      status === 429
        ? 'Gemini quota exceeded for this key. Wait briefly or use a key/project with available quota.'
        : 'Failed to generate AI response';
    return res.status(status).json({
      error: message,
      details: error?.message || 'Unknown error',
    });
  }
});

// ===== END MESSAGING API =====

// ===== AUTH & USER MANAGEMENT =====

function getJwtSecret() {
  return process.env.JWT_SECRET || 'nyota-jwt-secret-dev-only-change-in-production';
}

function requireAuth(roles) {
  return async (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = auth.slice(7);
    try {
      const payload = jwt.verify(token, getJwtSecret());
      const user = await getUserById(payload.userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }
      if (isUserTrialExpired(user)) {
        return res.status(402).json({ error: 'Your 30-day trial has ended. Contact Nyota Health to activate your account.' });
      }
      req.user = payload;
      req.currentUser = user;
      if (roles && roles.length > 0 && !roles.includes(user.access_level)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

function toAuthUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accessLevel: user.access_level,
    department: user.department || '',
    initials: user.initials || '',
    color: user.color || 'bg-teal-600',
    subscriptionStatus: user.subscription_status || 'active',
    trialEndsAt: user.trial_ends_at || null,
    trialDaysRemaining: publicUser(user)?.trialDaysRemaining ?? null,
    dashboardAccess: user.dashboard_access || null,
    communityCareAccess: Boolean(user.community_care_access),
  };
}

function issueAuthResponse(res, user) {
  const payload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accessLevel: user.access_level,
    department: user.department,
    initials: user.initials,
    color: user.color,
    subscriptionStatus: user.subscription_status || 'active',
  };
  const expiresInSeconds = getTokenTtlSeconds(user);
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: expiresInSeconds });
  res.json({ token, user: toAuthUser(user) });
}

function getTokenTtlSeconds(user) {
  const defaultTtlSeconds = 8 * 60 * 60;
  if (user.subscription_status !== 'trialing' || !user.trial_ends_at) {
    return defaultTtlSeconds;
  }

  const secondsUntilTrialEnds = Math.floor((new Date(user.trial_ends_at).getTime() - Date.now()) / 1000);
  return Math.max(1, Math.min(defaultTtlSeconds, secondsUntilTrialEnds));
}

// POST /api/auth/register - create a 30-day trial account
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (await getUserByEmail(email)) {
    return res.status(409).json({ error: 'Email address is already in use' });
  }

  try {
    const user = await createTrialUser({ name, email, password });
    issueAuthResponse(res, await getUserById(user.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (isUserTrialExpired(user)) {
    return res.status(402).json({ error: 'Your 30-day trial has ended. Contact Nyota Health to activate your account.' });
  }
  issueAuthResponse(res, user);
});

// GET /api/auth/me  – validate stored token and return current user
app.get('/api/auth/me', requireAuth([]), async (req, res) => {
  const user = await getUserById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (isUserTrialExpired(user)) {
    return res.status(402).json({ error: 'Your 30-day trial has ended. Contact Nyota Health to activate your account.' });
  }
  res.json(toAuthUser(user));
});

// GET /api/users  – list all users (admin + supervisor)
app.get('/api/users', requireAuth(['admin', 'supervisor']), async (req, res) => {
  res.json(await getAllUsers());
});

// POST /api/users  – create user (admin only)
app.post('/api/users', requireAuth(['admin']), async (req, res) => {
  const { name, email, password, role, accessLevel, department, initials, color, dashboardAccess, communityCareAccess } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role are required' });
  }
  if (await getUserByEmail(email)) {
    return res.status(409).json({ error: 'Email address is already in use' });
  }
  try {
    const user = await createUser({
      name, email, password, role, accessLevel, department, initials, color,
      dashboardAccess, communityCareAccess,
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id  – update user (admin only)
app.put('/api/users/:id', requireAuth(['admin']), async (req, res) => {
  const user = await updateUser(req.params.id, req.body || {});
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// DELETE /api/users/:id  – soft-delete user (admin only)
app.delete('/api/users/:id', requireAuth(['admin']), async (req, res) => {
  if (req.params.id === req.user.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  await deactivateUser(req.params.id);
  res.json({ success: true });
});

// ===== END AUTH & USER MANAGEMENT =====

  // ===== CAREFORCE DIRECTORY =====

  const CAREFORCE_ROLES = ['CHW', 'Doula', 'Midwife', 'Nurse', 'MD', 'Specialist',
    'OB/GYN Attending', 'Charge Nurse', 'Care Navigator', 'Clinical Coordinator'];

  // GET /api/careforce – list careforce members (any authenticated user)
  app.get('/api/careforce', requireAuth([]), async (req, res) => {
    try {
      const allUsers = await getAllUsers();
      const positions = [
        { top: '50%', left: '40%' }, { top: '30%', left: '70%' },
        { top: '65%', left: '25%' }, { top: '20%', left: '60%' },
        { top: '75%', left: '80%' }, { top: '45%', left: '15%' },
        { top: '35%', left: '45%' }, { top: '60%', left: '55%' },
      ];
      const statusCycle = ['active', 'active', 'available', 'offline'];
      const activityCycle = ['2m ago', '14m ago', '5m ago', '1h ago', '4h ago', '8m ago', '22m ago', '3h ago'];
      const programMap = {
        'CHW':              'TMaH Pillar 3',
        'Doula':            'Continuous Support',
        'Midwife':          'Midwife Connect',
        'Nurse':            'Postpartum Surge',
        'MD':               'Specialty Access',
        'Specialist':       'Specialty Access',
        'OB/GYN Attending': 'Clinical Services',
        'Charge Nurse':     'Labor & Delivery',
        'Care Navigator':   'MCO Navigation',
        'Clinical Coordinator': 'Care Coordination',
      };

      const members = allUsers
        .filter(u => u.isActive && CAREFORCE_ROLES.includes(u.role))
        .map((u, idx) => ({
          id:            u.id,
          name:          u.name,
          role:          u.role,
          status:        statusCycle[idx % statusCycle.length],
          caseload:      10 + (idx * 7) % 11,
          maxCapacity:   u.role === 'MD' || u.role === 'OB/GYN Attending' ? 100 : 20,
          coverageArea:  [],
          rating:        Math.round((4.5 + (idx % 5) * 0.1) * 10) / 10,
          benefitProgram: programMap[u.role] || u.department || 'TMaH',
          initials:      u.initials || u.name.substring(0, 2).toUpperCase(),
          color:         u.color || 'bg-teal-600',
          lastActivity:  activityCycle[idx % activityCycle.length],
          department:    u.department || '',
          mapPosition:   positions[idx % positions.length],
        }));

      // Role distribution for network stats chart
      const roleCounts = {};
      members.forEach(m => {
        const group = ['CHW'].includes(m.role) ? 'CHW'
          : ['Doula'].includes(m.role) ? 'Doulas'
          : ['Nurse', 'Charge Nurse'].includes(m.role) ? 'Nurses'
          : ['MD', 'OB/GYN Attending', 'Specialist'].includes(m.role) ? 'MDs'
          : ['Midwife'].includes(m.role) ? 'Midwives'
          : 'Other';
        roleCounts[group] = (roleCounts[group] || 0) + 1;
      });

      // Recent activities derived from MCO submissions
      const recentActivities = [];
      const activeMem = members.filter(m => m.status === 'active');
      const subs = (mcoDataStore.submissions || []).slice(-3);
      subs.forEach((sub, i) => {
        const mem = activeMem[i % Math.max(1, activeMem.length)];
        if (!mem) return;
        recentActivities.push({
          id:         `act-${i}`,
          memberId:   mem.id,
          memberName: mem.name,
          action:     sub.clinicalData?.smmCondition
            ? `SMM Alert Responded: ${sub.clinicalData.smmCondition}`
            : 'Member Check-in Completed',
          location: sub.zipCode ? `Zip ${sub.zipCode}` : 'Telehealth',
          timestamp: sub.submittedAt
            ? new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Recently',
        });
      });
      // Always have at least a couple of entries for new installs
      if (recentActivities.length === 0 && members.length > 0) {
        recentActivities.push(
          { id: 'act-0', memberId: members[0].id, memberName: members[0].name, action: 'Birth Plan Sync Complete',    location: 'Telehealth', timestamp: '10m ago' },
          { id: 'act-1', memberId: members[1 % members.length].id, memberName: members[1 % members.length].name, action: 'Uber Health Dispatched', location: 'Field', timestamp: '15m ago' }
        );
      }

      res.json({ members, recentActivities, roleCounts });
    } catch (err) {
      console.error('Careforce endpoint error:', err);
      res.status(500).json({ error: 'Failed to load careforce data' });
    }
  });

  // GET /api/hedis – HEDIS metrics computed from board data (any authenticated user)
  app.get('/api/hedis', requireAuth([]), async (req, res) => {
    try {
      const data = await buildAggregatedDataPayload();
      const items = (data.groups || []).flatMap(g => g.items);

      const total = items.length;
      if (total === 0) {
        return res.json({ metrics: [], memberGaps: [], totalWithhold: 4200000, atRiskAmount: 4200000 });
      }

      const ppcPreCount  = items.filter(i => i.ppcPre).length;
      const ppcPostCount = items.filter(i => i.ppcPost).length;
      // PND/PDS approximated from risk bands (low-risk members likely screened)
      const pndCount = Math.floor(total * 0.84);
      const pdsCount = Math.floor(total * (ppcPostCount / total) * 0.80);

      const ppcPreRate  = Math.round(ppcPreCount  / total * 100);
      const ppcPostRate = Math.round(ppcPostCount / total * 100);
      const pndRate     = Math.round(pndCount / total * 100);
      const pdsRate     = Math.round(pdsCount / total * 100);

      const metrics = [
        { id: '1', name: 'PPC-Pre: Timeliness of Prenatal Care',   code: 'PPC-Pre',  currentRate: ppcPreRate,  goal: 90, trend:  2.1, status: ppcPreRate  >= 90 ? 'on-track' : ppcPreRate  >= 80 ? 'at-risk' : 'failing', numerator: ppcPreCount,  denominator: total },
        { id: '2', name: 'PPC-Post: Postpartum Care (Day 7-84)',    code: 'PPC-Post', currentRate: ppcPostRate, goal: 85, trend: -1.4, status: ppcPostRate >= 85 ? 'on-track' : ppcPostRate >= 70 ? 'at-risk' : 'failing', numerator: ppcPostCount, denominator: total },
        { id: '3', name: 'PND-E: Prenatal Depression Screening',    code: 'PND-E',    currentRate: pndRate,     goal: 80, trend:  0.8, status: pndRate     >= 80 ? 'on-track' : 'at-risk',                                  numerator: pndCount,     denominator: total },
        { id: '4', name: 'PDS-E: Postpartum Depression Screening',  code: 'PDS-E',    currentRate: pdsRate,     goal: 80, trend: -4.2, status: pdsRate     >= 80 ? 'on-track' : 'at-risk',                                  numerator: pdsCount,     denominator: total },
      ];

      const failingCount = metrics.filter(m => m.status !== 'on-track').length;
      const atRiskAmount = Math.round(4200000 * failingCount / metrics.length);

      const memberGaps = items
        .filter(i => !i.ppcPost && (i.status === 'Critical' || i.status === 'Reviewing'))
        .sort((a, b) => b.riskRank - a.riskRank)
        .slice(0, 5)
        .map((item, idx) => ({
          id:  item.id,
          name: item.name,
          mrn:  item.mrn,
          metric: idx % 2 === 0 ? 'PPC-Post' : 'PDS-E',
          daysRemaining: Math.max(7, Math.round(item.riskRank / 5)),
          status: item.status === 'Critical' ? 'critical' : 'warning',
          prescriptiveAction: item.riskRank > 60
            ? 'Schedule Uber Health Transport + Postpartum Visit'
            : 'Trigger Telehealth Postpartum Check-in',
        }));

      res.json({ metrics, memberGaps, totalWithhold: 4200000, atRiskAmount });
    } catch (err) {
      console.error('HEDIS endpoint error:', err);
      res.status(500).json({ error: 'Failed to compute HEDIS metrics' });
    }
  });

  // ===== END CAREFORCE & HEDIS =====

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nyota-api' });
  });

  const DIST_PATH = path.resolve(__dirname, './dist');
  if (fs.existsSync(DIST_PATH)) {
    app.use(express.static(DIST_PATH));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      return res.sendFile(path.join(DIST_PATH, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3009;
  app.listen(PORT, () => console.log(`server listening on ${PORT}`));
