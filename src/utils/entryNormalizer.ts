import { PowerEntry } from '../types';

/**
 * Cleans Worker or Agency name so ONLY the name is displayed (strips IDs, bracketed codes, phone numbers, etc.)
 */
export function cleanNameOnly(rawName?: string): string {
  if (!rawName) return '';
  let s = String(rawName).trim();
  // Remove bracketed IDs like (ID: 1234), (LM-101), (WRK-01), [ID: ...], etc.
  s = s.replace(/\s*\((?:ID|WRK|LM|USR|ADM|EMP|AGENCY|CODE|NO|#)?[^)]*\)/gi, '');
  s = s.replace(/\s*\[[^\]]*\]/g, '');
  // Remove trailing "- ID: ..." or "| ID: ..."
  s = s.replace(/\s*[-|•]\s*(?:ID|WRK|LM|USR|Badge)?\s*[:#-]?\s*[A-Za-z0-9_-]+$/gi, '');
  // If string starts with "ID:" or similar prefix, strip it
  s = s.replace(/^(?:ID|Worker ID|Agency ID)\s*[:#-]?\s*/gi, '');
  return s.trim();
}

/**
 * Universal Entry Normalizer for POWER Utility Management.
 * Detects legacy/shifted Google Sheet column orders and 33-column Disconnection sheet headers,
 * normalizing them into standard, strictly typed PowerEntry objects.
 */
export function normalizeEntry(entry: any): PowerEntry {
  if (!entry || typeof entry !== 'object') {
    return entry;
  }

  const raw: any = { ...entry };

  // Normalize Category (handle 'Disconnection' -> 'DISCONNECTION')
  const rawCat = String(raw.category || raw['Category'] || 'NSC').trim();
  const rawCatUpper = rawCat.toUpperCase();
  if (rawCatUpper === 'DISCONNECTION' || rawCatUpper === 'DISCONNECT') {
    raw.category = 'DISCONNECTION';
  } else {
    raw.category = rawCat;
  }

  const isDisc = raw.category === 'DISCONNECTION';
  const isNscOrDisc = isDisc || raw.category === 'NSC';

  // Map Google Sheet display headers and alternative keys to camelCase properties if missing
  raw.consumerId = raw.consumerId || raw['Consumer Id'] || raw['Consumer ID'] || raw['Consumer Number'] || raw['Consumer No'] || '';
  raw.consumerName = raw.consumerName || raw['Name'] || raw['Consumer Name'] || raw['Customer Name'] || '';
  raw.submissionId = raw.submissionId || raw['Submission ID'] || raw['SubmissionID'] || raw['submission_id'] || (isDisc ? String(raw.consumerId || raw.taskId || '') : '');
  raw.id = raw.id || raw['Record ID'] || raw['RecordID'] || raw['record_id'] || raw['ID'] || (isDisc ? String(raw.consumerId || raw.taskId || '') : '');

  if (isDisc) {
    raw.status = raw['Discon Status'] || raw.disconStatus || raw.taskStatus || raw.status || raw['Status'] || 'PENDING';
  } else {
    raw.status = raw.status || raw['Status'] || 'Completed';
  }

  raw.date = raw.date || raw['Date'] || raw['Discon Date'] || raw['Upload Date'] || raw.createdAt || '';
  raw.createdAt = raw.createdAt || raw['Created At'] || raw['Upload Date'] || raw.date || '';
  raw.updatedAt = raw.updatedAt || raw['Updated At'] || raw['Last Updated'] || '';

  raw.workerId = '';
  raw.workerName = cleanNameOnly(raw.workerName || raw['Worker Name'] || raw['Lineman Name'] || raw['NSC Worker Name'] || raw['Agency'] || raw.agency || '');
  raw.role = raw.role || raw['Role'] || '';
  raw.submittedBy = cleanNameOnly(raw.submittedBy || raw['Submitted By'] || raw.workerName || '');
  raw.workerPhone = raw.workerPhone || raw['Worker Phone'] || '';

  raw.agencyName = cleanNameOnly(raw.agencyName || raw['Agency Name'] || raw['Agency'] || raw.agency || '');
  raw.cccName = raw.cccName || raw['CCC Name'] || raw['MRU'] || raw.mru || '';
  raw.substation = isNscOrDisc ? '' : (raw.substation || raw['Substation'] || '');
  raw.feederName = isNscOrDisc ? '' : (raw.feederName || raw['Feeder Name'] || '');

  raw.workOrderNo = raw.workOrderNo || raw['Work Order No'] || raw['Work Order Number'] || '';
  raw.workOrderDate = raw.workOrderDate || raw['Work Order Date'] || '';
  raw.workOrderNoticeId = raw.workOrderNoticeId || raw['Work Order Notice ID'] || '';
  raw.workOrderNoticeTitle = raw.workOrderNoticeTitle || raw['Work Order Notice Title'] || '';
  raw.workOrderNoticeDate = raw.workOrderNoticeDate || raw['Work Order Notice Date'] || '';
  raw.workOrderPhoto = raw.workOrderPhoto || raw['Work Order Photo'] || '';

  raw.applicationNo = raw.applicationNo || raw['Application No'] || raw['Application Number'] || '';
  raw.fatherName = raw.fatherName || raw['Father Name'] || raw['Father / Husband Name'] || '';
  raw.mobile = raw.mobile || raw['Mobile Number'] || raw['Mobile No'] || raw['Mobile'] || raw.phoneNumber || '';
  raw.address = raw.address || raw['Address'] || raw.consumerAddress || '';

  raw.appliedLoad = raw.appliedLoad || raw['Applied Load'] || '';
  raw.phase = raw.phase || raw['Device'] || raw['BClass/Phase'] || raw['Supply Phase'] || raw['Phase'] || raw.deviceType || '';
  raw.tariffCategory = raw.tariffCategory || raw['Base Class'] || raw['Class'] || raw['Tariff Category'] || raw.baseClass || '';
  raw.serviceCableLength = raw.serviceCableLength || raw['Service Cable Length'] || '';
  raw.poleNo = raw.poleNo || raw['Pole No'] || raw['Gis Pole'] || raw.gisPole || '';
  raw.earthResistance = raw.earthResistance || raw['Earth Resistance'] || '';

  raw.meterNo = raw.meterNo || raw['Number'] || raw['Meter'] || raw['Meter No'] || raw['Meter Number'] || raw.meterNumber || '';
  raw.meterMake = raw.meterMake || raw['Meter Make'] || '';
  raw.initialReading = raw.initialReading || raw['Initial Reading'] || raw['Reading'] || raw.reading || '';
  raw.sealNo = raw.sealNo || raw['Meter Seal No'] || raw['Seal No'] || '';
  raw.meterInstallDate = raw.meterInstallDate || raw['Meter Install Date'] || '';
  raw.inspectionAgencyName = raw.inspectionAgencyName || raw['Inspection Agency Name'] || '';

  raw.arrearAmount = raw.arrearAmount || raw['D2 Net O/S'] || raw['Arrear Amount'] || raw.outstandingDue || '';
  raw.dueDateRange = raw.dueDateRange || raw['O/S Duedate Range'] || raw['O/S Due date Range'] || '';
  raw.govStatus = raw.govStatus || raw['Gov/Non-Gov'] || '';

  raw.locationGps = raw.locationGps || raw['GPS Location'] || raw['Location GPS'] || '';
  raw.photoUrl = raw.photoUrl || raw['Image'] || raw['Photo Evidence'] || raw['Photo URL'] || raw.directImageUrl || '';
  raw.notes = raw.notes || raw['Notes'] || raw.workerRemarks || '';

  const cName = String(raw.consumerName || '').trim();
  const cId = String(raw.consumerId || '').trim();
  const mNo = String(raw.meterNo || '').trim();
  const initR = String(raw.initialReading || '').trim();
  const fName = String(raw.feederName || '').trim();
  const sub = String(raw.substation || '').trim();
  const workOrd = String(raw.workOrderNo || '').trim();
  const notesVal = String(raw.notes || '').trim();
  const updatedVal = String(raw.updatedAt || '').trim();

  const isShifted =
    !isDisc && (
      (cName && (/^CON/i.test(cName) || /^\d{8,12}$/.test(cName)) && mNo && (mNo.includes(' ') || /[a-zA-Z]{3,}\s+[a-zA-Z]{3,}/.test(mNo) || /[\u0980-\u09FF]/.test(mNo))) ||
      (initR && /^APP/i.test(initR)) ||
      (sub && /^[6-9]\d{9}$/.test(sub.replace(/\D/g, ''))) ||
      (cId && (cId.toLowerCase().includes('feeder') || cId.toLowerCase().includes('substation') || cId.toLowerCase().includes('kv') || cId.toLowerCase().includes('town') || cId.toLowerCase().includes('bazar'))) ||
      (fName && (fName.toLowerCase().includes('sub-') || fName.toLowerCase().includes('substation') || fName.toLowerCase().includes('33/11') || fName.toLowerCase().includes('132/33')))
    );

  let normalized: PowerEntry;

  if (isShifted) {
    const isMobileInWorkOrder = /^[6-9]\d{9}$/.test(workOrd.replace(/\D/g, ''));
    const isAppliedLoadInNotes = /kw|hp|phase|w|load/i.test(notesVal);
    const isPhaseInUpdatedAt = /phase/i.test(updatedVal);

    normalized = {
      ...raw,
      id: String(raw.id || '').trim(),
      category: raw.category || 'NSC',
      status: raw.status || 'Completed',
      date: raw.date || raw.createdAt || new Date().toISOString(),
      createdAt: raw.createdAt || raw.date || new Date().toISOString(),
      workerName: String(raw.workerName || '').trim(),
      workerPhone: String(raw.substation || raw.workerPhone || '').trim(),
      substation: String(raw.feederName || raw.substation || '').trim(),
      feederName: String(raw.consumerId || raw.feederName || '').trim(),
      consumerId: String(raw.consumerName || raw.consumerId || '').trim(),
      consumerName: String(raw.meterNo || raw.consumerName || '').trim(),
      fatherName: String(raw.sealNo || raw.fatherName || '').trim(),
      applicationNo: String(raw.initialReading || raw.applicationNo || '').trim(),
      meterNo: String(raw.finalReading || (mNo.includes(' ') ? '' : raw.meterNo) || '').trim(),
      sealNo: String(raw.address || raw.sealNo || '').trim(),
      initialReading: String(raw.initialReading && !/^APP/i.test(raw.initialReading) ? raw.initialReading : (raw.finalReading || '000000')).trim(),
      finalReading: '',
      mobile: isMobileInWorkOrder ? workOrd : (raw.mobile || ''),
      address: String(raw.locationGps || raw.address || '').trim(),
      workOrderNo: isMobileInWorkOrder ? '' : String(raw.workOrderNo || '').trim(),
      locationGps: isAppliedLoadInNotes ? '' : String(raw.locationGps || '').trim(),
      appliedLoad: isAppliedLoadInNotes ? notesVal : (raw.appliedLoad || ''),
      phase: isPhaseInUpdatedAt ? updatedVal : (raw.phase || '1 Phase'),
      notes: isAppliedLoadInNotes || isPhaseInUpdatedAt ? '' : String(raw.notes || '').trim(),
      photoUrl: String(raw.photoUrl && (raw.photoUrl.startsWith('http') || raw.photoUrl.startsWith('data:')) ? raw.photoUrl : (raw.directImageUrl || '')),
      updatedAt: String(raw[''] || raw.updatedAt || raw.createdAt || new Date().toISOString())
    };
  } else {
    normalized = {
      ...raw,
      id: String(raw.id || '').trim(),
      category: raw.category || 'NSC',
      status: raw.status || 'Completed',
      date: raw.date || raw.createdAt || new Date().toISOString(),
      createdAt: raw.createdAt || raw.date || new Date().toISOString(),
      consumerName: String(raw.consumerName || '').trim(),
      consumerId: String(raw.consumerId || '').trim(),
      meterNo: String(raw.meterNo || '').trim(),
      workerName: String(raw.workerName || '').trim(),
      workerPhone: String(raw.workerPhone || '').trim(),
      substation: String(raw.substation || '').trim(),
      feederName: String(raw.feederName || '').trim(),
      applicationNo: String(raw.applicationNo || '').trim(),
      fatherName: String(raw.fatherName || '').trim(),
      address: String(raw.address || '').trim(),
      notes: String(raw.notes || '').trim(),
      photoUrl: String(raw.photoUrl || raw.directImageUrl || '')
    };
  }

  // Ensure consumerName is never empty if consumerId is known (for non-Disconnection categories)
  if (!isDisc && !normalized.consumerName && normalized.consumerId) {
    normalized.consumerName = `Consumer (${normalized.consumerId})`;
  }

  // Standardize Google Drive thumbnail images for photos
  if (normalized.photoUrl && normalized.photoUrl.includes('drive.google.com') && !normalized.photoUrl.includes('thumbnail')) {
    const match = normalized.photoUrl.match(/[\/=]([a-zA-Z0-9_-]{25,})/);
    if (match && match[1]) {
      normalized.photoUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w2000`;
    }
  }

  return normalized;
}

/**
 * Validates that a Disconnection record has both a real Consumer ID (not SL001/PWR-DIS/TASK-DISC)
 * and a real Consumer Name (not "Consumer", "Worker", "Unknown", or blank).
 */
export function isValidDisconnectionEntry(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  const rawCId = String(item.consumerId || item['Consumer Id'] || item['Consumer ID'] || item.accountNumber || '').trim();
  const isBadId = !rawCId || /^(PWR-DIS-|TASK-DISC-|DISC-\d+|SL\s*\d+|N\/A|NA|null|undefined|0|-)$/i.test(rawCId);
  if (isBadId) return false;

  const rawName = String(item.consumerName || item['Name'] || item.Name || item.name || '').trim();
  const isBadName = !rawName || /^(Consumer|Consumer\s*\(.*\)|Worker|Unnamed Consumer|Unknown Consumer|Unknown|Demo|Test|N\/A|NA|null|undefined|-)$/i.test(rawName);
  if (isBadName) return false;

  return true;
}

/**
 * Strict Deduplication Guard:
 * Ensures that 1 worker submission / consumer record = exactly 1 entry shown to Admin & Worker,
 * and filters out any deleted records.
 */
export function deduplicateEntries(entries: PowerEntry[]): PowerEntry[] {
  if (!Array.isArray(entries)) return [];

  const seenKeys = new Set<string>();
  const uniqueList: PowerEntry[] = [];

  for (const raw of entries) {
    if (!raw) continue;
    const item = normalizeEntry(raw);

    // Filter out any deleted records
    const stUpper = String(item.status || (item as any).disconStatus || (item as any)['Discon Status'] || '').trim().toUpperCase();
    const notesStr = String(item.notes || (item as any)['Notes'] || '').trim();
    if (stUpper === 'DELETED' || notesStr.includes('[DELETED_BY_ADMIN]')) {
      continue;
    }

    const catVal = String(item.category || '').trim().toUpperCase();
    if (catVal === 'DISCONNECTION' && !isValidDisconnectionEntry(item)) {
      continue;
    }

    // Skip empty ghost rows (records where no real form data was provided)
    const hasMeaningfulData = Boolean(
      item.consumerName ||
      item.consumerId ||
      item.applicationNo ||
      item.meterNo ||
      item.feederName ||
      item.poleNo ||
      item.dtrName ||
      item.substation ||
      (item.category && item.workerName && catVal !== 'DISCONNECTION')
    );

    if (!hasMeaningfulData) {
      continue;
    }

    const subId = item.submissionId ? String(item.submissionId).trim() : '';
    const idVal = item.id ? String(item.id).trim() : '';
    const consVal = String(item.consumerId || '').trim().toLowerCase();
    const meterVal = String(item.meterNo || '').trim().toLowerCase();
    const appNo = String(item.applicationNo || '').trim().toLowerCase();

    let primaryKey = '';
    if (catVal === 'DISCONNECTION' && consVal) {
      primaryKey = `DISC:${consVal}`;
    } else if (subId && subId.startsWith('SUB-')) {
      primaryKey = `SUB:${subId}`;
    } else if (idVal && idVal.startsWith('PWR-')) {
      primaryKey = `ID:${idVal}`;
    } else if (consVal && meterVal) {
      primaryKey = `DATA:${catVal}:${consVal}:${meterVal}`;
    } else if (consVal) {
      primaryKey = `CONS:${catVal}:${consVal}`;
    } else if (appNo) {
      primaryKey = `APP:${catVal}:${appNo}`;
    } else {
      primaryKey = `RAW:${idVal || Math.random()}`;
    }

    if (!seenKeys.has(primaryKey)) {
      seenKeys.add(primaryKey);
      uniqueList.push(item);
    }
  }

  return uniqueList;
}
