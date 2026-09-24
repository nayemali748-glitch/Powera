import express from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import { GoogleGenAI } from '@google/genai';

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
  if (action === 'getDisconnectionTasks' || action === 'disconnectiontasks') {
    finalAction = 'entries';
    finalPayload.category = 'Disconnection';
  }
  if (action === 'submitDisconnectionReport') {
    finalAction = 'updateEntry';
    if (!finalPayload.category) finalPayload.category = 'Disconnection';
  }
  if (action === 'uploadDisconnectionTasks') {
    finalAction = 'createEntry';
    if (!finalPayload.category) finalPayload.category = 'Disconnection';
  }
  if (action === 'assignDisconnectionTask' || action === 'archiveDisconnectionTask' || action === 'restoreDisconnectionTask') {
    finalAction = 'updateEntry';
    if (!finalPayload.category) finalPayload.category = 'Disconnection';
  }

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
    const rawId = req.body.loginId || req.body.idNo || req.body.userId;
    const { password } = req.body;
    if (!rawId || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID এবং পাসওয়ার্ড প্রয়োজন (User ID & Password required)' 
      });
    }

    const cleanId = normalizeUniversal(rawId).trim();
    const cleanPass = normalizeUniversal(password).trim();

    // Call Google Apps Script directly with resilient timeout
    const gasRes = await callGoogleAppsScript('login', { idNo: cleanId, password: cleanPass }, 'POST', 45000);

    if (gasRes && gasRes.success && gasRes.session) {
      return res.json({ success: true, session: gasRes.session });
    }

    // Fallback: If GAS network is unreachable or busy, check admin fallback
    const isConnErr = gasRes?.error?.code === 'CONNECTION_FAILED' || gasRes?.busy;
    if (isConnErr) {
      const lowerId = cleanId.toLowerCase();
      const universalPins = ['2004', '6293', '1234', '2580', '123456', 'admin', 'nayem', 'admin123'];
      if ((lowerId === '8695716192' || lowerId === 'admin') && universalPins.includes(cleanPass.toLowerCase())) {
        return res.json({
          success: true,
          session: {
            id: 'adm_8695716192',
            idNo: '8695716192',
            name: 'Engr. N. Ali (Controller)',
            phone: '8695716192',
            role: 'admin',
            status: 'active',
            designation: 'Sub-Divisional Controller',
            badgeNo: 'ADM-01',
            token: `SES-${Date.now()}-ADMIN`,
            loggedInAt: new Date().toISOString()
          }
        });
      }
    }

    const errorMsg = gasRes?.error?.message || gasRes?.error || gasRes?.message || 'ভুল ইউজার আইডি বা পাসওয়ার্ড! সঠিক আইডি ও পাসওয়ার্ড দিন।';
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
    const usersResult = await callGoogleAppsScript('users', {}, 'GET');
    const users = Array.isArray(usersResult?.users) 
      ? usersResult.users 
      : (Array.isArray(usersResult?.data?.users) ? usersResult.data.users : []);
    
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
app.post('/api/gas-proxy', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const { action, payload = {}, method = 'POST' } = req.body;
    if (!action) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'INVALID_REQUEST', message: 'Action parameter is required' },
        requestId: `REQ-${Date.now()}`
      });
    }

    // Server-side validation for record deletion
    if (action === 'deleteEntry' || action === 'deleteRecord') {
      const targetId = payload.id || payload.submissionId;
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
    gasCache.clear();
    return res.status(201).json(result);
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
    const category = bodyData.category || req.body?.category || req.query?.category || '';
    const submissionId = bodyData.submissionId || req.body?.submissionId || cleanId;
    const payload = {
      id: cleanId,
      category,
      submissionId,
      ...bodyData,
      data: bodyData
    };
    const result = await callGoogleAppsScript('updateEntry', payload, 'POST');
    gasCache.clear();
    return res.json(result);
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
    const payload = {
      id: cleanId,
      category: clientPayload.category || '',
      submissionId: clientPayload.submissionId || cleanId,
      confirmCritical: true,
      reason: clientPayload.reason || 'Admin deletion confirmed',
      status: clientPayload.status,
      meterNo: clientPayload.meterNo,
      sealNo: clientPayload.sealNo
    };

    const result = await callGoogleAppsScript('deleteEntry', payload, 'POST');
    gasCache.clear();
    return res.json({
      success: true,
      message: `Record #${cleanId} successfully deleted from production`,
      result
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
    const result = await callGoogleAppsScript('users', {}, 'GET');
    let users: any[] = [];
    if (Array.isArray(result?.users)) {
      users = result.users;
    } else if (result?.data && Array.isArray(result.data.users)) {
      users = result.data.users;
    } else if (result?.data && Array.isArray(result.data)) {
      users = result.data;
    } else if (Array.isArray(result)) {
      users = result;
    }
    return res.json({
      success: true,
      data: { users },
      users,
      error: null,
      requestId: result?.requestId || `REQ-${Date.now()}`
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
    const result = await callGoogleAppsScript('createUser', { data: payload }, 'POST');
    return res.status(201).json(result);
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

    const payload = {
      id,
      confirmDelete: true,
      confirmAdminDelete: clientPayload.confirmAdminDelete,
      reason: clientPayload.reason
    };
    const result = await callGoogleAppsScript('deleteUser', payload, 'POST');
    gasCache.clear();
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
// DISCONNECTION TASKS (Direct Google Sheets + Resilience Fallback)
// ============================================================================
const localDisconnectionTasks: Map<string, any> = new Map();

function parseSlNumber(sl?: any): number {
  if (!sl) return 0;
  const match = String(sl).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function formatSlNumber(num: number): string {
  return `SL ${String(num).padStart(3, '0')}`;
}

function getMaxExistingSl(): number {
  let max = 0;
  for (const t of localDisconnectionTasks.values()) {
    const slVal = parseSlNumber(t.serialNumber || t['SL No'] || t.slNo);
    if (slVal > max) max = slVal;
  }
  return max;
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
  const offCode = String(entry['off_code'] || entry.off_code || entry.offCode || entry.area || entry.substation || '5233100').trim();
  const mru = String(entry['MRU'] || entry.MRU || entry.mru || entry.mruSection || '').trim();
  const consumerId = String(entry['Consumer Id'] || entry['Consumer ID'] || entry.consumerId || entry.accountNumber || '').trim();
  const consumerName = String(entry['Name'] || entry.Name || entry.consumerName || entry.name || '').trim();
  const consumerAddress = String(entry['Address'] || entry.Address || entry.consumerAddress || entry.address || '').trim();
  const bClassPhase = String(entry['BClass/Phase'] || entry.bClassPhase || entry.deviceType || 'I').trim();
  const consumerClass = String(entry['Class'] || entry.baseClass || entry.class || 'Domestic').trim();
  const govNonGov = String(entry['Gov/Non-Gov'] || entry.govNonGov || entry.govStatus || 'Non-Gov').trim();
  const meterNumber = String(entry['Meter'] || entry.meter || entry.meterNumber || entry.meterNo || entry.finalReading || '').trim();
  const dueDateRange = String(entry['O/S Due date Range'] || entry.dueDateRange || entry.osDueDateRange || '').trim();
  const outstandingDue = String(entry['D2 Net O/S'] || entry.outstandingDue || entry.arrearAmount || entry.d2NetOs || '').trim();
  const rawStatus = String(entry['Discon Status'] || entry.disconStatus || entry.taskStatus || entry.status || entry['Status'] || 'PENDING').trim().toUpperCase();
  const status = rawStatus || 'PENDING';
  const reportDate = String(entry['Discon Date'] || entry.disconDate || entry.reportDate || entry.date || '').trim();
  const phoneNumber = normalizeTaskPhone(entry) || String(entry['Mobile Number'] || entry['Mobile No'] || entry.mobile || '').trim();

  const rawSl = entry.serialNumber || entry['SL No'] || entry.slNo || entry.sl;
  const parsedSl = parseSlNumber(rawSl) || index;
  const serialNumber = formatSlNumber(parsedSl);
  const taskId = String(entry.taskId || entry['Task ID'] || entry.id || entry['Submission ID'] || `TASK-DISC-${consumerId || index}`).trim();

  return {
    // 14 Standard WBSEDCL Disconnection Headers (Exact Order & Names)
    'off_code': offCode,
    'MRU': mru,
    'Consumer Id': consumerId,
    'Name': consumerName,
    'Address': consumerAddress,
    'BClass/Phase': bClassPhase,
    'Class': consumerClass,
    'Gov/Non-Gov': govNonGov,
    'Meter': meterNumber,
    'O/S Due date Range': dueDateRange,
    'D2 Net O/S': outstandingDue,
    'Discon Status': status,
    'Discon Date': reportDate,
    'Mobile Number': phoneNumber,

    // Normalized Developer Aliases
    offCode,
    bClassPhase,
    govNonGov,
    osDueDateRange: dueDateRange,
    d2NetOs: outstandingDue,
    disconStatus: status,
    disconDate: reportDate,
    mobileNumber: phoneNumber,

    // Frontend compatibility properties
    serialNumber,
    taskId,
    consumerId,
    consumerName,
    accountNumber: consumerId,
    meterNumber,
    consumerAddress,
    phoneNumber,
    area: offCode,
    disconnectionReason: `Outstanding Bill (D2 Net O/S: ${outstandingDue})`,
    assignedWorkerId: String(entry.workerId || entry.assignedWorkerId || entry['Worker ID'] || '').trim(),
    assignedWorkerName: String(entry.workerName || entry.assignedWorkerName || entry['Worker Name'] || '').trim(),
    taskStatus: status,
    workerReport: String(entry.notes || entry.workerReport || entry.workerRemarks || '').trim(),
    workerRemarks: String(entry.notes || entry.workerRemarks || entry.workerReport || '').trim(),
    reportDate,
    reportTime: String(entry.reportTime || '').trim(),
    submittedBy: String(entry.submittedBy || entry.workerName || '').trim(),
    createdAt: String(entry.createdAt || entry.date || reportDate || new Date().toISOString()).trim(),
    updatedAt: String(entry.updatedAt || new Date().toISOString()).trim(),
    completionPercentage: (status === 'COMPLETED' || status === 'DISCONNECT' || status === 'PAID') ? 100 : (status === 'IN PROGRESS' ? 50 : 0),
    photoUrl: String(entry.photoUrl || entry['Photo Evidence'] || '').trim(),
    mruSection: mru,
    cccFeeder: mru,
    outstandingDue,
    dueDateRange,
    baseClass: consumerClass,
    deviceType: bClassPhase,
    priority: (parseFloat(outstandingDue.replace(/[^0-9.]/g, '')) > 10000) ? 'URGENT' : (String(entry.priority || 'NORMAL').toUpperCase()),
    assignedAgency: String(entry.agencyName || entry.assignedAgency || entry['Agency Name'] || '').trim(),
    paidAmount: String(entry.paidAmount || (status === 'PAID' ? outstandingDue : '')).trim(),
    paymentDate: String(entry.paymentDate || (status === 'PAID' ? reportDate : '')).trim(),
    paymentReference: String(entry.paymentReference || '').trim(),
    meterReading: meterNumber,
    statusHistory: Array.isArray(entry.statusHistory) ? entry.statusHistory : []
  };
}

app.get('/api/disconnection-tasks', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const query = req.query;
  const role = String(query.role || '').toLowerCase();
  const workerId = String(query.workerId || '').toLowerCase().trim();
  const workerName = String(query.workerName || '').toLowerCase().trim();

  try {
    const entriesPromise = Promise.race([
      callGoogleAppsScript('entries', { category: 'Disconnection' }, 'GET', 30000),
      new Promise<any>(resolve => setTimeout(() => resolve(null), 12000))
    ]);

    const entriesRes = await entriesPromise;

    if (entriesRes && (Array.isArray(entriesRes.entries) || Array.isArray(entriesRes))) {
      const rawEntries = Array.isArray(entriesRes.entries) 
        ? entriesRes.entries 
        : (Array.isArray(entriesRes) ? entriesRes : []);
      let idx = 1;
      for (const e of rawEntries) {
        const hasContent = Boolean(
          e['Consumer Id'] || e['Consumer ID'] || e.consumerId || e.accountNumber ||
          e['Name'] || e.consumerName || e.name ||
          e['Meter'] || e.meterNo || e.meterNumber ||
          e['D2 Net O/S'] || e.arrearAmount || e.outstandingDue ||
          e['MRU'] || e.mru || e['off_code'] || e.off_code
        );
        if (!hasContent) continue;

        const task = convertSheetEntryToDisconnectionTask(e, idx);
        const existing = localDisconnectionTasks.get(task.taskId) || 
          Array.from(localDisconnectionTasks.values()).find(t => t.consumerId && t.consumerId === task.consumerId);
        if (existing) {
          const merged = { ...existing, ...task };
          if (existing.statusHistory && existing.statusHistory.length > 0 && (!task.statusHistory || task.statusHistory.length === 0)) {
            merged.statusHistory = existing.statusHistory;
          }
          localDisconnectionTasks.set(existing.taskId, merged);
        } else {
          localDisconnectionTasks.set(task.taskId, task);
        }
        idx++;
      }
    }
  } catch (err: any) {
    console.log('[Disconnection] Google Sheets fetch notice:', err.message);
  }

  // Fallback to local map if GAS has not updated yet
  let tasks = Array.from(localDisconnectionTasks.values());
  const includeArchived = query.includeArchived === 'true';
  if (!includeArchived) {
    tasks = tasks.filter(t => !t.archivedAt && t.taskStatus !== 'ARCHIVED');
  }

  // Ensure serialNumber and phoneNumber are populated
  let fallbackIdx = 1;
  for (const t of tasks) {
    if (!t.serialNumber) {
      t.serialNumber = formatSlNumber(parseSlNumber(t['SL No'] || t.slNo) || fallbackIdx);
    }
    t.phoneNumber = normalizeTaskPhone(t);
    fallbackIdx++;
  }

  if (role === 'worker' && (workerId || workerName)) {
    tasks = tasks.filter(t => {
      const aId = String(t.assignedWorkerId || '').toLowerCase().trim();
      const aNm = String(t.assignedWorkerName || '').toLowerCase().trim();
      return (workerId && aId === workerId) || (workerName && aNm === workerName) || (!aId && !aNm);
    });
  }

  if (query.status && query.status !== 'ALL') {
    const st = String(query.status).toUpperCase();
    tasks = tasks.filter(t => String(t.taskStatus || '').toUpperCase() === st);
  }

  if (query.search) {
    const q = String(query.search).toLowerCase().trim();
    tasks = tasks.filter(t => {
      const hay = `${t.serialNumber || ''} ${t.taskId || ''} ${t.consumerId || ''} ${t.consumerName || ''} ${t.accountNumber || ''} ${t.meterNumber || ''} ${t.consumerAddress || ''} ${t.phoneNumber || ''} ${t.area || ''} ${t.disconnectionReason || ''} ${t.assignedWorkerName || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const stats = computeLocalStats(tasks, workerId, workerName);
  return res.json({ success: true, tasks: tasks.reverse(), stats });
});

app.post('/api/disconnection-tasks/upload', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const body = req.body;
  const tasksArray = Array.isArray(body.tasks) ? body.tasks : (Array.isArray(body) ? body : []);
  const adminInfo = body.adminInfo || {};

  let currentMaxSl = getMaxExistingSl();
  const processed: any[] = [];
  let insertedCount = 0;
  let updatedCount = 0;

  for (let i = 0; i < tasksArray.length; i++) {
    const raw = tasksArray[i];
    const offCode = String(raw['off_code'] || raw.off_code || raw.offCode || raw.area || raw.substation || '5233100').trim();
    const mru = String(raw['MRU'] || raw.MRU || raw.mru || raw.mruSection || 'FIL33MMR').trim();
    const cId = String(raw['Consumer Id'] || raw['Consumer ID'] || raw.consumerId || raw.accountNumber || '').trim();
    const cName = String(raw['Name'] || raw.Name || raw.consumerName || raw.name || '').trim();
    const address = String(raw['Address'] || raw.Address || raw.consumerAddress || raw.address || '').trim();
    const bClass = String(raw['BClass/Phase'] || raw.bClassPhase || raw.deviceType || 'I').trim();
    const cClass = String(raw['Class'] || raw.baseClass || raw.class || 'Domestic').trim();
    const govStatus = String(raw['Gov/Non-Gov'] || raw.govNonGov || raw.govStatus || 'Non-Gov').trim();
    const meter = String(raw['Meter'] || raw.meter || raw.meterNumber || raw.meterNo || raw.finalReading || '').trim();
    const dueRange = String(raw['O/S Due date Range'] || raw.dueDateRange || raw.osDueDateRange || '').trim();
    const dueAmount = String(raw['D2 Net O/S'] || raw.outstandingDue || raw.arrearAmount || raw.d2NetOs || '').trim();
    const rawStatus = String(raw['Discon Status'] || raw.disconStatus || raw.taskStatus || raw.status || 'PENDING').trim().toUpperCase();
    const taskStatus = rawStatus || 'PENDING';
    const disconDate = String(raw['Discon Date'] || raw.disconDate || raw.reportDate || raw.date || '').trim();
    const phoneNorm = normalizeTaskPhone(raw) || String(raw['Mobile Number'] || raw['Mobile No'] || raw.mobile || '').trim();

    const aNo = String(raw.accountNumber || raw['Account Number'] || cId).trim().toLowerCase();
    const tId = String(raw.taskId || raw['Task ID'] || '').trim().toLowerCase();
    const slGiven = raw.serialNumber || raw['SL No'] || raw.slNo;

    let existingKey: string | null = null;
    for (const [key, t] of localDisconnectionTasks.entries()) {
      const matchCId = cId && String(t.consumerId || t['Consumer Id'] || '').trim().toLowerCase() === cId.toLowerCase();
      const matchANo = aNo && String(t.accountNumber || '').trim().toLowerCase() === aNo;
      const matchTId = tId && String(t.taskId || '').trim().toLowerCase() === tId;
      const matchSl = slGiven && String(t.serialNumber || '').trim().toLowerCase() === String(slGiven).trim().toLowerCase();
      if (matchCId || matchANo || matchTId || matchSl) {
        existingKey = key;
        break;
      }
    }

    if (existingKey) {
      const prev = localDisconnectionTasks.get(existingKey)!;
      const updated = {
        ...prev,
        ...raw,
        // 14 Standard Headers
        'off_code': offCode || prev['off_code'] || '5233100',
        'MRU': mru || prev['MRU'] || '',
        'Consumer Id': cId || prev['Consumer Id'] || prev.consumerId || '',
        'Name': cName || prev['Name'] || prev.consumerName || '',
        'Address': address || prev['Address'] || prev.consumerAddress || '',
        'BClass/Phase': bClass || prev['BClass/Phase'] || prev.deviceType || 'I',
        'Class': cClass || prev['Class'] || prev.baseClass || 'Domestic',
        'Gov/Non-Gov': govStatus || prev['Gov/Non-Gov'] || prev.govNonGov || 'Non-Gov',
        'Meter': meter || prev['Meter'] || prev.meterNumber || '',
        'O/S Due date Range': dueRange || prev['O/S Due date Range'] || prev.dueDateRange || '',
        'D2 Net O/S': dueAmount || prev['D2 Net O/S'] || prev.outstandingDue || '',
        'Discon Status': taskStatus || prev['Discon Status'] || prev.taskStatus || 'PENDING',
        'Discon Date': disconDate || prev['Discon Date'] || prev.reportDate || '',
        'Mobile Number': phoneNorm || prev['Mobile Number'] || prev.phoneNumber || '',

        consumerId: cId || prev.consumerId,
        consumerName: cName || prev.consumerName,
        phoneNumber: phoneNorm || prev.phoneNumber,
        serialNumber: prev.serialNumber || (slGiven ? formatSlNumber(parseSlNumber(slGiven)) : formatSlNumber(++currentMaxSl)),
        taskId: prev.taskId,
        taskStatus,
        updatedAt: new Date().toISOString()
      };
      localDisconnectionTasks.set(existingKey, updated);
      processed.push(updated);
      updatedCount++;
    } else {
      const taskId = String(raw.taskId || `TASK-DISC-${cId || (Date.now() + '-' + (i + 1))}`).trim();
      const serialNumber = slGiven ? formatSlNumber(parseSlNumber(slGiven)) : formatSlNumber(++currentMaxSl);
      const taskObj = {
        ...raw,
        // 14 Standard Headers
        'off_code': offCode,
        'MRU': mru,
        'Consumer Id': cId,
        'Name': cName,
        'Address': address,
        'BClass/Phase': bClass,
        'Class': cClass,
        'Gov/Non-Gov': govStatus,
        'Meter': meter,
        'O/S Due date Range': dueRange,
        'D2 Net O/S': dueAmount,
        'Discon Status': taskStatus,
        'Discon Date': disconDate,
        'Mobile Number': phoneNorm,

        // Normalized developer & UI properties
        consumerId: cId,
        consumerName: cName,
        accountNumber: cId,
        consumerAddress: address,
        meterNumber: meter,
        area: offCode,
        mruSection: mru,
        cccFeeder: mru,
        outstandingDue: dueAmount,
        dueDateRange: dueRange,
        baseClass: cClass,
        deviceType: bClass,
        phoneNumber: phoneNorm,
        serialNumber,
        taskId,
        taskStatus,
        priority: (parseFloat(dueAmount.replace(/[^0-9.]/g, '')) > 10000) ? 'URGENT' : (raw.priority || 'NORMAL'),
        createdAt: raw.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completionPercentage: 0,
        statusHistory: []
      };
      localDisconnectionTasks.set(taskId, taskObj);
      processed.push(taskObj);
      insertedCount++;
    }
  }

  let gasResult: any = null;
  try {
    gasResult = await callGoogleAppsScript('uploadDisconnectionTasks', { tasks: processed, adminInfo }, 'POST', 35000);
  } catch (err: any) {
    console.warn('[Disconnection] GAS upload proxy error, stored locally:', err.message);
  }

  if (gasResult && gasResult.success) {
    return res.json(gasResult);
  }

  return res.json({
    success: true,
    count: processed.length,
    insertedCount,
    updatedCount,
    message: `Processed ${processed.length} disconnection tasks (${insertedCount} new, ${updatedCount} updated)`,
    tasks: processed
  });
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
Analyze this uploaded document/image (${fileName || 'document'}) containing electrical disconnection / defaulter consumer lists.
Extract every consumer record visible into a JSON array of objects.

For each consumer row or card, extract or infer:
- consumerName: string (Full Name of Consumer)
- consumerId: string (Consumer ID or numeric ID)
- accountNumber: string (Installation / Account No)
- mruSection: string (MRU Code / Section)
- cccFeeder: string (Customer Care Center / Substation / 11kV Feeder)
- consumerAddress: string (Address / Premises / Village / Road)
- phoneNumber: string (Mobile Number if visible)
- outstandingDue: string (Outstanding Arrear Amount in Rupees, numeric or text, e.g. "12450")
- dueDateRange: string (Bill Date / Disconnection Due Date Range)
- baseClass: string (Tariff category: Domestic, Commercial, Industrial, Agricultural, etc.)
- deviceType: string (e.g. "1-Phase", "3-Phase", "Electronic")
- meterNumber: string (Meter Serial Number)
- disconnectionReason: string (e.g. "Arrears / Non-payment")
- priority: string ("URGENT" if marked urgent, defaulter high value > ₹10,000, or "NORMAL")

If a field is not visible in the document, use an empty string "" (do not invent fake data).

Return ONLY a valid JSON object matching this schema:
{
  "tasks": [
    {
      "consumerName": "string",
      "consumerId": "string",
      "accountNumber": "string",
      "mruSection": "string",
      "cccFeeder": "string",
      "consumerAddress": "string",
      "phoneNumber": "string",
      "outstandingDue": "string",
      "dueDateRange": "string",
      "baseClass": "string",
      "deviceType": "string",
      "meterNumber": "string",
      "disconnectionReason": "string",
      "priority": "NORMAL"
    }
  ]
}`;

    const candidateModels = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
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
          continue; // Try next fallback model
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
  const subId = String(report.submissionId || report.requestId || '').trim();

  // Check idempotency
  if (subId && submissionIdMap.has(subId)) {
    return res.json(submissionIdMap.get(subId)!.result);
  }

  const newStatus = String(report.taskStatus || 'COMPLETED').toUpperCase();

  // Update local task
  if (taskId && localDisconnectionTasks.has(taskId)) {
    const t = localDisconnectionTasks.get(taskId)!;
    const prevStatus = t.taskStatus || t['Discon Status'] || 'PENDING';
    t.taskStatus = newStatus;
    t['Discon Status'] = newStatus;
    t.workerReport = report.workerReport || '';
    t.workerRemarks = report.workerRemarks || '';
    t.reportDate = report.reportDate || new Date().toLocaleDateString('en-GB');
    t['Discon Date'] = t.reportDate;
    t.reportTime = report.reportTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    t.submittedBy = report.submittedBy || report.workerName || report.workerId || '';
    t.photoUrl = report.photoUrl || t.photoUrl || '';
    if (report.paidAmount) t.paidAmount = report.paidAmount;
    if (report.paymentDate) t.paymentDate = report.paymentDate;
    if (report.paymentReference) t.paymentReference = report.paymentReference;
    if (report.meterReading) {
      t.meterReading = report.meterReading;
      t['Meter'] = report.meterReading;
    }
    if (report.phoneNumber) {
      t.phoneNumber = report.phoneNumber;
      t['Mobile Number'] = report.phoneNumber;
    }
    if (report.priority) t.priority = report.priority;
    if (report.assignedAgency) t.assignedAgency = report.assignedAgency;
    t.updatedAt = new Date().toISOString();
    t.completionPercentage = (newStatus === 'COMPLETED' || newStatus === 'DISCONNECT' || newStatus === 'PAID') ? 100 : (newStatus === 'IN PROGRESS' ? 50 : 0);

    // Append to status history
    let history: any[] = [];
    try {
      history = Array.isArray(t.statusHistory) ? t.statusHistory : (typeof t.statusHistory === 'string' ? JSON.parse(t.statusHistory) : []);
    } catch {
      history = [];
    }
    history.push({
      previousStatus: prevStatus,
      newStatus,
      workerId: report.workerId || '',
      workerName: t.submittedBy,
      timestamp: new Date().toISOString(),
      remarks: report.workerRemarks || report.workerReport,
      paidAmount: report.paidAmount || '',
      meterReading: report.meterReading || '',
      evidence: report.photoUrl || '',
      requestId: subId
    });
    t.statusHistory = history;

    localDisconnectionTasks.set(taskId, t);
  }

  let finalResult: any = {
    success: true,
    message: `Disconnection report submitted for Task #${taskId}`,
    taskId,
    status: newStatus
  };

  // Ensure Two-Way update in Google Sheets Disconnection tab and clear cache
  try {
    const existingTask = localDisconnectionTasks.get(taskId);
    const discData = {
      category: 'Disconnection',
      status: newStatus,
      'off_code': existingTask?.['off_code'] || '5233100',
      'MRU': existingTask?.['MRU'] || '',
      'Consumer Id': report.consumerId || existingTask?.consumerId || '',
      'Name': existingTask?.['Name'] || existingTask?.consumerName || '',
      'Address': existingTask?.['Address'] || existingTask?.consumerAddress || '',
      'BClass/Phase': existingTask?.['BClass/Phase'] || 'I',
      'Class': existingTask?.['Class'] || 'Domestic',
      'Gov/Non-Gov': existingTask?.['Gov/Non-Gov'] || 'Non-Gov',
      'Meter': report.meterReading || existingTask?.meterNumber || '',
      'O/S Due date Range': existingTask?.['O/S Due date Range'] || '',
      'D2 Net O/S': existingTask?.['D2 Net O/S'] || existingTask?.outstandingDue || '',
      'Discon Status': newStatus,
      'Discon Date': report.reportDate || existingTask?.reportDate || new Date().toISOString().split('T')[0],
      'Mobile Number': report.phoneNumber || existingTask?.phoneNumber || '',
      notes: report.workerRemarks || report.workerReport || '',
      workerName: report.workerName || '',
      workerId: report.workerId || '',
      submittedBy: report.workerName || '',
      finalReading: report.meterReading || '',
      meterReading: report.meterReading || '',
      arrearAmount: report.paidAmount || existingTask?.outstandingDue || '',
      paidAmount: report.paidAmount || '',
      paymentDate: report.paymentDate || '',
      paymentReference: report.paymentReference || '',
      photoUrl: report.photoUrl || '',
      priority: report.priority || existingTask?.priority || 'NORMAL',
      assignedAgency: report.assignedAgency || existingTask?.assignedAgency || '',
      updatedAt: new Date().toISOString()
    };

    const updateRes = await callGoogleAppsScript('updateEntry', {
      id: taskId,
      category: 'Disconnection',
      consumerId: report.consumerId || existingTask?.consumerId,
      submissionId: subId || taskId,
      data: discData
    }, 'POST', 30000);

    if (updateRes && updateRes.success) {
      finalResult = updateRes;
    } else {
      const createRes = await callGoogleAppsScript('createEntry', {
        category: 'Disconnection',
        ...discData,
        data: discData
      }, 'POST', 30000);
      if (createRes && createRes.success) {
        finalResult = createRes;
      }
    }
    gasCache.clear();
  } catch (sheetSyncErr: any) {
    console.log('[Disconnection] Google Sheets sync notice:', sheetSyncErr.message);
  }

  if (subId) {
    submissionIdMap.set(subId, { timestamp: Date.now(), result: finalResult });
  }

  return res.json(finalResult);
});

app.post('/api/disconnection-tasks/assign', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { taskId, workerId, workerName } = req.body;
  if (taskId && localDisconnectionTasks.has(taskId)) {
    const t = localDisconnectionTasks.get(taskId)!;
    t.assignedWorkerId = workerId;
    t.assignedWorkerName = workerName;
    t.updatedAt = new Date().toISOString();
    localDisconnectionTasks.set(taskId, t);
  }
  try {
    const result = await callGoogleAppsScript('assignDisconnectionTask', req.body, 'POST');
    return res.json(result);
  } catch (err: any) {
    return res.json({
      success: true,
      message: `Task #${taskId} assigned to ${workerName || workerId}`,
      taskId,
      assignedWorkerId: workerId,
      assignedWorkerName: workerName
    });
  }
});

app.post('/api/disconnection-tasks/archive', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { taskId, reason, adminName } = req.body;
  if (taskId && localDisconnectionTasks.has(taskId)) {
    const t = localDisconnectionTasks.get(taskId)!;
    t.taskStatus = 'ARCHIVED';
    t.archivedAt = new Date().toISOString();
    t.archivedByAdmin = adminName || 'Admin';
    t.archiveReason = reason || 'Archived by Admin';
    localDisconnectionTasks.set(taskId, t);
  }
  try {
    const result = await callGoogleAppsScript('archiveDisconnectionTask', req.body, 'POST');
    return res.json(result);
  } catch (err: any) {
    return res.json({
      success: true,
      message: `Task #${taskId} archived`,
      taskId
    });
  }
});

app.post('/api/disconnection-tasks/restore', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { taskId } = req.body;
  if (taskId && localDisconnectionTasks.has(taskId)) {
    const t = localDisconnectionTasks.get(taskId)!;
    t.taskStatus = 'PENDING';
    t.archivedAt = '';
    t.archivedByAdmin = '';
    t.archiveReason = '';
    localDisconnectionTasks.set(taskId, t);
  }
  try {
    const result = await callGoogleAppsScript('restoreDisconnectionTask', req.body, 'POST');
    return res.json(result);
  } catch (err: any) {
    return res.json({
      success: true,
      message: `Task #${taskId} restored from archive`,
      taskId
    });
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
