export type CategoryType = 
  | 'NSC' 
  | 'DISCONNECTION' 
  | 'POLE CASE' 
  | 'METER REPLESMENT' 
  | 'DTR REPLESMENT';

export type StatusType = 'Pending' | 'In Progress' | 'Completed' | 'Approved' | 'Rejected';

export interface PowerEntry {
  id: string;
  submissionId?: string;
  category: CategoryType;
  date: string;
  workerName: string;
  workerPhone?: string;
  feederName?: string;
  substation?: string;
  status: StatusType;
  notes?: string;
  locationGps?: string;
  photoUrl?: string;
  photoBeforeUrl?: string;
  photoAfterUrl?: string;
  workOrderPhoto?: string;
  workOrderNoticeId?: string;
  workOrderNoticeTitle?: string;
  workOrderNoticeDate?: string;
  createdAt: string;
  updatedAt?: string;

  // Authenticated Worker Identity
  workerId?: string;
  role?: string;
  submittedBy?: string;

  // NSC specific
  workOrderNo?: string;
  workOrderDate?: string;
  consumerId?: string;
  consumerName?: string;
  fatherName?: string;
  applicationNo?: string;
  agencyName?: string;
  cccName?: string;
  mobile?: string;
  address?: string;
  poleNo?: string;
  appliedLoad?: string;
  phase?: 'Single Phase' | '3-Phase' | string;
  tariffCategory?: string;
  meterNo?: string;
  initialReading?: string;
  sealNo?: string;
  serviceCableLength?: string;
  meterInstallDate?: string;
  inspectionAgencyName?: string;
  meterMake?: string;

  // DISCONNECTION specific
  arrearAmount?: string;
  reason?: string;
  finalReading?: string;
  disconnectionType?: 'Temporary' | 'Permanent' | 'Defaulter' | 'Safety Hazard' | string;
  cutoutSealed?: boolean;

  // POLE CASE specific
  issueType?: string;
  priority?: 'Urgent' | 'High' | 'Normal' | 'Low';
  actionTaken?: string;
  materialUsed?: string;
  poleType?: 'PSC Pole' | 'Spun Pre-stressed' | 'Steel Tubular' | 'Wood' | string;
  lineVoltage?: 'LT (230V/400V)' | '11 kV' | '33 kV' | string;
  conductorType?: string;
  ptwShutdownRef?: string;

  // METER REPLESMENT specific
  oldMeterNo?: string;
  replacementReason?: string;
  newMeterNo?: string;
  newMeterSealNo?: string;
  oldMeterSealNo?: string;
  meterType?: 'Analog Electro-Mechanical' | 'Single Phase Digital' | '3-Phase LT-CT' | 'Smart Prepaid' | string;

  // DTR REPLESMENT specific
  dtrName?: string;
  existingCapacity?: string;
  newCapacity?: string;
  oldDtrSerial?: string;
  newDtrSerial?: string;
  failureReason?: string;
  oilLevelChecked?: boolean;
  earthResistance?: string;
  dtrMakeBrand?: string;
  hgFuseRating?: string;
  ltMccbAmpere?: string;
  lightningArrester?: boolean;
}

export interface StatsResponse {
  total: number;
  categories: {
    NSC: number;
    DISCONNECTION: number;
    POLE_CASE: number;
    METER_REPLESMENT: number;
    DTR_REPLESMENT: number;
  };
  status: {
    pending: number;
    completed: number;
    approved: number;
  };
}

export type ActiveTab = 'entry' | 'admin' | 'my-submissions' | 'performance' | 'work-orders' | 'disconnection';

export type SyncMode = 'auto' | 'manual';

export type CornerOptionKey = 'admin_portal' | 'emergency_safety' | 'export_reports' | null;

export interface UserSession {
  id: string;
  idNo: string;
  uid?: string;
  email?: string;
  name: string;
  phone?: string;
  role: 'admin' | 'worker' | 'supervisor';
  status?: 'active' | 'hold';
  designation: string;
  badgeNo?: string;
  loggedInAt: string;
}

export interface UserAccount {
  id: string;
  idNo: string;
  uid?: string;
  email?: string;
  userId?: string;
  password?: string;
  name: string;
  phone: string;
  role: 'admin' | 'worker' | 'supervisor';
  designation: string;
  badgeNo?: string;
  status?: 'active' | 'hold';
  securityQuestion?: string;
  securityAnswer?: string;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'admin' | 'worker' | 'supervisor';
  recipientId?: string;
  recipientRole?: 'admin' | 'worker' | 'all';
  message: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
}

export interface WorkOrderNotice {
  id: string;
  category: CategoryType | 'ALL';
  title: string;
  photoUrl: string;
  fileId?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number | string;
  driveViewUrl?: string;
  driveDownloadUrl?: string;
  directImageUrl?: string;
  description?: string;
  uploadedBy: string;
  adminName: string;
  adminPhone?: string;
  uploadDate: string;
  uploadTime: string;
  createdAt: string;
  isHidden?: boolean;
}

export type DisconnectionTaskStatus = 
  | 'PENDING' 
  | 'DISCONNECT'
  | 'ALREADY DISCONNECTED'
  | 'DISPUTE'
  | 'OFFICE TEAM'
  | 'PAID'
  | 'NOT FOUND'
  | 'REISSUE'
  | 'IN PROGRESS' 
  | 'COMPLETED' 
  | 'UNABLE' 
  | 'REPORTED' 
  | 'CANCELLED'
  | 'ARCHIVED';

export interface DisconnectionTask {
  // Exact 33 Google Sheet Columns (A:AG)
  off_code?: string;
  MRU?: string;
  'Consumer Id'?: string;
  Name?: string;
  Address?: string;
  'Base Class'?: string;
  Class?: string;
  Device?: string;
  'O/S Duedate Range'?: string;
  'D2 Net O/S'?: string;
  Mobile?: string;
  Number?: string;
  Latitude?: string;
  Longitude?: string;
  'Discon Status'?: string;
  'Discon Date'?: string;
  Image?: string;
  Reading?: string;
  'Payment Status'?: string;
  'Gis Pole'?: string;
  Agency?: string;
  Notes?: string;
  'Nature of Conn'?: string;
  'Gov/Non-Gov'?: string;
  'Last Updated'?: string;
  Priority?: string;
  'Paid Amount'?: string;
  'Paid Date'?: string;
  'Paid Type'?: string;
  'Outstanding After'?: string;
  'Next Payment Date'?: string;
  'Payment Source'?: string;
  'Upload Date'?: string;

  // Normalized Developer Aliases
  offCode?: string;
  mru?: string;
  mruSection?: string;
  cccFeeder?: string;
  serialNumber?: string; // e.g. "SL 001", "SL 002"
  taskId: string;
  consumerId: string;
  consumerName: string;
  accountNumber?: string;
  meterNumber?: string;
  reading?: string;
  meterReading?: string;
  consumerAddress?: string;
  phoneNumber?: string;
  mobile?: string;
  mobileNumber?: string;
  area?: string;
  disconnectionReason?: string;
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  assignedAgency?: string;
  agency?: string;
  taskStatus: DisconnectionTaskStatus;
  disconStatus?: string;
  disconDate?: string;
  workerReport?: string;
  workerRemarks?: string;
  notes?: string;
  reportDate?: string;
  reportTime?: string;
  submittedBy?: string;
  createdAt: string;
  updatedAt?: string;
  lastUpdated?: string;
  completionPercentage?: number;
  adminRemarks?: string;
  photoUrl?: string;
  imageUrl?: string;
  archivedAt?: string;
  archivedByAdmin?: string;
  archiveReason?: string;
  outstandingDue?: string;
  d2NetOs?: string;
  dueDateRange?: string;
  osDueDateRange?: string;
  baseClass?: string;
  classType?: string;
  deviceType?: string;
  device?: string;
  priority?: 'NORMAL' | 'URGENT' | string;
  paidAmount?: string;
  paidDate?: string;
  paymentDate?: string;
  paidType?: string;
  paymentReference?: string;
  paymentStatus?: string;
  gisPole?: string;
  natureOfConn?: string;
  govNonGov?: string;
  outstandingAfter?: string;
  nextPaymentDate?: string;
  paymentSource?: string;
  uploadDate?: string;
  latitude?: string;
  longitude?: string;
  statusHistory?: any[] | string;
  reissueRequested?: boolean;
  reissueRequestedBy?: string;
  reissueRequestedAt?: string;
  reissueApproved?: boolean;
}

export interface WorkerPerformanceStat {
  workerName: string;
  assigned: number;
  completed: number;
  pending: number;
  reportsSubmitted: number;
  completionRate: number;
}

export interface DisconnectionStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  disconnectedTasks?: number;
  paidTasks?: number;
  notFoundTasks?: number;
  disputeTasks?: number;
  officeTeamTasks?: number;
  reissueTasks?: number;
  urgentTasks?: number;
  inProgressTasks: number;
  unableTasks: number;
  reportedTasks: number;
  cancelledTasks: number;
  completionPercentage: number;
  myAssignedTasks: number;
  myCompletedTasks: number;
  myPendingTasks: number;
  myCompletionPercentage: number;
  workerPerformance?: WorkerPerformanceStat[];
}

