import React from 'react';
import { 
  Zap, 
  Scissors, 
  TowerControl, 
  Gauge, 
  Activity,
  CheckCircle2, 
  Layers,
  ChevronRight
} from 'lucide-react';
import { CategoryType } from '../types';
import { Language, translations } from '../utils/translations';

interface CategorySelectorProps {
  selectedCategory: CategoryType;
  onSelectCategory: (category: CategoryType) => void;
  categoryCounts?: Record<string, number>;
  currentLanguage?: Language;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts = {},
  currentLanguage = 'bn',
}) => {
  const t = translations[currentLanguage] || translations.bn;

  const categories = [
    {
      id: 'NSC' as CategoryType,
      code: '1. NSC',
      title: t.nscTitle,
      subtitle: t.nscSubtitle,
      shortDesc: t.nscShortDesc,
      icon: Zap,
      accentColor: 'text-amber-600',
      lightBg: 'bg-amber-50 text-amber-700',
      badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
      cardHover: 'hover:border-amber-400 hover:shadow-amber-500/10'
    },
    {
      id: 'DISCONNECTION' as CategoryType,
      code: '2. DISCONNECTION',
      title: t.disconnectionTitle,
      subtitle: t.disconnectionSubtitle,
      shortDesc: t.disconnectionShortDesc,
      icon: Scissors,
      accentColor: 'text-rose-600',
      lightBg: 'bg-rose-50 text-rose-700',
      badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
      cardHover: 'hover:border-rose-400 hover:shadow-rose-500/10'
    },
    {
      id: 'POLE CASE' as CategoryType,
      code: '3. POLE CASE',
      title: t.poleCaseTitle,
      subtitle: t.poleCaseSubtitle,
      shortDesc: t.poleCaseShortDesc,
      icon: TowerControl,
      accentColor: 'text-sky-600',
      lightBg: 'bg-sky-50 text-sky-700',
      badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
      cardHover: 'hover:border-sky-400 hover:shadow-sky-500/10'
    },
    {
      id: 'METER REPLESMENT' as CategoryType,
      code: '4. METER REPLESMENT',
      title: t.meterReplacementTitle,
      subtitle: t.meterReplacementSubtitle,
      shortDesc: t.meterReplacementShortDesc,
      icon: Gauge,
      accentColor: 'text-emerald-600',
      lightBg: 'bg-emerald-50 text-emerald-700',
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      cardHover: 'hover:border-emerald-400 hover:shadow-emerald-500/10'
    },
    {
      id: 'DTR REPLESMENT' as CategoryType,
      code: '5. DTR REPLESMENT',
      title: t.dtrReplacementTitle,
      subtitle: t.dtrReplacementSubtitle,
      shortDesc: t.dtrReplacementShortDesc,
      icon: Activity,
      accentColor: 'text-indigo-600',
      lightBg: 'bg-indigo-50 text-indigo-700',
      badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      cardHover: 'hover:border-indigo-400 hover:shadow-indigo-500/10'
    }
  ];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-700" />
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-wide uppercase">
            {t.workCategorySelection}
          </h2>
        </div>
        <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full font-medium hidden sm:inline">
          {t.clickToOpenForm}
        </span>
      </div>

      {/* Grid of 5 Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] || 0;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`text-left p-4 rounded-xl border-2 transition-all duration-150 flex flex-col justify-between relative cursor-pointer group bg-white shadow-xs ${cat.cardHover} ${
                isSelected 
                  ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Top Row: Icon + Count Badge */}
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat.lightBg} shadow-2xs group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cat.badgeBg}`}>
                    {count} {t.recordsCount.split(' ')[0]}
                  </span>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    {cat.code}
                  </span>
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 mt-0.5 leading-tight group-hover:text-blue-600 transition-colors">
                  {cat.title}
                </h3>
                <p className="text-[11px] font-semibold text-slate-600 mt-1 line-clamp-1">
                  {cat.subtitle}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {cat.shortDesc}
                </p>
              </div>

              {/* Action Button Indicator */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-blue-600">
                <span className="text-[11px]">{t.dataEntry} →</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
