import { PowerEntry, StatsResponse, CategoryType, UserAccount, UserSession, WorkOrderNotice } from '../types';

const API_BASE = '/api';
const LOCAL_STORAGE_KEY = 'power_app_entries_cache';
const USERS_STORAGE_KEY = 'power_registered_users';
const WORK_ORDERS_STORAGE_KEY = 'power_work_orders_cache';

export const DEFAULT_WBSEDCL_ACCOUNTS: UserAccount[] = [
  {
    id: 'worker_default_0000',
    idNo: 'worker',
    password: '0000',
    name: 'Field Worker (WBSEDCL)',
    phone: '',
    role: 'worker',
    status: 'active',
    designation: 'লাইনম্যান / Worker (WBSEDCL)',
    badgeNo: 'WRK-0000',
    securityQuestion: 'আপনার প্রিয় সাবস্টেশন / অফিস?',
    securityAnswer: 'Vidyut Bhavan',
    createdAt: new Date().toISOString()
  },
  {
    id: 'adm_8695716192',
    idNo: '8695716192',
    password: '6293',
    name: 'Engr. N. Ali (Admin Controller)',
    phone: '8695716192',
    role: 'admin',
    status: 'active',
    designation: 'Assistant Engineer / Divisional Admin (WBSEDCL)',
    badgeNo: 'ADM-8695',
    securityQuestion: 'Your Primary Power Substation?',
    securityAnswer: 'Vidyut Bhavan',
    createdAt: new Date().toISOString()
  }
];

export async function fetchEntries(filters?: {
  category?: string;
  status?: string;
  search?: string;
}): Promise<PowerEntry[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== 'ALL') params.append('category', filters.category);
    if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const res = await fetch(`${API_BASE}/entries?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data: PowerEntry[] = await res.json();
    
    // Update local cache
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // LocalStorage quota or unavailable
    }
    return data;
  } catch (error) {
    console.warn('Backend fetch failed, using local storage cache:', error);
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      let list: PowerEntry[] = JSON.parse(cached);
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
    return [];
  }
}

export async function createEntry(entryData: Partial<PowerEntry>): Promise<PowerEntry> {
  try {
    const res = await fetch(`${API_BASE}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entryData),
    });
    if (!res.ok) throw new Error('Failed to submit entry');
    const result = await res.json();
    return result.entry;
  } catch (error) {
    console.warn('API submit error, saving locally:', error);
    const fallbackEntry: PowerEntry = {
      ...entryData as any,
      id: entryData.id || `PWR-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      status: entryData.status || 'Pending',
    };
    
    // Save to local cache
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: PowerEntry[] = cached ? JSON.parse(cached) : [];
    list.unshift(fallbackEntry);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    return fallbackEntry;
  }
}

export async function updateEntry(id: string, updates: Partial<PowerEntry>): Promise<PowerEntry> {
  try {
    const res = await fetch(`${API_BASE}/entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update entry');
    const result = await res.json();
    return result.entry;
  } catch (error) {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const list: PowerEntry[] = JSON.parse(cached);
      const idx = list.findIndex(e => e.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
        return list[idx];
      }
    }
    throw error;
  }
}

export async function deleteEntry(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/entries/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    return true;
  } catch (error) {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      let list: PowerEntry[] = JSON.parse(cached);
      list = list.filter(e => e.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      return true;
    }
    return false;
  }
}

export async function clearAllEntries(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/entries`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear all');
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    return true;
  } catch (error) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    return true;
  }
}

export async function fetchStats(): Promise<StatsResponse> {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return await res.json();
  } catch (error) {
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
}

// User accounts management APIs
export async function fetchUsers(): Promise<UserAccount[]> {
  try {
    const res = await fetch(`${API_BASE}/users`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    const users: UserAccount[] = await res.json();
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch {}
    return users;
  } catch (err) {
    console.warn('Backend fetch users failed, fallback to local storage:', err);
    const cached = localStorage.getItem(USERS_STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return DEFAULT_WBSEDCL_ACCOUNTS;
  }
}

export async function createUserAccount(userData: Partial<UserAccount>): Promise<UserAccount> {
  const cleanId = (userData.idNo || '').toString().trim();
  const cleanPass = (userData.password || '').toString().trim();
  const cleanName = (userData.name || cleanId || 'কর্মী').toString().trim();

  try {
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
        name: cleanName
      }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to create user on server');
    }
    const data = await res.json();
    // Update local cache
    try {
      const all = await fetchUsers();
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(all));
    } catch {}
    return data.user;
  } catch (err: any) {
    if (err.message && (err.message.includes('already exists') || err.message.includes('required') || err.message.includes('server'))) {
      throw err;
    }
    console.warn('Backend create user failed, offline local fallback:', err);
    const newUser: UserAccount = {
      id: `${userData.role || 'user'}_${Date.now()}`,
      idNo: cleanId || `LM-${Math.floor(1000 + Math.random() * 9000)}`,
      password: cleanPass || '1234',
      name: cleanName,
      phone: userData.phone || '',
      role: userData.role || 'worker',
      designation: userData.designation || 'লাইনম্যান (WBSEDCL)',
      badgeNo: userData.badgeNo || cleanId,
      status: userData.status || 'active',
      securityQuestion: userData.securityQuestion || 'আপনার প্রিয় বিদ্যুৎ সাবস্টেশন?',
      securityAnswer: userData.securityAnswer || 'Vidyut Bhavan',
      createdAt: new Date().toISOString()
    };
    const cached = localStorage.getItem(USERS_STORAGE_KEY);
    const list: UserAccount[] = cached ? JSON.parse(cached) : [...DEFAULT_WBSEDCL_ACCOUNTS];
    list.unshift(newUser);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(list));
    return newUser;
  }
}

export async function updateUserAccount(id: string, updates: Partial<UserAccount>): Promise<UserAccount> {
  try {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to update user');
    }
    const data = await res.json();
    // Update local cache
    try {
      const all = await fetchUsers();
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(all));
    } catch {}
    return data.user;
  } catch (err: any) {
    const cached = localStorage.getItem(USERS_STORAGE_KEY);
    if (cached) {
      let list: UserAccount[] = JSON.parse(cached);
      const idx = list.findIndex(u => u && (u.id === id || u.idNo === id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(list));
        return list[idx];
      }
    }
    throw err;
  }
}

export async function deleteUserAccount(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to delete user');
    }
    const cached = localStorage.getItem(USERS_STORAGE_KEY);
    if (cached) {
      let list: UserAccount[] = JSON.parse(cached);
      list = list.filter(u => u && u.id !== id && u.idNo !== id);
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(list));
    }
    return true;
  } catch (err: any) {
    const cached = localStorage.getItem(USERS_STORAGE_KEY);
    if (cached) {
      let list: UserAccount[] = JSON.parse(cached);
      list = list.filter(u => u && u.id !== id && u.idNo !== id);
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(list));
      return true;
    }
    throw err;
  }
}

export async function updateUserStatus(id: string, status: 'active' | 'hold'): Promise<UserAccount> {
  try {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to update user status');
    }
    const data = await res.json();
    
    // Update local cache
    const cached = localStorage.getItem(USERS_STORAGE_KEY);
    if (cached) {
      let list: UserAccount[] = JSON.parse(cached);
      const idx = list.findIndex(u => u && (u.id === id || u.idNo === id));
      if (idx !== -1) {
        list[idx].status = status;
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(list));
      }
    }
    return data.user;
  } catch (err: any) {
    const cached = localStorage.getItem(USERS_STORAGE_KEY);
    if (cached) {
      let list: UserAccount[] = JSON.parse(cached);
      const idx = list.findIndex(u => u && (u.id === id || u.idNo === id));
      if (idx !== -1) {
        list[idx].status = status;
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(list));
        return list[idx];
      }
    }
    throw err;
  }
}

export async function verifyUserSession(idNo: string): Promise<{ valid: boolean; status?: 'active' | 'hold'; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/verify/${encodeURIComponent(idNo)}`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { valid: false, error: errJson.error || 'Session invalid' };
    }
    const data = await res.json();
    return data;
  } catch {
    return { valid: true, status: 'active' };
  }
}

export async function loginUser(loginId: string, password: string): Promise<UserSession> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'ভুল আইডি বা পাসওয়ার্ড!');
    }
    const data = await res.json();
    return data.session;
  } catch (err: any) {
    // Check local fallback
    const cleanId = (loginId || '').toString().trim();
    const cleanPass = (password || '').toString().trim();
    
    // Check if master admin 8695716192 or admin
    if ((cleanId === '8695716192' || cleanId.toLowerCase() === 'admin') && cleanPass === '6293') {
      return {
        id: 'adm_8695716192',
        idNo: '8695716192',
        name: 'Engr. N. Ali (Admin Controller)',
        phone: '8695716192',
        role: 'admin',
        designation: 'Assistant Engineer / Divisional Admin (WBSEDCL)',
        badgeNo: 'ADM-8695',
        loggedInAt: new Date().toISOString()
      };
    }

    // Check if default worker
    if ((cleanId.toLowerCase() === 'worker' || cleanId.toLowerCase() === 'workar') && cleanPass === '0000') {
      return {
        id: 'worker_default_0000',
        idNo: 'worker',
        name: 'Field Worker (WBSEDCL)',
        phone: '',
        role: 'worker',
        designation: 'লাইনম্যান / Worker (WBSEDCL)',
        badgeNo: 'WRK-0000',
        loggedInAt: new Date().toISOString()
      };
    }

    const cached = localStorage.getItem(USERS_STORAGE_KEY);
    const users: UserAccount[] = cached ? JSON.parse(cached) : DEFAULT_WBSEDCL_ACCOUNTS;
    const found = users.find(u => u && u.idNo && (
      u.idNo.toString().toLowerCase() === cleanId.toLowerCase() || 
      (u.phone && u.phone.replace(/[^0-9]/g, '') === cleanId.replace(/[^0-9]/g, '')) ||
      (u.name && u.name.toLowerCase() === cleanId.toLowerCase())
    ));

    if (found) {
      if (found.status === 'hold') {
        throw new Error(`Account ID "${found.idNo}" is currently ON HOLD by Admin! Only active IDs can log in.`);
      }
      if (String(found.password).trim() === cleanPass) {
        return {
          id: found.id,
          idNo: found.idNo,
          name: found.name,
          phone: found.phone,
          role: found.role,
          designation: found.designation,
          badgeNo: found.badgeNo || found.idNo,
          loggedInAt: new Date().toISOString()
        };
      }
    }
    throw new Error(err.message || 'Invalid ID or Password! Account not found or deactivated.');
  }
}

export async function changeUserPassword(idNo: string, currentPassword: string, newPassword: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idNo, currentPassword, newPassword }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে!');
    }
  } catch (err: any) {
    // Local fallback update
    console.warn('Backend change-password failed, fallback to localStorage update:', err);
  }

  // Always update local storage cache too
  try {
    const cached = localStorage.getItem(USERS_STORAGE_KEY);
    const users: UserAccount[] = cached ? JSON.parse(cached) : [...DEFAULT_WBSEDCL_ACCOUNTS];
    const index = users.findIndex(u => u.idNo.toLowerCase() === idNo.toLowerCase() || u.id === idNo);
    if (index !== -1) {
      users[index].password = newPassword;
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }
  } catch {}

  return true;
}

export async function resetUserPassword(idNo: string, newPassword: string, phone?: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idNo, phone, newPassword }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে!');
    }
  } catch (err: any) {
    console.warn('Backend reset-password failed, fallback to localStorage update:', err);
  }

  // Update local storage cache
  try {
    const cached = localStorage.getItem(USERS_STORAGE_KEY);
    const users: UserAccount[] = cached ? JSON.parse(cached) : [...DEFAULT_WBSEDCL_ACCOUNTS];
    const index = users.findIndex(u => u.idNo.toLowerCase() === idNo.toLowerCase() || (phone && u.phone.replace(/[^0-9]/g, '') === phone.replace(/[^0-9]/g, '')));
    if (index !== -1) {
      users[index].password = newPassword;
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }
  } catch {}

  return true;
}

// Live Chat Support API
const CHAT_LOCAL_KEY = 'power_chat_history';

export async function fetchChatMessages(workerId?: string) {
  try {
    const params = workerId ? `?workerId=${encodeURIComponent(workerId)}` : '';
    const res = await fetch(`${API_BASE}/chat${params}`);
    if (!res.ok) throw new Error('Failed to fetch chat');
    const data = await res.json();
    try {
      localStorage.setItem(CHAT_LOCAL_KEY, JSON.stringify(data));
    } catch {}
    return data;
  } catch (err) {
    const cached = localStorage.getItem(CHAT_LOCAL_KEY);
    if (cached) {
      try {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) return list;
      } catch {}
    }
    return [];
  }
}

export async function sendChatMessage(payload: {
  senderId: string;
  senderName: string;
  senderRole: 'admin' | 'worker' | 'supervisor';
  recipientId?: string;
  message: string;
}) {
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to send chat message');
    }
    const data = await res.json();
    return data.message;
  } catch (err: any) {
    const fallbackMsg = {
      id: `msg_${Date.now()}`,
      ...payload,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };
    const cached = localStorage.getItem(CHAT_LOCAL_KEY);
    const list = cached ? JSON.parse(cached) : [];
    list.push(fallbackMsg);
    localStorage.setItem(CHAT_LOCAL_KEY, JSON.stringify(list));
    return fallbackMsg;
  }
}

export async function clearChatMessages(): Promise<boolean> {
  try {
    await fetch(`${API_BASE}/chat`, { method: 'DELETE' });
    localStorage.removeItem(CHAT_LOCAL_KEY);
    return true;
  } catch {
    localStorage.removeItem(CHAT_LOCAL_KEY);
    return true;
  }
}

// Work Order / Khata Notice API services
export async function fetchWorkOrders(category?: string): Promise<WorkOrderNotice[]> {
  try {
    const params = new URLSearchParams();
    if (category && category !== 'ALL') params.append('category', category);
    const res = await fetch(`${API_BASE}/work-orders?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data: WorkOrderNotice[] = await res.json();
    try {
      localStorage.setItem(WORK_ORDERS_STORAGE_KEY, JSON.stringify(data));
    } catch {}
    return data;
  } catch (error) {
    console.warn('Backend work-orders fetch failed, using local cache:', error);
    const cached = localStorage.getItem(WORK_ORDERS_STORAGE_KEY);
    if (cached) {
      let list: WorkOrderNotice[] = JSON.parse(cached);
      if (category && category !== 'ALL') {
        list = list.filter(item => item.category === category || item.category === ('ALL' as any));
      }
      return list;
    }
    return [];
  }
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to upload work order photo');
    }
    const data = await res.json();
    return data.workOrder;
  } catch (error: any) {
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
    try {
      const cached = localStorage.getItem(WORK_ORDERS_STORAGE_KEY);
      const list: WorkOrderNotice[] = cached ? JSON.parse(cached) : [];
      list.unshift(fallbackOrder);
      localStorage.setItem(WORK_ORDERS_STORAGE_KEY, JSON.stringify(list.slice(0, 15)));
    } catch (cacheErr) {
      console.warn('LocalStorage save failed for work order (quota or disabled):', cacheErr);
    }
    return fallbackOrder;
  }
}

export async function toggleWorkOrderVisibility(id: string, isHidden: boolean): Promise<boolean> {
  try {
    let res = await fetch(`${API_BASE}/work-orders/${encodeURIComponent(id)}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHidden }),
    });
    if (!res.ok) {
      // Try POST fallback
      res = await fetch(`${API_BASE}/work-orders/${encodeURIComponent(id)}/visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHidden }),
      });
    }
  } catch (err) {
    console.warn('Network toggle error, applying locally:', err);
  }

  // Update client cache
  try {
    const cached = localStorage.getItem(WORK_ORDERS_STORAGE_KEY);
    if (cached) {
      const list: WorkOrderNotice[] = JSON.parse(cached);
      const updated = list.map(item => String(item.id) === String(id) ? { ...item, isHidden } : item);
      localStorage.setItem(WORK_ORDERS_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {}
  return true;
}

export async function deleteWorkOrder(id: string): Promise<boolean> {
  try {
    let res = await fetch(`${API_BASE}/work-orders/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) {
      // Try POST /delete fallback
      res = await fetch(`${API_BASE}/work-orders/${encodeURIComponent(id)}/delete`, { method: 'POST' });
    }
  } catch (err) {
    console.warn('Network delete error, applying locally:', err);
  }

  // Update client cache
  try {
    const cached = localStorage.getItem(WORK_ORDERS_STORAGE_KEY);
    if (cached) {
      const list: WorkOrderNotice[] = JSON.parse(cached);
      const updated = list.filter(item => String(item.id) !== String(id));
      localStorage.setItem(WORK_ORDERS_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {}
  return true;
}

