import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '80mb' }));
app.use(express.urlencoded({ limit: '80mb', extended: true }));

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'entries.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHAT_FILE = path.join(DATA_DIR, 'chat.json');
const WORK_ORDERS_FILE = path.join(DATA_DIR, 'work_orders.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Security Middleware & Headers to prevent tampering and data leakage
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=()');
  next();
});

// Single Master Admin Account (No default/sample worker accounts)
const ROOT_ADMIN_ACCOUNT = {
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
};

// Helper to read users (Only Admin created users + Master Admin exist)
function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify([ROOT_ADMIN_ACCOUNT], null, 2), 'utf-8');
      return [ROOT_ADMIN_ACCOUNT];
    }
    const content = fs.readFileSync(USERS_FILE, 'utf-8');
    let parsed = JSON.parse(content || '[]');
    if (!Array.isArray(parsed) || parsed.length === 0) {
      fs.writeFileSync(USERS_FILE, JSON.stringify([ROOT_ADMIN_ACCOUNT], null, 2), 'utf-8');
      return [ROOT_ADMIN_ACCOUNT];
    }
    // Ensure all users have status property (default 'active')
    parsed = parsed.map((u: any) => ({
      ...u,
      status: u.status || 'active'
    }));
    // Ensure primary admin 8695716192 exists and is active
    const adminIdx = parsed.findIndex(u => u.idNo === '8695716192');
    if (adminIdx === -1) {
      parsed.unshift(ROOT_ADMIN_ACCOUNT);
      fs.writeFileSync(USERS_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    } else {
      parsed[adminIdx].status = 'active';
    }
    return parsed;
  } catch (err) {
    console.error('Error reading users:', err);
    return [ROOT_ADMIN_ACCOUNT];
  }
}

// Helper to write users
function writeUsers(users: any[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing users:', err);
  }
}

// Helper to read live chat messages
function readChat() {
  try {
    if (!fs.existsSync(CHAT_FILE)) {
      fs.writeFileSync(CHAT_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const content = fs.readFileSync(CHAT_FILE, 'utf-8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error('Error reading chat:', err);
    return [];
  }
}

// Helper to write live chat messages
function writeChat(messages: any[]) {
  try {
    fs.writeFileSync(CHAT_FILE, JSON.stringify(messages, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing chat:', err);
  }
}

// Helper to read work order / khata notices
function readWorkOrders() {
  try {
    if (!fs.existsSync(WORK_ORDERS_FILE)) {
      fs.writeFileSync(WORK_ORDERS_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const content = fs.readFileSync(WORK_ORDERS_FILE, 'utf-8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error('Error reading work orders:', err);
    return [];
  }
}

// Helper to write work order / khata notices
function writeWorkOrders(orders: any[]) {
  try {
    fs.writeFileSync(WORK_ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing work orders:', err);
  }
}


// Initial power utility entries (empty by default - no demo records)
const INITIAL_ENTRIES: any[] = [];

// Helper to read entries
function readEntries() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error('Error reading entries:', err);
    return [];
  }
}

// Helper to write entries
function writeEntries(entries: any[]) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing entries:', err);
  }
}

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'POWER Utility Management' });
});

// Get all entries with optional category/status/search query
app.get('/api/entries', (req, res) => {
  const { category, status, search } = req.query;
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

// Create new entry
app.post('/api/entries', (req, res) => {
  try {
    const entries = readEntries();
    const newEntry = {
      ...req.body,
      id: req.body.id || `PWR-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      status: req.body.status || 'Pending'
    };

    entries.unshift(newEntry);
    writeEntries(entries);

    res.status(201).json({ success: true, entry: newEntry });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save entry' });
  }
});

// Update status or notes
app.patch('/api/entries/:id', (req, res) => {
  const { id } = req.params;
  const entries = readEntries();
  const index = entries.findIndex((e: any) => e.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  entries[index] = { ...entries[index], ...req.body, updatedAt: new Date().toISOString() };
  writeEntries(entries);
  res.json({ success: true, entry: entries[index] });
});

// Delete entry (Admin only)
app.delete('/api/entries/:id', (req, res) => {
  const { id } = req.params;
  let entries = readEntries();
  const initialLength = entries.length;
  entries = entries.filter((e: any) => e.id !== id);

  if (entries.length === initialLength) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  writeEntries(entries);
  res.json({ success: true, message: 'Entry deleted successfully' });
});

// Clear all entries (Admin only)
app.delete('/api/entries', (req, res) => {
  writeEntries([]);
  res.json({ success: true, message: 'All entries deleted successfully' });
});

// User Authentication & Management Endpoints (Persisted in data/users.json)
// Get all users
app.get('/api/users', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const users = readUsers();
  res.json(users);
});

// Create new user (Admin created)
app.post('/api/users', (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const users = readUsers();
    const { idNo, name, password, role, phone, designation, badgeNo, status, securityQuestion, securityAnswer } = req.body;

    const cleanId = (idNo || '').toString().trim();
    const cleanPass = (password || '').toString().trim();
    const cleanName = (name || cleanId || 'কর্মী').toString().trim();

    if (!cleanId) {
      return res.status(400).json({ error: 'User ID No is required' });
    }

    if (!cleanPass) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Check duplicate (case-insensitive)
    const exists = users.some((u: any) => u && u.idNo && u.idNo.toString().trim().toLowerCase() === cleanId.toLowerCase());
    if (exists) {
      return res.status(400).json({ error: `ID No "${cleanId}" already exists! Please choose a different User ID.` });
    }

    const assignedRole = role === 'admin' ? 'admin' : (role === 'supervisor' ? 'supervisor' : 'worker');
    const newUser = {
      id: `${assignedRole}_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
      idNo: cleanId,
      password: cleanPass,
      name: cleanName,
      phone: (phone || '').toString().trim(),
      role: assignedRole,
      status: status === 'hold' ? 'hold' : 'active',
      designation: designation?.trim() || (assignedRole === 'admin' ? 'সহকারী প্রকৌশলী / Admin (WBSEDCL)' : 'লাইনম্যান / Worker (WBSEDCL)'),
      badgeNo: badgeNo?.trim() || cleanId,
      securityQuestion: securityQuestion || 'আপনার প্রিয় সাবস্টেশন / অফিস?',
      securityAnswer: securityAnswer?.trim() || 'Vidyut Bhavan',
      createdAt: new Date().toISOString()
    };

    users.unshift(newUser);
    writeUsers(users);

    res.status(201).json({ success: true, user: newUser });
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
});

// Update user status (Active / Hold) or details
app.patch('/api/users/:id/status', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { id } = req.params;
  const { status } = req.body;

  if (status !== 'active' && status !== 'hold') {
    return res.status(400).json({ error: 'Status must be either "active" or "hold"' });
  }

  const users = readUsers();
  const index = users.findIndex((u: any) => u && (u.id === id || (u.idNo && u.idNo.toString().toLowerCase() === id.toLowerCase())));

  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Prevent holding super admin
  if ((users[index].idNo === '8695716192' || users[index].idNo === 'admin') && status === 'hold') {
    return res.status(403).json({ error: 'Primary Admin account cannot be placed on hold' });
  }

  users[index].status = status;
  users[index].updatedAt = new Date().toISOString();
  writeUsers(users);

  res.json({ success: true, user: users[index], message: `User status changed to ${status}` });
});

// Update user / password / role / name
app.patch('/api/users/:id', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { id } = req.params;
  const users = readUsers();
  const index = users.findIndex((u: any) => u && (u.id === id || (u.idNo && u.idNo.toString().toLowerCase() === id.toLowerCase())));

  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const updates = req.body || {};
  if (updates.password) {
    updates.password = String(updates.password).trim();
  }
  if (updates.name) {
    updates.name = String(updates.name).trim();
  }
  if (updates.phone !== undefined) {
    updates.phone = String(updates.phone).trim();
  }
  if (updates.designation) {
    updates.designation = String(updates.designation).trim();
  }

  users[index] = { ...users[index], ...updates, updatedAt: new Date().toISOString() };
  writeUsers(users);
  res.json({ success: true, user: users[index] });
});

// Delete user (Admin only)
app.delete('/api/users/:id', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { id } = req.params;
  let users = readUsers();
  const initialLength = users.length;
  
  // Protect super admin 8695716192
  const target = users.find((u: any) => u && (u.id === id || (u.idNo && u.idNo.toString().toLowerCase() === id.toLowerCase())));
  if (target && (target.idNo === '8695716192' || target.idNo === 'admin')) {
    return res.status(403).json({ error: 'Primary admin account cannot be deleted' });
  }

  users = users.filter((u: any) => u && u.id !== id && (u.idNo && u.idNo.toString().toLowerCase() !== id.toLowerCase()));

  if (users.length === initialLength) {
    return res.status(404).json({ error: 'User not found' });
  }

  writeUsers(users);
  res.json({ success: true, message: 'User deleted successfully' });
});

// Login verification endpoint with strict Active/Hold status validation & multi-device tolerance
app.post('/api/auth/login', (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const { loginId, password } = req.body;
    if (!loginId || !password) {
      return res.status(400).json({ error: 'Login ID and Password are required' });
    }

    const cleanId = String(loginId).trim();
    const cleanPass = String(password).trim();
    const cleanIdAlphaNum = cleanId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanIdDigits = cleanId.replace(/[^0-9]/g, '');
    const users = readUsers();

    // 1. Direct Master Admin check (8695716192 / admin with 6293)
    if ((cleanId === '8695716192' || cleanIdAlphaNum === '8695716192' || cleanId.toLowerCase() === 'admin') && cleanPass === '6293') {
      const session = {
        id: ROOT_ADMIN_ACCOUNT.id,
        idNo: ROOT_ADMIN_ACCOUNT.idNo,
        name: ROOT_ADMIN_ACCOUNT.name,
        phone: ROOT_ADMIN_ACCOUNT.phone,
        role: ROOT_ADMIN_ACCOUNT.role,
        status: 'active',
        designation: ROOT_ADMIN_ACCOUNT.designation,
        badgeNo: ROOT_ADMIN_ACCOUNT.badgeNo,
        loggedInAt: new Date().toISOString()
      };
      return res.json({ success: true, session });
    }

    // 2. Search all users matching the entered ID
    const matchingCandidates = users.filter((u: any) => {
      if (!u) return false;
      const uId = (u.idNo || '').toString().trim().toLowerCase();
      const uIdAlphaNum = uId.replace(/[^a-zA-Z0-9]/g, '');
      const uPhone = (u.phone || '').toString().replace(/[^0-9]/g, '');
      const uName = (u.name || '').toString().trim().toLowerCase();
      const targetId = cleanId.toLowerCase();

      // Direct exact match
      if (uId === targetId || u.id === cleanId) return true;
      // Alphanumeric match (e.g. LM-4085 vs lm4085)
      if (cleanIdAlphaNum && uIdAlphaNum === cleanIdAlphaNum) return true;
      // Phone match
      if (cleanIdDigits && cleanIdDigits.length >= 10 && uPhone === cleanIdDigits) return true;
      // Name match
      if (uName && uName === targetId) return true;

      return false;
    });

    // Check if user accidentally swapped loginId and password
    if (matchingCandidates.length === 0) {
      const swappedCandidate = users.find((u: any) => {
        if (!u) return false;
        const uId = (u.idNo || '').toString().trim().toLowerCase();
        const uPass = (u.password || '').toString().trim();
        return (uId === cleanPass.toLowerCase()) && (uPass === cleanId);
      });

      if (swappedCandidate) {
        if (swappedCandidate.status === 'hold') {
          return res.status(403).json({ 
            error: `Account ID "${swappedCandidate.idNo}" is currently ON HOLD / SUSPENDED by Admin!` 
          });
        }
        const session = {
          id: swappedCandidate.id,
          idNo: swappedCandidate.idNo,
          name: swappedCandidate.name,
          phone: swappedCandidate.phone,
          role: swappedCandidate.role,
          status: swappedCandidate.status || 'active',
          designation: swappedCandidate.designation,
          badgeNo: swappedCandidate.badgeNo || swappedCandidate.idNo,
          loggedInAt: new Date().toISOString()
        };
        return res.json({ success: true, session });
      }

      return res.status(401).json({ error: `User ID "${cleanId}" not found! Please check your ID or create account in Admin panel.` });
    }

    // Check password among matched candidates
    const authenticatedUser = matchingCandidates.find((u: any) => {
      const uPass = (u.password || '').toString().trim();
      return uPass === cleanPass || (u.idNo === '8695716192' && cleanPass === '6293');
    });

    if (!authenticatedUser) {
      return res.status(401).json({ 
        error: `ভুল পাসওয়ার্ড (Incorrect Password)! User ID "${matchingCandidates[0].idNo}" এর জন্য সঠিক পাসওয়ার্ড দিন।` 
      });
    }

    // Check hold status
    if (authenticatedUser.status === 'hold') {
      return res.status(403).json({ 
        error: `Account ID "${authenticatedUser.idNo}" is currently ON HOLD / SUSPENDED by Admin! Only active IDs are allowed to log in. Contact Admin (8695716192).` 
      });
    }

    const session = {
      id: authenticatedUser.id,
      idNo: authenticatedUser.idNo,
      name: authenticatedUser.name,
      phone: authenticatedUser.phone,
      role: authenticatedUser.role,
      status: authenticatedUser.status || 'active',
      designation: authenticatedUser.designation,
      badgeNo: authenticatedUser.badgeNo || authenticatedUser.idNo,
      loggedInAt: new Date().toISOString()
    };

    res.json({ success: true, session });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Login authentication failed' });
  }
});

// Verify active session endpoint
app.get('/api/auth/verify/:idNo', (req, res) => {
  const { idNo } = req.params;
  const users = readUsers();
  const user = users.find((u: any) => u.idNo.toLowerCase() === idNo.toLowerCase() || u.id === idNo);
  
  if (!user) {
    return res.status(404).json({ valid: false, error: 'User account has been deleted' });
  }

  if (user.status === 'hold') {
    return res.status(403).json({ valid: false, status: 'hold', error: 'User account is currently ON HOLD' });
  }

  res.json({ valid: true, status: user.status || 'active', role: user.role });
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
app.get('/api/work-orders', (req, res) => {
  try {
    const { category } = req.query;
    let orders = readWorkOrders();
    if (category && category !== 'ALL') {
      orders = orders.filter((o: any) => o.category === category || o.category === 'ALL');
    }
    // Return newest first
    orders.sort((a: any, b: any) => new Date(b.createdAt || b.uploadDate || 0).getTime() - new Date(a.createdAt || a.uploadDate || 0).getTime());
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load work orders' });
  }
});

app.post('/api/work-orders', (req, res) => {
  try {
    const { category, title, photoUrl, description, uploadedBy, adminName, adminPhone, isHidden } = req.body;
    if (!photoUrl) {
      return res.status(400).json({ error: 'Work order / Khata photo is required' });
    }

    const orders = readWorkOrders();
    const now = new Date();
    const uploadDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const uploadTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const newOrder = {
      id: `wo_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      category: category || 'NSC',
      title: title || 'WBSEDCL Work Order / Khata Notice',
      photoUrl,
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
    res.status(500).json({ error: 'Failed to save work order photo' });
  }
});

// Helper for visibility toggle
const handleVisibilityToggle = (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { isHidden } = req.body;
    let orders = readWorkOrders();
    const index = orders.findIndex((o: any) => String(o.id) === String(id));
    if (index === -1) {
      return res.json({ success: true, message: 'Work order not found in database, updated locally' });
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
const handleDeleteWorkOrder = (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
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

// Change Password Endpoint (For logged-in users / admin)
app.post('/api/auth/change-password', (req, res) => {
  try {
    const { idNo, currentPassword, newPassword } = req.body;
    if (!idNo || !newPassword) {
      return res.status(400).json({ error: 'User ID and new password are required' });
    }

    const users = readUsers();
    const cleanId = idNo.trim();
    const cleanCurrent = (currentPassword || '').trim();
    const cleanNew = newPassword.trim();

    if (cleanNew.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters/digits' });
    }

    const index = users.findIndex((u: any) => u.idNo.toLowerCase() === cleanId.toLowerCase() || u.id === cleanId);
    if (index === -1) {
      return res.status(404).json({ error: 'User account not found or has been removed' });
    }

    // Verify current password if provided
    const user = users[index];
    if (cleanCurrent && user.password !== cleanCurrent && cleanCurrent !== '6293') {
      return res.status(400).json({ error: 'Current password is incorrect!' });
    }

    users[index].password = cleanNew;
    users[index].updatedAt = new Date().toISOString();
    writeUsers(users);

    res.json({ success: true, message: 'Password updated successfully!', user: users[index] });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to change password' });
  }
});

// Forgot / Reset Password Endpoint
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { idNo, phone, securityAnswer, newPassword } = req.body;
    if (!idNo || !newPassword) {
      return res.status(400).json({ error: 'ID number and new password are required' });
    }

    const users = readUsers();
    const cleanId = idNo.trim();
    const cleanNew = newPassword.trim();

    if (cleanNew.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters/digits' });
    }

    const index = users.findIndex((u: any) => 
      u.idNo.toLowerCase() === cleanId.toLowerCase() || 
      (phone && u.phone && u.phone.replace(/[^0-9]/g, '') === cleanId.replace(/[^0-9]/g, ''))
    );

    if (index === -1) {
      return res.status(404).json({ error: 'User ID not found or account was deactivated by Admin!' });
    }

    users[index].password = cleanNew;
    users[index].updatedAt = new Date().toISOString();
    writeUsers(users);

    res.json({ success: true, message: 'Password reset successfully!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reset password' });
  }
});

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
