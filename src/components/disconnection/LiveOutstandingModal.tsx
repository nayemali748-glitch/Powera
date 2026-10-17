import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileCheck2,
  X,
  Search,
  Printer,
  Download,
  AlertCircle,
  FileText,
  User,
  Building2,
  Calendar,
  MapPin,
  Loader2,
  ExternalLink,
  CheckCircle2,
  QrCode,
  ShieldCheck
} from 'lucide-react';
import { DisconnectionTask } from '../../types';

interface LiveOutstandingModalProps {
  task: DisconnectionTask;
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'bn';
}

interface LiveCheckResult {
  success: boolean;
  liveConnected: boolean;
  consumerId: string;
  consumerName?: string;
  mru?: string;
  ccc?: string;
  office?: string;
  outstandingAmount?: number | null;
  lpscAmount?: number | null;
  lpscSurcharge?: number | null;
  lpscAvailable?: boolean;
  totalDueAmount?: number | null;
  connectionStatus?: string;
  connDate?: string;
  address?: string;
  reportingDate?: string;
  lastReadingDate?: string;
  lastCheckedAt?: string;
  reportType?: string;
  pdfBase64?: string;
  officialPortalUrl?: string;
  error?: string;
  message?: string;
  requiresBrowserOpen?: boolean;
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [result, setResult] = useState<LiveCheckResult | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement | null>(null);

  const formatCurrency = (amount: number): string => {
    return `₹ ${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const cleanIdVal = consumerId.replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-)/i, '').replace(/\.0+$/, '').replace(/[, \-_]/g, '').trim();
  const officialReportUrl = `https://portal.wbsedcl.in/webdynpro/resources/wbsedcl/noduesandoutstandingreport/OutstandingReport?consumerId=${cleanIdVal || initialConsumerId}`;

  const handleCheckOutstanding = useCallback(async (searchId?: string) => {
    const rawId = searchId !== undefined ? searchId : consumerId;
    const cleanId = rawId.replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-)/i, '').replace(/\.0+$/, '').replace(/[, \-_]/g, '').trim();
    if (!cleanId) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে সঠিক কনজিউমার আইডি লিখুন।' : 'Please enter a valid Consumer ID.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setResult(null); // Never mix previous search results

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);

      const res = await fetch('/api/wbsedcl/live-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerId: cleanId }),
        signal: controller.signal
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => null);

      if (data && data.success && data.liveConnected) {
        setResult(data);
        setError(null);
      } else {
        setResult(data || null);
        const errText = data?.error || data?.message || (lang === 'bn' ? 'WBSEDCL অফিশিয়াল লাইভ সার্ভার থেকে সরাসরি রিপোর্ট লোড করা যায়নি।' : 'Could not retrieve official live report directly from WBSEDCL.');
        setError(errText);
      }
    } catch (err: any) {
      setError(err?.name === 'AbortError'
        ? (lang === 'bn' ? 'অনুরোধের সময় শেষ হয়ে গেছে।' : 'Request timed out while connecting to WBSEDCL portal.')
        : (err?.message || (lang === 'bn' ? 'লাইভ ডেটা লোড করতে ব্যর্থ হয়েছে।' : 'Failed to retrieve live data.'))
      );
    } finally {
      setIsLoading(false);
    }
  }, [consumerId, lang]);

  useEffect(() => {
    setConsumerId(initialConsumerId);
    setError(null);
    setSuccessMessage(null);
    setResult(null);
    if (isOpen && initialConsumerId) {
      handleCheckOutstanding(initialConsumerId);
    }
  }, [initialConsumerId, isOpen]);

  if (!isOpen) return null;

  // Values strictly from verified official WBSEDCL live response
  const isLive = Boolean(result && result.liveConnected);
  const displayName = isLive ? (result?.consumerName || '—') : '—';
  const displayOffice = isLive ? (result?.office || result?.ccc || '—') : '—';
  const displayConnStatus = isLive ? (result?.connectionStatus || 'LIVE') : '—';
  const displayConnDate = isLive ? (result?.connDate || '—') : '—';
  const displayAddress = isLive ? (result?.address || '—') : '—';
  const reportingDate = isLive ? result?.reportingDate : '';
  const lastReadingDate = isLive ? result?.lastReadingDate : '';

  const rawOsd = result?.outstandingAmount;
  const isOsdParsed = isLive && typeof rawOsd === 'number' && !isNaN(rawOsd);
  const osdAmount = isOsdParsed ? rawOsd : null;

  const rawLpsc = result?.lpscAmount !== undefined ? result.lpscAmount : result?.lpscSurcharge;
  const isLpscParsed = isLive && typeof rawLpsc === 'number' && !isNaN(rawLpsc);
  const lpscAmount = isLpscParsed ? rawLpsc : null;

  const rawTotal = result?.totalDueAmount;
  const isTotalParsed = isLive && typeof rawTotal === 'number' && !isNaN(rawTotal);
  const totalDueAmount = isTotalParsed
    ? rawTotal
    : (isOsdParsed && isLpscParsed)
      ? Math.round(((osdAmount ?? 0) + (lpscAmount ?? 0)) * 100) / 100
      : isOsdParsed
        ? osdAmount
        : null;

  // Print authentic official WBSEDCL PDF
  const handlePrint = () => {
    try {
      if (result?.pdfBase64) {
        const byteCharacters = atob(result.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);

        if (!printIframeRef.current) {
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          document.body.appendChild(iframe);
          printIframeRef.current = iframe;
        }

        printIframeRef.current.src = blobUrl;
        printIframeRef.current.onload = () => {
          setTimeout(() => {
            printIframeRef.current?.contentWindow?.print();
            setSuccessMessage(lang === 'bn' ? '✓ প্রিন্ট ডায়ালগ সফলভাবে চালু হয়েছে।' : '✓ Official WBSEDCL report sent to print.');
            setTimeout(() => setSuccessMessage(null), 4000);
          }, 300);
        };
        return;
      }
      window.print();
      setSuccessMessage(lang === 'bn' ? '✓ প্রিন্ট ডায়ালগ সফলভাবে চালু হয়েছে।' : '✓ Print dialog opened.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      window.print();
    }
  };

  // Download authentic official WBSEDCL PDF
  const handleDownload = () => {
    const cId = cleanIdVal || initialConsumerId;
    try {
      if (result?.pdfBase64) {
        const byteCharacters = atob(result.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `WBSEDCL_Outstanding_Report_${cId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);

        setSuccessMessage(lang === 'bn' ? '✓ অফিসিয়াল WBSEDCL রিপোর্ট PDF ডাউনলোড সফল হয়েছে।' : '✓ Official WBSEDCL Outstanding Report downloaded successfully.');
        setTimeout(() => setSuccessMessage(null), 4000);
        return;
      }

      // If PDF base64 is missing, trigger direct download route
      const downloadUrl = `/api/wbsedcl/download-official-pdf?consumerId=${encodeURIComponent(cId)}`;
      window.open(downloadUrl, '_blank');
      setSuccessMessage(lang === 'bn' ? '✓ রিপোর্ট ডাউনলোড শুরু হয়েছে।' : '✓ Downloading official report from WBSEDCL.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      window.open(officialReportUrl, '_blank');
    }
  };

  const handleOpenOfficialPortal = () => {
    window.open(officialReportUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-150 font-sans"
        role="dialog"
        aria-modal="true"
        aria-labelledby="osd-check-title"
      >
        {/* 1. Header Bar: OSD & No Dues Check + Circular Close Button */}
        <div className="px-5 sm:px-6 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900">
            <FileCheck2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <h2 id="osd-check-title" className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
              <span>OSD & No Dues Check</span>
              {isLive && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>WBSEDCL VERIFIED LIVE</span>
                </span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="px-5 sm:px-6 pb-6 overflow-y-auto space-y-4">
          {/* 2. Search Bar Row: Input with clear 'X' + Green Search button */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <input
                type="text"
                value={consumerId}
                onChange={e => {
                  setConsumerId(e.target.value);
                  setError(null);
                  setSuccessMessage(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleCheckOutstanding();
                  }
                }}
                placeholder="Enter Consumer ID..."
                className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-300 hover:border-slate-400 focus:border-emerald-600 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-all placeholder:text-slate-400"
              />
              {consumerId && (
                <button
                  type="button"
                  onClick={() => {
                    setConsumerId('');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="absolute right-3 p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                  title="Clear"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleCheckOutstanding()}
              disabled={isLoading}
              className="px-5 py-2.5 bg-[#00875A] hover:bg-[#00734c] active:scale-95 text-white font-bold text-sm rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>

          {/* Success Banner if Download or Print Succeeded */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">{successMessage}</span>
            </div>
          )}

          {/* Error Banner with Direct Official Portal Button if Live unavailable */}
          {error && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl text-amber-950 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">
                  <strong className="font-bold">Notice: </strong>
                  <span>{error}</span>
                </div>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleOpenOfficialPortal}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Official WBSEDCL Report Page</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. Outstanding Report Banner: Cream/Yellow Card + Print & Download buttons */}
          <div className="bg-[#FFF9EE] border border-[#FDE68A] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-6 h-6 rounded-md border-2 border-amber-600 flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5 text-amber-700 stroke-[2.5]" />
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-amber-950 uppercase tracking-wide">
                {isLive ? (result?.reportType || 'OUTSTANDING REPORT') : 'OUTSTANDING REPORT'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[#FCE7D0] text-amber-900 text-[11px] font-black uppercase tracking-wider">
                {!isLive ? 'PENDING CHECK' : (totalDueAmount ?? 0) > 0 ? 'OUTSTANDING' : 'NO DUES'}
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Print Report"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="px-3.5 py-1.5 bg-[#00875A] hover:bg-[#00734c] text-white font-bold text-xs rounded-lg transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Download Report"
              >
                <Download className="w-3.5 h-3.5 text-white" />
                <span>Download</span>
              </button>
            </div>
          </div>

          {/* 4. Amount KPI Cards Row (OSD Amount, LPSC Surcharge, Total Dues) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* OSD AMOUNT */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase block">
                OSD AMOUNT
              </span>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {isLive && isOsdParsed ? formatCurrency(osdAmount!) : '—'}
              </div>
            </div>

            {/* LPSC SURCHARGE */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase block">
                LPSC SURCHARGE
              </span>
              <div className="mt-1">
                {!isLive ? (
                  <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight block">—</span>
                ) : isLpscParsed ? (
                  <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight block">
                    {formatCurrency(lpscAmount!)}
                  </span>
                ) : (
                  <div className="space-y-1">
                    <span className="text-xs text-amber-700 font-semibold leading-tight block">
                      LPSC unavailable in official response
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenOfficialPortal}
                      className="text-[11px] text-amber-800 hover:text-amber-900 underline font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Verify in Official WBSEDCL Report</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* TOTAL DUES */}
            <div className="bg-emerald-50/20 border-2 border-[#A3E6CD] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase block">
                TOTAL DUES
              </span>
              <div className="mt-1 text-xl sm:text-2xl font-black text-[#00875A] tracking-tight">
                {isLive && typeof totalDueAmount === 'number' && !isNaN(totalDueAmount)
                  ? formatCurrency(totalDueAmount)
                  : '—'}
              </div>
            </div>
          </div>

          {/* 5. Consumer Details Container */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
            {/* Consumer Details Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  CONSUMER DETAILS
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">
                ID: {cleanIdVal || initialConsumerId || '—'}
              </span>
            </div>

            {/* Row 1: Consumer Name, CCC / Office, Connection Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="bg-slate-50/60 border border-slate-100 rounded-lg p-2.5">
                <span className="text-[11px] text-slate-400 block font-medium">
                  Consumer Name
                </span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate uppercase mt-0.5" title={displayName}>
                  {displayName}
                </span>
              </div>

              <div className="bg-slate-50/60 border border-slate-100 rounded-lg p-2.5">
                <span className="text-[11px] text-slate-400 block font-medium">
                  CCC / Office
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0" title={displayOffice}>
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-bold text-slate-900 text-xs sm:text-sm truncate uppercase">
                    {displayOffice}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50/60 border border-slate-100 rounded-lg p-2.5">
                <span className="text-[11px] text-slate-400 block font-medium">
                  Connection Status
                </span>
                <div className="mt-0.5">
                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold uppercase">
                    {displayConnStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 2: Conn. Date, Service Location Address */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="bg-slate-50/60 border border-slate-100 rounded-lg p-2.5">
                <span className="text-[11px] text-slate-400 block font-medium">
                  Conn. Date
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">
                    {displayConnDate}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50/60 border border-slate-100 rounded-lg p-2.5 sm:col-span-2">
                <span className="text-[11px] text-slate-400 block font-medium">
                  Service Location Address
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0" title={displayAddress}>
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-bold text-slate-900 text-xs sm:text-sm truncate uppercase">
                    {displayAddress}
                  </span>
                </div>
              </div>
            </div>

            {/* Official Report Verification Footer Details */}
            {isLive && (
              <div className="pt-3 border-t border-slate-100 space-y-2 text-[11px] text-slate-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                  <span>
                    Reporting Date: <strong className="text-slate-700">{reportingDate || 'Live'}</strong>
                    {lastReadingDate && (
                      <> • Last Meter Reading: <strong className="text-slate-700">{lastReadingDate}</strong></>
                    )}
                  </span>
                  <span className="text-slate-600 font-semibold flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Official Station Manager Copy</span>
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 italic">
                  * This is a computer-generated document and hence does not requires any signature.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
