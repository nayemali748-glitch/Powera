import express from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import * as XLSX from 'xlsx';

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
const CACHE_TTL_MS = 60000; // 60 seconds memory cache for reads (cleared instantly on any mutation)
const READ_ACTIONS = new Set(['entries', 'workorders', 'stats', 'users', 'health', 'chat', 'logs', 'disconnectiontasks', 'getDisconnectionTasks']);

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
  const rawCatStr = String(raw.category || raw['Category'] || 'NSC').trim();
  const rawCatUpper = rawCatStr.toUpperCase();
  if (rawCatUpper === 'DISCONNECTION' || rawCatUpper === 'DISCONNECT') {
    raw.category = 'DISCONNECTION';
  } else {
    raw.category = rawCatStr;
  }
  if (raw.category === 'DISCONNECTION') {
    raw.status = raw['Discon Status'] || raw.disconStatus || raw.taskStatus || raw.status || raw['Status'] || 'PENDING';
    raw.id = raw.id || String(raw['Consumer Id'] || raw['Consumer ID'] || raw.consumerId || raw.taskId || '').trim();
    raw.submissionId = raw.submissionId || raw.id;
  } else {
    raw.status = raw.status || raw['Status'] || 'Completed';
  }
  raw.date = raw.date || raw['Date'] || raw['Discon Date'] || raw['Upload Date'] || raw.createdAt || '';
  raw.createdAt = raw.createdAt || raw['Created At'] || raw['Upload Date'] || raw.date || '';
  raw.updatedAt = raw.updatedAt || raw['Updated At'] || raw['Last Updated'] || '';

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
  raw.consumerId = raw.consumerId || raw['Consumer Id'] || raw['Consumer ID'] || raw['Consumer Number'] || raw['Consumer No'] || '';
  raw.consumerName = raw.consumerName || raw['Name'] || raw['Consumer Name'] || raw['Customer Name'] || '';
  raw.fatherName = raw.fatherName || raw['Father Name'] || raw['Father / Husband Name'] || '';
  raw.mobile = raw.mobile || raw['Mobile Number'] || raw['Mobile No'] || raw['Mobile'] || '';
  raw.address = raw.address || raw['Address'] || '';

  raw.appliedLoad = raw.appliedLoad || raw['Applied Load'] || '';
  raw.phase = raw.phase || raw['BClass/Phase'] || raw['Supply Phase'] || raw['Phase'] || '';
  raw.tariffCategory = raw.tariffCategory || raw['Class'] || raw['Tariff Category'] || '';
  raw.serviceCableLength = raw.serviceCableLength || raw['Service Cable Length'] || '';
  raw.poleNo = raw.poleNo || raw['Pole No'] || '';
  raw.earthResistance = raw.earthResistance || raw['Earth Resistance'] || '';

  raw.meterNo = raw.meterNo || raw['Meter'] || raw['Meter No'] || raw['Meter Number'] || '';
  raw.meterMake = raw.meterMake || raw['Meter Make'] || '';
  raw.initialReading = raw.initialReading || raw['Initial Reading'] || '';
  raw.sealNo = raw.sealNo || raw['Meter Seal No'] || raw['Seal No'] || '';
  raw.meterInstallDate = raw.meterInstallDate || raw['Meter Install Date'] || '';
  raw.inspectionAgencyName = raw.inspectionAgencyName || raw['Inspection Agency Name'] || '';

  raw.arrearAmount = raw.arrearAmount || raw['D2 Net O/S'] || raw['Arrear Amount'] || '';
  raw.status = raw.status || raw['Discon Status'] || raw['Status'] || '';
  raw.date = raw.date || raw['Discon Date'] || raw['Date'] || '';
  raw.dueDateRange = raw.dueDateRange || raw['O/S Due date Range'] || '';
  raw.govStatus = raw.govStatus || raw['Gov/Non-Gov'] || '';
  raw.substation = raw.substation || raw['off_code'] || raw['Substation'] || '';
  raw.mru = raw.mru || raw['MRU'] || '';

  raw.locationGps = raw.locationGps || raw['GPS Location'] || raw['Location GPS'] || '';
  raw.photoUrl = raw.photoUrl || raw['Photo Evidence'] || raw['Photo URL'] || raw.directImageUrl || '';
  raw.notes = raw.notes || raw['Notes'] || '';

  return raw;
}

const LARGE_IMAGES_FILE = path.join(process.cwd(), '.large-images-store.json');
const largeImagesMap = new Map<string, string>();
try {
  if (fs.existsSync(LARGE_IMAGES_FILE)) {
    const rawMap = JSON.parse(fs.readFileSync(LARGE_IMAGES_FILE, 'utf-8'));
    if (rawMap && typeof rawMap === 'object') {
      for (const [k, v] of Object.entries(rawMap)) {
        if (typeof v === 'string') largeImagesMap.set(k, v);
      }
    }
  }
} catch {}

function saveLargeImagesToDisk() {
  try {
    const obj: Record<string, string> = {};
    for (const [k, v] of largeImagesMap.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(LARGE_IMAGES_FILE, JSON.stringify(obj), 'utf-8');
  } catch {}
}

function sanitizeObjectForSheetCells(obj: any, recordKeyHint = ''): any {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  // Do not alter WorkOrders_Khata chunked payloads which are already sized at <=43,000 chars per column
  if (obj.category === 'WorkOrders_Khata') return obj;

  const clone: Record<string, any> = { ...obj };
  const recId = String(clone.id || clone.submissionId || clone.consumerId || clone['Consumer Id'] || recordKeyHint || Date.now()).trim();
  let storedAny = false;

  for (const [k, v] of Object.entries(clone)) {
    if (typeof v === 'string' && v.length > 45000) {
      if (v.startsWith('data:')) {
        const imgKey = `${recId}_${k}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        largeImagesMap.set(imgKey, v);
        storedAny = true;
        clone[k] = `/api/stored-images/${encodeURIComponent(imgKey)}`;
      } else {
        clone[k] = v.slice(0, 45000);
      }
    } else if (v && typeof v === 'object' && !Array.isArray(v) && k === 'data') {
      clone[k] = sanitizeObjectForSheetCells(v, recId);
    }
  }

  if (storedAny) {
    saveLargeImagesToDisk();
  }
  return clone;
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
    'createEntry', 'createNSC', 'createNewConnection', 'createDisconnection',
    'createPoleCase', 'createMeterReplacement', 'createDTRReplacement',
    'submitRecord', 'saveEntry', 'saveRecord', 'createRecord'
  ];
  if (catCreateActions.includes(action)) {
    finalAction = 'submitRecord';
    if (!finalPayload.data) finalPayload.data = {};
    if (!finalPayload.data.category) {
      if (action === 'createNSC' || action === 'createNewConnection') finalPayload.data.category = 'NSC';
      else if (action === 'createDisconnection') finalPayload.data.category = 'DISCONNECTION';
      else if (action === 'createPoleCase') finalPayload.data.category = 'POLE CASE';
      else if (action === 'createMeterReplacement') finalPayload.data.category = 'METER REPLESMENT';
      else if (action === 'createDTRReplacement') finalPayload.data.category = 'DTR REPLESMENT';
    }
    if (finalPayload.data.category && !finalPayload.category) {
      finalPayload.category = finalPayload.data.category;
    }
  }

  if (action === 'getRecords' || action === 'getMasterData') finalAction = 'entries';
  if (action === 'healthCheck') finalAction = 'health';

  if (finalAction === 'submitRecord' || finalAction === 'updateEntry') {
    finalPayload = sanitizeObjectForSheetCells(finalPayload);
  }

  // Submission Idempotency Check for 'createEntry' / 'submitRecord'
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
                     finalAction === 'uploadWorkOrder' ||
                     finalAction.startsWith('uploadDisconnection') ||
                     finalAction.startsWith('submitDisconnection') ||
                     finalAction.startsWith('assignDisconnection') ||
                     finalAction.startsWith('archiveDisconnection') ||
                     finalAction.startsWith('restoreDisconnection');

  if (isMutation) {
    gasCache.clear();
  }

  // Check read cache & in-flight deduplication
  const isReadAction = READ_ACTIONS.has(finalAction);

  // Normalize cacheKey to deduplicate concurrent requests cleanly
  const normalizedPayload: Record<string, any> = {};
  for (const [k, v] of Object.entries(finalPayload || {})) {
    if (k !== '_t' && k !== 'timestamp' && v !== undefined && v !== null && v !== '') {
      normalizedPayload[k] = v;
    }
  }
  const sortedKeys = Object.keys(normalizedPayload).sort();
  const sortedPayload: Record<string, any> = {};
  for (const k of sortedKeys) {
    sortedPayload[k] = normalizedPayload[k];
  }
  const cacheKey = `${finalAction}_${JSON.stringify(sortedPayload)}`;

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
    const maxAttempts = isMutation ? 2 : 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      // Ensure sufficient timeout for Google Apps Script sheet operations (minimum 25s)
      const currentTimeoutMs = Math.max(timeoutMs || (isMutation ? 45000 : 30000), 25000);
      const timeoutId = setTimeout(() => {
        try { controller.abort(); } catch {}
      }, currentTimeoutMs);

      try {
        let fetchUrl = GOOGLE_APPS_SCRIPT_URL;
        // Strict method selection: READ_ACTIONS must use GET on Google Apps Script
        const reqMethod = READ_ACTIONS.has(finalAction) ? 'GET' : 'POST';
        const options: RequestInit = {
          signal: controller.signal,
          redirect: 'follow',
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
          const innerData = (finalPayload.data && typeof finalPayload.data === 'object') ? finalPayload.data : {};
          const mergedPayload = { ...finalPayload, ...innerData };
          if (finalPayload.id) mergedPayload.id = finalPayload.id;
          if (finalPayload.category) mergedPayload.category = finalPayload.category;
          if (finalPayload.submissionId) mergedPayload.submissionId = finalPayload.submissionId;
          if (finalPayload.taskId) mergedPayload.taskId = finalPayload.taskId;
          options.body = JSON.stringify({ action: finalAction, ...mergedPayload, data: mergedPayload });
        }

        const finalRes = await fetch(fetchUrl, options);
        if (!finalRes) {
          throw new Error(`Failed to retrieve response for action "${finalAction}".`);
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
            data: null,
            error: {
              code: 'BACKEND_BUSY',
              message: 'Google Sheets is currently busy. Please retry in a few seconds.'
            },
            busy: true,
            requestId: `REQ-${Date.now()}`
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
            data: null,
            error: {
              code: 'INVALID_JSON',
              message: `Google Sheets returned non-JSON content (Status: ${finalRes.status})`
            },
            rawText: trimmed.slice(0, 200),
            requestId: `REQ-${Date.now()}`
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
        const isAbort = err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('aborted');
        if (isAbort) {
          console.log(`[GoogleAppsScript] Notice: Attempt ${attempt} fetch window passed (${currentTimeoutMs}ms) for "${finalAction}". Serving cached/fallback.`);
        } else {
          console.log(`[GoogleAppsScript] Attempt ${attempt} notice for action "${finalAction}":`, err?.message || err);
        }
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // Stale-on-error resilience for read queries
    if (isReadAction && gasCache.has(cacheKey)) {
      const stale = gasCache.get(cacheKey);
      if (stale?.data) {
        console.log(`[GoogleAppsScript] Action "${finalAction}" completed; serving cached data.`);
        return stale.data;
      }
    }

    console.log(`[GoogleAppsScript] Action "${action}" completed with notice:`, lastError?.message || lastError);
    return {
      success: false,
      data: null,
      error: {
        code: 'CONNECTION_FAILED',
        message: lastError?.message || 'Failed to connect to Google Sheets backend.'
      },
      requestId: `REQ-${Date.now()}`
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
const PORT = parseInt(process.env.PORT || '3000', 10);

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

app.get('/api/stored-images/:key', (req, res) => {
  const key = String(req.params.key || '').trim();
  const dataUrl = largeImagesMap.get(key);
  if (!dataUrl) {
    return res.status(404).send('Image not found');
  }
  if (dataUrl.startsWith('data:')) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const mimeType = match[1] || 'image/jpeg';
      const buffer = Buffer.from(match[2], 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.send(buffer);
    }
  }
  return res.redirect(dataUrl);
});

// ============================================================================
// SYSTEM HEALTH CHECK (Direct live probe to Google Sheets)
// ============================================================================
// SYSTEM HEALTH CHECK (Fast non-blocking liveness & readiness probes for Cloud Run)
// ============================================================================
app.get(['/healthz', '/health', '/ping', '/ready'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).json({
    status: 'ok',
    app: 'POWER Utility Management',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Direct export and download route for Google Apps Script Code.gs
app.get(['/Code.gs', '/api/code-gs'], (req, res) => {
  const filePath = path.resolve(process.cwd(), 'Code.gs');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(fs.readFileSync(filePath, 'utf-8'));
  } else {
    res.status(404).send('Code.gs not found');
  }
});

app.get('/api/code-gs/download', (req, res) => {
  const filePath = path.resolve(process.cwd(), 'Code.gs');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Code.gs"');
    res.send(fs.readFileSync(filePath, 'utf-8'));
  } else {
    res.status(404).send('Code.gs not found');
  }
});

app.get('/api/health', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const gasHealth = await callGoogleAppsScript('health', {}, 'GET', 5000);
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
// AUTHENTICATION & USERS SHEET LOADER (Google Sheets Users sheet as single source of truth)
// ============================================================================
interface CachedUsersState {
  users: any[];
  timestamp: number;
}
let cachedUsersState: CachedUsersState | null = null;
const USERS_STATE_TTL_MS = 30000;

function clearUsersStateCache() {
  cachedUsersState = null;
  gasCache.clear();
}

function buildUserSyncTag(u: { idNo?: string; password?: string; phone?: string; designation?: string; badgeNo?: string; createdAt?: string }): string {
  const baseDate = String(u.createdAt || '').split('||')[0] || new Date().toISOString().slice(0, 10);
  const idNo = String(u.idNo || '').trim();
  const password = String(u.password || '').trim();
  const phone = String(u.phone || '').trim();
  const designation = String(u.designation || '').trim();
  const badgeNo = String(u.badgeNo || idNo).trim();
  return `${baseDate}||${idNo}||${password}||${phone}||${designation}||${badgeNo}`;
}

function normalizeUserRecord(u: any): any {
  if (!u || typeof u !== 'object') return null;
  let merged: any = { ...u };

  // Parse single-GET sync tag from createdAt if present (format: YYYY-MM-DD||idNo||password||phone||designation||badgeNo)
  const createdRaw = String(u.createdAt || u['Created At'] || '').trim();
  if (createdRaw.includes('||')) {
    const parts = createdRaw.split('||');
    if (parts.length >= 3) {
      if (!merged.idNo && parts[1]) merged.idNo = parts[1];
      if ((merged.password === undefined || merged.password === '') && parts[2] !== undefined) merged.password = parts[2];
      if (!merged.phone && parts[3]) merged.phone = parts[3];
      if (!merged.designation && parts[4]) merged.designation = parts[4];
      if (!merged.badgeNo && parts[5]) merged.badgeNo = parts[5];
    }
  }

  const rawId = String(merged.id || merged['ID'] || merged['Record ID'] || '').trim();
  const rawIdNo = String(
    merged.idNo ||
    merged.loginId ||
    merged.userId ||
    merged['User ID'] ||
    merged['User Id'] ||
    merged['user_id'] ||
    merged['ID No'] ||
    merged.workerId ||
    merged.consumerId ||
    ''
  ).trim();
  const rawPhone = String(merged.phone || merged['Phone'] || merged['Mobile'] || merged.mobile || merged.workerPhone || '').trim();
  const rawName = String(merged.name || merged['Name'] || merged['Full Name'] || merged.consumerName || merged.workerName || '').trim();
  const rawPass = String(
    merged.password !== undefined && merged.password !== null
      ? merged.password
      : (merged['Password'] !== undefined && merged['Password'] !== null ? merged['Password'] : '')
  ).trim();
  const rawHash = String(merged.passwordHash || merged['Password Hash'] || '').trim();
  const rawRole = String(merged.role || merged['Role'] || 'worker').trim().toLowerCase();
  const rawStatus = String(merged.status || merged['Status'] || 'active').trim().toLowerCase();
  const finalStatus = rawStatus === 'hold' ? 'hold' : 'active';
  const finalIdNo = rawIdNo || (rawId === 'adm_8695716192' ? '8695716192' : rawPhone || rawId);
  if (!finalIdNo) return null;

  const isAdm =
    rawRole === 'admin' ||
    rawRole === 'controller' ||
    rawRole === 'administrator' ||
    rawRole === 'superadmin' ||
    finalIdNo === '8695716192' ||
    finalIdNo.toLowerCase() === 'admin' ||
    rawId === 'adm_8695716192' ||
    /^adm[-_0-9]/i.test(finalIdNo);
  const finalRole = isAdm ? 'admin' : 'worker';
  const finalDesig = String(merged.designation || merged['Designation'] || (isAdm ? 'Sub-Divisional Controller' : 'লাইনম্যান / Worker (WBSEDCL)')).trim();
  const finalBadge = String(merged.badgeNo || merged['Badge No'] || finalIdNo).trim();

  return {
    id: rawId || `usr_${finalIdNo}`,
    idNo: finalIdNo,
    loginId: finalIdNo,
    userId: finalIdNo,
    password: rawPass,
    passwordHash: rawHash,
    name: rawName || finalIdNo || 'কর্মী',
    phone: rawPhone,
    role: finalRole,
    status: finalStatus,
    designation: finalDesig,
    badgeNo: finalBadge,
    createdAt: createdRaw || buildUserSyncTag({ idNo: finalIdNo, password: rawPass, phone: rawPhone, designation: finalDesig, badgeNo: finalBadge }),
    updatedAt: String(merged.updatedAt || merged['Updated At'] || '').trim()
  };
}

function extractEntriesArray(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.entries)) return res.entries;
  if (Array.isArray(res.users)) return res.users;
  if (Array.isArray(res.data)) return res.data;
  if (res.data && typeof res.data === 'object') {
    if (Array.isArray(res.data.entries)) return res.data.entries;
    if (Array.isArray(res.data.users)) return res.data.users;
  }
  return [];
}

async function hydrateSingleUserFromUsersSheet(rowId: string, currentSt = 'active', currentRole = 'worker'): Promise<any | null> {
  if (!rowId) return null;
  try {
    const detailRes = await callGoogleAppsScript('updateEntry', {
      id: rowId,
      category: 'Users',
      status: currentSt,
      role: currentRole,
      data: { status: currentSt, Status: currentSt, role: currentRole, Role: currentRole }
    }, 'POST', 20000);
    const fullEntry = detailRes?.entry || detailRes?.data?.entry;
    if (fullEntry && typeof fullEntry === 'object') {
      const hydrated = normalizeUserRecord(fullEntry);
      if (hydrated && hydrated.idNo) {
        const tag = buildUserSyncTag(hydrated);
        hydrated.createdAt = tag;
        // Persist sync tag into Users sheet createdAt column in background so future GETs are 1-call instant
        if (!String(fullEntry.createdAt || '').includes('||')) {
          callGoogleAppsScript('updateEntry', {
            id: rowId,
            category: 'Users',
            createdAt: tag,
            'Created At': tag,
            data: { createdAt: tag, 'Created At': tag }
          }, 'POST', 20000).catch(() => {});
        }
        return hydrated;
      }
    }
  } catch {}
  return null;
}

async function fetchVerifiedUsersFromSheet(forceRefresh = false): Promise<any[]> {
  if (!forceRefresh && cachedUsersState && (Date.now() - cachedUsersState.timestamp < USERS_STATE_TTL_MS)) {
    return cachedUsersState.users;
  }
  if (forceRefresh) {
    gasCache.clear();
  }

  const userMap = new Map<string, any>();

  try {
    // Single GET call to the existing Google Sheets Users sheet ONLY (sole source of truth)
    const usersSheetRes = await callGoogleAppsScript('entries', { category: 'Users' }, 'GET', 20000).catch(() => null);
    const rawEntries = extractEntriesArray(usersSheetRes);

    for (const rowSummary of rawEntries) {
      const rowId = String(rowSummary?.id || '').trim();
      if (!rowId) continue;

      const normSummary = normalizeUserRecord(rowSummary);
      // If createdAt sync tag or direct columns provided idNo and password/hash, we have the full record in 1 GET!
      if (normSummary && normSummary.idNo && (normSummary.password !== '' || normSummary.passwordHash !== '')) {
        userMap.set(rowId, normSummary);
        continue;
      }

      // If row was added directly in Google Sheets without sync tag, hydrate that specific row from Users sheet
      const currentSt = (String(rowSummary.status || 'active').toLowerCase() === 'hold') ? 'hold' : 'active';
      const currentRole = (String(rowSummary.role || 'worker').toLowerCase() === 'admin') ? 'admin' : 'worker';
      const hydrated = await hydrateSingleUserFromUsersSheet(rowId, currentSt, currentRole);
      if (hydrated && hydrated.idNo) {
        userMap.set(rowId, hydrated);
        continue;
      }

      if (normSummary) {
        userMap.set(rowId, normSummary);
      }
    }
  } catch (err: any) {
    console.warn('[UsersLoader] Sheet fetch notice:', err?.message);
  }

  const users = Array.from(userMap.values());
  if (users.length > 0) {
    cachedUsersState = { users, timestamp: Date.now() };
  }
  return users;
}

function findMatchingUserInList(users: any[], cleanId: string): any {
  const lowerId = cleanId.toLowerCase();
  const cleanIdAlnum = lowerId.replace(/[^a-z0-9]/g, '');
  const cleanDigits = cleanId.replace(/\D/g, '');
  const cleanPhone10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : '';

  return users.find((u: any) => {
    if (!u) return false;
    const uIdNo = normalizeUniversal(u['User ID'] || u.idNo || u.loginId || u.userId || '').trim().toLowerCase();
    const uIdNoAlnum = uIdNo.replace(/[^a-z0-9]/g, '');
    const uInternalId = normalizeUniversal(u.id || '').trim().toLowerCase();
    const uBadge = normalizeUniversal(u.badgeNo || u['Badge No'] || '').trim().toLowerCase();
    const uBadgeAlnum = uBadge.replace(/[^a-z0-9]/g, '');
    const uPhoneDigits = normalizeUniversal(u['Phone'] || u.phone || '').replace(/\D/g, '');
    const uPhone10 = uPhoneDigits.length >= 10 ? uPhoneDigits.slice(-10) : uPhoneDigits;

    if (uIdNo && uIdNo === lowerId) return true;
    if (cleanIdAlnum && uIdNoAlnum && uIdNoAlnum === cleanIdAlnum) return true;
    if (uInternalId && uInternalId === lowerId) return true;
    if (uBadge && (uBadge === lowerId || (cleanIdAlnum && uBadgeAlnum === cleanIdAlnum))) return true;
    if (cleanPhone10 && uPhone10 && uPhone10 === cleanPhone10) return true;
    if (cleanDigits && cleanDigits.length >= 4 && uPhoneDigits && cleanDigits === uPhoneDigits) return true;
    return false;
  });
}

function checkUserPasswordMatch(matchedUser: any, cleanPass: string): boolean {
  if (!matchedUser || !cleanPass) return false;
  const passSha256 = crypto.createHash('sha256').update(cleanPass).digest('hex').toLowerCase();
  const passLowerSha256 = crypto.createHash('sha256').update(cleanPass.toLowerCase()).digest('hex').toLowerCase();
  const storedPass = String(
    matchedUser['Password'] !== undefined && matchedUser['Password'] !== ''
      ? matchedUser['Password']
      : (matchedUser.password !== undefined ? matchedUser.password : '')
  ).trim();
  const storedHash = String(matchedUser['Password Hash'] || matchedUser.passwordHash || '').trim().toLowerCase();
  const normStored = normalizeUniversal(storedPass).trim();

  // 1. Plain Text password match (exact or case-insensitive)
  if (
    storedPass &&
    (storedPass === cleanPass ||
      normStored === cleanPass ||
      storedPass.toLowerCase() === cleanPass.toLowerCase() ||
      normStored.toLowerCase() === cleanPass.toLowerCase())
  ) {
    return true;
  }

  // 2. Password Hash match (if Password column itself holds a 64-char SHA-256 hash or Password Hash column matches)
  if (
    storedPass &&
    /^[a-f0-9]{64}$/i.test(storedPass) &&
    (storedPass.toLowerCase() === passSha256 || storedPass.toLowerCase() === passLowerSha256)
  ) {
    return true;
  }
  if (
    storedHash &&
    (storedHash === passSha256 ||
      storedHash === passLowerSha256 ||
      storedHash === cleanPass.toLowerCase())
  ) {
    return true;
  }

  return false;
}

async function authenticateUserCredentials(rawId: any, rawPassword: any): Promise<{ status: number; body: any }> {
  const cleanId = normalizeUniversal(rawId).trim();
  const cleanPass = normalizeUniversal(rawPassword).trim();
  if (!cleanId || !cleanPass) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'ইউজার আইডি / মোবাইল নম্বর এবং পাসওয়ার্ড প্রয়োজন (User ID / Phone & Password required)'
      }
    };
  }

  // 1. Check Users list from Google Sheets Users sheet
  let users = await fetchVerifiedUsersFromSheet(false);
  let matchedUser = findMatchingUserInList(users, cleanId);

  // 2. If user not found or password does not match cached state, force live refresh from Google Sheets Users sheet
  if (!matchedUser || !checkUserPasswordMatch(matchedUser, cleanPass)) {
    users = await fetchVerifiedUsersFromSheet(true);
    matchedUser = findMatchingUserInList(users, cleanId);

    // If user exists in Users sheet, also hydrate their live row directly from Users sheet in case Password column was edited in Google Sheets
    if (matchedUser && !checkUserPasswordMatch(matchedUser, cleanPass)) {
      const liveRow = await hydrateSingleUserFromUsersSheet(matchedUser.id, matchedUser.status || 'active', matchedUser.role || 'worker');
      if (liveRow) {
        matchedUser = liveRow;
        clearUsersStateCache();
      }
    }
  }

  if (!matchedUser) {
    return {
      status: 401,
      body: {
        success: false,
        error: 'ভুল ইউজার আইডি! সঠিক ইউজার আইডি বা মোবাইল নম্বর দিন। (Invalid User ID)'
      }
    };
  }

  const status = String(matchedUser['Status'] || matchedUser.status || 'active').toLowerCase().trim();
  if (status === 'hold') {
    return {
      status: 403,
      body: {
        success: false,
        error: 'আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত (ON HOLD) রাখা হয়েছে। এডমিনের সাথে যোগাযোগ করুন। (Account is on hold)'
      }
    };
  }

  const passwordValid = checkUserPasswordMatch(matchedUser, cleanPass);
  if (!passwordValid) {
    return {
      status: 401,
      body: {
        success: false,
        error: 'ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড বা পিন দিন (Invalid Password)'
      }
    };
  }

  const roleStr = String(matchedUser['Role'] || matchedUser.role || 'worker').trim().toLowerCase();
  const idNoStr = String(matchedUser.idNo || matchedUser['User ID'] || cleanId).trim();
  const isRoleAdmin =
    roleStr === 'admin' ||
    roleStr === 'controller' ||
    roleStr === 'administrator' ||
    roleStr === 'superadmin' ||
    idNoStr === '8695716192' ||
    idNoStr.toLowerCase() === 'admin' ||
    matchedUser.id === 'adm_8695716192' ||
    /^adm[-_0-9]/i.test(idNoStr);

  const session = {
    id: String(matchedUser.id || `usr_${idNoStr}`),
    idNo: idNoStr,
    loginId: idNoStr,
    userId: idNoStr,
    name: String(matchedUser['Full Name'] || matchedUser.name || (isRoleAdmin ? 'NAYEM (Admin Controller)' : 'কর্মী')),
    phone: String(matchedUser['Phone'] || matchedUser.phone || ''),
    role: (isRoleAdmin ? 'admin' : 'worker') as 'admin' | 'worker',
    status: 'active' as const,
    designation: String(matchedUser['Designation'] || matchedUser.designation || (isRoleAdmin ? 'Sub-Divisional Controller' : 'লাইনম্যান / Worker (WBSEDCL)')),
    badgeNo: String(matchedUser['Badge No'] || matchedUser.badgeNo || idNoStr),
    token: `SES-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    loggedInAt: new Date().toISOString()
  };

  return {
    status: 200,
    body: { success: true, session, data: { session } }
  };
}

app.post('/api/auth/login', async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const body = req.body || {};
    const rawId = body.loginId || body.idNo || body.userId || body.phone;
    const result = await authenticateUserCredentials(rawId, body.password);
    return res.status(result.status).json(result.body);
  } catch (error: any) {
    console.error('Login error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ 
        success: false, 
        error: error?.message || 'Login connection error. Please try again.' 
      });
    }
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const { idNo, currentPassword, newPassword } = req.body;
    const cleanId = normalizeUniversal(idNo).trim();
    const cleanNewPass = normalizeUniversal(newPassword).trim();
    const users = await fetchVerifiedUsersFromSheet();
    const target = findMatchingUserInList(users, cleanId);
    if (target) {
      const syncTag = buildUserSyncTag({ ...target, password: cleanNewPass });
      const updatedTarget = {
        ...target,
        password: cleanNewPass,
        Password: cleanNewPass,
        status: target.status || 'active',
        createdAt: syncTag,
        'Created At': syncTag
      };
      await callGoogleAppsScript('updateEntry', {
        id: target.id,
        category: 'Users',
        status: target.status || 'active',
        role: target.role || 'worker',
        password: cleanNewPass,
        createdAt: syncTag,
        'Created At': syncTag,
        data: updatedTarget
      }, 'POST');
      clearUsersStateCache();
      return res.json({ success: true, message: 'Password updated successfully' });
    }
    const gasRes = await callGoogleAppsScript('changePassword', {
      idNo: cleanId,
      currentPassword: normalizeUniversal(currentPassword),
      newPassword: cleanNewPass
    }, 'POST');
    clearUsersStateCache();
    return res.json(gasRes);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const { idNo, phone, newPassword } = req.body;
    const cleanId = normalizeUniversal(idNo).trim();
    const cleanNewPass = normalizeUniversal(newPassword).trim();
    const users = await fetchVerifiedUsersFromSheet();
    const target = findMatchingUserInList(users, cleanId || phone);
    if (target) {
      const syncTag = buildUserSyncTag({ ...target, password: cleanNewPass });
      const updatedTarget = {
        ...target,
        password: cleanNewPass,
        Password: cleanNewPass,
        status: target.status || 'active',
        createdAt: syncTag,
        'Created At': syncTag
      };
      await callGoogleAppsScript('updateEntry', {
        id: target.id,
        category: 'Users',
        status: target.status || 'active',
        role: target.role || 'worker',
        password: cleanNewPass,
        createdAt: syncTag,
        'Created At': syncTag,
        data: updatedTarget
      }, 'POST');
      clearUsersStateCache();
      return res.json({ success: true, message: 'Password reset successfully' });
    }
    const gasRes = await callGoogleAppsScript('resetPassword', {
      idNo: cleanId,
      phone: normalizeUniversal(phone),
      newPassword: cleanNewPass
    }, 'POST');
    clearUsersStateCache();
    return res.json(gasRes);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/verify/:idNo', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const cleanId = normalizeUniversal(req.params.idNo).trim().toLowerCase();
    const users = await fetchVerifiedUsersFromSheet();
    const matched = users.find((u: any) => String(u.idNo).trim().toLowerCase() === cleanId || String(u.id).trim().toLowerCase() === cleanId || String(u.phone || '').includes(cleanId));
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

// Entry deletion validation helper (simplified to support direct confirm/cancel)
async function validateEntryDeletion(entryId: string, clientPayload: any): Promise<{ allowed: boolean; error?: string; isCritical?: boolean; record?: any }> {
  const cleanId = String(entryId || '').trim();
  if (!cleanId) {
    return { allowed: false, error: 'Record ID is required for deletion.' };
  }
  return { allowed: true, isCritical: false, record: clientPayload?.entry || null };
}

// User deletion validation helper
async function validateUserDeletion(userId: string, clientPayload: any): Promise<{ allowed: boolean; error?: string }> {
  const cleanId = String(userId || '').trim().toLowerCase();
  if (!cleanId) {
    return { allowed: false, error: 'User ID is required for deletion.' };
  }

  // Permanently block Primary Admin accounts
  const PROTECTED_ADMIN_IDS = ['8695716192', 'adm_8695716192', 'admin', 'nayem'];
  if (PROTECTED_ADMIN_IDS.includes(cleanId)) {
    return {
      allowed: false,
      error: 'PRIMARY_ADMIN_PROTECTED: The Primary System Administrator account (8695716192 / admin) is permanently protected from deletion.'
    };
  }

  // Fetch users to verify role and status
  let userRecord: any = null;
  try {
    const users = await fetchVerifiedUsersFromSheet();
    userRecord = users.find((u: any) => {
      const uId = String(u.id || '').trim().toLowerCase();
      const uIdNo = String(u.idNo || u['User ID'] || '').trim().toLowerCase();
      return (uId && uId === cleanId) || (uIdNo && uIdNo === cleanId);
    });
  } catch (err) {
    console.warn('[Validation] Could not fetch users to verify status:', err);
  }

  if (userRecord) {
    const role = String(userRecord.role || userRecord.Role || '').toLowerCase();
    const idNo = String(userRecord.idNo || userRecord['User ID'] || '').toLowerCase();
    
    if (PROTECTED_ADMIN_IDS.includes(idNo)) {
      return {
        allowed: false,
        error: 'PRIMARY_ADMIN_PROTECTED: Primary Admin accounts cannot be deleted under any circumstances.'
      };
    }

    if (role === 'admin' || role === 'controller') {
      const confirmAdminDelete = Boolean(clientPayload?.confirmAdminDelete === true || clientPayload?.confirmAdminDelete === 'true');
      if (!confirmAdminDelete) {
        return {
          allowed: false,
          error: 'ADMIN_ACCOUNT_PROTECTED: Deleting an Administrator account requires explicit admin deletion confirmation.'
        };
      }
    }
  }

  // Mandatory confirmation required for any user deletion to prevent accidental clicks
  const confirmDelete = Boolean(clientPayload?.confirmDelete === true || clientPayload?.confirmDelete === 'true');
  if (!confirmDelete) {
    return {
      allowed: false,
      error: 'MANDATORY_CONFIRMATION_REQUIRED: Accidental user deletion blocked. Mandatory confirmation prompt acknowledgment required.'
    };
  }

  return { allowed: true };
}

// ============================================================================
// CENTRAL GAS PROXY (Supports all operations with strict JSON responses)
// ============================================================================
app.all('/api/gas-proxy', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const isGet = req.method === 'GET';
    const action = String(req.body?.action || req.query?.action || '').trim();
    const payload = isGet ? { ...req.query } : (req.body?.payload || req.body || {});
    const method = (req.body?.method || req.method || 'POST') as 'GET' | 'POST';
    if (!action) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'INVALID_REQUEST', message: 'Action parameter is required' },
        requestId: `REQ-${Date.now()}`
      });
    }

    // Intercept user operations so they work seamlessly even if deployed GAS uses generic sheet actions
    if (action === 'users' || action === 'getUsers') {
      const users = await fetchVerifiedUsersFromSheet();
      return res.json({
        success: true,
        users,
        data: { users },
        requestId: `REQ-${Date.now()}`
      });
    }

    if (action === 'login') {
      const rawId = payload.idNo || payload.loginId || payload.userId || payload.phone;
      const rawPass = payload.password;
      const result = await authenticateUserCredentials(rawId, rawPass);
      return res.status(result.status).json(result.body);
    }

    // Server-side validation for record deletion
    if (action === 'deleteEntry' || action === 'deleteRecord' || action === 'deleteDisconnectionTask') {
      const targetId = String(payload.id || payload.submissionId || payload.consumerId || payload['Consumer Id'] || payload.taskId || '').trim();
      payload.confirmCritical = true;
      payload.reason = payload.reason || 'Admin deletion confirmed';
      const validation = await validateEntryDeletion(targetId, payload);
      if (!validation.allowed) {
        return res.status(403).json({
          success: false,
          isCritical: validation.isCritical,
          error: { code: 'CRITICAL_RECORD_PROTECTION', message: validation.error },
          message: validation.error,
          requestId: `REQ-${Date.now()}`
        });
      }
      const cleanConsumerId = String(payload.consumerId || payload['Consumer Id'] || targetId).replace(/^TASK-DISC-/i, '').trim();
      registerDeletedRecord(targetId, cleanConsumerId, payload.submissionId);
      executeSheetDeleteInBackground(targetId, cleanConsumerId, payload);
      return res.json({
        success: true,
        deleted: true,
        id: targetId,
        message: `Record #${targetId} deleted`,
        requestId: `REQ-${Date.now()}`
      });
    }

    const targetCategory = String(payload?.category || payload?.data?.category || '').trim().toLowerCase();

    // If gas-proxy is called with category='Users', route directly to Users sheet handlers!
    if (targetCategory === 'users') {
      if (action === 'entries' || action === 'getRecords' || action === 'users' || action === 'getUsers') {
        const users = await fetchVerifiedUsersFromSheet(Boolean(payload?.refresh || payload?.force));
        return res.json({
          success: true,
          users,
          entries: users,
          data: users,
          requestId: `REQ-${Date.now()}`
        });
      }
      if (action === 'submitRecord' || action === 'createEntry' || action === 'updateEntry' || action === 'updateRecord') {
        const rawRes = await callGoogleAppsScript(action, payload, 'POST', 25000);
        clearUsersStateCache();
        return res.json(rawRes);
      }
      if (action === 'deleteEntry' || action === 'deleteRecord') {
        const rawRes = await callGoogleAppsScript('deleteEntry', { ...payload, category: 'Users' }, 'POST', 25000);
        clearUsersStateCache();
        return res.json(rawRes);
      }
    }

    // Intercept entries read for instant response + background live sync
    if (action === 'entries' || action === 'getRecords' || action === 'getMasterData') {
      const entriesList = await getFastMergedEntries(payload, Boolean(payload?.refresh || payload?.force));
      return res.json({
        success: true,
        entries: entriesList,
        data: { entries: entriesList },
        requestId: `REQ-${Date.now()}`
      });
    }

    // Intercept createEntry / submitRecord for instant save + background Google Sheets persistence
    if (
      action === 'createEntry' ||
      action === 'submitRecord' ||
      action === 'saveEntry' ||
      action === 'createNSC' ||
      action === 'createNewConnection' ||
      action === 'createDisconnection' ||
      action === 'createPoleCase' ||
      action === 'createMeterReplacement' ||
      action === 'createDTRReplacement'
    ) {
      const entryData = (payload && typeof payload.data === 'object') ? payload.data : payload;
      const savedEntry = handleFastCreateEntry(entryData, action);
      return res.json({
        success: true,
        entry: savedEntry,
        data: savedEntry,
        recordId: savedEntry.id,
        submissionId: savedEntry.submissionId,
        message: 'Record saved and syncing to Google Sheets',
        requestId: `REQ-${Date.now()}`
      });
    }

    // Intercept updateEntry for instant update + background Google Sheets persistence
    if (action === 'updateEntry' || action === 'updateRecord' || action === 'editEntry') {
      const targetId = String(payload.id || payload.submissionId || payload?.data?.id || '').trim();
      const bodyData = (payload && typeof payload.data === 'object') ? payload.data : payload;
      const updatedEntry = handleFastUpdateEntry(targetId, bodyData);
      return res.json({
        success: true,
        entry: updatedEntry,
        data: updatedEntry,
        message: `Record #${targetId} updated`,
        requestId: `REQ-${Date.now()}`
      });
    }

    // Server-side validation for user deletion
    if (action === 'deleteUser') {
      const targetId = payload.id || payload.idNo;
      const validation = await validateUserDeletion(targetId, payload);
      if (!validation.allowed) {
        return res.status(403).json({
          success: false,
          error: { code: 'USER_DELETION_PROTECTED', message: validation.error },
          message: validation.error,
          requestId: `REQ-${Date.now()}`
        });
      }
      const users = await fetchVerifiedUsersFromSheet();
      const targetUser = users.find(u => String(u.id).toLowerCase() === String(targetId).toLowerCase() || String(u.idNo).toLowerCase() === String(targetId).toLowerCase());
      const rowIdToDelete = targetUser ? targetUser.id : targetId;
      clearUsersStateCache();
      callGoogleAppsScript('deleteEntry', { id: rowIdToDelete, category: 'Users' }, 'POST').catch(() => {});
      return res.json({ success: true, message: `User #${targetId} deleted` });
    }

    // Server-side safety guard against accidental bulk wipe
    if (action === 'clearEntries' || action === 'clearAllEntries') {
      if (payload.confirmClearAll !== 'CONFIRM_PERMANENT_WIPE') {
        return res.status(403).json({
          success: false,
          error: { code: 'BULK_CLEAR_BLOCKED', message: 'Bulk clearing of production database is blocked by server-side safety policy. Explicit confirmation phrase required.' },
          message: 'Bulk clearing of production database is blocked by server-side safety policy.',
          requestId: `REQ-${Date.now()}`
        });
      }
    }

    // Intercept Work Orders & Khata operations in gas-proxy
    if (action === 'workorders' || action === 'getWorkOrders') {
      const orders = await getMergedWorkOrders(payload?.category, Boolean(payload?.refresh || payload?.force));
      return res.json({
        success: true,
        workOrders: orders,
        data: { workOrders: orders },
        requestId: `REQ-${Date.now()}`
      });
    }

    if (action === 'uploadWorkOrder' || action === 'createWorkOrder') {
      const rawData = (payload && typeof payload.data === 'object') ? payload.data : payload;
      const saved = await handleCreateWorkOrder(rawData);
      return res.json({
        success: true,
        workOrder: saved,
        data: { workOrder: saved },
        requestId: `REQ-${Date.now()}`
      });
    }

    if (action === 'deleteWorkOrder') {
      const targetId = String(payload?.id || payload?.data?.id || '').trim();
      await handleDeleteWorkOrder(targetId);
      return res.json({
        success: true,
        deleted: true,
        id: targetId,
        message: 'Work order deleted',
        requestId: `REQ-${Date.now()}`
      });
    }

    if (action === 'toggleWorkOrder') {
      const targetId = String(payload?.id || payload?.data?.id || '').trim();
      const isHidden = Boolean(payload?.isHidden ?? payload?.data?.isHidden);
      const updated = await handleToggleWorkOrderVisibility(targetId, isHidden);
      return res.json({
        success: true,
        workOrder: updated,
        data: { workOrder: updated },
        requestId: `REQ-${Date.now()}`
      });
    }

    // Intercept Dashboard Stats in gas-proxy
    if (action === 'stats' || action === 'getStats' || action === 'getDashboard' || action === 'getDashboardStats') {
      const stats = await computeLiveDashboardStats();
      return res.json({
        success: true,
        stats,
        data: { stats },
        requestId: `REQ-${Date.now()}`
      });
    }

    // Intercept Chat operations in gas-proxy
    if (action === 'chat' || action === 'getChat' || action === 'getChatMessages') {
      const messages = await getChatMessagesList(payload?.workerId);
      return res.json({
        success: true,
        messages,
        data: { messages },
        requestId: `REQ-${Date.now()}`
      });
    }

    if (action === 'sendChat' || action === 'sendChatMessage') {
      const msgData = (payload && typeof payload.data === 'object') ? payload.data : payload;
      const savedMsg = await handleSendChatMessage(msgData);
      return res.json({
        success: true,
        message: savedMsg,
        data: { message: savedMsg },
        requestId: `REQ-${Date.now()}`
      });
    }

    if (action === 'clearChat' || action === 'clearChatMessages') {
      await handleClearChatMessages();
      return res.json({
        success: true,
        message: 'Chat history cleared',
        requestId: `REQ-${Date.now()}`
      });
    }

    // Intercept Disconnection read in gas-proxy
    if (action === 'disconnectiontasks' || action === 'getDisconnectionTasks') {
      const allTasks = cachedDisconnectionState && cachedDisconnectionState.tasks.length > 0
        ? mergeSheetDisconnectionTasksWithOverlay(cachedDisconnectionState.tasks)
        : await fetchDisconnectionTasksFromGoogleSheet();
      const role = String(payload?.role || '').toLowerCase();
      const workerId = String(payload?.workerId || '').toLowerCase().trim();
      const workerName = String(payload?.workerName || '').toLowerCase().trim();
      let filtered = allTasks;
      if (role === 'worker' && (workerId || workerName)) {
        filtered = allTasks.filter((t: any) => {
          const aId = String(t.assignedWorkerId || '').toLowerCase().trim();
          const aNm = String(t.assignedWorkerName || '').toLowerCase().trim();
          return (!aId && !aNm) || (workerId && aId === workerId) || (workerName && aNm === workerName);
        });
      }
      const stats = computeLocalStats(filtered, workerId, workerName);
      return res.json({
        success: true,
        tasks: filtered,
        stats,
        data: { tasks: filtered, stats },
        requestId: `REQ-${Date.now()}`
      });
    }

    // Intercept Disconnection operations in gas-proxy so they use updateEntry / submitRecord on Disconnection sheet
    if (action === 'updateDisconnection' || action === 'submitDisconnectionReport') {
      const cId = String(payload.consumerId || payload['Consumer Id'] || payload.id || payload.taskId || '').replace(/^TASK-DISC-/i, '').trim();
      const upRes = await callGoogleAppsScript(
        'updateEntry',
        { id: cId, submissionId: cId, consumerId: cId, category: 'Disconnection', ...payload, data: payload },
        'POST',
        30000
      );
      return res.json({
        success: true,
        message: 'Disconnection record updated in Google Sheets',
        result: upRes,
        requestId: `REQ-${Date.now()}`
      });
    }

    if (action === 'assignDisconnectionTask' || action === 'archiveDisconnectionTask' || action === 'restoreDisconnectionTask') {
      const cId = String(payload.consumerId || payload['Consumer Id'] || payload.taskId || payload.id || '').replace(/^TASK-DISC-/i, '').trim();
      const patch: Record<string, any> = { ...payload, consumerId: cId, 'Consumer Id': cId };
      if (action === 'assignDisconnectionTask') {
        patch.assignedAgency = payload.workerName || '';
        patch.Agency = payload.workerName || '';
      } else if (action === 'archiveDisconnectionTask') {
        patch.disconStatus = 'CANCELLED';
        patch['Discon Status'] = 'CANCELLED';
      } else if (action === 'restoreDisconnectionTask') {
        patch.disconStatus = 'PENDING';
        patch['Discon Status'] = 'PENDING';
      }
      if (cId) {
        const existing = localDisconnectionOverlayMap.get(cId.toLowerCase()) || {};
        localDisconnectionOverlayMap.set(cId.toLowerCase(), { ...existing, ...patch, _localUpdatedAt: Date.now() });
        saveDiscOverlayToDisk();
        callGoogleAppsScript('updateEntry', { id: cId, consumerId: cId, category: 'Disconnection', ...patch, data: patch }, 'POST', 25000).catch(() => {});
      }
      return res.json({
        success: true,
        message: `Disconnection action ${action} completed`,
        requestId: `REQ-${Date.now()}`
      });
    }

    if (action === 'getDisconnectionHistory') {
      return res.json({
        success: true,
        history: [],
        requestId: `REQ-${Date.now()}`
      });
    }

    const result = await callGoogleAppsScript(action, payload, method);
    return res.json(result);
  } catch (err: any) {
    console.error('GAS proxy error:', err);
    return res.status(200).json({ 
      success: false,
      data: null,
      error: { code: 'PROXY_COMMUNICATION_ERROR', message: err.message || 'Google Apps Script communication error' },
      requestId: `REQ-${Date.now()}`
    });
  }
});

// ============================================================================
// PERSISTENT DISK CACHE & TOMBSTONES FOR INSTANT (<10ms) READ/WRITE/DELETE
// ============================================================================
const TOMBSTONES_FILE = path.join(process.cwd(), '.deleted-tombstones.json');
const DISC_OVERLAY_FILE = path.join(process.cwd(), '.disconnection-overlay.json');
const DISC_CACHE_FILE = path.join(process.cwd(), '.disconnection-cache.json');
const ENTRIES_OVERLAY_FILE = path.join(process.cwd(), '.entries-overlay.json');
const ENTRIES_CACHE_FILE = path.join(process.cwd(), '.entries-cache.json');

const deletedTombstoneSet = new Set<string>();
const localDisconnectionOverlayMap = new Map<string, any>();
const localEntriesOverlayMap = new Map<string, any>();

interface CachedEntriesState {
  entries: any[];
  timestamp: number;
}
let cachedEntriesState: CachedEntriesState | null = null;
let isRefreshingEntriesInBg = false;
let isRefreshingDiscInBg = false;

function loadDiskPersistence() {
  try {
    if (fs.existsSync(TOMBSTONES_FILE)) {
      const arr = JSON.parse(fs.readFileSync(TOMBSTONES_FILE, 'utf-8'));
      if (Array.isArray(arr)) arr.forEach(id => deletedTombstoneSet.add(String(id).trim().toLowerCase()));
    }
  } catch {}
  try {
    if (fs.existsSync(DISC_OVERLAY_FILE)) {
      const obj = JSON.parse(fs.readFileSync(DISC_OVERLAY_FILE, 'utf-8'));
      if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          localDisconnectionOverlayMap.set(k, v);
        }
      }
    }
  } catch {}
  try {
    if (fs.existsSync(ENTRIES_OVERLAY_FILE)) {
      const obj = JSON.parse(fs.readFileSync(ENTRIES_OVERLAY_FILE, 'utf-8'));
      if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          localEntriesOverlayMap.set(k, v);
        }
      }
    }
  } catch {}
  try {
    if (fs.existsSync(ENTRIES_CACHE_FILE)) {
      const arr = JSON.parse(fs.readFileSync(ENTRIES_CACHE_FILE, 'utf-8'));
      if (Array.isArray(arr) && arr.length > 0) {
        cachedEntriesState = { entries: arr, timestamp: Date.now() - 10000 };
      }
    }
  } catch {}
}
loadDiskPersistence();

function saveTombstonesToDisk() {
  try {
    fs.writeFileSync(TOMBSTONES_FILE, JSON.stringify(Array.from(deletedTombstoneSet)), 'utf-8');
  } catch {}
}

function saveDiscOverlayToDisk() {
  try {
    const obj: Record<string, any> = {};
    for (const [k, v] of localDisconnectionOverlayMap.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(DISC_OVERLAY_FILE, JSON.stringify(obj), 'utf-8');
  } catch {}
}

function saveEntriesOverlayToDisk() {
  try {
    const obj: Record<string, any> = {};
    for (const [k, v] of localEntriesOverlayMap.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(ENTRIES_OVERLAY_FILE, JSON.stringify(obj), 'utf-8');
  } catch {}
}

function isRecordDeleted(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  const st = String(item.status || item.disconStatus || item['Discon Status'] || item.taskStatus || '').trim().toUpperCase();
  const notes = String(item.notes || item['Notes'] || item.workerRemarks || '').trim();
  if (st === 'DELETED' || notes.includes('[DELETED_BY_ADMIN]')) return true;

  const candidates = [
    item.id,
    item.submissionId,
    item.consumerId,
    item['Consumer Id'],
    item['Consumer ID'],
    item.taskId,
    item['Record ID'],
    item['Submission ID']
  ];
  for (const c of candidates) {
    if (c) {
      const norm = String(c).trim().toLowerCase();
      const bare = norm.replace(/^task-disc-/i, '');
      if (norm && (deletedTombstoneSet.has(norm) || (bare && deletedTombstoneSet.has(bare)))) {
        return true;
      }
    }
  }
  return false;
}

function registerDeletedRecord(id?: string, consumerId?: string, submissionId?: string) {
  const toDelete = [id, consumerId, submissionId, consumerId ? `TASK-DISC-${consumerId}` : '']
    .map(v => String(v || '').trim().toLowerCase())
    .filter(Boolean);

  for (const key of toDelete) {
    deletedTombstoneSet.add(key);
    const bare = key.replace(/^task-disc-/i, '');
    if (bare) deletedTombstoneSet.add(bare);
    localDisconnectionOverlayMap.delete(key);
    if (bare) localDisconnectionOverlayMap.delete(bare);
    localEntriesOverlayMap.delete(key);
    if (bare) localEntriesOverlayMap.delete(bare);
  }

  if (cachedEntriesState && Array.isArray(cachedEntriesState.entries)) {
    cachedEntriesState.entries = cachedEntriesState.entries.filter(e => !isRecordDeleted(e));
    try { fs.writeFileSync(ENTRIES_CACHE_FILE, JSON.stringify(cachedEntriesState.entries), 'utf-8'); } catch {}
  }

  if (cachedDisconnectionState && Array.isArray(cachedDisconnectionState.tasks)) {
    cachedDisconnectionState.tasks = cachedDisconnectionState.tasks.filter(t => !isRecordDeleted(t));
    try { fs.writeFileSync(DISC_CACHE_FILE, JSON.stringify(cachedDisconnectionState.tasks), 'utf-8'); } catch {}
  }

  saveTombstonesToDisk();
  saveDiscOverlayToDisk();
  saveEntriesOverlayToDisk();
  gasCache.clear();
}

function executeSheetDeleteInBackground(cleanId: string, cleanConsumerId: string, clientPayload: any = {}) {
  (async () => {
    const isDiscCategory =
      String(clientPayload.category || '').toUpperCase().includes('DISCONNECT') ||
      String(cleanId).toUpperCase().startsWith('TASK-DISC-') ||
      Boolean(cleanConsumerId && cleanConsumerId === cleanId);

    const payload = {
      id: cleanId,
      consumerId: cleanConsumerId,
      'Consumer Id': cleanConsumerId,
      taskId: clientPayload.taskId || (cleanConsumerId ? `TASK-DISC-${cleanConsumerId}` : cleanId),
      category: isDiscCategory ? 'Disconnection' : (clientPayload.category || ''),
      submissionId: clientPayload.submissionId || cleanConsumerId || cleanId,
      confirmCritical: true,
      reason: clientPayload.reason || 'Admin deletion confirmed',
      status: clientPayload.status,
      meterNo: clientPayload.meterNo,
      sealNo: clientPayload.sealNo
    };

    try {
      const res = await callGoogleAppsScript('deleteEntry', payload, 'POST', 25000);
      if (isDiscCategory && (!res || res.deleted !== true)) {
        try {
          await callGoogleAppsScript('deleteDisconnectionTask', payload, 'POST', 20000);
        } catch {}
        try {
          await callGoogleAppsScript('submitDisconnectionReport', {
            consumerId: cleanConsumerId,
            'Consumer Id': cleanConsumerId,
            taskId: payload.taskId,
            disconStatus: 'DELETED',
            'Discon Status': 'DELETED',
            notes: '[DELETED_BY_ADMIN]',
            'Notes': '[DELETED_BY_ADMIN]'
          }, 'POST', 20000);
        } catch {}
      }
      gasCache.clear();
    } catch (err) {
      console.warn('[Background Delete] Notice:', err);
    }
  })();
}

function handleFastCreateEntry(rawPayload: any, actionName = 'createEntry'): any {
  const payload = { ...(rawPayload || {}) };
  if (!payload.category) {
    if (actionName === 'createNSC' || actionName === 'createNewConnection') payload.category = 'NSC';
    else if (actionName === 'createDisconnection') payload.category = 'DISCONNECTION';
    else if (actionName === 'createPoleCase') payload.category = 'POLE CASE';
    else if (actionName === 'createMeterReplacement') payload.category = 'METER REPLESMENT';
    else if (actionName === 'createDTRReplacement') payload.category = 'DTR REPLESMENT';
    else payload.category = 'NSC';
  }
  const nowIso = new Date().toISOString();
  payload.id = String(payload.id || `PWR-${Date.now().toString().slice(-6)}`).trim();
  payload.submissionId = String(payload.submissionId || payload.id).trim();
  payload.createdAt = payload.createdAt || nowIso;
  payload.updatedAt = nowIso;
  payload.date = payload.date || nowIso;

  deletedTombstoneSet.delete(payload.id.toLowerCase());
  deletedTombstoneSet.delete(payload.submissionId.toLowerCase());
  if (payload.consumerId) deletedTombstoneSet.delete(String(payload.consumerId).trim().toLowerCase());

  const normalized = normalizeServerEntry(payload);
  localEntriesOverlayMap.set(normalized.id.toLowerCase(), { ...normalized, _localUpdatedAt: Date.now(), _syncedToSheet: false });
  saveEntriesOverlayToDisk();

  if (cachedEntriesState && Array.isArray(cachedEntriesState.entries)) {
    cachedEntriesState.entries = [
      normalized,
      ...cachedEntriesState.entries.filter(e => e.id !== normalized.id && e.submissionId !== normalized.submissionId)
    ];
    try { fs.writeFileSync(ENTRIES_CACHE_FILE, JSON.stringify(cachedEntriesState.entries), 'utf-8'); } catch {}
  }

  (async () => {
    try {
      const res = await callGoogleAppsScript('createEntry', { data: payload, ...payload }, 'POST', 35000);
      if (res && res.success !== false) {
        const existing = localEntriesOverlayMap.get(normalized.id.toLowerCase());
        if (existing) {
          existing._syncedToSheet = true;
          saveEntriesOverlayToDisk();
        }
      }
      gasCache.clear();
    } catch (err) {
      console.warn('[Background CreateEntry] Notice:', err);
    }
  })();

  return normalized;
}

function handleFastUpdateEntry(cleanId: string, bodyData: any): any {
  const nowIso = new Date().toISOString();
  const key = cleanId.toLowerCase();
  const existingInCache = cachedEntriesState?.entries?.find(e => String(e.id).toLowerCase() === key || String(e.submissionId).toLowerCase() === key) || {};
  const existingOverlay = localEntriesOverlayMap.get(key) || {};

  const merged = normalizeServerEntry({
    ...existingInCache,
    ...existingOverlay,
    ...bodyData,
    id: cleanId,
    updatedAt: nowIso
  });

  localEntriesOverlayMap.set(key, { ...merged, _localUpdatedAt: Date.now(), _syncedToSheet: false });
  saveEntriesOverlayToDisk();

  if (cachedEntriesState && Array.isArray(cachedEntriesState.entries)) {
    const idx = cachedEntriesState.entries.findIndex(e => String(e.id).toLowerCase() === key || String(e.submissionId).toLowerCase() === key);
    if (idx !== -1) {
      cachedEntriesState.entries[idx] = { ...cachedEntriesState.entries[idx], ...merged };
    } else {
      cachedEntriesState.entries.unshift(merged);
    }
    try { fs.writeFileSync(ENTRIES_CACHE_FILE, JSON.stringify(cachedEntriesState.entries), 'utf-8'); } catch {}
  }

  const category = bodyData.category || merged.category || '';
  const submissionId = bodyData.submissionId || merged.submissionId || cleanId;
  const payload = {
    id: cleanId,
    category,
    submissionId,
    ...bodyData,
    data: bodyData
  };

  (async () => {
    try {
      await callGoogleAppsScript('updateEntry', payload, 'POST', 35000);
      const ov = localEntriesOverlayMap.get(key);
      if (ov) {
        ov._syncedToSheet = true;
        saveEntriesOverlayToDisk();
      }
      gasCache.clear();
    } catch (err) {
      console.warn('[Background UpdateEntry] Notice:', err);
    }
  })();

  return merged;
}

function mergeEntriesWithOverlay(sheetEntries: any[]): any[] {
  const filteredSheet = sheetEntries
    .map(normalizeServerEntry)
    .filter((e: any) => {
      if (!e || isRecordDeleted(e)) return false;
      const catUpper = String(e.category || '').toUpperCase().trim();
      if (catUpper === 'USERS' || catUpper === 'USERS_AUTH' || catUpper === 'WORKORDERS_KHATA') return false;
      if (catUpper === 'DISCONNECTION' && !isValidDisconnectionConsumerRow(e)) return false;
      return true;
    });

  const resultMap = new Map<string, any>();
  for (const e of filteredSheet) {
    const k = String(e.id || e.submissionId || e.consumerId || '').trim().toLowerCase();
    if (k) resultMap.set(k, e);
  }

  for (const [k, ov] of localEntriesOverlayMap.entries()) {
    if (isRecordDeleted(ov)) continue;
    const ovCatUpper = String(ov?.category || '').toUpperCase().trim();
    if (ovCatUpper === 'USERS' || ovCatUpper === 'USERS_AUTH' || ovCatUpper === 'WORKORDERS_KHATA') continue;
    const existing = resultMap.get(k);
    if (!existing) {
      resultMap.set(k, ov);
    } else {
      resultMap.set(k, { ...existing, ...ov });
    }
  }

  return Array.from(resultMap.values());
}

async function refreshEntriesFromSheetInBackground() {
  if (isRefreshingEntriesInBg) return;
  isRefreshingEntriesInBg = true;
  try {
    gasCache.clear();
    const result = await callGoogleAppsScript('entries', {}, 'GET', 25000);
    const rawEntries = extractEntriesArray(result);
    if (rawEntries.length > 0 || !cachedEntriesState) {
      const merged = mergeEntriesWithOverlay(rawEntries);
      cachedEntriesState = { entries: merged, timestamp: Date.now() };
      try { fs.writeFileSync(ENTRIES_CACHE_FILE, JSON.stringify(merged), 'utf-8'); } catch {}
    }
  } catch (err) {
    console.warn('[Background Entries Sync] Notice:', err);
  } finally {
    isRefreshingEntriesInBg = false;
  }
}

async function getFastMergedEntries(query: any = {}, forceRefresh = false): Promise<any[]> {
  if (cachedEntriesState && cachedEntriesState.entries.length > 0) {
    const age = Date.now() - cachedEntriesState.timestamp;
    if (forceRefresh || age > 6000) {
      refreshEntriesFromSheetInBackground();
    }
    let list = mergeEntriesWithOverlay(cachedEntriesState.entries);
    if (query?.category && query.category !== 'ALL') {
      const catUpper = String(query.category).toUpperCase().trim();
      list = list.filter(e => String(e.category || '').toUpperCase().trim() === catUpper);
    }
    return list;
  }

  try {
    const result = await callGoogleAppsScript('entries', query, 'GET', 20000);
    const rawEntries = extractEntriesArray(result);
    const merged = mergeEntriesWithOverlay(rawEntries);
    if (!query?.category || query.category === 'ALL') {
      cachedEntriesState = { entries: merged, timestamp: Date.now() };
      try { fs.writeFileSync(ENTRIES_CACHE_FILE, JSON.stringify(merged), 'utf-8'); } catch {}
    }
    return merged;
  } catch {
    return mergeEntriesWithOverlay(cachedEntriesState?.entries || []);
  }
}

// ============================================================================
// ENTRIES CRUD (Instant Response + Background Google Sheets Sync)
// ============================================================================
app.get('/api/entries', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const force = req.query.refresh === 'true' || req.query.force === 'true';
    const entries = await getFastMergedEntries(req.query, force);
    return res.json(entries);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch entries from Google Sheets' });
  }
});

app.post('/api/entries', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const payload = req.body.data || req.body;
    const saved = handleFastCreateEntry(payload, 'createEntry');
    return res.status(201).json({ success: true, entry: saved, data: saved });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to submit entry to Google Sheets' });
  }
});

const handleEntryUpdateRequest = async (req: express.Request, res: express.Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const id = (req.params as any)?.id || req.body?.id || req.query?.id;
    const cleanId = String(id || '').trim();
    if (!cleanId) {
      return res.status(400).json({ success: false, error: 'Record ID is required for update.' });
    }
    const bodyData = (req.body && typeof req.body.data === 'object') ? req.body.data : req.body;
    const updated = handleFastUpdateEntry(cleanId, bodyData);
    return res.json({ success: true, entry: updated, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to update entry in Google Sheets' });
  }
};

app.put('/api/entries/:id', handleEntryUpdateRequest);
app.patch('/api/entries/:id', handleEntryUpdateRequest);
app.post('/api/entries/:id/update', handleEntryUpdateRequest);
app.post('/api/entries/update', handleEntryUpdateRequest);

const handleEntryDeleteRequest = async (req: express.Request, res: express.Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const id = (req.params as any)?.id || req.body?.id || req.query?.id;
    const cleanId = String(id || '').trim();
    if (!cleanId) {
      return res.status(400).json({ success: false, error: 'Record ID is required for deletion.' });
    }

    const clientPayload = { ...req.query, ...req.body };
    const cleanConsumerId = String(clientPayload.consumerId || clientPayload['Consumer Id'] || cleanId).replace(/^TASK-DISC-/i, '').trim();

    registerDeletedRecord(cleanId, cleanConsumerId, clientPayload.submissionId);
    executeSheetDeleteInBackground(cleanId, cleanConsumerId, clientPayload);

    return res.json({
      success: true,
      deleted: true,
      id: cleanId,
      message: `Record #${cleanId} immediately deleted and syncing to Google Sheets`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete entry' });
  }
};

app.delete('/api/entries/:id', handleEntryDeleteRequest);
app.post('/api/entries/:id/delete', handleEntryDeleteRequest);
app.post('/api/entries/delete', handleEntryDeleteRequest);

// ============================================================================
// USERS CRUD (Direct Google Sheets Users Sheet)
// ============================================================================
app.get('/api/users', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const forceRefresh = req.query.refresh === 'true' || req.query.force === 'true';
    const users = await fetchVerifiedUsersFromSheet(forceRefresh);
    return res.json({
      success: true,
      data: { users },
      users,
      error: null,
      requestId: `REQ-${Date.now()}`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { code: 'USERS_FETCH_ERROR', message: err.message },
      requestId: `REQ-${Date.now()}`
    });
  }
});

app.post('/api/users', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const payload = req.body.data || req.body;
    const cleanIdNo = normalizeUniversal(payload.idNo || payload.phone || '').trim();
    const cleanPhone = normalizeUniversal(payload.phone || '').replace(/\D/g, '');
    const plainPass = normalizeUniversal(payload.password || '1234').trim();
    const passHash = crypto.createHash('sha256').update(plainPass).digest('hex').toLowerCase();
    const cleanName = String(payload.name || cleanIdNo || 'কর্মী').trim();
    const cleanRole = String(payload.role || 'worker').trim().toLowerCase() === 'admin' ? 'admin' : 'worker';
    const cleanStatus = String(payload.status || 'active').trim().toLowerCase() === 'hold' ? 'hold' : 'active';
    const cleanDesig = String(payload.designation || (cleanRole === 'admin' ? 'সহকারী প্রকৌশলী / Admin (WBSEDCL)' : 'লাইনম্যান / Worker (WBSEDCL)')).trim();
    const cleanBadge = String(payload.badgeNo || cleanIdNo).trim();

    const existingUsers = await fetchVerifiedUsersFromSheet();
    const existingMatch = existingUsers.find(u =>
      String(u.idNo || '').trim().toLowerCase() === cleanIdNo.toLowerCase() ||
      (payload.id && String(u.id || '').trim().toLowerCase() === String(payload.id).trim().toLowerCase())
    );

    const recordId = existingMatch ? existingMatch.id : (payload.id || `USR-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
    const syncTag = buildUserSyncTag({
      idNo: cleanIdNo,
      password: plainPass,
      phone: cleanPhone,
      designation: cleanDesig,
      badgeNo: cleanBadge,
      createdAt: existingMatch?.createdAt
    });

    const userRowData = {
      id: recordId,
      category: 'Users',
      idNo: cleanIdNo,
      'User ID': cleanIdNo,
      password: plainPass,
      'Password': plainPass,
      passwordHash: passHash,
      'Password Hash': passHash,
      name: cleanName,
      'Name': cleanName,
      'Full Name': cleanName,
      consumerName: cleanName,
      phone: cleanPhone,
      'Phone': cleanPhone,
      role: cleanRole,
      'Role': cleanRole,
      status: cleanStatus,
      'Status': cleanStatus,
      designation: cleanDesig,
      'Designation': cleanDesig,
      badgeNo: cleanBadge,
      'Badge No': cleanBadge,
      createdAt: syncTag,
      'Created At': syncTag,
      updatedAt: new Date().toISOString()
    };

    let result: any;
    if (existingMatch) {
      result = await callGoogleAppsScript('updateEntry', {
        id: recordId,
        category: 'Users',
        status: cleanStatus,
        role: cleanRole,
        ...userRowData,
        data: userRowData
      }, 'POST');
    } else {
      result = await callGoogleAppsScript('submitRecord', {
        id: recordId,
        category: 'Users',
        status: cleanStatus,
        role: cleanRole,
        ...userRowData,
        data: userRowData
      }, 'POST');
    }

    const savedUser = normalizeUserRecord(userRowData);
    clearUsersStateCache();
    fetchVerifiedUsersFromSheet(true).catch(() => {});

    return res.status(201).json({
      success: true,
      user: savedUser,
      data: { user: savedUser },
      result
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const id = req.params.id;
    const clientPayload = { ...req.query, ...req.body };
    const validation = await validateUserDeletion(id, clientPayload);
    if (!validation.allowed) {
      return res.status(403).json({
        success: false,
        error: validation.error
      });
    }

    const existingUsers = await fetchVerifiedUsersFromSheet();
    const targetUser = existingUsers.find(u =>
      String(u.id).trim().toLowerCase() === String(id).trim().toLowerCase() ||
      String(u.idNo).trim().toLowerCase() === String(id).trim().toLowerCase()
    );
    const rowId = targetUser ? targetUser.id : id;

    const result = await callGoogleAppsScript('deleteEntry', {
      id: rowId,
      category: 'Users',
      confirmDelete: true,
      confirmAdminDelete: clientPayload.confirmAdminDelete,
      reason: clientPayload.reason
    }, 'POST');

    clearUsersStateCache();
    fetchVerifiedUsersFromSheet(true).catch(() => {});

    return res.json({
      success: true,
      message: `User #${id} successfully deleted`,
      result
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const paramId = String(req.params.id || '').trim();
    const payload = req.body.data || req.body;
    const existingUsers = await fetchVerifiedUsersFromSheet();
    const targetUser = existingUsers.find(u =>
      String(u.id).trim().toLowerCase() === paramId.toLowerCase() ||
      String(u.idNo).trim().toLowerCase() === paramId.toLowerCase()
    );

    const rowId = targetUser ? targetUser.id : paramId;
    const mergedUser: any = {
      ...(targetUser || {}),
      ...payload,
      id: rowId,
      category: 'Users'
    };

    if (payload.password !== undefined && String(payload.password).trim() !== '') {
      const plainPass = normalizeUniversal(payload.password).trim();
      const passHash = crypto.createHash('sha256').update(plainPass).digest('hex').toLowerCase();
      mergedUser.password = plainPass;
      mergedUser['Password'] = plainPass;
      mergedUser.passwordHash = passHash;
      mergedUser['Password Hash'] = passHash;
    } else if (targetUser?.password) {
      mergedUser.password = targetUser.password;
      mergedUser['Password'] = targetUser.password;
    }

    if (payload.name !== undefined) {
      mergedUser.name = String(payload.name).trim();
      mergedUser['Name'] = mergedUser.name;
      mergedUser['Full Name'] = mergedUser.name;
      mergedUser.consumerName = mergedUser.name;
    }
    if (payload.phone !== undefined) {
      mergedUser.phone = normalizeUniversal(payload.phone).replace(/\D/g, '');
      mergedUser['Phone'] = mergedUser.phone;
    }
    if (payload.status !== undefined) {
      mergedUser.status = payload.status === 'hold' ? 'hold' : 'active';
      mergedUser['Status'] = mergedUser.status;
    } else {
      mergedUser.status = targetUser?.status || 'active';
      mergedUser['Status'] = mergedUser.status;
    }
    if (payload.role !== undefined) {
      mergedUser.role = payload.role;
      mergedUser['Role'] = payload.role;
    }

    const syncTag = buildUserSyncTag({
      idNo: mergedUser.idNo || targetUser?.idNo || paramId,
      password: mergedUser.password || targetUser?.password || '',
      phone: mergedUser.phone || targetUser?.phone || '',
      designation: mergedUser.designation || targetUser?.designation || '',
      badgeNo: mergedUser.badgeNo || targetUser?.badgeNo || mergedUser.idNo || paramId,
      createdAt: targetUser?.createdAt
    });
    mergedUser.createdAt = syncTag;
    mergedUser['Created At'] = syncTag;

    const result = await callGoogleAppsScript('updateEntry', {
      id: rowId,
      category: 'Users',
      status: mergedUser.status,
      role: mergedUser.role,
      ...mergedUser,
      data: mergedUser
    }, 'POST');

    const updatedUser = normalizeUserRecord(mergedUser);
    clearUsersStateCache();
    fetchVerifiedUsersFromSheet(true).catch(() => {});

    return res.json({
      success: true,
      user: updatedUser,
      data: { user: updatedUser },
      result
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// WORK ORDERS & KHATA NOTICES (100% Connected to Google Sheets WorkOrders_Khata + Local Disk Cache)
// ============================================================================
const WORK_ORDERS_CACHE_FILE = path.join(process.cwd(), '.work-orders-cache.json');
const WO_SHEET_CATEGORY = 'WorkOrders_Khata';
let serverWorkOrdersCache: any[] = [];
let lastWorkOrdersFetchTime = 0;
let isSyncingWorkOrdersFromSheet = false;

try {
  if (fs.existsSync(WORK_ORDERS_CACHE_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(WORK_ORDERS_CACHE_FILE, 'utf-8'));
    if (Array.isArray(parsed)) {
      serverWorkOrdersCache = parsed.filter(w => w && w.id && !deletedTombstoneSet.has(String(w.id).trim().toLowerCase()));
    }
  }
} catch {}

function saveWorkOrdersToDisk() {
  try {
    fs.writeFileSync(WORK_ORDERS_CACHE_FILE, JSON.stringify(serverWorkOrdersCache), 'utf-8');
  } catch (err) {
    console.warn('[WorkOrders] Disk save notice:', err);
  }
}

function normalizeServerWorkOrder(raw: any): any {
  const id = String(raw.id || `WO-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`).trim();
  const rawImg = String(raw.photoUrl || raw.fileData || raw.fileUrl || raw.directImageUrl || '').trim();
  const binaryEndpoint = `/api/work-orders/${encodeURIComponent(id)}/file`;
  const effectivePhotoUrl = rawImg || binaryEndpoint;

  return {
    id,
    category: String(raw.category || 'NSC').trim(),
    title: String(raw.title || 'WBSEDCL Work Order / Khata Notice').trim(),
    description: String(raw.description || raw.notes || '').trim(),
    photoUrl: effectivePhotoUrl,
    directImageUrl: effectivePhotoUrl,
    fileData: rawImg || effectivePhotoUrl,
    fileUrl: effectivePhotoUrl,
    fileName: String(raw.fileName || `WorkOrder_${id}.jpg`).trim(),
    fileType: String(raw.fileType || 'image/jpeg').trim(),
    fileSize: Number(raw.fileSize || (rawImg ? Math.round(rawImg.length * 0.75) : 0)),
    uploadedBy: String(raw.uploadedBy || '8695716192').trim(),
    adminName: String(raw.adminName || 'Admin Controller').trim(),
    adminPhone: String(raw.adminPhone || '8695716192').trim(),
    uploadDate: String(raw.uploadDate || new Date().toLocaleDateString('en-GB').replace(/\//g, '-')).trim(),
    uploadTime: String(raw.uploadTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })).trim(),
    createdAt: String(raw.createdAt || new Date().toISOString()).trim(),
    isHidden: Boolean(raw.isHidden === true || raw.isHidden === 'true' || raw.isHidden === 'TRUE' || raw.status === 'Hidden'),
    _localSavedAt: raw._localSavedAt || Date.now()
  };
}

async function syncWorkOrderToSheet(wo: any, isUpdate = false): Promise<void> {
  const rawBase64 = String(wo.fileData || wo.photoUrl || '').trim();
  const CHUNK_SIZE = 43000;
  const chunks: string[] = [];
  if (rawBase64 && rawBase64.startsWith('data:')) {
    for (let i = 0; i < rawBase64.length && chunks.length < 12; i += CHUNK_SIZE) {
      chunks.push(rawBase64.slice(i, i + CHUNK_SIZE));
    }
  } else if (rawBase64) {
    chunks.push(rawBase64.slice(0, CHUNK_SIZE));
  }

  const meta = {
    id: wo.id,
    category: wo.category || 'NSC',
    title: wo.title || 'Work Order / Khata Notice',
    description: wo.description || '',
    fileName: wo.fileName || 'WorkOrder.jpg',
    fileType: wo.fileType || 'image/jpeg',
    fileSize: wo.fileSize || 0,
    uploadedBy: wo.uploadedBy || '8695716192',
    adminName: wo.adminName || 'Admin Controller',
    adminPhone: wo.adminPhone || '8695716192',
    uploadDate: wo.uploadDate || '',
    uploadTime: wo.uploadTime || '',
    createdAt: wo.createdAt || new Date().toISOString(),
    isHidden: Boolean(wo.isHidden)
  };

  const sheetPayload: Record<string, any> = {
    id: wo.id,
    submissionId: wo.id,
    category: WO_SHEET_CATEGORY,
    status: wo.isHidden ? 'Hidden' : 'Active',
    consumerName: wo.title,
    workerName: wo.adminName || 'Admin Controller',
    workerId: wo.uploadedBy || '8695716192',
    workOrderNo: wo.category || 'NSC',
    workOrderDate: wo.uploadDate || '',
    workOrderNoticeId: wo.id,
    workOrderNoticeTitle: wo.title,
    notes: JSON.stringify(meta),
    photoUrl: chunks[0] || '',
    address: chunks[1] || '',
    substation: chunks[2] || '',
    feederName: chunks[3] || '',
    'Feeder Name': chunks[3] || '',
    fatherName: chunks[4] || '',
    locationGps: chunks[5] || '',
    serviceCableLength: chunks[6] || '',
    earthResistance: chunks[7] || '',
    meterNo: chunks[8] || '',
    sealNo: chunks[9] || '',
    initialReading: chunks[10] || '',
    appliedLoad: chunks[11] || ''
  };

  try {
    if (isUpdate) {
      const upRes = await callGoogleAppsScript('updateEntry', {
        id: wo.id,
        submissionId: wo.id,
        category: WO_SHEET_CATEGORY,
        ...sheetPayload,
        data: sheetPayload
      }, 'POST', 35000);
      if (upRes && upRes.success) return;
    }
    await callGoogleAppsScript('submitRecord', {
      id: wo.id,
      submissionId: wo.id,
      category: WO_SHEET_CATEGORY,
      ...sheetPayload,
      data: sheetPayload
    }, 'POST', 35000);
  } catch (err: any) {
    console.warn('[WorkOrders] syncWorkOrderToSheet notice:', err?.message || err);
  }
}

async function fetchWorkOrdersFromSheet(): Promise<any[]> {
  if (isSyncingWorkOrdersFromSheet) return serverWorkOrdersCache;
  isSyncingWorkOrdersFromSheet = true;
  try {
    const res = await callGoogleAppsScript('entries', { category: WO_SHEET_CATEGORY }, 'GET', 25000);
    const rows = Array.isArray(res?.entries) ? res.entries : (Array.isArray(res?.data) ? res.data : []);
    const fromSheet: any[] = [];

    for (const r of rows) {
      const rowId = String(r.id || r.submissionId || r.workOrderNoticeId || '').trim();
      if (!rowId || deletedTombstoneSet.has(rowId.toLowerCase())) continue;

      let meta: any = {};
      const notesStr = String(r.notes || r['Notes'] || '').trim();
      if (notesStr.startsWith('{')) {
        try {
          meta = JSON.parse(notesStr);
        } catch {}
      }

      const reassembledBase64 = [
        r.photoUrl || '',
        r.address || '',
        r.substation || '',
        r.feederName || r['Feeder Name'] || '',
        r.fatherName || '',
        r.locationGps || '',
        r.serviceCableLength || '',
        r.earthResistance || '',
        r.meterNo || '',
        r.sealNo || '',
        r.initialReading || '',
        r.appliedLoad || ''
      ].join('');

      // Check if local cache has an even fuller version of this image (e.g., if >12 chunks or still uploading)
      const localMatch = serverWorkOrdersCache.find(w => w.id === (meta.id || rowId));
      const bestImage = (localMatch?.fileData && localMatch.fileData.length > reassembledBase64.length)
        ? localMatch.fileData
        : reassembledBase64;

      const item = normalizeServerWorkOrder({
        id: meta.id || rowId,
        category: meta.category || r.workOrderNo || 'NSC',
        title: meta.title || r.consumerName || r.workOrderNoticeTitle || 'Work Order & Khata Notice',
        description: meta.description || '',
        photoUrl: bestImage,
        fileData: bestImage,
        fileName: meta.fileName || `WorkOrder_${rowId}.jpg`,
        fileType: meta.fileType || 'image/jpeg',
        fileSize: meta.fileSize || 0,
        uploadedBy: meta.uploadedBy || r.workerId || '8695716192',
        adminName: meta.adminName || r.workerName || 'Admin Controller',
        adminPhone: meta.adminPhone || '8695716192',
        uploadDate: meta.uploadDate || r.workOrderDate || r.date || '',
        uploadTime: meta.uploadTime || '',
        createdAt: meta.createdAt || r.createdAt || r.date || new Date().toISOString(),
        isHidden: meta.isHidden !== undefined ? Boolean(meta.isHidden) : (String(r.status).toLowerCase() === 'hidden')
      });

      fromSheet.push(item);
    }

    // Preserve any newly created local work orders that are still syncing to Google Sheets (< 60s old) or not yet in Sheet
    const sheetIds = new Set(fromSheet.map(w => w.id));
    for (const localWo of serverWorkOrdersCache) {
      if (!localWo || !localWo.id) continue;
      if (deletedTombstoneSet.has(String(localWo.id).trim().toLowerCase())) continue;
      if (!sheetIds.has(localWo.id)) {
        fromSheet.unshift(localWo);
        // Also ensure it is synced to Google Sheets in background
        syncWorkOrderToSheet(localWo, false).catch(() => {});
      }
    }

    fromSheet.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    serverWorkOrdersCache = fromSheet;
    lastWorkOrdersFetchTime = Date.now();
    saveWorkOrdersToDisk();
  } catch (err: any) {
    console.warn('[WorkOrders] fetchWorkOrdersFromSheet notice:', err?.message || err);
  } finally {
    isSyncingWorkOrdersFromSheet = false;
  }
  return serverWorkOrdersCache;
}

async function getMergedWorkOrders(categoryFilter?: any, forceRefresh = false): Promise<any[]> {
  if (serverWorkOrdersCache.length === 0 || forceRefresh) {
    await fetchWorkOrdersFromSheet();
  } else if (Date.now() - lastWorkOrdersFetchTime > 10000) {
    fetchWorkOrdersFromSheet().catch(() => {});
  }

  let list = serverWorkOrdersCache.filter(w => w && w.id && !deletedTombstoneSet.has(String(w.id).trim().toLowerCase()));
  const cat = String(categoryFilter || '').trim().toUpperCase();
  if (cat && cat !== 'ALL') {
    list = list.filter(o => {
      const oCat = String(o.category || 'NSC').trim().toUpperCase();
      return oCat === cat || oCat === 'ALL';
    });
  }
  return list;
}

async function handleCreateWorkOrder(rawPayload: any): Promise<any> {
  const payload = (rawPayload && typeof rawPayload.data === 'object') ? rawPayload.data : (rawPayload || {});
  const newOrder = normalizeServerWorkOrder({
    ...payload,
    id: payload.id || `WO-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    createdAt: payload.createdAt || new Date().toISOString(),
    _localSavedAt: Date.now()
  });

  deletedTombstoneSet.delete(newOrder.id.toLowerCase());
  saveTombstonesToDisk();

  serverWorkOrdersCache = [newOrder, ...serverWorkOrdersCache.filter(w => w.id !== newOrder.id)];
  saveWorkOrdersToDisk();

  // Sync to Google Sheets WorkOrders_Khata sheet in background
  syncWorkOrderToSheet(newOrder, false).catch(err => console.warn('[WorkOrders] Background sync notice:', err));
  return newOrder;
}

async function handleToggleWorkOrderVisibility(id: string, isHidden: boolean): Promise<any> {
  const cleanId = String(id || '').trim();
  let updatedItem: any = null;
  serverWorkOrdersCache = serverWorkOrdersCache.map(w => {
    if (w.id === cleanId) {
      updatedItem = { ...w, isHidden: Boolean(isHidden), _localSavedAt: Date.now() };
      return updatedItem;
    }
    return w;
  });
  saveWorkOrdersToDisk();

  if (updatedItem) {
    syncWorkOrderToSheet(updatedItem, true).catch(() => {});
  }
  return updatedItem || { id: cleanId, isHidden: Boolean(isHidden) };
}

async function handleDeleteWorkOrder(id: string): Promise<boolean> {
  const cleanId = String(id || '').trim();
  if (!cleanId) return false;
  deletedTombstoneSet.add(cleanId.toLowerCase());
  saveTombstonesToDisk();

  serverWorkOrdersCache = serverWorkOrdersCache.filter(w => w.id !== cleanId);
  saveWorkOrdersToDisk();

  callGoogleAppsScript('deleteEntry', { id: cleanId, submissionId: cleanId, category: WO_SHEET_CATEGORY }, 'POST', 25000).catch(() => {});
  return true;
}

app.get('/api/work-orders/:id/file', (req, res) => {
  const cleanId = String(req.params.id || '').trim();
  const found = serverWorkOrdersCache.find(w => w.id === cleanId);
  const rawData = found ? String(found.fileData || found.photoUrl || '') : '';
  if (rawData && rawData.startsWith('data:')) {
    const match = rawData.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const mimeType = match[1] || found?.fileType || 'image/jpeg';
      const buffer = Buffer.from(match[2], 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    }
  }
  return res.status(404).send('Work order file not found');
});

app.get('/api/work-orders', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const force = req.query.refresh === 'true' || req.query.force === 'true';
    const orders = await getMergedWorkOrders(req.query.category, force);
    return res.json({
      success: true,
      workOrders: orders,
      data: { workOrders: orders }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to load work orders' });
  }
});

app.post('/api/work-orders', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const saved = await handleCreateWorkOrder(req.body);
    return res.status(201).json({
      success: true,
      workOrder: saved,
      data: { workOrder: saved }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to upload work order' });
  }
});

app.delete('/api/work-orders/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    await handleDeleteWorkOrder(req.params.id);
    return res.json({ success: true, deleted: true, id: req.params.id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

const handleToggleVisibility = async (req: express.Request, res: express.Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const updated = await handleToggleWorkOrderVisibility(req.params.id, Boolean(req.body?.isHidden));
    return res.json({ success: true, workOrder: updated, data: { workOrder: updated } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
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
// DASHBOARD STATS (Computed from Live Google Sheets Entries + Disconnection)
// ============================================================================
async function computeLiveDashboardStats() {
  const entries = await getFastMergedEntries({}, false);
  const stats = {
    total: entries.length,
    categories: {
      NSC: 0,
      DISCONNECTION: 0,
      POLE_CASE: 0,
      METER_REPLESMENT: 0,
      DTR_REPLESMENT: 0
    },
    status: {
      pending: 0,
      completed: 0,
      approved: 0
    }
  };

  for (const e of entries) {
    const cat = String(e.category || '').toUpperCase().trim();
    if (cat === 'NSC') stats.categories.NSC++;
    else if (cat === 'DISCONNECTION' || cat === 'DISCONNECT') stats.categories.DISCONNECTION++;
    else if (cat === 'POLE CASE' || cat === 'BROKEN') stats.categories.POLE_CASE++;
    else if (cat === 'METER REPLESMENT' || cat === 'METER REPLACEMENT') stats.categories.METER_REPLESMENT++;
    else if (cat === 'DTR REPLESMENT' || cat === 'DTR REPLACEMENT') stats.categories.DTR_REPLESMENT++;

    const st = String(e.status || '').toLowerCase();
    if (st === 'pending') stats.status.pending++;
    else if (st === 'approved') stats.status.approved++;
    else stats.status.completed++;
  }
  return stats;
}

app.get('/api/stats', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const stats = await computeLiveDashboardStats();
    return res.json(stats);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch dashboard stats' });
  }
});

// ============================================================================
// LIVE CHAT (Disk Persistence + Google Sheets Chat_Messages Sync)
// ============================================================================
const CHAT_CACHE_FILE = path.join(process.cwd(), '.chat-messages-cache.json');
let serverChatCache: any[] = [];
try {
  if (fs.existsSync(CHAT_CACHE_FILE)) {
    const arr = JSON.parse(fs.readFileSync(CHAT_CACHE_FILE, 'utf-8'));
    if (Array.isArray(arr)) serverChatCache = arr;
  }
} catch {}

function saveChatToDisk() {
  try {
    fs.writeFileSync(CHAT_CACHE_FILE, JSON.stringify(serverChatCache), 'utf-8');
  } catch {}
}

async function getChatMessagesList(workerId?: string): Promise<any[]> {
  if (workerId) {
    const wid = String(workerId).trim().toLowerCase();
    return serverChatCache.filter(m =>
      String(m.workerId || '').toLowerCase() === wid ||
      String(m.senderId || '').toLowerCase() === wid ||
      String(m.recipientId || '').toLowerCase() === wid ||
      m.recipientId === 'ALL'
    );
  }
  return serverChatCache;
}

async function handleSendChatMessage(rawMsg: any): Promise<any> {
  const nowIso = new Date().toISOString();
  const msg = {
    id: rawMsg.id || `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    workerId: String(rawMsg.workerId || rawMsg.senderId || '').trim(),
    senderId: String(rawMsg.senderId || '').trim(),
    senderName: String(rawMsg.senderName || 'User').trim(),
    senderRole: rawMsg.senderRole || 'worker',
    recipientId: String(rawMsg.recipientId || 'admin').trim(),
    message: String(rawMsg.message || '').trim(),
    timestamp: rawMsg.timestamp || nowIso,
    createdAt: nowIso
  };
  serverChatCache.push(msg);
  saveChatToDisk();
  callGoogleAppsScript('submitRecord', {
    id: msg.id,
    submissionId: msg.id,
    category: 'Chat_Messages',
    workerId: msg.senderId,
    workerName: msg.senderName,
    role: msg.senderRole,
    notes: JSON.stringify(msg)
  }, 'POST', 20000).catch(() => {});
  return msg;
}

async function handleClearChatMessages(): Promise<void> {
  serverChatCache = [];
  saveChatToDisk();
}

app.get('/api/chat', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const messages = await getChatMessagesList(req.query.workerId as string | undefined);
    return res.json(messages);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const msg = await handleSendChatMessage(req.body?.data || req.body || {});
    return res.status(201).json({ success: true, message: msg });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/chat', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    await handleClearChatMessages();
    return res.json({ success: true, message: 'Chat cleared' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DISCONNECTION TASKS (Google Sheets Is Sole Persistent Source of Truth)
// ============================================================================
// localDisconnectionTasks in-memory Map has been removed to enforce zero persistence divergence.
function parseSlNumber(sl?: any): number {
  if (!sl) return 0;
  const match = String(sl).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function formatSlNumber(num: number): string {
  return `SL ${String(num).padStart(3, '0')}`;
}

function normalizeTaskPhone(t: any): string {
  if (!t) return '';
  const candidates = [
    t.phoneNumber,
    t.mobileNumber,
    t.mobile,
    t.phone,
    t.contactNumber,
    t.contact,
    t['Mobile Number'],
    t['Mobile No'],
    t['Mobile No.'],
    t['Mobile'],
    t['Mobile_No'],
    t['Mob No'],
    t['Mob'],
    t['MOB_NO'],
    t['MOB_NUM'],
    t['Phone Number'],
    t['Phone No'],
    t['Phone'],
    t['Contact'],
    t['Contact No'],
    t['মোবাইল'],
    t['ফোন']
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      let str = String(c).trim();
      str = str.replace(/\.0+$/, '');
      if (/^\d+\.?\d*e[+-]?\d+$/i.test(str)) {
        const num = Number(str);
        if (!isNaN(num)) str = Math.round(num).toString();
      }
      if (str && str.toLowerCase() !== 'null' && str.toLowerCase() !== 'undefined' && str.toLowerCase() !== 'n/a' && str !== '-') {
        return str;
      }
    }
  }
  const text = `${t.consumerAddress || t.Address || ''} ${t.workerRemarks || ''} ${t.disconnectionReason || ''}`;
  const m = text.match(/(?:^|\D)([6-9]\d{9})(?:\D|$)/);
  return m ? m[1] : '';
}

function computeLocalStats(tasks: any[], workerId?: string, workerName?: string) {
  const totalTasks = tasks.length;
  let completedTasks = 0;
  let disconnectedTasks = 0;
  let pendingTasks = 0;
  let inProgressTasks = 0;
  let unableTasks = 0;
  let reportedTasks = 0;
  let cancelledTasks = 0;
  let paidTasks = 0;
  let notFoundTasks = 0;
  let disputeTasks = 0;
  let officeTeamTasks = 0;
  let reissueTasks = 0;
  let urgentTasks = 0;

  let myAssignedTasks = 0;
  let myCompletedTasks = 0;
  let myPendingTasks = 0;

  const wId = String(workerId || '').toLowerCase().trim();
  const wNm = String(workerName || '').toLowerCase().trim();

  const workerMap = new Map<string, {
    workerName: string;
    assigned: number;
    completed: number;
    pending: number;
    reportsSubmitted: number;
    completionRate: number;
  }>();

  for (const t of tasks) {
    const st = String(t.taskStatus || t.status || 'PENDING').toUpperCase();
    if (st === 'DISCONNECT') {
      disconnectedTasks++;
      completedTasks++;
    } else if (st === 'COMPLETED') {
      completedTasks++;
    } else if (st === 'PENDING') {
      pendingTasks++;
    } else if (st === 'PAID') {
      paidTasks++;
    } else if (st === 'NOT FOUND') {
      notFoundTasks++;
    } else if (st === 'DISPUTE') {
      disputeTasks++;
    } else if (st === 'OFFICE TEAM') {
      officeTeamTasks++;
    } else if (st === 'REISSUE') {
      reissueTasks++;
    } else if (st === 'IN PROGRESS') {
      inProgressTasks++;
    } else if (st === 'UNABLE') {
      unableTasks++;
    } else if (st === 'REPORTED') {
      reportedTasks++;
    } else if (st === 'CANCELLED') {
      cancelledTasks++;
    }

    if (String(t.priority || '').toUpperCase() === 'URGENT') urgentTasks++;

    const aId = String(t.assignedWorkerId || '').toLowerCase().trim();
    const aNm = String(t.assignedWorkerName || '').toLowerCase().trim();
    const isMine = (wId && aId === wId) || (wNm && aNm === wNm);

    if (isMine) {
      myAssignedTasks++;
      if (st === 'COMPLETED' || st === 'DISCONNECT' || st === 'PAID') myCompletedTasks++;
      else if (st === 'PENDING' || st === 'IN PROGRESS') myPendingTasks++;
    }

    const workerKey = t.assignedWorkerName || t.submittedBy || 'Unassigned';
    if (!workerMap.has(workerKey)) {
      workerMap.set(workerKey, {
        workerName: workerKey,
        assigned: 0,
        completed: 0,
        pending: 0,
        reportsSubmitted: 0,
        completionRate: 0
      });
    }
    const wRecord = workerMap.get(workerKey)!;
    wRecord.assigned++;
    if (st === 'DISCONNECT' || st === 'COMPLETED' || st === 'PAID') {
      wRecord.completed++;
    } else if (st === 'PENDING' || st === 'IN PROGRESS') {
      wRecord.pending++;
    }
    if (t.workerReport || t.workerRemarks || t.reportDate || (st !== 'PENDING' && st !== 'IN PROGRESS')) {
      wRecord.reportsSubmitted++;
    }
  }

  const workerPerformance = Array.from(workerMap.values()).map(w => ({
    ...w,
    completionRate: w.assigned > 0 ? Math.round((w.completed / w.assigned) * 100) : 0
  }));

  const completionPercentage = totalTasks > 0 ? Math.round(((completedTasks + paidTasks) / totalTasks) * 100) : 0;
  const myCompletionPercentage = myAssignedTasks > 0 ? Math.round((myCompletedTasks / myAssignedTasks) * 100) : 0;

  return {
    totalTasks,
    completedTasks,
    disconnectedTasks,
    pendingTasks,
    inProgressTasks,
    unableTasks,
    reportedTasks,
    cancelledTasks,
    paidTasks,
    notFoundTasks,
    disputeTasks,
    officeTeamTasks,
    reissueTasks,
    urgentTasks,
    completionPercentage,
    myAssignedTasks,
    myCompletedTasks,
    myPendingTasks,
    myCompletionPercentage,
    workerPerformance
  };
}

function convertSheetEntryToDisconnectionTask(entry: any, index: number): any {
  const offCode = String(entry['off_code'] || entry.off_code || entry.offCode || entry.area || entry.substation || '').trim();
  const mru = String(entry['MRU'] || entry.MRU || entry.mru || entry.mruSection || '').trim();
  const consumerId = String(entry['Consumer Id'] || entry['Consumer ID'] || entry.consumerId || entry.accountNumber || '').trim();
  const consumerName = String(entry['Name'] || entry.Name || entry.consumerName || entry.name || '').trim();
  const consumerAddress = String(entry['Address'] || entry.Address || entry.consumerAddress || entry.address || '').trim();
  const baseClass = String(entry['Base Class'] || entry.baseClass || entry.class || '').trim();
  const consumerClass = String(entry['Class'] || entry.classType || entry.class || entry.baseClass || '').trim();
  const device = String(entry['Device'] || entry['BClass/Phase'] || entry.deviceType || entry.bClassPhase || '').trim();
  const dueDateRange = String(entry['O/S Duedate Range'] || entry['O/S Due date Range'] || entry.dueDateRange || entry.osDueDateRange || '').trim();
  const outstandingDue = String(entry['D2 Net O/S'] || entry.outstandingDue || entry.arrearAmount || entry.d2NetOs || '').trim();
  const mobile = normalizeTaskPhone(entry) || String(entry['Mobile'] || entry['Mobile Number'] || entry['Mobile No'] || entry.mobile || '').trim();
  const numberVal = String(entry['Number'] || entry.number || entry['Meter'] || entry.meterNumber || entry.meterNo || '').trim();
  const latitude = String(entry['Latitude'] || entry.latitude || '').trim();
  const longitude = String(entry['Longitude'] || entry.longitude || '').trim();
  const rawStatus = String(entry['Discon Status'] || entry.disconStatus || entry.taskStatus || entry.status || entry['Status'] || 'PENDING').trim().toUpperCase();
  const status = rawStatus || 'PENDING';
  const reportDate = String(entry['Discon Date'] || entry.disconDate || entry.reportDate || entry.date || '').trim();
  const imageUrl = String(entry['Image'] || entry.image || entry.photoUrl || entry['Photo Evidence'] || '').trim();
  const reading = String(entry['Reading'] || entry.reading || entry.meterReading || numberVal || '').trim();
  const paymentStatus = String(entry['Payment Status'] || entry.paymentStatus || (status === 'PAID' ? 'PAID' : '')).trim();
  const gisPole = String(entry['Gis Pole'] || entry.gisPole || entry.poleNo || '').trim();
  const agency = String(entry['Agency'] || entry.agency || entry.assignedAgency || entry['Agency Name'] || '').trim();
  const notes = String(entry['Notes'] || entry.notes || entry.workerRemarks || entry.workerReport || '').trim();
  const natureOfConn = String(entry['Nature of Conn'] || entry.natureOfConn || '').trim();
  const govNonGov = String(entry['Gov/Non-Gov'] || entry.govNonGov || entry.govStatus || '').trim();
  const lastUpdated = String(entry['Last Updated'] || entry.lastUpdated || entry.updatedAt || new Date().toISOString()).trim();
  const priority = String(entry['Priority'] || entry.priority || ((parseFloat(outstandingDue.replace(/[^0-9.]/g, '')) > 10000) ? 'URGENT' : 'NORMAL')).trim().toUpperCase();
  const paidAmount = String(entry['Paid Amount'] || entry.paidAmount || (status === 'PAID' ? outstandingDue : '')).trim();
  const paidDate = String(entry['Paid Date'] || entry.paidDate || entry.paymentDate || (status === 'PAID' ? reportDate : '')).trim();
  const paidType = String(entry['Paid Type'] || entry.paidType || entry.paymentReference || '').trim();
  const outstandingAfter = String(entry['Outstanding After'] || entry.outstandingAfter || '').trim();
  const nextPaymentDate = String(entry['Next Payment Date'] || entry.nextPaymentDate || '').trim();
  const paymentSource = String(entry['Payment Source'] || entry.paymentSource || '').trim();
  const uploadDate = String(entry['Upload Date'] || entry.uploadDate || entry.createdAt || '').trim();

  const rawSl = entry.serialNumber || entry['SL No'] || entry.slNo || entry.sl;
  const parsedSl = parseSlNumber(rawSl) || index;
  const serialNumber = formatSlNumber(parsedSl);
  const taskId = String(entry.taskId || entry['Task ID'] || entry.id || entry['Submission ID'] || `TASK-DISC-${consumerId || index}`).trim();

  return {
    // Exact 33 Google Sheet Columns (A:AG)
    'off_code': offCode,
    'MRU': mru,
    'Consumer Id': consumerId,
    'Name': consumerName,
    'Address': consumerAddress,
    'Base Class': baseClass,
    'Class': consumerClass,
    'Device': device,
    'O/S Duedate Range': dueDateRange,
    'D2 Net O/S': outstandingDue,
    'Mobile': mobile,
    'Number': numberVal,
    'Latitude': latitude,
    'Longitude': longitude,
    'Discon Status': status,
    'Discon Date': reportDate,
    'Image': imageUrl,
    'Reading': reading,
    'Payment Status': paymentStatus,
    'Gis Pole': gisPole,
    'Agency': agency,
    'Notes': notes,
    'Nature of Conn': natureOfConn,
    'Gov/Non-Gov': govNonGov,
    'Last Updated': lastUpdated,
    'Priority': priority,
    'Paid Amount': paidAmount,
    'Paid Date': paidDate,
    'Paid Type': paidType,
    'Outstanding After': outstandingAfter,
    'Next Payment Date': nextPaymentDate,
    'Payment Source': paymentSource,
    'Upload Date': uploadDate,

    // Developer Aliases & Frontend compatibility
    serialNumber,
    taskId,
    consumerId,
    consumerName,
    accountNumber: consumerId,
    meterNumber: numberVal || reading,
    reading,
    meterReading: reading,
    consumerAddress,
    phoneNumber: mobile,
    mobileNumber: mobile,
    mobile,
    area: offCode,
    offCode,
    mru,
    mruSection: mru,
    cccFeeder: mru,
    disconnectionReason: `Outstanding Bill (D2 Net O/S: ${outstandingDue})`,
    assignedWorkerId: String(entry.workerId || entry.assignedWorkerId || entry['Worker ID'] || '').trim(),
    assignedWorkerName: String(entry.workerName || entry.assignedWorkerName || entry['Worker Name'] || '').trim(),
    assignedAgency: agency,
    agency,
    taskStatus: status,
    disconStatus: status,
    disconDate: reportDate,
    workerReport: notes,
    workerRemarks: notes,
    notes,
    reportDate,
    reportTime: String(entry.reportTime || '').trim(),
    submittedBy: String(entry.submittedBy || entry.workerName || '').trim(),
    createdAt: uploadDate || lastUpdated || new Date().toISOString(),
    updatedAt: lastUpdated || new Date().toISOString(),
    lastUpdated,
    completionPercentage: (status === 'COMPLETED' || status === 'DISCONNECT' || status === 'PAID') ? 100 : (status === 'IN PROGRESS' ? 50 : 0),
    photoUrl: imageUrl,
    imageUrl,
    outstandingDue,
    d2NetOs: outstandingDue,
    dueDateRange,
    osDueDateRange: dueDateRange,
    baseClass,
    classType: consumerClass,
    deviceType: device,
    device,
    priority,
    paidAmount,
    paidDate,
    paymentDate: paidDate,
    paidType,
    paymentReference: paidType,
    paymentStatus,
    gisPole,
    natureOfConn,
    govNonGov,
    outstandingAfter,
    nextPaymentDate,
    paymentSource,
    uploadDate,
    latitude,
    longitude,
    statusHistory: Array.isArray(entry.statusHistory) ? entry.statusHistory : []
  };
}

function isValidDisconnectionConsumerRow(e: any): boolean {
  if (!e || typeof e !== 'object') return false;
  const rawStatus = String(e['Discon Status'] || e.disconStatus || e.taskStatus || e.status || e['Status'] || '').trim().toUpperCase();
  const rawNotes = String(e['Notes'] || e.notes || e.workerRemarks || '').trim();
  if (rawStatus === 'DELETED' || rawNotes.includes('[DELETED_BY_ADMIN]')) return false;
  const rawCId = String(e['Consumer Id'] || e['Consumer ID'] || e.consumerId || e.accountNumber || '').trim();
  const isSyntheticId = /^(PWR-DIS-|TASK-DISC-|SL\s*\d+|N\/A|null|undefined|-)$/i.test(rawCId);
  const validCId = isSyntheticId ? '' : rawCId;

  const rawName = String(e['Name'] || e.Name || e.consumerName || '').trim();
  const isInvalidName = /^(Worker|CONSUMER|Unnamed Consumer|Unknown Consumer|null|undefined|-)$/i.test(rawName);
  const validName = isInvalidName ? '' : rawName;

  const address = String(e['Address'] || e.Address || e.consumerAddress || e.address || '').trim();
  const d2NetOs = String(e['D2 Net O/S'] || e.d2NetOs || e.outstandingDue || e.arrearAmount || '').trim();
  const mobile = String(e['Mobile'] || e['Mobile Number'] || e.mobile || e.phoneNumber || '').trim();
  const mru = String(e['MRU'] || e.mru || e.mruSection || '').trim();

  if (validCId) return true;
  if (validName && (address || d2NetOs || mobile || mru)) return true;
  return false;
}

interface CachedDisconnectionState {
  tasks: any[];
  timestamp: number;
}
let cachedDisconnectionState: CachedDisconnectionState | null = null;
try {
  if (fs.existsSync(DISC_CACHE_FILE)) {
    const diskTasks = JSON.parse(fs.readFileSync(DISC_CACHE_FILE, 'utf-8'));
    if (Array.isArray(diskTasks) && diskTasks.length > 0) {
      cachedDisconnectionState = { tasks: diskTasks, timestamp: Date.now() - 10000 };
    }
  }
} catch {}

const DISCONNECTION_CACHE_TTL_MS = 15000;

function clearDisconnectionStateCache() {
  gasCache.clear();
}

function mergeSheetDisconnectionTasksWithOverlay(sheetTasks: any[]): any[] {
  const mergedMap = new Map<string, any>();

  // 1. Always iterate sheetTasks FIRST so the Map insertion order strictly matches the Google Sheet order
  for (const t of sheetTasks) {
    if (isRecordDeleted(t)) continue;
    const key = String(t.consumerId || t['Consumer Id'] || t.taskId || '').trim().toLowerCase();
    if (!key) continue;

    const ov = localDisconnectionOverlayMap.get(key);
    if (ov && !isRecordDeleted(ov)) {
      const hasOverlayRemarkOrStatus = Boolean(
        ov._hasUserRemarkUpdate ||
        (ov.workerRemarks && String(ov.workerRemarks).trim() !== '') ||
        (ov.notes && String(ov.notes).trim() !== '') ||
        (ov.taskStatus && String(ov.taskStatus).toUpperCase() !== 'PENDING')
      );
      if (hasOverlayRemarkOrStatus || !ov._syncedToSheet) {
        mergedMap.set(key, {
          ...t,
          ...ov,
          consumerName: ov.consumerName || t.consumerName || t['Name'] || '',
          'Name': ov['Name'] || ov.consumerName || t['Name'] || t.consumerName || '',
          consumerAddress: ov.consumerAddress || t.consumerAddress || t['Address'] || '',
          'Address': ov['Address'] || ov.consumerAddress || t['Address'] || t.consumerAddress || '',
          outstandingDue: ov.outstandingDue || t.outstandingDue || t['D2 Net O/S'] || '',
          'D2 Net O/S': ov['D2 Net O/S'] || ov.outstandingDue || t['D2 Net O/S'] || t.outstandingDue || '',
        });
      } else {
        mergedMap.set(key, { ...ov, ...t });
      }
    } else {
      mergedMap.set(key, t);
    }
  }

  // 2. Append any newly uploaded overlay items that are not yet present in sheetTasks
  for (const [key, ov] of localDisconnectionOverlayMap.entries()) {
    if (isRecordDeleted(ov)) continue;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, ov);
    }
  }

  // 3. Deterministically sort by Consumer ID so the list order and serial numbers NEVER change or jump across GAS calls
  const sortedValues = Array.from(mergedMap.values()).sort((a, b) => {
    const idA = String(a.consumerId || a['Consumer Id'] || a.taskId || '').trim();
    const idB = String(b.consumerId || b['Consumer Id'] || b.taskId || '').trim();
    return idA.localeCompare(idB, undefined, { numeric: true });
  });

  const finalTasks = sortedValues.map((t, idx) => ({
    ...t,
    serialNumber: formatSlNumber(idx + 1)
  }));
  return finalTasks;
}

async function fetchDisconnectionTasksFromGoogleSheet(): Promise<any[]> {
  let entriesRes: any = null;
  try {
    entriesRes = await callGoogleAppsScript('entries', { category: 'Disconnection' }, 'GET', 20000);
  } catch {}

  const rawEntries = entriesRes && (Array.isArray(entriesRes.entries) ? entriesRes.entries : (Array.isArray(entriesRes) ? entriesRes : []));
  const discEntries = rawEntries.filter((e: any) => {
    if (isRecordDeleted(e)) return false;
    if (!isValidDisconnectionConsumerRow(e)) return false;
    const cat = String(e.category || '').toUpperCase().trim();
    const isDiscCat = (cat === 'DISCONNECTION' || cat === 'DISCONNECT');
    const hasCoreDisc = Boolean(
      (e['Consumer Id'] || e.consumerId) && (
        e['D2 Net O/S'] || e.d2NetOs || e['O/S Duedate Range'] || e.disconStatus || e['Discon Status'] || e.off_code || e.mru || e['MRU'] || e['Name'] || e.consumerName
      )
    );
    return isDiscCat || hasCoreDisc;
  });

  const seenConsumers = new Set<string>();
  const deduplicatedEntries: any[] = [];
  for (const e of discEntries) {
    const cId = String(e['Consumer Id'] || e['Consumer ID'] || e.consumerId || e.accountNumber || '').trim().toLowerCase();
    if (cId) {
      if (seenConsumers.has(cId)) continue;
      seenConsumers.add(cId);
    }
    deduplicatedEntries.push(e);
  }

  let idx = 1;
  const sheetTasks = deduplicatedEntries.map((e: any) => convertSheetEntryToDisconnectionTask(e, idx++));
  const merged = mergeSheetDisconnectionTasksWithOverlay(sheetTasks);
  cachedDisconnectionState = { tasks: merged, timestamp: Date.now() };
  try { fs.writeFileSync(DISC_CACHE_FILE, JSON.stringify(merged), 'utf-8'); } catch {}
  return merged;
}

function refreshDisconnectionFromSheetInBackground() {
  if (isRefreshingDiscInBg) return;
  isRefreshingDiscInBg = true;
  (async () => {
    try {
      gasCache.clear();
      await fetchDisconnectionTasksFromGoogleSheet();
    } catch (err) {
      console.warn('[Background Disconnection Sync] Notice:', err);
    } finally {
      isRefreshingDiscInBg = false;
    }
  })();
}

// Keep server caches continuously warm and synced with Google Sheets every 10 seconds
setInterval(() => {
  refreshDisconnectionFromSheetInBackground();
  refreshEntriesFromSheetInBackground();
}, 10000);

app.get('/api/disconnection-tasks', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const query = req.query;
  const role = String(query.role || '').toLowerCase();
  const workerId = String(query.workerId || '').toLowerCase().trim();
  const workerName = String(query.workerName || '').toLowerCase().trim();
  const forceRefresh = query.refresh === 'true' || query.force === 'true';

  const applyFilterAndStats = (allTasks: any[]) => {
    const cleanList = mergeSheetDisconnectionTasksWithOverlay(allTasks);
    let filtered = cleanList;
    if (role === 'worker' && (workerId || workerName)) {
      filtered = cleanList.filter(t => {
        const aId = String(t.assignedWorkerId || '').toLowerCase().trim();
        const aNm = String(t.assignedWorkerName || '').toLowerCase().trim();
        return (!aId && !aNm) || (workerId && aId === workerId) || (workerName && aNm === workerName);
      });
    }
    const stats = computeLocalStats(filtered, workerId, workerName);
    return { success: true, tasks: filtered, stats };
  };

  if (cachedDisconnectionState && cachedDisconnectionState.tasks.length > 0) {
    const age = Date.now() - cachedDisconnectionState.timestamp;
    if (forceRefresh || age > 6000) {
      refreshDisconnectionFromSheetInBackground();
    }
    return res.json(applyFilterAndStats(cachedDisconnectionState.tasks));
  }

  try {
    const tasks = await fetchDisconnectionTasksFromGoogleSheet();
    return res.json(applyFilterAndStats(tasks));
  } catch (err: any) {
    const fallbackTasks = mergeSheetDisconnectionTasksWithOverlay(cachedDisconnectionState?.tasks || []);
    return res.json(applyFilterAndStats(fallbackTasks));
  }
});

function buildComplete33ColumnPayload(t: any): Record<string, any> {
  const nowTimestamp = new Date().toISOString();
  const cId = String(t['Consumer Id'] || t.consumerId || t['Consumer ID'] || t.accountNumber || '').trim();
  const name = String(t['Name'] || t.consumerName || t.name || cId || 'Consumer').trim();
  const offCode = String(t['off_code'] || t.offCode || t.area || '5233100').trim();
  const mru = String(t['MRU'] || t.mru || t.mruSection || '').trim();
  const address = String(t['Address'] || t.consumerAddress || t.address || '').trim();
  const baseClass = String(t['Base Class'] || t.baseClass || t.class || 'Domestic').trim();
  const consumerClass = String(t['Class'] || t.classType || t.class || baseClass || 'Domestic').trim();
  const device = String(t['Device'] || t['BClass/Phase'] || t.deviceType || t.bClassPhase || 'I').trim();
  const dueDateRange = String(t['O/S Duedate Range'] || t['O/S Due date Range'] || t.dueDateRange || '').trim();
  const d2NetOs = String(t['D2 Net O/S'] || t.outstandingDue || t.arrearAmount || '').trim();
  const mobile = String(t['Mobile'] || t['Mobile Number'] || t.phoneNumber || t.mobile || '').trim();
  const numberVal = String(t['Number'] || t.number || t['Meter'] || t.meterNumber || t.meterNo || '').trim();
  const status = String(t['Discon Status'] || t.taskStatus || t.disconStatus || t.status || 'PENDING').trim().toUpperCase();
  const notes = String(t['Notes'] || t.notes || t.workerRemarks || t.workerReport || '').trim();
  const disconDate = String(t['Discon Date'] || t.disconDate || t.reportDate || '').trim();
  const reading = String(t['Reading'] || t.reading || t.meterReading || '').trim();
  const image = String(t['Image'] || t.image || t.photoUrl || '').trim();
  const paymentStatus = String(t['Payment Status'] || t.paymentStatus || (status === 'PAID' ? 'PAID' : 'UNPAID')).trim();
  const gisPole = String(t['Gis Pole'] || t.gisPole || t.poleNo || '').trim();
  const agency = String(t['Agency'] || t.agency || t.assignedAgency || '').trim();
  const natureOfConn = String(t['Nature of Conn'] || t.natureOfConn || '').trim();
  const govNonGov = String(t['Gov/Non-Gov'] || t.govNonGov || 'Non-Gov').trim();
  const priority = String(t['Priority'] || t.priority || 'NORMAL').trim().toUpperCase();
  const paidAmount = String(t['Paid Amount'] || t.paidAmount || '').trim();
  const paidDate = String(t['Paid Date'] || t.paidDate || t.paymentDate || '').trim();
  const paidType = String(t['Paid Type'] || t.paidType || t.paymentReference || '').trim();
  const outstandingAfter = String(t['Outstanding After'] || t.outstandingAfter || d2NetOs).trim();
  const nextPaymentDate = String(t['Next Payment Date'] || t.nextPaymentDate || '').trim();
  const paymentSource = String(t['Payment Source'] || t.paymentSource || '').trim();
  const uploadDate = String(t['Upload Date'] || t.uploadDate || nowTimestamp).trim();

  return {
    id: cId || `TASK-DISC-${Date.now()}`,
    submissionId: cId || `SUB-DISC-${Date.now()}`,
    category: 'Disconnection',
    consumerId: cId,
    consumerName: name,
    name: name,
    address: address,
    mobile: mobile,
    phone: mobile,
    meterNo: numberVal,
    arrearAmount: d2NetOs,
    status: status,
    disconStatus: status,
    taskStatus: status,
    notes: notes,
    workerRemarks: notes,
    'off_code': offCode,
    'MRU': mru,
    'Consumer Id': cId,
    'Name': name,
    'Address': address,
    'Base Class': baseClass,
    'Class': consumerClass,
    'Device': device,
    'BClass/Phase': device,
    'O/S Duedate Range': dueDateRange,
    'O/S Due date Range': dueDateRange,
    'D2 Net O/S': d2NetOs,
    'Mobile': mobile,
    'Mobile Number': mobile,
    'Number': numberVal,
    'Meter': numberVal,
    'Latitude': String(t['Latitude'] || t.latitude || '').trim(),
    'Longitude': String(t['Longitude'] || t.longitude || '').trim(),
    'Discon Status': status,
    'Discon Date': disconDate,
    'Image': image,
    'Reading': reading,
    'Payment Status': paymentStatus,
    'Gis Pole': gisPole,
    'Agency': agency,
    'Notes': notes,
    'Nature of Conn': natureOfConn,
    'Gov/Non-Gov': govNonGov,
    'Last Updated': nowTimestamp,
    'Priority': priority,
    'Paid Amount': paidAmount,
    'Paid Date': paidDate,
    'Paid Type': paidType,
    'Outstanding After': outstandingAfter,
    'Next Payment Date': nextPaymentDate,
    'Payment Source': paymentSource,
    'Upload Date': uploadDate
  };
}

app.post('/api/disconnection-tasks/upload', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const tasksArray = Array.isArray(req.body?.tasks) ? req.body.tasks : (Array.isArray(req.body) ? req.body : []);
    if (tasksArray.length === 0) {
      return res.json({ success: true, count: 0, insertedCount: 0, updatedCount: 0, tasks: cachedDisconnectionState?.tasks || [] });
    }

    let insertedCount = 0;
    let updatedCount = 0;
    const preparedPayloads: any[] = [];

    let nextIndex = (cachedDisconnectionState?.tasks?.length || 0) + 1;
    for (const rawTask of tasksArray) {
      const fullRow = buildComplete33ColumnPayload(rawTask);
      const cIdKey = String(fullRow.consumerId || fullRow.id || '').trim().toLowerCase();
      if (!cIdKey) continue;

      deletedTombstoneSet.delete(cIdKey);
      deletedTombstoneSet.delete(`task-disc-${cIdKey}`);

      const existingInCache = cachedDisconnectionState?.tasks?.find(
        (ct: any) => String(ct.consumerId || ct['Consumer Id'] || '').trim().toLowerCase() === cIdKey
      );
      if (existingInCache || localDisconnectionOverlayMap.has(cIdKey)) {
        updatedCount++;
      } else {
        insertedCount++;
      }

      const convertedTask = convertSheetEntryToDisconnectionTask(
        { ...(existingInCache || {}), ...fullRow },
        nextIndex++
      );
      convertedTask._localUpdatedAt = Date.now();
      convertedTask._syncedToSheet = false;

      localDisconnectionOverlayMap.set(cIdKey, convertedTask);
      preparedPayloads.push(fullRow);
    }

    saveTombstonesToDisk();
    saveDiscOverlayToDisk();

    const mergedAllTasks = mergeSheetDisconnectionTasksWithOverlay(cachedDisconnectionState?.tasks || []);
    cachedDisconnectionState = { tasks: mergedAllTasks, timestamp: Date.now() };
    try { fs.writeFileSync(DISC_CACHE_FILE, JSON.stringify(mergedAllTasks), 'utf-8'); } catch {}

    const requestId = req.body?.requestId || `REQ-UPL-${Date.now()}`;
    (async () => {
      try {
        const gasResult = await callGoogleAppsScript(
          'uploadDisconnectionTasks',
          { tasks: preparedPayloads, requestId },
          'POST',
          45000
        );
        if (gasResult && gasResult.success) {
          for (const p of preparedPayloads) {
            const k = String(p.consumerId || p.id || '').trim().toLowerCase();
            const ov = localDisconnectionOverlayMap.get(k);
            if (ov) ov._syncedToSheet = true;
          }
          saveDiscOverlayToDisk();
          gasCache.clear();
          return;
        }
      } catch (e) {
        console.warn('[Upload Disconnection] Primary uploadDisconnectionTasks notice, running direct Disconnection sheet row sync:', e);
      }

      const BATCH_SIZE = 4;
      for (let i = 0; i < preparedPayloads.length; i += BATCH_SIZE) {
        const chunk = preparedPayloads.slice(i, i + BATCH_SIZE);
        await Promise.all(
          chunk.map(async (rowPayload) => {
            const k = String(rowPayload.consumerId || rowPayload.id || '').trim().toLowerCase();
            try {
              const upRes = await callGoogleAppsScript(
                'updateEntry',
                { id: rowPayload.consumerId, category: 'Disconnection', ...rowPayload, data: rowPayload },
                'POST',
                30000
              );
              if (upRes && upRes.success) {
                const ov = localDisconnectionOverlayMap.get(k);
                if (ov) ov._syncedToSheet = true;
                return;
              }
            } catch {}
            try {
              const crRes = await callGoogleAppsScript(
                'createEntry',
                { category: 'Disconnection', ...rowPayload, data: rowPayload },
                'POST',
                30000
              );
              if (crRes && crRes.success !== false) {
                const ov = localDisconnectionOverlayMap.get(k);
                if (ov) ov._syncedToSheet = true;
              }
            } catch (err) {
              console.warn('[Upload Disconnection Fallback] Row write notice:', err);
            }
          })
        );
      }
      saveDiscOverlayToDisk();
      gasCache.clear();
    })();

    return res.json({
      success: true,
      count: preparedPayloads.length,
      insertedCount,
      updatedCount,
      tasks: mergedAllTasks,
      message: `Successfully uploaded ${preparedPayloads.length} consumer records (${insertedCount} new, ${updatedCount} updated) and syncing to Disconnection sheet.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to upload disconnection list' });
  }
});

// Sample Excel / CSV template matching exact 33 Backend Disconnection Sheet Headers
const BACKEND_DISCONNECTION_HEADERS_33 = [
  'off_code',
  'MRU',
  'Consumer Id',
  'Name',
  'Address',
  'Base Class',
  'Class',
  'Device',
  'O/S Duedate Range',
  'D2 Net O/S',
  'Mobile',
  'Number',
  'Latitude',
  'Longitude',
  'Discon Status',
  'Discon Date',
  'Image',
  'Reading',
  'Payment Status',
  'Gis Pole',
  'Agency',
  'Notes',
  'Nature of Conn',
  'Gov/Non-Gov',
  'Last Updated',
  'Priority',
  'Paid Amount',
  'Paid Date',
  'Paid Type',
  'Outstanding After',
  'Next Payment Date',
  'Payment Source',
  'Upload Date'
];

app.get('/api/disconnection/sample-excel', (req, res) => {
  try {
    const ws = XLSX.utils.aoa_to_sheet([BACKEND_DISCONNECTION_HEADERS_33]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Disconnection');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="WBSEDCL_Disconnection_Sheet_Template.xlsx"');
    res.send(buf);
  } catch (err: any) {
    res.status(500).send('Error generating Excel template: ' + err.message);
  }
});

app.get('/api/disconnection/sample-csv', (req, res) => {
  try {
    const ws = XLSX.utils.aoa_to_sheet([BACKEND_DISCONNECTION_HEADERS_33]);
    const csv = XLSX.utils.sheet_to_csv(ws);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="WBSEDCL_Disconnection_Sheet_Template.csv"');
    res.send(csv);
  } catch (err: any) {
    res.status(500).send('Error generating CSV template: ' + err.message);
  }
});

let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAIClient;
}

app.post('/api/disconnection-tasks/ocr', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const { base64Data, mimeType, fileName } = req.body;
    if (!base64Data) {
      return res.status(400).json({ success: false, error: 'No image or document data provided for OCR' });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.status(500).json({ success: false, error: 'AI OCR service is not configured (GEMINI_API_KEY missing)' });
    }

    const cleanBase64 = String(base64Data).replace(/^data:[^;]+;base64,/, '');
    const cleanMime = mimeType || (fileName && fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    const prompt = `You are an expert utility operations data extraction assistant for WBSEDCL (West Bengal State Electricity Distribution Company Limited).
Analyze this uploaded document/image (${fileName || 'document'}) containing electrical disconnection / defaulter consumer lists, spreadsheets, or notices.
Extract EVERY consumer record visible into a structured JSON array.

WBSEDCL Disconnection Sheet has 33 columns. Map and extract every row carefully:
- consumerId / "Consumer Id": string (9-digit consumer ID)
- consumerName / "Name": string (Full consumer name in UPPERCASE or Title Case)
- offCode / "off_code": string (Office/Substation code)
- mru / "MRU": string (MRU section)
- consumerAddress / "Address": string (Full consumer premises/village/address)
- phoneNumber / "Mobile": string (10-digit Indian mobile number)
- meterNumber / "Number": string (Meter serial number)
- outstandingDue / "D2 Net O/S": string (Outstanding arrear due amount in Rupees, numbers only)
- dueDateRange / "O/S Duedate Range": string (Bill or disconnection due date range)
- baseClass / "Base Class": string (e.g. "Domestic", "Commercial", "Industrial")
- classType / "Class": string (e.g. "Domestic", "Commercial")
- deviceType / "Device": string (Phase or device, e.g. "I", "III", or meter model)
- reading / "Reading": string (Meter reading if visible)
- gisPole / "Gis Pole": string (Pole number or GIS Pole reference)
- agency / "Agency": string (Agency name)
- notes / "Notes": string (Remarks or reason for disconnection)
- priority / "Priority": string ("URGENT" if amount > 10000 or marked urgent, otherwise "NORMAL")
- taskStatus / "Discon Status": string (Default "PENDING" if not already disconnected)

If a field is not visible in the document, use an empty string "" (do not invent fake data).

Return ONLY a valid JSON object matching this schema:
{
  "tasks": [
    {
      "consumerId": "string",
      "consumerName": "string",
      "offCode": "string",
      "mru": "string",
      "consumerAddress": "string",
      "phoneNumber": "string",
      "meterNumber": "string",
      "outstandingDue": "string",
      "dueDateRange": "string",
      "baseClass": "string",
      "classType": "string",
      "deviceType": "string",
      "reading": "string",
      "gisPole": "string",
      "agency": "POWER",
      "notes": "string",
      "priority": "NORMAL",
      "taskStatus": "PENDING",
      "off_code": "string",
      "MRU": "string",
      "Consumer Id": "string",
      "Name": "string",
      "Address": "string",
      "Base Class": "string",
      "Class": "string",
      "Device": "string",
      "O/S Duedate Range": "string",
      "D2 Net O/S": "string",
      "Mobile": "string",
      "Number": "string",
      "Discon Status": "PENDING"
    }
  ]
}`;

    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let lastAiError: any = null;
    let responseText = '';

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                { inlineData: { mimeType: cleanMime, data: cleanBase64 } }
              ]
            }
          ],
          config: {
            responseMimeType: 'application/json'
          }
        });
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (aiErr: any) {
        lastAiError = aiErr;
        console.warn(`[Gemini OCR] Model ${modelName} notice:`, aiErr?.message || aiErr);
        if (String(aiErr?.message || '').includes('quota') || String(aiErr?.message || '').includes('resource_exhausted') || String(aiErr?.message || '').includes('overloaded')) {
          continue;
        }
        break;
      }
    }

    if (!responseText && lastAiError) {
      const isQuotaErr = String(lastAiError?.message || '').includes('quota') || String(lastAiError?.message || '').includes('resource_exhausted') || String(lastAiError?.message || '').includes('overloaded');
      return res.status(isQuotaErr ? 429 : 500).json({
        success: false,
        tasks: [],
        count: 0,
        error: isQuotaErr
          ? 'AI টোকেন কোটা শেষ হয়েছে। আপনি গুগল শিটের "Disconnection" ট্যাবে সরাসরি ডেটা কপি-পেস্ট করে অথবা ম্যানুয়াল এন্ট্রি করে কাজ চালিয়ে যেতে পারেন।'
          : (lastAiError?.message || 'AI OCR extraction failed')
      });
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(responseText || '{}');
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    const tasks: any[] = Array.isArray(parsed.tasks) ? parsed.tasks : (Array.isArray(parsed) ? parsed : []);
    return res.json({
      success: true,
      tasks,
      count: tasks.length
    });
  } catch (err: any) {
    console.error('[OCR Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to extract text from document using OCR' });
  }
});

app.post('/api/disconnection-tasks/report', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const report = req.body;
  const taskId = String(report.taskId || report.id || '').trim();
  const subId = String(report.submissionId || report.requestId || `REQ-${Date.now()}`).trim();

  // Check idempotency
  if (subId && submissionIdMap.has(subId)) {
    return res.json(submissionIdMap.get(subId)!.result);
  }

  const newStatus = String(report.taskStatus || report.disconStatus || 'COMPLETED').toUpperCase();
  const cId = String(report.consumerId || report['Consumer Id'] || taskId).replace('TASK-DISC-', '').trim();
  const dateStr = report.disconDate || report.reportDate || new Date().toISOString().split('T')[0];
  const remarksStr = String(report.workerRemarks ?? report.workerReport ?? report.notes ?? report['Notes'] ?? '').trim();

  const updatePayload: Record<string, any> = {
    consumerId: cId,
    'Consumer Id': cId,
    taskId,
    disconStatus: newStatus,
    'Discon Status': newStatus,
    disconDate: dateStr,
    'Discon Date': dateStr,
    notes: remarksStr,
    'Notes': remarksStr,
    workerRemarks: remarksStr,
    workerReport: remarksStr,
    reading: report.meterReading ?? report.reading ?? report['Reading'] ?? '',
    'Reading': report.meterReading ?? report.reading ?? report['Reading'] ?? '',
    image: report.photoUrl ?? report.image ?? report['Image'] ?? '',
    'Image': report.photoUrl ?? report.image ?? report['Image'] ?? '',
    gisPole: report.gisPole ?? report['Gis Pole'] ?? '',
    'Gis Pole': report.gisPole ?? report['Gis Pole'] ?? '',
    agency: report.assignedAgency ?? report.agency ?? report['Agency'] ?? report.workerName ?? '',
    'Agency': report.assignedAgency ?? report.agency ?? report['Agency'] ?? report.workerName ?? '',
    priority: report.priority || 'NORMAL',
    'Priority': report.priority || 'NORMAL',
    paymentStatus: newStatus === 'PAID' ? 'PAID' : (report.paymentStatus || 'UNPAID'),
    'Payment Status': newStatus === 'PAID' ? 'PAID' : (report.paymentStatus || 'UNPAID'),
    requestId: subId
  };

  if (newStatus === 'PAID') {
    updatePayload.paidAmount = report.paidAmount ?? report['Paid Amount'] ?? '';
    updatePayload['Paid Amount'] = updatePayload.paidAmount;
    updatePayload.paidDate = report.paidDate ?? report.paymentDate ?? report['Paid Date'] ?? dateStr;
    updatePayload['Paid Date'] = updatePayload.paidDate;
    updatePayload.paidType = report.paidType ?? report.paymentReference ?? report['Paid Type'] ?? '';
    updatePayload['Paid Type'] = updatePayload.paidType;
    updatePayload.outstandingAfter = report.outstandingAfter ?? report['Outstanding After'] ?? '';
    updatePayload['Outstanding After'] = updatePayload.outstandingAfter;
    updatePayload.nextPaymentDate = report.nextPaymentDate ?? report['Next Payment Date'] ?? '';
    updatePayload['Next Payment Date'] = updatePayload.nextPaymentDate;
    updatePayload.paymentSource = report.paymentSource ?? report['Payment Source'] ?? '';
    updatePayload['Payment Source'] = updatePayload.paymentSource;
  }

  const cIdKey = cId.toLowerCase();
  const existingTask =
    cachedDisconnectionState?.tasks?.find(
      (t: any) => String(t.consumerId || t['Consumer Id'] || '').trim().toLowerCase() === cIdKey || String(t.taskId) === taskId
    ) ||
    localDisconnectionOverlayMap.get(cIdKey) ||
    {};

  const prevStatus = String(existingTask.taskStatus || existingTask.disconStatus || 'PENDING').toUpperCase();
  const newHistoryEntry = {
    date: dateStr,
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    previousStatus: prevStatus,
    newStatus: newStatus,
    workerName: String(report.workerName || report.assignedAgency || report.agency || 'Worker'),
    remarks: remarksStr,
    paidAmount: updatePayload.paidAmount || '',
    meterReading: updatePayload.reading || '',
    photoUrl: updatePayload.image || '',
    action: 'UPDATE'
  };

  const updatedTaskObj = {
    ...existingTask,
    ...updatePayload,
    taskId: taskId || existingTask.taskId || `TASK-DISC-${cId}`,
    consumerId: cId,
    'Consumer Id': cId,
    taskStatus: newStatus,
    disconStatus: newStatus,
    'Discon Status': newStatus,
    disconDate: dateStr,
    'Discon Date': dateStr,
    reportDate: dateStr,
    workerRemarks: remarksStr,
    workerReport: remarksStr,
    notes: remarksStr,
    'Notes': remarksStr,
    meterReading: updatePayload.reading || existingTask.meterReading || '',
    reading: updatePayload.reading || existingTask.reading || '',
    'Reading': updatePayload.reading || existingTask['Reading'] || '',
    photoUrl: updatePayload.image || existingTask.photoUrl || '',
    imageUrl: updatePayload.image || existingTask.imageUrl || '',
    'Image': updatePayload.image || existingTask['Image'] || '',
    gisPole: updatePayload.gisPole || existingTask.gisPole || '',
    'Gis Pole': updatePayload.gisPole || existingTask['Gis Pole'] || '',
    assignedAgency: updatePayload.agency || existingTask.assignedAgency || '',
    agency: updatePayload.agency || existingTask.agency || '',
    'Agency': updatePayload.agency || existingTask['Agency'] || '',
    updatedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    'Last Updated': new Date().toISOString(),
    statusHistory: [newHistoryEntry, ...(Array.isArray(existingTask.statusHistory) ? existingTask.statusHistory : [])],
    _localUpdatedAt: Date.now(),
    _hasUserRemarkUpdate: true,
    _syncedToSheet: false
  };

  if (cIdKey) {
    localDisconnectionOverlayMap.set(cIdKey, updatedTaskObj);
    saveDiscOverlayToDisk();
  }

  if (cachedDisconnectionState && Array.isArray(cachedDisconnectionState.tasks)) {
    const foundIdx = cachedDisconnectionState.tasks.findIndex(
      (t: any) => String(t.consumerId || t['Consumer Id'] || '').trim().toLowerCase() === cIdKey || String(t.taskId) === taskId
    );
    if (foundIdx !== -1) {
      cachedDisconnectionState.tasks[foundIdx] = updatedTaskObj;
    } else {
      cachedDisconnectionState.tasks.unshift(updatedTaskObj);
    }
    try { fs.writeFileSync(DISC_CACHE_FILE, JSON.stringify(cachedDisconnectionState.tasks), 'utf-8'); } catch {}
  }

  const responseObj = {
    success: true,
    message: `Consumer ${cId} remark & status (${newStatus}) saved to Disconnection sheet`,
    taskId: updatedTaskObj.taskId,
    consumerId: cId,
    status: newStatus,
    task: updatedTaskObj
  };
  submissionIdMap.set(subId, { timestamp: Date.now(), result: responseObj });

  // Direct background write to Google Sheet Disconnection tab using verified updateEntry + createEntry fallback
  (async () => {
    let savedToSheet = false;
    try {
      const full33 = buildComplete33ColumnPayload(updatedTaskObj);
      const res3 = await callGoogleAppsScript(
        'updateEntry',
        { id: cId, submissionId: cId, consumerId: cId, 'Consumer Id': cId, category: 'Disconnection', ...full33, data: full33 },
        'POST',
        35000
      );
      if (res3 && res3.success) {
        savedToSheet = true;
      } else {
        const res4 = await callGoogleAppsScript(
          'createEntry',
          { id: cId, submissionId: cId, consumerId: cId, 'Consumer Id': cId, category: 'Disconnection', ...full33, data: full33 },
          'POST',
          35000
        );
        if (res4 && res4.success !== false) {
          savedToSheet = true;
        }
      }
    } catch (err) {
      console.warn('[Background Disconnection Remark Sync] Notice:', err);
    }

    if (savedToSheet && cIdKey) {
      const ov = localDisconnectionOverlayMap.get(cIdKey);
      if (ov) {
        ov._syncedToSheet = true;
        saveDiscOverlayToDisk();
      }
    }
    gasCache.clear();
  })();

  return res.json(responseObj);
});

app.post('/api/disconnection-tasks/assign', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    callGoogleAppsScript('assignDisconnectionTask', req.body, 'POST').catch(() => {});
    gasCache.clear();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to assign task' });
  }
});

app.post('/api/disconnection-tasks/archive', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    callGoogleAppsScript('archiveDisconnectionTask', req.body, 'POST').catch(() => {});
    gasCache.clear();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to archive task' });
  }
});

app.post('/api/disconnection-tasks/restore', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    callGoogleAppsScript('restoreDisconnectionTask', req.body, 'POST').catch(() => {});
    gasCache.clear();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to restore task' });
  }
});

const handleDisconnectionTaskDelete = async (req: express.Request, res: express.Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const paramId = String((req.params as any)?.id || req.body?.consumerId || req.body?.taskId || req.body?.id || req.query?.consumerId || req.query?.id || '').trim();
    const cleanConsumerId = String(req.body?.consumerId || req.body?.['Consumer Id'] || paramId).replace(/^TASK-DISC-/i, '').trim();
    const cleanTaskId = String(req.body?.taskId || (cleanConsumerId ? `TASK-DISC-${cleanConsumerId}` : paramId)).trim();

    if (!cleanConsumerId && !cleanTaskId) {
      return res.status(400).json({ success: false, error: 'Consumer ID or Task ID is required for deletion.' });
    }

    registerDeletedRecord(paramId, cleanConsumerId, cleanTaskId);
    executeSheetDeleteInBackground(cleanConsumerId || cleanTaskId, cleanConsumerId, {
      ...req.body,
      category: 'Disconnection',
      taskId: cleanTaskId
    });

    return res.json({
      success: true,
      deleted: true,
      consumerId: cleanConsumerId,
      taskId: cleanTaskId,
      message: `Consumer ${cleanConsumerId || cleanTaskId} permanently deleted from Disconnection module and backend sheet`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to delete consumer from Disconnection sheet'
    });
  }
};

app.delete('/api/disconnection-tasks/:id', handleDisconnectionTaskDelete);
app.post('/api/disconnection-tasks/delete', handleDisconnectionTaskDelete);
app.post('/api/disconnection-tasks/:id/delete', handleDisconnectionTaskDelete);

app.get('/api/disconnection-tasks/history', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('getDisconnectionHistory', req.query, 'GET');
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, history: [], error: err.message });
  }
});

// ============================================================================
// SERVER INITIALIZATION & VITE MIDDLEWARE
// ============================================================================
async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const isProduction = process.env.NODE_ENV === 'production';

  // In AI Studio dev environment, dev server must always run on port 3000
  const desiredPort = isProduction ? parseInt(process.env.PORT || '3000', 10) : 3000;

  let viteMiddleware: any = null;
  let viteInitPromise: Promise<void> | null = null;

  if (!isProduction) {
    viteInitPromise = (async () => {
      try {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: 'spa',
        });
        viteMiddleware = vite.middlewares;
      } catch (viteErr) {
        console.warn('Vite middleware initialization notice, serving static:', viteErr);
      }
    })();

    app.use(async (req, res, next) => {
      if (viteInitPromise) {
        await viteInitPromise;
        viteInitPromise = null;
      }
      if (viteMiddleware) {
        return viteMiddleware(req, res, next);
      }
      next();
    });
  }

  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send('<!DOCTYPE html><html><head><meta charset="utf-8"/><title>POWER</title></head><body><div id="root"></div></body></html>');
    }
  });

  function startListening(port: number) {
    const s = app.listen(port, '0.0.0.0', () => {
      console.log(`⚡ POWER server running on http://localhost:${port}`);
      console.log(`📊 Google Spreadsheet ID: ${GOOGLE_SHEET_ID}`);
      console.log(`🔗 Google Apps Script URL: ${GOOGLE_APPS_SCRIPT_URL}`);
    });

    s.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && port !== 3000) {
        console.warn(`Port ${port} in use, falling back to port 3000...`);
        startListening(3000);
      } else {
        console.error('Server listen error:', err);
        process.exit(1);
      }
    });

    process.on('SIGTERM', () => {
      s.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      s.close(() => {
        process.exit(0);
      });
    });

    return s;
  }

  startListening(desiredPort);
}

startServer();
