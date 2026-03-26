import express from 'express';
import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

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

try {
  console.log('Loading ML model...');
  modelMeta = JSON.parse(fs.readFileSync(path.join(__dirname, '../models_senior_v4/meta.json'), 'utf8'));
  console.log('✅ ML model metadata loaded');
  
  // Load feature importance
  const importanceData = [];
  fs.createReadStream(path.join(__dirname, '../models_senior_v4/perm_importance_test.csv'))
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

// adjust this path if your csv lives elsewhere
const CSV_PATH = path.resolve(__dirname, '../nyota-api-local/maternal_data.csv');
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
    // Use aggregated data that includes both CSV and MCO submissions
    const response = await fetch('http://localhost:3009/api/mco/aggregated-data');
    const data = await response.json();
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
  // Simulate ML prediction for demo purposes
  // In production, you'd load the actual model and make predictions
  const { features } = req.body;
  
  if (!features) {
    return res.status(400).json({ error: 'Features required' });
  }
  
  // Simulate prediction based on key features
  const sbp = features.sbp || 120;
  const heatIslandIndex = features.heat_island_index || 50;
  const map = features.map || 90;
  const pulsePressure = features.pulse_pressure || 40;
  
  // Simple risk calculation (in reality, use the trained model)
  let baseRisk = 0.05; // 5% base risk
  
  if (sbp > 160) baseRisk += 0.3;
  else if (sbp > 140) baseRisk += 0.15;
  
  if (heatIslandIndex > 80) baseRisk += 0.1;
  if (map > 100) baseRisk += 0.05;
  if (pulsePressure > 50) baseRisk += 0.05;
  
  const prediction = Math.min(0.95, Math.max(0.01, baseRisk));
  
  // Determine risk tier
  let riskTier = 'Low';
  if (prediction > modelMeta?.tier_thresholds?.tier4) riskTier = 'Critical';
  else if (prediction > modelMeta?.tier_thresholds?.tier3) riskTier = 'High';
  else if (prediction > modelMeta?.tier_thresholds?.tier2) riskTier = 'Medium';
  
  res.json({
    prediction: prediction,
    probability: Math.round(prediction * 100),
    riskTier: riskTier,
    confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
    features: {
      sbp: sbp,
      heat_island_index: heatIslandIndex,
      map: map,
      pulse_pressure: pulsePressure
    }
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
app.get('/api/mco/aggregated-data', async (req, res) => {
  try {
    // Get CSV data
    const csvRows = await parseCsv();

    // Convert MCO submissions to board item format
    const mcoItems = mcoDataStore.submissions.map((submission, index) => {
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
          gestation: 'Unknown', // MCO might not have this
          parity: 'Unknown', // MCO might not have this
          chiefComplaint: clinical.smmCondition || 'MCO Submission',
          vitals: `BP ${clinical.sbp || 'N/A'}/${clinical.dbp || 'N/A'} | HR ${clinical.hr || 'N/A'}`,
          environmental: {
            zipCode: submission.zipCode || 'Unknown',
            airQuality: String(environmental.aqi || 'Unknown'),
            heatIndex: environmental.heatIslandIndex || 0,
          },
          // Add MCO-specific data
          hypertension: clinical.hypertension,
          diabetes: clinical.diabetes,
          foodDesert: resource.foodDesert,
          transportationAccess: resource.transportationAccess,
          heatIslandIndex: environmental.heatIslandIndex,
          aqi: environmental.aqi
        },
        nicuCategory,
        nicuProbability: Math.round(nicuProbability),
        smmCondition: clinical.smmCondition || (clinical.hypertension ? 'Hypertension' : clinical.diabetes ? 'Diabetes' : 'None'),
        ppcPre: nicuProbability < 30,
        ppcPost: nicuProbability < 40,
        estimatedSavings: Math.round(nicuProbability * 50 + Math.random() * 200),
        mcoId: submission.mcoId,
        source: submission.source || 'mco-submission'
      };
    });

    // Combine CSV data with MCO data
    const allItems = [...csvRows.map((r, i) => {
      // Transform CSV row to board item (existing logic)
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
        source: 'csv-data'
      };
    }), ...mcoItems];

    // Group by status for dashboard view
    const criticalItems = allItems.filter(i => i.status === 'Critical');
    const reviewingItems = allItems.filter(i => i.status === 'Reviewing');
    const stableItems = allItems.filter(i => i.status === 'Stable');

    const groups = [];
    if (criticalItems.length > 0) {
      groups.push({
        id: 'g1',
        title: '🚨 72-Hour Critical Window',
        color: 'rose',
        items: criticalItems, // Remove slice(0, 15) to show all items
      });
    }
    if (reviewingItems.length > 0) {
      groups.push({
        id: 'g2',
        title: '⚠️ Elevated Monitoring',
        color: 'amber',
        items: reviewingItems, // Remove slice(0, 15) to show all items
      });
    }
    if (stableItems.length > 0) {
      groups.push({
        id: 'g3',
        title: '🛡️ Stable Members',
        color: 'emerald',
        items: stableItems, // Remove slice(0, 15) to show all items
      });
    }

    res.json({
      groups: groups.length > 0 ? groups : [{ id: 'g0', title: 'All Members', color: 'indigo', items: allItems.slice(0, 20) }],
      stats: {
        totalPatients: allItems.length,
        csvPatients: csvRows.length,
        mcoPatients: mcoItems.length,
        mcoStats: mcoDataStore.mcoStats,
        lastUpdated: mcoDataStore.lastUpdated
      }
    });

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

app.listen(3009, () => console.log('csv server listening on 3009'));
