import React, { useState, useEffect, useRef } from 'react';
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
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileImage,
  Maximize2,
  Download,
  Eye
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CategoryType, PowerEntry, UserSession, WorkOrderNotice } from '../types';
import { createEntry, fetchWorkOrders } from '../services/api';
import { appendEntryToGoogleSheet } from '../services/googleSheets';
import { Language, translations } from '../utils/translations';
import { resolveWorkOrderImageUrl } from './WorkOrderNoticeSection';
import { compressImageFile } from '../utils/imageCompressor';
import { DisconnectionTaskManagement } from './DisconnectionTaskManagement';

interface EntryFormProps {
  category: CategoryType;
  workerName: string;
  onSuccess: (entry: PowerEntry) => void;
  onBack?: () => void;
  lang?: Language;
  currentUser?: UserSession | null;
  initialNotice?: WorkOrderNotice | null;
  availableWorkOrders?: WorkOrderNotice[];
}

export const EntryForm: React.FC<EntryFormProps> = ({
  category,
  workerName,
  onSuccess,
  onBack,
  lang = 'en',
  currentUser,
  initialNotice,
  availableWorkOrders,
}) => {
  const t = translations[lang] || translations.en;

  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef<boolean>(false);
  const submissionIdRef = useRef<string>(
    `SUB-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
  );
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
  const [worker, setWorker] = useState(workerName || currentUser?.name || 'WBSEDCL Lineman-01');
  const [workerPhone, setWorkerPhone] = useState(() => currentUser?.phone ? String(currentUser.phone) : '');
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
  const [nscWorkOrders, setNscWorkOrders] = useState<WorkOrderNotice[]>([]);
  const [loadingWorkOrders, setLoadingWorkOrders] = useState<boolean>(false);
  const [zoomModalNotice, setZoomModalNotice] = useState<WorkOrderNotice | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);

  const loadNscWorkOrders = async (silent = false) => {
    if (category !== 'NSC') return;
    if (!silent) setLoadingWorkOrders(true);
    try {
      // Fetch all work orders to ensure none tagged as ALL or NSC are missed
      const orders = await fetchWorkOrders();
      const valid = (orders || []).filter(
        (o) => !o.isHidden && (o.category === 'NSC' || o.category === 'ALL' || !o.category)
      );
      if (valid.length > 0) {
        setNscWorkOrders(valid);
        setSelectedWorkOrderNotice((prev) => {
          if (prev) return prev;
          const matched = valid[0];
          if (matched?.title && !workOrderNo) {
            setWorkOrderNo(matched.title);
          }
          return matched;
        });
      }
    } catch (err) {
      console.warn('Could not fetch work orders for NSC:', err);
    } finally {
      if (!silent) setLoadingWorkOrders(false);
    }
  };

  useEffect(() => {
    if (initialNotice) {
      setSelectedWorkOrderNotice(initialNotice);
      if (initialNotice.title && !workOrderNo) {
        setWorkOrderNo(initialNotice.title);
      }
    }
  }, [initialNotice]);

  useEffect(() => {
    if (category === 'NSC') {
      if (availableWorkOrders && availableWorkOrders.length > 0) {
        const filtered = availableWorkOrders.filter(
          (o) => !o.isHidden && (o.category === 'NSC' || o.category === 'ALL' || !o.category)
        );
        if (filtered.length > 0) {
          setNscWorkOrders(filtered);
          if (!selectedWorkOrderNotice && !initialNotice) {
            setSelectedWorkOrderNotice(filtered[0]);
            if (filtered[0].title && !workOrderNo) {
              setWorkOrderNo(filtered[0].title);
            }
          }
        }
      }
      loadNscWorkOrders(Boolean(availableWorkOrders && availableWorkOrders.length > 0));
    }
  }, [category, availableWorkOrders]);

  const handleSelectWorkOrder = (notice: WorkOrderNotice) => {
    setSelectedWorkOrderNotice(notice);
    if (notice.title) {
      setWorkOrderNo(notice.title);
    }
  };

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
    if (workerName) {
      setWorker(workerName);
    } else if (currentUser?.name) {
      setWorker(String(currentUser.name));
    }
    if (currentUser?.phone) {
      setWorkerPhone(String(currentUser.phone));
    }
  }, [workerName, currentUser]);

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
          maxDimension: 1024,
          quality: 0.72,
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
    if (isSubmittingRef.current || loading) return;
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

    isSubmittingRef.current = true;
    setValidationErrors({});
    setLoading(true);
    setSuccessMessage(null);

    if (!submissionIdRef.current) {
      submissionIdRef.current = `SUB-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    }
    const submissionId = submissionIdRef.current;
    const generatedId = `PWR-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();

    const workerIdVal = String(currentUser?.idNo || currentUser?.id || '');
    const workerNameVal = String(currentUser?.name || (category === 'NSC' ? nscWorkerName : worker) || '').trim();
    const workerRoleVal = String(currentUser?.role || 'Field Worker');
    const submittedByVal = currentUser?.idNo ? `${currentUser.name} (${currentUser.idNo})` : workerNameVal;
    const workerPhoneVal = String(currentUser?.phone || workerPhone || '').trim();

    const entryPayload: Partial<PowerEntry> = {
      submissionId,
      id: generatedId,
      category,
      workerId: workerIdVal,
      workerName: workerNameVal,
      role: workerRoleVal,
      submittedBy: submittedByVal,
      workerPhone: workerPhoneVal,
      date: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
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
        entryPayload.workOrderPhoto = resolveWorkOrderImageUrl(selectedWorkOrderNotice);
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
      const created = await createEntry(entryPayload, currentUser);
      try {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      } catch (e) {
        // ignore
      }

      setSuccessMessage(t.entryCreatedSuccess);
      setSubmissionModalEntry(created);
      onSuccess(created);
      // Reset submissionId for the NEXT fresh entry only after successful submission
      submissionIdRef.current = `SUB-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    } catch (err: any) {
      console.error('Error creating entry in Google Sheets:', err);
      const errMsg = err?.message || 'Check network connection';
      alert(lang === 'bn' 
        ? `গুগল শিটে ডেটা সেভ করা যায়নি:\n${errMsg}\nঅনুগ্রহ করে ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।`
        : `Failed to save record to Google Sheets:\n${errMsg}\nPlease verify your internet connection and try again.`);
    } finally {
      setLoading(false);
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1000);
    }
  };

  if (category === 'DISCONNECTION') {
    return (
      <DisconnectionTaskManagement
        currentUser={currentUser}
        lang={lang}
        onBack={onBack}
      />
    );
  }

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

      {/* 1. NON-NSC: Optional Linked Work Order Banner if selected by user */}
      {category !== 'NSC' && selectedWorkOrderNotice && (
        <div className="mx-5 sm:mx-7 mt-5 p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3 overflow-hidden">
            <img 
              src={resolveWorkOrderImageUrl(selectedWorkOrderNotice)} 
              alt={selectedWorkOrderNotice.title} 
              className="w-12 h-12 object-cover rounded-lg border border-amber-300 shrink-0" 
            />
            <div className="overflow-hidden">
              <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">
                {lang === 'bn' ? '✓ সংযুক্ত ওয়ার্ক অর্ডার ও খাতা' : '✓ Linked Work Order & Khata'}
              </span>
              <p className="text-xs font-black text-slate-900 truncate">{selectedWorkOrderNotice.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedWorkOrderNotice(null)}
            className="text-xs text-slate-600 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 font-bold transition-colors cursor-pointer border border-slate-200"
            title="Remove work order link"
          >
            {lang === 'bn' ? 'বাতিল করুন' : 'Unlink'}
          </button>
        </div>
      )}

      {/* 2. NSC: DEDICATED PROMINENT WORK ORDER & KHATA PHOTO SECTION (SHOWN AT THE TOP) */}
      {category === 'NSC' && (
        <div className="mx-4 sm:mx-7 mt-5 bg-gradient-to-br from-amber-50 via-white to-amber-50/60 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 animate-in fade-in">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-amber-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
                <FileImage className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                    {lang === 'bn' ? '📋 অফিশিয়াল ওয়ার্ক অর্ডার ও খাতার ছবি' : '📋 Official Work Order & Khata Photo'}
                  </h3>
                  <span className="bg-amber-100 text-amber-900 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-300">
                    Live Photo
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  {selectedWorkOrderNotice ? (
                    <span className="font-bold text-amber-950 truncate inline-block max-w-[280px] sm:max-w-md">
                      {selectedWorkOrderNotice.title} 
                      {selectedWorkOrderNotice.uploadDate && ` • 📅 ${selectedWorkOrderNotice.uploadDate} ${selectedWorkOrderNotice.uploadTime || ''}`}
                      {selectedWorkOrderNotice.adminName && ` • 👤 ${selectedWorkOrderNotice.adminName}`}
                    </span>
                  ) : (
                    <span>{lang === 'bn' ? 'অ্যাডমিনের আপলোডকৃত ওয়ার্ক অর্ডার ও খাতার ছবি' : 'Work Order & Khata uploaded by Admin'}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Refresh button */}
              <button
                type="button"
                onClick={() => loadNscWorkOrders(false)}
                disabled={loadingWorkOrders}
                className="px-3 py-1.5 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                title="Refresh Work Order Photo"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${loadingWorkOrders ? 'animate-spin' : ''}`} />
                <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
              </button>

              {/* Fullscreen Zoom button */}
              {selectedWorkOrderNotice && (
                <button
                  type="button"
                  onClick={() => {
                    setZoomModalNotice(selectedWorkOrderNotice);
                    setZoomScale(1);
                  }}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <ZoomIn className="w-4 h-4" />
                  <span>{lang === 'bn' ? '🔍 বড় করে দেখুন' : '🔍 Zoom / Full View'}</span>
                </button>
              )}
            </div>
          </div>

          {/* TOP OPTION: Work Order Name (ওয়ার্ক অর্ডার নাম / নম্বর) */}
          <div className="bg-amber-100/90 dark:bg-slate-900 border-2 border-amber-400 rounded-xl p-3 sm:p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
              <label className="text-xs sm:text-sm font-black text-amber-950 dark:text-amber-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-700" />
                <span>{lang === 'bn' ? 'ওয়ার্ক অর্ডার নাম (Work Order Name / No)' : 'Work Order Name / No'} *</span>
              </label>
              {nscWorkOrders.length > 0 && (
                <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 bg-amber-200/70 dark:bg-amber-950/70 px-2.5 py-0.5 rounded-full border border-amber-300">
                  {lang === 'bn' ? `✓ ${nscWorkOrders.length} টি ওয়ার্ক অর্ডার উপলব্ধ` : `✓ ${nscWorkOrders.length} Work Orders Available`}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Dropdown to select uploaded order */}
              {nscWorkOrders.length > 0 && (
                <div>
                  <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    {lang === 'bn' ? 'তালিকা থেকে ওয়ার্ক অর্ডার সিলেক্ট করুন:' : 'Select Uploaded Work Order:'}
                  </label>
                  <select
                    value={selectedWorkOrderNotice?.id || ''}
                    onChange={(e) => {
                      const found = nscWorkOrders.find((o) => o.id === e.target.value);
                      if (found) {
                        handleSelectWorkOrder(found);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border-2 border-amber-400 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer shadow-2xs"
                  >
                    {nscWorkOrders.map((order, idx) => (
                      <option key={order.id} value={order.id}>
                        {idx + 1}. {order.title} {order.uploadDate ? `(${order.uploadDate})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Text input to show/edit Work Order Name */}
              <div className={nscWorkOrders.length === 0 ? 'sm:col-span-2' : ''}>
                <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  {lang === 'bn' ? 'ওয়ার্ক অর্ডার নাম / নম্বর:' : 'Work Order Name / No:'}
                </label>
                <input
                  type="text"
                  required
                  value={workOrderNo}
                  onChange={(e) => {
                    setWorkOrderNo(e.target.value);
                    clearError('workOrderNo');
                  }}
                  placeholder="e.g. WO-2026-98102"
                  className={`w-full px-3 py-2 bg-white dark:bg-slate-800 border-2 rounded-lg text-xs font-mono font-black focus:ring-2 focus:outline-none shadow-2xs ${
                    validationErrors.workOrderNo ? 'border-red-500 text-red-900' : 'border-amber-400 text-amber-950 dark:text-white focus:ring-amber-500'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Photo Preview Container */}
          {loadingWorkOrders && !selectedWorkOrderNotice ? (
            <div className="h-48 sm:h-64 rounded-xl bg-slate-900 border border-slate-700 flex flex-col items-center justify-center text-slate-300 gap-3">
              <RefreshCw className="w-7 h-7 text-amber-400 animate-spin" />
              <p className="text-xs font-bold text-slate-300">
                {lang === 'bn' ? 'ওয়ার্ক অর্ডার ও খাতার ছবি লোড হচ্ছে...' : 'Loading Work Order & Khata Photo...'}
              </p>
            </div>
          ) : selectedWorkOrderNotice ? (
            <div className="space-y-2.5">
              <div 
                onClick={() => {
                  setZoomModalNotice(selectedWorkOrderNotice);
                  setZoomScale(1);
                }}
                className="relative rounded-xl overflow-hidden bg-slate-950 border-2 border-amber-400/80 shadow-md group cursor-pointer flex items-center justify-center min-h-[220px] max-h-[360px] sm:max-h-[440px]"
                title="Click to zoom in full screen"
              >
                <img
                  src={resolveWorkOrderImageUrl(selectedWorkOrderNotice)}
                  alt={selectedWorkOrderNotice.title || 'Work Order Photo'}
                  className="w-full max-h-[350px] sm:max-h-[430px] object-contain transition-transform duration-200 group-hover:scale-[1.01]"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (selectedWorkOrderNotice.fileId && !target.src.includes('/api/drive-proxy/')) {
                      target.src = `/api/drive-proxy/${selectedWorkOrderNotice.fileId}`;
                    }
                  }}
                />

                {/* Top-Right Badge: Linked Status */}
                <div className="absolute top-2.5 right-2.5 bg-emerald-600/90 text-white text-[11px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-md backdrop-blur-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? '✓ সংযুক্ত খাতা' : '✓ Linked Khata'}</span>
                </div>

                {/* Bottom Overlay Hint */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent p-2.5 flex items-center justify-center text-white text-xs font-bold gap-2">
                  <ZoomIn className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-200">
                    {lang === 'bn' ? '🔍 ছবিতে ক্লিক করে ফুলস্ক্রিন জুম করুন (Click to zoom & inspect details)' : '🔍 Click photo to open Fullscreen Zoom'}
                  </span>
                </div>
              </div>

              {/* Multiple Khata Pages / Work Orders Switcher */}
              {nscWorkOrders.length > 1 && (
                <div className="pt-1">
                  <div className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center justify-between">
                    <span>{lang === 'bn' ? 'অন্যান্য খাতার পাতা বা ওয়ার্ক অর্ডার সিলেক্ট করুন:' : 'Select other Khata pages or Work Orders:'}</span>
                    <span className="text-amber-700 font-bold">{nscWorkOrders.length} টি ছবি রয়েছে</span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5">
                    {nscWorkOrders.map((order, idx) => {
                      const isSelected = selectedWorkOrderNotice?.id === order.id;
                      return (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => handleSelectWorkOrder(order)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shrink-0 ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs ring-2 ring-amber-300'
                              : 'bg-white text-slate-700 hover:bg-amber-50 border-slate-300'
                          }`}
                        >
                          <img
                            src={resolveWorkOrderImageUrl(order)}
                            alt=""
                            className="w-7 h-7 object-cover rounded border border-slate-300 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <span className="truncate max-w-[150px] sm:max-w-[220px]">
                            {idx + 1}. {order.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-white rounded-xl border border-amber-200 text-center space-y-2">
              <p className="text-xs font-bold text-amber-900">
                {lang === 'bn'
                  ? '⚠️ বর্তমানে কোনো অফিশিয়াল ওয়ার্ক অর্ডার বা খাতার ছবি আপলোড করা নেই।'
                  : '⚠️ No official Work Order or Khata photos uploaded yet.'}
              </p>
              <p className="text-[11px] text-slate-500">
                {lang === 'bn'
                  ? 'অ্যাডমিন ফটো আপলোড করার পর এখানে স্বয়ংক্রিয়ভাবে ভেসে উঠবে। আপনি চাইলে নিচের ফর্ম পূরণ চালিয়ে যেতে পারেন।'
                  : 'Photos uploaded by admin will automatically appear here. You can proceed to fill the form below.'}
              </p>
              <button
                type="button"
                onClick={() => loadNscWorkOrders(false)}
                className="mt-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'ছবি রিফ্রেশ করে দেখুন' : 'Check for New Photo'}</span>
              </button>
            </div>
          )}
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
              {/* 1. Work Order No (SOB UPOR A WORK ORDER NAME) -> TEAL CARD */}
              <div className={`rounded-xl p-3.5 shadow-xs transition-all ${validationErrors.workOrderNo ? 'bg-red-50/90 border-2 border-red-500 ring-2 ring-red-300' : 'bg-teal-50/80 border-2 border-teal-300 hover:border-teal-400'}`}>
                <label className="block font-black text-teal-950 mb-1.5 text-xs flex items-center justify-between">
                  <span>{t.workOrderNo} (Work Order Name / No) *</span>
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

              {/* 2. Work Order Date -> TEAL CARD */}
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

              {/* 3. Lineman / Staff Name (Worker Name) -> VIBRANT BLUE CARD */}
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

              {/* 4. Agency Name -> VIBRANT AMBER / ORANGE CARD */}
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

              {/* 5. CCC Name -> VIBRANT PURPLE CARD */}
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

              {/* 14. Premises / Village / GP Address -> SLATE CARD (Span 3) */}
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

              {/* 15. Meter Install Date -> FUCHSIA CARD */}
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

              {/* 16. Inspection Agency Name -> FUCHSIA CARD */}
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
              <div className="pt-1.5 border-t border-slate-200">
                <div className="p-2 bg-emerald-50 border border-emerald-200/80 rounded-lg text-[11px] text-emerald-800 font-bold flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>ডাটা এডমিন প্যানেলে রিয়েল-টাইমে দৃশ্যমান (Synced to Admin Panel)</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSubmissionModalEntry(null);
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-sm transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{t.okButton || 'ঠিক আছে (OK)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* FULLSCREEN WORK ORDER & KHATA PHOTO ZOOM MODAL */}
      {zoomModalNotice && (
        <div className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-md flex flex-col p-2 sm:p-4 animate-in fade-in">
          {/* Modal Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl shrink-0">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
                <FileImage className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <h4 className="text-sm font-black text-white truncate max-w-xs sm:max-w-md">
                  {zoomModalNotice.title}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {zoomModalNotice.uploadDate && `📅 ${zoomModalNotice.uploadDate} ${zoomModalNotice.uploadTime || ''}`}
                  {zoomModalNotice.adminName && ` • 👤 ${zoomModalNotice.adminName}`}
                </p>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.max(0.5, Number((s - 0.25).toFixed(2))))}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <span className="text-xs font-mono font-bold text-amber-400 px-2 py-1 bg-slate-800/80 rounded border border-slate-700 min-w-[50px] text-center">
                {Math.round(zoomScale * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.min(3.5, Number((s + 0.25).toFixed(2))))}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setZoomScale(1)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                title="Reset Zoom (100%)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <a
                href={resolveWorkOrderImageUrl(zoomModalNotice)}
                download={`Khata_${zoomModalNotice.title || 'Photo'}.jpg`}
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                title="Open / Download"
              >
                <Download className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={() => {
                  setZoomModalNotice(null);
                  setZoomScale(1);
                }}
                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Zoomable Image Area */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/80 rounded-xl mt-2 border border-slate-800">
            <img
              src={resolveWorkOrderImageUrl(zoomModalNotice)}
              alt={zoomModalNotice.title}
              style={{
                transform: `scale(${zoomScale})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out',
              }}
              className="max-w-full max-h-[75vh] object-contain rounded-lg border border-slate-800 shadow-2xl"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                if (zoomModalNotice.fileId && !target.src.includes('/api/drive-proxy/')) {
                  target.src = `/api/drive-proxy/${zoomModalNotice.fileId}`;
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
