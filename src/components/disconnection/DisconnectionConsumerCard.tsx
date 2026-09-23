import React, { useState } from 'react';
import {
  Zap,
  MapPin,
  Phone,
  Calendar,
  History,
  Edit3,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { DisconnectionTask } from '../../types';

interface DisconnectionConsumerCardProps {
  task: DisconnectionTask;
  onUpdateStatus: (task: DisconnectionTask) => void;
  lang?: 'en' | 'bn';
}

export const DisconnectionConsumerCard: React.FC<DisconnectionConsumerCardProps> = ({
  task,
  onUpdateStatus,
  lang = 'en'
}) => {
  const isUrgent = String(task.priority || '').toUpperCase() === 'URGENT';
  const rawStatus = String(task.taskStatus || 'PENDING').toUpperCase();

  // Status mapping matching IMG_6111.png pill format
  const getStatusDisplay = () => {
    switch (rawStatus) {
      case 'DISCONNECT':
      case 'COMPLETED':
        return {
          text: 'disconnected',
          badgeClass: 'bg-rose-50 text-rose-600 border border-rose-200/60'
        };
      case 'ALREADY DISCONNECTED':
        return {
          text: 'already disconnected',
          badgeClass: 'bg-zinc-100 text-zinc-700 border border-zinc-200/60'
        };
      case 'PAID':
        return {
          text: 'paid',
          badgeClass: 'bg-teal-50 text-teal-700 border border-teal-200/60'
        };
      case 'DISPUTE':
        return {
          text: 'dispute',
          badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200/60'
        };
      case 'OFFICE TEAM':
        return {
          text: 'office team',
          badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
        };
      case 'NOT FOUND':
        return {
          text: 'not found',
          badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200/60'
        };
      case 'REISSUE':
        return {
          text: 'reissue',
          badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200/60'
        };
      case 'PENDING':
      default:
        return {
          text: 'connected',
          badgeClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
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
  const displayId = task.consumerId || task.accountNumber || task.serialNumber || '342049760';

  // Section badge (e.g. FIL33MMR or MRU Section or Feeder)
  const sectionCode = task.mruSection || task.cccFeeder || (task as any)['sectionCode'] || 'FIL33MMR';

  // Class and Device
  const displayClass = task.baseClass || 'I';
  const displayDevice = task.meterNumber || task.deviceType || (task as any)['device'] || 'ST328707';

  // Reliable phone number extractor matching IMG_6111.png (checks all possible property names, excel formats, and address fallbacks)
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

    // Secondary fallback: check if 10-digit Indian phone number is embedded in address or remarks
    const addressOrRemarks = `${task.consumerAddress || ''} ${(task as any).address || ''} ${task.disconnectionReason || ''} ${task.workerRemarks || ''}`;
    const match = addressOrRemarks.match(/(?:^|\D)([6-9]\d{9})(?:\D|$)/);
    if (match && match[1]) {
      return match[1];
    }

    return '';
  })();

  return (
    <div
      className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 space-y-4 relative"
      id={`consumer-card-${task.taskId || task.consumerId}`}
    >
      {/* 1. Header: Consumer Name (Left) & Status pill (Right) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">
            {task.consumerName || 'HESAMUDDIN'}
          </h3>
          {isUrgent && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
              <Flame className="w-3 h-3 text-red-500 fill-red-500" />
              <span>URGENT</span>
            </span>
          )}
        </div>

        {/* Status Pill Badge (e.g. connected in soft green) */}
        <span
          className={`shrink-0 rounded-full px-3.5 py-1 text-xs font-semibold lowercase transition-colors ${status.badgeClass}`}
        >
          {status.text}
        </span>
      </div>

      {/* 2. ID row: ID: 342049760 ⚡ Live 🕒 + Right subtle capsule */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-xs sm:text-sm">
          <div className="flex items-center gap-1 font-bold">
            <span className="text-slate-500">ID:</span>
            <span className="text-slate-800 tracking-wide">{displayId}</span>
          </div>

          {/* Live indicator with lightning bolt */}
          <span className="inline-flex items-center gap-1 text-blue-500 font-semibold text-xs">
            <Zap className="w-3.5 h-3.5 fill-blue-500 text-blue-500" />
            <span>Live</span>
          </span>

          {/* History Clock Icon */}
          <button 
            type="button" 
            title="History" 
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
          </button>

          {/* Auto SL tag if available */}
          {task.serialNumber && (
            <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              {task.serialNumber}
            </span>
          )}
        </div>

        {/* Subtle pill indicator on far right matching screenshot */}
        <div className="w-7 h-2 rounded-full border border-slate-200 bg-slate-50 shrink-0"></div>
      </div>

      {/* 3. Section / Feeder Pill badge (e.g. FIL33MMR, FIL60MMR) */}
      <div>
        <span className="inline-block px-3 py-0.5 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-full uppercase tracking-wider">
          {sectionCode}
        </span>
      </div>

      {/* 4. Details with outline icons */}
      <div className="space-y-3 pt-1">
        {/* Location / Address */}
        <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span className="uppercase leading-snug">
            {task.consumerAddress || 'VILL. MOTTIGANJ,,P.O. SAMSI,DIST.MALDA,'}
          </span>
        </div>

        {/* Phone number (shown with phone icon and blue clickable link matching IMG_6111.png) */}
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
        <div className="flex items-start gap-2.5">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-slate-800 font-medium text-xs sm:text-sm">
              {task.dueDateRange || '21.09.2011–21.09.2011'}
            </div>
            <div className="text-slate-400 text-xs mt-0.5">
              Due Date Range
            </div>
          </div>
        </div>
      </div>

      {/* 5. Class & Device Row */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-slate-700 pt-2 border-t border-slate-100">
        <div>
          <span className="text-slate-500">Class: </span>
          <span className="font-semibold text-slate-800">{displayClass}</span>
        </div>
        <div>
          <span className="text-slate-500">Device: </span>
          <span className="font-semibold text-slate-800">{displayDevice}</span>
        </div>
      </div>

      {/* Observation or Site Evidence (if recorded by worker) */}
      {(task.workerRemarks || task.photoUrl || task.meterReading) && (
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
          {task.meterReading && (
            <div className="text-[11px] text-slate-600">
              <span className="font-bold text-slate-800">Meter Reading:</span> {task.meterReading}
            </div>
          )}
          {task.workerRemarks && (
            <div className="text-[11px] text-slate-600">
              <span className="font-bold text-slate-800">Observation:</span> {task.workerRemarks}
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

      {/* 6. Action Button: Full-width Dark Navy / Black Update Status Button */}
      <div className="pt-1">
        <button
          id={`update-status-btn-${task.taskId || task.consumerId}`}
          onClick={() => onUpdateStatus(task)}
          className="w-full py-3 px-4 bg-[#0f172a] hover:bg-slate-800 active:scale-[0.99] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <Edit3 className="w-4 h-4 text-white" />
          <span>Update Status</span>
        </button>
      </div>
    </div>
  );
};
