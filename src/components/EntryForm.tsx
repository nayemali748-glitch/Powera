import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Send, 
  MapPin, 
  Camera, 
  CheckCircle, 
  User, 
  Phone, 
  FileText, 
  AlertCircle,
  Hash,
  Activity,
  Layers,
  Calendar,
  Sparkles,
  Upload,
  X,
  RefreshCw,
  Clock,
  ArrowLeft,
  ShieldCheck,
  Building,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CategoryType, PowerEntry, UserSession, WorkOrderNotice } from '../types';
import { createEntry } from '../services/api';
import { appendEntryToGoogleSheet } from '../services/googleSheets';
import { Language, translations } from '../utils/translations';
import { WorkOrderNoticeSection } from './WorkOrderNoticeSection';
import { compressImageFile } from '../utils/imageCompressor';

interface EntryFormProps {
  category: CategoryType;
  workerName: string;
  onSuccess: (entry: PowerEntry) => void;
  onBack?: () => void;
  lang?: Language;
  currentUser?: UserSession | null;
  initialNotice?: WorkOrderNotice | null;
}

export const EntryForm: React.FC<EntryFormProps> = ({
  category,
  workerName,
  onSuccess,
  onBack,
  lang = 'bn',
  currentUser,
  initialNotice,
}) => {
  const t = translations[lang] || translations.bn;

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submissionModalEntry, setSubmissionModalEntry] = useState<PowerEntry | null>(null);
  const [fetchingGps, setFetchingGps] = useState(false);

  // Validation State & Tracking
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState<boolean>(false);

  const clearError = (field: string) => {
    setValidationErrors((prev) => {
      if (!prev[field]) return prev;
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  // Common Form Fields
  const [worker, setWorker] = useState(workerName || 'WBSEDCL Lineman-01');
  const [workerPhone, setWorkerPhone] = useState('');
  const [feederName, setFeederName] = useState('11kV Town Feeder-01');
  const [substation, setSubstation] = useState('Central 33/11kV Substation');
  const [cccOffice, setCccOffice] = useState('Burdwan / Howrah CCC');
  const [locationGps, setLocationGps] = useState('');
  const [notes, setNotes] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState<boolean>(false);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);

  // Category-specific states
  // 1. NSC (New Service Connection)
  const [workOrderNo, setWorkOrderNo] = useState('');
  const [workOrderDate, setWorkOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [consumerName, setConsumerName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [applicationNo, setApplicationNo] = useState('');
  const [nscWorkerName, setNscWorkerName] = useState(workerName || '');
  const [agencyName, setAgencyName] = useState('');
  const [cccName, setCccName] = useState('Central CCC');
  const [consumerId, setConsumerId] = useState('');
  const [meterNo, setMeterNo] = useState('');
  const [sealNo, setSealNo] = useState('');
  const [initialReading, setInitialReading] = useState('000000');
  const [mobile, setMobile] = useState('');
  const [appliedLoad, setAppliedLoad] = useState('');
  const [phase, setPhase] = useState('');
  const [tariffCategory, setTariffCategory] = useState('');
  const [serviceCableLength, setServiceCableLength] = useState('');
  const [address, setAddress] = useState('');
  const [meterInstallDate, setMeterInstallDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [inspectionAgencyName, setInspectionAgencyName] = useState('');
  const [poleNo, setPoleNo] = useState('');
  const [meterMake, setMeterMake] = useState('Genus / Secure');
  const [earthResistance, setEarthResistance] = useState('');

  // 2. DISCONNECTION
  const [arrearAmount, setArrearAmount] = useState('');
  const [disconnectionReason, setDisconnectionReason] = useState('বকেয়া বিল অনাদায়ে (Unpaid Arrear Default)');
  const [finalReading, setFinalReading] = useState('');
  const [noticeNo, setNoticeNo] = useState('');
  const [disconnectionType, setDisconnectionType] = useState('Defaulter / Non-Payment');
  const [cutoutSealed, setCutoutSealed] = useState(true);
  const [cutoutSealNo, setCutoutSealNo] = useState('');
  const [disconnectionActionTaken, setDisconnectionActionTaken] = useState('Service cable detached & cutout sealed');

  // 3. POLE CASE / MAINTENANCE
  const [issueType, setIssueType] = useState('ঝড়ে পোল ভাঙা / হেলে পড়া (Storm Damaged/Tilted)');
  const [priority, setPriority] = useState<'Urgent' | 'High' | 'Normal' | 'Low'>('High');
  const [poleType, setPoleType] = useState('9-Meter PSC Pole (Prestressed Concrete)');
  const [lineVoltage, setLineVoltage] = useState('LT (230V/400V 3-Phase 4-Wire)');
  const [conductorType, setConductorType] = useState('ACSR Weasel / Rabbit Conductor');
  const [actionTaken, setActionTaken] = useState('');
  const [materialUsed, setMaterialUsed] = useState('');
  const [ptwShutdownRef, setPtwShutdownRef] = useState('');

  // Selected Work Order Notice for NSC Entry
  const [selectedWorkOrderNotice, setSelectedWorkOrderNotice] = useState<WorkOrderNotice | null>(initialNotice || null);

  useEffect(() => {
    if (initialNotice) {
      setSelectedWorkOrderNotice(initialNotice);
      if (initialNotice.title && !workOrderNo) {
        setWorkOrderNo(initialNotice.title);
      }
    }
  }, [initialNotice]);

  // 4. METER REPLACEMENT
  const [oldMeterNo, setOldMeterNo] = useState('');
  const [oldMeterReading, setOldMeterReading] = useState('');
  const [replacementReason, setReplacementReason] = useState('মিটার পুড়ে যাওয়া / ডিসপ্লে নষ্ট (Burnt / Faulty Display)');
  const [newMeterNo, setNewMeterNo] = useState('');
  const [newMeterInitialReading, setNewMeterInitialReading] = useState('000000');
  const [newMeterSealNo, setNewMeterSealNo] = useState('');
  const [meterType, setMeterType] = useState('Single Phase Digital Static Electronic');

  // 5. DTR REPLACEMENT
  const [dtrName, setDtrName] = useState('');
  const [existingCapacity, setExistingCapacity] = useState('100 kVA (11/0.433 kV)');
  const [newCapacity, setNewCapacity] = useState('100 kVA (11/0.433 kV)');
  const [oldDtrSerial, setOldDtrSerial] = useState('');
  const [newDtrSerial, setNewDtrSerial] = useState('');
  const [dtrFailureReason, setDtrFailureReason] = useState('কয়েল পুড়ে যাওয়া / ওভারলোড ট্রিপ (Coil Burnt / Overload)');
  const [oilLevelChecked, setOilLevelChecked] = useState(true);
  const [earthPitResistance, setEarthPitResistance] = useState('1.5 Ohms');
  const [hgFuseRating, setHgFuseRating] = useState('22 SWG HG Fuse');
  const [ltMccbAmpere, setLtMccbAmpere] = useState('200 Amps MCCB Box');
  const [lightningArrester, setLightningArrester] = useState('9kV / 10kA LA Connected & OK');

  // Keep worker name synced
  useEffect(() => {
    if (workerName) setWorker(workerName);
  }, [workerName]);

  useEffect(() => {
    setSuccessMessage(null);
  }, [category]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('GPS is not supported by your browser.');
      return;
    }
    setFetchingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
        setLocationGps(coords);
        setFetchingGps(false);
      },
      () => {
        // Fallback WBSEDCL central grid coords
        setLocationGps('22.572646, 88.363895');
        setFetchingGps(false);
      },
      { timeout: 8000 }
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSizeBytes = 50 * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        alert('ফাইল সাইজ ৫০ MB এর বেশি হতে পারবে না (File size must be under 50 MB)');
        return;
      }
      const isVid = file.type.startsWith('video/');
      setIsVideo(isVid);

      if (isVid) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoPreview(reader.result as string);
          clearError('photo');
        };
        reader.readAsDataURL(file);
        return;
      }

      setIsCompressing(true);
      try {
        const compressed = await compressImageFile(file, {
          maxDimension: 1280,
          quality: 0.80,
          watermarkText: `WBSEDCL [${category}]`,
          subText: `${new Date().toLocaleDateString('en-GB')} • Lineman: ${worker || 'Staff'}`,
        });
        setPhotoPreview(compressed);
        clearError('photo');
      } catch (err) {
        console.error('Photo compression error:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoPreview(reader.result as string);
          clearError('photo');
        };
        reader.readAsDataURL(file);
      } finally {
        setIsCompressing(false);
        e.target.value = '';
      }
    }
  };

  const setSamplePhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`WBSEDCL FIELD OPS: ${category}`, 20, 50);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px sans-serif';
      ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, 20, 90);
      ctx.fillText(`Lineman: ${worker}`, 20, 120);
      ctx.fillText(`Ref: ${consumerId || poleNo || dtrName || applicationNo || 'Field Point'}`, 20, 150);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`✓ WBSEDCL Field Evidence Verified`, 20, 200);
      setIsVideo(false);
      setPhotoPreview(canvas.toDataURL());
      clearError('photo');
    }
  };

  const validateForm = (): { isValid: boolean; errors: Record<string, string>; firstElementId?: string } => {
    const errs: Record<string, string> = {};
    let firstId: string | undefined = undefined;

    const recordError = (fieldKey: string, elementId: string, msgBn: string, msgEn: string) => {
      errs[fieldKey] = lang === 'bn' ? msgBn : msgEn;
      if (!firstId) {
        firstId = elementId;
      }
    };

    // 1. Worker Name Validation
    const effectiveWorker = (category === 'NSC' ? nscWorkerName : worker).trim();
    if (!effectiveWorker) {
      recordError(
        'workerName',
        category === 'NSC' ? 'input-nsc-worker-name' : 'input-worker-name',
        'লাইনম্যান বা কর্মীর নাম প্রদান করুন',
        'Lineman/Worker Name is required'
      );
    }

    // 2. Critical Field: Photos / Evidence MUST be present
    if (!photoPreview) {
      recordError(
        'photo',
        'photo-evidence-section',
        'মাঠের কাজের ছবি (Photo Evidence) সংযুক্ত করা বাধ্যতামূলক',
        'Field work photo evidence is mandatory before submission'
      );
    }

    // 3. Category-Specific Critical Validations
    if (category === 'NSC') {
      if (!workOrderNo.trim()) {
        recordError('workOrderNo', 'input-work-order-no', 'ওয়ার্ক অর্ডার নম্বর (Work Order No) প্রদান করুন', 'Work Order Number is required');
      }
      if (!applicationNo.trim()) {
        recordError('applicationNo', 'input-application-no', 'আবেদন নম্বর (Application No) প্রদান করুন', 'Application Number is required');
      }
      if (!consumerId.trim()) {
        recordError('consumerId', 'input-consumer-id', 'কনজিউমার আইডি (Consumer ID) প্রদান করা বাধ্যতামূলক', 'Consumer ID is required');
      } else if (consumerId.trim().length < 4) {
        recordError('consumerId', 'input-consumer-id', 'সঠিক কনজিউমার আইডি লিখুন (কমপক্ষে ৪ সংখ্যা)', 'Enter valid Consumer ID (at least 4 characters)');
      }
      if (!meterNo.trim()) {
        recordError('meterNo', 'input-meter-no', 'নতুন মিটার নম্বর (Meter No) প্রদান করা বাধ্যতামূলক', 'Meter Number is required');
      }
      if (!sealNo.trim()) {
        recordError('sealNo', 'input-seal-no', 'মিটারের সিল নম্বর (Seal No) প্রদান করুন', 'Meter Seal Number is required');
      }
      if (!consumerName.trim()) {
        recordError('consumerName', 'input-consumer-name', 'গ্রাহকের পুরো নাম (Consumer Name) প্রদান করুন', 'Consumer Name is required');
      }
    } else if (category === 'DISCONNECTION') {
      if (!substation.trim()) {
        recordError('substation', 'input-substation', 'সাবস্টেশনের নাম প্রদান করুন', 'Substation name is required');
      }
      if (!feederName.trim()) {
        recordError('feederName', 'input-feeder', 'ফিডারের নাম প্রদান করুন', 'Feeder name is required');
      }
      if (!consumerId.trim()) {
        recordError('consumerId', 'input-consumer-id', 'বিচ্ছিন্নকরণ গ্রাহকের কনজিউমার আইডি (Consumer ID) বাধ্যতামূলক', 'Consumer ID is required');
      } else if (consumerId.trim().length < 4) {
        recordError('consumerId', 'input-consumer-id', 'সঠিক কনজিউমার আইডি লিখুন', 'Enter valid Consumer ID');
      }
      if (!meterNo.trim()) {
        recordError('meterNo', 'input-meter-no', 'বিচ্ছিন্নকৃত মিটার নম্বর (Meter No) প্রদান করা বাধ্যতামূলক', 'Meter Number is required');
      }
      if (!consumerName.trim()) {
        recordError('consumerName', 'input-consumer-name', 'গ্রাহকের নাম (Consumer Name) প্রদান করুন', 'Consumer Name is required');
      }
      if (!arrearAmount.trim()) {
        recordError('arrearAmount', 'input-arrear-amount', 'বকেয়া টাকার পরিমাণ (Arrear Amount) প্রদান করুন', 'Arrear Amount is required');
      }
      if (!finalReading.trim()) {
        recordError('finalReading', 'input-final-reading', 'মিটারের ফাইনাল রিডিং (Final Reading) লিখুন', 'Final Meter Reading is required');
      }
      if (!address.trim()) {
        recordError('address', 'input-address', 'গ্রাহকের ঠিকানা / স্থান প্রদান করুন', 'Premises/Address is required');
      }
    } else if (category === 'METER REPLESMENT') {
      if (!consumerId.trim()) {
        recordError('consumerId', 'input-consumer-id', 'গ্রাহকের কনজিউমার আইডি (Consumer ID) প্রদান করা বাধ্যতামূলক', 'Consumer ID is required');
      } else if (consumerId.trim().length < 4) {
        recordError('consumerId', 'input-consumer-id', 'সঠিক কনজিউমার আইডি লিখুন', 'Enter valid Consumer ID');
      }
      if (!consumerName.trim()) {
        recordError('consumerName', 'input-consumer-name', 'গ্রাহকের নাম (Consumer Name) প্রদান করুন', 'Consumer Name is required');
      }
      if (!oldMeterNo.trim()) {
        recordError('oldMeterNo', 'input-old-meter-no', 'পুরানো মিটার নম্বর (Old Meter No) প্রদান করা বাধ্যতামূলক', 'Old Meter Number is required');
      }
      if (!oldMeterReading.trim()) {
        recordError('oldMeterReading', 'input-old-meter-reading', 'পুরানো মিটারের ফাইনাল রিডিং লিখুন', 'Old Meter Reading is required');
      }
      if (!newMeterNo.trim()) {
        recordError('newMeterNo', 'input-new-meter-no', 'নতুন প্রতিস্থাপিত মিটার নম্বর (New Meter No) প্রদান করা বাধ্যতামূলক', 'New Meter Number is required');
      }
      if (!address.trim()) {
        recordError('address', 'input-address', 'গ্রাহকের ঠিকানা প্রদান করুন', 'Address is required');
      }
    } else if (category === 'POLE CASE') {
      if (!poleNo.trim()) {
        recordError('poleNo', 'input-pole-no', 'পোল নম্বর (Pole No) প্রদান করা বাধ্যতামূলক', 'Pole Number is required');
      }
      if (!address.trim()) {
        recordError('address', 'input-address', 'কাজের স্থান / লাইন রুটের ঠিকানা প্রদান করুন', 'Location / Line route address is required');
      }
    } else if (category === 'DTR REPLESMENT') {
      if (!dtrName.trim()) {
        recordError('dtrName', 'input-dtr-name', 'DTR নাম / ট্রান্সফরমার আইডি প্রদান করা বাধ্যতামূলক', 'DTR Name / Transformer ID is required');
      }
      if (!newDtrSerial.trim()) {
        recordError('newDtrSerial', 'input-new-dtr-serial', 'নতুন DTR সিরিয়াল নম্বর (New DTR Serial) প্রদান করুন', 'New DTR Serial Number is required');
      }
      if (!address.trim()) {
        recordError('address', 'input-address', 'DTR লোকেশন / ইয়ার্ডের ঠিকানা প্রদান করুন', 'Location / Sub-station Yard address is required');
      }
    }

    return {
      isValid: Object.keys(errs).length === 0,
      errors: errs,
      firstElementId: firstId,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);

    const validation = validateForm();
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      if (validation.firstElementId) {
        setTimeout(() => {
          const el = document.getElementById(validation.firstElementId!);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if ('focus' in el) {
              (el as HTMLElement).focus();
            }
          }
        }, 60);
      }
      return;
    }

    setValidationErrors({});
    setLoading(true);
    setSuccessMessage(null);

    const generatedId = `PWR-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();

    const entryPayload: Partial<PowerEntry> = {
      id: generatedId,
      category,
      workerName: (category === 'NSC' ? nscWorkerName : worker).trim(),
      workerPhone: workerPhone.trim(),
      date: nowIso,
      status: 'Completed',
      locationGps,
      photoUrl: photoPreview || undefined,
      notes: notes.trim(),
    };

    // Category specifics
    if (category === 'NSC') {
      entryPayload.workOrderNo = workOrderNo.trim();
      entryPayload.workOrderDate = workOrderDate;
      // Attach Official Work Order & Khata Photo uploaded by Admin
      if (selectedWorkOrderNotice) {
        entryPayload.workOrderPhoto = selectedWorkOrderNotice.photoUrl;
        entryPayload.workOrderNoticeId = selectedWorkOrderNotice.id;
        entryPayload.workOrderNoticeTitle = selectedWorkOrderNotice.title;
        entryPayload.workOrderNoticeDate = `${selectedWorkOrderNotice.uploadDate} ${selectedWorkOrderNotice.uploadTime}`;
      }
      entryPayload.consumerName = consumerName.trim();
      entryPayload.fatherName = fatherName.trim();
      entryPayload.applicationNo = applicationNo.trim();
      entryPayload.workerName = nscWorkerName.trim() || worker.trim();
      entryPayload.agencyName = agencyName.trim();
      entryPayload.cccName = cccName.trim();
      entryPayload.consumerId = consumerId.trim();
      entryPayload.meterNo = meterNo.trim();
      entryPayload.sealNo = sealNo.trim();
      entryPayload.initialReading = initialReading.trim() || '000000';
      entryPayload.mobile = mobile.trim();
      entryPayload.appliedLoad = appliedLoad.trim();
      entryPayload.phase = phase;
      entryPayload.tariffCategory = tariffCategory;
      entryPayload.serviceCableLength = serviceCableLength.trim();
      entryPayload.address = address.trim() || 'West Bengal, India';
      entryPayload.meterInstallDate = meterInstallDate;
      entryPayload.inspectionAgencyName = inspectionAgencyName.trim();
      entryPayload.poleNo = poleNo.trim();
      entryPayload.meterMake = meterMake.trim();
      entryPayload.earthResistance = earthResistance.trim();
    } else if (category === 'DISCONNECTION') {
      entryPayload.feederName = feederName.trim();
      entryPayload.substation = substation.trim();
      entryPayload.consumerId = consumerId.trim();
      entryPayload.consumerName = consumerName.trim();
      entryPayload.mobile = mobile.trim();
      entryPayload.address = address.trim();
      entryPayload.poleNo = poleNo.trim();
      entryPayload.meterNo = meterNo.trim();
      entryPayload.arrearAmount = arrearAmount.trim();
      entryPayload.reason = disconnectionReason;
      entryPayload.finalReading = finalReading.trim();
      entryPayload.disconnectionType = disconnectionType;
      entryPayload.cutoutSealed = cutoutSealed;
      entryPayload.sealNo = cutoutSealNo.trim();
      entryPayload.actionTaken = disconnectionActionTaken;
    } else if (category === 'POLE CASE') {
      entryPayload.feederName = feederName.trim();
      entryPayload.substation = substation.trim();
      entryPayload.poleNo = poleNo.trim();
      entryPayload.address = address.trim();
      entryPayload.issueType = issueType;
      entryPayload.priority = priority;
      entryPayload.poleType = poleType;
      entryPayload.lineVoltage = lineVoltage;
      entryPayload.conductorType = conductorType;
      entryPayload.actionTaken = actionTaken.trim() || 'পোল মেরামত ও ওভারহেড লাইন নিরাপদ করা হয়েছে';
      entryPayload.materialUsed = materialUsed.trim();
      entryPayload.ptwShutdownRef = ptwShutdownRef.trim();
    } else if (category === 'METER REPLESMENT') {
      entryPayload.feederName = feederName.trim();
      entryPayload.substation = substation.trim();
      entryPayload.consumerId = consumerId.trim();
      entryPayload.consumerName = consumerName.trim();
      entryPayload.address = address.trim();
      entryPayload.poleNo = poleNo.trim();
      entryPayload.oldMeterNo = oldMeterNo.trim();
      entryPayload.finalReading = oldMeterReading.trim();
      entryPayload.replacementReason = replacementReason;
      entryPayload.newMeterNo = newMeterNo.trim();
      entryPayload.initialReading = newMeterInitialReading.trim() || '000000';
      entryPayload.sealNo = newMeterSealNo.trim();
      entryPayload.meterType = meterType;
      entryPayload.phase = phase;
    } else if (category === 'DTR REPLESMENT') {
      entryPayload.feederName = feederName.trim();
      entryPayload.substation = substation.trim();
      entryPayload.dtrName = dtrName.trim();
      entryPayload.address = address.trim();
      entryPayload.existingCapacity = existingCapacity;
      entryPayload.newCapacity = newCapacity;
      entryPayload.oldDtrSerial = oldDtrSerial.trim();
      entryPayload.newDtrSerial = newDtrSerial.trim();
      entryPayload.failureReason = dtrFailureReason;
      entryPayload.oilLevelChecked = oilLevelChecked;
      entryPayload.earthResistance = earthResistance.trim() || earthPitResistance.trim();
      entryPayload.hgFuseRating = hgFuseRating.trim();
      entryPayload.ltMccbAmpere = ltMccbAmpere.trim();
      entryPayload.lightningArrester = lightningArrester.trim();
    }

    try {
      const created = await createEntry(entryPayload);
      try {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      } catch (e) {
        // ignore
      }
      // Asynchronously append to Google Sheet if Google Auth is active
      appendEntryToGoogleSheet(created).catch((sheetErr) => {
        console.warn('Google Sheet auto-sync notice:', sheetErr);
      });

      setSuccessMessage(t.entryCreatedSuccess);
      setSubmissionModalEntry(created);
      onSuccess(created);
    } catch (err: any) {
      console.error('Error creating entry:', err);
      alert('Error saving data: ' + (err.message || 'Check connection'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-200">
      {/* Form Header */}
      <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
        <div className="flex items-center gap-3.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-11 h-11 rounded-xl bg-blue-600/30 border border-blue-400/40 text-blue-400 flex items-center justify-center font-bold">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                WBSEDCL • {category}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                {t.liveStatus}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-1">
              {category === 'NSC' && t.nscTitle}
              {category === 'DISCONNECTION' && t.disconnectionTitle}
              {category === 'POLE CASE' && t.poleCaseTitle}
              {category === 'METER REPLESMENT' && t.meterReplacementTitle}
              {category === 'DTR REPLESMENT' && t.dtrReplacementTitle}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {t.wbsedclStandard}
            </p>
          </div>
        </div>

        <div className="text-right hidden sm:block">
          <div className="text-xs text-slate-400 font-medium">{t.workerName}</div>
          <div className="text-sm font-bold text-amber-400">{worker}</div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border-b border-emerald-200 text-emerald-800 flex items-center gap-3 text-sm font-bold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* WORK ORDER / KHATA PHOTO BOARD (Independent Work Order Board for NSC) */}
      {category === 'NSC' && (
        <div className="p-5 sm:p-7 pb-0">
          <WorkOrderNoticeSection 
            category={category} 
            currentUser={currentUser} 
            lang={lang} 
            selectedNoticeId={selectedWorkOrderNotice?.id}
            onSelectNotice={(notice) => setSelectedWorkOrderNotice(notice)}
          />
        </div>
      )}

      {/* Main Form Fields */}
      <form onSubmit={handleSubmit} noValidate className="p-5 sm:p-7 space-y-6">
        {/* Top Validation Error Alert Banner */}
        {hasAttemptedSubmit && Object.keys(validationErrors).length > 0 && (
          <div 
            id="validation-summary-banner"
            className="p-4 sm:p-5 bg-red-50 border-2 border-red-500 rounded-2xl text-red-950 space-y-3 shadow-md animate-in fade-in slide-in-from-top-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm sm:text-base font-black text-red-900 leading-tight">
                  {lang === 'bn' 
                    ? `⚠️ ফর্ম সাবমিট অসম্পূর্ণ: ${Object.keys(validationErrors).length}টি প্রয়োজনীয় তথ্য বাদ পড়েছে!`
                    : `⚠️ Form Submission Blocked: ${Object.keys(validationErrors).length} required field(s) missing!`}
                </h4>
                <p className="text-xs text-red-700 mt-1 font-medium">
                  {lang === 'bn'
                    ? 'তথ্য সেভ না হওয়া প্রতিরোধ করতে লাল চিহ্নিত প্রয়োজনীয় ঘরগুলো (বিশেষ করে কনজিউমার আইডি, মিটার নম্বর ও কাজের ছবি) পূরণ করুন।'
                    : 'To prevent records from failing to save, please complete the red-flagged critical fields (Consumer ID, Meter Number, and Photo Evidence).'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {Object.entries(validationErrors).map(([key, msg]) => (
                <div 
                  key={key} 
                  className="flex items-center gap-2 bg-white/90 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-bold text-red-800 shadow-2xs"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 1: Common Station & Grid Infrastructure Details (Hidden for NSC as requested) */}
        {category !== 'NSC' && (
          <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <Building className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. {t.substation} & {t.feeder}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.substation} *
                </label>
                <input
                  id="input-substation"
                  type="text"
                  required
                  value={substation}
                  onChange={(e) => {
                    setSubstation(e.target.value);
                    clearError('substation');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:ring-2 focus:outline-none ${validationErrors.substation ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="e.g. 33/11kV Main Substation"
                />
                {validationErrors.substation && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.substation}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.feeder} *
                </label>
                <input
                  id="input-feeder"
                  type="text"
                  required
                  value={feederName}
                  onChange={(e) => {
                    setFeederName(e.target.value);
                    clearError('feederName');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:ring-2 focus:outline-none ${validationErrors.feederName ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="e.g. 11kV Town Feeder-01"
                />
                {validationErrors.feederName && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.feederName}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.workerName} (Lineman) *
                </label>
                <input
                  id="input-worker-name"
                  type="text"
                  required
                  value={worker}
                  onChange={(e) => {
                    setWorker(e.target.value);
                    clearError('workerName');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 font-semibold focus:ring-2 focus:outline-none ${validationErrors.workerName ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="Lineman / Worker Name"
                />
                {validationErrors.workerName && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.workerName}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.cccOffice}
                </label>
                <input
                  type="text"
                  value={cccOffice}
                  onChange={(e) => setCccOffice(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Customer Care Center (CCC)"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Category Specific Primary Fields */}
        <div className="space-y-4">
          {/* Section Heading: Green for NSC Form */}
          {category === 'NSC' ? (
            <div className="flex items-center justify-between border-2 border-emerald-400 bg-emerald-50/90 p-3.5 rounded-xl shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-emerald-800 tracking-tight uppercase">
                    1. NSC FORM PARAMETERS (WBSEDCL)
                  </h3>
                  <p className="text-[11px] text-emerald-700 font-semibold">
                    {lang === 'bn' ? 'নতুন সার্ভিস কানেকশন অফিশিয়াল ফর্ম ফিল্ড' : 'New Service Connection Official Parameters'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-xs">
                Official Green Form
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                2. {category} Field Parameters (WBSEDCL Standard)
              </h3>
            </div>
          )}

          {/* 1. NSC SPECIFIC FORM WITH DISTINCT COLOR CODED FIELDS */}
          {category === 'NSC' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
              {/* 1. Lineman / Staff Name (Worker Name - Above Work Order No) -> VIBRANT BLUE CARD */}
              <div className={`rounded-xl p-3.5 shadow-xs transition-all ${validationErrors.workerName ? 'bg-red-50/90 border-2 border-red-500 ring-2 ring-red-300' : 'bg-blue-50/80 border-2 border-blue-300 hover:border-blue-400'}`}>
                <label className="block font-black text-blue-950 mb-1.5 text-xs flex items-center justify-between">
                  <span>{t.workerName} (Worker Name / Lineman) *</span>
                  <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">Staff</span>
                </label>
                <input
                  id="input-nsc-worker-name"
                  type="text"
                  required
                  value={nscWorkerName}
                  onChange={(e) => {
                    setNscWorkerName(e.target.value);
                    clearError('workerName');
                  }}
                  className={`w-full px-3 py-2 bg-white border-2 rounded-lg font-bold focus:ring-2 focus:outline-none ${validationErrors.workerName ? 'border-red-400 text-red-900 focus:ring-red-500' : 'border-blue-300 text-blue-900 focus:ring-blue-500'}`}
                  placeholder="Lineman / Worker Name"
                />
                {validationErrors.workerName && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.workerName}</span>
                  </p>
                )}
              </div>

              {/* 2. Agency Name (Above Work Order No) -> VIBRANT AMBER / ORANGE CARD */}
              <div className="bg-amber-50/80 border-2 border-amber-300 rounded-xl p-3.5 shadow-xs hover:border-amber-400 transition-colors">
                <label className="block font-black text-amber-950 mb-1.5 text-xs flex items-center justify-between">
                  <span>{t.agencyName} (Agency Name)</span>
                  <span className="text-[9px] bg-amber-600 text-white px-1.5 py-0.5 rounded font-bold">Agency</span>
                </label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-amber-300 rounded-lg text-amber-900 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="Contractor / Agency Name"
                />
              </div>

              {/* 3. CCC Name (Above Work Order No) -> VIBRANT PURPLE CARD */}
              <div className="bg-purple-50/80 border-2 border-purple-300 rounded-xl p-3.5 shadow-xs hover:border-purple-400 transition-colors">
                <label className="block font-black text-purple-950 mb-1.5 text-xs flex items-center justify-between">
                  <span>{t.cccName} (CCC Name)</span>
                  <span className="text-[9px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-bold">CCC Unit</span>
                </label>
                <input
                  type="text"
                  value={cccName}
                  onChange={(e) => setCccName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-purple-300 rounded-lg text-purple-900 font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="e.g. CCC Office Name"
                />
              </div>

              {/* 4. Work Order No -> TEAL CARD */}
              <div className={`rounded-xl p-3.5 shadow-xs transition-all ${validationErrors.workOrderNo ? 'bg-red-50/90 border-2 border-red-500 ring-2 ring-red-300' : 'bg-teal-50/80 border-2 border-teal-300 hover:border-teal-400'}`}>
                <label className="block font-black text-teal-950 mb-1.5 text-xs flex items-center justify-between">
                  <span>{t.workOrderNo} *</span>
                  <span className="text-[9px] bg-teal-600 text-white px-1.5 py-0.5 rounded font-bold font-mono">WO</span>
                </label>
                <input
                  id="input-work-order-no"
                  type="text"
                  required
                  value={workOrderNo}
                  onChange={(e) => {
                    setWorkOrderNo(e.target.value);
                    clearError('workOrderNo');
                  }}
                  className={`w-full px-3 py-2 bg-white border-2 rounded-lg font-mono font-black focus:ring-2 focus:outline-none ${validationErrors.workOrderNo ? 'border-red-400 text-red-900 focus:ring-red-500' : 'border-teal-300 text-teal-900 focus:ring-teal-500'}`}
                  placeholder="e.g. WO-2026-98102"
                />
                {validationErrors.workOrderNo && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.workOrderNo}</span>
                  </p>
                )}
              </div>

              {/* 5. Work Order Date -> TEAL CARD */}
              <div className="bg-teal-50/80 border-2 border-teal-300 rounded-xl p-3.5 shadow-xs hover:border-teal-400 transition-colors">
                <label className="block font-black text-teal-950 mb-1.5 text-xs">
                  {t.workOrderDate} *
                </label>
                <input
                  type="date"
                  required
                  value={workOrderDate}
                  onChange={(e) => setWorkOrderDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-teal-300 rounded-lg text-teal-900 font-bold focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* 6. Application No (Above Consumer Name) -> ROSE / PINK CARD */}
              <div className={`rounded-xl p-3.5 shadow-xs transition-all ${validationErrors.applicationNo ? 'bg-red-50/90 border-2 border-red-500 ring-2 ring-red-300' : 'bg-rose-50/80 border-2 border-rose-300 hover:border-rose-400'}`}>
                <label className="block font-black text-rose-950 mb-1.5 text-xs flex items-center justify-between">
                  <span>{t.applicationNo} *</span>
                  <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-bold font-mono">App No</span>
                </label>
                <input
                  id="input-application-no"
                  type="text"
                  required
                  value={applicationNo}
                  onChange={(e) => {
                    setApplicationNo(e.target.value);
                    clearError('applicationNo');
                  }}
                  className={`w-full px-3 py-2 bg-white border-2 rounded-lg font-mono font-black text-xs focus:ring-2 focus:outline-none ${validationErrors.applicationNo ? 'border-red-400 text-red-900 focus:ring-red-500' : 'border-rose-300 text-rose-900 focus:ring-rose-500'}`}
                  placeholder="e.g. CA / Quota / Application No"
                />
                {validationErrors.applicationNo && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.applicationNo}</span>
                  </p>
                )}
              </div>

              {/* 7. Consumer ID (Above Consumer Name) -> SKY BLUE CARD */}
              <div className={`rounded-xl p-3.5 shadow-xs transition-all ${validationErrors.consumerId ? 'bg-red-50/90 border-2 border-red-500 ring-2 ring-red-300' : 'bg-sky-50/80 border-2 border-sky-300 hover:border-sky-400'}`}>
                <label className="block font-black text-sky-950 mb-1.5 text-xs flex items-center justify-between">
                  <span>{t.consumerId} * (বাধ্যতামূলক)</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono text-white ${validationErrors.consumerId ? 'bg-red-600' : 'bg-sky-600'}`}>ID</span>
                </label>
                <input
                  id="input-consumer-id"
                  type="text"
                  required
                  value={consumerId}
                  onChange={(e) => {
                    setConsumerId(e.target.value);
                    clearError('consumerId');
                  }}
                  className={`w-full px-3 py-2 bg-white border-2 rounded-lg font-mono font-black focus:ring-2 focus:outline-none ${validationErrors.consumerId ? 'border-red-400 text-red-900 focus:ring-red-500' : 'border-sky-300 text-sky-900 focus:ring-sky-500'}`}
                  placeholder="e.g. 100293847 (9 Digits)"
                />
                {validationErrors.consumerId && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.consumerId}</span>
                  </p>
                )}
              </div>

              {/* 8. Meter No (Above Consumer Name) -> EMERALD GREEN CARD */}
              <div className={`rounded-xl p-3.5 shadow-xs transition-all ${validationErrors.meterNo ? 'bg-red-50/90 border-2 border-red-500 ring-2 ring-red-300' : 'bg-emerald-50/80 border-2 border-emerald-300 hover:border-emerald-400'}`}>
                <label className="block font-black text-emerald-950 mb-1.5 text-xs flex items-center justify-between">
                  <span>{t.meterNo} * (বাধ্যতামূলক)</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono text-white ${validationErrors.meterNo ? 'bg-red-600' : 'bg-emerald-600'}`}>Meter</span>
                </label>
                <input
                  id="input-meter-no"
                  type="text"
                  required
                  value={meterNo}
                  onChange={(e) => {
                    setMeterNo(e.target.value);
                    clearError('meterNo');
                  }}
                  className={`w-full px-3 py-2 bg-white border-2 rounded-lg font-mono font-black focus:ring-2 focus:outline-none ${validationErrors.meterNo ? 'border-red-400 text-red-900 focus:ring-red-500' : 'border-emerald-300 text-emerald-900 focus:ring-emerald-500'}`}
                  placeholder="e.g. WB26-987654"
                />
                {validationErrors.meterNo && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.meterNo}</span>
                  </p>
                )}
              </div>

              {/* 9. Meter Seal No (Above Consumer Name) -> VIOLET CARD */}
              <div className={`rounded-xl p-3.5 shadow-xs transition-all ${validationErrors.sealNo ? 'bg-red-50/90 border-2 border-red-500 ring-2 ring-red-300' : 'bg-violet-50/80 border-2 border-violet-300 hover:border-violet-400'}`}>
                <label className="block font-black text-violet-950 mb-1.5 text-xs flex items-center justify-between">
                  <span>{t.meterSealNo} *</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono text-white ${validationErrors.sealNo ? 'bg-red-600' : 'bg-violet-600'}`}>Seal</span>
                </label>
                <input
                  id="input-seal-no"
                  type="text"
                  required
                  value={sealNo}
                  onChange={(e) => {
                    setSealNo(e.target.value);
                    clearError('sealNo');
                  }}
                  className={`w-full px-3 py-2 bg-white border-2 rounded-lg font-mono font-black focus:ring-2 focus:outline-none ${validationErrors.sealNo ? 'border-red-400 text-red-900 focus:ring-red-500' : 'border-violet-300 text-violet-900 focus:ring-violet-500'}`}
                  placeholder="e.g. WB-SL-98214"
                />
                {validationErrors.sealNo && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.sealNo}</span>
                  </p>
                )}
              </div>

              {/* 10. Consumer Name -> INDIGO CARD */}
              <div className={`rounded-xl p-3.5 shadow-xs transition-all ${validationErrors.consumerName ? 'bg-red-50/90 border-2 border-red-500 ring-2 ring-red-300' : 'bg-indigo-50/80 border-2 border-indigo-300 hover:border-indigo-400'}`}>
                <label className="block font-black text-indigo-950 mb-1.5 text-xs">
                  {t.consumerName} *
                </label>
                <input
                  id="input-consumer-name"
                  type="text"
                  required
                  value={consumerName}
                  onChange={(e) => {
                    setConsumerName(e.target.value);
                    clearError('consumerName');
                  }}
                  className={`w-full px-3 py-2 bg-white border-2 rounded-lg font-bold focus:ring-2 focus:outline-none ${validationErrors.consumerName ? 'border-red-400 text-red-900 focus:ring-red-500' : 'border-indigo-300 text-indigo-900 focus:ring-indigo-500'}`}
                  placeholder="Enter Full Consumer Name"
                />
                {validationErrors.consumerName && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.consumerName}</span>
                  </p>
                )}
              </div>

              {/* 11. Father's / Husband's Name -> INDIGO CARD */}
              <div className="bg-indigo-50/80 border-2 border-indigo-300 rounded-xl p-3.5 shadow-xs hover:border-indigo-400 transition-colors">
                <label className="block font-black text-indigo-950 mb-1.5 text-xs">
                  {t.fatherHusbandName}
                </label>
                <input
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-indigo-300 rounded-lg text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                  placeholder="Father's / Husband's Name"
                />
              </div>

              {/* 12. Mobile No -> ORANGE CARD */}
              <div className="bg-orange-50/80 border-2 border-orange-300 rounded-xl p-3.5 shadow-xs hover:border-orange-400 transition-colors">
                <label className="block font-black text-orange-950 mb-1.5 text-xs">
                  {t.mobileNo}
                </label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-orange-300 rounded-lg text-orange-900 focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono font-bold"
                  placeholder="e.g. 98300XXXXX"
                />
              </div>

              {/* 13. Initial Meter Reading -> ORANGE CARD */}
              <div className="bg-orange-50/80 border-2 border-orange-300 rounded-xl p-3.5 shadow-xs hover:border-orange-400 transition-colors">
                <label className="block font-black text-orange-950 mb-1.5 text-xs">
                  {t.initialReading}
                </label>
                <input
                  type="text"
                  value={initialReading}
                  onChange={(e) => setInitialReading(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-orange-300 rounded-lg text-orange-900 focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono font-bold"
                  placeholder="000000"
                />
              </div>

              {/* 14. Sanctioned Load (kW) -> CYAN CARD */}
              <div className="bg-cyan-50/80 border-2 border-cyan-300 rounded-xl p-3.5 shadow-xs hover:border-cyan-400 transition-colors">
                <label className="block font-black text-cyan-950 mb-1.5 text-xs">
                  {t.appliedLoad}
                </label>
                <input
                  type="text"
                  value={appliedLoad}
                  onChange={(e) => setAppliedLoad(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-cyan-300 rounded-lg text-cyan-900 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  placeholder="e.g. 2 kW (যা প্রযোজ্য লিখুন)"
                />
              </div>

              {/* 15. Supply Phase -> CYAN CARD */}
              <div className="bg-cyan-50/80 border-2 border-cyan-300 rounded-xl p-3.5 shadow-xs hover:border-cyan-400 transition-colors">
                <label className="block font-black text-cyan-950 mb-1.5 text-xs">
                  {t.phaseSupply}
                </label>
                <input
                  type="text"
                  value={phase}
                  onChange={(e) => setPhase(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-cyan-300 rounded-lg text-cyan-900 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  placeholder="e.g. 1-Phase / 3-Phase (যা প্রযোজ্য লিখুন)"
                />
              </div>

              {/* 16. Tariff Class -> LIME CARD */}
              <div className="bg-lime-50/80 border-2 border-lime-300 rounded-xl p-3.5 shadow-xs hover:border-lime-400 transition-colors">
                <label className="block font-black text-lime-950 mb-1.5 text-xs">
                  {t.tariffCategory}
                </label>
                <input
                  type="text"
                  value={tariffCategory}
                  onChange={(e) => setTariffCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-lime-300 rounded-lg text-lime-900 font-bold focus:ring-2 focus:ring-lime-500 focus:outline-none"
                  placeholder="e.g. Domestic (A-Dom) / Commercial (B-Com)"
                />
              </div>

              {/* 17. Service Cable Size & Length -> LIME CARD */}
              <div className="bg-lime-50/80 border-2 border-lime-300 rounded-xl p-3.5 shadow-xs hover:border-lime-400 transition-colors">
                <label className="block font-black text-lime-950 mb-1.5 text-xs">
                  {t.serviceCableLength}
                </label>
                <input
                  type="text"
                  value={serviceCableLength}
                  onChange={(e) => setServiceCableLength(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-lime-300 rounded-lg text-lime-900 font-bold focus:ring-2 focus:ring-lime-500 focus:outline-none"
                  placeholder="e.g. 25 Meters (2Cx10 sq.mm PVC/Armoured)"
                />
              </div>

              {/* 18. Premises / Village / GP Address -> SLATE CARD (Span 3) */}
              <div className="bg-slate-100/90 border-2 border-slate-300 rounded-xl p-3.5 shadow-xs sm:col-span-2 lg:col-span-3 hover:border-slate-400 transition-colors">
                <label className="block font-black text-slate-950 mb-1.5 text-xs">
                  {t.addressLocation} *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-slate-700 focus:outline-none"
                  placeholder="Village / GP / Municipality / Post Office / Pin Code"
                />
              </div>

              {/* 19. Meter Install Date -> FUCHSIA CARD */}
              <div className="bg-fuchsia-50/80 border-2 border-fuchsia-300 rounded-xl p-3.5 shadow-xs hover:border-fuchsia-400 transition-colors">
                <label className="block font-black text-fuchsia-950 mb-1.5 text-xs">
                  {t.meterInstallDate} *
                </label>
                <input
                  type="date"
                  required
                  value={meterInstallDate}
                  onChange={(e) => setMeterInstallDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-fuchsia-300 rounded-lg text-fuchsia-900 font-bold focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                />
              </div>

              {/* 20. Inspection Agency Name -> FUCHSIA CARD */}
              <div className="bg-fuchsia-50/80 border-2 border-fuchsia-300 rounded-xl p-3.5 shadow-xs hover:border-fuchsia-400 transition-colors">
                <label className="block font-black text-fuchsia-950 mb-1.5 text-xs">
                  {t.inspectionAgencyName}
                </label>
                <input
                  type="text"
                  value={inspectionAgencyName}
                  onChange={(e) => setInspectionAgencyName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-fuchsia-300 rounded-lg text-fuchsia-900 font-bold focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                  placeholder="Third-party / Inspection Agency Name"
                />
              </div>
            </div>
          )}

          {/* 2. DISCONNECTION SPECIFIC FORM */}
          {category === 'DISCONNECTION' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{t.consumerId} *</span>
                  <span className="text-[10px] text-red-600 font-bold">বাধ্যতামূলক</span>
                </label>
                <input
                  id="input-consumer-id"
                  type="text"
                  required
                  value={consumerId}
                  onChange={(e) => {
                    setConsumerId(e.target.value);
                    clearError('consumerId');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:outline-none ${validationErrors.consumerId ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="e.g. 100234567"
                />
                {validationErrors.consumerId && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.consumerId}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{t.meterNo} (বিচ্ছিন্নকৃত মিটার) *</span>
                  <span className="text-[10px] text-red-600 font-bold">বাধ্যতামূলক</span>
                </label>
                <input
                  id="input-meter-no"
                  type="text"
                  required
                  value={meterNo}
                  onChange={(e) => {
                    setMeterNo(e.target.value);
                    clearError('meterNo');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:outline-none ${validationErrors.meterNo ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="e.g. WB26-981240"
                />
                {validationErrors.meterNo && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.meterNo}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.consumerName} *
                </label>
                <input
                  id="input-consumer-name"
                  type="text"
                  required
                  value={consumerName}
                  onChange={(e) => {
                    setConsumerName(e.target.value);
                    clearError('consumerName');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 font-semibold focus:ring-2 focus:outline-none ${validationErrors.consumerName ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="Consumer Full Name"
                />
                {validationErrors.consumerName && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.consumerName}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.arrearAmount} *
                </label>
                <input
                  id="input-arrear-amount"
                  type="text"
                  required
                  value={arrearAmount}
                  onChange={(e) => {
                    setArrearAmount(e.target.value);
                    clearError('arrearAmount');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg font-mono font-bold text-red-600 focus:ring-2 focus:outline-none ${validationErrors.arrearAmount ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="e.g. ₹ 7,850"
                />
                {validationErrors.arrearAmount && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.arrearAmount}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.finalReading} (kWh) *
                </label>
                <input
                  id="input-final-reading"
                  type="text"
                  required
                  value={finalReading}
                  onChange={(e) => {
                    setFinalReading(e.target.value);
                    clearError('finalReading');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:outline-none ${validationErrors.finalReading ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="e.g. 14230"
                />
                {validationErrors.finalReading && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.finalReading}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.noticeNo}
                </label>
                <input
                  type="text"
                  value={noticeNo}
                  onChange={(e) => setNoticeNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="Sec 56 Notice: WB/DIS/2026/04"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.disconnectionType}
                </label>
                <select
                  value={disconnectionType}
                  onChange={(e) => setDisconnectionType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold"
                >
                  <option value="Defaulter / Non-Payment">বকেয়া বিল খেলাপী (Unpaid Arrears)</option>
                  <option value="Permanent Disconnection (PD)">স্থায়ী বিচ্ছিন্নকরণ (Permanent PD)</option>
                  <option value="Consumer Voluntary Request">গ্রাহকের নিজস্ব আবেদন (Voluntary)</option>
                  <option value="Unauthorized Theft / U/S 135">অবৈধ হুকিং ও বিদ্যুৎ চুরি (Section 135)</option>
                  <option value="Safety Hazard / Fire Risk">নিরাপত্তা ঝুঁকি (Safety Hazard)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.cutoutSealed}
                </label>
                <div className="flex items-center gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={cutoutSealed}
                      onChange={(e) => setCutoutSealed(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span>{cutoutSealed ? 'হ্যাঁ (Sealed)' : 'না (Not Sealed)'}</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.cutoutSealNo}
                </label>
                <input
                  type="text"
                  value={cutoutSealNo}
                  onChange={(e) => setCutoutSealNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="e.g. CUT-SL-4412"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.poleNo}
                </label>
                <input
                  type="text"
                  value={poleNo}
                  onChange={(e) => setPoleNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="e.g. Pole P-18 / Sub-Span"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">
                  {t.addressLocation} *
                </label>
                <input
                  id="input-address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    clearError('address');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:ring-2 focus:outline-none ${validationErrors.address ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="Premises / Shop / Residence Address"
                />
                {validationErrors.address && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.address}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 3. POLE CASE SPECIFIC FORM */}
          {category === 'POLE CASE' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{t.poleNo} *</span>
                  <span className="text-[10px] text-red-600 font-bold">বাধ্যতামূলক</span>
                </label>
                <input
                  id="input-pole-no"
                  type="text"
                  required
                  value={poleNo}
                  onChange={(e) => {
                    setPoleNo(e.target.value);
                    clearError('poleNo');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:outline-none ${validationErrors.poleNo ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="e.g. Pole No P-84 / Span 04"
                />
                {validationErrors.poleNo && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.poleNo}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.poleType}
                </label>
                <select
                  value={poleType}
                  onChange={(e) => setPoleType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="9-Meter PSC Pole (Prestressed Concrete)">9-Meter PSC Pole</option>
                  <option value="8-Meter PSC Pole">8-Meter PSC Pole (LT)</option>
                  <option value="Steel Tubular Pole (STP 9m/11m)">Steel Tubular Pole (STP)</option>
                  <option value="Rail Pole (Heavy Duty)">Rail Pole</option>
                  <option value="Spun Pre-stressed Concrete Pole">Spun Concrete Pole</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.lineVoltage}
                </label>
                <select
                  value={lineVoltage}
                  onChange={(e) => setLineVoltage(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="LT (230V/400V 3-Phase 4-Wire)">LT (230V/400V 3-Phase)</option>
                  <option value="11 kV High Tension (HT)">11 kV High Tension (HT Line)</option>
                  <option value="33 kV Main Grid Line">33 kV Main Line</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.issueType} *
                </label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-rose-700"
                >
                  <option value="ঝড়ে পোল ভাঙা / হেলে পড়া (Storm Damaged/Tilted)">ঝড়ে পোল ভাঙা / হেলে পড়া (Storm Broken/Tilted)</option>
                  <option value="কন্ডাক্টর ছেঁড়া / তার বিচ্ছিন্ন (Conductor Snapped)">কন্ডাক্টর ছেঁড়া / তার বিচ্ছিন্ন (Conductor Snapped)</option>
                  <option value="ইনসুলেটর ভাঙা / ফ্ল্যাশওভার (Broken Insulator/Pin)">ইনসুলেটর ফ্ল্যাশওভার (Broken Insulator)</option>
                  <option value="গাছের ডাল পড়ে ফল্ট (Tree Branch Falling)">গাছের ডাল পড়ে ফল্ট (Tree Branch Fault)</option>
                  <option value="স্টে ওয়্যার ছেঁড়া / আলগা (Stay Wire Damaged)">স্টে ওয়্যার ক্ষতিগ্রস্থ (Stay Wire Damaged)</option>
                  <option value="নিউট্রাল তার পুড়ে ফল্ট (Neutral Burn)">নিউট্রাল তার বার্ন (Neutral Burn)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.priority}
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold"
                >
                  <option value="Urgent">জরুরী (Urgent Emergency)</option>
                  <option value="High">উচ্চ অগ্রাধিকার (High)</option>
                  <option value="Normal">সাধারণ (Normal)</option>
                  <option value="Low">কম (Low)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.conductorType}
                </label>
                <input
                  type="text"
                  value={conductorType}
                  onChange={(e) => setConductorType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. ACSR Rabbit (50mm²) / Weasel (30mm²)"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{t.actionTaken} *</span>
                  <span className="text-[10px] text-red-600 font-bold">বাধ্যতামূলক</span>
                </label>
                <input
                  id="input-action-taken"
                  type="text"
                  required
                  value={actionTaken}
                  onChange={(e) => {
                    setActionTaken(e.target.value);
                    clearError('actionTaken');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:ring-2 focus:outline-none ${validationErrors.actionTaken ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="e.g. নতুন পোল স্থাপন, কংক্রিটিং ও কন্ডাক্টর টানা সম্পন্ন"
                />
                {validationErrors.actionTaken && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.actionTaken}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.ptwShutdownRef}
                </label>
                <input
                  type="text"
                  value={ptwShutdownRef}
                  onChange={(e) => setPtwShutdownRef(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="PTW Ref: SD/2026/09"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">
                  {t.materialUsed}
                </label>
                <input
                  type="text"
                  value={materialUsed}
                  onChange={(e) => setMaterialUsed(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. 1x PSC Pole, 2x V-Cross Arm, 3x Pin Insulators, 1x Stay Set Complete"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{t.addressLocation} *</span>
                  <span className="text-[10px] text-red-600 font-bold">বাধ্যতামূলক</span>
                </label>
                <input
                  id="input-address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    clearError('address');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:ring-2 focus:outline-none ${validationErrors.address ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="Location landmark / Village / Road point"
                />
                {validationErrors.address && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.address}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 4. METER REPLACEMENT SPECIFIC FORM */}
          {category === 'METER REPLESMENT' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{t.consumerId} *</span>
                  <span className="text-[10px] text-red-600 font-bold">বাধ্যতামূলক</span>
                </label>
                <input
                  id="input-consumer-id"
                  type="text"
                  required
                  value={consumerId}
                  onChange={(e) => {
                    setConsumerId(e.target.value);
                    clearError('consumerId');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:outline-none ${validationErrors.consumerId ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="e.g. 100289123"
                />
                {validationErrors.consumerId && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.consumerId}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{t.consumerName} *</span>
                  <span className="text-[10px] text-red-600 font-bold">বাধ্যতামূলক</span>
                </label>
                <input
                  id="input-consumer-name"
                  type="text"
                  required
                  value={consumerName}
                  onChange={(e) => {
                    setConsumerName(e.target.value);
                    clearError('consumerName');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 font-semibold focus:ring-2 focus:outline-none ${validationErrors.consumerName ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="Consumer Name"
                />
                {validationErrors.consumerName && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.consumerName}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{t.oldMeterNo} *</span>
                  <span className="text-[10px] text-red-600 font-bold">বাধ্যতামূলক</span>
                </label>
                <input
                  id="input-old-meter-no"
                  type="text"
                  required
                  value={oldMeterNo}
                  onChange={(e) => {
                    setOldMeterNo(e.target.value);
                    clearError('oldMeterNo');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:outline-none ${validationErrors.oldMeterNo ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="e.g. OLD-WB-9821"
                />
                {validationErrors.oldMeterNo && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.oldMeterNo}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{t.oldMeterReading} (kWh) *</span>
                  <span className="text-[10px] text-red-600 font-bold">বাধ্যতামূলক</span>
                </label>
                <input
                  id="input-old-meter-reading"
                  type="text"
                  required
                  value={oldMeterReading}
                  onChange={(e) => {
                    setOldMeterReading(e.target.value);
                    clearError('oldMeterReading');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:outline-none ${validationErrors.oldMeterReading ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="e.g. 08945"
                />
                {validationErrors.oldMeterReading && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.oldMeterReading}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.replacementReason}
                </label>
                <select
                  value={replacementReason}
                  onChange={(e) => setReplacementReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="মিটার পুড়ে যাওয়া / ডিসপ্লে নষ্ট (Burnt / Faulty Display)">মিটার পুড়ে যাওয়া / ডিসপ্লে নষ্ট (Burnt / Display Fault)</option>
                  <option value="মিটার বন্ধ / রিডিং জ্যাম (Meter Stopped / Jammed)">মিটার বন্ধ / রিডিং জ্যাম (Meter Stopped)</option>
                  <option value="স্মার্ট প্রিপেইড মিটার রূপান্তর (Smart Meter Upgrade RDSS)">স্মার্ট মিটার আপগ্রেড (Smart Meter RDSS)</option>
                  <option value="কাঁচ ভাঙা / সিল টেম্পার সন্দেহ (Glass Broken / Tamper)">কাঁচ ভাঙা / সিল টেম্পার (Glass Broken / Tamper)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{t.newMeterNo} *</span>
                  <span className="text-[10px] text-red-600 font-bold">বাধ্যতামূলক</span>
                </label>
                <input
                  id="input-new-meter-no"
                  type="text"
                  required
                  value={newMeterNo}
                  onChange={(e) => {
                    setNewMeterNo(e.target.value);
                    clearError('newMeterNo');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 font-mono font-bold text-emerald-700 focus:ring-2 focus:outline-none ${validationErrors.newMeterNo ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="e.g. WB26-GEN-88319"
                />
                {validationErrors.newMeterNo && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.newMeterNo}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.newMeterInitialReading}
                </label>
                <input
                  type="text"
                  value={newMeterInitialReading}
                  onChange={(e) => setNewMeterInitialReading(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="000000"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.newMeterSealNo}
                </label>
                <input
                  type="text"
                  value={newMeterSealNo}
                  onChange={(e) => setNewMeterSealNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-blue-700 font-bold"
                  placeholder="e.g. WB-SL-90312"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.meterType}
                </label>
                <select
                  value={meterType}
                  onChange={(e) => setMeterType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Single Phase Digital Static Electronic">1-Phase Static Electronic (Digital)</option>
                  <option value="3-Phase 4-Wire LT-CT Meter">3-Phase 4-Wire LT-CT Meter</option>
                  <option value="Smart Prepaid DLMS Meter (RDSS)">Smart Prepaid DLMS Meter (RDSS)</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{t.addressLocation} *</span>
                  <span className="text-[10px] text-red-600 font-bold">বাধ্যতামূলক</span>
                </label>
                <input
                  id="input-address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    clearError('address');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:ring-2 focus:outline-none ${validationErrors.address ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="Consumer Premises Address"
                />
                {validationErrors.address && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.address}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 5. DTR REPLACEMENT SPECIFIC FORM */}
          {category === 'DTR REPLESMENT' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{t.dtrName} *</span>
                  <span className="text-[10px] text-red-600 font-bold">বাধ্যতামূলক</span>
                </label>
                <input
                  id="input-dtr-name"
                  type="text"
                  required
                  value={dtrName}
                  onChange={(e) => {
                    setDtrName(e.target.value);
                    clearError('dtrName');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:outline-none ${validationErrors.dtrName ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="e.g. DTR-VILLAGE-04"
                />
                {validationErrors.dtrName && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.dtrName}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.existingCapacity} *
                </label>
                <select
                  value={existingCapacity}
                  onChange={(e) => setExistingCapacity(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-rose-700"
                >
                  <option value="16 kVA (1-Ph/3-Ph)">16 kVA (11/0.433 kV)</option>
                  <option value="25 kVA">25 kVA (11/0.433 kV)</option>
                  <option value="63 kVA">63 kVA (11/0.433 kV)</option>
                  <option value="100 kVA">100 kVA (11/0.433 kV Standard)</option>
                  <option value="250 kVA">250 kVA (11/0.433 kV Town)</option>
                  <option value="500 kVA">500 kVA (11/0.433 kV Heavy)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.newCapacity} *
                </label>
                <select
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-emerald-700"
                >
                  <option value="25 kVA">25 kVA (11/0.433 kV)</option>
                  <option value="63 kVA">63 kVA (11/0.433 kV)</option>
                  <option value="100 kVA">100 kVA (11/0.433 kV Standard)</option>
                  <option value="250 kVA">250 kVA (11/0.433 kV Upgraded)</option>
                  <option value="500 kVA">500 kVA (11/0.433 kV Heavy)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.oldDtrSerial}
                </label>
                <input
                  type="text"
                  value={oldDtrSerial}
                  onChange={(e) => setOldDtrSerial(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="e.g. OLD-DTR-9941 (Voltamp/Crompton)"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{t.newDtrSerial} *</span>
                  <span className="text-[10px] text-red-600 font-bold">বাধ্যতামূলক</span>
                </label>
                <input
                  id="input-new-dtr-serial"
                  type="text"
                  required
                  value={newDtrSerial}
                  onChange={(e) => {
                    setNewDtrSerial(e.target.value);
                    clearError('newDtrSerial');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 font-mono font-bold text-blue-700 focus:ring-2 focus:outline-none ${validationErrors.newDtrSerial ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="e.g. WB-DTR-2026-081"
                />
                {validationErrors.newDtrSerial && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.newDtrSerial}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.dtrFailureReason}
                </label>
                <select
                  value={dtrFailureReason}
                  onChange={(e) => setDtrFailureReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="কয়েল পুড়ে যাওয়া / ওভারলোড ট্রিপ (Coil Burnt / Overload)">কয়েল পুড়ে যাওয়া / ওভারলোড (Coil Burnt/Overload)</option>
                  <option value="বজ্রপাতে ড্যামেজ (Lightning Surge Damage)">বজ্রপাতে ড্যামেজ (Lightning Surge)</option>
                  <option value="অয়েল লিক / BDV টেস্ট ফেইল (Oil Leak / Low BDV)">অয়েল লিক ও কম BDV (Oil Breakdown Fail)</option>
                  <option value="বুশিং ফ্ল্যাশওভার / ব্রেকিং (Bushing Flashover)">বুশিং ফ্ল্যাশওভার (Bushing Flashover)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.oilLevelChecked}
                </label>
                <div className="flex items-center gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={oilLevelChecked}
                      onChange={(e) => setOilLevelChecked(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span>{oilLevelChecked ? 'হ্যাঁ (Full & BDV > 40kV OK)' : 'না (Check Required)'}</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.earthPitResistance}
                </label>
                <input
                  type="text"
                  value={earthPitResistance}
                  onChange={(e) => setEarthPitResistance(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="e.g. 1.2 Ohms (Neutral & Body < 2Ω)"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.hgFuseRating} & MCCB
                </label>
                <input
                  type="text"
                  value={hgFuseRating}
                  onChange={(e) => setHgFuseRating(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. 20 SWG HG Fuse / 200A MCCB"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{t.addressLocation} *</span>
                  <span className="text-[10px] text-red-600 font-bold">বাধ্যতামূলক</span>
                </label>
                <input
                  id="input-address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    clearError('address');
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:ring-2 focus:outline-none ${validationErrors.address ? 'border-red-500 ring-2 ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`}
                  placeholder="DTR Sub-station Yard Location / Village / Pole Structure"
                />
                {validationErrors.address && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationErrors.address}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Section 3: GPS & Photo Evidence Section */}
        <div 
          id="photo-evidence-section"
          className={`p-4 sm:p-5 rounded-xl border space-y-4 transition-colors ${validationErrors.photo ? 'bg-red-50/70 border-red-400 ring-2 ring-red-400' : 'bg-slate-50 border-slate-200'}`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {category === 'NSC' ? '2. ' : '3. '}{t.gpsLocation} & {t.photoEvidence}
              </h3>
            </div>
            <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
              ছবি তোলা বাধ্যতামূলক *
            </span>
          </div>

          {validationErrors.photo && (
            <div className="p-3 bg-red-100/90 border border-red-400 rounded-lg text-red-900 text-xs font-bold flex items-center gap-2 animate-bounce">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{validationErrors.photo}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* GPS capture */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {t.gpsLocation}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={locationGps}
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-mono text-xs focus:outline-none"
                  placeholder="Latitude, Longitude"
                />
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={fetchingGps}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{fetchingGps ? '...' : t.getGps}</span>
                </button>
              </div>
            </div>

            {/* Photo / Video upload / camera / sample */}
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>{t.photoEvidence}</span>
                {isCompressing ? (
                  <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>ছবি প্রস্তুত হচ্ছে...</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-600 font-medium">✓ অটো হাই-স্পিড অপটিমাইজেশন</span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {/* Direct Camera Button */}
                <label className="flex-1 min-w-[120px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors">
                  <Camera className="w-3.5 h-3.5" />
                  <span>ক্যামেরা (Photo)</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={isCompressing}
                  />
                </label>

                {/* File / Gallery Upload */}
                <label className="flex-1 min-w-[120px] px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>গ্যালারি / ফাইল</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={isCompressing}
                  />
                </label>

                {/* Sample Stamp */}
                <button
                  type="button"
                  onClick={setSamplePhoto}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer border border-slate-200"
                  title="Generate sample verified photo stamp"
                  disabled={isCompressing}
                >
                  {t.takeSamplePhoto}
                </button>
              </div>
            </div>
          </div>

          {/* Photo / Video Preview if present */}
          {photoPreview && (
            <div className="pt-2 flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
              {isVideo ? (
                <video
                  src={photoPreview}
                  controls
                  className="w-36 h-24 object-cover rounded-lg border border-slate-300 shadow-xs"
                />
              ) : (
                <img
                  src={photoPreview}
                  alt="Field preview"
                  className="w-24 h-20 object-cover rounded-lg border border-slate-300 shadow-xs"
                />
              )}
              <div className="text-xs text-slate-600 space-y-1">
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> {isVideo ? 'Video Evidence Attached' : 'Photo Evidence Attached'}
                </span>
                <p className="text-[11px] text-slate-400">Verified field attachment</p>
                <button
                  type="button"
                  onClick={() => {
                    setPhotoPreview(null);
                    setIsVideo(false);
                  }}
                  className="text-red-500 hover:underline cursor-pointer font-semibold text-[11px] block"
                >
                  Remove Attachment
                </button>
              </div>
            </div>
          )}

          {/* Notes textarea */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {t.notes}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Additional lineman comments, site landmarks or remarks..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              {t.backToCategories}
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex-1 sm:flex-initial px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-98 ml-auto"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{t.submitting}</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>{t.submit}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Submission Success Dialog Modal: "Your Entry data submitted" */}
      {submissionModalEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {t.yourEntryDataSubmitted || 'Your Entry data submitted'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {t.entryCreatedSuccess}
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-left text-xs space-y-2">
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-500 font-medium">{t.recordId}:</span>
                <span className="font-mono font-bold text-blue-700">{submissionModalEntry.id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-500 font-medium">{t.category}:</span>
                <span className="font-bold text-slate-800">{submissionModalEntry.category}</span>
              </div>
              {submissionModalEntry.applicationNo && (
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500 font-medium">{t.applicationNo}:</span>
                  <span className="font-mono font-bold text-purple-700">{submissionModalEntry.applicationNo}</span>
                </div>
              )}
              {submissionModalEntry.consumerName && (
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500 font-medium">{t.consumerName}:</span>
                  <span className="font-bold text-slate-800">{submissionModalEntry.consumerName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">{t.workerName}:</span>
                <span className="font-bold text-slate-800">{submissionModalEntry.workerName}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const entry = submissionModalEntry;
                setSubmissionModalEntry(null);
                onSuccess(entry);
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-sm transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{t.okButton || 'ঠিক আছে (OK)'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
