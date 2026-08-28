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
  Globe
} from 'lucide-react';
import { CornerOptionKey, UserSession } from '../types';
import { Language, translations } from '../utils/translations';

interface HeaderProps {
  isAdmin: boolean;
  activeTab: 'entry' | 'admin' | 'my-submissions';
  setActiveTab: (tab: 'entry' | 'admin' | 'my-submissions') => void;
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
  currentLanguage = 'bn',
  onOpenLanguageModal,
}) => {
  const t = translations[currentLanguage] || translations.bn;
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

  const getLangBadge = (code: Language) => {
    switch (code) {
      case 'en': return 'EN';
      case 'hi': return 'HI';
      case 'ur': return 'UR';
      default: return 'বাং';
    }
  };

  return (
    <header className="h-16 sm:h-20 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 z-30 shadow-xs">
      {/* Left Title & System Status */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-3">
          <img 
            src={appLogo} 
            alt="Power of Construction Round Logo" 
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover shadow-sm border-2 border-amber-400 p-0.5 bg-white shrink-0 ring-2 ring-slate-100"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-bold text-blue-600 leading-none">
                {t.appName}
              </h1>
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full text-[9px] font-bold tracking-wide uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>
                Live
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block font-medium">
              POWER OF CONSTRUCTION • WBSEDCL
            </p>
          </div>
        </div>
      </div>

      {/* Center/Right Nav Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Navigation Tabs (Quick Switch) */}
        <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            id="nav-tab-home"
            onClick={() => setActiveTab('entry')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'entry'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Home className="w-3.5 h-3.5 text-amber-500" />
            <span>Home</span>
          </button>

          <button
            id="nav-tab-submissions"
            onClick={() => setActiveTab('my-submissions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'my-submissions'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-sky-500" />
            <span>{t.mySubmissions}</span>
          </button>

          {isAdmin && (
            <button
              id="nav-tab-admin"
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Admin ({totalEntriesCount})</span>
            </button>
          )}
        </div>

        {/* Worker / User Badge */}
        <div className="hidden md:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            currentUser?.role === 'admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {currentUser?.role === 'admin' ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : (
              <UserCheck className="w-3.5 h-3.5" />
            )}
          </div>
          {editingWorker ? (
            <form onSubmit={handleSaveWorkerName} className="flex items-center gap-1">
              <input
                type="text"
                value={tempWorkerName}
                onChange={(e) => setTempWorkerName(e.target.value)}
                className="bg-white text-slate-900 text-xs px-2 py-0.5 rounded border border-blue-500 w-32 focus:outline-none"
                autoFocus
                placeholder="আপনার নাম"
              />
              <button type="submit" className="text-blue-600 text-xs font-bold hover:underline">
                OK
              </button>
            </form>
          ) : (
            <div 
              onClick={() => {
                setTempWorkerName(workerName);
                setEditingWorker(true);
              }}
              className="cursor-pointer hover:text-blue-600 flex items-center gap-1.5"
              title="Click to edit worker name"
            >
              <div className="leading-tight">
                <div className="font-bold text-slate-800 max-w-[120px] truncate">
                  {currentUser?.name || workerName || 'Worker'}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <span>{currentUser?.designation || (isAdmin ? 'Admin' : 'Lineman / Field Operator')}</span>
                  {currentUser?.badgeNo && (
                    <span className="text-[9px] font-mono text-slate-400">({currentUser.badgeNo})</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Home Button with House Symbol */}
        <button
          id="header-home-btn"
          onClick={() => setActiveTab('entry')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border cursor-pointer ${
            activeTab === 'entry'
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-600/30 shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 shadow-xs'
          }`}
          title="Back to Home"
        >
          <Home className="w-4 h-4 text-slate-950" />
          <span>Home</span>
        </button>

        {/* Tools and Utility Menu */}
        <div className="relative" ref={menuRef}>
          <button
            id="header-tools-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-all flex items-center justify-center cursor-pointer"
            title="Options Menu"
            aria-label="Options menu"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Dropdown Menu for Quick Tools & Options (in English & Indian WBSEDCL Standard) */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-slate-100">
              <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    POWER • Options & Tools
                  </span>
                </div>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold">
                  WBSEDCL
                </span>
              </div>

              <div className="py-1">
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
                      {currentUser?.name || workerName || 'Worker'}
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
