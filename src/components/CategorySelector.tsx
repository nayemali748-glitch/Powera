import React from 'react';
import { 
  Zap, 
  Scissors, 
  TowerControl, 
  Gauge, 
  Activity,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { CategoryType } from '../types';

interface CategorySelectorProps {
  selectedCategory: CategoryType;
  onSelectCategory: (category: CategoryType) => void;
  categoryCounts?: Record<string, number>;
}

export const CATEGORIES: Array<{
  id: CategoryType;
  title: string;
  subtitleBn: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  lightBg: string;
  badgeBg: string;
}> = [
  {
    id: 'NSC',
    title: 'NSC',
    subtitleBn: 'নতুন বিদ্যুৎ সংযোগ (New Connection)',
    shortDesc: 'কনজিউমার লোড, মিটার স্থাপন, সিল নং ও ড্রপ কেবল লাইন এন্ট্রি',
    icon: Zap,
    accentColor: 'text-amber-600',
    lightBg: 'bg-amber-50 text-amber-700',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  {
    id: 'DISCONNECTION',
    title: 'DISCONNECTION',
    subtitleBn: 'সংযোগ বিচ্ছিন্নকরণ (Line Disconnection)',
    shortDesc: 'বকেয়া বিল খেলাপী, গ্রাহক আবেদন ও অবৈধ সংযোগ বিচ্ছিন্ন এন্ট্রি',
    icon: Scissors,
    accentColor: 'text-red-600',
    lightBg: 'bg-red-50 text-red-700',
    badgeBg: 'bg-red-100 text-red-800 border-red-200'
  },
  {
    id: 'POLE CASE',
    title: 'POLE CASE',
    subtitleBn: 'খুঁটি ও লাইন মেরামত (Pole & Line Fault)',
    shortDesc: 'ভাঙা/হেলে পড়া পোল, নতুন পোল স্থাপন, তার টানা ও স্টে সেট রিপোর্ট',
    icon: TowerControl,
    accentColor: 'text-blue-600',
    lightBg: 'bg-blue-50 text-blue-700',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  {
    id: 'METER REPLESMENT',
    title: 'METER REPLESMENT',
    subtitleBn: 'মিটার পরিবর্তন (Meter Replacement)',
    shortDesc: 'পোড়া/নষ্ট ও ডিজিটাল মিটার প্রতিস্থাপন, পুরাতন ও নতুন রিডিং এন্ট্রি',
    icon: Gauge,
    accentColor: 'text-emerald-600',
    lightBg: 'bg-emerald-50 text-emerald-700',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  {
    id: 'DTR REPLESMENT',
    title: 'DTR REPLESMENT',
    subtitleBn: 'ট্রান্সফরমার পরিবর্তন (DTR Replacement)',
    shortDesc: 'ডিস্ট্রিবিউশন ট্রান্সফরমার (kVA), অয়েল টেস্ট, নতুন DTR সিরিয়াল এন্ট্রি',
    icon: Activity,
    accentColor: 'text-purple-600',
    lightBg: 'bg-purple-50 text-purple-700',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-200'
  }
];

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts = {},
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-700" />
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-wide uppercase">
            Work Category Selection (৫টি অপশন)
          </h2>
        </div>
        <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full font-medium hidden sm:inline">
          যেকোনো অপশনে ক্লিক করে সরাসরি এন্ট্রি ফর্ম খুলুন
        </span>
      </div>

      {/* Grid of 5 Category Cards in Professional Polish Design */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const Icon = cat.icon;
          const count = categoryCounts[cat.id] || 0;

          return (
            <button
              key={cat.id}
              id={`cat-btn-${cat.id.replace(/\s+/g, '-').toLowerCase()}`}
              onClick={() => onSelectCategory(cat.id)}
              className={`relative text-left p-4 rounded-xl border transition-all duration-150 flex flex-col justify-between overflow-hidden cursor-pointer group hover:scale-[1.01] ${
                isSelected
                  ? 'bg-slate-900 border-slate-900 text-white shadow-md ring-2 ring-slate-900/10'
                  : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-sm text-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-slate-800 text-amber-400' : `${cat.lightBg} group-hover:bg-blue-600 group-hover:text-white`
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {count > 0 && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isSelected 
                        ? 'bg-slate-800 border-slate-700 text-amber-300' 
                        : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      {count}
                    </span>
                  )}
                </div>

                <div className={`font-bold text-xs sm:text-sm flex items-center gap-1.5 ${
                  isSelected ? 'text-white' : 'text-slate-900 group-hover:text-blue-600'
                }`}>
                  <span>{cat.title}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </div>

                <p className={`text-[11px] font-medium mt-1 leading-snug line-clamp-1 ${
                  isSelected ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  {cat.subtitleBn}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100/15 flex items-center justify-between">
                <span className={`text-[11px] font-bold flex items-center gap-1 ${
                  isSelected ? 'text-amber-400' : 'text-blue-600 group-hover:underline'
                }`}>
                  ফর্ম খুলুন →
                </span>
                <span className="text-[10px] text-slate-400 hidden xs:inline font-mono">
                  {cat.id === 'NSC' ? 'New' : cat.id.slice(0, 4)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

