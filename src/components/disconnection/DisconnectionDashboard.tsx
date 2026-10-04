import React, { useMemo, useState } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Building2,
  Zap,
  Flame,
  Award,
  ChevronRight,
  CreditCard,
  Search,
  ExternalLink,
  X,
  Layers
} from 'lucide-react';
import { DisconnectionTask, DisconnectionStats } from '../../types';
import {
  getTaskPhase,
  getTaskConnectionClass,
  matchesDisconnectionStatusFilter,
  PhaseFilterType,
  ConnectionClassFilterType,
  cleanWorkerOrAgencyName
} from '../../utils/disconnectionClassifier';
import { DisconnectionConsumerCard } from './DisconnectionConsumerCard';

interface DisconnectionDashboardProps {
  tasks: DisconnectionTask[];
  stats: DisconnectionStats;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onSelectStatusFilter?: (status: string) => void;
  onSelectWorkerFilter?: (worker: string) => void;
  onSelectPhaseFilter?: (phase: PhaseFilterType) => void;
  onSelectClassFilter?: (cls: ConnectionClassFilterType) => void;
  onUpdateStatus?: (task: DisconnectionTask) => void;
  onRequestReissue?: (task: DisconnectionTask) => Promise<void> | void;
  onApproveReissue?: (task: DisconnectionTask) => Promise<void> | void;
  onDeleteTask?: (task: DisconnectionTask) => Promise<void> | void;
  isAdmin?: boolean;
  lang?: 'en' | 'bn';
}

export const DisconnectionDashboard: React.FC<DisconnectionDashboardProps> = ({
  tasks,
  stats,
  onRefresh,
  isRefreshing = false,
  onSelectStatusFilter,
  onSelectWorkerFilter,
  onSelectPhaseFilter,
  onSelectClassFilter,
  onUpdateStatus,
  onRequestReissue,
  onApproveReissue,
  onDeleteTask,
  isAdmin = false,
  lang = 'en'
}) => {
  const [workerSearch, setWorkerSearch] = useState('');
  const [activeDeckStatus, setActiveDeckStatus] = useState<string | null>('PAID');
  const [activeDeckPhase, setActiveDeckPhase] = useState<PhaseFilterType>('ALL');
  const [activeDeckClass, setActiveDeckClass] = useState<ConnectionClassFilterType>('ALL');
  const [deckSearch, setDeckSearch] = useState('');

  // Dynamically compute live backend stats directly from tasks so counts are always 100% accurate
  const computedStats = useMemo(() => {
    const total = tasks.length;
    let completed = 0;
    let disconnected = 0;
    let pending = 0;
    let paid = 0;
    let notFound = 0;
    let dispute = 0;
    let officeTeam = 0;
    let reissue = 0;
    let urgent = 0;

    let phase1Count = 0;
    let phase3Count = 0;
    let domesticCount = 0;
    let commercialCount = 0;
    let industrialCount = 0;
    let stwCount = 0;

    let totalOutstanding = 0;
    let totalCollected = 0;

    const workerMap = new Map<string, {
      workerName: string;
      assigned: number;
      completed: number;
      pending: number;
      reportsSubmitted: number;
    }>();

    tasks.forEach(t => {
      const pAmt = parseFloat(String(t.paidAmount || (t as any)['Paid Amount'] || '0').replace(/[^0-9.-]/g, '')) || 0;
      const oAmt = parseFloat(String(t.outstandingDue || (t as any)['D2 Net O/S'] || '0').replace(/[^0-9.-]/g, '')) || 0;

      totalOutstanding += oAmt;
      if (matchesDisconnectionStatusFilter(t, 'PAID')) {
        totalCollected += (pAmt > 0 ? pAmt : oAmt);
      } else {
        totalCollected += pAmt;
      }

      if (matchesDisconnectionStatusFilter(t, 'DISCONNECT')) {
        disconnected++;
        completed++;
      } else if (matchesDisconnectionStatusFilter(t, 'PAID')) {
        paid++;
        completed++;
      } else if (matchesDisconnectionStatusFilter(t, 'NOT FOUND')) {
        notFound++;
      } else if (matchesDisconnectionStatusFilter(t, 'DISPUTE')) {
        dispute++;
      } else if (matchesDisconnectionStatusFilter(t, 'OFFICE TEAM')) {
        officeTeam++;
      } else if (matchesDisconnectionStatusFilter(t, 'REISSUE')) {
        reissue++;
      } else {
        pending++;
      }

      if (matchesDisconnectionStatusFilter(t, 'URGENT')) {
        urgent++;
      }

      const ph = getTaskPhase(t);
      if (ph === '3PH') phase3Count++;
      else phase1Count++;

      const cls = getTaskConnectionClass(t);
      if (cls === 'COMMERCIAL') commercialCount++;
      else if (cls === 'INDUSTRIAL') industrialCount++;
      else if (cls === 'STW') stwCount++;
      else domesticCount++;

      // Group workers (Name only, no ID)
      const wName = cleanWorkerOrAgencyName(t.assignedWorkerName || t.assignedAgency || t.Agency || t.submittedBy || '') || 'Unassigned';
      if (!workerMap.has(wName)) {
        workerMap.set(wName, {
          workerName: wName,
          assigned: 0,
          completed: 0,
          pending: 0,
          reportsSubmitted: 0
        });
      }
      const w = workerMap.get(wName)!;
      w.assigned++;
      if (matchesDisconnectionStatusFilter(t, 'COMPLETED')) {
        w.completed++;
      } else if (matchesDisconnectionStatusFilter(t, 'PENDING')) {
        w.pending++;
      }
      const st = String(t.taskStatus || t.disconStatus || 'PENDING').toUpperCase();
      if (t.workerReport || t.workerRemarks || t.reportDate || (st !== 'PENDING' && st !== 'IN PROGRESS')) {
        w.reportsSubmitted++;
      }
    });

    const workerList = Array.from(workerMap.values()).map(w => ({
      ...w,
      completionRate: w.assigned > 0 ? Math.round((w.completed / w.assigned) * 100) : 0
    })).sort((a, b) => b.completed - a.completed);

    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      disconnected,
      pending,
      paid,
      notFound,
      dispute,
      officeTeam,
      reissue,
      urgent,
      phase1Count,
      phase3Count,
      domesticCount,
      commercialCount,
      industrialCount,
      stwCount,
      completionPct,
      totalOutstanding,
      totalCollected,
      workerList: workerList.length > 0 ? workerList : (stats.workerPerformance || [])
    };
  }, [tasks, stats]);

  const filteredWorkers = useMemo(() => {
    if (!workerSearch.trim()) return computedStats.workerList;
    const q = workerSearch.toLowerCase().trim();
    return computedStats.workerList.filter(w => w.workerName.toLowerCase().includes(q));
  }, [computedStats.workerList, workerSearch]);

  const statCards = [
    {
      id: 'total',
      label: lang === 'bn' ? 'মোট উপভোক্তা (Total)' : 'Total Consumers',
      count: computedStats.total,
      filterStatus: 'ALL',
      bg: 'bg-slate-900 text-white border-slate-800',
      activeRing: 'ring-4 ring-amber-400',
      iconBg: 'bg-slate-800 text-amber-400',
      icon: Users,
      desc: lang === 'bn' ? 'সম্পূর্ণ ডিসকানেকশন তালিকা' : 'All disconnection consumers'
    },
    {
      id: 'paid',
      label: lang === 'bn' ? 'পরিশোধিত (Paid)' : 'Paid',
      count: computedStats.paid,
      filterStatus: 'PAID',
      bg: 'bg-teal-50 text-teal-950 border-teal-300',
      activeRing: 'ring-4 ring-teal-500 bg-teal-100/90',
      iconBg: 'bg-teal-600 text-white',
      icon: CreditCard,
      desc: `₹${computedStats.totalCollected.toLocaleString('en-IN')} ${lang === 'bn' ? 'আদায়' : 'collected'}`
    },
    {
      id: 'disconnected',
      label: lang === 'bn' ? 'বিচ্ছিন্ন (Disconnected)' : 'Disconnected',
      count: computedStats.disconnected,
      filterStatus: 'DISCONNECT',
      bg: 'bg-rose-50 text-rose-950 border-rose-300',
      activeRing: 'ring-4 ring-rose-500 bg-rose-100/90',
      iconBg: 'bg-rose-600 text-white',
      icon: Zap,
      desc: lang === 'bn' ? 'সংযোগ বিচ্ছিন্ন সম্পন্ন' : 'Power cut executed'
    },
    {
      id: 'completed',
      label: lang === 'bn' ? 'সম্পন্ন (Completed)' : 'Completed',
      count: computedStats.completed,
      filterStatus: 'COMPLETED',
      bg: 'bg-emerald-50 text-emerald-950 border-emerald-200',
      activeRing: 'ring-4 ring-emerald-500 bg-emerald-100/90',
      iconBg: 'bg-emerald-600 text-white',
      icon: CheckCircle2,
      desc: `${computedStats.completionPct}% ${lang === 'bn' ? 'সম্পন্নতার হার' : 'overall rate'}`
    },
    {
      id: 'pending',
      label: lang === 'bn' ? 'অমীমাংসিত (Connected)' : 'Connected / Pending',
      count: computedStats.pending,
      filterStatus: 'PENDING',
      bg: 'bg-amber-50 text-amber-950 border-amber-200',
      activeRing: 'ring-4 ring-amber-500 bg-amber-100/90',
      iconBg: 'bg-amber-500 text-slate-950',
      icon: Clock,
      desc: lang === 'bn' ? 'মাঠে কার্যকর করার অপেক্ষায়' : 'Awaiting field execution'
    },
    {
      id: 'dispute',
      label: lang === 'bn' ? 'বিরোধ (Dispute)' : 'Dispute',
      count: computedStats.dispute,
      filterStatus: 'DISPUTE',
      bg: 'bg-orange-50 text-orange-950 border-orange-200',
      activeRing: 'ring-4 ring-orange-500 bg-orange-100/90',
      iconBg: 'bg-orange-500 text-white',
      icon: AlertTriangle,
      desc: lang === 'bn' ? 'বিল বা রিডিং সংক্রান্ত আপত্তি' : 'Bill or reading disputed'
    },
    {
      id: 'officeTeam',
      label: lang === 'bn' ? 'অফিস টিম (Office Team)' : 'Office Team',
      count: computedStats.officeTeam,
      filterStatus: 'OFFICE TEAM',
      bg: 'bg-indigo-50 text-indigo-950 border-indigo-200',
      activeRing: 'ring-4 ring-indigo-500 bg-indigo-100/90',
      iconBg: 'bg-indigo-600 text-white',
      icon: Building2,
      desc: lang === 'bn' ? 'বিশেষ আধিকারিক দল প্রয়োজন' : 'Special squad required'
    },
    {
      id: 'notFound',
      label: lang === 'bn' ? 'অনুপস্থিত (Not Found)' : 'Not Found',
      count: computedStats.notFound,
      filterStatus: 'NOT FOUND',
      bg: 'bg-slate-100 text-slate-900 border-slate-300',
      activeRing: 'ring-4 ring-slate-500 bg-slate-200/90',
      iconBg: 'bg-slate-700 text-white',
      icon: HelpCircle,
      desc: lang === 'bn' ? 'ঠিকানা/মিটার পাওয়া যায়নি' : 'Locked / unlocatable premises'
    },
    {
      id: 'reissue',
      label: lang === 'bn' ? 'পুনঃপ্রেরণ (Reissue)' : 'Reissue',
      count: computedStats.reissue,
      filterStatus: 'REISSUE',
      bg: 'bg-purple-50 text-purple-950 border-purple-200',
      activeRing: 'ring-4 ring-purple-500 bg-purple-100/90',
      iconBg: 'bg-purple-600 text-white',
      icon: RefreshCw,
      desc: lang === 'bn' ? 'পুনর্বার তদন্ত প্রয়োজন' : 'Re-verification requested'
    },
    {
      id: 'urgent',
      label: lang === 'bn' ? 'জরুরি (Urgent)' : 'Urgent',
      count: computedStats.urgent,
      filterStatus: 'URGENT',
      bg: 'bg-red-50 text-red-950 border-red-300',
      activeRing: 'ring-4 ring-red-500 bg-red-100/90',
      iconBg: 'bg-red-600 text-white',
      icon: Flame,
      desc: lang === 'bn' ? 'উচ্চ অগ্রাধিকার উপভোক্তা' : 'High-priority defaulters'
    }
  ];

  // Filtered consumer list for the active Performance Deck selection
  const activeDeckConsumers = useMemo(() => {
    if (!activeDeckStatus) return [];
    return tasks.filter(task => {
      if (!matchesDisconnectionStatusFilter(task, activeDeckStatus)) return false;
      if (activeDeckPhase !== 'ALL' && getTaskPhase(task) !== activeDeckPhase) return false;
      if (activeDeckClass !== 'ALL' && getTaskConnectionClass(task) !== activeDeckClass) return false;
      if (deckSearch.trim()) {
        const q = deckSearch.toLowerCase().trim();
        const cId = String(task.consumerId || '').toLowerCase();
        const cNm = String(task.consumerName || '').toLowerCase();
        const ph = String(task.phoneNumber || '').toLowerCase();
        const addr = String(task.consumerAddress || '').toLowerCase();
        const mru = String(task.mru || task.mruSection || '').toLowerCase();
        return cId.includes(q) || cNm.includes(q) || ph.includes(q) || addr.includes(q) || mru.includes(q);
      }
      return true;
    });
  }, [tasks, activeDeckStatus, activeDeckPhase, activeDeckClass, deckSearch]);

  const activeCardObj = statCards.find(c => c.filterStatus === activeDeckStatus);

  return (
    <div className="space-y-6" id="disconnection-dashboard">
      {/* Top Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {lang === 'bn' ? 'অ্যাক্টিভ পারফরম্যান্স ডেক বোর্ড (Performance Deck Board)' : 'Active Disconnection Performance Deck Board'}
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
              {lang === 'bn' ? `মোট তালিকা: ${computedStats.total}` : `Total List: ${computedStats.total}`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'bn' 
              ? 'Paid, Disconnected বা যেকোনো কার্ডে ক্লিক করলে নিচে সরাসরি সেই উপভোক্তাদের সম্পূর্ণ ডেটা দেখা যাবে' 
              : 'Click on Paid, Disconnected, or any metric card below to immediately view those consumers and their details.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            id="dashboard-refresh-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all active:scale-95"
            title="Refresh statistics from Google Sheets backend"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? (lang === 'bn' ? 'রিফ্রেশ হচ্ছে...' : 'Refreshing...') : (lang === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh Live Data')}</span>
          </button>
        </div>
      </div>

      {/* Progress & Dues Summary Banner (Interactive!) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Completion Rate -> Click to view COMPLETED */}
        <button
          type="button"
          onClick={() => setActiveDeckStatus('COMPLETED')}
          className={`text-left bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 border border-slate-700 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md active:scale-[0.99] ${
            activeDeckStatus === 'COMPLETED' ? 'ring-4 ring-amber-400' : ''
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              {lang === 'bn' ? 'মোট সম্পন্নতার হার (Completed)' : 'Completion Rate (Click to View)'}
            </span>
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          <div className="my-3 w-full">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-400">{computedStats.completionPct}%</span>
              <span className="text-xs text-slate-300">
                ({computedStats.completed} / {computedStats.total} {lang === 'bn' ? 'উপভোক্তা' : 'consumers'})
              </span>
            </div>
            <div className="w-full bg-slate-700/80 rounded-full h-2.5 mt-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(computedStats.completionPct, 100)}%` }}
              ></div>
            </div>
          </div>
          <p className="text-[11px] text-slate-300 flex items-center justify-between w-full">
            <span>{lang === 'bn' ? `বিচ্ছিন্ন: ${computedStats.disconnected} • পরিশোধিত: ${computedStats.paid}` : `Disconnected: ${computedStats.disconnected} • Paid: ${computedStats.paid}`}</span>
            <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
          </p>
        </button>

        {/* Total Arrears Outstanding -> Click to view ALL */}
        <button
          type="button"
          onClick={() => setActiveDeckStatus('ALL')}
          className={`text-left bg-rose-50 border border-rose-200 text-rose-950 rounded-2xl p-5 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md active:scale-[0.99] ${
            activeDeckStatus === 'ALL' ? 'ring-4 ring-rose-500' : ''
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold tracking-wider text-rose-700 uppercase">
              {lang === 'bn' ? 'মোট বকেয়া পরিমাণ (Total List)' : 'Total Outstanding Arrears'}
            </span>
            <CreditCard className="w-5 h-5 text-rose-600" />
          </div>
          <div className="my-3">
            <div className="text-2xl font-black text-rose-700">
              ₹{computedStats.totalOutstanding.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-rose-800 font-bold mt-1">
              {computedStats.total} {lang === 'bn' ? 'জন উপভোক্তার মোট ডিসকানেকশন লিস্ট' : 'total consumers in disconnection list'}
            </p>
          </div>
          <span className="text-[11px] text-rose-700 font-bold flex items-center justify-between w-full">
            <span>{lang === 'bn' ? 'সব উপভোক্তা দেখতে ক্লিক করুন' : 'Click to view all consumers'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>

        {/* Total Arrears Collected -> Click to view PAID */}
        <button
          type="button"
          onClick={() => setActiveDeckStatus('PAID')}
          className={`text-left bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl p-5 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md active:scale-[0.99] ${
            activeDeckStatus === 'PAID' ? 'ring-4 ring-emerald-500' : ''
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold tracking-wider text-emerald-700 uppercase">
              {lang === 'bn' ? 'পরিশোধিত উপভোক্তা (Paid Consumers)' : 'Recovered in Field (Paid Consumers)'}
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="my-3">
            <div className="text-2xl font-black text-emerald-700">
              {computedStats.paid} {lang === 'bn' ? 'জন Paid' : 'Paid'} (₹{computedStats.totalCollected.toLocaleString('en-IN')})
            </div>
            <p className="text-xs text-emerald-800 font-bold mt-1">
              {computedStats.paid} {lang === 'bn' ? 'জন উপভোক্তা বিল পরিশোধ করেছেন' : 'consumers have paid their dues'}
            </p>
          </div>
          <span className="text-[11px] text-emerald-700 font-bold flex items-center justify-between w-full">
            <span>{lang === 'bn' ? 'Paid উপভোক্তাদের ডেটা দেখতে ক্লিক করুন' : 'Click to view Paid consumers data'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>

      {/* 10 Core Interactive Metric Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
            {lang === 'bn' ? 'স্ট্যাটাস অনুযায়ী উপভোক্তাদের তালিকা দেখুন (কার্ডে ক্লিক করুন)' : 'Interactive Status Deck (Click Any Card to View Consumer Data)'}
          </h3>
          <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            {lang === 'bn' ? 'সক্রিয় ডেক বোর্ড (Active)' : 'Deck Board Active'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {statCards.map(card => {
            const Icon = card.icon;
            const isSelected = activeDeckStatus === card.filterStatus;
            return (
              <button
                key={card.id}
                id={`stat-card-${card.id}`}
                type="button"
                onClick={() => {
                  setActiveDeckStatus(card.filterStatus);
                }}
                className={`text-left p-3.5 rounded-2xl border ${card.bg} ${
                  isSelected ? card.activeRing : ''
                } shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer flex flex-col justify-between group`}
                title={`Show ${card.label} consumer data`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-bold tracking-tight line-clamp-1">
                    {card.label}
                  </span>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${card.iconBg}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-black tracking-tight">{card.count}</div>
                  <p className="text-[10px] opacity-75 mt-0.5 line-clamp-1">{card.desc}</p>
                </div>

                <div className="mt-2 pt-2 border-t border-current/10 flex items-center justify-between text-[10px] font-bold opacity-90 group-hover:opacity-100">
                  <span>{isSelected ? (lang === 'bn' ? 'নিচে দেখানো হচ্ছে' : 'Showing Below') : (lang === 'bn' ? 'ডেটা দেখুন' : 'Show Data')}</span>
                  <ChevronRight className={`w-3 h-3 transition-transform ${isSelected ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ACTIVE CONSUMER DATA PANEL ON PERFORMANCE DECK BOARD */}
      {activeDeckStatus && (
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-slate-900 text-amber-400 text-xs font-black uppercase tracking-wider">
                {activeCardObj?.label || activeDeckStatus}
              </span>
              <span className="text-sm font-black text-slate-900">
                {activeDeckConsumers.length} {lang === 'bn' ? 'জন উপভোক্তার তথ্য' : 'Consumers Found'}
              </span>
              {activeDeckPhase !== 'ALL' && (
                <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold">
                  {activeDeckPhase === '3PH' ? '3 PH' : '1 PH'}
                </span>
              )}
              {activeDeckClass !== 'ALL' && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                  {activeDeckClass}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 sm:flex-none">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={deckSearch}
                  onChange={e => setDeckSearch(e.target.value)}
                  placeholder={lang === 'bn' ? 'নাম বা আইডি খুঁজুন...' : 'Search consumer...'}
                  className="w-full sm:w-52 pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {onSelectStatusFilter && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeDeckPhase !== 'ALL' && onSelectPhaseFilter) onSelectPhaseFilter(activeDeckPhase);
                    if (activeDeckClass !== 'ALL' && onSelectClassFilter) onSelectClassFilter(activeDeckClass);
                    onSelectStatusFilter(activeDeckStatus);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'সম্পূর্ণ তালিকায় যান' : 'Open in Consumer List'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveDeckStatus(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                title="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {activeDeckConsumers.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm font-semibold">
              {lang === 'bn'
                ? 'এই স্ট্যাটাস বা ফিল্টারে কোনো উপভোক্তা পাওয়া যায়নি।'
                : 'No consumers match this status filter.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[680px] overflow-y-auto pr-1">
              {activeDeckConsumers.slice(0, 60).map((task, idx) => (
                <DisconnectionConsumerCard
                  key={`${task.taskId || task.consumerId || idx}-${idx}`}
                  task={task}
                  onUpdateStatus={t => {
                    if (onUpdateStatus) {
                      onUpdateStatus(t);
                    } else if (onSelectStatusFilter) {
                      onSelectStatusFilter(activeDeckStatus);
                    }
                  }}
                  onRequestReissue={onRequestReissue}
                  onApproveReissue={onApproveReissue}
                  isAdmin={isAdmin}
                  onDeleteTask={onDeleteTask}
                  lang={lang}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Worker Performance Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs" id="worker-performance-table">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                {lang === 'bn' ? 'কর্মী ও এজেন্সির কার্যকারিতা (Worker Performance)' : 'Worker & Agency Performance'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'bn' 
                ? 'ফিল্ড কর্মীদের কাজের বরাদ্দ, সম্পন্নতা ও রিপোর্ট দাখিলের অনুপাত' 
                : 'Live tracking of assigned tasks, completions, pending backlog, and reports.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={workerSearch}
                onChange={e => setWorkerSearch(e.target.value)}
                placeholder={lang === 'bn' ? 'কর্মী খুঁজুন...' : 'Search worker...'}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>

        {filteredWorkers.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs font-medium">
            {lang === 'bn' ? 'কোনো কর্মী তথ্য পাওয়া যায়নি।' : 'No worker assignment records found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-2.5 px-3 rounded-l-lg">{lang === 'bn' ? 'কর্মীর নাম (Worker Name)' : 'Worker Name'}</th>
                  <th className="py-2.5 px-3 text-center">{lang === 'bn' ? 'বরাদ্দ (Assigned)' : 'Assigned'}</th>
                  <th className="py-2.5 px-3 text-center">{lang === 'bn' ? 'সম্পন্ন (Completed)' : 'Completed'}</th>
                  <th className="py-2.5 px-3 text-center">{lang === 'bn' ? 'অমীমাংসিত (Pending)' : 'Pending'}</th>
                  <th className="py-2.5 px-3 text-center">{lang === 'bn' ? 'রিপোর্ট দাখিল' : 'Reports Submitted'}</th>
                  <th className="py-2.5 px-3 text-right rounded-r-lg">{lang === 'bn' ? 'সম্পন্ন % (Completion)' : 'Completion %'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredWorkers.map((w, idx) => {
                  return (
                    <tr
                      key={idx}
                      onClick={() => onSelectWorkerFilter && onSelectWorkerFilter(w.workerName)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      title={`Filter View List by ${w.workerName}`}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-black text-[11px] flex items-center justify-center shrink-0 border border-slate-200 group-hover:bg-amber-100 group-hover:text-amber-900 group-hover:border-amber-300 transition-colors">
                            {w.workerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                              {w.workerName}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {w.assigned} {lang === 'bn' ? 'টি কাজ বরাদ্দ' : 'tasks assigned'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                          {w.assigned}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-emerald-600">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
                          {w.completed}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-amber-600">
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200">
                          {w.pending}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-indigo-600">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200">
                          {w.reportsSubmitted}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden hidden sm:block">
                            <div
                              className={`h-2 rounded-full ${
                                w.completionRate >= 80 ? 'bg-emerald-500' :
                                w.completionRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(w.completionRate, 100)}%` }}
                            ></div>
                          </div>
                          <span className={`font-black text-xs px-2 py-0.5 rounded-md border ${
                            w.completionRate >= 80 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            w.completionRate >= 50 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {w.completionRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
