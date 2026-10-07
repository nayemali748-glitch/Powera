import { DisconnectionTask } from '../types';

export type PhaseFilterType = 'ALL' | '1PH' | '3PH';
export type ConnectionClassFilterType = 'ALL' | 'DOMESTIC' | 'COMMERCIAL' | 'INDUSTRIAL' | 'STW';
export type ClassFilterType = ConnectionClassFilterType;
export type StatusFilterType = 'ALL' | 'Paid' | 'Disconnected' | 'Connected' | 'Not Found' | 'Dispute' | string;

/**
 * Determines whether a DisconnectionTask is 1-Phase ('1PH') or 3-Phase ('3PH').
 * Inspects Device, BClass/Phase, Nature of Conn, Class, and Base Class fields.
 */
export function getTaskPhase(task: DisconnectionTask): '1PH' | '3PH' {
  const deviceRaw = String(
    task.deviceType ||
    (task as any).device ||
    (task as any)['Device'] ||
    (task as any)['BClass/Phase'] ||
    (task as any).bClassPhase ||
    (task as any).phase ||
    ''
  ).trim().toUpperCase();

  const natureRaw = String(
    task.natureOfConn ||
    (task as any)['Nature of Conn'] ||
    ''
  ).trim().toUpperCase();

  const classRaw = String(
    task.baseClass ||
    (task as any)['Base Class'] ||
    (task as any)['Class'] ||
    task.classType ||
    ''
  ).trim().toUpperCase();

  const combined = `${deviceRaw} ${natureRaw} ${classRaw}`;

  // Explicit 3-Phase indicators
  if (
    /\b3\s*-?\s*P(H|HASE)?\b/i.test(combined) ||
    /\bTHREE\s*-?\s*PHASE\b/i.test(combined) ||
    /\bIII\b/.test(deviceRaw) ||
    /\(III\)/.test(combined) ||
    deviceRaw === '3' ||
    deviceRaw === '3P' ||
    deviceRaw === '3PH' ||
    natureRaw === '3' ||
    natureRaw === '3P' ||
    natureRaw === '3PH' ||
    natureRaw.includes('3 PHASE') ||
    natureRaw.includes('3-PHASE') ||
    natureRaw.includes('THREE')
  ) {
    return '3PH';
  }

  // Explicit 1-Phase indicators
  if (
    /\b1\s*-?\s*P(H|HASE)?\b/i.test(combined) ||
    /\bSINGLE\s*-?\s*PHASE\b/i.test(combined) ||
    /\bI\b/.test(deviceRaw) ||
    /\(I\)/.test(combined) ||
    deviceRaw === '1' ||
    deviceRaw === '1P' ||
    deviceRaw === '1PH' ||
    natureRaw === '1' ||
    natureRaw === '1P' ||
    natureRaw === '1PH' ||
    natureRaw.includes('1 PHASE') ||
    natureRaw.includes('1-PHASE') ||
    natureRaw.includes('SINGLE')
  ) {
    return '1PH';
  }

  // If class is Industrial or STW/Agriculture and no explicit 1PH marker exists, it is typically 3-Phase
  const connClass = getTaskConnectionClass(task);
  if (connClass === 'INDUSTRIAL' || connClass === 'STW') {
    return '3PH';
  }

  return '1PH';
}

function normalizeDisconnectionClassValue(rawVal: unknown): 'DOMESTIC' | 'COMMERCIAL' | 'INDUSTRIAL' | 'STW' | '' {
  if (rawVal === null || rawVal === undefined) return '';
  const normalized = String(rawVal).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return '';

  // Exact normalized logical matching (including Rural/Urban suffixes and WBSEDCL Base Class codes in Google Sheets)
  if (
    normalized === 'domestic' ||
    normalized === 'domestic rural' ||
    normalized === 'domestic urban' ||
    /^d\s*-\s*[13]\s*phase$/.test(normalized)
  ) {
    return 'DOMESTIC';
  }

  if (
    normalized === 'commercial' ||
    normalized === 'commercial rural' ||
    normalized === 'commercial urban' ||
    /^c\s*-\s*[13]\s*phase$/.test(normalized)
  ) {
    return 'COMMERCIAL';
  }

  if (
    normalized === 'industrial' ||
    normalized === 'industrial rural' ||
    normalized === 'industrial urban' ||
    /^i\s*-\s*[13]\s*phase$/.test(normalized)
  ) {
    return 'INDUSTRIAL';
  }

  if (
    normalized === 'agriculture' ||
    normalized === 'agriculture rural' ||
    normalized === 'agriculture urban' ||
    normalized === 'stw' ||
    /^a\s*-\s*[13]\s*phase$/.test(normalized)
  ) {
    return 'STW';
  }

  // Whole-word exact token match (never partial substring match)
  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.includes('agriculture') || words.includes('stw')) return 'STW';
  if (words.includes('industrial')) return 'INDUSTRIAL';
  if (words.includes('commercial')) return 'COMMERCIAL';
  if (words.includes('domestic')) return 'DOMESTIC';

  return '';
}

/**
 * Classifies a DisconnectionTask using ONLY the actual Google Sheets Class / Base Class fields:
 * - DOMESTIC   <- Domestic
 * - COMMERCIAL <- Commercial
 * - INDUSTRIAL <- Industrial
 * - STW        <- Agriculture (or STW)
 * - ''         <- Empty / unknown class (never falsely assigned to Domestic/Commercial/Industrial/STW)
 */
export function getTaskConnectionClass(task: DisconnectionTask): 'DOMESTIC' | 'COMMERCIAL' | 'INDUSTRIAL' | 'STW' | '' {
  if (!task || typeof task !== 'object') return '';

  // 1. Check actual Google Sheets 'Class' field first
  const classCandidates = [
    (task as any)['Class'],
    task.classType,
    (task as any).class
  ];
  for (const candidate of classCandidates) {
    const mapped = normalizeDisconnectionClassValue(candidate);
    if (mapped) return mapped;
  }

  // 2. Check actual Google Sheets 'Base Class' field
  const baseClassCandidates = [
    (task as any)['Base Class'],
    task.baseClass
  ];
  for (const candidate of baseClassCandidates) {
    const mapped = normalizeDisconnectionClassValue(candidate);
    if (mapped) return mapped;
  }

  // 3. Empty / unknown class: do not assign to Domestic, Commercial, Industrial, or STW
  return '';
}

export function getConnectionClassLabel(cls: 'DOMESTIC' | 'COMMERCIAL' | 'INDUSTRIAL' | 'STW' | '', lang: 'en' | 'bn' = 'en'): string {
  switch (cls) {
    case 'DOMESTIC':
      return lang === 'bn' ? 'Domestic (গৃহস্থালি)' : 'Domestic';
    case 'COMMERCIAL':
      return lang === 'bn' ? 'Commercial (বাণিজ্যিক)' : 'Commercial';
    case 'INDUSTRIAL':
      return lang === 'bn' ? 'Industrial (শিল্প)' : 'Industrial';
    case 'STW':
      return lang === 'bn' ? 'STW (কৃষি / শ্যালো)' : 'STW';
    default:
      return '';
  }
}

/**
 * Universal status matcher across Disconnection Dashboard, Performance Dashboard, and Consumer List.
 */
export function matchesDisconnectionStatusFilter(task: DisconnectionTask, statusFilter: string): boolean {
  if (!statusFilter || statusFilter === 'ALL') return true;

  const filterUpper = statusFilter.trim().toUpperCase();
  const rawStatus = String(
    task.taskStatus ||
    task.disconStatus ||
    (task as any)['Discon Status'] ||
    'PENDING'
  ).trim().toUpperCase();

  const paidAmt = parseFloat(String(task.paidAmount || (task as any)['Paid Amount'] || '0').replace(/[^0-9.-]/g, '')) || 0;
  const paymentSt = String(task.paymentStatus || (task as any)['Payment Status'] || '').trim().toUpperCase();

  if (filterUpper === 'URGENT') {
    return String(task.priority || (task as any)['Priority'] || '').trim().toUpperCase() === 'URGENT';
  }

  if (filterUpper === 'PAID') {
    return rawStatus === 'PAID' || paymentSt === 'PAID' || (paidAmt > 0 && rawStatus !== 'DISCONNECT' && rawStatus !== 'DISCONNECTED');
  }

  if (filterUpper === 'DISCONNECT' || filterUpper === 'DISCONNECTED') {
    return (
      rawStatus === 'DISCONNECT' ||
      rawStatus === 'DISCONNECTED' ||
      rawStatus === 'COMPLETED' ||
      rawStatus === 'ALREADY DISCONNECTED'
    );
  }

  if (filterUpper === 'COMPLETED') {
    return (
      rawStatus === 'DISCONNECT' ||
      rawStatus === 'DISCONNECTED' ||
      rawStatus === 'COMPLETED' ||
      rawStatus === 'ALREADY DISCONNECTED' ||
      rawStatus === 'PAID' ||
      paymentSt === 'PAID' ||
      paidAmt > 0
    );
  }

  if (filterUpper === 'PENDING' || filterUpper === 'CONNECTED') {
    const isPaid = rawStatus === 'PAID' || paymentSt === 'PAID' || paidAmt > 0;
    const isDisc = rawStatus === 'DISCONNECT' || rawStatus === 'DISCONNECTED' || rawStatus === 'COMPLETED' || rawStatus === 'ALREADY DISCONNECTED';
    const isOther = rawStatus === 'DISPUTE' || rawStatus === 'OFFICE TEAM' || rawStatus === 'NOT FOUND' || rawStatus === 'UNABLE' || rawStatus === 'REISSUE';
    if (filterUpper === 'CONNECTED') {
      return !isPaid && !isDisc && !isOther;
    }
    return (
      rawStatus === 'PENDING' ||
      rawStatus === 'IN PROGRESS' ||
      rawStatus === 'CONNECTED' ||
      rawStatus === '' ||
      (!isPaid && !isDisc && !isOther)
    );
  }

  if (filterUpper === 'DISPUTE' || filterUpper === 'BILL DISPUTE') {
    return rawStatus === 'DISPUTE' || rawStatus === 'BILL DISPUTE';
  }

  if (filterUpper === 'OFFICE TEAM') {
    return rawStatus === 'OFFICE TEAM';
  }

  if (filterUpper === 'NOT FOUND') {
    return rawStatus === 'NOT FOUND' || rawStatus === 'UNABLE';
  }

  if (filterUpper === 'REISSUE') {
    return rawStatus === 'REISSUE';
  }

  return rawStatus === filterUpper;
}

export const matchesDisconnectionStatus = matchesDisconnectionStatusFilter;

/**
 * Strips any IDs or bracketed codes from Worker or Agency names so ONLY the Name is displayed.
 */
export function cleanWorkerOrAgencyName(rawName?: string): string {
  if (!rawName) return '';
  let s = String(rawName).trim();
  s = s.replace(/\s*\((?:ID|WRK|LM|USR|ADM|EMP|AGENCY|CODE|NO|#)?[^)]*\)/gi, '');
  s = s.replace(/\s*\[[^\]]*\]/g, '');
  s = s.replace(/\s*[-|•]\s*(?:ID|WRK|LM|USR|Badge)?\s*[:#-]?\s*[A-Za-z0-9_-]+$/gi, '');
  s = s.replace(/^(?:ID|Worker ID|Agency ID)\s*[:#-]?\s*/gi, '');
  return s.trim();
}

/**
 * Cleans internal reissue tags from visible observation/remark text.
 */
export function cleanDisconnectionNotes(rawNotes?: string): string {
  if (!rawNotes) return '';
  return String(rawNotes)
    .replace(/\[DELETED_BY_ADMIN\]/gi, '')
    .replace(/\[REISSUE_REQ[^\]]*\]/gi, '')
    .replace(/\[REISSUE_APPROVED[^\]]*\]/gi, '')
    .trim();
}

/**
 * Evaluates whether a Disconnection task has a Re-issue Request pending / approved by Admin.
 * Workers, Supervisors, and Admins can update status and remarks on any consumer record.
 */
export function getReissueLockState(task: DisconnectionTask): {
  isUpdatedOnce: boolean;
  isLockedForWorker: boolean;
  isReissueRequested: boolean;
  reissueRequested: boolean;
  isReissueApproved: boolean;
  requestedBy: string;
  requestedAt: string;
} {
  const rawStatus = String(
    task.taskStatus || task.disconStatus || (task as any)['Discon Status'] || 'PENDING'
  )
    .trim()
    .toUpperCase();

  const rawNotes = String(
    task.workerRemarks || task.workerReport || task.notes || (task as any)['Notes'] || ''
  );

  const reqMatch = rawNotes.match(/\[REISSUE_REQ:([^|\]]*)(?:\|([^\]]*))?\]/i);
  const isReissueRequested = Boolean(task.reissueRequested || reqMatch);
  const isReissueApproved = Boolean(
    task.reissueApproved ||
    /\[REISSUE_APPROVED/i.test(rawNotes) ||
    rawStatus === 'REISSUE'
  );

  const isInitialPending =
    rawStatus === '' ||
    rawStatus === 'PENDING' ||
    rawStatus === 'CONNECTED' ||
    rawStatus === 'IN PROGRESS';

  const isUpdatedOnce = !isInitialPending;
  const isLockedForWorker = false;

  const requestedBy = cleanWorkerOrAgencyName(
    task.reissueRequestedBy ||
    (reqMatch && reqMatch[1]) ||
    task.assignedAgency ||
    task.assignedWorkerName ||
    task.Agency ||
    'Worker'
  );
  const requestedAt =
    task.reissueRequestedAt ||
    (reqMatch && reqMatch[2]) ||
    task.disconDate ||
    task.reportDate ||
    'Just now';

  return {
    isUpdatedOnce,
    isLockedForWorker,
    isReissueRequested,
    reissueRequested: isReissueRequested,
    isReissueApproved,
    requestedBy,
    requestedAt
  };
}

