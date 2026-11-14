import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import {
  Receipt,
  X,
  Printer,
  Download,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  Phone,
  Zap,
  ShieldCheck,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { DisconnectionTask } from '../../types';
import { cleanAndNormalizeConsumerId } from '../../utils/consumerId';
import { cleanDisconnectionNotes, cleanWorkerOrAgencyName } from '../../utils/disconnectionClassifier';
import { formatDateDDMMYYYY, formatTime12Hour, getNowDateDDMMYYYY, getNowTime12Hour } from '../../utils/dateTimeFormat';

interface PaymentReceiptModalProps {
  task: DisconnectionTask;
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'bn';
}

interface LiveWbsedclSummary {
  liveConnected: boolean;
  reportType?: string;
  totalDueAmount?: number | null;
  outstandingAmount?: number | null;
  reportingDate?: string;
  lastReadingDate?: string;
  connectionStatus?: string;
}

const WBSEDCL_PAYMENT_RECEIPT_BASE_URL =
  'https://portal.wbsedcl.in/webdynpro/resources/wbsedcl/wbpaymentreceipt/ViewPaymentReceipt?payReceipt=Y';

function parseNumericAmount(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function formatINR(val: number): string {
  return `₹ ${val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  task,
  isOpen,
  onClose,
  lang = 'en'
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveSummary, setLiveSummary] = useState<LiveWbsedclSummary | null>(null);
  const [liveCheckNonce, setLiveCheckNonce] = useState(0);

  const cleanIdForEffect =
    cleanAndNormalizeConsumerId(
      task.consumerId ||
        (task as any)['Consumer Id'] ||
        (task as any)['Consumer ID'] ||
        task.taskId ||
        ''
    ) || String(task.consumerId || task.taskId || '').trim();

  useEffect(() => {
    if (!isOpen || !cleanIdForEffect) {
      setLiveSummary(null);
      setLiveLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    setLiveLoading(true);

    fetch('/api/wbsedcl/live-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consumerId: cleanIdForEffect }),
      signal: controller.signal
    })
      .then(res => res.json().catch(() => null))
      .then(data => {
        if (controller.signal.aborted) return;
        if (data && data.success && data.liveConnected) {
          setLiveSummary({
            liveConnected: true,
            reportType: data.reportType,
            totalDueAmount: data.totalDueAmount ?? data.outstandingAmount ?? null,
            outstandingAmount: data.outstandingAmount ?? null,
            reportingDate: data.reportingDate || '',
            lastReadingDate: data.lastReadingDate || '',
            connectionStatus: data.connectionStatus || ''
          });
        } else {
          setLiveSummary(null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLiveSummary(null);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!controller.signal.aborted) setLiveLoading(false);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [isOpen, cleanIdForEffect, liveCheckNonce]);

  if (!isOpen) return null;

  const cleanId =
    cleanAndNormalizeConsumerId(
      task.consumerId ||
        (task as any)['Consumer Id'] ||
        (task as any)['Consumer ID'] ||
        task.taskId ||
        ''
    ) || String(task.consumerId || task.taskId || '').trim();

  const consumerName = String(
    task.consumerName || (task as any)['Name'] || (task as any)['Consumer Name'] || 'Consumer'
  ).trim();
  const consumerAddress = String(
    task.consumerAddress || (task as any)['Address'] || ''
  ).trim();
  const phone = String(
    task.phoneNumber || task.mobileNumber || (task as any).mobile || ''
  ).trim();
  const mru = String(task.mru || (task as any)['MRU'] || task.mruSection || '').trim();
  const offCode = String(task.offCode || (task as any)['off_code'] || '').trim();
  const meterNo = String(task.meterNumber || (task as any)['Number'] || '').trim();
  const device = String(task.device || task.deviceType || (task as any)['Device'] || '').trim();

  const rawStatus = String(
    task.taskStatus || task.disconStatus || (task as any)['Discon Status'] || 'PENDING'
  )
    .trim()
    .toUpperCase();
  const paymentStatus = String(
    task.paymentStatus || (task as any)['Payment Status'] || (rawStatus === 'PAID' ? 'PAID' : 'PENDING')
  )
    .trim()
    .toUpperCase();

  const isPaid = rawStatus === 'PAID' || paymentStatus === 'PAID';

  const dueAmt = parseNumericAmount(task.outstandingDue ?? (task as any)['D2 Net O/S'] ?? task.arrearAmount);
  const rawPaidAmt = parseNumericAmount(task.paidAmount ?? (task as any)['Paid Amount']);
  const paidAmt = rawPaidAmt > 0 ? rawPaidAmt : isPaid ? dueAmt : 0;

  const rawPaidDate =
    task.paidDate ||
    task.paymentDate ||
    (task as any)['Paid Date'] ||
    task.reportDate ||
    task.disconDate ||
    task.updatedAt ||
    task.createdAt ||
    '';
  const dateDisplay = rawPaidDate ? formatDateDDMMYYYY(rawPaidDate) : getNowDateDDMMYYYY();
  const timeDisplay =
    formatTime12Hour(task.reportTime || task.updatedAt || task.createdAt) || getNowTime12Hour();

  const agencyOrWorker =
    cleanWorkerOrAgencyName(
      task.assignedAgency ||
        task.Agency ||
        (task as any).agency ||
        (task as any)['Agency Name'] ||
        task.assignedWorkerName ||
        (task as any)['Worker Name'] ||
        task.submittedBy ||
        ''
    ) || 'WBSEDCL Field Unit';

  const remarks = cleanDisconnectionNotes(
    task.workerRemarks || task.workerReport || task.notes || (task as any)['Notes'] || ''
  );

  const receiptNo = task.paymentReference || `REC-${cleanId || 'WB'}`;
  const wbsedclPaymentReceiptUrl = cleanId
    ? `${WBSEDCL_PAYMENT_RECEIPT_BASE_URL}&conId=${encodeURIComponent(cleanId)}`
    : WBSEDCL_PAYMENT_RECEIPT_BASE_URL;

  const handleCopyConsumerId = async () => {
    if (!cleanId) return;
    try {
      await navigator.clipboard.writeText(cleanId);
      setCopiedId(true);
      setStatusMessage(
        lang === 'bn'
          ? `কনজিউমার আইডি ${cleanId} কপি করা হয়েছে — পোর্টালে পেস্ট করুন।`
          : `Consumer ID ${cleanId} copied to clipboard.`
      );
      setTimeout(() => {
        setCopiedId(false);
        setStatusMessage(null);
      }, 3000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handlePrintReceipt = () => {
    window.print();
    setStatusMessage(lang === 'bn' ? 'প্রিন্ট ডায়ালগ খোলা হয়েছে।' : 'Print dialog opened.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 34, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('WBSEDCL - POWER OF CONSTRUCTION', 15, 14);
    doc.setFontSize(11);
    doc.setTextColor(110, 231, 183);
    doc.text('DISCONNECTION & ARREAR PAYMENT RECEIPT', 15, 22);
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`Receipt No: ${receiptNo}   |   Date: ${dateDisplay} ${timeDisplay}`, 15, 29);

    let y = 46;
    doc.setTextColor(15, 23, 42);

    const drawRow = (label: string, value: string, highlight = false) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(label, 15, y);

      doc.setFont('helvetica', highlight ? 'bold' : 'normal');
      doc.setTextColor(highlight ? 5 : 15, highlight ? 150 : 23, highlight ? 105 : 42);
      const wrapped = doc.splitTextToSize(value || '—', 120);
      doc.text(wrapped, 75, y);
      y += Math.max(8, wrapped.length * 5.5);
      doc.setDrawColor(226, 232, 240);
      doc.line(15, y - 2, 195, y - 2);
    };

    drawRow('Consumer ID:', cleanId || '—', true);
    drawRow('Consumer Name:', consumerName);
    drawRow('Address:', consumerAddress || '—');
    drawRow('Mobile Number:', phone || '—');
    drawRow('Office / MRU:', `${offCode || 'WBSEDCL'} / ${mru || '—'}`);
    drawRow('Device / Meter No:', `${device || '—'} / ${meterNo || '—'}`);
    drawRow('Issued Arrear Due:', `Rs. ${dueAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    drawRow('Paid Amount:', `Rs. ${paidAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, isPaid);
    drawRow('Payment Status:', isPaid ? 'PAID' : paymentStatus, isPaid);
    drawRow('Disconnection Status:', rawStatus);
    drawRow('Agency / Worker:', agencyOrWorker);
    drawRow('Payment / Report Date:', `${dateDisplay} (${timeDisplay})`);
    if (remarks) {
      drawRow('Remarks / Notes:', remarks);
    }

    y += 8;
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Note: For official WBSEDCL online payment gateway receipt, visit portal.wbsedcl.in (ViewPaymentReceipt).',
      15,
      y
    );

    doc.save(`WBSEDCL_Payment_Receipt_${cleanId || 'Consumer'}.pdf`);
    setStatusMessage(
      lang === 'bn' ? '✓ পেমেন্ট রসিদ PDF ডাউনলোড হয়েছে।' : '✓ Payment Receipt PDF downloaded.'
    );
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const printPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <div className="print-only-report p-6 text-slate-900 bg-white font-sans">
            <div className="border-2 border-slate-900 rounded-xl overflow-hidden max-w-2xl mx-auto">
              <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-black uppercase tracking-wide">
                    WBSEDCL • POWER OF CONSTRUCTION
                  </h1>
                  <p className="text-xs text-emerald-300 font-bold mt-0.5">
                    DISCONNECTION & ARREAR PAYMENT RECEIPT SLIP
                  </p>
                </div>
                <div className="text-right text-xs">
                  <div className="font-mono font-bold">{receiptNo}</div>
                  <div className="text-slate-300">{dateDisplay} • {timeDisplay}</div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-slate-500 block">Consumer ID</span>
                    <strong className="text-sm font-mono">{cleanId || '—'}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Payment Status</span>
                    <strong className={`text-sm font-black ${isPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {isPaid ? 'PAID' : paymentStatus} ({rawStatus})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Consumer Name</span>
                    <strong className="text-sm uppercase">{consumerName}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Mobile Number</span>
                    <strong>{phone || '—'}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Address</span>
                    <strong className="uppercase">{consumerAddress || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">MRU / Office</span>
                    <strong>{mru || '—'} / {offCode || 'WBSEDCL'}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Device / Meter No</span>
                    <strong>{device || '—'} / {meterNo || '—'}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 block">Issued Arrear (D2 Net O/S)</span>
                    <strong className="text-base font-bold text-slate-900">{formatINR(dueAmt)}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Paid Amount</span>
                    <strong className={`text-lg font-black ${isPaid ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {formatINR(paidAmt)}
                    </strong>
                  </div>
                </div>

                <div className="text-xs space-y-1.5">
                  <div>
                    <span className="text-slate-500">Agency / Field Worker: </span>
                    <strong>{agencyOrWorker}</strong>
                  </div>
                  {remarks && (
                    <div>
                      <span className="text-slate-500">Remarks: </span>
                      <span>{remarks}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-dashed border-slate-300 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Generated via POWER Field Utility App</span>
                  <span>Official Online Receipt: portal.wbsedcl.in</span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {printPortal}
      <div
        className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-150 print:hidden"
        onClick={onClose}
      >
        <div
          className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] animate-in zoom-in-95 duration-150 font-sans"
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-receipt-modal-title"
        >
          {/* Modal Top Header */}
          <div className="px-4 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h2 id="payment-receipt-modal-title" className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2 truncate">
                  <span>{lang === 'bn' ? 'পেমেন্ট রসিদ (Payment Receipt)' : 'Payment Receipt'}</span>
                </h2>
                <p className="text-[11px] text-slate-300 font-mono truncate">
                  ID: {cleanId || '—'} • {receiptNo}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Close Payment Receipt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
            {statusMessage && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Official WBSEDCL Payment Receipt Portal Verification Card */}
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-emerald-950">
                      {lang === 'bn'
                        ? 'WBSEDCL অফিসিয়াল পেমেন্ট রসিদ ও হিস্ট্রি পোর্টাল'
                        : 'WBSEDCL Official Payment History & Receipt'}
                    </h3>
                    <p className="text-[11px] text-emerald-800 leading-snug mt-0.5">
                      {lang === 'bn'
                        ? `নিচের বাটনে ক্লিক করলে Consumer ID (${cleanId || '—'}) সরাসরি WBSEDCL Payment History পেজে অটো-ফিল হয়ে খুলবে — শুধু Captcha দিয়েই সম্পূর্ণ পেমেন্ট হিস্ট্রি দেখতে পাবেন।`
                        : `Opens WBSEDCL Online Payment History with Consumer ID (${cleanId || '—'}) pre-filled automatically — just enter the captcha to view full payment history.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Live WBSEDCL Official Verification Status Pill */}
              <div className="bg-white/90 border border-emerald-200/80 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
                {liveLoading ? (
                  <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                    <span>
                      {lang === 'bn'
                        ? 'WBSEDCL লাইভ পেমেন্ট/বকেয়া স্ট্যাটাস যাচাই হচ্ছে...'
                        : 'Checking live WBSEDCL payment/dues status...'}
                    </span>
                  </div>
                ) : liveSummary?.liveConnected ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          (liveSummary.totalDueAmount ?? 0) === 0 ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      />
                      <span className="font-bold text-slate-800">
                        {lang === 'bn' ? 'WBSEDCL লাইভ:' : 'WBSEDCL Live:'}{' '}
                        {(liveSummary.totalDueAmount ?? 0) === 0 ? (
                          <span className="text-emerald-700 font-black">
                            NO DUES (PAID • ₹0.00)
                          </span>
                        ) : (
                          <span className="text-rose-700 font-black">
                            {formatINR(liveSummary.totalDueAmount ?? 0)} Due
                          </span>
                        )}
                      </span>
                      {liveSummary.reportingDate && (
                        <span className="text-[10px] text-slate-500">
                          (as on {liveSummary.reportingDate})
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setLiveCheckNonce(n => n + 1)}
                      className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
                      title="Refresh live status"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full text-slate-600">
                    <span>
                      {lang === 'bn'
                        ? 'লাইভ স্ট্যাটাস চেক করতে Refresh চাপুন বা WBSEDCL পোর্টাল খুলুন'
                        : 'Tap Refresh for live status or open WBSEDCL portal'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLiveCheckNonce(n => n + 1)}
                      className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleCopyConsumerId}
                  className="px-3 py-2 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId ? (lang === 'bn' ? 'কপি হয়েছে!' : 'Copied!') : `Copy ID: ${cleanId}`}</span>
                </button>

                <a
                  href={wbsedclPaymentReceiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (cleanId) {
                      navigator.clipboard?.writeText(cleanId).catch(() => {});
                    }
                  }}
                  className="flex-1 min-w-[200px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'bn'
                      ? 'WBSEDCL Payment Receipt খুলুন'
                      : 'Open WBSEDCL Payment Receipt'}
                  </span>
                </a>
              </div>
            </div>

            {/* Digital Receipt Card */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                    {lang === 'bn' ? 'ডিজিটাল পেমেন্ট রসিদ স্লিপ' : 'Digital Receipt Slip'}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${
                    isPaid
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  {isPaid ? 'PAID' : `${paymentStatus} (${rawStatus})`}
                </span>
              </div>

              <div className="p-4 space-y-3 text-xs">
                {/* Consumer Info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-900 font-black text-sm uppercase">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{consumerName}</span>
                  </div>
                  {consumerAddress && (
                    <div className="flex items-start gap-2 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="uppercase">{consumerAddress}</span>
                    </div>
                  )}
                  {phone && (
                    <div className="flex items-center gap-2 text-blue-700 font-semibold">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{phone}</span>
                    </div>
                  )}
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Consumer ID</span>
                    <span className="font-mono font-black text-slate-900 text-xs sm:text-sm">{cleanId || '—'}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Date & Time</span>
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{dateDisplay}</span>
                    </span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">MRU / Office</span>
                    <span className="font-bold text-slate-800">{mru || '—'} / {offCode || 'WBSEDCL'}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Device / Meter</span>
                    <span className="font-bold text-slate-800">{device || '—'} / {meterNo || '—'}</span>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900 text-white">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      {lang === 'bn' ? 'বকেয়া বিল (O/S)' : 'Issued Arrear (O/S)'}
                    </span>
                    <span className="text-sm sm:text-base font-black text-rose-300">
                      {formatINR(dueAmt)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      {lang === 'bn' ? 'পরিশোধিত টাকা (Paid)' : 'Paid Amount'}
                    </span>
                    <span className={`text-sm sm:text-base font-black ${isPaid ? 'text-emerald-400' : 'text-amber-300'}`}>
                      {formatINR(paidAmt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
                  <span>
                    <strong className="text-slate-800">{lang === 'bn' ? 'এজেন্সি / কর্মী:' : 'Agency / Worker:'}</strong>{' '}
                    {agencyOrWorker}
                  </span>
                  {task.meterReading && (
                    <span className="font-mono">
                      <strong>Reading:</strong> {task.meterReading}
                    </span>
                  )}
                </div>

                {remarks && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                    <strong className="text-slate-900">{lang === 'bn' ? 'মন্তব্য:' : 'Remarks:'} </strong>
                    <span>{remarks}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Bottom Actions */}
          <div className="px-4 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer"
            >
              {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'PDF রসিদ ডাউনলোড' : 'Download PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
