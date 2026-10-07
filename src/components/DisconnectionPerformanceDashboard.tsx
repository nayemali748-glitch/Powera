import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Users,
  CheckCircle2,
  Power,
  Clock,
  AlertCircle,
  HelpCircle,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  RefreshCw,
  Download,
  Building2,
  Check,
  Search,
  X,
  Trash2,
  Phone,
  MapPin,
  Zap,
  Layers,
  Loader2,
  MoreVertical,
  MessageSquareWarning,
  RotateCcw
} from 'lucide-react';
import { DisconnectionTask } from '../types';
import {
  getTaskPhase,
  getTaskConnectionClass,
  matchesDisconnectionStatusFilter,
  PhaseFilterType,
  ConnectionClassFilterType,
  getReissueLockState,
  cleanDisconnectionNotes,
  cleanWorkerOrAgencyName
} from '../utils/disconnectionClassifier';
import { submitDisconnectionTaskReport } from '../services/api';
import { DisconnectionConsumerCard } from './disconnection/DisconnectionConsumerCard';
import { DisconnectionUpdateModal } from './disconnection/DisconnectionUpdateModal';

interface DisconnectionPerformanceDashboardProps {
  tasks: DisconnectionTask[];
  onBack?: () => void;
  lang?: 'en' | 'bn';
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onSelectFilter?: (status: string, agency?: string) => void;
  isAdmin?: boolean;
  onDeleteTask?: (task: DisconnectionTask) => Promise<void> | void;
}

export const parseTaskAmount = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  const clean = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

export const formatCurrency = (val: number): string => {
  return '₹' + Number(val || 0).toLocaleString('en-IN');
};

export const DisconnectionPerformanceDashboard: React.FC<DisconnectionPerformanceDashboardProps> = ({
  tasks = [],
  onBack,
  lang = 'en',
  onRefresh,
  isRefreshing = false,
  onSelectFilter,
  isAdmin = false,
  onDeleteTask
}) => {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState<boolean>(true);
  const [selectedAgency, setSelectedAgency] = useState<string>('All');
  const [selectedPhase, setSelectedPhase] = useState<PhaseFilterType>('ALL');
  const [selectedConnClass, setSelectedConnClass] = useState<ConnectionClassFilterType>('ALL');
  const [activeStatusCard, setActiveStatusCard] = useState<string | null>('PAID');
  const [consumerSearch, setConsumerSearch] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showThreeDotFilter, setShowThreeDotFilter] = useState<boolean>(false);
  const [approvingReissueId, setApprovingReissueId] = useState<string | null>(null);
  const [selectedTaskForUpdate, setSelectedTaskForUpdate] = useState<DisconnectionTask | null>(null);

  // Pending Re-issue requests from workers
  const pendingReissueTasks = useMemo(() => {
    return tasks.filter(t => getReissueLockState(t).reissueRequested);
  }, [tasks]);

  const handleApproveReissue = async (task: DisconnectionTask) => {
    const cId = String(task.consumerId || task.taskId || '');
    setApprovingReissueId(cId);
    try {
      const cleanedNotes = cleanDisconnectionNotes(task.workerRemarks || task.notes || '');
      const approvedMarker = `${cleanedNotes ? cleanedNotes + ' | ' : ''}[REISSUE_APPROVED]`;
      await submitDisconnectionTaskReport({
        taskId: task.taskId || `TASK-DISC-${cId}`,
        consumerId: cId,
        consumerName: task.consumerName || '',
        taskStatus: 'REISSUE' as any,
        disconStatus: 'REISSUE',
        workerRemarks: approvedMarker,
        notes: approvedMarker,
        agency: cleanWorkerOrAgencyName(task.assignedAgency || task.agency || ''),
        workerId: '',
        workerName: cleanWorkerOrAgencyName(task.assignedWorkerName || '')
      });
      if (onRefresh) onRefresh();
    } finally {
      setApprovingReissueId(null);
    }
  };

  // Extract unique agencies from tasks (Name only)
  const agencyList = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      const ag = cleanWorkerOrAgencyName(t.assignedAgency || t.assignedWorkerName);
      if (ag) set.add(ag);
    });
    const list = Array.from(set).sort();
    return ['All', ...list];
  }, [tasks]);

  // Phase & Class overall counts
  const phaseAndClassCounts = useMemo(() => {
    let ph1 = 0;
    let ph3 = 0;
    let dom = 0;
    let com = 0;
    let ind = 0;
    let stw = 0;
    tasks.forEach(t => {
      if (getTaskPhase(t) === '3PH') ph3++;
      else ph1++;
      const c = getTaskConnectionClass(t);
      if (c === 'DOMESTIC') dom++;
      else if (c === 'COMMERCIAL') com++;
      else if (c === 'INDUSTRIAL') ind++;
      else if (c === 'STW') stw++;
    });
    return { ph1, ph3, dom, com, ind, stw };
  }, [tasks]);

  // Filter tasks based on Agency, Phase (1PH/3PH), and Class (Domestic/Commercial/Industrial/STW)
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (selectedAgency !== 'All') {
        const ag = cleanWorkerOrAgencyName(t.assignedAgency || t.assignedWorkerName) || 'Unassigned';
        if (ag.toLowerCase() !== selectedAgency.toLowerCase()) return false;
      }
      if (selectedPhase !== 'ALL' && getTaskPhase(t) !== selectedPhase) {
        return false;
      }
      if (selectedConnClass !== 'ALL' && getTaskConnectionClass(t) !== selectedConnClass) {
        return false;
      }
      return true;
    });
  }, [tasks, selectedAgency, selectedPhase, selectedConnClass]);

  // Compute 8 Statistics Cards
  const stats = useMemo(() => {
    let totalCount = 0;
    let totalAmount = 0;

    let connectedCount = 0;
    let connectedAmount = 0;

    let disconnectedCount = 0;
    let disconnectedAmount = 0;

    let paidCount = 0;
    let paidAmount = 0;

    let officeTeamCount = 0;
    let officeTeamAmount = 0;

    let billDisputeCount = 0;
    let billDisputeAmount = 0;

    let notFoundCount = 0;
    let notFoundAmount = 0;

    filteredTasks.forEach(t => {
      const due = parseTaskAmount(t.outstandingDue || (t as any)['D2 Net O/S']);
      const paid = parseTaskAmount(t.paidAmount || (t as any)['Paid Amount']);

      totalCount++;
      totalAmount += due;

      if (matchesDisconnectionStatusFilter(t, 'PAID')) {
        paidCount++;
        paidAmount += (paid > 0 ? paid : due);
      } else if (matchesDisconnectionStatusFilter(t, 'DISCONNECT')) {
        disconnectedCount++;
        disconnectedAmount += due;
      } else if (matchesDisconnectionStatusFilter(t, 'OFFICE TEAM')) {
        officeTeamCount++;
        officeTeamAmount += due;
      } else if (matchesDisconnectionStatusFilter(t, 'DISPUTE')) {
        billDisputeCount++;
        billDisputeAmount += due;
      } else if (matchesDisconnectionStatusFilter(t, 'NOT FOUND')) {
        notFoundCount++;
        notFoundAmount += due;
      } else {
        connectedCount++;
        connectedAmount += due;
      }
    });

    return {
      total: { count: totalCount, amount: totalAmount },
      connected: { count: connectedCount, amount: connectedAmount },
      disconnected: { count: disconnectedCount, amount: disconnectedAmount },
      paid: { count: paidCount, amount: paidAmount },
      officeTeam: { count: officeTeamCount, amount: officeTeamAmount },
      billDispute: { count: billDisputeCount, amount: billDisputeAmount },
      notFound: { count: notFoundCount, amount: notFoundAmount },
      totalOutstanding: totalAmount
    };
  }, [filteredTasks]);

  // Consumers matching the clicked Performance Deck card (e.g. PAID, DISCONNECT, CONNECTED, etc.)
  const activeCardConsumers = useMemo(() => {
    if (!activeStatusCard) return [];
    return filteredTasks.filter(t => {
      if (!matchesDisconnectionStatusFilter(t, activeStatusCard)) return false;
      if (consumerSearch.trim()) {
        const q = consumerSearch.toLowerCase().trim();
        const cId = String(t.consumerId || (t as any)['Consumer Id'] || '').toLowerCase();
        const cNm = String(t.consumerName || (t as any)['Name'] || '').toLowerCase();
        const ph = String(t.phoneNumber || (t as any)['Mobile'] || '').toLowerCase();
        const addr = String(t.consumerAddress || (t as any)['Address'] || '').toLowerCase();
        const mru = String(t.mru || t.mruSection || (t as any)['MRU'] || '').toLowerCase();
        return cId.includes(q) || cNm.includes(q) || ph.includes(q) || addr.includes(q) || mru.includes(q);
      }
      return true;
    });
  }, [filteredTasks, activeStatusCard, consumerSearch]);

  const handleCardClick = (statusKey: string, agencyOverride?: string) => {
    if (agencyOverride) {
      setSelectedAgency(agencyOverride);
    }
    setActiveStatusCard(statusKey);
    if (onSelectFilter) {
      onSelectFilter(statusKey, agencyOverride || (selectedAgency !== 'All' ? selectedAgency : undefined));
    }
  };

  const handleConfirmDeleteConsumer = async (task: DisconnectionTask) => {
    if (!onDeleteTask || deletingId) return;
    const key = String(task.consumerId || task.taskId || '');
    setDeletingId(key);
    try {
      await onDeleteTask(task);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // Compute Agency Breakdown Table Data
  const agencyRows = useMemo(() => {
    const map = new Map<string, {
      agency: string;
      totalCount: number;
      totalAmount: number;
      discCount: number;
      discAmount: number;
      paidCount: number;
      paidAmount: number;
      officeCount: number;
      officeAmount: number;
      disputeCount: number;
      disputeAmount: number;
      notFoundCount: number;
      notFoundAmount: number;
    }>();

    const targetAgencies = selectedAgency === 'All'
      ? (agencyList.filter(a => a !== 'All').length > 0 ? agencyList.filter(a => a !== 'All') : ['Unassigned'])
      : [selectedAgency];

    targetAgencies.forEach(ag => {
      map.set(ag, {
        agency: ag,
        totalCount: 0,
        totalAmount: 0,
        discCount: 0,
        discAmount: 0,
        paidCount: 0,
        paidAmount: 0,
        officeCount: 0,
        officeAmount: 0,
        disputeCount: 0,
        disputeAmount: 0,
        notFoundCount: 0,
        notFoundAmount: 0
      });
    });

    filteredTasks.forEach(t => {
      const ag = cleanWorkerOrAgencyName(t.assignedAgency || t.assignedWorkerName) || 'Unassigned';
      if (!map.has(ag)) {
        map.set(ag, {
          agency: ag,
          totalCount: 0,
          totalAmount: 0,
          discCount: 0,
          discAmount: 0,
          paidCount: 0,
          paidAmount: 0,
          officeCount: 0,
          officeAmount: 0,
          disputeCount: 0,
          disputeAmount: 0,
          notFoundCount: 0,
          notFoundAmount: 0
        });
      }

      const row = map.get(ag)!;
      const due = parseTaskAmount(t.outstandingDue || (t as any)['D2 Net O/S']);
      const paid = parseTaskAmount(t.paidAmount || (t as any)['Paid Amount']);

      row.totalCount++;
      row.totalAmount += due;

      if (matchesDisconnectionStatusFilter(t, 'PAID')) {
        row.paidCount++;
        row.paidAmount += (paid > 0 ? paid : due);
      } else if (matchesDisconnectionStatusFilter(t, 'DISCONNECT')) {
        row.discCount++;
        row.discAmount += due;
      } else if (matchesDisconnectionStatusFilter(t, 'OFFICE TEAM')) {
        row.officeCount++;
        row.officeAmount += due;
      } else if (matchesDisconnectionStatusFilter(t, 'DISPUTE')) {
        row.disputeCount++;
        row.disputeAmount += due;
      } else if (matchesDisconnectionStatusFilter(t, 'NOT FOUND')) {
        row.notFoundCount++;
        row.notFoundAmount += due;
      }
    });

    return Array.from(map.values());
  }, [filteredTasks, agencyList, selectedAgency]);

  // Export CSV summary report
  const exportCsv = () => {
    const headers = [
      'Agency',
      'Total Count',
      'Total Amount',
      'Disconnected Count',
      'Disconnected Amount',
      'Paid Count',
      'Paid Amount',
      'Office Team Count',
      'Office Team Amount',
      'Bill Dispute Count',
      'Bill Dispute Amount',
      'Not Found Count',
      'Not Found Amount'
    ];

    const rows = agencyRows.map(r => [
      `"${r.agency}"`,
      r.totalCount,
      r.totalAmount,
      r.discCount,
      r.discAmount,
      r.paidCount,
      r.paidAmount,
      r.officeCount,
      r.officeAmount,
      r.disputeCount,
      r.disputeAmount,
      r.notFoundCount,
      r.notFoundAmount
    ]);

    rows.push([
      '"Total"',
      stats.total.count,
      stats.total.amount,
      stats.disconnected.count,
      stats.disconnected.amount,
      stats.paid.count,
      stats.paid.amount,
      stats.officeTeam.count,
      stats.officeTeam.amount,
      stats.billDispute.count,
      stats.billDispute.amount,
      stats.notFound.count,
      stats.notFound.amount
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `disconnection_performance_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActiveCardTitle = (statusKey: string | null) => {
    switch (statusKey) {
      case 'PAID':
        return lang === 'bn' ? 'পরিশোধিত উপভোক্তা তালিকা (Paid Consumers)' : 'Paid Consumers Data';
      case 'DISCONNECT':
        return lang === 'bn' ? 'সংযোগ বিচ্ছিন্ন উপভোক্তা তালিকা (Disconnected Consumers)' : 'Disconnected Consumers Data';
      case 'CONNECTED':
      case 'PENDING':
        return lang === 'bn' ? 'সংযুক্ত / পেন্ডিং উপভোক্তা তালিকা (Connected Consumers)' : 'Connected / Pending Consumers Data';
      case 'OFFICE TEAM':
        return lang === 'bn' ? 'অফিস টিম উপভোক্তা তালিকা (Office Team)' : 'Office Team Consumers Data';
      case 'DISPUTE':
        return lang === 'bn' ? 'বিল বিরোধ উপভোক্তা তালিকা (Bill Dispute)' : 'Bill Dispute Consumers Data';
      case 'NOT FOUND':
        return lang === 'bn' ? 'পাওয়া যায়নি উপভোক্তা তালিকা (Not Found)' : 'Not Found Consumers Data';
      default:
        return lang === 'bn' ? 'মোট ডিসকানেকশন উপভোক্তা তালিকা (All Disconnection Consumers)' : 'All Disconnection Consumers Data';
    }
  };

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-200">
      {/* Top Bar Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'bn' ? 'টাস্ক তালিকায় ফিরুন' : 'Back to Tasks'}</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-black tracking-wide text-slate-800 dark:text-white uppercase">
              {lang === 'bn' ? 'অ্যাক্টিভ ডিসকানেকশন পারফরম্যান্স ডেক বোর্ড' : 'Active Disconnection Performance Deck Board'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-black border border-rose-200">
              {lang === 'bn' ? `মোট লিস্ট: ${tasks.length}` : `Total List: ${tasks.length}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-500' : ''}`} />
              <span className="hidden sm:inline">{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={exportCsv}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'এক্সপোর্ট CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-slate-50/70 dark:bg-slate-950 p-2 sm:p-4 rounded-3xl space-y-4">
        {/* Dashboard Statistics Breakdown Header Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100/70 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {lang === 'bn' ? 'ড্যাশবোর্ড পরিসংখ্যান বিশ্লেষণ (কার্ডে ক্লিক করে ডেটা দেখুন)' : 'Dashboard Statistics Breakdown (Click Any Card to View Consumers)'}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {lang === 'bn'
                    ? 'Paid, Disconnected, Connected বা যেকোনো কার্ডে ক্লিক করলে নিচে উপভোক্তাদের ডেটা দেখানো হবে'
                    : 'Click Paid, Disconnected, Connected, or any card below to inspect matching consumer data'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsBreakdownOpen(!isBreakdownOpen)}
              className="w-9 h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              title={isBreakdownOpen ? 'Collapse' : 'Expand'}
            >
              {isBreakdownOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>

          {isBreakdownOpen && (
            <div className="mt-5 space-y-5">
              {/* Admin SMS-Style Re-issue Notification Inbox */}
              {isAdmin && pendingReissueTasks.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-3.5 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-xl bg-amber-500 text-slate-950">
                        <MessageSquareWarning className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-amber-950 uppercase">
                          {lang === 'bn'
                            ? `📩 ওয়ার্কার রি-ইস্যু মেসেজ (${pendingReissueTasks.length} টি পেন্ডিং)`
                            : `📩 Worker Re-issue SMS Requests (${pendingReissueTasks.length} Pending)`}
                        </h4>
                        <p className="text-[11px] font-semibold text-amber-800">
                          {lang === 'bn'
                            ? 'ওয়ার্কাররা পুনরায় স্ট্যাটাস আপডেট করার অনুমতির জন্য মেসেজ পাঠিয়েছে। Re-issue করলে তারা আবার আপডেট করতে পারবে।'
                            : 'Workers requested permission to update status again. Click Re-issue to unlock.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {pendingReissueTasks.map((rt, rIdx) => {
                      const lockInfo = getReissueLockState(rt);
                      const cId = rt.consumerId || (rt as any)['Consumer Id'] || `ROW-${rIdx}`;
                      return (
                        <div
                          key={`${cId}-${rIdx}`}
                          className="bg-white border border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-black uppercase">
                                Worker: {lockInfo.requestedBy || cleanWorkerOrAgencyName(rt.assignedWorkerName || rt.assignedAgency) || 'Field Worker'}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-500">
                                ID: {cId}
                              </span>
                            </div>
                            <p className="text-xs font-black text-slate-900 truncate mt-1">
                              {rt.consumerName || 'Consumer'}
                            </p>
                            <p className="text-[10px] font-semibold text-slate-500">
                              Current Status: <span className="font-bold text-slate-800">{rt.disconStatus || rt.taskStatus}</span>
                              {lockInfo.requestedAt ? ` • ${lockInfo.requestedAt}` : ''}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleApproveReissue(rt)}
                            disabled={approvingReissueId === String(cId)}
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                          >
                            {approvingReissueId === String(cId) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            <span>{lang === 'bn' ? 'Re-issue করুন' : 'Re-issue (Unlock)'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Agency & Three-Dot Filter Bar (All / Phase / Class inside 3-dot menu) */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
                    {lang === 'bn' ? 'এজেন্সি / ওয়ার্কার নাম:' : 'Agency / Worker Name:'}
                  </label>
                  <div className="relative flex-1 max-w-xs">
                    <select
                      value={selectedAgency}
                      onChange={e => setSelectedAgency(e.target.value)}
                      className="w-full appearance-none py-1.5 px-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      {agencyList.map(ag => (
                        <option key={ag} value={ag}>
                          {ag}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Three-Dot Menu Button for All, Phase, Class */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowThreeDotFilter(prev => !prev)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                      selectedPhase !== 'ALL' || selectedConnClass !== 'ALL'
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
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-2xl p-3.5 z-40 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-[11px] font-black uppercase text-slate-800">Filter Options</span>
                          {(selectedPhase !== 'ALL' || selectedConnClass !== 'ALL') && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPhase('ALL');
                                setSelectedConnClass('ALL');
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
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedPhase('ALL')}
                              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border ${
                                selectedPhase === 'ALL'
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedPhase('1PH')}
                              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border ${
                                selectedPhase === '1PH'
                                  ? 'bg-sky-600 text-white border-sky-600'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              1 PH
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedPhase('3PH')}
                              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border ${
                                selectedPhase === '3PH'
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              3 PH
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase text-slate-400 block">Class</span>
                          <div className="flex items-center justify-between gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setSelectedConnClass('ALL')}
                              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all shrink-0 ${
                                selectedConnClass === 'ALL'
                                  ? 'bg-amber-500 text-slate-950 shadow-2xs'
                                  : 'text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              All Class
                            </button>
                            <div className="flex items-center gap-1">
                              {(['DOMESTIC', 'COMMERCIAL', 'INDUSTRIAL', 'STW'] as ConnectionClassFilterType[]).map(clsKey => (
                                <button
                                  key={clsKey}
                                  type="button"
                                  onClick={() => setSelectedConnClass(clsKey)}
                                  className={`w-7 h-7 rounded-lg text-[11px] font-black flex items-center justify-center cursor-pointer border transition-all ${
                                    selectedConnClass === clsKey
                                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-200'
                                  }`}
                                >
                                  {clsKey === 'DOMESTIC'
                                    ? 'D'
                                    : clsKey === 'COMMERCIAL'
                                    ? 'C'
                                    : clsKey === 'INDUSTRIAL'
                                    ? 'I'
                                    : 'S'}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 8 Interactive Statistics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Total */}
                <button
                  type="button"
                  onClick={() => handleCardClick('ALL')}
                  className={`text-left bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-blue-500 cursor-pointer ${
                    activeStatusCard === 'ALL' ? 'border-blue-600 ring-2 ring-blue-500/30 bg-blue-50/20' : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400">
                      {lang === 'bn' ? 'মোট তালিকা (Total)' : 'Total List'}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {stats.total.count}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatCurrency(stats.total.amount)}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                </button>

                {/* 2. Connected */}
                <button
                  type="button"
                  onClick={() => handleCardClick('CONNECTED')}
                  className={`text-left bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-emerald-500 cursor-pointer ${
                    activeStatusCard === 'CONNECTED' ? 'border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/20' : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400">
                      {lang === 'bn' ? 'সংযুক্ত (Connected)' : 'Connected'}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {stats.connected.count}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatCurrency(stats.connected.amount)}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 stroke-[2.5]" />
                  </div>
                </button>

                {/* 3. Disconnected */}
                <button
                  type="button"
                  onClick={() => handleCardClick('DISCONNECT')}
                  className={`text-left bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-rose-500 cursor-pointer ${
                    activeStatusCard === 'DISCONNECT' ? 'border-rose-600 ring-2 ring-rose-500/30 bg-rose-50/20' : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
                      {lang === 'bn' ? 'বিচ্ছিন্ন (Disconnected)' : 'Disconnected'}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">
                      {stats.disconnected.count}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatCurrency(stats.disconnected.amount)}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Power className="w-5 h-5 stroke-[2.5]" />
                  </div>
                </button>

                {/* 4. Paid */}
                <button
                  type="button"
                  onClick={() => handleCardClick('PAID')}
                  className={`text-left bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-emerald-500 cursor-pointer ${
                    activeStatusCard === 'PAID' ? 'border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/30' : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      {lang === 'bn' ? 'পরিশোধিত (Paid)' : 'Paid'}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {stats.paid.count}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatCurrency(stats.paid.amount)}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  </div>
                </button>

                {/* 5. Office Team */}
                <button
                  type="button"
                  onClick={() => handleCardClick('OFFICE TEAM')}
                  className={`text-left bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-amber-500 cursor-pointer ${
                    activeStatusCard === 'OFFICE TEAM' ? 'border-amber-600 ring-2 ring-amber-500/30 bg-amber-50/20' : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400">
                      {lang === 'bn' ? 'অফিস টিম (Office Team)' : 'Office Team'}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {stats.officeTeam.count}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatCurrency(stats.officeTeam.amount)}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 stroke-[2.5]" />
                  </div>
                </button>

                {/* 6. Bill Dispute */}
                <button
                  type="button"
                  onClick={() => handleCardClick('DISPUTE')}
                  className={`text-left bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-orange-500 cursor-pointer ${
                    activeStatusCard === 'DISPUTE' ? 'border-orange-600 ring-2 ring-orange-500/30 bg-orange-50/20' : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400">
                      {lang === 'bn' ? 'বিল বিরোধ (Bill Dispute)' : 'Bill Dispute'}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {stats.billDispute.count}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatCurrency(stats.billDispute.amount)}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/60 text-orange-500 dark:text-orange-400 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5 stroke-[2.5]" />
                  </div>
                </button>

                {/* 7. Not Found */}
                <button
                  type="button"
                  onClick={() => handleCardClick('NOT FOUND')}
                  className={`text-left bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-indigo-500 cursor-pointer ${
                    activeStatusCard === 'NOT FOUND' ? 'border-indigo-600 ring-2 ring-indigo-500/30 bg-indigo-50/20' : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400">
                      {lang === 'bn' ? 'পাওয়া যায়নি (Not Found)' : 'Not Found'}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {stats.notFound.count}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatCurrency(stats.notFound.amount)}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <HelpCircle className="w-5 h-5 stroke-[2.5]" />
                  </div>
                </button>

                {/* 8. Total Outstanding */}
                <button
                  type="button"
                  onClick={() => handleCardClick('ALL')}
                  className="text-left bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-purple-400 cursor-pointer"
                >
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400">
                      {lang === 'bn' ? 'মোট বকেয়া (Total Outstanding)' : 'Total Outstanding'}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {formatCurrency(stats.totalOutstanding)}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5 stroke-[2.5]" />
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ACTIVE CONSUMER DATA PANEL WHEN ANY DECK CARD IS CLICKED */}
        {activeStatusCard && (
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-amber-500/60 rounded-3xl p-4 sm:p-5 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-slate-900 text-amber-400 text-xs font-black uppercase">
                  {getActiveCardTitle(activeStatusCard)}
                </span>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  ({activeCardConsumers.length} {lang === 'bn' ? 'জন উপভোক্তা' : 'Consumers'})
                </span>
                {selectedPhase !== 'ALL' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold">
                    {selectedPhase === '3PH' ? '3 PH' : '1 PH'}
                  </span>
                )}
                {selectedConnClass !== 'ALL' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                    {selectedConnClass}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={consumerSearch}
                    onChange={e => setConsumerSearch(e.target.value)}
                    placeholder={lang === 'bn' ? 'উপভোক্তার নাম বা আইডি খুঁজুন...' : 'Search consumer...'}
                    className="w-full sm:w-56 pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStatusCard(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Close Consumer Data View"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {activeCardConsumers.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs sm:text-sm font-semibold">
                {lang === 'bn'
                  ? 'এই স্ট্যাটাসে কোনো উপভোক্তার ডেটা নেই।'
                  : 'No consumers found for this status filter.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[680px] overflow-y-auto pr-1">
                {activeCardConsumers.slice(0, 90).map((t, idx) => (
                  <DisconnectionConsumerCard
                    key={`${t.taskId || t.consumerId || idx}-${idx}`}
                    task={t}
                    onUpdateStatus={(taskItem) => setSelectedTaskForUpdate(taskItem)}
                    isAdmin={isAdmin}
                    onDeleteTask={onDeleteTask}
                    lang={lang}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Agency Breakdown Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-3 sm:p-5 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                {lang === 'bn' ? 'এজেন্সিভিত্তিক বিস্তারিত পারফরম্যান্স টেবিল' : 'Agency Performance Breakdown Table'}
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {agencyRows.length} {lang === 'bn' ? 'টি টিম/এজেন্সি' : 'Agencies'}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 text-center">
                  <th rowSpan={2} className="p-3 text-left border-r border-slate-200 dark:border-slate-700 min-w-[130px]">
                    {lang === 'bn' ? 'এজেন্সি' : 'Agency'}
                  </th>
                  <th colSpan={2} className="p-2 border-r border-slate-200 dark:border-slate-700">
                    {lang === 'bn' ? 'মোট (Total)' : 'Total'}
                  </th>
                  <th colSpan={2} className="p-2 border-r border-slate-200 dark:border-slate-700 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400">
                    {lang === 'bn' ? 'বিচ্ছিন্ন' : 'Disconnected'}
                  </th>
                  <th colSpan={2} className="p-2 border-r border-slate-200 dark:border-slate-700 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                    {lang === 'bn' ? 'পরিশোধিত' : 'Paid'}
                  </th>
                  <th colSpan={2} className="p-2 border-r border-slate-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
                    {lang === 'bn' ? 'অফিস টিম' : 'Office Team'}
                  </th>
                  <th colSpan={2} className="p-2 border-r border-slate-200 dark:border-slate-700 bg-orange-50/50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400">
                    {lang === 'bn' ? 'বিল বিরোধ' : 'Bill Dispute'}
                  </th>
                  <th colSpan={2} className="p-2 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400">
                    {lang === 'bn' ? 'পাওয়া যায়নি' : 'Not Found'}
                  </th>
                </tr>
                <tr className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 text-center text-[11px]">
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[85px]">Amount</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[85px]">Amount</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[85px]">Amount</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[85px]">Amount</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[85px]">Amount</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[60px]">Count</th>
                  <th className="p-2 min-w-[85px]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-center font-medium">
                {agencyRows.map((row, idx) => (
                  <tr
                    key={row.agency + idx}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-2.5 text-left font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800">
                      {row.agency}
                    </td>
                    <td
                      onClick={() => handleCardClick('ALL', row.agency)}
                      className="p-2 font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:underline"
                    >
                      {row.totalCount}
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                      {formatCurrency(row.totalAmount)}
                    </td>
                    <td
                      onClick={() => handleCardClick('DISCONNECT', row.agency)}
                      className="p-2 font-bold text-rose-600 dark:text-rose-400 border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:underline"
                    >
                      {row.discCount}
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                      {formatCurrency(row.discAmount)}
                    </td>
                    <td
                      onClick={() => handleCardClick('PAID', row.agency)}
                      className="p-2 font-bold text-emerald-600 dark:text-emerald-400 border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:underline"
                    >
                      {row.paidCount}
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                      {formatCurrency(row.paidAmount)}
                    </td>
                    <td
                      onClick={() => handleCardClick('OFFICE TEAM', row.agency)}
                      className="p-2 font-bold text-amber-600 dark:text-amber-400 border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:underline"
                    >
                      {row.officeCount}
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                      {formatCurrency(row.officeAmount)}
                    </td>
                    <td
                      onClick={() => handleCardClick('DISPUTE', row.agency)}
                      className="p-2 font-bold text-orange-600 dark:text-orange-400 border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:underline"
                    >
                      {row.disputeCount}
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                      {formatCurrency(row.disputeAmount)}
                    </td>
                    <td
                      onClick={() => handleCardClick('NOT FOUND', row.agency)}
                      className="p-2 font-bold text-indigo-600 dark:text-indigo-400 border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:underline"
                    >
                      {row.notFoundCount}
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400">
                      {formatCurrency(row.notFoundAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700 text-center">
                  <td className="p-3 text-left font-black border-r border-slate-300 dark:border-slate-700">
                    {lang === 'bn' ? 'মোট (Total)' : 'Total'}
                  </td>
                  <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                    {stats.total.count}
                  </td>
                  <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                    {formatCurrency(stats.total.amount)}
                  </td>
                  <td className="p-2 text-rose-600 dark:text-rose-400 border-r border-slate-300 dark:border-slate-700">
                    {stats.disconnected.count}
                  </td>
                  <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                    {formatCurrency(stats.disconnected.amount)}
                  </td>
                  <td className="p-2 text-emerald-600 dark:text-emerald-400 border-r border-slate-300 dark:border-slate-700">
                    {stats.paid.count}
                  </td>
                  <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                    {formatCurrency(stats.paid.amount)}
                  </td>
                  <td className="p-2 text-amber-600 dark:text-amber-400 border-r border-slate-300 dark:border-slate-700">
                    {stats.officeTeam.count}
                  </td>
                  <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                    {formatCurrency(stats.officeTeam.amount)}
                  </td>
                  <td className="p-2 text-orange-600 dark:text-orange-400 border-r border-slate-300 dark:border-slate-700">
                    {stats.billDispute.count}
                  </td>
                  <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                    {formatCurrency(stats.billDispute.amount)}
                  </td>
                  <td className="p-2 text-indigo-600 dark:text-indigo-400 border-r border-slate-300 dark:border-slate-700">
                    {stats.notFound.count}
                  </td>
                  <td className="p-2">
                    {formatCurrency(stats.notFound.amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {selectedTaskForUpdate && (
        <DisconnectionUpdateModal
          task={selectedTaskForUpdate}
          isOpen={Boolean(selectedTaskForUpdate)}
          onClose={() => setSelectedTaskForUpdate(null)}
          onUpdateSuccess={() => {
            setSelectedTaskForUpdate(null);
            if (onRefresh) onRefresh();
          }}
          currentUser={{ role: 'admin', idNo: '8695716192', name: 'Admin Controller' }}
          lang={lang}
        />
      )}
    </div>
  );
};

export default DisconnectionPerformanceDashboard;
