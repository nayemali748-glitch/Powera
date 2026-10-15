import React, { useState, useEffect } from 'react';
import {
  Zap,
  X,
  Search,
  Printer,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building2,
  FileText,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { DisconnectionTask } from '../../types';

interface LiveOutstandingModalProps {
  task: DisconnectionTask;
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'bn';
}

interface LiveCheckResult {
  liveConnected: boolean;
  consumerId: string;
  consumerName?: string;
  mru?: string;
  ccc?: string;
  outstandingAmount?: number;
  lpscAmount?: number;
  totalDueAmount?: number;
  connectionStatus?: string;
  lastCheckedAt?: string;
  message?: string;
  requiresConfig?: boolean;
}

export const LiveOutstandingModal: React.FC<LiveOutstandingModalProps> = ({
  task,
  isOpen,
  onClose,
  lang = 'en'
}) => {
  const initialConsumerId = String(
    task.consumerId || (task as any)['Consumer Id'] || (task as any)['Consumer ID'] || task.taskId || ''
  ).replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-)/i, '').replace(/\.0+$/, '').trim();

  const [consumerId, setConsumerId] = useState<string>(initialConsumerId);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LiveCheckResult | null>(null);

  useEffect(() => {
    setConsumerId(initialConsumerId);
    setError(null);
    setResult(null);
  }, [initialConsumerId, isOpen]);

  if (!isOpen) return null;

  const handleCheckOutstanding = async () => {
    const cleanId = consumerId.replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-)/i, '').replace(/\.0+$/, '').replace(/[, \-_]/g, '').trim();
    if (!cleanId) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে সঠিক উপভোক্তা আইডি (Consumer ID) লিখুন।' : 'Please enter a valid Consumer ID.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const res = await fetch('/api/wbsedcl/live-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerId: cleanId }),
        signal: controller.signal
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => null);

      if (!res.ok && data?.error) {
        throw new Error(data.error);
      }

      if (data) {
        setResult(data);
        if (!data.liveConnected && data.message) {
          // If live credentials are not configured, result is displayed with official guidance
          setError(data.message);
        }
      } else {
        throw new Error('No response from live verification server');
      }
    } catch (err: any) {
      setError(err?.name === 'AbortError'
        ? (lang === 'bn' ? 'অনুরোধের সময় শেষ হয়ে গেছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।' : 'Request timed out. Please try again.')
        : (err?.message || (lang === 'bn' ? 'লাইভ ডেটা লোড করতে ব্যর্থ হয়েছে।' : 'Failed to retrieve live data.'))
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSlip = () => {
    const cId = consumerId || initialConsumerId;
    const name = result?.consumerName || task.consumerName || (task as any)['Name'] || 'Consumer';
    const mru = result?.mru || task.mru || (task as any)['MRU'] || task.mruSection || 'N/A';
    const ccc = result?.ccc || (task as any)['off_code'] || 'WBSEDCL CCC';
    const osd = result?.outstandingAmount !== undefined ? `₹${result.outstandingAmount.toLocaleString('en-IN')}` : (task.outstandingDue || '₹0');
    const lpsc = result?.lpscAmount !== undefined ? `₹${result.lpscAmount.toLocaleString('en-IN')}` : '₹0';
    const totalDue = result?.totalDueAmount !== undefined ? `₹${result.totalDueAmount.toLocaleString('en-IN')}` : osd;
    const connStatus = result?.connectionStatus || task.disconStatus || task.taskStatus || 'CONNECTED';
    const checkedAt = result?.lastCheckedAt ? new Date(result.lastCheckedAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');

    const slipContent = `
========================================
   WBSEDCL - LIVE OUTSTANDING & LPSC SLIP
========================================
Date & Time       : ${checkedAt}
Consumer ID       : ${cId}
Consumer Name     : ${name}
Office / CCC      : ${ccc}
MRU Section       : ${mru}
Connection Status : ${connStatus}
----------------------------------------
Outstanding (OSD) : ${osd}
LPSC Surcharge    : ${lpsc}
----------------------------------------
TOTAL DUE AMOUNT  : ${totalDue}
========================================
* WBSEDCL Utility Management System *
    `.trim();

    const blob = new Blob([slipContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `WBSEDCL_Due_Slip_${cId}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const displayName = result?.consumerName || task.consumerName || (task as any)['Name'] || '—';
  const displayMru = result?.mru || task.mru || (task as any)['MRU'] || task.mruSection || '—';
  const displayOffice = result?.ccc || (task as any)['off_code'] || (task as any)['office'] || '—';
  const displayConnStatus = result?.connectionStatus || task.disconStatus || task.taskStatus || 'CONNECTED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-live-check-title"
      >
        {/* Header with Lightning Bolt badge */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 fill-blue-400 text-blue-400" />
            </div>
            <div>
              <h2 id="modal-live-check-title" className="text-sm font-black tracking-wide uppercase flex items-center gap-2">
                <span>{lang === 'bn' ? 'লাইভ বকেয়া ও এলপিএসসি যাচাই' : 'Live Outstanding & LPSC Check'}</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500 text-slate-950">
                  WBSEDCL
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {lang === 'bn' ? 'রিয়েল-টাইম বকেয়া বিল ও লেট পেমেন্ট সার্চার্জ' : 'Real-time Outstanding Due & Late Payment Surcharge verification'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Consumer ID input & Check Action */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              {lang === 'bn' ? '১. উপভোক্তা আইডি (Consumer ID)' : '1. Consumer ID'}
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={consumerId}
                  onChange={e => {
                    setConsumerId(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. 1020304050"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all tracking-wider"
                />
              </div>
              <button
                type="button"
                onClick={handleCheckOutstanding}
                disabled={isLoading}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === 'bn' ? 'যাচাই হচ্ছে...' : 'Checking...'}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white text-white" />
                    <span>{lang === 'bn' ? 'যাচাই করুন' : 'CHECK OUTSTANDING'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <strong className="font-bold">{lang === 'bn' ? 'বিজ্ঞপ্তি: ' : 'Notice: '}</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 font-semibold block">
                  {lang === 'bn' ? 'উপভোক্তার নাম' : 'Consumer Name'}
                </span>
                <span className="font-bold text-slate-900 block truncate" title={displayName}>
                  {displayName}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-semibold block">
                  {lang === 'bn' ? 'MRU / সেকশন' : 'MRU / Section'}
                </span>
                <span className="font-bold text-slate-900 block">
                  {displayMru}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-semibold block">
                  {lang === 'bn' ? 'অফিস / CCC' : 'Office / CCC'}
                </span>
                <span className="font-bold text-slate-900 block">
                  {displayOffice}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-semibold block">
                  {lang === 'bn' ? 'কানেকশন স্ট্যাটাস' : 'Connection Status'}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-200 text-slate-800 uppercase">
                  {displayConnStatus}
                </span>
              </div>
            </div>

            {/* Live Financial Breakdown */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">
                  {lang === 'bn' ? 'বকেয়া বিল (Outstanding / OSD):' : 'Outstanding / OSD Amount:'}
                </span>
                <span className="font-bold text-slate-900">
                  {result?.outstandingAmount !== undefined
                    ? `₹${result.outstandingAmount.toLocaleString('en-IN')}`
                    : (task.outstandingDue ? `₹${task.outstandingDue}` : '—')}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">
                  {lang === 'bn' ? 'লেট পেমেন্ট চার্জ (LPSC):' : 'Late Payment Surcharge (LPSC):'}
                </span>
                <span className="font-bold text-amber-700">
                  {result?.lpscAmount !== undefined
                    ? `₹${result.lpscAmount.toLocaleString('en-IN')}`
                    : '₹0 (Check Live)'}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block uppercase">
                    {lang === 'bn' ? 'সর্বমোট প্রদেয় বকেয়া (Total Due):' : 'Total Due Amount:'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {lang === 'bn' ? '* LPSC সমন্বয়সহ অফিসিয়াল মানদণ্ড' : '* Official WBSEDCL standard with LPSC rule'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base sm:text-lg font-black text-rose-600">
                    {result?.totalDueAmount !== undefined
                      ? `₹${result.totalDueAmount.toLocaleString('en-IN')}`
                      : (task.outstandingDue ? `₹${task.outstandingDue}` : '₹0')}
                  </span>
                </div>
              </div>
            </div>

            {/* Last Checked Date & Time */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{lang === 'bn' ? 'সর্বশেষ যাচাই:' : 'Last Checked:'}</span>
              </div>
              <span className="font-bold text-slate-700">
                {result?.lastCheckedAt
                  ? new Date(result.lastCheckedAt).toLocaleString('en-IN')
                  : new Date().toLocaleDateString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Footer with PRINT, DOWNLOAD and CLOSE */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Print Bill Slip"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'প্রিন্ট' : 'PRINT'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSlip}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Download Statement Slip"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'ডাউনলোড' : 'DOWNLOAD'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
          >
            {lang === 'bn' ? 'বন্ধ করুন' : 'CLOSE'}
          </button>
        </div>
      </div>
    </div>
  );
};
