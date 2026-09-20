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

// Critical production record validation helper
async function validateEntryDeletion(entryId: string, clientPayload: any): Promise<{ allowed: boolean; error?: string; isCritical?: boolean; record?: any }> {
  const cleanId = String(entryId || '').trim();
  if (!cleanId) {
    return { allowed: false, error: 'Record ID is required for deletion.' };
  }

  // Fetch current entries to inspect record
  let currentRecord: any = null;
  try {
    const cachedEntriesResult = await callGoogleAppsScript('entries', {}, 'GET');
    const rawEntries = Array.isArray(cachedEntriesResult?.entries) 
      ? cachedEntriesResult.entries 
      : (Array.isArray(cachedEntriesResult) ? cachedEntriesResult : []);
    
    currentRecord = rawEntries.find((e: any) => {
      const eId = String(e.id || e['Record ID'] || e['RecordID'] || e['ID'] || '').trim();
      const subId = String(e.submissionId || e['Submission ID'] || e['SubmissionID'] || '').trim();
      return (eId && eId === cleanId) || (subId && subId === cleanId);
    });
  } catch (err) {
    console.warn('[Validation] Could not fetch entries to verify status, falling back to payload check:', err);
  }

  // Fallback to record info sent in payload if not found in fetched list
  if (!currentRecord && clientPayload?.entry) {
    currentRecord = clientPayload.entry;
  }

  const status = String(currentRecord?.status || currentRecord?.Status || clientPayload?.status || '').trim();
  const meterNo = String(currentRecord?.meterNo || currentRecord?.['Meter No'] || clientPayload?.meterNo || '').trim();
  const sealNo = String(currentRecord?.sealNo || currentRecord?.['Seal No'] || clientPayload?.sealNo || '').trim();
  const applicationNo = String(currentRecord?.applicationNo || currentRecord?.['Application No'] || clientPayload?.applicationNo || '').trim();

  // Determine if this is a critical production record
  const isApproved = status.toLowerCase() === 'approved';
  const isCompleted = status.toLowerCase() === 'completed';
  const hasInstalledHardware = Boolean(meterNo && sealNo);
  const isCritical = isApproved || isCompleted || hasInstalledHardware;

  if (isCritical) {
    const confirmCritical = Boolean(clientPayload?.confirmCritical === true || clientPayload?.confirmCritical === 'true');
    const reason = String(clientPayload?.reason || clientPayload?.deletionReason || '').trim();

    if (!confirmCritical) {
      return {
        allowed: false,
        isCritical: true,
        record: currentRecord,
        error: `CRITICAL_RECORD_PROTECTION: Entry #${cleanId} is an official production record with status "${status || 'Completed'}". Deletion is blocked to prevent accidental data loss. Mandatory administrative override confirmation and deletion reason required.`
      };
    }

    if (reason.length < 3) {
      return {
        allowed: false,
        isCritical: true,
        record: currentRecord,
        error: `MANDATORY_REASON_REQUIRED: A specific reason (at least 3 characters) must be documented for deleting critical production record #${cleanId}.`
      };
    }
  }

  return { allowed: true, isCritical, record: currentRecord };
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
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to submit entry to Google Sheets' });
  }
});

app.delete('/api/entries/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const id = req.params.id;
    const clientPayload = { ...req.query, ...req.body };
    const validation = await validateEntryDeletion(id, clientPayload);
    if (!validation.allowed) {
      return res.status(403).json({
        success: false,
        isCritical: validation.isCritical,
        error: validation.error
      });
    }

    const payload = {
      id,
      category: clientPayload.category,
      submissionId: clientPayload.submissionId,
      confirmCritical: clientPayload.confirmCritical,
      reason: clientPayload.reason
    };
    const result = await callGoogleAppsScript('deleteEntry', payload, 'POST');
    gasCache.clear();
    return res.json({
      success: true,
      message: `Record #${id} successfully deleted from production`,
      result
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete entry' });
  }
});

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

function computeLocalStats(tasks: any[], workerId?: string, workerName?: string) {
  const totalTasks = tasks.length;
  let completedTasks = 0;
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

  for (const t of tasks) {
    const st = String(t.taskStatus || t.status || 'PENDING').toUpperCase();
    if (st === 'COMPLETED' || st === 'DISCONNECT') completedTasks++;
    else if (st === 'PENDING') pendingTasks++;
    else if (st === 'PAID') paidTasks++;
    else if (st === 'NOT FOUND') notFoundTasks++;
    else if (st === 'DISPUTE') disputeTasks++;
    else if (st === 'OFFICE TEAM') officeTeamTasks++;
    else if (st === 'REISSUE') reissueTasks++;
    else if (st === 'IN PROGRESS') inProgressTasks++;
    else if (st === 'UNABLE') unableTasks++;
    else if (st === 'REPORTED') reportedTasks++;
    else if (st === 'CANCELLED') cancelledTasks++;

    if (String(t.priority || '').toUpperCase() === 'URGENT') urgentTasks++;

    const aId = String(t.assignedWorkerId || '').toLowerCase().trim();
    const aNm = String(t.assignedWorkerName || '').toLowerCase().trim();
    const isMine = (wId && aId === wId) || (wNm && aNm === wNm);

    if (isMine) {
      myAssignedTasks++;
      if (st === 'COMPLETED' || st === 'DISCONNECT' || st === 'PAID') myCompletedTasks++;
      else if (st === 'PENDING' || st === 'IN PROGRESS') myPendingTasks++;
    }
  }

  const completionPercentage = totalTasks > 0 ? Math.round(((completedTasks + paidTasks) / totalTasks) * 100) : 0;
  const myCompletionPercentage = myAssignedTasks > 0 ? Math.round((myCompletedTasks / myAssignedTasks) * 100) : 0;

  return {
    totalTasks,
    completedTasks,
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
    myCompletionPercentage
  };
}

app.get('/api/disconnection-tasks', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const query = req.query;
  const role = String(query.role || '').toLowerCase();
  const workerId = String(query.workerId || '').toLowerCase().trim();
  const workerName = String(query.workerName || '').toLowerCase().trim();

  try {
    const result = await callGoogleAppsScript('getDisconnectionTasks', query, 'GET');
    if (result && Array.isArray(result.tasks)) {
      for (const t of result.tasks) {
        if (t.taskId) localDisconnectionTasks.set(t.taskId, t);
      }
      return res.json({
        success: true,
        tasks: result.tasks,
        stats: result.stats || computeLocalStats(result.tasks, workerId, workerName)
      });
    }
  } catch (err: any) {
    console.warn('[Disconnection] GAS fetch failed, using memory fallback:', err.message);
  }

  // Fallback to local map if GAS has not updated yet
  let tasks = Array.from(localDisconnectionTasks.values());
  const includeArchived = query.includeArchived === 'true';
  if (!includeArchived) {
    tasks = tasks.filter(t => !t.archivedAt && t.taskStatus !== 'ARCHIVED');
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
      const hay = `${t.taskId} ${t.consumerId} ${t.consumerName} ${t.accountNumber} ${t.meterNumber} ${t.consumerAddress} ${t.phoneNumber} ${t.area} ${t.disconnectionReason} ${t.assignedWorkerName}`.toLowerCase();
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

  // Store locally immediately with deduplication by consumerId, accountNumber, or taskId
  const processed: any[] = [];
  let insertedCount = 0;
  let updatedCount = 0;

  for (let i = 0; i < tasksArray.length; i++) {
    const raw = tasksArray[i];
    const cId = String(raw.consumerId || raw['Consumer ID'] || '').trim().toLowerCase();
    const aNo = String(raw.accountNumber || raw['Account Number'] || '').trim().toLowerCase();
    const tId = String(raw.taskId || raw['Task ID'] || '').trim().toLowerCase();

    let existingKey: string | null = null;
    for (const [key, t] of localDisconnectionTasks.entries()) {
      const matchCId = cId && String(t.consumerId || '').trim().toLowerCase() === cId;
      const matchANo = aNo && String(t.accountNumber || '').trim().toLowerCase() === aNo;
      const matchTId = tId && String(t.taskId || '').trim().toLowerCase() === tId;
      if (matchCId || matchANo || matchTId) {
        existingKey = key;
        break;
      }
    }

    if (existingKey) {
      const prev = localDisconnectionTasks.get(existingKey)!;
      const updated = {
        ...prev,
        ...raw,
        taskId: prev.taskId,
        updatedAt: new Date().toISOString()
      };
      localDisconnectionTasks.set(existingKey, updated);
      processed.push(updated);
      updatedCount++;
    } else {
      const taskId = String(raw.taskId || `TASK-DISC-${Date.now()}-${i + 1}`).trim();
      const taskObj = {
        ...raw,
        taskId,
        taskStatus: raw.taskStatus || 'PENDING',
        priority: raw.priority || 'NORMAL',
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

  try {
    const result = await callGoogleAppsScript('uploadDisconnectionTasks', { tasks: tasksArray, adminInfo }, 'POST');
    return res.json(result);
  } catch (err: any) {
    console.warn('[Disconnection] GAS upload proxy error, stored locally:', err.message);
    return res.json({
      success: true,
      count: processed.length,
      insertedCount,
      updatedCount,
      message: `Processed ${processed.length} disconnection tasks (${insertedCount} new, ${updatedCount} updated)`,
      tasks: processed
    });
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
    const prevStatus = t.taskStatus || 'PENDING';
    t.taskStatus = newStatus;
    t.workerReport = report.workerReport || '';
    t.workerRemarks = report.workerRemarks || '';
    t.reportDate = report.reportDate || new Date().toLocaleDateString('en-GB');
    t.reportTime = report.reportTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    t.submittedBy = report.submittedBy || report.workerName || report.workerId || '';
    t.photoUrl = report.photoUrl || t.photoUrl || '';
    if (report.paidAmount) t.paidAmount = report.paidAmount;
    if (report.paymentDate) t.paymentDate = report.paymentDate;
    if (report.paymentReference) t.paymentReference = report.paymentReference;
    if (report.meterReading) t.meterReading = report.meterReading;
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

  try {
    const gasRes = await callGoogleAppsScript('submitDisconnectionReport', report, 'POST');
    if (gasRes && gasRes.success) {
      finalResult = gasRes;
    }
  } catch (err: any) {
    console.warn('[Disconnection] GAS report error, local update persisted:', err.message);
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
