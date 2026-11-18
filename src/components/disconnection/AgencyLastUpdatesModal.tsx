import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  RefreshCw,
  Building2,
  Clock
} from 'lucide-react';
import { DisconnectionTask, UserSession } from '../../types';
import {
  isUpdatedDisconnectionRecord,
  getTaskReportYMD,
  getTodayYMD,
  getDeduplicatedUpdatedTasks
} from './DisconnectionDailyReportModal';
import {
  cleanWorkerOrAgencyName,
  cleanDisconnectionNotes
} from '../../utils/disconnectionClassifier';

export interface AgencyLastUpdatesWorkerRef {
  id: string;
  idNo: string;
  name: string;
  role?: string;
}

interface AgencyLastUpdatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: DisconnectionTask[];
  availableUsers?: AgencyLastUpdatesWorkerRef[];
  currentUser?: UserSession | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lang?: 'en' | 'bn';
}

type FreshnessColor = 'GREEN' | 'YELLOW' | 'RED' | 'EXPIRED';

interface AgencyDateUpdateRow {
  key: string;
  agencyName: string;
  ymd: string;
  displayDate: string;
  totalUpdates: number;
  latestTimestampMs: number;
  isCurrentUserAgency: boolean;
  daysAgo: number;
  colorState: FreshnessColor;
}

function formatYMDToDashDDMMYYYY(ymd: string): string {
  if (!ymd) return '-';
  const parts = ymd.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return ymd;
}

function getCalendarDaysAgo(ymd: string, todayYmd: string): number {
  const parseUtcDay = (s: string) => {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return NaN;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  const rowMs = parseUtcDay(ymd);
  const todayMs = parseUtcDay(todayYmd);
  if (isNaN(rowMs) || isNaN(todayMs)) return 9999;
  return Math.round((todayMs - rowMs) / 86400000);
}

function getFreshnessColorState(daysAgo: number): FreshnessColor {
  // Day 1 (Today = 0) -> GREEN
  // Day 2 (Tomorrow without update = 1) -> YELLOW
  // Day 3 (Day after without update = 2) -> RED
  // Day 4+ (>= 3) -> EXPIRED (hidden from Agency Last Updates)
  if (daysAgo <= 0) return 'GREEN';
  if (daysAgo === 1) return 'YELLOW';
  if (daysAgo === 2) return 'RED';
  return 'EXPIRED';
}

function getTaskUpdateTimeMs(task: DisconnectionTask, fallbackYmd: string): number {
  if (typeof (task as any)._localUpdatedAt === 'number' && (task as any)._localUpdatedAt > 0) {
    return (task as any)._localUpdatedAt;
  }
  const candidates = [
    (task as any)['Last Updated'],
    task.lastUpdated,
    task.updatedAt,
    (task as any)['Discon Date'],
    task.disconDate,
    (task as any)['Paid Date'],
    task.paidDate,
    task.reportDate
  ];
  for (const c of candidates) {
    if (c) {
      const ms = new Date(String(c)).getTime();
      if (!isNaN(ms) && ms > 0) return ms;
    }
  }
  if (fallbackYmd) {
    const ms = new Date(`${fallbackYmd}T12:00:00+05:30`).getTime();
    if (!isNaN(ms) && ms > 0) return ms;
  }
  return 0;
}

function stripGenericAgencySuffix(val: string): string {
  return val
    .toLowerCase()
    .replace(
      /\b(enterprise|enterprises|agency|associates|traders|construction|electric|electrical|electricals|electro|electronic|india|pvt|ltd|private|limited|co|company|wbsedcl|partner)\b/gi,
      ' '
    )
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveCanonicalAgencyName(
  task: DisconnectionTask,
  nonAdminUsers: AgencyLastUpdatesWorkerRef[]
): string {
  const candidates = [
    (task as any)['Agency'],
    task.Agency,
    task.agency,
    task.assignedAgency,
    task.assignedWorkerName,
    task.submittedBy && task.submittedBy !== 'Worker' ? task.submittedBy : '',
    Array.isArray(task.statusHistory) &&
    task.statusHistory[0]?.workerName &&
    task.statusHistory[0].workerName !== 'Worker'
      ? task.statusHistory[0].workerName
      : ''
  ];

  const isAdminLabel = (val: string) =>
    /^(admin|administrator|superadmin|controller|worker|unassigned|samsi ccc|nayem(?:\s*\(.*\))?)$/i.test(
      val.trim()
    );

  let rawAgency = '';
  for (const c of candidates) {
    const cleaned = cleanWorkerOrAgencyName(String(c || '').trim());
    if (cleaned && !isAdminLabel(cleaned)) {
      rawAgency = cleaned;
      break;
    }
  }

  if (!rawAgency) return '';

  const normRaw = rawAgency
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normRaw) return '';

  const exactMatch = nonAdminUsers.find(u => {
    const uNorm = cleanWorkerOrAgencyName(u.name)
      .toLowerCase()
      .replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return uNorm === normRaw;
  });
  if (exactMatch) {
    return cleanWorkerOrAgencyName(exactMatch.name).toUpperCase();
  }

  const rawCore = stripGenericAgencySuffix(normRaw);
  const brandMatches = nonAdminUsers.filter(u => {
    const uNorm = cleanWorkerOrAgencyName(u.name)
      .toLowerCase()
      .replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!uNorm) return false;
    if (uNorm.startsWith(`${normRaw} `) || normRaw.startsWith(`${uNorm} `)) return true;
    const uCore = stripGenericAgencySuffix(uNorm);
    return Boolean(rawCore && uCore && rawCore.length >= 3 && uCore === rawCore);
  });

  if (brandMatches.length === 1) {
    return cleanWorkerOrAgencyName(brandMatches[0].name).toUpperCase();
  }

  return rawAgency.toUpperCase();
}

export const AgencyLastUpdatesModal: React.FC<AgencyLastUpdatesModalProps> = ({
  isOpen,
  onClose,
  tasks,
  availableUsers = [],
  currentUser,
  onRefresh,
  isRefreshing = false,
  lang = 'en'
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const todayYMD = useMemo(() => getTodayYMD(), [isOpen, tasks]);

  const nonAdminUsers = useMemo(() => {
    return availableUsers.filter(u => {
      const r = String(u.role || '').trim().toLowerCase();
      return r !== 'admin' && r !== 'superadmin' && r !== 'controller';
    });
  }, [availableUsers]);

  const currentUserBrand = useMemo(() => {
    const raw = cleanWorkerOrAgencyName(
      String((currentUser as any)?.agencyName || currentUser?.name || currentUser?.username || '')
    );
    return stripGenericAgencySuffix(raw);
  }, [currentUser]);

  // Build each agency's exact genuine update count within the 3-day window (Today=Green, 1 day ago=Yellow, 2 days ago=Red; 3+ days ago=hidden)
  const agencyRows = useMemo<AgencyDateUpdateRow[]>(() => {
    const dedupedUpdated = getDeduplicatedUpdatedTasks(tasks);
    const byAgencyDate = new Map<string, AgencyDateUpdateRow>();

    dedupedUpdated.forEach(task => {
      const agencyName = resolveCanonicalAgencyName(task, nonAdminUsers);
      if (!agencyName) return;

      const rawStatus = String(
        (task as any)['Discon Status'] ?? task.disconStatus ?? task.taskStatus ?? 'PENDING'
      )
        .trim()
        .toUpperCase();

      // Count strictly records updated via Update Status -> Set Status (DISCONNECT, PAID, NOT FOUND, DISPUTE, OFFICE TEAM)
      const isSetStatusSaved =
        rawStatus === 'DISCONNECT' ||
        rawStatus === 'DISCONNECTED' ||
        rawStatus === 'COMPLETED' ||
        rawStatus === 'PAID' ||
        rawStatus === 'AGENCY PAID' ||
        rawStatus === 'NOT FOUND' ||
        rawStatus === 'DISPUTE' ||
        rawStatus === 'OFFICE TEAM';

      if (!isSetStatusSaved) {
        return;
      }

      const ymd = getTaskReportYMD(task);
      if (!ymd) return;

      const daysAgo = Math.max(0, getCalendarDaysAgo(ymd, todayYMD));
      const colorState = getFreshnessColorState(daysAgo);
      const tsMs = getTaskUpdateTimeMs(task, ymd);

      const agencyCore = stripGenericAgencySuffix(agencyName);
      const isMine = Boolean(
        currentUserBrand &&
          agencyCore &&
          (agencyCore === currentUserBrand ||
            agencyCore.includes(currentUserBrand) ||
            currentUserBrand.includes(agencyCore))
      );

      const key = `${agencyName}__${ymd}`;
      const existing = byAgencyDate.get(key);
      if (!existing) {
        byAgencyDate.set(key, {
          key,
          agencyName,
          ymd,
          displayDate: formatYMDToDashDDMMYYYY(ymd),
          totalUpdates: 1,
          latestTimestampMs: tsMs,
          isCurrentUserAgency: isMine,
          daysAgo,
          colorState
        });
      } else {
        existing.totalUpdates += 1;
        if (tsMs > existing.latestTimestampMs) {
          existing.latestTimestampMs = tsMs;
        }
      }
    });

    // Pick only the most recent update date per agency, and keep ONLY updates within the last 3 days (daysAgo 0, 1, 2)
    const latestPerAgency = new Map<string, AgencyDateUpdateRow>();
    for (const row of byAgencyDate.values()) {
      const existing = latestPerAgency.get(row.agencyName);
      if (!existing || row.ymd > existing.ymd) {
        latestPerAgency.set(row.agencyName, row);
      }
    }

    return Array.from(latestPerAgency.values())
      .filter(row => row.colorState !== 'EXPIRED')
      .sort((a, b) => {
        if (a.daysAgo !== b.daysAgo) return a.daysAgo - b.daysAgo;
        if (b.totalUpdates !== a.totalUpdates) return b.totalUpdates - a.totalUpdates;
        return b.latestTimestampMs - a.latestTimestampMs;
      });
  }, [tasks, nonAdminUsers, currentUserBrand, todayYMD]);

  const visibleRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return agencyRows;
    return agencyRows.filter(
      r => r.agencyName.toLowerCase().includes(q) || r.displayDate.includes(q)
    );
  }, [agencyRows, searchQuery]);

  if (!isOpen) return null;

  const getRowStyles = (colorState: FreshnessColor) => {
    if (colorState === 'GREEN') {
      return {
        card: 'bg-[#dcfce7] border-[#bbf7d0] hover:bg-[#d1fae5]',
        dot: 'bg-emerald-600',
        badge: 'bg-[#86efac]/70 text-emerald-950'
      };
    }
    if (colorState === 'YELLOW') {
      return {
        card: 'bg-[#fef9c3] border-[#fde047] hover:bg-[#fef08a]/80',
        dot: 'bg-amber-500',
        badge: 'bg-[#fde047]/80 text-amber-950'
      };
    }
    return {
      card: 'bg-[#fee2e2] border-[#fca5a5] hover:bg-[#fecaca]/80',
      dot: 'bg-rose-600',
      badge: 'bg-[#fca5a5]/80 text-rose-950'
    };
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[88vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                Agency Last Updates
              </h2>
              <p className="text-[11px] text-slate-300 truncate">
                {lang === 'bn'
                  ? 'গত ৩ দিনের এজেন্সি স্ট্যাটাস ও রিমার্ক আপডেট'
                  : 'Last 3 days agency status & remark updates'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
                title="Refresh live data"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact Search + 3-Day Color Legend */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-5 py-2.5 space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={lang === 'bn' ? 'এজেন্সির নাম খুঁজুন...' : 'Search agency name...'}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-slate-600">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>{lang === 'bn' ? 'আজ (সবুজ)' : 'Today (Green)'}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <span>{lang === 'bn' ? '১ দিন আগে (হলুদ)' : '1 Day Ago (Yellow)'}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                <span>{lang === 'bn' ? '২ দিন আগে (লাল)' : '2 Days Ago (Red)'}</span>
              </span>
            </div>
            <span className="text-slate-500">
              {visibleRows.length} {lang === 'bn' ? 'এজেন্সি' : 'Agencies'}
            </span>
          </div>
        </div>

        {/* Clean Compact Strip Cards */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-1.5 bg-white">
          {visibleRows.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Clock className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-700">
                {lang === 'bn'
                  ? 'গত ৩ দিনে কোনো এজেন্সি আপডেট পাওয়া যায়নি'
                  : 'No agency updates in the last 3 days'}
              </p>
              <p className="text-xs text-slate-400">
                {lang === 'bn'
                  ? 'কোনো এজেন্সি স্ট্যাটাস বা রিমার্ক আপডেট করলে এখানে সবুজ রঙে দেখাবে।'
                  : 'Agencies that submit a status or remark update will appear here.'}
              </p>
            </div>
          ) : (
            visibleRows.map(row => {
              const styles = getRowStyles(row.colorState);
              return (
                <div
                  key={row.key}
                  className={`w-full rounded-xl border px-3 py-1.5 sm:py-2 flex items-center justify-between gap-2 transition-colors shadow-2xs ${styles.card}`}
                >
                  {/* Left: Status Dot + Agency Name */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${styles.dot}`} />
                    <span
                      className="text-[11px] sm:text-xs font-extrabold text-slate-800 uppercase tracking-tight truncate"
                      title={row.agencyName}
                    >
                      {row.agencyName}
                    </span>
                  </div>

                  {/* Right: Clock + Date (DD-MM-YYYY) + Count Pill */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-slate-700 tabular-nums whitespace-nowrap">
                      <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{row.displayDate}</span>
                    </div>
                    <span
                      className={`min-w-[24px] h-5 px-1.5 rounded-full text-[11px] font-black flex items-center justify-center tabular-nums ${styles.badge}`}
                    >
                      {row.totalUpdates}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AgencyLastUpdatesModal;
