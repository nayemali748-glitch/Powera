import React, { useState, useRef, useMemo } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Download,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Search,
  RefreshCw,
  FileWarning
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DisconnectionTask } from '../../types';
import { extractDisconnectionTasksFromOCR, uploadDisconnectionTasks } from '../../services/api';

interface DisconnectionUploadProps {
  existingTasks: DisconnectionTask[];
  onUploadSuccess: (newTasks: DisconnectionTask[]) => void;
  onNavigateToViewList: () => void;
  adminUser: {
    idNo?: string;
    username?: string;
    name?: string;
  };
  lang?: 'en' | 'bn';
}

interface ParsedConsumerTask extends Partial<DisconnectionTask> {
  tempId: string;
  isDuplicateId?: boolean;
  isDuplicateAccount?: boolean;
  isInvalid?: boolean;
  validationNote?: string;
}

export const DisconnectionUpload: React.FC<DisconnectionUploadProps> = ({
  existingTasks,
  onUploadSuccess,
  onNavigateToViewList,
  adminUser,
  lang = 'en'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [parsedRecords, setParsedRecords] = useState<ParsedConsumerTask[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    count: number;
    insertedCount?: number;
    updatedCount?: number;
    message: string;
  } | null>(null);
  const [filterPreview, setFilterPreview] = useState<'ALL' | 'VALID' | 'DUPLICATES'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate highest existing SL number from database
  const maxExistingSl = useMemo(() => {
    let max = 0;
    existingTasks.forEach(t => {
      const sl = t.serialNumber || (t as any)['SL No'];
      if (sl) {
        const match = String(sl).match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > max) max = num;
        }
      }
    });
    return max;
  }, [existingTasks]);

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'SL No': 'SL 001',
        'Consumer Name': 'HESAMUDDIN',
        'Consumer ID': '342049760',
        'MRU Section': 'FIL33MMR',
        'CCC / Feeder': 'SAMSI CCC / 11kV Feeder',
        'Address': 'VILL. MOTTIGANJ,,P.O. SAMSI,DIST.MALDA,',
        'Mobile Number': '8145773298',
        'Outstanding Dues': '1296888',
        'Due Date Range': '21.09.2011–21.09.2011',
        'Class': 'I',
        'Device': 'ST328707',
        'Priority': 'NORMAL',
        'Status': 'connected',
        'Disconnection Reason': 'Outstanding Dues (Issued for Disconnection)'
      },
      {
        'SL No': 'SL 002',
        'Consumer Name': 'SECRETARY',
        'Consumer ID': '342212718',
        'MRU Section': 'FIL60MMR',
        'CCC / Feeder': 'SAMSI CCC',
        'Address': 'MD.SAYED ALI -( B. COM.D T W ),,BHAGABANPUR .PO. SAMSI,LOC-...',
        'Mobile Number': '8145773298',
        'Outstanding Dues': '559384.18',
        'Due Date Range': '14.09.2015–10.08.2020',
        'Class': 'A',
        'Device': 'ST328710',
        'Priority': 'NORMAL',
        'Status': 'connected',
        'Disconnection Reason': 'Outstanding Dues (Issued for Disconnection)'
      },
      {
        'SL No': 'SL 003',
        'Consumer Name': 'Bikash Chandra Mondal',
        'Consumer ID': '342088192',
        'MRU Section': 'FIL33MMR',
        'CCC / Feeder': 'SAMSI CCC',
        'Address': 'Vill- Gopalpur, PO- Samsi, Malda',
        'Mobile Number': '9832011223',
        'Outstanding Dues': '14500',
        'Due Date Range': '15.01.2020–31.01.2026',
        'Class': 'I',
        'Device': 'ST328715',
        'Priority': 'NORMAL',
        'Status': 'connected',
        'Disconnection Reason': 'Outstanding Dues (Issued for Disconnection)'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Disconnection_List');
    XLSX.writeFile(wb, 'WBSEDCL_Disconnection_Upload_Template.xlsx');
  };

  // Normalizer for messy spreadsheet columns
  const normalizeRow = (row: any, idx: number): ParsedConsumerTask => {
    const getVal = (...keys: string[]): string => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return String(row[k]).trim();
        }
        // case-insensitive match
        const lowerK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const rowKey of Object.keys(row)) {
          const lowerRowKey = rowKey.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (lowerRowKey === lowerK && row[rowKey] !== undefined && row[rowKey] !== null) {
            return String(row[rowKey]).trim();
          }
        }
      }
      return '';
    };

    const slRaw = getVal('SL No', 'SL', 'Serial No', 'Serial', 'SlNo');
    let serialNumber = '';
    if (slRaw) {
      const match = slRaw.match(/(\d+)/);
      if (match) {
        serialNumber = `SL ${String(parseInt(match[1], 10)).padStart(3, '0')}`;
      } else {
        serialNumber = slRaw;
      }
    } else {
      serialNumber = `SL ${String(maxExistingSl + idx + 1).padStart(3, '0')}`;
    }

    const consumerName = getVal('Consumer Name', 'ConsumerName', 'Name', 'Customer Name', 'Consumer');
    const consumerId = getVal('Consumer ID', 'ConsumerId', 'CID', 'Con ID', 'ID', 'Consumer_No', 'ConNo', 'Consumer No');
    const accountNumber = getVal('Account Number', 'Account No', 'Installation No', 'Inst No', 'Acc No', 'Account');
    const mruSection = getVal('MRU Section', 'MRU', 'Section', 'MRU_Section', 'Section Code', 'Pill', 'Feeder Code');
    const cccFeeder = getVal('CCC / Feeder', 'CCC', 'Feeder', 'CCC Name', 'Feeder Name', 'Substation');
    const consumerAddress = getVal('Address', 'Consumer Address', 'Premises', 'Location', 'Village');
    
    // Comprehensive Mobile / Phone number extraction with fuzzy matching and fallbacks
    let phoneNumber = getVal(
      'Mobile Number', 'Mobile No', 'Mobile No.', 'Mobile', 'Mob No', 'Mob No.', 'Mob', 'MOB_NO', 'MOB_NUM',
      'Phone Number', 'Phone No', 'Phone No.', 'Phone', 'Ph No', 'Ph No.', 'PH_NO', 'PHONENO',
      'Telephone', 'Tel No', 'Tel', 'Cell', 'Cell No', 'Contact Number', 'Contact No', 'Contact No.', 'Contact',
      'Customer Mobile', 'Consumer Mobile', 'Cust Mobile', 'Caller', 'Caller No', 'MOBILE', 'PHONE',
      'মোবাইল', 'মোবাইল নম্বর', 'ফোন', 'ফোন নম্বর', 'যোগাযোগ'
    );

    // Fuzzy header matching if not found by exact synonym
    if (!phoneNumber) {
      for (const rowKey of Object.keys(row)) {
        const lowerKey = rowKey.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (
          lowerKey.includes('mob') ||
          lowerKey.includes('phone') ||
          lowerKey.includes('contact') ||
          lowerKey.includes('cell') ||
          lowerKey.includes('tel') ||
          rowKey.includes('মোবাইল') ||
          rowKey.includes('ফোন')
        ) {
          const val = row[rowKey];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            phoneNumber = String(val).trim();
            break;
          }
        }
      }
    }

    // Clean up float/scientific notation from Excel (e.g. 8145773298.0 or 8.14577e+09)
    if (phoneNumber) {
      phoneNumber = phoneNumber.replace(/\.0+$/, '');
      if (/^\d+\.?\d*e[+-]?\d+$/i.test(phoneNumber)) {
        const num = Number(phoneNumber);
        if (!isNaN(num)) phoneNumber = Math.round(num).toString();
      }
    }

    // Fallback 1: Scan all cell values in the row for a 10-digit Indian phone number
    if (!phoneNumber) {
      for (const val of Object.values(row)) {
        if (val !== undefined && val !== null) {
          const str = String(val).trim();
          const match = str.match(/(?:^|\D)([6-9]\d{9})(?:\D|$)/);
          if (match && match[1]) {
            phoneNumber = match[1];
            break;
          }
        }
      }
    }

    // Fallback 2: Check address string for embedded phone number
    if (!phoneNumber && consumerAddress) {
      const match = consumerAddress.match(/(?:^|\D)([6-9]\d{9})(?:\D|$)/);
      if (match && match[1]) {
        phoneNumber = match[1];
      }
    }

    const outstandingDue = getVal('Outstanding Dues', 'Outstanding Amount', 'Arrears', 'Due Amount', 'Arrear', 'Balance', 'Dues', 'Outstanding Dues (Issued for Disconnection)');
    const dueDateRange = getVal('Due Date Range', 'Due Date', 'Bill Date', 'Date Range', 'Due Range');
    const baseClass = getVal('Class', 'Base Class', 'Tariff', 'Category') || 'I';
    const meterNumber = getVal('Device', 'Meter Number', 'Meter No', 'Meter Serial', 'Meter', 'DeviceId', 'Device No') || 'ST328707';
    const deviceType = getVal('Device Type', 'Phase', 'Meter Type') || meterNumber;
    const priorityVal = getVal('Priority', 'Urgent').toUpperCase();
    const priority = priorityVal === 'URGENT' || priorityVal === 'YES' || priorityVal === 'HIGH' ? 'URGENT' : 'NORMAL';
    const disconnectionReason = getVal('Disconnection Reason', 'Reason', 'Remarks') || 'Outstanding Dues (Issued for Disconnection)';
    
    // Status parsing
    const rawStatus = getVal('Status', 'Task Status', 'Connection Status').toUpperCase();
    let taskStatus: any = 'PENDING';
    if (rawStatus.includes('DISCONNECT') && !rawStatus.includes('ALREADY')) {
      taskStatus = 'DISCONNECT';
    } else if (rawStatus.includes('ALREADY')) {
      taskStatus = 'ALREADY DISCONNECTED';
    } else if (rawStatus.includes('PAID')) {
      taskStatus = 'PAID';
    } else if (rawStatus.includes('DISPUTE')) {
      taskStatus = 'DISPUTE';
    } else if (rawStatus.includes('OFFICE')) {
      taskStatus = 'OFFICE TEAM';
    } else if (rawStatus.includes('NOT FOUND')) {
      taskStatus = 'NOT FOUND';
    } else if (rawStatus.includes('REISSUE')) {
      taskStatus = 'REISSUE';
    } else if (rawStatus.includes('CONNECTED')) {
      taskStatus = 'PENDING';
    }

    const tempId = `TEMP-ROW-${idx + 1}`;
    const taskId = getVal('Task ID', 'TaskId') || `TASK-DISC-${Date.now()}-${idx + 1}`;

    return {
      tempId,
      taskId,
      serialNumber,
      consumerName,
      consumerId,
      accountNumber,
      mruSection,
      cccFeeder,
      consumerAddress,
      phoneNumber,
      outstandingDue,
      dueDateRange,
      baseClass,
      deviceType,
      meterNumber,
      priority,
      disconnectionReason,
      taskStatus,
      createdAt: new Date().toISOString()
    };
  };

  // Run duplicate and validity check
  const validateExtractedRecords = (records: ParsedConsumerTask[]): ParsedConsumerTask[] => {
    const existingCids = new Set(existingTasks.map(t => String(t.consumerId || '').trim().toLowerCase()).filter(Boolean));
    const existingAccounts = new Set(existingTasks.map(t => String(t.accountNumber || '').trim().toLowerCase()).filter(Boolean));

    const seenCidsInFile = new Set<string>();
    const seenAccountsInFile = new Set<string>();

    return records.map(r => {
      const cid = String(r.consumerId || '').trim().toLowerCase();
      const acc = String(r.accountNumber || '').trim().toLowerCase();

      let isDuplicateId = false;
      let isDuplicateAccount = false;
      let isInvalid = false;
      const notes: string[] = [];

      if (!r.consumerName && !r.consumerId && !r.accountNumber) {
        isInvalid = true;
        notes.push('Missing Name and Consumer ID');
      }

      if (cid) {
        if (existingCids.has(cid)) {
          isDuplicateId = true;
          notes.push('Consumer ID already exists in database (will update)');
        }
        if (seenCidsInFile.has(cid)) {
          isDuplicateId = true;
          notes.push('Duplicate Consumer ID within uploaded file');
        }
        seenCidsInFile.add(cid);
      }

      if (acc) {
        if (existingAccounts.has(acc)) {
          isDuplicateAccount = true;
          notes.push('Account No already exists in database');
        }
        if (seenAccountsInFile.has(acc)) {
          isDuplicateAccount = true;
          notes.push('Duplicate Account No in file');
        }
        seenAccountsInFile.add(acc);
      }

      return {
        ...r,
        isDuplicateId,
        isDuplicateAccount,
        isInvalid,
        validationNote: notes.join(' | ')
      };
    });
  };

  // Process File
  const handleFileProcess = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setSaveResult(null);
    setParsedRecords([]);

    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        setProcessingStatus(lang === 'bn' ? 'এক্সেল ফাইল প্রসেস করা হচ্ছে...' : 'Parsing spreadsheet data...');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (jsonData.length === 0) {
          throw new Error('Spreadsheet appears to be empty.');
        }

        const normalized = jsonData.map((row, i) => normalizeRow(row, i));
        const validated = validateExtractedRecords(normalized);
        setParsedRecords(validated);
        setProcessingStatus('');
      } else if (ext === 'pdf' || ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
        // Document / Image OCR using Gemini
        setProcessingStatus(lang === 'bn' ? 'নথি রিড করা হচ্ছে...' : 'Reading document file...');
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const base64Data = await base64Promise;
        setProcessingStatus(lang === 'bn' ? 'AI OCR দিয়ে কনজিউমার ডাটা এক্সট্র্যাক্ট হচ্ছে...' : 'Extracting consumer records via AI OCR...');

        const ocrResult = await extractDisconnectionTasksFromOCR(base64Data, file.type, file.name);

        if (!ocrResult.success || !ocrResult.tasks || ocrResult.tasks.length === 0) {
          throw new Error(ocrResult.error || 'No consumer records could be detected in document.');
        }

        const normalized = ocrResult.tasks.map((row, i) => normalizeRow(row, i));
        const validated = validateExtractedRecords(normalized);
        setParsedRecords(validated);
        setProcessingStatus('');
      } else {
        throw new Error('Unsupported format. Please upload Excel (.xlsx, .xls), CSV, PDF, JPG, or PNG.');
      }
    } catch (err: any) {
      alert(`Upload error: ${err.message || 'Failed to parse file'}`);
      setSelectedFile(null);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Remove single row from preview
  const handleRemoveRow = (tempId: string) => {
    setParsedRecords(prev => prev.filter(r => r.tempId !== tempId));
  };

  // Save to backend
  const handleSaveToBackend = async () => {
    if (parsedRecords.length === 0) return;

    setIsSaving(true);
    try {
      const adminInfo = {
        adminId: adminUser?.idNo || adminUser?.username || 'ADMIN',
        adminName: adminUser?.name || adminUser?.username || 'Administrator'
      };

      // Filter out invalid rows
      const validToUpload = parsedRecords.filter(r => !r.isInvalid);

      const res = await uploadDisconnectionTasks(validToUpload, adminInfo);

      if (res && res.success) {
        setSaveResult({
          success: true,
          count: res.count || validToUpload.length,
          insertedCount: res.insertedCount,
          updatedCount: res.updatedCount,
          message: res.message || `Successfully saved ${validToUpload.length} disconnection records to database.`
        });
        if (res.tasks && Array.isArray(res.tasks)) {
          onUploadSuccess(res.tasks);
        }
      } else {
        throw new Error(res?.message || 'Server failed to save disconnection list');
      }
    } catch (err: any) {
      alert(`Save error: ${err.message || 'Could not save to database'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter preview records
  const filteredRecords = parsedRecords.filter(r => {
    if (filterPreview === 'VALID' && (r.isInvalid || r.isDuplicateId)) return false;
    if (filterPreview === 'DUPLICATES' && !r.isDuplicateId && !r.isDuplicateAccount) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        (r.consumerName && r.consumerName.toLowerCase().includes(q)) ||
        (r.consumerId && r.consumerId.toLowerCase().includes(q)) ||
        (r.accountNumber && r.accountNumber.toLowerCase().includes(q)) ||
        (r.consumerAddress && r.consumerAddress.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const duplicateCount = parsedRecords.filter(r => r.isDuplicateId || r.isDuplicateAccount).length;
  const validCount = parsedRecords.filter(r => !r.isInvalid).length;

  return (
    <div className="space-y-6" id="disconnection-upload-section">
      {/* Header card with Sample Template Download */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-amber-500" />
            <span>{lang === 'bn' ? 'ডিসকানেকশন কনজিউমার তালিকা আপলোড' : 'Upload Disconnection Consumer List'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'bn'
              ? 'Excel, CSV, PDF বা ছবি (JPG/PNG) ফাইল আপলোড করুন। এআই স্বয়ংক্রিয়ভাবে উপভোক্তার তথ্য রিড করবে।'
              : 'Support for Excel, CSV, PDF, JPG, and PNG with automated OCR consumer record extraction.'}
          </p>
        </div>

        <button
          id="download-sample-template-btn"
          onClick={handleDownloadTemplate}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-2xs"
          title="Download sample Excel template with standard columns"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          <span>{lang === 'bn' ? 'নমুনা এক্সেল ডাউনলোড' : 'Download Sample Excel'}</span>
        </button>
      </div>

      {/* Upload Box */}
      {!parsedRecords.length && !saveResult && (
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all ${
            isDragging
              ? 'border-amber-500 bg-amber-50/50 scale-[1.01]'
              : 'border-slate-300 bg-white hover:border-slate-400'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileProcess(e.target.files[0]);
              }
            }}
            accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png"
            className="hidden"
          />

          {isProcessing ? (
            <div className="flex flex-col items-center justify-center py-6">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-3" />
              <div className="font-bold text-slate-800 text-sm">{processingStatus}</div>
              <p className="text-xs text-slate-400 mt-1">
                {lang === 'bn' ? 'অনুগ্রহ করে অপেক্ষা করুন...' : 'Please wait while records are structured...'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-100/70 text-amber-700 flex items-center justify-center mb-4">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-900 mb-1">
                {lang === 'bn' ? 'ফাইল এখানে টানুন অথবা ক্লিক করুন' : 'Drag & Drop files or Click to Browse'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mb-5">
                {lang === 'bn'
                  ? 'সাপোর্টেড ফরম্যাট: Excel (.xlsx, .xls), CSV, PDF ডকুমেন্ট, অথবা স্ক্যান করা ছবি (JPG/PNG)'
                  : 'Supported formats: Excel (.xlsx, .xls), CSV, PDF document, or scanned list photo (JPG/PNG)'}
              </p>

              <button
                id="browse-files-btn"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                <span>{lang === 'bn' ? 'কম্পিউটার থেকে ফাইল বাছুন' : 'Select File to Upload'}</span>
              </button>

              <div className="flex items-center gap-3 mt-6 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> Excel / CSV
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-rose-500" /> PDF Scans
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-sky-500" /> JPG / PNG OCR
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success Notification & Redirect to View List */}
      {saveResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-xs text-emerald-950">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-black text-emerald-950 tracking-tight">
                {lang === 'bn' ? 'সফলভাবে ডাটাবেসে সেভ হয়েছে!' : 'Disconnection List Successfully Uploaded!'}
              </h3>
              <p className="text-xs text-emerald-800 mt-1 font-medium">{saveResult.message}</p>
              <div className="flex items-center gap-4 mt-3 text-xs font-bold">
                <span className="px-2.5 py-1 rounded-md bg-emerald-100 border border-emerald-300">
                  {saveResult.count} {lang === 'bn' ? 'টি উপভোক্তা প্রসেসড' : 'Consumers Processed'}
                </span>
                {saveResult.insertedCount !== undefined && (
                  <span className="px-2.5 py-1 rounded-md bg-emerald-100 border border-emerald-300">
                    +{saveResult.insertedCount} {lang === 'bn' ? 'টি নতুন যুক্ত' : 'New Added'}
                  </span>
                )}
                {saveResult.updatedCount !== undefined && saveResult.updatedCount > 0 && (
                  <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                    ↻ {saveResult.updatedCount} {lang === 'bn' ? 'টি আপডেট' : 'Updated'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-5">
                <button
                  id="go-to-view-list-btn"
                  onClick={onNavigateToViewList}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <span>{lang === 'bn' ? 'তালিকা দেখুন (View List)' : 'Open View List'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setSaveResult(null);
                    setParsedRecords([]);
                    setSelectedFile(null);
                  }}
                  className="px-4 py-2.5 bg-white border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  {lang === 'bn' ? 'আরেকটি ফাইল আপলোড করুন' : 'Upload Another File'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Table Before Final Save */}
      {parsedRecords.length > 0 && !saveResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 tracking-tight">
                  {lang === 'bn' ? 'আপলোডকৃত ডাটা যাচাই ও প্রিভিউ' : 'Review & Validate Extracted Data'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  {parsedRecords.length} {lang === 'bn' ? 'টি রেকর্ড' : 'Records'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedFile?.name} •{' '}
                {duplicateCount > 0 ? (
                  <span className="text-amber-600 font-bold">
                    {duplicateCount} {lang === 'bn' ? 'টি ডুপ্লিকেট শনাক্ত' : 'potential duplicates detected'}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-bold">
                    {lang === 'bn' ? 'কোনো ডুপ্লিকেট নেই, সুরক্ষিত' : 'All records clean & ready'}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setParsedRecords([]);
                  setSelectedFile(null);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>

              <button
                id="save-to-backend-btn"
                onClick={handleSaveToBackend}
                disabled={isSaving || validCount === 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === 'bn' ? 'সেভ হচ্ছে...' : 'Saving to Database...'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {lang === 'bn' ? `ডাটাবেসে ${validCount}টি সেভ করুন` : `Save ${validCount} to Database`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setFilterPreview('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterPreview === 'ALL' ? 'bg-slate-900 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {lang === 'bn' ? 'সকল' : 'All'} ({parsedRecords.length})
              </button>
              <button
                onClick={() => setFilterPreview('VALID')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterPreview === 'VALID' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {lang === 'bn' ? 'সঠিক (Valid)' : 'Valid'} ({validCount})
              </button>
              {duplicateCount > 0 && (
                <button
                  onClick={() => setFilterPreview('DUPLICATES')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterPreview === 'DUPLICATES' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {lang === 'bn' ? 'ডুপ্লিকেট' : 'Duplicates'} ({duplicateCount})
                </button>
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={lang === 'bn' ? 'প্রিভিউতে খুঁজুন...' : 'Search preview...'}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider z-10">
                <tr>
                  <th className="py-2.5 px-3">{lang === 'bn' ? 'ক্রমিক নং' : 'Serial No'}</th>
                  <th className="py-2.5 px-3">{lang === 'bn' ? 'কনজিউমার নাম' : 'Consumer Name'}</th>
                  <th className="py-2.5 px-3">{lang === 'bn' ? 'ঠিকানা ও ফোন' : 'Address & Phone'}</th>
                  <th className="py-2.5 px-3">{lang === 'bn' ? 'বকেয়া টাকা' : 'Outstanding Arrears'}</th>
                  <th className="py-2.5 px-3">{lang === 'bn' ? 'MRU / CCC' : 'MRU / CCC'}</th>
                  <th className="py-2.5 px-3">{lang === 'bn' ? 'প্রায়োরিটি' : 'Priority'}</th>
                  <th className="py-2.5 px-3 text-center">{lang === 'bn' ? 'স্ট্যাটাস' : 'Validation'}</th>
                  <th className="py-2.5 px-3 text-right">{lang === 'bn' ? 'অ্যাকশন' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r, idx) => {
                  return (
                    <tr
                      key={r.tempId}
                      className={`hover:bg-slate-50 transition-colors ${
                        r.isDuplicateId ? 'bg-amber-50/40' : r.isInvalid ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-black text-amber-900 bg-amber-50 text-xs whitespace-nowrap">
                        {r.serialNumber || ('SL ' + String(idx + 1).padStart(3, '0'))}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{r.consumerName || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        <div className="line-clamp-1">{r.consumerAddress || '—'}</div>
                        {r.phoneNumber && <div className="text-amber-600 font-bold">{r.phoneNumber}</div>}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-rose-600">
                        {r.outstandingDue ? `₹${r.outstandingDue}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        {r.mruSection || r.cccFeeder || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.priority === 'URGENT' ? (
                          <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-800 font-black text-[10px] border border-red-300">
                            URGENT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[10px]">
                            NORMAL
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {r.isDuplicateId ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300"
                            title={r.validationNote}
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Update</span>
                          </span>
                        ) : r.isInvalid ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 font-bold text-[10px] border border-rose-300"
                            title={r.validationNote}
                          >
                            <FileWarning className="w-3 h-3 text-rose-600" />
                            <span>Incomplete</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-bold text-[10px] border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>New</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleRemoveRow(r.tempId)}
                          className="p-1 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove row from upload"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
