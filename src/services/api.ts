import { PowerEntry, StatsResponse, CategoryType } from '../types';

const API_BASE = '/api';
const LOCAL_STORAGE_KEY = 'power_app_entries_cache';

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
