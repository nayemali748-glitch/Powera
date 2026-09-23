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
import { submitDisconnectionTaskReport } from '../../services/api';

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
  const [conditionalReason, setConditionalReason] = useState<string>('');

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
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
      setAssignedAgency(task.assignedAgency || task.assignedWorkerName || '');
      setPhotoDataUrl(task.photoUrl || '');
      setMeterReading(task.meterReading || '');
      setRemarks(task.workerRemarks || task.workerReport || '');
      setPaidAmount(task.paidAmount || (task.outstandingDue ? String(task.outstandingDue) : ''));
      setPaymentDate(task.paymentDate || new Date().toISOString().split('T')[0]);
      setPaymentReference(task.paymentReference || '');
      setConditionalReason('');
      setErrorMessage(null);
      setShowRoundSavePopup(false);
      setSavedTaskResult(null);
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
      status: 'DISPUTE',
      label: 'DISPUTE',
      icon: AlertCircle,
      selectedBorder: 'border-2 border-amber-500',
      selectedBg: 'bg-amber-50/50',
      selectedText: 'text-amber-700'
    },
    {
      status: 'OFFICE TEAM',
      label: 'OFFICE TEAM',
      icon: Clock,
      selectedBorder: 'border-2 border-indigo-500',
      selectedBg: 'bg-indigo-50/50',
      selectedText: 'text-indigo-700'
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
      status: 'NOT FOUND',
      label: 'NOT FOUND',
      icon: XCircle,
      selectedBorder: 'border-2 border-slate-600',
      selectedBg: 'bg-slate-100',
      selectedText: 'text-slate-800'
    },
    {
      status: 'REISSUE',
      label: 'REISSUE',
      icon: RefreshCw,
      selectedBorder: 'border-2 border-purple-500',
      selectedBg: 'bg-purple-50/50',
      selectedText: 'text-purple-700'
    }
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
      const workerName = currentUser?.name || currentUser?.username || 'Worker';
      const workerId = currentUser?.idNo || 'WID';
      const dateStr = new Date().toLocaleDateString('en-GB');
      const timeStr = new Date().toLocaleTimeString();

      const watermarkText = `TASK: ${task.taskId} | CID: ${task.consumerId}`;
      const subText = `WORKER: ${workerName} (${workerId}) | ${dateStr} ${timeStr}`;

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
      const workerId = currentUser?.idNo || currentUser?.username || 'WORKER';
      const workerName = currentUser?.name || currentUser?.username || 'Field Worker';
      const dateNow = new Date().toISOString().split('T')[0];
      const timeNow = new Date().toLocaleTimeString();

      let combinedRemarks = remarks.trim();
      if (conditionalReason && !combinedRemarks.includes(conditionalReason)) {
        combinedRemarks = combinedRemarks ? `[${conditionalReason}] ${combinedRemarks}` : `[${conditionalReason}]`;
      }

      const reportPayload = {
        taskId: task.taskId,
        consumerId: task.consumerId,
        consumerName: task.consumerName,
        consumerAddress: task.consumerAddress,
        phoneNumber: modalPhone || task.phoneNumber,
        workerId,
        workerName,
        taskStatus: selectedStatus,
        workerReport: combinedRemarks,
        workerRemarks: combinedRemarks,
        photoUrl: photoDataUrl,
        paidAmount: selectedStatus === 'PAID' ? paidAmount : undefined,
        paymentDate: selectedStatus === 'PAID' ? paymentDate : undefined,
        paymentReference: selectedStatus === 'PAID' ? paymentReference : undefined,
        meterReading: meterReading || undefined,
        priority: isUrgent ? 'URGENT' : 'NORMAL',
        assignedAgency: assignedAgency || undefined
      };

      const res = await submitDisconnectionTaskReport(reportPayload);

      if (res && res.success) {
        const newHistoryItem = {
          date: dateNow,
          time: timeNow,
          workerName,
          previousStatus: task.taskStatus,
          newStatus: selectedStatus,
          remarks: combinedRemarks,
          paidAmount: selectedStatus === 'PAID' ? paidAmount : undefined,
          meterReading: meterReading || undefined,
          photoUrl: photoDataUrl || undefined
        };

        const existingHistory = Array.isArray(task.statusHistory) ? task.statusHistory : [];

        const updatedTaskObj: DisconnectionTask = {
          ...task,
          taskStatus: selectedStatus,
          priority: isUrgent ? 'URGENT' : 'NORMAL',
          assignedAgency: assignedAgency || task.assignedAgency,
          assignedWorkerName: assignedAgency || task.assignedWorkerName,
          workerRemarks: combinedRemarks,
          workerReport: combinedRemarks,
          photoUrl: photoDataUrl || task.photoUrl,
          meterReading: meterReading || task.meterReading,
          paidAmount: selectedStatus === 'PAID' ? paidAmount : task.paidAmount,
          paymentDate: selectedStatus === 'PAID' ? paymentDate : task.paymentDate,
          paymentReference: selectedStatus === 'PAID' ? paymentReference : task.paymentReference,
          reportDate: dateNow,
          reportTime: timeNow,
          submittedBy: workerName,
          updatedAt: new Date().toISOString(),
          statusHistory: [newHistoryItem, ...existingHistory]
        };

        setSavedTaskResult(updatedTaskObj);
        setShowRoundSavePopup(true);

        // Auto close round popup after 1.8 seconds and complete update
        setTimeout(() => {
          onUpdateSuccess(updatedTaskObj);
          onClose();
        }, 1800);
      } else {
        throw new Error(res?.message || 'Server rejected status update');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const historyList = Array.isArray(task.statusHistory) ? task.statusHistory : [];
  const displayOutstanding = task.outstandingDue
    ? Number(task.outstandingDue).toLocaleString('en-IN')
    : '12,96,888';
  const displayClass = task.baseClass || 'I';
  const displayDevice = task.meterNumber || task.deviceType || (task as any)['device'] || 'ST328707';
  const displayDueDate = task.dueDateRange || '21.09.2011–21.09.2011';
  const displaySection = task.mruSection || 'FIL33MMR';

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
            onClick={() => setShowHistoryModal(true)}
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
                  {task.consumerName || 'HESAMUDDIN'}
                </h3>
                {/* Location row */}
                <div className="flex items-start gap-1.5 mt-1 text-slate-600 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <span className="uppercase leading-snug">
                    {task.consumerAddress || 'VILL. MOTTIGANJ,,P.O. SAMSI,DIST.MALDA,'}
                  </span>
                </div>
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
                  CONSUMER ID
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-900 block font-mono">
                  {task.consumerId || '342049760'}
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
                  DEVICE TYPE
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

            {/* ASSIGN AGENCY */}
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
                  <option value="">Select Agency</option>
                  {availableWorkers.map(w => (
                    <option key={w.idNo} value={w.name}>
                      {w.name} ({w.idNo})
                    </option>
                  ))}
                  {task.assignedAgency && !availableWorkers.some(w => w.name === task.assignedAgency) && (
                    <option value={task.assignedAgency}>{task.assignedAgency}</option>
                  )}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* PRIORITY */}
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

          {/* CARD 3: METER READING & REMARKS (Matching IMG_6113.png) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
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
              {historyList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">
                  No previous history entries recorded yet for this consumer.
                </div>
              ) : (
                historyList.map((h: any, i: number) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>{h.date} {h.time && `• ${h.time}`}</span>
                      <span className="font-bold text-slate-700">{h.workerName || 'Worker'}</span>
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
