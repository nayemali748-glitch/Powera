import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Building2,
  Zap,
  Flame,
  FileSpreadsheet,
  Award,
  ChevronRight,
  Filter,
  CreditCard,
  PhoneCall,
  Search
} from 'lucide-react';
import { DisconnectionTask, DisconnectionStats } from '../../types';

interface DisconnectionDashboardProps {
  tasks: DisconnectionTask[];
  stats: DisconnectionStats;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onSelectStatusFilter?: (status: string) => void;
  onSelectWorkerFilter?: (worker: string) => void;
  lang?: 'en' | 'bn';
}

export const DisconnectionDashboard: React.FC<DisconnectionDashboardProps> = ({
  tasks,
  stats,
  onRefresh,
  isRefreshing = false,
  onSelectStatusFilter,
  onSelectWorkerFilter,
  lang = 'en'
}) => {
  const [workerSearch, setWorkerSearch] = useState('');

  // Dynamically compute live backend stats if tasks change
  const computedStats = useMemo(() => {
    let total = tasks.length;
    let completed = 0;
    let disconnected = 0;
    let pending = 0;
    let paid = 0;
    let notFound = 0;
    let dispute = 0;
    let officeTeam = 0;
    let reissue = 0;
    let urgent = 0;

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
      const st = String(t.taskStatus || 'PENDING').toUpperCase();
      const pAmt = parseFloat(String(t.paidAmount || '0').replace(/[^0-9.-]/g, '')) || 0;
      const oAmt = parseFloat(String(t.outstandingDue || '0').replace(/[^0-9.-]/g, '')) || 0;

      totalOutstanding += oAmt;
      totalCollected += pAmt;

      if (st === 'DISCONNECT') {
        disconnected++;
        completed++;
      } else if (st === 'COMPLETED') {
        completed++;
      } else if (st === 'PENDING') {
        pending++;
      } else if (st === 'PAID') {
        paid++;
        completed++;
      } else if (st === 'NOT FOUND') {
        notFound++;
      } else if (st === 'DISPUTE') {
        dispute++;
      } else if (st === 'OFFICE TEAM') {
        officeTeam++;
      } else if (st === 'REISSUE') {
        reissue++;
      } else if (st === 'IN PROGRESS') {
        pending++;
      }

      if (String(t.priority || '').toUpperCase() === 'URGENT') {
        urgent++;
      }

      // Group workers
      const wName = t.assignedWorkerName || t.assignedAgency || t.submittedBy || 'Unassigned';
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
      if (st === 'DISCONNECT' || st === 'COMPLETED' || st === 'PAID') {
        w.completed++;
      } else if (st === 'PENDING' || st === 'IN PROGRESS') {
        w.pending++;
      }
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
      total: stats.totalTasks || total,
      completed: stats.completedTasks || completed,
      disconnected: stats.disconnectedTasks !== undefined ? stats.disconnectedTasks : disconnected,
      pending: stats.pendingTasks || pending,
      paid: stats.paidTasks !== undefined ? stats.paidTasks : paid,
      notFound: stats.notFoundTasks !== undefined ? stats.notFoundTasks : notFound,
      dispute: stats.disputeTasks !== undefined ? stats.disputeTasks : dispute,
      officeTeam: stats.officeTeamTasks !== undefined ? stats.officeTeamTasks : officeTeam,
      reissue: stats.reissueTasks !== undefined ? stats.reissueTasks : reissue,
      urgent: stats.urgentTasks !== undefined ? stats.urgentTasks : urgent,
      completionPct: stats.completionPercentage || completionPct,
      totalOutstanding,
      totalCollected,
      workerList: (stats.workerPerformance && stats.workerPerformance.length > 0) ? stats.workerPerformance : workerList
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
      label: lang === 'bn' ? 'মোট উপভোক্তা' : 'Total Consumers',
      count: computedStats.total,
      filterStatus: 'ALL',
      bg: 'bg-slate-900 text-white border-slate-800',
      iconBg: 'bg-slate-800 text-amber-400',
      icon: Users,
      desc: lang === 'bn' ? 'লাইভ ব্যাকএন্ড মোট রেকর্ড' : 'Live backend consumer records'
    },
    {
      id: 'completed',
      label: lang === 'bn' ? 'সম্পন্ন (Completed)' : 'Completed',
      count: computedStats.completed,
      filterStatus: 'COMPLETED',
      bg: 'bg-emerald-50 text-emerald-950 border-emerald-200',
      iconBg: 'bg-emerald-600 text-white',
      icon: CheckCircle2,
      desc: `${computedStats.completionPct}% ${lang === 'bn' ? 'সম্পন্নতার হার' : 'overall rate'}`
    },
    {
      id: 'pending',
      label: lang === 'bn' ? 'অমীমাংসিত (Pending)' : 'Pending',
      count: computedStats.pending,
      filterStatus: 'PENDING',
      bg: 'bg-amber-50 text-amber-950 border-amber-200',
      iconBg: 'bg-amber-500 text-slate-950',
      icon: Clock,
      desc: lang === 'bn' ? 'মাঠে কার্যকর করার অপেক্ষায়' : 'Awaiting field execution'
    },
    {
      id: 'disconnected',
      label: lang === 'bn' ? 'বিচ্ছিন্ন (Disconnected)' : 'Disconnected',
      count: computedStats.disconnected,
      filterStatus: 'DISCONNECT',
      bg: 'bg-rose-50 text-rose-950 border-rose-200',
      iconBg: 'bg-rose-600 text-white',
      icon: Zap,
      desc: lang === 'bn' ? 'সংযোগ বিচ্ছিন্ন সম্পন্ন' : 'Power cut executed'
    },
    {
      id: 'paid',
      label: lang === 'bn' ? 'পরিশোধিত (Paid)' : 'Paid',
      count: computedStats.paid,
      filterStatus: 'PAID',
      bg: 'bg-teal-50 text-teal-950 border-teal-200',
      iconBg: 'bg-teal-600 text-white',
      icon: CreditCard,
      desc: `₹${computedStats.totalCollected.toLocaleString('en-IN')} ${lang === 'bn' ? 'আদায়' : 'collected'}`
    },
    {
      id: 'notFound',
      label: lang === 'bn' ? 'অনুপস্থিত (Not Found)' : 'Not Found',
      count: computedStats.notFound,
      filterStatus: 'NOT FOUND',
      bg: 'bg-slate-100 text-slate-900 border-slate-300',
      iconBg: 'bg-slate-700 text-white',
      icon: HelpCircle,
      desc: lang === 'bn' ? 'ঠিকানা/মিটার পাওয়া যায়নি' : 'Locked / unlocatable premises'
    },
    {
      id: 'dispute',
      label: lang === 'bn' ? 'বিরোধ (Dispute)' : 'Dispute',
      count: computedStats.dispute,
      filterStatus: 'DISPUTE',
      bg: 'bg-orange-50 text-orange-950 border-orange-200',
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
      iconBg: 'bg-indigo-600 text-white',
      icon: Building2,
      desc: lang === 'bn' ? 'বিশেষ আধিকারিক দল প্রয়োজন' : 'Special squad / police escort'
    },
    {
      id: 'reissue',
      label: lang === 'bn' ? 'পুনঃপ্রেরণ (Reissue)' : 'Reissue',
      count: computedStats.reissue,
      filterStatus: 'REISSUE',
      bg: 'bg-purple-50 text-purple-950 border-purple-200',
      iconBg: 'bg-purple-600 text-white',
      icon: RefreshCw,
      desc: lang === 'bn' ? 'পুনর্বার তদন্ত প্রয়োজন' : 'Re-verification requested'
    },
    {
      id: 'urgent',
      label: lang === 'bn' ? 'জরুরি (Urgent)' : 'Urgent',
      count: computedStats.urgent,
      filterStatus: 'URGENT',
      bg: 'bg-red-50 text-red-950 border-red-300 ring-1 ring-red-300',
      iconBg: 'bg-red-600 text-white',
      icon: Flame,
      desc: lang === 'bn' ? 'উচ্চ অগ্রাধিকার উপভোক্তা' : 'High-priority defaulters'
    }
  ];

  return (
    <div className="space-y-6" id="disconnection-dashboard">
      {/* Top Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {lang === 'bn' ? 'লাইভ ডিসকানেকশন ড্যাশবোর্ড' : 'Live Disconnection Performance Dashboard'}
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
              Live Google Sheets Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'bn' 
              ? 'বিদ্যুৎ সংযোগ বিচ্ছিন্নকরণ ও বকেয়া আদায়ের রিয়েল-টাইম কার্যকারিতা পরিসংখ্যান' 
              : 'Real-time utility disconnection statistics, defaulter execution, and agency performance.'}
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

      {/* Progress & Dues Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Completion Rate */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 border border-slate-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              {lang === 'bn' ? 'মোট সম্পন্নতার হার' : 'Completion Rate'}
            </span>
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          <div className="my-3">
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
          <p className="text-[11px] text-slate-400">
            {lang === 'bn' ? 'ডিসকানেক্ট ও পরিশোধিত সহ মোট সফল নিষ্পত্তির অনুপাত' : 'Includes disconnected executions and verified consumer settlements'}
          </p>
        </div>

        {/* Total Arrears Outstanding */}
        <div className="bg-rose-50 border border-rose-200 text-rose-950 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-rose-700 uppercase">
              {lang === 'bn' ? 'মোট বকেয়া পরিমাণ' : 'Total Outstanding Arrears'}
            </span>
            <CreditCard className="w-5 h-5 text-rose-600" />
          </div>
          <div className="my-3">
            <div className="text-2xl font-black text-rose-700">
              ₹{computedStats.totalOutstanding.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-rose-800 font-medium mt-1">
              {computedStats.total} {lang === 'bn' ? 'উপভোক্তার মোট বকেয়া দাবি' : 'consumers defaulter list'}
            </p>
          </div>
          <span className="text-[11px] text-rose-600">
            {lang === 'bn' ? 'ডেলিগেট তালিকাভুক্ত সক্রিয় বকেয়া' : 'Target revenue recovery in field'}
          </span>
        </div>

        {/* Total Arrears Collected */}
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-emerald-700 uppercase">
              {lang === 'bn' ? 'মাঠে মোট আদায়' : 'Recovered in Field (Paid)'}
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="my-3">
            <div className="text-2xl font-black text-emerald-700">
              ₹{computedStats.totalCollected.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-emerald-800 font-medium mt-1">
              {computedStats.paid} {lang === 'bn' ? 'উপভোক্তা তাৎক্ষণিক পরিশোধ করেছেন' : 'consumers paid on-spot'}
            </p>
          </div>
          <span className="text-[11px] text-emerald-600">
            {lang === 'bn' ? 'ডিসকানেকশন এড়াতে জমা দেওয়া অর্থ' : 'Live recorded payment references'}
          </span>
        </div>
      </div>

      {/* 10 Core Metric Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
            {lang === 'bn' ? '১০টি প্রধান স্ট্যাটাস মেট্রিক (ফিল্টার করতে ক্লিক করুন)' : '10 Live Status Metrics (Click to Filter View List)'}
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">
            {lang === 'bn' ? 'লাইভ ব্যাকএন্ড ডাটা' : 'Synchronized with backend'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {statCards.map(card => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                id={`stat-card-${card.id}`}
                onClick={() => onSelectStatusFilter && onSelectStatusFilter(card.filterStatus)}
                className={`text-left p-3.5 rounded-2xl border ${card.bg} shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer flex flex-col justify-between group`}
                title={`Filter by ${card.label}`}
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

                <div className="mt-2 pt-2 border-t border-current/10 flex items-center justify-between text-[10px] font-bold opacity-80 group-hover:opacity-100">
                  <span>{lang === 'bn' ? 'তালিকা দেখুন' : 'View List'}</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

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
