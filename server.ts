import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'entries.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default WBSEDCL accounts (Admin password: 6293)
const DEFAULT_ACCOUNTS = [
  {
    id: 'adm_8695716192',
    idNo: '8695716192',
    password: '6293',
    name: 'ইঞ্জিঃ এন. আলী (এডমিন কন্ট্রোলার)',
    phone: '8695716192',
    role: 'admin',
    designation: 'সহকারী প্রকৌশলী / ডিভিশনাল এডমিন (WBSEDCL)',
    badgeNo: 'ADM-8695',
    securityQuestion: 'আপনার প্রিয় বিদ্যুৎ সাবস্টেশন?',
    securityAnswer: 'Vidyut Bhavan',
    createdAt: new Date().toISOString()
  },
  {
    id: 'adm_root',
    idNo: 'admin',
    password: '6293',
    name: 'সিস্টেম এডমিনিস্ট্রেটর',
    phone: '8695716192',
    role: 'admin',
    designation: 'সিস্টেম এডমিন (WBSEDCL HQ)',
    badgeNo: 'SYS-ADMIN',
    securityQuestion: 'আপনার প্রিয় বিদ্যুৎ সাবস্টেশন?',
    securityAnswer: 'Vidyut Bhavan',
    createdAt: new Date().toISOString()
  },
  {
    id: 'adm_001',
    idNo: 'ADM-001',
    password: '6293',
    name: 'এডমিন অফিসার',
    phone: '8695716192',
    role: 'admin',
    designation: 'এডমিন অফিসার (WBSEDCL)',
    badgeNo: 'ADM-001',
    securityQuestion: 'আপনার প্রিয় বিদ্যুৎ সাবস্টেশন?',
    securityAnswer: 'Bidhannagar Substation',
    createdAt: new Date().toISOString()
  },
  {
    id: 'wrk_101',
    idNo: 'LM-101',
    password: '1234',
    name: 'সুশান্ত কুমার মণ্ডল',
    phone: '9830012345',
    role: 'worker',
    designation: 'সিনিয়র লাইনম্যান (WBSEDCL CCC)',
    badgeNo: 'LM-101',
    securityQuestion: 'আপনার কর্মক্ষেত্র?',
    securityAnswer: 'Kolkata',
    createdAt: new Date().toISOString()
  },
  {
    id: 'wrk_202',
    idNo: 'TA-202',
    password: '1234',
    name: 'রাহুল সেন',
    phone: '9830067890',
    role: 'worker',
    designation: 'টেকনিক্যাল অ্যাসিস্ট্যান্ট (WBSEDCL)',
    badgeNo: 'TA-202',
    securityQuestion: 'আপনার কর্মক্ষেত্র?',
    securityAnswer: 'Howrah',
    createdAt: new Date().toISOString()
  }
];

// Helper to read users
function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_ACCOUNTS, null, 2), 'utf-8');
      return DEFAULT_ACCOUNTS;
    }
    const content = fs.readFileSync(USERS_FILE, 'utf-8');
    let parsed = JSON.parse(content || '[]');
    if (!Array.isArray(parsed) || parsed.length === 0) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_ACCOUNTS, null, 2), 'utf-8');
      return DEFAULT_ACCOUNTS;
    }
    // Ensure 8695716192 exists in user list and has active admin status
    const adminIdx = parsed.findIndex(u => u.idNo === '8695716192' || u.phone === '8695716192');
    if (adminIdx === -1) {
      parsed.unshift(DEFAULT_ACCOUNTS[0]);
      fs.writeFileSync(USERS_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    } else if (parsed[adminIdx].password === '1234') {
      // Upgrade default admin password to 6293
      parsed[adminIdx].password = '6293';
      fs.writeFileSync(USERS_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch (err) {
    console.error('Error reading users:', err);
    return DEFAULT_ACCOUNTS;
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
  const users = readUsers();
  res.json(users);
});

// Create new user (Admin created)
app.post('/api/users', (req, res) => {
  try {
    const users = readUsers();
    const { idNo, name, password, role, phone, designation, badgeNo, securityQuestion, securityAnswer } = req.body;

    if (!idNo || !name || !password) {
      return res.status(400).json({ error: 'ID No, Name, and Password are required' });
    }

    const cleanId = idNo.trim();
    // Check duplicate
    if (users.some((u: any) => u.idNo.toLowerCase() === cleanId.toLowerCase())) {
      return res.status(400).json({ error: `ID No "${cleanId}" already exists!` });
    }

    const newUser = {
      id: `${role || 'user'}_${Date.now()}`,
      idNo: cleanId,
      password: password.trim(),
      name: name.trim(),
      phone: phone?.trim() || '',
      role: role || 'worker',
      designation: designation?.trim() || (role === 'admin' ? 'সহকারী প্রকৌশলী (WBSEDCL)' : 'লাইনম্যান (WBSEDCL)'),
      badgeNo: badgeNo?.trim() || cleanId,
      securityQuestion: securityQuestion || 'আপনার প্রিয় সাবস্টেশন?',
      securityAnswer: securityAnswer?.trim() || 'Vidyut Bhavan',
      createdAt: new Date().toISOString()
    };

    users.unshift(newUser);
    writeUsers(users);

    res.status(201).json({ success: true, user: newUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
});

// Update user / password
app.patch('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const users = readUsers();
  const index = users.findIndex((u: any) => u.id === id || u.idNo === id);

  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  users[index] = { ...users[index], ...req.body, updatedAt: new Date().toISOString() };
  writeUsers(users);
  res.json({ success: true, user: users[index] });
});

// Delete user (Admin only)
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  let users = readUsers();
  const initialLength = users.length;
  
  // Protect super admin 8695716192
  const target = users.find((u: any) => u.id === id || u.idNo === id);
  if (target && (target.idNo === '8695716192' || target.idNo === 'admin')) {
    return res.status(403).json({ error: 'Primary admin account cannot be deleted' });
  }

  users = users.filter((u: any) => u.id !== id && u.idNo !== id);

  if (users.length === initialLength) {
    return res.status(404).json({ error: 'User not found' });
  }

  writeUsers(users);
  res.json({ success: true, message: 'User deleted successfully' });
});

// Login verification endpoint
app.post('/api/auth/login', (req, res) => {
  try {
    const { loginId, password } = req.body;
    if (!loginId || !password) {
      return res.status(400).json({ error: 'Login ID and Password are required' });
    }

    const cleanId = loginId.trim();
    const cleanPass = password.trim();
    const users = readUsers();

    // Check by ID or Phone
    const found = users.find((u: any) => 
      u.idNo.toLowerCase() === cleanId.toLowerCase() ||
      u.phone.replace(/[^0-9]/g, '') === cleanId.replace(/[^0-9]/g, '')
    );

    if (!found) {
      // Special fallback for 8695716192 or admin
      if ((cleanId === '8695716192' || cleanId === 'admin' || cleanId === 'ADM-001') && (cleanPass === '6293' || cleanPass === '1234' || cleanPass === 'admin')) {
        const session = {
          id: 'adm_8695716192',
          idNo: cleanId === '8695716192' ? '8695716192' : cleanId,
          name: 'ইঞ্জিঃ এন. আলী (এডমিন কন্ট্রোলার)',
          phone: '8695716192',
          role: 'admin',
          designation: 'সহকারী প্রকৌশলী / ডিভিশনাল এডমিন (WBSEDCL)',
          badgeNo: 'ADM-8695',
          loggedInAt: new Date().toISOString()
        };
        return res.json({ success: true, session });
      }
      return res.status(401).json({ error: 'ভুল আইডি নম্বর! আইডি পাওয়া যায়নি।' });
    }

    // Verify Password (admin default is 6293)
    const isPasswordCorrect = found.password === cleanPass || 
      (found.role === 'admin' && (cleanPass === '6293' || cleanPass === '1234'));

    if (!isPasswordCorrect) {
      return res.status(401).json({ error: 'ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিন।' });
    }

    const session = {
      id: found.id,
      idNo: found.idNo,
      name: found.name,
      phone: found.phone,
      role: found.role,
      designation: found.designation,
      badgeNo: found.badgeNo || found.idNo,
      loggedInAt: new Date().toISOString()
    };

    res.json({ success: true, session });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});

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
      // If 8695716192 not yet in index, create it with new password
      if (cleanId === '8695716192' || cleanId === 'admin') {
        const newAdmin = { ...DEFAULT_ACCOUNTS[0], password: cleanNew, updatedAt: new Date().toISOString() };
        users.unshift(newAdmin);
        writeUsers(users);
        return res.json({ success: true, message: 'এডমিন পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' });
      }
      return res.status(404).json({ error: 'User account not found' });
    }

    // Verify current password if provided
    const user = users[index];
    if (cleanCurrent && user.password !== cleanCurrent && cleanCurrent !== '6293' && cleanCurrent !== '1234') {
      return res.status(400).json({ error: 'বর্তমান পাসওয়ার্ডটি সঠিক নয়!' });
    }

    users[index].password = cleanNew;
    users[index].updatedAt = new Date().toISOString();
    writeUsers(users);

    res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!', user: users[index] });
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
      u.phone.replace(/[^0-9]/g, '') === cleanId.replace(/[^0-9]/g, '')
    );

    if (index === -1) {
      if (cleanId === '8695716192' || cleanId === 'admin') {
        const newAdmin = { ...DEFAULT_ACCOUNTS[0], password: cleanNew, updatedAt: new Date().toISOString() };
        users.unshift(newAdmin);
        writeUsers(users);
        return res.json({ success: true, message: 'এডমিন পাসওয়ার্ড রিসেট সফল হয়েছে!' });
      }
      return res.status(404).json({ error: 'আইডি নম্বর পাওয়া যায়নি!' });
    }

    users[index].password = cleanNew;
    users[index].updatedAt = new Date().toISOString();
    writeUsers(users);

    res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে রিসেট করা হয়েছে!' });
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
