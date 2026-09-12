import { PowerEntry } from '../types';

/**
 * Universal Entry Normalizer for POWER Utility Management.
 * Detects legacy/shifted Google Sheet column orders and normalizes
 * them into standard, strictly typed PowerEntry objects.
 */
export function normalizeEntry(entry: any): PowerEntry {
  if (!entry || typeof entry !== 'object') {
    return entry;
  }

  const raw = { ...entry };

  const cName = String(raw.consumerName || '').trim();
  const cId = String(raw.consumerId || '').trim();
  const mNo = String(raw.meterNo || '').trim();
  const initR = String(raw.initialReading || '').trim();
  const fName = String(raw.feederName || '').trim();
  const sub = String(raw.substation || '').trim();
  const workOrd = String(raw.workOrderNo || '').trim();
  const notesVal = String(raw.notes || '').trim();
  const updatedVal = String(raw.updatedAt || '').trim();

  // Signature of shifted Google Sheet row:
  // When an older GAS version appended [id, cat, status, date, createdAt, workerName, workerPhone, substation, feederName, consumerId, consumerName, fatherName, applicationNo, meterNo, sealNo, initialReading, address, workOrderNo, locationGps, notes, updatedAt]
  // against sheet headers [id, cat, status, date, createdAt, workerName, substation, feederName, consumerId, consumerName, meterNo, sealNo, initialReading, finalReading, address, workOrderNo, locationGps, photoUrl, notes, updatedAt]:
  const isShifted =
    // Pattern 1: consumerName has 'CON...' or numeric ID, and meterNo has a name with spaces or Bengali/letters
    (cName && (/^CON/i.test(cName) || /^\d{8,12}$/.test(cName)) && mNo && (mNo.includes(' ') || /[a-zA-Z]{3,}\s+[a-zA-Z]{3,}/.test(mNo) || /[\u0980-\u09FF]/.test(mNo))) ||
    // Pattern 2: initialReading starts with 'APP' or looks like an application number
    (initR && /^APP/i.test(initR)) ||
    // Pattern 3: substation contains a phone number (10 digits)
    (sub && /^[6-9]\d{9}$/.test(sub.replace(/\D/g, ''))) ||
    // Pattern 4: consumerId contains feeder identifiers
    (cId && (cId.toLowerCase().includes('feeder') || cId.toLowerCase().includes('substation') || cId.toLowerCase().includes('kv') || cId.toLowerCase().includes('town') || cId.toLowerCase().includes('bazar'))) ||
    // Pattern 5: feederName looks like a substation name
    (fName && (fName.toLowerCase().includes('sub-') || fName.toLowerCase().includes('substation') || fName.toLowerCase().includes('33/11') || fName.toLowerCase().includes('132/33')));

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

  // Ensure consumerName is never empty if consumerId is known
  if (!normalized.consumerName && normalized.consumerId) {
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
 * Strict Deduplication Guard:
 * Ensures that 1 worker submission = exactly 1 entry shown to Admin & Worker.
 */
export function deduplicateEntries(entries: PowerEntry[]): PowerEntry[] {
  if (!Array.isArray(entries)) return [];

  const seenKeys = new Set<string>();
  const uniqueList: PowerEntry[] = [];

  for (const raw of entries) {
    if (!raw) continue;
    const item = normalizeEntry(raw);

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
      (item.category && item.workerName)
    );

    if (!hasMeaningfulData) {
      continue;
    }

    const subId = item.submissionId ? String(item.submissionId).trim() : '';
    const idVal = item.id ? String(item.id).trim() : '';
    const catVal = String(item.category || '').trim().toUpperCase();
    const consVal = String(item.consumerId || '').trim().toLowerCase();
    const meterVal = String(item.meterNo || '').trim().toLowerCase();
    const appNo = String(item.applicationNo || '').trim().toLowerCase();

    let primaryKey = '';
    if (subId && subId.startsWith('SUB-')) {
      primaryKey = `SUB:${subId}`;
    } else if (idVal && idVal.startsWith('PWR-')) {
      primaryKey = `ID:${idVal}`;
    } else if (consVal && meterVal) {
      primaryKey = `DATA:${catVal}:${consVal}:${meterVal}`;
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
