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
  ArrowLeft
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CategoryType, PowerEntry } from '../types';
import { createEntry } from '../services/api';

interface EntryFormProps {
  category: CategoryType;
  workerName: string;
  onSuccess: (entry: PowerEntry) => void;
  onBack?: () => void;
}

export const EntryForm: React.FC<EntryFormProps> = ({
  category,
  workerName,
  onSuccess,
  onBack,
}) => {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fetchingGps, setFetchingGps] = useState(false);

  // Common Form Fields
  const [worker, setWorker] = useState(workerName || 'Worker-1');
  const [feederName, setFeederName] = useState('Feeder-01 (Main Substation)');
  const [substation, setSubstation] = useState('Central 33/11kV Substation');
  const [locationGps, setLocationGps] = useState('');
  const [notes, setNotes] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Category-specific states
  // NSC
  const [consumerName, setConsumerName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [consumerId, setConsumerId] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [poleNo, setPoleNo] = useState('');
  const [appliedLoad, setAppliedLoad] = useState('2 kW');
  const [phase, setPhase] = useState('Single Phase');
  const [meterNo, setMeterNo] = useState('');
  const [initialReading, setInitialReading] = useState('000000');
  const [sealNo, setSealNo] = useState('');
  const [serviceCableLength, setServiceCableLength] = useState('25 Meters');

  // DISCONNECTION
  const [arrearAmount, setArrearAmount] = useState('');
  const [disconnectionReason, setDisconnectionReason] = useState('বকেয়া বিল অনাদায়ে (Unpaid Defaulter)');
  const [finalReading, setFinalReading] = useState('');
  const [disconnectionType, setDisconnectionType] = useState('Defaulter');
  const [cutoutSealed, setCutoutSealed] = useState(true);

  // POLE CASE
  const [issueType, setIssueType] = useState('ঝড়ে পোল ভাঙা / হেলে পড়া (Storm Damaged/Tilted)');
  const [priority, setPriority] = useState<'Urgent' | 'High' | 'Normal' | 'Low'>('High');
  const [poleType, setPoleType] = useState('PSC Pole (9 Meter)');
  const [lineVoltage, setLineVoltage] = useState('LT (230V/400V)');
  const [actionTaken, setActionTaken] = useState('');
  const [materialUsed, setMaterialUsed] = useState('');

  // METER REPLESMENT
  const [oldMeterNo, setOldMeterNo] = useState('');
  const [oldMeterReading, setOldMeterReading] = useState('');
  const [replacementReason, setReplacementReason] = useState('মিটার পুড়ে যাওয়া / ডিসপ্লে নষ্ট (Burnt / Display Fault)');
  const [newMeterNo, setNewMeterNo] = useState('');
  const [newMeterInitialReading, setNewMeterInitialReading] = useState('000000');
  const [newMeterSealNo, setNewMeterSealNo] = useState('');
  const [meterType, setMeterType] = useState('Single Phase Digital');

  // DTR REPLESMENT
  const [dtrName, setDtrName] = useState('');
  const [existingCapacity, setExistingCapacity] = useState('100 kVA');
  const [newCapacity, setNewCapacity] = useState('100 kVA');
  const [oldDtrSerial, setOldDtrSerial] = useState('');
  const [newDtrSerial, setNewDtrSerial] = useState('');
  const [dtrFailureReason, setDtrFailureReason] = useState('কয়েল পুড়ে যাওয়া / ওভারলোড ট্রিপ (Coil Burnt / Overload)');
  const [oilLevelChecked, setOilLevelChecked] = useState(true);
  const [earthResistance, setEarthResistance] = useState('1.5 Ohms');

  // Keep worker name synced
  useEffect(() => {
    if (workerName) setWorker(workerName);
  }, [workerName]);

  // Generate default ID or reset on category change
  useEffect(() => {
    setSuccessMessage(null);
  }, [category]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('আপনার ডিভাইসে জিপিএস সমর্থন করে না।');
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
        // Fallback demo location if browser permission denied
        setLocationGps('23.810332, 90.412518');
        setFetchingGps(false);
      },
      { timeout: 8000 }
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const setSamplePhoto = (type: string) => {
    // Generate an illustrative utility photo canvas base64
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`POWER FIELD OPS: ${category}`, 20, 60);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, 20, 100);
      ctx.fillText(`Worker: ${worker}`, 20, 130);
      ctx.fillText(`Pole / Site Ref: ${poleNo || dtrName || 'Field Point'}`, 20, 160);
      ctx.fillStyle = '#10b981';
      ctx.fillText(`✓ Photo Evidence Verified`, 20, 210);
      setPhotoPreview(canvas.toDataURL());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage(null);

    const generatedId = `PWR-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();

    const entryPayload: Partial<PowerEntry> = {
      id: generatedId,
      category,
      workerName: worker,
      date: nowIso,
      status: 'Completed',
      feederName,
      substation,
      locationGps,
      photoUrl: photoPreview || undefined,
      notes,
    };

    // Populate category-specific fields
    if (category === 'NSC') {
      entryPayload.consumerName = consumerName || 'New Consumer';
      entryPayload.fatherName = fatherName;
      entryPayload.consumerId = consumerId || `CON-${Math.floor(100000 + Math.random() * 900000)}`;
      entryPayload.mobile = mobile;
      entryPayload.address = address;
      entryPayload.poleNo = poleNo;
      entryPayload.appliedLoad = appliedLoad;
      entryPayload.phase = phase;
      entryPayload.meterNo = meterNo || `MTR-${Math.floor(10000 + Math.random() * 90000)}`;
      entryPayload.initialReading = initialReading;
      entryPayload.sealNo = sealNo || `SL-${Math.floor(10000 + Math.random() * 90000)}`;
      entryPayload.serviceCableLength = serviceCableLength;
    } else if (category === 'DISCONNECTION') {
      entryPayload.consumerId = consumerId || `CON-${Math.floor(100000 + Math.random() * 900000)}`;
      entryPayload.consumerName = consumerName || 'Defaulter Consumer';
      entryPayload.mobile = mobile;
      entryPayload.address = address;
      entryPayload.poleNo = poleNo;
      entryPayload.arrearAmount = arrearAmount || '5,000';
      entryPayload.reason = disconnectionReason;
      entryPayload.finalReading = finalReading || '10200';
      entryPayload.disconnectionType = disconnectionType;
      entryPayload.cutoutSealed = cutoutSealed;
    } else if (category === 'POLE CASE') {
      entryPayload.poleNo = poleNo || `P-${Math.floor(100 + Math.random() * 900)}`;
      entryPayload.address = address;
      entryPayload.issueType = issueType;
      entryPayload.priority = priority;
      entryPayload.poleType = poleType;
      entryPayload.lineVoltage = lineVoltage;
      entryPayload.actionTaken = actionTaken || 'পোল মেরামত এবং লাইন নিরাপদ করা হয়েছে';
      entryPayload.materialUsed = materialUsed;
    } else if (category === 'METER REPLESMENT') {
      entryPayload.consumerId = consumerId || `CON-${Math.floor(100000 + Math.random() * 900000)}`;
      entryPayload.consumerName = consumerName || 'Consumer';
      entryPayload.address = address;
      entryPayload.poleNo = poleNo;
      entryPayload.oldMeterNo = oldMeterNo || `OLD-${Math.floor(10000 + Math.random() * 90000)}`;
      entryPayload.finalReading = oldMeterReading || '09840';
      entryPayload.replacementReason = replacementReason;
      entryPayload.newMeterNo = newMeterNo || `DIG-${Math.floor(10000 + Math.random() * 90000)}`;
      entryPayload.initialReading = newMeterInitialReading;
      entryPayload.sealNo = newMeterSealNo || `SL-${Math.floor(10000 + Math.random() * 90000)}`;
      entryPayload.meterType = meterType;
      entryPayload.phase = phase;
    } else if (category === 'DTR REPLESMENT') {
      entryPayload.dtrName = dtrName || `DTR-${Math.floor(10 + Math.random() * 90)}`;
      entryPayload.address = address;
      entryPayload.existingCapacity = existingCapacity;
      entryPayload.newCapacity = newCapacity;
      entryPayload.oldDtrSerial = oldDtrSerial || `DTR-OLD-${Math.floor(1000 + Math.random() * 9000)}`;
      entryPayload.newDtrSerial = newDtrSerial || `DTR-NEW-${Math.floor(1000 + Math.random() * 9000)}`;
      entryPayload.failureReason = dtrFailureReason;
      entryPayload.oilLevelChecked = oilLevelChecked;
      entryPayload.earthResistance = earthResistance;
    }

    try {
      const savedEntry = await createEntry(entryPayload);
      
      // Trigger festive celebration confetti
      try {
        confetti({
          particleCount: 75,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#f59e0b', '#10b981', '#38bdf8', '#fbbf24']
        });
      } catch {}

      setSuccessMessage(`সফলভাবে এন্ট্রি সেভ হয়েছে! (আইডি: ${savedEntry.id}) ডাটা এডমিন প্যানেলে সংরক্ষিত হয়েছে।`);
      onSuccess(savedEntry);

      // Reset specific fields
      setConsumerName('');
      setFatherName('');
      setMobile('');
      setAddress('');
      setPoleNo('');
      setMeterNo('');
      setNotes('');
      setPhotoPreview(null);
      setArrearAmount('');
      setFinalReading('');
      setActionTaken('');
      setMaterialUsed('');
      setOldMeterNo('');
      setNewMeterNo('');
      setDtrName('');
      setOldDtrSerial('');
      setNewDtrSerial('');
    } catch (err: any) {
      alert(`এন্ট্রি সেভ করতে সমস্যা হয়েছে: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const inputBaseClass = "w-full bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-colors";
  const selectBaseClass = "w-full bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-colors";
  const labelBaseClass = "block text-xs font-semibold text-slate-700 mb-1";
  const sectionCardClass = "bg-slate-50/70 p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4";
  const sectionTitleClass = "text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2";

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Header Banner */}
      <div className="bg-slate-50 px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors shadow-xs"
              title="ক্যাটাগরি তালিকায় ফিরে যান"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {category} এন্ট্রি ফর্ম
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                Active Form
              </span>
            </div>
            <p className="text-xs text-slate-500">
              সমস্ত তথ্য সঠিকভাবে পূরণ করুন, এটি এডমিন ডাটাবেজে তাৎক্ষণিক সেভ হবে।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>তারিখ: {new Date().toLocaleDateString('bn-BD')}</span>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              বন্ধ করুন
            </button>
          )}
        </div>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="m-4 sm:m-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-emerald-950">{successMessage}</p>
            <p className="text-xs text-emerald-800 mt-0.5">
              এডমিন ড্যাশবোর্ডে গিয়ে আপনি বা এডমিন এই এন্ট্রির স্লিপ ও রিপোর্ট প্রিন্ট করতে পারেন।
            </p>
          </div>
        </div>
      )}

      {/* Main Entry Form */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
        {/* Section 1: Line & Worker Basic Setup */}
        <div className={sectionCardClass}>
          <div className={sectionTitleClass}>
            <User className="w-4 h-4 text-slate-700" />
            <span>১. লাইন ও কর্মীর সাধারণ তথ্য</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className={labelBaseClass}>
                কর্মীর নাম (Worker / Lineman Name) *
              </label>
              <input
                id="input-worker-name"
                type="text"
                required
                value={worker}
                onChange={(e) => setWorker(e.target.value)}
                placeholder="উদাঃ মোঃ রফিকুল ইসলাম (লাইনম্যান)"
                className={inputBaseClass}
              />
            </div>

            <div>
              <label className={labelBaseClass}>
                ফিডারের নাম (Feeder Name) *
              </label>
              <select
                id="input-feeder-name"
                value={feederName}
                onChange={(e) => setFeederName(e.target.value)}
                className={selectBaseClass}
              >
                <option value="Feeder-01 (Town Substation)">Feeder-01 (Town Substation)</option>
                <option value="Feeder-02 (Commercial Bazar)">Feeder-02 (Commercial Bazar)</option>
                <option value="Feeder-03 (Rural North)">Feeder-03 (Rural North)</option>
                <option value="Feeder-04 (Industrial Line)">Feeder-04 (Industrial Line)</option>
                <option value="Feeder-05 (Hospital Road)">Feeder-05 (Hospital Road)</option>
                <option value="Feeder-06 (Agricultural Express)">Feeder-06 (Agricultural Express)</option>
              </select>
            </div>

            <div>
              <label className={labelBaseClass}>
                সাবস্টেশন (Substation)
              </label>
              <input
                id="input-substation"
                type="text"
                value={substation}
                onChange={(e) => setSubstation(e.target.value)}
                placeholder="৩৩/১১ কেভি সাবস্টেশন"
                className={inputBaseClass}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Specific Fields Based on Category */}
        <div className={sectionCardClass}>
          <div className={sectionTitleClass}>
            <Layers className="w-4 h-4 text-slate-700" />
            <span>২. {category} কাজের বিবরণ ও টেকনিক্যাল ডাটা</span>
          </div>

          {/* 1. NSC - NEW SERVICE CONNECTION */}
          {category === 'NSC' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className={labelBaseClass}>
                  গ্রাহকের নাম (Consumer Name) *
                </label>
                <input
                  id="nsc-consumer-name"
                  type="text"
                  required
                  value={consumerName}
                  onChange={(e) => setConsumerName(e.target.value)}
                  placeholder="গ্রাহকের পুরো নাম"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  পিতা/স্বামীর নাম (Father/Husband Name)
                </label>
                <input
                  id="nsc-father-name"
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="পিতা বা স্বামীর নাম"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  মোবাইল নম্বর (Mobile Number) *
                </label>
                <input
                  id="nsc-mobile"
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="০১৭১xxxxxxx"
                  className={inputBaseClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelBaseClass}>
                  ঠিকানা / গ্রাম / ওয়ার্ড (Address / Village) *
                </label>
                <input
                  id="nsc-address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="বাড়ি নং, রোড, গ্রাম, ইউনিয়ন / ওয়ার্ড"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  পোল নম্বর (Pole No.) *
                </label>
                <input
                  id="nsc-pole-no"
                  type="text"
                  required
                  value={poleNo}
                  onChange={(e) => setPoleNo(e.target.value)}
                  placeholder="উদাঃ P-114/A"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  অনুমোদিত লোড (Applied Load)
                </label>
                <select
                  id="nsc-applied-load"
                  value={appliedLoad}
                  onChange={(e) => setAppliedLoad(e.target.value)}
                  className={selectBaseClass}
                >
                  <option value="1.0 kW (Residential)">1.0 kW (Residential)</option>
                  <option value="2.0 kW (Residential)">2.0 kW (Residential)</option>
                  <option value="3.0 kW (Domestic)">3.0 kW (Domestic)</option>
                  <option value="5.0 kW (Commercial)">5.0 kW (Commercial)</option>
                  <option value="10.0 kW (Small Industrial)">10.0 kW (Small Industrial)</option>
                  <option value="15 HP (Irrigation Pump)">15 HP (Irrigation Pump)</option>
                </select>
              </div>

              <div>
                <label className={labelBaseClass}>
                  ফেজ টাইপ (Phase Type)
                </label>
                <select
                  id="nsc-phase"
                  value={phase}
                  onChange={(e) => setPhase(e.target.value)}
                  className={selectBaseClass}
                >
                  <option value="Single Phase">Single Phase (1-Phase 230V)</option>
                  <option value="3-Phase">3-Phase (400V)</option>
                </select>
              </div>

              <div>
                <label className={labelBaseClass}>
                  মিটার নম্বর (New Meter Serial No.) *
                </label>
                <input
                  id="nsc-meter-no"
                  type="text"
                  required
                  value={meterNo}
                  onChange={(e) => setMeterNo(e.target.value)}
                  placeholder="উদাঃ MTR-98241"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  মিটারের শুরুর রিডিং (Initial Reading)
                </label>
                <input
                  id="nsc-initial-reading"
                  type="text"
                  value={initialReading}
                  onChange={(e) => setInitialReading(e.target.value)}
                  placeholder="000001"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  মিটার সিকিউরিটি সিল নং (Seal No.)
                </label>
                <input
                  id="nsc-seal-no"
                  type="text"
                  value={sealNo}
                  onChange={(e) => setSealNo(e.target.value)}
                  placeholder="উদাঃ SL-88491"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  সার্ভিস ড্রপ কেবল দৈর্ঘ্য (Drop Cable Length)
                </label>
                <input
                  id="nsc-cable-length"
                  type="text"
                  value={serviceCableLength}
                  onChange={(e) => setServiceCableLength(e.target.value)}
                  placeholder="উদাঃ ৩০ মিটার"
                  className={inputBaseClass}
                />
              </div>
            </div>
          )}

          {/* 2. DISCONNECTION */}
          {category === 'DISCONNECTION' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className={labelBaseClass}>
                  গ্রাহক আইডি / একাউন্ট নং (Consumer / Account ID) *
                </label>
                <input
                  id="disc-consumer-id"
                  type="text"
                  required
                  value={consumerId}
                  onChange={(e) => setConsumerId(e.target.value)}
                  placeholder="উদাঃ CON-774910"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  গ্রাহকের নাম (Consumer Name) *
                </label>
                <input
                  id="disc-consumer-name"
                  type="text"
                  required
                  value={consumerName}
                  onChange={(e) => setConsumerName(e.target.value)}
                  placeholder="গ্রাহকের নাম"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  পোল নম্বর (Pole No.)
                </label>
                <input
                  id="disc-pole-no"
                  type="text"
                  value={poleNo}
                  onChange={(e) => setPoleNo(e.target.value)}
                  placeholder="উদাঃ P-089"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  বিচ্ছিন্ন করার কারণ (Disconnection Reason) *
                </label>
                <select
                  id="disc-reason"
                  value={disconnectionReason}
                  onChange={(e) => setDisconnectionReason(e.target.value)}
                  className={selectBaseClass}
                >
                  <option value="বকেয়া বিল অনাদায়ে (Unpaid Defaulter)">বকেয়া বিল অনাদায়ে (Unpaid Defaulter)</option>
                  <option value="অবৈধ হুকিং ও বিদ্যুৎ চুরি (Illegal Hooking/Theft)">অবৈধ হুকিং ও বিদ্যুৎ চুরি (Illegal Hooking/Theft)</option>
                  <option value="গ্রাহকের নিজস্ব আবেদন (Consumer Surrender Request)">গ্রাহকের নিজস্ব আবেদন (Consumer Surrender Request)</option>
                  <option value="মিটার বাইপাস ও কারসাজি (Meter Tampering)">মিটার বাইপাস ও কারসাজি (Meter Tampering)</option>
                  <option value="ঝুঁকিপূর্ণ ওয়্যারিং / সেফটি হ্যাজার্ড (Hazardous Wiring)">ঝুঁকিপূর্ণ ওয়্যারিং / সেফটি হ্যাজার্ড (Hazardous Wiring)</option>
                </select>
              </div>

              <div>
                <label className={labelBaseClass}>
                  বকেয়া টাকার পরিমাণ (Arrear Amount Tk/₹) *
                </label>
                <input
                  id="disc-arrear"
                  type="text"
                  required
                  value={arrearAmount}
                  onChange={(e) => setArrearAmount(e.target.value)}
                  placeholder="উদাঃ ১২,৫০০"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  বিচ্ছিন্নকালীন শেষ রিডিং (Final Meter Reading) *
                </label>
                <input
                  id="disc-final-reading"
                  type="text"
                  required
                  value={finalReading}
                  onChange={(e) => setFinalReading(e.target.value)}
                  placeholder="উদাঃ ১৪৭৮০"
                  className={inputBaseClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelBaseClass}>
                  গ্রাহকের ঠিকানা / দোকান / বাড়ি (Location)
                </label>
                <input
                  id="disc-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="ঠিকানা ও দোকান/বাসা নম্বর"
                  className={inputBaseClass}
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="disc-cutout-sealed"
                  checked={cutoutSealed}
                  onChange={(e) => setCutoutSealed(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <label htmlFor="disc-cutout-sealed" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  কাট-আউট লুপ খুলে সিল ও লাল নোটিশ ঝুলানো হয়েছে
                </label>
              </div>
            </div>
          )}

          {/* 3. POLE CASE */}
          {category === 'POLE CASE' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className={labelBaseClass}>
                  পোল নম্বর / আইডি (Pole No. / ID) *
                </label>
                <input
                  id="pole-no"
                  type="text"
                  required
                  value={poleNo}
                  onChange={(e) => setPoleNo(e.target.value)}
                  placeholder="উদাঃ P-302/B"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  সমস্যার ধরণ (Issue / Fault Type) *
                </label>
                <select
                  id="pole-issue-type"
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className={selectBaseClass}
                >
                  <option value="ঝড়ে পোল ভাঙা / হেলে পড়া (Storm Damaged/Tilted)">ঝড়ে পোল ভাঙা / হেলে পড়া (Storm Damaged/Tilted)</option>
                  <option value="নতুন পোল স্থাপন প্রয়োজন (New Pole Erection)">নতুন পোল স্থাপন প্রয়োজন (New Pole Erection)</option>
                  <option value="গাছ পড়ে তার ছেঁড়া (Tree Fallen / Wire Snapped)">গাছ পড়ে তার ছেঁড়া (Tree Fallen / Wire Snapped)</option>
                  <option value="ইনসুলেটর ব্লাস্ট ও জাম্পার ফল্ট (Insulator/Jumper Fault)">ইনসুলেটর ব্লাস্ট ও জাম্পার ফল্ট (Insulator/Jumper Fault)</option>
                  <option value="স্টে ওয়্যার ছেঁড়া / পোল শিফটিং (Stay Broken / Shifting)">স্টে ওয়্যার ছেঁড়া / পোল শিফটিং (Stay Broken / Shifting)</option>
                  <option value="গাড়ি বা ট্রাকের ধাক্কায় পোল ক্ষতিগ্রস্ত (Vehicle Impact Damage)">গাড়ি বা ট্রাকের ধাক্কায় পোল ক্ষতিগ্রস্ত (Vehicle Impact Damage)</option>
                </select>
              </div>

              <div>
                <label className={labelBaseClass}>
                  জরুরিতা / প্রায়োরিটি (Priority)
                </label>
                <select
                  id="pole-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className={selectBaseClass}
                >
                  <option value="Urgent">Urgent (জরুরী বিপদজনক)</option>
                  <option value="High">High (উচ্চ অগ্রাধিকার)</option>
                  <option value="Normal">Normal (স্বাভাবিক)</option>
                  <option value="Low">Low (পরবর্তী রুটিন)</option>
                </select>
              </div>

              <div>
                <label className={labelBaseClass}>
                  পোলের ধরণ (Pole Type)
                </label>
                <select
                  id="pole-type"
                  value={poleType}
                  onChange={(e) => setPoleType(e.target.value)}
                  className={selectBaseClass}
                >
                  <option value="PSC Pole (9 Meter)">PSC Pole (9 Meter)</option>
                  <option value="PSC Pole (11 Meter)">PSC Pole (11 Meter)</option>
                  <option value="Steel Tubular Pole">Steel Tubular Pole</option>
                  <option value="Spun Pre-stressed Concrete">Spun Pre-stressed Concrete</option>
                  <option value="Wooden / Other Pole">Wooden / Other Pole</option>
                </select>
              </div>

              <div>
                <label className={labelBaseClass}>
                  লাইনের ভোল্টেজ (Line Voltage)
                </label>
                <select
                  id="pole-voltage"
                  value={lineVoltage}
                  onChange={(e) => setLineVoltage(e.target.value)}
                  className={selectBaseClass}
                >
                  <option value="LT (230V/400V)">LT (230V/400V Low Tension)</option>
                  <option value="11 kV">11 kV (High Tension Line)</option>
                  <option value="33 kV">33 kV (Transmission Feeder)</option>
                </select>
              </div>

              <div>
                <label className={labelBaseClass}>
                  স্থানের নাম / রোড (Location / Landmark) *
                </label>
                <input
                  id="pole-address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="উদাঃ হাইস্কুল মোড়, মেইন রোড"
                  className={inputBaseClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelBaseClass}>
                  গৃহীত ব্যবস্থা (Action Taken & Maintenance Work)
                </label>
                <input
                  id="pole-action-taken"
                  type="text"
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  placeholder="উদাঃ নতুন পোল পুঁতে স্টে ওয়্যার ও ৩-ফেজ লাইন টান টান করা হয়েছে"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  ব্যবহৃত মালামাল (Materials / Consumables Used)
                </label>
                <input
                  id="pole-material"
                  type="text"
                  value={materialUsed}
                  onChange={(e) => setMaterialUsed(e.target.value)}
                  placeholder="উদাঃ ১টি ৯মি পোল, ১ সেট স্টে, ৪০মি কন্ডাক্টর"
                  className={inputBaseClass}
                />
              </div>
            </div>
          )}

          {/* 4. METER REPLESMENT */}
          {category === 'METER REPLESMENT' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className={labelBaseClass}>
                  গ্রাহক একাউন্ট নং / আইডি (Consumer ID) *
                </label>
                <input
                  id="mtr-consumer-id"
                  type="text"
                  required
                  value={consumerId}
                  onChange={(e) => setConsumerId(e.target.value)}
                  placeholder="উদাঃ CON-551029"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  গ্রাহকের নাম (Consumer Name)
                </label>
                <input
                  id="mtr-consumer-name"
                  type="text"
                  value={consumerName}
                  onChange={(e) => setConsumerName(e.target.value)}
                  placeholder="গ্রাহকের নাম"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  মিটার পরিবর্তনের কারণ (Replacement Reason) *
                </label>
                <select
                  id="mtr-reason"
                  value={replacementReason}
                  onChange={(e) => setReplacementReason(e.target.value)}
                  className={selectBaseClass}
                >
                  <option value="মিটার পুড়ে যাওয়া / ডিসপ্লে নষ্ট (Burnt / Display Fault)">মিটার পুড়ে যাওয়া / ডিসপ্লে নষ্ট (Burnt / Display Fault)</option>
                  <option value="মিটার জ্যাম বা রিডিং বন্ধ (Mechanical Jam / Stuck)">মিটার জ্যাম বা রিডিং বন্ধ (Mechanical Jam / Stuck)</option>
                  <option value="স্মার্ট প্রিপেইড মিটার আপগ্রেড (Smart Prepaid Upgrade)">স্মার্ট প্রিপেইড মিটার আপগ্রেড (Smart Prepaid Upgrade)</option>
                  <option value="গ্লাস ভাঙা ও সিল নষ্ট (Glass Broken / Tampered)">গ্লাস ভাঙা ও সিল নষ্ট (Glass Broken / Tampered)</option>
                  <option value="অতিরিক্ত দ্রুত বা ধীরগতির রিডিং (Fast / Slow Disputed)">অতিরিক্ত দ্রুত বা ধীরগতির রিডিং (Fast / Slow Disputed)</option>
                </select>
              </div>

              <div>
                <label className={labelBaseClass}>
                  পুরাতন মিটার নম্বর (Old Meter Serial No.) *
                </label>
                <input
                  id="mtr-old-no"
                  type="text"
                  required
                  value={oldMeterNo}
                  onChange={(e) => setOldMeterNo(e.target.value)}
                  placeholder="উদাঃ OLD-44910"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  পুরাতন মিটারের শেষ রিডিং (Old Meter Final Reading) *
                </label>
                <input
                  id="mtr-old-reading"
                  type="text"
                  required
                  value={oldMeterReading}
                  onChange={(e) => setOldMeterReading(e.target.value)}
                  placeholder="উদাঃ ০৮৭৪২"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  নতুন মিটার নম্বর (New Meter Serial No.) *
                </label>
                <input
                  id="mtr-new-no"
                  type="text"
                  required
                  value={newMeterNo}
                  onChange={(e) => setNewMeterNo(e.target.value)}
                  placeholder="উদাঃ DIG-2026-44102"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  নতুন মিটারের শুরুর রিডিং (New Initial Reading)
                </label>
                <input
                  id="mtr-new-initial-reading"
                  type="text"
                  value={newMeterInitialReading}
                  onChange={(e) => setNewMeterInitialReading(e.target.value)}
                  placeholder="000000"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  নতুন সিকিউরিটি সিল নং (New Meter Seal No.)
                </label>
                <input
                  id="mtr-new-seal"
                  type="text"
                  value={newMeterSealNo}
                  onChange={(e) => setNewMeterSealNo(e.target.value)}
                  placeholder="উদাঃ SL-99382"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  মিটারে ধরণ ও ফেজ (Meter Type & Phase)
                </label>
                <select
                  id="mtr-type-phase"
                  value={meterType}
                  onChange={(e) => setMeterType(e.target.value)}
                  className={selectBaseClass}
                >
                  <option value="Single Phase Digital">Single Phase Digital Meter</option>
                  <option value="Single Phase Smart Prepaid">Single Phase Smart Prepaid</option>
                  <option value="3-Phase LT-CT Meter">3-Phase LT-CT Meter</option>
                  <option value="3-Phase HT Meter">3-Phase HT Meter (11kV)</option>
                </select>
              </div>
            </div>
          )}

          {/* 5. DTR REPLESMENT */}
          {category === 'DTR REPLESMENT' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className={labelBaseClass}>
                  ট্রান্সফরমার নাম/কোড (DTR Name / No.) *
                </label>
                <input
                  id="dtr-name"
                  type="text"
                  required
                  value={dtrName}
                  onChange={(e) => setDtrName(e.target.value)}
                  placeholder="উদাঃ DTR-K-14 (কাশিমপুর বাজার)"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  পূর্বের ক্ষমতা (Existing Capacity kVA) *
                </label>
                <select
                  id="dtr-existing-capacity"
                  value={existingCapacity}
                  onChange={(e) => setExistingCapacity(e.target.value)}
                  className={selectBaseClass}
                >
                  <option value="25 kVA">25 kVA</option>
                  <option value="50 kVA">50 kVA</option>
                  <option value="63 kVA">63 kVA</option>
                  <option value="100 kVA">100 kVA</option>
                  <option value="200 kVA">200 kVA</option>
                  <option value="250 kVA">250 kVA</option>
                  <option value="315 kVA">315 kVA</option>
                  <option value="500 kVA">500 kVA</option>
                </select>
              </div>

              <div>
                <label className={labelBaseClass}>
                  নতুন ট্রান্সফরমার ক্ষমতা (New Capacity kVA) *
                </label>
                <select
                  id="dtr-new-capacity"
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                  className={selectBaseClass}
                >
                  <option value="25 kVA">25 kVA</option>
                  <option value="50 kVA">50 kVA</option>
                  <option value="63 kVA">63 kVA</option>
                  <option value="100 kVA">100 kVA</option>
                  <option value="200 kVA">200 kVA (Upgraded)</option>
                  <option value="250 kVA">250 kVA (Upgraded)</option>
                  <option value="315 kVA">315 kVA (Upgraded)</option>
                  <option value="500 kVA">500 kVA</option>
                </select>
              </div>

              <div>
                <label className={labelBaseClass}>
                  পুরাতন DTR সিরিয়াল নং (Old DTR Serial) *
                </label>
                <input
                  id="dtr-old-serial"
                  type="text"
                  required
                  value={oldDtrSerial}
                  onChange={(e) => setOldDtrSerial(e.target.value)}
                  placeholder="উদাঃ DTR-OLD-7712"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  নতুন DTR সিরিয়াল নং (New DTR Serial) *
                </label>
                <input
                  id="dtr-new-serial"
                  type="text"
                  required
                  value={newDtrSerial}
                  onChange={(e) => setNewDtrSerial(e.target.value)}
                  placeholder="উদাঃ DTR-NEW-99014"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label className={labelBaseClass}>
                  নষ্ট হওয়ার কারণ (Failure Reason) *
                </label>
                <select
                  id="dtr-failure-reason"
                  value={dtrFailureReason}
                  onChange={(e) => setDtrFailureReason(e.target.value)}
                  className={selectBaseClass}
                >
                  <option value="কয়েল পুড়ে যাওয়া / ওভারলোড ট্রিপ (Coil Burnt / Overload)">কয়েল পুড়ে যাওয়া / ওভারলোড ট্রিপ (Coil Burnt / Overload)</option>
                  <option value="বজ্রপাত ও হাইভোল্টেজ সার্জ (Lightning Surge / Flashover)">বজ্রপাত ও হাইভোল্টেজ সার্জ (Lightning Surge / Flashover)</option>
                  <option value="অয়েল লিকেজ ও কম বিডিভি (Oil Leakage / Low BDV)">অয়েল লিকেজ ও কম বিডিভি (Oil Leakage / Low BDV)</option>
                  <option value="এইচটি/এলটি বুশিং ড্যামেজ (HT/LT Bushing Crack)">এইচটি/এলটি বুশিং ড্যামেজ (HT/LT Bushing Crack)</option>
                  <option value="গ্রাহক লোড বৃদ্ধির কারণে আপগ্রেড (Capacity Upgrade)">গ্রাহক লোড বৃদ্ধির কারণে আপগ্রেড (Capacity Upgrade)</option>
                </select>
              </div>

              <div>
                <label className={labelBaseClass}>
                  আর্থিং রেজিস্ট্যান্স (Earth Resistance)
                </label>
                <input
                  id="dtr-earth-res"
                  type="text"
                  value={earthResistance}
                  onChange={(e) => setEarthResistance(e.target.value)}
                  placeholder="উদাঃ 1.5 Ohms (নিরাপদ < 2.0)"
                  className={inputBaseClass}
                />
              </div>

              <div className="flex items-center gap-3 pt-6 sm:col-span-2">
                <input
                  type="checkbox"
                  id="dtr-oil-checked"
                  checked={oilLevelChecked}
                  onChange={(e) => setOilLevelChecked(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <label htmlFor="dtr-oil-checked" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  ট্রান্সফরমার অয়েল লেভেল ও বিডিভি টেস্ট পরীক্ষা করে নিরাপদ পাওয়া গেছে
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: GPS & Photo Evidence Verification */}
        <div className={sectionCardClass}>
          <div className={sectionTitleClass}>
            <Camera className="w-4 h-4 text-slate-700" />
            <span>৩. সাইট লোকেশন ও কাজের ছবি (Photo & GPS Verification)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* GPS Location */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>জিপিএস লোকেশন (GPS Coordinates)</span>
                {locationGps && <span className="text-emerald-700 text-[11px] font-mono font-bold">✓ লোকেশন যুক্ত হয়েছে</span>}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={locationGps}
                  onChange={(e) => setLocationGps(e.target.value)}
                  placeholder="উদাঃ 23.810332, 90.412518"
                  className={`${inputBaseClass} font-mono`}
                />
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={fetchingGps}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <MapPin className={`w-4 h-4 ${fetchingGps ? 'animate-spin text-amber-600' : 'text-slate-600'}`} />
                  <span>{fetchingGps ? 'খুঁজছি...' : 'জিপিএস নিন'}</span>
                </button>
              </div>
            </div>

            {/* Photo Attachment */}
            <div>
              <label className={labelBaseClass}>
                কাজের প্রমাণের ছবি (Site / Meter Photo)
              </label>
              
              {photoPreview ? (
                <div className="relative inline-block rounded-xl overflow-hidden border border-slate-300 shadow-xs">
                  <img src={photoPreview} alt="Work site preview" className="h-28 w-auto object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={() => setPhotoPreview(null)}
                    className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-dashed border-slate-300 hover:border-slate-400 rounded-lg text-xs text-slate-700 font-medium transition-colors shadow-xs">
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span>ছবি আপলোড / ক্যামেরা</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={() => setSamplePhoto('site')}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 shrink-0"
                    title="নমুনা সাইট ছবি যুক্ত করুন"
                  >
                    নমুনা ছবি
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Remarks / Additional Notes */}
          <div>
            <label className={labelBaseClass}>
              অতিরিক্ত মন্তব্য / নোট (Worker Notes / Action Details)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="কাজের বিশেষ তথ্য বা পরবর্তী পদক্ষেপ থাকলে লিখুন..."
              className={inputBaseClass}
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>এডমিন প্যানেলে রিয়েল-টাইম সংরক্ষণ করা হবে</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-full sm:w-auto px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors text-sm"
              >
                বাতিল করুন
              </button>
            )}
            <button
              id="submit-entry-btn"
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>সেভ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-amber-400" />
                  <span>{category} ডাটা সেভ করুন (Submit)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
