import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Zap,
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Upload,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Camera,
  UserCheck,
  UserPlus,
  Archive,
  RotateCcw,
  FileSpreadsheet,
  Phone,
  MapPin,
  FileText,
  Eye,
  X,
  ChevronDown,
  ShieldCheck,
  Check,
  AlertCircle,
  Flame,
  CreditCard,
  Building2,
  HelpCircle,
  History
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  DisconnectionTask,
  DisconnectionTaskStatus,
  DisconnectionStats,
  UserSession,
  UserAccount
} from '../types';
import {
  fetchDisconnectionTasks,
  uploadDisconnectionTasks,
  submitDisconnectionTaskReport,
  assignDisconnectionTask,
  archiveDisconnectionTask,
  restoreDisconnectionTask,
  fetchUsers
} from '../services/api';
import { compressImageFile } from '../utils/imageCompressor';
import { Language } from '../utils/translations';

interface DisconnectionTaskManagementProps {
  currentUser?: UserSession | null;
  lang?: Language;
  onBack?: () => void;
}

const STATUS_CONFIG: Record<
  DisconnectionTaskStatus,
  { labelEn: string; labelBn: string; badgeBg: string; textColor: string; borderColor: string; icon: any }
> = {
  PENDING: {
    labelEn: 'Pending',
    labelBn: 'অপেক্ষমাণ',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: Clock
  },
  'IN PROGRESS': {
    labelEn: 'In Progress',
    labelBn: 'চলমান',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/40',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-200 dark:border-blue-800',
    icon: RefreshCw
  },
  COMPLETED: {
    labelEn: 'Completed',
    labelBn: 'সম্পন্ন',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    icon: CheckCircle2
  },
  UNABLE: {
    labelEn: 'Unable',
    labelBn: 'অসমর্থ',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
    textColor: 'text-rose-700 dark:text-rose-300',
    borderColor: 'border-rose-200 dark:border-rose-800',
    icon: AlertTriangle
  },
  REPORTED: {
    labelEn: 'Reported',
    labelBn: 'রিপোর্টকৃত',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
    textColor: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-200 dark:border-purple-800',
    icon: FileText
  },
  CANCELLED: {
    labelEn: 'Cancelled',
    labelBn: 'বাতিল',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    textColor: 'text-slate-600 dark:text-slate-400',
    borderColor: 'border-slate-300 dark:border-slate-700',
    icon: XCircle
  },
  ARCHIVED: {
    labelEn: 'Archived',
    labelBn: 'আর্কাইভ',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-900',
    textColor: 'text-zinc-500 dark:text-zinc-400',
    borderColor: 'border-zinc-300 dark:border-zinc-800',
    icon: Archive
  },
  DISCONNECT: {
    labelEn: 'Disconnected',
    labelBn: 'বিচ্ছিন্নকৃত',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
    textColor: 'text-rose-700 dark:text-rose-300',
    borderColor: 'border-rose-300 dark:border-rose-800',
    icon: Zap
  },
  PAID: {
    labelEn: 'Paid',
    labelBn: 'পরিশোধিত',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-300 dark:border-emerald-800',
    icon: CheckCircle2
  },
  DISPUTE: {
    labelEn: 'Dispute',
    labelBn: 'বিরোধপূর্ণ',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-300 dark:border-amber-800',
    icon: AlertTriangle
  },
  'OFFICE TEAM': {
    labelEn: 'Office Team',
    labelBn: 'অফিস টিম',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40',
    textColor: 'text-indigo-700 dark:text-indigo-300',
    borderColor: 'border-indigo-300 dark:border-indigo-800',
    icon: Building2
  },
  'NOT FOUND': {
    labelEn: 'Not Found',
    labelBn: 'অনুপস্থিত / পাওয়া যায়নি',
    badgeBg: 'bg-orange-50 dark:bg-orange-950/40',
    textColor: 'text-orange-700 dark:text-orange-300',
    borderColor: 'border-orange-300 dark:border-orange-800',
    icon: HelpCircle
  },
  REISSUE: {
    labelEn: 'Reissue',
    labelBn: 'পুনরায় ইস্যু',
    badgeBg: 'bg-cyan-50 dark:bg-cyan-950/40',
    textColor: 'text-cyan-700 dark:text-cyan-300',
    borderColor: 'border-cyan-300 dark:border-cyan-800',
    icon: RotateCcw
  }
};

const REPORT_QUICK_TEMPLATES = [
  'পোল/কাট-আউট থেকে সফলভাবে সংযোগ বিচ্ছিন্ন করা হয়েছে (Disconnected from pole/cutout)',
  'মিটার সিল অক্ষত রেখে তার খোলা হয়েছে (Cable removed keeping meter seal intact)',
  'মিটার ও সার্ভিস তার অফিসিয়ালভাবে জব্দ করা হয়েছে (Meter & cable officially removed)',
  'গ্রাহকের বাড়ি তালাবদ্ধ / যোগাযোগের চেষ্টা করা হলেও পাওয়া যায়নি (Premises locked / unavailable)',
  'গ্রাহক নগদ পরিশোধের রসিদ প্রদর্শন করায় সংযোগ বিচ্ছিন্ন স্থগিত (Payment proof shown, stay granted)',
  'স্থানীয় বিরোধ বা বাধার কারণে কাজ সম্পন্ন করা সম্ভব হয়নি (Unable due to local resistance)'
];

export const DisconnectionTaskManagement: React.FC<DisconnectionTaskManagementProps> = ({
  currentUser,
  lang = 'en',
  onBack
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const workerId = currentUser?.idNo || currentUser?.id || '';
  const workerName = currentUser?.name || '';

  // Data states
  const [tasks, setTasks] = useState<DisconnectionTask[]>([]);
  const [workersList, setWorkersList] = useState<UserAccount[]>([]);
  const [stats, setStats] = useState<DisconnectionStats>({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    unableTasks: 0,
    reportedTasks: 0,
    cancelledTasks: 0,
    completionPercentage: 0,
    myAssignedTasks: 0,
    myCompletedTasks: 0,
    myPendingTasks: 0,
    myCompletionPercentage: 0
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState<string>('ALL');
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Modals
  const [reportTask, setReportTask] = useState<DisconnectionTask | null>(null);
  const [assignTask, setAssignTask] = useState<DisconnectionTask | null>(null);
  const [archiveTaskModal, setArchiveTaskModal] = useState<DisconnectionTask | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showAddSingleModal, setShowAddSingleModal] = useState<boolean>(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Worker Report Form State
  const [reportStatus, setReportStatus] = useState<DisconnectionTaskStatus>('COMPLETED');
  const [reportRemarks, setReportRemarks] = useState<string>('');
  const [reportPhoto, setReportPhoto] = useState<string>('');
  const [reportPaidAmount, setReportPaidAmount] = useState<string>('');
  const [reportPaymentDate, setReportPaymentDate] = useState<string>('');
  const [reportPaymentRef, setReportPaymentRef] = useState<string>('');
  const [reportMeterReading, setReportMeterReading] = useState<string>('');
  const [reportPriority, setReportPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [reportAssignedAgency, setReportAssignedAgency] = useState<string>('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openReportModal = (task: DisconnectionTask) => {
    setReportTask(task);
    setReportStatus(task.taskStatus === 'PENDING' ? 'DISCONNECT' : task.taskStatus);
    setReportRemarks(task.workerRemarks || '');
    setReportPhoto(task.photoUrl || '');
    setReportPaidAmount(task.paidAmount || '');
    setReportPaymentDate(task.paymentDate || new Date().toISOString().slice(0, 10));
    setReportPaymentRef(task.paymentReference || '');
    setReportMeterReading(task.meterReading || '');
    setReportPriority(task.priority || 'NORMAL');
    setReportAssignedAgency(task.assignedAgency || task.assignedWorkerName || '');
  };

  // Admin Assign State
  const [assignedWorkerSelected, setAssignedWorkerSelected] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // Admin Archive State
  const [archiveReason, setArchiveReason] = useState<string>('');
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  // Admin Upload State
  const [uploadText, setUploadText] = useState<string>('');
  const [parsedUploadTasks, setParsedUploadTasks] = useState<Partial<DisconnectionTask>[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStep, setUploadStep] = useState<'input' | 'preview'>('input');

  // Admin Single Task State
  const [singleTaskForm, setSingleTaskForm] = useState({
    consumerId: '',
    consumerName: '',
    accountNumber: '',
    meterNumber: '',
    consumerAddress: '',
    phoneNumber: '',
    area: '',
    disconnectionReason: 'Outstanding Electricity Bill Default',
    assignedWorkerId: ''
  });
  const [isCreatingSingle, setIsCreatingSingle] = useState<boolean>(false);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch initial tasks and workers
  const loadTasks = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetchDisconnectionTasks({
        role: currentUser?.role || 'worker',
        workerId: currentUser?.role === 'worker' ? workerId : undefined,
        workerName: currentUser?.role === 'worker' ? workerName : undefined,
        includeArchived: showArchived
      });

      if (res && res.tasks) {
        setTasks(res.tasks);
        setStats(res.stats);
      }
    } catch (err: any) {
      console.warn('Failed to load tasks:', err);
      showToast(lang === 'bn' ? 'টাস্ক লোড করতে সমস্যা হয়েছে' : 'Failed to refresh tasks', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTasks();
    if (isAdmin) {
      fetchUsers().then(users => {
        setWorkersList(users.filter(u => u.role === 'worker' || u.role === 'supervisor'));
      }).catch(() => {});
    }
  }, [showArchived]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Archived filter
      if (!showArchived && (t.taskStatus === 'ARCHIVED' || t.archivedAt)) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'ALL') {
        if (t.taskStatus !== selectedStatus) return false;
      }

      // Worker filter (for admin)
      if (isAdmin && selectedWorkerFilter !== 'ALL') {
        if (selectedWorkerFilter === 'UNASSIGNED') {
          if (t.assignedWorkerId || t.assignedWorkerName) return false;
        } else {
          const matches =
            String(t.assignedWorkerId).toLowerCase() === selectedWorkerFilter.toLowerCase() ||
            String(t.assignedWorkerName).toLowerCase() === selectedWorkerFilter.toLowerCase();
          if (!matches) return false;
        }
      }

      // Universal search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const haystack = `${t.taskId} ${t.consumerId} ${t.consumerName} ${t.accountNumber || ''} ${t.meterNumber || ''} ${t.consumerAddress || ''} ${t.phoneNumber || ''} ${t.area || ''} ${t.disconnectionReason || ''} ${t.assignedWorkerName || ''} ${t.workerRemarks || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [tasks, selectedStatus, selectedWorkerFilter, searchQuery, showArchived, isAdmin]);

  // Photo upload handler
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    try {
      const compressed = await compressImageFile(file, {
        maxDimension: 1200,
        quality: 0.75
      });
      setReportPhoto(compressed);
      showToast(lang === 'bn' ? 'ছবি সফলভাবে লোড হয়েছে' : 'Photo captured & compressed', 'info');
    } catch (err) {
      console.warn('Compression error:', err);
      // Fallback to FileReader
      const reader = new FileReader();
      reader.onload = () => {
        setReportPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  // Submit Worker Report
  const handleWorkerReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTask || isSubmittingReport) return;

    setIsSubmittingReport(true);
    try {
      const res = await submitDisconnectionTaskReport({
        taskId: reportTask.taskId,
        workerId: workerId || 'FIELD-WORKER',
        workerName: workerName || 'Field Executive',
        taskStatus: reportStatus,
        workerReport: reportRemarks || `Status changed to ${reportStatus}`,
        workerRemarks: reportRemarks,
        photoUrl: reportPhoto || undefined,
        paidAmount: reportPaidAmount || undefined,
        paymentDate: reportPaymentDate || undefined,
        paymentReference: reportPaymentRef || undefined,
        meterReading: reportMeterReading || undefined,
        priority: reportPriority,
        assignedAgency: reportAssignedAgency || undefined
      });

      if (res && res.success) {
        // Update local task
        setTasks(prev =>
          prev.map(t =>
            t.taskId === reportTask.taskId
              ? {
                  ...t,
                  taskStatus: reportStatus,
                  workerReport: reportRemarks,
                  workerRemarks: reportRemarks,
                  photoUrl: reportPhoto || t.photoUrl,
                  paidAmount: reportPaidAmount || t.paidAmount,
                  paymentDate: reportPaymentDate || t.paymentDate,
                  paymentReference: reportPaymentRef || t.paymentReference,
                  meterReading: reportMeterReading || t.meterReading,
                  priority: reportPriority,
                  assignedAgency: reportAssignedAgency || t.assignedAgency,
                  reportDate: new Date().toLocaleDateString('en-GB'),
                  reportTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                  submittedBy: workerName || workerId,
                  statusHistory: [
                    ...(t.statusHistory || []),
                    {
                      status: reportStatus,
                      updatedAt: new Date().toISOString(),
                      updatedBy: workerName || workerId || 'User',
                      remarks: reportRemarks,
                      photoUrl: reportPhoto || undefined,
                      paidAmount: reportPaidAmount || undefined,
                      paymentReference: reportPaymentRef || undefined
                    }
                  ]
                }
              : t
          )
        );

        // Confetti if completed or paid!
        if (reportStatus === 'COMPLETED' || reportStatus === 'PAID') {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        }

        showToast(
          lang === 'bn'
            ? `টাস্ক #${reportTask.taskId} সফলভাবে আপডেট হয়েছে!`
            : `Task #${reportTask.taskId} report submitted successfully!`
        );
        setReportTask(null);
        setReportRemarks('');
        setReportPhoto('');
        loadTasks(true);
      } else {
        throw new Error(res?.message || 'Report submission failed');
      }
    } catch (err: any) {
      showToast(err.message || 'Error submitting report', 'error');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Admin Assign Worker
  const handleAssignWorkerSubmit = async () => {
    if (!assignTask || isAssigning) return;
    setIsAssigning(true);

    const selectedUser = workersList.find(
      u => u.idNo === assignedWorkerSelected || u.id === assignedWorkerSelected || u.name === assignedWorkerSelected
    );
    const workerTargetId = selectedUser?.idNo || selectedUser?.id || assignedWorkerSelected;
    const workerTargetName = selectedUser?.name || assignedWorkerSelected;

    try {
      const res = await assignDisconnectionTask(assignTask.taskId, workerTargetId, workerTargetName);
      if (res && res.success) {
        setTasks(prev =>
          prev.map(t =>
            t.taskId === assignTask.taskId
              ? { ...t, assignedWorkerId: workerTargetId, assignedWorkerName: workerTargetName }
              : t
          )
        );
        showToast(
          lang === 'bn'
            ? `টাস্ক #${assignTask.taskId} ${workerTargetName}-কে বরাদ্দ করা হয়েছে`
            : `Task #${assignTask.taskId} assigned to ${workerTargetName}`
        );
        setAssignTask(null);
        setAssignedWorkerSelected('');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to assign worker', 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  // Admin Archive Task
  const handleArchiveTaskSubmit = async () => {
    if (!archiveTaskModal || isArchiving) return;
    setIsArchiving(true);
    try {
      const res = await archiveDisconnectionTask(
        archiveTaskModal.taskId,
        archiveReason || 'Archived by Admin',
        currentUser?.name || 'Admin'
      );
      if (res && res.success) {
        setTasks(prev =>
          prev.map(t =>
            t.taskId === archiveTaskModal.taskId
              ? {
                  ...t,
                  taskStatus: 'ARCHIVED',
                  archivedAt: new Date().toISOString(),
                  archiveReason: archiveReason || 'Archived by Admin'
                }
              : t
          )
        );
        showToast(lang === 'bn' ? `টাস্ক #${archiveTaskModal.taskId} আর্কাইভ করা হয়েছে` : `Task #${archiveTaskModal.taskId} archived`);
        setArchiveTaskModal(null);
        setArchiveReason('');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to archive task', 'error');
    } finally {
      setIsArchiving(false);
    }
  };

  // Admin Restore Task
  const handleRestoreTask = async (taskId: string) => {
    try {
      const res = await restoreDisconnectionTask(taskId);
      if (res && res.success) {
        setTasks(prev =>
          prev.map(t => (t.taskId === taskId ? { ...t, taskStatus: 'PENDING', archivedAt: undefined } : t))
        );
        showToast(lang === 'bn' ? `টাস্ক #${taskId} পুনরুদ্ধার করা হয়েছে` : `Task #${taskId} restored`);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to restore task', 'error');
    }
  };

  // CSV Template Download
  const handleDownloadSampleCSV = () => {
    const headers = 'Consumer ID,Consumer Name,Account Number,Meter Number,Address,Phone Number,Area,Disconnection Reason,Assigned Worker';
    const sampleRows = [
      'CONS-1001,Abul Kalam Azad,502948123,WB762391,Vill - Panagarh Bazaar,9832145678,Burdwan North,Outstanding 6 Months Bill,Suman Das',
      'CONS-1002,Rina Roy,502948124,WB762392,12/A Station Road,9832145679,Durgapur East,Defective Bypass Wiring,Ramesh Ghosh',
      'CONS-1003,Sukumar Mondal,502948125,WB762393,Near Kali Mandir,9832145680,Asansol South,Notice Period Expired,'
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...sampleRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'WBSEDCL_Disconnection_Tasks_Sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse Text/CSV in Upload Modal
  const parseUploadData = (text: string) => {
    if (!text.trim()) {
      setParsedUploadTasks([]);
      return;
    }
    const lines = text.trim().split(/\r?\n/);
    if (lines.length === 0) return;

    const parsed: Partial<DisconnectionTask>[] = [];
    // Check if line 0 is header
    const firstLineLower = lines[0].toLowerCase();
    const startIndex = (firstLineLower.includes('consumer') || firstLineLower.includes('name') || firstLineLower.includes('account')) ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle tab-separated or comma-separated
      const cols = line.includes('\t') ? line.split('\t') : line.split(',');
      if (cols.length >= 2) {
        const consumerId = (cols[0] || '').trim();
        const consumerName = (cols[1] || '').trim();
        const accountNumber = (cols[2] || '').trim();
        const meterNumber = (cols[3] || '').trim();
        const consumerAddress = (cols[4] || '').trim();
        const phoneNumber = (cols[5] || '').trim();
        const area = (cols[6] || '').trim();
        const disconnectionReason = (cols[7] || '').trim() || 'Outstanding Default';
        const assignedWorker = (cols[8] || '').trim();

        if (consumerId || consumerName) {
          parsed.push({
            taskId: `TASK-DISC-${Date.now().toString().slice(-4)}-${i}`,
            consumerId: consumerId || `C-${Math.floor(1000 + Math.random() * 9000)}`,
            consumerName: consumerName || 'Valued Consumer',
            accountNumber,
            meterNumber,
            consumerAddress,
            phoneNumber,
            area,
            disconnectionReason,
            assignedWorkerName: assignedWorker,
            taskStatus: 'PENDING',
            createdAt: new Date().toISOString()
          });
        }
      }
    }
    setParsedUploadTasks(parsed);
    if (parsed.length > 0) {
      setUploadStep('preview');
    } else {
      showToast('Could not find valid rows. Please check format.', 'error');
    }
  };

  // Confirm Batch Upload
  const handleConfirmBatchUpload = async () => {
    if (parsedUploadTasks.length === 0 || isUploading) return;
    setIsUploading(true);

    try {
      const res = await uploadDisconnectionTasks(parsedUploadTasks, {
        adminId: currentUser?.idNo || currentUser?.id || 'ADMIN',
        adminName: currentUser?.name || 'Administrator'
      });

      if (res && res.success) {
        showToast(lang === 'bn' ? `${parsedUploadTasks.length}টি টাস্ক সফলভাবে আপলোড হয়েছে!` : `Successfully uploaded ${parsedUploadTasks.length} disconnection tasks!`);
        setShowUploadModal(false);
        setUploadText('');
        setParsedUploadTasks([]);
        setUploadStep('input');
        loadTasks(true);
      } else {
        throw new Error(res?.message || 'Upload failed');
      }
    } catch (err: any) {
      showToast(err.message || 'Upload error', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Add Single Task
  const handleAddSingleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleTaskForm.consumerName || isCreatingSingle) return;
    setIsCreatingSingle(true);

    const newTask: Partial<DisconnectionTask> = {
      taskId: `TASK-DISC-${Date.now().toString().slice(-6)}`,
      consumerId: singleTaskForm.consumerId || `C-${Math.floor(1000 + Math.random() * 9000)}`,
      consumerName: singleTaskForm.consumerName,
      accountNumber: singleTaskForm.accountNumber,
      meterNumber: singleTaskForm.meterNumber,
      consumerAddress: singleTaskForm.consumerAddress,
      phoneNumber: singleTaskForm.phoneNumber,
      area: singleTaskForm.area,
      disconnectionReason: singleTaskForm.disconnectionReason || 'Outstanding Electricity Bill Default',
      assignedWorkerId: singleTaskForm.assignedWorkerId,
      assignedWorkerName: workersList.find(w => w.idNo === singleTaskForm.assignedWorkerId || w.id === singleTaskForm.assignedWorkerId)?.name || '',
      taskStatus: 'PENDING',
      createdAt: new Date().toISOString()
    };

    try {
      const res = await uploadDisconnectionTasks([newTask], {
        adminId: currentUser?.idNo || currentUser?.id || 'ADMIN',
        adminName: currentUser?.name || 'Administrator'
      });

      if (res && res.success) {
        showToast(lang === 'bn' ? 'নতুন ডিসকানেকশন টাস্ক যোগ হয়েছে!' : 'New Disconnection Task added successfully!');
        setShowAddSingleModal(false);
        setSingleTaskForm({
          consumerId: '',
          consumerName: '',
          accountNumber: '',
          meterNumber: '',
          consumerAddress: '',
          phoneNumber: '',
          area: '',
          disconnectionReason: 'Outstanding Electricity Bill Default',
          assignedWorkerId: ''
        });
        loadTasks(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create task', 'error');
    } finally {
      setIsCreatingSingle(false);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-800 dark:text-slate-100 pb-16 font-sans">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 text-sm font-semibold animate-in slide-in-from-top duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800'
              : 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600" />}
          {toastMessage.type === 'info' && <AlertTriangle className="w-5 h-5 text-blue-600" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header Banner */}
      <div className="bg-slate-900 text-white border-b border-slate-800 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Back to menu"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center font-black">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  WBSEDCL • DISCONNECTION
                </span>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Live Sheets
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
                {lang === 'bn' ? 'বিদ্যুৎ বিচ্ছিন্নকরণ টাস্ক ব্যবস্থাপনা' : 'Disconnection Task Management'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadTasks(false)}
              disabled={refreshing}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh from Google Sheets"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline">{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAddSingleModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-bold flex items-center gap-1.5 border border-amber-500/30 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'টাস্ক যোগ করুন' : 'Add Task'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'তালিকা আপলোড' : 'Upload List'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* Statistics Dashboard Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
          {/* Total */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {lang === 'bn' ? 'মোট টাস্ক' : 'Total Tasks'}
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {stats.totalTasks}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span>{lang === 'bn' ? 'সকল রেকর্ড' : 'All assigned records'}</span>
            </div>
          </div>

          {/* Completed */}
          <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-4 shadow-xs">
            <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              {lang === 'bn' ? 'সম্পন্ন' : 'Completed'}
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {stats.completedTasks}
            </div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{stats.completionPercentage}% {lang === 'bn' ? 'সম্পূর্ণ' : 'rate'}</span>
            </div>
          </div>

          {/* Pending */}
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 shadow-xs">
            <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              {lang === 'bn' ? 'অপেক্ষমাণ' : 'Pending'}
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {stats.pendingTasks}
            </div>
            <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'কাজের অপেক্ষায়' : 'Awaiting action'}</span>
            </div>
          </div>

          {/* In Progress */}
          <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 shadow-xs">
            <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              {lang === 'bn' ? 'চলমান' : 'In Progress'}
            </div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
              {stats.inProgressTasks}
            </div>
            <div className="text-[11px] text-blue-700 dark:text-blue-400 mt-1">
              {lang === 'bn' ? 'ফিল্ডে কাজ চলছে' : 'Field work active'}
            </div>
          </div>

          {/* Unable / Dispute */}
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 shadow-xs">
            <div className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
              {lang === 'bn' ? 'অসমর্থ / বাধা' : 'Unable / Hold'}
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {stats.unableTasks}
            </div>
            <div className="text-[11px] text-rose-700 dark:text-rose-400 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'তালাবদ্ধ বা সমস্যা' : 'Locked / issue'}</span>
            </div>
          </div>

          {/* Progress Bar Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {lang === 'bn' ? 'অগ্রগতি' : 'Progress'}
            </div>
            <div className="my-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                <span>{stats.completionPercentage}%</span>
                <span>{stats.completedTasks}/{stats.totalTasks}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(stats.completionPercentage, 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="text-[10px] text-slate-600 dark:text-slate-400">
              {lang === 'bn' ? 'সম্পূর্ণ করার হার' : 'Overall clearance'}
            </div>
          </div>
        </div>

        {/* Worker Specific Greeting Card (if role is worker) */}
        {!isAdmin && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 dark:border-amber-900/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'স্বাগতম' : 'Welcome'}, {workerName || 'Worker'}!
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {lang === 'bn'
                    ? `আপনার জন্য বরাদ্দকৃত মোট ${stats.myAssignedTasks}টি টাস্ক (${stats.myCompletedTasks}টি সম্পন্ন)`
                    : `You have ${stats.myAssignedTasks} assigned tasks (${stats.myCompletedTasks} completed)`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {lang === 'bn' ? 'বাকি টাস্ক' : 'Remaining'}: {stats.myPendingTasks}
              </span>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs mb-6">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'টাস্ক আইডি, কনজিউমার নাম, আইডি, মিটার বা ঠিকানা দিয়ে খুঁজুন...'
                    : 'Search by Task ID, Consumer Name, Account, Meter, Address...'
                }
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <Filter className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">{lang === 'bn' ? 'সকল স্ট্যাটাস' : 'All Status'}</option>
                  <option value="DISCONNECT">Disconnected (বিচ্ছিন্ন)</option>
                  <option value="PAID">Paid (পরিশোধিত)</option>
                  <option value="PENDING">Pending (অপেক্ষমাণ)</option>
                  <option value="IN PROGRESS">In Progress (চলমান)</option>
                  <option value="COMPLETED">Completed (সম্পন্ন)</option>
                  <option value="DISPUTE">Dispute (বিরোধপূর্ণ)</option>
                  <option value="OFFICE TEAM">Office Team (অফিস টিম)</option>
                  <option value="NOT FOUND">Not Found (অনুপস্থিত)</option>
                  <option value="REISSUE">Reissue (পুনরায় ইস্যু)</option>
                  <option value="UNABLE">Unable (অসমর্থ)</option>
                  <option value="REPORTED">Reported (রিপোর্টকৃত)</option>
                  <option value="CANCELLED">Cancelled (বাতিল)</option>
                  {showArchived && <option value="ARCHIVED">Archived</option>}
                </select>
              </div>

              {/* Worker Filter (Admin Only) */}
              {isAdmin && workersList.length > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <UserCheck className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <select
                    value={selectedWorkerFilter}
                    onChange={e => setSelectedWorkerFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer max-w-[130px] truncate"
                  >
                    <option value="ALL">{lang === 'bn' ? 'সকল কর্মী' : 'All Workers'}</option>
                    <option value="UNASSIGNED">{lang === 'bn' ? 'অনাবন্টিত' : 'Unassigned'}</option>
                    {workersList.map(w => (
                      <option key={w.id || w.idNo} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Show Archived Toggle (Admin Only) */}
              {isAdmin && (
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer px-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={e => setShowArchived(e.target.checked)}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>{lang === 'bn' ? 'আর্কাইভ সহ' : 'Archived'}</span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Task Cards Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-3 animate-spin">
              <RefreshCw className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
              {lang === 'bn' ? 'গুগল শিট থেকে টাস্ক লোড হচ্ছে...' : 'Fetching disconnection tasks from Google Sheets...'}
            </p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-12 text-center my-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {lang === 'bn' ? 'কোনো ডিসকানেকশন টাস্ক পাওয়া যায়নি' : 'No Disconnection Tasks Found'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-5">
              {searchQuery || selectedStatus !== 'ALL'
                ? lang === 'bn'
                  ? 'আপনার খোঁজার সাথে কোনো টাস্ক মিলছে না। ফিল্টার পরিবর্তন করুন।'
                  : 'No tasks match your active filters or search criteria.'
                : lang === 'bn'
                ? 'বর্তমানে কোনো ডিসকানেকশন টাস্ক নিবন্ধিত নেই।'
                : 'No disconnection tasks have been assigned or uploaded yet.'}
            </p>

            {isAdmin && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'এক্সেল/সিএসভি আপলোড করুন' : 'Upload CSV/Excel List'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSingleModal(true)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'টাস্ক ম্যানুয়ালি যোগ করুন' : 'Add Single Task'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map(task => {
              const statusCfg = STATUS_CONFIG[task.taskStatus] || STATUS_CONFIG.PENDING;
              const StatusIcon = statusCfg.icon;

              return (
                <div
                  key={task.taskId}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Task ID & Priority & Status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono font-black px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {task.taskId}
                        </span>
                        {task.priority === 'URGENT' && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-600 text-white flex items-center gap-1 shadow-xs animate-pulse">
                            <Flame className="w-3 h-3" />
                            URGENT
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-black px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${statusCfg.badgeBg} ${statusCfg.textColor} ${statusCfg.borderColor}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? statusCfg.labelBn : statusCfg.labelEn}</span>
                      </span>
                    </div>

                    {/* Consumer Primary Info */}
                    <div className="mb-3">
                      <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                        {task.consumerName}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-slate-600 dark:text-slate-400">
                        <span>ID: <strong className="text-slate-800 dark:text-slate-200">{task.consumerId}</strong></span>
                        {task.accountNumber && (
                          <span>• Acc: <strong className="text-slate-800 dark:text-slate-200">{task.accountNumber}</strong></span>
                        )}
                        {task.meterNumber && (
                          <span>• Mtr: <strong className="text-slate-800 dark:text-slate-200">{task.meterNumber}</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Outstanding Due & Specs Banner */}
                    {(task.outstandingDue !== undefined && task.outstandingDue !== '') && (
                      <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 mb-3">
                        <span className="text-amber-900 dark:text-amber-200 font-bold flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                          {lang === 'bn' ? 'বকেয়া বিল (Due)' : 'Outstanding Due'}:
                        </span>
                        <span className="font-mono font-black text-amber-950 dark:text-amber-100 text-sm">
                          ₹{task.outstandingDue}
                        </span>
                      </div>
                    )}

                    {/* Address & Phone */}
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 mb-3">
                      {task.consumerAddress && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                          <span className="leading-snug">{task.consumerAddress} {task.area && `(${task.area})`}</span>
                        </div>
                      )}
                      {(task.mruSection || task.cccFeeder) && (
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          <Building2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <span>MRU: {task.mruSection || '-'} • Feeder/CCC: {task.cccFeeder || '-'}</span>
                        </div>
                      )}
                      {task.phoneNumber && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <a
                            href={`tel:${task.phoneNumber}`}
                            className="text-amber-600 dark:text-amber-400 hover:underline font-bold"
                          >
                            {task.phoneNumber}
                          </a>
                        </div>
                      )}
                      {task.disconnectionReason && (
                        <div className="flex items-start gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span className="text-rose-700 dark:text-rose-400 font-semibold leading-snug">
                            {task.disconnectionReason}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Assigned Worker & Agency */}
                    <div className="flex flex-wrap items-center justify-between text-xs py-2 border-y border-slate-100 dark:border-slate-800/80 mb-3 gap-1">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">
                        {lang === 'bn' ? 'বরাদ্দ কর্মী / এজেন্সি' : 'Worker / Agency'}:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {task.assignedWorkerName ? (
                          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[11px]">
                            <UserCheck className="w-3 h-3 text-amber-500" />
                            <span>{task.assignedWorkerName}</span>
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 italic text-[11px] font-bold">
                            {lang === 'bn' ? 'অনাবন্টিত' : 'Unassigned'}
                          </span>
                        )}
                        {task.assignedAgency && (
                          <span className="font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md text-[11px] border border-indigo-200 dark:border-indigo-800">
                            {task.assignedAgency}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Payment & Meter Reading Details if recorded */}
                    {(task.paidAmount || task.meterReading) && (
                      <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs mb-3 space-y-1">
                        {task.paidAmount && (
                          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-200 font-bold">
                            <span>✓ {lang === 'bn' ? 'পরিশোধিত' : 'Paid'}: ₹{task.paidAmount}</span>
                            <span className="text-[10px] text-emerald-600 font-normal">{task.paymentDate}</span>
                          </div>
                        )}
                        {task.paymentReference && (
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono">
                            Ref: {task.paymentReference}
                          </div>
                        )}
                        {task.meterReading && (
                          <div className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                            Meter Reading: {task.meterReading} kWh
                          </div>
                        )}
                      </div>
                    )}

                    {/* Execution Report Section (if completed or unable) */}
                    {(task.workerReport || task.workerRemarks || task.photoUrl) && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs mb-3 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase">
                          <span>{lang === 'bn' ? 'কাজের রিপোর্ট' : 'Execution Report'}</span>
                          {task.reportDate && <span>{task.reportDate} {task.reportTime}</span>}
                        </div>
                        {task.workerRemarks && (
                          <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                            {task.workerRemarks}
                          </p>
                        )}
                        {task.photoUrl && (
                          <div className="pt-1.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoUrl(task.photoUrl!)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{lang === 'bn' ? 'প্রমাণ ছবি দেখুন' : 'View Proof Photo'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    {/* Worker Action: UPDATE STATUS BUTTON */}
                    <button
                      type="button"
                      onClick={() => openReportModal(task)}
                      className="flex-1 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>[ UPDATE STATUS ]</span>
                    </button>

                    {/* Admin Actions */}
                    {isAdmin && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAssignTask(task);
                            setAssignedWorkerSelected(task.assignedWorkerId || task.assignedWorkerName || '');
                          }}
                          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                          title="Assign Worker"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>

                        {task.taskStatus === 'ARCHIVED' ? (
                          <button
                            type="button"
                            onClick={() => handleRestoreTask(task.taskId)}
                            className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
                            title="Restore Task"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setArchiveTaskModal(task)}
                            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Archive Task"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: WORKER REPORT SUBMISSION */}
      {/* ========================================================================= */}
      {reportTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
                  {reportTask.taskId}
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {lang === 'bn' ? 'ডিসকানেকশন কাজের রিপোর্ট' : 'Disconnection Field Report'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReportTask(null)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWorkerReportSubmit} className="space-y-4 pt-4">
              {/* Consumer summary preview */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">{reportTask.consumerName}</span>
                  {reportTask.outstandingDue && (
                    <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">
                      Due: ₹{reportTask.outstandingDue}
                    </span>
                  )}
                </div>
                <div className="text-slate-600 dark:text-slate-400 mt-1">
                  ID: {reportTask.consumerId} • Mtr: {reportTask.meterNumber || 'N/A'} • {reportTask.consumerAddress}
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  {lang === 'bn' ? 'কাজের চূড়ান্ত স্ট্যাটাস' : 'Execution Status'} *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['DISCONNECT', 'PAID', 'DISPUTE', 'OFFICE TEAM', 'NOT FOUND', 'REISSUE', 'COMPLETED', 'IN PROGRESS', 'UNABLE', 'REPORTED'] as DisconnectionTaskStatus[]).map(st => {
                    const cfg = STATUS_CONFIG[st] || STATUS_CONFIG.PENDING;
                    const isSel = reportStatus === st;
                    return (
                      <button
                        type="button"
                        key={st}
                        onClick={() => setReportStatus(st)}
                        className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSel
                            ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs ring-2 ring-amber-400/40'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <cfg.icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{lang === 'bn' ? cfg.labelBn : cfg.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority & Agency Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    {lang === 'bn' ? 'অগ্রাধিকার (Priority)' : 'Priority'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setReportPriority('NORMAL')}
                      className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        reportPriority === 'NORMAL'
                          ? 'bg-slate-800 text-white border-slate-700 dark:bg-slate-200 dark:text-slate-900'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportPriority('URGENT')}
                      className={`py-1.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        reportPriority === 'URGENT'
                          ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Flame className="w-3 h-3" />
                      Urgent
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    {lang === 'bn' ? 'এজেন্সি / টিম' : 'Agency / Team'}
                  </label>
                  <input
                    type="text"
                    value={reportAssignedAgency}
                    onChange={e => setReportAssignedAgency(e.target.value)}
                    placeholder="e.g. Field Team A"
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              {/* Conditional Payment Details (Highlighted if status is PAID or entered) */}
              {(reportStatus === 'PAID' || reportPaidAmount) && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800 dark:text-emerald-300">
                    <CreditCard className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'পেমেন্ট / পরিশোধের বিবরণ' : 'Payment Details'}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-900 dark:text-emerald-200 uppercase mb-0.5">
                        {lang === 'bn' ? 'পরিশোধিত টাকা (₹)' : 'Paid Amount (₹)'}
                      </label>
                      <input
                        type="text"
                        value={reportPaidAmount}
                        onChange={e => setReportPaidAmount(e.target.value)}
                        placeholder="₹ Amount"
                        className="w-full p-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-900 dark:text-emerald-200 uppercase mb-0.5">
                        {lang === 'bn' ? 'তারিখ' : 'Payment Date'}
                      </label>
                      <input
                        type="date"
                        value={reportPaymentDate}
                        onChange={e => setReportPaymentDate(e.target.value)}
                        className="w-full p-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-900 dark:text-emerald-200 uppercase mb-0.5">
                        {lang === 'bn' ? 'রসিদ / ট্রানজ্যাকশন আইডি' : 'Receipt / Ref No'}
                      </label>
                      <input
                        type="text"
                        value={reportPaymentRef}
                        onChange={e => setReportPaymentRef(e.target.value)}
                        placeholder="Txn / Receipt #"
                        className="w-full p-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Meter Reading Input */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {lang === 'bn' ? 'মিটার রিডিং (ঐচ্ছিক)' : 'Meter Reading at Site (Optional)'}
                </label>
                <input
                  type="text"
                  value={reportMeterReading}
                  onChange={e => setReportMeterReading(e.target.value)}
                  placeholder="e.g. 14205 kWh"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              {/* Quick Template Chips */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  {lang === 'bn' ? 'দ্রুত মন্তব্য বাছাই (Quick Templates)' : 'Quick Remarks'}
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {REPORT_QUICK_TEMPLATES.map((tmpl, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setReportRemarks(tmpl)}
                      className="text-[11px] text-left px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detailed Remarks Textarea */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  {lang === 'bn' ? 'বিস্তারিত ফিল্ড নোট ও মন্তব্য' : 'Field Report & Notes'} *
                </label>
                <textarea
                  rows={2}
                  value={reportRemarks}
                  onChange={e => setReportRemarks(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'কাজের ফলাফল বা বাধার বিশদ বিবরণ লিখুন...'
                      : 'Provide details about the disconnection action, cable status, reason, etc.'
                  }
                  required
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* Proof Photo Attachment */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  {lang === 'bn' ? 'সাইটের প্রমাণ ছবি (Proof Photo)' : 'Site / Disconnection Photo'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputRef}
                  onChange={handlePhotoCapture}
                  className="hidden"
                />

                {reportPhoto ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-40 flex items-center justify-center bg-slate-900">
                    <img src={reportPhoto} alt="Proof" className="max-h-40 w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setReportPhoto('')}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCompressingPhoto}
                    className="w-full py-3.5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:text-amber-500 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-xs font-bold">
                      {isCompressingPhoto
                        ? lang === 'bn' ? 'ছবি কম্প্রেস হচ্ছে...' : 'Compressing photo...'
                        : lang === 'bn' ? 'ক্যামেরা চালু করুন / ছবি আপলোড' : 'Take Photo / Upload Evidence'}
                    </span>
                  </button>
                )}
              </div>

              {/* Status History Audit Trail (if present) */}
              {reportTask.statusHistory && reportTask.statusHistory.length > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-amber-500" />
                    <span>{lang === 'bn' ? 'পূর্ববর্তী স্ট্যাটাস ইতিহাস' : 'Status History'} ({reportTask.statusHistory.length})</span>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {reportTask.statusHistory.map((hist, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-white dark:bg-slate-800 text-[11px] border border-slate-100 dark:border-slate-700 flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-black">
                              {hist.status}
                            </span>
                            <span className="text-slate-500 font-normal">by {hist.updatedBy}</span>
                          </div>
                          {hist.remarks && <p className="text-slate-600 dark:text-slate-400 mt-0.5">{hist.remarks}</p>}
                          {hist.paidAmount && <p className="text-emerald-600 font-bold mt-0.5">Paid: ₹{hist.paidAmount}</p>}
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 shrink-0 text-right">
                          {new Date(hist.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => setReportTask(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingReport ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{lang === 'bn' ? 'রিপোর্ট সংরক্ষণ করুন' : 'Submit Report'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADMIN ASSIGN WORKER */}
      {/* ========================================================================= */}
      {assignTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {lang === 'bn' ? 'কর্মী বরাদ্দ করুন' : 'Assign Worker to Task'}
              </h3>
              <button
                type="button"
                onClick={() => setAssignTask(null)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white">{assignTask.consumerName}</div>
                <div className="text-slate-600 dark:text-slate-400">
                  Task: {assignTask.taskId} • Area: {assignTask.area || 'All'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  {lang === 'bn' ? 'ফিল্ড কর্মী নির্বাচন করুন' : 'Select Active Field Worker'}
                </label>
                <select
                  value={assignedWorkerSelected}
                  onChange={e => setAssignedWorkerSelected(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
                >
                  <option value="">-- {lang === 'bn' ? 'কর্মী নির্বাচন করুন' : 'Choose Worker'} --</option>
                  {workersList.map(w => (
                    <option key={w.id || w.idNo} value={w.name}>
                      {w.name} ({w.idNo || w.phone || 'Worker'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => setAssignTask(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleAssignWorkerSubmit}
                  disabled={!assignedWorkerSelected || isAssigning}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isAssigning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{lang === 'bn' ? 'বরাদ্দ সম্পন্ন' : 'Assign Worker'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADMIN ARCHIVE TASK */}
      {/* ========================================================================= */}
      {archiveTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <Archive className="w-5 h-5" />
                <span>{lang === 'bn' ? 'টাস্ক আর্কাইভ করুন' : 'Archive Disconnection Task'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setArchiveTaskModal(null)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                {lang === 'bn'
                  ? `আপনি কি নিশ্চিত যে #${archiveTaskModal.taskId} টাস্কটি সংরক্ষণ/আর্কাইভ করতে চান? এটি সাধারণ তালিকা থেকে আড়াল হবে কিন্তু স্থায়ীভাবে সংরক্ষিত থাকবে।`
                  : `Are you sure you want to archive Task #${archiveTaskModal.taskId}? It will be hidden from daily worker views but preserved securely.`}
              </p>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {lang === 'bn' ? 'আর্কাইভের কারণ' : 'Reason for Archival'}
                </label>
                <input
                  type="text"
                  value={archiveReason}
                  onChange={e => setArchiveReason(e.target.value)}
                  placeholder="e.g. Completed & Closed, Permanent Disconnection, Dispute Resolved"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => setArchiveTaskModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleArchiveTaskSubmit}
                  disabled={isArchiving}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isArchiving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                  <span>{lang === 'bn' ? 'আর্কাইভ করুন' : 'Confirm Archive'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ADMIN BATCH UPLOAD (EXCEL/CSV) */}
      {/* ========================================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'ডিসকানেকশন তালিকা ব্যাচ আপলোড' : 'Upload Disconnection Tasks List'}
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Excel/CSV কপি করে সরাসরি পেস্ট করুন বা ফাইল আপলোড করুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadStep('input');
                  setParsedUploadTasks([]);
                }}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadStep === 'input' ? (
              <div className="py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    {lang === 'bn' ? 'এক্সেল বা সিএসভি ডেটা পেস্ট করুন' : 'Paste Tabular Data from Excel / CSV'}
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadSampleCSV}
                    className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'নমুনা সিএসভি ডাউনলোড' : 'Download Sample Template'}</span>
                  </button>
                </div>

                <textarea
                  rows={8}
                  value={uploadText}
                  onChange={e => setUploadText(e.target.value)}
                  placeholder={`Consumer ID, Consumer Name, Account No, Meter No, Address, Phone, Area, Reason, Assigned Worker\nCONS-101, Abul Kalam, 502948123, WB762391, Panagarh, 9832145678, North, Bill Default, Suman Das`}
                  className="w-full p-3 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 leading-relaxed"
                />

                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Excel থেকে টেবিল কপি করে হুবহু পেস্ট করতে পারেন (Tab Separated) অথবা কমা দিয়ে সেপারেট করা CSV লাইন দিতে পারেন।
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => parseUploadData(uploadText)}
                    disabled={!uploadText.trim()}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{lang === 'bn' ? 'প্রিভিউ দেখুন' : 'Preview Parsed Rows'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    ✓ {parsedUploadTasks.length} {lang === 'bn' ? 'টি রেকর্ড সনাক্ত করা হয়েছে' : 'tasks parsed successfully'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setUploadStep('input')}
                    className="text-xs font-bold text-slate-600 hover:text-slate-700 dark:hover:text-slate-200 underline cursor-pointer"
                  >
                    {lang === 'bn' ? 'এডিট করুন' : 'Edit Input'}
                  </button>
                </div>

                {/* Table Preview */}
                <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0">
                      <tr>
                        <th className="p-2.5 font-bold">#</th>
                        <th className="p-2.5 font-bold">Consumer</th>
                        <th className="p-2.5 font-bold">Account / Meter</th>
                        <th className="p-2.5 font-bold">Address</th>
                        <th className="p-2.5 font-bold">Reason</th>
                        <th className="p-2.5 font-bold">Worker</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {parsedUploadTasks.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-mono text-[11px] text-slate-600">{idx + 1}</td>
                          <td className="p-2.5 font-bold">
                            <div>{t.consumerName}</div>
                            <div className="text-[10px] text-slate-600">{t.consumerId}</div>
                          </td>
                          <td className="p-2.5 text-[11px]">
                            <div>Acc: {t.accountNumber || '-'}</div>
                            <div>Mtr: {t.meterNumber || '-'}</div>
                          </td>
                          <td className="p-2.5 text-[11px] max-w-[150px] truncate">{t.consumerAddress || '-'}</td>
                          <td className="p-2.5 text-[11px] text-rose-600 dark:text-rose-400">{t.disconnectionReason || '-'}</td>
                          <td className="p-2.5 text-[11px] font-semibold">{t.assignedWorkerName || 'Unassigned'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setUploadStep('input')}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100"
                  >
                    {lang === 'bn' ? 'ফিরে যান' : 'Back'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBatchUpload}
                    disabled={isUploading}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>{lang === 'bn' ? 'গুগল শিটে আপলোড নিশ্চিত করুন' : 'Confirm & Save to Google Sheets'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ADMIN ADD SINGLE TASK */}
      {/* ========================================================================= */}
      {showAddSingleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-500" />
                <span>{lang === 'bn' ? 'নতুন ডিসকানেকশন টাস্ক তৈরি' : 'Create Disconnection Task'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddSingleModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSingleTaskSubmit} className="space-y-3 pt-3 text-xs">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Consumer Name *
                </label>
                <input
                  type="text"
                  required
                  value={singleTaskForm.consumerName}
                  onChange={e => setSingleTaskForm(prev => ({ ...prev, consumerName: e.target.value }))}
                  placeholder="e.g. Subhashish Chatterjee"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Consumer ID
                  </label>
                  <input
                    type="text"
                    value={singleTaskForm.consumerId}
                    onChange={e => setSingleTaskForm(prev => ({ ...prev, consumerId: e.target.value }))}
                    placeholder="e.g. 50019283"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Account No
                  </label>
                  <input
                    type="text"
                    value={singleTaskForm.accountNumber}
                    onChange={e => setSingleTaskForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                    placeholder="e.g. 102938475"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Meter Number
                  </label>
                  <input
                    type="text"
                    value={singleTaskForm.meterNumber}
                    onChange={e => setSingleTaskForm(prev => ({ ...prev, meterNumber: e.target.value }))}
                    placeholder="e.g. WB192831"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={singleTaskForm.phoneNumber}
                    onChange={e => setSingleTaskForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    placeholder="e.g. 9832145678"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Address & Area
                </label>
                <input
                  type="text"
                  value={singleTaskForm.consumerAddress}
                  onChange={e => setSingleTaskForm(prev => ({ ...prev, consumerAddress: e.target.value }))}
                  placeholder="e.g. Vill - Rampur, Near Hospital"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Disconnection Reason
                </label>
                <input
                  type="text"
                  value={singleTaskForm.disconnectionReason}
                  onChange={e => setSingleTaskForm(prev => ({ ...prev, disconnectionReason: e.target.value }))}
                  placeholder="e.g. Outstanding Electricity Bill Default"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Assign Worker
                </label>
                <select
                  value={singleTaskForm.assignedWorkerId}
                  onChange={e => setSingleTaskForm(prev => ({ ...prev, assignedWorkerId: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
                >
                  <option value="">-- Unassigned --</option>
                  {workersList.map(w => (
                    <option key={w.id || w.idNo} value={w.idNo || w.id || w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddSingleModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSingle}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isCreatingSingle ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>{lang === 'bn' ? 'টাস্ক সেভ করুন' : 'Create Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: IMAGE PREVIEW LIGHTBOX */}
      {/* ========================================================================= */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 p-2 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-4 py-2 text-white border-b border-slate-800">
              <span className="text-xs font-bold text-slate-400">Proof Image Preview</span>
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center">
              <img src={previewPhotoUrl} alt="Enlarged Proof" className="max-h-[75vh] w-auto object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisconnectionTaskManagement;
