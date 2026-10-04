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

/**
 * Classifies a DisconnectionTask into WBSEDCL standard consumer classes:
 * - DOMESTIC
 * - COMMERCIAL
 * - INDUSTRIAL
 * - STW (Shallow Tube Well / Agriculture / Irrigation)
 */
export function getTaskConnectionClass(task: DisconnectionTask): 'DOMESTIC' | 'COMMERCIAL' | 'INDUSTRIAL' | 'STW' {
  const baseClassRaw = String(
    task.baseClass ||
    (task as any)['Base Class'] ||
    (task as any)['Class'] ||
    task.classType ||
    (task as any).consumerCategory ||
    ''
  ).trim().toUpperCase();

  const natureRaw = String(
    task.natureOfConn ||
    (task as any)['Nature of Conn'] ||
    ''
  ).trim().toUpperCase();

  const combined = `${baseClassRaw} ${natureRaw}`.trim();

  // 1. STW / Agriculture / Shallow Tube Well
  if (
    combined.includes('STW') ||
    combined.includes('SHALLOW') ||
    combined.includes('TUBE') ||
    combined.includes('AGRI') ||
    combined.includes('PUMP') ||
    combined.includes('IRRIG') ||
    combined.includes('C(T)') ||
    combined.includes('S(T)') ||
    combined.includes('A(T)') ||
    combined.includes('KRISHI') ||
    combined.includes('কৃষি') ||
    baseClassRaw === 'A' ||
    baseClassRaw === 'AG' ||
    baseClassRaw === 'ST'
  ) {
    return 'STW';
  }

  // 2. Industrial
  if (
    combined.includes('IND') ||
    combined.includes('FACT') ||
    combined.includes('MILL') ||
    combined.includes('WORKSHOP') ||
    combined.includes('COLD STORAGE') ||
    combined.includes('I(I)') ||
    combined.includes('I(R)') ||
    combined.includes('I(U)') ||
    combined.includes('A(I)') ||
    combined.includes('B(I)') ||
    combined.includes('শিল্প') ||
    baseClassRaw === 'I' ||
    baseClassRaw === 'IN' ||
    baseClassRaw.startsWith('I(') ||
    baseClassRaw.startsWith('IND')
  ) {
    return 'INDUSTRIAL';
  }

  // 3. Commercial
  if (
    combined.includes('COM') ||
    combined.includes('SHOP') ||
    combined.includes('MARKET') ||
    combined.includes('BUSINESS') ||
    combined.includes('HOTEL') ||
    combined.includes('C(I)') ||
    combined.includes('C(R)') ||
    combined.includes('C(U)') ||
    combined.includes('A(CM)') ||
    combined.includes('বাণিজ্যিক') ||
    baseClassRaw === 'C' ||
    baseClassRaw === 'CM' ||
    baseClassRaw.startsWith('C(') ||
    baseClassRaw.startsWith('COM')
  ) {
    return 'COMMERCIAL';
  }

  // 4. Default / Domestic
  return 'DOMESTIC';
}

export function getConnectionClassLabel(cls: 'DOMESTIC' | 'COMMERCIAL' | 'INDUSTRIAL' | 'STW', lang: 'en' | 'bn' = 'en'): string {
  switch (cls) {
    case 'DOMESTIC':
      return lang === 'bn' ? 'Domestic (গৃহস্থালি)' : 'Domestic';
    case 'COMMERCIAL':
      return lang === 'bn' ? 'Commercial (বাণিজ্যিক)' : 'Commercial';
    case 'INDUSTRIAL':
      return lang === 'bn' ? 'Industrial (শিল্প)' : 'Industrial';
    case 'STW':
      return lang === 'bn' ? 'STW (কৃষি / শ্যালো)' : 'STW';
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

