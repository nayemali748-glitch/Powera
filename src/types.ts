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
  createdAt: string;
  updatedAt?: string;

  // NSC specific
  consumerId?: string;
  consumerName?: string;
  fatherName?: string;
  mobile?: string;
  address?: string;
  poleNo?: string;
  appliedLoad?: string;
  phase?: 'Single Phase' | '3-Phase' | string;
  meterNo?: string;
  initialReading?: string;
  sealNo?: string;
  serviceCableLength?: string;

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

export type ActiveTab = 'entry' | 'admin' | 'my-submissions';

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
  securityQuestion?: string;
  securityAnswer?: string;
  createdAt: string;
}
