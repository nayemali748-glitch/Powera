import { PowerEntry, StatsResponse, CategoryType, UserAccount, UserSession, WorkOrderNotice, ChatMessage, DisconnectionTask, DisconnectionTaskStatus, DisconnectionStats } from '../types';
import { normalizeUniversalText, normalizePassword } from '../utils/textNormalizer';
import { deduplicateEntries, normalizeEntry } from '../utils/entryNormalizer';
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
    // Only strip huge base64 data URIs to keep localStorage quota safe, never strip Drive URLs
    if (photo && photo.startsWith('data:') && photo.length > 5000) {
      photo = '';
    }
    return {
      ...w,
      photoUrl: photo,
      directImageUrl: w.directImageUrl || photo,
    };
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
      options.headers = { 'Accept': 'application/json' };
    } else {
      options.method = 'POST';
      // Plain text content-type prevents browser CORS preflight blocks across Google redirects
      options.headers = {
        'Content-Type': 'text/plain;charset=utf-8',
        'Accept': 'application/json'
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
          signal: directController.signal, 
          headers: { 'Accept': 'application/json' } 
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
        const res = await callGasApi<{ success: boolean; entry?: PowerEntry; duplicate?: boolean }>('createEntry', { data: cleanItem }, 'POST');
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
}): Promise<PowerEntry[]> {
  try {
    const params: Record<string, string> = {};
    if (filters?.category && filters.category !== 'ALL') params.category = filters.category;
    if (filters?.status && filters.status !== 'ALL') params.status = filters.status;
    if (filters?.search) params.search = filters.search;
    if (filters?.workerId) params.workerId = filters.workerId;
    if (filters?.workerName) params.workerName = filters.workerName;

    const data = await callGasApi<{ success: boolean; entries: PowerEntry[] }>('entries', params, 'GET');
    const rawList = Array.isArray(data.entries) ? data.entries : [];
    const uniqueEntries = deduplicateEntries(rawList);
    
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

// Map category to explicit Apps Script action
// Map category to explicit Apps Script action - 'createEntry' is the canonical GAS action
export function getCreateActionForCategory(_cat?: string): string {
  return 'createEntry';
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
    workerId: String(entryData.workerId || currentUser?.idNo || currentUser?.id || ''),
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
    let res: { success: boolean; entry?: PowerEntry; data?: PowerEntry; duplicate?: boolean; recordId?: string; message?: string } | null = null;
    let backendError: any = null;

    // 1. Send submission request to backend proxy
    try {
      res = await callGasApi<{ success: boolean; entry?: PowerEntry; data?: PowerEntry; duplicate?: boolean; recordId?: string; message?: string }>(
        'createEntry',
        { data: cleanEntry },
        'POST',
        30000
      );
    } catch (err: any) {
      backendError = err;
      console.warn('Proxy createEntry attempt error, trying fallback to /api/entries:', err?.message || err);
    }

    // 2. Fallback to Express /api/entries if proxy had a network glitch or timeout
    if (!res || res.success === false) {
      try {
        const localRes = await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanEntry)
        });
        const localData = await localRes.json();
        if (localData && (localData.success || localData.entry)) {
          res = { success: true, entry: localData.entry || cleanEntry };
          backendError = null;
        }
      } catch (localErr) {
        console.warn('Fallback /api/entries error:', localErr);
      }
    }

    // 3. Fallback to offline queue if client has completely lost connectivity
    if (!res || res.success === false) {
      console.warn('Network unavailable, storing entry safely in offline queue:', backendError?.message || backendError);
      const offlineEntry: PowerEntry & { _isPendingSync?: boolean } = {
        ...cleanEntry,
        _isPendingSync: true
      };
      try {
        const list = readCache<(PowerEntry & { _isPendingSync?: boolean })[]>(LOCAL_STORAGE_KEY, []);
        const filtered = list.filter(e => e.id !== offlineEntry.id && e.submissionId !== offlineEntry.submissionId);
        writeCache(LOCAL_STORAGE_KEY, [offlineEntry, ...filtered]);
      } catch {}
      return offlineEntry as PowerEntry;
    }

    // 3. Data successfully saved and confirmed by Google Sheets!
    const confirmedEntry: PowerEntry = normalizeEntry(res.entry || res.data || cleanEntry);

    // Update local cache for instant read synchronization in the Admin Panel and Worker Recent Submissions
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

  let deletedSuccessfully = false;
  let lastErrorMessage = '';

  // 1. Primary Method: POST /api/entries/:id/delete (Immune to proxy HTTP 405 Method Not Allowed)
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
        // If already deleted or not found, consider it cleaned up
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

  // Update local storage cache immediately so UI reflects deletion
  const list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []);
  writeCache(LOCAL_STORAGE_KEY, list.filter(e => e.id !== cleanId && e.submissionId !== cleanId));

  if (!deletedSuccessfully && lastErrorMessage) {
    // If it's a critical record notice or other error, throw meaningful error
    throw new Error(lastErrorMessage);
  }

  return true;
}

export async function clearAllEntries(confirmPhrase: string = 'CONFIRM_PERMANENT_WIPE'): Promise<boolean> {
  try {
    const res = await callGasApi<{ success?: boolean; error?: any; message?: string }>('clearEntries', { confirmClearAll: confirmPhrase }, 'POST');
    if (res && res.success === false) {
      const msg = typeof res.error === 'object' ? (res.error?.message || JSON.stringify(res.error)) : (res.error || res.message || 'Server rejected bulk clear');
      throw new Error(msg);
    }
  } catch (e: any) {
    console.warn('Clear entries notice:', e);
    throw e;
  }
  writeCache(LOCAL_STORAGE_KEY, []);
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

export async function fetchUsers(): Promise<UserAccount[]> {
  try {
    // 1. Try Express API proxy first
    if (typeof window !== 'undefined') {
      try {
        const pRes = await fetch('/api/users');
        if (pRes.ok) {
          const pData = await pRes.json();
          const list = pData?.users || pData?.data?.users;
          if (Array.isArray(list) && list.length > 0) {
            const sanitized: UserAccount[] = list.map((u: any) => ({
              id: u.id || `usr_${u.idNo || u.phone}`,
              idNo: String(u.idNo || u.phone || u.id),
              uid: u.uid,
              name: String(u.name || u['Full Name'] || u.idNo || 'কর্মী'),
              phone: String(u.phone || u['Phone'] || '').trim(),
              role: (String(u.role || u['Role'] || 'worker').trim().toLowerCase() === 'admin' ? 'admin' : 'worker') as 'admin' | 'worker',
              status: (u.status || u['Status'] || 'active') as 'active' | 'hold',
              designation: String(u.designation || u['Designation'] || ''),
              badgeNo: String(u.badgeNo || u['Badge No'] || u.idNo || ''),
              createdAt: String(u.createdAt || ''),
              updatedAt: String(u.updatedAt || ''),
              lastLogin: String(u.lastLogin || '')
            }));
            writeCache(USERS_CACHE_KEY, sanitized);
            return sanitized;
          }
        }
      } catch {}
    }

    // 2. Direct Google Apps Script failover
    const directRes = await callGasApi<any>('users', {}, 'GET');
    const directList = directRes?.users || directRes?.data?.users;
    if (Array.isArray(directList) && directList.length > 0) {
      const sanitized: UserAccount[] = directList.map((u: any) => ({
        id: u.id || `usr_${u.idNo || u.phone}`,
        idNo: String(u.idNo || u.phone || u.id),
        uid: u.uid,
        name: String(u.name || u['Full Name'] || u.idNo || 'কর্মী'),
        phone: String(u.phone || u['Phone'] || '').trim(),
        role: (String(u.role || u['Role'] || 'worker').trim().toLowerCase() === 'admin' ? 'admin' : 'worker') as 'admin' | 'worker',
        status: (u.status || u['Status'] || 'active') as 'active' | 'hold',
        designation: String(u.designation || u['Designation'] || ''),
        badgeNo: String(u.badgeNo || u['Badge No'] || u.idNo || ''),
        createdAt: String(u.createdAt || ''),
        updatedAt: String(u.updatedAt || ''),
        lastLogin: String(u.lastLogin || '')
      }));
      writeCache(USERS_CACHE_KEY, sanitized);
      return sanitized;
    }

    const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
    return cached;
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
  const payload = {
    id: `usr_${finalId}`,
    idNo: finalId,
    phone: cleanPhone,
    name: cleanName,
    password: cleanPassword,
    role: (userData.role || 'worker') as 'admin' | 'worker' | 'supervisor',
    status: (userData.status || 'active') as 'active' | 'hold',
    designation: userData.designation || (userData.role === 'admin' ? 'সহকারী প্রকৌশলী / Admin (WBSEDCL)' : 'লাইনম্যান / Worker (WBSEDCL)'),
    badgeNo: userData.badgeNo || finalId,
    securityQuestion: userData.securityQuestion || '',
    securityAnswer: userData.securityAnswer || ''
  };

  // 1. Try server endpoint
  if (typeof window !== 'undefined') {
    try {
      const resp = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload })
      });
      if (resp.ok) {
        const resData = await resp.json();
        const rawCreated = (resData?.user || resData?.data?.user || payload) as UserAccount;
        const created = { ...rawCreated };
        delete (created as any).password;
        delete (created as any).passwordHash;
        const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
        writeCache(USERS_CACHE_KEY, [created, ...cached.filter(u => u.idNo !== created.idNo)]);
        return created;
      }
    } catch {}
  }

  // 2. Direct GAS failover
  const gasRes = await callGasApi<any>('createUser', { data: payload }, 'POST');
  const rawCreated = (gasRes?.user || gasRes?.data?.user || payload) as UserAccount;
  const created = { ...rawCreated };
  delete (created as any).password;
  delete (created as any).passwordHash;
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: safeUpdates })
      });
      if (resp.ok) {
        const resData = await resp.json();
        const rawUpdated = (resData?.user || resData?.data || { id: cleanId, ...safeUpdates }) as UserAccount;
        const updated = { ...rawUpdated };
        delete (updated as any).password;
        delete (updated as any).passwordHash;
        const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
        writeCache(USERS_CACHE_KEY, cached.map(u => (u.id === cleanId || u.idNo === cleanId) ? { ...u, ...updated } : u));
        return updated;
      }
    } catch {}
  }

  // 2. Direct GAS failover
  const gasRes = await callGasApi<any>('updateUser', { id: cleanId, data: safeUpdates }, 'POST');
  const rawUpdated = (gasRes?.user || gasRes?.data || { id: cleanId, ...safeUpdates }) as UserAccount;
  const updated = { ...rawUpdated };
  delete (updated as any).password;
  delete (updated as any).passwordHash;
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

  // 1. Try server endpoint
  if (typeof window !== 'undefined') {
    try {
      const resp = await fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {})
      });
      if (resp.ok) {
        const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
        writeCache(USERS_CACHE_KEY, cached.filter(u => u.id !== id && u.idNo !== id));
        return true;
      }
    } catch {}
  }

  // 2. Direct GAS failover
  await callGasApi<any>('deleteUser', { id, ...options }, 'POST');
  const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
  writeCache(USERS_CACHE_KEY, cached.filter(u => u.id !== id && u.idNo !== id));
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
    const cleanDigits = clean.replace(/[^0-9]/g, '');
    const users = await fetchUsers();

    const u = users.find(user => {
      const uId = normalizeUniversalText(user.idNo || user.id || '').trim().toLowerCase();
      const uPhone = String(user.phone || '').replace(/[^0-9]/g, '');
      return uId === clean || (cleanDigits.length >= 10 && uPhone.endsWith(cleanDigits.slice(-10)));
    });

    if (u) {
      return { valid: true, status: u.status || 'active' };
    }
    return { valid: false, error: 'User profile not found' };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Verification error' };
  }
}

export async function loginUser(loginId: string, password: string): Promise<UserSession> {
  const cleanId = normalizeUniversalText(loginId).trim();
  const cleanPass = normalizePassword(password);
  if (!cleanId || !cleanPass) {
    throw new Error('ইউজার আইডি / মোবাইল নম্বর এবং পাসওয়ার্ড প্রয়োজন (User ID / Phone & Password required)');
  }

  let resData: any = null;

  // 1. Try Express API proxy route
  if (typeof window !== 'undefined') {
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: cleanId, password: cleanPass })
      });
      const data = await resp.json();
      if (resp.ok && data.success && data.session) {
        resData = data;
      } else if (data && data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : (data.error?.message || 'ভুল ইউজার আইডি বা পাসওয়ার্ড'));
      }
    } catch (fetchErr: any) {
      if (fetchErr.message && !fetchErr.message.includes('Failed to fetch') && !fetchErr.message.includes('NetworkError')) {
        throw fetchErr;
      }
    }
  }

  // 2. Direct Google Apps Script Web App failover
  if (!resData) {
    const gasRes = await callGasApi<any>('login', { idNo: cleanId, password: cleanPass }, 'POST');
    if (gasRes && (gasRes.session || gasRes.data?.session)) {
      resData = { success: true, session: gasRes.session || gasRes.data?.session };
    } else if (gasRes && gasRes.error) {
      throw new Error(typeof gasRes.error === 'string' ? gasRes.error : (gasRes.error?.message || 'ভুল ইউজার আইডি বা পাসওয়ার্ড'));
    }
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

export async function fetchWorkOrders(category?: string): Promise<WorkOrderNotice[]> {
  try {
    const params: Record<string, string> = {};
    if (category && category !== 'ALL') params.category = category;
    
    // First try Google Apps Script (Primary Source)
    let rawList: any[] = [];
    let fetchedSuccessfully = false;

    try {
      const data = await callGasApi<{ success: boolean; workOrders: WorkOrderNotice[] }>('workorders', params, 'GET');
      if (data && data.success && Array.isArray(data.workOrders)) {
        rawList = data.workOrders;
        fetchedSuccessfully = true;
      }
    } catch {
      // Direct GAS fetch failed or timed out; will fall back to proxy
    }

    // Proxy fallback ONLY if direct GAS fetch failed
    if (!fetchedSuccessfully) {
      try {
        const pUrl = category && category !== 'ALL' ? `/api/work-orders?category=${encodeURIComponent(category)}` : '/api/work-orders';
        const res = await fetch(pUrl);
        if (res.ok) {
          const pData = await res.json();
          if (Array.isArray(pData)) {
            rawList = pData;
            fetchedSuccessfully = true;
          }
        }
      } catch {}
    }

    if (fetchedSuccessfully) {
      const validOrders = rawList.filter(w => w && (w.id || w.title || w.photoUrl || w.fileId));
      const seen = new Set<string>();
      const uniqueOrders: WorkOrderNotice[] = [];
      validOrders.forEach((w, idx) => {
        const idKey = String(w.id || `wo-${idx + 1}-${w.createdAt || Date.now()}`).trim();
        let photo = w.photoUrl || w.directImageUrl || '';
        if (!photo && w.description && (String(w.description).startsWith('http') || String(w.description).startsWith('data:'))) {
          photo = String(w.description);
        }
        if (!photo && w.fileId) {
          photo = `https://drive.google.com/thumbnail?id=${w.fileId}&sz=w2000`;
        }
        // Normalize Google Drive viewer URLs to direct thumbnail
        if (photo && photo.includes('drive.google.com') && !photo.includes('thumbnail')) {
          const match = photo.match(/[\/=]([a-zA-Z0-9_-]{25,})/);
          if (match && match[1]) {
            photo = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w2000`;
          }
        }

        const normalizedOrder: WorkOrderNotice = {
          ...w,
          id: seen.has(idKey) ? `${idKey}-${idx + 1}` : idKey,
          photoUrl: photo,
          directImageUrl: w.directImageUrl || photo,
          description: (w.description && (String(w.description).startsWith('http') || String(w.description).startsWith('data:'))) ? '' : (w.description || '')
        };

        seen.add(normalizedOrder.id);
        uniqueOrders.push(normalizedOrder);
      });
      writeCache(WORK_ORDERS_STORAGE_KEY, sanitizeWorkOrdersForCache(uniqueOrders));
      return uniqueOrders;
    }
  } catch {}
  return readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []);
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
  const uploadPayload = {
    ...payload,
    fileData: payload.fileData || payload.photoUrl,
    description: payload.description || payload.photoUrl,
    fileName: payload.fileName || `WBSEDCL_Notice_${Date.now()}.jpg`,
    fileType: payload.fileType || 'image/jpeg',
  };

  // Attempt 1: Direct Google Apps Script upload (stores file in Google Drive, record in Google Sheets)
  try {
    const data = await callGasApi<{ success: boolean; workOrder: WorkOrderNotice }>(
      'createWorkOrder',
      { data: uploadPayload },
      'POST',
      60000 // 60s timeout for Drive upload
    );
    if (data && data.workOrder) {
      const savedOrder = data.workOrder;
      if (!savedOrder.photoUrl && (savedOrder as any).directImageUrl) {
        savedOrder.photoUrl = (savedOrder as any).directImageUrl;
      }
      if (!savedOrder.photoUrl && (savedOrder as any).fileId) {
        savedOrder.photoUrl = `https://drive.google.com/thumbnail?id=${(savedOrder as any).fileId}&sz=w2000`;
      }
      if (!savedOrder.photoUrl) {
        savedOrder.photoUrl = payload.photoUrl;
      }
      const list = readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []);
      writeCache(WORK_ORDERS_STORAGE_KEY, sanitizeWorkOrdersForCache([savedOrder, ...list.filter(w => w.id !== savedOrder.id)]));

      // Also sync to server in background so server cache has the image
      try {
        fetch('/api/work-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...uploadPayload, id: savedOrder.id }),
        }).catch(() => {});
      } catch {}

      return savedOrder;
    }
  } catch (gasErr) {
    console.warn('Direct GAS createWorkOrder failed, trying server proxy endpoint:', gasErr);
  }

  // Attempt 2: Server proxy upload endpoint
  try {
    const sRes = await fetch('/api/work-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uploadPayload),
    });
    if (sRes.ok) {
      const sData = await sRes.json();
      if (sData && sData.workOrder) {
        const savedOrder = sData.workOrder;
        const list = readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []);
        writeCache(WORK_ORDERS_STORAGE_KEY, sanitizeWorkOrdersForCache([savedOrder, ...list.filter(w => w.id !== savedOrder.id)]));
        return savedOrder;
      }
    }
  } catch (proxyErr) {
    console.warn('Server proxy upload failed:', proxyErr);
  }

  // Local fallback
  const now = new Date();
  const fallbackOrder: WorkOrderNotice = {
    id: `wo_${Date.now()}`,
    category: payload.category,
    title: payload.title || 'Work Order / Khata Notice',
    photoUrl: payload.photoUrl,
    description: payload.description || '',
    uploadedBy: payload.uploadedBy || 'admin',
    adminName: payload.adminName || 'Admin Controller',
    adminPhone: payload.adminPhone || '8695716192',
    uploadDate: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    uploadTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    createdAt: now.toISOString(),
    isHidden: Boolean(payload.isHidden)
  };
  const list = readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []);
  writeCache(WORK_ORDERS_STORAGE_KEY, [fallbackOrder, ...list].slice(0, 50));
  return fallbackOrder;
}

export async function toggleWorkOrderVisibility(id: string, isHidden: boolean): Promise<boolean> {
  try {
    await callGasApi('toggleWorkOrder', { id, isHidden }, 'POST');
  } catch {}
  try {
    await fetch(`/api/work-orders/${encodeURIComponent(id)}/visibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHidden }),
    });
  } catch {}
  const list = readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []);
  writeCache(WORK_ORDERS_STORAGE_KEY, list.map(item => String(item.id) === String(id) ? { ...item, isHidden } : item));
  return true;
}

export async function deleteWorkOrder(id: string): Promise<boolean> {
  try {
    await callGasApi('deleteWorkOrder', { id }, 'POST');
  } catch {}
  try {
    await fetch(`/api/work-orders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch {}
  const list = readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []);
  writeCache(WORK_ORDERS_STORAGE_KEY, list.filter(item => String(item.id) !== String(id)));
  return true;
}

// ============================================================================
// DISCONNECTION TASK MANAGEMENT SYSTEM (Google Sheets Source of Truth)
// ============================================================================
export const DISCONNECTION_TASKS_CACHE_KEY = 'power_disconnection_tasks_cache';

export function invalidateDisconnectionCache() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DISCONNECTION_TASKS_CACHE_KEY);
    }
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
  return {
    ...t,
    phoneNumber: phone || t.phoneNumber || ''
  };
}

export async function fetchDisconnectionTasks(params: {
  workerId?: string;
  workerName?: string;
  role?: string;
  search?: string;
  status?: string;
  includeArchived?: boolean;
} = {}): Promise<{ tasks: DisconnectionTask[]; stats: DisconnectionStats }> {
  // Step 1: Call Google Apps Script getDisconnectionTasks directly (Google Sheet is source of truth)
  try {
    const gasData = await callGasApi<{ success: boolean; tasks: DisconnectionTask[]; stats: DisconnectionStats }>(
      'getDisconnectionTasks',
      params,
      'GET'
    );
    if (gasData && gasData.success && Array.isArray(gasData.tasks)) {
      const cleaned = gasData.tasks.map((t, idx) => ({
        ...cleanDisconnectionTask(t),
        serialNumber: `SL ${String(idx + 1).padStart(3, '0')}`
      }));
      writeCache(DISCONNECTION_TASKS_CACHE_KEY, cleaned);
      return { tasks: cleaned, stats: gasData.stats };
    }
  } catch (err: any) {
    console.warn('[Disconnection] GAS getDisconnectionTasks attempt notice:', err?.message || err);
  }

  // Step 2: Fallback direct read from Google Sheet via 'entries' category=Disconnection
  // (In case user has not redeployed the newest Code.gs to their Google account yet)
  try {
    const rawRes = await callGasApi<{ success: boolean; entries: any[] }>('entries', { category: 'Disconnection' }, 'GET');
    const rawEntries = rawRes && (Array.isArray(rawRes.entries) ? rawRes.entries : (Array.isArray(rawRes) ? rawRes : []));
    if (rawEntries && rawEntries.length > 0) {
      const mappedTasks: DisconnectionTask[] = rawEntries.map((e, idx) => {
        const cId = String(e['Consumer Id'] || e['Consumer ID'] || e.consumerId || e.accountNumber || '').trim();
        const mru = String(e['MRU'] || e.mru || e.mruSection || '').trim();
        const name = String(e['Name'] || e.consumerName || e.name || '').trim();
        const address = String(e['Address'] || e.consumerAddress || e.address || '').trim();
        const bClassPhase = String(e['BClass/Phase'] || e.bClassPhase || e.deviceType || 'I').trim();
        const consumerClass = String(e['Class'] || e.baseClass || e.class || 'Domestic').trim();
        const govNonGov = String(e['Gov/Non-Gov'] || e.govNonGov || 'Non-Gov').trim();
        const meter = String(e['Meter'] || e.meterNumber || e.meterNo || '').trim();
        const dueDateRange = String(e['O/S Due date Range'] || e.dueDateRange || '').trim();
        const d2NetOs = String(e['D2 Net O/S'] || e.outstandingDue || e.arrearAmount || '').trim();
        const disconStatus = (String(e['Discon Status'] || e.disconStatus || e.status || 'PENDING').trim().toUpperCase() || 'PENDING') as DisconnectionTaskStatus;
        const disconDate = String(e['Discon Date'] || e.disconDate || e.reportDate || '').trim();
        const mobile = String(e['Mobile Number'] || e.phoneNumber || e.mobile || '').trim();
        const slNumber = `SL ${String(idx + 1).padStart(3, '0')}`;

        return cleanDisconnectionTask({
          off_code: String(e['off_code'] || e.offCode || '5233100').trim(),
          MRU: mru,
          'Consumer Id': cId,
          Name: name,
          Address: address,
          'BClass/Phase': bClassPhase,
          Class: consumerClass,
          'Gov/Non-Gov': govNonGov,
          Meter: meter,
          'O/S Due date Range': dueDateRange,
          'D2 Net O/S': d2NetOs,
          'Discon Status': disconStatus,
          'Discon Date': disconDate,
          'Mobile Number': mobile,
          serialNumber: slNumber,
          taskId: `TASK-DISC-${cId || idx + 1}`,
          consumerId: cId,
          consumerName: name,
          accountNumber: cId,
          meterNumber: meter,
          consumerAddress: address,
          phoneNumber: mobile,
          mobileNumber: mobile,
          area: String(e['off_code'] || '5233100').trim(),
          disconnectionReason: `Outstanding Bill (D2 Net O/S: ${d2NetOs})`,
          assignedWorkerId: String(e['Worker ID'] || e.assignedWorkerId || '').trim(),
          assignedWorkerName: String(e['Worker Name'] || e.assignedWorkerName || '').trim(),
          taskStatus: disconStatus,
          workerReport: String(e['Notes'] || e.workerReport || '').trim(),
          workerRemarks: String(e['Remarks'] || e.workerRemarks || '').trim(),
          reportDate: disconDate,
          reportTime: '',
          submittedBy: String(e['Submitted By'] || e.submittedBy || '').trim(),
          createdAt: String(e['Created At'] || e.createdAt || disconDate || new Date().toISOString()).trim(),
          updatedAt: String(e['Updated At'] || e.updatedAt || new Date().toISOString()).trim(),
          photoUrl: String(e['Photo Evidence'] || e.photoUrl || '').trim(),
          mruSection: mru,
          cccFeeder: mru,
          outstandingDue: d2NetOs,
          dueDateRange: dueDateRange,
          baseClass: consumerClass,
          deviceType: bClassPhase,
          priority: parseFloat(d2NetOs.replace(/[^0-9.]/g, '')) > 10000 ? 'URGENT' : 'NORMAL',
          assignedAgency: String(e['Agency Name'] || e.assignedAgency || '').trim(),
          paidAmount: String(e['Paid Amount'] || e.paidAmount || (disconStatus === 'PAID' ? d2NetOs : '')).trim(),
          paymentDate: String(e['Payment Date'] || e.paymentDate || (disconStatus === 'PAID' ? disconDate : '')).trim(),
          paymentReference: String(e['Payment Reference'] || e.paymentReference || '').trim(),
          meterReading: meter,
          statusHistory: []
        });
      });

      // Filter
      let filtered = mappedTasks;
      const role = String(params.role || '').toLowerCase();
      const workerId = String(params.workerId || '').toLowerCase().trim();
      const workerName = String(params.workerName || '').toLowerCase().trim();
      if (role === 'worker' && (workerId || workerName)) {
        filtered = filtered.filter(t => {
          const aId = String(t.assignedWorkerId || '').toLowerCase().trim();
          const aNm = String(t.assignedWorkerName || '').toLowerCase().trim();
          return (workerId && aId === workerId) || (workerName && aNm === workerName) || (!aId && !aNm);
        });
      }
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

      const total = filtered.length;
      let completed = 0;
      let pending = 0;
      for (const t of filtered) {
        const st = t.taskStatus;
        if (st === 'COMPLETED' || st === 'DISCONNECT') completed++;
        else if (st === 'PENDING') pending++;
        else if (st === 'PAID') completed++;
      }

      const computedStats: DisconnectionStats = {
        totalTasks: total,
        completedTasks: completed,
        pendingTasks: pending,
        inProgressTasks: 0,
        unableTasks: 0,
        reportedTasks: 0,
        cancelledTasks: 0,
        completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        myAssignedTasks: total,
        myCompletedTasks: completed,
        myPendingTasks: pending,
        myCompletionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0
      };

      writeCache(DISCONNECTION_TASKS_CACHE_KEY, filtered);
      return { tasks: filtered, stats: computedStats };
    }
  } catch (err: any) {
    console.warn('[Disconnection] Google Sheet fallback read notice:', err?.message || err);
  }

  // Step 3: Temporary cache fallback only when offline
  const cached = readCache<DisconnectionTask[]>(DISCONNECTION_TASKS_CACHE_KEY, []);
  let filtered = cached.map((t, idx) => ({
    ...cleanDisconnectionTask(t),
    serialNumber: `SL ${String(idx + 1).padStart(3, '0')}`
  }));
  if (params.role === 'worker' && (params.workerId || params.workerName)) {
    const wId = String(params.workerId || '').toLowerCase().trim();
    const wNm = String(params.workerName || '').toLowerCase().trim();
    filtered = filtered.filter(t => {
      const aId = String(t.assignedWorkerId || '').toLowerCase().trim();
      const aNm = String(t.assignedWorkerName || '').toLowerCase().trim();
      return (wId && aId === wId) || (wNm && aNm === wNm) || (!aId && !aNm);
    });
  }
  const total = filtered.length;
  const completed = filtered.filter(t => t.taskStatus === 'COMPLETED' || t.taskStatus === 'DISCONNECT').length;
  const pending = filtered.filter(t => t.taskStatus === 'PENDING').length;
  const inProg = filtered.filter(t => t.taskStatus === 'IN PROGRESS').length;

  return {
    tasks: filtered,
    stats: {
      totalTasks: total,
      completedTasks: completed,
      pendingTasks: pending,
      inProgressTasks: inProg,
      unableTasks: filtered.filter(t => t.taskStatus === 'UNABLE').length,
      reportedTasks: filtered.filter(t => t.taskStatus === 'REPORTED').length,
      cancelledTasks: filtered.filter(t => t.taskStatus === 'CANCELLED').length,
      completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      myAssignedTasks: total,
      myCompletedTasks: completed,
      myPendingTasks: pending,
      myCompletionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  };
}

export async function uploadDisconnectionTasks(
  tasks: Partial<DisconnectionTask>[],
  adminInfo: { adminId: string; adminName: string }
): Promise<{ success: boolean; count: number; message: string; tasks?: DisconnectionTask[]; insertedCount?: number; updatedCount?: number }> {
  const reqId = `REQ-UPL-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // Map each task to the exact 14 WBSEDCL Google Sheet headers and standard model
  const standardizedTasks = tasks.map(t => {
    const cId = String((t as any)['Consumer Id'] || t.consumerId || (t as any)['Consumer ID'] || t.accountNumber || '').trim();
    const meter = String((t as any)['Meter'] || t.meterNumber || (t as any)['Meter No'] || t.meterReading || '').trim();
    const offCode = String((t as any)['off_code'] || t.offCode || t.area || '5233100').trim();
    const mru = String((t as any)['MRU'] || (t as any).mru || t.mruSection || '').trim();
    const name = String((t as any)['Name'] || t.consumerName || (t as any)['Customer Name'] || '').trim();
    const address = String((t as any)['Address'] || t.consumerAddress || '').trim();
    const bClassPhase = String((t as any)['BClass/Phase'] || t.bClassPhase || t.deviceType || 'I').trim();
    const consumerClass = String((t as any)['Class'] || t.baseClass || 'Domestic').trim();
    const govNonGov = String((t as any)['Gov/Non-Gov'] || (t as any)['govNonGov'] || 'Non-Gov').trim();
    const dueDateRange = String((t as any)['O/S Due date Range'] || t.dueDateRange || '').trim();
    const d2NetOs = String((t as any)['D2 Net O/S'] || t.outstandingDue || '').trim();
    const disconStatus = String((t as any)['Discon Status'] || t.disconStatus || t.taskStatus || 'PENDING').trim().toUpperCase();
    const disconDate = String((t as any)['Discon Date'] || t.disconDate || t.reportDate || '').trim();
    const mobile = String((t as any)['Mobile Number'] || t.phoneNumber || t.mobileNumber || '').trim();

    return {
      // 14 Exact Headers
      'off_code': offCode,
      'MRU': mru,
      'Consumer Id': cId,
      'Name': name,
      'Address': address,
      'BClass/Phase': bClassPhase,
      'Class': consumerClass,
      'Gov/Non-Gov': govNonGov,
      'Meter': meter,
      'O/S Due date Range': dueDateRange,
      'D2 Net O/S': d2NetOs,
      'Discon Status': disconStatus,
      'Discon Date': disconDate,
      'Mobile Number': mobile,

      // Model fields
      consumerId: cId,
      consumerName: name,
      meterNumber: meter,
      phoneNumber: mobile,
      outstandingDue: d2NetOs,
      dueDateRange: dueDateRange,
      consumerAddress: address,
      taskStatus: disconStatus as DisconnectionTaskStatus,
      mruSection: mru,
      offCode: offCode
    };
  });

  try {
    const res = await callGasApi<any>('uploadDisconnectionTasks', { tasks: standardizedTasks, adminInfo, requestId: reqId }, 'POST');
    if (res && res.success) {
      invalidateDisconnectionCache();
      return res;
    }
  } catch (err: any) {
    console.warn('[Disconnection] uploadDisconnectionTasks notice:', err?.message || err);
  }

  // Fallback direct write to Google Sheet via createEntry/updateEntry
  try {
    let inserted = 0;
    for (const t of standardizedTasks) {
      await callGasApi('createEntry', {
        category: 'Disconnection',
        ...t,
        data: t
      }, 'POST');
      inserted++;
    }
    invalidateDisconnectionCache();
    return {
      success: true,
      count: standardizedTasks.length,
      insertedCount: inserted,
      message: `Uploaded ${standardizedTasks.length} disconnection records to Google Sheets.`
    };
  } catch (fallbackErr: any) {
    throw new Error(fallbackErr.message || 'Failed to upload disconnection tasks to Google Sheets');
  }
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
}): Promise<{ success: boolean; message: string; taskId?: string; status?: string }> {
  const reqId = report.submissionId || `REQ-SUB-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const cId = String(report.consumerId || report.taskId || '').replace('TASK-DISC-', '').trim();
  const dateStr = report.reportDate || new Date().toISOString().split('T')[0];

  const payload = {
    ...report,
    consumerId: cId,
    'Consumer Id': cId,
    'Discon Status': report.taskStatus,
    'Discon Date': dateStr,
    'Meter': report.meterReading || '',
    'Mobile Number': report.phoneNumber || '',
    requestId: reqId
  };

  try {
    const res = await callGasApi<any>('submitDisconnectionReport', payload, 'POST');
    if (res && res.success) {
      invalidateDisconnectionCache();
      return res;
    }
  } catch (err: any) {
    console.warn('[Disconnection] submitDisconnectionReport notice:', err?.message || err);
  }

  // Fallback to updateEntry on Google Sheet
  try {
    const res = await callGasApi<any>('updateEntry', {
      id: report.taskId,
      consumerId: cId,
      category: 'Disconnection',
      status: report.taskStatus,
      data: payload,
      requestId: reqId
    }, 'POST');
    invalidateDisconnectionCache();
    return {
      success: true,
      message: 'Report saved to Google Sheets successfully',
      taskId: report.taskId,
      status: report.taskStatus
    };
  } catch (err: any) {
    throw new Error(err.message || 'Failed to submit disconnection report to Google Sheets');
  }
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

export async function fetchDisconnectionHistory(consumerId: string): Promise<{ success: boolean; history: any[] }> {
  if (!consumerId) return { success: true, history: [] };
  try {
    const res = await callGasApi<any>('getDisconnectionHistory', { consumerId, 'Consumer Id': consumerId }, 'GET');
    if (res && res.success && Array.isArray(res.history)) {
      return res;
    }
  } catch (err: any) {
    console.warn('[Disconnection] fetchDisconnectionHistory notice:', err?.message || err);
  }
  return { success: true, history: [] };
}

