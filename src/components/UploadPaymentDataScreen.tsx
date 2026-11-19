import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  UploadCloud,
  AlertCircle,
  AlertTriangle,
  Loader2,
  XCircle,
  SearchX,
  FileCheck2,
  RotateCcw,
  Coins
} from 'lucide-react';
import {
  PaymentSourceOption,
  PaymentUploadProgress,
  PaymentUploadResultReport,
  uploadDisconnectionPaymentData
} from '../services/api';
import { formatDateDDMMYYYY } from '../utils/dateTimeFormat';

interface UploadPaymentDataScreenProps {
  onBack: () => void;
  onUploadCompleted?: () => void;
}

interface ParsedFilePreview {
  fileName: string;
  fileSize: number;
  fileBase64: string;
  totalNonBlankRows: number;
  validRowCount: number;
  invalidRowCount: number;
  detectedColumns: string[];
  headerError: string | null;
  sampleErrors: string[];
}

type ResultFilter = 'ALL' | 'Updated' | 'Not Found' | 'Failed';

function normalizeHeaderName(val: unknown): string {
  return String(val ?? '')
    .trim()
    .replace(/[\s_-]+/g, ' ')
    .toLowerCase();
}

const PREVIEW_CID_HEADERS = new Set([
  'consumer id', 'consumerid', 'consumer no', 'consumerno', 'consumer number',
  'con id', 'con no', 'ca no', 'account number', 'account no', 'acct no'
]);
const PREVIEW_AMT_HEADERS = new Set([
  'amount', 'paid amount', 'paidamount', 'pay amount', 'payment amount',
  'collection amount', 'amt', 'paid amt'
]);
const PREVIEW_DATE_HEADERS = new Set([
  'date', 'paid date', 'paiddate', 'payment date', 'collection date',
  'receipt date', 'pay date', 'tran date', 'transaction date'
]);

function detectPreviewPaymentColumns(row: unknown[]): {
  consumerIdCol: number;
  amountCol: number;
  dateCol: number;
  score: number;
  detectedColumns: string[];
} {
  let consumerIdCol = -1;
  let amountCol = -1;
  let dateCol = -1;
  const detectedColumns: string[] = [];

  for (let c = 0; c < row.length; c++) {
    const raw = String(row[c] ?? '').trim();
    if (raw) detectedColumns.push(raw);
    const norm = normalizeHeaderName(raw);
    if (norm === 'consumer id') consumerIdCol = c;
    else if (norm === 'amount') amountCol = c;
    else if (norm === 'date') dateCol = c;
  }

  for (let c = 0; c < row.length; c++) {
    const norm = normalizeHeaderName(row[c]);
    if (consumerIdCol === -1 && PREVIEW_CID_HEADERS.has(norm)) consumerIdCol = c;
    else if (amountCol === -1 && PREVIEW_AMT_HEADERS.has(norm)) amountCol = c;
    else if (dateCol === -1 && PREVIEW_DATE_HEADERS.has(norm)) dateCol = c;
  }

  const score = (consumerIdCol !== -1 ? 1 : 0) + (amountCol !== -1 ? 1 : 0) + (dateCol !== -1 ? 1 : 0);
  return { consumerIdCol, amountCol, dateCol, score, detectedColumns };
}

function isRowBlank(row: unknown[]): boolean {
  if (!Array.isArray(row) || row.length === 0) return true;
  return row.every(cell => cell === null || cell === undefined || String(cell).trim() === '');
}

function validatePreviewConsumerId(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number') return Number.isFinite(val);
  const s = String(val).trim().replace(/\.0+$/, '');
  return s.length > 0 && !/^(null|undefined|nan|n\/a|-+)$/i.test(s);
}

function validatePreviewAmount(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return Number.isFinite(val) && val > 0;
  const cleaned = String(val)
    .trim()
    .replace(/[₹,\s]/g, '')
    .replace(/^(rs\.?|inr)/i, '');
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return false;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0;
}

function isValidCalendarYMD(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function getPreviewSsf(): { parse_date_code?: (serial: number, opts?: { date1904?: boolean }) => { y: number; m: number; d: number } | null } | null {
  const mod = XLSX as any;
  if (mod?.SSF && typeof mod.SSF.parse_date_code === 'function') return mod.SSF;
  if (mod?.default?.SSF && typeof mod.default.SSF.parse_date_code === 'function') return mod.default.SSF;
  return null;
}

function isValidExcelSerial(serial: number, date1904 = false): boolean {
  if (!Number.isFinite(serial) || serial <= 0) return false;
  const ssf = getPreviewSsf();
  if (ssf && typeof ssf.parse_date_code === 'function') {
    try {
      const parsed = ssf.parse_date_code(serial, date1904 ? { date1904: true } : undefined);
      if (parsed && isValidCalendarYMD(parsed.y, parsed.m, parsed.d)) return true;
    } catch {
      // fall through to deterministic UTC math
    }
  }
  const wholeDays = Math.floor(serial + 1e-7);
  if (wholeDays <= 0) return false;
  if (date1904) {
    const dt = new Date(Date.UTC(1904, 0, 1) + wholeDays * 86400000);
    return isValidCalendarYMD(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  if (wholeDays === 60) return false;
  const adjustedDays = wholeDays < 60 ? wholeDays + 1 : wholeDays;
  const dt = new Date(Date.UTC(1970, 0, 1) + (adjustedDays - 25569) * 86400000);
  return isValidCalendarYMD(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

const PREVIEW_MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
};

function validatePreviewDate(val: unknown, date1904 = false): boolean {
  if (val === null || val === undefined || val === '') return false;
  if (val instanceof Date) return !isNaN(val.getTime());
  if (typeof val === 'number') {
    return isValidExcelSerial(val, date1904);
  }
  const s = String(val).trim();
  if (!s) return false;
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    if (isValidExcelSerial(Number(s), date1904)) return true;
  }
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (m) {
    return isValidCalendarYMD(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
  }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:\s.*)?$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const rawY = parseInt(m[3], 10);
    const year = m[3].length === 2 ? 2000 + rawY : rawY;
    return isValidCalendarYMD(year, b, a) || isValidCalendarYMD(year, a, b);
  }
  m = s.match(/^(\d{1,2})[\s,-]+([A-Za-z]+)[\s,-]+(\d{2,4})(?:\s.*)?$/);
  if (m) {
    const month = PREVIEW_MONTH_NAMES[m[2].toLowerCase()];
    const rawY = parseInt(m[3], 10);
    const year = m[3].length === 2 ? 2000 + rawY : rawY;
    return Boolean(month && isValidCalendarYMD(year, month, parseInt(m[1], 10)));
  }
  return !isNaN(new Date(s).getTime());
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const UploadPaymentDataScreen: React.FC<UploadPaymentDataScreenProps> = ({
  onBack,
  onUploadCompleted
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [paymentSource, setPaymentSource] = useState<PaymentSourceOption | ''>('');
  const [filePreview, setFilePreview] = useState<ParsedFilePreview | null>(null);
  const [uploadId, setUploadId] = useState<string>('');
  const [appliedUploadKey, setAppliedUploadKey] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<PaymentUploadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultReport, setResultReport] = useState<PaymentUploadResultReport | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('ALL');
  const [resultSearch, setResultSearch] = useState<string>('');
  const [resultPage, setResultPage] = useState<number>(1);
  const RESULT_PAGE_SIZE = 100;

  const currentBatchKey = useMemo(() => {
    if (!paymentSource || !filePreview) return '';
    return `${paymentSource}::${filePreview.fileName}::${filePreview.fileSize}::${uploadId}`;
  }, [paymentSource, filePreview, uploadId]);

  const isAlreadyAppliedForBatch = Boolean(currentBatchKey && appliedUploadKey === currentBatchKey);

  const generateFreshUploadId = () =>
    `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const handlePaymentSourceChange = (val: string) => {
    setPaymentSource((val === 'Cash Desk' || val === 'Portal') ? val : '');
    setErrorMessage(null);
    setResultReport(null);
    setAppliedUploadKey(null);
    setUploadId(generateFreshUploadId());
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setResultReport(null);
    setAppliedUploadKey(null);

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setFilePreview(null);
      setErrorMessage('Unsupported file format. Please select a valid Excel file (.xlsx or .xls).');
      return;
    }

    setIsReadingFile(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false, raw: true });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        setFilePreview(null);
        setErrorMessage('The selected Excel file contains no worksheets.');
        return;
      }

      let matrix: unknown[][] = [];
      for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        if (!ws) continue;
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          defval: '',
          raw: true,
          blankrows: true
        });
        if (Array.isArray(rows) && rows.some(r => !isRowBlank(r))) {
          matrix = rows;
          break;
        }
      }

      if (matrix.length === 0) {
        setFilePreview(null);
        setErrorMessage('The uploaded Excel sheet is empty.');
        return;
      }

      let headerRowIdx = -1;
      let firstNonBlankIdx = -1;
      let bestMatch: ReturnType<typeof detectPreviewPaymentColumns> | null = null;
      let scannedNonBlank = 0;

      for (let i = 0; i < matrix.length; i++) {
        if (isRowBlank(matrix[i])) continue;
        if (firstNonBlankIdx === -1) firstNonBlankIdx = i;
        scannedNonBlank++;
        const cols = detectPreviewPaymentColumns(matrix[i]);
        if (!bestMatch || cols.score > bestMatch.score) {
          bestMatch = cols;
          headerRowIdx = i;
        }
        if (cols.score === 3 || scannedNonBlank >= 20) {
          break;
        }
      }

      if (headerRowIdx === -1) {
        setFilePreview(null);
        setErrorMessage('No column header row found in the Excel file.');
        return;
      }

      if (bestMatch && bestMatch.score === 0 && firstNonBlankIdx !== -1) {
        headerRowIdx = firstNonBlankIdx;
        bestMatch = detectPreviewPaymentColumns(matrix[firstNonBlankIdx]);
      }

      const { consumerIdCol, amountCol, dateCol, detectedColumns } =
        bestMatch || detectPreviewPaymentColumns(matrix[headerRowIdx]);

      const missing: string[] = [];
      if (consumerIdCol === -1) missing.push('Consumer ID');
      if (amountCol === -1) missing.push('Amount');
      if (dateCol === -1) missing.push('Date');

      const headerError =
        missing.length > 0
          ? `Missing required Excel column header(s): ${missing.join(', ')}. Required headers: Consumer ID, Amount, Date.`
          : null;

      let totalNonBlankRows = 0;
      let validRowCount = 0;
      let invalidRowCount = 0;
      const sampleErrors: string[] = [];

      const isDate1904 = Boolean((workbook as any)?.Workbook?.WBProps?.date1904);

      for (let r = headerRowIdx + 1; r < matrix.length; r++) {
        const row = matrix[r];
        if (isRowBlank(row)) continue;
        totalNonBlankRows++;

        if (!headerError) {
          const cidOk = validatePreviewConsumerId(row[consumerIdCol]);
          const amtOk = validatePreviewAmount(row[amountCol]);
          const dtOk = validatePreviewDate(row[dateCol], isDate1904);
          if (cidOk && amtOk && dtOk) {
            validRowCount++;
          } else {
            invalidRowCount++;
            if (sampleErrors.length < 5) {
              const rowIssues: string[] = [];
              if (!cidOk) rowIssues.push('Consumer ID');
              if (!amtOk) rowIssues.push('Amount');
              if (!dtOk) rowIssues.push('Date');
              sampleErrors.push(`Row ${r + 1}: invalid ${rowIssues.join(', ')}`);
            }
          }
        }
      }

      // Encode original file bytes to base64
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const fileBase64 = btoa(binary);

      if (!headerError && totalNonBlankRows === 0) {
        setFilePreview(null);
        setErrorMessage('The Excel file contains headers only and no payment data rows.');
        return;
      }

      setFilePreview({
        fileName: file.name,
        fileSize: file.size,
        fileBase64,
        totalNonBlankRows,
        validRowCount,
        invalidRowCount,
        detectedColumns,
        headerError,
        sampleErrors
      });
      setUploadId(generateFreshUploadId());
      if (headerError) {
        setErrorMessage(headerError);
      }
    } catch (err: any) {
      setFilePreview(null);
      setErrorMessage(err?.message || 'Unable to parse the selected Excel file.');
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleResetForm = () => {
    setPaymentSource('');
    setFilePreview(null);
    setUploadId('');
    setAppliedUploadKey(null);
    setUploadProgress(null);
    setErrorMessage(null);
    setResultReport(null);
    setResultFilter('ALL');
    setResultSearch('');
    setResultPage(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (paymentSource !== 'Cash Desk' && paymentSource !== 'Portal') {
      setErrorMessage('Please select a Payment Source (Cash Desk or Portal) before uploading.');
      return;
    }

    if (!filePreview) {
      setErrorMessage('Please select a valid Excel file (.xlsx or .xls).');
      return;
    }

    if (filePreview.headerError) {
      setErrorMessage(filePreview.headerError);
      return;
    }

    if (isAlreadyAppliedForBatch) {
      setErrorMessage('This payment file has already been processed for the selected Payment Source.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress({
      progressPercent: 4,
      stageMessage: 'Uploading & preparing payment records...',
      totalCount: filePreview.totalNonBlankRows,
      matchedCount: 0,
      processedCount: 0,
      updatedCount: 0
    });
    setErrorMessage(null);
    try {
      const effectiveId = uploadId || generateFreshUploadId();
      const report = await uploadDisconnectionPaymentData(
        {
          paymentSource,
          fileName: filePreview.fileName,
          fileBase64: filePreview.fileBase64,
          uploadId: effectiveId
        },
        (progress) => {
          setUploadProgress(progress);
        }
      );

      setResultReport(report);
      setResultFilter('ALL');
      setResultSearch('');
      setResultPage(1);
      setAppliedUploadKey(`${paymentSource}::${filePreview.fileName}::${filePreview.fileSize}::${effectiveId}`);
      if (report.updatedCount > 0 && onUploadCompleted) {
        onUploadCompleted();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Payment data upload failed.');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const filteredRows = useMemo(() => {
    if (!resultReport?.rowResults) return [];
    let list = resultReport.rowResults;
    if (resultFilter !== 'ALL') {
      list = list.filter(r => r.status === resultFilter);
    }
    const q = resultSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        String(r.consumerId || '').toLowerCase().includes(q) ||
        String(r.message || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [resultReport, resultFilter, resultSearch]);

  const totalResultPages = Math.max(1, Math.ceil(filteredRows.length / RESULT_PAGE_SIZE));
  const safeResultPage = Math.min(resultPage, totalResultPages);
  const pagedRows = useMemo(() => {
    const start = (safeResultPage - 1) * RESULT_PAGE_SIZE;
    return filteredRows.slice(start, start + RESULT_PAGE_SIZE);
  }, [filteredRows, safeResultPage]);

  const canSubmit =
    !isReadingFile &&
    !isSubmitting &&
    !isAlreadyAppliedForBatch &&
    (paymentSource === 'Cash Desk' || paymentSource === 'Portal') &&
    Boolean(filePreview) &&
    !filePreview?.headerError;

  return (
    <div id="upload-payment-data-screen" className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Admin Panel</span>
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black uppercase tracking-wider">
                <Coins className="w-3 h-3 text-emerald-700" />
                <span>Admin Panel • Payment Updater</span>
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              Upload Payment Data
            </h2>
            <p className="text-xs text-slate-500">
              Updates only Paid Amount, Paid Date, Paid Type, and Outstanding After on matching Disconnection rows.
            </p>
          </div>
        </div>

        {(filePreview || resultReport || paymentSource) && (
          <button
            type="button"
            onClick={handleResetForm}
            disabled={isSubmitting}
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-center disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Dedicated Form with Section A & Section B */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* SECTION A: PAYMENT SOURCE */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                Section A
              </span>
              {paymentSource && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{paymentSource}</span>
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="payment-source-select"
                className="block text-sm font-black text-slate-900 mb-1.5"
              >
                Payment Source <span className="text-rose-600">*</span>
              </label>
              <select
                id="payment-source-select"
                name="paymentSource"
                value={paymentSource}
                onChange={e => handlePaymentSourceChange(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-sm font-bold text-slate-900 outline-none transition-all cursor-pointer disabled:opacity-60"
              >
                <option value="">-- Select Payment Source --</option>
                <option value="Cash Desk">Cash Desk</option>
                <option value="Portal">Portal</option>
              </select>
              <p className="text-xs text-slate-500 mt-2">
                Select one payment source before uploading the Excel file. This value is written to the existing{' '}
                <strong className="text-slate-700">Paid Type</strong> column.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">Google Sheet Update Mapping:</p>
            <p>• Excel <span className="font-semibold text-slate-800">Consumer ID</span> → Match existing Consumer Id</p>
            <p>• Excel <span className="font-semibold text-slate-800">Amount</span> → <span className="font-semibold text-slate-800">Paid Amount</span></p>
            <p>• Excel <span className="font-semibold text-slate-800">Date</span> → <span className="font-semibold text-slate-800">Paid Date</span></p>
            <p>• Selected Source → <span className="font-semibold text-slate-800">Paid Type</span></p>
            <p>• Calculated <span className="font-semibold text-slate-800">MAX(0, D2 Net O/S - Paid Amount)</span> → <span className="font-semibold text-slate-800">Outstanding After</span></p>
          </div>
        </div>

        {/* SECTION B: PAYMENT FILE */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-lg">
                Section B
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                Supported: .xlsx, .xls
              </span>
            </div>

            <div>
              <label
                htmlFor="payment-excel-file-input"
                className="block text-sm font-black text-slate-900 mb-1.5"
              >
                Payment File <span className="text-rose-600">*</span>
              </label>

              <label
                htmlFor="payment-excel-file-input"
                className={`block border-2 border-dashed rounded-2xl p-5 text-center transition-all ${
                  !paymentSource
                    ? 'border-slate-200 bg-slate-50/70 opacity-75 cursor-not-allowed'
                    : filePreview?.headerError
                      ? 'border-rose-300 bg-rose-50/50 cursor-pointer hover:border-rose-400'
                      : filePreview
                        ? 'border-emerald-300 bg-emerald-50/40 cursor-pointer hover:border-emerald-400'
                        : 'border-sky-300 bg-sky-50/30 cursor-pointer hover:border-sky-500 hover:bg-sky-50/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  id="payment-excel-file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelected}
                  disabled={!paymentSource || isSubmitting || isReadingFile}
                  className="hidden"
                />

                {isReadingFile ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
                    <span className="text-xs font-bold text-slate-700">Reading and validating Excel columns...</span>
                  </div>
                ) : filePreview ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <FileSpreadsheet className={`w-8 h-8 ${filePreview.headerError ? 'text-rose-600' : 'text-emerald-600'}`} />
                    <span className="text-sm font-black text-slate-900 break-all">{filePreview.fileName}</span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {formatBytes(filePreview.fileSize)} • {filePreview.totalNonBlankRows} non-blank record(s)
                    </span>
                    <span className="text-[11px] font-bold text-sky-700 underline mt-1">
                      Click to choose a different Excel file
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <UploadCloud className="w-9 h-9 text-sky-600" />
                    <span className="text-sm font-bold text-slate-800">
                      {paymentSource
                        ? 'Click to select Excel payment file (.xlsx / .xls)'
                        : 'Select Payment Source in Section A first'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Required columns: <strong className="text-slate-700">Consumer ID</strong>, <strong className="text-slate-700">Amount</strong>, <strong className="text-slate-700">Date</strong>
                    </span>
                  </div>
                )}
              </label>
            </div>

            {filePreview && !filePreview.headerError && (
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <FileCheck2 className="w-3.5 h-3.5" />
                    <span>All required columns verified</span>
                  </span>
                  <span className="font-semibold text-slate-600">
                    Valid: {filePreview.validRowCount} • Invalid: {filePreview.invalidRowCount}
                  </span>
                </div>
                {filePreview.sampleErrors.length > 0 && (
                  <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2 space-y-0.5">
                    <p className="font-bold">Pre-upload validation warnings (these rows will be reported as Failed):</p>
                    {filePreview.sampleErrors.map((msg, idx) => (
                      <p key={idx}>• {msg}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              id="submit-upload-payment-data-btn"
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {uploadProgress
                      ? `Processing... ${uploadProgress.progressPercent}%`
                      : 'Updating Payment Data in Google Sheet...'}
                  </span>
                </>
              ) : isAlreadyAppliedForBatch ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Already Processed (Select New File or Source to Re-upload)</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload & Process Payment Data</span>
                </>
              )}
            </button>

            {isSubmitting && uploadProgress && (
              <div className="mt-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900">
                  <span className="truncate pr-2">{uploadProgress.stageMessage}</span>
                  <span className="shrink-0 tabular-nums">{uploadProgress.progressPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-emerald-200/70 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(4, Math.min(100, uploadProgress.progressPercent))}%` }}
                  />
                </div>
                {uploadProgress.matchedCount > 0 && (
                  <p className="text-[10px] font-semibold text-emerald-800">
                    Matched Consumers: {uploadProgress.matchedCount.toLocaleString()} • Updated: {uploadProgress.updatedCount.toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 flex items-start gap-3 text-rose-900">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1">
            <p className="font-black">Upload Error</p>
            <p className="font-medium">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Upload Result Report */}
      {resultReport && (
        <div id="payment-upload-result-report" className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Upload Result Report
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Source: <strong>{resultReport.paymentSource}</strong> • File: <strong>{resultReport.fileName}</strong>
                {(resultReport.duplicate || resultReport.duplicatePrevented) && (
                  <span className="ml-2 inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                    Duplicate protection active
                  </span>
                )}
              </p>
            </div>

            <div className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
              {resultReport.message}
            </div>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Excel Records
              </p>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {resultReport.totalRecords}
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Successfully Updated</span>
              </p>
              <p className="text-2xl font-black text-emerald-900 mt-1">
                {resultReport.updatedCount}
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                <SearchX className="w-3.5 h-3.5" />
                <span>Consumer ID Not Found</span>
              </p>
              <p className="text-2xl font-black text-amber-900 mt-1">
                {resultReport.notFoundCount}
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>Failed Records</span>
              </p>
              <p className="text-2xl font-black text-rose-900 mt-1">
                {resultReport.failedCount}
              </p>
            </div>
          </div>

          {/* Filter Tabs + Consumer Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              {(['ALL', 'Updated', 'Not Found', 'Failed'] as ResultFilter[]).map(tab => {
                const count =
                  tab === 'ALL'
                    ? resultReport.totalRecords
                    : tab === 'Updated'
                      ? resultReport.updatedCount
                      : tab === 'Not Found'
                        ? resultReport.notFoundCount
                        : resultReport.failedCount;
                const active = resultFilter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setResultFilter(tab);
                      setResultPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tab === 'ALL' ? 'All Records' : tab} ({count})
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={resultSearch}
              onChange={e => {
                setResultSearch(e.target.value);
                setResultPage(1);
              }}
              placeholder="Search Consumer ID..."
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-900 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none sm:w-56"
            />
          </div>

          {/* Detailed Row Results Table (Paginated cleanly for 10k+ records) */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-96">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 font-black border-b border-slate-200">Row</th>
                  <th className="py-2.5 px-3 font-black border-b border-slate-200">Consumer ID</th>
                  <th className="py-2.5 px-3 font-black border-b border-slate-200 text-right">D2 Net O/S</th>
                  <th className="py-2.5 px-3 font-black border-b border-slate-200 text-right">Paid Amount</th>
                  <th className="py-2.5 px-3 font-black border-b border-slate-200">Paid Date</th>
                  <th className="py-2.5 px-3 font-black border-b border-slate-200">Paid Type</th>
                  <th className="py-2.5 px-3 font-black border-b border-slate-200 text-right">Outstanding After</th>
                  <th className="py-2.5 px-3 font-black border-b border-slate-200">Status</th>
                  <th className="py-2.5 px-3 font-black border-b border-slate-200">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-slate-500 font-medium">
                      No records match the selected filter.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row, idx) => (
                    <tr key={`${row.rowNumber}-${idx}`} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-slate-600">{row.rowNumber}</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900 select-all">
                        {row.consumerId || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono text-right text-slate-700">
                        {row.d2NetOs !== '' ? row.d2NetOs : '-'}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-right text-slate-900">
                        {row.paidAmount !== '' ? row.paidAmount : '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                        {row.paidDate ? formatDateDDMMYYYY(row.paidDate) || row.paidDate : '-'}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        {row.paidType || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-right text-slate-900">
                        {row.outstandingAfter !== '' ? row.outstandingAfter : '-'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {row.status === 'Updated' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Updated</span>
                          </span>
                        )}
                        {row.status === 'Not Found' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Not Found</span>
                          </span>
                        )}
                        {row.status === 'Failed' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold">
                            <XCircle className="w-3 h-3" />
                            <span>Failed</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{row.message}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredRows.length > RESULT_PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 pt-1 text-xs font-bold text-slate-600">
              <span>
                Showing {((safeResultPage - 1) * RESULT_PAGE_SIZE + 1).toLocaleString()}–{Math.min(safeResultPage * RESULT_PAGE_SIZE, filteredRows.length).toLocaleString()} of {filteredRows.length.toLocaleString()}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeResultPage <= 1}
                  onClick={() => setResultPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  Prev
                </button>
                <span className="px-2 tabular-nums">
                  {safeResultPage} / {totalResultPages}
                </span>
                <button
                  type="button"
                  disabled={safeResultPage >= totalResultPages}
                  onClick={() => setResultPage(p => Math.min(totalResultPages, p + 1))}
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
