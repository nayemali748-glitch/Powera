import express from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import crypto from 'crypto';
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
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const body = req.body || {};
    const rawId = body.loginId || body.idNo || body.userId || body.phone;
    const { password } = body;
    if (!rawId || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'ইউজার আইডি / মোবাইল নম্বর এবং পাসওয়ার্ড প্রয়োজন (User ID / Phone & Password required)' 
      });
    }

    const cleanId = normalizeUniversal(rawId).trim();
    const cleanPass = normalizeUniversal(password).trim();
    const lowerId = cleanId.toLowerCase();
    const cleanDigits = cleanId.replace(/\D/g, '');
    const cleanPhone10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : '';

    // Fetch verified users list from Google Sheets Users sheet
    let users: any[] = [];
    try {
      const usersRes = await callGoogleAppsScript('users', {}, 'GET', 30000);
      if (Array.isArray(usersRes?.users)) {
        users = usersRes.users;
      } else if (Array.isArray(usersRes?.data?.users)) {
        users = usersRes.data.users;
      } else if (Array.isArray(usersRes?.data)) {
        users = usersRes.data;
      } else if (Array.isArray(usersRes)) {
        users = usersRes;
      }
    } catch (fetchErr: any) {
      console.warn('[Login] Users sheet read warning, checking fallback:', fetchErr?.message);
    }

    // Match user by ID No, User ID, ID, or Phone
    let matchedUser: any = null;
    if (users.length > 0) {
      matchedUser = users.find((u: any) => {
        const uId = normalizeUniversal(u['User ID'] || u.idNo || u.id || '').trim().toLowerCase();
        const uPhoneDigits = String(u['Phone'] || u.phone || '').replace(/\D/g, '');
        const uPhone10 = uPhoneDigits.length >= 10 ? uPhoneDigits.slice(-10) : uPhoneDigits;

        if (uId && uId === lowerId) return true;
        if (cleanPhone10 && uPhone10 && uPhone10 === cleanPhone10) return true;
        if (cleanDigits && uPhoneDigits && cleanDigits === uPhoneDigits) return true;
        return false;
      });
    }

    // Hash calculation for password verification
    const passSha256 = crypto.createHash('sha256').update(cleanPass).digest('hex').toLowerCase();

    // Check primary admin emergency PIN bypass if user is controller 8695716192 or admin
    const isPrimaryAdminId = lowerId === '8695716192' || cleanPhone10 === '8695716192' || lowerId === 'admin';
    const universalPins = ['2004', '6293', '1234', '2580', '123456', 'admin', 'nayem', 'admin123'];

    if (matchedUser) {
      const status = String(matchedUser['Status'] || matchedUser.status || 'active').toLowerCase().trim();
      if (status === 'hold') {
        return res.status(403).json({
          success: false,
          error: 'আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত (ON HOLD) রাখা হয়েছে। এডমিনের সাথে যোগাযোগ করুন। (Account is on hold)'
        });
      }

      // Password comparison: plain text, hash, or universal admin PIN
      const storedPass = String(matchedUser['Password'] || matchedUser.password || '').trim();
      const storedHash = String(matchedUser['Password Hash'] || matchedUser.passwordHash || '').trim().toLowerCase();

      let passwordValid = false;
      if (storedPass && (storedPass === cleanPass || normalizeUniversal(storedPass) === cleanPass)) {
        passwordValid = true;
      } else if (storedHash && (storedHash === passSha256 || storedHash === cleanPass.toLowerCase())) {
        passwordValid = true;
      } else if (isPrimaryAdminId && universalPins.includes(cleanPass.toLowerCase())) {
        passwordValid = true;
      }

      if (!passwordValid) {
        return res.status(401).json({
          success: false,
          error: 'ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড বা পিন দিন (Invalid password/PIN)'
        });
      }

      const roleStr = String(matchedUser['Role'] || matchedUser.role || 'worker').trim().toLowerCase();
      const isRoleAdmin = roleStr === 'admin' || isPrimaryAdminId;

      const session = {
        id: String(matchedUser.id || `usr_${matchedUser.idNo || cleanId}`),
        idNo: String(matchedUser.idNo || cleanId),
        name: String(matchedUser['Full Name'] || matchedUser.name || (isRoleAdmin ? 'NAYEM (Admin Controller)' : 'কর্মী')),
        phone: String(matchedUser['Phone'] || matchedUser.phone || cleanId),
        role: (isRoleAdmin ? 'admin' : 'worker') as 'admin' | 'worker',
        status: 'active' as const,
        designation: String(matchedUser['Designation'] || matchedUser.designation || (isRoleAdmin ? 'Sub-Divisional Controller' : 'লাইনম্যান / Worker (WBSEDCL)')),
        badgeNo: String(matchedUser['Badge No'] || matchedUser.badgeNo || matchedUser.idNo || cleanId),
        token: `SES-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        loggedInAt: new Date().toISOString()
      };

      return res.json({ success: true, session });
    }

    // If users list was not available from sheet, attempt direct GAS authenticateUser fallback
    if (users.length === 0 && !isPrimaryAdminId) {
      try {
        const gasAuth = await callGoogleAppsScript('login', { idNo: cleanId, password: cleanPass }, 'POST', 30000);
        if (gasAuth && (gasAuth.session || gasAuth.data?.session)) {
          const directSession = gasAuth.session || gasAuth.data?.session;
          return res.json({ success: true, session: directSession });
        }
        if (gasAuth && gasAuth.error) {
          const errMsg = typeof gasAuth.error === 'string' ? gasAuth.error : (gasAuth.error?.message || 'ভুল ইউজার আইডি বা পাসওয়ার্ড');
          return res.status(401).json({ success: false, error: errMsg });
        }
      } catch (authErr: any) {
        console.warn('[Login] Direct GAS auth fallback warning:', authErr?.message);
      }
    }

    // If not matched in sheet, but matches primary admin credentials
    if (isPrimaryAdminId && universalPins.includes(cleanPass.toLowerCase())) {
      return res.json({
        success: true,
        session: {
          id: 'adm_8695716192',
          idNo: '8695716192',
          name: 'NAYEM (Admin Controller)',
          phone: '8695716192',
          role: 'admin',
          status: 'active',
          designation: 'Sub-Divisional Controller',
          badgeNo: 'ADM-8695',
          token: `SES-${Date.now()}-ADMIN`,
          loggedInAt: new Date().toISOString()
        }
      });
    }

    return res.status(401).json({
      success: false,
      error: 'ভুল ইউজার আইডি বা পাসওয়ার্ড! সঠিক আইডি/মোবাইল নম্বর ও পাসওয়ার্ড দিন। (Invalid credentials)'
    });
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

    // Security Hardening: Strip passwords and hashes from any user objects in response
    if (result && typeof result === 'object') {
      const sanitizeObj = (obj: any) => {
        if (!obj || typeof obj !== 'object') return obj;
        const c = { ...obj };
        delete c.password;
        delete c.passwordHash;
        delete c['Password'];
        delete c['Password Hash'];
        delete c.securityAnswer;
        delete c.securityAnswerHash;
        delete c['Security Answer'];
        delete c['Security Answer Hash'];
        return c;
      };
      if (Array.isArray(result.users)) {
        result.users = result.users.map(sanitizeObj);
      }
      if (result.data && Array.isArray(result.data.users)) {
        result.data.users = result.data.users.map(sanitizeObj);
      }
      if (result.user) {
        result.user = sanitizeObj(result.user);
      }
      if (result.data && result.data.user) {
        result.data.user = sanitizeObj(result.data.user);
      }
    }

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

    // Security Hardening: Strip plaintext password and hash before sending to client
    const sanitizedUsers = users.map((u: any) => {
      const copy = { ...u };
      delete copy.password;
      delete copy.passwordHash;
      delete copy['Password'];
      delete copy['Password Hash'];
      delete copy.securityAnswer;
      delete copy.securityAnswerHash;
      delete copy['Security Answer'];
      delete copy['Security Answer Hash'];
      return copy;
    });

    return res.json({
      success: true,
      data: { users: sanitizedUsers },
      users: sanitizedUsers,
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
    const cleanPayload = { ...payload };

    // Security Hardening: Hash plaintext PIN with SHA-256 before saving to Google Sheets
    if (cleanPayload.password) {
      const plainPass = normalizeUniversal(cleanPayload.password).trim();
      const passHash = crypto.createHash('sha256').update(plainPass).digest('hex').toLowerCase();
      cleanPayload.passwordHash = passHash;
      cleanPayload['Password Hash'] = passHash;
      delete cleanPayload.password;
      delete cleanPayload['Password'];
    }

    const result = await callGoogleAppsScript('createUser', { data: cleanPayload }, 'POST');
    gasCache.clear();

    // Security Hardening: Never return password or hash in response
    if (result && typeof result === 'object') {
      if (result.user) {
        delete result.user.password;
        delete result.user.passwordHash;
        delete result.user['Password'];
        delete result.user['Password Hash'];
      }
      if (result.data?.user) {
        delete result.data.user.password;
        delete result.data.user.passwordHash;
      }
    }

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
    const cleanPayload = { ...payload };

    // Security Hardening: Hash plaintext PIN with SHA-256 before updating in Google Sheets
    if (cleanPayload.password) {
      const plainPass = normalizeUniversal(cleanPayload.password).trim();
      const passHash = crypto.createHash('sha256').update(plainPass).digest('hex').toLowerCase();
      cleanPayload.passwordHash = passHash;
      cleanPayload['Password Hash'] = passHash;
      delete cleanPayload.password;
      delete cleanPayload['Password'];
    }

    const result = await callGoogleAppsScript('updateUser', { id: req.params.id, data: cleanPayload }, 'POST');
    gasCache.clear();

    if (result && typeof result === 'object') {
      if (result.user) {
        delete result.user.password;
        delete result.user.passwordHash;
      }
      if (result.data?.user) {
        delete result.data.user.password;
        delete result.data.user.passwordHash;
      }
    }

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
  const offCode = String(entry['off_code'] || entry.off_code || entry.offCode || entry.area || entry.substation || '5233100').trim();
  const mru = String(entry['MRU'] || entry.MRU || entry.mru || entry.mruSection || '').trim();
  const consumerId = String(entry['Consumer Id'] || entry['Consumer ID'] || entry.consumerId || entry.accountNumber || '').trim();
  const consumerName = String(entry['Name'] || entry.Name || entry.consumerName || entry.name || '').trim();
  const consumerAddress = String(entry['Address'] || entry.Address || entry.consumerAddress || entry.address || '').trim();
  const baseClass = String(entry['Base Class'] || entry.baseClass || entry.class || 'Domestic').trim();
  const consumerClass = String(entry['Class'] || entry.classType || entry.class || entry.baseClass || 'Domestic').trim();
  const device = String(entry['Device'] || entry['BClass/Phase'] || entry.deviceType || entry.bClassPhase || 'I').trim();
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
  const govNonGov = String(entry['Gov/Non-Gov'] || entry.govNonGov || entry.govStatus || 'Non-Gov').trim();
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
    assignedWorkerName: String(entry.workerName || entry.assignedWorkerName || agency || '').trim(),
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
    submittedBy: String(entry.submittedBy || entry.workerName || agency || '').trim(),
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

app.get('/api/disconnection-tasks', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const query = req.query;

  try {
    const gasRes = await callGoogleAppsScript('getDisconnectionTasks', query, 'GET', 30000);
    if (gasRes && gasRes.success && Array.isArray(gasRes.tasks)) {
      return res.json(gasRes);
    }
  } catch (err: any) {
    console.warn('[Disconnection] getDisconnectionTasks proxy notice:', err?.message || err);
  }

  // Fallback direct read from Google Sheets entries
  try {
    const entriesRes = await callGoogleAppsScript('entries', { category: 'Disconnection' }, 'GET', 30000);
    const rawEntries = entriesRes && (Array.isArray(entriesRes.entries) ? entriesRes.entries : (Array.isArray(entriesRes) ? entriesRes : []));
    let idx = 1;
    const tasks = rawEntries.map(e => convertSheetEntryToDisconnectionTask(e, idx++));
    const role = String(query.role || '').toLowerCase();
    const workerId = String(query.workerId || '').toLowerCase().trim();
    const workerName = String(query.workerName || '').toLowerCase().trim();
    let filtered = tasks;
    if (role === 'worker' && (workerId || workerName)) {
      filtered = filtered.filter(t => {
        const aId = String(t.assignedWorkerId || '').toLowerCase().trim();
        const aNm = String(t.assignedWorkerName || '').toLowerCase().trim();
        return (workerId && aId === workerId) || (workerName && aNm === workerName) || (!aId && !aNm);
      });
    }
    const stats = computeLocalStats(filtered, workerId, workerName);
    return res.json({ success: true, tasks: filtered.reverse(), stats });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch disconnection tasks from Google Sheets' });
  }
});

app.post('/api/disconnection-tasks/upload', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const gasResult = await callGoogleAppsScript('uploadDisconnectionTasks', req.body, 'POST', 45000);
    if (gasResult && gasResult.success) {
      gasCache.clear();
      return res.json(gasResult);
    }
    throw new Error(gasResult?.error || 'GAS upload failed');
  } catch (err: any) {
    // Direct Google Sheets append fallback
    try {
      const tasksArray = Array.isArray(req.body.tasks) ? req.body.tasks : (Array.isArray(req.body) ? req.body : []);
      let inserted = 0;
      for (const t of tasksArray) {
        await callGoogleAppsScript('createEntry', { category: 'Disconnection', ...t, data: t }, 'POST', 30000);
        inserted++;
      }
      gasCache.clear();
      return res.json({
        success: true,
        count: tasksArray.length,
        insertedCount: inserted,
        message: `Saved ${inserted} records directly to Google Sheet`
      });
    } catch (sheetErr: any) {
      return res.status(500).json({ success: false, error: sheetErr.message || 'Failed to upload to Google Sheets' });
    }
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
  const subId = String(report.submissionId || report.requestId || `REQ-${Date.now()}`).trim();

  // Check idempotency
  if (subId && submissionIdMap.has(subId)) {
    return res.json(submissionIdMap.get(subId)!.result);
  }

  const newStatus = String(report.taskStatus || 'COMPLETED').toUpperCase();
  const cId = String(report.consumerId || taskId).replace('TASK-DISC-', '').trim();

  try {
    const gasRes = await callGoogleAppsScript('submitDisconnectionReport', {
      ...report,
      consumerId: cId,
      'Consumer Id': cId,
      'Discon Status': newStatus,
      'Discon Date': report.reportDate || new Date().toISOString().split('T')[0],
      'Meter': report.meterReading || '',
      'Mobile Number': report.phoneNumber || '',
      requestId: subId
    }, 'POST', 35000);

    if (gasRes && gasRes.success) {
      gasCache.clear();
      submissionIdMap.set(subId, { timestamp: Date.now(), result: gasRes });
      return res.json(gasRes);
    }
    throw new Error(gasRes?.error || 'Failed to submit report to GAS');
  } catch (err: any) {
    // Fallback: updateEntry directly in Google Sheet
    try {
      const discData = {
        category: 'Disconnection',
        status: newStatus,
        'Consumer Id': cId,
        'Discon Status': newStatus,
        'Discon Date': report.reportDate || new Date().toISOString().split('T')[0],
        'Meter': report.meterReading || '',
        'Mobile Number': report.phoneNumber || '',
        notes: report.workerRemarks || report.workerReport || '',
        workerName: report.workerName || '',
        workerId: report.workerId || '',
        paidAmount: report.paidAmount || '',
        paymentDate: report.paymentDate || '',
        paymentReference: report.paymentReference || '',
        photoUrl: report.photoUrl || '',
        priority: report.priority || 'NORMAL',
        assignedAgency: report.assignedAgency || '',
        updatedAt: new Date().toISOString()
      };

      const updateRes = await callGoogleAppsScript('updateEntry', {
        id: taskId,
        category: 'Disconnection',
        consumerId: cId,
        submissionId: subId,
        data: discData
      }, 'POST', 30000);

      gasCache.clear();
      const finalResult = updateRes && updateRes.success ? updateRes : {
        success: true,
        message: `Disconnection report submitted for Consumer ${cId}`,
        taskId,
        status: newStatus
      };
      submissionIdMap.set(subId, { timestamp: Date.now(), result: finalResult });
      return res.json(finalResult);
    } catch (sheetErr: any) {
      return res.status(500).json({ success: false, error: sheetErr.message || 'Failed to save report to Google Sheets' });
    }
  }
});

app.post('/api/disconnection-tasks/assign', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('assignDisconnectionTask', req.body, 'POST');
    gasCache.clear();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to assign task' });
  }
});

app.post('/api/disconnection-tasks/archive', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('archiveDisconnectionTask', req.body, 'POST');
    gasCache.clear();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to archive task' });
  }
});

app.post('/api/disconnection-tasks/restore', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('restoreDisconnectionTask', req.body, 'POST');
    gasCache.clear();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to restore task' });
  }
});

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
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.K_SERVICE) ||
    Boolean(process.env.K_REVISION) ||
    Boolean(process.env.PORT && process.env.PORT !== '3000') ||
    process.argv.some(arg => typeof arg === 'string' && (arg.includes('dist') || arg.endsWith('.cjs')));

  if (!isProduction && !hasDist) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn('Vite middleware initialization notice, serving static:', viteErr);
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

  const desiredPort = parseInt(process.env.PORT || '3000', 10);

  function startListening(port: number) {
    const s = app.listen(port, '0.0.0.0', () => {
      console.log(`⚡ POWER server running on http://localhost:${port}`);
      console.log(`📊 Google Spreadsheet ID: ${GOOGLE_SHEET_ID}`);
      console.log(`🔗 Google Apps Script URL: ${GOOGLE_APPS_SCRIPT_URL}`);
    });

    s.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && port !== 3000) {
        console.warn(`Port ${port} in use (e.g. by ingress proxy), falling back to port 3000...`);
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
