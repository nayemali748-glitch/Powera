import React, { useState, useEffect } from 'react';
import appLogo from './assets/images/power_round_logo_1787860440979.jpg';
import { Header } from './components/Header';
import { CategorySelector } from './components/CategorySelector';
import { EntryForm } from './components/EntryForm';
import { AdminDashboard } from './components/AdminDashboard';
import { WorkerRecentSubmissions } from './components/WorkerRecentSubmissions';
import { CornerOptionsModal } from './components/CornerOptionsModal';
import { LoginScreen } from './components/LoginScreen';
import { CategoryType, PowerEntry, ActiveTab, CornerOptionKey, UserSession } from './types';
import { fetchEntries, fetchStats } from './services/api';
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
  LogOut
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('power_user_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.idNo) return parsed;
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
    return localStorage.getItem('power_is_admin') === 'true';
  });
  const [workerName, setWorkerName] = useState<string>(() => {
    return localStorage.getItem('power_worker_name') || '';
  });
  const [cornerModalOption, setCornerModalOption] = useState<CornerOptionKey>(null);
  const [previewEntry, setPreviewEntry] = useState<PowerEntry | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Clean stale demo items on mount
  useEffect(() => {
    // Purge old demo users from registered users if they exist
    const savedUsers = localStorage.getItem('power_registered_users');
    if (savedUsers) {
      try {
        const parsed = JSON.parse(savedUsers);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(u => u.idNo !== 'wrk_001' && u.idNo !== 'wrk_002' && !u.id?.startsWith('wrk_00'));
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('power_registered_users', JSON.stringify(cleaned));
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // Purge old demo records (PWR-1001 to PWR-1005) from local cache
    const cachedEntries = localStorage.getItem('power_app_entries_cache');
    if (cachedEntries) {
      try {
        const parsed = JSON.parse(cachedEntries);
        if (Array.isArray(parsed)) {
          const nonDemo = parsed.filter(e => !['PWR-1001', 'PWR-1002', 'PWR-1003', 'PWR-1004', 'PWR-1005'].includes(e.id));
          if (nonDemo.length !== parsed.length) {
            localStorage.setItem('power_app_entries_cache', JSON.stringify(nonDemo));
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Load initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchEntries();
      setEntries(data);
    } catch (err) {
      console.error('Failed to load power records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEntrySuccess = (newEntry: PowerEntry) => {
    setEntries((prev) => [newEntry, ...prev.filter(e => e.id !== newEntry.id)]);
  };

  const handleUserLogin = (session: UserSession) => {
    setCurrentUser(session);
    setWorkerName(session.name);
    setIsAdmin(session.role === 'admin');
    localStorage.setItem('power_user_session', JSON.stringify(session));
    localStorage.setItem('power_worker_name', session.name);
    if (session.role === 'admin') {
      localStorage.setItem('power_is_admin', 'true');
      setActiveTab('admin');
    } else {
      localStorage.removeItem('power_is_admin');
      setActiveTab('entry');
    }
  };

  const handleUserLogout = () => {
    setCurrentUser(null);
    setIsAdmin(false);
    localStorage.removeItem('power_user_session');
    localStorage.removeItem('power_is_admin');
    setActiveTab('entry');
    setActiveFormCategory(null);
  };

  const handleAdminLogin = (pin: string): boolean => {
    if (pin === '1234' || pin === 'admin' || pin === 'power123') {
      setIsAdmin(true);
      localStorage.setItem('power_is_admin', 'true');
      if (currentUser) {
        const updated: UserSession = {
          ...currentUser,
          role: 'admin',
          designation: 'এডমিন কন্ট্রোলার / প্রকৌশলী'
        };
        setCurrentUser(updated);
        localStorage.setItem('power_user_session', JSON.stringify(updated));
      }
      return true;
    }
    return false;
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('power_is_admin');
    if (currentUser) {
      const updated: UserSession = {
        ...currentUser,
        role: 'worker',
        designation: 'লাইনম্যান'
      };
      setCurrentUser(updated);
      localStorage.setItem('power_user_session', JSON.stringify(updated));
    }
    if (activeTab === 'admin') {
      setActiveTab('entry');
    }
  };

  // Export full CSV for admin/workers
  const handleExportCsv = () => {
    if (entries.length === 0) {
      alert('কোনো ডাটা পাওয়া যায়নি।');
      return;
    }

    const headers = [
      'Work ID',
      'Category',
      'Date',
      'Status',
      'Worker Name',
      'Consumer Name',
      'Consumer ID',
      'Mobile',
      'Address',
      'Feeder',
      'Pole No',
      'Applied Load',
      'Phase',
      'Meter No',
      'Initial Reading',
      'Seal No',
      'Arrear Amount',
      'Disconnection Reason',
      'Final Reading',
      'Pole Issue Type',
      'Priority',
      'Action Taken',
      'Old Meter No',
      'New Meter No',
      'Meter Reason',
      'DTR Name',
      'Existing Capacity',
      'New Capacity',
      'Old DTR Serial',
      'New DTR Serial',
      'GPS Location',
      'Notes'
    ];

    const rows = entries.map(e => [
      `"${e.id || ''}"`,
      `"${e.category || ''}"`,
      `"${new Date(e.date).toLocaleString()}"`,
      `"${e.status || ''}"`,
      `"${e.workerName || ''}"`,
      `"${e.consumerName || ''}"`,
      `"${e.consumerId || ''}"`,
      `"${e.mobile || ''}"`,
      `"${(e.address || '').replace(/"/g, '""')}"`,
      `"${e.feederName || ''}"`,
      `"${e.poleNo || ''}"`,
      `"${e.appliedLoad || ''}"`,
      `"${e.phase || ''}"`,
      `"${e.meterNo || ''}"`,
      `"${e.initialReading || ''}"`,
      `"${e.sealNo || ''}"`,
      `"${e.arrearAmount || ''}"`,
      `"${(e.reason || '').replace(/"/g, '""')}"`,
      `"${e.finalReading || ''}"`,
      `"${(e.issueType || '').replace(/"/g, '""')}"`,
      `"${e.priority || ''}"`,
      `"${(e.actionTaken || '').replace(/"/g, '""')}"`,
      `"${e.oldMeterNo || ''}"`,
      `"${e.newMeterNo || ''}"`,
      `"${(e.replacementReason || '').replace(/"/g, '""')}"`,
      `"${e.dtrName || ''}"`,
      `"${e.existingCapacity || ''}"`,
      `"${e.newCapacity || ''}"`,
      `"${e.oldDtrSerial || ''}"`,
      `"${e.newDtrSerial || ''}"`,
      `"${e.locationGps || ''}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `POWER_Field_Records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate category counts
  const categoryCounts = {
    'NSC': entries.filter(e => e.category === 'NSC').length,
    'DISCONNECTION': entries.filter(e => e.category === 'DISCONNECTION').length,
    'POLE CASE': entries.filter(e => e.category === 'POLE CASE').length,
    'METER REPLESMENT': entries.filter(e => e.category === 'METER REPLESMENT').length,
    'DTR REPLESMENT': entries.filter(e => e.category === 'DTR REPLESMENT').length,
  };

  const navToCategory = (cat: CategoryType) => {
    setSelectedCategory(cat);
    setActiveFormCategory(cat);
    setActiveTab('entry');
    setSidebarOpen(false);
  };

  // If user is not logged in, show the Login / Auth Screen
  if (!currentUser) {
    return <LoginScreen onLogin={handleUserLogin} />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* PROFESSIONAL POLISH SIDEBAR (Desktop & Mobile Drawer) */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs md:hidden"
        />
      )}

      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 flex flex-col transition-transform duration-200 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-800 bg-slate-950/40">
          <div 
            onClick={() => { setActiveTab('entry'); setSidebarOpen(false); }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="relative">
              <img 
                src={appLogo} 
                alt="Power of Construction Round Logo" 
                className="w-11 h-11 rounded-full object-cover shadow-lg border-2 border-amber-400 group-hover:scale-105 transition-transform shrink-0 ring-2 ring-amber-400/20"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                POWER
              </span>
              <p className="text-[10px] uppercase font-bold tracking-wider text-amber-400">ESTD 2026</p>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Nav Links */}
        <div className="px-4 py-3">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Main Modules</p>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          <button
            onClick={() => { setActiveTab('entry'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'entry'
                ? 'bg-slate-800 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Home className="w-4 h-4 text-amber-400" />
              <span>Home (এন্ট্রি পোর্টাল)</span>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">Home</span>
          </button>

          <button
            onClick={() => { setActiveTab('my-submissions'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'my-submissions'
                ? 'bg-slate-800 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>My Submissions</span>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded">{entries.length}</span>
          </button>

          {/* Direct Logout Option Right Below My Submissions */}
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
              <span>লগআউট (Logout)</span>
            </div>
            <span className="text-[9px] bg-red-950 text-red-400 font-mono px-1.5 py-0.5 rounded border border-red-900/40">Exit</span>
          </button>

          <button
            onClick={() => { setActiveTab('admin'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'admin'
                ? 'bg-slate-800 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Admin Center</span>
            </div>
            {isAdmin && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
          </button>

          <div className="pt-4 pb-2">
            <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">5 Categories</p>
          </div>

          <button
            onClick={() => navToCategory('NSC')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'entry' && selectedCategory === 'NSC' ? 'bg-amber-500/15 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="truncate">1. NSC (New Connection)</span>
            <span className="text-[10px] text-slate-400 font-mono">{categoryCounts['NSC']}</span>
          </button>

          <button
            onClick={() => navToCategory('DISCONNECTION')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'entry' && selectedCategory === 'DISCONNECTION' ? 'bg-rose-500/15 text-rose-300 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="truncate">2. Disconnections</span>
            <span className="text-[10px] text-slate-400 font-mono">{categoryCounts['DISCONNECTION']}</span>
          </button>

          <button
            onClick={() => navToCategory('POLE CASE')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'entry' && selectedCategory === 'POLE CASE' ? 'bg-sky-500/15 text-sky-300 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="truncate">3. Pole Cases</span>
            <span className="text-[10px] text-slate-400 font-mono">{categoryCounts['POLE CASE']}</span>
          </button>

          <button
            onClick={() => navToCategory('METER REPLESMENT')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'entry' && selectedCategory === 'METER REPLESMENT' ? 'bg-emerald-500/15 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="truncate">4. Meter Replacement</span>
            <span className="text-[10px] text-slate-400 font-mono">{categoryCounts['METER REPLESMENT']}</span>
          </button>

          <button
            onClick={() => navToCategory('DTR REPLESMENT')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'entry' && selectedCategory === 'DTR REPLESMENT' ? 'bg-violet-500/15 text-violet-300 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="truncate">5. DTR Maintenance</span>
            <span className="text-[10px] text-slate-400 font-mono">{categoryCounts['DTR REPLESMENT']}</span>
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
        />

        {/* Content Container */}
        <section className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* VIEW 1: DATA ENTRY VIEW (HOME PAGE) */}
          {activeTab === 'entry' && (
            <div className="space-y-6">
              {/* If no form is currently opened inside, show the 5 Categories and Worker Overview */}
              {activeFormCategory === null ? (
                <div className="space-y-6">
                  {/* 5 Work Category Cards Selector */}
                  <CategorySelector
                    selectedCategory={selectedCategory}
                    onSelectCategory={(cat) => {
                      setSelectedCategory(cat);
                      setActiveFormCategory(cat);
                    }}
                    categoryCounts={categoryCounts}
                  />

                  {/* Clean Helper Card & Recent Submissions (No bottom form permanently open) */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold">
                          <Zap className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900">
                            বিদ্যুৎ কাজের ফিল্ড ডাটা এন্ট্রি পোর্টাল
                          </h3>
                          <p className="text-xs text-slate-500">
                            উপরের <strong>NSC</strong> অথবা যেকোনো কাজের ক্যাটাগরিতে ক্লিক করলে সরাসরি সেই ফরমটি খুলবে।
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedCategory('NSC');
                            setActiveFormCategory('NSC');
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>NSC ফরম খুলুন</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-600" />
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                            আপনার সাম্প্রতিক কাজের তালিকা ({entries.length})
                          </h4>
                        </div>
                      </div>
                      <WorkerRecentSubmissions
                        entries={entries.slice(0, 6)}
                        workerName={workerName}
                        onSelectEntry={(entry) => setPreviewEntry(entry)}
                        onNewEntry={() => {
                          setSelectedCategory('NSC');
                          setActiveFormCategory('NSC');
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* INSIDE FORM VIEW: Opened inside when clicking NSC or any category */
                <div className="space-y-4">
                  {/* Category Switcher & Back Navigation Bar */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setActiveFormCategory(null)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>← সব ক্যাটাগরি</span>
                      </button>
                      <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>
                      <span className="text-xs font-bold text-slate-700 hidden sm:inline">
                        বর্তমান ফরম: <span className="text-blue-600 font-black">{activeFormCategory}</span>
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
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-all ${
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
                    onSuccess={(newEntry) => {
                      handleEntrySuccess(newEntry);
                    }}
                    onBack={() => setActiveFormCategory(null)}
                  />
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: ADMIN DASHBOARD */}
          {activeTab === 'admin' && (
            <div>
              {isAdmin ? (
                <AdminDashboard
                  entries={entries}
                  onRefresh={loadData}
                  onExportCsv={handleExportCsv}
                  onLogout={handleUserLogout}
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto my-8 space-y-4 shadow-sm">
                  <div className="w-14 h-14 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Admin Authentication Required</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Sign in with your 4-digit PIN code to view and manage all worker submissions.
                    </p>
                  </div>
                  <button
                    onClick={() => setCornerModalOption('admin_portal')}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-xs shadow-xs transition-colors"
                  >
                    Open Admin Login Panel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: WORKER'S RECENT SUBMISSIONS (MAIN MODULE) */}
          {activeTab === 'my-submissions' && (
            <div className="space-y-6">
              {/* Metrics Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">Total Work Entries</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{entries.length}</p>
                  <div className="flex items-center gap-1 text-emerald-600 text-xs mt-2 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Real-time Synced</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">Active NSC Connections</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{categoryCounts['NSC']}</p>
                  <div className="flex items-center gap-1 text-blue-600 text-xs mt-2 font-medium">
                    <span>New meters registered</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">Poles & Lines Maintained</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{categoryCounts['POLE CASE']}</p>
                  <div className="flex items-center gap-1 text-amber-600 text-xs mt-2 font-medium">
                    <span>Field issues tracked</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">Meter & DTR Replacements</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                    {categoryCounts['METER REPLESMENT'] + categoryCounts['DTR REPLESMENT']}
                  </p>
                  <div className="flex items-center gap-1 text-slate-500 text-xs mt-2 font-medium">
                    <span>Verified with serials</span>
                  </div>
                </div>
              </div>

              <WorkerRecentSubmissions
                entries={entries}
                workerName={workerName}
                currentUser={currentUser}
                onLogout={handleUserLogout}
                onSelectEntry={(entry) => setPreviewEntry(entry)}
                onNewEntry={() => setActiveTab('entry')}
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
                className="p-1 text-slate-400 hover:text-slate-700"
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
              <button
                onClick={() => {
                  setPreviewEntry(null);
                  setActiveTab('admin');
                }}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-xs transition-colors"
              >
                View in Admin Console
              </button>
              <button
                onClick={() => setPreviewEntry(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

