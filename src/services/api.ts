import { PowerEntry, StatsResponse, CategoryType, UserAccount, UserSession, WorkOrderNotice, ChatMessage } from '../types';
import { normalizeUniversalText, normalizePassword, isUserMatch } from '../utils/textNormalizer';

const API_BASE = '/api';
const LOCAL_STORAGE_KEY = 'power_app_entries_cache';
const WORK_ORDERS_STORAGE_KEY = 'power_work_orders_cache';
const CHAT_LOCAL_KEY = 'power_chat_history';

// Empty default accounts - Google Sheets is the ONLY source of truth
export const DEFAULT_WBSEDCL_ACCOUNTS: UserAccount[] = [];

// Clean legacy user storage and bloated cache on initialization
try {
  localStorage.removeItem('power_registered_users');
  const oldEntries = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (oldEntries && oldEntries.length > 50000) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
  const oldOrders = localStorage.getItem(WORK_ORDERS_STORAGE_KEY);
  if (oldOrders && oldOrders.length > 50000) {
    localStorage.removeItem(WORK_ORDERS_STORAGE_KEY);
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

// Strip heavy base64 images when writing to localStorage cache to prevent UI thread freezing
function sanitizeEntriesForCache(entries: PowerEntry[]): PowerEntry[] {
  return entries.slice(0, 50).map(e => ({
    ...e,
    photoUrl: e.photoUrl && e.photoUrl.length > 3000 ? '' : e.photoUrl,
    workOrderPhoto: e.workOrderPhoto && e.workOrderPhoto.length > 3000 ? '' : e.workOrderPhoto,
  }));
}

function sanitizeWorkOrdersForCache(orders: WorkOrderNotice[]): WorkOrderNotice[] {
  return orders.slice(0, 30).map(w => ({
    ...w,
    photoUrl: w.photoUrl && w.photoUrl.length > 3000 ? '' : w.photoUrl,
  }));
}

export async function syncPendingEntries(): Promise<number> {
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
        const res = await fetch(`${API_BASE}/entries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          body: JSON.stringify(cleanItem)
        });
        if (res.ok) {
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
  }
  return syncedCount;
}

export async function fetchEntries(filters?: {
  category?: string;
  status?: string;
  search?: string;
}): Promise<PowerEntry[]> {
  // Background sync of unsynced items
  syncPendingEntries().catch(() => {});

  try {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== 'ALL') params.append('category', filters.category);
    if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    params.append('_t', Date.now().toString());

    const res = await fetch(`${API_BASE}/entries?${params.toString()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data: PowerEntry[] = await res.json();
    
    // Update local cache safely with stripped images to avoid freezing the UI thread
    writeCache(LOCAL_STORAGE_KEY, sanitizeEntriesForCache(data));
    return data;
  } catch (error) {
    console.warn('Local server fetch failed, using local cache:', error);
    let list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []);
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

export async function createEntry(entryData: Partial<PowerEntry>): Promise<PowerEntry> {
  const generatedId = entryData.id || `PWR-${Date.now().toString().slice(-6)}`;
  const nowIso = new Date().toISOString();
  const cleanEntry: PowerEntry = {
    ...entryData as any,
    id: generatedId,
    date: entryData.date || nowIso,
    createdAt: entryData.createdAt || nowIso,
    status: entryData.status || 'Completed',
  };

  // Immediate local cache update for instant UI feedback (0ms delay)
  try {
    const list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []);
    writeCache(LOCAL_STORAGE_KEY, sanitizeEntriesForCache([cleanEntry, ...list.filter(e => e.id !== cleanEntry.id)]));
  } catch {}

  try {
    const res = await fetch(`${API_BASE}/entries`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify(cleanEntry),
    });

    if (res.ok) {
      const result = await res.json();
      return result.entry || cleanEntry;
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (error) {
    console.warn('Server createEntry error, saved locally with sync flag:', error);
    const fallbackEntry = { ...cleanEntry, _isPendingSync: true };
    const list = readCache<any[]>(LOCAL_STORAGE_KEY, []);
    writeCache(LOCAL_STORAGE_KEY, [fallbackEntry, ...list.filter(e => e.id !== fallbackEntry.id)].slice(0, 100));
    return cleanEntry;
  }
}

export async function updateEntry(id: string, updates: Partial<PowerEntry>): Promise<PowerEntry> {
  try {
    const res = await fetch(`${API_BASE}/entries/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update entry');
    const result = await res.json();
    return result.entry;
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
    await fetch(`${API_BASE}/entries/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {}
  const list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []);
  writeCache(LOCAL_STORAGE_KEY, list.filter(e => e.id !== id));
  return true;
}

export async function clearAllEntries(): Promise<boolean> {
  try {
    await fetch(`${API_BASE}/entries`, { method: 'DELETE' });
  } catch {}
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  return true;
}

export async function fetchStats(): Promise<StatsResponse> {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (res.ok) return await res.json();
  } catch {}

  const entries = await fetchEntries();
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

// User accounts management APIs (GOOGLE SHEETS IS THE SINGLE SOURCE OF TRUTH)
export async function fetchUsers(): Promise<UserAccount[]> {
  const res = await fetch(`${API_BASE}/users?_t=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || `Failed to fetch users: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data && data.success && Array.isArray(data.users)) {
    return data.users;
  }
  if (Array.isArray(data)) {
    return data;
  }
  throw new Error(data?.error || 'Invalid response from Google Sheets user backend');
}

export async function createUserAccount(userData: Partial<UserAccount>): Promise<UserAccount> {
  const cleanId = normalizeUniversalText(userData.idNo);
  const cleanPass = normalizePassword(userData.password);
  const cleanName = (userData.name ? String(userData.name).trim() : cleanId) || 'কর্মী';
  const cleanPhone = normalizeUniversalText(userData.phone).replace(/[^0-9]/g, '');

  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    body: JSON.stringify({
      ...userData,
      idNo: cleanId,
      password: cleanPass,
      name: cleanName,
      phone: cleanPhone
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success && data.user) {
    return data.user;
  }

  throw new Error(data.error || 'Failed to create user in Google Sheets');
}

export async function updateUserAccount(id: string, updates: Partial<UserAccount>): Promise<UserAccount> {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    body: JSON.stringify(updates),
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success && data.user) {
    return data.user;
  }

  throw new Error(data.error || 'Failed to update user in Google Sheets');
}

export async function deleteUserAccount(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, { 
    method: 'DELETE',
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success) {
    return true;
  }

  throw new Error(data.error || 'Failed to delete user in Google Sheets');
}

export async function updateUserStatus(id: string, status: 'active' | 'hold'): Promise<UserAccount> {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    body: JSON.stringify({ status }),
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success && data.user) {
    return data.user;
  }

  throw new Error(data.error || 'Failed to update user status in Google Sheets');
}

export async function verifyUserSession(idNo: string): Promise<{ valid: boolean; status?: 'active' | 'hold'; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/verify/${encodeURIComponent(idNo)}?_t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.valid) {
      return data;
    }
    return { valid: false, error: data?.error || 'Session verification failed' };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Session verification connection failed' };
  }
}

export async function loginUser(loginId: string, password: string): Promise<UserSession> {
  const cleanId = normalizeUniversalText(loginId);
  const cleanPass = normalizePassword(password);

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    body: JSON.stringify({ loginId: cleanId, password: cleanPass }),
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success && data.session) {
    return data.session;
  }

  throw new Error(data.error || 'ভুল আইডি বা পাসওয়ার্ড!');
}

export async function changeUserPassword(idNo: string, currentPassword: string, newPassword: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    body: JSON.stringify({ 
      idNo: normalizeUniversalText(idNo), 
      currentPassword: normalizePassword(currentPassword), 
      newPassword: normalizePassword(newPassword) 
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success) {
    return true;
  }

  throw new Error(data.error || 'Failed to change password in Google Sheets');
}

export async function resetUserPassword(idNo: string, newPassword: string, phone?: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    body: JSON.stringify({ 
      idNo: normalizeUniversalText(idNo), 
      phone: phone ? normalizeUniversalText(phone).replace(/[^0-9]/g, '') : undefined, 
      newPassword: normalizePassword(newPassword) 
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success) {
    return true;
  }

  throw new Error(data.error || 'Failed to reset password in Google Sheets');
}

export async function fetchChatMessages(workerId?: string): Promise<ChatMessage[]> {
  try {
    const params = workerId ? `?workerId=${encodeURIComponent(workerId)}` : '';
    const res = await fetch(`${API_BASE}/chat${params}`);
    if (res.ok) {
      const data = await res.json();
      writeCache(CHAT_LOCAL_KEY, data);
      return data;
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
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
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
    await fetch(`${API_BASE}/chat`, { method: 'DELETE' });
  } catch {}
  localStorage.removeItem(CHAT_LOCAL_KEY);
  return true;
}

export async function fetchWorkOrders(category?: string): Promise<WorkOrderNotice[]> {
  try {
    const params = new URLSearchParams();
    if (category && category !== 'ALL') params.append('category', category);
    params.append('_t', Date.now().toString());

    const res = await fetch(`${API_BASE}/work-orders?${params.toString()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (res.ok) {
      const data: WorkOrderNotice[] = await res.json();
      writeCache(WORK_ORDERS_STORAGE_KEY, sanitizeWorkOrdersForCache(data));
      return data;
    }
  } catch {}
  return readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []);
}

export async function uploadWorkOrder(payload: {
  category: CategoryType;
  title: string;
  photoUrl: string;
  description?: string;
  uploadedBy: string;
  adminName: string;
  adminPhone?: string;
  isHidden?: boolean;
}): Promise<WorkOrderNotice> {
  try {
    const res = await fetch(`${API_BASE}/work-orders`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      const savedOrder: WorkOrderNotice = data.workOrder;
      const list = readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []);
      writeCache(WORK_ORDERS_STORAGE_KEY, sanitizeWorkOrdersForCache([savedOrder, ...list.filter(w => w.id !== savedOrder.id)]));
      return savedOrder;
    }
  } catch {}

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
    await fetch(`${API_BASE}/work-orders/${encodeURIComponent(id)}/visibility`, {
      method: 'PATCH',
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
    await fetch(`${API_BASE}/work-orders/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {}
  const list = readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []);
  writeCache(WORK_ORDERS_STORAGE_KEY, list.filter(item => String(item.id) !== String(id)));
  return true;
}
