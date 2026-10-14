import React, { useMemo, useState } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Scissors,
  HelpCircle,
  RefreshCw,
  Search,
  X,
  FileCheck,
  Zap,
  TrendingUp,
  CreditCard,
  ChevronRight,
  ExternalLink,
  Layers,
  ArrowRight
} from 'lucide-react';
import { DisconnectionTask } from '../../types';
import {
  getTaskPhase,
  getTaskConnectionClass,
  matchesDisconnectionStatusFilter,
  PhaseFilterType,
  ConnectionClassFilterType,
  cleanWorkerOrAgencyName
} from '../../utils/disconnectionClassifier';
import { DisconnectionConsumerCard } from './DisconnectionConsumerCard';

interface AgencyDisconnectionDashboardProps {
  tasks: DisconnectionTask[];
  agencyName: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onUpdateStatus?: (task: DisconnectionTask) => void;
  onRequestReissue?: (task: DisconnectionTask) => Promise<void> | void;
  onSelectStatusFilter?: (status: string) => void;
  onSelectClassFilter?: (cls: ConnectionClassFilterType) => void;
  lang?: 'en' | 'bn';
  onClose?: () => void;
}

export const AgencyDisconnectionDashboard: React.FC<AgencyDisconnectionDashboardProps> = ({
  tasks,
  agencyName,
  onRefresh,
  isRefreshing = false,
  onUpdateStatus,
  onRequestReissue,
  onSelectStatusFilter,
  onSelectClassFilter,
  lang = 'bn',
  onClose
}) => {
  const [selectedClass, setSelectedClass] = useState<ConnectionClassFilterType>('ALL');
  const [selectedPhase, setSelectedPhase] = useState<PhaseFilterType>('ALL');
  const [activeCardStatus, setActiveCardStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Overall counts for class selector badges
  const classCounts = useMemo(() => {
    let dom = 0;
    let com = 0;
    let ind = 0;
    let stw = 0;
    tasks.forEach(t => {
      const cls = getTaskConnectionClass(t);
      if (cls === 'DOMESTIC') dom++;
      else if (cls === 'COMMERCIAL') com++;
      else if (cls === 'INDUSTRIAL') ind++;
      else if (cls === 'STW') stw++;
    });
    return { total: tasks.length, dom, com, ind, stw };
  }, [tasks]);

  // 2. Filter tasks based on selected Class and Phase
  const classPhaseFilteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (selectedClass !== 'ALL') {
        const cls = getTaskConnectionClass(t);
        if (cls !== selectedClass) return false;
      }
      if (selectedPhase !== 'ALL') {
        const ph = getTaskPhase(t);
        if (ph !== selectedPhase) return false;
      }
      return true;
    });
  }, [tasks, selectedClass, selectedPhase]);

  // Helper currency format
  const formatRs = (num: number) => {
    if (isNaN(num)) return '₹0';
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  // 3. Compute dynamic stats from classPhaseFilteredTasks
  const metrics = useMemo(() => {
    let totalAssigned = classPhaseFilteredTasks.length;
    let totalDue = 0;
    let totalCollected = 0;

    let paidCount = 0;
    let paidAmount = 0;

    let disconnectCount = 0;
    let disconnectAmount = 0;

    let officeTeamCount = 0;
    let officeTeamAmount = 0;

    let alreadyDiscCount = 0;
    let alreadyDiscAmount = 0;

    let disputeCount = 0;
    let disputeAmount = 0;

    let notFoundCount = 0;
    let notFoundAmount = 0;

    let pendingCount = 0;
    let pendingAmount = 0;

    let reportsGivenCount = 0;

    classPhaseFilteredTasks.forEach(t => {
      const due = parseFloat(String(t.outstandingDue || (t as any)['D2 Net O/S'] || '0').replace(/[^0-9.-]/g, '')) || 0;
      const paidAmt = parseFloat(String(t.paidAmount || (t as any)['Paid Amount'] || '0').replace(/[^0-9.-]/g, '')) || 0;

      totalDue += due;

      if (matchesDisconnectionStatusFilter(t, 'PAID')) {
        paidCount++;
        reportsGivenCount++;
        const amt = paidAmt > 0 ? paidAmt : due;
        paidAmount += amt;
        totalCollected += amt;
      } else if (matchesDisconnectionStatusFilter(t, 'DISCONNECT')) {
        disconnectCount++;
        reportsGivenCount++;
        disconnectAmount += due;
      } else if (matchesDisconnectionStatusFilter(t, 'OFFICE TEAM')) {
        officeTeamCount++;
        reportsGivenCount++;
        officeTeamAmount += due;
      } else if (matchesDisconnectionStatusFilter(t, 'ALREADY DISCONNECTED')) {
        alreadyDiscCount++;
        reportsGivenCount++;
        alreadyDiscAmount += due;
      } else if (matchesDisconnectionStatusFilter(t, 'DISPUTE')) {
        disputeCount++;
        reportsGivenCount++;
        disputeAmount += due;
      } else if (matchesDisconnectionStatusFilter(t, 'NOT FOUND')) {
        notFoundCount++;
        reportsGivenCount++;
        notFoundAmount += due;
      } else {
        pendingCount++;
        pendingAmount += due;
      }
    });

    const completionRate = totalAssigned > 0 ? Math.round((reportsGivenCount / totalAssigned) * 100) : 0;

    return {
      totalAssigned,
      totalDue,
      totalCollected,
      reportsGivenCount,
      completionRate,
      paid: { count: paidCount, amount: paidAmount },
      disconnect: { count: disconnectCount, amount: disconnectAmount },
      officeTeam: { count: officeTeamCount, amount: officeTeamAmount },
      alreadyDisc: { count: alreadyDiscCount, amount: alreadyDiscAmount },
      dispute: { count: disputeCount, amount: disputeAmount },
      notFound: { count: notFoundCount, amount: notFoundAmount },
      pending: { count: pendingCount, amount: pendingAmount }
    };
  }, [classPhaseFilteredTasks]);

  // 4. Consumers matching the active card status & search query
  const deckConsumers = useMemo(() => {
    return classPhaseFilteredTasks.filter(t => {
      if (activeCardStatus !== 'ALL') {
        if (activeCardStatus === 'REPORTED') {
          if (matchesDisconnectionStatusFilter(t, 'PENDING')) return false;
        } else if (!matchesDisconnectionStatusFilter(t, activeCardStatus)) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cId = String(t.consumerId || (t as any)['Consumer Id'] || '').toLowerCase();
        const cNm = String(t.consumerName || (t as any)['Name'] || '').toLowerCase();
        const ph = String(t.phoneNumber || (t as any)['Mobile'] || '').toLowerCase();
        const meter = String(t.meterNumber || (t as any).meterNo || (t as any)['Meter No'] || '').toLowerCase();
        return cId.includes(q) || cNm.includes(q) || ph.includes(q) || meter.includes(q);
      }
      return true;
    });
  }, [classPhaseFilteredTasks, activeCardStatus, searchQuery]);

  const handleApplyToMainList = (statusTarget?: string) => {
    if (onSelectClassFilter) onSelectClassFilter(selectedClass);
    if (onSelectStatusFilter) onSelectStatusFilter(statusTarget || activeCardStatus);
    if (onClose) onClose();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 text-white rounded-2xl p-4 sm:p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
            <Zap className="w-6 h-6 fill-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>{cleanWorkerOrAgencyName(agencyName)}</span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  {lang === 'bn' ? 'এজেন্সি ড্যাশবোর্ড' : 'Agency Dashboard'}
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-1">
              {lang === 'bn'
                ? 'রিয়েল-টাইম ডিসকানেকশন কাজের অগ্রগতি, পেমেন্ট ও শ্রেণিভিত্তিক পারফরম্যান্স রিপোর্ট'
                : 'Real-time disconnection progress, payment collection & connection class metrics'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'উপভোক্তা তালিকায় যান' : 'Consumer List'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Class & Phase Filter Bar (Domestic / Commercial / etc.) */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Connection Class Buttons */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-amber-600" />
              <span>{lang === 'bn' ? '🏷️ শ্রেণি ফিল্টার (Class Filter — Domestic / Commercial):' : '🏷️ Connection Class Filter:'}</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedClass('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  selectedClass === 'ALL'
                    ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{lang === 'bn' ? 'সব শ্রেণি (All Class)' : 'All Class'}</span>
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-white">
                  {classCounts.total}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedClass('DOMESTIC')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  selectedClass === 'DOMESTIC'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                }`}
              >
                <span>{lang === 'bn' ? 'গার্হস্থ্য (Domestic)' : 'Domestic'}</span>
                <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedClass === 'DOMESTIC' ? 'bg-white text-blue-800' : 'bg-blue-100 text-blue-900'
                }`}>
                  {classCounts.dom}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedClass('COMMERCIAL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  selectedClass === 'COMMERCIAL'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
                }`}
              >
                <span>{lang === 'bn' ? 'বাণিজ্যিক (Commercial)' : 'Commercial'}</span>
                <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedClass === 'COMMERCIAL' ? 'bg-white text-purple-800' : 'bg-purple-100 text-purple-900'
                }`}>
                  {classCounts.com}
                </span>
              </button>

              {classCounts.ind > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedClass('INDUSTRIAL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                    selectedClass === 'INDUSTRIAL'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                  }`}
                >
                  <span>{lang === 'bn' ? 'শিল্প (Industrial)' : 'Industrial'}</span>
                  <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                    selectedClass === 'INDUSTRIAL' ? 'bg-white text-amber-800' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {classCounts.ind}
                  </span>
                </button>
              )}

              {classCounts.stw > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedClass('STW')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                    selectedClass === 'STW'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  <span>{lang === 'bn' ? 'সেচ / STW' : 'STW / Agri'}</span>
                  <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                    selectedClass === 'STW' ? 'bg-white text-emerald-800' : 'bg-emerald-100 text-emerald-900'
                  }`}>
                    {classCounts.stw}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Phase Filter Buttons */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
              {lang === 'bn' ? '⚡ ফেজ ফিল্টার (Phase):' : '⚡ Phase Filter:'}
            </span>
            <div className="flex items-center gap-1.5">
              {(['ALL', '1PH', '3PH'] as PhaseFilterType[]).map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => setSelectedPhase(ph)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                    selectedPhase === ph
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {ph === 'ALL'
                    ? (lang === 'bn' ? 'সব ফেজ' : 'All Phase')
                    : ph === '1PH'
                    ? '1-PH'
                    : '3-PH'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. The 8 Main Performance Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Card 1: Total Assigned (মোট কতগুলো কাজ) */}
        <button
          type="button"
          onClick={() => setActiveCardStatus('ALL')}
          className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCardStatus === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400 shadow-md'
              : 'bg-slate-50 hover:bg-white text-slate-900 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${
              activeCardStatus === 'ALL' ? 'text-amber-400' : 'text-slate-500'
            }`}>
              {lang === 'bn' ? 'মোট কাজ (Assigned)' : 'Total Assigned'}
            </span>
            <Users className={`w-4 h-4 ${activeCardStatus === 'ALL' ? 'text-amber-400' : 'text-slate-500'}`} />
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1.5 leading-none">
            {metrics.totalAssigned}
          </div>
          <div className={`text-[11px] font-bold mt-1.5 ${
            activeCardStatus === 'ALL' ? 'text-slate-300' : 'text-slate-500'
          }`}>
            {formatRs(metrics.totalDue)} বকেয়া
          </div>
        </button>

        {/* Card 2: Reports Submitted / Updated (কয়টা রিপোর্ট দিয়েছে) */}
        <button
          type="button"
          onClick={() => setActiveCardStatus(activeCardStatus === 'REPORTED' ? 'ALL' : 'REPORTED')}
          className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCardStatus === 'REPORTED'
              ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-300 shadow-md'
              : 'bg-blue-50/70 hover:bg-blue-50 text-blue-950 border-blue-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${
              activeCardStatus === 'REPORTED' ? 'text-white' : 'text-blue-700'
            }`}>
              {lang === 'bn' ? 'রিপোর্ট প্রদান (Updated)' : 'Reports Given'}
            </span>
            <FileCheck className={`w-4 h-4 ${activeCardStatus === 'REPORTED' ? 'text-white' : 'text-blue-600'}`} />
          </div>
          <div className={`text-2xl sm:text-3xl font-black mt-1.5 leading-none ${
            activeCardStatus === 'REPORTED' ? 'text-white' : 'text-blue-950'
          }`}>
            {metrics.reportsGivenCount}
          </div>
          <div className={`text-[11px] font-bold mt-1.5 ${
            activeCardStatus === 'REPORTED' ? 'text-blue-100' : 'text-blue-700'
          }`}>
            {metrics.completionRate}% সম্পন্ন
          </div>
        </button>

        {/* Card 3: Paid Reports (কয়টা পেইড) */}
        <button
          type="button"
          onClick={() => setActiveCardStatus(activeCardStatus === 'PAID' ? 'ALL' : 'PAID')}
          className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCardStatus === 'PAID'
              ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300 shadow-md'
              : 'bg-emerald-50/70 hover:bg-emerald-50 text-emerald-950 border-emerald-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${
              activeCardStatus === 'PAID' ? 'text-white' : 'text-emerald-700'
            }`}>
              {lang === 'bn' ? 'পরিশোধিত (Paid)' : 'Paid Reports'}
            </span>
            <CheckCircle2 className={`w-4 h-4 ${activeCardStatus === 'PAID' ? 'text-white' : 'text-emerald-600'}`} />
          </div>
          <div className={`text-2xl sm:text-3xl font-black mt-1.5 leading-none ${
            activeCardStatus === 'PAID' ? 'text-white' : 'text-emerald-950'
          }`}>
            {metrics.paid.count}
          </div>
          <div className={`text-[11px] font-bold mt-1.5 ${
            activeCardStatus === 'PAID' ? 'text-emerald-100' : 'text-emerald-700'
          }`}>
            {formatRs(metrics.paid.amount)} সংগৃহীত
          </div>
        </button>

        {/* Card 4: Disconnected Reports (কয়টা ডিসকানেক্ট) */}
        <button
          type="button"
          onClick={() => setActiveCardStatus(activeCardStatus === 'DISCONNECT' ? 'ALL' : 'DISCONNECT')}
          className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCardStatus === 'DISCONNECT'
              ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-300 shadow-md'
              : 'bg-rose-50/70 hover:bg-rose-50 text-rose-950 border-rose-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${
              activeCardStatus === 'DISCONNECT' ? 'text-white' : 'text-rose-700'
            }`}>
              {lang === 'bn' ? 'সংযোগ বিচ্ছিন্ন' : 'Disconnected'}
            </span>
            <Scissors className={`w-4 h-4 ${activeCardStatus === 'DISCONNECT' ? 'text-white' : 'text-rose-600'}`} />
          </div>
          <div className={`text-2xl sm:text-3xl font-black mt-1.5 leading-none ${
            activeCardStatus === 'DISCONNECT' ? 'text-white' : 'text-rose-950'
          }`}>
            {metrics.disconnect.count}
          </div>
          <div className={`text-[11px] font-bold mt-1.5 ${
            activeCardStatus === 'DISCONNECT' ? 'text-rose-100' : 'text-rose-600'
          }`}>
            {formatRs(metrics.disconnect.amount)} বিচ্ছিন্ন
          </div>
        </button>

        {/* Card 5: Office Team (কয়টা অফিস টিম) */}
        <button
          type="button"
          onClick={() => setActiveCardStatus(activeCardStatus === 'OFFICE TEAM' ? 'ALL' : 'OFFICE TEAM')}
          className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCardStatus === 'OFFICE TEAM'
              ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-300 shadow-md'
              : 'bg-indigo-50/70 hover:bg-indigo-50 text-indigo-950 border-indigo-200 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${
              activeCardStatus === 'OFFICE TEAM' ? 'text-white' : 'text-indigo-700'
            }`}>
              {lang === 'bn' ? 'অফিস টিম (Office Team)' : 'Office Team'}
            </span>
            <Building2 className={`w-4 h-4 ${activeCardStatus === 'OFFICE TEAM' ? 'text-white' : 'text-indigo-600'}`} />
          </div>
          <div className={`text-2xl sm:text-3xl font-black mt-1.5 leading-none ${
            activeCardStatus === 'OFFICE TEAM' ? 'text-white' : 'text-indigo-950'
          }`}>
            {metrics.officeTeam.count}
          </div>
          <div className={`text-[11px] font-bold mt-1.5 ${
            activeCardStatus === 'OFFICE TEAM' ? 'text-indigo-100' : 'text-indigo-700'
          }`}>
            {formatRs(metrics.officeTeam.amount)} অফিস নোট
          </div>
        </button>

        {/* Card 6: Already Disconnected (পূর্বে বিচ্ছিন্ন) */}
        <button
          type="button"
          onClick={() => setActiveCardStatus(activeCardStatus === 'ALREADY DISCONNECTED' ? 'ALL' : 'ALREADY DISCONNECTED')}
          className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCardStatus === 'ALREADY DISCONNECTED'
              ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300 shadow-md'
              : 'bg-amber-50/70 hover:bg-amber-50 text-amber-950 border-amber-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${
              activeCardStatus === 'ALREADY DISCONNECTED' ? 'text-white' : 'text-amber-800'
            }`}>
              {lang === 'bn' ? 'পূর্বে বিচ্ছিন্ন' : 'Already Disc.'}
            </span>
            <AlertTriangle className={`w-4 h-4 ${activeCardStatus === 'ALREADY DISCONNECTED' ? 'text-white' : 'text-amber-700'}`} />
          </div>
          <div className={`text-2xl sm:text-3xl font-black mt-1.5 leading-none ${
            activeCardStatus === 'ALREADY DISCONNECTED' ? 'text-white' : 'text-amber-950'
          }`}>
            {metrics.alreadyDisc.count}
          </div>
          <div className={`text-[11px] font-bold mt-1.5 ${
            activeCardStatus === 'ALREADY DISCONNECTED' ? 'text-amber-100' : 'text-amber-700'
          }`}>
            {formatRs(metrics.alreadyDisc.amount)} পূর্বে ডিসকানেক্ট
          </div>
        </button>

        {/* Card 7: Dispute / Objection (আপত্তি / বিরোধ) */}
        <button
          type="button"
          onClick={() => setActiveCardStatus(activeCardStatus === 'DISPUTE' ? 'ALL' : 'DISPUTE')}
          className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCardStatus === 'DISPUTE'
              ? 'bg-purple-600 text-white border-purple-600 ring-2 ring-purple-300 shadow-md'
              : 'bg-purple-50/70 hover:bg-purple-50 text-purple-950 border-purple-200 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${
              activeCardStatus === 'DISPUTE' ? 'text-white' : 'text-purple-700'
            }`}>
              {lang === 'bn' ? 'আপত্তি / বিরোধ' : 'Dispute'}
            </span>
            <HelpCircle className={`w-4 h-4 ${activeCardStatus === 'DISPUTE' ? 'text-white' : 'text-purple-600'}`} />
          </div>
          <div className={`text-2xl sm:text-3xl font-black mt-1.5 leading-none ${
            activeCardStatus === 'DISPUTE' ? 'text-white' : 'text-purple-950'
          }`}>
            {metrics.dispute.count}
          </div>
          <div className={`text-[11px] font-bold mt-1.5 ${
            activeCardStatus === 'DISPUTE' ? 'text-purple-100' : 'text-purple-700'
          }`}>
            {formatRs(metrics.dispute.amount)} আপত্তি
          </div>
        </button>

        {/* Card 8: Pending Disconnections (বাকি / পেন্ডিং) */}
        <button
          type="button"
          onClick={() => setActiveCardStatus(activeCardStatus === 'PENDING' ? 'ALL' : 'PENDING')}
          className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCardStatus === 'PENDING'
              ? 'bg-slate-700 text-white border-slate-700 ring-2 ring-slate-400 shadow-md'
              : 'bg-slate-100/70 hover:bg-slate-100 text-slate-900 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${
              activeCardStatus === 'PENDING' ? 'text-white' : 'text-slate-600'
            }`}>
              {lang === 'bn' ? 'বাকি / পেন্ডিং' : 'Pending'}
            </span>
            <Clock className={`w-4 h-4 ${activeCardStatus === 'PENDING' ? 'text-white' : 'text-slate-500'}`} />
          </div>
          <div className={`text-2xl sm:text-3xl font-black mt-1.5 leading-none ${
            activeCardStatus === 'PENDING' ? 'text-white' : 'text-slate-900'
          }`}>
            {metrics.pending.count}
          </div>
          <div className={`text-[11px] font-bold mt-1.5 ${
            activeCardStatus === 'PENDING' ? 'text-slate-200' : 'text-slate-500'
          }`}>
            {formatRs(metrics.pending.amount)} বাকি কাজ
          </div>
        </button>
      </div>

      {/* 4. Consumer List Section for Selected Filter */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xs">
              {deckConsumers.length}
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                {activeCardStatus === 'ALL'
                  ? (lang === 'bn' ? 'সকল বরাদ্দকৃত উপভোক্তা' : 'All Assigned Consumers')
                  : activeCardStatus === 'REPORTED'
                  ? (lang === 'bn' ? 'রিপোর্ট প্রদানকৃত উপভোক্তা' : 'Reported Consumers')
                  : activeCardStatus === 'PAID'
                  ? (lang === 'bn' ? 'পরিশোধিত উপভোক্তা তালিকা' : 'Paid Consumers List')
                  : activeCardStatus === 'DISCONNECT'
                  ? (lang === 'bn' ? 'সংযোগ বিচ্ছিন্ন উপভোক্তা তালিকা' : 'Disconnected Consumers List')
                  : activeCardStatus === 'OFFICE TEAM'
                  ? (lang === 'bn' ? 'অফিস টিম উপভোক্তা তালিকা' : 'Office Team Consumers List')
                  : activeCardStatus === 'ALREADY DISCONNECTED'
                  ? (lang === 'bn' ? 'পূর্বে বিচ্ছিন্ন উপভোক্তা তালিকা' : 'Already Disconnected Consumers List')
                  : activeCardStatus === 'DISPUTE'
                  ? (lang === 'bn' ? 'আপত্তিযুক্ত উপভোক্তা তালিকা' : 'Dispute Consumers List')
                  : (lang === 'bn' ? 'বাকি / পেন্ডিং উপভোক্তা তালিকা' : 'Pending Consumers List')}
                {selectedClass !== 'ALL' && ` • ${selectedClass}`}
                {selectedPhase !== 'ALL' && ` • ${selectedPhase}`}
              </h3>
              <p className="text-[10px] text-slate-500">
                {lang === 'bn' ? 'কার্ডে ক্লিক করে স্ট্যাটাস পরিবর্তন করুন' : 'Click any card above to filter'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Search */}
            <div className="relative min-w-[180px] sm:min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={lang === 'bn' ? 'আইডি, নাম, মোবাইল...' : 'Search ID, Name, Mobile...'}
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Action to switch to main list with this filter */}
            {onSelectStatusFilter && (
              <button
                type="button"
                onClick={() => handleApplyToMainList()}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
                title="Open in Main Consumer List"
              >
                <span>{lang === 'bn' ? 'মূল তালিকায় কাজ করুন' : 'Open in Main List'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Consumers List Rendering */}
        {deckConsumers.length === 0 ? (
          <div className="text-center py-8 text-slate-500 space-y-1 bg-white rounded-xl border border-slate-200">
            <p className="text-xs font-bold text-slate-700">
              {lang === 'bn' ? 'কোনো উপভোক্তা পাওয়া যায়নি' : 'No consumers found'}
            </p>
            <p className="text-[11px] text-slate-400">
              {lang === 'bn' ? 'ফিল্টার বা সার্চ পরিবর্তন করে দেখুন' : 'Try changing your search or filters'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
            {deckConsumers.map((task, idx) => (
              <DisconnectionConsumerCard
                key={`${task.consumerId || task.taskId || idx}-${idx}`}
                task={task}
                onUpdateStatus={onUpdateStatus || (() => {})}
                onRequestReissue={onRequestReissue}
                isAdmin={false}
                lang={lang}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
