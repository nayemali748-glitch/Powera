import React, { useState, useRef, useEffect } from 'react';
import appLogo from '../assets/images/power_round_logo_1787860440979.jpg';
import { 
  Zap, 
  ShieldCheck, 
  UserCheck, 
  MoreVertical, 
  FileSpreadsheet, 
  AlertTriangle, 
  Lock, 
  LogOut, 
  Radio, 
  Clock, 
  Sparkles, 
  Menu, 
  CheckCircle2, 
  Home,
  Globe,
  BarChart3,
  PowerOff,
  Calendar,
  Settings,
  RefreshCw,
  Sun,
  Moon
} from 'lucide-react';
import { CornerOptionKey, UserSession, ActiveTab, ThemeMode } from '../types';
import { Language, translations } from '../utils/translations';
import { cleanNameOnly } from '../utils/entryNormalizer';
import { formatDateDDMMYYYY, formatTime12Hour } from '../utils/dateTimeFormat';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  isAdmin: boolean;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  workerName: string;
  setWorkerName: (name: string) => void;
  currentUser?: UserSession | null;
  onOpenCornerOption: (option: CornerOptionKey) => void;
  onLogoutAdmin: () => void;
  onLogoutUser: () => void;
  totalEntriesCount: number;
  onToggleSidebar?: () => void;
  currentLanguage?: Language;
  onOpenLanguageModal?: () => void;
  forceRefreshState?: 'idle' | 'refreshing' | 'completed' | 'failed';
  onForceSystemRefresh?: () => void;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
  onOpenLiveOsdCheck?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isAdmin,
  activeTab,
  setActiveTab,
  workerName,
  setWorkerName,
  currentUser,
  onOpenCornerOption,
  onLogoutAdmin,
  onLogoutUser,
  totalEntriesCount,
  onToggleSidebar,
  currentLanguage = 'en',
  onOpenLanguageModal,
  forceRefreshState = 'idle',
  onForceSystemRefresh,
  theme = 'day',
  onToggleTheme,
  onOpenLiveOsdCheck,
}) => {
  const t = translations[currentLanguage] || translations.en;
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState(false);
  const [tempWorkerName, setTempWorkerName] = useState(workerName);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveWorkerName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempWorkerName.trim()) {
      setWorkerName(tempWorkerName.trim());
      localStorage.setItem('power_worker_name', tempWorkerName.trim());
      setEditingWorker(false);
    }
  };

  const getLangBadge = (code?: string) => {
    switch (code) {
      case 'en': return 'EN';
      case 'hi': return 'HI';
      case 'ur': return 'UR';
      default: return 'বাং';
    }
  };

  return (
    <header className={`h-16 sm:h-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 w-full z-30 sticky top-0 transition-colors duration-200 ${
      theme === 'night' 
        ? 'bg-[#0a1122] border-b border-slate-800 text-white shadow-md' 
        : 'bg-white border-b border-slate-200 text-slate-900 shadow-xs'
    }`}>
      {/* Left Title & System Status */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              theme === 'night' 
                ? 'text-white hover:bg-slate-800' 
                : 'text-slate-800 hover:bg-slate-100'
            }`}
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5 stroke-[2.5]" />
          </button>
        )}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <img 
            src={appLogo} 
            alt="Power of Construction Round Logo" 
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover shadow-sm border-2 border-amber-400 p-0.5 bg-white shrink-0 ring-2 ring-slate-100"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-base sm:text-lg font-black tracking-wide leading-none ${
                theme === 'night' ? 'text-white' : 'text-[#2563eb]'
              }`}>
                POWER
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black tracking-wider uppercase flex items-center gap-1 shadow-2xs ${
                theme === 'night'
                  ? 'bg-emerald-950/70 border border-emerald-500/60 text-emerald-300'
                  : 'bg-[#dcfce7] border border-[#86efac] text-[#15803d]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  theme === 'night' ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-600 animate-pulse'
                }`}></span>
                LIVE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Controls: Golden Home Button + 3-Dots Button */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Home Button with House Symbol */}
        <button
          id="header-home-btn"
          onClick={() => setActiveTab('entry')}
          className={`flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-black transition-all active:scale-95 border cursor-pointer shadow-xs ${
            theme === 'night'
              ? 'bg-[#f59e0b] hover:bg-[#d97706] text-slate-950 border-amber-500 ring-1 ring-amber-400/30'
              : 'bg-[#ffbe1a] hover:bg-[#f59e0b] text-slate-950 border-amber-400 ring-1 ring-amber-300/30'
          }`}
          title="Back to Home"
        >
          <Home className="w-3.5 h-3.5 text-slate-950 stroke-[2.2]" />
          <span>Home</span>
        </button>

        {/* Tools and Utility Menu */}
        <div className="relative" ref={menuRef}>
          <button
            id="header-tools-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            className={`p-1.5 sm:p-2 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
              theme === 'night' 
                ? 'bg-[#0f1b33] hover:bg-[#18284d] text-slate-300 hover:text-white border-blue-900/60 shadow-[0_0_10px_rgba(14,165,233,0.15)]' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-2xs'
            }`}
            title="Options Menu"
            aria-label="Options menu"
          >
            <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Dropdown Menu for Quick Tools & Options */}
          {menuOpen && (
            <div className={`absolute right-0 mt-2 w-72 sm:w-84 rounded-2xl shadow-2xl border py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 divide-y ${
              theme === 'night' 
                ? 'bg-[#0d172e] border-slate-700 text-white divide-slate-800' 
                : 'bg-white border-slate-200 text-slate-900 divide-slate-100'
            }`}>
              <div className={`px-4 py-2.5 flex items-center justify-between ${
                theme === 'night' ? 'bg-[#0a1226]' : 'bg-slate-50'
              }`}>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className={`text-xs font-black uppercase tracking-wider ${theme === 'night' ? 'text-slate-200' : 'text-slate-800'}`}>
                    POWER • App Settings & Tools
                  </span>
                </div>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold border border-amber-500/30">
                  WBSEDCL
                </span>
              </div>

              <div className="py-1">
                {/* 1. LIVE OSD & BILL CHECK OPTION */}
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <button
                    id="header-menu-live-osd-btn"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      if (onOpenLiveOsdCheck) onOpenLiveOsdCheck();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer border bg-emerald-50 hover:bg-emerald-100/80 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-600/40 dark:hover:bg-emerald-900/50 shadow-2xs group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                        <Zap className="w-4 h-4 fill-white" />
                      </div>
                      <div>
                        <div className="text-xs font-black tracking-wide text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{currentLanguage === 'bn' ? 'লাইভ OSD ও বকেয়া চেক' : 'Live OSD & Bill Check'}</span>
                          <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded text-[9px] font-bold">WBSEDCL</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-300 font-semibold mt-0.5">
                          {currentLanguage === 'bn' 
                            ? 'কনজিউমার আইডি দিয়ে লাইভ বকেয়া ও নো-ডিউজ রিপোর্ট' 
                            : 'Live Outstanding, LPSC Surcharge & No Dues'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                      LIVE
                    </span>
                  </button>
                </div>

                {/* DAY / NIGHT THEME SWITCHER OPTION */}
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <button
                    id="header-menu-theme-toggle-btn"
                    type="button"
                    onClick={() => {
                      if (onToggleTheme) onToggleTheme();
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer border ${
                      theme === 'night'
                        ? 'bg-[#111c38] hover:bg-[#162447] border-indigo-500/40 text-white'
                        : 'bg-amber-50 hover:bg-amber-100/80 border-amber-200 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${
                        theme === 'night' ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/40' : 'bg-amber-400 text-slate-950 shadow-xs'
                      }`}>
                        {theme === 'night' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-xs font-black tracking-wide">
                          {currentLanguage === 'bn' ? 'দিন বা রাত মোড (Theme)' : 'Day / Night Mode'}
                        </div>
                        <div className={`text-[10px] font-semibold ${theme === 'night' ? 'text-indigo-200' : 'text-slate-500'}`}>
                          {theme === 'night' 
                            ? (currentLanguage === 'bn' ? 'রাত মোড সক্রিয় • ট্যাপ করে দিন মোড করুন' : 'Night mode active • tap for Day') 
                            : (currentLanguage === 'bn' ? 'দিন মোড সক্রিয় • ট্যাপ করে রাত মোড করুন' : 'Day mode active • tap for Night')}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      theme === 'night' 
                        ? 'bg-indigo-900/80 text-amber-300 border-indigo-400/50' 
                        : 'bg-amber-200/80 text-amber-950 border-amber-300'
                    }`}>
                      {theme === 'night' ? '🌙 Night' : '☀️ Day'}
                    </span>
                  </button>
                </div>

                {/* APP SETTINGS: FORCE SYSTEM REFRESH */}
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1.5">
                    App Settings
                  </div>
                  <button
                    id="header-menu-force-system-refresh-btn"
                    type="button"
                    onClick={() => {
                      if (onForceSystemRefresh) onForceSystemRefresh();
                    }}
                    disabled={forceRefreshState === 'refreshing'}
                    className={`w-full px-3 py-2.5 rounded-lg text-left flex items-center justify-between transition-all cursor-pointer border ${
                      forceRefreshState === 'failed'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : forceRefreshState === 'completed'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-900 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <RefreshCw className={`w-4 h-4 shrink-0 ${forceRefreshState === 'refreshing' ? 'animate-spin' : ''}`} />
                      <div>
                        <div className="text-xs font-extrabold tracking-wide">
                          FORCE SYSTEM REFRESH
                        </div>
                        <div className="text-[10px] opacity-90 font-semibold">
                          {forceRefreshState === 'refreshing'
                            ? 'Refreshing system...'
                            : forceRefreshState === 'completed'
                              ? 'Refresh completed'
                              : forceRefreshState === 'failed'
                                ? 'Refresh failed — tap to retry'
                                : 'Manual emergency/full recovery refresh'}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Install App Option (Inside 3-Dot Options Menu) */}
                <PWAInstallButton
                  lang={currentLanguage}
                  variant="menu-item"
                  onInstalledClick={() => setMenuOpen(false)}
                />

                {/* Language Option */}
                {onOpenLanguageModal && (
                  <button
                    id="corner-opt-language"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenLanguageModal();
                    }}
                    className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-blue-50/50 transition-colors group cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                        Language Settings
                      </div>
                      <p className="text-[11px] text-slate-500">English, বাংলা, हिन्दी, اردو</p>
                    </div>
                  </button>
                )}

                {/* Work Orders & Khata Option */}
                <button
                  id="corner-opt-work-orders"
                  onClick={() => {
                    setMenuOpen(false);
                    setActiveTab('work-orders');
                  }}
                  className="w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-amber-50/60 transition-colors group cursor-pointer"
                >
                  <div className="p-2 rounded-lg mt-0.5 bg-amber-100 text-amber-700">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 group-hover:text-amber-700">
                        {t.workOrders || 'Work Orders & Khata'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.workOrderNoticeDesc || 'View & upload official Work Order and Khata photos'}
                    </p>
                  </div>
                </button>

                {/* Option 1: Admin Mode / Control Portal (ONLY visible if logged in as Admin) */}
                {isAdmin && (
                  <button
                    id="corner-opt-1-admin"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenCornerOption('admin_portal');
                    }}
                    className="w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="p-2 rounded-lg mt-0.5 bg-green-100 text-green-700">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 group-hover:text-amber-600">
                          Admin Dashboard & Control
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        View, edit, verify, approve, and manage all worker submissions
                      </p>
                    </div>
                  </button>
                )}

                {/* Option 2: Emergency SOS & Feeder Safety */}
                <button
                  id="corner-opt-2-emergency"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenCornerOption('emergency_safety');
                  }}
                  className="w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-slate-50 transition-colors group cursor-pointer"
                >
                  <div className="p-2 rounded-lg mt-0.5 bg-red-100 text-red-700">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 group-hover:text-red-600">
                        Emergency SOS & Safety Hotline
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      WBSEDCL Breakdown Control, 19121 Helpline & Lineman PTW Protocol
                    </p>
                  </div>
                </button>

                {/* Option 3: Export Data & Daily Reports */}
                <button
                  id="corner-opt-3-export"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenCornerOption('export_reports');
                  }}
                  className="w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-slate-50 transition-colors group cursor-pointer"
                >
                  <div className="p-2 rounded-lg mt-0.5 bg-blue-100 text-blue-700">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600">
                        Data Export & Daily Sheets
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Download Excel / CSV, print daily log summary & backup data
                    </p>
                  </div>
                </button>
              </div>

              <div className="p-3 bg-slate-50 flex items-center justify-between gap-2 border-t border-slate-100">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    currentUser?.role === 'admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {currentUser?.role === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {cleanNameOnly(currentUser?.name || workerName || 'Worker')}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {currentUser?.designation || (isAdmin ? 'Admin Console' : 'Lineman / Field Operator')}
                    </p>
                  </div>
                </div>

                <button
                  id="dropdown-logout-btn"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogoutUser();
                  }}
                  className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-red-50 border border-red-200/60 transition-colors shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
