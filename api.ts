import { PowerEntry, StatsResponse, CategoryType, UserAccount, UserSession, WorkOrderNotice, ChatMessage } from '../types';
import { normalizeUniversalText, normalizePassword, isUserMatch } from '../utils/textNormalizer';

const API_BASE = (import.meta.env.VITE_GOOGLE_SHEET_API_URL || 'https://script.google.com/macros/s/AKfycbzVV5sqqypop3sr19hstcti76QXw4aGIKHqAut31pcYMcOuffGwsAmtfbbOnx3KVB_7/exec').replace(/\/$/, '');
const LOCAL_STORAGE_KEY = 'power_app_entries_cache';
const USERS_STORAGE_KEY = 'power_registered_users';
const WORK_ORDERS_STORAGE_KEY = 'power_work_orders_cache';
const CHAT_LOCAL_KEY = 'power_chat_history';

export const DEFAULT_WBSEDCL_ACCOUNTS: UserAccount[] = [
  { id: 'worker_default_0000', idNo: 'worker', password: '0000', name: 'Field Worker (WBSEDCL)', phone: '', role: 'worker', status: 'active', designation: 'লাইনম্যান / Worker (WBSEDCL)', badgeNo: 'WRK-0000', securityQuestion: 'আপনার প্রিয় সাবস্টেশন / অফিস?', securityAnswer: 'Vidyut Bhavan', createdAt: new Date().toISOString() },
  { id: 'adm_8695716192', idNo: '8695716192', password: '6293', name: 'Engr. N. Ali (Admin Controller)', phone: '8695716192', role: 'admin', status: 'active', designation: 'Assistant Engineer / Divisional Admin (WBSEDCL)', badgeNo: 'ADM-8695', securityQuestion: 'Your Primary Power Substation?', securityAnswer: 'Vidyut Bhavan', createdAt: new Date().toISOString() }
];

async function get(action: string, params: Record<string, string | undefined> = {}) {
  const q = new URLSearchParams({ action, _t: Date.now().toString() });
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, v); });
  const res = await fetch(`${API_BASE}?${q.toString()}`, { cache: 'no-store' });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { throw new Error('Invalid backend response'); }
  if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function post(action: string, data: any = {}) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...data })
  });
  const text = await res.text();
  let result: any = {};
  try { result = text ? JSON.parse(text) : {}; } catch { throw new Error('Invalid backend response'); }
  if (!res.ok || result.success === false) throw new Error(result.error || `HTTP ${res.status}`);
  return result;
}

function cache<T>(key: string, value: T) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function readCache<T>(key: string, fallback: T): T { try { const x = localStorage.getItem(key); return x ? JSON.parse(x) : fallback; } catch { return fallback; } }

export async function syncPendingEntries(): Promise<number> {
  const list: any[] = readCache(LOCAL_STORAGE_KEY, []);
  const pending = list.filter(e => e._isPendingSync);
  let count = 0;
  for (const item of pending) {
    try { const { _isPendingSync, ...clean } = item; await post('createEntry', { data: clean }); item._isPendingSync = false; count++; } catch {}
  }
  if (count) cache(LOCAL_STORAGE_KEY, list);
  return count;
}

export async function fetchEntries(filters?: { category?: string; status?: string; search?: string }): Promise<PowerEntry[]> {
  syncPendingEntries().catch(() => {});
  try {
    const data = await get('entries', filters || {});
    const entries: PowerEntry[] = data.entries || [];
    cache(LOCAL_STORAGE_KEY, entries.slice(0, 100));
    return entries;
  } catch (error) {
    console.warn('Google Sheet fetch failed:', error);
    let list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []);
    if (filters?.category && filters.category !== 'ALL') list = list.filter(e => e.category === filters.category);
    if (filters?.status && filters.status !== 'ALL') list = list.filter(e => e.status === filters.status);
    if (filters?.search) { const q = filters.search.toLowerCase(); list = list.filter(e => JSON.stringify(e).toLowerCase().includes(q)); }
    return list;
  }
}

export async function createEntry(entryData: Partial<PowerEntry>): Promise<PowerEntry> {
  try {
    const result = await post('createEntry', { data: entryData });
    const saved = result.entry as PowerEntry;
    const list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []);
    cache(LOCAL_STORAGE_KEY, [saved, ...list.filter(e => e.id !== saved.id)].slice(0, 100));
    return saved;
  } catch (error) {
    const fallback: any = { ...entryData, id: entryData.id || `PWR-${Date.now()}`, date: entryData.date || new Date().toISOString(), createdAt: entryData.createdAt || new Date().toISOString(), status: entryData.status || 'Completed', _isPendingSync: true };
    cache(LOCAL_STORAGE_KEY, [fallback, ...readCache<any[]>(LOCAL_STORAGE_KEY, [])].slice(0, 100));
    return fallback;
  }
}

export async function updateEntry(id: string, updates: Partial<PowerEntry>): Promise<PowerEntry> {
  try { const r = await post('updateEntry', { id, data: updates }); return r.entry; }
  catch (error) { const list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []); const i = list.findIndex(e => e.id === id); if (i >= 0) { list[i] = { ...list[i], ...updates, updatedAt: new Date().toISOString() }; cache(LOCAL_STORAGE_KEY, list); return list[i]; } throw error; }
}
export async function deleteEntry(id: string): Promise<boolean> { try { await post('deleteEntry', { id }); } catch {} const list = readCache<PowerEntry[]>(LOCAL_STORAGE_KEY, []); cache(LOCAL_STORAGE_KEY, list.filter(e => e.id !== id)); return true; }
export async function clearAllEntries(): Promise<boolean> { try { await post('clearEntries'); } catch {} localStorage.removeItem(LOCAL_STORAGE_KEY); return true; }

export async function fetchStats(): Promise<StatsResponse> {
  try { const r = await get('stats'); return r.stats; }
  catch { const e = await fetchEntries(); return { total: e.length, categories: { NSC: e.filter(x=>x.category==='NSC').length, DISCONNECTION: e.filter(x=>x.category==='DISCONNECTION').length, POLE_CASE: e.filter(x=>x.category==='POLE CASE').length, METER_REPLESMENT: e.filter(x=>x.category==='METER REPLESMENT').length, DTR_REPLESMENT: e.filter(x=>x.category==='DTR REPLESMENT').length }, status: { pending: e.filter(x=>x.status==='Pending').length, completed: e.filter(x=>x.status==='Completed').length, approved: e.filter(x=>x.status==='Approved').length } }; }
}

export async function fetchUsers(): Promise<UserAccount[]> {
  try { const r = await get('users'); const users = r.users || []; cache(USERS_STORAGE_KEY, users); return users; }
  catch { return readCache(USERS_STORAGE_KEY, DEFAULT_WBSEDCL_ACCOUNTS); }
}

export async function createUserAccount(userData: Partial<UserAccount>): Promise<UserAccount> {
  const cleanId = normalizeUniversalText(userData.idNo); const cleanPass = normalizePassword(userData.password); const cleanName = String(userData.name || cleanId || 'কর্মী').trim(); const cleanPhone = normalizeUniversalText(userData.phone).replace(/[^0-9]/g, '');
  const r = await post('createUser', { data: { ...userData, idNo: cleanId, password: cleanPass, name: cleanName, phone: cleanPhone } });
  const user = r.user as UserAccount; const users = await fetchUsers().catch(()=>[]); cache(USERS_STORAGE_KEY, [user, ...users.filter(u=>u.id!==user.id && u.idNo!==user.idNo)]); return user;
}
export async function updateUserAccount(id: string, updates: Partial<UserAccount>): Promise<UserAccount> { const r = await post('updateUser', { id, data: updates }); await fetchUsers(); return r.user; }
export async function deleteUserAccount(id: string): Promise<boolean> { await post('deleteUser', { id }); cache(USERS_STORAGE_KEY, readCache<UserAccount[]>(USERS_STORAGE_KEY, []).filter(u=>u.id!==id && u.idNo!==id)); return true; }
export async function updateUserStatus(id: string, status: 'active' | 'hold'): Promise<UserAccount> { const r = await post('updateUserStatus', { id, status }); await fetchUsers(); return r.user; }

export async function verifyUserSession(idNo: string): Promise<{ valid: boolean; status?: 'active' | 'hold'; error?: string }> {
  try { return (await get('verify', { idNo })).result; } catch { return { valid: false, error: 'Session verification failed' }; }
}

export async function loginUser(loginId: string, password: string): Promise<UserSession> {
  const cleanId = normalizeUniversalText(loginId); const cleanPass = normalizePassword(password);
  try { return (await post('login', { idNo: cleanId, password: cleanPass })).session; }
  catch (err: any) { const cached = readCache<UserAccount[]>(USERS_STORAGE_KEY, DEFAULT_WBSEDCL_ACCOUNTS); const found = cached.find(u => isUserMatch(cleanId, u)); if (found && normalizePassword(found.password) === cleanPass && found.status !== 'hold') return { id: found.id, idNo: found.idNo, name: found.name, phone: found.phone, role: found.role, status: found.status || 'active', designation: found.designation, badgeNo: found.badgeNo || found.idNo, loggedInAt: new Date().toISOString() }; throw new Error(err?.message || 'ভুল আইডি বা পাসওয়ার্ড!'); }
}
export async function changeUserPassword(idNo: string, currentPassword: string, newPassword: string): Promise<boolean> { await post('changePassword', { idNo, currentPassword, newPassword }); return true; }
export async function resetUserPassword(idNo: string, newPassword: string, phone?: string): Promise<boolean> { await post('resetPassword', { idNo, newPassword, phone }); return true; }

export async function fetchChatMessages(workerId?: string): Promise<ChatMessage[]> { try { const r = await get('chat', { workerId }); const data = r.messages || []; cache(CHAT_LOCAL_KEY, data); return data; } catch { return readCache(CHAT_LOCAL_KEY, []); } }
export async function sendChatMessage(payload: { senderId: string; senderName: string; senderRole: 'admin'|'worker'|'supervisor'; recipientId?: string; message: string }) { const r = await post('sendChat', { data: payload }); const msg = r.message; const list = readCache<ChatMessage[]>(CHAT_LOCAL_KEY, []); cache(CHAT_LOCAL_KEY, [...list, msg]); return msg; }
export async function clearChatMessages(): Promise<boolean> { try { await post('clearChat'); } catch {} localStorage.removeItem(CHAT_LOCAL_KEY); return true; }

export async function fetchWorkOrders(category?: string): Promise<WorkOrderNotice[]> { try { const r = await get('workorders', { category }); const data = r.workOrders || []; cache(WORK_ORDERS_STORAGE_KEY, data); return data; } catch { return readCache(WORK_ORDERS_STORAGE_KEY, []); } }
export async function uploadWorkOrder(payload: { category: CategoryType; title: string; photoUrl: string; description?: string; uploadedBy: string; adminName: string; adminPhone?: string; isHidden?: boolean }): Promise<WorkOrderNotice> { const r = await post('createWorkOrder', { data: payload }); const order = r.workOrder; const list = readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []); cache(WORK_ORDERS_STORAGE_KEY, [order, ...list.filter(x=>x.id!==order.id)].slice(0,50)); return order; }
export async function toggleWorkOrderVisibility(id: string, isHidden: boolean): Promise<boolean> { await post('toggleWorkOrder', { id, isHidden }); const list = readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []); cache(WORK_ORDERS_STORAGE_KEY, list.map(x=>x.id===id?{...x,isHidden}:x)); return true; }
export async function deleteWorkOrder(id: string): Promise<boolean> { await post('deleteWorkOrder', { id }); cache(WORK_ORDERS_STORAGE_KEY, readCache<WorkOrderNotice[]>(WORK_ORDERS_STORAGE_KEY, []).filter(x=>x.id!==id)); return true; }
