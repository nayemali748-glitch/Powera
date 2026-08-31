import React, { useState, useEffect, useCallback, useRef } from 'react';
import appLogo from './assets/images/power_round_logo_1787860440979.jpg';
import { Header } from './components/Header';
import { CategorySelector } from './components/CategorySelector';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { EntryForm } from './components/EntryForm';
import { AdminDashboard } from './components/AdminDashboard';
import { WorkerRecentSubmissions } from './components/WorkerRecentSubmissions';
import { CornerOptionsModal } from './components/CornerOptionsModal';
import { LoginScreen } from './components/LoginScreen';
import { InstallAppModal } from './components/InstallAppModal';
import { LanguageModal } from './components/LanguageModal';
import { HelpSupportModal } from './components/HelpSupportModal';
import { CategoryType, PowerEntry, ActiveTab, CornerOptionKey, UserSession } from './types';
import { fetchEntries, fetchStats, verifyUserSession } from './services/api';
import { Language, translations } from './utils/translations';
import { 
  Zap, 
  ShieldCheck, 
  Clock, 
  Layers, 
  Sparkles, 
  RefreshCw, 
  X, 
  Printer, 
  LayoutDashboard, 
  CheckCircle2, 
  ChevronRight,
  Radio,
  FileSpreadsheet,
  AlertTriangle,
  UserCheck,
  Home,
  ArrowLeft,
  Plus,
  LogOut,
  Download,
  Smartphone,
  Globe,
  BarChart3,
  TrendingUp,
  HelpCircle
} from 'lucide-react';

export default function App() {
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    return (localStorage.getItem('power_app_lang') as Language) || 'bn';
  });
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);

  const t = translations[currentLanguage] || translations.bn;

  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('power_user_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.idNo) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('entry');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('NSC');
  const [activeFormCategory, setActiveFormCategory] = useState<CategoryType | null>(null);
  const [entries, setEntries] = useState<PowerEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    const saved = localStorage.getItem('power_user_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.role === 'admin' || parsed.idNo === '8695716192')) return true;
      } catch {}
    }
    return localStorage.getItem('power_is_admin') === 'true';
  });
  const [workerName, setWorkerName] = useState<string>(() => {
    const saved = localStorage.getItem('power_user_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) return parsed.name;
      } catch {}
    }
    return localStorage.getItem('power_worker_name') || '';
  });
  const [cornerModalOption, setCornerModalOption] = useState<CornerOptionKey>(null);
  const [previewEntry, setPreviewEntry] = useState<PowerEntry | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  const currentUserRef = useRef<UserSession | null>(currentUser);
  currentUserRef.current = currentUser;

  const handleSelectLanguage = (lang: Language) => {
    setCurrentLanguage(lang);
    localStorage.setItem('power_app_lang', lang);
  };

  const handleUserLogout = useCallback(() => {
    localStorage.removeItem('power_user_session');
    localStorage.removeItem('power_is_admin');
    localStorage.removeItem('power_worker_name');
    setCurrentUser(null);
    setIsAdmin(false);
    setWorkerName('');
    setActiveTab('entry');
  }, []);

  const handleUserLoginSuccess = useCallback((session: UserSession) => {
    setCurrentUser(session);
    setWorkerName(session.name);
    try {
      localStorage.setItem('power_user_session', JSON.stringify(session));
      localStorage.setItem('power_worker_name', session.name);
      const userIsAdmin = session.role === 'admin' || session.idNo === '8695716192';
      setIsAdmin(userIsAdmin);
      localStorage.setItem('power_is_admin', userIsAdmin ? 'true' : 'false');
    } catch (e) {
      console.warn('Failed to save session to local storage:', e);
    }
  }, []);

  // Robust session verification against localStorage metadata and server synchronization
  useEffect(() => {
    // 1. Validate and reconcile local state against localStorage on mount
    const saved = localStorage.getItem('power_user_session');
    let activeSession: UserSession | null = null;
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.idNo) {
          activeSession = parsed;
          
          // Reconcile metadata in localStorage and React state to avoid any timing drops
          const shouldBeAdmin = parsed.role === 'admin' || parsed.idNo === '8695716192';
          const storedIsAdmin = localStorage.getItem('power_is_admin') === 'true';
          const storedWorkerName = localStorage.getItem('power_worker_name');

          if (shouldBeAdmin !== storedIsAdmin) {
            localStorage.setItem('power_is_admin', shouldBeAdmin ? 'true' : 'false');
            setIsAdmin(shouldBeAdmin);
          }
          if (parsed.name && parsed.name !== storedWorkerName) {
            localStorage.setItem('power_worker_name', parsed.name);
            setWorkerName(parsed.name);
          }
          if (!currentUserRef.current || currentUserRef.current.idNo !== parsed.idNo) {
            setCurrentUser(parsed);
          }
        }
      } catch (e) {
        console.warn('Session parse error from localStorage:', e);
      }
    }

    const sessionToVerify = activeSession || currentUserRef.current;
    if (!sessionToVerify || !sessionToVerify.idNo) return;
    
    // Master admin account bypass
    if (sessionToVerify.idNo === '8695716192') return;

    const performVerification = async () => {
      const current = currentUserRef.current;
      if (!current?.idNo || current.idNo === '8695716192') return;

      try {
        const result = await verifyUserSession(current.idNo);
        if (!result.valid) {
          alert(result.error || 'আপনার অ্যাকাউন্টটি মুছে ফেলা হয়েছে বা আর সক্রিয় নেই।');
          handleUserLogout();
          return;
        }
        
        if (result.status === 'hold') {
          alert('আপনার অ্যাকাউন্টটি এডমিন কর্তৃক সাময়িকভাবে স্থগিত (ON HOLD) করা হয়েছে।');
          handleUserLogout();
          return;
        }

        // Sync metadata without discarding persistent session
        let hasChanges = false;
        const updatedSession = { ...current };

        if (result.role && result.role !== current.role) {
          updatedSession.role = result.role as 'admin' | 'worker';
          hasChanges = true;
        }
        if (result.name && result.name !== current.name) {
          updatedSession.name = result.name;
          setWorkerName(result.name);
          localStorage.setItem('power_worker_name', result.name);
          hasChanges = true;
        }
        if (result.designation && result.designation !== current.designation) {
          updatedSession.designation = result.designation;
          hasChanges = true;
        }
        if (result.badgeNo && result.badgeNo !== current.badgeNo) {
          updatedSession.badgeNo = result.badgeNo;
          hasChanges = true;
        }

        if (hasChanges) {
          setCurrentUser(updatedSession);
          localStorage.setItem('power_user_session', JSON.stringify(updatedSession));
          const userIsAdmin = updatedSession.role === 'admin';
          setIsAdmin(userIsAdmin);
          localStorage.setItem('power_is_admin', userIsAdmin ? 'true' : 'false');
        }
      } catch (err) {
        // Retain persistent session if backend is slow/offline, preventing premature logout
        console.warn('Session verification fallback (offline/cached mode):', err);
      }
    };

    // Initial check on load
    performVerification();

    // Re-verify on focus and periodically
    const interval = setInterval(performVerification, 30000);
    window.addEventListener('focus', performVerification);

    // Cross-tab synchronization via Storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'power_user_session') {
        if (!e.newValue) {
          handleUserLogout();
        } else {
          try {
            const parsed = JSON.parse(e.newValue);
            if (parsed && parsed.idNo) {
              setCurrentUser(parsed);
              setWorkerName(parsed.name || '');
              const userIsAdmin = parsed.role === 'admin' || parsed.idNo === '8695716192';
              setIsAdmin(userIsAdmin);
            }
          } catch {}
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', performVerification);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [handleUserLogout]);

  // Capture Android/PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handlePromptInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }
  };

  // Clean stale demo items on mount
  useEffect(() => {
    const savedUsers = localStorage.getItem('power_registered_users');
    if (savedUsers) {
      try {
        const parsed = JSON.parse(savedUsers);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(
            (u: any) => u && u.idNo !== 'WRK-101' && u.idNo !== 'WBSEDCL-ADM-99'
          );
          if (filtered.length !== parsed.length) {
            localStorage.setItem('power_registered_users', JSON.stringify(filtered));
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchEntries();
      setEntries(data || []);
    } catch (err) {
      console.error('Failed to load power entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) {
      setActiveTab('entry');
    }
  }, [activeTab, isAdmin]);

  const handleEntrySuccess = (newEntry: PowerEntry) => {
    setEntries((prev) => [newEntry, ...prev]);
    setActiveFormCategory(null);
  };

  const handleAdminLogin = () => {
    setIsAdmin(true);
    localStorage.setItem('power_is_admin', 'true');
    setActiveTab('admin');
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('power_is_admin');
    setActiveTab('entry');
  };

  const handleExportCsv = () => {
    if (entries.length === 0) {
      alert('এক্সপোর্ট করার মতো কোনো ডাটা নেই');
      return;
    }

    const headers = [
      'ID', 'Date', 'Category', 'Worker Name', 'Feeder', 'Substation', 'Status',
      'Consumer Name', 'Consumer ID', 'Mobile', 'Address', 'Pole No', 'Applied Load',
      'Phase', 'Meter No', 'Initial Reading', 'Final Reading', 'Seal No',
      'Arrear Amount', 'Reason', 'Issue Type', 'Priority', 'Action Taken',
      'Material Used', 'Old Meter No', 'New Meter No', 'DTR Name', 'Existing Capacity',
      'New Capacity', 'Notes', 'GPS Coordinates'
    ];

    const rows = entries.map(e => [
      e.id,
      `"${e.date}"`,
      `"${e.category}"`,
      `"${e.workerName || ''}"`,
      `"${e.feederName || ''}"`,
      `"${e.substation || ''}"`,
      `"${e.status}"`,
      `"${e.consumerName || ''}"`,
      `"${e.consumerId || ''}"`,
      `"${e.mobile || ''}"`,
      `"${e.address || ''}"`,
      `"${e.poleNo || ''}"`,
      `"${e.appliedLoad || ''}"`,
      `"${e.phase || ''}"`,
      `"${e.meterNo || ''}"`,
      `"${e.initialReading || ''}"`,
      `"${e.finalReading || ''}"`,
      `"${e.sealNo || ''}"`,
      `"${e.arrearAmount || ''}"`,
      `"${e.reason || ''}"`,
      `"${e.issueType || ''}"`,
      `"${e.priority || ''}"`,
      `"${e.actionTaken || ''}"`,
      `"${e.materialUsed || ''}"`,
      `"${e.oldMeterNo || ''}"`,
      `"${e.newMeterNo || ''}"`,
      `"${e.dtrName || ''}"`,
      `"${e.existingCapacity || ''}"`,
      `"${e.newCapacity || ''}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      `"${e.locationGps || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `POWER_FIELD_EXPORT_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const navToCategory = (cat: CategoryType) => {
    setSelectedCategory(cat);
    setActiveFormCategory(cat);
    setActiveTab('entry');
    setSidebarOpen(false);
  };

  // Helper count badges
  const categoryCounts: Record<CategoryType, number> = {
    'NSC': entries.filter(e => e.category === 'NSC').length,
    'DISCONNECTION': entries.filter(e => e.category === 'DISCONNECTION').length,
    'POLE CASE': entries.filter(e => e.category === 'POLE CASE').length,
    'METER REPLESMENT': entries.filter(e => e.category === 'METER REPLESMENT').length,
    'DTR REPLESMENT': entries.filter(e => e.category === 'DTR REPLESMENT').length,
  };

  // If user is not logged in with ID & Password, display LoginScreen
  if (!currentUser) {
    return (
      <LoginScreen 
        onLoginSuccess={handleUserLoginSuccess}
        lang={currentLanguage}
        onOpenLanguageModal={() => setShowLanguageModal(true)}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-slate-100 font-sans antialiased">
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-xs md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* LEFT NAVIGATION SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out md:static md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand Header with Round Logo */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={appLogo} 
              alt="Power of Construction Logo" 
              className="w-10 h-10 rounded-full object-cover shadow-sm border-2 border-amber-400 p-0.5 bg-white shrink-0 ring-2 ring-slate-800"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white text-sm tracking-wide">{t.appName}</span>
                <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded">WBSEDCL</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">Field Utility Standard</p>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="px-4 py-3">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t.mainModules}</p>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          <button
            onClick={() => { setActiveTab('entry'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'entry'
                ? 'bg-slate-800 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Home className="w-4 h-4 text-amber-400" />
              <span>{t.dataEntry}</span>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">Home</span>
          </button>

          <button
            onClick={() => { setActiveTab('my-submissions'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'my-submissions'
                ? 'bg-slate-800 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>{t.mySubmissions}</span>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded">{entries.length}</span>
          </button>

          <button
            id="sidebar-nav-performance-btn"
            onClick={() => { setActiveTab('performance'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'performance'
                ? 'bg-slate-800 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span>{t.performanceDashboard}</span>
            </div>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-1.5 py-0.5 rounded">Live</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => { setActiveTab('admin'); setSidebarOpen(false); loadData(); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-slate-800 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{t.adminCenter}</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </button>
          )}

          {/* LANGUAGE OPTION INSIDE MAIN MODULES BELOW ADMIN CENTER */}
          <button
            id="sidebar-nav-language-btn"
            onClick={() => {
              setSidebarOpen(false);
              setShowLanguageModal(true);
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold text-blue-300 hover:text-white hover:bg-blue-500/10 border border-blue-500/30 transition-all cursor-pointer shadow-xs"
            title="ভাষা পরিবর্তন করুন (Change Language: Bengali, English, Hindi, Urdu)"
          >
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>{t.language}</span>
            </div>
            <span className="text-[9px] bg-blue-500/20 text-blue-300 font-bold px-1.5 py-0.5 rounded border border-blue-500/40 uppercase">
              {currentLanguage}
            </span>
          </button>

          {/* Install App Option inside MAIN MODULES below Language */}
          <button
            id="sidebar-nav-install-app-btn"
            onClick={() => {
              setSidebarOpen(false);
              setShowInstallModal(true);
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold text-amber-300 hover:text-white hover:bg-amber-500/10 border border-amber-500/30 transition-all cursor-pointer shadow-xs"
            title="অ্যান্ড্রয়েড ফোনে অ্যাপ ইনস্টল করুন"
          >
            <div className="flex items-center gap-3">
              <Download className="w-4 h-4 text-amber-400" />
              <span>{t.installApp}</span>
            </div>
            <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/40">
              Android
            </span>
          </button>

          {/* Help & Support Option inside MAIN MODULES (Live Chat & Email Support) */}
          <button
            id="sidebar-nav-help-support-btn"
            onClick={() => {
              setSidebarOpen(false);
              setShowHelpModal(true);
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold text-emerald-300 hover:text-white hover:bg-emerald-500/10 border border-emerald-500/30 transition-all cursor-pointer shadow-xs"
            title="হেল্প ও সাপোর্ট (Email: powerof2026@gmail.com & Admin Live Chat)"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span>{t.helpSupport}</span>
            </div>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/40">
              Live Chat
            </span>
          </button>

          {/* Direct Logout Option Right Below Help & Support */}
          <button
            id="sidebar-nav-logout-btn"
            onClick={() => {
              setSidebarOpen(false);
              handleUserLogout();
            }}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/30 transition-all cursor-pointer"
            title="একাউন্ট থেকে লগআউট করুন"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-4 h-4 text-red-400" />
              <span>{t.logout}</span>
            </div>
            <span className="text-[9px] bg-red-950 text-red-400 font-mono px-1.5 py-0.5 rounded border border-red-900/40">Exit</span>
          </button>

          <div className="pt-4 pb-2">
            <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t.fiveCategories}</p>
          </div>

          <button
            onClick={() => navToCategory('NSC')}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeFormCategory === 'NSC' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>1. NSC</span>
            </div>
            <span className="text-[10px] text-slate-500">{categoryCounts['NSC']}</span>
          </button>

          <button
            onClick={() => navToCategory('DISCONNECTION')}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeFormCategory === 'DISCONNECTION' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span>2. DISCONNECTION</span>
            </div>
            <span className="text-[10px] text-slate-500">{categoryCounts['DISCONNECTION']}</span>
          </button>

          <button
            onClick={() => navToCategory('POLE CASE')}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeFormCategory === 'POLE CASE' ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
              <span>3. POLE CASE</span>
            </div>
            <span className="text-[10px] text-slate-500">{categoryCounts['POLE CASE']}</span>
          </button>

          <button
            onClick={() => navToCategory('METER REPLESMENT')}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeFormCategory === 'METER REPLESMENT' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>4. METER REPLESMENT</span>
            </div>
            <span className="text-[10px] text-slate-500">{categoryCounts['METER REPLESMENT']}</span>
          </button>

          <button
            onClick={() => navToCategory('DTR REPLESMENT')}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeFormCategory === 'DTR REPLESMENT' ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
              <span>5. DTR REPLESMENT</span>
            </div>
            <span className="text-[10px] text-slate-500">{categoryCounts['DTR REPLESMENT']}</span>
          </button>
        </nav>

        {/* User / Admin Profile & Logout at Bottom */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                currentUser.role === 'admin' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-blue-950 text-blue-400 border border-blue-800'
              }`}>
                {currentUser.role === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              </div>
              <div className="text-xs overflow-hidden">
                <p className="text-white font-bold leading-tight truncate">{currentUser.name}</p>
                <p className="text-slate-400 text-[10px] truncate">{currentUser.designation}</p>
              </div>
            </div>

            <button
              onClick={handleUserLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer"
              title="লগআউট করুন (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT (Top Header + Scrollable Content) */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Top Operations Header */}
        <Header
          isAdmin={isAdmin}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          workerName={workerName}
          setWorkerName={setWorkerName}
          currentUser={currentUser}
          onOpenCornerOption={(opt) => setCornerModalOption(opt)}
          onLogoutAdmin={handleAdminLogout}
          onLogoutUser={handleUserLogout}
          totalEntriesCount={entries.length}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          currentLanguage={currentLanguage}
          onOpenLanguageModal={() => setShowLanguageModal(true)}
        />

        {/* Content Container */}
        <section className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* VIEW 1: DATA ENTRY VIEW (HOME PAGE) */}
          {activeTab === 'entry' && (
            <div className="space-y-6">
              {/* If no form is currently opened inside, show the 5 Categories and Worker Overview */}
              {activeFormCategory === null ? (
                <div className="space-y-6">
                  {/* CLICKABLE PERFORMANCE DASHBOARD OPTION (Above Work Category Selection) */}
                  <div 
                    onClick={() => setActiveTab('performance')}
                    className="bg-linear-to-r from-blue-900/90 via-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 border border-blue-500/30 shadow-md hover:shadow-xl hover:border-blue-400/60 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('performance'); }}
                  >
                    {/* Background glow accents */}
                    <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/20 transition-all"></div>
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                      {/* Left: Icon, Title, Subtitle, Live Badge */}
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center shadow-inner shrink-0 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all">
                          <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm sm:text-base font-black tracking-wide text-white flex items-center gap-1.5 uppercase">
                              <span>{t.performanceDashboard}</span>
                            </h2>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              LIVE METRICS
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
                            {currentLanguage === 'bn' 
                              ? 'ক্লিক করে ৫টি ক্যাটাগরির রিয়েল-টাইম কাজের পারফরম্যান্স ড্যাশবোর্ড দেখুন' 
                              : 'Click to view real-time field performance & operational metrics'}
                          </p>
                        </div>
                      </div>

                      {/* Right: Quick Micro-Stats & Action CTA Button */}
                      <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                        {/* Micro Stats Pills */}
                        <div className="hidden sm:flex items-center gap-2 text-xs">
                          <div className="bg-slate-800/80 border border-slate-700/80 px-2.5 py-1.5 rounded-lg text-slate-200 text-center">
                            <span className="text-[10px] text-slate-400 block leading-tight">Total</span>
                            <strong className="text-white font-bold">{entries.length}</strong>
                          </div>
                          <div className="bg-slate-800/80 border border-slate-700/80 px-2.5 py-1.5 rounded-lg text-emerald-300 text-center">
                            <span className="text-[10px] text-slate-400 block leading-tight">Status</span>
                            <strong className="font-bold">Active</strong>
                          </div>
                        </div>

                        {/* CTA Open Button */}
                        <div className="px-4 py-2.5 bg-blue-600 group-hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all">
                          <span>{currentLanguage === 'bn' ? 'ড্যাশবোর্ড খুলুন' : 'Open Dashboard'}</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5 Work Category Cards Selector */}
                  <CategorySelector
                    selectedCategory={selectedCategory}
                    onSelectCategory={(cat) => {
                      setSelectedCategory(cat);
                      setActiveFormCategory(cat);
                    }}
                    categoryCounts={categoryCounts}
                    currentLanguage={currentLanguage}
                  />

                  {/* Clean Helper Card & Recent Submissions */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold">
                          <Zap className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900">
                            {t.appSubtitle}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {t.selectCategory} (NSC, DISCONNECTION, POLE CASE, METER, DTR)
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedCategory('NSC');
                            setActiveFormCategory('NSC');
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>NSC Form</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-600" />
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                            {t.recordsCount} ({entries.length})
                          </h4>
                        </div>
                      </div>
                      <WorkerRecentSubmissions
                        entries={entries.slice(0, 6)}
                        workerName={workerName}
                        currentUser={currentUser}
                        onLogout={handleUserLogout}
                        onSelectEntry={(entry) => setPreviewEntry(entry)}
                        onNewEntry={() => {
                          setSelectedCategory('NSC');
                          setActiveFormCategory('NSC');
                        }}
                        lang={currentLanguage}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* INSIDE FORM VIEW */
                <div className="space-y-4">
                  {/* Category Switcher & Back Navigation Bar */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setActiveFormCategory(null)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>← {t.filterAll} {t.fiveCategories}</span>
                      </button>
                      <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>
                      <span className="text-xs font-bold text-slate-700 hidden sm:inline">
                        {t.category}: <span className="text-blue-600 font-black">{activeFormCategory}</span>
                      </span>
                    </div>

                    {/* Quick Switch Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
                      {(['NSC', 'DISCONNECTION', 'POLE CASE', 'METER REPLESMENT', 'DTR REPLESMENT'] as CategoryType[]).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => {
                            setSelectedCategory(cat);
                            setActiveFormCategory(cat);
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                            activeFormCategory === cat
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Form customized for the selected category */}
                  <EntryForm
                    category={activeFormCategory}
                    workerName={workerName}
                    currentUser={currentUser}
                    onSuccess={(newEntry) => {
                      handleEntrySuccess(newEntry);
                    }}
                    onBack={() => setActiveFormCategory(null)}
                    lang={currentLanguage}
                  />
                </div>
              )}
            </div>
          )}

          {/* VIEW: PERFORMANCE DASHBOARD (DEDICATED FULL VIEW) */}
          {activeTab === 'performance' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Back to Home & Actions Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('entry')}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{currentLanguage === 'bn' ? '← হোম স্ক্রিনে ফিরে যান' : '← Back to Home'}</span>
                  </button>
                  <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>{t.performanceDashboard}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Live Analytics
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      {currentLanguage === 'bn' ? 'WBSEDCL ৫টি ক্যাটাগরির কাজের বিস্তারিত রিপোর্ট' : 'WBSEDCL 5 Categories Field Performance Report'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadData}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCategory('NSC');
                      setActiveFormCategory('NSC');
                      setActiveTab('entry');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ New Entry</span>
                  </button>
                </div>
              </div>

              {/* Full Performance Dashboard Component */}
              <PerformanceDashboard
                entries={entries}
                categoryCounts={categoryCounts}
                onSelectCategory={(cat) => {
                  setSelectedCategory(cat);
                  setActiveFormCategory(cat);
                  setActiveTab('entry');
                }}
                currentLanguage={currentLanguage}
              />

              {/* Recent Activity in Performance view */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-600" />
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
                      {t.recordsCount} ({entries.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">All Field Logs</span>
                </div>

                <WorkerRecentSubmissions
                  entries={entries}
                  workerName={workerName}
                  currentUser={currentUser}
                  onLogout={handleUserLogout}
                  onSelectEntry={(entry) => setPreviewEntry(entry)}
                  onNewEntry={() => {
                    setSelectedCategory('NSC');
                    setActiveFormCategory('NSC');
                    setActiveTab('entry');
                  }}
                  lang={currentLanguage}
                />
              </div>
            </div>
          )}

          {/* VIEW 2: ADMIN DASHBOARD (EXCLUSIVELY FOR LOGGED-IN ADMINS) */}
          {activeTab === 'admin' && isAdmin && (
            <div>
              <AdminDashboard
                entries={entries}
                onRefresh={loadData}
                onExportCsv={handleExportCsv}
                onLogout={handleUserLogout}
                lang={currentLanguage}
                onOpenLanguageModal={() => setShowLanguageModal(true)}
              />
            </div>
          )}

          {/* VIEW 3: WORKER'S RECENT SUBMISSIONS (MAIN MODULE) */}
          {activeTab === 'my-submissions' && (
            <div className="space-y-6">
              <WorkerRecentSubmissions
                entries={entries}
                workerName={workerName}
                currentUser={currentUser}
                onLogout={handleUserLogout}
                onSelectEntry={(entry) => setPreviewEntry(entry)}
                onNewEntry={() => setActiveTab('entry')}
                lang={currentLanguage}
              />
            </div>
          )}
        </section>
      </main>

      {/* Modal for Corner 3 Options */}
      <CornerOptionsModal
        activeOption={cornerModalOption}
        onClose={() => setCornerModalOption(null)}
        isAdmin={isAdmin}
        onLoginAdmin={handleAdminLogin}
        onLogoutAdmin={handleAdminLogout}
        onSwitchToAdminTab={() => setActiveTab('admin')}
        entries={entries}
        onExportCsv={handleExportCsv}
      />

      {/* Language Selector Modal */}
      <LanguageModal
        isOpen={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        currentLanguage={currentLanguage}
        onSelectLanguage={handleSelectLanguage}
      />

      {/* Android & PWA App Install Modal */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
        onPromptInstall={handlePromptInstall}
      />

      {/* Help & Support Modal (Live Chat with Admin + Email to powerof2026@gmail.com) */}
      <HelpSupportModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        currentUser={currentUser}
        lang={currentLanguage}
      />

      {/* Quick Preview & Slip Modal */}
      {previewEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900">{previewEntry.id}</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {previewEntry.category}
                </span>
              </div>
              <button
                onClick={() => setPreviewEntry(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div><strong className="text-slate-800">Consumer / Site:</strong> {previewEntry.consumerName || previewEntry.dtrName || previewEntry.poleNo}</div>
              <div><strong className="text-slate-800">Worker:</strong> {previewEntry.workerName}</div>
              <div><strong className="text-slate-800">Date:</strong> {new Date(previewEntry.date).toLocaleString()}</div>
              <div><strong className="text-slate-800">Feeder:</strong> {previewEntry.feederName}</div>
              {previewEntry.notes && <div><strong className="text-slate-800">Notes:</strong> {previewEntry.notes}</div>}
            </div>

            <div className="flex gap-2 pt-2">
              {isAdmin && (
                <button
                  onClick={() => {
                    setPreviewEntry(null);
                    setActiveTab('admin');
                  }}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  View in Admin Console
                </button>
              )}
              <button
                onClick={() => setPreviewEntry(null)}
                className={`py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer ${
                  isAdmin ? 'px-4' : 'w-full'
                }`}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
