import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  History as HistoryIcon,
  MapPin,
  Calendar,
  Power,
  AlertCircle,
  Clock,
  Check,
  XCircle,
  RefreshCw,
  Camera,
  Upload,
  X,
  Loader2,
  ChevronDown,
  Phone,
  Flame,
  Eye,
  Trash2,
  CreditCard
} from 'lucide-react';
import { DisconnectionTask, DisconnectionTaskStatus } from '../../types';
import { compressImageFile } from '../../utils/imageCompressor';
import { submitDisconnectionTaskReport, fetchDisconnectionHistory } from '../../services/api';
import { formatDateDDMMYYYY, formatTime12Hour, getNowDateDDMMYYYY, getNowTime12Hour } from '../../utils/dateTimeFormat';
import { cleanDisconnectionNotes, cleanWorkerOrAgencyName } from '../../utils/disconnectionClassifier';

interface DisconnectionUpdateModalProps {
  task: DisconnectionTask;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSuccess: (updatedTask: DisconnectionTask) => void;
  currentUser: {
    idNo?: string;
    username?: string;
    name?: string;
    role?: string;
  };
  availableWorkers: Array<{ idNo: string; name: string }>;
  lang?: 'en' | 'bn';
}

export const DisconnectionUpdateModal: React.FC<DisconnectionUpdateModalProps> = ({
  task,
  isOpen,
  onClose,
  onUpdateSuccess,
  currentUser,
  availableWorkers = [],
  lang = 'en'
}) => {
  // Form States
  const [selectedStatus, setSelectedStatus] = useState<DisconnectionTaskStatus>(
    (task.taskStatus as DisconnectionTaskStatus) || 'DISCONNECT'
  );
  const [isUrgent, setIsUrgent] = useState<boolean>(
    String(task.priority || '').toUpperCase() === 'URGENT'
  );
  const [assignedAgency, setAssignedAgency] = useState<string>(
    task.assignedAgency || task.assignedWorkerName || ''
  );
  const [photoDataUrl, setPhotoDataUrl] = useState<string>(task.photoUrl || '');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [meterReading, setMeterReading] = useState<string>(task.meterReading || '');
  const [remarks, setRemarks] = useState<string>(task.workerRemarks || task.workerReport || '');

  // Conditional Fields
  const [paidAmount, setPaidAmount] = useState<string>(task.paidAmount || '');
  const [paymentDate, setPaymentDate] = useState<string>(
    task.paymentDate || new Date().toISOString().split('T')[0]
  );
  const [paymentReference, setPaymentReference] = useState<string>(task.paymentReference || '');
  const [disconDate, setDisconDate] = useState<string>(
    task.disconDate || task.reportDate || (task as any)['Discon Date'] || new Date().toISOString().split('T')[0]
  );
  const [gisPole, setGisPole] = useState<string>(
    task.gisPole || (task as any)['Gis Pole'] || ''
  );
  const [paymentStatus, setPaymentStatus] = useState<string>(
    task.paymentStatus || (task as any)['Payment Status'] || (task.taskStatus === 'PAID' ? 'PAID' : 'UNPAID')
  );
  const [paidType, setPaidType] = useState<string>(
    task.paidType || (task as any)['Paid Type'] || task.paymentReference || ''
  );
  const [outstandingAfter, setOutstandingAfter] = useState<string>(
    task.outstandingAfter || (task as any)['Outstanding After'] || ''
  );
  const [nextPaymentDate, setNextPaymentDate] = useState<string>(
    task.nextPaymentDate || (task as any)['Next Payment Date'] || ''
  );
  const [paymentSource, setPaymentSource] = useState<string>(
    task.paymentSource || (task as any)['Payment Source'] || ''
  );
  const [conditionalReason, setConditionalReason] = useState<string>('');

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [remoteHistory, setRemoteHistory] = useState<any[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showRoundSavePopup, setShowRoundSavePopup] = useState(false);
  const [savedTaskResult, setSavedTaskResult] = useState<DisconnectionTask | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Sync state when task changes
  useEffect(() => {
    if (task) {
      const initialSt = (task.taskStatus as DisconnectionTaskStatus) || 'DISCONNECT';
      setSelectedStatus(initialSt === 'PENDING' ? 'DISCONNECT' : initialSt);
      setIsUrgent(String(task.priority || '').toUpperCase() === 'URGENT');
      setAssignedAgency(cleanWorkerOrAgencyName(task.assignedAgency || task.assignedWorkerName || (task as any)['Agency'] || ''));
      setPhotoDataUrl(task.photoUrl || (task as any)['Image'] || '');
      setMeterReading(task.meterReading || (task as any)['Reading'] || '');
      setRemarks(cleanDisconnectionNotes(task.workerRemarks || task.workerReport || (task as any)['Notes'] || ''));
      setPaidAmount(initialSt === 'PAID' ? (task.paidAmount || (task as any)['Paid Amount'] || '') : '');
      setPaymentDate(task.paymentDate || (task as any)['Paid Date'] || new Date().toISOString().split('T')[0]);
      setPaymentReference(task.paymentReference || (task as any)['Paid Type'] || '');
      setDisconDate(task.disconDate || task.reportDate || (task as any)['Discon Date'] || new Date().toISOString().split('T')[0]);
      setGisPole(task.gisPole || (task as any)['Gis Pole'] || '');
      setPaymentStatus(task.paymentStatus || (task as any)['Payment Status'] || (initialSt === 'PAID' ? 'PAID' : 'UNPAID'));
      setPaidType(task.paidType || (task as any)['Paid Type'] || task.paymentReference || '');
      setOutstandingAfter(task.outstandingAfter || (task as any)['Outstanding After'] || '');
      setNextPaymentDate(task.nextPaymentDate || (task as any)['Next Payment Date'] || '');
      setPaymentSource(task.paymentSource || (task as any)['Payment Source'] || '');
      setConditionalReason('');
      setErrorMessage(null);
      setShowRoundSavePopup(false);
      setSavedTaskResult(null);
      setRemoteHistory(null);
      setIsLoadingHistory(false);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  // Reliable phone number extractor for modal
  const modalPhone = (() => {
    const directCandidates = [
      task.phoneNumber,
      (task as any).mobileNumber,
      (task as any).mobile,
      (task as any).phone,
      (task as any).contactNumber,
      (task as any).contact,
      (task as any)['Mobile Number'],
      (task as any)['Mobile No'],
      (task as any)['Mobile'],
      (task as any)['Mobile_No'],
      (task as any)['Mob No'],
      (task as any)['Mob'],
      (task as any)['Phone'],
      (task as any)['Phone No'],
      (task as any)['মোবাইল'],
      (task as any)['ফোন']
    ];
    for (const val of directCandidates) {
      if (val !== undefined && val !== null) {
        let str = String(val).trim().replace(/\.0+$/, '');
        if (/^\d+\.?\d*e[+-]?\d+$/i.test(str)) {
          const num = Number(str);
          if (!isNaN(num)) str = Math.round(num).toString();
        }
        if (str && str.toLowerCase() !== 'null' && str.toLowerCase() !== 'undefined' && str.toLowerCase() !== 'n/a' && str !== '-') {
          return str;
        }
      }
    }
    const text = `${task.consumerAddress || ''} ${task.workerRemarks || ''}`;
    const m = text.match(/(?:^|\D)([6-9]\d{9})(?:\D|$)/);
    return m ? m[1] : '';
  })();

  // 6 Exact Status options matching IMG_6112.png
  const isAdminOrSupervisor =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'superadmin' ||
    currentUser?.role === 'supervisor' ||
    currentUser?.idNo === 'ADMIN' ||
    currentUser?.idNo === '8695716192';

  const statusButtons: {
    status: DisconnectionTaskStatus;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    selectedBorder: string;
    selectedBg: string;
    selectedText: string;
  }[] = [
    {
      status: 'DISCONNECT',
      label: 'DISCONNECT',
      icon: Power,
      selectedBorder: 'border-2 border-rose-500',
      selectedBg: 'bg-rose-50/50',
      selectedText: 'text-rose-700'
    },
    {
      status: 'PAID',
      label: 'PAID',
      icon: Check,
      selectedBorder: 'border-2 border-emerald-500',
      selectedBg: 'bg-emerald-50/50',
      selectedText: 'text-emerald-700'
    },
    {
      status: 'PENDING',
      label: 'PENDING',
      icon: Clock,
      selectedBorder: 'border-2 border-amber-500',
      selectedBg: 'bg-amber-50/50',
      selectedText: 'text-amber-700'
    },
    {
      status: 'NOT FOUND',
      label: 'NOT FOUND',
      icon: XCircle,
      selectedBorder: 'border-2 border-slate-600',
      selectedBg: 'bg-slate-100',
      selectedText: 'text-slate-800'
    },
    {
      status: 'DISPUTE',
      label: 'DISPUTE',
      icon: AlertCircle,
      selectedBorder: 'border-2 border-orange-500',
      selectedBg: 'bg-orange-50/50',
      selectedText: 'text-orange-700'
    },
    {
      status: 'OFFICE TEAM',
      label: 'OFFICE TEAM',
      icon: Clock,
      selectedBorder: 'border-2 border-indigo-500',
      selectedBg: 'bg-indigo-50/50',
      selectedText: 'text-indigo-700'
    },
    ...(isAdminOrSupervisor
      ? [
          {
            status: 'REISSUE' as DisconnectionTaskStatus,
            label: 'REISSUE',
            icon: RefreshCw,
            selectedBorder: 'border-2 border-purple-500',
            selectedBg: 'bg-purple-50/50',
            selectedText: 'text-purple-700'
          }
        ]
      : [])
  ];

  // Quick tap observation options
  const quickObservationChips = [
    'Disconnected',
    'Already disconnected',
    'Consumer not found',
    'Consumer paid on spot',
    'Meter removed from pole',
    'Consumer refused disconnection',
    'Office team required / high resistance',
    'Premises locked / untraceable',
    'Defective meter / burnt terminal',
    'Court stay order presented'
  ];

  const handleInsertQuickChip = (chip: string) => {
    if (!remarks.trim()) {
      setRemarks(chip);
    } else if (!remarks.includes(chip)) {
      setRemarks(prev => `${prev.trim()}, ${chip}`);
    }
  };

  // Photo Upload Handler with Geotag & Watermark
  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    setIsProcessingPhoto(true);
    try {
      const workerName = cleanWorkerOrAgencyName(currentUser?.name || currentUser?.username || 'Worker');
      const dateStr = getNowDateDDMMYYYY();
      const timeStr = getNowTime12Hour();

      const watermarkText = `CONSUMER: ${task.consumerId}`;
      const subText = `WORKER: ${workerName} | ${dateStr} ${timeStr}`;

      const compressed = await compressImageFile(file, {
        maxDimension: 900,
        quality: 0.7,
        watermarkText,
        subText
      });

      setPhotoDataUrl(compressed);
    } catch (err: any) {
      alert(`Photo compression failed: ${err.message}`);
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  // Submit Update
  const handleSubmitUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!selectedStatus) {
      setErrorMessage(lang === 'bn' ? 'অনুগ্রহ করে একটি স্ট্যাটাস নির্বাচন করুন' : 'Please select a status');
      return;
    }

    if (selectedStatus === 'PAID') {
      if (!paidAmount || isNaN(parseFloat(paidAmount)) || parseFloat(paidAmount) <= 0) {
        setErrorMessage(lang === 'bn' ? 'পরিশোধিত টাকার পরিমাণ উল্লেখ করুন' : 'Please enter valid Paid Amount');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const isAdminUser = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.idNo === 'ADMIN' || currentUser?.idNo === '8695716192';
      const workerId = currentUser?.idNo || currentUser?.username || 'WORKER';
      const workerName = cleanWorkerOrAgencyName(currentUser?.name || currentUser?.username || 'Field Worker');
      const dateNow = getNowDateDDMMYYYY();
      const timeNow = getNowTime12Hour();

      let combinedRemarks = cleanDisconnectionNotes(remarks.trim());
      if (conditionalReason && !combinedRemarks.includes(conditionalReason)) {
        combinedRemarks = combinedRemarks ? `[${conditionalReason}] ${combinedRemarks}` : `[${conditionalReason}]`;
      }
      // If Admin sets status to REISSUE, mark [REISSUE_APPROVED] so worker is unlocked to update status once
      if (isAdminUser && selectedStatus === 'REISSUE') {
        combinedRemarks = `${combinedRemarks} [REISSUE_APPROVED]`.trim();
      }

      const cleanAgency = cleanWorkerOrAgencyName(assignedAgency || workerName);

      const reportPayload = {
        ...task,
        taskId: task.taskId,
        consumerId: task.consumerId || (task as any)['Consumer Id'],
        workerId,
        workerName,
        taskStatus: selectedStatus,
        disconStatus: selectedStatus,
        disconDate: formatDateDDMMYYYY(disconDate) || dateNow,
        reportDate: formatDateDDMMYYYY(disconDate) || dateNow,
        reportTime: timeNow,
        workerReport: combinedRemarks,
        workerRemarks: combinedRemarks,
        notes: combinedRemarks,
        photoUrl: photoDataUrl || undefined,
        image: photoDataUrl || undefined,
        meterReading: meterReading || undefined,
        reading: meterReading || undefined,
        paymentStatus: selectedStatus === 'PAID' ? 'PAID' : 'UNPAID',
        gisPole: gisPole || undefined,
        priority: isUrgent ? 'URGENT' : 'NORMAL',
        assignedAgency: cleanAgency || undefined,
        agency: cleanAgency || undefined,
        paidAmount: selectedStatus === 'PAID' ? paidAmount : undefined,
        paymentDate: selectedStatus === 'PAID' ? formatDateDDMMYYYY(paymentDate) : undefined,
        paidDate: selectedStatus === 'PAID' ? formatDateDDMMYYYY(paymentDate) : undefined,
        paidType: selectedStatus === 'PAID' ? (paidType || paymentReference || undefined) : undefined,
        paymentReference: selectedStatus === 'PAID' ? (paidType || paymentReference || undefined) : undefined,
        outstandingAfter: selectedStatus === 'PAID' ? (outstandingAfter || undefined) : undefined,
        nextPaymentDate: selectedStatus === 'PAID' ? (nextPaymentDate || undefined) : undefined,
        paymentSource: selectedStatus === 'PAID' ? (paymentSource || undefined) : undefined
      };

      const res = await submitDisconnectionTaskReport(reportPayload);

      if (res && res.success) {
        const finalImgUrl = (res as any).imageUrl || photoDataUrl || task.photoUrl || (task as any)['Image'];
        const newHistoryItem = {
          date: dateNow,
          time: timeNow,
          workerName,
          previousStatus: task.taskStatus,
          newStatus: selectedStatus,
          remarks: cleanDisconnectionNotes(combinedRemarks),
          paidAmount: selectedStatus === 'PAID' ? paidAmount : undefined,
          meterReading: meterReading || undefined,
          photoUrl: finalImgUrl || undefined
        };

        const existingHistory = Array.isArray(task.statusHistory) ? task.statusHistory : [];

        // Keep consumer details in the Disconnection module completely unchanged; update status badge, remark, and operational fields
        const updatedTaskObj: DisconnectionTask = {
          ...task,
          taskStatus: selectedStatus,
          disconStatus: selectedStatus,
          'Discon Status': selectedStatus,
          workerRemarks: combinedRemarks,
          workerReport: combinedRemarks,
          'Notes': combinedRemarks,
          notes: combinedRemarks,
          reissueRequested: false,
          reissueApproved: Boolean(isAdminUser && selectedStatus === 'REISSUE'),
          disconDate: formatDateDDMMYYYY(disconDate) || dateNow,
          reportDate: formatDateDDMMYYYY(disconDate) || dateNow,
          'Discon Date': formatDateDDMMYYYY(disconDate) || dateNow,
          assignedAgency: cleanAgency || task.assignedAgency,
          Agency: cleanAgency || (task as any)['Agency'],
          priority: (isUrgent ? 'URGENT' : 'NORMAL') as any,
          Priority: isUrgent ? 'URGENT' : 'NORMAL',
          meterReading: meterReading || task.meterReading,
          Reading: meterReading || (task as any)['Reading'],
          photoUrl: finalImgUrl || task.photoUrl,
          Image: finalImgUrl || (task as any)['Image'],
          paidAmount: selectedStatus === 'PAID' ? paidAmount : task.paidAmount,
          'Paid Amount': selectedStatus === 'PAID' ? paidAmount : (task as any)['Paid Amount'],
          paymentDate: selectedStatus === 'PAID' ? formatDateDDMMYYYY(paymentDate) : task.paymentDate,
          'Paid Date': selectedStatus === 'PAID' ? formatDateDDMMYYYY(paymentDate) : (task as any)['Paid Date'],
          paymentReference: selectedStatus === 'PAID' ? (paidType || paymentReference || '') : task.paymentReference,
          'Paid Type': selectedStatus === 'PAID' ? (paidType || paymentReference || '') : (task as any)['Paid Type'],
          statusHistory: [newHistoryItem, ...existingHistory]
        };

        // Immediately propagate update to parent list (0ms delay)
        onUpdateSuccess(updatedTaskObj);
        setSavedTaskResult(updatedTaskObj);
        setShowRoundSavePopup(true);

        // Auto close confirmation popup quickly (550ms)
        setTimeout(() => {
          onClose();
        }, 550);
      } else {
        throw new Error(res?.message || 'Server rejected status update');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenHistory = async () => {
    setShowHistoryModal(true);
    const targetCId = task.consumerId || (task as any)['Consumer Id'];
    if (targetCId) {
      setIsLoadingHistory(true);
      try {
        const res = await fetchDisconnectionHistory(targetCId);
        if (res && res.success && Array.isArray(res.history)) {
          setRemoteHistory(res.history);
        }
      } catch (err) {
        console.warn('[Disconnection] History fetch notice:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    }
  };

  const historyList = (remoteHistory !== null)
    ? remoteHistory
    : (Array.isArray(task.statusHistory) ? task.statusHistory : []);

  const displayOutstanding = task.outstandingDue
    ? Number(task.outstandingDue).toLocaleString('en-IN')
    : '0';
  const displayClass = task.baseClass || (task as any)['Base Class'] || (task as any)['Class'] || '-';
  const displayDevice = task.meterNumber || task.deviceType || (task as any)['device'] || (task as any)['Number'] || (task as any)['Device'] || '-';
  const displayDueDate = task.dueDateRange || (task as any)['O/S Duedate Range'] || '-';
  const displaySection = task.mruSection || (task as any)['MRU'] || '-';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-50/80 rounded-3xl max-w-xl w-full max-h-[96vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 relative"
        onClick={e => e.stopPropagation()}
        id="disconnection-update-modal"
      >
        {/* Top Header matching IMG_6112.png */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Update Consumer
            </h2>
          </div>

          <button
            type="button"
            onClick={handleOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <HistoryIcon className="w-4 h-4 text-slate-600" />
            <span>History</span>
          </button>
        </div>

        {/* Scrollable Body containing cards matching IMG_6112 and IMG_6113 */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* CARD 1: CONSUMER DETAILS (Exact match to IMG_6112.png) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            {/* Row 1: Name and Outstanding Due Badge */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase truncate">
                  {task.consumerName || (task as any)['Name'] || 'Consumer'}
                </h3>
                {/* Location row */}
                {(task.consumerAddress || (task as any)['Address']) ? (
                  <div className="flex items-start gap-1.5 mt-1 text-slate-600 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <span className="uppercase leading-snug">
                      {task.consumerAddress || (task as any)['Address']}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Outstanding Badge with OUTSTANDING text underneath */}
              <div className="flex flex-col items-center shrink-0">
                <div className="bg-rose-50 border border-rose-200 text-rose-600 px-3.5 py-1 rounded-full font-bold text-xs sm:text-sm">
                  ₹ {displayOutstanding}
                </div>
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-1">
                  OUTSTANDING
                </span>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* 2-Column Info Grid */}
            <div className="grid grid-cols-2 gap-y-3.5 gap-x-4">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  CONSUMER ID {task.serialNumber ? `(${task.serialNumber})` : ''}
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-900 block font-mono">
                  {task.consumerId || (task as any)['Consumer Id'] || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  MRU SECTION
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-900 block">
                  {displaySection}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  BASE CLASS
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-900 block">
                  {displayClass}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  METER / DEVICE
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-900 block">
                  {displayDevice}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  MOBILE NUMBER
                </span>
                {modalPhone ? (
                  <a
                    href={`tel:${modalPhone}`}
                    className="text-xs sm:text-sm font-bold text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <Phone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>{modalPhone}</span>
                  </a>
                ) : (
                  <span className="text-xs sm:text-sm font-semibold text-slate-400 block mt-0.5">
                    N/A
                  </span>
                )}
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  DUE DATE RANGE
                </span>
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{displayDueDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: SET STATUS, ASSIGN AGENCY, PRIORITY, EVIDENCE (Matching IMG_6112.png) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            {/* SET STATUS Label */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2.5">
                SET STATUS
              </span>

              {/* 6 Exact Status Buttons in 2-Column Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {statusButtons.map(item => {
                  const Icon = item.icon;
                  const isSelected = selectedStatus === item.status;
                  return (
                    <button
                      key={item.status}
                      type="button"
                      onClick={() => {
                        setSelectedStatus(item.status);
                        setErrorMessage(null);
                      }}
                      className={`py-3 px-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 ${
                        isSelected
                          ? `${item.selectedBorder} ${item.selectedBg} ${item.selectedText} shadow-xs`
                          : 'bg-white border border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conditional input if PAID is chosen */}
            {selectedStatus === 'PAID' && (
              <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-teal-900 font-bold text-xs">
                  <CreditCard className="w-4 h-4 text-teal-600" />
                  <span>Payment Collection Details (Mandatory for PAID)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-teal-900 block mb-1">
                      Paid Amount (₹) *
                    </label>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={e => setPaidAmount(e.target.value)}
                      placeholder="Enter amount..."
                      className="w-full py-2.5 px-3 bg-white border border-teal-300 rounded-xl text-xs font-bold text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-teal-900 block mb-1">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={e => setPaymentDate(e.target.value)}
                      className="w-full py-2.5 px-3 bg-white border border-teal-300 rounded-xl text-xs font-bold text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-teal-900 block mb-1">
                      Paid Type / Mode
                    </label>
                    <select
                      value={paidType}
                      onChange={e => {
                        setPaidType(e.target.value);
                        if (!paymentReference) setPaymentReference(e.target.value);
                      }}
                      className="w-full py-2.5 px-3 bg-white border border-teal-300 rounded-xl text-xs font-bold text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      <option value="">Select Mode</option>
                      <option value="UPI / Online">UPI / Online</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                      <option value="RTGS / NEFT">RTGS / NEFT</option>
                      <option value="Counter Receipt">Counter Receipt</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-teal-900 block mb-1">
                      Receipt / Ref No.
                    </label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={e => setPaymentReference(e.target.value)}
                      placeholder="Receipt or Money Receipt no..."
                      className="w-full py-2.5 px-3 bg-white border border-teal-300 rounded-xl text-xs font-bold text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-teal-900 block mb-1">
                      Payment Source
                    </label>
                    <input
                      type="text"
                      value={paymentSource}
                      onChange={e => setPaymentSource(e.target.value)}
                      placeholder="e.g. Field / Portal / Counter..."
                      className="w-full py-2.5 px-3 bg-white border border-teal-300 rounded-xl text-xs font-bold text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-teal-900 block mb-1">
                      Outstanding After (₹)
                    </label>
                    <input
                      type="number"
                      value={outstandingAfter}
                      onChange={e => setOutstandingAfter(e.target.value)}
                      placeholder="Remaining due if any..."
                      className="w-full py-2.5 px-3 bg-white border border-teal-300 rounded-xl text-xs font-bold text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Conditional reason for DISPUTE */}
            {selectedStatus === 'DISPUTE' && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-1.5 animate-in fade-in">
                <label className="text-[11px] font-bold text-amber-950 block">
                  Dispute Reason
                </label>
                <select
                  value={conditionalReason}
                  onChange={e => setConditionalReason(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-amber-300 rounded-xl text-xs font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-600"
                >
                  <option value="">Select Dispute Reason</option>
                  <option value="Billing calculation dispute">Billing calculation dispute (under review at CCC)</option>
                  <option value="Court Injunction / Stay Order">Court injunction / legal stay order</option>
                  <option value="Meter Reading Mismatch Claim">Meter reading mismatch claim</option>
                  <option value="Already Paid at Counter / Portal">Already paid at counter/online (receipt pending)</option>
                </select>
              </div>
            )}

            {/* Conditional reason for OFFICE TEAM */}
            {selectedStatus === 'OFFICE TEAM' && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5 space-y-1.5 animate-in fade-in">
                <label className="text-[11px] font-bold text-indigo-950 block">
                  Office Team Reason
                </label>
                <select
                  value={conditionalReason}
                  onChange={e => setConditionalReason(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="">Select Reason</option>
                  <option value="Severe local resistance / police required">Severe local resistance / police support needed</option>
                  <option value="Commercial High Voltage disconnection">Commercial / High voltage disconnection needed</option>
                  <option value="Substation Feeder Isolation Required">Substation feeder isolation required</option>
                </select>
              </div>
            )}

            {/* Conditional reason for NOT FOUND */}
            {selectedStatus === 'NOT FOUND' && (
              <div className="bg-slate-100 border border-slate-300 rounded-2xl p-3.5 space-y-1.5 animate-in fade-in">
                <label className="text-[11px] font-bold text-slate-800 block">
                  Reason for NOT FOUND
                </label>
                <select
                  value={conditionalReason}
                  onChange={e => setConditionalReason(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-600"
                >
                  <option value="">Select Reason</option>
                  <option value="Premises Locked / Gates Closed">Premises Locked / Gates Closed</option>
                  <option value="Incorrect Address / Untraceable">Incorrect Address / Untraceable</option>
                  <option value="Consumer Relocated / Demolished">Consumer Relocated / Demolished</option>
                  <option value="No Such Person in Locality">No Such Person in Locality</option>
                </select>
              </div>
            )}

            {/* Conditional reason for REISSUE */}
            {selectedStatus === 'REISSUE' && (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3.5 space-y-1.5 animate-in fade-in">
                <label className="text-[11px] font-bold text-purple-950 block">
                  Reissue Reason
                </label>
                <select
                  value={conditionalReason}
                  onChange={e => setConditionalReason(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-purple-300 rounded-xl text-xs font-bold text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  <option value="">Select Reason</option>
                  <option value="Field re-verification required">Field re-verification required</option>
                  <option value="Wrong Pole / Feeder tagged">Wrong Pole / Feeder tagged</option>
                  <option value="Defective meter notice expired">Defective meter notice expired</option>
                </select>
              </div>
            )}

            {/* ASSIGN AGENCY & PRIORITY (Admin / Supervisor Only) */}
            {isAdminOrSupervisor && (
              <>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    ASSIGN AGENCY
                  </span>
                  <div className="relative">
                    <select
                      value={assignedAgency}
                      onChange={e => setAssignedAgency(e.target.value)}
                      className="w-full py-3 px-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">Select Worker / Agency</option>
                      {availableWorkers.map((w, idx) => {
                        const cleanW = cleanWorkerOrAgencyName(w.name);
                        return (
                          <option key={`${cleanW}-${idx}`} value={cleanW}>
                            {cleanW}
                          </option>
                        );
                      })}
                      {task.assignedAgency && !availableWorkers.some(w => cleanWorkerOrAgencyName(w.name) === cleanWorkerOrAgencyName(task.assignedAgency)) && (
                        <option value={cleanWorkerOrAgencyName(task.assignedAgency)}>{cleanWorkerOrAgencyName(task.assignedAgency)}</option>
                      )}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    PRIORITY
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsUrgent(!isUrgent)}
                    className={`w-full py-3 px-4 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      isUrgent
                        ? 'border-red-500 bg-red-50 text-red-700 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    {isUrgent && <Flame className="w-4 h-4 text-red-500 animate-bounce" />}
                    <span>{isUrgent ? 'MARKED AS URGENT' : 'Mark as URGENT'}</span>
                  </button>
                </div>

                <hr className="border-slate-100" />
              </>
            )}

            {/* EVIDENCE (AUTO-WATERMARKED) */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                EVIDENCE (AUTO-WATERMARKED)
              </span>

              {/* Hidden file inputs */}
              <input
                type="file"
                ref={cameraInputRef}
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    handlePhotoUpload(e.target.files[0]);
                  }
                }}
              />
              <input
                type="file"
                ref={galleryInputRef}
                accept="image/*"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    handlePhotoUpload(e.target.files[0]);
                  }
                }}
              />

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isProcessingPhoto}
                  className="py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-bold text-slate-800 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all"
                >
                  <Camera className="w-4 h-4 text-slate-600" />
                  <span>Camera (Live)</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isProcessingPhoto}
                  className="py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-bold text-slate-800 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all"
                >
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span>Gallery</span>
                </button>
              </div>

              {isProcessingPhoto && (
                <div className="flex items-center gap-2 text-xs text-blue-600 font-bold py-2 mt-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Watermarking photo & optimizing...</span>
                </div>
              )}

              {photoDataUrl && !isProcessingPhoto && (
                <div className="relative border border-slate-200 rounded-2xl p-2.5 bg-slate-50 flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={photoDataUrl}
                      alt="Evidence"
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 object-cover rounded-xl border border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">
                        Evidence Photo Attached
                      </span>
                      <span className="text-[10px] text-emerald-600 font-medium">
                        ✓ Watermark & Geotag applied
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPhotoPreview(true)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoDataUrl('')}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CARD 3: OPERATIONAL DETAILS (METER READING, DISCON DATE, GIS POLE, REMARKS) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            {/* DISCON DATE & GIS POLE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  DISCON DATE
                </span>
                <input
                  type="date"
                  value={disconDate}
                  onChange={e => setDisconDate(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  GIS POLE NO.
                </span>
                <input
                  type="text"
                  value={gisPole}
                  onChange={e => setGisPole(e.target.value)}
                  placeholder="e.g. POL-1029..."
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* PAYMENT STATUS & PAYMENT SOURCE (If not already marked as PAID) */}
            {selectedStatus !== 'PAID' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    PAYMENT STATUS
                  </span>
                  <select
                    value={paymentStatus}
                    onChange={e => setPaymentStatus(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="UNPAID">UNPAID</option>
                    <option value="PAID">PAID</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="DISPUTED">DISPUTED</option>
                  </select>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    PAYMENT SOURCE
                  </span>
                  <input
                    type="text"
                    value={paymentSource}
                    onChange={e => setPaymentSource(e.target.value)}
                    placeholder="e.g. Counter / Portal / Cash..."
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* METER READING */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                METER READING
              </span>
              <input
                type="text"
                value={meterReading}
                onChange={e => setMeterReading(e.target.value)}
                placeholder="Enter reading..."
                className="w-full py-3 px-3.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* REMARKS */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  REMARKS
                </span>
                <span className="text-[10px] text-slate-400">Tap chips to insert</span>
              </div>

              {/* Quick Observation Chips */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {quickObservationChips.slice(0, 6).map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsertQuickChip(chip)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold border border-slate-200 transition-colors cursor-pointer"
                  >
                    + {chip}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Any additional notes..."
                className="w-full p-3.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              />
            </div>
          </div>

          {/* Error Message if any */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-3 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Fixed Bottom Action Bar matching IMG_6112.png & IMG_6113.png */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 py-3.5 px-6 font-bold text-sm min-w-[110px] sm:min-w-[130px] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            id="save-update-button"
            onClick={() => handleSubmitUpdate()}
            disabled={isSubmitting}
            className="rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold py-3.5 px-6 flex-1 text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Update</span>
            )}
          </button>
        </div>
      </div>

      {/* SPECIAL REQUEST: ROUND SAVE POPUP IN CENTER OF SCREEN */}
      {showRoundSavePopup && (
        <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-72 h-72 sm:w-80 sm:h-80 rounded-full bg-white shadow-2xl border-4 border-emerald-500 flex flex-col items-center justify-center text-center p-6 animate-in zoom-in-75 duration-300 relative overflow-hidden">
            {/* Background radial gradient glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/70 via-white to-emerald-50/30 pointer-events-none rounded-full" />

            {/* Circular Green Checkmark */}
            <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-2 animate-bounce">
              <Check className="w-10 h-10 stroke-[3.5]" />
            </div>

            {/* Success Title */}
            <h3 className="text-lg sm:text-xl font-black text-slate-900 relative z-10 tracking-tight">
              {lang === 'bn' ? 'সফলভাবে সংরক্ষিত!' : 'Update Saved!'}
            </h3>

            {/* Consumer Name */}
            <p className="text-xs font-bold text-slate-700 mt-1 max-w-[200px] truncate relative z-10 uppercase">
              {task.consumerName}
            </p>

            {/* Status Pill */}
            <div className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-extrabold text-xs relative z-10">
              <span>{selectedStatus}</span>
            </div>

            <p className="text-[10px] text-slate-400 mt-2 relative z-10">
              {lang === 'bn' ? 'ডাটাবেসে আপডেট সম্পন্ন হয়েছে' : 'Task successfully updated'}
            </p>
          </div>
        </div>
      )}

      {/* History Drawer Modal */}
      {showHistoryModal && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 max-h-[80vh] flex flex-col space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <HistoryIcon className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Consumer History</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  <span className="text-xs font-medium">Loading history from Google Sheets...</span>
                </div>
              ) : historyList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">
                  No previous history entries recorded yet for this consumer.
                </div>
              ) : (
                historyList.map((h: any, i: number) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-mono">
                      <span>{formatDateDDMMYYYY(h.date)} {h.time ? `• ${formatTime12Hour(h.time)}` : ''}</span>
                      <span className="font-bold text-slate-700 font-sans">{h.workerName || 'Worker'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 font-bold text-[10px] text-slate-800">
                        {h.newStatus || h.status}
                      </span>
                      {h.paidAmount && (
                        <span className="text-emerald-600 font-bold text-[11px]">Paid: ₹{h.paidAmount}</span>
                      )}
                      {h.meterReading && (
                        <span className="text-slate-600 font-mono text-[10px]">Reading: {h.meterReading}</span>
                      )}
                    </div>
                    {h.remarks && (
                      <p className="text-[11px] text-slate-600 mt-1 italic">{h.remarks}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox Preview */}
      {showPhotoPreview && photoDataUrl && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowPhotoPreview(false)}
        >
          <div className="relative max-w-xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowPhotoPreview(false)}
              className="absolute -top-10 right-0 p-1 text-white hover:text-slate-300 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={photoDataUrl}
              alt="Evidence Preview"
              referrerPolicy="no-referrer"
              className="w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-slate-700"
            />
          </div>
        </div>
      )}
    </div>
  );
};
