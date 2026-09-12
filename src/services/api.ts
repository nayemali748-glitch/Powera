import { PowerEntry, StatsResponse, CategoryType, UserAccount, UserSession, WorkOrderNotice, ChatMessage } from '../types';
import { normalizeUniversalText, normalizePassword } from '../utils/textNormalizer';
import { deduplicateEntries, normalizeEntry } from '../utils/entryNormalizer';

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    try { controller.abort(); } catch {}
  }, timeoutMs);

  try {
    let url = GOOGLE_SCRIPT_WEB_APP_URL;
    const options: RequestInit = {
      signal: controller.signal,
      redirect: 'follow',
    };

    if (method === 'GET') {
      const sep = url.includes('?') ? '&' : '?';
      const queryParams: Record<string, string> = { action };
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined && value !== null) {
          queryParams[key] = String(value);
        }
      }
      queryParams['_t'] = Date.now().toString();
      const params = new URLSearchParams(queryParams);
      url = `${url}${sep}${params.toString()}`;
      options.method = 'GET';
    } else {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}action=${encodeURIComponent(action)}`;
      options.method = 'POST';
      // Use text/plain to prevent browser CORS preflight OPTIONS request
      options.headers = {
        'Content-Type': 'text/plain;charset=utf-8'
      };
      options.body = JSON.stringify({ action, ...payload });
    }

    const res = await fetch(url, options);
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Google Apps Script returned invalid response: ${text.slice(0, 150)}`);
    }

    if (data && data.success === false && data.error) {
      throw new Error(data.error);
    }

    return data as T;
  } catch (err: any) {
    if (err && err.name === 'AbortError') {
      throw new Error(`Request timed out for action "${action}". Please try again.`);
    }

    // Secondary fallback for read operations ONLY: if direct GAS GET fails, try server proxy
    if (method === 'GET' && typeof window !== 'undefined' && window.location && window.location.port === '3000') {
      try {
        const endpoint = action === 'users' ? '/api/users' : (action === 'entries' ? '/api/entries' : (action === 'workorders' ? '/api/work-orders' : null));
        if (endpoint) {
          const proxyRes = await fetch(endpoint);
          if (proxyRes.ok) {
            const proxyData = await proxyRes.json();
            return (action === 'entries' ? { success: true, entries: proxyData } : (action === 'workorders' ? { success: true, workOrders: proxyData } : proxyData)) as T;
          }
        }
      } catch {}
    }

    throw err;
  } finally {
    clearTimeout(timeoutId);
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
export function getCreateActionForCategory(cat?: string): string {
  const c = String(cat || '').toUpperCase();
  if (c === 'NSC') return 'createNSC';
  if (c === 'DISCONNECTION') return 'createDisconnection';
  if (c === 'POLE CASE' || c === 'POLE_CASE') return 'createPoleCase';
  if (c === 'METER REPLESMENT' || c === 'METER_REPLACEMENT') return 'createMeterReplacement';
  if (c === 'DTR REPLESMENT' || c === 'DTR_REPLACEMENT') return 'createDTRReplacement';
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

    // 1. Send to Google Apps Script backend API using canonical 'createEntry' action
    try {
      res = await callGasApi<{ success: boolean; entry?: PowerEntry; data?: PowerEntry; duplicate?: boolean; recordId?: string; message?: string }>(
        'createEntry',
        { data: cleanEntry },
        'POST',
        25000
      );
    } catch (err: any) {
      console.warn('Direct GAS createEntry failed, attempting server proxy /api/entries:', err);
      try {
        const proxyRes = await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanEntry),
        });
        if (proxyRes.ok) {
          res = await proxyRes.json();
        } else {
          const errBody = await proxyRes.json().catch(() => ({}));
          backendError = new Error(errBody.error || `Server proxy returned ${proxyRes.status}`);
        }
      } catch (proxyErr) {
        backendError = proxyErr;
      }
    }

    // 2. Strict Backend Save Confirmation check
    if (!res || res.success === false) {
      const detailMsg = res?.message || (backendError ? (backendError.message || String(backendError)) : 'Google Sheets backend failed to save the entry.');
      console.error('Google Sheets Backend Save Failed:', detailMsg);
      throw new Error(`Google Sheets save error: ${detailMsg}`);
    }

    // 3. Data successfully saved and confirmed by Google Sheets!
    const confirmedEntry: PowerEntry = normalizeEntry(res.entry || res.data || cleanEntry);

    // Synchronize to server cache in the background so Admin Panel sees it immediately
    try {
      fetch('/api/entries/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: [confirmedEntry] }),
      }).catch(() => {});
    } catch {}

    // Now update cache for instant read synchronization in the Admin Panel and Worker Recent Submissions
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
  try {
    const res = await callGasApi<{ success: boolean; entry: PowerEntry }>('updateEntry', { id, data: updates }, 'POST');
    const updated = res.entry || { id, ...updates } as PowerEntry;
    const list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []);
    const idx = list.findIndex(e => e.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updated };
      writeCache(LOCAL_STORAGE_KEY, list);
    }
    return updated;
  } catch (error) {
    const list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []);
    const idx = list.findIndex(e => e.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
      writeCache(LOCAL_STORAGE_KEY, list);
      return list[idx];
    }
    throw error;
  }
}

export async function deleteEntry(id: string): Promise<boolean> {
  try {
    await callGasApi('deleteEntry', { id }, 'POST');
  } catch (e) {
    console.warn('Delete entry notice:', e);
  }
  const list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []);
  writeCache(LOCAL_STORAGE_KEY, list.filter(e => e.id !== id));
  return true;
}

export async function clearAllEntries(): Promise<boolean> {
  try {
    await callGasApi('clearEntries', {}, 'POST');
  } catch (e) {
    console.warn('Clear entries notice:', e);
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
// USER MANAGEMENT & AUTHENTICATION (GOOGLE SHEETS)
// ============================================================================

export async function fetchUsers(): Promise<UserAccount[]> {
  try {
    const data = await callGasApi<{ success: boolean; users: UserAccount[] }>('users', {}, 'GET');
    if (data && Array.isArray(data.users)) {
      const validUsers = data.users.filter(u => u && (u.id || u.idNo || u.name));
      const seen = new Set<string>();
      const uniqueUsers: UserAccount[] = [];
      validUsers.forEach((u, idx) => {
        const idKey = String(u.id || u.idNo || `usr-${idx + 1}`).trim();
        if (!seen.has(idKey)) {
          seen.add(idKey);
          uniqueUsers.push({ ...u, id: idKey });
        }
      });
      writeCache(USERS_CACHE_KEY, uniqueUsers);
      return uniqueUsers;
    }
    throw new Error('Failed to load users from Google Sheets');
  } catch (err: any) {
    console.warn('fetchUsers using cache fallback:', err);
    const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
    if (cached.length > 0) return cached;
    throw new Error(err.message || 'Failed to fetch users from Google Sheets');
  }
}

export async function createUserAccount(userData: Partial<UserAccount>): Promise<UserAccount> {
  const cleanId = normalizeUniversalText(userData.idNo || '');
  const cleanPass = normalizePassword(userData.password || '');
  const cleanPhone = userData.phone ? normalizeUniversalText(userData.phone).replace(/[^0-9]/g, '') : '';
  const cleanName = normalizeUniversalText(userData.name || cleanId) || 'কর্মী';

  if (!cleanId) throw new Error('User ID No is required');
  if (!cleanPass) throw new Error('Password is required');

  const payload = {
    ...userData,
    idNo: cleanId,
    password: cleanPass,
    name: cleanName,
    phone: cleanPhone,
    role: userData.role || 'worker',
    status: userData.status || 'active',
  };

  const data = await callGasApi<{ success: boolean; user: UserAccount }>('createUser', { data: payload }, 'POST');
  if (data && data.user) {
    const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
    writeCache(USERS_CACHE_KEY, [data.user, ...cached.filter(u => u.id !== data.user.id)]);
    return data.user;
  }
  throw new Error('Failed to create user in Google Sheets');
}

export async function updateUserAccount(id: string, updates: Partial<UserAccount>): Promise<UserAccount> {
  const data = await callGasApi<{ success: boolean; user: UserAccount }>('updateUser', { id, data: updates }, 'POST');
  if (data && data.user) {
    const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
    writeCache(USERS_CACHE_KEY, cached.map(u => u.id === id ? { ...u, ...data.user } : u));
    return data.user;
  }
  throw new Error('Failed to update user in Google Sheets');
}

export async function deleteUserAccount(id: string): Promise<boolean> {
  const cleanId = id.toLowerCase();
  if (cleanId === '8695716192' || cleanId === 'adm_8695716192' || cleanId === 'admin') {
    throw new Error('Primary Admin account cannot be deleted');
  }
  const data = await callGasApi<{ success: boolean }>('deleteUser', { id }, 'POST');
  const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
  writeCache(USERS_CACHE_KEY, cached.filter(u => u.id !== id));
  return Boolean(data.success);
}

export async function updateUserStatus(id: string, status: 'active' | 'hold'): Promise<UserAccount> {
  const cleanId = id.toLowerCase();
  if ((cleanId === '8695716192' || cleanId === 'adm_8695716192' || cleanId === 'admin') && status === 'hold') {
    throw new Error('Primary Admin account cannot be placed on hold');
  }
  const data = await callGasApi<{ success: boolean; user: UserAccount }>('updateUserStatus', { id, status }, 'POST');
  if (data && data.user) {
    const cached = readCache<UserAccount[]>(USERS_CACHE_KEY, []);
    writeCache(USERS_CACHE_KEY, cached.map(u => u.id === id ? { ...u, status } : u));
    return data.user;
  }
  throw new Error('Failed to update user status in Google Sheets');
}

export async function verifyUserSession(idNo: string): Promise<{ valid: boolean; status?: 'active' | 'hold'; error?: string }> {
  try {
    const data = await callGasApi<{ success: boolean; result: { valid: boolean; status?: 'active' | 'hold'; error?: string } }>(
      'verify',
      { idNo: normalizeUniversalText(idNo) },
      'GET'
    );
    return data.result || { valid: false, error: 'User not found' };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Verification error' };
  }
}

export async function loginUser(loginId: string, password: string): Promise<UserSession> {
  const cleanId = normalizeUniversalText(loginId).trim();
  const cleanPass = normalizePassword(password).trim();

  if (!cleanId || !cleanPass) {
    throw new Error('User ID No and Password are required');
  }

  // 1. Try server endpoint first (fast, same-origin, immune to iframe CORS and redirects)
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: cleanId, password: cleanPass })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.session) {
        return data.session;
      }
    } else {
      const errJson = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        throw new Error(errJson.error || 'ভুল ইউজার আইডি বা পাসওয়ার্ড!');
      }
    }
  } catch (err: any) {
    // If it's a 401/403 rejection from backend, don't fallback to duplicate call, rethrow immediately
    if (err && err.message && (err.message.includes('ভুল') || err.message.includes('Invalid') || err.message.includes('Password') || err.message.includes('User ID') || err.message.includes('Hold') || err.message.includes('hold'))) {
      throw err;
    }
    console.warn('Local /api/auth/login failed, falling back to direct GAS:', err);
  }

  // 2. Direct GAS login fallback
  const data = await callGasApi<{ success: boolean; session: UserSession }>(
    'login',
    { idNo: cleanId, password: cleanPass },
    'POST',
    25000
  );

  if (data && data.success && data.session) {
    return data.session;
  }

  throw new Error('Invalid User ID or Password in Google Sheets');
}

export async function changeUserPassword(idNo: string, currentPassword: string, newPassword: string): Promise<boolean> {
  const data = await callGasApi<{ success: boolean }>(
    'changePassword',
    {
      idNo: normalizeUniversalText(idNo),
      currentPassword: normalizePassword(currentPassword),
      newPassword: normalizePassword(newPassword)
    },
    'POST'
  );

  if (data && data.success) return true;
  throw new Error('Failed to change password in Google Sheets');
}

export async function resetUserPassword(idNo: string, newPassword: string, phone?: string): Promise<boolean> {
  const data = await callGasApi<{ success: boolean }>(
    'resetPassword',
    {
      idNo: normalizeUniversalText(idNo),
      phone: phone ? normalizeUniversalText(phone).replace(/[^0-9]/g, '') : undefined,
      newPassword: normalizePassword(newPassword)
    },
    'POST'
  );

  if (data && data.success) return true;
  throw new Error('Failed to reset password in Google Sheets');
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
      const data = await callGasApi<{ success: boolean; workOrders: WorkOrderNotice[] }>('workorders', params, 'GET', 12000);
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
