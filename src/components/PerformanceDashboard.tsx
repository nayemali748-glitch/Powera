import React from 'react';
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
  Layers
} from 'lucide-react';
import { CategoryType, PowerEntry } from '../types';
import { Language, translations } from '../utils/translations';

interface PerformanceDashboardProps {
  entries: PowerEntry[];
  categoryCounts: Record<string, number>;
  onSelectCategory: (category: CategoryType) => void;
  currentLanguage?: Language;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  entries,
  categoryCounts,
  onSelectCategory,
  currentLanguage = 'bn',
}) => {
  const t = translations[currentLanguage] || translations.bn;

  const totalEntries = entries.length;
  const completedEntries = entries.filter(e => e.status === 'Completed' || e.status === 'Approved').length;
  const pendingEntries = entries.filter(e => e.status === 'Pending' || e.status === 'In Progress').length;
  const withGps = entries.filter(e => !!e.locationGps).length;
  const withMedia = entries.filter(e => !!e.photoUrl).length;

  const completionRate = totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 100;

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
      count: categoryCounts['DISCONNECTION'] || 0,
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

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs mb-6 space-y-4">
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

        {/* Top summary badge */}
        <div className="flex items-center gap-2 text-xs">
          <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 shadow-xs">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>{totalEntries} Total Entries</span>
          </div>
        </div>
      </div>

      {/* 5 Work Category Visual Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {categoryStats.map((item) => {
          const Icon = item.icon;
          const percentage = totalEntries > 0 ? Math.round((item.count / totalEntries) * 100) : 0;

          return (
            <button
              key={item.id}
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
                  {percentage}%
                </span>
              </div>

              <div className="mt-1">
                <p className="text-[11px] font-bold text-slate-700 truncate">{item.name}</p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className={`text-lg font-black ${item.textAccent}`}>{item.count}</span>
                  <span className="text-[10px] text-slate-500 font-medium">records</span>
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
