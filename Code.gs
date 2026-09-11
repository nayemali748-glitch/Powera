// ============================================================================
// POWER - Field Worker & Utility Management System
// Google Apps Script Web App Backend & Google Sheets Database
// Single Source of Truth for all application data
// ============================================================================

const SPREADSHEET_ID = '1-3LtAbXZU6klisReK6ffIxDUwbM4wXvhxSbKVpE7raY';

// Sheet aliases for 100% backward compatibility & exact user naming
const SHEET_ALIASES = {
  'USERS': ['USERS', 'Users', 'users'],
  'USER_ACTIVITY': ['USER_ACTIVITY', 'UserActivity', 'ActivityLogs'],
  'MASTER_DATA': ['MASTER_DATA', 'Entries', 'master_data', 'entries'],
  'NSC': ['NSC', 'NEW_CONNECTION', 'NewConnection'],
  'NEW_CONNECTION': ['NSC', 'NEW_CONNECTION', 'NewConnection'],
  'DISCONNECTION': ['DISCONNECTION', 'Disconnection'],
  'POLE_CASE': ['POLE_CASE', 'PoleCase', 'POLE CASE'],
  'METER_REPLACEMENT': ['METER_REPLACEMENT', 'METER_REPLESMENT', 'MeterReplacement'],
  'DTR_REPLACEMENT': ['DTR_REPLACEMENT', 'DTR_REPLESMENT', 'DtrReplacement'],
  'SETTINGS': ['SETTINGS', 'Settings'],
  'WORK_ORDERS': ['WORK_ORDERS', 'WorkOrders', 'workorders'],
  'CHAT': ['CHAT', 'Chat', 'chat']
};

const CATEGORY_MAP = {
  'NSC': 'NSC',
  'NEW_CONNECTION': 'NSC',
  'DISCONNECTION': 'DISCONNECTION',
  'POLE CASE': 'POLE_CASE',
  'POLE_CASE': 'POLE_CASE',
  'METER REPLESMENT': 'METER_REPLACEMENT',
  'METER_REPLESMENT': 'METER_REPLACEMENT',
  'METER_REPLACEMENT': 'METER_REPLACEMENT',
  'DTR REPLESMENT': 'DTR_REPLACEMENT',
  'DTR_REPLESMENT': 'DTR_REPLACEMENT',
  'DTR_REPLACEMENT': 'DTR_REPLACEMENT'
};

const COMMON_ENTRY_HEADERS = [
  'submissionId', 'id', 'category', 'status', 'date', 'createdAt', 'workerId', 'workerName', 'role', 'submittedBy', 'workerPhone', 'substation',
  'feederName', 'consumerId', 'consumerName', 'fatherName', 'applicationNo', 'agencyName', 'cccName',
  'mobile', 'address', 'poleNo', 'appliedLoad', 'phase', 'tariffCategory', 'meterNo', 'initialReading',
  'sealNo', 'serviceCableLength', 'meterInstallDate', 'inspectionAgencyName', 'meterMake', 'workOrderNo',
  'workOrderDate', 'arrearAmount', 'reason', 'finalReading', 'disconnectionType', 'cutoutSealed',
  'issueType', 'priority', 'actionTaken', 'materialUsed', 'poleType', 'lineVoltage', 'conductorType',
  'ptwShutdownRef', 'oldMeterNo', 'replacementReason', 'newMeterNo', 'newMeterSealNo', 'oldMeterSealNo',
  'meterType', 'dtrName', 'existingCapacity', 'newCapacity', 'oldDtrSerial', 'newDtrSerial', 'failureReason',
  'oilLevelChecked', 'earthResistance', 'dtrMakeBrand', 'hgFuseRating', 'ltMccbAmpere', 'lightningArrester',
  'locationGps', 'photoUrl', 'photoBeforeUrl', 'photoAfterUrl', 'workOrderPhoto', 'workOrderNoticeId',
  'workOrderNoticeTitle', 'workOrderNoticeDate', 'notes', 'updatedAt'
];

const USER_HEADERS = [
  'id', 'idNo', 'password', 'name', 'phone', 'role', 'status', 'designation', 'badgeNo',
  'securityQuestion', 'securityAnswerHash', 'createdAt', 'updatedAt'
];

const ACTIVITY_HEADERS = [
  'id', 'userId', 'idNo', 'userName', 'role', 'action', 'details', 'ipAddress', 'timestamp', 'createdAt'
];

const SETTINGS_HEADERS = [
  'key', 'value', 'description', 'updatedAt'
];

const WORK_ORDER_HEADERS = [
  'id', 'category', 'title', 'photoUrl', 'fileId', 'fileName', 'fileType', 'fileSize',
  'driveViewUrl', 'driveDownloadUrl', 'directImageUrl', 'description', 'uploadedBy',
  'adminName', 'adminPhone', 'uploadDate', 'uploadTime', 'createdAt', 'isHidden'
];

const CHAT_HEADERS = [
  'id', 'workerId', 'senderId', 'senderName', 'senderRole', 'recipientId', 'recipientRole',
  'message', 'timestamp', 'status', 'createdAt'
];

var _ssInstance = null;
function ss() {
  if (!_ssInstance) {
    _ssInstance = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return _ssInstance;
}

var _sheetMemoryMap = {};
function getExistingOrNewSheet(canonicalName, headers) {
  if (_sheetMemoryMap[canonicalName]) {
    return _sheetMemoryMap[canonicalName];
  }
  const spreadsheet = ss();
  const aliases = SHEET_ALIASES[canonicalName] || [canonicalName];
  
  for (let i = 0; i < aliases.length; i++) {
    const existing = spreadsheet.getSheetByName(aliases[i]);
    if (existing) {
      _sheetMemoryMap[canonicalName] = existing;
      return existing;
    }
  }

  const newSheet = spreadsheet.insertSheet(canonicalName);
  newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  newSheet.setFrozenRows(1);
  _sheetMemoryMap[canonicalName] = newSheet;
  return newSheet;
}

function ensureHeaders(s, headers) {
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.setFrozenRows(1);
    return;
  }
  const currentHeaders = s.getRange(1, 1, 1, Math.max(1, s.getLastColumn())).getValues()[0];
  const missingHeaders = headers.filter(h => currentHeaders.indexOf(h) === -1);
  if (missingHeaders.length > 0) {
    const startCol = currentHeaders.length + 1;
    s.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
  }
  s.setFrozenRows(1);
}

function headersFor(name) {
  if (name === 'USERS' || name === 'Users') return USER_HEADERS;
  if (name === 'USER_ACTIVITY') return ACTIVITY_HEADERS;
  if (name === 'SETTINGS') return SETTINGS_HEADERS;
  if (name === 'WORK_ORDERS' || name === 'WorkOrders') return WORK_ORDER_HEADERS;
  if (name === 'CHAT' || name === 'Chat') return CHAT_HEADERS;
  return COMMON_ENTRY_HEADERS;
}

function getSheet(name) {
  return getExistingOrNewSheet(name, headersFor(name));
}

function setupDatabase() {
  const sheetsCreated = [];
  const canonicalNames = [
    'USERS', 'USER_ACTIVITY', 'MASTER_DATA', 'NSC', 'DISCONNECTION',
    'POLE_CASE', 'METER_REPLACEMENT', 'DTR_REPLACEMENT', 'SETTINGS', 'WORK_ORDERS', 'CHAT'
  ];

  canonicalNames.forEach(name => {
    const s = getSheet(name);
    ensureHeaders(s, headersFor(name));
    sheetsCreated.push(s.getName());
  });

  // Seed default admin if Users sheet is empty
  const users = getRows('USERS');
  if (users.length === 0) {
    appendRow('USERS', {
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
      securityAnswerHash: sha('Vidyut Bhavan'),
      createdAt: now(),
      updatedAt: now()
    });
  }

  // Seed default settings if empty
  const settings = getRows('SETTINGS');
  if (settings.length === 0) {
    appendRow('SETTINGS', { key: 'app_name', value: 'POWER Management', description: 'WBSEDCL Field Utility App', updatedAt: now() });
    appendRow('SETTINGS', { key: 'admin_phone', value: '8695716192', description: 'Primary Admin Phone', updatedAt: now() });
    appendRow('SETTINGS', { key: 'primary_admin_id', value: '8695716192', description: 'Primary Admin Account', updatedAt: now() });
  }

  return {
    success: true,
    spreadsheetId: SPREADSHEET_ID,
    spreadsheetUrl: ss().getUrl(),
    sheets: sheetsCreated
  };
}

function getRows(sheetName) {
  const s = getSheet(sheetName);
  const totalRows = s.getLastRow();
  const totalCols = s.getLastColumn();
  if (totalRows < 2 || totalCols < 1) return [];

  const headers = s.getRange(1, 1, 1, totalCols).getValues()[0];
  const data = s.getRange(2, 1, totalRows - 1, totalCols).getValues();

  return data.map(r => {
    const item = {};
    headers.forEach((h, i) => {
      const col = String(h || '').trim();
      if (col) item[col] = r[i];
    });

    if (sheetName === 'WORK_ORDERS' || sheetName === 'WorkOrders') {
      let photo = item.photoUrl || item.directImageUrl || '';
      if (!photo && item.description && (String(item.description).indexOf('http') === 0 || String(item.description).indexOf('data:') === 0)) {
        photo = String(item.description);
      }
      if (!photo && item.fileId) {
        photo = 'https://drive.google.com/thumbnail?id=' + item.fileId + '&sz=w2000';
      }
      item.photoUrl = photo;
      if (!item.directImageUrl) item.directImageUrl = photo;
      if (!item.uploadedBy && item.createdBy) item.uploadedBy = item.createdBy;
      if (!item.uploadDate && item.date) item.uploadDate = item.date;
      if (item.isHidden === undefined && item.visible !== undefined && item.visible !== '') {
        item.isHidden = !item.visible;
      }
      if (item.description && (String(item.description).indexOf('http') === 0 || String(item.description).indexOf('data:') === 0)) {
        item.description = '';
      }
    }

    return item;
  });
}

function appendRow(sheetName, obj) {
  const s = getSheet(sheetName);
  ensureHeaders(s, headersFor(sheetName));
  const currentHeaders = s.getRange(1, 1, 1, Math.max(1, s.getLastColumn())).getValues()[0];

  const rowValues = currentHeaders.map(h => {
    const k = String(h || '').trim();
    if (!k) return '';
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];

    // Aliases for legacy sheets
    if (k === 'photoUrl') return obj.photoUrl || obj.directImageUrl || obj.driveViewUrl || '';
    if (k === 'description') {
      if (currentHeaders.indexOf('photoUrl') === -1) {
        return obj.photoUrl || obj.directImageUrl || obj.description || '';
      }
      return obj.description || '';
    }
    if (k === 'date') return obj.uploadDate || obj.date || '';
    if (k === 'createdBy') return obj.uploadedBy || obj.adminName || obj.createdBy || '';
    if (k === 'visible') return obj.isHidden !== undefined ? !obj.isHidden : true;
    if (k === 'directImageUrl') return obj.directImageUrl || obj.photoUrl || '';
    return '';
  });

  s.appendRow(rowValues);
  return obj;
}

function findRowIndex(sheetName, key, value) {
  const s = getSheet(sheetName);
  const h = headersFor(sheetName);
  const colIndex = h.indexOf(key);
  if (colIndex < 0) return -1;
  const totalRows = s.getLastRow();
  if (totalRows < 2) return -1;

  const vals = s.getRange(2, colIndex + 1, totalRows - 1, 1).getValues();
  const target = String(value).trim().toLowerCase();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === target) {
      return i + 2;
    }
  }
  return -1;
}

function getRowByIndex(sheetName, rowIdx) {
  const s = getSheet(sheetName);
  const totalCols = Math.max(1, s.getLastColumn());
  const headers = s.getRange(1, 1, 1, totalCols).getValues()[0];
  const rowValues = s.getRange(rowIdx, 1, 1, totalCols).getValues()[0];
  const item = {};
  headers.forEach((h, i) => {
    const col = String(h || '').trim();
    if (col) item[col] = rowValues[i];
  });
  return item;
}

function updateRow(sheetName, key, value, updates) {
  const s = getSheet(sheetName);
  const h = headersFor(sheetName);
  const rowIdx = findRowIndex(sheetName, key, value);
  if (rowIdx < 0) throw Error('Record not found in ' + sheetName);

  const existingRow = {};
  h.forEach((k, i) => {
    existingRow[k] = s.getRange(rowIdx, i + 1).getValue();
  });

  const updatedObj = Object.assign({}, existingRow, updates, { updatedAt: now() });
  h.forEach((k, i) => {
    s.getRange(rowIdx, i + 1).setValue(updatedObj[k] === undefined ? '' : updatedObj[k]);
  });

  return updatedObj;
}

function deleteRow(sheetName, key, value) {
  const s = getSheet(sheetName);
  const rowIdx = findRowIndex(sheetName, key, value);
  if (rowIdx < 0) throw Error('Record not found in ' + sheetName);
  s.deleteRow(rowIdx);
  return true;
}

function sha(v) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(v || ''), Utilities.Charset.UTF_8)
    .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function generateId(prefix) {
  return prefix + '-' + Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7);
}

function now() {
  return new Date().toISOString();
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sanitizeUser(u) {
  const clean = Object.assign({}, u);
  delete clean.securityAnswerHash;
  return clean;
}

function logActivity(userId, idNo, userName, role, action, details) {
  try {
    appendRow('USER_ACTIVITY', {
      id: generateId('ACT'),
      userId: userId || '',
      idNo: idNo || '',
      userName: userName || '',
      role: role || '',
      action: action || '',
      details: typeof details === 'object' ? JSON.stringify(details) : String(details || ''),
      timestamp: now(),
      createdAt: now()
    });
  } catch (e) {
    // Non-blocking log
  }
}

// User Operations
function createUser(d) {
  const cleanId = String(d.idNo || '').trim();
  if (!cleanId) throw Error('User ID No is required');
  const users = getRows('USERS');
  if (users.some(u => String(u.idNo).trim().toLowerCase() === cleanId.toLowerCase())) {
    throw Error('User ID "' + cleanId + '" already exists in Google Sheets');
  }

  const assignedRole = d.role === 'admin' ? 'admin' : (d.role === 'supervisor' ? 'supervisor' : 'worker');
  const user = {
    id: d.id || ('usr_' + cleanId),
    idNo: cleanId,
    password: String(d.password || ''),
    name: d.name || cleanId || 'কর্মী',
    phone: d.phone ? String(d.phone).replace(/\D/g, '') : '',
    role: assignedRole,
    status: d.status === 'hold' ? 'hold' : 'active',
    designation: d.designation || (assignedRole === 'admin' ? 'সহকারী প্রকৌশলী / Admin (WBSEDCL)' : 'লাইনম্যান / Worker (WBSEDCL)'),
    badgeNo: d.badgeNo || cleanId,
    securityQuestion: d.securityQuestion || 'আপনার প্রিয় সাবস্টেশন / অফিস?',
    securityAnswerHash: sha(d.securityAnswer || 'Vidyut Bhavan'),
    createdAt: now(),
    updatedAt: now()
  };

  appendRow('USERS', user);
  invalidateUserCache(user.idNo, user.id);
  logActivity(user.id, user.idNo, user.name, user.role, 'CREATE_USER', 'User account created');
  return sanitizeUser(user);
}

function invalidateUserCache(idNo, id) {
  try {
    const cache = CacheService.getScriptCache();
    if (idNo) cache.remove('auth_usr_' + String(idNo).trim().toLowerCase());
    if (id) cache.remove('auth_usr_' + String(id).trim().toLowerCase());
  } catch (e) {}
}

function authenticateUser(idNo, password) {
  const cleanId = String(idNo || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();

  if (!cleanId || !cleanPass) {
    throw Error('User ID and Password are required');
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = 'auth_usr_' + cleanId;
  let cachedJson = null;
  try {
    cachedJson = cache.get(cacheKey);
  } catch (e) {}

  let user = null;
  if (cachedJson) {
    try {
      user = JSON.parse(cachedJson);
    } catch (e) {}
  }

  if (!user) {
    // High-speed direct read from USERS sheet without ensureHeaders overhead
    const s = getSheet('USERS');
    const totalRows = s.getLastRow();
    const totalCols = s.getLastColumn();
    if (totalRows < 2 || totalCols < 1) {
      throw Error('Invalid User ID or Password');
    }

    const allValues = s.getRange(1, 1, totalRows, totalCols).getValues();
    const headers = allValues[0].map(h => String(h || '').trim());
    const idNoIdx = headers.indexOf('idNo');
    const idIdx = headers.indexOf('id');
    const passIdx = headers.indexOf('password');
    const passHashIdx = headers.indexOf('passwordHash');
    const nameIdx = headers.indexOf('name');
    const phoneIdx = headers.indexOf('phone');
    const roleIdx = headers.indexOf('role');
    const statusIdx = headers.indexOf('status');
    const desigIdx = headers.indexOf('designation');
    const badgeIdx = headers.indexOf('badgeNo');

    for (let i = 1; i < totalRows; i++) {
      const row = allValues[i];
      const rowIdNo = idNoIdx >= 0 ? String(row[idNoIdx] || '').trim().toLowerCase() : '';
      const rowId = idIdx >= 0 ? String(row[idIdx] || '').trim().toLowerCase() : '';

      if (rowIdNo === cleanId || rowId === cleanId) {
        user = {
          id: idIdx >= 0 ? String(row[idIdx] || '') : ('usr_' + cleanId),
          idNo: idNoIdx >= 0 ? String(row[idNoIdx] || '') : cleanId,
          password: passIdx >= 0 ? String(row[passIdx] || '') : '',
          passwordHash: passHashIdx >= 0 ? String(row[passHashIdx] || '') : '',
          name: nameIdx >= 0 ? String(row[nameIdx] || '') : cleanId,
          phone: phoneIdx >= 0 ? String(row[phoneIdx] || '') : '',
          role: roleIdx >= 0 ? String(row[roleIdx] || 'worker') : 'worker',
          status: statusIdx >= 0 ? String(row[statusIdx] || 'active') : 'active',
          designation: desigIdx >= 0 ? String(row[desigIdx] || '') : '',
          badgeNo: badgeIdx >= 0 ? String(row[badgeIdx] || '') : ''
        };
        break;
      }
    }

    if (user) {
      try {
        cache.put(cacheKey, JSON.stringify(user), 1800); // 30 mins TTL
      } catch (e) {}
    }
  }

  if (!user) throw Error('Invalid User ID or Password');
  if (user.status === 'hold') throw Error('This user account is currently ON HOLD. Contact Admin.');

  const matchPass = String(user.password).trim() === cleanPass || 
    (user.passwordHash && String(user.passwordHash) === sha(cleanPass));

  if (!matchPass) throw Error('Invalid User ID or Password');

  const session = {
    id: String(user.id),
    idNo: String(user.idNo),
    name: String(user.name),
    phone: String(user.phone || ''),
    role: String(user.role),
    status: String(user.status || 'active'),
    designation: String(user.designation || ''),
    badgeNo: String(user.badgeNo || ''),
    loggedInAt: now()
  };

  // Asynchronous activity logging: do NOT block or delay the login response
  try {
    const sAct = getSheet('USER_ACTIVITY');
    sAct.appendRow([generateId('ACT'), user.id, user.idNo, user.name, user.role, 'LOGIN', 'Successful login', now()]);
  } catch (e) {}

  return session;
}

// Entry Operations with Strict LockService & Idempotency Protection
function saveEntry(d) {
  const lock = LockService.getScriptLock();
  // Wait for up to 30 seconds to guarantee atomic execution under concurrent load
  const hasLock = lock.tryLock(30000);
  if (!hasLock) {
    throw Error('Server is busy processing another transaction. Please try again in a moment.');
  }

  try {
    const submissionId = String(d.submissionId || '').trim();
    const entryId = String(d.id || '').trim() || ('PWR-' + Date.now().toString().slice(-6));

    // 1. Check by Submission ID in MASTER_DATA (Strict Idempotency)
    if (submissionId) {
      const existingBySubIdx = findRowIndex('MASTER_DATA', 'submissionId', submissionId);
      if (existingBySubIdx > 0) {
        const existingRow = getRowByIndex('MASTER_DATA', existingBySubIdx);
        return {
          success: true,
          duplicate: true,
          message: 'Record already saved with this Submission ID',
          recordId: existingRow.id || entryId,
          submissionId: submissionId,
          entry: existingRow
        };
      }
    }

    // 2. Check by Record ID in MASTER_DATA
    if (entryId) {
      const existingByIdIdx = findRowIndex('MASTER_DATA', 'id', entryId);
      if (existingByIdIdx > 0) {
        const existingRow = getRowByIndex('MASTER_DATA', existingByIdIdx);
        if (!d._isExplicitUpdate) {
          return {
            success: true,
            duplicate: true,
            message: 'Record already saved with this ID',
            recordId: existingRow.id || entryId,
            submissionId: existingRow.submissionId || submissionId,
            entry: existingRow
          };
        }
      }
    }

    // 3. Semantic Deduplication Guard: Check if identical record was submitted within last 3 minutes
    if (d.consumerId && d.meterNo && d.category) {
      const recentRows = getRows('MASTER_DATA').slice(-30);
      const cleanConsumer = String(d.consumerId).trim().toLowerCase();
      const cleanMeter = String(d.meterNo).trim().toLowerCase();
      const cleanCat = String(d.category).trim().toUpperCase();
      const cleanWorker = String(d.workerName || '').trim().toLowerCase();

      const matched = recentRows.find(r => {
        const sameCat = String(r.category || '').toUpperCase() === cleanCat || CATEGORY_MAP[String(r.category || '').toUpperCase()] === CATEGORY_MAP[cleanCat];
        const sameConsumer = String(r.consumerId || '').trim().toLowerCase() === cleanConsumer;
        const sameMeter = String(r.meterNo || '').trim().toLowerCase() === cleanMeter;
        const sameWorker = cleanWorker ? String(r.workerName || '').trim().toLowerCase() === cleanWorker : true;
        if (sameCat && sameConsumer && sameMeter && sameWorker) {
          const recTime = new Date(r.createdAt || r.date || 0).getTime();
          const currTime = new Date(d.createdAt || d.date || Date.now()).getTime();
          return Math.abs(currTime - recTime) < 180000; // 3 minutes window
        }
        return false;
      });

      if (matched) {
        return {
          success: true,
          duplicate: true,
          message: 'Identical record already saved recently',
          recordId: matched.id,
          submissionId: matched.submissionId || submissionId,
          entry: matched
        };
      }
    }

    // 4. Form the verified new entry
    const finalSubmissionId = submissionId || ('SUB-' + Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase());
    const newEntry = Object.assign({}, d, {
      submissionId: finalSubmissionId,
      id: entryId,
      workerId: String(d.workerId || d.WorkerID || d.idNo || '').trim(),
      workerName: String(d.workerName || d.WorkerName || '').trim(),
      role: String(d.role || d.Role || 'worker').trim(),
      submittedBy: String(d.submittedBy || d.SubmittedBy || d.workerName || '').trim(),
      date: d.date || now(),
      createdAt: d.createdAt || d.date || now(),
      status: d.status || 'Completed',
      updatedAt: now()
    });

    // 5. Append to MASTER_DATA
    appendRow('MASTER_DATA', newEntry);

    // 6. Also sync to canonical category sheet if not already present
    const rawCat = String(newEntry.category || '').toUpperCase();
    const canonicalCat = CATEGORY_MAP[rawCat];
    if (canonicalCat) {
      try {
        const catSheet = getSheet(canonicalCat);
        const catIdx = findRowIndex(canonicalCat, 'submissionId', finalSubmissionId);
        if (catIdx <= 0) {
          appendRow(canonicalCat, newEntry);
        }
      } catch (e) {
        Logger.log('Category sheet append warning: ' + e);
      }
    }

    try { CacheService.getScriptCache().remove('dashboard_stats'); } catch (e) {}

    return {
      success: true,
      duplicate: false,
      message: 'Data saved successfully',
      recordId: newEntry.id,
      submissionId: newEntry.submissionId,
      entry: newEntry,
      data: newEntry
    };
  } finally {
    lock.releaseLock();
  }
}

// Safe Deduplication & Backup Process for existing duplicate records
function cleanupDuplicateRecords(targetSheetName) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000);
  if (!hasLock) throw Error('Server busy. Please try again.');

  try {
    const targetSheets = targetSheetName ? [targetSheetName] : [
      'MASTER_DATA', 'NEW_CONNECTION', 'DISCONNECTION', 'POLE_CASE', 'METER_REPLACEMENT', 'DTR_REPLACEMENT'
    ];

    const results = {};
    const ssInstance = ss();

    targetSheets.forEach(name => {
      const aliases = SHEET_ALIASES[name] || [name];
      let sheet = null;
      for (let i = 0; i < aliases.length; i++) {
        sheet = ssInstance.getSheetByName(aliases[i]);
        if (sheet) break;
      }

      if (!sheet || sheet.getLastRow() < 3) {
        results[name] = { removed: 0, kept: sheet ? Math.max(0, sheet.getLastRow() - 1) : 0 };
        return;
      }

      // Create backup sheet before deduplication
      const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm');
      const backupName = (sheet.getName() + '_BACKUP_BEFORE_DEDUPLICATION').slice(0, 50);
      if (!ssInstance.getSheetByName(backupName)) {
        const backupSheet = sheet.copyTo(ssInstance);
        backupSheet.setName(backupName);
      }

      const totalRows = sheet.getLastRow();
      const totalCols = sheet.getLastColumn();
      const headers = sheet.getRange(1, 1, 1, totalCols).getValues()[0];
      const rows = sheet.getRange(2, 1, totalRows - 1, totalCols).getValues();

      const subIdCol = headers.indexOf('submissionId');
      const idCol = headers.indexOf('id');
      const catCol = headers.indexOf('category');
      const consIdCol = headers.indexOf('consumerId');
      const meterCol = headers.indexOf('meterNo');
      const dateCol = headers.indexOf('date');

      const seenKeys = new Set();
      const rowsToKeep = [];
      let removedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const subId = subIdCol >= 0 ? String(r[subIdCol] || '').trim() : '';
        const idVal = idCol >= 0 ? String(r[idCol] || '').trim() : '';
        const catVal = catCol >= 0 ? String(r[catCol] || '').trim().toUpperCase() : '';
        const consVal = consIdCol >= 0 ? String(r[consIdCol] || '').trim().toLowerCase() : '';
        const meterVal = meterCol >= 0 ? String(r[meterCol] || '').trim().toLowerCase() : '';
        const dateVal = dateCol >= 0 ? String(r[dateCol] || '').slice(0, 10) : '';

        let key = '';
        if (subId && subId.indexOf('SUB-') === 0) {
          key = 'SUB:' + subId;
        } else if (consVal && meterVal) {
          key = 'CONS:' + catVal + ':' + consVal + ':' + meterVal + ':' + dateVal;
        } else if (idVal) {
          key = 'ID:' + idVal;
        }

        if (key && seenKeys.has(key)) {
          removedCount++;
        } else {
          if (key) seenKeys.add(key);
          rowsToKeep.push(r);
        }
      }

      if (removedCount > 0) {
        sheet.getRange(2, 1, totalRows - 1, totalCols).clearContent();
        if (rowsToKeep.length > 0) {
          sheet.getRange(2, 1, rowsToKeep.length, totalCols).setValues(rowsToKeep);
        }
      }

      results[name] = { removed: removedCount, kept: rowsToKeep.length };
    });

    return {
      success: true,
      message: 'Safely deduplicated sheets with backup created',
      details: results
    };
  } finally {
    lock.releaseLock();
  }
}

function removeEntry(id) {
  deleteRow('MASTER_DATA', 'id', id);
  // Also remove from category sheets
  Object.keys(SHEET_ALIASES).forEach(k => {
    if (k.indexOf('CONNECTION') >= 0 || k.indexOf('DISCONNECTION') >= 0 || k.indexOf('POLE') >= 0 || k.indexOf('METER') >= 0 || k.indexOf('DTR') >= 0) {
      try { deleteRow(k, 'id', id); } catch (e) {}
    }
  });
  try { CacheService.getScriptCache().remove('dashboard_stats'); } catch (e) {}
  return true;
}

function queryEntries(params) {
  let list = getRows('MASTER_DATA');
  
  if (params.workerId || params.workerName) {
    const wId = String(params.workerId || '').toLowerCase().trim();
    const wName = String(params.workerName || '').toLowerCase().trim();
    list = list.filter(e => {
      const eWId = String(e.workerId || e.idNo || '').toLowerCase().trim();
      const eWName = String(e.workerName || '').toLowerCase().trim();
      const eCreator = String(e.createdBy || '').toLowerCase().trim();
      if (wId && (eWId === wId || eCreator === wId)) return true;
      if (wName && eWName.indexOf(wName) >= 0) return true;
      return false;
    });
  }

  if (params.category && params.category !== 'ALL') {
    const catQuery = String(params.category).toUpperCase();
    list = list.filter(e => {
      const itemCat = String(e.category || '').toUpperCase();
      return itemCat === catQuery || CATEGORY_MAP[itemCat] === CATEGORY_MAP[catQuery];
    });
  }

  if (params.status && params.status !== 'ALL') {
    list = list.filter(e => String(e.status).toLowerCase() === String(params.status).toLowerCase());
  }

  if (params.search) {
    const q = String(params.search).toLowerCase();
    list = list.filter(e => 
      (e.id && String(e.id).toLowerCase().indexOf(q) >= 0) ||
      (e.consumerName && String(e.consumerName).toLowerCase().indexOf(q) >= 0) ||
      (e.consumerId && String(e.consumerId).toLowerCase().indexOf(q) >= 0) ||
      (e.meterNo && String(e.meterNo).toLowerCase().indexOf(q) >= 0) ||
      (e.poleNo && String(e.poleNo).toLowerCase().indexOf(q) >= 0) ||
      (e.workerName && String(e.workerName).toLowerCase().indexOf(q) >= 0) ||
      (e.address && String(e.address).toLowerCase().indexOf(q) >= 0)
    );
  }

  return list.reverse();
}

function computeStats() {
  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get('dashboard_stats');
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  const entries = getRows('MASTER_DATA');
  const countCat = (catName) => {
    return entries.filter(e => {
      const c = String(e.category || '').toUpperCase();
      return c === catName || CATEGORY_MAP[c] === CATEGORY_MAP[catName];
    }).length;
  };

  const result = {
    total: entries.length,
    categories: {
      NSC: countCat('NSC'),
      DISCONNECTION: countCat('DISCONNECTION'),
      POLE_CASE: countCat('POLE_CASE') + countCat('POLE CASE'),
      'POLE CASE': countCat('POLE_CASE') + countCat('POLE CASE'),
      METER_REPLESMENT: countCat('METER_REPLESMENT') + countCat('METER_REPLACEMENT'),
      METER_REPLACEMENT: countCat('METER_REPLESMENT') + countCat('METER_REPLACEMENT'),
      DTR_REPLESMENT: countCat('DTR_REPLESMENT') + countCat('DTR_REPLACEMENT'),
      DTR_REPLACEMENT: countCat('DTR_REPLESMENT') + countCat('DTR_REPLACEMENT')
    },
    status: {
      pending: entries.filter(e => String(e.status).toLowerCase() === 'pending').length,
      completed: entries.filter(e => String(e.status).toLowerCase() === 'completed').length,
      approved: entries.filter(e => String(e.status).toLowerCase() === 'approved').length
    }
  };

  try {
    cache.put('dashboard_stats', JSON.stringify(result), 45); // 45s cache
  } catch (e) {}

  return result;
}

function bulkSyncEntries(items) {
  if (!Array.isArray(items)) throw Error('Array of entries is required for bulkSync');
  let count = 0;
  for (let i = 0; i < items.length; i++) {
    saveEntry(items[i]);
    count++;
  }
  return { success: true, syncedCount: count, total: getRows('MASTER_DATA').length };
}

// Google Drive Storage for Work Orders & Khata Files
function getOrCreateWorkOrdersFolder() {
  const folderName = 'WBSEDCL_Work_Orders_Khata_Files';
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    const folder = folders.next();
    try {
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}
    return folder;
  }
  const folder = DriveApp.createFolder(folderName);
  try {
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}
  return folder;
}

function saveFileToDrive(fileData, fileName, mimeType) {
  if (!fileData || typeof fileData !== 'string') {
    return null;
  }

  // If already an http(s) URL, no need to re-upload
  if (fileData.indexOf('http://') === 0 || fileData.indexOf('https://') === 0) {
    return {
      fileId: '',
      fileName: fileName || '',
      fileType: mimeType || 'image/jpeg',
      fileSize: 0,
      driveViewUrl: fileData,
      driveDownloadUrl: fileData,
      directImageUrl: fileData
    };
  }

  let cleanBase64 = fileData;
  let detectedMime = mimeType || 'image/jpeg';

  if (cleanBase64.indexOf(';base64,') > -1) {
    const parts = cleanBase64.split(';base64,');
    const prefix = parts[0];
    if (prefix.indexOf('data:') === 0) {
      detectedMime = prefix.replace('data:', '').trim();
    }
    cleanBase64 = parts[1];
  } else if (cleanBase64.indexOf('data:') === 0) {
    const commaIdx = cleanBase64.indexOf(',');
    if (commaIdx > -1) {
      cleanBase64 = cleanBase64.substring(commaIdx + 1);
    }
  }

  cleanBase64 = cleanBase64.trim();
  const decodedBytes = Utilities.base64Decode(cleanBase64);

  let ext = '.jpg';
  if (detectedMime.indexOf('png') > -1) ext = '.png';
  else if (detectedMime.indexOf('pdf') > -1) ext = '.pdf';
  else if (detectedMime.indexOf('webp') > -1) ext = '.webp';

  const baseName = (fileName || ('WBSEDCL_Notice_' + Date.now())).replace(/\.[^/.]+$/, '');
  const safeFileName = baseName + ext;

  const blob = Utilities.newBlob(decodedBytes, detectedMime, safeFileName);
  const folder = getOrCreateWorkOrdersFolder();
  const file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('Set sharing failed: ' + e);
  }

  const fileId = file.getId();
  const driveViewUrl = 'https://drive.google.com/file/d/' + fileId + '/view?usp=drivesdk';
  const driveDownloadUrl = 'https://drive.google.com/uc?export=download&id=' + fileId;
  const directImageUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w2000';

  return {
    fileId: fileId,
    fileName: safeFileName,
    fileType: detectedMime,
    fileSize: file.getSize(),
    driveViewUrl: driveViewUrl,
    driveDownloadUrl: driveDownloadUrl,
    directImageUrl: directImageUrl
  };
}

// Work Orders
function saveWorkOrder(d) {
  const id = d.id || generateId('WO');
  const nowObj = new Date();

  const rawFile = d.photoUrl || d.fileData || d.photoBase64 || d.image || '';
  let driveInfo = null;

  if (rawFile && typeof rawFile === 'string' && (rawFile.indexOf('data:') === 0 || rawFile.length > 500)) {
    try {
      driveInfo = saveFileToDrive(rawFile, d.fileName || d.title, d.fileType || d.mimeType);
    } catch (err) {
      Logger.log('Drive upload error: ' + err.toString());
    }
  }

  const finalPhotoUrl = driveInfo ? driveInfo.directImageUrl : (rawFile.length < 500 ? rawFile : '');
  const fileId = driveInfo ? driveInfo.fileId : (d.fileId || '');
  const fileName = driveInfo ? driveInfo.fileName : (d.fileName || '');
  const fileType = driveInfo ? driveInfo.fileType : (d.fileType || 'image/jpeg');
  const fileSize = driveInfo ? driveInfo.fileSize : (d.fileSize || 0);
  const driveViewUrl = driveInfo ? driveInfo.driveViewUrl : (d.driveViewUrl || '');
  const driveDownloadUrl = driveInfo ? driveInfo.driveDownloadUrl : (d.driveDownloadUrl || '');
  const directImageUrl = driveInfo ? driveInfo.directImageUrl : (d.directImageUrl || finalPhotoUrl);

  const item = {
    id: id,
    category: d.category || 'NSC',
    title: d.title || 'WBSEDCL Work Order Notice',
    photoUrl: finalPhotoUrl,
    fileId: fileId,
    fileName: fileName,
    fileType: fileType,
    fileSize: fileSize,
    driveViewUrl: driveViewUrl,
    driveDownloadUrl: driveDownloadUrl,
    directImageUrl: directImageUrl,
    description: d.description || '',
    uploadedBy: d.uploadedBy || 'admin',
    adminName: d.adminName || 'Admin Controller',
    adminPhone: d.adminPhone || '8695716192',
    uploadDate: Utilities.formatDate(nowObj, Session.getScriptTimeZone(), 'dd MMM yyyy'),
    uploadTime: Utilities.formatDate(nowObj, Session.getScriptTimeZone(), 'hh:mm a'),
    createdAt: now(),
    isHidden: Boolean(d.isHidden)
  };
  appendRow('WORK_ORDERS', item);
  return item;
}

// Routing
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = String(p.action || 'health').trim();

    if (action === 'health' || action === 'healthCheck') {
      return out({
        success: true,
        status: 'ok',
        app: 'POWER',
        spreadsheetId: SPREADSHEET_ID,
        message: 'Google Sheets API connected and operational'
      });
    }

    if (action === 'database' || action === 'setup' || action === 'init') {
      return out(setupDatabase());
    }

    if (action === 'users' || action === 'getUsers') {
      const users = getRows('USERS').map(sanitizeUser);
      return out({ success: true, users: users });
    }

    if (action === 'entries' || action === 'getMasterData') {
      return out({ success: true, entries: queryEntries(p) });
    }

    if (action === 'stats' || action === 'getDashboardStats') {
      return out({ success: true, stats: computeStats() });
    }

    if (action === 'verify') {
      const cleanId = String(p.idNo || '').trim().toLowerCase();
      const u = getRows('USERS').find(x => 
        String(x.idNo).trim().toLowerCase() === cleanId || 
        String(x.id).trim().toLowerCase() === cleanId
      );
      if (u) {
        return out({ success: true, result: { valid: u.status !== 'hold', status: u.status, role: u.role } });
      }
      return out({ success: true, result: { valid: false, error: 'User not found in Google Sheets' } });
    }

    if (action === 'workorders' || action === 'getWorkOrders') {
      let orders = getRows('WORK_ORDERS');
      if (p.category && p.category !== 'ALL') {
        orders = orders.filter(o => o.category === p.category || o.category === 'ALL');
      }
      return out({ success: true, workOrders: orders.reverse() });
    }

    if (action === 'chat' || action === 'getChat') {
      let msgs = getRows('CHAT');
      if (p.workerId) {
        msgs = msgs.filter(m => 
          String(m.workerId) === String(p.workerId) || 
          String(m.senderId) === String(p.workerId) || 
          String(m.recipientId) === String(p.workerId) ||
          m.recipientId === 'all'
        );
      }
      return out({ success: true, messages: msgs });
    }

    if (action === 'settings' || action === 'getSettings') {
      return out({ success: true, settings: getRows('SETTINGS') });
    }

    if (action === 'userActivity' || action === 'getUserActivity') {
      return out({ success: true, activities: getRows('USER_ACTIVITY').reverse() });
    }

    // Specific category read shortcuts
    if (action === 'getNewConnections') return out({ success: true, entries: queryEntries({ category: 'NSC' }) });
    if (action === 'getDisconnections') return out({ success: true, entries: queryEntries({ category: 'DISCONNECTION' }) });
    if (action === 'getPoleCases') return out({ success: true, entries: queryEntries({ category: 'POLE CASE' }) });
    if (action === 'getMeterReplacements') return out({ success: true, entries: queryEntries({ category: 'METER REPLESMENT' }) });
    if (action === 'getDTRReplacements') return out({ success: true, entries: queryEntries({ category: 'DTR REPLESMENT' }) });

    throw Error('Unknown GET action: ' + action);
  } catch (err) {
    return out({ success: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    const rawContent = (e && e.postData && e.postData.contents) || '{}';
    const body = JSON.parse(rawContent);
    const action = String(body.action || '').trim();
    const data = body.data || {};

    if (!action) throw Error('Action is required in POST payload');

    // Health & Setup
    if (action === 'health' || action === 'healthCheck') {
      return out({ success: true, status: 'ok', app: 'POWER', spreadsheetId: SPREADSHEET_ID });
    }
    if (action === 'setup' || action === 'init' || action === 'database') {
      return out(setupDatabase());
    }

    // Auth & User Management
    if (action === 'login') {
      return out({ success: true, session: authenticateUser(body.idNo, body.password) });
    }
    if (action === 'users' || action === 'getUsers') {
      return out({ success: true, users: getRows('USERS').map(sanitizeUser) });
    }
    if (action === 'createUser') {
      return out({ success: true, user: createUser(data) });
    }
    if (action === 'updateUser') {
      const updated = updateRow('USERS', 'id', body.id, data);
      invalidateUserCache(updated?.idNo || body?.idNo, body?.id);
      return out({ success: true, user: sanitizeUser(updated) });
    }
    if (action === 'updateUserStatus') {
      const targetId = body.id || body.idNo;
      const key = body.id ? 'id' : 'idNo';
      const updated = updateRow('USERS', key, targetId, { status: body.status });
      invalidateUserCache(body.idNo, body.id);
      return out({ success: true, user: sanitizeUser(updated) });
    }
    if (action === 'deleteUser') {
      const targetId = String(body.id || body.idNo || '').toLowerCase();
      if (targetId.indexOf('8695716192') >= 0 || targetId === 'admin') {
        throw Error('Primary Admin account cannot be deleted');
      }
      const key = body.id ? 'id' : 'idNo';
      deleteRow('USERS', key, body.id || body.idNo);
      invalidateUserCache(body.idNo, body.id);
      return out({ success: true, message: 'User deleted from Google Sheets' });
    }
    if (action === 'changePassword') {
      const cleanId = String(body.idNo || '').trim().toLowerCase();
      const users = getRows('USERS');
      const u = users.find(x => String(x.idNo).trim().toLowerCase() === cleanId);
      if (!u) throw Error('User not found in Google Sheets');
      const match = String(u.password).trim() === String(body.currentPassword).trim() || 
        (u.passwordHash && u.passwordHash === sha(body.currentPassword));
      if (!match) throw Error('Current password is incorrect');
      updateRow('USERS', 'id', u.id, { password: String(body.newPassword).trim() });
      invalidateUserCache(u.idNo, u.id);
      return out({ success: true, message: 'Password updated successfully in Google Sheets' });
    }
    if (action === 'resetPassword') {
      const cleanId = String(body.idNo || '').trim().toLowerCase();
      const users = getRows('USERS');
      const u = users.find(x => {
        const idMatch = String(x.idNo).trim().toLowerCase() === cleanId;
        if (!idMatch) return false;
        if (body.phone) {
          return String(x.phone).replace(/\D/g, '') === String(body.phone).replace(/\D/g, '');
        }
        return true;
      });
      if (!u) throw Error('User verification failed in Google Sheets');
      updateRow('USERS', 'id', u.id, { password: String(body.newPassword).trim() });
      invalidateUserCache(u.idNo, u.id);
      return out({ success: true, message: 'Password reset successfully in Google Sheets' });
    }

    // Entries & CRUD Operations (Protected with LockService & Idempotency)
    if (action === 'entries' || action === 'getMasterData') {
      return out({ success: true, entries: queryEntries(body) });
    }
    if (action === 'stats' || action === 'getDashboardStats') {
      return out({ success: true, stats: computeStats() });
    }
    if (
      action === 'createEntry' ||
      action === 'saveEntry' ||
      action === 'createNSC' ||
      action === 'createNewConnection' ||
      action === 'createDisconnection' ||
      action === 'createPoleCase' ||
      action === 'createMeterReplacement' ||
      action === 'createDTRReplacement'
    ) {
      if (action === 'createNSC' || action === 'createNewConnection') data.category = data.category || 'NSC';
      if (action === 'createDisconnection') data.category = data.category || 'DISCONNECTION';
      if (action === 'createPoleCase') data.category = data.category || 'POLE CASE';
      if (action === 'createMeterReplacement') data.category = data.category || 'METER REPLESMENT';
      if (action === 'createDTRReplacement') data.category = data.category || 'DTR REPLESMENT';
      return out(saveEntry(data));
    }
    if (
      action === 'updateEntry' ||
      action === 'updateNSC' ||
      action === 'updateNewConnection' ||
      action === 'updateDisconnection' ||
      action === 'updatePoleCase' ||
      action === 'updateMeterReplacement' ||
      action === 'updateDTRReplacement'
    ) {
      const targetId = body.id || data.id;
      const updated = updateRow('MASTER_DATA', 'id', targetId, Object.assign({}, data, { _isExplicitUpdate: true }));
      return out({ success: true, entry: updated });
    }
    if (
      action === 'deleteEntry' ||
      action === 'deleteNSC' ||
      action === 'deleteNewConnection' ||
      action === 'deleteDisconnection' ||
      action === 'deletePoleCase' ||
      action === 'deleteMeterReplacement' ||
      action === 'deleteDTRReplacement'
    ) {
      const targetId = body.id || data.id;
      removeEntry(targetId);
      return out({ success: true, message: 'Entry deleted successfully from Google Sheets' });
    }
    if (action === 'cleanupDuplicates' || action === 'deduplicateSheets') {
      return out(cleanupDuplicateRecords(body.sheetName));
    }
    if (action === 'clearEntries') {
      const s = getSheet('MASTER_DATA');
      if (s.getLastRow() > 1) {
        s.deleteRows(2, s.getLastRow() - 1);
      }
      return out({ success: true, message: 'All entries cleared from Google Sheets' });
    }
    if (action === 'sync' || action === 'bulkSync') {
      const items = body.entries || body.data || [];
      return out(bulkSyncEntries(items));
    }

    // Work Orders
    if (action === 'workorders' || action === 'getWorkOrders') {
      return out({ success: true, workOrders: getRows('WORK_ORDERS').reverse() });
    }
    if (action === 'createWorkOrder' || action === 'uploadWorkOrder') {
      return out({ success: true, workOrder: saveWorkOrder(data) });
    }
    if (action === 'toggleWorkOrder') {
      const updated = updateRow('WORK_ORDERS', 'id', body.id, { isHidden: Boolean(body.isHidden) });
      return out({ success: true, workOrder: updated });
    }
    if (action === 'deleteWorkOrder') {
      deleteRow('WORK_ORDERS', 'id', body.id);
      return out({ success: true, message: 'Work order deleted from Google Sheets' });
    }

    // Live Chat
    if (action === 'chat' || action === 'getChat') {
      return out({ success: true, messages: getRows('CHAT') });
    }
    if (action === 'sendChat') {
      const msg = {
        id: data.id || generateId('MSG'),
        workerId: data.workerId || data.senderId || '',
        senderId: data.senderId || 'anonymous',
        senderName: data.senderName || 'User',
        senderRole: data.senderRole || 'worker',
        recipientId: data.recipientId || 'all',
        recipientRole: data.recipientRole || (data.senderRole === 'worker' ? 'admin' : 'worker'),
        message: String(data.message || '').trim(),
        timestamp: data.timestamp || now(),
        status: data.status || 'sent',
        createdAt: now()
      };
      appendRow('CHAT', msg);
      return out({ success: true, message: msg });
    }
    if (action === 'clearChat') {
      const s = getSheet('CHAT');
      if (s.getLastRow() > 1) {
        s.deleteRows(2, s.getLastRow() - 1);
      }
      return out({ success: true, message: 'Chat history cleared in Google Sheets' });
    }

    // Activity Log
    if (action === 'logActivity') {
      logActivity(data.userId, data.idNo, data.userName, data.role, data.activityAction, data.details);
      return out({ success: true });
    }

    throw Error('Unknown POST action: ' + action);
  } catch (err) {
    return out({ success: false, error: String(err.message || err) });
  }
}
