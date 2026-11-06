import React from 'react';
import { 
  Zap, 
  Scissors, 
  TowerControl, 
  Gauge, 
  Activity,
  Layers,
  ChevronRight
} from 'lucide-react';
import { CategoryType, ThemeMode } from '../types';
import { Language, translations } from '../utils/translations';
import { TransmissionPylonSvg } from './TransmissionPylonSvg';

interface CategorySelectorProps {
  selectedCategory: CategoryType;
  onSelectCategory: (category: CategoryType) => void;
  categoryCounts?: Record<string, number>;
  currentLanguage?: Language;
  theme?: ThemeMode;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts = {},
  currentLanguage = 'en',
  theme = 'day',
}) => {
  const t = translations[currentLanguage] || translations.en;
  const isNight = theme === 'night';

  const categories = [
    {
      id: 'NSC' as CategoryType,
      code: '1. NSC',
      title: 'NSC (New Service Connection)',
      subtitle: currentLanguage === 'bn' ? 'নতুন বিদ্যুৎ সংযোগ ব্যবস্থা' : 'New Electricity Connection Provision',
      shortDesc: currentLanguage === 'bn' 
        ? 'কনজিউমার লোড, মিটার ইনস্টলেশন, সিকিউরিটি সিল ও সার্ভিস কেবল এন্ট্রি' 
        : 'Consumer load, meter installation, security seal & service cable entry',
      icon: Zap,
      actionText: currentLanguage === 'bn' ? 'নতুন এন্ট্রি ফর্ম →' : 'New Data Entry →',
    },
    {
      id: 'DISCONNECTION' as CategoryType,
      code: '2. DISCONNECTION',
      title: currentLanguage === 'bn' ? 'Disconnection (বকেয়া লাইন বিচ্ছিন্ন)' : 'DISCONNECTION',
      subtitle: currentLanguage === 'bn' ? 'বকেয়া বিল আদায় ও লাইন বিচ্ছিন্নকরণ' : 'Service Line Disconnection',
      shortDesc: currentLanguage === 'bn'
        ? 'বকেয়া কনজিউমার লিস্ট, ডিসকানেকশন রিপোর্ট, মিটার রিডিং ও ফটো আপলোড'
        : 'Outstanding arrear default, consumer request & unauthorized load cutoff',
      icon: Scissors,
      actionText: currentLanguage === 'bn' ? 'ডিসকানেকশন লিস্ট দেখুন →' : 'Disconnection List →',
    },
    {
      id: 'POLE CASE' as CategoryType,
      code: '3. POLE CASE',
      title: currentLanguage === 'bn' ? 'Pole Case (ভাঙা পোল মেরামতি)' : 'POLE CASE',
      subtitle: currentLanguage === 'bn' ? 'ভাঙা বা ঝুঁকিপূর্ণ পোল প্রতিস্থাপন' : 'Broken Pole Case & Structure Repair',
      shortDesc: currentLanguage === 'bn'
        ? 'পোল নম্বর, অবস্থান, জিপিএস ক্যামেরা ও মেরামতি রিপোর্ট'
        : 'Pole number, location GPS camera & structural maintenance report',
      icon: TowerControl,
      actionText: currentLanguage === 'bn' ? 'পোল মেরামত এন্ট্রি →' : 'Pole Maintenance →',
    },
    {
      id: 'METER REPLESMENT' as CategoryType,
      code: '4. METER REPLESMENT',
      title: currentLanguage === 'bn' ? 'Meter Replacement (মিটার বদল)' : 'METER REPLACEMENT',
      subtitle: currentLanguage === 'bn' ? 'ত্রুটিযুক্ত মিটার প্রতিস্থাপন' : 'Defective & Burnt Meter Replacement',
      shortDesc: currentLanguage === 'bn'
        ? 'পুরাতন ও নতুন মিটার নম্বর, সিল নম্বর ও ফাইনাল রিডিং এন্ট্রি'
        : 'Old/new meter serial, security seal number & final reading entry',
      icon: Gauge,
      actionText: currentLanguage === 'bn' ? 'মিটার রিপ্লেসমেন্ট এন্ট্রি →' : 'Meter Replacement →',
    },
    {
      id: 'DTR REPLESMENT' as CategoryType,
      code: '5. DTR REPLESMENT',
      title: currentLanguage === 'bn' ? 'DTR Replacement (ট্রান্সফরমার বদল)' : 'DTR REPLACEMENT',
      subtitle: currentLanguage === 'bn' ? 'ডিস্ট্রিবিউশন ট্রান্সফরমার মেরামত' : 'Distribution Transformer Replacement',
      shortDesc: currentLanguage === 'bn'
        ? 'DTR নাম, কেভিএ ক্ষমতা, অয়েল লেভেল ও রক্ষণাবেক্ষণ এন্ট্রি'
        : 'DTR name, kVA capacity, oil level check & maintenance report',
      icon: Activity,
      actionText: currentLanguage === 'bn' ? 'ট্রান্সফরমার এন্ট্রি →' : 'DTR Maintenance →',
    }
  ];

  return (
    <div className="w-full space-y-4">
      {/* WORK CATEGORY SELECTION Header (Color-coded Blue) */}
      <div className={`flex items-center justify-between px-4 sm:px-5 py-3 rounded-2xl transition-all duration-200 ${
        isNight
          ? 'bg-[#06122c] border border-[#0ea5e9]/80 shadow-[0_0_20px_rgba(14,165,233,0.25)]'
          : 'bg-[#edf5ff] border border-[#bfdbfe] shadow-2xs'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
            isNight
              ? 'bg-[#0284c7] text-white shadow-[0_0_10px_rgba(14,165,233,0.5)]'
              : 'bg-[#2563eb] text-white'
          }`}>
            <Layers className="w-4 h-4" />
          </div>
          <h2 className={`text-xs sm:text-sm font-black tracking-wider uppercase ${
            isNight ? 'text-white' : 'text-[#1d4ed8]'
          }`}>
            WORK CATEGORY SELECTION (5 MODULES)
          </h2>
        </div>
        <ChevronRight className={`w-5 h-5 shrink-0 ${
          isNight ? 'text-[#38bdf8]' : 'text-[#2563eb]'
        }`} />
      </div>

      {/* Grid of 5 Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {categories.map((cat, idx) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] || 0;

          // Day mode color themes per module matching IMG_7279
          const dayIconStyle =
            cat.id === 'NSC'
              ? 'bg-[#fffbeb] border border-[#fef3c7] text-[#d97706]'
              : cat.id === 'DISCONNECTION'
              ? 'bg-[#fff1f2] border border-[#ffe4e6] text-[#e11d48]'
              : cat.id === 'POLE CASE'
              ? 'bg-[#ecfeff] border border-[#cffafe] text-[#0891b2]'
              : cat.id === 'METER REPLESMENT'
              ? 'bg-[#faf5ff] border border-[#f3e8ff] text-[#9333ea]'
              : 'bg-[#ecfdf5] border border-[#d1fae5] text-[#059669]';

          return (
            <button
              key={`${cat.id}-${idx}`}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`text-left rounded-2xl sm:rounded-3xl p-4.5 sm:p-5.5 transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer group ${
                isNight
                  ? `bg-[#06122c] border-2 shadow-[0_0_20px_rgba(14,165,233,0.2)] hover:border-[#38bdf8] hover:shadow-[0_0_25px_rgba(14,165,233,0.35)] ${
                      isSelected ? 'border-[#38bdf8] ring-2 ring-[#0ea5e9]/40' : 'border-[#0ea5e9]/70'
                    }`
                  : `bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-all ${
                      isSelected
                        ? 'border-2 border-[#2563eb] shadow-[0_4px_16px_rgba(37,99,235,0.1)]'
                        : 'border border-slate-200/90 hover:border-slate-300'
                    }`
              }`}
            >
              {/* Electric Transmission Pylon Watermark in Background */}
              <TransmissionPylonSvg
                theme={theme}
                mode="card"
                className={`absolute right-0 bottom-0 w-36 h-48 pointer-events-none select-none transition-opacity ${
                  isNight ? 'opacity-30' : 'opacity-[0.05]'
                }`}
              />

              {/* Relative Content Container */}
              <div className="relative z-10 w-full flex flex-col justify-between h-full space-y-3.5 sm:space-y-4">
                {/* Top Row: Icon + Count Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                    isNight
                      ? 'bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                      : dayIconStyle
                  }`}>
                    <Icon className="w-5.5 h-5.5 sm:w-6 sm:h-6" />
                  </div>

                  {/* Badges */}
                  {cat.id === 'DISCONNECTION' ? (
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-[11px] font-black px-3.5 py-0.5 rounded-full shadow-2xs ${
                        isNight
                          ? 'bg-[#f43f5e] text-white shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                          : 'bg-[#ffe4e6] border border-[#fecdd3] text-[#9f1239]'
                      }`}>
                        {currentLanguage === 'bn' ? `মোট তালিকা: ${count}` : `Total List: ${count}`}
                      </span>
                      <span className={`text-[11px] font-black px-3.5 py-0.5 rounded-full shadow-2xs ${
                        isNight
                          ? 'bg-[#f59e0b] text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                          : 'bg-[#ffe4e6] border border-[#fecdd3] text-[#9f1239]'
                      }`}>
                        {currentLanguage === 'bn' ? `${count} টি কনজিউমার` : `${count} Consumers`}
                      </span>
                    </div>
                  ) : (
                    <span className={`text-xs font-black px-3.5 py-1 rounded-full shrink-0 shadow-2xs ${
                      isNight
                        ? 'bg-[#f59e0b] text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                        : 'bg-[#fef3c7] border border-[#fde68a] text-[#92400e]'
                    }`}>
                      {currentLanguage === 'bn' ? `${count} টি রেকর্ড` : `${count} Recorded`}
                    </span>
                  )}
                </div>

                {/* Body: Number, Title, Subtitle, Short Desc */}
                <div className="space-y-1">
                  <span className={`text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider block ${
                    isNight ? 'text-[#38bdf8]' : 'text-slate-500'
                  }`}>
                    {cat.code}
                  </span>

                  <h3 className={`font-black text-base sm:text-lg leading-tight tracking-tight transition-colors ${
                    isNight
                      ? 'text-white group-hover:text-[#38bdf8]'
                      : 'text-slate-900 group-hover:text-[#2563eb]'
                  }`}>
                    {cat.title}
                  </h3>

                  <p className={`text-xs sm:text-[13px] font-semibold leading-tight pt-0.5 ${
                    isNight ? 'text-sky-200' : 'text-slate-700'
                  }`}>
                    {cat.subtitle}
                  </p>

                  <p className={`text-xs leading-relaxed pt-1 line-clamp-2 ${
                    isNight ? 'text-slate-300 font-medium' : 'text-slate-600 font-normal'
                  }`}>
                    {cat.shortDesc}
                  </p>
                </div>

                {/* Bottom Row: Action Link + Right Chevron */}
                <div className={`pt-3 border-t flex items-center justify-between text-xs sm:text-[13px] font-black transition-colors ${
                  isNight
                    ? 'border-blue-900/60 text-[#38bdf8] group-hover:text-white'
                    : 'border-slate-100 text-slate-800 group-hover:text-[#2563eb]'
                }`}>
                  <span className="flex items-center gap-1 group-hover:underline">
                    {cat.id === 'DISCONNECTION'
                      ? (currentLanguage === 'bn' ? `ডিসকানেকশন লিস্ট (${count}) →` : `Disconnection List (${count}) →`)
                      : cat.actionText}
                  </span>
                  <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${
                    isNight ? 'text-[#38bdf8]' : 'text-slate-400 group-hover:text-[#2563eb]'
                  }`} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
