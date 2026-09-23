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
  Filter,
  Check
} from 'lucide-react';
import { DisconnectionTask } from '../types';

interface DisconnectionPerformanceDashboardProps {
  tasks: DisconnectionTask[];
  onBack?: () => void;
  lang?: 'en' | 'bn';
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onSelectFilter?: (status: string, agency?: string) => void;
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
  onSelectFilter
}) => {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState<boolean>(true);
  const [selectedAgency, setSelectedAgency] = useState<string>('All');
  const [selectedClass, setSelectedClass] = useState<string>('All');

  // Extract unique agencies from tasks
  const agencyList = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      const ag = t.assignedAgency?.trim() || t.assignedWorkerName?.trim();
      if (ag) set.add(ag);
    });
    const list = Array.from(set).sort();
    return ['All', ...list];
  }, [tasks]);

  // Extract unique classes from tasks
  const classList = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      const cl = t.baseClass?.trim() || t.consumerCategory?.trim();
      if (cl) set.add(cl);
    });
    if (set.size === 0) {
      return ['All', 'Domestic', 'Commercial', 'Industrial', 'Agricultural'];
    }
    return ['All', ...Array.from(set).sort()];
  }, [tasks]);

  // Filter tasks based on Agency and Class
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (selectedAgency !== 'All') {
        const ag = t.assignedAgency?.trim() || t.assignedWorkerName?.trim() || 'Unassigned';
        if (ag.toLowerCase() !== selectedAgency.toLowerCase()) return false;
      }
      if (selectedClass !== 'All') {
        const cl = t.baseClass?.trim() || t.consumerCategory?.trim() || 'General';
        if (cl.toLowerCase() !== selectedClass.toLowerCase()) return false;
      }
      return true;
    });
  }, [tasks, selectedAgency, selectedClass]);

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
      const due = parseTaskAmount(t.outstandingDue);
      const paid = parseTaskAmount(t.paidAmount);
      const st = String(t.taskStatus || 'PENDING').toUpperCase();

      totalCount++;
      totalAmount += due;

      if (st === 'PAID' || (paid > 0 && st !== 'DISCONNECT')) {
        paidCount++;
        paidAmount += (paid > 0 ? paid : due);
      } else if (st === 'DISCONNECT' || st === 'COMPLETED') {
        disconnectedCount++;
        disconnectedAmount += due;
      } else if (st === 'OFFICE TEAM') {
        officeTeamCount++;
        officeTeamAmount += due;
      } else if (st === 'DISPUTE') {
        billDisputeCount++;
        billDisputeAmount += due;
      } else if (st === 'NOT FOUND' || st === 'UNABLE') {
        notFoundCount++;
        notFoundAmount += due;
      } else {
        // Connected (PENDING, IN PROGRESS, REISSUE, REPORTED)
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

  // Compute Agency Breakdown Table Data
  const agencyRows = useMemo(() => {
    // Group filtered tasks by Agency
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

    // Initialize list with any known agencies or unique filtered agencies
    const targetAgencies = selectedAgency === 'All'
      ? (agencyList.filter(a => a !== 'All').length > 0 ? agencyList.filter(a => a !== 'All') : ['Team A', 'Team B', 'Office Team'])
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
      const ag = t.assignedAgency?.trim() || t.assignedWorkerName?.trim() || 'Unassigned';
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
      const due = parseTaskAmount(t.outstandingDue);
      const paid = parseTaskAmount(t.paidAmount);
      const st = String(t.taskStatus || 'PENDING').toUpperCase();

      row.totalCount++;
      row.totalAmount += due;

      if (st === 'PAID' || (paid > 0 && st !== 'DISCONNECT')) {
        row.paidCount++;
        row.paidAmount += (paid > 0 ? paid : due);
      } else if (st === 'DISCONNECT' || st === 'COMPLETED') {
        row.discCount++;
        row.discAmount += due;
      } else if (st === 'OFFICE TEAM') {
        row.officeCount++;
        row.officeAmount += due;
      } else if (st === 'DISPUTE') {
        row.disputeCount++;
        row.disputeAmount += due;
      } else if (st === 'NOT FOUND' || st === 'UNABLE') {
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

    // Total row
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

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Top Bar Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
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
              {lang === 'bn' ? 'বিচ্ছিন্নকরণ পারফরম্যান্স ড্যাশবোর্ড' : 'Disconnection Performance Dashboard'}
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

      {/* Main Container mirroring the user photo */}
      <div className="bg-slate-50/70 dark:bg-slate-950 p-2 sm:p-4 rounded-3xl space-y-4">
        {/* Dashboard Statistics Breakdown Header Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100/70 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {lang === 'bn' ? 'ড্যাশবোর্ড পরিসংখ্যান বিশ্লেষণ' : 'Dashboard Statistics Breakdown'}
              </h2>
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
              {/* Agency & Class Filters (Identical to photo) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Agency Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                    {lang === 'bn' ? 'এজেন্সি (Agency)' : 'Agency'}
                  </label>
                  <div className="relative">
                    <select
                      value={selectedAgency}
                      onChange={e => setSelectedAgency(e.target.value)}
                      className="w-full appearance-none p-2.5 sm:p-3 pr-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-2xs"
                    >
                      {agencyList.map(ag => (
                        <option key={ag} value={ag}>
                          {ag}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Class Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                    {lang === 'bn' ? 'ক্লাস (Class)' : 'Class'}
                  </label>
                  <div className="relative">
                    <select
                      value={selectedClass}
                      onChange={e => setSelectedClass(e.target.value)}
                      className="w-full appearance-none p-2.5 sm:p-3 pr-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-2xs"
                    >
                      {classList.map(cl => (
                        <option key={cl} value={cl}>
                          {cl}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* 8 Statistics Cards in 2-column grid (mirroring photo) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Total */}
                <div 
                  onClick={() => onSelectFilter?.('ALL', selectedAgency !== 'All' ? selectedAgency : undefined)}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-blue-400 cursor-pointer"
                >
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'মোট (Total)' : 'Total'}
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
                </div>

                {/* 2. Connected */}
                <div 
                  onClick={() => onSelectFilter?.('PENDING', selectedAgency !== 'All' ? selectedAgency : undefined)}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-emerald-400 cursor-pointer"
                >
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
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
                </div>

                {/* 3. Disconnected */}
                <div 
                  onClick={() => onSelectFilter?.('DISCONNECT', selectedAgency !== 'All' ? selectedAgency : undefined)}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-rose-400 cursor-pointer"
                >
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'সংযোগ বিচ্ছিন্ন (Disconnected)' : 'Disconnected'}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {stats.disconnected.count}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatCurrency(stats.disconnected.amount)}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Power className="w-5 h-5 stroke-[2.5]" />
                  </div>
                </div>

                {/* 4. Paid */}
                <div 
                  onClick={() => onSelectFilter?.('PAID', selectedAgency !== 'All' ? selectedAgency : undefined)}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-emerald-400 cursor-pointer"
                >
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'পরিশোধিত (Paid)' : 'Paid'}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {stats.paid.count}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatCurrency(stats.paid.amount)}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  </div>
                </div>

                {/* 5. Office Team */}
                <div 
                  onClick={() => onSelectFilter?.('OFFICE TEAM', selectedAgency !== 'All' ? selectedAgency : undefined)}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-amber-400 cursor-pointer"
                >
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
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
                </div>

                {/* 6. Bill Dispute */}
                <div 
                  onClick={() => onSelectFilter?.('DISPUTE', selectedAgency !== 'All' ? selectedAgency : undefined)}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-orange-400 cursor-pointer"
                >
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
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
                </div>

                {/* 7. Not Found */}
                <div 
                  onClick={() => onSelectFilter?.('NOT FOUND', selectedAgency !== 'All' ? selectedAgency : undefined)}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-indigo-400 cursor-pointer"
                >
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
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
                </div>

                {/* 8. Total Outstanding */}
                <div 
                  onClick={() => onSelectFilter?.('ALL', selectedAgency !== 'All' ? selectedAgency : undefined)}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-purple-400 cursor-pointer"
                >
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'মোট বকেয়া (Total Outstanding)' : 'Total Outstanding'}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {formatCurrency(stats.totalOutstanding)}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5 stroke-[2.5]" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Agency Breakdown Table (Mirroring photo) */}
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
                {/* Level 1 Header */}
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
                {/* Level 2 Sub-headers (Count & Amount) */}
                <tr className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 text-center text-[11px]">
                  {/* Total */}
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[85px]">Amount</th>
                  {/* Disconnected */}
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[85px]">Amount</th>
                  {/* Paid */}
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[85px]">Amount</th>
                  {/* Office Team */}
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[85px]">Amount</th>
                  {/* Bill Dispute */}
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[85px]">Amount</th>
                  {/* Not Found */}
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
                    {/* Total */}
                    <td className="p-2 font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                      {row.totalCount}
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                      {formatCurrency(row.totalAmount)}
                    </td>
                    {/* Disconnected */}
                    <td className="p-2 font-bold text-rose-600 dark:text-rose-400 border-r border-slate-200 dark:border-slate-800">
                      {row.discCount}
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                      {formatCurrency(row.discAmount)}
                    </td>
                    {/* Paid */}
                    <td className="p-2 font-bold text-emerald-600 dark:text-emerald-400 border-r border-slate-200 dark:border-slate-800">
                      {row.paidCount}
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                      {formatCurrency(row.paidAmount)}
                    </td>
                    {/* Office Team */}
                    <td className="p-2 font-bold text-amber-600 dark:text-amber-400 border-r border-slate-200 dark:border-slate-800">
                      {row.officeCount}
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                      {formatCurrency(row.officeAmount)}
                    </td>
                    {/* Bill Dispute */}
                    <td className="p-2 font-bold text-orange-600 dark:text-orange-400 border-r border-slate-200 dark:border-slate-800">
                      {row.disputeCount}
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                      {formatCurrency(row.disputeAmount)}
                    </td>
                    {/* Not Found */}
                    <td className="p-2 font-bold text-indigo-600 dark:text-indigo-400 border-r border-slate-200 dark:border-slate-800">
                      {row.notFoundCount}
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400">
                      {formatCurrency(row.notFoundAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* Total Row (Identical to bottom row in user's image) */}
                <tr className="bg-slate-100 dark:bg-slate-800 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700 text-center">
                  <td className="p-3 text-left font-black border-r border-slate-300 dark:border-slate-700">
                    {lang === 'bn' ? 'মোট (Total)' : 'Total'}
                  </td>
                  {/* Total */}
                  <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                    {stats.total.count}
                  </td>
                  <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                    {formatCurrency(stats.total.amount)}
                  </td>
                  {/* Disconnected */}
                  <td className="p-2 text-rose-600 dark:text-rose-400 border-r border-slate-300 dark:border-slate-700">
                    {stats.disconnected.count}
                  </td>
                  <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                    {formatCurrency(stats.disconnected.amount)}
                  </td>
                  {/* Paid */}
                  <td className="p-2 text-emerald-600 dark:text-emerald-400 border-r border-slate-300 dark:border-slate-700">
                    {stats.paid.count}
                  </td>
                  <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                    {formatCurrency(stats.paid.amount)}
                  </td>
                  {/* Office Team */}
                  <td className="p-2 text-amber-600 dark:text-amber-400 border-r border-slate-300 dark:border-slate-700">
                    {stats.officeTeam.count}
                  </td>
                  <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                    {formatCurrency(stats.officeTeam.amount)}
                  </td>
                  {/* Bill Dispute */}
                  <td className="p-2 text-orange-600 dark:text-orange-400 border-r border-slate-300 dark:border-slate-700">
                    {stats.billDispute.count}
                  </td>
                  <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                    {formatCurrency(stats.billDispute.amount)}
                  </td>
                  {/* Not Found */}
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
    </div>
  );
};

export default DisconnectionPerformanceDashboard;
