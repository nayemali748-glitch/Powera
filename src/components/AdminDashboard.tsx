import React, { useState, useMemo } from 'react';
import appLogo from '../assets/images/power_round_logo_1787860440979.jpg';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  Printer, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Eye, 
  Zap, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  Layers, 
  AlertCircle,
  X,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  LogOut,
  UserPlus,
  Users,
  KeyRound,
  Edit3,
  Globe,
  FileText,
  Camera,
  FileImage,
  ChevronDown,
  ChevronUp,
  PowerOff,
  Wrench,
  ShieldAlert,
  Coins,
  Sparkles,
  Check,
  Activity,
  Hash,
  ArrowRight,
  AlertTriangle,
  LayoutDashboard,
  UploadCloud,
  MessageSquareWarning,
  RotateCcw,
  XCircle,
  Loader2,
  Building2
} from 'lucide-react';
import { PowerEntry, CategoryType, StatusType, SyncMode, DisconnectionTask } from '../types';
import { updateEntry, deleteEntry, clearAllEntries, deleteDisconnectionTask, submitDisconnectionTaskReport } from '../services/api';
import { UserManagementModal } from './UserManagementModal';
import { EditEntryModal } from './EditEntryModal';
import { WorkOrderNoticeSection } from './WorkOrderNoticeSection';
import { DisconnectionPerformanceDashboard } from './DisconnectionPerformanceDashboard';
import { Language, translations } from '../utils/translations';
import { cleanNameOnly } from '../utils/entryNormalizer';
import { getReissueLockState, cleanDisconnectionNotes } from '../utils/disconnectionClassifier';
import { 
  syncAllEntriesToGoogleSheet, 
  getSavedSpreadsheetUrl, 
  getSavedSpreadsheetId, 
  createPowerSpreadsheet 
} from '../services/googleSheets';
import { formatDateDDMMYYYY, formatTime12Hour, formatDateTime12Hour, getNowDateDDMMYYYY } from '../utils/dateTimeFormat';

interface AdminDashboardProps {
  entries: PowerEntry[];
  disconnectionTasks?: DisconnectionTask[];
  onRefresh: () => void;
  onExportCsv: () => void;
  onLogout?: () => void;
  lang?: Language;
  onOpenLanguageModal?: () => void;
  syncMode?: SyncMode;
  onNavigateToDisconnection?: (tab?: 'DASHBOARD' | 'UPLOAD' | 'REPORT' | 'VIEW_LIST') => void;
  isSyncing?: boolean;
  lastSyncedTimeStr?: string;
  onPowerAppSheetsRefresh?: () => void;
  forceRefreshState?: 'idle' | 'refreshing' | 'completed' | 'failed';
  onForceSystemRefresh?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  entries,
  disconnectionTasks = [],
  onRefresh,
  onExportCsv,
  onLogout,
  lang = 'bn',
  onOpenLanguageModal,
  syncMode = 'auto',
  onNavigateToDisconnection,
  isSyncing = false,
  lastSyncedTimeStr = '',
  onPowerAppSheetsRefresh,
  forceRefreshState = 'idle',
  onForceSystemRefresh,
}) => {
  const t = translations[lang] || translations.en;
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<PowerEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<PowerEntry | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [userModalTab, setUserModalTab] = useState<'create' | 'list' | 'change-password'>('create');
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showWorkOrdersManager, setShowWorkOrdersManager] = useState<boolean>(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);
  const [sheetsSyncMessage, setSheetsSyncMessage] = useState<string | null>(null);
  const [currentSheetUrl, setCurrentSheetUrl] = useState<string | null>(() => getSavedSpreadsheetUrl());

  // Record Deletion Confirmation State + Instant 0ms Local Tombstone Set
  const [entryToDelete, setEntryToDelete] = useState<PowerEntry | null>(null);
  const [isDeletingEntry, setIsDeletingEntry] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [locallyDeletedIds, setLocallyDeletedIds] = useState<Set<string>>(new Set());

  // Mandatory Clear All Confirmation State
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState<boolean>(false);
  const [clearAllConfirmText, setClearAllConfirmText] = useState<string>('');
  const [isClearingAll, setIsClearingAll] = useState<boolean>(false);
  const [clearAllError, setClearAllError] = useState<string | null>(null);
  const [approvingReissueId, setApprovingReissueId] = useState<string | null>(null);
  const [rejectingReissueId, setRejectingReissueId] = useState<string | null>(null);
  const [showReissueRequestsPanel, setShowReissueRequestsPanel] = useState<boolean>(false);
  const [localReissueOverrides, setLocalReissueOverrides] = useState<Record<string, 'APPROVED' | 'REJECTED'>>({});

  const handleAdminApproveReissue = async (task: DisconnectionTask) => {
    const cId = String(task.consumerId || (task as any)['Consumer Id'] || task.taskId || '').replace(/^TASK-DISC-/i, '').trim();
    setApprovingReissueId(cId);
    setLocalReissueOverrides(prev => ({ ...prev, [cId]: 'APPROVED' }));
    try {
      const cleanedNotes = cleanDisconnectionNotes(task.workerRemarks || task.notes || '');
      const approvedMarker = `${cleanedNotes ? cleanedNotes + ' ' : ''}[REISSUE_APPROVED]`.trim();
      await submitDisconnectionTaskReport({
        ...task,
        taskId: task.taskId || `TASK-DISC-${cId}`,
        consumerId: cId,
        consumerName: task.consumerName || '',
        taskStatus: 'REISSUE' as any,
        disconStatus: 'REISSUE',
        workerRemarks: approvedMarker,
        notes: approvedMarker,
        agency: cleanNameOnly(task.assignedAgency || task.agency || ''),
        workerId: 'ADMIN',
        workerName: cleanNameOnly(task.assignedWorkerName || 'Admin'),
        reissueRequested: false,
        reissueApproved: true,
        reissueRejected: false,
        reissueAction: 'APPROVE'
      });
      onRefresh();
    } finally {
      setApprovingReissueId(null);
    }
  };

  const handleAdminRejectReissue = async (task: DisconnectionTask) => {
    const cId = String(task.consumerId || (task as any)['Consumer Id'] || task.taskId || '').replace(/^TASK-DISC-/i, '').trim();
    setRejectingReissueId(cId);
    setLocalReissueOverrides(prev => ({ ...prev, [cId]: 'REJECTED' }));
    try {
      const cleanedNotes = cleanDisconnectionNotes(task.workerRemarks || task.notes || '');
      const rejectedMarker = `${cleanedNotes ? cleanedNotes + ' ' : ''}[REISSUE_REJECTED]`.trim();
      const keepStatus = (task.disconStatus || task.taskStatus || 'DISCONNECT') as any;
      await submitDisconnectionTaskReport({
        ...task,
        taskId: task.taskId || `TASK-DISC-${cId}`,
        consumerId: cId,
        consumerName: task.consumerName || '',
        taskStatus: keepStatus,
        disconStatus: String(keepStatus),
        workerRemarks: rejectedMarker,
        notes: rejectedMarker,
        agency: cleanNameOnly(task.assignedAgency || task.agency || ''),
        workerId: 'ADMIN',
        workerName: cleanNameOnly(task.assignedWorkerName || 'Admin'),
        reissueRequested: false,
        reissueApproved: false,
        reissueRejected: true,
        reissueAction: 'REJECT'
      });
      onRefresh();
    } finally {
      setRejectingReissueId(null);
    }
  };

  const handleSyncToGoogleSheets = async () => {
    setIsSyncingSheets(true);
    setSheetsSyncMessage(null);
    try {
      const result = await syncAllEntriesToGoogleSheet(entries);
      setCurrentSheetUrl(result.sheetUrl);
      if (onRefresh) onRefresh();
      setSheetsSyncMessage(
        lang === 'bn'
          ? `সফলভাবে ${result.syncedCount} টি এন্ট্রি Google Sheets থেকে রিফ্রেশ ও সিঙ্ক হয়েছে!`
          : `Successfully refreshed and synced ${result.syncedCount} records from Google Sheets!`
      );
    } catch (err: any) {
      console.error('Failed to sync to Google Sheets:', err);
      alert(
        lang === 'bn'
          ? `Google Sheets সিঙ্ক ব্যর্থ হয়েছে: ${err.message || 'Error'}`
          : `Google Sheets sync error: ${err.message || 'Error'}`
      );
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Category-specific Excel/CSV Export handler
  const handleExportCategoryExcel = (targetCategory: string = selectedCategory) => {
    let targetEntries = activeEntries;
    if (targetCategory === 'DISCONNECTION') {
      targetEntries = discEntriesFromTasks;
    } else if (targetCategory !== 'ALL') {
      targetEntries = activeEntries.filter((e) => e.category === targetCategory);
    }

    if (targetEntries.length === 0) {
      alert(
        lang === 'bn'
          ? `"${targetCategory}" ক্যাটাগরিতে কোনো ডাটা পাওয়া যায়নি`
          : `No data found in category "${targetCategory}"`
      );
      return;
    }

    const dateStamp = getNowDateDDMMYYYY();
    let filename = `WBSEDCL_${targetCategory}_Report_${dateStamp}.csv`;
    let headers: string[] = [];
    let rows: string[][] = [];

    if (targetCategory === 'NSC') {
      filename = `WBSEDCL_NSC_Report_${dateStamp}.csv`;
      headers = [
        'SL No',
        'Record ID',
        'Date Time',
        'Work Order No',
        'Work Order Date',
        'Application No',
        'Consumer ID',
        'Meter No',
        'Meter Seal No',
        'Consumer Name',
        "Father's / Husband's Name",
        'Mobile No',
        'Initial Reading',
        'Sanctioned Load (kW)',
        'Supply Phase',
        'Tariff Category',
        'Service Cable Length (Meters)',
        'Premises / Location Address',
        'Meter Installation Date',
        'Inspection Agency Name',
        'Worker Name',
        'Agency Name',
        'CCC Name',
        'Status',
        'GPS Coordinates',
        'Remarks / Notes'
      ];
      rows = targetEntries.map((e, idx) => [
        String(idx + 1),
        `"${e.id}"`,
        `"${formatDateTime12Hour(e.date)}"`,
        `"${e.workOrderNo || ''}"`,
        `"${formatDateDDMMYYYY(e.workOrderDate)}"`,
        `"${e.applicationNo || ''}"`,
        `"${e.consumerId || ''}"`,
        `"${e.meterNo || ''}"`,
        `"${e.sealNo || ''}"`,
        `"${(e.consumerName || '').replace(/"/g, '""')}"`,
        `"${(e.fatherName || '').replace(/"/g, '""')}"`,
        `"${e.mobile || ''}"`,
        `"${e.initialReading || ''}"`,
        `"${e.appliedLoad || ''}"`,
        `"${e.phase || ''}"`,
        `"${e.tariffCategory || ''}"`,
        `"${e.serviceCableLength || ''}"`,
        `"${(e.address || '').replace(/"/g, '""')}"`,
        `"${formatDateDDMMYYYY(e.meterInstallDate)}"`,
        `"${cleanNameOnly(e.inspectionAgencyName || '').replace(/"/g, '""')}"`,
        `"${cleanNameOnly(e.workerName || '').replace(/"/g, '""')}"`,
        `"${cleanNameOnly(e.agencyName || '').replace(/"/g, '""')}"`,
        `"${(e.cccName || e.cccOffice || '').replace(/"/g, '""')}"`,
        `"${e.status}"`,
        `"${e.locationGps || ''}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ]);
    } else if (targetCategory === 'DISCONNECTION') {
      filename = `WBSEDCL_Disconnection_Report_${dateStamp}.csv`;
      headers = [
        'SL No',
        'Record ID',
        'Date Time',
        'Consumer ID',
        'Consumer Name',
        'Mobile No',
        'Address / Location',
        'Arrear Amount (INR)',
        'Disconnection Reason',
        'Final Meter Reading (kWh)',
        'Meter No',
        'Pole No',
        'Worker Name',
        'CCC Office',
        'Status',
        'GPS Coordinates',
        'Remarks / Notes'
      ];
      rows = targetEntries.map((e, idx) => [
        String(idx + 1),
        `"${e.id}"`,
        `"${formatDateTime12Hour(e.date)}"`,
        `"${e.consumerId || ''}"`,
        `"${(e.consumerName || '').replace(/"/g, '""')}"`,
        `"${e.mobile || ''}"`,
        `"${(e.address || '').replace(/"/g, '""')}"`,
        `"${e.arrearAmount || ''}"`,
        `"${(e.reason || '').replace(/"/g, '""')}"`,
        `"${e.finalReading || ''}"`,
        `"${e.meterNo || ''}"`,
        `"${e.poleNo || ''}"`,
        `"${cleanNameOnly(e.workerName || '').replace(/"/g, '""')}"`,
        `"${(e.cccOffice || '').replace(/"/g, '""')}"`,
        `"${e.status}"`,
        `"${e.locationGps || ''}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ]);
    } else if (targetCategory === 'POLE CASE') {
      filename = `WBSEDCL_Pole_Case_Report_${dateStamp}.csv`;
      headers = [
        'SL No',
        'Record ID',
        'Date Time',
        'Pole Number',
        'Fault / Issue Type',
        'Priority Level',
        'Location / Address',
        'Maintenance Action Taken',
        'Materials Consumed',
        'Lineman / Staff Name',
        'Feeder Name',
        'Substation',
        'Status',
        'GPS Coordinates',
        'Remarks / Notes'
      ];
      rows = targetEntries.map((e, idx) => [
        String(idx + 1),
        `"${e.id}"`,
        `"${formatDateTime12Hour(e.date)}"`,
        `"${e.poleNo || ''}"`,
        `"${(e.issueType || '').replace(/"/g, '""')}"`,
        `"${e.priority || ''}"`,
        `"${(e.address || '').replace(/"/g, '""')}"`,
        `"${(e.actionTaken || '').replace(/"/g, '""')}"`,
        `"${(e.materialUsed || '').replace(/"/g, '""')}"`,
        `"${(e.workerName || '').replace(/"/g, '""')}"`,
        `"${(e.feederName || '').replace(/"/g, '""')}"`,
        `"${(e.substation || '').replace(/"/g, '""')}"`,
        `"${e.status}"`,
        `"${e.locationGps || ''}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ]);
    } else if (targetCategory === 'METER REPLESMENT') {
      filename = `WBSEDCL_Meter_Replacement_Report_${dateStamp}.csv`;
      headers = [
        'SL No',
        'Record ID',
        'Date Time',
        'Consumer ID',
        'Consumer Name',
        'Mobile No',
        'Address / Location',
        'Old Defective Meter No',
        'Old Meter Final Reading',
        'New Meter Serial No',
        'New Initial Reading',
        'Security Seal No',
        'Replacement Reason',
        'Lineman / Staff Name',
        'Feeder Name',
        'Status',
        'GPS Coordinates',
        'Remarks / Notes'
      ];
      rows = targetEntries.map((e, idx) => [
        String(idx + 1),
        `"${e.id}"`,
        `"${formatDateTime12Hour(e.date)}"`,
        `"${e.consumerId || ''}"`,
        `"${(e.consumerName || '').replace(/"/g, '""')}"`,
        `"${e.mobile || ''}"`,
        `"${(e.address || '').replace(/"/g, '""')}"`,
        `"${e.oldMeterNo || ''}"`,
        `"${e.finalReading || ''}"`,
        `"${e.newMeterNo || ''}"`,
        `"${e.initialReading || ''}"`,
        `"${e.sealNo || ''}"`,
        `"${(e.reason || '').replace(/"/g, '""')}"`,
        `"${(e.workerName || '').replace(/"/g, '""')}"`,
        `"${(e.feederName || '').replace(/"/g, '""')}"`,
        `"${e.status}"`,
        `"${e.locationGps || ''}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ]);
    } else if (targetCategory === 'DTR REPLESMENT') {
      filename = `WBSEDCL_DTR_Replacement_Report_${dateStamp}.csv`;
      headers = [
        'SL No',
        'Record ID',
        'Date Time',
        'DTR Code / Name',
        'Existing Capacity',
        'Upgraded / New Capacity',
        'Old DTR Serial No',
        'New DTR Serial No',
        'Earth Resistance (Ohms)',
        'Substation',
        'Feeder Name',
        'Location / Address',
        'Lineman / Staff Name',
        'Status',
        'GPS Coordinates',
        'Remarks / Notes'
      ];
      rows = targetEntries.map((e, idx) => [
        String(idx + 1),
        `"${e.id}"`,
        `"${formatDateTime12Hour(e.date)}"`,
        `"${(e.dtrName || '').replace(/"/g, '""')}"`,
        `"${e.existingCapacity || ''}"`,
        `"${e.newCapacity || ''}"`,
        `"${e.oldDtrSerial || ''}"`,
        `"${e.newDtrSerial || ''}"`,
        `"${e.earthResistance || ''}"`,
        `"${(e.substation || '').replace(/"/g, '""')}"`,
        `"${(e.feederName || '').replace(/"/g, '""')}"`,
        `"${(e.address || '').replace(/"/g, '""')}"`,
        `"${(e.workerName || '').replace(/"/g, '""')}"`,
        `"${e.status}"`,
        `"${e.locationGps || ''}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ]);
    } else {
      // ALL CATEGORIES COMPREHENSIVE MASTER REPORT
      filename = `WBSEDCL_Master_All_Categories_Report_${dateStamp}.csv`;
      headers = [
        'SL No',
        'Record ID',
        'Date Time',
        'Category',
        'Lineman / Worker Name',
        'Agency Name',
        'CCC Name',
        'Feeder Name',
        'Substation',
        'Status',
        'Work Order No',
        'Work Order Date',
        'Application No',
        'Consumer ID',
        'Consumer Name',
        "Father's / Husband's Name",
        'Mobile No',
        'Address / Location',
        'Meter No',
        'Meter Seal No',
        'Initial Reading',
        'Final Reading',
        'Applied Load',
        'Supply Phase',
        'Tariff Category',
        'Service Cable Length',
        'Meter Install Date',
        'Inspection Agency',
        'Pole No',
        'Arrear Amount',
        'Reason',
        'Issue Type',
        'Priority',
        'Action Taken',
        'Material Used',
        'Old Meter No',
        'New Meter No',
        'DTR Name',
        'Existing Capacity',
        'New Capacity',
        'Old DTR Serial',
        'New DTR Serial',
        'Earth Resistance',
        'GPS Coordinates',
        'Notes'
      ];
      rows = targetEntries.map((e, idx) => [
        String(idx + 1),
        `"${e.id}"`,
        `"${formatDateTime12Hour(e.date)}"`,
        `"${e.category}"`,
        `"${(e.workerName || '').replace(/"/g, '""')}"`,
        `"${(e.agencyName || '').replace(/"/g, '""')}"`,
        `"${(e.cccName || e.cccOffice || '').replace(/"/g, '""')}"`,
        `"${(e.feederName || '').replace(/"/g, '""')}"`,
        `"${(e.substation || '').replace(/"/g, '""')}"`,
        `"${e.status}"`,
        `"${e.workOrderNo || ''}"`,
        `"${formatDateDDMMYYYY(e.workOrderDate)}"`,
        `"${e.applicationNo || ''}"`,
        `"${e.consumerId || ''}"`,
        `"${(e.consumerName || '').replace(/"/g, '""')}"`,
        `"${(e.fatherName || '').replace(/"/g, '""')}"`,
        `"${e.mobile || ''}"`,
        `"${(e.address || '').replace(/"/g, '""')}"`,
        `"${e.meterNo || ''}"`,
        `"${e.sealNo || ''}"`,
        `"${e.initialReading || ''}"`,
        `"${e.finalReading || ''}"`,
        `"${e.appliedLoad || ''}"`,
        `"${e.phase || ''}"`,
        `"${e.tariffCategory || ''}"`,
        `"${e.serviceCableLength || ''}"`,
        `"${formatDateDDMMYYYY(e.meterInstallDate)}"`,
        `"${(e.inspectionAgencyName || '').replace(/"/g, '""')}"`,
        `"${e.poleNo || ''}"`,
        `"${e.arrearAmount || ''}"`,
        `"${(e.reason || '').replace(/"/g, '""')}"`,
        `"${(e.issueType || '').replace(/"/g, '""')}"`,
        `"${e.priority || ''}"`,
        `"${(e.actionTaken || '').replace(/"/g, '""')}"`,
        `"${(e.materialUsed || '').replace(/"/g, '""')}"`,
        `"${e.oldMeterNo || ''}"`,
        `"${e.newMeterNo || ''}"`,
        `"${(e.dtrName || '').replace(/"/g, '""')}"`,
        `"${e.existingCapacity || ''}"`,
        `"${e.newCapacity || ''}"`,
        `"${e.oldDtrSerial || ''}"`,
        `"${e.newDtrSerial || ''}"`,
        `"${e.earthResistance || ''}"`,
        `"${e.locationGps || ''}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ]);
    }

    // UTF-8 BOM prefix \uFEFF ensures Microsoft Excel opens Bengali text and numbers cleanly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Initial refresh when Admin Dashboard is opened (ongoing sync is centrally managed by App.tsx)
  React.useEffect(() => {
    onRefresh();
  }, []);

  const isDeletedLocally = React.useCallback((item: any) => {
    if (!item || locallyDeletedIds.size === 0) return false;
    const candidates = [
      item.id,
      item.submissionId,
      item.consumerId,
      item['Consumer Id'],
      item.taskId,
      item.consumerId ? `TASK-DISC-${item.consumerId}` : ''
    ];
    for (const c of candidates) {
      if (c && locallyDeletedIds.has(String(c).trim())) return true;
    }
    return false;
  }, [locallyDeletedIds]);

  const activeEntries = React.useMemo(
    () =>
      entries.filter((e) => {
        if (isDeletedLocally(e)) return false;
        const catUp = String(e.category || '').toUpperCase().trim();
        const idUp = String(e.id || '').toUpperCase().trim();
        return catUp !== 'DISCONNECTION' && !idUp.startsWith('TASK-DISC-') && !idUp.startsWith('PWR-DIS-');
      }),
    [entries, isDeletedLocally]
  );

  const effectiveDiscTasks: DisconnectionTask[] = React.useMemo(() => {
    return (disconnectionTasks || [])
      .filter(t => !isDeletedLocally(t))
      .map(t => {
        const cId = String(t.consumerId || (t as any)['Consumer Id'] || t.taskId || '').replace(/^TASK-DISC-/i, '').trim();
        const ov = localReissueOverrides[cId];
        if (ov === 'APPROVED') {
          const baseNotes = cleanDisconnectionNotes(t.workerRemarks || t.notes || '');
          const appNotes = `${baseNotes} [REISSUE_APPROVED]`.trim();
          return {
            ...t,
            taskStatus: 'REISSUE' as any,
            disconStatus: 'REISSUE',
            workerRemarks: appNotes,
            notes: appNotes,
            reissueRequested: false,
            reissueApproved: true,
            reissueRejected: false
          };
        }
        if (ov === 'REJECTED') {
          const baseNotes = cleanDisconnectionNotes(t.workerRemarks || t.notes || '');
          const rejNotes = `${baseNotes} [REISSUE_REJECTED]`.trim();
          return {
            ...t,
            workerRemarks: rejNotes,
            notes: rejNotes,
            reissueRequested: false,
            reissueApproved: false,
            reissueRejected: true
          };
        }
        return t;
      });
  }, [disconnectionTasks, isDeletedLocally, localReissueOverrides]);

  const pendingReissueTasks = React.useMemo(
    () => effectiveDiscTasks.filter(t => getReissueLockState(t).reissueRequested),
    [effectiveDiscTasks]
  );

  const discEntriesFromTasks: PowerEntry[] = React.useMemo(() => {
    return effectiveDiscTasks.map((t) => {
      const raw: any = t;
      const cid = String(t.consumerId || raw['Consumer Id'] || raw.id || '').replace(/^TASK-DISC-/i, '').trim();
      const st = String(t.disconStatus || t.taskStatus || raw['Discon Status'] || 'PENDING').toUpperCase();
      return {
        id: t.taskId || raw.id || `TASK-DISC-${cid}`,
        submissionId: cid || t.taskId || raw.id,
        category: 'DISCONNECTION' as CategoryType,
        workerName: raw.updatedBy || t.assignedWorkerName || raw.agencyName || t.assignedAgency || raw['Agency'] || 'Field Team',
        feederName: t.mruSection || raw['MRU'] || '',
        substation: '',
        date: t.disconDate || t.reportDate || t.updatedAt || t.createdAt || '',
        createdAt: t.createdAt || t.disconDate || t.reportDate || new Date().toISOString(),
        status:
          st.includes('PAID') || st.includes('DISCONNECT') || st.includes('COMPLETE')
            ? 'Completed'
            : 'Pending',
        notes: raw.remarks || t.workerRemarks || t.workerReport || raw['Notes'] || '',
        reason: raw.remarks || t.workerRemarks || raw['Notes'] || 'Non-Payment of Electricity Dues',
        consumerId: cid,
        consumerName: t.consumerName || raw['Name'] || '',
        mobile: t.mobile || t.phoneNumber || raw['Mobile'] || '',
        address: raw.address || t.consumerAddress || raw['Address'] || '',
        meterNo: raw.meterNo || t.meterNumber || raw['Number'] || '',
        poleNo: raw.poleNo || t.gisPole || raw['Gis Pole'] || '',
        arrearAmount: raw.arrearAmount || t.outstandingDue || raw['D2 Net O/S'] || '0',
        finalReading: t.meterReading || raw['Reading'] || '0',
        disconStatus: st,
        baseClass: t.baseClass || raw['Base Class'] || raw['Class'] || '',
        device: t.device || t.deviceType || raw['Device'] || '',
        phase: t.device || t.deviceType || raw['Device'] || '',
        tariffCategory: t.baseClass || raw['Class'] || '',
        agencyName: raw.agencyName || t.assignedAgency || raw['Agency'] || '',
        photoUrl: t.photoUrl || raw['Image'] || raw.imageUrl || raw.image || '',
      };
    });
  }, [effectiveDiscTasks]);

  // Filter calculations strictly isolated per category tab (memoized for instantaneous UI response)
  const sourceEntriesForSelectedCategory = useMemo(() => {
    if (selectedCategory === 'DISCONNECTION') {
      return discEntriesFromTasks;
    }
    if (selectedCategory === 'ALL') {
      return activeEntries;
    }
    return activeEntries.filter((item) => item.category === selectedCategory);
  }, [selectedCategory, discEntriesFromTasks, activeEntries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const hasQuery = q.length > 0;
    const matchStatus = selectedStatus !== 'ALL';

    return sourceEntriesForSelectedCategory.filter((item) => {
      if (matchStatus && item.status !== selectedStatus) {
        return false;
      }
      if (!hasQuery) {
        return true;
      }
      // High-performance targeted property search (avoids expensive full-object JSON.stringify)
      const fields = [
        item.consumerName,
        item.consumerId,
        item.meterNo,
        item.mobile,
        item.applicationNo,
        item.workerName,
        item.agencyName,
        item.id,
        item.address,
        item.poleNo,
        item.status,
        item.category,
        item.remarks,
        item.disconStatus,
      ];
      for (let i = 0; i < fields.length; i++) {
        const val = fields[i];
        if (val && String(val).toLowerCase().includes(q)) {
          return true;
        }
      }
      return false;
    });
  }, [sourceEntriesForSelectedCategory, selectedStatus, searchQuery]);

  // Metrics summary (strictly 1-to-1 with Backend Google Sheet tabs - single-pass loop)
  const { nscCount, discCount, poleCount, meterCount, dtrCount, total, pendingCount, completedCount, approvedCount } = useMemo(() => {
    let nsc = 0;
    let pole = 0;
    let meter = 0;
    let dtr = 0;
    let pending = 0;
    let completed = 0;
    let approved = 0;

    for (let i = 0; i < activeEntries.length; i++) {
      const e = activeEntries[i];
      if (e.category === 'NSC') nsc++;
      else if (e.category === 'POLE CASE') pole++;
      else if (e.category === 'METER REPLESMENT') meter++;
      else if (e.category === 'DTR REPLESMENT') dtr++;

      if (e.status === 'Pending') pending++;
      else if (e.status === 'Completed') completed++;
      else if (e.status === 'Approved') approved++;
    }

    const disc = effectiveDiscTasks.length;
    return {
      nscCount: nsc,
      discCount: disc,
      poleCount: pole,
      meterCount: meter,
      dtrCount: dtr,
      total: nsc + disc + pole + meter + dtr,
      pendingCount: pending,
      completedCount: completed,
      approvedCount: approved,
    };
  }, [activeEntries, effectiveDiscTasks]);

  const handleStatusChange = async (id: string, newStatus: StatusType) => {
    setUpdatingId(id);
    try {
      const updated = await updateEntry(id, { status: newStatus });
      if (selectedEntry && selectedEntry.id === id) {
        setSelectedEntry(updated);
      }
      onRefresh();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = (entryOrId: PowerEntry | string) => {
    let target: PowerEntry | undefined;
    if (typeof entryOrId === 'string') {
      target = activeEntries.find(e => e.id === entryOrId || e.submissionId === entryOrId);
      if (!target && selectedEntry && (selectedEntry.id === entryOrId || selectedEntry.submissionId === entryOrId)) {
        target = selectedEntry;
      }
      if (!target) {
        target = { id: entryOrId, category: 'NSC', status: 'Completed', date: new Date().toISOString() } as PowerEntry;
      }
    } else {
      target = entryOrId;
    }

    setEntryToDelete(target);
    setDeleteError(null);
  };

  const executeDeleteEntry = async () => {
    if (!entryToDelete) return;
    const target = entryToDelete;

    // 1. Immediately mark as deleted in UI (0ms delay) and close confirmation modal
    setLocallyDeletedIds(prev => {
      const next = new Set(prev);
      if (target.id) next.add(String(target.id).trim());
      if (target.submissionId) next.add(String(target.submissionId).trim());
      if (target.consumerId) {
        next.add(String(target.consumerId).trim());
        next.add(`TASK-DISC-${String(target.consumerId).trim()}`);
      }
      return next;
    });
    if (selectedEntry?.id === target.id || selectedEntry?.submissionId === target.id) {
      setSelectedEntry(null);
    }
    setEntryToDelete(null);
    setIsDeletingEntry(false);

    // 2. Permanently delete on server & Backend Google Sheet
    try {
      if (target.category === 'DISCONNECTION' || String(target.id || '').startsWith('TASK-DISC-')) {
        await deleteDisconnectionTask({
          id: target.id,
          consumerId: target.consumerId || target.id
        });
      } else {
        await deleteEntry(target.id, target.category, target.submissionId, {
          confirmCritical: true,
          reason: 'Confirmed by Admin',
          status: target.status,
          meterNo: target.meterNo,
          sealNo: target.sealNo,
          entry: target
        });
      }
      onRefresh();
    } catch (err: any) {
      console.warn('Delete background notice:', err);
    }
  };

  const handleClearAll = () => {
    setIsClearAllModalOpen(true);
    setClearAllConfirmText('');
    setClearAllError(null);
  };

  const executeClearAll = async () => {
    if (clearAllConfirmText.trim().toUpperCase() !== 'CLEAR ALL') {
      setClearAllError(lang === 'bn' 
        ? 'নিশ্চিত করতে হুবহু "CLEAR ALL" লিখুন' 
        : 'Type "CLEAR ALL" exactly to confirm');
      return;
    }

    setIsClearingAll(true);
    setClearAllError(null);

    try {
      await clearAllEntries('CONFIRM_PERMANENT_WIPE');
      setLocallyDeletedIds(prev => {
        const next = new Set(prev);
        entries.forEach(e => {
          if (e.id) next.add(String(e.id).trim());
          if (e.submissionId) next.add(String(e.submissionId).trim());
          if (e.consumerId) {
            next.add(String(e.consumerId).trim());
            next.add(`TASK-DISC-${String(e.consumerId).trim()}`);
          }
        });
        if (disconnectionTasks) {
          disconnectionTasks.forEach(t => {
            const cid = String(t.consumerId || (t as any)['Consumer Id'] || '').trim();
            if (cid) {
              next.add(cid);
              next.add(`TASK-DISC-${cid}`);
            }
            if (t.taskId) next.add(String(t.taskId).trim());
          });
        }
        return next;
      });
      setIsClearAllModalOpen(false);
      setSelectedEntry(null);
      setEditingEntry(null);
      setEntryToDelete(null);
      onRefresh();
    } catch (err: any) {
      setClearAllError(err.message || 'Failed to clear entries');
    } finally {
      setIsClearingAll(false);
    }
  };

  const handlePrintCertificate = (entry: PowerEntry) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>POWER Utility Work Receipt - ${entry.id}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #111; }
          .header { text-align: center; border-bottom: 2px solid #f59e0b; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 26px; font-weight: bold; color: #b45309; }
          .subtitle { font-size: 14px; color: #555; }
          .badge { display: inline-block; padding: 4px 12px; background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; border-radius: 6px; font-weight: bold; font-size: 13px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          .card { border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; background: #fafafa; }
          .card-title { font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: bold; margin-bottom: 4px; }
          .card-val { font-size: 15px; font-weight: 600; color: #111827; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 13px; }
          th { background: #f3f4f6; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; padding-top: 30px; border-top: 1px dashed #9ca3af; }
          .sig-line { width: 180px; border-top: 1px solid #374151; text-align: center; font-size: 12px; padding-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">⚡ POWER DISTRIBUTION FIELD REPORT</div>
          <div class="subtitle">Electric Utility Work Order & Verification Certificate</div>
          <div style="margin-top: 10px;">
            <span class="badge">Category: ${entry.category}</span>
            <span class="badge" style="background:#e0f2fe; color:#0369a1; border-color:#38bdf8;">Work ID: ${entry.id}</span>
            <span class="badge" style="background:#dcfce7; color:#15803d; border-color:#22c55e;">Status: ${entry.status}</span>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">Worker / Lineman Name</div>
            <div class="card-val">${entry.workerName || 'N/A'}</div>
          </div>
          <div class="card">
            <div class="card-title">Submission Date & Time</div>
            <div class="card-val">${formatDateTime12Hour(entry.date)}</div>
          </div>
          <div class="card">
            <div class="card-title">Substation & Feeder</div>
            <div class="card-val">${entry.feederName || 'N/A'}</div>
          </div>
          <div class="card">
            <div class="card-title">Site / GPS Coordinates</div>
            <div class="card-val">${entry.locationGps || entry.address || 'Field Location Recorded'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Field Parameter</th>
              <th>Recorded Value / Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${entry.consumerName ? `<tr><td><strong>Consumer Name</strong></td><td>${entry.consumerName} ${entry.fatherName ? `(Father: ${entry.fatherName})` : ''}</td></tr>` : ''}
            ${entry.consumerId ? `<tr><td><strong>Consumer / Account ID</strong></td><td>${entry.consumerId}</td></tr>` : ''}
            ${entry.mobile ? `<tr><td><strong>Mobile Contact</strong></td><td>${entry.mobile}</td></tr>` : ''}
            ${entry.address ? `<tr><td><strong>Address / Location</strong></td><td>${entry.address}</td></tr>` : ''}
            ${entry.poleNo ? `<tr><td><strong>Pole Number</strong></td><td>${entry.poleNo}</td></tr>` : ''}
            ${entry.appliedLoad ? `<tr><td><strong>Applied Load / Phase</strong></td><td>${entry.appliedLoad} (${entry.phase || '1-Phase'})</td></tr>` : ''}
            ${entry.meterNo ? `<tr><td><strong>Meter Serial No.</strong></td><td>${entry.meterNo} (Initial Reading: ${entry.initialReading || '000000'})</td></tr>` : ''}
            ${entry.sealNo ? `<tr><td><strong>Security Seal No.</strong></td><td>${entry.sealNo}</td></tr>` : ''}
            ${entry.arrearAmount ? `<tr><td><strong>Arrear Amount</strong></td><td>₹ ${entry.arrearAmount}</td></tr>` : ''}
            ${entry.reason ? `<tr><td><strong>Disconnection Reason</strong></td><td>${entry.reason}</td></tr>` : ''}
            ${entry.finalReading ? `<tr><td><strong>Final Meter Reading</strong></td><td>${entry.finalReading} kWh</td></tr>` : ''}
            ${entry.issueType ? `<tr><td><strong>Pole Fault / Issue</strong></td><td>${entry.issueType}</td></tr>` : ''}
            ${entry.priority ? `<tr><td><strong>Priority Level</strong></td><td>${entry.priority}</td></tr>` : ''}
            ${entry.actionTaken ? `<tr><td><strong>Maintenance Action</strong></td><td>${entry.actionTaken}</td></tr>` : ''}
            ${entry.materialUsed ? `<tr><td><strong>Materials Consumed</strong></td><td>${entry.materialUsed}</td></tr>` : ''}
            ${entry.oldMeterNo ? `<tr><td><strong>Old Meter No. & Reading</strong></td><td>${entry.oldMeterNo} (Reading: ${entry.finalReading || 'N/A'})</td></tr>` : ''}
            ${entry.newMeterNo ? `<tr><td><strong>New Meter Serial No.</strong></td><td>${entry.newMeterNo} (Reading: ${entry.initialReading || '000000'})</td></tr>` : ''}
            ${entry.dtrName ? `<tr><td><strong>DTR Code & Capacity</strong></td><td>${entry.dtrName} (${entry.existingCapacity || ''} ➔ ${entry.newCapacity || ''})</td></tr>` : ''}
            ${entry.oldDtrSerial ? `<tr><td><strong>Old DTR Serial</strong></td><td>${entry.oldDtrSerial}</td></tr>` : ''}
            ${entry.newDtrSerial ? `<tr><td><strong>New DTR Serial</strong></td><td>${entry.newDtrSerial}</td></tr>` : ''}
            ${entry.earthResistance ? `<tr><td><strong>Earth Resistance</strong></td><td>${entry.earthResistance}</td></tr>` : ''}
            ${entry.notes ? `<tr><td><strong>Technician Notes</strong></td><td>${entry.notes}</td></tr>` : ''}
          </tbody>
        </table>

        <div class="footer">
          <div>
            <div class="sig-line">Lineman / Field Technician Signature</div>
          </div>
          <div>
            <div class="sig-line">Sub-Assistant Engineer / Officer</div>
          </div>
          <div>
            <div class="sig-line">POWER Admin Approval Seal</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      {/* Admin Top Dashboard Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-amber-400/10 via-sky-400/5 to-transparent rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4 relative">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <div className="absolute -inset-0.5 bg-gradient-to-tr from-amber-500 via-yellow-400 to-orange-500 rounded-full opacity-80 blur-[1px]" />
              <img 
                src={appLogo} 
                alt="Power of Construction Round Logo" 
                className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover shadow-md border-2 border-white p-0.5 bg-white shrink-0"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-xs" title="Live System Online" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 text-amber-400 text-[10px] font-black uppercase tracking-widest shadow-2xs border border-slate-800">
                  <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                  <span>WBSEDCL EXECUTIVE SUITE</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live Master Data</span>
                </span>
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 flex-wrap">
                  <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-500 bg-clip-text text-transparent drop-shadow-2xs">
                    POWER
                  </span>
                  <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 bg-clip-text text-transparent">
                    Admin Control Panel
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {lang === 'bn'
                  ? 'ফিল্ড ইঞ্জিনিয়ারিং, ওয়ার্কার আইডি, লাইভ ক্লাউড সিঙ্ক ও মাস্টার রিপোর্ট কমান্ড সেন্টার'
                  : 'Real-time field operations, identity governance & live cloud synchronization hub'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="admin-refresh-btn"
              onClick={onRefresh}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-200 transition-all active:scale-95 cursor-pointer shadow-xs"
              title="Refresh Data (তথ্য রিফ্রেশ করুন)"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>

            {onOpenLanguageModal && (
              <button
                id="admin-language-btn"
                onClick={onOpenLanguageModal}
                className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-blue-200 transition-all cursor-pointer shadow-xs active:scale-95"
                title="Change Language"
              >
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span className="uppercase text-[11px] font-mono">{lang}</span>
              </button>
            )}

            {entries.length > 0 && (
              <button
                id="admin-clear-all-btn"
                onClick={handleClearAll}
                className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-rose-200 transition-colors cursor-pointer"
                title="Clear All Data (সকল ডাটা মুছুন)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            {onLogout && (
              <button
                id="admin-module-logout-btn"
                onClick={onLogout}
                className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                title="Logout from Admin Session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>

        {/* ORGANIZED ADMIN OPERATIONS & DATA CONTROL HUB (4 Bespoke Executive Modules) */}
        <div className="mt-4 pt-3">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                {lang === 'bn' ? 'অ্যাডমিন অপারেশন ও ডাটা কন্ট্রোল হাব' : 'Admin Operations & Data Control Hub'}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Compact "Reissue Request's" Option Button in Admin Panel */}
              <button
                id="admin-reissue-requests-btn"
                type="button"
                onClick={() => {
                  setShowReissueRequestsPanel(prev => !prev);
                  setTimeout(() => {
                    document.getElementById('admin-reissue-requests-inbox')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 80);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer shadow-xs active:scale-95 ${
                  pendingReissueTasks.length > 0
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-500 shadow-purple-500/25 ring-2 ring-purple-300/60'
                    : showReissueRequestsPanel
                      ? 'bg-purple-100 text-purple-900 border-purple-300'
                      : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200'
                }`}
                title="View Worker Reissue Requests (Approve or Reject)"
              >
                <MessageSquareWarning className={`w-3.5 h-3.5 ${pendingReissueTasks.length > 0 ? 'text-amber-300 animate-bounce' : 'text-purple-600'}`} />
                <span>Reissue Request's</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    pendingReissueTasks.length > 0
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-purple-200/80 text-purple-900'
                  }`}
                >
                  {pendingReissueTasks.length}
                </span>
              </button>

              <span className="text-[10px] text-slate-600 font-extrabold bg-slate-100/90 border border-slate-200/80 px-2.5 py-1 rounded-full hidden md:inline-flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-amber-600" />
                <span>{lang === 'bn' ? 'আইডি ভল্ট • ক্লাউড সিঙ্ক • এক্সেল রিপোর্ট • ওয়ার্ক অর্ডার' : 'ID Vault • Cloud Sync • Excel Export • Work Orders'}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Worker & User Accounts (Manage IDs) */}
            <button
              id="admin-manage-users-btn"
              type="button"
              onClick={() => {
                setUserModalTab('create');
                setIsUserModalOpen(true);
              }}
              className="text-left p-4 rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/70 hover:shadow-lg hover:shadow-amber-500/10 hover:border-amber-400 transition-all cursor-pointer group relative overflow-hidden active:scale-[0.99] flex flex-col justify-between"
              title="Create & manage worker or admin login IDs and passwords"
            >
              <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-amber-400/10 group-hover:scale-125 transition-transform pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm shadow-amber-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-amber-100/90 text-amber-900 border-amber-300 flex items-center gap-1 shadow-2xs">
                    <KeyRound className="w-2.5 h-2.5 text-amber-700" />
                    <span>{lang === 'bn' ? 'আইডি ও পিন' : 'Manage IDs'}</span>
                  </span>
                </div>

                <div className="mt-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700/80 truncate">
                    {lang === 'bn' ? '01 • আইডেন্টিটি ও অ্যাক্সেস ভল্ট' : '01 • IDENTITY & ACCESS VAULT'}
                  </p>
                  <div className="flex items-center justify-between gap-1.5 mt-0.5">
                    <span className="text-sm sm:text-base font-black text-slate-900 group-hover:text-amber-700 transition-colors truncate">
                      {lang === 'bn' ? 'ইউজার ও আইডি কন্ট্রোল' : 'Worker & Admin IDs'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                    {lang === 'bn' ? 'নতুন আইডি তৈরি, লিস্ট ও পাসওয়ার্ড' : 'Create IDs, directory & PIN control'}
                  </p>
                </div>
              </div>

              <div className="w-full bg-amber-100 rounded-full h-1.5 mt-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full w-full" />
              </div>
            </button>

            {/* 2. Google Sheets Live Cloud Backend */}
            <div className="text-left p-4 rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50/90 via-white to-blue-50/70 hover:shadow-lg hover:shadow-sky-500/10 hover:border-sky-400 transition-all group relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-sky-400/10 group-hover:scale-125 transition-transform pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <button
                    type="button"
                    onClick={handleSyncToGoogleSheets}
                    disabled={isSyncingSheets}
                    className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm shadow-sky-500/20 flex items-center justify-center group-hover:scale-105 transition-transform cursor-pointer"
                    title="Sync with Google Sheets"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                  </button>
                  {currentSheetUrl ? (
                    <a
                      href={currentSheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-sky-100/90 hover:bg-sky-200 text-sky-900 border-sky-300 flex items-center gap-1 transition-colors shadow-2xs"
                      title="Open Live Google Sheet Spreadsheet"
                    >
                      <span>{lang === 'bn' ? 'শীট খুলুন' : 'Open Sheet'}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-sky-100/90 text-sky-900 border-sky-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Cloud Live</span>
                    </span>
                  )}
                </div>

                <button
                  id="admin-sync-google-sheets-btn"
                  type="button"
                  onClick={handleSyncToGoogleSheets}
                  disabled={isSyncingSheets}
                  className="w-full text-left mt-1 cursor-pointer disabled:opacity-60"
                  title="Google Sheets-এ সম্পূর্ণ ডাটাবেস লাইভ ব্যাকআপ ও সেভ করুন"
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700/80 truncate">
                    {lang === 'bn' ? '02 • গুগল শীটস ক্লাউড ইঞ্জিন' : '02 • GOOGLE SHEETS CLOUD'}
                  </p>
                  <div className="flex items-center justify-between gap-1.5 mt-0.5">
                    <span className="text-sm sm:text-base font-black text-slate-900 group-hover:text-sky-700 transition-colors truncate">
                      {isSyncingSheets ? (lang === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing Cloud...') : (lang === 'bn' ? 'লাইভ শীট সিঙ্ক' : 'Sync Master Sheet')}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-sky-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                    {lang === 'bn' ? 'অনলাইন লাইভ ডাটাবেস ব্যাকআপ' : 'Instant two-way cloud backup'}
                  </p>
                </button>
              </div>

              <div className="w-full bg-sky-100 rounded-full h-1.5 mt-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full w-full" />
              </div>
            </div>

            {/* 3. Category Excel Export & Reports */}
            <div className="relative">
              <div className="w-full h-full text-left p-4 rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/70 hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-400 transition-all group relative overflow-hidden flex flex-col justify-between">
                <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-emerald-400/10 group-hover:scale-125 transition-transform pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <button
                      type="button"
                      onClick={() => handleExportCategoryExcel(selectedCategory)}
                      className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/20 flex items-center justify-center group-hover:scale-105 transition-transform cursor-pointer"
                      title="Download Excel / CSV"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-emerald-100/90 hover:bg-emerald-200 text-emerald-900 border-emerald-300 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      title="Choose Category to Export"
                    >
                      <span>{selectedCategory === 'ALL' ? `${total} All` : selectedCategory}</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    id="admin-export-csv-btn"
                    type="button"
                    onClick={() => handleExportCategoryExcel(selectedCategory)}
                    className="w-full text-left mt-1 cursor-pointer"
                    title={`Download ${selectedCategory === 'ALL' ? 'All' : selectedCategory} Excel / CSV Report`}
                  >
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700/80 truncate">
                      {lang === 'bn' ? '03 • এক্সেল ও CSV রিপোর্ট' : '03 • EXCEL & CSV EXPORT'}
                    </p>
                    <div className="flex items-center justify-between gap-1.5 mt-0.5">
                      <span className="text-sm sm:text-base font-black text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                        Export {selectedCategory === 'ALL' ? 'Master' : selectedCategory}
                      </span>
                      <Download className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                      {lang === 'bn' ? 'ক্যাটাগরি ভিত্তিক রিপোর্ট ডাউনলোড' : 'Download formatted spreadsheet'}
                    </p>
                  </button>
                </div>

                <div className="w-full bg-emerald-100 rounded-full h-1.5 mt-3 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full w-full" />
                </div>
              </div>

              {/* Category Export Dropdown */}
              {showExportMenu && (
                <div 
                  className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in"
                  onClick={() => setShowExportMenu(false)}
                >
                  <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-100">
                    {lang === 'bn' ? 'ক্যাটাগরি ভিত্তিক এক্সেল ডাউনলোড' : 'Category-Specific Excel Export'}
                  </div>
                  
                  <button
                    onClick={() => handleExportCategoryExcel('NSC')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-amber-50 text-xs font-bold text-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <Zap className="w-3.5 h-3.5" />
                      1. NSC Only ({nscCount})
                    </span>
                    <Download className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    onClick={() => handleExportCategoryExcel('DISCONNECTION')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-xs font-bold text-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-rose-700">2. Disconnection Only ({discCount})</span>
                    <Download className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    onClick={() => handleExportCategoryExcel('POLE CASE')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-sky-50 text-xs font-bold text-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-sky-700">3. Pole Case Only ({poleCount})</span>
                    <Download className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    onClick={() => handleExportCategoryExcel('METER REPLESMENT')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 text-xs font-bold text-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-emerald-700">4. Meter Replacement ({meterCount})</span>
                    <Download className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    onClick={() => handleExportCategoryExcel('DTR REPLESMENT')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 text-xs font-bold text-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-indigo-700">5. DTR Replacement ({dtrCount})</span>
                    <Download className="w-3 h-3 text-slate-400" />
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    onClick={() => handleExportCategoryExcel('ALL')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-between hover:bg-slate-800 cursor-pointer"
                  >
                    <span>Download All 5 Categories ({total})</span>
                    <Download className="w-3 h-3 text-emerald-400" />
                  </button>
                </div>
              )}
            </div>

            {/* 4. NSC Work Order & Khata Photo Notice */}
            <button
              id="admin-work-orders-toggle-btn"
              type="button"
              onClick={() => setShowWorkOrdersManager(!showWorkOrdersManager)}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden active:scale-[0.99] flex flex-col justify-between ${
                showWorkOrdersManager
                  ? 'border-indigo-500 bg-gradient-to-br from-indigo-100 via-indigo-50 to-purple-50 ring-2 ring-indigo-400/70 shadow-lg'
                  : 'border-indigo-200/90 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/70 hover:shadow-lg hover:shadow-indigo-500/10 hover:border-indigo-400'
              }`}
              title="Upload and manage NSC Work Orders and Khata Slips for field workers"
            >
              <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-indigo-400/10 group-hover:scale-125 transition-transform pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FileImage className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-indigo-100/90 text-indigo-900 border-indigo-300 shadow-2xs">
                    {showWorkOrdersManager ? (lang === 'bn' ? 'খোলা আছে' : 'Active View') : (lang === 'bn' ? 'নোটিশ বোর্ড' : 'Dispatch Hub')}
                  </span>
                </div>

                <div className="mt-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700/80 truncate">
                    {lang === 'bn' ? '04 • ওয়ার্ক অর্ডার ও খাতা' : '04 • NSC WORK ORDERS'}
                  </p>
                  <div className="flex items-center justify-between gap-1.5 mt-0.5">
                    <span className="text-sm sm:text-base font-black text-slate-900 group-hover:text-indigo-700 transition-colors truncate">
                      {showWorkOrdersManager ? (lang === 'bn' ? 'প্যানেল লুকান' : 'Hide Manager') : (lang === 'bn' ? 'ম্যানেজ ও আপলোড' : 'Manage & Upload')}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                    {lang === 'bn' ? 'ফিল্ড কর্মীদের কাজের স্লিপ ও ছবি' : 'Field worker work-order slips'}
                  </p>
                </div>
              </div>

              <div className="w-full bg-indigo-100 rounded-full h-1.5 mt-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full w-full" />
              </div>
            </button>
          </div>
        </div>

        {/* Google Sheets Sync Success Alert */}
        {sheetsSyncMessage && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800 font-bold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{sheetsSyncMessage}</span>
            </div>
            {currentSheetUrl && (
              <a
                href={currentSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
              >
                <span>{lang === 'bn' ? 'Google Sheet ওপেন করুন' : 'Open in Google Sheets'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* 5 Requested Category Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 mt-4">
          <div 
            onClick={() => {
              setSelectedCategory('ALL');
              document.getElementById('admin-category-data-view')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-800 scale-[1.02]'
                : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase ${selectedCategory === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>Total Entries</span>
              <Layers className={`w-3.5 h-3.5 ${selectedCategory === 'ALL' ? 'text-amber-400' : 'text-slate-400'}`} />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'ALL' ? 'text-amber-400' : 'text-slate-900'}`}>{total}</div>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] ${selectedCategory === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>All 5 Categories</span>
              {selectedCategory === 'ALL' && (
                <span className="text-[9px] bg-amber-400 text-slate-950 font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
          </div>

          <div 
            onClick={() => {
              setSelectedCategory('NSC');
              document.getElementById('admin-category-data-view')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
              selectedCategory === 'NSC'
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md ring-2 ring-amber-400 scale-[1.02]'
                : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-amber-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'NSC' ? 'text-slate-950' : 'text-amber-700'}`}>
              <span>1. NSC</span>
              <Zap className="w-3.5 h-3.5 fill-current" />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'NSC' ? 'text-slate-950' : 'text-slate-900'}`}>{nscCount}</div>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] ${selectedCategory === 'NSC' ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>New Connection</span>
              {selectedCategory === 'NSC' && (
                <span className="text-[9px] bg-slate-950 text-amber-400 font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
          </div>

          <div 
            onClick={() => {
              setSelectedCategory('DISCONNECTION');
              document.getElementById('admin-category-data-view')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
              selectedCategory === 'DISCONNECTION'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-400 scale-[1.02]'
                : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-rose-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'DISCONNECTION' ? 'text-rose-100' : 'text-rose-700'}`}>
              <span>2. DISCONNECT</span>
              <PowerOff className="w-3.5 h-3.5" />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'DISCONNECTION' ? 'text-white' : 'text-slate-900'}`}>{discCount}</div>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] font-bold ${selectedCategory === 'DISCONNECTION' ? 'text-rose-100' : 'text-rose-700'}`}>
                {lang === 'bn' ? `মোট লিস্ট: ${discCount}` : `Total List: ${discCount}`}
              </span>
              {selectedCategory === 'DISCONNECTION' && (
                <span className="text-[9px] bg-white text-rose-700 font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
          </div>

          <div 
            onClick={() => {
              setSelectedCategory('POLE CASE');
              document.getElementById('admin-category-data-view')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
              selectedCategory === 'POLE CASE'
                ? 'bg-sky-600 text-white border-sky-600 shadow-md ring-2 ring-sky-400 scale-[1.02]'
                : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-sky-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'POLE CASE' ? 'text-sky-100' : 'text-sky-700'}`}>
              <span>3. POLE CASE</span>
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'POLE CASE' ? 'text-white' : 'text-slate-900'}`}>{poleCount}</div>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] ${selectedCategory === 'POLE CASE' ? 'text-sky-100 font-semibold' : 'text-slate-500'}`}>Poles & Lines</span>
              {selectedCategory === 'POLE CASE' && (
                <span className="text-[9px] bg-white text-sky-700 font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
          </div>

          <div 
            onClick={() => {
              setSelectedCategory('METER REPLESMENT');
              document.getElementById('admin-category-data-view')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
              selectedCategory === 'METER REPLESMENT'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400 scale-[1.02]'
                : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-emerald-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'METER REPLESMENT' ? 'text-emerald-100' : 'text-emerald-700'}`}>
              <span>4. METER REP.</span>
              <RefreshCw className="w-3.5 h-3.5" />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'METER REPLESMENT' ? 'text-white' : 'text-slate-900'}`}>{meterCount}</div>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] ${selectedCategory === 'METER REPLESMENT' ? 'text-emerald-100 font-semibold' : 'text-slate-500'}`}>Replacement</span>
              {selectedCategory === 'METER REPLESMENT' && (
                <span className="text-[9px] bg-white text-emerald-700 font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
          </div>

          <div 
            onClick={() => {
              setSelectedCategory('DTR REPLESMENT');
              document.getElementById('admin-category-data-view')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
              selectedCategory === 'DTR REPLESMENT'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400 scale-[1.02]'
                : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-indigo-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'DTR REPLESMENT' ? 'text-indigo-100' : 'text-indigo-700'}`}>
              <span>5. DTR REP.</span>
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'DTR REPLESMENT' ? 'text-white' : 'text-slate-900'}`}>{dtrCount}</div>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] ${selectedCategory === 'DTR REPLESMENT' ? 'text-indigo-100 font-semibold' : 'text-slate-500'}`}>Transformer</span>
              {selectedCategory === 'DTR REPLESMENT' && (
                <span className="text-[9px] bg-white text-indigo-700 font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
          </div>
        </div>

        {/* DISCONNECTION MANAGEMENT COMPACT 4-OPTION BAR (Matching 1. NSC / 2. DISCONNECT / 3. POLE CASE style) */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <PowerOff className="w-3 h-3 text-rose-600" />
              <span>Disconnection Management Quick Options</span>
            </span>
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
              Total List: {discCount}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" id="admin-disconnection-quick-options">
            <button
              type="button"
              onClick={() => {
                if (onNavigateToDisconnection) {
                  onNavigateToDisconnection('DASHBOARD');
                } else {
                  setSelectedCategory('DISCONNECTION');
                }
              }}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-amber-50 hover:border-amber-300 transition-all text-left cursor-pointer active:scale-[0.98]"
            >
              <div className="text-[10px] sm:text-[11px] font-black uppercase flex items-center justify-between text-amber-700">
                <span className="truncate">1. PERFORMANCE DASHBOARD</span>
                <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
              </div>
              <div className="text-[10px] text-slate-500 font-semibold mt-1 flex items-center justify-between">
                <span>Live Deck & Paid/Discon</span>
                <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">Open</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToDisconnection && onNavigateToDisconnection('UPLOAD')}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-indigo-50 hover:border-indigo-300 transition-all text-left cursor-pointer active:scale-[0.98]"
            >
              <div className="text-[10px] sm:text-[11px] font-black uppercase flex items-center justify-between text-indigo-700">
                <span className="truncate">2. UPLOAD LIST</span>
                <UploadCloud className="w-3.5 h-3.5 shrink-0" />
              </div>
              <div className="text-[10px] text-slate-500 font-semibold mt-1 flex items-center justify-between">
                <span>Excel / CSV to Sheet</span>
                <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded">Upload</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToDisconnection && onNavigateToDisconnection('REPORT')}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-emerald-50 hover:border-emerald-300 transition-all text-left cursor-pointer active:scale-[0.98]"
            >
              <div className="text-[10px] sm:text-[11px] font-black uppercase flex items-center justify-between text-emerald-700">
                <span className="truncate">3. WORKER-WISE REPORT</span>
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              </div>
              <div className="text-[10px] text-slate-500 font-semibold mt-1 flex items-center justify-between">
                <span>Worker & Agency Stats</span>
                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">Report</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToDisconnection && onNavigateToDisconnection('VIEW_LIST')}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-rose-50 hover:border-rose-300 transition-all text-left cursor-pointer active:scale-[0.98]"
            >
              <div className="text-[10px] sm:text-[11px] font-black uppercase flex items-center justify-between text-rose-700">
                <span className="truncate">4. VIEW LIST</span>
                <Users className="w-3.5 h-3.5 shrink-0" />
              </div>
              <div className="text-[10px] text-slate-500 font-semibold mt-1 flex items-center justify-between">
                <span>All Consumers</span>
                <span className="text-[9px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded">{discCount}</span>
              </div>
            </button>
          </div>
        </div>

        {/* ADMIN SMS-LIKE REISSUE REQUEST'S INBOX (Shows when toggled OR when pending requests > 0) */}
        {(showReissueRequestsPanel || pendingReissueTasks.length > 0) && (
          <div
            id="admin-reissue-requests-inbox"
            className="mt-3.5 bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 border-2 border-purple-500/70 rounded-2xl p-4 shadow-lg space-y-3 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between gap-2 border-b border-purple-500/30 pb-2.5">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-purple-500/20 border border-purple-400/40 text-amber-300">
                  <MessageSquareWarning className="w-4 h-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-black text-white tracking-wide">
                      📩 Reissue Request's ({pendingReissueTasks.length} Pending)
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-[10px] font-black text-amber-300">
                      SMS INBOX
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-purple-200 mt-0.5">
                    {lang === 'bn'
                      ? 'কোনো ওয়ার্কার Reissue ক্লিক করলে এখানে SMS আকারে দেখা যাবে — Approve করলে ওয়ার্কার আবার Update Status করতে পারবে, আর Reject করলে ওয়ার্কার দেখতে পাবে "Your Reissue Request Rejected"।'
                      : 'Approve to allow the worker to Update Status again, or Reject to notify "Your Reissue Request Rejected".'}
                  </p>
                </div>
              </div>

              {showReissueRequestsPanel && (
                <button
                  type="button"
                  onClick={() => setShowReissueRequestsPanel(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer"
                  title="Close Reissue Request's Panel"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {pendingReissueTasks.length === 0 ? (
              <div className="bg-slate-900/80 border border-purple-500/30 rounded-xl p-4 text-center space-y-1">
                <p className="text-xs font-bold text-purple-200">
                  {lang === 'bn'
                    ? 'এই মুহূর্তে কোনো নতুন Reissue Request পেন্ডিং নেই।'
                    : 'No pending Reissue SMS requests right now.'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {lang === 'bn'
                    ? 'কোনো ফিল্ড ওয়ার্কার ডিসকানেকশন লিস্ট থেকে "Reissue" বাটনে ক্লিক করার সাথে সাথে এখানে SMS চলে আসবে।'
                    : 'Whenever a worker clicks "Reissue" on a consumer card, their SMS request will appear here immediately.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {pendingReissueTasks.map((rt, rIdx) => {
                  const lockInfo = getReissueLockState(rt);
                  const cId = String(rt.consumerId || (rt as any)['Consumer Id'] || `ROW-${rIdx}`).replace(/^TASK-DISC-/i, '').trim();
                  const workerDisplay = lockInfo.requestedBy || cleanNameOnly(rt.assignedWorkerName || rt.assignedAgency) || 'Worker';
                  const isBusy = approvingReissueId === cId || rejectingReissueId === cId;

                  return (
                    <div
                      key={`${cId}-${rIdx}`}
                      className="bg-slate-900/95 border border-purple-400/40 rounded-xl p-3 flex flex-col justify-between gap-2.5 shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase">
                              📩 {workerDisplay}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">• {lockInfo.requestedAt}</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-500/30">
                            ID: #{cId}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm font-black text-white truncate">
                          {rt.consumerName || (rt as any)['Name'] || 'Consumer'}
                        </p>

                        <div className="bg-purple-950/60 border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-[11px] text-purple-100 italic">
                          {lang === 'bn'
                            ? `"স্যার, কনজিউমার #${cId} (বর্তমান স্ট্যাটাস: ${rt.disconStatus || rt.taskStatus}) পুনরায় আপডেট করার জন্য Reissue অনুমোদন দিন।"`
                            : `"Sir, please approve Reissue for Consumer #${cId} (Current Status: ${rt.disconStatus || rt.taskStatus}) so I can update status again."`}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleAdminApproveReissue(rt)}
                          disabled={isBusy}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all disabled:opacity-60"
                        >
                          {approvingReissueId === cId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>{lang === 'bn' ? 'Approve (অনুমোদন)' : 'Approve'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAdminRejectReissue(rt)}
                          disabled={isBusy}
                          className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all disabled:opacity-60"
                        >
                          {rejectingReissueId === cId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{lang === 'bn' ? 'Reject (বাতিল)' : 'Reject'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ADMIN WORK ORDER / KHATA PHOTO MANAGEMENT SECTION */}
      {showWorkOrdersManager && (
        <div className="bg-slate-900/5 p-4 sm:p-6 rounded-2xl border border-amber-300 shadow-sm animate-in fade-in space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-500 text-slate-950 rounded-lg">
                <FileImage className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === 'bn' ? '⚡ NSC ওয়ার্ক অর্ডার ও খাতার ফটো ম্যানেজমেন্ট (Admin Upload & Control)' : '⚡ NSC Work Order & Khata Photo Management'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'bn' ? 'এখানে আপলোড করা ছবি ফিল্ড কর্মীরা NSC এন্ট্রি করার সময় সঙ্গে সঙ্গে দেখতে পাবে' : 'Photos uploaded here will be instantly visible to field workers during NSC entries'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowWorkOrdersManager(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              title="Close Panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <WorkOrderNoticeSection
            category="ALL"
            currentUser={{
              idNo: '8695716192',
              phone: '8695716192',
              name: 'Admin Controller',
              role: 'admin',
              status: 'active'
            }}
            lang={lang}
            isAdmin={true}
          />
        </div>
      )}

      {/* DEDICATED CATEGORY DATA SECTION CONTAINER */}
      <div id="admin-category-data-view" className="space-y-4 pt-2">
        {/* Dynamic Category Hero Banner */}
        <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all shadow-sm ${
          selectedCategory === 'NSC' ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-300' :
          selectedCategory === 'DISCONNECTION' ? 'bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-rose-300' :
          selectedCategory === 'POLE CASE' ? 'bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent border-sky-300' :
          selectedCategory === 'METER REPLESMENT' ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-300' :
          selectedCategory === 'DTR REPLESMENT' ? 'bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-300' :
          'bg-gradient-to-r from-slate-900/10 via-slate-900/5 to-transparent border-slate-300'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm shrink-0 ${
                selectedCategory === 'NSC' ? 'bg-amber-500 text-slate-950' :
                selectedCategory === 'DISCONNECTION' ? 'bg-rose-600 text-white' :
                selectedCategory === 'POLE CASE' ? 'bg-sky-600 text-white' :
                selectedCategory === 'METER REPLESMENT' ? 'bg-emerald-600 text-white' :
                selectedCategory === 'DTR REPLESMENT' ? 'bg-indigo-600 text-white' :
                'bg-slate-900 text-white'
              }`}>
                {selectedCategory === 'NSC' && <Zap className="w-5 h-5 fill-current" />}
                {selectedCategory === 'DISCONNECTION' && <PowerOff className="w-5 h-5" />}
                {selectedCategory === 'POLE CASE' && <ShieldAlert className="w-5 h-5" />}
                {selectedCategory === 'METER REPLESMENT' && <RefreshCw className="w-5 h-5" />}
                {selectedCategory === 'DTR REPLESMENT' && <Activity className="w-5 h-5" />}
                {selectedCategory === 'ALL' && <Layers className="w-5 h-5" />}
              </div>
              
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                    {selectedCategory === 'NSC' && (lang === 'bn' ? '⚡ NSC — নতুন সার্ভিস কানেকশন ডাটা' : '⚡ NSC — New Service Connection Data')}
                    {selectedCategory === 'DISCONNECTION' && (lang === 'bn' ? 'ডিসকানেকশন ম্যানেজমেন্ট' : 'Disconnection Management')}
                    {selectedCategory === 'POLE CASE' && (lang === 'bn' ? '🏗️ POLE CASE — খুঁটি ও তার লাইন মেরামত ডাটা' : '🏗️ POLE CASE — Poles & Overhead Line Data')}
                    {selectedCategory === 'METER REPLESMENT' && (lang === 'bn' ? '🔄 METER REPLACEMENT — মিটার পরিবর্তন ও নতুন সিল ডাটা' : '🔄 METER REPLACEMENT — Meter Replacement Data')}
                    {selectedCategory === 'DTR REPLESMENT' && (lang === 'bn' ? '⚡ DTR REPLACEMENT — ট্রান্সফরমার পরিবর্তন ও মেরামত ডাটা' : '⚡ DTR REPLACEMENT — Distribution Transformer Data')}
                    {selectedCategory === 'ALL' && (lang === 'bn' ? '📋 MASTER OVERVIEW — সমস্ত ৫টি ক্যাটাগরির মাস্টার ডাটা' : '📋 MASTER OVERVIEW — All 5 Categories Master Data')}
                  </h2>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border shadow-xs ${
                    selectedCategory === 'NSC' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                    selectedCategory === 'DISCONNECTION' ? 'bg-rose-100 text-rose-900 border-rose-300' :
                    selectedCategory === 'POLE CASE' ? 'bg-sky-100 text-sky-900 border-sky-300' :
                    selectedCategory === 'METER REPLESMENT' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                    selectedCategory === 'DTR REPLESMENT' ? 'bg-indigo-100 text-indigo-900 border-indigo-300' :
                    'bg-slate-200 text-slate-900 border-slate-300'
                  }`}>
                    {selectedCategory === 'DISCONNECTION' ? `${discCount} Total List` : `${filteredEntries.length} Records Found`}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {selectedCategory === 'NSC' && (lang === 'bn' ? 'ওয়ার্ক অর্ডার, কনজিউমার নাম, মোবাইল, মিটার নম্বর, সিকিউরিটি সিল, লোড, ফেজ ও খাতার ফটোর লাইভ রেকর্ড' : 'Live records of work orders, consumers, meter & seal numbers, loads, phases, and khata slips')}
                  {selectedCategory === 'DISCONNECTION' && (lang === 'bn' ? 'কনজিউমার আইডি, মোট বকেয়া টাকা (Arrears), ডিসকানেকশনের কারণ, ফাইনাল রিডিং ও পোল রেকর্ডের লাইভ ডাটা' : 'Live records of consumer IDs, arrear amounts, disconnection reasons, and final meter readings')}
                  {selectedCategory === 'POLE CASE' && (lang === 'bn' ? 'পোল নম্বর, ত্রুটির ধরন, প্রায়োরিটি, লাইনে কাজ ও ব্যবহৃত উপাদানের লাইভ ডাটা' : 'Live records of pole numbers, fault types, breakdown priority, and repair materials used')}
                  {selectedCategory === 'METER REPLESMENT' && (lang === 'bn' ? 'পুরোনো মিটার নম্বর ও রিডিং, নতুন মিটার নম্বর, ইনিশিয়াল রিডিং, নতুন সিল ও কারণ' : 'Live records of old defective meters, final readings, new meter serials, and security seals')}
                  {selectedCategory === 'DTR REPLESMENT' && (lang === 'bn' ? 'ট্রান্সফরমার নাম, পূর্বের ও নতুন ক্ষমতা (kVA), সিরিয়াল নম্বর ও আর্থ রেজিস্ট্যান্স' : 'Live records of transformer names, existing vs new capacity (kVA), serials, and earth resistance')}
                  {selectedCategory === 'ALL' && (lang === 'bn' ? 'WBSEDCL এর ৫টি ডিপার্টমেন্টাল কাজের সমন্বিত মাস্টার তালিকা' : 'Consolidated master table of all departmental electrical operations')}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons for Active Category */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => handleExportCategoryExcel(selectedCategory)}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                title={`Export ${selectedCategory} Data to Excel / CSV`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export {selectedCategory === 'ALL' ? 'Master' : selectedCategory} Excel</span>
              </button>

              {selectedCategory === 'NSC' && (
                <button
                  onClick={() => setShowWorkOrdersManager(!showWorkOrdersManager)}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Upload or Manage NSC Work Orders & Khata Slips"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span>{showWorkOrdersManager ? 'Hide Khata Slips' : 'NSC Khata Slips'}</span>
                </button>
              )}

              {selectedCategory === 'DISCONNECTION' && onNavigateToDisconnection && (
                <button
                  id="admin-open-disconnection-btn"
                  onClick={() => onNavigateToDisconnection('VIEW_LIST')}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Open Full Disconnection Management"
                >
                  <PowerOff className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? `⚡ ডিসকানেকশন ম্যানেজমেন্ট (মোট লিস্ট: ${discCount})` : `⚡ Disconnection Management (Total List: ${discCount})`}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Disconnection Performance Deck Board inside Admin Panel when DISCONNECTION is selected */}
        {selectedCategory === 'DISCONNECTION' && (
          <DisconnectionPerformanceDashboard
            tasks={effectiveDiscTasks}
            lang={lang}
            isAdmin={true}
            onRefresh={onRefresh}
            onDeleteTask={async (task) => {
              setLocallyDeletedIds(prev => {
                const next = new Set(prev);
                if (task.id) next.add(String(task.id).trim());
                if (task.consumerId) {
                  next.add(String(task.consumerId).trim());
                  next.add(`TASK-DISC-${String(task.consumerId).trim()}`);
                }
                return next;
              });
              await deleteDisconnectionTask({
                id: task.id,
                consumerId: task.consumerId,
              });
              onRefresh();
            }}
          />
        )}

        {/* Filter and Search Controls Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Quick Option Pill Switcher */}
          <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline mr-1">
              Select Option:
            </span>
            {[
              { id: 'ALL', label: 'All', count: total },
              { id: 'NSC', label: '1. NSC', count: nscCount },
              { id: 'DISCONNECTION', label: '2. Disconnection', count: discCount },
              { id: 'POLE CASE', label: '3. Pole Case', count: poleCount },
              { id: 'METER REPLESMENT', label: '4. Meter Rep.', count: meterCount },
              { id: 'DTR REPLESMENT', label: '5. DTR Rep.', count: dtrCount }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === tab.id
                    ? tab.id === 'NSC' ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-400' :
                      tab.id === 'DISCONNECTION' ? 'bg-rose-600 text-white shadow-xs' :
                      tab.id === 'POLE CASE' ? 'bg-sky-600 text-white shadow-xs' :
                      tab.id === 'METER REPLESMENT' ? 'bg-emerald-600 text-white shadow-xs' :
                      tab.id === 'DTR REPLESMENT' ? 'bg-indigo-600 text-white shadow-xs' :
                      'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedCategory === tab.id ? 'bg-black/20 text-inherit' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search and Status Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="admin-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search in ${selectedCategory}...`}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-slate-900"
            >
              <option value="ALL">All Status</option>
              <option value="Approved">Approved</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Specialized Data Table Container */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-700" />
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                {selectedCategory === 'ALL' ? 'All Recorded Entries' : `${selectedCategory} Data List`} ({filteredEntries.length})
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Click any record to inspect, approve, edit or print receipt
            </span>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="font-semibold text-slate-700">
                No records found in {selectedCategory}
              </p>
              <p className="text-xs text-slate-500">
                Try clearing the search query or switch to another category option above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                {/* 1. Specialized Headers for NSC */}
                {selectedCategory === 'NSC' && (
                  <thead className="bg-amber-50/70 text-amber-950 text-[11px] uppercase tracking-wider border-b border-amber-200 font-extrabold">
                    <tr>
                      <th className="px-3.5 py-3">ID & Date</th>
                      <th className="px-3.5 py-3">App & Work Order No</th>
                      <th className="px-3.5 py-3">Consumer Details</th>
                      <th className="px-3.5 py-3">Meter No & Seal No</th>
                      <th className="px-3.5 py-3">Load & Phase & Reading</th>
                      <th className="px-3.5 py-3">Worker & Agency Name</th>
                      <th className="px-3.5 py-3">Khata Slip / Photo</th>
                      <th className="px-3.5 py-3">Status</th>
                      <th className="px-3.5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                )}

                {/* 2. Specialized Headers for DISCONNECTION */}
                {selectedCategory === 'DISCONNECTION' && (
                  <thead className="bg-rose-50/70 text-rose-950 text-[11px] uppercase tracking-wider border-b border-rose-200 font-extrabold">
                    <tr>
                      <th className="px-3.5 py-3">ID & Date</th>
                      <th className="px-3.5 py-3">Consumer ID & Name</th>
                      <th className="px-3.5 py-3">Mobile & Address</th>
                      <th className="px-3.5 py-3 text-rose-700">Arrear Amount (বকেয়া ₹)</th>
                      <th className="px-3.5 py-3">Disconnection Reason</th>
                      <th className="px-3.5 py-3">Final Reading (kWh)</th>
                      <th className="px-3.5 py-3">Meter & Pole No</th>
                      <th className="px-3.5 py-3">Worker & Agency Name</th>
                      <th className="px-3.5 py-3">Status</th>
                      <th className="px-3.5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                )}

                {/* 3. Specialized Headers for POLE CASE */}
                {selectedCategory === 'POLE CASE' && (
                  <thead className="bg-sky-50/70 text-sky-950 text-[11px] uppercase tracking-wider border-b border-sky-200 font-extrabold">
                    <tr>
                      <th className="px-3.5 py-3">ID & Date</th>
                      <th className="px-3.5 py-3">Pole No & Location</th>
                      <th className="px-3.5 py-3">Issue / Fault Type</th>
                      <th className="px-3.5 py-3">Priority Level</th>
                      <th className="px-3.5 py-3">Action Taken & Materials</th>
                      <th className="px-3.5 py-3">Lineman & Feeder</th>
                      <th className="px-3.5 py-3">Site Photo</th>
                      <th className="px-3.5 py-3">Status</th>
                      <th className="px-3.5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                )}

                {/* 4. Specialized Headers for METER REPLESMENT */}
                {selectedCategory === 'METER REPLESMENT' && (
                  <thead className="bg-emerald-50/70 text-emerald-950 text-[11px] uppercase tracking-wider border-b border-emerald-200 font-extrabold">
                    <tr>
                      <th className="px-3.5 py-3">ID & Date</th>
                      <th className="px-3.5 py-3">Consumer ID & Name</th>
                      <th className="px-3.5 py-3 text-rose-700">Old Meter & Final Reading</th>
                      <th className="px-3.5 py-3 text-emerald-800">New Meter & Initial Reading</th>
                      <th className="px-3.5 py-3">Seal No & Reason</th>
                      <th className="px-3.5 py-3">Lineman & CCC Office</th>
                      <th className="px-3.5 py-3">Site Photo</th>
                      <th className="px-3.5 py-3">Status</th>
                      <th className="px-3.5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                )}

                {/* 5. Specialized Headers for DTR REPLESMENT */}
                {selectedCategory === 'DTR REPLESMENT' && (
                  <thead className="bg-indigo-50/70 text-indigo-950 text-[11px] uppercase tracking-wider border-b border-indigo-200 font-extrabold">
                    <tr>
                      <th className="px-3.5 py-3">ID & Date</th>
                      <th className="px-3.5 py-3">DTR / Transformer Name</th>
                      <th className="px-3.5 py-3">Capacity (Old ➔ New kVA)</th>
                      <th className="px-3.5 py-3">Serial No (Old ➔ New)</th>
                      <th className="px-3.5 py-3">Earth Resistance (Ω) & Oil</th>
                      <th className="px-3.5 py-3">Substation & Feeder</th>
                      <th className="px-3.5 py-3">Lineman & Agency</th>
                      <th className="px-3.5 py-3">Status</th>
                      <th className="px-3.5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                )}

                {/* 6. Headers for ALL */}
                {selectedCategory === 'ALL' && (
                  <thead className="bg-slate-50 text-slate-700 text-[11px] uppercase tracking-wider border-b border-slate-200 font-extrabold">
                    <tr>
                      <th className="px-3.5 py-3">ID & Date</th>
                      <th className="px-3.5 py-3">Category</th>
                      <th className="px-3.5 py-3">Consumer / Pole / Site</th>
                      <th className="px-3.5 py-3">Key Attributes & Specifics</th>
                      <th className="px-3.5 py-3">Lineman / Worker</th>
                      <th className="px-3.5 py-3">Feeder & Location</th>
                      <th className="px-3.5 py-3">Status</th>
                      <th className="px-3.5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                )}

                {/* Dynamic Table Body */}
                <tbody className="divide-y divide-slate-100">
                  {filteredEntries.map((item, idx) => {
                    const isNsc = item.category === 'NSC';
                    const isDisc = item.category === 'DISCONNECTION';
                    const isPole = item.category === 'POLE CASE';
                    const isMeter = item.category === 'METER REPLESMENT';
                    const isDtr = item.category === 'DTR REPLESMENT';

                    return (
                      <tr 
                        key={`${item.id || 'admin-row'}-${idx}`} 
                        className="hover:bg-slate-50/90 transition-colors group cursor-pointer"
                        onClick={() => setSelectedEntry(item)}
                      >
                        {/* Common ID & Date Column */}
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-900">{item.id}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{formatDateDDMMYYYY(item.date)}</span>
                            <span className="text-blue-600 font-bold">{formatTime12Hour(item.date)}</span>
                          </div>
                        </td>

                        {/* NSC Specific Row Cells */}
                        {selectedCategory === 'NSC' && (
                          <>
                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-900">App: {item.applicationNo || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 font-mono">WO: {item.workOrderNo || 'N/A'}</div>
                            </td>

                            <td className="px-3.5 py-3">
                              <div className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                                {item.consumerName || 'N/A'}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {item.fatherName ? `C/O: ${item.fatherName} • ` : ''}
                                {item.mobile ? `Ph: ${item.mobile}` : ''}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                {item.address || ''}
                              </div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-mono font-bold text-slate-900">Mtr: {item.meterNo || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 font-mono">Seal: {item.sealNo || 'N/A'}</div>
                              <div className="text-[10px] text-amber-700 font-mono">ID: {item.consumerId || 'N/A'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-900">{item.appliedLoad || '1'} kW ({item.phase || '1-Phase'})</div>
                              <div className="text-[10px] text-slate-500">Init: {item.initialReading || '0'} kWh</div>
                              <div className="text-[10px] text-slate-400">{item.tariffCategory || 'Domestic'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-medium text-slate-800 flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>{cleanNameOnly(item.workerName) || 'Worker'}</span>
                              </div>
                              {item.agencyName && (
                                <div className="text-[10px] text-slate-500 truncate max-w-[130px]">
                                  {cleanNameOnly(item.agencyName)}
                                </div>
                              )}
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              {item.workOrderPhoto ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded">
                                  <FileImage className="w-3 h-3 text-amber-700" />
                                  <span>Khata Slip Attached</span>
                                </span>
                              ) : item.photoUrl ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded">
                                  <Camera className="w-3 h-3 text-emerald-700" />
                                  <span>Field Photo</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">None</span>
                              )}
                            </td>
                          </>
                        )}

                        {/* DISCONNECTION Specific Row Cells */}
                        {selectedCategory === 'DISCONNECTION' && (
                          <>
                            <td className="px-3.5 py-3">
                              <div className="font-bold text-slate-900">{item.consumerName || 'N/A'}</div>
                              <div className="text-[10px] text-rose-700 font-mono font-bold">ID: {item.consumerId || 'N/A'}</div>
                            </td>

                            <td className="px-3.5 py-3">
                              <div className="text-slate-800">{item.mobile || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{item.address || ''}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="text-sm font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block font-mono">
                                ₹ {item.arrearAmount || '0'}
                              </div>
                            </td>

                            <td className="px-3.5 py-3">
                              <div className="text-slate-800 truncate max-w-[180px]" title={item.reason}>
                                {item.reason || 'Non-Payment of Electricity Dues'}
                              </div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap font-mono font-bold text-slate-900">
                              {item.finalReading || '0'} kWh
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-mono text-slate-900">Mtr: {item.meterNo || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500">Pole: {item.poleNo || 'N/A'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-medium text-slate-800">{cleanNameOnly(item.workerName) || 'Worker'}</div>
                              {item.agencyName && (
                                <div className="text-[10px] text-slate-500">{cleanNameOnly(item.agencyName)}</div>
                              )}
                            </td>
                          </>
                        )}

                        {/* POLE CASE Specific Row Cells */}
                        {selectedCategory === 'POLE CASE' && (
                          <>
                            <td className="px-3.5 py-3">
                              <div className="font-bold text-slate-900">Pole #{item.poleNo || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[160px]">{item.address || 'Site'}</div>
                            </td>

                            <td className="px-3.5 py-3">
                              <div className="font-semibold text-slate-800">{item.issueType || 'General Fault'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                item.priority === 'High' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                                item.priority === 'Medium' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                'bg-sky-100 text-sky-800 border-sky-200'
                              }`}>
                                {item.priority || 'Normal'}
                              </span>
                            </td>

                            <td className="px-3.5 py-3">
                              <div className="text-slate-900 font-medium truncate max-w-[180px]">{item.actionTaken || 'Repair complete'}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{item.materialUsed ? `Materials: ${item.materialUsed}` : ''}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-medium text-slate-800">{item.workerName || 'Worker'}</div>
                              <div className="text-[10px] text-slate-500">{item.feederName || 'Feeder'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              {item.photoUrl ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-sky-100 text-sky-900 border border-sky-300 font-bold px-2 py-0.5 rounded">
                                  <Camera className="w-3 h-3 text-sky-700" />
                                  <span>Site Photo</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">None</span>
                              )}
                            </td>
                          </>
                        )}

                        {/* METER REPLESMENT Specific Row Cells */}
                        {selectedCategory === 'METER REPLESMENT' && (
                          <>
                            <td className="px-3.5 py-3">
                              <div className="font-bold text-slate-900">{item.consumerName || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 font-mono">ID: {item.consumerId || 'N/A'} • Ph: {item.mobile || ''}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-mono font-bold text-rose-700">Old: {item.oldMeterNo || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 font-mono">Final Rdg: {item.finalReading || '0'} kWh</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-mono font-bold text-emerald-700">New: {item.newMeterNo || item.meterNo || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 font-mono">Init Rdg: {item.initialReading || '0'} kWh</div>
                            </td>

                            <td className="px-3.5 py-3">
                              <div className="font-mono text-slate-800">Seal: {item.sealNo || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{item.replacementReason || 'Burnt/Defective'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-medium text-slate-800">{item.workerName || 'Worker'}</div>
                              <div className="text-[10px] text-slate-500">{item.cccOffice || 'CCC'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              {item.photoUrl ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded">
                                  <Camera className="w-3 h-3 text-emerald-700" />
                                  <span>Photo</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">None</span>
                              )}
                            </td>
                          </>
                        )}

                        {/* DTR REPLESMENT Specific Row Cells */}
                        {selectedCategory === 'DTR REPLESMENT' && (
                          <>
                            <td className="px-3.5 py-3">
                              <div className="font-bold text-slate-900">{item.dtrName || 'Transformer'}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{item.address || ''}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-semibold text-indigo-950">
                                {item.existingCapacity || '63 kVA'} ➔ <span className="font-bold text-indigo-700">{item.newCapacity || '100 kVA'}</span>
                              </div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap font-mono text-[11px]">
                              <div>Old: {item.oldDtrSerial || 'N/A'}</div>
                              <div className="text-indigo-700 font-bold">New: {item.newDtrSerial || 'N/A'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-mono text-slate-900">Earth: {item.earthResistance || 'N/A'} Ω</div>
                              <div className="text-[10px] text-slate-500">Oil: {item.oilLevel || 'Normal'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div>{item.substation || 'Substation'}</div>
                              <div className="text-[10px] text-slate-500">{item.feederName || 'Feeder'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-medium text-slate-800">{item.workerName || 'Worker'}</div>
                              <div className="text-[10px] text-slate-500">{item.agencyName || 'Agency'}</div>
                            </td>
                          </>
                        )}

                        {/* ALL Specific Row Cells */}
                        {selectedCategory === 'ALL' && (
                          <>
                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                                isNsc ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                isDisc ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                isPole ? 'bg-sky-50 text-sky-800 border-sky-200' :
                                isMeter ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                'bg-indigo-50 text-indigo-800 border-indigo-200'
                              }`}>
                                {item.category}
                              </span>
                            </td>

                            <td className="px-3.5 py-3">
                              <div className="font-semibold text-slate-900 group-hover:text-amber-700 transition-colors">
                                {item.consumerName || item.dtrName || item.poleNo || 'Field Point'}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate max-w-xs">
                                {item.consumerId && `ID: ${item.consumerId} • `}
                                {item.meterNo && `Meter: ${item.meterNo} • `}
                                {item.arrearAmount && `₹ ${item.arrearAmount} • `}
                                {item.address || ''}
                              </div>
                            </td>

                            <td className="px-3.5 py-3 text-slate-600 text-[11px]">
                              {isNsc && <div>Load: {item.appliedLoad || '1 kW'} • WO: {item.workOrderNo || 'N/A'}</div>}
                              {isDisc && <div className="text-rose-700 font-bold">Arrear: ₹ {item.arrearAmount || '0'} • Rdg: {item.finalReading}</div>}
                              {isPole && <div>Issue: {item.issueType || 'Line fault'} (Priority: {item.priority || 'Normal'})</div>}
                              {isMeter && <div>Old: {item.oldMeterNo || 'N/A'} ➔ New: {item.newMeterNo || 'N/A'}</div>}
                              {isDtr && <div>Cap: {item.existingCapacity} ➔ {item.newCapacity}</div>}
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span>{cleanNameOnly(item.workerName) || 'Worker'}</span>
                              </div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap text-slate-600 text-xs">
                              {(!isNsc && !isDisc) && <div>{item.feederName || 'Main Feeder'}</div>}
                              <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                {(!isNsc && !isDisc) ? (item.substation || item.address || 'Site') : (item.address || 'Site')}
                              </div>
                            </td>
                          </>
                        )}

                        {/* Status Column */}
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            item.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.status === 'Completed'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {item.status}
                          </span>
                        </td>

                        {/* Actions Column */}
                        <td className="px-3.5 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setSelectedEntry(item)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="View Full Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingEntry(item)}
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors cursor-pointer"
                              title="Edit Data"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handlePrintCertificate(item)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer"
                              title="Print Receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Entry Detail Inspector Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-base sm:text-lg">
                      {selectedEntry.id}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                      {selectedEntry.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Complete entry records and admin verification panel
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              {/* Status and Action Buttons */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-slate-500 text-xs">Current Status: </span>
                  <span className={`font-bold ml-1 px-2 py-0.5 rounded text-xs border ${
                    selectedEntry.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {selectedEntry.status}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={updatingId === selectedEntry.id}
                    onClick={() => handleStatusChange(selectedEntry.id, 'Approved')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-all shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Entry</span>
                  </button>

                  <button
                    disabled={updatingId === selectedEntry.id}
                    onClick={() => handleStatusChange(selectedEntry.id, 'Completed')}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold text-xs transition-all shadow-xs"
                  >
                    Completed
                  </button>
                </div>
              </div>

              {/* Grid of Key Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Worker Name</div>
                  <div className="font-bold text-slate-900 mt-0.5">{cleanNameOnly(selectedEntry.workerName)}</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Date & Time</div>
                  <div className="font-bold text-slate-900 mt-0.5 font-mono text-xs">
                    {formatDateTime12Hour(selectedEntry.date)}
                  </div>
                </div>

                {selectedEntry.category !== 'NSC' && selectedEntry.category !== 'DISCONNECTION' ? (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Feeder Name</div>
                    <div className="font-bold text-slate-900 mt-0.5">{selectedEntry.feederName || 'N/A'}</div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Agency Name</div>
                    <div className="font-bold text-slate-900 mt-0.5">{cleanNameOnly(selectedEntry.agencyName) || 'N/A'}</div>
                  </div>
                )}
              </div>

              {/* Category specific details list */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                  Field Data Details ({selectedEntry.category})
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-1 text-slate-700">
                  {selectedEntry.consumerName && (
                    <div><strong className="text-slate-900">Consumer Name:</strong> {selectedEntry.consumerName}</div>
                  )}
                  {selectedEntry.fatherName && (
                    <div><strong className="text-slate-900">Father / Husband:</strong> {selectedEntry.fatherName}</div>
                  )}
                  {selectedEntry.consumerId && (
                    <div><strong className="text-slate-900">Consumer ID:</strong> {selectedEntry.consumerId}</div>
                  )}
                  {selectedEntry.mobile && (
                    <div><strong className="text-slate-900">Mobile No:</strong> {selectedEntry.mobile}</div>
                  )}
                  {selectedEntry.address && (
                    <div className="sm:col-span-2"><strong className="text-slate-900">Address / Location:</strong> {selectedEntry.address}</div>
                  )}
                  {selectedEntry.poleNo && (
                    <div><strong className="text-slate-900">Pole Number:</strong> {selectedEntry.poleNo}</div>
                  )}
                  {selectedEntry.appliedLoad && (
                    <div><strong className="text-slate-900">Load & Phase:</strong> {selectedEntry.appliedLoad} ({selectedEntry.phase})</div>
                  )}
                  {selectedEntry.meterNo && (
                    <div><strong className="text-slate-900">Meter Number:</strong> {selectedEntry.meterNo}</div>
                  )}
                  {selectedEntry.initialReading && (
                    <div><strong className="text-slate-900">Initial Reading:</strong> {selectedEntry.initialReading}</div>
                  )}
                  {selectedEntry.sealNo && (
                    <div><strong className="text-slate-900">Seal Number:</strong> {selectedEntry.sealNo}</div>
                  )}
                  {selectedEntry.arrearAmount && (
                    <div><strong className="text-slate-900">Arrear Amount:</strong> ₹ {selectedEntry.arrearAmount}</div>
                  )}
                  {selectedEntry.reason && (
                    <div className="sm:col-span-2"><strong className="text-slate-900">Disconnection Reason:</strong> {selectedEntry.reason}</div>
                  )}
                  {selectedEntry.finalReading && (
                    <div><strong className="text-slate-900">Final Reading:</strong> {selectedEntry.finalReading} kWh</div>
                  )}
                  {selectedEntry.issueType && (
                    <div className="sm:col-span-2"><strong className="text-slate-900">Pole Issue:</strong> {selectedEntry.issueType} (Priority: {selectedEntry.priority})</div>
                  )}
                  {selectedEntry.actionTaken && (
                    <div className="sm:col-span-2"><strong className="text-slate-900">Action Taken:</strong> {selectedEntry.actionTaken}</div>
                  )}
                  {selectedEntry.materialUsed && (
                    <div className="sm:col-span-2"><strong className="text-slate-900">Materials Used:</strong> {selectedEntry.materialUsed}</div>
                  )}
                  {selectedEntry.oldMeterNo && (
                    <div><strong className="text-slate-900">Old Meter No:</strong> {selectedEntry.oldMeterNo}</div>
                  )}
                  {selectedEntry.newMeterNo && (
                    <div><strong className="text-slate-900">New Meter No:</strong> {selectedEntry.newMeterNo}</div>
                  )}
                  {selectedEntry.replacementReason && (
                    <div className="sm:col-span-2"><strong className="text-slate-900">Replacement Reason:</strong> {selectedEntry.replacementReason}</div>
                  )}
                  {selectedEntry.dtrName && (
                    <div><strong className="text-slate-900">DTR Name / Code:</strong> {selectedEntry.dtrName}</div>
                  )}
                  {selectedEntry.existingCapacity && (
                    <div><strong className="text-slate-900">Capacity:</strong> {selectedEntry.existingCapacity} ➔ {selectedEntry.newCapacity}</div>
                  )}
                  {selectedEntry.oldDtrSerial && (
                    <div><strong className="text-slate-900">Old DTR Serial:</strong> {selectedEntry.oldDtrSerial}</div>
                  )}
                  {selectedEntry.newDtrSerial && (
                    <div><strong className="text-slate-900">New DTR Serial:</strong> {selectedEntry.newDtrSerial}</div>
                  )}
                  {selectedEntry.earthResistance && (
                    <div><strong className="text-slate-900">Earth Resistance:</strong> {selectedEntry.earthResistance}</div>
                  )}
                  {selectedEntry.locationGps && (
                    <div className="sm:col-span-2"><strong className="text-slate-900">GPS Coordinates:</strong> {selectedEntry.locationGps}</div>
                  )}
                </div>

                {selectedEntry.notes && (
                  <div className="mt-3 pt-2 border-t border-slate-200">
                    <strong className="text-slate-900">Notes: </strong>
                    <span className="text-slate-700">{selectedEntry.notes}</span>
                  </div>
                )}
              </div>

              {/* Photos Section: Field Photo & Official Work Order Khata Photo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Official Admin Work Order / Khata Slip Photo */}
                {selectedEntry.workOrderPhoto && (
                  <div className="bg-amber-50/90 p-3.5 rounded-xl border-2 border-amber-300 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-amber-700" />
                          <span>Official Work Order & Khata Slip</span>
                        </span>
                        <span className="text-[10px] bg-amber-600 text-white font-bold px-2 py-0.5 rounded">
                          Admin Order
                        </span>
                      </div>
                      {selectedEntry.workOrderNoticeTitle && (
                        <div className="text-[11px] font-bold text-amber-900 mb-1">
                          {selectedEntry.workOrderNoticeTitle}
                        </div>
                      )}
                      {selectedEntry.workOrderNoticeDate && (
                        <div className="text-[10px] text-amber-800 font-mono mb-2 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-700" />
                          <span>Uploaded: {selectedEntry.workOrderNoticeDate}</span>
                        </div>
                      )}
                    </div>
                    <div className="relative group rounded-lg overflow-hidden border border-amber-300 bg-slate-950">
                      <img 
                        src={selectedEntry.workOrderPhoto} 
                        alt="Work Order Khata Slip" 
                        className="max-h-52 w-full object-contain mx-auto"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          const url = target.src;
                          const idMatch = url.match(/[\/=]([a-zA-Z0-9_-]{25,})/);
                          if (idMatch && idMatch[1] && !url.includes('/api/drive-proxy/')) {
                            target.src = `/api/drive-proxy/${idMatch[1]}`;
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 2. Field Site Photo / Lineman Installation Evidence */}
                {selectedEntry.photoUrl && (
                  <div className="bg-emerald-50/90 p-3.5 rounded-xl border-2 border-emerald-300 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-emerald-700" />
                          <span>Field Site / Installation Media</span>
                        </span>
                        <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded">
                          Worker Evidence
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-800 mb-2">
                        Captured by Lineman / Staff at field location
                      </div>
                    </div>
                    <div className="relative group rounded-lg overflow-hidden border border-emerald-300 bg-slate-950">
                      <img 
                        src={selectedEntry.photoUrl} 
                        alt="Field evidence" 
                        className="max-h-52 w-full object-contain mx-auto"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          const url = target.src;
                          const idMatch = url.match(/[\/=]([a-zA-Z0-9_-]{25,})/);
                          if (idMatch && idMatch[1] && !url.includes('/api/drive-proxy/')) {
                            target.src = `/api/drive-proxy/${idMatch[1]}`;
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  handleDelete(selectedEntry);
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t.delete}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = selectedEntry;
                    setSelectedEntry(null);
                    setEditingEntry(toEdit);
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>{t.edit}</span>
                </button>
                <button
                  onClick={() => handlePrintCertificate(selectedEntry)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>{t.printReceipt}</span>
                </button>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-bold text-xs cursor-pointer"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Edit / Correction Modal */}
      <EditEntryModal
        isOpen={!!editingEntry}
        entry={editingEntry}
        lang={lang}
        onClose={() => setEditingEntry(null)}
        onUpdated={(updated) => {
          onRefresh();
          setEditingEntry(null);
        }}
        onDeleted={(id) => {
          onRefresh();
          setEditingEntry(null);
        }}
      />

      {/* Admin Worker ID Management Modal */}
      <UserManagementModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        lang={lang}
        initialTab={userModalTab}
      />

      {/* ========================================================================= */}
      {/* MANDATORY RECORD DELETION CONFIRMATION MODAL                             */}
      {/* ========================================================================= */}
      {entryToDelete && (
        <div 
          id="mandatory-record-deletion-modal"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => {
            if (!isDeletingEntry) setEntryToDelete(null);
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 flex items-center justify-between text-white bg-gradient-to-r from-red-600 to-rose-700">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-wide">
                    {lang === 'bn' ? 'রেকর্ড ডিলিট নিশ্চিতকরণ' : 'Confirm Record Deletion'}
                  </h3>
                  <p className="text-[11px] text-white/80 font-mono">
                    ID: #{entryToDelete.id || entryToDelete.submissionId} • {entryToDelete.category}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingEntry) setEntryToDelete(null);
                }}
                disabled={isDeletingEntry}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-900">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-red-950">
                    {lang === 'bn' ? 'আপনি কি নিশ্চিত যে এই রেকর্ডটি ডিলিট করতে চান?' : 'Are you sure you want to permanently delete this record?'}
                  </p>
                  <p className="text-[11px] text-red-700 mt-0.5">
                    {lang === 'bn' 
                      ? 'ডিলিট নিশ্চিত করলে এই রেকর্ডটি Google Sheets এবং সিস্টেম থেকে সম্পূর্ণভাবে মুছে যাবে।'
                      : 'Once confirmed, this record will be permanently deleted from Google Sheets and the system.'}
                  </p>
                </div>
              </div>

              {/* Record Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">{lang === 'bn' ? 'ক্যাটাগরি ও স্ট্যাটাস:' : 'Category & Status:'}</span>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[11px]">{entryToDelete.category}</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] ${
                      entryToDelete.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {entryToDelete.status || 'Pending'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-slate-500">{lang === 'bn' ? 'গ্রাহকের নাম:' : 'Consumer Name:'}</p>
                    <p className="font-bold text-slate-900 truncate">{entryToDelete.consumerName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">{lang === 'bn' ? 'মোবাইল নম্বর:' : 'Mobile No:'}</p>
                    <p className="font-bold text-slate-900 truncate">{entryToDelete.mobile || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">{lang === 'bn' ? 'অ্যাপ্লিকেশন / ওয়ার্ক অর্ডার:' : 'App / WO No:'}</p>
                    <p className="font-bold text-slate-900 font-mono truncate">{entryToDelete.applicationNo || entryToDelete.workOrderNo || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">{lang === 'bn' ? 'মিটার ও সিল নং:' : 'Meter & Seal:'}</p>
                    <p className="font-bold text-slate-900 font-mono truncate">{entryToDelete.meterNo ? `${entryToDelete.meterNo} / ${entryToDelete.sealNo || '—'}` : '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-500">{lang === 'bn' ? 'কর্মী / লাইনম্যান:' : 'Lineman / Worker:'}</p>
                    <p className="font-bold text-slate-900 truncate">{entryToDelete.workerName || entryToDelete.submittedBy || '—'} {entryToDelete.workerId ? `(${entryToDelete.workerId})` : ''}</p>
                  </div>
                </div>
              </div>

              {/* Server-Side Validation / Error Callout */}
              {deleteError && (
                <div className="p-3 bg-red-100/90 border border-red-300 rounded-xl flex items-start gap-2 text-xs text-red-900 font-medium animate-in shake-1 duration-150">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold">{lang === 'bn' ? 'ত্রুটি:' : 'Error:'} </span>
                    <span>{deleteError}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="admin-cancel-delete-entry-btn"
                onClick={() => setEntryToDelete(null)}
                disabled={isDeletingEntry}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>

              <button
                type="button"
                id="admin-confirm-delete-entry-btn"
                onClick={executeDeleteEntry}
                disabled={isDeletingEntry}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed"
              >
                {isDeletingEntry ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{lang === 'bn' ? 'মুছে ফেলা হচ্ছে...' : 'Deleting...'}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'ডিলিট নিশ্চিত করুন' : 'Confirm Delete'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MANDATORY CLEAR ALL DATABASE CONFIRMATION MODAL                           */}
      {/* ========================================================================= */}
      {isClearAllModalOpen && (
        <div 
          id="mandatory-clear-all-modal"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => {
            if (!isClearingAll) setIsClearAllModalOpen(false);
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-red-300 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-gradient-to-r from-red-700 to-rose-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-wide">
                    {lang === 'bn' ? 'বিপদজনক: সকল ডাটা মুছুন' : 'Extreme Danger: Wipe Database'}
                  </h3>
                  <p className="text-[11px] text-white/80">
                    {lang === 'bn' ? 'সকল এন্ট্রি মুছে ফেলার পদক্ষেপ' : 'Clear all recorded production data'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isClearingAll) setIsClearAllModalOpen(false);
                }}
                disabled={isClearingAll}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <p className="text-xs text-slate-700 leading-relaxed">
                {lang === 'bn'
                  ? '⚠️ আপনি অ্যাপের সকল সাবমিট করা রেকর্ড মুছে ফেলার চেষ্টা করছেন। সার্ভার নীতি অনুসারে এই প্রক্রিয়া পূর্বাবস্থায় ফেরানো সম্ভব নয়।'
                  : '⚠️ You are about to clear all utility entries from the database. This action is destructive and irreversible.'}
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'bn' ? 'নিশ্চিত করতে হুবহু "CLEAR ALL" লিখুন:' : 'Type "CLEAR ALL" exactly to confirm:'}
                </label>
                <input
                  type="text"
                  value={clearAllConfirmText}
                  onChange={(e) => setClearAllConfirmText(e.target.value)}
                  placeholder="CLEAR ALL"
                  className="w-full px-3 py-2 border-2 border-red-200 focus:border-red-500 rounded-xl text-xs font-mono font-bold tracking-wider outline-none bg-red-50/40 text-red-900"
                />
              </div>

              {clearAllError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-xs text-red-900 font-medium">
                  {clearAllError}
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                disabled={isClearingAll}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={executeClearAll}
                disabled={isClearingAll || clearAllConfirmText.trim().toUpperCase() !== 'CLEAR ALL'}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
              >
                {isClearingAll ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{lang === 'bn' ? 'পরিষ্কার হচ্ছে...' : 'Wiping...'}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'সকল ডাটা মুছুন' : 'Wipe All Records'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
