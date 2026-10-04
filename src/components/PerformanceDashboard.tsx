import React, { useState, useMemo } from 'react';
import { 
  Zap, 
  Scissors, 
  TowerControl, 
  Gauge, 
  Activity, 
  CheckCircle2, 
  TrendingUp, 
  Clock, 
  BarChart3, 
  ShieldCheck,
  Award,
  CreditCard,
  Power,
  HelpCircle,
  AlertCircle,
  Users,
  Search,
  X,
  Phone,
  MapPin,
  ExternalLink,
  MoreVertical
} from 'lucide-react';
import { CategoryType, PowerEntry, DisconnectionTask } from '../types';
import { Language, translations } from '../utils/translations';
import {
  getTaskPhase,
  getTaskConnectionClass,
  matchesDisconnectionStatus,
  PhaseFilterType,
  ClassFilterType,
  StatusFilterType
} from '../utils/disconnectionClassifier';

interface PerformanceDashboardProps {
  entries: PowerEntry[];
  categoryCounts: Record<string, number>;
  onSelectCategory: (category: CategoryType) => void;
  currentLanguage?: Language;
  disconnectionTasks?: DisconnectionTask[];
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  entries,
  categoryCounts,
  onSelectCategory,
  currentLanguage = 'en',
  disconnectionTasks = [],
}) => {
  const t = translations[currentLanguage] || translations.en;

  const [selectedDiscStatus, setSelectedDiscStatus] = useState<StatusFilterType | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilterType>('ALL');
  const [classFilter, setClassFilter] = useState<ClassFilterType>('ALL');
  const [deckSearch, setDeckSearch] = useState('');
  const [showThreeDotFilter, setShowThreeDotFilter] = useState(false);

  // Derive Disconnection tasks from prop or fallback to DISCONNECTION entries
  const effectiveDiscTasks: DisconnectionTask[] = useMemo(() => {
    if (disconnectionTasks && disconnectionTasks.length > 0) {
      return disconnectionTasks;
    }
    return entries
      .filter((e) => e.category === 'DISCONNECTION')
      .map((e) => ({
        id: e.id || `TASK-DISC-${e.consumerId}`,
        consumerId: e.consumerId || e.id,
        consumerName: e.consumerName || 'N/A',
        address: e.address || '',
        mobile: e.mobile || '',
        meterNo: e.meterNo || '',
        poleNo: e.poleNo || '',
        arrearAmount: e.arrearAmount || '0',
        disconStatus: e.disconStatus || e.status || 'CONNECTED',
        agencyName: e.agencyName || '',
        updatedBy: e.workerName || '',
        updatedAt: e.date || '',
        remarks: e.notes || e.reason || '',
        baseClass: e.baseClass || e.tariffCategory || '',
        device: e.device || e.phase || '',
        category: e.tariffCategory || e.baseClass || '',
      }));
  }, [disconnectionTasks, entries]);

  const totalDisconnectionListCount = Math.max(
    categoryCounts['DISCONNECTION'] || 0,
    effectiveDiscTasks.length
  );

  const nonDiscCount =
    (categoryCounts['NSC'] || 0) +
    (categoryCounts['POLE CASE'] || 0) +
    (categoryCounts['METER REPLESMENT'] || 0) +
    (categoryCounts['DTR REPLESMENT'] || 0);

  const totalEntries = Math.max(entries.length, nonDiscCount + totalDisconnectionListCount);
  const completedEntries = entries.filter(e => e.status === 'Completed' || e.status === 'Approved').length;
  const pendingEntries = entries.filter(e => e.status === 'Pending' || e.status === 'In Progress').length;
  const withGps = entries.filter(e => !!e.locationGps).length;
  const withMedia = entries.filter(e => !!e.photoUrl).length;

  const completionRate = totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 100;

  // Filtered Disconnection tasks by Phase & Category
  const filteredDiscByPhaseClass = useMemo(() => {
    return effectiveDiscTasks.filter((task) => {
      if (phaseFilter !== 'ALL' && getTaskPhase(task) !== phaseFilter) return false;
      if (classFilter !== 'ALL' && getTaskConnectionClass(task) !== classFilter) return false;
      return true;
    });
  }, [effectiveDiscTasks, phaseFilter, classFilter]);

  // Disconnection Status Counts
  const discMetrics = useMemo(() => {
    const total = filteredDiscByPhaseClass.length;
    const paid = filteredDiscByPhaseClass.filter((t) => matchesDisconnectionStatus(t, 'Paid')).length;
    const disconnected = filteredDiscByPhaseClass.filter((t) => matchesDisconnectionStatus(t, 'Disconnected')).length;
    const connected = filteredDiscByPhaseClass.filter((t) => matchesDisconnectionStatus(t, 'Connected')).length;
    const notFound = filteredDiscByPhaseClass.filter((t) => matchesDisconnectionStatus(t, 'Not Found')).length;
    const dispute = filteredDiscByPhaseClass.filter((t) => matchesDisconnectionStatus(t, 'Dispute')).length;
    return { total, paid, disconnected, connected, notFound, dispute };
  }, [filteredDiscByPhaseClass]);

  const activeDeckConsumers = useMemo(() => {
    if (!selectedDiscStatus) return [];
    const q = deckSearch.trim().toLowerCase();
    return filteredDiscByPhaseClass.filter((task) => {
      const statusMatch =
        selectedDiscStatus === 'ALL'
          ? true
          : matchesDisconnectionStatus(task, selectedDiscStatus);
      if (!statusMatch) return false;
      if (!q) return true;
      return (
        (task.consumerId || '').toLowerCase().includes(q) ||
        (task.consumerName || '').toLowerCase().includes(q) ||
        (task.meterNo || '').toLowerCase().includes(q) ||
        (task.mobile || '').toLowerCase().includes(q) ||
        (task.address || '').toLowerCase().includes(q)
      );
    });
  }, [filteredDiscByPhaseClass, selectedDiscStatus, deckSearch]);

  const categoryStats = [
    {
      id: 'NSC' as CategoryType,
      name: 'NSC',
      label: t.nscTitle,
      count: categoryCounts['NSC'] || 0,
      icon: Zap,
      color: 'amber',
      bgLight: 'bg-amber-50',
      textAccent: 'text-amber-700',
      borderAccent: 'border-amber-300',
      barColor: 'bg-amber-500',
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    },
    {
      id: 'DISCONNECTION' as CategoryType,
      name: 'DISCONNECTION',
      label: t.disconnectionTitle,
      count: totalDisconnectionListCount,
      icon: Scissors,
      color: 'rose',
      bgLight: 'bg-rose-50',
      textAccent: 'text-rose-700',
      borderAccent: 'border-rose-300',
      barColor: 'bg-rose-500',
      badgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
    },
    {
      id: 'POLE CASE' as CategoryType,
      name: 'POLE CASE',
      label: t.poleCaseTitle,
      count: categoryCounts['POLE CASE'] || 0,
      icon: TowerControl,
      color: 'sky',
      bgLight: 'bg-sky-50',
      textAccent: 'text-sky-700',
      borderAccent: 'border-sky-300',
      barColor: 'bg-sky-500',
      badgeBg: 'bg-sky-100 text-sky-900 border-sky-300',
    },
    {
      id: 'METER REPLESMENT' as CategoryType,
      name: 'METER REPLESMENT',
      label: t.meterReplacementTitle,
      count: categoryCounts['METER REPLESMENT'] || 0,
      icon: Gauge,
      color: 'emerald',
      bgLight: 'bg-emerald-50',
      textAccent: 'text-emerald-700',
      borderAccent: 'border-emerald-300',
      barColor: 'bg-emerald-500',
      badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    {
      id: 'DTR REPLESMENT' as CategoryType,
      name: 'DTR REPLESMENT',
      label: t.dtrReplacementTitle,
      count: categoryCounts['DTR REPLESMENT'] || 0,
      icon: Activity,
      color: 'indigo',
      bgLight: 'bg-indigo-50',
      textAccent: 'text-indigo-700',
      borderAccent: 'border-indigo-300',
      barColor: 'bg-indigo-500',
      badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    },
  ];

  const handleToggleDiscDeck = (status: StatusFilterType) => {
    setSelectedDiscStatus((prev) => (prev === status ? null : status));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs mb-6 space-y-5">
      {/* Dashboard Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-extrabold text-blue-700 tracking-tight uppercase">
                {t.performanceDashboard}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                LIVE
              </span>
            </div>
            <p className="text-xs text-slate-500">
              WBSEDCL 5 Work Category Real-Time Operational Performance
            </p>
          </div>
        </div>

        {/* Top summary badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => onSelectCategory('DISCONNECTION')}
            className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl font-black flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            title="Open Disconnection Consumer List"
          >
            <Scissors className="w-3.5 h-3.5 text-rose-200" />
            <span>
              {currentLanguage === 'bn'
                ? `মোট ডিসকানেকশন লিস্ট: ${totalDisconnectionListCount}`
                : `Total Disconnection List: ${totalDisconnectionListCount}`}
            </span>
          </button>
          <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 shadow-xs">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>{totalEntries} Total Entries</span>
          </div>
        </div>
      </div>

      {/* 5 Work Category Visual Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {categoryStats.map((item, idx) => {
          const Icon = item.icon;
          const percentage = totalEntries > 0 ? Math.round((item.count / totalEntries) * 100) : 0;

          return (
            <button
              key={`${item.id}-${idx}`}
              type="button"
              onClick={() => onSelectCategory(item.id)}
              className={`text-left p-3 rounded-xl border ${item.borderAccent} ${item.bgLight} hover:shadow-md transition-all cursor-pointer group relative overflow-hidden`}
              title={`Open ${item.name} form`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-white/90 shadow-2xs flex items-center justify-center">
                  <Icon className={`w-4 h-4 ${item.textAccent}`} />
                </div>
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border ${item.badgeBg}`}>
                  {item.id === 'DISCONNECTION'
                    ? (currentLanguage === 'bn' ? `মোট লিস্ট: ${item.count}` : `Total List: ${item.count}`)
                    : `${percentage}%`}
                </span>
              </div>

              <div className="mt-1">
                <p className="text-[11px] font-bold text-slate-700 truncate">{item.name}</p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className={`text-lg font-black ${item.textAccent}`}>{item.count}</span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {item.id === 'DISCONNECTION'
                      ? (currentLanguage === 'bn' ? 'টি ডিসকানেকশন লিস্ট' : 'total list')
                      : 'records'}
                  </span>
                </div>
              </div>

              {/* Mini progress track */}
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 mt-2 overflow-hidden">
                <div 
                  className={`h-full ${item.barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.max(percentage, totalEntries === 0 ? 0 : 5)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* ACTIVE DISCONNECTION PERFORMANCE DECK BOARD (Click Paid, Disconnected, etc. to view consumer data) */}
      <div className="bg-slate-50/90 border border-rose-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-rose-200/60 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-rose-600 text-white shadow-2xs">
              <Scissors className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                  {currentLanguage === 'bn'
                    ? '⚡ ডিসকানেকশন পারফরম্যান্স ডেক বোর্ড (ক্লিক করে কনজিউমার ডাটা দেখুন)'
                    : '⚡ Disconnection Performance Deck Board (Click status to view consumer data)'}
                </h3>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                  {currentLanguage === 'bn'
                    ? `মোট লিস্ট: ${discMetrics.total} টি`
                    : `Total List: ${discMetrics.total}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto relative">
            <button
              type="button"
              onClick={() => onSelectCategory('DISCONNECTION')}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span>{currentLanguage === 'bn' ? 'ডিসকানেকশন মডিউল খুলুন' : 'Open Disconnection Module'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            {/* Three-Dot Menu for All / Phase / Class */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowThreeDotFilter(prev => !prev)}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                  phaseFilter !== 'ALL' || classFilter !== 'ALL'
                    ? 'bg-slate-900 text-amber-400 border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Filter Options (All / Phase / Class)"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showThreeDotFilter && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowThreeDotFilter(false)} />
                  <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl border border-slate-200 shadow-xl p-3 z-40 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-700">Filter Options</span>
                      {(phaseFilter !== 'ALL' || classFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => {
                            setPhaseFilter('ALL');
                            setClassFilter('ALL');
                            setShowThreeDotFilter(false);
                          }}
                          className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Reset All
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Phase</span>
                      <div className="grid grid-cols-3 gap-1">
                        {([
                          { id: 'ALL', label: 'All' },
                          { id: '1PH', label: '1 PH' },
                          { id: '3PH', label: '3 PH' },
                        ] as { id: PhaseFilterType; label: string }[]).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPhaseFilter(p.id)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                              phaseFilter === p.id
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Class</span>
                      <div className="grid grid-cols-2 gap-1">
                        {([
                          { id: 'ALL', label: 'All Class' },
                          { id: 'DOMESTIC', label: 'Domestic' },
                          { id: 'COMMERCIAL', label: 'Commercial' },
                          { id: 'INDUSTRIAL', label: 'Industrial' },
                          { id: 'STW', label: 'STW' },
                        ] as { id: ClassFilterType; label: string }[]).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setClassFilter(c.id)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                              classFilter === c.id
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Clickable Disconnection Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <button
            type="button"
            onClick={() => handleToggleDiscDeck('ALL')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              selectedDiscStatus === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400 shadow-sm'
                : 'bg-white text-slate-900 border-slate-200 hover:border-slate-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase ${selectedDiscStatus === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
                {currentLanguage === 'bn' ? 'মোট লিস্ট' : 'Total List'}
              </span>
              <Users className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-xl font-black mt-1">{discMetrics.total}</div>
            <div className={`text-[10px] font-bold mt-0.5 ${selectedDiscStatus === 'ALL' ? 'text-amber-300' : 'text-blue-600'}`}>
              {currentLanguage === 'bn' ? 'ক্লিক করে দেখুন →' : 'Click to view →'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleToggleDiscDeck('Paid')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              selectedDiscStatus === 'Paid'
                ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-300 shadow-sm'
                : 'bg-blue-50/70 text-blue-950 border-blue-200 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase ${selectedDiscStatus === 'Paid' ? 'text-blue-100' : 'text-blue-700'}`}>
                Paid (পরিশোধিত)
              </span>
              <CreditCard className={`w-3.5 h-3.5 ${selectedDiscStatus === 'Paid' ? 'text-white' : 'text-blue-600'}`} />
            </div>
            <div className="text-xl font-black mt-1">{discMetrics.paid}</div>
            <div className={`text-[10px] font-bold mt-0.5 ${selectedDiscStatus === 'Paid' ? 'text-white' : 'text-blue-700'}`}>
              {currentLanguage === 'bn' ? 'Paid ডাটা দেখুন →' : 'View Paid Data →'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleToggleDiscDeck('Disconnected')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              selectedDiscStatus === 'Disconnected'
                ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-300 shadow-sm'
                : 'bg-rose-50/70 text-rose-950 border-rose-200 hover:border-rose-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase ${selectedDiscStatus === 'Disconnected' ? 'text-rose-100' : 'text-rose-700'}`}>
                Disconnected
              </span>
              <Power className={`w-3.5 h-3.5 ${selectedDiscStatus === 'Disconnected' ? 'text-white' : 'text-rose-600'}`} />
            </div>
            <div className="text-xl font-black mt-1">{discMetrics.disconnected}</div>
            <div className={`text-[10px] font-bold mt-0.5 ${selectedDiscStatus === 'Disconnected' ? 'text-white' : 'text-rose-700'}`}>
              {currentLanguage === 'bn' ? 'Disconnected ডাটা →' : 'View Disconnected →'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleToggleDiscDeck('Connected')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              selectedDiscStatus === 'Connected'
                ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300 shadow-sm'
                : 'bg-emerald-50/70 text-emerald-950 border-emerald-200 hover:border-emerald-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase ${selectedDiscStatus === 'Connected' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                Connected / Pending
              </span>
              <Clock className={`w-3.5 h-3.5 ${selectedDiscStatus === 'Connected' ? 'text-white' : 'text-emerald-600'}`} />
            </div>
            <div className="text-xl font-black mt-1">{discMetrics.connected}</div>
            <div className={`text-[10px] font-bold mt-0.5 ${selectedDiscStatus === 'Connected' ? 'text-white' : 'text-emerald-700'}`}>
              {currentLanguage === 'bn' ? 'Pending ডাটা →' : 'View Pending →'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleToggleDiscDeck('Not Found')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              selectedDiscStatus === 'Not Found'
                ? 'bg-purple-600 text-white border-purple-600 ring-2 ring-purple-300 shadow-sm'
                : 'bg-purple-50/70 text-purple-950 border-purple-200 hover:border-purple-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase ${selectedDiscStatus === 'Not Found' ? 'text-purple-100' : 'text-purple-700'}`}>
                Not Found
              </span>
              <HelpCircle className={`w-3.5 h-3.5 ${selectedDiscStatus === 'Not Found' ? 'text-white' : 'text-purple-600'}`} />
            </div>
            <div className="text-xl font-black mt-1">{discMetrics.notFound}</div>
            <div className={`text-[10px] font-bold mt-0.5 ${selectedDiscStatus === 'Not Found' ? 'text-white' : 'text-purple-700'}`}>
              {currentLanguage === 'bn' ? 'Not Found ডাটা →' : 'View Not Found →'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleToggleDiscDeck('Dispute')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              selectedDiscStatus === 'Dispute'
                ? 'bg-orange-600 text-white border-orange-600 ring-2 ring-orange-300 shadow-sm'
                : 'bg-orange-50/70 text-orange-950 border-orange-200 hover:border-orange-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase ${selectedDiscStatus === 'Dispute' ? 'text-orange-100' : 'text-orange-700'}`}>
                Dispute
              </span>
              <AlertCircle className={`w-3.5 h-3.5 ${selectedDiscStatus === 'Dispute' ? 'text-white' : 'text-orange-600'}`} />
            </div>
            <div className="text-xl font-black mt-1">{discMetrics.dispute}</div>
            <div className={`text-[10px] font-bold mt-0.5 ${selectedDiscStatus === 'Dispute' ? 'text-white' : 'text-orange-700'}`}>
              {currentLanguage === 'bn' ? 'Dispute ডাটা →' : 'View Dispute →'}
            </div>
          </button>
        </div>

        {/* Consumer Data Drawer when Paid / Disconnected / etc. is clicked */}
        {selectedDiscStatus && (
          <div className="bg-white border-2 border-blue-500 rounded-xl p-3.5 space-y-3 shadow-md animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-black uppercase">
                  {selectedDiscStatus === 'ALL' ? 'ALL CONSUMERS' : selectedDiscStatus}
                </span>
                <span className="text-xs font-extrabold text-slate-800">
                  {currentLanguage === 'bn'
                    ? `মোট ${activeDeckConsumers.length} জন কনজিউমারের ডাটা`
                    : `${activeDeckConsumers.length} Consumers Found`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={deckSearch}
                    onChange={(e) => setDeckSearch(e.target.value)}
                    placeholder={currentLanguage === 'bn' ? 'নাম বা আইডি খুঁজুন...' : 'Search consumer...'}
                    className="pl-7 pr-6 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  {deckSearch && (
                    <button
                      type="button"
                      onClick={() => setDeckSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDiscStatus(null)}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                  title="Close list"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {activeDeckConsumers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 font-semibold">
                {currentLanguage === 'bn'
                  ? 'এই স্ট্যাটাসে কোনো কনজিউমার ডাটা পাওয়া যায়নি।'
                  : 'No consumer records found in this status.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {activeDeckConsumers.slice(0, 90).map((c) => {
                  const ph = getTaskPhase(c);
                  const cl = getTaskConnectionClass(c);
                  return (
                    <div
                      key={c.id || c.consumerId}
                      onClick={() => onSelectCategory('DISCONNECTION')}
                      className="p-3 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/70 hover:bg-white transition-all cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            ID: {c.consumerId}
                          </span>
                          <h4 className="text-xs font-extrabold text-slate-900 mt-1 line-clamp-1">
                            {c.consumerName || 'N/A'}
                          </h4>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-900 text-white shrink-0">
                          {c.disconStatus || 'Connected'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold">
                        {c.meterNo && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-800 font-mono">
                            Mtr: {c.meterNo}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                          {ph === '1PH' ? '1-Phase' : '3-Phase'}
                        </span>
                        {c.arrearAmount && Number(c.arrearAmount) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono">
                            ₹{c.arrearAmount}
                          </span>
                        )}
                      </div>

                      {(c.address || c.mobile) && (
                        <div className="text-[10px] text-slate-500 flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                          {c.address && (
                            <span className="truncate flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5 shrink-0" />
                              {c.address}
                            </span>
                          )}
                          {c.mobile && (
                            <span className="font-mono shrink-0 flex items-center gap-0.5">
                              <Phone className="w-2.5 h-2.5" />
                              {c.mobile}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Operational Key Performance Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 font-semibold">Completed</p>
            <p className="font-bold text-slate-800">{completedEntries} ({completionRate}%)</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 font-semibold">Active / Pending</p>
            <p className="font-bold text-slate-800">{pendingEntries}</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 font-semibold">GPS Verified</p>
            <p className="font-bold text-slate-800">{withGps} records</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center gap-2.5">
          <Award className="w-4 h-4 text-purple-600 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 font-semibold">Media Evidence</p>
            <p className="font-bold text-slate-800">{withMedia} uploads</p>
          </div>
        </div>
      </div>
    </div>
  );
};
