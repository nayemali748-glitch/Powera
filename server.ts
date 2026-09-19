import express from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns';

// Ensure IPv4 resolution first for stable script.google.com connection
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // ignore
}

const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzVV5sqqypop3sr19hstcti76QXw4aGIKHqAut31pcYMcOuffGwsAmtfbbOnx3KVB_7/exec';
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1-3LtAbXZU6klisReK6ffIxDUwbM4wXvhxSbKVpE7raY';

// Standard desktop browser User-Agent to prevent Google Edge Security Frontend (ESF) 403/interstitial blocks
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Cache & concurrency deduplication for Google Apps Script requests
interface CacheEntry {
  data: any;
  timestamp: number;
}
const gasCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();
const CACHE_TTL_MS = 6000; // 6 seconds for high-frequency reads
const READ_ACTIONS = new Set(['entries', 'workorders', 'stats', 'users', 'health', 'chat', 'logs']);

// Strict Idempotency Submission Map (15 minutes TTL)
interface IdempotencyRecord {
  timestamp: number;
  result: any;
}
const submissionIdMap = new Map<string, IdempotencyRecord>();
const inFlightSubmissions = new Map<string, Promise<any>>();
const SUBMISSION_IDEMPOTENCY_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Clean old idempotency records periodically
setInterval(() => {
  const now = Date.now();
  for (const [subId, record] of submissionIdMap.entries()) {
    if (now - record.timestamp > SUBMISSION_IDEMPOTENCY_TTL_MS) {
      submissionIdMap.delete(subId);
    }
  }
}, 60000);

// Bengali digit normalizer
function normalizeUniversal(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let res = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const bIdx = bengaliDigits.indexOf(ch);
    if (bIdx >= 0) {
      res += bIdx.toString();
    } else {
      res += ch;
    }
  }
  return res;
}

// Normalizer for Google Sheets column shifts and display headers
function normalizeServerEntry(entry: any): any {
  if (!entry || typeof entry !== 'object') return entry;
  const raw: any = { ...entry };

  raw.submissionId = raw.submissionId || raw['Submission ID'] || raw['SubmissionID'] || raw['submission_id'] || '';
  raw.id = raw.id || raw['Record ID'] || raw['RecordID'] || raw['record_id'] || raw['ID'] || '';
  raw.category = raw.category || raw['Category'] || 'NSC';
  raw.status = raw.status || raw['Status'] || 'Completed';
  raw.date = raw.date || raw['Date'] || raw.createdAt || '';
  raw.createdAt = raw.createdAt || raw['Created At'] || raw.date || '';
  raw.updatedAt = raw.updatedAt || raw['Updated At'] || '';

  raw.workerId = raw.workerId || raw['Worker ID'] || raw['Lineman ID'] || '';
  raw.workerName = raw.workerName || raw['Worker Name'] || raw['Lineman Name'] || raw['NSC Worker Name'] || '';
  raw.role = raw.role || raw['Role'] || '';
  raw.submittedBy = raw.submittedBy || raw['Submitted By'] || raw.workerName || '';
  raw.workerPhone = raw.workerPhone || raw['Worker Phone'] || '';

  raw.agencyName = raw.agencyName || raw['Agency Name'] || '';
  raw.cccName = raw.cccName || raw['CCC Name'] || '';
  raw.substation = raw.substation || raw['Substation'] || '';
  raw.feederName = raw.feederName || raw['Feeder Name'] || '';

  raw.workOrderNo = raw.workOrderNo || raw['Work Order No'] || raw['Work Order Number'] || '';
  raw.workOrderDate = raw.workOrderDate || raw['Work Order Date'] || '';
  raw.workOrderNoticeId = raw.workOrderNoticeId || raw['Work Order Notice ID'] || '';
  raw.workOrderNoticeTitle = raw.workOrderNoticeTitle || raw['Work Order Notice Title'] || '';
  raw.workOrderNoticeDate = raw.workOrderNoticeDate || raw['Work Order Notice Date'] || '';
  raw.workOrderPhoto = raw.workOrderPhoto || raw['Work Order Photo'] || '';

  raw.applicationNo = raw.applicationNo || raw['Application No'] || raw['Application Number'] || '';
  raw.consumerId = raw.consumerId || raw['Consumer ID'] || raw['Consumer Number'] || raw['Consumer No'] || '';
  raw.consumerName = raw.consumerName || raw['Consumer Name'] || raw['Customer Name'] || '';
  raw.fatherName = raw.fatherName || raw['Father Name'] || raw['Father / Husband Name'] || '';
  raw.mobile = raw.mobile || raw['Mobile No'] || raw['Mobile'] || '';
  raw.address = raw.address || raw['Address'] || '';

  raw.appliedLoad = raw.appliedLoad || raw['Applied Load'] || '';
  raw.phase = raw.phase || raw['Supply Phase'] || raw['Phase'] || '';
  raw.tariffCategory = raw.tariffCategory || raw['Tariff Category'] || '';
  raw.serviceCableLength = raw.serviceCableLength || raw['Service Cable Length'] || '';
  raw.poleNo = raw.poleNo || raw['Pole No'] || '';
  raw.earthResistance = raw.earthResistance || raw['Earth Resistance'] || '';

  raw.meterNo = raw.meterNo || raw['Meter No'] || raw['Meter Number'] || '';
  raw.meterMake = raw.meterMake || raw['Meter Make'] || '';
  raw.initialReading = raw.initialReading || raw['Initial Reading'] || '';
  raw.sealNo = raw.sealNo || raw['Meter Seal No'] || raw['Seal No'] || '';
  raw.meterInstallDate = raw.meterInstallDate || raw['Meter Install Date'] || '';
  raw.inspectionAgencyName = raw.inspectionAgencyName || raw['Inspection Agency Name'] || '';

  raw.locationGps = raw.locationGps || raw['GPS Location'] || raw['Location GPS'] || '';
  raw.photoUrl = raw.photoUrl || raw['Photo Evidence'] || raw['Photo URL'] || raw.directImageUrl || '';
  raw.notes = raw.notes || raw['Notes'] || '';

  return raw;
}

// Canonical Apps Script Communicator (Single Source of Truth)
async function callGoogleAppsScript(
  action: string, 
  payload: any = {}, 
  method: 'GET' | 'POST' = 'POST',
  timeoutMs = 45000
): Promise<any> {
  let finalAction = action;
  let finalPayload = { ...payload };

  // Canonical action normalization
  const catCreateActions = [
    'createNSC', 'createNewConnection', 'createDisconnection',
    'createPoleCase', 'createMeterReplacement', 'createDTRReplacement',
    'submitRecord', 'saveEntry', 'saveRecord', 'createRecord'
  ];
  if (catCreateActions.includes(action)) {
    finalAction = 'createEntry';
    if (!finalPayload.data) finalPayload.data = {};
    if (!finalPayload.data.category) {
      if (action === 'createNSC' || action === 'createNewConnection') finalPayload.data.category = 'NSC';
      else if (action === 'createDisconnection') finalPayload.data.category = 'DISCONNECTION';
      else if (action === 'createPoleCase') finalPayload.data.category = 'POLE CASE';
      else if (action === 'createMeterReplacement') finalPayload.data.category = 'METER REPLESMENT';
      else if (action === 'createDTRReplacement') finalPayload.data.category = 'DTR REPLESMENT';
    }
  }

  if (action === 'uploadWorkOrder') finalAction = 'createWorkOrder';
  if (action === 'getRecords' || action === 'getMasterData') finalAction = 'entries';
  if (action === 'getDashboard' || action === 'getDashboardStats') finalAction = 'stats';
  if (action === 'getUsers') finalAction = 'users';
  if (action === 'getWorkOrders') finalAction = 'workorders';
  if (action === 'healthCheck') finalAction = 'health';
  if (action === 'saveUser' || action === 'register') finalAction = 'createUser';
  if (action === 'getChat') finalAction = 'chat';

  // Submission Idempotency Check for 'createEntry'
  if (finalAction === 'createEntry') {
    const entryData = finalPayload.data || finalPayload;
    const subId = String(entryData.submissionId || finalPayload.submissionId || '').trim();
    if (subId) {
      const existing = submissionIdMap.get(subId);
      if (existing) {
        console.log(`[Idempotency] Submission ID "${subId}" already processed. Returning cached success.`);
        return {
          success: true,
          duplicate: true,
          message: 'Already recorded (Idempotency check)',
          submissionId: subId,
          ...existing.result
        };
      }

      if (inFlightSubmissions.has(subId)) {
        console.log(`[Idempotency] Submission ID "${subId}" currently in-flight. Awaiting result.`);
        return inFlightSubmissions.get(subId);
      }
    }
  }

  // Invalidate read cache on mutations
  const isMutation = finalAction.startsWith('create') || 
                     finalAction.startsWith('update') || 
                     finalAction.startsWith('delete') || 
                     finalAction.startsWith('clear') || 
                     finalAction.startsWith('change') || 
                     finalAction.startsWith('toggle') ||
                     finalAction === 'resetPassword' ||
                     finalAction === 'uploadWorkOrder';

  if (isMutation) {
    gasCache.clear();
  }

  // Check read cache & in-flight deduplication
  const isReadAction = READ_ACTIONS.has(finalAction);
  const cacheKey = `${finalAction}_${JSON.stringify(finalPayload)}`;

  if (isReadAction && !isMutation) {
    const cached = gasCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }
  }

  const executionPromise = (async () => {
    const maxAttempts = isMutation ? 2 : 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const currentTimeoutMs = isMutation ? Math.min(timeoutMs, 45000) : timeoutMs;
      const timeoutId = setTimeout(() => {
        try { controller.abort(); } catch {}
      }, currentTimeoutMs);

      try {
        let fetchUrl = GOOGLE_APPS_SCRIPT_URL;
        // Strict method selection: READ_ACTIONS must use GET on Google Apps Script
        const reqMethod = READ_ACTIONS.has(finalAction) ? 'GET' : 'POST';
        const options: RequestInit = {
          signal: controller.signal,
          redirect: 'manual', // Never let Node auto-follow; handle 302 manually with browser User-Agent
        };

        if (reqMethod === 'GET') {
          const sep = fetchUrl.includes('?') ? '&' : '?';
          const queryParams: Record<string, string> = { action: finalAction };
          for (const [key, value] of Object.entries(finalPayload)) {
            if (value !== undefined && value !== null && key !== 'action') {
              queryParams[key] = String(value);
            }
          }
          queryParams['_t'] = Date.now().toString();
          fetchUrl = `${fetchUrl}${sep}${new URLSearchParams(queryParams).toString()}`;
          options.method = 'GET';
          options.headers = {
            'User-Agent': BROWSER_USER_AGENT,
            'Accept': 'application/json'
          };
        } else {
          options.method = 'POST';
          // Use text/plain to avoid CORS preflight issues across Google redirects
          options.headers = {
            'Content-Type': 'text/plain;charset=utf-8',
            'User-Agent': BROWSER_USER_AGENT,
            'Accept': 'application/json'
          };
          const postData = (finalPayload.data && typeof finalPayload.data === 'object') ? finalPayload.data : finalPayload;
          options.body = JSON.stringify({ action: finalAction, ...postData, data: postData });
        }

        const res = await fetch(fetchUrl, options);
        let finalRes = res;

        // Manual redirect handling for Google Apps Script 302/301/303/307 redirects
        if (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308) {
          const loc = res.headers.get('location');
          if (loc) {
            finalRes = await fetch(loc, {
              method: 'GET',
              signal: controller.signal,
              headers: {
                'User-Agent': BROWSER_USER_AGENT,
                'Accept': 'application/json'
              }
            });
          }
        }

        const rawText = await finalRes.text();
        const trimmed = rawText.trim();

        // Check if Google returned an HTML error / login / busy page
        if (trimmed.startsWith('<!DOCTYPE') || trimmed.includes('<html') || trimmed.includes('<body') || trimmed.includes('ppConfig')) {
          console.warn(`[GoogleAppsScript] Received HTML page on attempt ${attempt} for "${finalAction}". Retrying...`);
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
            continue;
          }
          return {
            success: false,
            error: 'Google Sheets is currently busy. Please retry in a few seconds.',
            busy: true
          };
        }

        let parsed: any;
        try {
          parsed = JSON.parse(trimmed);
        } catch (parseErr: any) {
          console.error(`[GoogleAppsScript] JSON parse error on attempt ${attempt}:`, parseErr.message, trimmed.slice(0, 100));
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 800));
            continue;
          }
          return {
            success: false,
            error: 'Invalid response format from Google Sheets service.'
          };
        }

        // Cache successful read operations
        if (isReadAction && parsed && parsed.success !== false) {
          gasCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
        }

        // Store idempotency result for createEntry
        if (finalAction === 'createEntry' && parsed && parsed.success) {
          const entryData = finalPayload.data || finalPayload;
          const subId = String(entryData.submissionId || finalPayload.submissionId || '').trim();
          if (subId) {
            submissionIdMap.set(subId, { timestamp: Date.now(), result: parsed });
          }
        }

        return parsed;
      } catch (err: any) {
        lastError = err;
        console.warn(`[GoogleAppsScript] Attempt ${attempt} failed for action "${finalAction}":`, err?.message || err);
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    console.error(`[GoogleAppsScript] Action "${action}" completely failed:`, lastError?.message || lastError);
    return {
      success: false,
      error: lastError?.message || 'Failed to connect to Google Sheets backend.'
    };
  })();

  // Track in-flight idempotency for submissions
  if (finalAction === 'createEntry') {
    const entryData = finalPayload.data || finalPayload;
    const subId = String(entryData.submissionId || finalPayload.submissionId || '').trim();
    if (subId) {
      inFlightSubmissions.set(subId, executionPromise);
      try {
        return await executionPromise;
      } finally {
        inFlightSubmissions.delete(subId);
      }
    }
  }

  if (isReadAction && !isMutation) {
    inFlightRequests.set(cacheKey, executionPromise);
    try {
      return await executionPromise;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  }

  return executionPromise;
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '80mb' }));
app.use(express.urlencoded({ limit: '80mb', extended: true }));

// Standard security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=()');
  next();
});

// ============================================================================
// SYSTEM HEALTH CHECK (Direct live probe to Google Sheets)
// ============================================================================
app.get(['/health', '/healthz', '/api/health'], async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const gasHealth = await callGoogleAppsScript('health', {}, 'GET', 15000);
    res.status(200).json({
      status: 'ok',
      app: 'POWER Utility Management',
      backend: 'Google Sheets & Google Apps Script',
      spreadsheetId: GOOGLE_SHEET_ID,
      gasStatus: gasHealth?.status || (gasHealth?.success ? 'connected' : 'error'),
      message: gasHealth?.message || 'Google Sheets connected successfully'
    });
  } catch (err: any) {
    res.status(200).json({
      status: 'ok',
      app: 'POWER Utility Management',
      backend: 'Google Sheets & Google Apps Script',
      warning: err?.message || 'Google Sheets health check pending'
    });
  }
});

// ============================================================================
// AUTHENTICATION (Google Sheets Users sheet as single source of truth)
// ============================================================================
app.post('/api/auth/login', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const { loginId, password } = req.body;
    if (!loginId || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID এবং পাসওয়ার্ড প্রয়োজন (User ID & Password required)' 
      });
    }

    const cleanId = normalizeUniversal(loginId).trim();
    const cleanPass = normalizeUniversal(password).trim();

    // Call Google Apps Script directly
    const gasRes = await callGoogleAppsScript('login', { idNo: cleanId, password: cleanPass }, 'POST', 25000);

    if (gasRes && gasRes.success && gasRes.session) {
      return res.json({ success: true, session: gasRes.session });
    }

    const errorMsg = gasRes?.error || gasRes?.message || 'ভুল ইউজার আইডি বা পাসওয়ার্ড! সঠিক আইডি ও পাসওয়ার্ড দিন।';
    return res.status(401).json({ success: false, error: errorMsg });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || 'Login connection error. Please try again.' 
    });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const { idNo, currentPassword, newPassword } = req.body;
    const gasRes = await callGoogleAppsScript('changePassword', {
      idNo: normalizeUniversal(idNo),
      currentPassword: normalizeUniversal(currentPassword),
      newPassword: normalizeUniversal(newPassword)
    }, 'POST');
    return res.json(gasRes);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const { idNo, phone, newPassword } = req.body;
    const gasRes = await callGoogleAppsScript('resetPassword', {
      idNo: normalizeUniversal(idNo),
      phone: normalizeUniversal(phone),
      newPassword: normalizeUniversal(newPassword)
    }, 'POST');
    return res.json(gasRes);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/verify/:idNo', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const cleanId = normalizeUniversal(req.params.idNo).trim();
    const usersRes = await callGoogleAppsScript('users', {}, 'GET');
    const users = Array.isArray(usersRes?.users) ? usersRes.users : [];
    const matched = users.find((u: any) => String(u.idNo).trim() === cleanId || String(u.id).trim() === cleanId);
    if (!matched) {
      return res.status(404).json({ valid: false, error: 'User not found in Google Sheets' });
    }
    if (matched.status === 'hold') {
      return res.status(403).json({ valid: false, status: 'hold', error: 'User account is currently ON HOLD' });
    }
    return res.json({ valid: true, status: matched.status || 'active', role: matched.role });
  } catch (err: any) {
    return res.status(500).json({ valid: false, error: err.message });
  }
});

// ============================================================================
// CENTRAL GAS PROXY (Supports all operations with strict JSON responses)
// ============================================================================
app.post('/api/gas-proxy', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const { action, payload = {}, method = 'POST' } = req.body;
    if (!action) {
      return res.status(400).json({ success: false, error: 'Action parameter is required' });
    }

    const result = await callGoogleAppsScript(action, payload, method);
    return res.json(result);
  } catch (err: any) {
    console.error('GAS proxy error:', err);
    return res.status(200).json({ 
      success: false, 
      error: err.message || 'Google Apps Script communication error' 
    });
  }
});

// ============================================================================
// ENTRIES CRUD (Strictly mapped to Google Sheets)
// ============================================================================
app.get('/api/entries', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('entries', req.query, 'GET');
    const rawEntries = Array.isArray(result?.entries) ? result.entries : (Array.isArray(result) ? result : []);
    const normalized = rawEntries.map(normalizeServerEntry);
    return res.json(normalized);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch entries from Google Sheets' });
  }
});

app.post('/api/entries', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const payload = req.body.data || req.body;
    const result = await callGoogleAppsScript('createEntry', { data: payload }, 'POST');
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to submit entry to Google Sheets' });
  }
});

// ============================================================================
// USERS CRUD (Direct Google Sheets Users Sheet)
// ============================================================================
app.get('/api/users', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('users', {}, 'GET');
    const users = Array.isArray(result?.users) ? result.users : [];
    return res.json({ success: true, users });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const payload = req.body.data || req.body;
    const result = await callGoogleAppsScript('createUser', { data: payload }, 'POST');
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('deleteUser', { id: req.params.id }, 'POST');
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const payload = req.body.data || req.body;
    const result = await callGoogleAppsScript('updateUser', { id: req.params.id, data: payload }, 'POST');
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// WORK ORDERS & KHATA NOTICES (Google Drive + Google Sheets)
// ============================================================================
app.get('/api/work-orders', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('workorders', req.query, 'GET');
    let orders = Array.isArray(result?.workOrders) ? result.workOrders : [];
    if (req.query.category && req.query.category !== 'ALL') {
      orders = orders.filter((o: any) => o.category === req.query.category || o.category === 'ALL');
    }
    return res.json(orders);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to load work orders' });
  }
});

app.post('/api/work-orders', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('uploadWorkOrder', { data: req.body }, 'POST');
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to upload work order' });
  }
});

app.delete('/api/work-orders/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('deleteWorkOrder', { id: req.params.id }, 'POST');
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

const handleToggleVisibility = async (req: express.Request, res: express.Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('toggleWorkOrder', { id: req.params.id, isHidden: req.body.isHidden }, 'POST');
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
app.patch('/api/work-orders/:id/visibility', handleToggleVisibility);
app.post('/api/work-orders/:id/visibility', handleToggleVisibility);
app.put('/api/work-orders/:id/visibility', handleToggleVisibility);

// Google Drive Image Proxy
app.get('/api/drive-proxy/:fileId', async (req, res) => {
  const { fileId } = req.params;
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return res.status(400).send('Invalid file ID');
  }

  const driveUrls = [
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`,
    `https://lh3.googleusercontent.com/d/${fileId}`,
    `https://drive.google.com/uc?export=view&id=${fileId}`
  ];

  for (const driveUrl of driveUrls) {
    try {
      const response = await fetch(driveUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });
      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        const arrayBuffer = await response.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }
    } catch {
      // try next
    }
  }

  return res.status(404).send('Image could not be retrieved from Google Drive');
});

// ============================================================================
// DASHBOARD STATS (Direct from Google Sheets)
// ============================================================================
app.get('/api/stats', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('stats', {}, 'GET');
    return res.json(result?.stats || result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch dashboard stats' });
  }
});

// ============================================================================
// LIVE CHAT (Google Sheets Chat Sheet)
// ============================================================================
app.get('/api/chat', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('chat', req.query, 'GET');
    return res.json(result?.messages || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('sendChat', { data: req.body }, 'POST');
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/chat', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('clearChat', {}, 'POST');
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// SERVER INITIALIZATION & VITE MIDDLEWARE
// ============================================================================
async function startServer() {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.argv.some(arg => typeof arg === 'string' && (arg.includes('dist') || arg.endsWith('.cjs')));

  const distPath = path.join(process.cwd(), 'dist');

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send('<!DOCTYPE html><html><head><meta charset="utf-8"/><title>POWER</title></head><body><div id="root"></div></body></html>');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ POWER server running on http://localhost:${PORT}`);
    console.log(`📊 Google Spreadsheet ID: ${GOOGLE_SHEET_ID}`);
    console.log(`🔗 Google Apps Script URL: ${GOOGLE_APPS_SCRIPT_URL}`);
  });

  process.on('SIGTERM', () => {
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    server.close(() => {
      process.exit(0);
    });
  });
}

startServer();
