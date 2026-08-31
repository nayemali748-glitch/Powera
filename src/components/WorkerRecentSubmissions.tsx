import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  FileText, 
  Printer, 
  Zap, 
  Scissors, 
  TowerControl, 
  Gauge, 
  Activity,
  MapPin,
  User,
  ArrowRight,
  LogOut,
  ShieldCheck,
  UserCheck,
  Search,
  AlertCircle,
  XCircle,
  RotateCw,
  Tag,
  Calendar
} from 'lucide-react';
import { PowerEntry, StatusType, UserSession } from '../types';
import { Language, translations } from '../utils/translations';

interface WorkerRecentSubmissionsProps {
  entries: PowerEntry[];
  workerName: string;
  currentUser?: UserSession | null;
  onLogout?: () => void;
  onSelectEntry: (entry: PowerEntry) => void;
  onNewEntry: () => void;
  lang?: Language;
}

export const WorkerRecentSubmissions: React.FC<WorkerRecentSubmissionsProps> = ({
  entries,
  workerName,
  currentUser,
  onLogout,
  onSelectEntry,
  onNewEntry,
  lang = 'bn',
}) => {
  const t = translations[lang] || translations.bn;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StatusType>('ALL');

  // Filter for this worker or show all recent
  const workerEntries = useMemo(() => {
    return entries.filter(
      e => !workerName || e.workerName?.toLowerCase().includes(workerName.toLowerCase()) || workerName === 'Worker-1'
    );
  }, [entries, workerName]);

  const baseEntries = workerEntries.length > 0 ? workerEntries : entries;

  // Counts by status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: baseEntries.length,
      Pending: 0,
      Completed: 0,
      Approved: 0,
      Rejected: 0,
      'In Progress': 0,
    };
    baseEntries.forEach(e => {
      const st = e.status || 'Pending';
      if (counts[st] !== undefined) {
        counts[st]++;
      } else {
        counts[st] = 1;
      }
    });
    return counts;
  }, [baseEntries]);

  // Filtered entries by search and status
  const displayEntries = useMemo(() => {
    return baseEntries.filter(item => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const itemStatus = item.status || 'Pending';
        if (itemStatus !== statusFilter) return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchId = item.id?.toLowerCase().includes(term);
        const matchConsumer = item.consumerName?.toLowerCase().includes(term);
        const matchConsumerId = item.consumerId?.toLowerCase().includes(term);
        const matchMeter = item.meterNo?.toLowerCase().includes(term) || item.oldMeterNo?.toLowerCase().includes(term) || item.newMeterNo?.toLowerCase().includes(term);
        const matchPole = item.poleNo?.toLowerCase().includes(term);
        const matchDtr = item.dtrName?.toLowerCase().includes(term);
        const matchApp = item.applicationNo?.toLowerCase().includes(term);
        const matchAddress = item.address?.toLowerCase().includes(term);
        const matchWorker = item.workerName?.toLowerCase().includes(term);
        return matchId || matchConsumer || matchConsumerId || matchMeter || matchPole || matchDtr || matchApp || matchAddress || matchWorker;
      }

      return true;
    });
  }, [baseEntries, statusFilter, searchTerm]);

  // Helper for Status Badge Styling & Icon
  const renderStatusBadge = (statusValue?: string) => {
    const status = statusValue || 'Pending';
    
    switch (status) {
      case 'Completed':
        return (
          <span 
            id={`status-badge-${status.toLowerCase()}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>{t.completed || 'Completed'}</span>
          </span>
        );

      case 'Approved':
        return (
          <span 
            id={`status-badge-${status.toLowerCase()}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-950 border border-teal-300 shadow-2xs"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span>{t.approved || 'Approved'}</span>
          </span>
        );

      case 'Rejected':
        return (
          <span 
            id={`status-badge-${status.toLowerCase()}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-950 border border-rose-300 shadow-2xs"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
            <span>{t.rejected || 'Rejected'}</span>
          </span>
        );

      case 'In Progress':
        return (
          <span 
            id={`status-badge-inprogress`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-950 border border-blue-300 shadow-2xs"
          >
            <RotateCw className="w-3.5 h-3.5 text-blue-700 animate-spin shrink-0" />
            <span>{t.inProgress || 'In Progress'}</span>
          </span>
        );

      case 'Pending':
      default:
        return (
          <span 
            id={`status-badge-${status.toLowerCase()}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs"
          >
            <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0 animate-pulse" />
            <span>{t.pending || 'Pending'}</span>
          </span>
        );
    }
  };

  // Helper for Card Border accent according to status
  const getCardStatusAccent = (statusValue?: string) => {
    switch (statusValue) {
      case 'Completed':
        return 'border-l-4 border-l-emerald-500 bg-emerald-50/20';
      case 'Approved':
        return 'border-l-4 border-l-teal-500 bg-teal-50/20';
      case 'Rejected':
        return 'border-l-4 border-l-rose-500 bg-rose-50/20';
      case 'In Progress':
        return 'border-l-4 border-l-blue-500 bg-blue-50/20';
      case 'Pending':
      default:
        return 'border-l-4 border-l-amber-500 bg-amber-50/20';
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* User Account & Session Bar with Logout Option */}
      {currentUser && onLogout && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shadow-xs ${
              currentUser.role === 'admin' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {currentUser.role === 'admin' ? <ShieldCheck className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {currentUser.name}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  currentUser.role === 'admin' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {currentUser.role === 'admin' ? 'Admin' : 'Staff / Lineman'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>{currentUser.designation || 'WBSEDCL Field Operator'}</span>
                {currentUser.phone && <span>• {currentUser.phone}</span>}
                {currentUser.badgeNo && <span className="font-mono">({currentUser.badgeNo})</span>}
              </p>
            </div>
          </div>

          <button
            id="module-worker-logout-btn"
            onClick={onLogout}
            className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 border border-red-200/80 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs cursor-pointer self-start sm:self-auto"
            title={t.logout}
          >
            <LogOut className="w-4 h-4" />
            <span>{t.logout}</span>
          </button>
        </div>
      )}

      {/* Main Submissions Container */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden space-y-4 p-4 sm:p-6">
        {/* Header section with Stats & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {t.mySubmissions}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.recordsCount} ({baseEntries.length}) • {t.wbsedclStandard}
            </p>
          </div>

          <button
            id="btn-new-entry-from-submissions"
            onClick={onNewEntry}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 self-start sm:self-auto shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>{t.dataEntry}</span>
          </button>
        </div>

        {/* Filter Controls: Status Badges Filter Bar + Search Box */}
        <div className="space-y-3 pt-1">
          {/* Status Quick Filter Buttons with Dynamic Count Badges */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {/* All Filter */}
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>{t.filterAll || 'All'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                statusFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {statusCounts.ALL}
              </span>
            </button>

            {/* Pending Filter */}
            <button
              type="button"
              onClick={() => setStatusFilter('Pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'Pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t.pending || 'Pending'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                statusFilter === 'Pending' ? 'bg-amber-700 text-white' : 'bg-amber-200/80 text-amber-900'
              }`}>
                {statusCounts.Pending || 0}
              </span>
            </button>

            {/* Completed Filter */}
            <button
              type="button"
              onClick={() => setStatusFilter('Completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'Completed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t.completed || 'Completed'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                statusFilter === 'Completed' ? 'bg-emerald-700 text-white' : 'bg-emerald-200/80 text-emerald-900'
              }`}>
                {statusCounts.Completed || 0}
              </span>
            </button>

            {/* Approved Filter */}
            <button
              type="button"
              onClick={() => setStatusFilter('Approved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'Approved'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t.approved || 'Approved'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                statusFilter === 'Approved' ? 'bg-teal-700 text-white' : 'bg-teal-200/80 text-teal-900'
              }`}>
                {statusCounts.Approved || 0}
              </span>
            </button>

            {/* Rejected Filter */}
            <button
              type="button"
              onClick={() => setStatusFilter('Rejected')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'Rejected'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>{t.rejected || 'Rejected'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                statusFilter === 'Rejected' ? 'bg-rose-700 text-white' : 'bg-rose-200/80 text-rose-900'
              }`}>
                {statusCounts.Rejected || 0}
              </span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="submissions-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.searchPlaceholder || 'Search by ID, Consumer Name, Meter No, Pole No, DTR...'}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Entries List */}
        {displayEntries.length === 0 ? (
          <div className="text-center py-12 text-slate-500 space-y-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <FileText className="w-10 h-10 mx-auto text-slate-400" />
            <p className="text-sm font-bold text-slate-700">{t.noDataFound}</p>
            <p className="text-xs text-slate-500">
              {searchTerm || statusFilter !== 'ALL'
                ? 'Try adjusting your search filter or status selection'
                : t.clickToOpenForm}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {displayEntries.map((item) => {
              const isNsc = item.category === 'NSC';
              const isDisc = item.category === 'DISCONNECTION';
              const isPole = item.category === 'POLE CASE';
              const isMeter = item.category === 'METER REPLESMENT';
              const isDtr = item.category === 'DTR REPLESMENT';

              const formattedDate = item.date 
                ? new Date(item.date).toLocaleDateString(lang === 'bn' ? 'bn-IN' : 'en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })
                : '';

              return (
                <div
                  key={item.id}
                  id={`submission-card-${item.id}`}
                  onClick={() => onSelectEntry(item)}
                  className={`p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:shadow-md transition-all cursor-pointer space-y-3 group shadow-2xs ${getCardStatusAccent(item.status)}`}
                >
                  {/* Top Bar: ID + Category Badge + Prominent Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {item.id}
                      </span>
                      
                      {/* Category Badge */}
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        isNsc ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        isDisc ? 'bg-rose-50 text-rose-800 border-rose-200' :
                        isPole ? 'bg-sky-50 text-sky-800 border-sky-200' :
                        isMeter ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        'bg-indigo-50 text-indigo-800 border-indigo-200'
                      }`}>
                        {item.category}
                      </span>
                    </div>

                    {/* Color-Coded Status Badge */}
                    <div>
                      {renderStatusBadge(item.status)}
                    </div>
                  </div>

                  {/* Main Subject & Details */}
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors flex items-center gap-1.5">
                      <span>{item.consumerName || item.dtrName || item.poleNo || 'WBSEDCL Field Operation'}</span>
                      {item.consumerId && (
                        <span className="text-[11px] font-mono font-medium text-slate-500">
                          (ID: {item.consumerId})
                        </span>
                      )}
                    </h3>

                    {/* Sub-details (Meter No / App No / Arrear / Pole / DTR) */}
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-medium flex-wrap">
                      {item.meterNo && (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-700">
                          Meter: {item.meterNo}
                        </span>
                      )}
                      {item.arrearAmount && (
                        <span className="bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded text-[11px] font-bold">
                          ₹{item.arrearAmount}
                        </span>
                      )}
                      {item.applicationNo && (
                        <span className="text-[11px] font-mono text-slate-500">
                          App: {item.applicationNo}
                        </span>
                      )}
                      {item.poleNo && !item.consumerName && (
                        <span className="text-[11px] font-mono text-slate-600">
                          Pole: {item.poleNo}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-1">
                      {item.address || item.feederName || item.issueType || item.notes || 'No extra remarks'}
                    </p>
                  </div>

                  {/* Bottom Footer: Lineman & Date & Print Receipt link */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-700">{item.workerName}</span>
                      </div>
                      {formattedDate && (
                        <div className="flex items-center gap-1 text-slate-400">
                          <Calendar className="w-3 h-3" />
                          <span>{formattedDate}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-blue-600 font-bold group-hover:translate-x-0.5 transition-transform">
                      <span>{t.printReceipt}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
