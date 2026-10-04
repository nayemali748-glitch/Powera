import React, { useState } from 'react';
import {
  Zap,
  MapPin,
  Phone,
  Calendar,
  Edit3,
  Flame,
  Trash2,
  Loader2,
  Lock,
  RotateCcw,
  MessageSquareWarning,
  CheckCircle2
} from 'lucide-react';
import { DisconnectionTask } from '../../types';
import {
  getTaskPhase,
  getReissueLockState,
  cleanDisconnectionNotes,
  cleanWorkerOrAgencyName
} from '../../utils/disconnectionClassifier';

interface DisconnectionConsumerCardProps {
  task: DisconnectionTask;
  onUpdateStatus: (task: DisconnectionTask) => void;
  onRequestReissue?: (task: DisconnectionTask) => Promise<void> | void;
  onApproveReissue?: (task: DisconnectionTask) => Promise<void> | void;
  isAdmin?: boolean;
  onDeleteTask?: (task: DisconnectionTask) => Promise<void> | void;
  lang?: 'en' | 'bn';
}

export const DisconnectionConsumerCard: React.FC<DisconnectionConsumerCardProps> = ({
  task,
  onUpdateStatus,
  onRequestReissue,
  onApproveReissue,
  isAdmin = false,
  onDeleteTask,
  lang = 'en'
}) => {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingReissue, setIsSendingReissue] = useState(false);
  const [isApprovingReissue, setIsApprovingReissue] = useState(false);

  const isUrgent = String(task.priority || '').toUpperCase() === 'URGENT';
  const rawStatus = String(task.taskStatus || task.disconStatus || (task as any)['Discon Status'] || 'PENDING').trim().toUpperCase();
  const phaseType = getTaskPhase(task);
  const lockState = getReissueLockState(task);
  const cleanRemarks = cleanDisconnectionNotes(task.workerRemarks || task.workerReport || task.notes || (task as any)['Notes']);
  const agencyOrWorkerName = cleanWorkerOrAgencyName(
    task.assignedAgency ||
    task.Agency ||
    (task as any).agency ||
    (task as any)['Agency Name'] ||
    task.assignedWorkerName ||
    (task as any)['Worker Name'] ||
    task.submittedBy ||
    ''
  );

  // Status mapping matching Set Status options
  const getStatusDisplay = () => {
    switch (rawStatus) {
      case 'DISCONNECT':
      case 'DISCONNECTED':
      case 'COMPLETED':
        return {
          text: 'Disconnect',
          badgeClass: 'bg-rose-50 text-rose-600 border border-rose-200/80'
        };
      case 'ALREADY DISCONNECTED':
        return {
          text: 'Already Disconnected',
          badgeClass: 'bg-zinc-100 text-zinc-700 border border-zinc-200/80'
        };
      case 'PAID':
        return {
          text: 'Paid',
          badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
        };
      case 'DISPUTE':
        return {
          text: 'Dispute',
          badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200/80'
        };
      case 'OFFICE TEAM':
        return {
          text: 'Office Team',
          badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
        };
      case 'NOT FOUND':
        return {
          text: 'Not Found',
          badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200/80'
        };
      case 'REISSUE':
        return {
          text: 'Reissue',
          badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200/80'
        };
      case 'PENDING':
      default:
        return {
          text: 'Connected',
          badgeClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200/80'
        };
    }
  };

  const status = getStatusDisplay();

  // Formatted Indian Currency
  const formattedDues = (() => {
    if (!task.outstandingDue) return '₹0.00';
    const cleanStr = String(task.outstandingDue).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    if (isNaN(num)) return `₹${task.outstandingDue}`;
    return `₹${num.toLocaleString('en-IN')}`;
  })();

  // Display Consumer ID or Serial Number or Fallback
  const displayId = task.consumerId || task.accountNumber || task.serialNumber || 'N/A';

  // Device / Meter
  const displayDevice = task.meterNumber || task.deviceType || (task as any)['device'] || (task as any)['Number'] || (task as any)['Device'] || phaseType;

  // Reliable phone number extractor
  const displayPhone = (() => {
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
      (task as any)['MOB_NO'],
      (task as any)['Phone'],
      (task as any)['Phone No'],
      (task as any)['Phone Number'],
      (task as any)['Contact'],
      (task as any)['Contact No'],
      (task as any)['মোবাইল'],
      (task as any)['ফোন']
    ];

    for (const val of directCandidates) {
      if (val !== undefined && val !== null) {
        let str = String(val).trim();
        str = str.replace(/\.0+$/, '');
        if (/^\d+\.?\d*e[+-]?\d+$/i.test(str)) {
          const num = Number(str);
          if (!isNaN(num)) str = Math.round(num).toString();
        }
        if (
          str &&
          str.toLowerCase() !== 'null' &&
          str.toLowerCase() !== 'undefined' &&
          str.toLowerCase() !== 'n/a' &&
          str !== '-'
        ) {
          return str;
        }
      }
    }

    const addressOrRemarks = `${task.consumerAddress || ''} ${(task as any).address || ''} ${task.disconnectionReason || ''} ${cleanRemarks || ''}`;
    const match = addressOrRemarks.match(/(?:^|\D)([6-9]\d{9})(?:\D|$)/);
    if (match && match[1]) {
      return match[1];
    }

    return '';
  })();

  const consumerAddressText = task.consumerAddress || (task as any)['Address'] || '';
  const dueDateRangeText = task.dueDateRange || (task as any)['O/S Duedate Range'] || '';

  const handleConfirmDelete = async () => {
    if (!onDeleteTask || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDeleteTask(task);
    } finally {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const handleWorkerRequestReissue = async () => {
    if (!onRequestReissue || isSendingReissue) return;
    setIsSendingReissue(true);
    try {
      await onRequestReissue(task);
    } finally {
      setIsSendingReissue(false);
    }
  };

  const handleAdminApproveReissue = async () => {
    if (!onApproveReissue || isApprovingReissue) return;
    setIsApprovingReissue(true);
    try {
      await onApproveReissue(task);
    } finally {
      setIsApprovingReissue(false);
    }
  };

  return (
    <div
      className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 space-y-4 relative w-full max-w-full overflow-hidden box-border"
      id={`consumer-card-${task.taskId || task.consumerId}`}
    >
      {/* 1. Header: Consumer Name + ID (Left) & Status pill + Agency/Worker Name underneath (Right) */}
      <div className="flex items-start justify-between gap-2.5 min-w-0">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase break-words">
              {task.consumerName || (task as any)['Name'] || 'Consumer'}
            </h3>
            {isUrgent && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                <Flame className="w-3 h-3 text-red-500 fill-red-500" />
                <span>URGENT</span>
              </span>
            )}
          </div>

          {/* 2. Consumer ID row + Live indicator */}
          <div className="flex items-center gap-2 text-xs sm:text-sm flex-wrap">
            <div className="flex items-center gap-1 font-bold">
              <span className="text-slate-500">ID:</span>
              <span className="text-slate-800 tracking-wide">{displayId}</span>
            </div>

            {/* Live indicator with lightning bolt */}
            <span className="inline-flex items-center gap-1 text-blue-500 font-semibold text-xs">
              <Zap className="w-3.5 h-3.5 fill-blue-500 text-blue-500" />
              <span>Live</span>
            </span>
          </div>
        </div>

        {/* Status Pill Badge + Small Agency/Worker Name underneath */}
        <div className="flex flex-col items-end shrink-0">
          <span
            className={`rounded-full px-3.5 py-1 text-xs font-bold transition-colors ${status.badgeClass}`}
          >
            {status.text}
          </span>
          {agencyOrWorkerName && (
            <span className="text-[11px] font-semibold text-slate-500 mt-1 text-right leading-tight">
              {agencyOrWorkerName}
            </span>
          )}
        </div>
      </div>

      {/* 4. Details with outline icons */}
      <div className="space-y-3 pt-1">
        {/* Location / Address */}
        {consumerAddressText && (
          <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span className="uppercase leading-snug">
              {consumerAddressText}
            </span>
          </div>
        )}

        {/* Phone number */}
        <div className="flex items-center gap-2.5 text-xs sm:text-sm">
          <Phone className="w-4 h-4 text-slate-400 shrink-0" />
          {displayPhone ? (
            <a
              href={`tel:${displayPhone}`}
              onClick={e => e.stopPropagation()}
              className="text-blue-600 font-medium hover:underline tracking-wide"
            >
              {displayPhone}
            </a>
          ) : (
            <span className="text-slate-400 italic text-xs">
              {lang === 'bn' ? 'মোবাইল নম্বর নেই' : 'No mobile number'}
            </span>
          )}
        </div>

        {/* Outstanding Dues */}
        <div className="flex items-start gap-2.5">
          <div className="w-4 flex justify-center text-slate-400 font-semibold text-sm shrink-0 mt-0.5">
            ₹
          </div>
          <div>
            <div className="text-rose-600 font-bold text-sm sm:text-base tracking-tight">
              {formattedDues}
            </div>
            <div className="text-slate-400 text-xs mt-0.5">
              Outstanding Dues (Issued for Disconnection)
            </div>
          </div>
        </div>

        {/* Due Date Range */}
        {dueDateRangeText && (
          <div className="flex items-start gap-2.5">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-slate-800 font-medium text-xs sm:text-sm">
                {dueDateRangeText}
              </div>
              <div className="text-slate-400 text-xs mt-0.5">
                Due Date Range
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Device / Meter Row */}
      {displayDevice && (
        <div className="flex items-center justify-between text-xs sm:text-sm text-slate-700 pt-2 border-t border-slate-100">
          <div>
            <span className="text-slate-500">Device / Meter: </span>
            <span className="font-semibold text-slate-800">{displayDevice}</span>
          </div>
        </div>
      )}

      {/* Observation or Site Evidence (if recorded by worker) */}
      {(cleanRemarks || task.photoUrl || task.meterReading) && (
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
          {task.meterReading && (
            <div className="text-[11px] text-slate-600">
              <span className="font-bold text-slate-800">Meter Reading:</span> {task.meterReading}
            </div>
          )}
          {cleanRemarks && (
            <div className="text-[11px] text-slate-600">
              <span className="font-bold text-slate-800">Observation:</span> {cleanRemarks}
            </div>
          )}
          {task.photoUrl && (
            <div className="flex items-center gap-2 pt-1">
              <img
                src={task.photoUrl}
                alt="Site Evidence"
                referrerPolicy="no-referrer"
                className="w-10 h-10 object-cover rounded-lg border border-slate-300"
              />
              <span className="text-[10px] text-emerald-700 font-bold">Photo Evidence Attached</span>
            </div>
          )}
        </div>
      )}

      {/* Re-issue Status Banner on Card */}
      {lockState.isReissueRequested && (
        <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquareWarning className="w-4 h-4 text-purple-600 shrink-0" />
            <div className="text-[11px] text-purple-900 leading-tight">
              <span className="font-black block">
                {lang === 'bn' ? 'Re-issue রিকোয়েস্ট পাঠানো হয়েছে' : 'Re-issue Request Pending'}
              </span>
              <span className="text-purple-700">
                {lang === 'bn'
                  ? `কর্মী: ${lockState.requestedBy}`
                  : `Requested by ${lockState.requestedBy}`}
              </span>
            </div>
          </div>
          {isAdmin && onApproveReissue && (
            <button
              type="button"
              onClick={handleAdminApproveReissue}
              disabled={isApprovingReissue}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[11px] font-black shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              {isApprovingReissue ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>{lang === 'bn' ? 'Re-issue করুন' : 'Approve Re-issue'}</span>
            </button>
          )}
        </div>
      )}

      {!isAdmin && lockState.isReissueApproved && !lockState.isReissueRequested && (
        <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-[11px] font-bold text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {lang === 'bn'
              ? 'অ্যাডমিন Re-issue করেছেন — আপনি আবার ১ বার স্ট্যাটাস আপডেট করতে পারবেন'
              : 'Re-issued by Admin — You can update status once'}
          </span>
        </div>
      )}

      {/* 6. Action Buttons: Update Status + Delete Button */}
      {confirmingDelete && onDeleteTask ? (
        <div className="pt-1 bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-red-800 text-center">
            {lang === 'bn'
              ? `কনজিউমার #${displayId} ব্যাকএন্ড শিট থেকে চিরতরে মুছে ফেলবেন?`
              : `Permanently delete Consumer #${displayId} from Backend Sheet?`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={isDeleting}
              className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold cursor-pointer"
            >
              {lang === 'bn' ? 'বাতিল (Cancel)' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{lang === 'bn' ? 'ডিলিট হচ্ছে...' : 'Deleting...'}</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'হ্যাঁ, পুরো ডিলিট করুন' : 'Yes, Delete Forever'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-1 flex items-center gap-2">
          {!isAdmin && lockState.isLockedForWorker ? (
            lockState.isReissueRequested ? (
              <button
                type="button"
                disabled
                className="flex-1 py-3 px-4 bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 opacity-90 cursor-not-allowed"
              >
                <Lock className="w-4 h-4 text-purple-600 shrink-0" />
                <span>
                  {lang === 'bn'
                    ? 'অ্যাডমিন Re-issue অনুমোদনের অপেক্ষায়...'
                    : 'Waiting for Admin Re-issue...'}
                </span>
              </button>
            ) : (
              <button
                id={`request-reissue-btn-${task.taskId || task.consumerId}`}
                type="button"
                onClick={handleWorkerRequestReissue}
                disabled={isSendingReissue}
                className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-60"
              >
                {isSendingReissue ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                ) : (
                  <RotateCcw className="w-4 h-4 text-white shrink-0" />
                )}
                <span>
                  {lang === 'bn'
                    ? 'পুনরায় আপডেট করতে Re-issue রিকোয়েস্ট পাঠান'
                    : 'Request Re-issue to Update Again'}
                </span>
              </button>
            )
          ) : (
            <button
              id={`update-status-btn-${task.taskId || task.consumerId}`}
              onClick={() => onUpdateStatus(task)}
              className="flex-1 py-3 px-4 bg-[#0f172a] hover:bg-slate-800 active:scale-[0.99] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Edit3 className="w-4 h-4 text-white" />
              <span>Update Status</span>
            </button>
          )}

          {onDeleteTask && (
            <button
              id={`delete-consumer-btn-${task.taskId || task.consumerId}`}
              type="button"
              onClick={() => setConfirmingDelete(true)}
              title="Delete Consumer"
              aria-label="Delete Consumer"
              className="py-3 px-3.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-red-600 rounded-xl text-sm font-bold flex items-center justify-center transition-all cursor-pointer shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

