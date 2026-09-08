import express from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import { createServer as createViteServer } from 'vite';

// Ensure IPv4 resolution first for stable script.google.com connection
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // ignore
}

const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzVV5sqqypop3sr19hstcti76QXw4aGIKHqAut31pcYMcOuffGwsAmtfbbOnx3KVB_7/exec';
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1-3LtAbXZU6klisReK6ffIxDUwbM4wXvhxSbKVpE7raY';

// Helper to communicate with Google Apps Script Web App (Single source of truth)
async function callGoogleAppsScript(
  action: string, 
  payload: any = {}, 
  method: 'GET' | 'POST' = 'POST',
  timeoutMs = 15000
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    try { controller.abort(); } catch {}
  }, timeoutMs);

  try {
    let url = GOOGLE_APPS_SCRIPT_URL;
    const options: RequestInit = {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'Accept': 'application/json'
      }
    };

    if (method === 'GET') {
      const sep = url.includes('?') ? '&' : '?';
      const queryParams: Record<string, string> = { action };
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined && value !== null) {
          queryParams[key] = String(value);
        }
      }
      const params = new URLSearchParams(queryParams);
      url = `${url}${sep}${params.toString()}`;
      options.method = 'GET';
    } else {
      options.method = 'POST';
      options.headers = {
        ...options.headers,
        'Content-Type': 'text/plain;charset=utf-8'
      };
      options.body = JSON.stringify({ action, ...payload });
    }

    const res = await fetch(url, options);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Google Apps Script returned non-JSON response: ${text.slice(0, 150)}`);
    }
  } catch (err: any) {
    if (err && err.name === 'AbortError') {
      console.warn(`[GoogleAppsScript] action "${action}" timed out after ${timeoutMs}ms.`);
      throw new Error('Backend request timed out. Please try again.');
    }
    console.error(`[GoogleAppsScript] action "${action}" error:`, err?.message || err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '80mb' }));
app.use(express.urlencoded({ limit: '80mb', extended: true }));

// Ensure data directory exists for local non-user data (entries and chat)
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'entries.json');
const CHAT_FILE = path.join(DATA_DIR, 'chat.json');
const WORK_ORDERS_FILE = path.join(DATA_DIR, 'work_orders.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Security Middleware & Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=()');
  next();
});

// In-memory cache variables for non-user data
let cachedEntries: any[] | null = null;
let cachedWorkOrders: any[] | null = null;
let cachedChat: any[] | null = null;

// Helper to read live chat messages
function readChat() {
  if (cachedChat) return cachedChat;
  try {
    if (!fs.existsSync(CHAT_FILE)) {
      fs.writeFileSync(CHAT_FILE, JSON.stringify([], null, 2), 'utf-8');
      cachedChat = [];
      return [];
    }
    const content = fs.readFileSync(CHAT_FILE, 'utf-8');
    const parsed = JSON.parse(content || '[]');
    cachedChat = parsed;
    return parsed;
  } catch (err) {
    console.error('Error reading chat:', err);
    return [];
  }
}

// Helper to write live chat messages
function writeChat(messages: any[]) {
  cachedChat = messages;
  try {
    fs.writeFileSync(CHAT_FILE, JSON.stringify(messages, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing chat:', err);
  }
}

// Helper to read work order / khata notices
function readWorkOrders() {
  if (cachedWorkOrders) return cachedWorkOrders;
  try {
    if (!fs.existsSync(WORK_ORDERS_FILE)) {
      fs.writeFileSync(WORK_ORDERS_FILE, JSON.stringify([], null, 2), 'utf-8');
      cachedWorkOrders = [];
      return [];
    }
    const content = fs.readFileSync(WORK_ORDERS_FILE, 'utf-8');
    const parsed = JSON.parse(content || '[]');
    cachedWorkOrders = parsed;
    return parsed;
  } catch (err) {
    console.error('Error reading work orders:', err);
    return [];
  }
}

// Helper to write work order / khata notices
function writeWorkOrders(orders: any[]) {
  cachedWorkOrders = orders;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(WORK_ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing work orders:', err);
    throw err;
  }
}

// Initial power utility entries (empty by default - no demo records)
const INITIAL_ENTRIES: any[] = [];

// Helper to read entries
function readEntries() {
  if (cachedEntries) return cachedEntries;
  try {
    if (!fs.existsSync(DATA_FILE)) {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
      cachedEntries = [];
      return [];
    }
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(content || '[]');
    const clean = Array.isArray(parsed) ? parsed.filter((e: any) => e && ((e.id && String(e.id).trim() !== '') || (e.consumerName && String(e.consumerName).trim() !== '') || (e.category && String(e.category).trim() !== ''))) : [];
    cachedEntries = clean;
    return clean;
  } catch (err) {
    console.error('Error reading entries:', err);
    return [];
  }
}

// Helper to write entries
function writeEntries(entries: any[]) {
  cachedEntries = entries;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing entries:', err);
    throw err;
  }
}

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({ status: 'ok', app: 'POWER Utility Management' });
});

// Get all entries with optional category/status/search query (from Google Sheets via GAS)
app.get('/api/entries', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { category, status, search } = req.query;

  try {
    const result = await callGoogleAppsScript('entries', req.query, 'GET');
    if (result && result.success && Array.isArray(result.entries)) {
      const cleanList = result.entries.filter((e: any) => e && ((e.id && String(e.id).trim() !== '') || (e.consumerName && String(e.consumerName).trim() !== '') || (e.category && String(e.category).trim() !== '')));
      writeEntries(cleanList);
      return res.json(cleanList);
    }
  } catch (e) {
    console.warn('Failed to fetch entries from Google Sheets, using local cache:', e);
  }

  let entries = readEntries();
  if (category && category !== 'ALL') {
    entries = entries.filter((e: any) => e.category === category);
  }
  if (status && status !== 'ALL') {
    entries = entries.filter((e: any) => e.status === status);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    entries = entries.filter((e: any) => 
      (e.id && e.id.toLowerCase().includes(q)) ||
      (e.consumerName && e.consumerName.toLowerCase().includes(q)) ||
      (e.consumerId && e.consumerId.toLowerCase().includes(q)) ||
      (e.poleNo && e.poleNo.toLowerCase().includes(q)) ||
      (e.meterNo && e.meterNo.toLowerCase().includes(q)) ||
      (e.oldMeterNo && e.oldMeterNo.toLowerCase().includes(q)) ||
      (e.newMeterNo && e.newMeterNo.toLowerCase().includes(q)) ||
      (e.dtrName && e.dtrName.toLowerCase().includes(q)) ||
      (e.workerName && e.workerName.toLowerCase().includes(q)) ||
      (e.address && e.address.toLowerCase().includes(q)) ||
      (e.feederName && e.feederName.toLowerCase().includes(q))
    );
  }
  res.json(entries);
});

// Create or update entry in Google Sheets
app.post('/api/entries', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const newEntry = {
      ...req.body,
      id: req.body.id || `PWR-${Date.now().toString().slice(-6)}`,
      date: req.body.date || req.body.createdAt || new Date().toISOString(),
      createdAt: req.body.createdAt || req.body.date || new Date().toISOString(),
      status: req.body.status || 'Completed'
    };

    // Update local cache immediately
    const entries = readEntries();
    const existingIndex = entries.findIndex((e: any) => e.id === newEntry.id);
    if (existingIndex !== -1) {
      entries[existingIndex] = { ...entries[existingIndex], ...newEntry };
    } else {
      entries.unshift(newEntry);
    }
    writeEntries(entries);

    // Save to Google Sheets
    try {
      const result = await callGoogleAppsScript('createEntry', { data: newEntry }, 'POST');
      if (result && result.entry) {
        return res.status(201).json({ success: true, entry: result.entry });
      }
    } catch (e) {
      console.warn('Failed to save entry to Google Sheets:', e);
    }

    res.status(201).json({ success: true, entry: newEntry });
  } catch (error: any) {
    console.error('Error saving entry:', error);
    res.status(500).json({ error: error.message || 'Failed to save entry' });
  }
});

// Bulk sync endpoint for offline submissions
app.post('/api/entries/bulk', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const { entries: incomingList } = req.body;
    if (!Array.isArray(incomingList)) {
      return res.status(400).json({ error: 'Array of entries is required' });
    }
    const currentEntries = readEntries();
    for (const item of incomingList) {
      const idx = currentEntries.findIndex((e: any) => e.id === item.id);
      if (idx !== -1) {
        currentEntries[idx] = { ...currentEntries[idx], ...item };
      } else {
        currentEntries.unshift(item);
      }
    }
    writeEntries(currentEntries);

    try {
      await callGoogleAppsScript('bulkSync', { entries: incomingList }, 'POST');
    } catch (e) {
      console.warn('Failed to bulk sync entries to Google Sheets:', e);
    }

    res.json({ success: true, count: incomingList.length });
  } catch (error: any) {
    console.error('Bulk sync error:', error);
    res.status(500).json({ error: 'Failed to bulk sync entries' });
  }
});

// Update status or notes in Google Sheets
app.patch('/api/entries/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { id } = req.params;
  const entries = readEntries();
  const index = entries.findIndex((e: any) => e.id === id);

  if (index !== -1) {
    entries[index] = { ...entries[index], ...req.body, updatedAt: new Date().toISOString() };
    writeEntries(entries);
  }

  try {
    const result = await callGoogleAppsScript('updateEntry', { id, data: req.body }, 'POST');
    if (result && result.entry) {
      return res.json({ success: true, entry: result.entry });
    }
  } catch (e) {
    console.warn('Failed to update entry in Google Sheets:', e);
  }

  if (index === -1) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  res.json({ success: true, entry: entries[index] });
});

// Delete entry (Admin only) from Google Sheets
app.delete('/api/entries/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { id } = req.params;
  let entries = readEntries();
  entries = entries.filter((e: any) => e.id !== id);
  writeEntries(entries);

  try {
    await callGoogleAppsScript('deleteEntry', { id }, 'POST');
  } catch (e) {
    console.warn('Failed to delete entry in Google Sheets:', e);
  }

  res.json({ success: true, message: 'Entry deleted successfully' });
});

// Clear all entries (Admin only) from Google Sheets
app.delete('/api/entries', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  writeEntries([]);

  try {
    await callGoogleAppsScript('clearEntries', {}, 'POST');
  } catch (e) {
    console.warn('Failed to clear entries in Google Sheets:', e);
  }

  res.json({ success: true, message: 'All entries deleted successfully' });
});

// User Authentication & Management Endpoints (Persisted in Google Sheets via Google Apps Script)

// Helper to normalize Unicode, non-ASCII numerals (Bengali, Hindi, Arabic), dashes and invisible spaces
function normalizeUniversal(val: any): string {
  if (val === null || val === undefined) return '';
  let s = String(val);
  try {
    s = s.normalize('NFKC');
  } catch {
    // ignore
  }
  // Strip zero-width, BOM, non-breaking spaces
  s = s.replace(/[\u200B-\u200D\uFEFF\u00A0\u200E\u200F\u180E\u202F\u205F\u3000\u00AD]/g, '');
  // Bengali numerals ০-৯
  s = s.replace(/[\u09E6-\u09EF]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x09E6 + 48));
  // Devanagari numerals ०-९
  s = s.replace(/[\u0966-\u096F]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x0966 + 48));
  // Arabic-Indic numerals ٠-٩
  s = s.replace(/[\u0660-\u0669]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x0660 + 48));
  // Eastern Arabic numerals ۰-۹
  s = s.replace(/[\u06F0-\u06F9]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x06F0 + 48));
  // Standardize various dash symbols to ASCII '-'
  s = s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-');
  return s.trim();
}

// ==========================================================
// USER MANAGEMENT & AUTHENTICATION (GOOGLE SHEETS EXCLUSIVE)
// ==========================================================

// Helper to resolve an identifier (id or idNo) to a user's sheet id in Google Sheets
async function resolveGoogleSheetUserId(identifier: string): Promise<{ id: string; user?: any } | null> {
  const clean = normalizeUniversal(identifier).toLowerCase();
  try {
    const res = await callGoogleAppsScript('users', {}, 'GET');
    if (res && res.success && Array.isArray(res.users)) {
      const match = res.users.find((u: any) => 
        String(u.id).toLowerCase() === clean || 
        String(u.idNo).toLowerCase() === clean
      );
      if (match) {
        return { id: String(match.id), user: match };
      }
    }
  } catch (e) {
    console.error('Failed to resolve user ID from Google Sheets:', e);
  }
  return null;
}

// Get all users exclusively from Google Sheets
app.get('/api/users', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const result = await callGoogleAppsScript('users', {}, 'GET');
    if (result && result.success && Array.isArray(result.users)) {
      return res.json({ success: true, users: result.users });
    }
    return res.status(502).json({ 
      success: false, 
      error: result?.error || 'Failed to fetch users from Google Sheets' 
    });
  } catch (err: any) {
    console.error('Error fetching users from Google Sheets:', err);
    return res.status(503).json({ 
      success: false, 
      error: err?.message || 'Google Sheets backend connection error. Please try again.' 
    });
  }
});

// Create new user in Google Sheets
app.post('/api/users', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const { idNo, name, password, role, phone, designation, badgeNo, status, securityQuestion, securityAnswer } = req.body;

    const cleanId = normalizeUniversal(idNo);
    const cleanPass = normalizeUniversal(password);
    const cleanName = (name ? String(name).trim() : cleanId) || 'কর্মী';
    const cleanPhone = normalizeUniversal(phone).replace(/[^0-9]/g, '');

    if (!cleanId) {
      return res.status(400).json({ success: false, error: 'User ID No is required' });
    }
    if (!cleanPass) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    const assignedRole = role === 'admin' ? 'admin' : (role === 'supervisor' ? 'supervisor' : 'worker');

    const userData = {
      idNo: cleanId,
      password: cleanPass,
      name: cleanName,
      phone: cleanPhone || '',
      role: assignedRole,
      status: status === 'hold' ? 'hold' : 'active',
      designation: designation?.trim() || (assignedRole === 'admin' ? 'সহকারী প্রকৌশলী / Admin (WBSEDCL)' : 'লাইনম্যান / Worker (WBSEDCL)'),
      badgeNo: badgeNo ? normalizeUniversal(badgeNo) : cleanId,
      securityQuestion: securityQuestion || 'আপনার প্রিয় সাবস্টেশন / অফিস?',
      securityAnswer: securityAnswer ? normalizeUniversal(securityAnswer) : 'Vidyut Bhavan'
    };

    const result = await callGoogleAppsScript('createUser', { data: userData }, 'POST');
    if (result && result.success) {
      return res.status(201).json({ success: true, user: result.user || userData });
    }

    return res.status(400).json({ 
      success: false, 
      error: result?.error || 'Failed to create user in Google Sheets' 
    });
  } catch (error: any) {
    console.error('Error creating user in Google Sheets:', error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || 'Google Sheets backend connection error' 
    });
  }
});

// Update user details in Google Sheets
app.patch('/api/users/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { id } = req.params;
  const updates = req.body || {};

  try {
    const resolved = await resolveGoogleSheetUserId(id);
    const targetId = resolved ? resolved.id : id;
    const targetIdNo = resolved?.user?.idNo || id;

    const result = await callGoogleAppsScript('updateUser', { id: targetId, idNo: targetIdNo, data: updates }, 'POST');

    if (result && result.success) {
      return res.json({ success: true, user: result.user });
    }
    return res.status(400).json({ 
      success: false, 
      error: result?.error || 'Failed to update user in Google Sheets' 
    });
  } catch (error: any) {
    console.error('Error updating user in Google Sheets:', error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || 'Google Sheets backend error' 
    });
  }
});

// Update user status (active / hold) in Google Sheets
app.patch('/api/users/:id/status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { id } = req.params;
  const { status } = req.body;
  const cleanId = normalizeUniversal(id).toLowerCase();

  if (status !== 'active' && status !== 'hold') {
    return res.status(400).json({ success: false, error: 'Status must be either "active" or "hold"' });
  }

  if ((cleanId === '8695716192' || cleanId === 'adm_8695716192' || cleanId === 'admin') && status === 'hold') {
    return res.status(403).json({ success: false, error: 'Primary Admin account cannot be placed on hold' });
  }

  try {
    const resolved = await resolveGoogleSheetUserId(id);
    const targetId = resolved ? resolved.id : id;
    const targetIdNo = resolved?.user?.idNo || id;

    const result = await callGoogleAppsScript('updateUserStatus', { id: targetId, idNo: targetIdNo, status }, 'POST');

    if (result && result.success) {
      return res.json({ success: true, user: result.user, message: `Status updated to ${status}` });
    }
    return res.status(400).json({ 
      success: false, 
      error: result?.error || 'Failed to update user status in Google Sheets' 
    });
  } catch (error: any) {
    console.error('Error updating status in Google Sheets:', error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || 'Google Sheets backend error' 
    });
  }
});

// Delete user permanently from Google Sheets
app.delete('/api/users/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { id } = req.params;
  const cleanId = normalizeUniversal(id).toLowerCase();

  if (cleanId === '8695716192' || cleanId === 'adm_8695716192' || cleanId === 'admin') {
    return res.status(403).json({ success: false, error: 'Primary Admin account cannot be deleted' });
  }

  try {
    const resolved = await resolveGoogleSheetUserId(id);
    const targetId = resolved ? resolved.id : id;
    const targetIdNo = resolved?.user?.idNo || id;

    const result = await callGoogleAppsScript('deleteUser', { id: targetId, idNo: targetIdNo }, 'POST');

    if (result && result.success) {
      return res.json({ success: true, message: 'User deleted from Google Sheets successfully' });
    }
    return res.status(400).json({ 
      success: false, 
      error: result?.error || 'Failed to delete user in Google Sheets' 
    });
  } catch (error: any) {
    console.error('Error deleting user in Google Sheets:', error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || 'Google Sheets backend error' 
    });
  }
});

// Authenticate login with Google Sheets backend
app.post('/api/auth/login', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const { loginId, password } = req.body;
    if (!loginId || !password) {
      return res.status(400).json({ success: false, error: 'Login ID and Password are required' });
    }

    const cleanId = normalizeUniversal(loginId).trim();
    const cleanPass = normalizeUniversal(password).trim();

    const result = await callGoogleAppsScript('login', { idNo: cleanId, password: cleanPass }, 'POST');
    if (result && result.success && result.session) {
      return res.json({ success: true, session: result.session });
    }

    const errorMsg = result?.error || 'Invalid User ID or Password';
    return res.status(401).json({ success: false, error: errorMsg });
  } catch (error: any) {
    console.error('Login backend error:', error);
    return res.status(503).json({ 
      success: false, 
      error: error?.message || 'Backend connection failed. Please try again.' 
    });
  }
});

// Change password in Google Sheets
app.post('/api/auth/change-password', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const { idNo, currentPassword, newPassword } = req.body;
    if (!idNo || !newPassword) {
      return res.status(400).json({ success: false, error: 'User ID and New Password are required' });
    }

    const cleanId = normalizeUniversal(idNo);
    const cleanCurrent = normalizeUniversal(currentPassword);
    const cleanNew = normalizeUniversal(newPassword);

    const result = await callGoogleAppsScript('changePassword', {
      idNo: cleanId,
      currentPassword: cleanCurrent,
      newPassword: cleanNew
    }, 'POST');

    if (result && result.success) {
      return res.json({ success: true, message: 'Password changed successfully' });
    }

    return res.status(400).json({ 
      success: false, 
      error: result?.error || 'Failed to change password in Google Sheets' 
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || 'Backend connection error' 
    });
  }
});

// Reset password in Google Sheets
app.post('/api/auth/reset-password', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const { idNo, phone, newPassword } = req.body;
    if (!idNo || !newPassword) {
      return res.status(400).json({ success: false, error: 'User ID and New Password are required' });
    }

    const cleanId = normalizeUniversal(idNo);
    const cleanPhone = normalizeUniversal(phone).replace(/[^0-9]/g, '');
    const cleanNew = normalizeUniversal(newPassword);

    const result = await callGoogleAppsScript('resetPassword', {
      idNo: cleanId,
      phone: cleanPhone,
      newPassword: cleanNew
    }, 'POST');

    if (result && result.success) {
      return res.json({ success: true, message: 'Password reset successfully' });
    }

    return res.status(400).json({ 
      success: false, 
      error: result?.error || 'Failed to reset password in Google Sheets' 
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || 'Backend connection error' 
    });
  }
});

// Verify active session with Google Sheets
app.get('/api/auth/verify/:idNo', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { idNo } = req.params;
  const cleanId = normalizeUniversal(idNo).trim();

  try {
    const resolved = await resolveGoogleSheetUserId(cleanId);
    if (resolved && resolved.user) {
      if (resolved.user.status === 'hold') {
        return res.status(403).json({ valid: false, status: 'hold', error: 'User account is currently ON HOLD' });
      }
      return res.json({ valid: true, status: resolved.user.status || 'active', role: resolved.user.role });
    }
    return res.status(404).json({ valid: false, error: 'User not found in Google Sheets' });
  } catch (error: any) {
    return res.status(503).json({ valid: false, error: error?.message || 'Backend connection error' });
  }
});

// Live Chat Support Endpoints between Workers & Admin
app.get('/api/chat', (req, res) => {
  try {
    const { workerId, role } = req.query;
    const messages = readChat();

    if (workerId) {
      const filtered = messages.filter((m: any) => 
        m.senderId === workerId || 
        m.recipientId === workerId || 
        m.recipientId === 'all' ||
        m.senderRole === 'admin'
      );
      return res.json(filtered);
    }

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load chat messages' });
  }
});

app.post('/api/chat', (req, res) => {
  try {
    const { senderId, senderName, senderRole, recipientId, message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const messages = readChat();
    const newMsg = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      senderId: senderId || 'anonymous',
      senderName: senderName || 'User',
      senderRole: senderRole || 'worker',
      recipientId: recipientId || 'all',
      recipientRole: senderRole === 'worker' ? 'admin' : 'worker',
      message: message.trim(),
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    messages.push(newMsg);
    // Keep last 500 messages to maintain speed
    const trimmed = messages.slice(-500);
    writeChat(trimmed);

    res.status(201).json({ success: true, message: newMsg });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.delete('/api/chat/:id', (req, res) => {
  try {
    const { id } = req.params;
    let messages = readChat();
    messages = messages.filter((m: any) => m.id !== id);
    writeChat(messages);
    res.json({ success: true, message: 'Message deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

app.delete('/api/chat', (req, res) => {
  try {
    writeChat([]);
    res.json({ success: true, message: 'Chat history cleared' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to clear chat' });
  }
});

// Work Order & Khata Photo Notice Endpoints (Uploaded by Admin, viewable by all field workers)
// Integrated with Google Apps Script + Google Drive + Google Sheets
app.get('/api/work-orders', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const { category } = req.query;

    // First attempt to fetch live from Google Sheets via Google Apps Script
    try {
      const result = await callGoogleAppsScript('workorders', req.query, 'GET', 15000);
      if (result && result.success && Array.isArray(result.workOrders)) {
        let orders = result.workOrders.map((o: any) => {
          let photo = o.photoUrl || o.directImageUrl || '';
          if (!photo && o.description && (String(o.description).startsWith('http') || String(o.description).startsWith('data:'))) {
            photo = String(o.description);
          }
          if (!photo && o.fileId) {
            photo = `https://drive.google.com/thumbnail?id=${o.fileId}&sz=w2000`;
          }
          return {
            ...o,
            photoUrl: photo,
            directImageUrl: o.directImageUrl || photo
          };
        });

        if (category && category !== 'ALL') {
          orders = orders.filter((o: any) => o.category === category || o.category === 'ALL');
        }
        writeWorkOrders(orders);
        return res.json(orders);
      }
    } catch (gasErr) {
      console.warn('[server.ts] GAS workorders fetch fallback:', gasErr);
    }

    let orders = readWorkOrders();
    if (category && category !== 'ALL') {
      orders = orders.filter((o: any) => o.category === category || o.category === 'ALL');
    }
    orders.sort((a: any, b: any) => new Date(b.createdAt || b.uploadDate || 0).getTime() - new Date(a.createdAt || a.uploadDate || 0).getTime());
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load work orders' });
  }
});

app.post('/api/work-orders', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const { category, title, photoUrl, fileData, fileName, fileType, description, uploadedBy, adminName, adminPhone, isHidden } = req.body;
    const rawPhoto = photoUrl || fileData;
    if (!rawPhoto) {
      return res.status(400).json({ error: 'Work order / Khata photo is required' });
    }

    const payload = {
      category: category || 'NSC',
      title: title || 'WBSEDCL Work Order / Khata Notice',
      photoUrl: rawPhoto,
      fileData: rawPhoto,
      fileName: fileName || `${title || 'WorkOrder'}_${Date.now()}.jpg`,
      fileType: fileType || 'image/jpeg',
      description: description || '',
      uploadedBy: uploadedBy || 'admin',
      adminName: adminName || 'Admin Controller',
      adminPhone: adminPhone || '8695716192',
      isHidden: Boolean(isHidden)
    };

    // Forward to Google Apps Script which saves file to Google Drive and row to Google Sheets
    try {
      const result = await callGoogleAppsScript('createWorkOrder', { data: payload }, 'POST', 60000);
      if (result && result.success && result.workOrder) {
        const savedOrder = result.workOrder;
        if (!savedOrder.photoUrl && savedOrder.directImageUrl) {
          savedOrder.photoUrl = savedOrder.directImageUrl;
        }
        if (!savedOrder.photoUrl && savedOrder.fileId) {
          savedOrder.photoUrl = `https://drive.google.com/thumbnail?id=${savedOrder.fileId}&sz=w2000`;
        }
        const currentOrders = readWorkOrders();
        writeWorkOrders([savedOrder, ...currentOrders.filter((o: any) => o.id !== savedOrder.id)]);
        return res.status(201).json({ success: true, workOrder: savedOrder });
      }
    } catch (gasErr) {
      console.warn('[server.ts] GAS createWorkOrder fallback:', gasErr);
    }

    // Local fallback
    const orders = readWorkOrders();
    const now = new Date();
    const uploadDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const uploadTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const newOrder = {
      id: `wo_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      category: category || 'NSC',
      title: title || 'WBSEDCL Work Order / Khata Notice',
      photoUrl: rawPhoto,
      description: description || '',
      uploadedBy: uploadedBy || 'admin',
      adminName: adminName || 'Admin Controller',
      adminPhone: adminPhone || '8695716192',
      uploadDate,
      uploadTime,
      createdAt: now.toISOString(),
      isHidden: Boolean(isHidden)
    };

    orders.unshift(newOrder);
    writeWorkOrders(orders);

    res.status(201).json({ success: true, workOrder: newOrder });
  } catch (error: any) {
    console.error('Error saving work order:', error);
    res.status(500).json({ error: 'Failed to save work order photo' });
  }
});

// Google Drive Image Proxy Route
// Guarantees reliable image loading in iframes or environments with strict cross-origin cookie rules
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
    } catch (e) {
      // Continue to next URL
    }
  }

  return res.status(404).send('Image could not be retrieved from Google Drive');
});

// Helper for visibility toggle
const handleVisibilityToggle = async (req: express.Request, res: express.Response) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const { id } = req.params;
    const { isHidden } = req.body;

    try {
      await callGoogleAppsScript('toggleWorkOrder', { id, isHidden: Boolean(isHidden) }, 'POST');
    } catch (e) {
      console.warn('Failed to sync toggle to GAS:', e);
    }

    let orders = readWorkOrders();
    const index = orders.findIndex((o: any) => String(o.id) === String(id));
    if (index === -1) {
      return res.json({ success: true, message: 'Work order updated' });
    }

    orders[index].isHidden = Boolean(isHidden);
    orders[index].updatedAt = new Date().toISOString();
    writeWorkOrders(orders);

    res.json({ success: true, workOrder: orders[index] });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update visibility' });
  }
};

app.patch('/api/work-orders/:id/visibility', handleVisibilityToggle);
app.post('/api/work-orders/:id/visibility', handleVisibilityToggle);
app.put('/api/work-orders/:id/visibility', handleVisibilityToggle);

// Helper for deletion
const handleDeleteWorkOrder = async (req: express.Request, res: express.Response) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const { id } = req.params;

    try {
      await callGoogleAppsScript('deleteWorkOrder', { id }, 'POST');
    } catch (e) {
      console.warn('Failed to delete work order from GAS:', e);
    }

    let orders = readWorkOrders();
    orders = orders.filter((o: any) => String(o.id) !== String(id));
    writeWorkOrders(orders);
    res.json({ success: true, message: 'Work order photo deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete work order photo' });
  }
};

app.delete('/api/work-orders/:id', handleDeleteWorkOrder);
app.post('/api/work-orders/:id/delete', handleDeleteWorkOrder);

// Stats endpoint for admin dashboard
app.get('/api/stats', (req, res) => {
  const entries = readEntries();
  const total = entries.length;
  const nscCount = entries.filter((e: any) => e.category === 'NSC').length;
  const disconnectionCount = entries.filter((e: any) => e.category === 'DISCONNECTION').length;
  const poleCaseCount = entries.filter((e: any) => e.category === 'POLE CASE').length;
  const meterReplacementCount = entries.filter((e: any) => e.category === 'METER REPLESMENT').length;
  const dtrReplacementCount = entries.filter((e: any) => e.category === 'DTR REPLESMENT').length;

  const pendingCount = entries.filter((e: any) => e.status === 'Pending').length;
  const completedCount = entries.filter((e: any) => e.status === 'Completed').length;
  const approvedCount = entries.filter((e: any) => e.status === 'Approved').length;

  res.json({
    total,
    categories: {
      NSC: nscCount,
      DISCONNECTION: disconnectionCount,
      POLE_CASE: poleCaseCount,
      METER_REPLESMENT: meterReplacementCount,
      DTR_REPLESMENT: dtrReplacementCount
    },
    status: {
      pending: pendingCount,
      completed: completedCount,
      approved: approvedCount
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ POWER server running on http://localhost:${PORT}`);
  });
}

startServer();
