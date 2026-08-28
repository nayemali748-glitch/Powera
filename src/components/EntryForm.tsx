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
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CategoryType, PowerEntry } from '../types';
import { createEntry } from '../services/api';
import { Language, translations } from '../utils/translations';

interface EntryFormProps {
  category: CategoryType;
  workerName: string;
  onSuccess: (entry: PowerEntry) => void;
  onBack?: () => void;
  lang?: Language;
}

export const EntryForm: React.FC<EntryFormProps> = ({
  category,
  workerName,
  onSuccess,
  onBack,
  lang = 'bn',
}) => {
  const t = translations[lang] || translations.bn;

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fetchingGps, setFetchingGps] = useState(false);

  // Common Form Fields
  const [worker, setWorker] = useState(workerName || 'WBSEDCL Lineman-01');
  const [workerPhone, setWorkerPhone] = useState('');
  const [feederName, setFeederName] = useState('11kV Town Feeder-01');
  const [substation, setSubstation] = useState('Central 33/11kV Substation');
  const [cccOffice, setCccOffice] = useState('Burdwan / Howrah CCC');
  const [locationGps, setLocationGps] = useState('');
  const [notes, setNotes] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Category-specific states
  // 1. NSC (New Service Connection)
  const [consumerName, setConsumerName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [consumerId, setConsumerId] = useState('');
  const [applicationNo, setApplicationNo] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [poleNo, setPoleNo] = useState('');
  const [appliedLoad, setAppliedLoad] = useState('2 kW');
  const [phase, setPhase] = useState<'Single Phase' | '3-Phase' | string>('Single Phase');
  const [tariffCategory, setTariffCategory] = useState('Domestic (A-Dom)');
  const [meterNo, setMeterNo] = useState('');
  const [meterMake, setMeterMake] = useState('Genus / Secure');
  const [initialReading, setInitialReading] = useState('000000');
  const [sealNo, setSealNo] = useState('');
  const [serviceCableLength, setServiceCableLength] = useState('25 Meters (2Cx10 sq.mm)');
  const [earthResistance, setEarthResistance] = useState('1.8 Ohms');

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
      ctx.fillText(`Ref: ${consumerId || poleNo || dtrName || 'Field Point'}`, 20, 150);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`✓ WBSEDCL Field Photo Verified`, 20, 200);
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
      workerName: worker || 'WBSEDCL Staff',
      workerPhone,
      date: nowIso,
      status: 'Completed',
      feederName,
      substation,
      locationGps,
      photoUrl: photoPreview || undefined,
      notes,
    };

    // Category specifics
    if (category === 'NSC') {
      entryPayload.consumerName = consumerName || 'WBSEDCL Consumer';
      entryPayload.fatherName = fatherName;
      entryPayload.consumerId = consumerId || `CON-${Math.floor(100000000 + Math.random() * 900000000)}`;
      entryPayload.mobile = mobile;
      entryPayload.address = address || 'West Bengal, India';
      entryPayload.poleNo = poleNo || 'P-12';
      entryPayload.appliedLoad = appliedLoad;
      entryPayload.phase = phase;
      entryPayload.meterNo = meterNo || `WB-${Math.floor(100000 + Math.random() * 900000)}`;
      entryPayload.initialReading = initialReading || '000000';
      entryPayload.sealNo = sealNo || `WB-SL-${Math.floor(10000 + Math.random() * 90000)}`;
      entryPayload.serviceCableLength = serviceCableLength;
      entryPayload.earthResistance = earthResistance;
    } else if (category === 'DISCONNECTION') {
      entryPayload.consumerId = consumerId || `CON-${Math.floor(100000000 + Math.random() * 900000000)}`;
      entryPayload.consumerName = consumerName || 'Consumer (Defaulter)';
      entryPayload.mobile = mobile;
      entryPayload.address = address || 'Field Site';
      entryPayload.poleNo = poleNo;
      entryPayload.meterNo = meterNo;
      entryPayload.arrearAmount = arrearAmount || '4,500';
      entryPayload.reason = disconnectionReason;
      entryPayload.finalReading = finalReading || '12450';
      entryPayload.disconnectionType = disconnectionType;
      entryPayload.cutoutSealed = cutoutSealed;
      entryPayload.sealNo = cutoutSealNo || `SL-CUT-${Math.floor(1000 + Math.random() * 9000)}`;
      entryPayload.actionTaken = disconnectionActionTaken;
    } else if (category === 'POLE CASE') {
      entryPayload.poleNo = poleNo || `P-${Math.floor(10 + Math.random() * 90)}`;
      entryPayload.address = address || 'Overhead Line Route';
      entryPayload.issueType = issueType;
      entryPayload.priority = priority;
      entryPayload.poleType = poleType;
      entryPayload.lineVoltage = lineVoltage;
      entryPayload.actionTaken = actionTaken || 'পোল মেরামত ও ওভারহেড লাইন নিরাপদ করা হয়েছে';
      entryPayload.materialUsed = materialUsed || 'PSC Pole 9M, V-Cross Arm, Stay Set';
    } else if (category === 'METER REPLESMENT') {
      entryPayload.consumerId = consumerId || `CON-${Math.floor(100000000 + Math.random() * 900000000)}`;
      entryPayload.consumerName = consumerName || 'Consumer';
      entryPayload.address = address;
      entryPayload.poleNo = poleNo;
      entryPayload.oldMeterNo = oldMeterNo || `OLD-MTR-${Math.floor(10000 + Math.random() * 90000)}`;
      entryPayload.finalReading = oldMeterReading || '09840';
      entryPayload.replacementReason = replacementReason;
      entryPayload.newMeterNo = newMeterNo || `WB-GEN-${Math.floor(100000 + Math.random() * 900000)}`;
      entryPayload.initialReading = newMeterInitialReading || '000000';
      entryPayload.sealNo = newMeterSealNo || `WB-SL-${Math.floor(10000 + Math.random() * 90000)}`;
      entryPayload.meterType = meterType;
      entryPayload.phase = phase;
    } else if (category === 'DTR REPLESMENT') {
      entryPayload.dtrName = dtrName || `DTR-${Math.floor(10 + Math.random() * 90)}`;
      entryPayload.address = address || 'DTR Sub-station Yard';
      entryPayload.existingCapacity = existingCapacity;
      entryPayload.newCapacity = newCapacity;
      entryPayload.oldDtrSerial = oldDtrSerial || `DTR-OLD-${Math.floor(1000 + Math.random() * 9000)}`;
      entryPayload.newDtrSerial = newDtrSerial || `DTR-NEW-${Math.floor(1000 + Math.random() * 9000)}`;
      entryPayload.failureReason = dtrFailureReason;
      entryPayload.oilLevelChecked = oilLevelChecked;
      entryPayload.earthResistance = earthPitResistance;
    }

    try {
      const created = await createEntry(entryPayload);
      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
      } catch (e) {
        // ignore
      }
      setSuccessMessage(t.entryCreatedSuccess);
      setTimeout(() => {
        onSuccess(created);
      }, 1200);
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

      {/* Main Form Fields */}
      <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-6">
        {/* Section 1: Common Station & Grid Infrastructure Details */}
        <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <Building className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              1. {t.substation} & {t.feeder}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {t.substation} *
              </label>
              <input
                type="text"
                required
                value={substation}
                onChange={(e) => setSubstation(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g. 33/11kV Main Substation"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {t.feeder} *
              </label>
              <input
                type="text"
                required
                value={feederName}
                onChange={(e) => setFeederName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g. 11kV Town Feeder-01"
              />
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

        {/* Section 2: Category Specific Primary Fields */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              2. {category} Field Parameters (WBSEDCL Indian Standard)
            </h3>
          </div>

          {/* 1. NSC SPECIFIC FORM */}
          {category === 'NSC' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.consumerName} *
                </label>
                <input
                  type="text"
                  required
                  value={consumerName}
                  onChange={(e) => setConsumerName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Enter Full Name"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.fatherHusbandName}
                </label>
                <input
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Father's / Husband's Name"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.consumerId} *
                </label>
                <input
                  type="text"
                  required
                  value={consumerId}
                  onChange={(e) => setConsumerId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="e.g. 100293847 (9 Digits)"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.applicationNo}
                </label>
                <input
                  type="text"
                  value={applicationNo}
                  onChange={(e) => setApplicationNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="e.g. CA-2026-9812"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.mobileNo} *
                </label>
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="e.g. 98300XXXXX"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.appliedLoad} *
                </label>
                <select
                  value={appliedLoad}
                  onChange={(e) => setAppliedLoad(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold"
                >
                  <option value="1 kW (Domestic)">1 kW (Domestic)</option>
                  <option value="2 kW (Domestic Standard)">2 kW (Domestic Standard)</option>
                  <option value="3 kW (Domestic / Small Com)">3 kW (Domestic / Small Com)</option>
                  <option value="5 kW (Commercial B-Com)">5 kW (Commercial B-Com)</option>
                  <option value="7.5 kW (Commercial / Workshop)">7.5 kW (Commercial / Workshop)</option>
                  <option value="10 kW (Industrial / High)">10 kW (Industrial / High)</option>
                  <option value="5 HP (Agriculture Pump)">5 HP (Agriculture Pump)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.phaseSupply}
                </label>
                <select
                  value={phase}
                  onChange={(e) => setPhase(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Single Phase">{t.singlePhase}</option>
                  <option value="3-Phase">{t.threePhase}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.tariffCategory}
                </label>
                <select
                  value={tariffCategory}
                  onChange={(e) => setTariffCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Domestic (A-Dom)">{t.domestic}</option>
                  <option value="Commercial (B-Com)">{t.commercial}</option>
                  <option value="Agriculture">{t.agriculture}</option>
                  <option value="Industrial">{t.industrial}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.meterNo} *
                </label>
                <input
                  type="text"
                  required
                  value={meterNo}
                  onChange={(e) => setMeterNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold"
                  placeholder="e.g. WB26-987654"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.initialReading}
                </label>
                <input
                  type="text"
                  value={initialReading}
                  onChange={(e) => setInitialReading(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="000000"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.sealNo} *
                </label>
                <input
                  type="text"
                  required
                  value={sealNo}
                  onChange={(e) => setSealNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-blue-700 font-bold"
                  placeholder="e.g. WB-SL-98214"
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
                  placeholder="e.g. P-45 / Span-02"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.serviceCableLength}
                </label>
                <input
                  type="text"
                  value={serviceCableLength}
                  onChange={(e) => setServiceCableLength(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. 25 Meters (2Cx10 sq.mm PVC/Armoured)"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.earthResistance}
                </label>
                <input
                  type="text"
                  value={earthResistance}
                  onChange={(e) => setEarthResistance(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="e.g. 1.8 Ohms (< 5 Ω)"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  {t.addressLocation} *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Village / GP / Municipality / Post Office / Pin Code"
                />
              </div>
            </div>
          )}

          {/* 2. DISCONNECTION SPECIFIC FORM */}
          {category === 'DISCONNECTION' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.consumerId} *
                </label>
                <input
                  type="text"
                  required
                  value={consumerId}
                  onChange={(e) => setConsumerId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="e.g. 100234567"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.consumerName} *
                </label>
                <input
                  type="text"
                  required
                  value={consumerName}
                  onChange={(e) => setConsumerName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Consumer Full Name"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.arrearAmount} *
                </label>
                <input
                  type="text"
                  required
                  value={arrearAmount}
                  onChange={(e) => setArrearAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold text-red-600"
                  placeholder="e.g. ₹ 7,850"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.finalReading} (kWh) *
                </label>
                <input
                  type="text"
                  required
                  value={finalReading}
                  onChange={(e) => setFinalReading(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="e.g. 14230"
                />
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
                  {t.poleNo} / Meter No
                </label>
                <input
                  type="text"
                  value={poleNo}
                  onChange={(e) => setPoleNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="e.g. Pole P-18 / Meter WB-394"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">
                  {t.addressLocation} *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Premises / Shop / Residence Address"
                />
              </div>
            </div>
          )}

          {/* 3. POLE CASE SPECIFIC FORM */}
          {category === 'POLE CASE' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.poleNo} *
                </label>
                <input
                  type="text"
                  required
                  value={poleNo}
                  onChange={(e) => setPoleNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold"
                  placeholder="e.g. Pole No P-84 / Span 04"
                />
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
                <label className="block font-bold text-slate-700 mb-1">
                  {t.actionTaken} *
                </label>
                <input
                  type="text"
                  required
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. নতুন পোল স্থাপন, কংক্রিটিং ও কন্ডাক্টর টানা সম্পন্ন"
                />
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
                <label className="block font-bold text-slate-700 mb-1">
                  {t.addressLocation} *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Location landmark / Village / Road point"
                />
              </div>
            </div>
          )}

          {/* 4. METER REPLACEMENT SPECIFIC FORM */}
          {category === 'METER REPLESMENT' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.consumerId} *
                </label>
                <input
                  type="text"
                  required
                  value={consumerId}
                  onChange={(e) => setConsumerId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="e.g. 100289123"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.consumerName} *
                </label>
                <input
                  type="text"
                  required
                  value={consumerName}
                  onChange={(e) => setConsumerName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Consumer Name"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.oldMeterNo} *
                </label>
                <input
                  type="text"
                  required
                  value={oldMeterNo}
                  onChange={(e) => setOldMeterNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="e.g. OLD-WB-9821"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.oldMeterReading} (kWh) *
                </label>
                <input
                  type="text"
                  required
                  value={oldMeterReading}
                  onChange={(e) => setOldMeterReading(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold"
                  placeholder="e.g. 08945"
                />
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
                <label className="block font-bold text-slate-700 mb-1">
                  {t.newMeterNo} *
                </label>
                <input
                  type="text"
                  required
                  value={newMeterNo}
                  onChange={(e) => setNewMeterNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold text-emerald-700"
                  placeholder="e.g. WB26-GEN-88319"
                />
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
                  {t.newMeterSealNo} *
                </label>
                <input
                  type="text"
                  required
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
                <label className="block font-bold text-slate-700 mb-1">
                  {t.addressLocation} *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Consumer Premises Address"
                />
              </div>
            </div>
          )}

          {/* 5. DTR REPLACEMENT SPECIFIC FORM */}
          {category === 'DTR REPLESMENT' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.dtrName} *
                </label>
                <input
                  type="text"
                  required
                  value={dtrName}
                  onChange={(e) => setDtrName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold"
                  placeholder="e.g. DTR-VILLAGE-04"
                />
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
                <label className="block font-bold text-slate-700 mb-1">
                  {t.newDtrSerial} *
                </label>
                <input
                  type="text"
                  required
                  value={newDtrSerial}
                  onChange={(e) => setNewDtrSerial(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold text-blue-700"
                  placeholder="e.g. WB-DTR-2026-081"
                />
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
                <label className="block font-bold text-slate-700 mb-1">
                  {t.addressLocation} *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="DTR Sub-station Yard Location / Village / Pole Structure"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: GPS & Photo Evidence Section */}
        <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <Camera className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              3. {t.gpsLocation} & {t.photoEvidence}
            </h3>
          </div>

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

            {/* Photo upload / sample */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {t.photoEvidence}
              </label>
              <div className="flex gap-2">
                <label className="flex-1 px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>{t.uploadPhoto}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={setSamplePhoto}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  title="Generate sample verified photo stamp"
                >
                  {t.takeSamplePhoto}
                </button>
              </div>
            </div>
          </div>

          {/* Photo Preview if present */}
          {photoPreview && (
            <div className="pt-2 flex items-center gap-3">
              <img
                src={photoPreview}
                alt="Field preview"
                className="w-24 h-20 object-cover rounded-lg border border-slate-300 shadow-2xs"
              />
              <div className="text-xs text-slate-500 space-y-1">
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Photo Attached
                </span>
                <button
                  type="button"
                  onClick={() => setPhotoPreview(null)}
                  className="text-red-500 hover:underline cursor-pointer font-medium text-[11px]"
                >
                  Remove Photo
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
    </div>
  );
};
