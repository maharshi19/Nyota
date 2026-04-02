import express from 'express';
import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
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
  updateUser,
  deactivateUser,
  verifyPassword,
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

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
      nicuProbability = Math.min(95, 70 + Math.random() * 25); // 70-95%
    } else if (ruleScore > 50) {
      nicuCategory = 'Rising Prob';
      nicuProbability = Math.min(69, 40 + Math.random() * 30); // 40-69%
    } else {
      nicuProbability = Math.max(5, Math.random() * 39); // 5-39%
    }
    
    const lastVitals = `BP ${sbp.toFixed(0)}/${dbp.toFixed(0)} | AQI ${aqi.toFixed(0)}`;
    const name = `Member ${r.member_id.substring(0, 4).toUpperCase()}`;
    const mrn = `MRN-${String(i + 1000).slice(-5)}`;
    
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
      lastUpdated: '5m ago',
      caseData: {
        ssn: `5${String(i).padStart(2, '0')}-XX-XXXX`,
        age: String(Math.floor(Math.random() * 25 + 18)),
        gestation: String(Math.floor(Math.random() * 6 + 24)) + 'w' + String(Math.floor(Math.random() * 7)) + 'd',
        parity: 'G' + String(Math.floor(Math.random() * 4 + 1)) + 'P' + String(Math.floor(Math.random() * 3)),
        chiefComplaint: sbp > 160 ? 'Elevated blood pressure' : sbp > 140 ? 'Headache' : 'Routine visit',
        vitals: lastVitals,
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
      estimatedSavings: Math.round(ruleScore * 100 + Math.random() * 500),
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

function loadMcoStore() {
  try {
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
    id: `mco-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
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

function storeSubmission(submission) {
  mcoDataStore.submissions.push(submission);
  upsertStats(submission);
  mcoDataStore.lastUpdated = new Date().toISOString();
}

loadMcoStore();

// MCO Form Submission Endpoint
app.post('/api/mco/submit-data', (req, res) => {
  try {
    const payload = req.body;
    const normalized = normalizeSubmission(payload, 'mco-form');

    if (!normalized.patientId || !normalized.mcoId) {
      return res.status(400).json({ error: 'Patient ID and MCO ID are required' });
    }

    storeSubmission(normalized);
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

    rows.forEach((row, index) => {
      try {
        const submission = normalizeFlatRow(row, defaultMcoId);

        if (!submission.patientId) {
          throw new Error('Missing patientId/patient_id/member_id');
        }
        if (!submission.mcoId) {
          throw new Error('Missing mcoId');
        }

        storeSubmission(submission);
        accepted.push(submission.id);
      } catch (error) {
        rejected.push({
          row: index + 1,
          reason: error.message,
        });
      }
    });

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

    // Calculate risk status
    let status = 'Stable';
    if (clinical.sbp > 160 || clinical.dbp > 100 || clinical.smmCondition) {
      status = 'Critical';
    } else if (clinical.sbp > 140 || clinical.dbp > 90 || clinical.hypertension || clinical.diabetes) {
      status = 'Reviewing';
    }

    // Calculate NICU probability based on clinical data
    let nicuProbability = 25; // Base probability
    if (clinical.sbp > 160) nicuProbability += 40;
    else if (clinical.sbp > 140) nicuProbability += 20;
    if (clinical.diabetes) nicuProbability += 15;
    if (clinical.hypertension) nicuProbability += 10;
    if (environmental.heatIslandIndex > 0.7) nicuProbability += 10;
    nicuProbability = Math.min(95, Math.max(5, nicuProbability));

    let nicuCategory = 'Low Prob';
    if (nicuProbability > 70) nicuCategory = 'High Prob';
    else if (nicuProbability > 50) nicuCategory = 'Rising Prob';

    return {
      id: submission.id,
      name: submission.name || `Patient ${submission.patientId}`,
      mrn: `MCO-${submission.patientId}`,
      status,
      triage: clinical.sbp > 160 ? '2 - Emergent' : clinical.sbp > 140 ? '3 - Urgent' : '4 - Less Urgent',
      riskRank: Math.round(nicuProbability),
      assignee: null,
      lastVitals: `BP ${clinical.sbp || 'N/A'}/${clinical.dbp || 'N/A'} | HR ${clinical.hr || 'N/A'}`,
      updatesCount: status === 'Critical' ? 2 : 0,
      lastUpdated: 'Just submitted',
      caseData: {
        ssn: `MCO-${submission.patientId}`,
        age: String(submission.age || 'Unknown'),
        gestation: 'Unknown',
        parity: 'Unknown',
        chiefComplaint: clinical.smmCondition || 'MCO Submission',
        vitals: `BP ${clinical.sbp || 'N/A'}/${clinical.dbp || 'N/A'} | HR ${clinical.hr || 'N/A'}`,
        environmental: {
          zipCode: submission.zipCode || 'Unknown',
          airQuality: String(environmental.aqi || 'Unknown'),
          heatIndex: environmental.heatIslandIndex || 0,
        },
        hypertension: clinical.hypertension,
        diabetes: clinical.diabetes,
        foodDesert: resource.foodDesert,
        transportationAccess: resource.transportationAccess,
        heatIslandIndex: environmental.heatIslandIndex,
        aqi: environmental.aqi,
      },
      nicuCategory,
      nicuProbability: Math.round(nicuProbability),
      smmCondition: clinical.smmCondition || (clinical.hypertension ? 'Hypertension' : clinical.diabetes ? 'Diabetes' : 'None'),
      ppcPre: nicuProbability < 30,
      ppcPost: nicuProbability < 40,
      estimatedSavings: Math.round(nicuProbability * 50 + Math.random() * 200),
      mcoId: submission.mcoId,
      source: submission.source || 'mco-submission',
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
      nicuProbability = Math.min(95, 70 + Math.random() * 25);
    } else if (ruleScore > 50) {
      nicuCategory = 'Rising Prob';
      nicuProbability = Math.min(69, 40 + Math.random() * 30);
    } else {
      nicuProbability = Math.max(5, Math.random() * 39);
    }

    const lastVitals = `BP ${sbp.toFixed(0)}/${dbp.toFixed(0)} | AQI ${aqi.toFixed(0)}`;
    const name = `Member ${r.member_id.substring(0, 4).toUpperCase()}`;
    const mrn = `MRN-${String(i + 1000).slice(-5)}`;

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
      lastUpdated: '5m ago',
      caseData: {
        ssn: `5${String(i).padStart(2, '0')}-XX-XXXX`,
        age: String(Math.floor(Math.random() * 25 + 18)),
        gestation: String(Math.floor(Math.random() * 6 + 24)) + 'w' + String(Math.floor(Math.random() * 7)) + 'd',
        parity: 'G' + String(Math.floor(Math.random() * 4 + 1)) + 'P' + String(Math.floor(Math.random() * 3)),
        chiefComplaint: sbp > 160 ? 'Elevated blood pressure' : sbp > 140 ? 'Headache' : 'Routine visit',
        vitals: lastVitals,
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
      estimatedSavings: Math.round(ruleScore * 100 + Math.random() * 500),
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

// In-memory message store (in production, use database)
let conversationHistory = [];

app.post('/api/messaging/send', (req, res) => {
  const { sender, name, text, type } = req.body;
  
  if (!text || !sender) {
    return res.status(400).json({ error: 'Message text and sender required' });
  }

  const message = {
    id: Date.now().toString(),
    sender: sender,
    name: name || 'Unknown',
    text: text,
    timestamp: new Date(),
    type: type || 'message'
  };

  conversationHistory.push(message);
  
  // Keep only last 100 messages
  if (conversationHistory.length > 100) {
    conversationHistory = conversationHistory.slice(-100);
  }

  res.json({
    success: true,
    message: message
  });
});

app.get('/api/messaging/history', (req, res) => {
  res.json({
    messages: conversationHistory.slice(-50) // Return last 50 messages
  });
});

app.post('/api/messaging/alert', (req, res) => {
  const { patientName, mrn, riskTier, probability } = req.body;
  
  if (!patientName || !riskTier) {
    return res.status(400).json({ error: 'Patient name and risk tier required' });
  }

  const alertMessage = {
    id: Date.now().toString(),
    sender: 'system',
    name: `Clinical Alert: ${riskTier} Risk`,
    text: `${patientName} (${mrn}) - Risk Tier: ${riskTier} - Probability: ${probability}%`,
    timestamp: new Date(),
    type: 'clinical-alert'
  };

  conversationHistory.push(alertMessage);

  res.json({
    success: true,
    alert: alertMessage
  });
});

app.post('/api/messaging/clear-history', (req, res) => {
  conversationHistory = [];
  res.json({ success: true, message: 'Conversation history cleared' });
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
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = auth.slice(7);
    try {
      const payload = jwt.verify(token, getJwtSecret());
      req.user = payload;
      if (roles && roles.length > 0 && !roles.includes(payload.accessLevel)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const payload = {
    userId:      user.id,
    name:        user.name,
    email:       user.email,
    role:        user.role,
    accessLevel: user.access_level,
    department:  user.department,
    initials:    user.initials,
    color:       user.color,
  };
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '8h' });
  res.json({
    token,
    user: {
      id:          user.id,
      name:        user.name,
      email:       user.email,
      role:        user.role,
      accessLevel: user.access_level,
      department:  user.department  || '',
      initials:    user.initials    || '',
      color:       user.color       || 'bg-teal-600',
    },
  });
});

// GET /api/auth/me  – validate stored token and return current user
app.get('/api/auth/me', requireAuth([]), (req, res) => {
  const user = getUserById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id:          user.id,
    name:        user.name,
    email:       user.email,
    role:        user.role,
    accessLevel: user.access_level,
    department:  user.department  || '',
    initials:    user.initials    || '',
    color:       user.color       || 'bg-teal-600',
  });
});

// GET /api/users  – list all users (admin + supervisor)
app.get('/api/users', requireAuth(['admin', 'supervisor']), (req, res) => {
  res.json(getAllUsers());
});

// POST /api/users  – create user (admin only)
app.post('/api/users', requireAuth(['admin']), (req, res) => {
  const { name, email, password, role, accessLevel, department, initials, color } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role are required' });
  }
  if (getUserByEmail(email)) {
    return res.status(409).json({ error: 'Email address is already in use' });
  }
  try {
    const user = createUser({ name, email, password, role, accessLevel, department, initials, color });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id  – update user (admin only)
app.put('/api/users/:id', requireAuth(['admin']), (req, res) => {
  const user = updateUser(req.params.id, req.body || {});
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// DELETE /api/users/:id  – soft-delete user (admin only)
app.delete('/api/users/:id', requireAuth(['admin']), (req, res) => {
  if (req.params.id === req.user.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  deactivateUser(req.params.id);
  res.json({ success: true });
});

// ===== END AUTH & USER MANAGEMENT =====

  // ===== CAREFORCE DIRECTORY =====

  const CAREFORCE_ROLES = ['CHW', 'Doula', 'Midwife', 'Nurse', 'MD', 'Specialist',
    'OB/GYN Attending', 'Charge Nurse', 'Care Navigator', 'Clinical Coordinator'];

  // GET /api/careforce – list careforce members (any authenticated user)
  app.get('/api/careforce', requireAuth([]), (req, res) => {
    try {
      const allUsers = getAllUsers();
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
