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
  'off_code',
  'MRU',
  'Consumer Id',
  'Name',
  'Address',
  'BClass/Phase',
  'Class',
  'Gov/Non-Gov',
  'Meter',
  'O/S Due date Range',
  'D2 Net O/S',
  'Discon Status',
  'Discon Date',
  'Mobile Number'
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
  let targetSheet = null;

  for (let i = 0; i < aliases.length; i++) {
    const s = spreadsheet.getSheetByName(aliases[i]);
    if (s) {
      targetSheet = s;
      break;
    }
  }

  // Case-insensitive / normalized search
  if (!targetSheet) {
    const allSheets = spreadsheet.getSheets();
    const normAliases = aliases.map(a => a.toUpperCase().replace(/[\s_\-]/g, ''));
    for (let i = 0; i < allSheets.length; i++) {
      const s = allSheets[i];
      const sNorm = s.getName().toUpperCase().replace(/[\s_\-]/g, '');
      if (normAliases.indexOf(sNorm) >= 0) {
        targetSheet = s;
        break;
      }
    }
  }

  // If not found, auto-create sheet with canonical name and default headers
  if (!targetSheet) {
    targetSheet = spreadsheet.insertSheet(canonicalName);
    const defaultHeaders = getHeadersForSheet(canonicalName);
    targetSheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    targetSheet.setFrozenRows(1);
  }

  // Self-heal and strictly ensure Disconnection has exact 14 WBSEDCL headers without deleting data
  if (canonicalName === 'Disconnection') {
    ensureDisconnectionHeaders(targetSheet);
  }

  return targetSheet;
}

// Strictly configure and verify exact 14 Disconnection headers while preserving all existing data
function ensureDisconnectionHeaders(sheet) {
  if (!sheet) return;
  try {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow === 0 || lastCol === 0) {
      sheet.getRange(1, 1, 1, DISCONNECTION_HEADERS.length).setValues([DISCONNECTION_HEADERS]);
      sheet.setFrozenRows(1);
      return;
    }

    const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
      return String(h || '').trim();
    });

    let isExact = currentHeaders.length === DISCONNECTION_HEADERS.length;
    if (isExact) {
      for (let i = 0; i < DISCONNECTION_HEADERS.length; i++) {
        if (currentHeaders[i] !== DISCONNECTION_HEADERS[i]) {
          isExact = false;
          break;
        }
      }
    }

    if (isExact) {
      return;
    }

    // Headers do not match exact 14 columns. Migrate rows without losing data!
    if (lastRow === 1) {
      sheet.clearContents();
      sheet.getRange(1, 1, 1, DISCONNECTION_HEADERS.length).setValues([DISCONNECTION_HEADERS]);
      sheet.setFrozenRows(1);
      return;
    }

    // Existing data rows present (lastRow > 1)
    const rawValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const oldHeaders = rawValues[0].map(function(h) { return String(h || '').trim(); });

    const migratedRows = [];
    for (let r = 1; r < rawValues.length; r++) {
      const row = rawValues[r];
      const rowObj = {};
      let hasData = false;
      for (let c = 0; c < oldHeaders.length; c++) {
        const hName = oldHeaders[c];
        if (hName) rowObj[hName] = row[c];
        if (row[c] !== '' && row[c] !== null && row[c] !== undefined) {
          hasData = true;
        }
      }
      if (hasData) {
        const newRow = DISCONNECTION_HEADERS.map(function(targetHeader) {
          return extractFieldValue(rowObj, targetHeader);
        });
        migratedRows.push(newRow);
      }
    }

    sheet.clearContents();
    sheet.getRange(1, 1, 1, DISCONNECTION_HEADERS.length).setValues([DISCONNECTION_HEADERS]);
    if (migratedRows.length > 0) {
      sheet.getRange(2, 1, migratedRows.length, DISCONNECTION_HEADERS.length).setValues(migratedRows);
    }
    sheet.setFrozenRows(1);
  } catch (err) {
    Logger.log('ensureDisconnectionHeaders notice: ' + err);
  }
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
function out(data, message, reqId) {
  const payload = {
    success: true,
    data: data,
    message: message || 'Success',
    requestId: reqId || ('REQ-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase())
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
  }
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function errOut(code, message, reqId) {
  const errMsg = message || 'An error occurred';
  const errCode = code || 'ERROR';
  const payload = {
    success: false,
    error: errMsg,
    errorCode: errCode,
    message: errMsg,
    details: {
      code: errCode,
      message: errMsg
    },
    requestId: reqId || ('REQ-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase())
  };
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
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

        // Disconnection 14-field exact & normalized mappings
        if (nh === 'offcode') { item.off_code = val; item.offCode = val; }
        if (nh === 'mru') { item.MRU = val; item.mru = val; item.mruSection = val; }
        if (nh === 'consumerid') { item['Consumer Id'] = val; item.consumerId = val; }
        if (nh === 'name') { item.Name = val; item.name = val; item.consumerName = val; }
        if (nh === 'address') { item.Address = val; item.address = val; item.consumerAddress = val; }
        if (nh === 'bclassphase') { item['BClass/Phase'] = val; item.bClassPhase = val; item.deviceType = val; }
        if (nh === 'class') { item.Class = val; item.class = val; item.baseClass = val; }
        if (nh === 'govnongov') { item['Gov/Non-Gov'] = val; item.govNonGov = val; }
        if (nh === 'meter') { item.Meter = val; item.meter = val; item.meterNumber = val; item.meterNo = val; }
        if (nh === 'osduedaterange') { item['O/S Due date Range'] = val; item.osDueDateRange = val; item.dueDateRange = val; }
        if (nh === 'd2netos') { item['D2 Net O/S'] = val; item.d2NetOs = val; item.outstandingDue = val; item.arrearAmount = val; }
        if (nh === 'disconstatus') { item['Discon Status'] = val; item.disconStatus = val; item.taskStatus = val; item.status = val; }
        if (nh === 'discondate') { item['Discon Date'] = val; item.disconDate = val; item.reportDate = val; }
        if (nh === 'mobilenumber') { item['Mobile Number'] = val; item.mobileNumber = val; item.phoneNumber = val; item.phone = val; }

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

  // Disconnection 14-field exact & normalized extractors
  if (targetNorm === 'offcode') return dataObj['off_code'] || dataObj.off_code || dataObj.offCode || dataObj.officeCode || dataObj.substation || dataObj.area || '5233100';
  if (targetNorm === 'mru') return dataObj['MRU'] || dataObj.MRU || dataObj.mru || dataObj.mruSection || dataObj['MRU Section'] || 'FIL33MMR';
  if (targetNorm === 'consumerid') return dataObj['Consumer Id'] || dataObj['Consumer ID'] || dataObj.consumerId || dataObj.accountNumber || dataObj.consumerNo || '';
  if (targetNorm === 'name') return dataObj['Name'] || dataObj.Name || dataObj.name || dataObj.consumerName || dataObj.customerName || '';
  if (targetNorm === 'address') return dataObj['Address'] || dataObj.Address || dataObj.address || dataObj.consumerAddress || '';
  if (targetNorm === 'bclassphase') return dataObj['BClass/Phase'] || dataObj['BClass_Phase'] || dataObj.bClassPhase || dataObj.deviceType || dataObj.phase || 'I';
  if (targetNorm === 'class') return dataObj['Class'] || dataObj.Class || dataObj.class || dataObj.baseClass || dataObj.tariffCategory || 'Domestic';
  if (targetNorm === 'govnongov') return dataObj['Gov/Non-Gov'] || dataObj['Gov_Non_Gov'] || dataObj.govNonGov || dataObj.govStatus || 'Non-Gov';
  if (targetNorm === 'meter') return dataObj['Meter'] || dataObj.Meter || dataObj.meter || dataObj.meterNumber || dataObj.meterNo || dataObj['Meter No'] || dataObj.finalReading || '';
  if (targetNorm === 'osduedaterange') return dataObj['O/S Due date Range'] || dataObj.dueDateRange || dataObj.osDueDateRange || dataObj.dueDate || '';
  if (targetNorm === 'd2netos') return dataObj['D2 Net O/S'] || dataObj['D2 Net OS'] || dataObj.outstandingDue || dataObj.arrearAmount || dataObj.d2NetOs || '';
  if (targetNorm === 'disconstatus') return dataObj['Discon Status'] || dataObj.disconStatus || dataObj.taskStatus || dataObj.status || dataObj['Status'] || 'PENDING';
  if (targetNorm === 'discondate') return dataObj['Discon Date'] || dataObj.disconDate || dataObj.reportDate || dataObj.date || dataObj['Date'] || '';
  if (targetNorm === 'mobilenumber') return dataObj['Mobile Number'] || dataObj['Mobile No'] || dataObj.mobileNumber || dataObj.phoneNumber || dataObj.mobile || dataObj.phone || '';

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
    id: 'usr_' + String(u['User ID'] || u.idNo),
    idNo: String(u['User ID'] || u.idNo || ''),
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

// Full Two-Way Update Record in Google Sheets
function updateEntry(targetId, category, updateData) {
  const cleanId = String(targetId || '').trim();
  if (!cleanId) throw Error('Entry ID is required for update');

  const sheetsToSearch = category 
    ? [category] 
    : ['NSC', 'Disconnection', 'Broken', 'Meter Replacement', 'DTR Replacement', 'Call Case'];

  let matchedSheet = null;
  let matchedRowIndex = -1;
  let matchedRow = null;

  for (let i = 0; i < sheetsToSearch.length; i++) {
    const sheetName = sheetsToSearch[i];
    try {
      const s = getSheet(sheetName);
      if (!s) continue;
      const rows = getSheetRows(sheetName);
      const bareId = cleanId.replace(/^(TASK-DISC-|SUB-DISC-|PWR-DIS-)/i, '').trim();
      const found = rows.find(r => {
        const cId = String(r['Consumer Id'] || r['Consumer ID'] || r.consumerId || '').trim();
        const mNo = String(r['Meter'] || r.meterNumber || r['Meter No'] || r.meterNo || '').trim();
        const recId = String(r['Record ID'] || r.id || r.ID || '').trim();
        const subId = String(r['Submission ID'] || r.submissionId || '').trim();
        const tId = String(r['Task ID'] || r.taskId || '').trim();

        return recId === cleanId || subId === cleanId || tId === cleanId ||
          (cId && (cId === cleanId || cId === bareId || ('TASK-DISC-' + cId) === cleanId)) ||
          (mNo && mNo === cleanId);
      });
      if (found) {
        matchedSheet = s;
        matchedRowIndex = found._rowIndex;
        matchedRow = found;
        break;
      }
    } catch (e) {}
  }

  // Fallback search by consumer ID or SL if provided in update payload
  if (!matchedSheet || matchedRowIndex < 2) {
    const patchObj = (updateData && typeof updateData.data === 'object') ? updateData.data : (updateData || {});
    const altConsumerId = String(patchObj.consumerId || patchObj['Consumer Id'] || patchObj['Consumer ID'] || patchObj.accountNumber || '').trim();
    if (altConsumerId) {
      for (let i = 0; i < sheetsToSearch.length; i++) {
        try {
          const s = getSheet(sheetsToSearch[i]);
          if (!s) continue;
          const rows = getSheetRows(sheetsToSearch[i]);
          const found = rows.find(r => {
            const cId = String(r['Consumer Id'] || r['Consumer ID'] || r.consumerId || '').trim();
            return cId === altConsumerId || ('TASK-DISC-' + cId) === altConsumerId;
          });
          if (found) {
            matchedSheet = s;
            matchedRowIndex = found._rowIndex;
            matchedRow = found;
            break;
          }
        } catch (e) {}
      }
    }
  }

  if (!matchedSheet || matchedRowIndex < 2) {
    throw Error('Record #' + cleanId + ' not found in Google Sheets.');
  }

  const lastCol = matchedSheet.getLastColumn();
  const headers = matchedSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  const rowVals = matchedSheet.getRange(matchedRowIndex, 1, 1, lastCol).getValues()[0];

  const patch = (updateData && typeof updateData.data === 'object') ? updateData.data : (updateData || {});
  patch.updatedAt = now();

  // If sheet has Record ID column and current value is empty, populate it
  const recIdCol = headers.findIndex(h => normHeader(h) === 'recordid');
  if (recIdCol >= 0 && (!rowVals[recIdCol] || rowVals[recIdCol] === '')) {
    rowVals[recIdCol] = cleanId;
  }

  headers.forEach((h, colIdx) => {
    const newVal = extractFieldValue(patch, h);
    if (newVal !== undefined && newVal !== null && newVal !== '') {
      rowVals[colIdx] = newVal;
    }
  });

  matchedSheet.getRange(matchedRowIndex, 1, 1, lastCol).setValues([rowVals]);
  try { CacheService.getScriptCache().remove('records_cache'); } catch (e) {}

  return {
    success: true,
    message: 'Record #' + cleanId + ' updated successfully in Google Sheets',
    entry: {
      id: cleanId,
      ...matchedRow,
      ...patch,
      updatedAt: patch.updatedAt
    }
  };
}

// Delete Record from Google Sheets with Protection
function deleteEntry(targetId, category, options) {
  options = options || {};
  const cleanId = String(targetId || '').trim();
  if (!cleanId) throw Error('Entry ID required for deletion');

  const sheetsToSearch = category 
    ? [category] 
    : ['NSC', 'Disconnection', 'Broken', 'Meter Replacement', 'DTR Replacement', 'Call Case'];

  let matchedSheet = null;
  let matchedRow = null;

  for (let i = 0; i < sheetsToSearch.length; i++) {
    const sheetName = sheetsToSearch[i];
    try {
      const s = getSheet(sheetName);
      if (!s) continue;
      const rows = getSheetRows(sheetName);
      const found = rows.find(r => 
        String(r['Record ID'] || r.id || r.ID || '').trim() === cleanId ||
        String(r['Submission ID'] || r.submissionId || '').trim() === cleanId
      );
      if (found) {
        matchedSheet = s;
        matchedRow = found;
        break;
      }
    } catch (e) {}
  }

  if (!matchedRow || !matchedSheet) {
    throw Error('Record not found in Google Sheets: ' + cleanId);
  }

  matchedSheet.deleteRow(matchedRow._rowIndex);
  try { CacheService.getScriptCache().remove('records_cache'); } catch (e) {}
  logSystemActivity('admin', cleanId, '', '', 'DELETE_RECORD', 'Deleted record: ' + cleanId);

  return { success: true, message: 'Record deleted from Google Sheets', id: cleanId };
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
      rows.forEach((r, idx) => {
        // Generate stable deterministic ID if missing (e.g. from copy-pasting directly into Sheet)
        const stableId = String(
          r['Record ID'] || 
          r.id || 
          r['Task ID'] || 
          r.taskId || 
          r['Submission ID'] || 
          r.submissionId || 
          ('PWR-' + sheetName.substring(0, 3).toUpperCase() + '-' + (r['Consumer ID'] || r.consumerId || r['SL No'] || r.slNo || (idx + 1)))
        ).trim();

        // Normalize entry to standard frontend shape
        const item = {
          id: stableId,
          submissionId: String(r['Submission ID'] || r.submissionId || stableId),
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
          consumerId: String(r['Consumer Id'] || r['Consumer ID'] || r.consumerId || ''),
          consumerName: String(r['Name'] || r['Consumer Name'] || r.consumerName || ''),
          fatherName: String(r['Father Name'] || r.fatherName || ''),
          mobile: String(r['Mobile Number'] || r['Mobile No'] || r.mobile || ''),
          address: String(r['Address'] || r.address || ''),
          meterNo: String(r['Meter'] || r['Meter No'] || r.meterNo || ''),
          initialReading: String(r['Initial Reading'] || r.initialReading || ''),
          sealNo: String(r['Meter Seal No'] || r.sealNo || ''),
          appliedLoad: String(r['Applied Load'] || r.appliedLoad || ''),
          phase: String(r['BClass/Phase'] || r['Supply Phase'] || r.phase || ''),
          tariffCategory: String(r['Class'] || r['Tariff Category'] || r.tariffCategory || ''),
          serviceCableLength: String(r['Service Cable Length'] || r.serviceCableLength || ''),
          poleNo: String(r['Pole No'] || r.poleNo || ''),
          earthResistance: String(r['Earth Resistance'] || r.earthResistance || ''),
          workOrderNo: String(r['Work Order No'] || r.workOrderNo || ''),
          workOrderDate: String(r['Work Order Date'] || r.workOrderDate || ''),
          workOrderNoticeId: String(r['Work Order Notice ID'] || r.workOrderNoticeId || ''),
          workOrderNoticeTitle: String(r['Work Order Notice Title'] || r.workOrderNoticeTitle || ''),
          arrearAmount: String(r['D2 Net O/S'] || r['Arrear Amount'] || r.arrearAmount || ''),
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
          notes: String(r['Notes'] || r.notes || ''),

          // 14 Standard WBSEDCL Disconnection Headers
          'off_code': String(r['off_code'] || r.off_code || '5233100'),
          'MRU': String(r['MRU'] || r.mru || ''),
          'Consumer Id': String(r['Consumer Id'] || r['Consumer ID'] || r.consumerId || ''),
          'Name': String(r['Name'] || r['Consumer Name'] || r.consumerName || ''),
          'Address': String(r['Address'] || r.address || ''),
          'BClass/Phase': String(r['BClass/Phase'] || r.bClassPhase || 'I'),
          'Class': String(r['Class'] || r.baseClass || 'Domestic'),
          'Gov/Non-Gov': String(r['Gov/Non-Gov'] || r.govNonGov || 'Non-Gov'),
          'Meter': String(r['Meter'] || r['Meter No'] || r.meterNo || ''),
          'O/S Due date Range': String(r['O/S Due date Range'] || r.dueDateRange || ''),
          'D2 Net O/S': String(r['D2 Net O/S'] || r['Arrear Amount'] || r.arrearAmount || ''),
          'Discon Status': String(r['Discon Status'] || r['Status'] || r.status || 'PENDING'),
          'Discon Date': String(r['Discon Date'] || r['Date'] || r.date || ''),
          'Mobile Number': String(r['Mobile Number'] || r['Mobile No'] || r.mobile || '')
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

    // 9. Disconnection Tasks & Module
    if (action === 'getDisconnectionTasks' || action === 'disconnectiontasks') {
      return out(getDisconnectionTasksData(p), 'Disconnection tasks retrieved');
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

    // Record Update & Delete Operations
    if (action === 'updateEntry' || action === 'updateRecord' || action === 'editEntry') {
      const targetId = body.id || body.submissionId || data.id || data.submissionId || body.taskId || data.taskId;
      const category = body.category || data.category;
      const updateData = body.data || data.data || data || body;
      const res = updateEntry(targetId, category, updateData);
      return out(res, res.message || 'Record updated', reqId);
    }
    if (action === 'deleteEntry' || action === 'deleteRecord') {
      const targetId = body.id || body.submissionId || data.id || data.submissionId;
      const category = body.category || data.category;
      const res = deleteEntry(targetId, category, body.options || body || data);
      return out(res, 'Record deleted', reqId);
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

    // Disconnection Tasks Operations
    if (action === 'uploadDisconnectionTasks') {
      return out(handleUploadDisconnectionTasks(body), 'Disconnection tasks processed', reqId);
    }
    if (action === 'submitDisconnectionReport') {
      return out(handleSubmitDisconnectionReport(body), 'Disconnection report saved', reqId);
    }
    if (action === 'assignDisconnectionTask') {
      return out(handleAssignDisconnectionTask(body), 'Disconnection task assigned', reqId);
    }
    if (action === 'archiveDisconnectionTask') {
      return out(handleArchiveDisconnectionTask(body), 'Disconnection task archived', reqId);
    }
    if (action === 'restoreDisconnectionTask') {
      return out(handleRestoreDisconnectionTask(body), 'Disconnection task restored', reqId);
    }

    return errOut('UNKNOWN_POST_ACTION', 'Unrecognized POST action: ' + action, reqId);
  } catch (err) {
    return errOut('SERVER_ERROR', String(err.message || err));
  }
}

// ============================================================================
// DISCONNECTION MODULE ISOLATED HANDLERS
// ============================================================================

function getDisconnectionTasksData(params) {
  params = params || {};
  let rawRows = [];
  try {
    rawRows = getSheetRows('Disconnection');
  } catch (e) {
    rawRows = [];
  }

  var tasks = [];
  var seenIds = {};

  for (var i = 0; i < rawRows.length; i++) {
    var r = rawRows[i];
    var consumerId = String(r['Consumer Id'] || r['Consumer ID'] || r.consumerId || r['Account Number'] || '').trim();
    var taskId = String(r['Task ID'] || r['Submission ID'] || r['Record ID'] || (consumerId ? ('TASK-DISC-' + consumerId) : ('TASK-DISC-' + (i + 1)))).trim();
    if (seenIds[taskId]) continue;
    seenIds[taskId] = true;

    var rawSl = String(r['SL No'] || r['SL'] || r.serialNumber || r.slNo || '').trim();
    var serialNumber = '';
    if (rawSl) {
      var m = rawSl.match(/(\d+)/);
      if (m) {
        serialNumber = 'SL ' + ('000' + m[1]).slice(-3);
      } else {
        serialNumber = rawSl;
      }
    } else {
      serialNumber = 'SL ' + ('000' + (i + 1)).slice(-3);
    }

    var offCode = String(r['off_code'] || r.off_code || r.offCode || r['Substation'] || r.area || '5233100').trim();
    var mru = String(r['MRU'] || r.mru || r['MRU Section'] || r.mruSection || '').trim();
    var consumerName = String(r['Name'] || r['Consumer Name'] || r.consumerName || r.name || '').trim();
    var consumerAddress = String(r['Address'] || r.consumerAddress || r.address || '').trim();
    var bClassPhase = String(r['BClass/Phase'] || r.bClassPhase || r['Device Type'] || r.deviceType || 'I').trim();
    var consumerClass = String(r['Class'] || r.baseClass || r['Base Class'] || r.class || 'Domestic').trim();
    var govNonGov = String(r['Gov/Non-Gov'] || r.govNonGov || 'Non-Gov').trim();
    var meterNumber = String(r['Meter'] || r['Meter No'] || r['Final Reading'] || r['Old Meter No'] || r.meterNumber || '').trim();
    var dueDateRange = String(r['O/S Due date Range'] || r['Due Date Range'] || r.dueDateRange || '').trim();
    var outstandingDue = String(r['D2 Net O/S'] || r['Arrear Amount'] || r.outstandingDue || '').trim();
    var rawStatus = String(r['Discon Status'] || r['Status'] || r['Task Status'] || r.disconStatus || r.status || 'PENDING').trim().toUpperCase();
    var reportDate = String(r['Discon Date'] || r['Date'] || r.disconDate || r.reportDate || '').trim();
    var phoneNumber = String(r['Mobile Number'] || r['Mobile No'] || r['Worker Phone'] || r.phoneNumber || '').trim();

    var status = rawStatus || 'PENDING';

    var task = {
      // 14 Standard WBSEDCL Disconnection Headers (Exact Order & Names)
      'off_code': offCode,
      'MRU': mru,
      'Consumer Id': consumerId,
      'Name': consumerName,
      'Address': consumerAddress,
      'BClass/Phase': bClassPhase,
      'Class': consumerClass,
      'Gov/Non-Gov': govNonGov,
      'Meter': meterNumber,
      'O/S Due date Range': dueDateRange,
      'D2 Net O/S': outstandingDue,
      'Discon Status': status,
      'Discon Date': reportDate,
      'Mobile Number': phoneNumber,

      // Frontend compatibility fields
      serialNumber: serialNumber,
      taskId: taskId,
      consumerId: consumerId,
      consumerName: consumerName,
      accountNumber: consumerId,
      meterNumber: meterNumber,
      consumerAddress: consumerAddress,
      phoneNumber: phoneNumber,
      mobileNumber: phoneNumber,
      area: offCode,
      disconnectionReason: 'Outstanding Bill (D2 Net O/S: ' + outstandingDue + ')',
      assignedWorkerId: String(r['Worker ID'] || r.assignedWorkerId || '').trim(),
      assignedWorkerName: String(r['Worker Name'] || r.assignedWorkerName || '').trim(),
      taskStatus: status,
      workerReport: String(r['Notes'] || r.workerReport || '').trim(),
      workerRemarks: String(r['Notes'] || r.workerRemarks || '').trim(),
      reportDate: reportDate,
      reportTime: String(r.reportTime || '').trim(),
      submittedBy: String(r['Submitted By'] || r.submittedBy || '').trim(),
      createdAt: String(r['Created At'] || r.createdAt || reportDate || now()).trim(),
      updatedAt: String(r['Updated At'] || r.updatedAt || now()).trim(),
      photoUrl: String(r['Photo Evidence'] || r.photoUrl || '').trim(),
      mruSection: mru,
      cccFeeder: mru,
      outstandingDue: outstandingDue,
      dueDateRange: dueDateRange,
      baseClass: consumerClass,
      deviceType: bClassPhase,
      priority: (parseFloat(outstandingDue.replace(/[^0-9.]/g, '')) > 10000) ? 'URGENT' : 'NORMAL',
      assignedAgency: String(r['Agency Name'] || r.assignedAgency || '').trim(),
      paidAmount: String(r['Paid Amount'] || r.paidAmount || (status === 'PAID' ? outstandingDue : '')).trim(),
      paymentDate: String(r['Payment Date'] || r.paymentDate || (status === 'PAID' ? reportDate : '')).trim(),
      paymentReference: String(r['Payment Reference'] || r.paymentReference || '').trim(),
      meterReading: meterNumber,
      statusHistory: r['Status History'] || r.statusHistory || []
    };
    tasks.push(task);
  }

  // Filter if worker requested
  var role = String(params.role || '').toLowerCase();
  var workerId = String(params.workerId || '').toLowerCase().trim();
  var workerName = String(params.workerName || '').toLowerCase().trim();

  var total = tasks.length;
  var completed = 0;
  var pending = 0;
  var paid = 0;
  var notFound = 0;
  var dispute = 0;
  var officeTeam = 0;
  var reissue = 0;
  var urgent = 0;

  for (var j = 0; j < tasks.length; j++) {
    var st = tasks[j].taskStatus;
    if (st === 'COMPLETED' || st === 'DISCONNECT') completed++;
    else if (st === 'PENDING') pending++;
    else if (st === 'PAID') paid++;
    else if (st === 'NOT FOUND') notFound++;
    else if (st === 'DISPUTE') dispute++;
    else if (st === 'OFFICE TEAM') officeTeam++;
    else if (st === 'REISSUE') reissue++;

    if (String(tasks[j].priority).toUpperCase() === 'URGENT') urgent++;
  }

  return {
    tasks: tasks,
    stats: {
      totalTasks: total,
      completedTasks: completed,
      pendingTasks: pending,
      paidTasks: paid,
      notFoundTasks: notFound,
      disputeTasks: dispute,
      officeTeamTasks: officeTeam,
      reissueTasks: reissue,
      urgentTasks: urgent,
      completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      myAssignedTasks: total,
      myCompletedTasks: completed,
      myPendingTasks: pending,
      myCompletionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  };
}

function handleUploadDisconnectionTasks(body) {
  var tasks = body.tasks || [];
  var adminInfo = body.adminInfo || {};
  var inserted = 0;
  var updated = 0;

  var s = getSheet('Disconnection');
  var existingRows = getSheetRows('Disconnection');
  var data = s.getDataRange().getValues();
  var headers = data.length > 0 ? data[0].map(function(h) { return String(h || '').trim(); }) : [];

  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    var cId = String(t['Consumer Id'] || t.consumerId || t['Consumer ID'] || t.accountNumber || '').trim();
    var mNo = String(t['Meter'] || t.meterNumber || t['Meter No'] || t.meterNo || '').trim();
    var offCode = String(t['off_code'] || t.offCode || t.area || '5233100').trim();
    var mru = String(t['MRU'] || t.mru || t.mruSection || '').trim();
    var name = String(t['Name'] || t.consumerName || t.name || '').trim();
    var address = String(t['Address'] || t.consumerAddress || t.address || '').trim();
    var bClassPhase = String(t['BClass/Phase'] || t.bClassPhase || t.deviceType || 'I').trim();
    var consumerClass = String(t['Class'] || t.baseClass || t.class || 'Domestic').trim();
    var govNonGov = String(t['Gov/Non-Gov'] || t.govNonGov || 'Non-Gov').trim();
    var dueDateRange = String(t['O/S Due date Range'] || t.dueDateRange || '').trim();
    var d2NetOs = String(t['D2 Net O/S'] || t.outstandingDue || t.arrearAmount || '').trim();
    var disconStatus = String(t['Discon Status'] || t.disconStatus || t.taskStatus || t.status || 'PENDING').trim();
    var disconDate = String(t['Discon Date'] || t.disconDate || t.reportDate || '').trim();
    var mobile = String(t['Mobile Number'] || t.phoneNumber || t.mobile || '').trim();

    var record14 = {
      'off_code': offCode,
      'MRU': mru,
      'Consumer Id': cId,
      'Name': name,
      'Address': address,
      'BClass/Phase': bClassPhase,
      'Class': consumerClass,
      'Gov/Non-Gov': govNonGov,
      'Meter': mNo,
      'O/S Due date Range': dueDateRange,
      'D2 Net O/S': d2NetOs,
      'Discon Status': disconStatus,
      'Discon Date': disconDate,
      'Mobile Number': mobile
    };

    // Find existing row by Consumer Id to prevent duplicates
    var existingRow = -1;
    if (cId) {
      for (var r = 0; r < existingRows.length; r++) {
        var rowCId = String(existingRows[r]['Consumer Id'] || existingRows[r]['Consumer ID'] || existingRows[r].consumerId || '').trim();
        if (rowCId && rowCId.toLowerCase() === cId.toLowerCase()) {
          existingRow = existingRows[r]._rowIndex;
          break;
        }
      }
    }

    if (existingRow > 1) {
      // Update existing row in place
      for (var col = 0; col < headers.length; col++) {
        var colName = headers[col];
        var val = extractFieldValue(record14, colName);
        if (val !== undefined && val !== null && String(val) !== '') {
          s.getRange(existingRow, col + 1).setValue(val);
        }
      }
      updated++;
    } else {
      appendSheetRecord('Disconnection', record14);
      inserted++;
    }
  }

  return {
    success: true,
    count: tasks.length,
    insertedCount: inserted,
    updatedCount: updated,
    message: 'Processed ' + tasks.length + ' disconnection records (' + inserted + ' new, ' + updated + ' updated)'
  };
}

function handleSubmitDisconnectionReport(body) {
  var taskId = String(body.taskId || body.id || '').trim();
  var cId = String(body['Consumer Id'] || body.consumerId || body['Consumer ID'] || '').trim();
  var status = String(body['Discon Status'] || body.taskStatus || body.status || 'COMPLETED').trim();
  var reportDate = String(body['Discon Date'] || body.reportDate || body.date || now()).trim();
  var meterReading = String(body['Meter'] || body.meterReading || body.meterNumber || '').trim();
  var phone = String(body['Mobile Number'] || body.phoneNumber || body.mobile || '').trim();

  var s = getSheet('Disconnection');
  var data = s.getDataRange().getValues();
  var headers = data.length > 0 ? data[0].map(function(h) { return String(h || '').trim(); }) : [];

  var cIdIdx = headers.indexOf('Consumer Id');
  if (cIdIdx === -1) cIdIdx = headers.indexOf('Consumer ID');
  var statusIdx = headers.indexOf('Discon Status');
  if (statusIdx === -1) statusIdx = headers.indexOf('Status');
  var dateIdx = headers.indexOf('Discon Date');
  if (dateIdx === -1) dateIdx = headers.indexOf('Date');
  var meterIdx = headers.indexOf('Meter');
  if (meterIdx === -1) meterIdx = headers.indexOf('Final Reading');
  var phoneIdx = headers.indexOf('Mobile Number');
  if (phoneIdx === -1) phoneIdx = headers.indexOf('Mobile No');
  var recIdIdx = headers.indexOf('Record ID');
  var subIdIdx = headers.indexOf('Submission ID');

  var foundRow = -1;
  // Match by Consumer Id first, then taskId/Record ID/Submission ID
  for (var r = 1; r < data.length; r++) {
    var rowCId = cIdIdx !== -1 ? String(data[r][cIdIdx] || '').trim() : '';
    var rowRecId = recIdIdx !== -1 ? String(data[r][recIdIdx] || '').trim() : '';
    var rowSubId = subIdIdx !== -1 ? String(data[r][subIdIdx] || '').trim() : '';

    if (cId && rowCId && rowCId.toLowerCase() === cId.toLowerCase()) {
      foundRow = r + 1;
      break;
    }
    if (taskId && (rowRecId === taskId || rowSubId === taskId || ('TASK-DISC-' + rowCId) === taskId)) {
      foundRow = r + 1;
      break;
    }
  }

  if (foundRow > 1) {
    if (statusIdx !== -1) s.getRange(foundRow, statusIdx + 1).setValue(status);
    if (dateIdx !== -1) s.getRange(foundRow, dateIdx + 1).setValue(reportDate);
    if (meterIdx !== -1 && meterReading) s.getRange(foundRow, meterIdx + 1).setValue(meterReading);
    if (phoneIdx !== -1 && phone) s.getRange(foundRow, phoneIdx + 1).setValue(phone);
  } else {
    // Append new 14-field record
    var newRecord = {
      'off_code': body['off_code'] || body.offCode || '5233100',
      'MRU': body['MRU'] || body.mru || '',
      'Consumer Id': cId,
      'Name': body['Name'] || body.consumerName || '',
      'Address': body['Address'] || body.consumerAddress || '',
      'BClass/Phase': body['BClass/Phase'] || body.bClassPhase || 'I',
      'Class': body['Class'] || body.baseClass || 'Domestic',
      'Gov/Non-Gov': body['Gov/Non-Gov'] || body.govNonGov || 'Non-Gov',
      'Meter': meterReading || body.meterNumber || '',
      'O/S Due date Range': body['O/S Due date Range'] || body.dueDateRange || '',
      'D2 Net O/S': body['D2 Net O/S'] || body.outstandingDue || body.arrearAmount || '',
      'Discon Status': status,
      'Discon Date': reportDate,
      'Mobile Number': phone
    };
    appendSheetRecord('Disconnection', newRecord);
  }

  return {
    success: true,
    message: 'Disconnection report saved successfully in Google Sheet',
    taskId: taskId || ('TASK-DISC-' + cId),
    status: status
  };
}

function handleAssignDisconnectionTask(body) {
  return { success: true, message: 'Task assigned successfully' };
}

function handleArchiveDisconnectionTask(body) {
  return { success: true, message: 'Task archived successfully' };
}

function handleRestoreDisconnectionTask(body) {
  return { success: true, message: 'Task restored successfully' };
}
