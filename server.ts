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

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
