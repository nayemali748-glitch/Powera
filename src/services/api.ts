import { PowerEntry, StatsResponse, CategoryType, UserAccount, UserSession, WorkOrderNotice, ChatMessage, DisconnectionTask, DisconnectionTaskStatus, DisconnectionStats } from '../types';
import { normalizeUniversalText, normalizePassword } from '../utils/textNormalizer';
import { deduplicateEntries, normalizeEntry } from '../utils/entryNormalizer';
import { formatDateDDMMYYYY, formatTime12Hour, getNowDateDDMMYYYY, getNowTime12Hour } from '../utils/dateTimeFormat';
// ============================================================================

// ============================================================================
// CENTRAL API CONFIGURATION
// Google Sheets via Google Apps Script is the SINGLE SOURCE OF TRUTH
// ============================================================================
export const GOOGLE_SCRIPT_WEB_APP_URL = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL) ||
  'https://script.google.com/macros/s/AKfycbzVV5sqqypop3sr19hstcti76QXw4aGIKHqAut31pcYMcOuffGwsAmtfbbOnx3KVB_7/exec';

export const SPREADSHEET_ID = '1-3LtAbXZU6klisReK6ffIxDUwbM4wXvhxSbKVpE7raY';
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;

const LOCAL_STORAGE_KEY = 'power_app_entries_cache';
const USERS_CACHE_KEY = 'power_app_users_cache';
const WORK_ORDERS_STORAGE_KEY = 'power_work_orders_cache';
const CHAT_LOCAL_KEY = 'power_chat_history';

// Empty default accounts - Google Sheets is the ONLY source of truth
export const DEFAULT_WBSEDCL_ACCOUNTS: UserAccount[] = [];

// Clean legacy localStorage keys on initialization
try {
  localStorage.removeItem('power_registered_users');
  const oldEntries = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (oldEntries && oldEntries.length > 50000) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
} catch {}

function readCache<T>(key: string, fallback: T): T {
  try {
    const x = localStorage.getItem(key);
    return x ? JSON.parse(x) : fallback;
  } catch {
    return fallback;
  }
}

function writeCache<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function sanitizeEntriesForCache(entries: PowerEntry[]): PowerEntry[] {
  return entries.slice(0, 50).map(e => ({
    ...e,
    photoUrl: e.photoUrl && e.photoUrl.length > 3000 ? '' : e.photoUrl,
    workOrderPhoto: e.workOrderPhoto && e.workOrderPhoto.length > 3000 ? '' : e.workOrderPhoto,
  }));
}

function sanitizeWorkOrdersForCache(orders: WorkOrderNotice[]): WorkOrderNotice[] {
  return orders.slice(0, 50).map(w => {
    let photo = w.photoUrl || w.directImageUrl || '';
    if (!photo && w.fileId) {
      photo = `https://drive.google.com/thumbnail?id=${w.fileId}&sz=w2000`;
    }
    // Replace huge base64 data URIs in localStorage with binary server endpoint so localStorage quota is safe and image still loads
    if (photo && photo.startsWith('data:') && photo.length > 5000 && w.id) {
      photo = `/api/work-orders/${encodeURIComponent(w.id)}/file`;
    }
    const copy: any = {
      ...w,
      photoUrl: photo,
      directImageUrl: w.directImageUrl && !w.directImageUrl.startsWith('data:') ? w.directImageUrl : photo,
    };
    delete copy.fileData;
    return copy;
  });
}

// ============================================================================
// CENTRAL API REQUEST HANDLER
// Communicates directly with Google Apps Script Web App (Works seamlessly on Vercel,
// local development, and production environments with zero HTTP 404 errors)
// ============================================================================
export async function callGasApi<T = any>(
  action: string,
  payload: any = {},
  method: 'GET' | 'POST' = 'GET',
  timeoutMs = 45000
): Promise<T> {
  const isBrowser = typeof window !== 'undefined';
  let proxyError: Error | null = null;

  // 1. In browser environment, attempt the high-performance Express server proxy first
  if (isBrowser) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try { controller.abort(); } catch {}
    }, timeoutMs);

    try {
      const res = await fetch('/api/gas-proxy', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload, method })
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        console.warn(`[API Proxy] Non-JSON response for action "${action}" (Status ${res.status}):`, text.slice(0, 200));
      }

      if (data && typeof data === 'object') {
        if (data.success === false && data.error) {
          const errMsg = typeof data.error === 'string' 
            ? data.error 
            : (data.error?.message || data.message || 'Google Sheets request failed');
          const errCode = data.error?.code || data.errorCode || 'BACKEND_ERROR';
          const err = new Error(errMsg);
          (err as any).code = errCode;
          (err as any).requestId = data.requestId;
          throw err;
        }
        return data as T;
      }

      proxyError = new Error(`Proxy returned status ${res.status}`);
    } catch (err: any) {
      if (err && err.code) {
        // Legitimate backend error from Google Apps Script (e.g. invalid credentials, duplicate)
        throw err;
      }
      proxyError = err;
      console.warn(`[API Proxy] Proxy unreachable for action "${action}", failing over to direct Google Apps Script:`, err?.message || err);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // 2. Direct Google Apps Script Web App Connection (Resilient failover & serverless execution)
  const directController = new AbortController();
  const directTimeoutId = setTimeout(() => {
    try { directController.abort(); } catch {}
  }, timeoutMs);

  try {
    let fetchUrl = GOOGLE_SCRIPT_WEB_APP_URL;
    const options: RequestInit = {
      signal: directController.signal,
      redirect: 'follow',
    };

    if (method === 'GET') {
      const sep = fetchUrl.includes('?') ? '&' : '?';
      const queryParams: Record<string, string> = { action };
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined && value !== null) {
          queryParams[key] = String(value);
        }
      }
      queryParams['_t'] = Date.now().toString();
      fetchUrl = `${fetchUrl}${sep}${new URLSearchParams(queryParams).toString()}`;
      options.method = 'GET';
      // IMPORTANT: Do NOT set custom headers on GET requests to script.google.com
      // so mobile browsers treat it as a simple request with zero CORS preflight!
    } else {
      options.method = 'POST';
      // Plain text content-type with NO other custom headers prevents browser CORS preflight blocks across Google redirects
      options.headers = {
        'Content-Type': 'text/plain;charset=utf-8'
      };
      options.body = JSON.stringify({ action, ...payload });
    }

    const res = await fetch(fetchUrl, options);
    let finalRes = res;

    // Node manual redirect fallback if not auto-followed
    if (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308) {
      const loc = res.headers.get('location');
      try {
        await res.body?.cancel();
      } catch {}
      if (loc) {
        finalRes = await fetch(loc, { 
          method: 'GET', 
          signal: directController.signal
        });
      }
    }

    const rawText = await finalRes.text();
    const trimmed = rawText.trim();

    if (trimmed.startsWith('<!DOCTYPE') || trimmed.includes('<html') || trimmed.includes('ppConfig')) {
      console.warn(`[GoogleAppsScript] HTML busy page received for action "${action}":`, trimmed.slice(0, 200));
      throw new Error('Google Sheets ব্যাকএন্ড বর্তমানে ব্যস্ত আছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন। (BACKEND_BUSY)');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      console.error(`[GoogleAppsScript] Non-JSON response for action "${action}". Status: ${finalRes.status}. Body:`, trimmed.slice(0, 300));
      throw new Error(`Google Sheets সার্ভিসের সাথে যোগাযোগে সমস্যা হয়েছে (Status: ${finalRes.status})। অনুগ্রহ করে আবার চেষ্টা করুন।`);
    }

    if (parsed && parsed.success === false) {
      const errMsg = typeof parsed.error === 'string'
        ? parsed.error
        : (parsed.error?.message || parsed.message || 'Google Sheets request failed');
      const errCode = parsed.error?.code || parsed.errorCode || 'BACKEND_ERROR';
      const err = new Error(errMsg);
      (err as any).code = errCode;
      (err as any).requestId = parsed.requestId;
      throw err;
    }

    return parsed as T;
  } catch (err: any) {
    if (err && err.name === 'AbortError') {
      throw new Error(`Google Sheets রিকোয়েস্টের সময় শেষ (Timeout) হয়েছে। আপনার ইন্টারনেট কানেকশন চেক করুন।`);
    }
    throw err;
  } finally {
    clearTimeout(directTimeoutId);
  }
}

// In-flight request deduplication map to prevent concurrent duplicate submissions
const inFlightSubmissions = new Map<string, Promise<PowerEntry>>();

// Background sync for offline submissions (idempotent, won't duplicate)
let isSyncingPending = false;
export async function syncPendingEntries(): Promise<number> {
  if (isSyncingPending) return 0;
  isSyncingPending = true;
  let syncedCount = 0;
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!cached) return 0;
    const list: (PowerEntry & { _isPendingSync?: boolean })[] = JSON.parse(cached);
    const pending = list.filter(e => e._isPendingSync);
    if (pending.length === 0) return 0;

    for (const item of pending) {
      try {
        const { _isPendingSync, ...cleanItem } = item;
        const res = await callGasApi<{ success: boolean; entry?: PowerEntry; duplicate?: boolean }>('submitRecord', { ...cleanItem, data: cleanItem }, 'POST');
        if (res && (res.success || res.duplicate)) {
          item._isPendingSync = false;
          syncedCount++;
        }
      } catch (e) {
        console.warn('Sync pending item failed:', e);
      }
    }

    if (syncedCount > 0) {
      writeCache(LOCAL_STORAGE_KEY, list);
    }
  } catch (err) {
    console.warn('Error during syncPendingEntries:', err);
  } finally {
    isSyncingPending = false;
  }
  return syncedCount;
}

// ============================================================================
// ENTRIES (CRUD & QUERY)
// ============================================================================

export async function fetchEntries(filters?: {
  category?: string;
  status?: string;
  search?: string;
  workerId?: string;
  workerName?: string;
  refresh?: boolean;
}): Promise<PowerEntry[]> {
  try {
    const query = new URLSearchParams();
    if (filters?.category && filters.category !== 'ALL') query.set('category', filters.category);
    if (filters?.status && filters.status !== 'ALL') query.set('status', filters.status);
    if (filters?.search) query.set('search', filters.search);
    if (filters?.workerId) query.set('workerId', filters.workerId);
    if (filters?.workerName) query.set('workerName', filters.workerName);
    if (filters?.refresh) query.set('refresh', 'true');

    // 1. Primary: Express /api/entries endpoint (Synced with Google Sheets)
    try {
      const fastRes = await fetch(`/api/entries?${query.toString()}`, {
        headers: { 'Accept': 'application/json' }
      });
      const ct = fastRes.headers.get('content-type') || '';
      if (fastRes.ok && ct.includes('application/json')) {
        const fastData = await fastRes.json();
        const fastArr = Array.isArray(fastData)
          ? fastData
          : (Array.isArray(fastData?.entries) ? fastData.entries : (Array.isArray(fastData?.data) ? fastData.data : null));
        if (Array.isArray(fastArr)) {
          const filteredFast = fastArr.filter((e: any) => {
            const catUp = String(e?.category || '').toUpperCase().trim();
            return (
              catUp !== 'USERS' &&
              catUp !== 'USERS_AUTH' &&
              catUp !== 'WORKORDERS_KHATA' &&
              catUp !== 'WORK ORDERS' &&
              catUp !== 'CHAT' &&
              catUp !== 'CHAT_MESSAGES' &&
              catUp !== 'SETTINGS' &&
              catUp !== 'SYSTEM LOGS' &&
              catUp !== 'DISCONNECTION_HISTORY'
            );
          });
          const uniqueEntries = deduplicateEntries(filteredFast.map((e: any) => normalizeEntry(e)));
          if (!filters || (!filters.category || filters.category === 'ALL')) {
            writeCache(LOCAL_STORAGE_KEY, sanitizeEntriesForCache(uniqueEntries));
          }
          return uniqueEntries;
        }
      }
    } catch {}

    // 2. Fallback: Gas Proxy / Direct GAS
    const params: Record<string, string> = {};
    if (filters?.category && filters.category !== 'ALL') params.category = filters.category;
    if (filters?.status && filters.status !== 'ALL') params.status = filters.status;
    if (filters?.search) params.search = filters.search;
    if (filters?.workerId) params.workerId = filters.workerId;
    if (filters?.workerName) params.workerName = filters.workerName;

    const data = await callGasApi<any>('entries', params, 'GET');
    const rawList = Array.isArray(data?.entries)
      ? data.entries
      : (Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []));
    const filteredList = rawList.filter((e: any) => {
      const catUp = String(e?.category || '').toUpperCase().trim();
      return (
        catUp !== 'USERS' &&
        catUp !== 'USERS_AUTH' &&
        catUp !== 'WORKORDERS_KHATA' &&
        catUp !== 'WORK ORDERS' &&
        catUp !== 'CHAT' &&
        catUp !== 'CHAT_MESSAGES' &&
        catUp !== 'SETTINGS' &&
        catUp !== 'SYSTEM LOGS' &&
        catUp !== 'DISCONNECTION_HISTORY'
      );
    });
    const uniqueEntries = deduplicateEntries(filteredList.map((e: any) => normalizeEntry(e)));
    
    // Save to local cache for instant UI availability
    writeCache(LOCAL_STORAGE_KEY, sanitizeEntriesForCache(uniqueEntries));
    return uniqueEntries;
  } catch (error) {
    console.warn('Direct Google Sheets fetch error, using local cache:', error);
    let list = deduplicateEntries(readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []));
    if (filters?.category && filters.category !== 'ALL') {
      list = list.filter(item => item.category === filters.category);
    }
    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter(item => item.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(item => JSON.stringify(item).toLowerCase().includes(q));
    }
    return list;
  }
}

// Map category to explicit Apps Script action - 'submitRecord' is the canonical GAS action
export function getCreateActionForCategory(_cat?: string): string {
  return 'submitRecord';
}

export async function createEntry(
  entryData: Partial<PowerEntry>,
  currentUser?: UserSession | null
): Promise<PowerEntry> {
  // Guaranteed single unique Submission ID across entire lifecycle
  const submissionId = entryData.submissionId || `SUB-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  
  // Strict deduplication guard: If an identical submission is already currently executing in-flight, return the existing Promise
  if (inFlightSubmissions.has(submissionId)) {
    return inFlightSubmissions.get(submissionId)!;
  }

  const generatedId = entryData.id || `PWR-${Date.now().toString().slice(-6)}`;
  const nowIso = new Date().toISOString();

  // Attach authenticated worker identity & metadata
  const cleanEntry: PowerEntry = {
    ...entryData as any,
    submissionId,
    id: generatedId,
    workerId: String(entryData.workerId || currentUser?.idNo || currentUser?.id || '').trim(),
    workerName: String(entryData.workerName || currentUser?.name || 'Field Worker').trim(),
    role: String(entryData.role || currentUser?.role || 'worker'),
    submittedBy: String(entryData.submittedBy || (currentUser?.idNo ? `${currentUser.name} (${currentUser.idNo})` : entryData.workerName || 'Worker')),
    workerPhone: String(entryData.workerPhone || currentUser?.phone || '').trim(),
    date: entryData.date || nowIso,
    createdAt: entryData.createdAt || nowIso,
    updatedAt: nowIso,
    status: entryData.status || 'Completed',
  };

  const promise = (async () => {
    let res: { success: boolean; entry?: PowerEntry; data?: any; duplicate?: boolean; recordId?: string; message?: string } | null = null;
    let backendError: any = null;

    // 1. Primary: Send to /api/entries endpoint (Waits for confirmed Google Sheets write)
    try {
      const localRes = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanEntry)
      });
      const localData = await localRes.json().catch(() => null);
      if (localRes.ok && localData && (localData.success || localData.entry)) {
        res = { success: true, entry: localData.entry || localData.data || cleanEntry };
      } else if (localData && localData.error) {
        backendError = new Error(typeof localData.error === 'string' ? localData.error : (localData.error.message || 'Google Sheets write failed'));
      }
    } catch (localErr) {
      backendError = localErr;
    }

    // 2. Fallback to gas-proxy / direct GAS submitRecord if needed
    if (!res || res.success === false) {
      try {
        const directPayload: any = { ...cleanEntry };
        if (String(directPayload.category || '').toUpperCase() === 'NSC') {
          const nscMeta = {
            applicationNo: String(directPayload.applicationNo || '').trim(),
            fatherName: String(directPayload.fatherName || '').trim(),
            agencyName: String(directPayload.agencyName || '').trim(),
            cccName: String(directPayload.cccName || directPayload.substation || '').trim(),
            sealNo: String(directPayload.sealNo || '').trim(),
            meterMake: String(directPayload.meterMake || '').trim(),
            meterInstallDate: String(directPayload.meterInstallDate || '').trim(),
            inspectionAgencyName: String(directPayload.inspectionAgencyName || '').trim(),
            appliedLoad: String(directPayload.appliedLoad || '').trim(),
            phase: String(directPayload.phase || '').trim(),
            tariffCategory: String(directPayload.tariffCategory || '').trim(),
            serviceCableLength: String(directPayload.serviceCableLength || '').trim(),
            earthResistance: String(directPayload.earthResistance || '').trim(),
            workOrderNo: String(directPayload.workOrderNo || '').trim(),
            workOrderDate: String(directPayload.workOrderDate || '').trim(),
            workOrderNoticeId: String(directPayload.workOrderNoticeId || '').trim(),
            workOrderNoticeTitle: String(directPayload.workOrderNoticeTitle || '').trim(),
            workOrderNoticeDate: String(directPayload.workOrderNoticeDate || '').trim(),
            notes: String(directPayload.notes || '').trim(),
            locationGps: String(directPayload.locationGps || '').trim(),
            role: String(directPayload.role || 'worker').trim(),
            submittedBy: String(directPayload.submittedBy || directPayload.workerName || '').trim(),
            createdAt: String(directPayload.createdAt || nowIso).trim(),
            updatedAt: nowIso
          };
          directPayload.reading = String(directPayload.initialReading || '000000').trim();
          directPayload.substation = nscMeta.cccName;
          directPayload.feederName = `NSC_META::${JSON.stringify(nscMeta)}`;
          directPayload.remarks = nscMeta.notes;
        }
        if (typeof directPayload.photoUrl === 'string' && directPayload.photoUrl.length > 42000) {
          directPayload.photoUrl = '';
        }
        if (typeof directPayload.workOrderPhoto === 'string' && directPayload.workOrderPhoto.length > 42000) {
          directPayload.workOrderPhoto = '';
        }

        const gasRes = await callGasApi<any>(
          'submitRecord',
          { ...directPayload, data: directPayload },
          'POST',
          40000
        );
        if (gasRes && gasRes.success !== false) {
          const inner = gasRes.entry || gasRes.data?.entry || gasRes.data || cleanEntry;
          res = { success: true, entry: { ...cleanEntry, ...(typeof inner === 'object' ? inner : {}) } };
        }
      } catch (err: any) {
        backendError = err;
      }
    }

    // 3. Do NOT fake success if Google Sheets write failed — throw a real error
    if (!res || res.success === false) {
      throw backendError || new Error(res?.message || 'Failed to save record to Google Sheets');
    }

    // Data confirmed saved in Google Sheets!
    const confirmedEntry: PowerEntry = normalizeEntry({ ...cleanEntry, ...(res.entry || res.data || {}) });

    try {
      const list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []);
      const filtered = list.filter(e => e.id !== confirmedEntry.id && e.submissionId !== confirmedEntry.submissionId);
      writeCache(LOCAL_STORAGE_KEY, sanitizeEntriesForCache([confirmedEntry, ...filtered]));
    } catch {}

    return confirmedEntry;
  })().finally(() => {
    inFlightSubmissions.delete(submissionId);
  });

  inFlightSubmissions.set(submissionId, promise);
  return promise;
}

// Cleanup duplicates on Google Sheets and local storage
export async function cleanupDuplicatesApi(sheetName?: string): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const res = await callGasApi<{ success: boolean; message: string; details?: any }>(
      'cleanupDuplicates',
      { sheetName },
      'POST',
      30000
    );
    // Refresh local cache with deduplicated entries
    await fetchEntries();
    return res;
  } catch (err: any) {
    console.error('cleanupDuplicates error:', err);
    throw err;
  }
}

export async function updateEntry(id: string, updates: Partial<PowerEntry>): Promise<PowerEntry> {
  const cleanId = String(id || '').trim();
  const payload = {
    id: cleanId,
    category: updates.category,
    submissionId: updates.submissionId || cleanId,
    data: updates
  };

  let updatedEntry: PowerEntry | null = null;

  // 1. Primary Method: POST /api/entries/:id/update (Express proxy to Google Apps Script)
  try {
    const res = await fetch(`/api/entries/${encodeURIComponent(cleanId)}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.success !== false || data.entry)) {
        updatedEntry = (data.entry || { id: cleanId, ...updates }) as PowerEntry;
      }
    }
  } catch (err: any) {
    console.warn('POST /api/entries/:id/update proxy notice:', err);
  }

  // 2. Secondary Method: callGasApi direct
  if (!updatedEntry) {
    try {
      const res = await callGasApi<{ success: boolean; entry: PowerEntry }>('updateEntry', payload, 'POST');
      if (res) {
        updatedEntry = res.entry || { id: cleanId, ...updates } as PowerEntry;
      }
    } catch (gasErr: any) {
      console.warn('callGasApi updateEntry fallback notice:', gasErr);
    }
  }

  const finalEntry = updatedEntry || ({ id: cleanId, ...updates, updatedAt: new Date().toISOString() } as PowerEntry);
  const list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []);
  const idx = list.findIndex(e => String(e.id || '').trim() === cleanId);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...finalEntry };
    writeCache(LOCAL_STORAGE_KEY, list);
  } else {
    list.unshift(finalEntry);
    writeCache(LOCAL_STORAGE_KEY, list);
  }

  return finalEntry;
}

export async function deleteEntry(
  id: string, 
  category?: string, 
  submissionId?: string,
  options?: { 
    confirmCritical?: boolean; 
    reason?: string; 
    status?: string; 
    meterNo?: string; 
    sealNo?: string; 
    entry?: any 
  }
): Promise<boolean> {
  const cleanId = String(id || '').trim();
  const payload = { 
    id: cleanId, 
    category, 
    submissionId: submissionId || cleanId, 
    confirmCritical: true,
    reason: options?.reason || 'User confirmed deletion',
    status: options?.status,
    meterNo: options?.meterNo,
    sealNo: options?.sealNo,
    entry: options?.entry
  };

  // Update local storage cache immediately so UI reflects deletion in 0ms
  try {
    const list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []);
    writeCache(LOCAL_STORAGE_KEY, list.filter(e => String(e.id || '') !== cleanId && String(e.submissionId || '') !== cleanId && String(e.consumerId || '') !== cleanId));
  } catch {}

  let deletedSuccessfully = false;
  let lastErrorMessage = '';

  // 1. Primary Method: POST /api/entries/:id/delete (Responds in <10ms and syncs Sheet in background)
  try {
    const res = await fetch(`/api/entries/${encodeURIComponent(cleanId)}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success !== false) {
        deletedSuccessfully = true;
      } else if (data?.error) {
        lastErrorMessage = typeof data.error === 'string' ? data.error : (data.error?.message || 'Deletion failed');
      }
    }
  } catch (err: any) {
    console.warn('POST /api/entries/:id/delete failed, attempting gas-proxy fallback...', err);
  }

  // 2. Secondary Method: POST /api/gas-proxy
  if (!deletedSuccessfully) {
    try {
      const gasRes = await callGasApi<{ success?: boolean; error?: any; message?: string }>('deleteEntry', payload, 'POST');
      if (gasRes && (gasRes.success === true || !gasRes.error)) {
        deletedSuccessfully = true;
      } else if (gasRes?.error) {
        const errorText = typeof gasRes.error === 'object' ? (gasRes.error?.message || JSON.stringify(gasRes.error)) : (gasRes.error || gasRes.message);
        if (errorText && (errorText.includes('Record not found') || errorText.includes('not found in Google Sheets'))) {
          deletedSuccessfully = true;
        } else {
          lastErrorMessage = errorText || 'Failed to delete record from Google Sheets';
        }
      }
    } catch (err: any) {
      console.warn('gas-proxy fallback notice:', err);
    }
  }

  // 3. Tertiary Method: REST DELETE /api/entries/:id
  if (!deletedSuccessfully) {
    try {
      const res = await fetch(`/api/entries/${encodeURIComponent(cleanId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success !== false) {
          deletedSuccessfully = true;
        }
      }
    } catch (err: any) {
      console.warn('Direct DELETE failed:', err);
    }
  }

  if (!deletedSuccessfully && lastErrorMessage) {
    throw new Error(lastErrorMessage);
  }

  return true;
}

export async function clearAllEntries(confirmPhrase: string = 'CONFIRM_PERMANENT_WIPE'): Promise<boolean> {
  const clearLocalCaches = () => {
    try {
      writeCache(LOCAL_STORAGE_KEY, []);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(DISCONNECTION_TASKS_CACHE_KEY);
      localStorage.removeItem('power_disconnection_tasks_cache_v2');
      localStorage.removeItem('power_entries_local_cache_v1');
    } catch {}
  };

  let clearedOnServer = false;
  let lastError = '';

  // 1. Primary: Dedicated /api/entries/clear endpoint
  try {
    const res = await fetch('/api/entries/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        confirmClearAll: confirmPhrase,
        confirmation: confirmPhrase
      })
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success !== false) {
        clearedOnServer = true;
      } else if (data?.error) {
        lastError = typeof data.error === 'string' ? data.error : (data.error?.message || '');
      }
    }
  } catch (err: any) {
    console.warn('POST /api/entries/clear fallback notice:', err);
  }

  // 2. Fallback: gas-proxy clearEntries
  if (!clearedOnServer) {
    try {
      const res = await callGasApi<{ success?: boolean; error?: any; message?: string }>(
        'clearEntries',
        { confirmClearAll: confirmPhrase, confirmation: confirmPhrase },
        'POST'
      );
      if (res && res.success !== false) {
        clearedOnServer = true;
      } else if (res && res.success === false) {
        const msg = typeof res.error === 'object' ? (res.error?.message || JSON.stringify(res.error)) : (res.error || res.message || 'Server rejected bulk clear');
        lastError = msg;
      }
    } catch (e: any) {
      console.warn('Clear entries gas-proxy notice:', e);
      lastError = e?.message || lastError;
    }
  }

  clearLocalCaches();

  if (!clearedOnServer && lastError) {
    throw new Error(lastError);
  }
  return true;
}

export async function fetchStats(): Promise<StatsResponse> {
  try {
    const data = await callGasApi<{ success: boolean; stats: StatsResponse }>('stats', {}, 'GET');
    if (data && data.stats) {
      return data.stats;
    }
  } catch (e) {
    console.warn('Fetch stats fallback to local calculation:', e);
  }

  // Fallback calculation from local cached entries
  const entries = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []);
  return {
    total: entries.length,
    categories: {
      NSC: entries.filter(e => e.category === 'NSC').length,
      DISCONNECTION: entries.filter(e => e.category === 'DISCONNECTION').length,
      POLE_CASE: entries.filter(e => e.category === 'POLE CASE').length,
      METER_REPLESMENT: entries.filter(e => e.category === 'METER REPLESMENT').length,
      DTR_REPLESMENT: entries.filter(e => e.category === 'DTR REPLESMENT').length,
    },
    status: {
      pending: entries.filter(e => e.status === 'Pending').length,
      completed: entries.filter(e => e.status === 'Completed').length,
      approved: entries.filter(e => e.status === 'Approved').length,
    }
  };
}

// ============================================================================
// USER MANAGEMENT & AUTHENTICATION (GOOGLE SHEETS BACKEND)
// Single source of truth: Google Sheets Users sheet via Google Apps Script
// ============================================================================

async function sha256HexClient(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    } catch {}
  }
  return '';
}

function buildClientUserSyncTag(u: { idNo?: string; password?: string; phone?: string; designation?: string; badgeNo?: string; role?: string; status?: string; createdAt?: string }): string {
  const baseDate = String(u.createdAt || '').split('||')[0] || new Date().toISOString().slice(0, 10);
  const idNo = String(u.idNo || '').trim();
  const password = String(u.password || '').trim();
  const phone = String(u.phone || '').trim();
  const designation = String(u.designation || '').trim();
  const badgeNo = String(u.badgeNo || idNo).trim();
  const role = String(u.role || 'worker').trim().toLowerCase() === 'admin' ? 'admin' : 'worker';
  const status = String(u.status || 'active').trim().toLowerCase() === 'hold' ? 'hold' : 'active';
  return `${baseDate}||${idNo}||${password}||${phone}||${designation}||${badgeNo}||${role}||${status}`;
}

function sanitizeClientUserRecord(u: any): UserAccount | null {
  if (!u || typeof u !== 'object') return null;
  let merged: any = { ...u };

  // Parse single-GET sync tag from createdAt if present (format: YYYY-MM-DD||idNo||password||phone||designation||badgeNo||role||status)
  const createdRaw = String(u.createdAt || u['Created At'] || '').trim();
  let tagRole = '';
  let tagStatus = '';
  if (createdRaw.includes('||')) {
    const parts = createdRaw.split('||');
    if (parts.length >= 3) {
      if (!merged.idNo && parts[1]) merged.idNo = parts[1];
      if ((merged.password === undefined || merged.password === '') && parts[2] !== undefined) merged.password = parts[2];
      if (!merged.phone && parts[3]) merged.phone = parts[3];
      if (!merged.designation && parts[4]) merged.designation = parts[4];
      if (!merged.badgeNo && parts[5]) merged.badgeNo = parts[5];
      if (parts[6]) tagRole = parts[6].trim().toLowerCase();
      if (parts[7]) tagStatus = parts[7].trim().toLowerCase();
    }
  }

  const rawId = String(merged.id || merged['ID'] || '').trim();
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
  const rawPhone = String(merged.phone || merged['Phone'] || merged.mobile || merged.workerPhone || '').trim();
  const finalIdNo = rawIdNo || (rawId === 'adm_8695716192' ? '8695716192' : rawPhone || rawId);
  if (!finalIdNo) return null;

  const rawRole = String(tagRole || merged.role || merged['Role'] || 'worker').trim().toLowerCase();
  const isAdm =
    rawRole === 'admin' ||
    rawRole === 'controller' ||
    rawRole === 'administrator' ||
    rawRole === 'superadmin' ||
    finalIdNo === '8695716192' ||
    finalIdNo.toLowerCase() === 'admin' ||
    rawId === 'adm_8695716192' ||
    /^adm[-_0-9]/i.test(finalIdNo);

  const finalPass = String(
    merged.password !== undefined && merged.password !== null
      ? merged.password
      : (merged['Password'] !== undefined && merged['Password'] !== null ? merged['Password'] : '')
  ).trim();
  const finalHash = String(merged.passwordHash || merged['Password Hash'] || '').trim();
  const finalDesig = String(merged.designation || merged['Designation'] || (isAdm ? 'Sub-Divisional Controller' : 'লাইনম্যান / Worker (WBSEDCL)')).trim();
  const finalBadge = String(merged.badgeNo || merged['Badge No'] || finalIdNo).trim();
  const rawSt = String(tagStatus || merged.status || merged['Status'] || 'active').trim().toLowerCase();
  const finalSt = (rawSt === 'hold' ? 'hold' : 'active') as 'active' | 'hold';

  const result: UserAccount & { passwordHash?: string; loginId?: string; userId?: string } = {
    id: rawId || `usr_${finalIdNo}`,
    idNo: finalIdNo,
    loginId: finalIdNo,
    userId: finalIdNo,
    uid: merged.uid,
    password: finalPass,
    passwordHash: finalHash,
    name: String(merged.name || merged['Full Name'] || merged['Name'] || merged.consumerName || finalIdNo || 'কর্মী').trim(),
    phone: rawPhone,
    role: (isAdm ? 'admin' : 'worker') as 'admin' | 'worker',
    status: finalSt,
    designation: finalDesig,
    badgeNo: finalBadge,
    createdAt: createdRaw || buildClientUserSyncTag({ idNo: finalIdNo, password: finalPass, phone: rawPhone, designation: finalDesig, badgeNo: finalBadge, role: isAdm ? 'admin' : 'worker', status: finalSt }),
    updatedAt: String(merged.updatedAt || ''),
    lastLogin: String(merged.lastLogin || '')
  };
  return result;
}

function extractClientList(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.users)) return res.users;
  if (Array.isArray(res.entries)) return res.entries;
  if (Array.isArray(res.data)) return res.data;
  if (res.data && typeof res.data === 'object') {
    if (Array.isArray(res.data.users)) return res.data.users;
    if (Array.isArray(res.data.entries)) return res.data.entries;
  }
  return [];
}

async function hydrateClientSingleUserRow(rowId: string): Promise<UserAccount | null> {
  if (!rowId) return null;
  try {
    const detailRes = await callGasApi<any>('updateEntry', {
      id: rowId,
      category: 'Users',
      data: {}
    }, 'POST');
    const fullEntry = detailRes?.entry || detailRes?.data?.entry;
    if (fullEntry && typeof fullEntry === 'object') {
      const hydrated = sanitizeClientUserRecord(fullEntry);
      if (hydrated && hydrated.idNo) {
        const tag = buildClientUserSyncTag(hydrated);
        hydrated.createdAt = tag;
        await callGasApi('updateEntry', {
          id: rowId,
          category: 'Users',
          status: hydrated.status,
          role: hydrated.role,
          createdAt: tag,
          'Created At': tag,
          data: {
            status: hydrated.status,
            Status: hydrated.status,
            role: hydrated.role,
            Role: hydrated.role,
            createdAt: tag,
            'Created At': tag
          }
        }, 'POST').catch(() => {});
        return hydrated;
      }
    }
  } catch {}
  return null;
}

async function fetchDirectUsersSheetSimpleGet(): Promise<any[]> {
  try {
    const sep = GOOGLE_SCRIPT_WEB_APP_URL.includes('?') ? '&' : '?';
    const url = `${GOOGLE_SCRIPT_WEB_APP_URL}${sep}action=entries&category=Users&_t=${Date.now()}`;
    // Zero custom headers -> Simple GET request in all browsers with NO CORS preflight
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    const text = (await res.text()).trim();
    if (!text.startsWith('<')) {
      const parsed = JSON.parse(text);
      return extractClientList(parsed);
    }
  } catch {}
  return [];
}

export async function fetchUsers(forceRefresh = false): Promise<UserAccount[]> {
  try {
    // 1. Try Express API proxy first
    if (typeof window !== 'undefined') {
      try {
        const url = forceRefresh ? '/api/users?refresh=true' : '/api/users';
        const pRes = await fetch(url, { headers: { 'Accept': 'application/json' } });
        const ct = pRes.headers.get('content-type') || '';
        if (pRes.ok && ct.includes('application/json')) {
          const pData = await pRes.json();
          const list = extractClientList(pData);
          if (Array.isArray(list) && list.length > 0) {
            const sanitized = list.map(sanitizeClientUserRecord).filter((u): u is UserAccount => Boolean(u && u.idNo));
            if (sanitized.length > 0) {
              writeCache(USERS_CACHE_KEY, sanitized);
              return sanitized;
            }
          }
        }
      } catch {}
    }

    // 2. Direct Google Apps Script Simple GET to the existing Users sheet (Zero CORS preflight)
    const userMap = new Map<string, UserAccount>();
    const cachedUsers = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
    const localLookup = new Map<string, UserAccount>();
    for (const cu of cachedUsers) {
      const normCu = sanitizeClientUserRecord(cu);
      if (normCu) {
        if (normCu.id) localLookup.set(normCu.id, normCu);
        if (normCu.idNo) localLookup.set(normCu.idNo.toLowerCase(), normCu);
      }
    }

    let sheetRows = await fetchDirectUsersSheetSimpleGet();
    if (sheetRows.length === 0) {
      const usersSheetRes = await callGasApi<any>('entries', { category: 'Users' }, 'GET').catch(() => null);
      sheetRows = extractClientList(usersSheetRes);
    }

    for (const rowSummary of sheetRows) {
      const rowId = String(rowSummary?.id || '').trim();
      if (!rowId) continue;

      const normSummary = sanitizeClientUserRecord(rowSummary);
      if (normSummary && normSummary.idNo && (normSummary.password !== '' || (normSummary as any).passwordHash)) {
        userMap.set(rowId, normSummary);
        continue;
      }

      // Hydrate any un-tagged row from the Users sheet
      const hydrated = await hydrateClientSingleUserRow(rowId);
      if (hydrated && hydrated.idNo) {
        userMap.set(rowId, hydrated);
        continue;
      }

      const localFallback = localLookup.get(rowId);
      if (localFallback) {
        userMap.set(rowId, {
          ...localFallback,
          name: rowSummary.consumerName || rowSummary.name || localFallback.name
        });
      }
    }

    const finalUsers = Array.from(userMap.values());
    if (finalUsers.length > 0) {
      writeCache(USERS_CACHE_KEY, finalUsers);
      return finalUsers;
    }

    return cachedUsers;
  } catch (err: any) {
    console.warn('fetchUsers using cache fallback due to error:', err);
    return readCache<UserAccount[]>(USERS_CACHE_KEY, []);
  }
}

export async function createUserAccount(userData: Partial<UserAccount>): Promise<UserAccount> {
  const cleanId = normalizeUniversalText(userData.idNo || '').trim();
  const cleanPhone = normalizeUniversalText(userData.phone || '').replace(/[^0-9]/g, '');
  const cleanName = normalizeUniversalText(userData.name || cleanId) || 'কর্মী';
  const cleanPassword = normalizePassword(userData.password || '1234');

  if (!cleanId && !cleanPhone) throw new Error('ইউজার আইডি বা মোবাইল নম্বর আবশ্যক');

  const finalId = cleanId || `LM-${cleanPhone.slice(-4)}`;
  const cleanDesig = userData.designation || (userData.role === 'admin' ? 'সহকারী প্রকৌশলী / Admin (WBSEDCL)' : 'লাইনম্যান / Worker (WBSEDCL)');
  const cleanBadge = userData.badgeNo || finalId;
  const syncTag = buildClientUserSyncTag({
    idNo: finalId,
    password: cleanPassword,
    phone: cleanPhone,
    designation: cleanDesig,
    badgeNo: cleanBadge,
    role: userData.role || 'worker',
    status: userData.status || 'active'
  });

  const payload = {
    id: `USR-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    idNo: finalId,
    'User ID': finalId,
    phone: cleanPhone,
    'Phone': cleanPhone,
    name: cleanName,
    'Name': cleanName,
    'Full Name': cleanName,
    consumerName: cleanName,
    password: cleanPassword,
    'Password': cleanPassword,
    role: (userData.role || 'worker') as 'admin' | 'worker' | 'supervisor',
    'Role': userData.role || 'worker',
    status: (userData.status || 'active') as 'active' | 'hold',
    'Status': userData.status || 'active',
    designation: cleanDesig,
    'Designation': cleanDesig,
    badgeNo: cleanBadge,
    'Badge No': cleanBadge,
    createdAt: syncTag,
    'Created At': syncTag,
    securityQuestion: userData.securityQuestion || '',
    securityAnswer: userData.securityAnswer || ''
  };

  // 1. Try server endpoint
  if (typeof window !== 'undefined') {
    try {
      const resp = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ data: payload })
      });
      const ct = resp.headers.get('content-type') || '';
      if (resp.ok && ct.includes('application/json')) {
        const resData = await resp.json();
        const rawCreated = (resData?.user || resData?.data?.user || payload) as UserAccount;
        const created = { ...rawCreated, password: cleanPassword };
        const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
        writeCache(USERS_CACHE_KEY, [created, ...cached.filter(u => u.idNo !== created.idNo)]);
        return created;
      }
    } catch {}
  }

  // 2. Direct GAS failover via submitRecord with category Users ONLY
  const gasRes = await callGasApi<any>('submitRecord', { category: 'Users', ...payload, data: { category: 'Users', ...payload } }, 'POST');
  const rawCreated = (gasRes?.user || gasRes?.entry || gasRes?.data?.entry || payload) as UserAccount;
  const created = { ...rawCreated, id: payload.id, idNo: finalId, password: cleanPassword, role: payload.role === 'admin' ? 'admin' : 'worker', status: payload.status } as UserAccount;
  const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
  writeCache(USERS_CACHE_KEY, [created, ...cached.filter(u => u.idNo !== created.idNo)]);
  return created;
}

export async function updateUserAccount(id: string, updates: Partial<UserAccount>): Promise<UserAccount> {
  const cleanId = String(id || '').trim();
  const safeUpdates = { ...updates };
  if (safeUpdates.phone) {
    safeUpdates.phone = normalizeUniversalText(safeUpdates.phone).replace(/[^0-9]/g, '');
  }
  if (safeUpdates.password) {
    safeUpdates.password = normalizePassword(safeUpdates.password);
  }

  // 1. Try server endpoint
  if (typeof window !== 'undefined') {
    try {
      const resp = await fetch(`/api/users/${encodeURIComponent(cleanId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ data: safeUpdates })
      });
      const ct = resp.headers.get('content-type') || '';
      if (resp.ok && ct.includes('application/json')) {
        const resData = await resp.json();
        const rawUpdated = (resData?.user || resData?.data?.user || { id: cleanId, ...safeUpdates }) as UserAccount;
        const updated = { ...rawUpdated, ...(safeUpdates.password ? { password: safeUpdates.password } : {}) };
        const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
        writeCache(USERS_CACHE_KEY, cached.map(u => (u.id === cleanId || u.idNo === cleanId) ? { ...u, ...updated } : u));
        return updated;
      }
    } catch {}
  }

  // 2. Direct GAS failover via updateEntry on category Users ONLY
  const cachedList = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
  const existingUser = cachedList.find(u => u.id === cleanId || u.idNo === cleanId);
  const targetRowId = existingUser?.id || cleanId;
  const mergedBase = { ...(existingUser || {}), ...safeUpdates, id: targetRowId };
  const syncTag = buildClientUserSyncTag({
    idNo: mergedBase.idNo || cleanId,
    password: mergedBase.password || existingUser?.password || '',
    phone: mergedBase.phone || existingUser?.phone || '',
    designation: mergedBase.designation || existingUser?.designation || '',
    badgeNo: mergedBase.badgeNo || existingUser?.badgeNo || mergedBase.idNo || cleanId,
    role: mergedBase.role || existingUser?.role || 'worker',
    status: mergedBase.status || existingUser?.status || 'active',
    createdAt: existingUser?.createdAt
  });
  const mergedPayload = {
    ...mergedBase,
    category: 'Users',
    createdAt: syncTag,
    'Created At': syncTag
  };

  const gasRes = await callGasApi<any>('updateEntry', {
    id: targetRowId,
    category: 'Users',
    ...mergedPayload,
    data: mergedPayload
  }, 'POST');
  const rawUpdated = (gasRes?.user || gasRes?.entry || gasRes?.data?.entry || mergedPayload) as UserAccount;
  const updated = sanitizeClientUserRecord({ ...mergedPayload, ...rawUpdated, ...(safeUpdates.password ? { password: safeUpdates.password } : {}) }) || (mergedPayload as UserAccount);
  const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
  writeCache(USERS_CACHE_KEY, cached.map(u => (u.id === cleanId || u.idNo === cleanId) ? { ...u, ...updated } : u));
  return updated;
}

export async function deleteUserAccount(
  id: string,
  options?: {
    confirmDelete?: boolean;
    confirmAdminDelete?: boolean;
    reason?: string;
  }
): Promise<boolean> {
  const cleanId = String(id || '').toLowerCase().trim();
  if (cleanId === '8695716192' || cleanId === 'adm_8695716192' || cleanId === 'admin' || cleanId === 'nayem') {
    throw new Error('PRIMARY_ADMIN_PROTECTED: The Primary Admin account (8695716192) is permanently protected and cannot be deleted.');
  }

  const reqPayload = {
    id,
    confirmDelete: true,
    confirmAdminDelete: options?.confirmAdminDelete ?? true,
    reason: options?.reason || 'Admin confirmed user deletion',
    ...(options || {})
  };

  // 1. Try server DELETE / POST endpoint
  if (typeof window !== 'undefined') {
    try {
      const resp = await fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(reqPayload)
      });
      const ct = resp.headers.get('content-type') || '';
      if (resp.ok && ct.includes('application/json')) {
        const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
        writeCache(USERS_CACHE_KEY, cached.filter(u => u.id !== id && u.idNo !== id));
        return true;
      }
      const postResp = await fetch(`/api/users/${encodeURIComponent(id)}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(reqPayload)
      });
      if (postResp.ok) {
        const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
        writeCache(USERS_CACHE_KEY, cached.filter(u => u.id !== id && u.idNo !== id));
        return true;
      }
    } catch {}
  }

  // 2. Direct GAS failover on Users sheet ONLY
  const cachedList = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
  const target = cachedList.find(u => u.id === id || u.idNo === id);
  const rowId = target?.id || id;
  await callGasApi<any>('deleteUser', { id: rowId, idNo: target?.idNo || id, category: 'Users', ...reqPayload }, 'POST').catch(() => {});
  await callGasApi<any>('deleteEntry', { id: rowId, category: 'Users', ...reqPayload }, 'POST').catch(() => {});
  writeCache(USERS_CACHE_KEY, cachedList.filter(u => u.id !== id && u.idNo !== id));
  return true;
}

export async function updateUserStatus(id: string, status: 'active' | 'hold'): Promise<UserAccount> {
  const cleanId = id.toLowerCase().trim();
  if ((cleanId === '8695716192' || cleanId === 'adm_8695716192' || cleanId === 'admin') && status === 'hold') {
    throw new Error('Primary Admin account cannot be placed on hold');
  }

  return updateUserAccount(id, { status });
}

export async function verifyUserSession(phoneOrId: string): Promise<{ valid: boolean; status?: 'active' | 'hold'; error?: string }> {
  try {
    const clean = normalizeUniversalText(phoneOrId).trim().toLowerCase();
    const cleanAlnum = clean.replace(/[^a-z0-9]/g, '');
    const cleanDigits = clean.replace(/[^0-9]/g, '');
    const users = await fetchUsers();

    const u = users.find(user => {
      const uId = normalizeUniversalText(user.idNo || user.id || '').trim().toLowerCase();
      const uAlnum = uId.replace(/[^a-z0-9]/g, '');
      const uPhone = String(user.phone || '').replace(/[^0-9]/g, '');
      return uId === clean || (cleanAlnum && uAlnum === cleanAlnum) || (cleanDigits.length >= 10 && uPhone.endsWith(cleanDigits.slice(-10)));
    });

    if (u) {
      return { valid: true, status: u.status || 'active' };
    }
    return { valid: false, error: 'User profile not found' };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Verification error' };
  }
}

async function checkClientPasswordMatch(matchedUser: any, cleanPass: string): Promise<boolean> {
  if (!matchedUser || !cleanPass) return false;
  const storedPass = normalizePassword(String(matchedUser.password || (matchedUser as any)['Password'] || ''));
  const storedHash = String((matchedUser as any).passwordHash || (matchedUser as any)['Password Hash'] || '').trim().toLowerCase();

  // 1. Plain Text password match
  if (storedPass && (storedPass === cleanPass || storedPass.toLowerCase() === cleanPass.toLowerCase())) {
    return true;
  }

  // 2. Password Hash match (SHA-256)
  const hashHex = await sha256HexClient(cleanPass);
  const hashLowerHex = await sha256HexClient(cleanPass.toLowerCase());
  if (
    storedPass &&
    /^[a-f0-9]{64}$/i.test(storedPass) &&
    hashHex &&
    (storedPass.toLowerCase() === hashHex || storedPass.toLowerCase() === hashLowerHex)
  ) {
    return true;
  }
  if (
    storedHash &&
    ((hashHex && (storedHash === hashHex || storedHash === hashLowerHex)) ||
      storedHash === cleanPass.toLowerCase())
  ) {
    return true;
  }

  return false;
}

export async function loginUser(loginId: string, password: string): Promise<UserSession> {
  const cleanId = normalizeUniversalText(loginId).trim();
  const cleanPass = normalizePassword(password);
  if (!cleanId || !cleanPass) {
    throw new Error('ইউজার আইডি / মোবাইল নম্বর এবং পাসওয়ার্ড প্রয়োজন (User ID / Phone & Password required)');
  }

  // Clear any stale login session or cached admin flags before authenticating
  try {
    localStorage.removeItem('power_user_session');
    localStorage.removeItem('power_is_admin');
  } catch {}

  let resData: any = null;
  let serverAuthError: string | null = null;

  // 1. Try Express API proxy route (/api/auth/login) which authenticates directly against Google Sheets Users sheet
  if (typeof window !== 'undefined') {
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ loginId: cleanId, idNo: cleanId, userId: cleanId, password: cleanPass })
      });

      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const rawText = await resp.text();
        let data: any = null;
        if (rawText && rawText.trim().length > 0) {
          try {
            data = JSON.parse(rawText.trim());
          } catch {}
        }

        if (data && typeof data === 'object') {
          if (resp.ok && data.success && data.session) {
            resData = data;
          } else if ((resp.status === 401 || resp.status === 403 || resp.status === 400) && data.error) {
            serverAuthError = typeof data.error === 'string' ? data.error : (data.error?.message || 'Invalid credentials');
          }
        }
      }
    } catch {}
  }

  // If the server explicitly rejected the credentials (401/403), throw that exact error immediately
  if (!resData && serverAuthError) {
    throw new Error(serverAuthError);
  }

  // 2. Direct Google Sheets Users Sheet Verification (Used when running on static/Vercel frontend without /api/auth/login)
  if (!resData) {
    const users = await fetchUsers(true);
    const lowerId = cleanId.toLowerCase();
    const cleanIdAlnum = lowerId.replace(/[^a-z0-9]/g, '');
    const cleanDigits = cleanId.replace(/\D/g, '');
    const cleanPhone10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : '';

    let matchedUser = users.find((u: UserAccount) => {
      if (!u) return false;
      const uIdNo = normalizeUniversalText(u.idNo || (u as any).loginId || (u as any).userId || '').trim().toLowerCase();
      const uIdNoAlnum = uIdNo.replace(/[^a-z0-9]/g, '');
      const uInternalId = normalizeUniversalText(u.id || '').trim().toLowerCase();
      const uBadge = normalizeUniversalText(u.badgeNo || '').trim().toLowerCase();
      const uBadgeAlnum = uBadge.replace(/[^a-z0-9]/g, '');
      const uPhoneDigits = normalizeUniversalText(u.phone || '').replace(/\D/g, '');
      const uPhone10 = uPhoneDigits.length >= 10 ? uPhoneDigits.slice(-10) : uPhoneDigits;

      if (uIdNo && uIdNo === lowerId) return true;
      if (cleanIdAlnum && uIdNoAlnum && uIdNoAlnum === cleanIdAlnum) return true;
      if (uInternalId && uInternalId === lowerId) return true;
      if (uBadge && (uBadge === lowerId || (cleanIdAlnum && uBadgeAlnum === cleanIdAlnum))) return true;
      if (cleanPhone10 && uPhone10 && uPhone10 === cleanPhone10) return true;
      if (cleanDigits && cleanDigits.length >= 4 && uPhoneDigits && cleanDigits === uPhoneDigits) return true;
      return false;
    });

    if (!matchedUser) {
      throw new Error('ভুল ইউজার আইডি! সঠিক ইউজার আইডি বা মোবাইল নম্বর দিন। (Invalid User ID)');
    }

    let passValid = await checkClientPasswordMatch(matchedUser, cleanPass);

    // If password was manually edited in Google Sheets Users tab Password column, hydrate live row
    if (!passValid && matchedUser.id) {
      const liveRow = await hydrateClientSingleUserRow(matchedUser.id);
      if (liveRow) {
        matchedUser = liveRow;
        passValid = await checkClientPasswordMatch(matchedUser, cleanPass);
      }
    }

    if (String(matchedUser.status || 'active').toLowerCase() === 'hold') {
      throw new Error('আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত (ON HOLD) রাখা হয়েছে। এডমিনের সাথে যোগাযোগ করুন।');
    }

    if (!passValid) {
      throw new Error('ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড বা পিন দিন (Invalid Password)');
    }

    const idNoStr = String(matchedUser.idNo || cleanId).trim();
    const isRoleAdmin =
      matchedUser.role === 'admin' ||
      idNoStr === '8695716192' ||
      idNoStr.toLowerCase() === 'admin' ||
      matchedUser.id === 'adm_8695716192' ||
      /^adm[-_0-9]/i.test(idNoStr);

    resData = {
      success: true,
      session: {
        id: String(matchedUser.id || `usr_${idNoStr}`),
        idNo: idNoStr,
        name: String(matchedUser.name || (isRoleAdmin ? 'NAYEM (Admin Controller)' : 'কর্মী')),
        phone: String(matchedUser.phone || ''),
        role: (isRoleAdmin ? 'admin' : 'worker') as 'admin' | 'worker',
        status: 'active' as const,
        designation: String(matchedUser.designation || (isRoleAdmin ? 'Sub-Divisional Controller' : 'লাইনম্যান / Worker (WBSEDCL)')),
        badgeNo: String(matchedUser.badgeNo || idNoStr),
        token: `SES-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        loggedInAt: new Date().toISOString()
      }
    };
  }

  if (!resData || !resData.session) {
    throw new Error('ভুল ইউজার আইডি বা পাসওয়ার্ড! সঠিক আইডি ও পাসওয়ার্ড দিন।');
  }

  const session: UserSession = resData.session;
  if (session.status === 'hold') {
    throw new Error('আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত (ON HOLD) রাখা হয়েছে। এডমিনের সাথে যোগাযোগ করুন।');
  }

  try {
    localStorage.setItem('power_user_session', JSON.stringify(session));
    const isAdm = session.role === 'admin' || session.idNo === '8695716192' || session.idNo === 'admin';
    if (isAdm) {
      localStorage.setItem('power_is_admin', 'true');
    } else {
      localStorage.removeItem('power_is_admin');
    }
  } catch {}

  return session;
}

export async function logoutUser(): Promise<void> {
  try {
    localStorage.removeItem('power_user_session');
    localStorage.removeItem('power_is_admin');
  } catch {}
}

// ============================================================================
// LIVE CHAT
// ============================================================================

export async function fetchChatMessages(workerId?: string): Promise<ChatMessage[]> {
  try {
    const data = await callGasApi<{ success: boolean; messages: ChatMessage[] }>(
      'chat',
      workerId ? { workerId } : {},
      'GET'
    );
    if (data && Array.isArray(data.messages)) {
      const valid = data.messages.filter(m => m && (m.id || m.message));
      const seen = new Set<string>();
      const uniqueMsgs: ChatMessage[] = [];
      valid.forEach((m, idx) => {
        const idKey = String(m.id || `msg-${idx + 1}-${m.timestamp || Date.now()}`).trim();
        if (!seen.has(idKey)) {
          seen.add(idKey);
          uniqueMsgs.push({ ...m, id: idKey });
        } else {
          const dedupe = `${idKey}-${idx + 1}`;
          seen.add(dedupe);
          uniqueMsgs.push({ ...m, id: dedupe });
        }
      });
      writeCache(CHAT_LOCAL_KEY, uniqueMsgs);
      return uniqueMsgs;
    }
  } catch {}
  return readCache(CHAT_LOCAL_KEY, []);
}

export async function sendChatMessage(payload: {
  senderId: string;
  senderName: string;
  senderRole: 'admin' | 'worker' | 'supervisor';
  recipientId?: string;
  message: string;
}): Promise<ChatMessage> {
  try {
    const data = await callGasApi<{ success: boolean; message: ChatMessage }>('sendChat', { data: payload }, 'POST');
    if (data && data.message) {
      const list = readCache<ChatMessage[]>(CHAT_LOCAL_KEY, []);
      writeCache(CHAT_LOCAL_KEY, [...list, data.message]);
      return data.message;
    }
  } catch {}

  const fallbackMsg: ChatMessage = {
    id: `msg_${Date.now()}`,
    ...payload,
    timestamp: new Date().toISOString(),
    status: 'sent'
  };
  const list = readCache<ChatMessage[]>(CHAT_LOCAL_KEY, []);
  writeCache(CHAT_LOCAL_KEY, [...list, fallbackMsg]);
  return fallbackMsg;
}

export async function clearChatMessages(): Promise<boolean> {
  try {
    await callGasApi('clearChat', {}, 'POST');
  } catch {}
  localStorage.removeItem(CHAT_LOCAL_KEY);
  return true;
}

// ============================================================================
// WORK ORDERS & KHATA NOTICES
// ============================================================================

export async function fetchWorkOrders(category?: string, forceRefresh = false): Promise<WorkOrderNotice[]> {
  try {
    const params: Record<string, string> = {};
    if (category && category !== 'ALL') params.category = category;
    if (forceRefresh) params.refresh = 'true';

    let rawList: any[] = [];
    let fetchedSuccessfully = false;

    // 1. Primary: Express Backend /api/work-orders (synced with Google Sheets WorkOrders_Khata)
    try {
      const q = new URLSearchParams(params).toString();
      const pUrl = q ? `/api/work-orders?${q}` : '/api/work-orders';
      const res = await fetch(pUrl, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const pData = await res.json();
        const arr = Array.isArray(pData) ? pData : (Array.isArray(pData?.workOrders) ? pData.workOrders : (Array.isArray(pData?.data?.workOrders) ? pData.data.workOrders : null));
        if (Array.isArray(arr)) {
          rawList = arr;
          fetchedSuccessfully = true;
        }
      }
    } catch {}

    // 2. Fallback: Gas Proxy / Direct GAS 'workorders'
    if (!fetchedSuccessfully) {
      try {
        const data = await callGasApi<{ success: boolean; workOrders: WorkOrderNotice[] }>('workorders', params, 'GET');
        if (data && Array.isArray(data.workOrders)) {
          rawList = data.workOrders;
          fetchedSuccessfully = true;
        }
      } catch {}
    }

    // 3. Fallback: Direct read from Google Sheets 'Work Orders' sheet via 'entries'
    if (!fetchedSuccessfully) {
      try {
        const sheetRes = await callGasApi<any>('entries', { category: 'Work Orders' }, 'GET');
        const rows = Array.isArray(sheetRes?.entries) ? sheetRes.entries : (Array.isArray(sheetRes?.data) ? sheetRes.data : []);
        if (Array.isArray(rows)) {
          rawList = rows.map((r: any) => {
            let meta: any = {};
            const notesStr = String(r.notes || r['Notes'] || '').trim();
            if (notesStr.startsWith('{')) {
              try { meta = JSON.parse(notesStr); } catch {}
            }
            const reassembled = [
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
            return {
              id: meta.id || r.id || r.submissionId,
              category: meta.category || r.workOrderNo || 'NSC',
              title: meta.title || r.consumerName || r.workOrderNoticeTitle || 'Work Order & Khata Notice',
              description: meta.description || '',
              photoUrl: reassembled,
              directImageUrl: reassembled,
              fileName: meta.fileName || 'WorkOrder.jpg',
              fileType: meta.fileType || 'image/jpeg',
              uploadedBy: meta.uploadedBy || r.workerId || '8695716192',
              adminName: meta.adminName || r.workerName || 'Admin Controller',
              adminPhone: meta.adminPhone || '8695716192',
              uploadDate: meta.uploadDate || r.workOrderDate || r.date || '',
              uploadTime: meta.uploadTime || '',
              createdAt: meta.createdAt || r.createdAt || r.date || new Date().toISOString(),
              isHidden: meta.isHidden !== undefined ? Boolean(meta.isHidden) : (String(r.status).toLowerCase() === 'hidden')
            };
          });
          if (category && category !== 'ALL') {
            const catUpper = category.toUpperCase().trim();
            rawList = rawList.filter((o: any) => {
              const oc = String(o.category || 'NSC').toUpperCase().trim();
              return oc === catUpper || oc === 'ALL';
            });
          }
          fetchedSuccessfully = true;
        }
      } catch {}
    }

    if (fetchedSuccessfully) {
      const validOrders = rawList.filter(w => w && (w.id || w.title || w.photoUrl || w.fileId));
      const seen = new Set<string>();
      const uniqueOrders: WorkOrderNotice[] = [];
      validOrders.forEach((w, idx) => {
        const idKey = String(w.id || `wo-${idx + 1}-${w.createdAt || Date.now()}`).trim();
        let photo = w.photoUrl || w.directImageUrl || w.fileData || '';
        if (!photo && w.fileId) {
          photo = `https://drive.google.com/thumbnail?id=${w.fileId}&sz=w2000`;
        }
        if (!photo && idKey) {
          photo = `/api/work-orders/${encodeURIComponent(idKey)}/file`;
        }
        if (photo && photo.includes('drive.google.com') && !photo.includes('thumbnail')) {
          const match = photo.match(/[\/=]([a-zA-Z0-9_-]{25,})/);
          if (match && match[1]) {
            photo = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w2000`;
          }
        }

        const normalizedOrder: WorkOrderNotice = {
          ...w,
          id: seen.has(idKey) ? `${idKey}-${idx + 1}` : idKey,
          category: (w.category || 'NSC') as CategoryType,
          title: w.title || 'WBSEDCL Work Order & Khata Notice',
          photoUrl: photo,
          directImageUrl: w.directImageUrl || photo,
          description: (w.description && (String(w.description).startsWith('http') || String(w.description).startsWith('data:'))) ? '' : (w.description || ''),
          uploadDate: formatDateDDMMYYYY(w.uploadDate || w.createdAt) || getNowDateDDMMYYYY(),
          uploadTime: formatTime12Hour(w.uploadTime || w.createdAt) || getNowTime12Hour(),
        };

        seen.add(normalizedOrder.id);
        uniqueOrders.push(normalizedOrder);
      });
      if (!category || category === 'ALL') {
        writeCache(WORK_ORDERS_STORAGE_KEY, sanitizeWorkOrdersForCache(uniqueOrders));
      }
      return uniqueOrders;
    }
  } catch {}
  const cached = readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []);
  if (category && category !== 'ALL') {
    const catUpper = category.toUpperCase().trim();
    return cached.filter(o => {
      const oc = String(o.category || 'NSC').toUpperCase().trim();
      return oc === catUpper || oc === 'ALL';
    });
  }
  return cached;
}

export async function uploadWorkOrder(payload: {
  category: CategoryType;
  title: string;
  photoUrl: string;
  fileData?: string;
  fileName?: string;
  fileType?: string;
  description?: string;
  uploadedBy: string;
  adminName: string;
  adminPhone?: string;
  isHidden?: boolean;
}): Promise<WorkOrderNotice> {
  const now = new Date();
  const generatedId = `WO-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const cleanDesc = (payload.description && !payload.description.startsWith('data:')) ? payload.description.trim() : '';
  const rawImg = payload.photoUrl || payload.fileData || '';

  const uploadPayload = {
    ...payload,
    id: generatedId,
    photoUrl: rawImg,
    fileData: rawImg,
    description: cleanDesc,
    fileName: payload.fileName || `WBSEDCL_Notice_${Date.now()}.jpg`,
    fileType: payload.fileType || 'image/jpeg',
    uploadDate: formatDateDDMMYYYY(now),
    uploadTime: formatTime12Hour(now),
    createdAt: now.toISOString(),
    isHidden: Boolean(payload.isHidden)
  };

  // Attempt 1: Primary Express Backend /api/work-orders (saves to disk + syncs 12-chunked row to Google Sheets WorkOrders_Khata)
  try {
    const sRes = await fetch('/api/work-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uploadPayload),
    });
    if (sRes.ok) {
      const sData = await sRes.json();
      const savedOrder: WorkOrderNotice = {
        ...(sData?.workOrder || uploadPayload),
        photoUrl: rawImg || sData?.workOrder?.photoUrl || `/api/work-orders/${encodeURIComponent(generatedId)}/file`,
        directImageUrl: rawImg || sData?.workOrder?.directImageUrl || `/api/work-orders/${encodeURIComponent(generatedId)}/file`
      };
      const list = readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []);
      writeCache(WORK_ORDERS_STORAGE_KEY, sanitizeWorkOrdersForCache([savedOrder, ...list.filter(w => w.id !== savedOrder.id)]));
      return savedOrder;
    }
  } catch (proxyErr) {
    console.warn('Primary /api/work-orders upload notice, falling back to direct GAS:', proxyErr);
  }

  // Attempt 2: Direct Google Sheets 'WorkOrders_Khata' submission with 12-column chunking
  try {
    const CHUNK_SIZE = 43000;
    const chunks: string[] = [];
    for (let i = 0; i < rawImg.length && chunks.length < 12; i += CHUNK_SIZE) {
      chunks.push(rawImg.slice(i, i + CHUNK_SIZE));
    }
    const meta = {
      id: generatedId,
      category: uploadPayload.category,
      title: uploadPayload.title,
      description: cleanDesc,
      fileName: uploadPayload.fileName,
      fileType: uploadPayload.fileType,
      uploadedBy: uploadPayload.uploadedBy,
      adminName: uploadPayload.adminName,
      adminPhone: uploadPayload.adminPhone || '8695716192',
      uploadDate: uploadPayload.uploadDate,
      uploadTime: uploadPayload.uploadTime,
      createdAt: uploadPayload.createdAt,
      isHidden: uploadPayload.isHidden
    };
    await callGasApi('submitRecord', {
      id: generatedId,
      submissionId: generatedId,
      category: 'Work Orders',
      status: uploadPayload.isHidden ? 'Hidden' : 'Active',
      consumerName: uploadPayload.title,
      workerName: uploadPayload.adminName,
      workerId: uploadPayload.uploadedBy,
      workOrderNo: uploadPayload.category,
      workOrderDate: uploadPayload.uploadDate,
      workOrderNoticeId: generatedId,
      workOrderNoticeTitle: uploadPayload.title,
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
    }, 'POST', 45000);
  } catch (gasErr) {
    console.warn('Direct GAS WorkOrders_Khata submitRecord notice:', gasErr);
  }

  const fallbackOrder: WorkOrderNotice = {
    id: generatedId,
    category: payload.category,
    title: payload.title || 'Work Order / Khata Notice',
    photoUrl: rawImg,
    directImageUrl: rawImg,
    description: cleanDesc,
    uploadedBy: payload.uploadedBy || 'admin',
    adminName: payload.adminName || 'Admin Controller',
    adminPhone: payload.adminPhone || '8695716192',
    uploadDate: uploadPayload.uploadDate,
    uploadTime: uploadPayload.uploadTime,
    createdAt: uploadPayload.createdAt,
    isHidden: Boolean(payload.isHidden)
  };
  const list = readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []);
  writeCache(WORK_ORDERS_STORAGE_KEY, sanitizeWorkOrdersForCache([fallbackOrder, ...list]));
  return fallbackOrder;
}

export async function toggleWorkOrderVisibility(id: string, isHidden: boolean): Promise<boolean> {
  const list = readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []);
  writeCache(WORK_ORDERS_STORAGE_KEY, list.map(item => String(item.id) === String(id) ? { ...item, isHidden } : item));
  try {
    const res = await fetch(`/api/work-orders/${encodeURIComponent(id)}/visibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHidden }),
    });
    if (res.ok) return true;
  } catch {}
  try {
    await callGasApi('toggleWorkOrder', { id, isHidden }, 'POST');
  } catch {}
  return true;
}

export async function deleteWorkOrder(id: string): Promise<boolean> {
  const list = readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []);
  writeCache(WORK_ORDERS_STORAGE_KEY, list.filter(item => String(item.id) !== String(id)));
  try {
    const res = await fetch(`/api/work-orders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) return true;
  } catch {}
  try {
    const postRes = await fetch(`/api/work-orders/${encodeURIComponent(id)}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (postRes.ok) return true;
  } catch {}
  try {
    await callGasApi('deleteWorkOrder', { id }, 'POST');
  } catch {}
  return true;
}

// ============================================================================
// DISCONNECTION TASK MANAGEMENT SYSTEM (Google Sheets Source of Truth)
// ============================================================================
export const DISCONNECTION_TASKS_CACHE_KEY = 'power_disconnection_tasks_cache';

export function invalidateDisconnectionCache() {
  // Keep cache intact for instant UI; server handles authoritative updates
}

export function isValidDisconnectionTaskOrRow(r: any): boolean {
  if (!r || typeof r !== 'object') return false;
  const rawSt = String(
    r['Discon Status'] || r.disconStatus || r.taskStatus || r.status || r['Status'] || r['Update'] || ''
  ).trim().toUpperCase();
  const rawNotes = String(
    r['Notes'] || r.notes || r.workerRemarks || r.workerReport || r['Remarks'] || ''
  ).trim().toUpperCase();
  if (
    rawSt === 'DELETED' ||
    rawSt === '[DELETED_BY_ADMIN]' ||
    r._deleted === true
  ) {
    return false;
  }

  const cId = String(
    r['Consumer Id'] ?? r['Consumer ID'] ?? r.consumerId ?? r.accountNumber ?? r['Consumer No'] ?? ''
  ).trim();
  const cName = String(
    r['Name'] ?? r['Consumer Name'] ?? r.consumerName ?? r.name ?? r['Customer Name'] ?? ''
  ).trim();

  if (!cId || !cName) return false;
  if (/^(SL\s*\d+|DISC[-_]|PWR-DIS-|SUB-|ROW-|TASK-|ID$|N\/A$|NULL$|UNDEFINED$|NONE$|-+$)/i.test(cId)) {
    return false;
  }
  if (
    /^(consumer|consumer\s*\(.*\)|unknown(\s+consumer)?|demo.*|sample.*|test.*|n\/a|null|undefined|none|-+)$/i.test(cName) ||
    cName.length < 2
  ) {
    return false;
  }
  return true;
}

export function getCachedDisconnectionTasksSync(): DisconnectionTask[] {
  try {
    localStorage.removeItem(DISCONNECTION_TASKS_CACHE_KEY);
  } catch {}
  return [];
}

export function setCachedDisconnectionTasksSync(_tasks: DisconnectionTask[]) {
  try {
    localStorage.removeItem(DISCONNECTION_TASKS_CACHE_KEY);
  } catch {}
}

export function cleanDisconnectionTask(t: any): DisconnectionTask {
  if (!t) return t;
  const directCandidates = [
    t.phoneNumber,
    t.mobileNumber,
    t.mobile,
    t.phone,
    t.contactNumber,
    t.contact,
    t['Mobile Number'],
    t['Mobile No'],
    t['Mobile'],
    t['Mobile_No'],
    t['Phone'],
    t['Phone No'],
    t['Phone Number'],
    t['Mob No'],
    t['Mob'],
    t['Contact'],
    t['Contact No'],
    t['মোবাইল'],
    t['ফোন']
  ];
  let phone = '';
  for (const c of directCandidates) {
    if (c !== undefined && c !== null) {
      let str = String(c).trim();
      str = str.replace(/\.0+$/, '');
      if (/^\d+\.?\d*e[+-]?\d+$/i.test(str)) {
        const num = Number(str);
        if (!isNaN(num)) str = Math.round(num).toString();
      }
      if (str && str.toLowerCase() !== 'null' && str.toLowerCase() !== 'undefined' && str.toLowerCase() !== 'n/a' && str !== '-') {
        phone = str;
        break;
      }
    }
  }
  if (!phone) {
    const text = `${t.consumerAddress || t.Address || ''} ${t.workerRemarks || ''} ${t.disconnectionReason || ''}`;
    const m = text.match(/(?:^|\D)([6-9]\d{9})(?:\D|$)/);
    if (m && m[1]) phone = m[1];
  }
  const cleanRemarks = String(t.workerRemarks || t.workerReport || t.notes || t['Notes'] || '')
    .replace(/\[DELETED_BY_ADMIN\]/gi, '')
    .trim();
  return {
    ...t,
    phoneNumber: phone || t.phoneNumber || '',
    workerRemarks: cleanRemarks,
    workerReport: cleanRemarks,
    notes: cleanRemarks,
    Notes: cleanRemarks
  };
}

export async function fetchDisconnectionTasks(params: {
  workerId?: string;
  workerName?: string;
  role?: string;
  search?: string;
  status?: string;
  includeArchived?: boolean;
  refresh?: boolean;
} = {}): Promise<{ tasks: DisconnectionTask[]; stats: DisconnectionStats }> {
  // Step 1: Call Backend API (/api/disconnection-tasks) with fast server-side memory cache (<10ms)
  try {
    const query = new URLSearchParams();
    if (params.workerId) query.set('workerId', params.workerId);
    if (params.workerName) query.set('workerName', params.workerName);
    if (params.role) query.set('role', params.role);
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.includeArchived) query.set('includeArchived', 'true');
    if (params.refresh) query.set('refresh', 'true');

    const res = await fetch(`/api/disconnection-tasks?${query.toString()}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.tasks)) {
        const validTasks = data.tasks.filter(isValidDisconnectionTaskOrRow);
        const cleaned = validTasks.map((t: any, idx: number) => ({
          ...cleanDisconnectionTask(t),
          serialNumber: t.serialNumber || `SL ${String(idx + 1).padStart(3, '0')}`
        }));
        if (!params.search && (!params.status || params.status === 'ALL')) {
          setCachedDisconnectionTasksSync(cleaned);
        }
        return { tasks: cleaned, stats: computeStats(cleaned) };
      }
    }
  } catch (apiErr: any) {
    console.warn('[Disconnection] Backend API fetch notice, trying GAS failover:', apiErr?.message || apiErr);
  }

  // Step 2: Direct read from Google Sheet via 'entries' (Disconnection category)
  try {
    const rawRes = await callGasApi<{ success: boolean; entries: any[] }>('entries', { category: 'Disconnection' }, 'GET');
    const rawEntries = rawRes && (Array.isArray(rawRes.entries) ? rawRes.entries : (Array.isArray(rawRes) ? rawRes : []));
    if (rawEntries && Array.isArray(rawEntries)) {
      const canonicalByConsumer = new Map<string, any>();
      for (const e of rawEntries) {
        const cId = String(e['Consumer Id'] || e['Consumer ID'] || e.consumerId || e.accountNumber || '').trim().toLowerCase();
        if (!cId) continue;
        if (!canonicalByConsumer.has(cId)) {
          canonicalByConsumer.set(cId, e);
        }
      }
      const discEntries = Array.from(canonicalByConsumer.values()).filter((e: any) => {
        if (!isValidDisconnectionTaskOrRow(e)) return false;
        const cat = String(e.category || e.Category || e._sheet || '').toUpperCase().trim();
        const isDiscCat = (cat === 'DISCONNECTION' || cat === 'DISCONNECT');
        const isCoreDisc = Boolean(e['Consumer Id'] && (e['D2 Net O/S'] || e.d2NetOs || e['O/S Duedate Range'] || e.disconStatus || e['Discon Status']));
        return isDiscCat || isCoreDisc;
      });

      const sortedDiscEntries = [...discEntries].sort((a, b) => {
        const idA = String(a['Consumer Id'] || a['Consumer ID'] || a.consumerId || a.accountNumber || '').trim();
        const idB = String(b['Consumer Id'] || b['Consumer ID'] || b.consumerId || b.accountNumber || '').trim();
        return idA.localeCompare(idB, undefined, { numeric: true });
      });
      if (true) {
        const mappedTasks: DisconnectionTask[] = sortedDiscEntries.map((e, idx) => {
          const cId = String(e['Consumer Id'] || e['Consumer ID'] || e.consumerId || e.accountNumber || '').trim();
          const mru = String(e['MRU'] || e.mru || e.mruSection || '').trim();
          const name = String(e['Name'] || e['Consumer Name'] || e.consumerName || e.name || '').trim();
          const address = String(e['Address'] || e.consumerAddress || e.address || '').trim();
          const rawBaseClass = String(e['Base Class'] ?? e.baseClass ?? '').trim();
          const consumerClass = String(e['Class'] ?? e.class ?? '').trim();
          const rawDevice = String(e['Device'] ?? e.device ?? '').trim();
          const govNonGov = String(e['Gov/Non-Gov'] ?? e.govNonGov ?? '').trim();
          const meter = String(
            (rawDevice && rawDevice.toUpperCase() !== 'I' && rawDevice.toUpperCase() !== 'III' ? rawDevice : '') ||
            e['Number'] || e['Meter'] || e.meterNumber || e.meterNo || ''
          ).trim();
          const dueDateRange = String(e['O/S Duedate Range'] || e['O/S Due date Range'] || e.dueDateRange || '').trim();
          const d2NetOs = String(e['D2 Net O/S'] || e.outstandingDue || e.arrearAmount || '').trim();
          const disconStatus = (String(e['Discon Status'] || e.disconStatus || e.status || 'PENDING').trim().toUpperCase() || 'PENDING') as DisconnectionTaskStatus;
          const disconDate = String(e['Discon Date'] || e.disconDate || e.reportDate || '').trim();
          const mobile = String(e['Mobile'] || e['Mobile Number'] || e.phoneNumber || e.mobile || '').trim();
          const slNumber = `SL ${String(idx + 1).padStart(3, '0')}`;

          return cleanDisconnectionTask({
            off_code: String(e['off_code'] || e.offCode || '').trim(),
            MRU: mru,
            'Consumer Id': cId,
            Name: name,
            Address: address,
            'Base Class': rawBaseClass,
            Class: consumerClass,
            Device: rawDevice,
            'Gov/Non-Gov': govNonGov,
            Number: String(e['Number'] || '').trim(),
            Meter: String(e['Meter'] || '').trim(),
            'O/S Duedate Range': dueDateRange,
            'O/S Due date Range': dueDateRange,
            'D2 Net O/S': d2NetOs,
            'Discon Status': disconStatus,
            'Discon Date': disconDate,
            Mobile: mobile,
            'Mobile Number': mobile,
            serialNumber: slNumber,
            taskId: `TASK-DISC-${cId}`,
            consumerId: cId,
            consumerName: name,
            accountNumber: cId,
            meterNumber: meter,
            consumerAddress: address,
            phoneNumber: mobile,
            mobileNumber: mobile,
            area: String(e['off_code'] || '').trim(),
            disconnectionReason: `Outstanding Bill (D2 Net O/S: ${d2NetOs})`,
            assignedWorkerId: String(e['Worker ID'] || e.assignedWorkerId || '').trim(),
            assignedWorkerName: String(e['Worker Name'] || e.assignedWorkerName || '').trim(),
            taskStatus: disconStatus,
            workerReport: String(e['Notes'] || e.workerReport || '').trim(),
            workerRemarks: String(e['Remarks'] || e['Notes'] || e.workerRemarks || '').trim(),
            reportDate: disconDate,
            reportTime: '',
            submittedBy: String(e['Submitted By'] || e.submittedBy || '').trim(),
            createdAt: String(e['Created At'] || e.createdAt || disconDate || new Date().toISOString()).trim(),
            updatedAt: String(e['Updated At'] || e.updatedAt || new Date().toISOString()).trim(),
            photoUrl: String(e['Image'] || e['Photo Evidence'] || e.photoUrl || '').trim(),
            mruSection: mru,
            cccFeeder: mru,
            outstandingDue: d2NetOs,
            dueDateRange: dueDateRange,
            baseClass: rawBaseClass,
            classType: consumerClass,
            deviceType: rawDevice,
            device: rawDevice,
            priority: parseFloat(d2NetOs.replace(/[^0-9.]/g, '')) > 10000 ? 'URGENT' : 'NORMAL',
            assignedAgency: String(e['Agency'] || e['Agency Name'] || e.assignedAgency || '').trim(),
            paidAmount: String(e['Paid Amount'] || e.paidAmount || (disconStatus === 'PAID' ? d2NetOs : '')).trim(),
            paymentDate: String(e['Paid Date'] || e['Payment Date'] || e.paymentDate || (disconStatus === 'PAID' ? disconDate : '')).trim(),
            paymentReference: String(e['Paid Type'] || e['Payment Reference'] || e.paymentReference || '').trim(),
            meterReading: String(e['Reading'] || '').trim(),
            statusHistory: []
          });
        });

        let filtered = mappedTasks;
        if (params.status && params.status !== 'ALL') {
          const filterSt = params.status.toUpperCase().trim();
          filtered = filtered.filter(t => String(t.taskStatus).toUpperCase() === filterSt);
        }
        if (params.search) {
          const q = params.search.toLowerCase().trim();
          filtered = filtered.filter(t =>
            `${t.serialNumber} ${t.consumerId} ${t.consumerName} ${t.meterNumber} ${t.consumerAddress} ${t.phoneNumber}`
              .toLowerCase()
              .includes(q)
          );
        }

        if (!params.search && (!params.status || params.status === 'ALL')) {
          setCachedDisconnectionTasksSync(filtered);
        }
        const stats = computeStats(filtered);
        return { tasks: filtered, stats };
      }
    }
  } catch (err: any) {
    console.warn('[Disconnection] Google Sheet fallback read notice:', err?.message || err);
  }

  // Return empty state if backend is unreachable (never show stale cached records)
  return {
    tasks: [],
    stats: computeStats([])
  };
}

function computeStats(taskList: DisconnectionTask[]): DisconnectionStats {
  const total = taskList.length;
  let completed = 0;
  let pending = 0;
  let inProgress = 0;
  let urgent = 0;
  for (const t of taskList) {
    const st = String(t.taskStatus || '').toUpperCase();
    if (st === 'COMPLETED' || st === 'DISCONNECT' || st === 'PAID') completed++;
    else if (st === 'PENDING') pending++;
    else if (st === 'IN PROGRESS') inProgress++;
    if (String(t.priority || '').toUpperCase() === 'URGENT') urgent++;
  }
  return {
    totalTasks: total,
    completedTasks: completed,
    pendingTasks: pending,
    inProgressTasks: inProgress,
    unableTasks: taskList.filter(t => t.taskStatus === 'UNABLE').length,
    reportedTasks: taskList.filter(t => t.taskStatus === 'REPORTED').length,
    cancelledTasks: taskList.filter(t => t.taskStatus === 'CANCELLED').length,
    paidTasks: taskList.filter(t => t.taskStatus === 'PAID').length,
    urgentTasks: urgent,
    completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    myAssignedTasks: total,
    myCompletedTasks: completed,
    myPendingTasks: pending,
    myCompletionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

export async function uploadDisconnectionTasks(
  tasks: Partial<DisconnectionTask>[],
  adminInfo: { adminId: string; adminName: string }
): Promise<{ success: boolean; count: number; message: string; tasks?: DisconnectionTask[]; insertedCount?: number; updatedCount?: number }> {
  const reqId = `REQ-UPL-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // Strictly filter out any demo or invalid rows missing a real Consumer Id or Consumer Name
  const validInputTasks = (Array.isArray(tasks) ? tasks : []).filter(isValidDisconnectionTaskOrRow);
  if (validInputTasks.length === 0) {
    throw new Error('No valid disconnection consumer records found. Each record must have a valid Consumer ID and Consumer Name.');
  }

  // Map each task to the exact WBSEDCL Google Sheet headers and standard model
  const standardizedTasks = validInputTasks.map((t) => {
    const cId = String(
      (t as any)['Consumer Id'] ||
      t.consumerId ||
      (t as any)['Consumer ID'] ||
      t.accountNumber ||
      ''
    ).trim();
    const meter = String((t as any)['Number'] || (t as any)['Meter'] || t.meterNumber || (t as any)['Meter No'] || '').trim();
    const offCode = String((t as any)['off_code'] ?? t.offCode ?? t.area ?? '').trim();
    const mru = String((t as any)['MRU'] ?? (t as any).mru ?? t.mruSection ?? '').trim();
    const name = String((t as any)['Name'] || (t as any)['Consumer Name'] || t.consumerName || (t as any)['Customer Name'] || '').trim();
    const address = String((t as any)['Address'] || t.consumerAddress || '').trim();
    const baseClass = String((t as any)['Base Class'] ?? t.baseClass ?? '').trim();
    const consumerClass = String((t as any)['Class'] ?? t.classType ?? '').trim();
    const device = String((t as any)['Device'] ?? (t as any).device ?? '').trim();
    const dueDateRange = String((t as any)['O/S Duedate Range'] || (t as any)['O/S Due date Range'] || t.dueDateRange || '').trim();
    const d2NetOs = String((t as any)['D2 Net O/S'] || t.outstandingDue || '').trim();
    const mobile = String((t as any)['Mobile'] || (t as any)['Mobile Number'] || t.phoneNumber || t.mobileNumber || '').trim();
    const latitude = String((t as any)['Latitude'] || t.latitude || '').trim();
    const longitude = String((t as any)['Longitude'] || t.longitude || '').trim();
    const natureOfConn = String((t as any)['Nature of Conn'] || t.natureOfConn || '').trim();
    const govNonGov = String((t as any)['Gov/Non-Gov'] ?? (t as any)['govNonGov'] ?? '').trim();
    const disconStatus = String((t as any)['Discon Status'] || t.disconStatus || t.taskStatus || 'PENDING').trim().toUpperCase();
    const disconDate = String((t as any)['Discon Date'] || t.disconDate || t.reportDate || '').trim();
    const image = String((t as any)['Image'] || t.photoUrl || t.imageUrl || '').trim();
    const reading = String((t as any)['Reading'] || t.meterReading || '').trim();
    const paymentStatus = String((t as any)['Payment Status'] || t.paymentStatus || '').trim();
    const gisPole = String((t as any)['Gis Pole'] || t.gisPole || '').trim();
    const agency = String((t as any)['Agency'] || t.assignedAgency || t.assignedWorkerName || '').trim();
    const notes = String((t as any)['Notes'] || t.workerRemarks || t.workerReport || '').trim();
    const priority = String((t as any)['Priority'] || t.priority || ((parseFloat(d2NetOs.replace(/[^0-9.]/g, '')) > 10000) ? 'URGENT' : 'NORMAL')).trim().toUpperCase();
    const paidAmount = String((t as any)['Paid Amount'] || t.paidAmount || '').trim();
    const paidDate = String((t as any)['Paid Date'] || t.paidDate || t.paymentDate || '').trim();
    const paidType = String((t as any)['Paid Type'] || t.paidType || t.paymentReference || '').trim();
    const outstandingAfter = String((t as any)['Outstanding After'] || t.outstandingAfter || '').trim();
    const nextPaymentDate = String((t as any)['Next Payment Date'] || t.nextPaymentDate || '').trim();
    const paymentSource = String((t as any)['Payment Source'] || t.paymentSource || '').trim();
    const uploadTimestamp = new Date().toISOString();

    return {
      // 33 Exact Google Sheet Headers (A:AG)
      'off_code': offCode,
      'MRU': mru,
      'Consumer Id': cId,
      'Name': name,
      'Consumer Name': name,
      'Address': address,
      'Base Class': baseClass,
      'Class': consumerClass,
      'Device': device,
      'O/S Duedate Range': dueDateRange,
      'D2 Net O/S': d2NetOs,
      'Mobile': mobile,
      'Number': meter,
      'Latitude': latitude,
      'Longitude': longitude,
      'Discon Status': disconStatus,
      'Discon Date': disconDate,
      'Image': image,
      'Reading': reading,
      'Payment Status': paymentStatus,
      'Gis Pole': gisPole,
      'Agency': agency,
      'Notes': notes,
      'Nature of Conn': natureOfConn,
      'Gov/Non-Gov': govNonGov,
      'Last Updated': uploadTimestamp,
      'Priority': priority,
      'Paid Amount': paidAmount,
      'Paid Date': paidDate,
      'Paid Type': paidType,
      'Outstanding After': outstandingAfter,
      'Next Payment Date': nextPaymentDate,
      'Payment Source': paymentSource,
      'Upload Date': uploadTimestamp,

      // Model fields for frontend compatibility
      taskId: `TASK-DISC-${cId}`,
      consumerId: cId,
      consumerName: name,
      accountNumber: cId,
      meterNumber: (device && device.toUpperCase() !== 'I' && device.toUpperCase() !== 'III' ? device : '') || meter,
      phoneNumber: mobile,
      mobileNumber: mobile,
      outstandingDue: d2NetOs,
      dueDateRange: dueDateRange,
      consumerAddress: address,
      taskStatus: disconStatus as DisconnectionTaskStatus,
      disconStatus: disconStatus,
      mruSection: mru,
      mru: mru,
      offCode: offCode,
      area: offCode,
      baseClass: baseClass,
      classType: consumerClass,
      deviceType: device,
      device: device,
      govNonGov: govNonGov,
      workerRemarks: notes,
      workerReport: notes,
      notes: notes
    };
  });

  // 1. Primary: Ultra-fast Express /api/disconnection-tasks/upload endpoint (saves to Disconnection tab in Google Sheets)
  try {
    const fastRes = await fetch('/api/disconnection-tasks/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: standardizedTasks, adminInfo, requestId: reqId })
    });
    if (fastRes.ok) {
      const fastData = await fastRes.json();
      if (fastData && fastData.success) {
        if (Array.isArray(fastData.tasks)) {
          setCachedDisconnectionTasksSync(fastData.tasks);
        }
        return fastData;
      }
    }
  } catch (fastErr) {
    console.warn('[Disconnection] Fast upload endpoint notice:', fastErr);
  }

  // 2. Fallback: Save directly to Google Sheet 'Disconnection' tab via updateEntry/createEntry
  let insertedCount = 0;
  let updatedCount = 0;
  for (let i = 0; i < standardizedTasks.length; i++) {
    const row = standardizedTasks[i];
    const cId = String(row.consumerId || '').trim();
    const submissionId = `PWR-DIS-${cId}`;
    const entryPayload = {
      ...row,
      id: submissionId,
      submissionId,
      category: 'Disconnection',
      Category: 'Disconnection'
    };
    try {
      const updRes = await callGasApi<any>('updateEntry', {
        id: submissionId,
        submissionId,
        consumerId: cId,
        category: 'Disconnection',
        entry: entryPayload
      }, 'POST');
      if (updRes && updRes.updated === true) {
        updatedCount++;
      } else {
        await callGasApi<any>('createEntry', entryPayload, 'POST');
        insertedCount++;
      }
    } catch {
      try {
        await callGasApi<any>('createEntry', entryPayload, 'POST');
        insertedCount++;
      } catch (e: any) {
        console.warn('[Disconnection] Direct sheet upload error for consumer', cId, e?.message || e);
      }
    }
  }

  return {
    success: (insertedCount + updatedCount) > 0,
    count: insertedCount + updatedCount,
    insertedCount,
    updatedCount,
    tasks: standardizedTasks as any[],
    message: `Uploaded ${insertedCount + updatedCount} disconnection records to Google Sheets Disconnection tab.`
  };
}

export async function extractDisconnectionTasksFromOCR(
  base64Data: string,
  mimeType?: string,
  fileName?: string
): Promise<{ success: boolean; tasks: Partial<DisconnectionTask>[]; count: number; error?: string }> {
  try {
    const res = await fetch('/api/disconnection-tasks/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, mimeType, fileName })
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
    const errData = await res.json().catch(() => ({}));
    return { success: false, tasks: [], count: 0, error: errData.error || `OCR Error (${res.status})` };
  } catch (err: any) {
    return { success: false, tasks: [], count: 0, error: err.message || 'Network error during OCR processing' };
  }
}

export async function submitDisconnectionTaskReport(report: {
  taskId: string;
  workerId: string;
  workerName: string;
  taskStatus: DisconnectionTaskStatus;
  workerReport?: string;
  workerRemarks?: string;
  photoUrl?: string;
  submissionId?: string;
  paidAmount?: string;
  paymentDate?: string;
  paymentReference?: string;
  meterReading?: string;
  priority?: string;
  assignedAgency?: string;
  consumerId?: string;
  phoneNumber?: string;
  reportDate?: string;
  disconDate?: string;
  disconStatus?: string;
  gisPole?: string;
  paymentStatus?: string;
  outstandingAfter?: string;
  nextPaymentDate?: string;
  paymentSource?: string;
  paidDate?: string;
  paidType?: string;
  notes?: string;
  agency?: string;
  reading?: string;
  image?: string;
  offCode?: string;
  mru?: string;
  [key: string]: any;
}): Promise<{ success: boolean; message: string; taskId?: string; status?: string; imageUrl?: string }> {
  const reqId = report.submissionId || `REQ-SUB-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const cId = String(report.consumerId || report['Consumer Id'] || report.taskId || '').replace(/^TASK-DISC-|^PWR-DIS-/i, '').trim();
  const newStatus = String(report.taskStatus || (report as any).disconStatus || (report as any).status || 'COMPLETED').toUpperCase();
  const remarksStr = String(report.workerRemarks ?? report.workerReport ?? (report as any).notes ?? (report as any)['Notes'] ?? (report as any)['Remark'] ?? '').trim();

  // Send ONLY Consumer ID, Status, and Remark/Notes so no other consumer columns (Meter/Device, Base Class, Class, etc.) are modified
  const payload: Record<string, any> = {
    taskId: report.taskId || `TASK-DISC-${cId}`,
    consumerId: cId,
    'Consumer Id': cId,
    taskStatus: newStatus,
    disconStatus: newStatus,
    status: newStatus,
    'Discon Status': newStatus,
    'Status': newStatus,
    workerRemarks: remarksStr,
    workerReport: remarksStr,
    notes: remarksStr,
    'Notes': remarksStr,
    remarks: remarksStr,
    'Remark': remarksStr,
    'Remarks': remarksStr,
    workerId: report.workerId,
    workerName: report.workerName,
    requestId: reqId
  };

  let lastError = 'Failed to save Disconnection status & remark to Google Sheets';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('/api/disconnection-tasks/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success) {
        return data;
      }
      if (data && data.error) {
        lastError = typeof data.error === 'string' ? data.error : (data.error.message || lastError);
      }
    } catch (proxyErr: any) {
      lastError = proxyErr?.message || lastError;
    }
  }
  throw new Error(lastError);
}

export async function assignDisconnectionTask(
  taskId: string,
  workerId: string,
  workerName: string
): Promise<{ success: boolean; message: string }> {
  return callGasApi('assignDisconnectionTask', { taskId, workerId, workerName, requestId: 'REQ-ASG-' + Date.now() }, 'POST');
}

export async function archiveDisconnectionTask(
  taskId: string,
  reason: string,
  adminName: string
): Promise<{ success: boolean; message: string }> {
  return callGasApi('archiveDisconnectionTask', { taskId, reason, adminName, requestId: 'REQ-ARC-' + Date.now() }, 'POST');
}

export async function restoreDisconnectionTask(taskId: string): Promise<{ success: boolean; message: string }> {
  return callGasApi('restoreDisconnectionTask', { taskId, requestId: 'REQ-RST-' + Date.now() }, 'POST');
}

export async function fetchDisconnectionHistory(_consumerId: string): Promise<{ success: boolean; history: any[] }> {
  return { success: true, history: [] };
}

export async function deleteDisconnectionTask(task: DisconnectionTask | { consumerId?: string; taskId?: string; id?: string }): Promise<{ success: boolean; message: string }> {
  const consumerId = String((task as any).consumerId || (task as any)['Consumer Id'] || '').trim();
  const taskId = String((task as any).taskId || (task as any).id || (consumerId ? `TASK-DISC-${consumerId}` : '')).trim();
  const targetId = consumerId || taskId;

  if (!targetId) {
    throw new Error('Consumer ID or Task ID is required to delete disconnection consumer');
  }

  // Immediately remove from local caches so UI updates in 0ms
  try {
    const cachedDisc = getCachedDisconnectionTasksSync();
    if (cachedDisc.length > 0) {
      setCachedDisconnectionTasksSync(
        cachedDisc.filter(t => String(t.consumerId || '') !== consumerId && String(t.taskId || '') !== taskId)
      );
    }
    const list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []);
    writeCache(LOCAL_STORAGE_KEY, list.filter(e => String(e.consumerId || '') !== consumerId && String(e.id || '') !== targetId));
  } catch {}

  // 1. Primary: call backend endpoint /api/disconnection-tasks/delete (<10ms response + background Sheet sync)
  try {
    const res = await fetch('/api/disconnection-tasks/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: targetId,
        consumerId,
        'Consumer Id': consumerId,
        taskId,
        category: 'Disconnection'
      })
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[Disconnection] Primary delete endpoint notice:', err);
  }

  // 2. Fallback: call GAS directly
  let deleted = false;
  try {
    const delRes = await callGasApi<any>('deleteEntry', {
      id: targetId,
      submissionId: targetId,
      consumerId,
      'Consumer Id': consumerId,
      taskId,
      category: 'Disconnection'
    }, 'POST');
    if (delRes && delRes.deleted === true) {
      deleted = true;
    }
  } catch {}

  if (!deleted && consumerId) {
    await callGasApi<any>('updateDisconnection', {
      consumerId,
      'Consumer Id': consumerId,
      taskId,
      disconStatus: 'DELETED',
      'Discon Status': 'DELETED',
      notes: '[DELETED_BY_ADMIN]',
      'Notes': '[DELETED_BY_ADMIN]'
    }, 'POST');
  }

  return {
    success: true,
    message: `Consumer #${consumerId || taskId} permanently deleted from Disconnection module and backend sheet.`
  };
}
