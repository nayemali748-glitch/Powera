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
  'NSC': ['NSC', 'NEW_CONNECTION', 'NewConnection', 'NEW CONNECTION', 'New Connection'],
  'NEW_CONNECTION': ['NSC', 'NEW_CONNECTION', 'NewConnection', 'NEW CONNECTION', 'New Connection'],
  'DISCONNECTION': ['DISCONNECTION', 'Disconnection', 'DISCONNECT', 'Disconnect'],
  'POLE CASE': ['POLE CASE', 'POLE_CASE', 'PoleCase', 'Pole Case', 'CALL CASE', 'CALL_CASE', 'CallCase', 'Call Case'],
  'POLE_CASE': ['POLE CASE', 'POLE_CASE', 'PoleCase', 'Pole Case', 'CALL CASE', 'CALL_CASE', 'CallCase', 'Call Case'],
  'METER REPLESMENT': ['METER REPLESMENT', 'METER_REPLESMENT', 'METER REPLACEMENT', 'METER_REPLACEMENT', 'MeterReplacement', 'Meter Replacement', 'Meter Replesment'],
  'METER_REPLACEMENT': ['METER REPLESMENT', 'METER_REPLESMENT', 'METER REPLACEMENT', 'METER_REPLACEMENT', 'MeterReplacement', 'Meter Replacement', 'Meter Replesment'],
  'DTR REPLESMENT': ['DTR REPLESMENT', 'DTR_REPLESMENT', 'DTR REPLACEMENT', 'DTR_REPLACEMENT', 'DtrReplacement', 'Dtr Replacement', 'Dtr Replesment'],
  'DTR_REPLACEMENT': ['DTR REPLESMENT', 'DTR_REPLESMENT', 'DTR REPLACEMENT', 'DTR_REPLACEMENT', 'DtrReplacement', 'Dtr Replacement', 'Dtr Replesment'],
  'SETTINGS': ['SETTINGS', 'Settings'],
  'WORK_ORDERS': ['WORK_ORDERS', 'WorkOrders', 'workorders'],
  'CHAT': ['CHAT', 'Chat', 'chat']
};

const CATEGORY_MAP = {
  'NSC': 'NSC',
  'NEW_CONNECTION': 'NSC',
  'NEW CONNECTION': 'NSC',
  'DISCONNECTION': 'DISCONNECTION',
  'POLE CASE': 'POLE CASE',
  'POLE_CASE': 'POLE CASE',
  'POLECASE': 'POLE CASE',
  'CALL CASE': 'POLE CASE',
  'CALL_CASE': 'POLE CASE',
  'CALLCASE': 'POLE CASE',
  'METER REPLESMENT': 'METER REPLESMENT',
  'METER_REPLESMENT': 'METER REPLESMENT',
  'METER REPLACEMENT': 'METER REPLESMENT',
  'METER_REPLACEMENT': 'METER REPLESMENT',
  'DTR REPLESMENT': 'DTR REPLESMENT',
  'DTR_REPLESMENT': 'DTR REPLESMENT',
  'DTR REPLACEMENT': 'DTR REPLESMENT',
  'DTR_REPLACEMENT': 'DTR REPLESMENT'
};

function normalizeCategory(cat) {
  if (!cat) return null;
  const raw = String(cat).trim().toUpperCase();
  if (CATEGORY_MAP[raw]) return CATEGORY_MAP[raw];
  const cleaned = raw.replace(/[\s_\-]/g, '');
  if (cleaned === 'NSC' || cleaned === 'NEWCONNECTION') return 'NSC';
  if (cleaned === 'DISCONNECTION' || cleaned === 'DISCONNECT') return 'DISCONNECTION';
  if (cleaned === 'POLECASE' || cleaned === 'CALLCASE') return 'POLE CASE';
  if (cleaned === 'METERREPLESMENT' || cleaned === 'METERREPLACEMENT') return 'METER REPLESMENT';
  if (cleaned === 'DTRREPLESMENT' || cleaned === 'DTRREPLACEMENT') return 'DTR REPLESMENT';
  return null;
}

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

// ============================================================================
// NSC (NEW SERVICE CONNECTION) FIELD DEFINITIONS & GOOGLE SHEET HEADER MAPPINGS
// Matches the exact fields from the application's NSC EntryForm.tsx
// ============================================================================
const NSC_FIELD_SPECS = [
  // 1. System & Submission Tracking Fields
  { key: 'submissionId', header: 'Submission ID', normalized: 'submissionid', aliases: ['submissionId', 'SubmissionID', 'submission_id', 'Submission Id'] },
  { key: 'id', header: 'Record ID', normalized: 'recordid', aliases: ['id', 'ID', 'recordId', 'RecordID', 'record_id', 'pwrId'] },
  { key: 'category', header: 'Category', normalized: 'category', aliases: ['category', 'Category', 'workCategory'] },
  { key: 'status', header: 'Status', normalized: 'status', aliases: ['status', 'Status', 'workStatus'] },
  { key: 'date', header: 'Date', normalized: 'date', aliases: ['date', 'Date', 'entryDate'] },
  { key: 'createdAt', header: 'Created At', normalized: 'createdat', aliases: ['createdAt', 'CreatedAt', 'created_at', 'CreatedDate'] },
  { key: 'updatedAt', header: 'Updated At', normalized: 'updatedat', aliases: ['updatedAt', 'UpdatedAt', 'updated_at', 'ModifiedAt'] },

  // 2. Worker Information Fields
  { key: 'workerId', header: 'Worker ID', normalized: 'workerid', aliases: ['workerId', 'WorkerID', 'worker_id', 'idNo', 'Lineman ID', 'linemanId'] },
  { key: 'workerName', header: 'Worker Name', normalized: 'workername', aliases: ['workerName', 'WorkerName', 'worker_name', 'Lineman Name', 'linemanName', 'nscWorkerName'] },
  { key: 'role', header: 'Role', normalized: 'role', aliases: ['role', 'Role', 'userRole'] },
  { key: 'submittedBy', header: 'Submitted By', normalized: 'submittedby', aliases: ['submittedBy', 'SubmittedBy', 'submitted_by'] },
  { key: 'workerPhone', header: 'Worker Phone', normalized: 'workerphone', aliases: ['workerPhone', 'WorkerPhone', 'worker_phone', 'linemanPhone', 'Lineman Phone'] },

  // 3. Office, Agency & Substation Fields
  { key: 'agencyName', header: 'Agency Name', normalized: 'agencyname', aliases: ['agencyName', 'AgencyName', 'agency_name', 'Contractor Name', 'contractorName'] },
  { key: 'cccName', header: 'CCC Name', normalized: 'cccname', aliases: ['cccName', 'CCCName', 'ccc_name', 'Customer Care Center', 'cccOffice', 'CCC Office'] },
  { key: 'substation', header: 'Substation', normalized: 'substation', aliases: ['substation', 'Substation', 'substation_name', 'subStation'] },
  { key: 'feederName', header: 'Feeder Name', normalized: 'feedername', aliases: ['feederName', 'FeederName', 'feeder_name', 'feeder'] },

  // 4. Work Order Details
  { key: 'workOrderNo', header: 'Work Order No', normalized: 'workorderno', aliases: ['workOrderNo', 'WorkOrderNo', 'work_order_no', 'Work Order Number', 'WO Number', 'woNo'] },
  { key: 'workOrderDate', header: 'Work Order Date', normalized: 'workorderdate', aliases: ['workOrderDate', 'WorkOrderDate', 'work_order_date', 'WO Date'] },
  { key: 'workOrderNoticeId', header: 'Work Order Notice ID', normalized: 'workordernoticeid', aliases: ['workOrderNoticeId', 'WorkOrderNoticeId', 'work_order_notice_id'] },
  { key: 'workOrderNoticeTitle', header: 'Work Order Notice Title', normalized: 'workordernoticetitle', aliases: ['workOrderNoticeTitle', 'WorkOrderNoticeTitle', 'work_order_notice_title'] },
  { key: 'workOrderNoticeDate', header: 'Work Order Notice Date', normalized: 'workordernoticedate', aliases: ['workOrderNoticeDate', 'WorkOrderNoticeDate', 'work_order_notice_date'] },
  { key: 'workOrderPhoto', header: 'Work Order Photo', normalized: 'workorderphoto', aliases: ['workOrderPhoto', 'WorkOrderPhoto', 'work_order_photo', 'khataPhoto', 'Notice Photo'] },

  // 5. Consumer Information Fields
  { key: 'applicationNo', header: 'Application No', normalized: 'applicationno', aliases: ['applicationNo', 'ApplicationNo', 'application_no', 'App No', 'appNo', 'Application Number'] },
  { key: 'consumerId', header: 'Consumer ID', normalized: 'consumerid', aliases: ['consumerId', 'ConsumerID', 'consumer_id', 'Consumer Number', 'consumerNo', 'Consumer No', 'Con Id', 'conId'] },
  { key: 'consumerName', header: 'Consumer Name', normalized: 'consumername', aliases: ['consumerName', 'ConsumerName', 'consumer_name', 'Customer Name', 'customerName', 'Name'] },
  { key: 'fatherName', header: 'Father Name', normalized: 'fathername', aliases: ['fatherName', 'FatherName', 'father_name', 'Father / Husband Name', 'Father/Husband Name', 'husbandName', 'FatherHusbandName'] },
  { key: 'mobile', header: 'Mobile No', normalized: 'mobileno', aliases: ['mobile', 'Mobile', 'mobile_no', 'Mobile No', 'phone', 'Phone', 'consumerMobile', 'Mobile Number'] },
  { key: 'address', header: 'Address', normalized: 'address', aliases: ['address', 'Address', 'premisesAddress', 'Location', 'villageAddress'] },

  // 6. Electrical & Tariff Specifications
  { key: 'appliedLoad', header: 'Applied Load', normalized: 'appliedload', aliases: ['appliedLoad', 'AppliedLoad', 'applied_load', 'Sanctioned Load', 'load', 'Load (kW)', 'Applied Load (kW)'] },
  { key: 'phase', header: 'Supply Phase', normalized: 'supplyphase', aliases: ['phase', 'Phase', 'supplyPhase', 'Supply Phase', 'Phase Supply'] },
  { key: 'tariffCategory', header: 'Tariff Category', normalized: 'tariffcategory', aliases: ['tariffCategory', 'TariffCategory', 'tariff_category', 'Tariff Class', 'tariff'] },
  { key: 'serviceCableLength', header: 'Service Cable Length', normalized: 'servicecablelength', aliases: ['serviceCableLength', 'ServiceCableLength', 'service_cable_length', 'Cable Length', 'serviceCable'] },
  { key: 'poleNo', header: 'Pole No', normalized: 'poleno', aliases: ['poleNo', 'PoleNo', 'pole_no', 'Pole Number'] },
  { key: 'earthResistance', header: 'Earth Resistance', normalized: 'earthresistance', aliases: ['earthResistance', 'EarthResistance', 'earth_resistance', 'Earth Pit Resistance'] },

  // 7. Meter Details
  { key: 'meterNo', header: 'Meter No', normalized: 'meterno', aliases: ['meterNo', 'MeterNo', 'meter_no', 'Meter Number', 'newMeterNo'] },
  { key: 'meterMake', header: 'Meter Make', normalized: 'metermake', aliases: ['meterMake', 'MeterMake', 'meter_make', 'Meter Make Brand', 'meterBrand'] },
  { key: 'initialReading', header: 'Initial Reading', normalized: 'initialreading', aliases: ['initialReading', 'InitialReading', 'initial_reading', 'Initial Meter Reading', 'meterReading', 'startReading'] },
  { key: 'sealNo', header: 'Meter Seal No', normalized: 'metersealno', aliases: ['sealNo', 'SealNo', 'seal_no', 'Meter Seal No', 'Seal Number'] },
  { key: 'meterInstallDate', header: 'Meter Install Date', normalized: 'meterinstalldate', aliases: ['meterInstallDate', 'MeterInstallDate', 'meter_install_date', 'Installation Date'] },
  { key: 'inspectionAgencyName', header: 'Inspection Agency Name', normalized: 'inspectionagencyname', aliases: ['inspectionAgencyName', 'InspectionAgencyName', 'inspection_agency_name', 'Inspection Agency'] },

  // 8. Site Evidence & Remarks
  { key: 'locationGps', header: 'GPS Location', normalized: 'gpslocation', aliases: ['locationGps', 'LocationGPS', 'location_gps', 'gps', 'GPS', 'Coordinates', 'location'] },
  { key: 'photoUrl', header: 'Photo Evidence', normalized: 'photoevidence', aliases: ['photoUrl', 'PhotoUrl', 'photo_url', 'Photo Evidence', 'directImageUrl', 'driveViewUrl', 'photo'] },
  { key: 'notes', header: 'Notes', normalized: 'notes', aliases: ['notes', 'Notes', 'remarks', 'Remarks', 'comment', 'comments'] }
];

// Canonical headers array for NSC sheet tab
const NSC_HEADERS = NSC_FIELD_SPECS.map(function(s) { return s.header; });

// Normalizes header names for case, space, and symbol-insensitive matching
function normalizeHeaderName(name) {
  if (!name) return '';
  return String(name).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Finds the matching field spec for any given header string (key, header, alias, or normalized)
function findSpecForHeader(headerStr) {
  if (!headerStr) return null;
  const raw = String(headerStr).trim();
  const norm = normalizeHeaderName(raw);
  if (!norm) return null;

  for (let i = 0; i < NSC_FIELD_SPECS.length; i++) {
    const spec = NSC_FIELD_SPECS[i];
    if (spec.key.toLowerCase() === raw.toLowerCase()) return spec;
    if (spec.header.toLowerCase() === raw.toLowerCase()) return spec;
    if (spec.normalized === norm) return spec;
    if (spec.aliases) {
      for (let j = 0; j < spec.aliases.length; j++) {
        if (spec.aliases[j].toLowerCase() === raw.toLowerCase() || normalizeHeaderName(spec.aliases[j]) === norm) {
          return spec;
        }
      }
    }
  }
  return null;
}

// Finds the column index in a headers array matching a key, display header, or alias
function findColumnIndex(headers, keyOrHeader) {
  if (!headers || !headers.length || !keyOrHeader) return -1;
  const targetRaw = String(keyOrHeader).trim();
  const targetNorm = normalizeHeaderName(targetRaw);
  if (!targetNorm) return -1;

  // 1. Direct exact match (case-insensitive)
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').trim();
    if (h.toLowerCase() === targetRaw.toLowerCase()) return i;
  }

  // 2. Spec-based match (match by spec key, spec header, or any alias)
  const spec = findSpecForHeader(targetRaw);
  if (spec) {
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i] || '').trim();
      const hNorm = normalizeHeaderName(h);
      if (hNorm === spec.normalized) return i;
      if (h.toLowerCase() === spec.key.toLowerCase()) return i;
      if (h.toLowerCase() === spec.header.toLowerCase()) return i;
      if (spec.aliases) {
        for (let j = 0; j < spec.aliases.length; j++) {
          if (h.toLowerCase() === spec.aliases[j].toLowerCase() || normalizeHeaderName(spec.aliases[j]) === hNorm) {
            return i;
          }
        }
      }
    }
  }

  // 3. Normalized string match
  for (let i = 0; i < headers.length; i++) {
    if (normalizeHeaderName(headers[i]) === targetNorm) return i;
  }

  return -1;
}

// Extracts the correct field value from an incoming data object for a given sheet header
function getValueForHeader(obj, headerStr, destSheetName) {
  if (!obj || typeof obj !== 'object') return '';
  const h = String(headerStr || '').trim();
  if (!h) return '';

  // 1. Exact match on raw header
  if (obj[h] !== undefined && obj[h] !== null) return obj[h];

  // 2. Match via field specs
  const spec = findSpecForHeader(h);
  if (spec) {
    if (obj[spec.key] !== undefined && obj[spec.key] !== null) return obj[spec.key];
    if (obj[spec.header] !== undefined && obj[spec.header] !== null) return obj[spec.header];
    if (spec.aliases) {
      for (let i = 0; i < spec.aliases.length; i++) {
        const alias = spec.aliases[i];
        if (obj[alias] !== undefined && obj[alias] !== null) return obj[alias];
      }
    }
  }

  // 3. Normalized key check across all obj keys
  const hNorm = normalizeHeaderName(h);
  const objKeys = Object.keys(obj);
  for (let i = 0; i < objKeys.length; i++) {
    const ok = objKeys[i];
    if (normalizeHeaderName(ok) === hNorm) {
      if (obj[ok] !== undefined && obj[ok] !== null) return obj[ok];
    }
  }

  // 4. Aliases & System Field Fallbacks
  if (hNorm === 'submissionid') return obj.submissionId || obj.SubmissionID || '';
  if (hNorm === 'recordid' || hNorm === 'id') return obj.id || obj.ID || '';
  if (hNorm === 'workerid') return obj.workerId || obj.WorkerID || obj.idNo || '';
  if (hNorm === 'workername') return obj.workerName || obj.WorkerName || obj.nscWorkerName || '';
  if (hNorm === 'role') return obj.role || obj.Role || 'worker';
  if (hNorm === 'submittedby') return obj.submittedBy || obj.SubmittedBy || obj.workerName || '';
  if (hNorm === 'createdat') return obj.createdAt || obj.CreatedAt || obj.date || now();
  if (hNorm === 'updatedat') return obj.updatedAt || obj.UpdatedAt || now();
  if (hNorm === 'status') return obj.status || obj.Status || 'Completed';
  if (hNorm === 'category') return obj.category || obj.Category || 'NSC';
  if (hNorm === 'photourl' || hNorm === 'photoevidence') return obj.photoUrl || obj.directImageUrl || obj.driveViewUrl || '';
  if (hNorm === 'workorderphoto') return obj.workOrderPhoto || '';
  if (hNorm === 'workorderno') return obj.workOrderNo || '';
  if (hNorm === 'workorderdate') return obj.workOrderDate || '';
  if (hNorm === 'applicationno') return obj.applicationNo || '';
  if (hNorm === 'consumerid') return obj.consumerId || '';
  if (hNorm === 'consumername') return obj.consumerName || '';
  if (hNorm === 'fathername') return obj.fatherName || '';
  if (hNorm === 'mobileno' || hNorm === 'mobile') return obj.mobile || '';
  if (hNorm === 'address') return obj.address || '';
  if (hNorm === 'appliedload') return obj.appliedLoad || '';
  if (hNorm === 'supplyphase' || hNorm === 'phase') return obj.phase || '';
  if (hNorm === 'tariffcategory') return obj.tariffCategory || '';
  if (hNorm === 'servicecablelength') return obj.serviceCableLength || '';
  if (hNorm === 'meterno') return obj.meterNo || '';
  if (hNorm === 'metermake') return obj.meterMake || '';
  if (hNorm === 'initialreading') return obj.initialReading || '';
  if (hNorm === 'metersealno' || hNorm === 'sealno') return obj.sealNo || '';
  if (hNorm === 'meterinstalldate') return obj.meterInstallDate || '';
  if (hNorm === 'inspectionagencyname') return obj.inspectionAgencyName || '';
  if (hNorm === 'poleno') return obj.poleNo || '';
  if (hNorm === 'earthresistance') return obj.earthResistance || '';
  if (hNorm === 'gpslocation' || hNorm === 'locationgps') return obj.locationGps || '';
  if (hNorm === 'notes') return obj.notes || '';

  return '';
}

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
  
  // 1. Direct match on alias names
  for (let i = 0; i < aliases.length; i++) {
    const existing = spreadsheet.getSheetByName(aliases[i]);
    if (existing) {
      ensureHeaders(existing, headers);
      _sheetMemoryMap[canonicalName] = existing;
      return existing;
    }
  }

  // 2. Case-insensitive and normalized match across all sheets
  const allSheets = spreadsheet.getSheets();
  const normalizedAliases = aliases.map(a => a.toUpperCase().replace(/[\s_\-]/g, ''));
  for (let i = 0; i < allSheets.length; i++) {
    const s = allSheets[i];
    const sNorm = s.getName().toUpperCase().replace(/[\s_\-]/g, '');
    if (normalizedAliases.indexOf(sNorm) >= 0) {
      ensureHeaders(s, headers);
      _sheetMemoryMap[canonicalName] = s;
      return s;
    }
  }

  // 3. Create destination sheet with canonical name if not found
  const newSheet = spreadsheet.insertSheet(canonicalName);
  newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  newSheet.setFrozenRows(1);
  _sheetMemoryMap[canonicalName] = newSheet;
  return newSheet;
}

function getCategorySheet(canonicalCategory) {
  return getExistingOrNewSheet(canonicalCategory, headersFor(canonicalCategory));
}

function ensureHeaders(s, headers) {
  if (!s) return;
  const lastRow = s.getLastRow();
  const lastCol = s.getLastColumn();

  if (lastRow === 0 || lastCol === 0) {
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.setFrozenRows(1);
    return;
  }

  const currentHeaders = s.getRange(1, 1, 1, Math.max(1, lastCol)).getValues()[0].map(h => String(h || '').trim());
  const missingHeaders = [];

  headers.forEach(h => {
    const trimmed = String(h || '').trim();
    if (!trimmed) return;
    // Check if this header already exists or matches a known field/alias in the sheet
    if (findColumnIndex(currentHeaders, trimmed) === -1) {
      const spec = findSpecForHeader(trimmed);
      const alreadyAdding = missingHeaders.some(m => {
        if (spec && findSpecForHeader(m) && findSpecForHeader(m).key === spec.key) return true;
        return normalizeHeaderName(m) === normalizeHeaderName(trimmed);
      });
      if (!alreadyAdding) {
        missingHeaders.push(trimmed);
      }
    }
  });

  if (missingHeaders.length > 0) {
    const startCol = currentHeaders.length + 1;
    s.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
  }
  s.setFrozenRows(1);
}

function headersFor(name) {
  const norm = String(name || '').trim().toUpperCase().replace(/[\s_\-]/g, '');
  if (norm === 'USERS') return USER_HEADERS;
  if (norm === 'USERACTIVITY') return ACTIVITY_HEADERS;
  if (norm === 'SETTINGS') return SETTINGS_HEADERS;
  if (norm === 'WORKORDERS') return WORK_ORDER_HEADERS;
  if (norm === 'CHAT') return CHAT_HEADERS;
  if (norm === 'NSC' || norm === 'NEWCONNECTION') return NSC_HEADERS;
  return COMMON_ENTRY_HEADERS;
}

function getSheet(name) {
  return getExistingOrNewSheet(name, headersFor(name));
}

function setupDatabase() {
  const sheetsCreated = [];
  const canonicalNames = [
    'USERS', 'USER_ACTIVITY', 'MASTER_DATA', 'NSC', 'DISCONNECTION',
    'POLE CASE', 'METER REPLESMENT', 'DTR REPLESMENT', 'SETTINGS', 'WORK_ORDERS', 'CHAT'
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

function getRowsFromSheet(s) {
  if (!s) return [];
  const totalRows = s.getLastRow();
  const totalCols = s.getLastColumn();
  if (totalRows < 2 || totalCols < 1) return [];

  const headers = s.getRange(1, 1, 1, totalCols).getValues()[0].map(h => String(h || '').trim());
  const data = s.getRange(2, 1, totalRows - 1, totalCols).getValues();

  return data.map(r => {
    const item = {};
    headers.forEach((h, i) => {
      if (h) {
        item[h] = r[i];
        const spec = findSpecForHeader(h);
        if (spec) {
          if (item[spec.key] === undefined || item[spec.key] === '') {
            item[spec.key] = r[i];
          }
          if (item[spec.header] === undefined || item[spec.header] === '') {
            item[spec.header] = r[i];
          }
        }
      }
    });
    return item;
  });
}

function appendRowDynamic(sheetOrName, obj, defaultHeaders) {
  const s = typeof sheetOrName === 'string' ? getSheet(sheetOrName) : sheetOrName;
  if (!s) throw Error('Target sheet not found: ' + sheetOrName);
  
  const sheetName = s.getName();
  const canonicalHeaders = defaultHeaders || headersFor(sheetName);

  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, canonicalHeaders.length).setValues([canonicalHeaders]);
    s.setFrozenRows(1);
  }

  // Ensure all canonical/required headers exist safely without duplication
  ensureHeaders(s, canonicalHeaders);

  let currentHeaders = s.getRange(1, 1, 1, Math.max(1, s.getLastColumn())).getValues()[0].map(h => String(h || '').trim());

  // Dynamic Header Detection: Automatically append new columns at the end if completely unknown fields arrive
  const missingHeaders = [];
  Object.keys(obj).forEach(k => {
    const trimmed = String(k || '').trim();
    if (trimmed && !trimmed.startsWith('_') && findColumnIndex(currentHeaders, trimmed) === -1) {
      const spec = findSpecForHeader(trimmed);
      const colToAdd = spec ? spec.header : trimmed;
      if (findColumnIndex(currentHeaders, colToAdd) === -1 && missingHeaders.indexOf(colToAdd) === -1) {
        missingHeaders.push(colToAdd);
      }
    }
  });

  if (missingHeaders.length > 0) {
    const startCol = currentHeaders.length + 1;
    s.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
    currentHeaders = currentHeaders.concat(missingHeaders);
  }

  // Header-based mapping: Extract correct value for each column header
  const rowValues = currentHeaders.map(h => getValueForHeader(obj, h, sheetName));

  s.appendRow(rowValues);
  return obj;
}

function appendRow(sheetName, obj) {
  return appendRowDynamic(sheetName, obj, headersFor(sheetName));
}

function findRowIndex(sheetOrName, key, value) {
  const s = typeof sheetOrName === 'string' ? getSheet(sheetOrName) : sheetOrName;
  if (!s) return -1;
  const totalRows = s.getLastRow();
  const totalCols = s.getLastColumn();
  if (totalRows < 2 || totalCols < 1) return -1;

  const currentHeaders = s.getRange(1, 1, 1, totalCols).getValues()[0].map(h => String(h || '').trim());
  const colIndex = findColumnIndex(currentHeaders, key);
  if (colIndex < 0) return -1;

  const vals = s.getRange(2, colIndex + 1, totalRows - 1, 1).getValues();
  const target = String(value).trim().toLowerCase();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === target) {
      return i + 2;
    }
  }
  return -1;
}

function getRowByIndex(sheetOrName, rowIdx) {
  const s = typeof sheetOrName === 'string' ? getSheet(sheetOrName) : sheetOrName;
  if (!s) return {};
  const totalCols = Math.max(1, s.getLastColumn());
  const headers = s.getRange(1, 1, 1, totalCols).getValues()[0].map(h => String(h || '').trim());
  const rowValues = s.getRange(rowIdx, 1, 1, totalCols).getValues()[0];
  const item = {};
  headers.forEach((h, i) => {
    if (h) item[h] = rowValues[i];
  });
  return item;
}

function updateRow(sheetOrName, key, value, updates) {
  const s = typeof sheetOrName === 'string' ? getSheet(sheetOrName) : sheetOrName;
  if (!s) throw Error('Target sheet not found: ' + sheetOrName);
  const rowIdx = findRowIndex(s, key, value);
  if (rowIdx < 0) throw Error('Record not found in ' + s.getName());

  const totalCols = Math.max(1, s.getLastColumn());
  const currentHeaders = s.getRange(1, 1, 1, totalCols).getValues()[0].map(h => String(h || '').trim());
  const existingValues = s.getRange(rowIdx, 1, 1, totalCols).getValues()[0];

  const existingRow = {};
  currentHeaders.forEach((k, i) => {
    if (k) existingRow[k] = existingValues[i];
  });

  const updatedObj = Object.assign({}, existingRow, updates, { updatedAt: now() });
  const newRowValues = currentHeaders.map(h => {
    const k = String(h || '').trim();
    if (!k) return '';
    return getValueForHeader(updatedObj, k, s.getName());
  });

  s.getRange(rowIdx, 1, 1, totalCols).setValues([newRowValues]);
  return updatedObj;
}

function deleteRow(sheetOrName, key, value) {
  const s = typeof sheetOrName === 'string' ? getSheet(sheetOrName) : sheetOrName;
  if (!s) throw Error('Target sheet not found: ' + sheetOrName);
  const rowIdx = findRowIndex(s, key, value);
  if (rowIdx < 0) throw Error('Record not found in ' + s.getName());
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

// Entry Operations with Strict LockService, Category-Wise Storage & Idempotency Protection
function saveEntry(d) {
  const lock = LockService.getScriptLock();
  // Wait for up to 30 seconds to guarantee atomic execution under concurrent load
  const hasLock = lock.tryLock(30000);
  if (!hasLock) {
    throw Error('Server is busy processing another transaction. Please try again in a moment.');
  }

  try {
    // Step 1: Validate request
    if (!d || typeof d !== 'object') {
      throw Error('Invalid payload: Entry data object is required.');
    }

    // Step 2 & 3: Identify & Normalize category
    const rawCat = d.category || d.Category;
    if (!rawCat) {
      throw Error('Category is required. Allowed categories: NSC, DISCONNECTION, POLE CASE, METER REPLESMENT, DTR REPLESMENT.');
    }
    const canonicalCat = normalizeCategory(rawCat);
    if (!canonicalCat) {
      throw Error('Unrecognized work category: "' + rawCat + '". Allowed: NSC, DISCONNECTION, POLE CASE, METER REPLESMENT, DTR REPLESMENT.');
    }

    // Step 4 & 5: Find the correct destination sheet & verify existence
    const destSheet = getCategorySheet(canonicalCat);
    if (!destSheet) {
      throw Error('Could not open or initialize Google Sheet tab for category: ' + canonicalCat);
    }
    const destSheetName = destSheet.getName();

    // Step 6: Validate and construct verified new entry with complete worker identity
    const submissionId = String(d.submissionId || d.SubmissionID || '').trim();
    const entryId = String(d.id || '').trim() || ('PWR-' + Date.now().toString().slice(-6));
    const finalSubmissionId = submissionId || ('SUB-' + Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase());

    const workerId = String(d.workerId || d.WorkerID || d.idNo || '').trim();
    const workerName = String(d.workerName || d.WorkerName || 'Field Worker').trim();
    const role = String(d.role || d.Role || 'worker').trim();
    const submittedBy = String(d.submittedBy || d.SubmittedBy || (workerId ? (workerName + ' (' + workerId + ')') : workerName)).trim();
    const dateVal = d.date || now();
    const createdAtVal = d.createdAt || d.date || now();

    const newEntry = Object.assign({}, d, {
      submissionId: finalSubmissionId,
      id: entryId,
      category: canonicalCat,
      workerId: workerId,
      workerName: workerName,
      role: role,
      submittedBy: submittedBy,
      date: dateVal,
      createdAt: createdAtVal,
      status: d.status || 'Completed',
      updatedAt: now()
    });

    // Step 7: Check duplicate SubmissionID (in category sheet first, then MASTER_DATA)
    if (finalSubmissionId) {
      const existingInCat = findRowIndex(destSheet, 'submissionId', finalSubmissionId);
      if (existingInCat > 0) {
        const existingRow = getRowByIndex(destSheet, existingInCat);
        return {
          success: true,
          duplicate: true,
          message: 'Record already saved with this Submission ID in ' + destSheetName,
          destinationSheet: destSheetName,
          category: canonicalCat,
          recordId: existingRow.id || entryId,
          submissionId: finalSubmissionId,
          entry: existingRow,
          data: existingRow
        };
      }

      const existingInMaster = findRowIndex('MASTER_DATA', 'submissionId', finalSubmissionId);
      if (existingInMaster > 0) {
        const existingRow = getRowByIndex('MASTER_DATA', existingInMaster);
        return {
          success: true,
          duplicate: true,
          message: 'Record already saved with this Submission ID in MASTER_DATA',
          destinationSheet: destSheetName,
          category: canonicalCat,
          recordId: existingRow.id || entryId,
          submissionId: finalSubmissionId,
          entry: existingRow,
          data: existingRow
        };
      }
    }

    // Check by Record ID if not an explicit update
    if (entryId && !d._isExplicitUpdate) {
      const existingById = findRowIndex(destSheet, 'id', entryId);
      if (existingById > 0) {
        const existingRow = getRowByIndex(destSheet, existingById);
        return {
          success: true,
          duplicate: true,
          message: 'Record already saved with this ID in ' + destSheetName,
          destinationSheet: destSheetName,
          category: canonicalCat,
          recordId: existingRow.id || entryId,
          submissionId: existingRow.submissionId || finalSubmissionId,
          entry: existingRow,
          data: existingRow
        };
      }
    }

    // Semantic Deduplication Guard: Check if identical record was submitted within last 3 minutes
    if (d.consumerId && d.meterNo) {
      const recentRows = getRowsFromSheet(destSheet).slice(-30);
      const cleanConsumer = String(d.consumerId).trim().toLowerCase();
      const cleanMeter = String(d.meterNo).trim().toLowerCase();
      const cleanWorker = String(workerName).trim().toLowerCase();

      const matched = recentRows.find(r => {
        const sameConsumer = String(r.consumerId || '').trim().toLowerCase() === cleanConsumer;
        const sameMeter = String(r.meterNo || '').trim().toLowerCase() === cleanMeter;
        const sameWorker = cleanWorker ? String(r.workerName || '').trim().toLowerCase() === cleanWorker : true;
        if (sameConsumer && sameMeter && sameWorker) {
          const recTime = new Date(r.createdAt || r.date || 0).getTime();
          const currTime = new Date(createdAtVal).getTime();
          return Math.abs(currTime - recTime) < 180000; // 3 minutes window
        }
        return false;
      });

      if (matched) {
        return {
          success: true,
          duplicate: true,
          message: 'Identical record already saved recently in ' + destSheetName,
          destinationSheet: destSheetName,
          category: canonicalCat,
          recordId: matched.id,
          submissionId: matched.submissionId || finalSubmissionId,
          entry: matched,
          data: matched
        };
      }
    }

    // Step 8: Save data only in the matching category sheet (PRIMARY DESTINATION)
    appendRowDynamic(destSheet, newEntry, headersFor(canonicalCat));

    // Also mirror to MASTER_DATA index layer
    try {
      const masterSheet = getSheet('MASTER_DATA');
      const masterIdx = findRowIndex(masterSheet, 'submissionId', finalSubmissionId);
      if (masterIdx <= 0) {
        appendRowDynamic(masterSheet, newEntry, COMMON_ENTRY_HEADERS);
      }
    } catch (e) {
      Logger.log('MASTER_DATA mirror warning: ' + e);
    }

    try { CacheService.getScriptCache().remove('dashboard_stats'); } catch (e) {}

    // Step 9: Return valid success response
    return {
      success: true,
      duplicate: false,
      message: 'Data saved successfully in ' + destSheetName,
      destinationSheet: destSheetName,
      category: canonicalCat,
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

function removeEntry(id, submissionId, category) {
  const targetId = id || submissionId;
  if (!targetId) return false;

  // 1. Remove from category sheet
  if (category) {
    const canonicalCat = normalizeCategory(category);
    if (canonicalCat) {
      try {
        const catSheet = getCategorySheet(canonicalCat);
        if (id) {
          try { deleteRow(catSheet, 'id', id); } catch (e) {}
        }
        if (submissionId) {
          try { deleteRow(catSheet, 'submissionId', submissionId); } catch (e) {}
        }
      } catch (e) {}
    }
  } else {
    // Check all category sheets if category not passed
    const categorySheets = ['NSC', 'DISCONNECTION', 'POLE CASE', 'METER REPLESMENT', 'DTR REPLESMENT'];
    categorySheets.forEach(cat => {
      try {
        const catSheet = getCategorySheet(cat);
        if (id) {
          try { deleteRow(catSheet, 'id', id); } catch (e) {}
        }
        if (submissionId) {
          try { deleteRow(catSheet, 'submissionId', submissionId); } catch (e) {}
        }
      } catch (e) {}
    });
  }

  // 2. Remove from MASTER_DATA
  try {
    if (id) {
      try { deleteRow('MASTER_DATA', 'id', id); } catch (e) {}
    }
    if (submissionId) {
      try { deleteRow('MASTER_DATA', 'submissionId', submissionId); } catch (e) {}
    }
  } catch (e) {}

  try { CacheService.getScriptCache().remove('dashboard_stats'); } catch (e) {}
  return true;
}

function updateEntryRecord(data, id) {
  const targetId = id || data.id || data.submissionId;
  if (!targetId) throw Error('ID or submissionId is required to update entry');

  const rawCat = data.category || data.Category;
  const canonicalCat = normalizeCategory(rawCat);
  let updatedRecord = null;

  if (canonicalCat) {
    try {
      const catSheet = getCategorySheet(canonicalCat);
      const rowById = findRowIndex(catSheet, 'id', targetId);
      const rowBySub = findRowIndex(catSheet, 'submissionId', targetId);
      if (rowById > 0) {
        updatedRecord = updateRow(catSheet, 'id', targetId, Object.assign({}, data, { _isExplicitUpdate: true }));
      } else if (rowBySub > 0) {
        updatedRecord = updateRow(catSheet, 'submissionId', targetId, Object.assign({}, data, { _isExplicitUpdate: true }));
      }
    } catch (e) {
      Logger.log('Category update error: ' + e);
    }
  }

  // Also update in MASTER_DATA
  try {
    const rowById = findRowIndex('MASTER_DATA', 'id', targetId);
    const rowBySub = findRowIndex('MASTER_DATA', 'submissionId', targetId);
    if (rowById > 0) {
      const mUpdated = updateRow('MASTER_DATA', 'id', targetId, Object.assign({}, data, { _isExplicitUpdate: true }));
      if (!updatedRecord) updatedRecord = mUpdated;
    } else if (rowBySub > 0) {
      const mUpdated = updateRow('MASTER_DATA', 'submissionId', targetId, Object.assign({}, data, { _isExplicitUpdate: true }));
      if (!updatedRecord) updatedRecord = mUpdated;
    }
  } catch (e) {
    Logger.log('MASTER_DATA update error: ' + e);
  }

  try { CacheService.getScriptCache().remove('dashboard_stats'); } catch (e) {}
  return updatedRecord || data;
}

function queryEntries(params) {
  let list = [];
  const requestedCat = params.category ? String(params.category).trim() : '';

  if (requestedCat && requestedCat.toUpperCase() !== 'ALL') {
    const canonicalCat = normalizeCategory(requestedCat);
    if (!canonicalCat) {
      return [];
    }
    // Read directly from the category's Google Sheet tab
    try {
      const catSheet = getCategorySheet(canonicalCat);
      list = getRowsFromSheet(catSheet);
    } catch (e) {
      Logger.log('Error reading category sheet ' + canonicalCat + ': ' + e);
      list = [];
    }

    // Fallback: If category sheet was empty or new, check MASTER_DATA for any previously logged entries
    if (!list || list.length === 0) {
      try {
        const masterRows = getRows('MASTER_DATA');
        list = masterRows.filter(e => normalizeCategory(e.category) === canonicalCat);
      } catch (e) {}
    }
  } else {
    // Read from MASTER_DATA
    try {
      list = getRows('MASTER_DATA');
    } catch (e) {
      list = [];
    }

    // If MASTER_DATA is empty, compile across all 5 category sheets
    if (!list || list.length === 0) {
      const categories = ['NSC', 'DISCONNECTION', 'POLE CASE', 'METER REPLESMENT', 'DTR REPLESMENT'];
      const combined = [];
      const seen = {};
      categories.forEach(cat => {
        try {
          const s = getCategorySheet(cat);
          const rows = getRowsFromSheet(s);
          rows.forEach(r => {
            const key = r.submissionId || r.id;
            if (key && !seen[key]) {
              seen[key] = true;
              combined.push(r);
            } else if (!key) {
              combined.push(r);
            }
          });
        } catch (e) {}
      });
      list = combined;
    }
  }
  
  if (params.workerId || params.workerName) {
    const wId = String(params.workerId || '').toLowerCase().trim();
    const wName = String(params.workerName || '').toLowerCase().trim();
    list = list.filter(e => {
      const eWId = String(e.workerId || e.idNo || '').toLowerCase().trim();
      const eWName = String(e.workerName || '').toLowerCase().trim();
      const eCreator = String(e.createdBy || e.submittedBy || '').toLowerCase().trim();
      if (wId && (eWId === wId || eCreator.indexOf(wId) >= 0)) return true;
      if (wName && eWName.indexOf(wName) >= 0) return true;
      return false;
    });
  }

  if (params.status && params.status !== 'ALL') {
    list = list.filter(e => String(e.status).toLowerCase() === String(params.status).toLowerCase());
  }

  if (params.search) {
    const q = String(params.search).toLowerCase();
    list = list.filter(e => 
      (e.id && String(e.id).toLowerCase().indexOf(q) >= 0) ||
      (e.submissionId && String(e.submissionId).toLowerCase().indexOf(q) >= 0) ||
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

    if (action === 'login' || action === 'authenticate') {
      return out({ success: true, session: authenticateUser(p.idNo, p.password) });
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
    if (action === 'getNscHeaders' || action === 'nscHeaders') {
      const s = getCategorySheet('NSC');
      ensureHeaders(s, NSC_HEADERS);
      const headers = s.getRange(1, 1, 1, Math.max(1, s.getLastColumn())).getValues()[0].map(h => String(h || '').trim());
      return out({ success: true, sheet: s.getName(), headers: headers, requiredHeaders: NSC_HEADERS });
    }
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
      const targetId = body.id || data.id || body.submissionId || data.submissionId;
      if (action === 'updateNSC' || action === 'updateNewConnection') data.category = data.category || 'NSC';
      if (action === 'updateDisconnection') data.category = data.category || 'DISCONNECTION';
      if (action === 'updatePoleCase') data.category = data.category || 'POLE CASE';
      if (action === 'updateMeterReplacement') data.category = data.category || 'METER REPLESMENT';
      if (action === 'updateDTRReplacement') data.category = data.category || 'DTR REPLESMENT';
      const updated = updateEntryRecord(data, targetId);
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
      const subId = body.submissionId || data.submissionId;
      let cat = body.category || data.category;
      if (action === 'deleteNSC' || action === 'deleteNewConnection') cat = cat || 'NSC';
      if (action === 'deleteDisconnection') cat = cat || 'DISCONNECTION';
      if (action === 'deletePoleCase') cat = cat || 'POLE CASE';
      if (action === 'deleteMeterReplacement') cat = cat || 'METER REPLESMENT';
      if (action === 'deleteDTRReplacement') cat = cat || 'DTR REPLESMENT';
      removeEntry(targetId, subId, cat);
      return out({ success: true, message: 'Entry deleted successfully from Google Sheets' });
    }
    if (action === 'cleanupDuplicates' || action === 'deduplicateSheets') {
      return out(cleanupDuplicateRecords(body.sheetName));
    }
    if (action === 'syncNscHeaders' || action === 'ensureNscHeaders') {
      const s = getCategorySheet('NSC');
      ensureHeaders(s, NSC_HEADERS);
      const headers = s.getRange(1, 1, 1, Math.max(1, s.getLastColumn())).getValues()[0].map(h => String(h || '').trim());
      return out({ success: true, message: 'NSC headers synchronized successfully', sheet: s.getName(), headers: headers, requiredHeaders: NSC_HEADERS });
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
