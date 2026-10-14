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

function parseAmountValue(val: unknown): number {
  if (val === undefined || val === null || val === '') return 0;
  const clean = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
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
    (task as any).status ||
    'PENDING'
  ).trim().toUpperCase();
  const paymentSt = String(task.paymentStatus || (task as any)['Payment Status'] || '').trim().toUpperCase();
  const paidAmt = parseAmountValue(task.paidAmount ?? (task as any)['Paid Amount']);

  if (filterUpper === 'URGENT') {
    return String(task.priority || (task as any)['Priority'] || '').trim().toUpperCase() === 'URGENT';
  }

  if (filterUpper === 'PAID') {
    return rawStatus === 'PAID';
  }

  if (filterUpper === 'DISCONNECT' || filterUpper === 'DISCONNECTED') {
    return (
      rawStatus === 'DISCONNECT' ||
      rawStatus === 'DISCONNECTED' ||
      rawStatus === 'ALREADY DISCONNECTED' ||
      rawStatus === 'COMPLETED'
    );
  }

  if (filterUpper === 'COMPLETED') {
    return (
      rawStatus === 'COMPLETED' ||
      rawStatus === 'DISCONNECT' ||
      rawStatus === 'DISCONNECTED' ||
      rawStatus === 'ALREADY DISCONNECTED' ||
      rawStatus === 'PAID'
    );
  }

  if (filterUpper === 'PENDING' || filterUpper === 'CONNECTED') {
    const isPaid = rawStatus === 'PAID';
    const isDisc = rawStatus === 'DISCONNECT' || rawStatus === 'DISCONNECTED' || rawStatus === 'ALREADY DISCONNECTED' || rawStatus === 'COMPLETED';
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
    const lock = getReissueLockState(task);
    return rawStatus === 'REISSUE' || lock.isReissueApproved || lock.isReissueRequested;
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
    .replace(/\[REISSUE_REJECTED[^\]]*\]/gi, '')
    .replace(/\s*\|\s*$/, '')
    .trim();
}

/**
 * Evaluates whether a Disconnection task has a Re-issue Request pending / approved / rejected by Admin.
 * Workers, Agencies, Supervisors, and Admins can update status and remarks on any consumer record.
 */
export function getReissueLockState(task: DisconnectionTask): {
  isUpdatedOnce: boolean;
  isLockedForWorker: boolean;
  isReissueRequested: boolean;
  reissueRequested: boolean;
  isReissueApproved: boolean;
  isReissueRejected: boolean;
  reissueRejected: boolean;
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
  const hasRejectTag = /\[REISSUE_REJECTED/i.test(rawNotes);
  const hasApproveTag = /\[REISSUE_APPROVED/i.test(rawNotes);

  const isReissueApproved = Boolean(
    task.reissueApproved === true ||
    hasApproveTag ||
    rawStatus === 'REISSUE'
  );

  const isReissueRejected = Boolean(
    !isReissueApproved &&
    (task.reissueRejected === true || hasRejectTag)
  );

  const isReissueRequested = Boolean(
    !isReissueApproved &&
    !isReissueRejected &&
    (task.reissueRequested === true || Boolean(reqMatch))
  );

  const isInitialPending =
    (rawStatus === '' ||
      rawStatus === 'PENDING' ||
      rawStatus === 'CONNECTED' ||
      rawStatus === 'IN PROGRESS') &&
    !isReissueRequested &&
    !isReissueApproved &&
    !isReissueRejected;

  const isUpdatedOnce = !isInitialPending;
  const isLockedForWorker = isUpdatedOnce && !isReissueApproved;

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
    isReissueRejected,
    reissueRejected: isReissueRejected,
    requestedBy,
    requestedAt
  };
}

/**
 * Checks whether a single Disconnection consumer row's "Agency" column matches the logged-in Agency user.
 * Strictly requires a non-empty Agency column in the sheet that matches the user's Agency Name or Login ID.
 */
export function doesTaskBelongToAgencyUser(
  task: DisconnectionTask,
  user?: { idNo?: string; name?: string; username?: string; agencyName?: string; role?: string; designation?: string } | null
): boolean {
  if (!task || !user) return false;

  const rawUserId = String(user.idNo || (user as any).loginId || (user as any).userId || '').trim().toLowerCase();
  const compactUserId = rawUserId.replace(/[^a-z0-9\u0980-\u09ff]+/g, '');
  const taskWorkerId = String(task.assignedWorkerId || (task as any)['Worker ID'] || (task as any).workerId || '').trim().toLowerCase();
  if (rawUserId && taskWorkerId && rawUserId === taskWorkerId) {
    return true;
  }

  const taskAgencyCandidates = [
    (task as any)['Agency'],
    task.Agency,
    task.agency,
    task.assignedAgency,
    (task as any)['Agency Name'],
    (task as any)['Assigned Agency'],
    (task as any).agencyName,
    task.assignedWorkerName && task.assignedWorkerName !== 'Worker' ? task.assignedWorkerName : '',
    (task as any).workerName && (task as any).workerName !== 'Worker' ? (task as any).workerName : ''
  ]
    .map(v => String(v || '').trim())
    .filter(Boolean);

  if (taskAgencyCandidates.length === 0) return false;

  const userNameCandidates = [
    (user as any).agencyName,
    (user as any)['Agency Name'],
    user.name,
    user.username,
    user.idNo,
    (user as any).loginId,
    (user as any).userId
  ]
    .map(v => String(v || '').trim())
    .filter(Boolean);

  const stripGenericSuffixes = (s: string) =>
    s
      .replace(/\b(enterprise|enterprises|agency|associates|traders|construction|electric|electrical|electricals|electro|india|pvt|ltd|private|limited|co|company|wbsedcl|partner)\b/gi, ' ')
      .replace(/\s+/g, '')
      .trim();

  for (const rawTaskAgency of taskAgencyCandidates) {
    const normTaskAgency = cleanWorkerOrAgencyName(rawTaskAgency)
      .toLowerCase()
      .replace(/^agency\s+/i, '')
      .replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ')
      .trim();
    const compactTaskAgency = normTaskAgency.replace(/\s+/g, '');
    if (!compactTaskAgency) continue;

    if (compactUserId.length >= 2 && (compactTaskAgency === compactUserId || rawTaskAgency.toLowerCase() === rawUserId)) {
      return true;
    }

    const coreTaskBrand = stripGenericSuffixes(normTaskAgency);

    for (const rawUserName of userNameCandidates) {
      const normUserName = cleanWorkerOrAgencyName(rawUserName)
        .toLowerCase()
        .replace(/^agency\s+/i, '')
        .replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ')
        .trim();
      const compactUserName = normUserName.replace(/\s+/g, '');

      if (compactUserName.length >= 2 && compactTaskAgency === compactUserName) {
        return true;
      }
      if (
        normUserName.length >= 3 &&
        normTaskAgency.length >= 3 &&
        (normTaskAgency === normUserName ||
          normTaskAgency.includes(normUserName) ||
          normUserName.includes(normTaskAgency))
      ) {
        return true;
      }

      const coreUserBrand = stripGenericSuffixes(normUserName);
      if (
        coreTaskBrand.length >= 4 &&
        coreUserBrand.length >= 4 &&
        (coreTaskBrand === coreUserBrand ||
          coreTaskBrand.includes(coreUserBrand) ||
          coreUserBrand.includes(coreTaskBrand))
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Determines whether the currently logged-in user is an Agency account (or has rows assigned in the Sheet's Agency column).
 */
export function isAgencyUserSession(
  user?: { idNo?: string; name?: string; username?: string; role?: string; designation?: string } | null,
  allTasks?: DisconnectionTask[]
): boolean {
  if (!user) return false;
  const role = String(user.role || '').trim().toLowerCase();
  const idNo = String(user.idNo || '').trim();
  const name = String(user.name || user.username || '').trim();
  const desig = String(user.designation || '').trim();

  if (
    role === 'admin' ||
    role === 'superadmin' ||
    role === 'controller' ||
    idNo === '8695716192' ||
    idNo.toLowerCase() === 'admin'
  ) {
    return false;
  }

  if (
    role === 'agency' ||
    /^(agn|agency)[-_0-9]/i.test(idNo) ||
    /agency|এজেন্সি/i.test(desig) ||
    /enterprise|agency|associates|traders|construction/i.test(name)
  ) {
    return true;
  }

  if (Array.isArray(allTasks) && allTasks.length > 0) {
    return allTasks.some(t => doesTaskBelongToAgencyUser(t, user));
  }

  return false;
}

/**
 * Filters Disconnection tasks for the logged-in user:
 * - Admin sees all rows.
 * - Agency account ONLY sees rows where the Google Sheet "Agency" column matches their specific Agency Name / ID.
 *   Non-matching rows are strictly hidden.
 * - General Lineman / Field Worker sees the general list.
 */
export function filterDisconnectionTasksForUser(
  tasks: DisconnectionTask[],
  user?: { idNo?: string; name?: string; username?: string; role?: string; designation?: string; agencyName?: string } | null
): DisconnectionTask[] {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];
  if (!user) return tasks;

  if (isAgencyUserSession(user, tasks)) {
    return tasks.filter(t => doesTaskBelongToAgencyUser(t, user));
  }

  return tasks;
}


