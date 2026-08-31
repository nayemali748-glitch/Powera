export type CategoryType = 
  | 'NSC' 
  | 'DISCONNECTION' 
  | 'POLE CASE' 
  | 'METER REPLESMENT' 
  | 'DTR REPLESMENT';

export type StatusType = 'Pending' | 'In Progress' | 'Completed' | 'Approved' | 'Rejected';

export interface PowerEntry {
  id: string;
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

export type ActiveTab = 'entry' | 'admin' | 'my-submissions' | 'performance';

export type CornerOptionKey = 'admin_portal' | 'emergency_safety' | 'export_reports' | null;

export interface UserSession {
  id: string;
  idNo: string;
  name: string;
  phone?: string;
  role: 'admin' | 'worker' | 'supervisor';
  designation: string;
  badgeNo?: string;
  loggedInAt: string;
}

export interface UserAccount {
  id: string;
  idNo: string;
  password: string;
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
  category: CategoryType;
  title: string;
  photoUrl: string;
  description?: string;
  uploadedBy: string;
  adminName: string;
  adminPhone?: string;
  uploadDate: string;
  uploadTime: string;
  createdAt: string;
  isHidden?: boolean;
}
