// ============================================================================
// POWER - Field Worker & Utility Management System (WBSEDCL)
// Google Apps Script Web App Backend & Single Source of Truth
// Fully Production-Hardened Google Sheets & Google Drive Integration
// ============================================================================

const SPREADSHEET_ID = '1-3LtAbXZU6klisReK6ffIxDUwbM4wXvhxSbKVpE7raY';
const WORK_ORDERS_FOLDER_NAME = 'WBSEDCL_Work_Orders_Khata_Files';

// Canonical Sheet Aliases
const SHEET_ALIASES = {
  'Users': ['Users', 'USERS', 'users', 'User'],
  'NSC': ['NSC', 'NewConnection', 'NEW_CONNECTION', 'New Connection', 'NEW CONNECTION'],
  'Disconnection': ['Disconnection', 'DISCONNECTION', 'Disconnect', 'DISCONNECT'],
  'Broken': ['Broken', 'BROKEN', 'POLE CASE', 'POLE_CASE', 'PoleCase', 'Pole Case'],
  'Meter Replacement': ['Meter Replacement', 'METER REPLACEMENT', 'METER REPLESMENT', 'METER_REPLESMENT', 'MeterReplacement'],
  'DTR Replacement': ['DTR Replacement', 'DTR REPLACEMENT', 'DTR REPLESMENT', 'DTR_REPLESMENT', 'DtrReplacement'],
  'Call Case': ['Call Case', 'CALL CASE', 'CALL_CASE', 'CallCase'],
  'Work Orders': ['Work Orders', 'WORK_ORDERS', 'WorkOrders', 'workorders'],
  'System Logs': ['System Logs', 'SYSTEM_LOGS', 'SystemLogs', 'USER_ACTIVITY', 'ActivityLogs'],
  'Settings': ['Settings', 'SETTINGS'],
  'Chat': ['Chat', 'CHAT']
};

// Canonical Category Normalization
const CATEGORY_MAP = {
  'NSC': 'NSC',
  'NEW_CONNECTION': 'NSC',
  'NEW CONNECTION': 'NSC',
  'NEWCONNECTION': 'NSC',
  'DISCONNECTION': 'Disconnection',
  'DISCONNECT': 'Disconnection',
  'POLE CASE': 'Broken',
  'POLE_CASE': 'Broken',
  'POLECASE': 'Broken',
  'BROKEN': 'Broken',
  'BROKEN CASE': 'Broken',
  'METER REPLESMENT': 'Meter Replacement',
  'METER_REPLESMENT': 'Meter Replacement',
  'METER REPLACEMENT': 'Meter Replacement',
  'METER_REPLACEMENT': 'Meter Replacement',
  'METERREPLACEMENT': 'Meter Replacement',
  'DTR REPLESMENT': 'DTR Replacement',
  'DTR_REPLESMENT': 'DTR Replacement',
  'DTR REPLACEMENT': 'DTR Replacement',
  'DTR_REPLACEMENT': 'DTR Replacement',
  'DTRREPLACEMENT': 'DTR Replacement',
  'CALL CASE': 'Call Case',
  'CALL_CASE': 'Call Case',
  'CALLCASE': 'Call Case'
};

function normalizeCategory(cat) {
  if (!cat) return null;
  const raw = String(cat).trim();
  const upper = raw.toUpperCase();
  if (CATEGORY_MAP[upper]) return CATEGORY_MAP[upper];
  const cleaned = upper.replace(/[\s_\-]/g, '');
  if (CATEGORY_MAP[cleaned]) return CATEGORY_MAP[cleaned];
  if (cleaned.includes('NSC') || cleaned.includes('NEWCON')) return 'NSC';
  if (cleaned.includes('DISCON')) return 'Disconnection';
  if (cleaned.includes('POLE') || cleaned.includes('BROKEN')) return 'Broken';
  if (cleaned.includes('METER')) return 'Meter Replacement';
  if (cleaned.includes('DTR')) return 'DTR Replacement';
  if (cleaned.includes('CALL')) return 'Call Case';
  return raw;
}

// Canonical Headers by Sheet Name
const USERS_HEADERS = [
  'User ID', 'Role', 'Full Name', 'Phone', 'Password Hash', 'Status',
  'Designation', 'Badge No', 'Security Question', 'Security Answer Hash',
  'Created At', 'Updated At', 'Last Login', 'Created By'
];

const NSC_HEADERS = [
  'Submission ID', 'Record ID', 'Category', 'Status', 'Date', 'Created At', 'Updated At',
  'Worker ID', 'Worker Name', 'Role', 'Submitted By', 'Worker Phone',
  'Agency Name', 'CCC Name', 'Substation', 'Feeder Name',
  'Work Order No', 'Work Order Date', 'Work Order Notice ID', 'Work Order Notice Title', 'Work Order Notice Date', 'Work Order Photo',
  'Application No', 'Consumer ID', 'Consumer Name', 'Father Name', 'Mobile No', 'Address',
  'Applied Load', 'Supply Phase', 'Tariff Category', 'Service Cable Length', 'Pole No', 'Earth Resistance',
  'Meter No', 'Meter Make', 'Initial Reading', 'Meter Seal No', 'Meter Install Date', 'Inspection Agency Name',
  'GPS Location', 'Photo Evidence', 'Notes'
];

const DISCONNECTION_HEADERS = [
  'Submission ID', 'Record ID', 'Category', 'Status', 'Date', 'Created At', 'Updated At',
  'Worker ID', 'Worker Name', 'Role', 'Submitted By', 'Worker Phone',
  'Substation', 'Feeder Name',
  'Consumer ID', 'Consumer Name', 'Father Name', 'Mobile No', 'Address',
  'Arrear Amount', 'Reason', 'Final Reading', 'Disconnection Type', 'Cutout Sealed',
  'GPS Location', 'Photo Evidence', 'Notes'
];

const BROKEN_HEADERS = [
  'Submission ID', 'Record ID', 'Category', 'Status', 'Date', 'Created At', 'Updated At',
  'Worker ID', 'Worker Name', 'Role', 'Submitted By', 'Worker Phone',
  'Substation', 'Feeder Name', 'Pole No',
  'Issue Type', 'Priority', 'Action Taken', 'Material Used', 'Pole Type', 'Line Voltage', 'Conductor Type', 'PTW Shutdown Ref',
  'GPS Location', 'Photo Evidence', 'Photo Before', 'Photo After', 'Notes'
];

const METER_REPLACEMENT_HEADERS = [
  'Submission ID', 'Record ID', 'Category', 'Status', 'Date', 'Created At', 'Updated At',
  'Worker ID', 'Worker Name', 'Role', 'Submitted By', 'Worker Phone',
  'Substation', 'Feeder Name',
  'Consumer ID', 'Consumer Name', 'Mobile No', 'Address',
  'Old Meter No', 'Replacement Reason', 'New Meter No', 'New Meter Seal No', 'Old Meter Seal No', 'Meter Type',
  'GPS Location', 'Photo Evidence', 'Photo Before', 'Photo After', 'Notes'
];

const DTR_REPLACEMENT_HEADERS = [
  'Submission ID', 'Record ID', 'Category', 'Status', 'Date', 'Created At', 'Updated At',
  'Worker ID', 'Worker Name', 'Role', 'Submitted By', 'Worker Phone',
  'Substation', 'Feeder Name',
  'DTR Name', 'Existing Capacity', 'New Capacity', 'Old DTR Serial', 'New DTR Serial', 'Failure Reason',
  'Oil Level Checked', 'Earth Resistance', 'DTR Make Brand', 'HG Fuse Rating', 'LT MCCB Ampere', 'Lightning Arrester',
  'GPS Location', 'Photo Evidence', 'Notes'
];

const CALL_CASE_HEADERS = [
  'Submission ID', 'Record ID', 'Category', 'Status', 'Date', 'Created At', 'Updated At',
  'Worker ID', 'Worker Name', 'Role', 'Submitted By', 'Worker Phone',
  'Substation', 'Feeder Name',
  'Consumer ID', 'Consumer Name', 'Mobile No', 'Address',
  'Issue Type', 'Priority', 'Action Taken',
  'GPS Location', 'Photo Evidence', 'Notes'
];

const WORK_ORDERS_HEADERS = [
  'id', 'category', 'title', 'photoUrl', 'fileId', 'fileName', 'fileType', 'fileSize',
  'driveViewUrl', 'driveDownloadUrl', 'directImageUrl', 'description', 'uploadedBy',
  'adminName', 'adminPhone', 'uploadDate', 'uploadTime', 'createdAt', 'isHidden'
];

const SYSTEM_LOGS_HEADERS = [
  'id', 'userId', 'idNo', 'userName', 'role', 'action', 'details', 'ipAddress', 'timestamp', 'createdAt'
];

const CHAT_HEADERS = [
  'id', 'workerId', 'senderId', 'senderName', 'senderRole', 'recipientId', 'recipientRole',
  'message', 'timestamp', 'status', 'createdAt'
];

function getHeadersForSheet(name) {
  const norm = String(name || '').trim();
  if (norm === 'Users') return USERS_HEADERS;
  if (norm === 'NSC') return NSC_HEADERS;
  if (norm === 'Disconnection') return DISCONNECTION_HEADERS;
  if (norm === 'Broken' || norm === 'POLE CASE') return BROKEN_HEADERS;
  if (norm === 'Meter Replacement' || norm === 'METER REPLESMENT') return METER_REPLACEMENT_HEADERS;
  if (norm === 'DTR Replacement' || norm === 'DTR REPLESMENT') return DTR_REPLACEMENT_HEADERS;
  if (norm === 'Call Case') return CALL_CASE_HEADERS;
  if (norm === 'Work Orders') return WORK_ORDERS_HEADERS;
  if (norm === 'System Logs') return SYSTEM_LOGS_HEADERS;
  if (norm === 'Chat') return CHAT_HEADERS;
  return NSC_HEADERS;
}

// Spreadsheet Singleton
var _ss = null;
function ss() {
  if (!_ss) {
    _ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return _ss;
}

// Find existing sheet by canonical name or any alias
function getSheet(canonicalName) {
  const spreadsheet = ss();
  const aliases = SHEET_ALIASES[canonicalName] || [canonicalName];

  for (let i = 0; i < aliases.length; i++) {
    const s = spreadsheet.getSheetByName(aliases[i]);
    if (s) return s;
  }

  // Case-insensitive / normalized search
  const allSheets = spreadsheet.getSheets();
  const normAliases = aliases.map(a => a.toUpperCase().replace(/[\s_\-]/g, ''));
  for (let i = 0; i < allSheets.length; i++) {
    const s = allSheets[i];
    const sNorm = s.getName().toUpperCase().replace(/[\s_\-]/g, '');
    if (normAliases.indexOf(sNorm) >= 0) return s;
  }

  // If not found, auto-create sheet with canonical name and default headers
  const newSheet = spreadsheet.insertSheet(canonicalName);
  const defaultHeaders = getHeadersForSheet(canonicalName);
  newSheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
  newSheet.setFrozenRows(1);
  return newSheet;
}

// Utility: Normalize Header for loose matching
function normHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// SHA-256 Password Hasher
function hashPassword(pass) {
  if (!pass) return '';
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pass).trim(), Utilities.Charset.UTF_8);
  let txt = '';
  for (let i = 0; i < raw.length; i++) {
    let byteVal = raw[i];
    if (byteVal < 0) byteVal += 256;
    let byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = '0' + byteHex;
    txt += byteHex;
  }
  return txt;
}

function now() {
  return new Date().toISOString();
}

function generateId(prefix) {
  return prefix + '-' + Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7);
}

// Standard Output Helpers
function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function out(data, message, reqId) {
  const rId = reqId || ('REQ-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase());
  const payload = {
    success: true,
    data: data,
    error: null,
    message: message || 'Success',
    requestId: rId
  };
  // Also shallow attach common properties for full backward compatibility
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (data.session) payload.session = data.session;
    if (data.users) payload.users = data.users;
    if (data.user) payload.user = data.user;
    if (data.entries) payload.entries = data.entries;
    if (data.entry) payload.entry = data.entry;
    if (data.stats) payload.stats = data.stats;
    if (data.workOrders) payload.workOrders = data.workOrders;
    if (data.workOrder) payload.workOrder = data.workOrder;
    if (data.messages) payload.messages = data.messages;
    if (data.duplicate !== undefined) payload.duplicate = data.duplicate;
  } else if (Array.isArray(data)) {
    payload.entries = data;
    payload.items = data;
    payload.users = data;
  }
  return jsonResponse(payload);
}

function errOut(code, message, reqId) {
  const errMsg = message || 'An error occurred';
  const errCode = code || 'ERROR';
  const rId = reqId || ('REQ-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase());
  const payload = {
    success: false,
    data: null,
    error: {
      code: errCode,
      message: errMsg
    },
    message: errMsg,
    errorCode: errCode,
    details: {
      code: errCode,
      message: errMsg
    },
    requestId: rId
  };
  return jsonResponse(payload);
}

// System Logging
function logSystemActivity(userId, idNo, userName, role, action, details) {
  try {
    const s = getSheet('System Logs');
    s.appendRow([
      generateId('LOG'),
      userId || '',
      idNo || '',
      userName || '',
      role || '',
      action || '',
      typeof details === 'object' ? JSON.stringify(details) : String(details || ''),
      '',
      now(),
      now()
    ]);
  } catch (e) {
    Logger.log('Error logging activity: ' + e);
  }
}

// ============================================================================
// DATABASE INITIALIZATION & HEALTH CHECK
// ============================================================================

function initializeDatabase() {
  const requiredSheets = [
    'Users',
    'NSC',
    'Disconnection',
    'Broken',
    'Meter Replacement',
    'DTR Replacement',
    'Call Case',
    'Work Orders',
    'System Logs',
    'Settings',
    'Chat'
  ];

  const createdOrVerified = [];
  requiredSheets.forEach(name => {
    const s = getSheet(name);
    const expectedHeaders = getHeadersForSheet(name);
    const lastRow = s.getLastRow();
    const lastCol = s.getLastColumn();

    if (lastRow === 0 || lastCol === 0) {
      s.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      s.setFrozenRows(1);
    } else {
      // Ensure missing headers are appended without altering existing columns
      const existingHeaders = s.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
      const missing = [];
      expectedHeaders.forEach(eh => {
        const normEh = normHeader(eh);
        const exists = existingHeaders.some(ex => normHeader(ex) === normEh);
        if (!exists) missing.push(eh);
      });
      if (missing.length > 0) {
        s.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
      }
    }
    createdOrVerified.push(s.getName());
  });

  // Seed default admin if Users is empty
  const users = getSheetRows('Users');
  if (users.length === 0) {
    const adminPassHash = hashPassword('2004');
    appendSheetRecord('Users', {
      'User ID': '8695716192',
      'Role': 'admin',
      'Full Name': 'NAYEM (Admin Controller)',
      'Phone': '8695716192',
      'Password Hash': adminPassHash,
      'Status': 'active',
      'Designation': 'CONTROLLER / Divisional Admin',
      'Badge No': 'ADM-8695',
      'Security Question': 'Primary Power Substation?',
      'Security Answer Hash': hashPassword('Vidyut Bhavan'),
      'Created At': now(),
      'Updated At': now(),
      'Last Login': '',
      'Created By': 'system'
    });
  }

  // Clear cache
  try { CacheService.getScriptCache().removeAll(['users_cache', 'dashboard_stats']); } catch (e) {}

  return {
    status: 'ok',
    spreadsheetId: SPREADSHEET_ID,
    spreadsheetUrl: ss().getUrl(),
    verifiedSheets: createdOrVerified
  };
}

// Fast Single-Call Sheet Reader
function getSheetRows(sheetName) {
  const s = getSheet(sheetName);
  const lastRow = s.getLastRow();
  const lastCol = s.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = s.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => String(h || '').trim());
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const item = { _rowIndex: i + 1 };
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j];
      if (h) {
        const val = r[j];
        item[h] = val;
        // Standardized camelCase aliases for developer convenience
        const nh = normHeader(h);
        if (nh === 'userid' || nh === 'idno') item.idNo = val;
        if (nh === 'fullname' || nh === 'name') item.name = val;
        if (nh === 'passwordhash') item.passwordHash = val;
        if (nh === 'role') item.role = val;
        if (nh === 'status') item.status = val;
        if (nh === 'phone') item.phone = val;
        if (nh === 'submissionid') item.submissionId = val;
        if (nh === 'recordid' || nh === 'id') item.id = val;
        if (nh === 'category') item.category = val;
        if (nh === 'consumername') item.consumerName = val;
        if (nh === 'consumerid') item.consumerId = val;
        if (nh === 'workername') item.workerName = val;
        if (nh === 'workerid') item.workerId = val;
        if (nh === 'meterno') item.meterNo = val;
        if (nh === 'date') item.date = val;
        if (nh === 'createdat') item.createdAt = val;
        if (nh === 'updatedat') item.updatedAt = val;
        if (nh === 'photourl' || nh === 'photoevidence') item.photoUrl = val;
        if (nh === 'locationgps' || nh === 'gpslocation') item.locationGps = val;
        if (nh === 'notes') item.notes = val;
        if (val !== '' && val !== null && val !== undefined) hasData = true;
      }
    }
    if (hasData) rows.push(item);
  }
  return rows;
}

// Field value extractor matching headers accurately
function extractFieldValue(dataObj, headerName) {
  if (!dataObj || typeof dataObj !== 'object') return '';
  // 1. Direct exact match
  if (dataObj[headerName] !== undefined && dataObj[headerName] !== null) return dataObj[headerName];

  // 2. Normalized match across keys
  const targetNorm = normHeader(headerName);
  const keys = Object.keys(dataObj);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (normHeader(k) === targetNorm) {
      if (dataObj[k] !== undefined && dataObj[k] !== null) return dataObj[k];
    }
  }

  // 3. Known Field Aliases
  if (targetNorm === 'submissionid') return dataObj.submissionId || dataObj.SubmissionID || '';
  if (targetNorm === 'recordid' || targetNorm === 'id') return dataObj.id || dataObj.ID || '';
  if (targetNorm === 'userid' || targetNorm === 'idno') return dataObj.idNo || dataObj.userId || dataObj.workerId || '';
  if (targetNorm === 'fullname' || targetNorm === 'name') return dataObj.name || dataObj.fullName || dataObj.workerName || '';
  if (targetNorm === 'role') return dataObj.role || 'worker';
  if (targetNorm === 'status') return dataObj.status || 'Completed';
  if (targetNorm === 'date') return dataObj.date || now();
  if (targetNorm === 'createdat') return dataObj.createdAt || dataObj.date || now();
  if (targetNorm === 'updatedat') return dataObj.updatedAt || now();
  if (targetNorm === 'workerid') return dataObj.workerId || dataObj.idNo || '';
  if (targetNorm === 'workername') return dataObj.workerName || dataObj.name || '';
  if (targetNorm === 'submittedby') return dataObj.submittedBy || dataObj.workerName || '';
  if (targetNorm === 'workerphone') return dataObj.workerPhone || dataObj.phone || '';
  if (targetNorm === 'consumerid') return dataObj.consumerId || dataObj.consumerNo || '';
  if (targetNorm === 'consumername') return dataObj.consumerName || dataObj.customerName || '';
  if (targetNorm === 'fathername') return dataObj.fatherName || '';
  if (targetNorm === 'mobileno' || targetNorm === 'phone') return dataObj.mobile || dataObj.phone || '';
  if (targetNorm === 'address') return dataObj.address || '';
  if (targetNorm === 'meterno') return dataObj.meterNo || '';
  if (targetNorm === 'initialreading') return dataObj.initialReading || '';
  if (targetNorm === 'metersealno') return dataObj.sealNo || dataObj.newMeterSealNo || '';
  if (targetNorm === 'appliedload') return dataObj.appliedLoad || '';
  if (targetNorm === 'supplyphase') return dataObj.phase || '';
  if (targetNorm === 'tariffcategory') return dataObj.tariffCategory || '';
  if (targetNorm === 'servicecablelength') return dataObj.serviceCableLength || '';
  if (targetNorm === 'poleno') return dataObj.poleNo || '';
  if (targetNorm === 'earthresistance') return dataObj.earthResistance || '';
  if (targetNorm === 'workorderno') return dataObj.workOrderNo || '';
  if (targetNorm === 'workorderdate') return dataObj.workOrderDate || '';
  if (targetNorm === 'arrearamount') return dataObj.arrearAmount || '';
  if (targetNorm === 'reason') return dataObj.reason || dataObj.replacementReason || '';
  if (targetNorm === 'finalreading') return dataObj.finalReading || '';
  if (targetNorm === 'disconnectiontype') return dataObj.disconnectionType || '';
  if (targetNorm === 'cutoutsealed') return dataObj.cutoutSealed !== undefined ? dataObj.cutoutSealed : '';
  if (targetNorm === 'issuetype') return dataObj.issueType || '';
  if (targetNorm === 'priority') return dataObj.priority || '';
  if (targetNorm === 'actiontaken') return dataObj.actionTaken || '';
  if (targetNorm === 'materialused') return dataObj.materialUsed || '';
  if (targetNorm === 'poletype') return dataObj.poleType || '';
  if (targetNorm === 'linevoltage') return dataObj.lineVoltage || '';
  if (targetNorm === 'conductortype') return dataObj.conductorType || '';
  if (targetNorm === 'oldmeterno') return dataObj.oldMeterNo || '';
  if (targetNorm === 'newmeterno') return dataObj.newMeterNo || '';
  if (targetNorm === 'newmetersealno') return dataObj.newMeterSealNo || '';
  if (targetNorm === 'oldmetersealno') return dataObj.oldMeterSealNo || '';
  if (targetNorm === 'metertype') return dataObj.meterType || '';
  if (targetNorm === 'dtrname') return dataObj.dtrName || '';
  if (targetNorm === 'existingcapacity') return dataObj.existingCapacity || '';
  if (targetNorm === 'newcapacity') return dataObj.newCapacity || '';
  if (targetNorm === 'olddtrserial') return dataObj.oldDtrSerial || '';
  if (targetNorm === 'newdtrserial') return dataObj.newDtrSerial || '';
  if (targetNorm === 'failurereason') return dataObj.failureReason || '';
  if (targetNorm === 'oillevelchecked') return dataObj.oilLevelChecked !== undefined ? dataObj.oilLevelChecked : '';
  if (targetNorm === 'photoevidence' || targetNorm === 'photourl') return dataObj.photoUrl || dataObj.directImageUrl || '';
  if (targetNorm === 'photobefore') return dataObj.photoBeforeUrl || '';
  if (targetNorm === 'photoafter') return dataObj.photoAfterUrl || '';
  if (targetNorm === 'gpslocation' || targetNorm === 'locationgps') return dataObj.locationGps || '';
  if (targetNorm === 'notes') return dataObj.notes || '';

  return '';
}

// Dynamic Row Appender respecting existing sheet headers
function appendSheetRecord(sheetName, recordObj) {
  const s = getSheet(sheetName);
  const lastCol = s.getLastColumn();
  let headers = [];
  if (lastCol > 0) {
    headers = s.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  } else {
    headers = getHeadersForSheet(sheetName);
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.setFrozenRows(1);
  }

  const rowVals = headers.map(h => extractFieldValue(recordObj, h));
  s.appendRow(rowVals);
  return recordObj;
}

// ============================================================================
// USER AUTHENTICATION & MANAGEMENT
// ============================================================================

function authenticateUser(idNo, password) {
  if (!idNo || !password) {
    throw Error('User ID and Password are required');
  }

  const cleanId = String(idNo).trim().toLowerCase();
  const cleanPass = String(password).trim();
  const passHash = hashPassword(cleanPass);

  const users = getSheetRows('Users');
  let matchedUser = null;
  let matchedIndex = -1;

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const uId = String(u['User ID'] || u.idNo || '').trim().toLowerCase();
    const uPhone = String(u['Phone'] || u.phone || '').replace(/\D/g, '');
    if (uId === cleanId || (cleanId.length >= 10 && uPhone === cleanId)) {
      matchedUser = u;
      matchedIndex = u._rowIndex;
      break;
    }
  }

  if (!matchedUser) {
    throw Error('Invalid User ID or Password.');
  }

  const status = String(matchedUser['Status'] || matchedUser.status || 'active').toLowerCase();
  if (status === 'hold') {
    throw Error('Your account is on hold. Contact administrator.');
  }

  // Password Verification: Support stored Hash AND Legacy Plain-Text with auto-migration
  const storedHash = String(matchedUser['Password Hash'] || matchedUser.passwordHash || '').trim();
  const storedPlain = String(matchedUser['Password'] || matchedUser.password || '').trim();

  let isMatch = false;
  let needsMigration = false;

  if (storedHash) {
    if (storedHash.toLowerCase() === passHash.toLowerCase()) {
      isMatch = true;
    } else if (storedHash === cleanPass) {
      // Stored in hash column as plain text -> migrate to SHA-256
      isMatch = true;
      needsMigration = true;
    }
  }

  if (!isMatch && storedPlain) {
    if (storedPlain === cleanPass || hashPassword(storedPlain).toLowerCase() === passHash.toLowerCase()) {
      isMatch = true;
      needsMigration = true;
    }
  }

  if (!isMatch) {
    throw Error('Invalid User ID or Password.');
  }

  // Auto-migrate plaintext to SHA-256 hash in Users sheet
  if (needsMigration && matchedIndex > 1) {
    try {
      const s = getSheet('Users');
      const headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(h => normHeader(h));
      const hashCol = headers.indexOf('passwordhash');
      if (hashCol >= 0) {
        s.getRange(matchedIndex, hashCol + 1).setValue(passHash);
      }
      const plainCol = headers.indexOf('password');
      if (plainCol >= 0) {
        s.getRange(matchedIndex, plainCol + 1).setValue(''); // Clear plain text
      }
    } catch (migErr) {
      Logger.log('Password migration notice: ' + migErr);
    }
  }

  // Update Last Login timestamp
  try {
    const s = getSheet('Users');
    const headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(h => normHeader(h));
    const loginCol = headers.indexOf('lastlogin');
    if (loginCol >= 0 && matchedIndex > 1) {
      s.getRange(matchedIndex, loginCol + 1).setValue(now());
    }
  } catch (e) {}

  const finalId = String(matchedUser['User ID'] || matchedUser.idNo);
  const session = {
    id: 'usr_' + finalId,
    idNo: finalId,
    name: String(matchedUser['Full Name'] || matchedUser.name || 'User'),
    phone: String(matchedUser['Phone'] || matchedUser.phone || ''),
    role: String(matchedUser['Role'] || matchedUser.role || 'worker'),
    status: status,
    designation: String(matchedUser['Designation'] || matchedUser.designation || ''),
    badgeNo: String(matchedUser['Badge No'] || matchedUser.badgeNo || ''),
    token: 'SES-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
    loggedInAt: now()
  };

  logSystemActivity(session.id, session.idNo, session.name, session.role, 'LOGIN', 'Successful user login');
  return session;
}

function getUsersList() {
  const raw = getSheetRows('Users');
  return raw.map(u => ({
    id: 'usr_' + String(u['User ID'] || u.idNo || ''),
    idNo: String(u['User ID'] || u.idNo || ''),
    userId: String(u['User ID'] || u.idNo || ''),
    password: String(u['Password'] || u.password || (u['Password Hash'] ? '' : '')),
    name: String(u['Full Name'] || u.name || ''),
    phone: String(u['Phone'] || u.phone || ''),
    role: String(u['Role'] || u.role || 'worker'),
    status: String(u['Status'] || u.status || 'active'),
    designation: String(u['Designation'] || u.designation || ''),
    badgeNo: String(u['Badge No'] || u.badgeNo || ''),
    createdAt: String(u['Created At'] || u.createdAt || ''),
    updatedAt: String(u['Updated At'] || u.updatedAt || ''),
    lastLogin: String(u['Last Login'] || u.lastLogin || '')
  }));
}

function createUserAccount(userData) {
  const idNo = String(userData.idNo || userData['User ID'] || '').trim();
  const password = String(userData.password || '').trim();
  const name = String(userData.name || userData['Full Name'] || '').trim();
  const role = String(userData.role || 'worker').trim();

  if (!idNo) throw Error('User ID is required');
  if (!password) throw Error('Password is required');

  const existingUsers = getSheetRows('Users');
  const duplicate = existingUsers.some(u => String(u['User ID'] || u.idNo || '').trim().toLowerCase() === idNo.toLowerCase());
  if (duplicate) throw Error('User ID already exists: ' + idNo);

  const newRec = {
    'User ID': idNo,
    'Role': role,
    'Full Name': name || ('Worker ' + idNo),
    'Phone': String(userData.phone || ''),
    'Password Hash': hashPassword(password),
    'Status': userData.status || 'active',
    'Designation': userData.designation || (role === 'admin' ? 'Administrator' : 'Field Worker'),
    'Badge No': userData.badgeNo || idNo,
    'Security Question': userData.securityQuestion || '',
    'Security Answer Hash': userData.securityAnswer ? hashPassword(userData.securityAnswer) : '',
    'Created At': now(),
    'Updated At': now(),
    'Last Login': '',
    'Created By': userData.createdBy || 'admin'
  };

  appendSheetRecord('Users', newRec);
  try { CacheService.getScriptCache().remove('users_cache'); } catch (e) {}

  logSystemActivity(newRec['User ID'], newRec['User ID'], newRec['Full Name'], newRec['Role'], 'CREATE_USER', 'Created user account: ' + idNo);

  return {
    id: 'usr_' + idNo,
    idNo: idNo,
    name: newRec['Full Name'],
    phone: newRec['Phone'],
    role: newRec['Role'],
    status: newRec['Status'],
    designation: newRec['Designation'],
    badgeNo: newRec['Badge No'],
    createdAt: newRec['Created At']
  };
}

function updateUserAccount(targetId, updates) {
  const cleanId = String(targetId || '').trim().toLowerCase();
  const s = getSheet('Users');
  const rows = getSheetRows('Users');
  const matched = rows.find(u => 
    String(u['User ID'] || u.idNo || '').trim().toLowerCase() === cleanId ||
    String(u.id || '').trim().toLowerCase() === cleanId
  );

  if (!matched) throw Error('User not found in Google Sheets: ' + targetId);

  const rowIndex = matched._rowIndex;
  const headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(h => normHeader(h));

  if (updates.status !== undefined) {
    const col = headers.indexOf('status');
    if (col >= 0) s.getRange(rowIndex, col + 1).setValue(updates.status);
  }
  if (updates.name !== undefined || updates['Full Name'] !== undefined) {
    const col = headers.indexOf('fullname');
    if (col >= 0) s.getRange(rowIndex, col + 1).setValue(updates.name || updates['Full Name']);
  }
  if (updates.phone !== undefined) {
    const col = headers.indexOf('phone');
    if (col >= 0) s.getRange(rowIndex, col + 1).setValue(updates.phone);
  }
  if (updates.designation !== undefined) {
    const col = headers.indexOf('designation');
    if (col >= 0) s.getRange(rowIndex, col + 1).setValue(updates.designation);
  }
  if (updates.badgeNo !== undefined) {
    const col = headers.indexOf('badgeno');
    if (col >= 0) s.getRange(rowIndex, col + 1).setValue(updates.badgeNo);
  }
  if (updates.role !== undefined) {
    const col = headers.indexOf('role');
    if (col >= 0) s.getRange(rowIndex, col + 1).setValue(updates.role);
  }
  if (updates.password) {
    const col = headers.indexOf('passwordhash');
    if (col >= 0) s.getRange(rowIndex, col + 1).setValue(hashPassword(updates.password));
  }

  const updatedCol = headers.indexOf('updatedat');
  if (updatedCol >= 0) s.getRange(rowIndex, updatedCol + 1).setValue(now());

  try { CacheService.getScriptCache().remove('users_cache'); } catch (e) {}
  logSystemActivity(cleanId, cleanId, updates.name || '', updates.role || '', 'UPDATE_USER', 'Updated user: ' + cleanId);

  return { success: true, message: 'User updated successfully' };
}

function deleteUserAccount(targetId) {
  const cleanId = String(targetId || '').trim().toLowerCase();
  if (cleanId === '8695716192' || cleanId === 'admin') {
    throw Error('Primary Admin account cannot be deleted');
  }

  const s = getSheet('Users');
  const rows = getSheetRows('Users');
  const matched = rows.find(u => 
    String(u['User ID'] || u.idNo || '').trim().toLowerCase() === cleanId ||
    String(u.id || '').trim().toLowerCase() === cleanId
  );

  if (!matched) throw Error('User not found: ' + targetId);

  s.deleteRow(matched._rowIndex);
  try { CacheService.getScriptCache().remove('users_cache'); } catch (e) {}
  logSystemActivity(cleanId, cleanId, '', '', 'DELETE_USER', 'Deleted user: ' + cleanId);

  return { success: true, message: 'User deleted from Google Sheets' };
}

// ============================================================================
// WORKER SUBMISSION & STRICT IDEMPOTENCY
// ============================================================================

function submitRecord(recordData) {
  const lock = LockService.getScriptLock();
  // Try up to 20 seconds for atomic lock
  const hasLock = lock.tryLock(20000);
  if (!hasLock) {
    throw Error('Server is busy processing another transaction. Please retry in a few seconds.');
  }

  try {
    if (!recordData || typeof recordData !== 'object') {
      throw Error('Record payload object is required');
    }

    const rawCategory = recordData.category || recordData.Category;
    if (!rawCategory) {
      throw Error('Category is required. E.g. NSC, Disconnection, Broken, Meter Replacement, DTR Replacement');
    }

    const canonicalCat = normalizeCategory(rawCategory);
    const destSheetName = canonicalCat; // Exactly matching dedicated sheet!
    const s = getSheet(destSheetName);

    // Guaranteed Unique Submission ID
    const submissionId = String(recordData.submissionId || recordData.SubmissionID || '').trim();
    const finalSubmissionId = submissionId || ('SUB-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9).toUpperCase());
    const finalId = String(recordData.id || '').trim() || ('PWR-' + Date.now().toString().slice(-6));

    // IDEMPOTENCY CHECK: Verify if this Submission ID already exists in target sheet
    if (finalSubmissionId) {
      const existingRows = getSheetRows(destSheetName);
      const match = existingRows.find(r => {
        const sub = String(r['Submission ID'] || r.submissionId || '').trim();
        return sub && sub === finalSubmissionId;
      });

      if (match) {
        return {
          duplicate: true,
          message: 'Record already saved with this Submission ID in ' + destSheetName,
          sheet: destSheetName,
          category: canonicalCat,
          recordId: match['Record ID'] || match.id || finalId,
          submissionId: finalSubmissionId,
          entry: match
        };
      }
    }

    // Construct clean verified record object
    const verifiedRecord = Object.assign({}, recordData, {
      submissionId: finalSubmissionId,
      id: finalId,
      category: canonicalCat,
      status: recordData.status || 'Completed',
      date: recordData.date || now(),
      createdAt: recordData.createdAt || recordData.date || now(),
      updatedAt: now()
    });

    // Save ONLY to matching Google Sheet!
    appendSheetRecord(destSheetName, verifiedRecord);

    // Invalidate stats cache
    try { CacheService.getScriptCache().remove('dashboard_stats'); } catch (e) {}

    logSystemActivity(
      verifiedRecord.workerId || '',
      verifiedRecord.workerId || '',
      verifiedRecord.workerName || '',
      verifiedRecord.role || 'worker',
      'SUBMIT_RECORD',
      'Submitted ' + canonicalCat + ' (ID: ' + finalId + ', SubID: ' + finalSubmissionId + ')'
    );

    return {
      duplicate: false,
      message: 'Record saved successfully in ' + destSheetName,
      sheet: destSheetName,
      category: canonicalCat,
      recordId: finalId,
      submissionId: finalSubmissionId,
      entry: verifiedRecord
    };
  } finally {
    lock.releaseLock();
  }
}

// Query Entries across dedicated sheets
function queryRecords(filters) {
  filters = filters || {};
  const catFilter = filters.category ? normalizeCategory(filters.category) : null;
  const targetSheets = catFilter && catFilter !== 'ALL' 
    ? [catFilter] 
    : ['NSC', 'Disconnection', 'Broken', 'Meter Replacement', 'DTR Replacement', 'Call Case'];

  const allRecords = [];

  targetSheets.forEach(sheetName => {
    try {
      const rows = getSheetRows(sheetName);
      rows.forEach(r => {
        // Normalize entry to standard frontend shape
        const item = {
          id: String(r['Record ID'] || r.id || ('PWR-' + Math.random().toString(36).substring(2, 7))),
          submissionId: String(r['Submission ID'] || r.submissionId || ''),
          category: String(r['Category'] || r.category || sheetName),
          status: String(r['Status'] || r.status || 'Completed'),
          date: String(r['Date'] || r.date || r['Created At'] || now()),
          createdAt: String(r['Created At'] || r.createdAt || now()),
          updatedAt: String(r['Updated At'] || r.updatedAt || ''),
          workerId: String(r['Worker ID'] || r.workerId || ''),
          workerName: String(r['Worker Name'] || r.workerName || 'Worker'),
          role: String(r['Role'] || r.role || 'worker'),
          submittedBy: String(r['Submitted By'] || r.submittedBy || r.workerName || ''),
          workerPhone: String(r['Worker Phone'] || r.workerPhone || ''),
          substation: String(r['Substation'] || r.substation || ''),
          feederName: String(r['Feeder Name'] || r.feederName || ''),
          consumerId: String(r['Consumer ID'] || r.consumerId || ''),
          consumerName: String(r['Consumer Name'] || r.consumerName || ''),
          fatherName: String(r['Father Name'] || r.fatherName || ''),
          mobile: String(r['Mobile No'] || r.mobile || ''),
          address: String(r['Address'] || r.address || ''),
          meterNo: String(r['Meter No'] || r.meterNo || ''),
          initialReading: String(r['Initial Reading'] || r.initialReading || ''),
          sealNo: String(r['Meter Seal No'] || r.sealNo || ''),
          appliedLoad: String(r['Applied Load'] || r.appliedLoad || ''),
          phase: String(r['Supply Phase'] || r.phase || ''),
          tariffCategory: String(r['Tariff Category'] || r.tariffCategory || ''),
          serviceCableLength: String(r['Service Cable Length'] || r.serviceCableLength || ''),
          poleNo: String(r['Pole No'] || r.poleNo || ''),
          earthResistance: String(r['Earth Resistance'] || r.earthResistance || ''),
          workOrderNo: String(r['Work Order No'] || r.workOrderNo || ''),
          workOrderDate: String(r['Work Order Date'] || r.workOrderDate || ''),
          workOrderNoticeId: String(r['Work Order Notice ID'] || r.workOrderNoticeId || ''),
          workOrderNoticeTitle: String(r['Work Order Notice Title'] || r.workOrderNoticeTitle || ''),
          arrearAmount: String(r['Arrear Amount'] || r.arrearAmount || ''),
          reason: String(r['Reason'] || r.reason || ''),
          finalReading: String(r['Final Reading'] || r.finalReading || ''),
          disconnectionType: String(r['Disconnection Type'] || r.disconnectionType || ''),
          issueType: String(r['Issue Type'] || r.issueType || ''),
          priority: String(r['Priority'] || r.priority || ''),
          actionTaken: String(r['Action Taken'] || r.actionTaken || ''),
          materialUsed: String(r['Material Used'] || r.materialUsed || ''),
          oldMeterNo: String(r['Old Meter No'] || r.oldMeterNo || ''),
          replacementReason: String(r['Replacement Reason'] || r.replacementReason || ''),
          newMeterNo: String(r['New Meter No'] || r.newMeterNo || ''),
          newMeterSealNo: String(r['New Meter Seal No'] || r.newMeterSealNo || ''),
          dtrName: String(r['DTR Name'] || r.dtrName || ''),
          existingCapacity: String(r['Existing Capacity'] || r.existingCapacity || ''),
          newCapacity: String(r['New Capacity'] || r.newCapacity || ''),
          locationGps: String(r['GPS Location'] || r.locationGps || ''),
          photoUrl: String(r['Photo Evidence'] || r.photoUrl || ''),
          photoBeforeUrl: String(r['Photo Before'] || r.photoBeforeUrl || ''),
          photoAfterUrl: String(r['Photo After'] || r.photoAfterUrl || ''),
          notes: String(r['Notes'] || r.notes || '')
        };
        allRecords.push(item);
      });
    } catch (e) {
      Logger.log('Notice reading sheet ' + sheetName + ': ' + e);
    }
  });

  // Apply filters
  let filtered = allRecords;
  if (filters.status && filters.status !== 'ALL') {
    filtered = filtered.filter(x => x.status === filters.status);
  }
  if (filters.workerId) {
    const wid = String(filters.workerId).trim().toLowerCase();
    filtered = filtered.filter(x => String(x.workerId).trim().toLowerCase() === wid);
  }
  if (filters.search) {
    const q = String(filters.search).trim().toLowerCase();
    filtered = filtered.filter(x => JSON.stringify(x).toLowerCase().includes(q));
  }

  // Sort descending by date
  filtered.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  return filtered;
}

// Compute Dashboard Stats
function computeDashboardStats() {
  const records = queryRecords();
  const stats = {
    total: records.length,
    categories: {
      NSC: 0,
      DISCONNECTION: 0,
      POLE_CASE: 0,
      METER_REPLESMENT: 0,
      DTR_REPLESMENT: 0
    },
    status: {
      pending: 0,
      completed: 0,
      approved: 0
    }
  };

  records.forEach(r => {
    const cat = normalizeCategory(r.category);
    if (cat === 'NSC') stats.categories.NSC++;
    else if (cat === 'Disconnection') stats.categories.DISCONNECTION++;
    else if (cat === 'Broken') stats.categories.POLE_CASE++;
    else if (cat === 'Meter Replacement') stats.categories.METER_REPLESMENT++;
    else if (cat === 'DTR Replacement') stats.categories.DTR_REPLESMENT++;

    const st = String(r.status || '').toLowerCase();
    if (st === 'pending') stats.status.pending++;
    else if (st === 'approved') stats.status.approved++;
    else stats.status.completed++;
  });

  return stats;
}

// ============================================================================
// WORK ORDERS & GOOGLE DRIVE INTEGRATION
// ============================================================================

function getOrCreateWorkOrdersDriveFolder() {
  const folders = DriveApp.getFoldersByName(WORK_ORDERS_FOLDER_NAME);
  if (folders.hasNext()) {
    const folder = folders.next();
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return folder;
  }
  const newFolder = DriveApp.createFolder(WORK_ORDERS_FOLDER_NAME);
  newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return newFolder;
}

function uploadWorkOrder(data) {
  const title = String(data.title || 'Work Order Notice').trim();
  const category = normalizeCategory(data.category || 'NSC');
  let photoUrl = String(data.photoUrl || '').trim();
  let fileId = '';
  let driveViewUrl = '';
  let directImageUrl = '';

  // If base64 photo data provided, upload to Google Drive!
  if (photoUrl && photoUrl.startsWith('data:')) {
    try {
      const parts = photoUrl.split(';base64,');
      const contentType = parts[0].replace('data:', '') || 'image/jpeg';
      const base64Data = parts[1];
      const decodedBytes = Utilities.base64Decode(base64Data);
      const ext = contentType.includes('png') ? '.png' : (contentType.includes('pdf') ? '.pdf' : '.jpg');
      const fileName = 'WO_' + Date.now() + ext;
      const blob = Utilities.newBlob(decodedBytes, contentType, fileName);

      const folder = getOrCreateWorkOrdersDriveFolder();
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      fileId = file.getId();
      driveViewUrl = 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing';
      directImageUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
      photoUrl = directImageUrl;
    } catch (driveErr) {
      Logger.log('Drive upload notice: ' + driveErr);
    }
  }

  const workOrder = {
    id: data.id || generateId('WO'),
    category: category,
    title: title,
    photoUrl: photoUrl || directImageUrl,
    fileId: fileId,
    fileName: data.fileName || ('Notice_' + Date.now()),
    fileType: data.fileType || 'image/jpeg',
    fileSize: data.fileSize || 0,
    driveViewUrl: driveViewUrl,
    driveDownloadUrl: fileId ? ('https://drive.google.com/uc?export=download&id=' + fileId) : '',
    directImageUrl: directImageUrl || photoUrl,
    description: data.description || '',
    uploadedBy: data.uploadedBy || 'admin',
    adminName: data.adminName || 'Admin Controller',
    adminPhone: data.adminPhone || '8695716192',
    uploadDate: data.uploadDate || new Date().toISOString().split('T')[0],
    uploadTime: data.uploadTime || new Date().toLocaleTimeString(),
    createdAt: now(),
    isHidden: Boolean(data.isHidden)
  };

  appendSheetRecord('Work Orders', workOrder);
  logSystemActivity(data.uploadedBy || 'admin', 'admin', data.adminName || 'Admin', 'admin', 'UPLOAD_WORK_ORDER', 'Uploaded WO: ' + title);

  return workOrder;
}

function getWorkOrdersList(category) {
  const rows = getSheetRows('Work Orders');
  let list = rows.map(r => ({
    id: String(r.id || ''),
    category: String(r.category || 'NSC'),
    title: String(r.title || ''),
    photoUrl: String(r.photoUrl || r.directImageUrl || ''),
    fileId: String(r.fileId || ''),
    fileName: String(r.fileName || ''),
    fileType: String(r.fileType || ''),
    fileSize: r.fileSize || 0,
    driveViewUrl: String(r.driveViewUrl || ''),
    driveDownloadUrl: String(r.driveDownloadUrl || ''),
    directImageUrl: String(r.directImageUrl || r.photoUrl || ''),
    description: String(r.description || ''),
    uploadedBy: String(r.uploadedBy || ''),
    adminName: String(r.adminName || ''),
    adminPhone: String(r.adminPhone || ''),
    uploadDate: String(r.uploadDate || ''),
    uploadTime: String(r.uploadTime || ''),
    createdAt: String(r.createdAt || ''),
    isHidden: Boolean(r.isHidden === true || r.isHidden === 'TRUE' || r.isHidden === 'true')
  }));

  if (category && category !== 'ALL') {
    const norm = normalizeCategory(category);
    list = list.filter(o => o.category === norm || o.category === 'ALL');
  }

  return list.reverse();
}

function deleteWorkOrder(id) {
  const s = getSheet('Work Orders');
  const rows = getSheetRows('Work Orders');
  const matched = rows.find(r => String(r.id) === String(id));
  if (!matched) throw Error('Work order not found: ' + id);

  s.deleteRow(matched._rowIndex);
  logSystemActivity('admin', 'admin', 'Admin', 'admin', 'DELETE_WORK_ORDER', 'Deleted WO: ' + id);
  return { success: true, message: 'Work order deleted' };
}

// ============================================================================
// MAIN HTTP DISPATCHERS: doGet & doPost
// ============================================================================

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = String(p.action || 'health').trim();

    // 1. Health Check
    if (action === 'health' || action === 'healthCheck') {
      return out({
        status: 'ok',
        spreadsheet: 'connected',
        spreadsheetId: SPREADSHEET_ID,
        app: 'WBSEDCL POWER Management',
        timestamp: now()
      }, 'Health check successful');
    }

    // 2. Database Initialization
    if (action === 'setup' || action === 'init' || action === 'database' || action === 'initializeDatabase') {
      return out(initializeDatabase(), 'Database initialized successfully');
    }

    // 3. User Operations
    if (action === 'users' || action === 'getUsers') {
      return out({ users: getUsersList() }, 'Users retrieved successfully');
    }

    // 4. Record Queries
    if (action === 'entries' || action === 'getRecords' || action === 'getMasterData') {
      return out({ entries: queryRecords(p) }, 'Records retrieved successfully');
    }

    // 5. Dashboard Stats
    if (action === 'stats' || action === 'getDashboard' || action === 'getDashboardStats') {
      return out({ stats: computeDashboardStats() }, 'Stats computed successfully');
    }

    // 6. Work Orders
    if (action === 'workorders' || action === 'getWorkOrders') {
      return out({ workOrders: getWorkOrdersList(p.category) }, 'Work orders retrieved successfully');
    }

    // 7. Refresh Combined Endpoint
    if (action === 'refresh') {
      return out({
        users: getUsersList(),
        entries: queryRecords(p),
        stats: computeDashboardStats(),
        workOrders: getWorkOrdersList()
      }, 'Refreshed from Google Sheets');
    }

    // 8. User Activity Logs
    if (action === 'logs' || action === 'getSystemLogs' || action === 'userActivity') {
      return out({ logs: getSheetRows('System Logs').reverse() }, 'System logs retrieved');
    }

    // Fallback: Unknown action
    return errOut('UNKNOWN_GET_ACTION', 'Unrecognized GET action: ' + action);
  } catch (err) {
    return errOut('GET_ERROR', String(err.message || err));
  }
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '{}';
    let body = {};
    try {
      body = JSON.parse(raw);
    } catch (parseErr) {
      throw Error('Invalid JSON in request body: ' + parseErr.message);
    }

    const action = String(body.action || '').trim();
    const data = (body.data && typeof body.data === 'object' && Object.keys(body.data).length > 0)
      ? body.data
      : body;
    const reqId = body.requestId || ('REQ-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase());

    if (!action) {
      return errOut('MISSING_ACTION', 'Action field is required in request payload', reqId);
    }

    // Health
    if (action === 'health' || action === 'healthCheck') {
      return out({ status: 'ok', spreadsheetId: SPREADSHEET_ID }, 'OK', reqId);
    }

    // Initialize Database
    if (action === 'setup' || action === 'init' || action === 'initializeDatabase') {
      return out(initializeDatabase(), 'Database initialized', reqId);
    }

    // Authentication
    if (action === 'login' || action === 'authenticateUser') {
      const idNo = body.idNo || body.loginId || data.idNo || data.loginId;
      const password = body.password || data.password;
      const session = authenticateUser(idNo, password);
      return out({ session: session }, 'Login successful', reqId);
    }

    // User Management
    if (action === 'getUsers' || action === 'users') {
      return out({ users: getUsersList() }, 'Users retrieved', reqId);
    }
    if (action === 'createUser') {
      const user = createUserAccount(data);
      return out({ user: user }, 'User created successfully', reqId);
    }
    if (action === 'updateUser') {
      const targetId = body.id || body.idNo || data.id || data.idNo;
      const res = updateUserAccount(targetId, data);
      return out(res, 'User updated', reqId);
    }
    if (action === 'holdUser' || action === 'updateUserStatus') {
      const targetId = body.id || body.idNo || data.id || data.idNo;
      const status = body.status || data.status || 'hold';
      const res = updateUserAccount(targetId, { status: status });
      return out(res, 'User status updated to ' + status, reqId);
    }
    if (action === 'activateUser') {
      const targetId = body.id || body.idNo || data.id || data.idNo;
      const res = updateUserAccount(targetId, { status: 'active' });
      return out(res, 'User activated', reqId);
    }
    if (action === 'changePassword') {
      const targetId = body.id || body.idNo || data.id || data.idNo;
      const newPass = body.newPassword || data.newPassword || body.password || data.password;
      const res = updateUserAccount(targetId, { password: newPass });
      return out(res, 'Password changed successfully', reqId);
    }
    if (action === 'deleteUser') {
      const targetId = body.id || body.idNo || data.id || data.idNo;
      const res = deleteUserAccount(targetId);
      return out(res, 'User deleted', reqId);
    }

    // Record Submission & Management
    if (
      action === 'submitRecord' ||
      action === 'createEntry' ||
      action === 'saveEntry' ||
      action === 'createNSC' ||
      action === 'createNewConnection' ||
      action === 'createDisconnection' ||
      action === 'createPoleCase' ||
      action === 'createMeterReplacement' ||
      action === 'createDTRReplacement'
    ) {
      if (action === 'createNSC' || action === 'createNewConnection') data.category = 'NSC';
      if (action === 'createDisconnection') data.category = 'Disconnection';
      if (action === 'createPoleCase') data.category = 'Broken';
      if (action === 'createMeterReplacement') data.category = 'Meter Replacement';
      if (action === 'createDTRReplacement') data.category = 'DTR Replacement';
      const res = submitRecord(data);
      return out(res, res.message, reqId);
    }

    if (action === 'getRecords' || action === 'entries' || action === 'getMasterData') {
      return out({ entries: queryRecords(body) }, 'Records retrieved', reqId);
    }

    if (action === 'getDashboard' || action === 'stats') {
      return out({ stats: computeDashboardStats() }, 'Stats computed', reqId);
    }

    if (action === 'refresh') {
      return out({
        users: getUsersList(),
        entries: queryRecords(body),
        stats: computeDashboardStats(),
        workOrders: getWorkOrdersList()
      }, 'Refreshed from Google Sheets', reqId);
    }

    // Work Orders
    if (action === 'uploadWorkOrder' || action === 'createWorkOrder') {
      const wo = uploadWorkOrder(data);
      return out({ workOrder: wo }, 'Work order uploaded successfully', reqId);
    }
    if (action === 'getWorkOrders' || action === 'workorders') {
      return out({ workOrders: getWorkOrdersList(body.category) }, 'Work orders retrieved', reqId);
    }
    if (action === 'deleteWorkOrder') {
      const res = deleteWorkOrder(body.id || data.id);
      return out(res, 'Work order deleted', reqId);
    }

    // Live Chat
    if (action === 'getChat' || action === 'chat') {
      return out({ messages: getSheetRows('Chat') }, 'Chat messages retrieved', reqId);
    }
    if (action === 'sendChat') {
      const msg = {
        id: generateId('MSG'),
        workerId: data.workerId || data.senderId || '',
        senderId: data.senderId || 'user',
        senderName: data.senderName || 'User',
        senderRole: data.senderRole || 'worker',
        recipientId: data.recipientId || 'all',
        recipientRole: data.recipientRole || 'admin',
        message: String(data.message || '').trim(),
        timestamp: now(),
        status: 'sent',
        createdAt: now()
      };
      appendSheetRecord('Chat', msg);
      return out({ message: msg }, 'Message sent', reqId);
    }

    // Activity Log
    if (action === 'logActivity') {
      logSystemActivity(data.userId, data.idNo, data.userName, data.role, data.action, data.details);
      return out({ logged: true }, 'Activity logged', reqId);
    }

    return errOut('UNKNOWN_POST_ACTION', 'Unrecognized POST action: ' + action, reqId);
  } catch (err) {
    return errOut('SERVER_ERROR', String(err.message || err));
  }
}
